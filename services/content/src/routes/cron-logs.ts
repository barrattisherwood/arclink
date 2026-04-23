import { Router, Request, Response } from 'express';
import { CronLog } from '../models/CronLog';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /cron-logs?job=fixture-sync-tennis&limit=20
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { job, limit = '20', offset = '0' } = req.query;
  const query: Record<string, any> = {};
  if (job) query.job = job;

  const logs = await CronLog.find(query)
    .sort({ startedAt: -1 })
    .skip(Number(offset))
    .limit(Number(limit));

  const total = await CronLog.countDocuments(query);
  res.json({ logs, total });
});

export default router;
