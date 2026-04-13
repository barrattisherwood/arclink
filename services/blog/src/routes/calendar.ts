import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth';
import { TitleQueue, CalendarContentType } from '../models/TitleQueue';
import { IFixtureEntry } from '../models/Post';

const router = Router({ mergeParams: true });

// GET /calendar/:tenantId — list all scheduled calendar events
// Returns items that have generate_at set, ordered chronologically
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;

  const items = await TitleQueue.find({
    tenant_id: tenantId,
    generate_at: { $ne: null },
  }).sort({ generate_at: 1 });

  res.json({ items });
});

// POST /calendar/:tenantId — schedule a new calendar event
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;

  const {
    title,
    generate_at,
    publish_at,
    persona_tag,
    notes,
    fixture_date,
    fixture_label,
    competition,
    fixtures,
    content_type,
  } = req.body as {
    title: string;
    generate_at: string;
    publish_at?: string;
    persona_tag?: string;
    notes?: string;
    fixture_date?: string;
    fixture_label?: string;
    competition?: string;
    fixtures?: IFixtureEntry[];
    content_type?: CalendarContentType;
  };

  if (!title || !title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  if (!generate_at) {
    res.status(400).json({ error: 'generate_at is required' });
    return;
  }

  const generateAt = new Date(generate_at);
  if (isNaN(generateAt.getTime())) {
    res.status(400).json({ error: 'generate_at is not a valid date' });
    return;
  }

  const publishAt = publish_at ? new Date(publish_at) : null;
  if (publishAt && isNaN(publishAt.getTime())) {
    res.status(400).json({ error: 'publish_at is not a valid date' });
    return;
  }

  // Priority: append after existing queue
  const last = await TitleQueue.findOne({ tenant_id: tenantId }).sort({ priority: -1 });
  const priority = last ? last.priority + 1 : 0;

  const item = await TitleQueue.create({
    id: randomUUID(),
    tenant_id: tenantId,
    title: title.trim(),
    priority,
    notes: notes ?? null,
    persona_tag: persona_tag ?? null,
    fixtures: fixtures ?? [],
    is_weekly_roundup: content_type === 'weekly-roundup',
    content_type: content_type ?? 'article',
    schedule_status: 'pending',
    generate_at: generateAt,
    publish_at: publishAt,
    fixture_date: fixture_date ?? null,
    fixture_label: fixture_label ?? null,
    competition: competition ?? null,
    generated_post_id: null,
  });

  res.status(201).json({ item });
});

// PATCH /calendar/:tenantId/:itemId — update a scheduled event (only if still pending)
router.patch('/:itemId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, itemId } = req.params;

  const item = await TitleQueue.findOne({ id: itemId, tenant_id: tenantId });
  if (!item) {
    res.status(404).json({ error: 'Calendar event not found' });
    return;
  }

  if (item.schedule_status !== 'pending') {
    res.status(409).json({ error: `Cannot edit event in status "${item.schedule_status}"` });
    return;
  }

  const {
    title,
    generate_at,
    publish_at,
    persona_tag,
    notes,
    fixture_date,
    fixture_label,
    competition,
    fixtures,
    content_type,
  } = req.body as Partial<{
    title: string;
    generate_at: string;
    publish_at: string | null;
    persona_tag: string | null;
    notes: string | null;
    fixture_date: string | null;
    fixture_label: string | null;
    competition: string | null;
    fixtures: IFixtureEntry[];
    content_type: CalendarContentType;
  }>;

  if (title !== undefined) item.title = title.trim();
  if (notes !== undefined) item.notes = notes;
  if (persona_tag !== undefined) item.persona_tag = persona_tag;
  if (fixture_date !== undefined) item.fixture_date = fixture_date;
  if (fixture_label !== undefined) item.fixture_label = fixture_label;
  if (competition !== undefined) item.competition = competition;
  if (fixtures !== undefined) item.fixtures = fixtures;
  if (content_type !== undefined) {
    item.content_type = content_type;
    item.is_weekly_roundup = content_type === 'weekly-roundup';
  }

  if (generate_at !== undefined) {
    const d = new Date(generate_at);
    if (isNaN(d.getTime())) { res.status(400).json({ error: 'generate_at is not a valid date' }); return; }
    item.generate_at = d;
  }

  if (publish_at !== undefined) {
    if (publish_at === null) {
      item.publish_at = null;
    } else {
      const d = new Date(publish_at);
      if (isNaN(d.getTime())) { res.status(400).json({ error: 'publish_at is not a valid date' }); return; }
      item.publish_at = d;
    }
  }

  await item.save();
  res.json({ item });
});

// DELETE /calendar/:tenantId/:itemId — delete a calendar event
router.delete('/:itemId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, itemId } = req.params;

  const item = await TitleQueue.findOneAndDelete({ id: itemId, tenant_id: tenantId });
  if (!item) {
    res.status(404).json({ error: 'Calendar event not found' });
    return;
  }

  res.json({ ok: true });
});

export default router;
