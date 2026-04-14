import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import slugify from 'slugify';
import { requireAuth, resolveTenant } from '../middleware/auth';
import { Post } from '../models/Post';
import { IBlogTenant } from '../models/BlogTenant';
import { fetchUnsplashImageWithFallbacks } from '../services/unsplash';

const router = Router({ mergeParams: true });

function makeSlug(title: string): string {
  return slugify(title, { lower: true, strict: true });
}

async function uniqueSlug(tenantId: string, base: string): Promise<string> {
  let slug = base;
  let counter = 2;
  while (await Post.findOne({ tenant_id: tenantId, slug })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

async function nextPublishDate(tenant: IBlogTenant, tenantId: string): Promise<Date> {
  const targetDay = tenant.blog_publish_day;
  const targetHour = tenant.blog_publish_hour;

  // Get all dates that already have a scheduled post
  const scheduled = await Post.find(
    { tenant_id: tenantId, status: 'scheduled', scheduled_for: { $ne: null } },
  ).select('scheduled_for');

  const takenDates = new Set(
    scheduled.map(p => p.scheduled_for!.toISOString().split('T')[0]),
  );

  // Walk forward week by week until we find a slot that isn't taken
  const now = new Date();
  const candidate = new Date(now);
  candidate.setUTCHours(targetHour, 0, 0, 0);

  const daysUntil = (targetDay - now.getUTCDay() + 7) % 7 || 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysUntil);

  while (takenDates.has(candidate.toISOString().split('T')[0])) {
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }

  return candidate;
}

// GET /posts/:tenantId — list published posts (public)
router.get('/', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
  const skip = (page - 1) * limit;
  const tag = req.query.tag as string | undefined;

  const query: Record<string, any> = { tenant_id: tenantId, status: 'published' };
  if (tag) query.tags = { $in: [tag] };

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort({ published_at: -1 })
      .skip(skip)
      .limit(limit)
      .select('-content'),
    Post.countDocuments(query),
  ]);

  res.json({ posts, total, page, pages: Math.ceil(total / limit) });
});

// GET /posts/:tenantId/drafts — list drafts only (protected)
router.get('/drafts', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const posts = await Post.find({ tenant_id: tenantId, status: 'draft' })
    .sort({ created_at: -1 })
    .select('-content');
  res.json({ posts });
});

// GET /posts/:tenantId/scheduled — list scheduled posts (protected)
router.get('/scheduled', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const posts = await Post.find({ tenant_id: tenantId, status: 'scheduled' })
    .sort({ scheduled_for: 1 })
    .select('-content');
  res.json({ posts });
});

// PATCH /posts/:tenantId/scheduled/reorder — reorder scheduled posts (protected)
router.patch('/scheduled/reorder', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const { ids } = req.body as { ids: string[] };

  if (!ids?.length) {
    res.status(400).json({ error: 'ids array is required' });
    return;
  }

  const tenant = req.tenant!;
  const baseDate = new Date();
  const daysBetween = 7; // one post per week

  for (let i = 0; i < ids.length; i++) {
    const scheduledFor = new Date(baseDate);
    scheduledFor.setUTCDate(scheduledFor.getUTCDate() + (i + 1) * daysBetween);
    scheduledFor.setUTCHours(tenant.blog_publish_hour, 0, 0, 0);

    await Post.updateOne(
      { id: ids[i], tenant_id: tenantId, status: 'scheduled' },
      { $set: { scheduled_for: scheduledFor } },
    );
  }

  const posts = await Post.find({ tenant_id: tenantId, status: 'scheduled' })
    .sort({ scheduled_for: 1 })
    .select('-content');
  res.json({ posts });
});

// GET /posts/:tenantId/preview/:postId — single post preview (protected, any status)
router.get('/preview/:postId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, postId } = req.params;
  const post = await Post.findOne({ id: postId, tenant_id: tenantId });

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  res.json({ post });
});

// POST /posts/:tenantId/:postId/regenerate-image — fetch a new Unsplash image (protected)
router.post('/:postId/regenerate-image', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, postId } = req.params;
  const { keyword } = req.body as { keyword?: string };

  const post = await Post.findOne({ id: postId, tenant_id: tenantId });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const keywords = keyword
    ? [keyword]
    : [
        ...(post.tags ?? []),
        post.title.split(' ').slice(0, 3).join(' '),
        'technology business',
      ];
  const image = await fetchUnsplashImageWithFallbacks(keywords, post.title);

  if (!image) {
    res.status(502).json({ error: 'Failed to fetch image from Unsplash' });
    return;
  }

  post.featured_image = image;
  await post.save();

  res.json({ post });
});

// POST /posts/:tenantId/:postId/upload-image — upload a custom image (protected)
router.post('/:postId/upload-image', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, postId } = req.params;
  const { image, alt } = req.body as { image: string; alt?: string };

  if (!image) {
    res.status(400).json({ error: 'image (base64 data URL) is required' });
    return;
  }

  const post = await Post.findOne({ id: postId, tenant_id: tenantId });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  post.featured_image = {
    url: image,
    alt: alt || post.title,
    credit: null,
  };
  await post.save();

  res.json({ post });
});

// GET /posts/:tenantId/featured — current pinned weekly roundup (public)
router.get('/featured', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;

  const post = await Post.findOne({
    tenant_id: tenantId,
    featured: true,
    status: 'published',
  }).sort({ published_at: -1 });

  if (!post) {
    res.status(404).json({ error: 'No featured post found' });
    return;
  }

  res.json({ post });
});

