import cron from 'node-cron';
import { Post } from './models/Post';

export function startScheduler(): void {
  // Run every minute — publish any posts whose scheduled_for has passed
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    const result = await Post.updateMany(
      { status: 'scheduled', scheduled_for: { $lte: now } },
      { $set: { status: 'published', published_at: now } },
    );

    if (result.modifiedCount > 0) {
      console.log(`Scheduler: published ${result.modifiedCount} post(s)`);
    }
  });

  console.log('Post scheduler started');
}
