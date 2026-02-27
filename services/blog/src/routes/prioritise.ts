import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Post } from '../models/Post';
import { TitleQueue } from '../models/TitleQueue';
import { prioritiseQueue } from '../services/claude';

const router = Router({ mergeParams: true });

// POST /prioritise/:tenantId — re-rank queue by SEO opportunity
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const tenant = req.tenant!;

  const items = await TitleQueue.find({ tenant_id: tenantId }).sort({ priority: 1 });

  if (!items.length) {
    res.status(404).json({ error: 'Queue is empty' });
    return;
  }

  const publishedPosts = await Post.find({ tenant_id: tenantId, status: 'published' })
    .sort({ published_at: -1 })
    .limit(20)
    .select('title');

  const publishedTitles = publishedPosts.map(p => p.title);

  const ranked = await prioritiseQueue(
    tenant,
    items.map(i => ({ id: i.id, title: i.title, notes: i.notes })),
    publishedTitles,
  );

  // Apply the new order
  await Promise.all(
    ranked.ids.map((id, index) =>
      TitleQueue.updateOne({ id, tenant_id: tenantId }, { $set: { priority: index } })
    )
  );

  const updated = await TitleQueue.find({ tenant_id: tenantId }).sort({ priority: 1 });

  res.json({ items: updated, reasoning: ranked.reasoning });
});

export default router;
