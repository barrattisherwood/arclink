import { Router, Request, Response } from 'express';
import { resolveTenant } from '../middleware/auth';
import { Post } from '../models/Post';

const router = Router({ mergeParams: true });

// GET /posts/:tenantId/feed.xml — RSS 2.0 feed
router.get('/', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const tenant = req.tenant!;

  const posts = await Post.find({ tenant_id: tenantId, status: 'published' })
    .sort({ published_at: -1 })
    .limit(20)
    .select('title slug excerpt published_at tags');

  const baseUrl = req.headers.origin ?? `https://${req.headers.host}`;

  const items = posts.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${baseUrl}/blog/${post.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${post.slug}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${(post.published_at ?? post.created_at).toUTCString()}</pubDate>
      ${post.tags.map(t => `<category>${t}</category>`).join('\n      ')}
    </item>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${tenant.name}]]></title>
    <link>${baseUrl}</link>
    <description><![CDATA[${tenant.blog_subject}]]></description>
    <language>en-gb</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(xml);
});

export default router;
