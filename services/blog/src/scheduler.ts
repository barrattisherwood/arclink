import cron from 'node-cron';
import { Post } from './models/Post';
import { BlogTenant } from './models/BlogTenant';
import { triggerDeploy, triggerDeployNow, DEPLOY_HOOK_SPORT_KEYS } from './services/deploy-hook';

export async function runScheduledPublisher(now = new Date()): Promise<void> {
  const due = await Post.find({ status: 'scheduled', scheduled_for: { $lte: now } });
  if (!due.length) return;

  await Post.updateMany(
    { _id: { $in: due.map(p => p._id) } },
    { $set: { status: 'published', published_at: now } },
  );

  console.log(`Scheduler: published ${due.length} post(s)`);

  const sportKeyByTenant = new Map<string, string>();
  for (const post of due) {
    if (!sportKeyByTenant.has(post.tenant_id)) {
      const tenant = await BlogTenant.findOne({ id: post.tenant_id });
      sportKeyByTenant.set(post.tenant_id, tenant?.sport_key ?? '');
    }
    const sportKey = sportKeyByTenant.get(post.tenant_id);
    if (sportKey) {
      triggerDeploy(sportKey);
    }
  }
}

// Rebuilds every site once a day regardless of publish activity — a safety
// net for fixture pages (kickoffs pass without a publish event) and for any
// deploy-hook call the debounce/retry logic above missed.
export async function runDailyRebuild(): Promise<void> {
  for (const sportKey of DEPLOY_HOOK_SPORT_KEYS) {
    await triggerDeployNow(sportKey);
  }
}

export function startScheduler(): void {
  // Run every minute — publish any posts whose scheduled_for has passed
  cron.schedule('* * * * *', () => runScheduledPublisher());

  // Daily at 05:00 UTC — clear of the fixture-sync (02:00-03:30 UTC) and
  // weekly-roundup/draft-publisher (04:00/08:00 UTC Tuesday) cron windows.
  cron.schedule('0 5 * * *', () => runDailyRebuild());

  console.log('Post scheduler started');
}
