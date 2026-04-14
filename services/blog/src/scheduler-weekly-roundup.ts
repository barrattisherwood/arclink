import cron from 'node-cron';
import { randomUUID } from 'crypto';
import slugify from 'slugify';
import { fetchUpcomingFixtures } from './services/sportdb';
import { scoreAndSelectFixtures } from './services/fixture-selector';
import { generatePost } from './services/claude';
import { BlogTenant, IBlogTenant } from './models/BlogTenant';
import { Post } from './models/Post';
import { parseWeeklyRoundup } from './utils/dialogue-parser';

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

// Tuesday 06:00 SAST = Tuesday 04:00 UTC
cron.schedule('0 4 * * 2', async () => {
  console.log('[Weekly Roundup] Cron fired');

  const tenants = await BlogTenant.find({
    active: true,
    sport_key: { $exists: true, $ne: '' }
  });

  for (const tenant of tenants) {
    try {
      await runWeeklyRoundup(tenant);
    } catch (err) {
      console.error(`[Weekly Roundup] Failed for ${tenant.name}:`, err);
    }
  }
});

export async function runWeeklyRoundup(tenant: IBlogTenant): Promise<void> {
  // 1. Fetch fixtures
  const raw = await fetchUpcomingFixtures(tenant.sport_key, 7);
  console.log(`[Weekly Roundup] Raw fixtures (${raw.length}):`, raw.map(f => `${f.competition} | ${f.homeTeam} vs ${f.awayTeam} | ${f.kickoff}`));
  if (!raw.length) {
    console.log(`[Weekly Roundup] No fixtures for ${tenant.name} — skipping`);
    return;
  }

  // 2. Score and select
  const selected = scoreAndSelectFixtures(raw, tenant.sport_key);
  console.log(`[Weekly Roundup] Selected (${selected.length}):`, selected.map(f => `${f.competition} | ${f.homeTeam} vs ${f.awayTeam}`));

  // 3. Build title
  const date = new Date().toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const title = `${tenant.sport_label} Weekly Preview — ${date}`;

  // 4. Generate directly (skip queue for automation)
  const generated = await generatePost(tenant, title, [], undefined, selected);
  const parsed = parseWeeklyRoundup(generated.content);

  // 5. Compute derived fields
  const base = makeSlug(title);
  const slug = await uniqueSlug(tenant.id, base);
  const word_count = generated.content.trim().split(/\s+/).length;
  const reading_time = Math.ceil(word_count / 200);

  // 6. Merge competition tags derived from fixtures (deterministic — don't rely on Claude)
  const competitionTags = [...new Set(
    selected.map(f => f.competitionTag).filter((t): t is string => !!t)
  )];
  const mergedTags = [...new Set([...generated.tags, ...competitionTags])];

  // 7. Save as draft
  await Post.create({
    id: randomUUID(),
    tenant_id: tenant.id,
    title,
    slug,
    content: generated.content,
    excerpt: generated.excerpt,
    seo_title: generated.seo_title,
    seo_description: generated.seo_description,
    tags: mergedTags,
    categories: generated.categories,
    article_format: 'weekly-roundup',
    dialogue_blocks: parsed.fixtures.flatMap(f => f.blocks),
    fixture_dialogues: parsed.fixtures,
    fixture_list: selected,
    featured: false,
    status: 'draft',
    generated: true,
    reading_time,
    word_count,
    created_at: new Date(),
  });

  console.log(`[Weekly Roundup] Draft saved: "${title}" (${selected.length} fixtures)`);
}
