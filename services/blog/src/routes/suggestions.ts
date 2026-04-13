import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth';
import { ContentSuggestion } from '../models/ContentSuggestion';
import { TitleQueue } from '../models/TitleQueue';
import { CalendarContentType } from '../models/TitleQueue';
import { runSuggestionsForTenant } from '../scheduler-suggestions';

const router = Router({ mergeParams: true });

// GET /suggestions/:tenantId — pending suggestions inbox
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;

  const suggestions = await ContentSuggestion.find({
    tenant_id: tenantId,
    status: 'pending',
  }).sort({ generate_at: 1 });

  res.json({ suggestions });
});

// GET /suggestions/:tenantId/count — unread count for sidebar badge
router.get('/count', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;

  const count = await ContentSuggestion.countDocuments({
    tenant_id: tenantId,
    status: 'pending',
  });

  res.json({ count });
});

// POST /suggestions/:tenantId/:id/approve
// Creates a TitleQueue item from the suggestion (with optional editor overrides)
router.post('/:id/approve', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, id } = req.params;

  const suggestion = await ContentSuggestion.findOne({ id, tenant_id: tenantId });
  if (!suggestion) {
    res.status(404).json({ error: 'Suggestion not found' });
    return;
  }

  if (suggestion.status !== 'pending') {
    res.status(409).json({ error: `Suggestion already ${suggestion.status}` });
    return;
  }

  // Editor may override title, dates, persona
  const overrides = req.body as Partial<{
    title:         string;
    persona_tag:   string | null;
    generate_at:   string;
    publish_at:    string;
    content_type:  string;
    competition:   string;
    fixture_label: string;
  }>;

  const generateAt = new Date(overrides.generate_at ?? suggestion.generate_at);
  const publishAt  = new Date(overrides.publish_at  ?? suggestion.publish_at);

  const last = await TitleQueue.findOne({ tenant_id: tenantId }).sort({ priority: -1 });
  const priority = last ? last.priority + 1 : 0;

  const item = await TitleQueue.create({
    id:            randomUUID(),
    tenant_id:     tenantId,
    title:         overrides.title        ?? suggestion.title,
    content_type:  (overrides.content_type ?? suggestion.content_type) as CalendarContentType,
    persona_tag:   overrides.persona_tag !== undefined ? overrides.persona_tag : suggestion.persona_tag,
    fixture_date:  suggestion.fixture_date,
    fixture_label: overrides.fixture_label ?? suggestion.fixture_label,
    competition:   overrides.competition  ?? suggestion.competition,
    generate_at:   generateAt,
    publish_at:    publishAt,
    is_weekly_roundup: false,
    fixtures:      [],
    schedule_status: 'pending',
    priority,
    notes:         null,
    generated_post_id: null,
  });

  await ContentSuggestion.updateOne({ id }, { $set: { status: 'approved' } });

  res.status(201).json({ item });
});

// POST /suggestions/:tenantId/:id/dismiss
router.post('/:id/dismiss', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, id } = req.params;

  const result = await ContentSuggestion.updateOne(
    { id, tenant_id: tenantId, status: 'pending' },
    { $set: { status: 'dismissed' } }
  );

  if (!result.matchedCount) {
    res.status(404).json({ error: 'Suggestion not found or already actioned' });
    return;
  }

  res.json({ ok: true });
});

// POST /suggestions/:tenantId/trigger — manual scan (for testing / on-demand)
router.post('/trigger', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;

  try {
    const count = await runSuggestionsForTenant(tenantId);
    res.json({ ok: true, created: count });
  } catch (err) {
    console.error('[Suggestions trigger] Error:', err);
    res.status(500).json({ error: 'Failed to run suggestion scan' });
  }
});

export default router;
