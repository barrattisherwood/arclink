import cron from 'node-cron';
import { Post } from './models/Post';

// Tuesday 08:00 UTC = 10:00 SAST — publish generated drafts created since the weekly roundup (04:00 UTC)
cron.schedule('0 8 * * 2', async () => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const drafts = await Post.find({
    status: 'draft',
    generated: true,
    created_at: { $lte: cutoff },
  });

  if (!drafts.length) return;

  for (const post of drafts) {
    post.status = 'published';
    post.published_at = now;

    if (post.article_format === 'weekly-roundup') {
      // Unfeature any existing pinned post for this tenant, then pin this one
      await Post.updateMany(
        { tenant_id: post.tenant_id, featured: true },
        { $set: { featured: false } },
      );
      post.featured = true;
    }

    await post.save();
  }

  const roundups = drafts.filter(p => p.article_format === 'weekly-roundup').length;
  console.log(`[Draft Publisher] Published ${drafts.length} draft(s), featured ${roundups} weekly roundup(s)`);
});

console.log('Draft publisher scheduler started');
