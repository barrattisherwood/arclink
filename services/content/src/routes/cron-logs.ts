import { Router, Request, Response } from 'express';
import { CronLog } from '../models/CronLog';
import { requireAdminJwt } from '../middleware/auth';
import {
  runSport,
  RUGBY_COMPETITIONS,
  CRICKET_COMPETITIONS,
  FOOTBALL_COMPETITIONS,
  TENNIS_COMPETITIONS,
} from '../scheduler-fixtures';

const router = Router();

// GET /cron-logs?job=fixture-sync-tennis&limit=20
router.get('/', requireAdminJwt, async (req: Request, res: Response): Promise<void> => {
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

// POST /sync-fixtures?siteId=betwise-rugby — manually trigger fixture sync
// Accepts optional ?siteId to scope to a single sport; omit to sync all sports.
router.post('/sync-fixtures', requireAdminJwt, async (req: Request, res: Response): Promise<void> => {
  const { siteId } = req.query;

  const allJobs: Array<[string, Array<{ path: string; name: string; tag: string }>, string]> = [
    ['fixture-sync-rugby-manual',    RUGBY_COMPETITIONS,    'betwise-rugby'],
    ['fixture-sync-cricket-manual',  CRICKET_COMPETITIONS,  'betwise-cricket'],
    ['fixture-sync-football-manual', FOOTBALL_COMPETITIONS, 'betwise-football'],
    ['fixture-sync-tennis-manual',   TENNIS_COMPETITIONS,   'satennis'],
  ];

  const jobs = siteId
    ? allJobs.filter(([, , id]) => id === siteId)
    : allJobs;

  if (!jobs.length) {
    res.status(400).json({ ok: false, error: `Unknown siteId: ${siteId}` });
    return;
  }

  const results: Array<{ siteId: string; status: string }> = [];

  for (const [job, competitions, site] of jobs) {
    try {
      await runSport(job, competitions, site);
      console.log(`[SyncFixtures] ${site} — ok`);
      results.push({ siteId: site, status: 'ok' });
    } catch (err: any) {
      const msg = err?.message ?? 'unknown';
      console.error(`[SyncFixtures] ${site} — failed:`, msg);
      results.push({ siteId: site, status: `failed: ${msg}` });
    }
  }

  const failed = results.filter(r => r.status !== 'ok');
  if (failed.length) {
    console.error(`[SyncFixtures] ${failed.length} sport(s) failed:`, failed.map(r => r.siteId).join(', '));
  } else {
    console.log(`[SyncFixtures] All ${results.length} sport(s) synced successfully`);
  }

  res.json({ ok: true, results });
});

export default router;
