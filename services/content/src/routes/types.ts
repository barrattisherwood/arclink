import { Router, Request, Response } from 'express';
import slugify from 'slugify';
import { ContentType } from '../models/ContentType';
import { requireAuth, resolveTenant } from '../middleware/auth';

const router = Router({ mergeParams: true });

// GET /types/:siteId — list content types
router.get('/', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const types = await ContentType.find({ siteId: req.params.siteId }).sort({ name: 1 });
  res.json({ types });
});

// POST /types/:siteId — create content type
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, fields } = req.body;
  const { siteId } = req.params;

  if (!name || !fields || !Array.isArray(fields)) {
    res.status(400).json({ error: 'name and fields are required' });
    return;
  }

  const slug = slugify(name, { lower: true, strict: true });

  const existing = await ContentType.findOne({ siteId, slug });
  if (existing) {
    res.status(409).json({ error: `Content type "${name}" already exists` });
    return;
  }

  const contentType = await ContentType.create({ siteId, name, slug, fields });
  res.status(201).json(contentType);
});

// GET /types/:siteId/:slug — get single content type
router.get('/:slug', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const contentType = await ContentType.findOne({
    siteId: req.params.siteId,
    slug: req.params.slug,
  });

  if (!contentType) {
    res.status(404).json({ error: 'Content type not found' });
    return;
  }

  res.json(contentType);
});

// PATCH /types/:siteId/:slug — update content type
router.patch('/:slug', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, fields } = req.body;
  const updates: Record<string, any> = {};

  if (name !== undefined) {
    updates.name = name;
    updates.slug = slugify(name, { lower: true, strict: true });
  }
  if (fields !== undefined) updates.fields = fields;

  const contentType = await ContentType.findOneAndUpdate(
    { siteId: req.params.siteId, slug: req.params.slug },
    updates,
    { new: true }
  );

  if (!contentType) {
    res.status(404).json({ error: 'Content type not found' });
    return;
  }

  res.json(contentType);
});

// DELETE /types/:siteId/:slug — delete content type
router.delete('/:slug', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const result = await ContentType.findOneAndDelete({
    siteId: req.params.siteId,
    slug: req.params.slug,
  });

  if (!result) {
    res.status(404).json({ error: 'Content type not found' });
    return;
  }

  res.json({ deleted: true });
});

export default router;
