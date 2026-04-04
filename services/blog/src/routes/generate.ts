import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import slugify from 'slugify';
import { requireAuth } from '../middleware/auth';
import { Post } from '../models/Post';
import { TitleQueue } from '../models/TitleQueue';
import { generatePost } from '../services/claude';
import { fetchUnsplashImage } from '../services/unsplash';

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

// POST /generate/:tenantId — generate next post from queue head
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const tenant = req.tenant!;

  const next = await TitleQueue.findOne({ tenant_id: tenantId }).sort({ priority: 1, created_at: 1 });

  if (!next) {
    res.status(404).json({ error: 'Queue is empty' });
    return;
  }

  const recentPosts = await Post.find({ tenant_id: tenantId, status: 'published' })
    .sort({ published_at: -1 })
    .limit(5)
    .select('title tags');

  const recentTitles = recentPosts.map(p => p.title);

  // Resolve persona: queue entry override → alternation → null
  const personaTags = tenant.blog_persona_prompts ? [...tenant.blog_persona_prompts.keys()] : [];
  let personaTag: string | null = next.persona_tag ?? null;

  if (!personaTag && personaTags.length > 0) {
    // Find the last published post's persona tag to alternate
    const lastPersona = recentPosts
      .map(p => p.tags.find((t: string) => personaTags.includes(t)))
      .find(Boolean) ?? null;
    const lastIndex = lastPersona ? personaTags.indexOf(lastPersona) : -1;
    personaTag = personaTags[(lastIndex + 1) % personaTags.length];
  }

  const generated = await generatePost(tenant, next.title, recentTitles, personaTag);

  const featured_image = tenant.blog_images_enabled
    ? await fetchUnsplashImage(generated.unsplash_keyword, generated.alt_text || next.title)
    : null;

  const base = makeSlug(next.title);
  const slug = await uniqueSlug(tenantId, base);
  const word_count = generated.content.trim().split(/\s+/).length;

  const reading_time = Math.ceil(word_count / 200);

  // Ensure the persona tag is included in the post tags (used for byline routing)
  const tags = generated.tags;
  if (personaTag && !tags.includes(personaTag)) {
    tags.push(personaTag);
  }

  const post = await Post.create({
    id: randomUUID(),
    tenant_id: tenantId,
    title: next.title,
    slug,
    excerpt: generated.excerpt,
    content: generated.content,
    seo_title: generated.seo_title,
    seo_description: generated.seo_description,
    categories: generated.categories,
    reading_time,
    status: 'draft',
    scheduled_for: null,
    published_at: null,
    tags,
    featured_image,
    word_count,
    generated: true,
  });

  // Remove from queue
  await TitleQueue.deleteOne({ id: next.id });

  res.status(201).json({ post });
});

export default router;
