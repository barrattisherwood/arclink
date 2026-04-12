import cron from 'node-cron';
import { randomUUID } from 'crypto';
import slugify from 'slugify';
import { TitleQueue } from './models/TitleQueue';
import { BlogTenant } from './models/BlogTenant';
import { Post } from './models/Post';
import { generatePost } from './services/claude';
import { fetchUnsplashImage } from './services/unsplash';
import { parseDialogueContent, parseWeeklyRoundup } from './utils/dialogue-parser';

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

async function processScheduledItem(itemId: string): Promise<void> {
  // Atomically claim the item — prevents double-processing if cron overlaps
  const item = await TitleQueue.findOneAndUpdate(
    { id: itemId, schedule_status: 'pending' },
    { $set: { schedule_status: 'generating' } },
    { new: true }
  );
  if (!item) return; // already claimed by another instance

  const tenant = await BlogTenant.findOne({ id: item.tenant_id, active: true });
  if (!tenant) {
    await TitleQueue.updateOne({ id: itemId }, { $set: { schedule_status: 'failed' } });
    console.error(`[Generation Scheduler] Tenant not found for item ${itemId}`);
    return;
  }

  try {
    // Resolve persona (item override or first available)
    const personaTags = tenant.blog_persona_prompts ? [...tenant.blog_persona_prompts.keys()] : [];
    const personaTag: string | null = item.persona_tag ?? (personaTags[0] ?? null);

    const generated = await generatePost(
      tenant,
      item.title,
      [],
      personaTag,
      item.fixtures?.length ? item.fixtures : undefined
    );

    const featured_image = tenant.blog_images_enabled
      ? await fetchUnsplashImage(generated.unsplash_keyword, generated.alt_text || item.title)
      : null;

    const base = makeSlug(item.title);
    const slug = await uniqueSlug(tenant.id, base);
    const word_count = generated.content.trim().split(/\s+/).length;
    const reading_time = Math.ceil(word_count / 200);

    const tags = generated.tags;
    if (personaTag && !tags.includes(personaTag)) tags.push(personaTag);

    let article_format: 'standard' | 'dialogue' | 'weekly-roundup' = 'standard';
    let dialogue_blocks: { persona: string; content: string; order: number }[] = [];
    let fixture_dialogues: { matchLabel: string; blocks: { persona: string; content: string; order: number }[] }[] = [];

    if (item.fixtures?.length) {
      const parsed = parseWeeklyRoundup(generated.content);
      if (parsed.isValid) {
        article_format = 'weekly-roundup';
        fixture_dialogues = parsed.fixtures;
        dialogue_blocks = parsed.fixtures.flatMap(f => f.blocks);
      }
    } else if (personaTag) {
      const parsed = parseDialogueContent(generated.content);
      if (parsed.isValid) {
        article_format = 'dialogue';
        dialogue_blocks = parsed.blocks;
      }
    }

    // Status: scheduled if publish_at is set, otherwise draft
    const status = item.publish_at ? 'scheduled' : 'draft';
    const scheduled_for = item.publish_at ?? null;

    const post = await Post.create({
      id: randomUUID(),
      tenant_id: tenant.id,
      title: item.title,
      slug,
      excerpt: generated.excerpt,
      content: generated.content,
      seo_title: generated.seo_title,
      seo_description: generated.seo_description,
      categories: generated.categories,
      reading_time,
      status,
      scheduled_for,
      published_at: null,
      tags,
      featured_image,
      word_count,
      generated: true,
      article_format,
      dialogue_blocks,
      fixture_dialogues,
      fixture_list: item.fixtures ?? [],
      featured: false,
    });

    await TitleQueue.updateOne(
      { id: itemId },
      { $set: { schedule_status: 'generated', generated_post_id: post.id } }
    );

    console.log(`[Generation Scheduler] Generated "${item.title}" → post ${post.id} (${status})`);
  } catch (err) {
    await TitleQueue.updateOne({ id: itemId }, { $set: { schedule_status: 'failed' } });
    console.error(`[Generation Scheduler] Failed for item ${itemId}:`, err);
  }
}

// Run every 5 minutes — check for scheduled items due for generation
cron.schedule('*/5 * * * *', async () => {
  const now = new Date();

  const dueItems = await TitleQueue.find({
    schedule_status: 'pending',
    generate_at: { $lte: now, $ne: null },
  }).select('id');

  if (!dueItems.length) return;

  console.log(`[Generation Scheduler] ${dueItems.length} item(s) due for generation`);

  for (const item of dueItems) {
    await processScheduledItem(item.id);
  }
});

console.log('Generation scheduler started');
