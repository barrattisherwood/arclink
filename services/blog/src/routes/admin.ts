import { Router, Request, Response } from 'express';
import { randomUUID, randomBytes, createHash } from 'crypto';
import axios from 'axios';
import { requireAdminJwt } from '../middleware/auth';
import { BlogTenant } from '../models/BlogTenant';
import { Post } from '../models/Post';
import { PERSONA_REGISTRY } from '../services/persona-registry';

const router = Router();

// POST /api/admin/sync-personas
// Applies the latest persona prompts from the in-code registry to all tenants in MongoDB.
// Auth: super-admin JWT (same token used by the admin dashboard).
router.post('/sync-personas', requireAdminJwt, async (_req: Request, res: Response): Promise<void> => {
  const results: Array<{ tenantName: string; status: 'updated' | 'not_found' }> = [];

  for (const config of PERSONA_REGISTRY) {
    const tenant = await BlogTenant.findOne({ name: config.tenantName });

    if (!tenant) {
      console.warn(`[SyncPersonas] Tenant not found: ${config.tenantName}`);
      results.push({ tenantName: config.tenantName, status: 'not_found' });
      continue;
    }

    tenant.blog_persona_prompts = config.personas;
    await tenant.save();

    console.log(`[SyncPersonas] Updated "${config.tenantName}" — personas: ${[...config.personas.keys()].join(', ')}`);
    results.push({ tenantName: config.tenantName, status: 'updated' });
  }

  const updated = results.filter(r => r.status === 'updated').length;
  res.json({ ok: true, updated, results });
});

// POST /api/admin/seed-findtherapy
// Idempotent — creates the FindTherapy blog tenant if it does not already exist.
// Returns { ok, created, tenantId, apiKey? } — apiKey only present on first creation.
router.post('/seed-findtherapy', requireAdminJwt, async (_req: Request, res: Response): Promise<void> => {
  const existing = await BlogTenant.findOne({ siteId: 'findtherapy-care' });
  if (existing) {
    res.json({ ok: true, created: false, tenantId: existing.id });
    return;
  }

  const rawKey = randomBytes(32).toString('hex');
  const hashedKey = createHash('sha256').update(rawKey).digest('hex');

  const tenant = new BlogTenant({
    id: randomUUID(),
    siteId: 'findtherapy-care',
    api_key: hashedKey,
    name: 'FindTherapy',
    allowed_origin: 'https://findtherapy.care',
    active: true,
    blog_subject: 'mental health, therapy and wellbeing in South Africa',
    blog_audience: 'South Africans exploring therapy for the first time or seeking to deepen their understanding of mental health and wellbeing',
    blog_tone: 'warm, evidence-based, destigmatising and accessible — professional without being clinical, honest without being alarming',
    blog_word_count: 1000,
    blog_cadence: 2,
    blog_publish_day: 2,
    blog_publish_hour: 9,
    blog_predefined_tags: ['therapy', 'mental health', 'wellbeing', 'CBT', 'anxiety', 'depression', 'relationships', 'self-care', 'finding a therapist'],
    blog_predefined_categories: ['Mental Health', 'Therapy Guides', 'Wellbeing', 'Relationships', 'Self-Care'],
    blog_canonical_base: 'https://findtherapy.care/blog',
    blog_persona_prompts: new Map(),
    blog_images_enabled: true,
    sport_key: '',
    sport_label: '',
  });

  await tenant.save();

  console.log(`[SeedFindtherapy] Created tenant "${tenant.name}" (${tenant.id})`);
  res.json({ ok: true, created: true, tenantId: tenant.id, apiKey: rawKey });
});

// POST /api/admin/migrate-findtherapy
// Fetches all published posts from the existing findtherapy.care backend and
// upserts them into Arclink as IPost documents under the findtherapy-care tenant.
// Safe to re-run — uses upsert on { tenant_id, slug }.
router.post('/migrate-findtherapy', requireAdminJwt, async (_req: Request, res: Response): Promise<void> => {
  const tenant = await BlogTenant.findOne({ siteId: 'findtherapy-care' });
  if (!tenant) {
    res.status(404).json({ error: 'findtherapy-care tenant not found — run seed-findtherapy first' });
    return;
  }

  // Paginate through the source API
  const SOURCE_URL = 'https://api.findtherapy.care/api/blog';
  let page = 1;
  let totalFetched = 0;
  const allPosts: any[] = [];

  while (true) {
    const response = await axios.get<{ posts: any[]; pages: number }>(SOURCE_URL, { params: { page, limit: 50 }, timeout: 15000 });
    const { posts = [], pages = 1 } = response.data;
    allPosts.push(...posts);
    totalFetched += posts.length;
    console.log(`[MigrateFindtherapy] Page ${page}/${pages} — fetched ${posts.length} posts`);
    if (page >= pages) break;
    page++;
  }

  console.log(`[MigrateFindtherapy] Total posts fetched: ${totalFetched}`);

  let upserted = 0;
  let skipped = 0;

  for (const src of allPosts) {
    try {
      const wordCount = src.content ? src.content.trim().split(/\s+/).length : 0;
      const readingTime = Math.max(1, Math.round(wordCount / 200));

      await Post.findOneAndUpdate(
        { tenant_id: tenant.id, slug: src.slug },
        {
          $setOnInsert: {
            id: randomUUID(),
            created_at: src.createdAt ? new Date(src.createdAt) : new Date(),
          },
          $set: {
            tenant_id: tenant.id,
            title: src.title,
            slug: src.slug,
            excerpt: src.excerpt || '',
            content: src.content || '',
            seo_title: src.seoTitle || src.title || '',
            seo_description: src.seoDescription || src.excerpt || '',
            categories: (src.categories || []).map((c: string) => c.toLowerCase()),
            tags: (src.tags || []).map((t: string) => t.toLowerCase()),
            status: 'published' as const,
            published_at: src.publishedAt ? new Date(src.publishedAt) : new Date(),
            scheduled_for: null,
            featured_image: src.featuredImage
              ? { url: src.featuredImage, alt: src.title || '', credit: null }
              : null,
            word_count: wordCount,
            reading_time: readingTime,
            generated: false,
            article_format: 'standard' as const,
            featured: false,
            views: src.views || 0,
            likes: src.likes || 0,
            author_name: src.authorDisplayName || null,
            dialogue_blocks: [],
            fixture_dialogues: [],
            fixture_list: [],
          },
        },
        { upsert: true, new: true }
      );
      upserted++;
    } catch (err: any) {
      console.error(`[MigrateFindtherapy] Skipped "${src.slug}": ${err.message}`);
      skipped++;
    }
  }

  console.log(`[MigrateFindtherapy] Done — ${upserted} upserted, ${skipped} skipped`);
  res.json({ ok: true, fetched: totalFetched, upserted, skipped });
});

export default router;
