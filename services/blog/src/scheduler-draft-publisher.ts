import cron from 'node-cron';
import { Post } from './models/Post';

// Tuesday 08:00 UTC = 10:00 SAST — publish generated drafts created since the weekly roundup (04:00 UTC)
cron.schedule('0 8 * * 2', async () => {
  const now = new Date();
  // Only publish drafts at least 2 hours old — guards against anything still mid-save
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const result = await Post.updateMany(
    {
      status: 'draft',
      generated: true,
      created_at: { $lte: cutoff },
    },
    { $set: { status: 'published', published_at: now } },
  );

  if (result.modifiedCount > 0) {
    console.log(`[Draft Publisher] Published ${result.modifiedCount} generated draft(s)`);
  }
});

console.log('Draft publisher scheduler started');
