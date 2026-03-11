import { Router, Request, Response } from 'express';
import slugify from 'slugify';
import { ContentType } from '../models/ContentType';
import { ContentEntry } from '../models/ContentEntry';
import { requireAuth, resolveTenant } from '../middleware/auth';
import { validateEntryData } from '../services/validate';

const router = Router({ mergeParams: true });

// GET /entries/:siteId/:typeSlug — list entries
router.get('/:typeSlug', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const { siteId, typeSlug } = req.params;
  const { published, limit = '50', offset = '0', ...filters } = req.query;

  const query: Record<string, any> = { siteId, contentTypeSlug: typeSlug };

  if (published !== undefined) {
    query.published = published === 'true';
  }

  // Allow filtering by any data field (select/boolean fields)
  for (const [key, value] of Object.entries(filters)) {
    if (value === 'true') query[`data.${key}`] = true;
    else if (value === 'false') query[`data.${key}`] = false;
    else query[`data.${key}`] = value;
  }

  const entries = await ContentEntry.find(query)
    .sort({ createdAt: -1 })
    .skip(Number(offset))
    .limit(Number(limit));

  const total = await ContentEntry.countDocuments(query);

  res.json({ entries, total, limit: Number(limit), offset: Number(offset) });
});

// POST /entries/:siteId/:typeSlug — create entry
router.post('/:typeSlug', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, typeSlug } = req.params;
  const { slug: rawSlug, data, published } = req.body;

  const contentType = await ContentType.findOne({ siteId, slug: typeSlug });
  if (!contentType) {
    res.status(404).json({ error: 'Content type not found' });
    return;
  }

  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'data object is required' });
    return;
  }

  const { valid, errors } = validateEntryData(data, contentType.fields);
  if (!valid) {
    res.status(422).json({ error: 'Validation failed', errors });
    return;
  }

  // Generate slug from title field or use provided slug
  let slug = rawSlug
    ? slugify(rawSlug, { lower: true, strict: true })
    : slugify(data.title || data.name || `entry-${Date.now()}`, { lower: true, strict: true });

  // Ensure unique slug
  const existing = await ContentEntry.findOne({ siteId, contentTypeSlug: typeSlug, slug });
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const entry = await ContentEntry.create({
    siteId,
    contentTypeId: contentType._id,
    contentTypeSlug: typeSlug,
    slug,
    published: published ?? false,
    data,
  });

  res.status(201).json(entry);
});

// GET /entries/:siteId/:typeSlug/:slug — get single entry
router.get('/:typeSlug/:slug', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const entry = await ContentEntry.findOne({
    siteId: req.params.siteId,
    contentTypeSlug: req.params.typeSlug,
    slug: req.params.slug,
  });

  if (!entry) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  res.json(entry);
});

// PATCH /entries/:siteId/:typeSlug/:slug — update entry
router.patch('/:typeSlug/:slug', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, typeSlug, slug } = req.params;
  const { data, published } = req.body;

  const contentType = await ContentType.findOne({ siteId, slug: typeSlug });
  if (!contentType) {
    res.status(404).json({ error: 'Content type not found' });
    return;
  }

  const entry = await ContentEntry.findOne({ siteId, contentTypeSlug: typeSlug, slug });
  if (!entry) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  if (data) {
    const merged = { ...entry.data, ...data };
    const { valid, errors } = validateEntryData(merged, contentType.fields);
    if (!valid) {
      res.status(422).json({ error: 'Validation failed', errors });
      return;
    }
    entry.data = merged;
    entry.markModified('data');
  }

  if (published !== undefined) {
    entry.published = published;
  }

  await entry.save();
  res.json(entry);
});

// DELETE /entries/:siteId/:typeSlug/:slug — delete entry
router.delete('/:typeSlug/:slug', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const result = await ContentEntry.findOneAndDelete({
    siteId: req.params.siteId,
    contentTypeSlug: req.params.typeSlug,
    slug: req.params.slug,
  });

  if (!result) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  res.json({ deleted: true });
});

// POST /entries/:siteId/:typeSlug/:slug/publish — toggle published
router.post('/:typeSlug/:slug/publish', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const entry = await ContentEntry.findOne({
    siteId: req.params.siteId,
    contentTypeSlug: req.params.typeSlug,
    slug: req.params.slug,
  });

  if (!entry) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  entry.published = !entry.published;
  await entry.save();

  res.json({ published: entry.published });
});

export default router;
