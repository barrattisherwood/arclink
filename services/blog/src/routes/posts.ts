import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import slugify from 'slugify';
import { requireAuth, resolveTenant } from '../middleware/auth';
import { Post } from '../models/Post';
import { IBlogTenant } from '../models/BlogTenant';

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

function nextPublishDate(tenant: IBlogTenant): Date {
  const now = new Date();
  const targetDay = tenant.blog_publish_day;
  const targetHour = tenant.blog_publish_hour;

  const date = new Date(now);
  date.setUTCHours(targetHour, 0, 0, 0);

  const daysUntil = (targetDay - now.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntil);

  return date;
}

// GET /posts/:tenantId — list published posts (public)
router.get('/', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    Post.find({ tenant_id: tenantId, status: 'published' })
      .sort({ published_at: -1 })
      .skip(skip)
      .limit(limit)
      .select('-content'),
    Post.countDocuments({ tenant_id: tenantId, status: 'published' }),
  ]);

  res.json({ posts, total, page, pages: Math.ceil(total / limit) });
});

// GET /posts/:tenantId/drafts — list drafts (protected)
router.get('/drafts', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const posts = await Post.find({ tenant_id: tenantId, status: { $in: ['draft', 'scheduled'] } })
    .sort({ created_at: -1 })
    .select('-content');
  res.json({ posts });
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
  const { title, content, excerpt, tags, status, scheduled_for } = req.body as {
    title: string;
    content: string;
    excerpt: string;
    tags?: string[];
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

  const post = await Post.create({
    id: randomUUID(),
    tenant_id: tenantId,
    title,
    slug,
    excerpt,
    content,
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

  const { title, content, excerpt, tags, status, scheduled_for } = req.body as {
    title?: string;
    content?: string;
    excerpt?: string;
    tags?: string[];
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
  }
  if (excerpt) post.excerpt = excerpt;
  if (tags) post.tags = tags;

  if (status) {
    post.status = status;

    if (status === 'scheduled') {
      // If no explicit date provided, auto-calculate from tenant cadence config
      post.scheduled_for = scheduled_for
        ? new Date(scheduled_for)
        : nextPublishDate(tenant);
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
