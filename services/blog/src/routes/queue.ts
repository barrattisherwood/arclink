import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth';
import { TitleQueue } from '../models/TitleQueue';
import { IFixtureEntry } from '../models/Post';

const router = Router({ mergeParams: true });

// GET /queue/:tenantId — list queue ordered by priority
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const items = await TitleQueue.find({ tenant_id: tenantId }).sort({ priority: 1, created_at: 1 });
  res.json({ items });
});

// POST /queue/:tenantId — add one or more titles
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;

  const body = req.body as
    | { title: string; notes?: string; persona_tag?: string; fixtures?: IFixtureEntry[] }
    | { titles: Array<{ title: string; notes?: string; persona_tag?: string; fixtures?: IFixtureEntry[] }> };

  const entries = 'titles' in body
    ? body.titles
    : [{ title: body.title, notes: body.notes, persona_tag: body.persona_tag, fixtures: body.fixtures }];

  if (!entries.length || entries.some(e => !e.title)) {
    res.status(400).json({ error: 'Each entry must have a title' });
    return;
  }

  // Append after current lowest priority
  const last = await TitleQueue.findOne({ tenant_id: tenantId }).sort({ priority: -1 });
  let nextPriority = last ? last.priority + 1 : 0;

  const created = await TitleQueue.insertMany(
    entries.map(e => ({
      id: randomUUID(),
      tenant_id: tenantId,
      title: e.title,
      notes: e.notes ?? null,
      persona_tag: e.persona_tag ?? null,
      fixtures: e.fixtures ?? [],
      priority: nextPriority++,
    }))
  );

  res.status(201).json({ items: created });
});

// PATCH /queue/:tenantId — reorder queue (array of IDs in desired order)
router.patch('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const { ids } = req.body as { ids: string[] };

  if (!Array.isArray(ids) || !ids.length) {
    res.status(400).json({ error: 'ids must be a non-empty array' });
    return;
  }

  await Promise.all(
    ids.map((id, index) =>
      TitleQueue.updateOne({ id, tenant_id: tenantId }, { $set: { priority: index } })
    )
  );

  const items = await TitleQueue.find({ tenant_id: tenantId }).sort({ priority: 1 });
  res.json({ items });
});

// DELETE /queue/:tenantId/:titleId — remove a title
router.delete('/:titleId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, titleId } = req.params;

  const item = await TitleQueue.findOneAndDelete({ id: titleId, tenant_id: tenantId });
  if (!item) {
    res.status(404).json({ error: 'Queue item not found' });
    return;
  }

  res.json({ ok: true });
});

export default router;
