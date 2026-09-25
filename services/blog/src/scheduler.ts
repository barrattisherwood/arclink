import cron from 'node-cron';
import { Post } from './models/Post';
import { BlogTenant } from './models/BlogTenant';
import { revalidateSite } from './services/revalidate';

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
      await revalidateSite(sportKey, [`/${post.slug}`]);
    }
  }
}

export function startScheduler(): void {
  // Run every minute — publish any posts whose scheduled_for has passed
  cron.schedule('* * * * *', () => runScheduledPublisher());

  console.log('Post scheduler started');
}