// POST /posts/:tenantId/:postId/feature — promote post to homepage featured (protected)
router.post('/:postId/feature', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, postId } = req.params;

  // Unpin any currently featured posts
  await Post.updateMany(
    { tenant_id: tenantId, featured: true },
    { $set: { featured: false } },
  );

  const post = await Post.findOneAndUpdate(
    { tenant_id: tenantId, id: postId },
    { $set: { featured: true } },
    { new: true },
  );

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  res.json({ post });
});

// POST /posts/:tenantId/generate-roundup — manually trigger the weekly roundup pipeline
router.post('/generate-roundup', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const tenant = req.tenant!;

  if (!tenant.sport_key) {
    res.status(400).json({ ok: false, error: 'No sport fixtures configured for this site. Set a sport_key on the blog tenant to enable roundup generation.' });
    return;
  }

  try {
    const { runWeeklyRoundup } = await import('../scheduler-weekly-roundup');
    const startedAt = new Date();
    await runWeeklyRoundup(tenant);

    const post = await Post.findOne({
      tenant_id: tenant.id,
      article_format: 'weekly-roundup',
      status: 'draft',
      created_at: { $gte: startedAt },
    }).sort({ created_at: -1 });

    if (!post) {
      res.status(422).json({ ok: false, error: 'No upcoming fixtures found for the next 7 days — roundup not generated.' });
      return;
    }

    res.json({ ok: true, post });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /posts/:tenantId/sitemap.xml — sitemap of published posts (public)
router.get('/sitemap.xml', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const tenant = req.tenant!;
  const canonicalBase = tenant.blog_canonical_base || `https://${req.headers.host}`;

  const posts = await Post.find({ tenant_id: tenantId, status: 'published' })
    .sort({ published_at: -1 })
    .select('slug published_at created_at');

  const urls = posts.map(post => `
  <url>
    <loc>${canonicalBase}/blog/${post.slug}</loc>
    <lastmod>${(post.published_at ?? post.created_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${canonicalBase}/blog</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>${urls}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

// GET /posts/:tenantId/:slug — single published post (public)
router.get('/:slug', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, slug } = req.params;

  const post = await Post.findOne({ tenant_id: tenantId, slug, status: 'published' });

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  res.json({ post });
});

// POST /posts/:tenantId — create post manually (protected)
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const { title, content, excerpt, tags, categories, seo_title, seo_description, status, scheduled_for } = req.body as {
    title: string;
    content: string;
    excerpt: string;
    tags?: string[];
    categories?: string[];
    seo_title?: string;
    seo_description?: string;
    status?: 'draft' | 'scheduled';
    scheduled_for?: string;
  };

  if (!title || !content || !excerpt) {
    res.status(400).json({ error: 'title, content, and excerpt are required' });
    return;
  }

  const base = makeSlug(title);
  const slug = await uniqueSlug(tenantId, base);
  const word_count = content.trim().split(/\s+/).length;
  const reading_time = Math.ceil(word_count / 200);

  const post = await Post.create({
    id: randomUUID(),
    tenant_id: tenantId,
    title,
    slug,
    excerpt,
    content,
    seo_title: seo_title || title.slice(0, 60),
    seo_description: seo_description || excerpt.slice(0, 155),
    categories: categories ?? [],
    reading_time,
    status: status ?? 'draft',
    scheduled_for: scheduled_for ? new Date(scheduled_for) : null,
    tags: tags ?? [],
    featured_image: null,
    word_count,
    generated: false,
  });

  res.status(201).json({ post });
});

// PATCH /posts/:tenantId/:postId — update post (protected)
router.patch('/:postId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, postId } = req.params;
  const tenant = req.tenant!;

  const post = await Post.findOne({ id: postId, tenant_id: tenantId });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const { title, content, excerpt, tags, categories, seo_title, seo_description, status, scheduled_for } = req.body as {
    title?: string;
    content?: string;
    excerpt?: string;
    tags?: string[];
    categories?: string[];
    seo_title?: string;
    seo_description?: string;
    status?: 'draft' | 'scheduled' | 'published';
    scheduled_for?: string | null;
  };

  if (title) {
    post.title = title;
    const base = makeSlug(title);
    post.slug = await uniqueSlug(tenantId, base);
  }
  if (content) {
    post.content = content;
    post.word_count = content.trim().split(/\s+/).length;
    post.reading_time = Math.ceil(post.word_count / 200);
  }
  if (excerpt) post.excerpt = excerpt;
  if (tags) post.tags = tags;
  if (categories) post.categories = categories;
  if (seo_title !== undefined) post.seo_title = seo_title;
  if (seo_description !== undefined) post.seo_description = seo_description;

  if (status) {
    post.status = status;

    if (status === 'scheduled') {
      // If no explicit date provided, auto-calculate from tenant cadence config
      post.scheduled_for = scheduled_for
        ? new Date(scheduled_for)
        : await nextPublishDate(tenant, tenantId);
    }

    if (status === 'published' && !post.published_at) {
      post.published_at = new Date();
      post.scheduled_for = null;
    }

    if (status === 'draft') {
      post.scheduled_for = null;
    }
  } else if (scheduled_for !== undefined) {
    post.scheduled_for = scheduled_for ? new Date(scheduled_for) : null;
  }

  await post.save();
  res.json({ post });
});

// DELETE /posts/:tenantId/:postId — delete post (protected)
router.delete('/:postId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, postId } = req.params;

  const post = await Post.findOneAndDelete({ id: postId, tenant_id: tenantId });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  res.json({ ok: true });
});

export default router;
