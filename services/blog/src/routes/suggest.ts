import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Post } from '../models/Post';
import { TitleQueue } from '../models/TitleQueue';
import { suggestTitles } from '../services/claude';

const router = Router({ mergeParams: true });

// POST /suggest/:tenantId — get N title suggestions without committing anything
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const tenant = req.tenant!;

  const count = Math.min(10, parseInt(req.body?.count as string) || 5);

  // Pass existing published + queued titles so Claude doesn't repeat them
  const [published, queued] = await Promise.all([
    Post.find({ tenant_id: tenantId, status: 'published' }).select('title').lean(),
    TitleQueue.find({ tenant_id: tenantId }).select('title').lean(),
  ]);

  const existingTitles = [
    ...published.map(p => p.title),
    ...queued.map(q => q.title),
  ];

  const suggestions = await suggestTitles(tenant, count, existingTitles);

  res.json({ suggestions });
});

export default router;
