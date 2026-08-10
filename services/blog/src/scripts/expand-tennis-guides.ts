/**
 * Expands SA Tennis Bets evergreen guides from ~450 words to target word counts.
 * Also updates the tenant blog_word_count from 450 → 1500 so future generation
 * uses the correct fallback.
 *
 * CLI: default dry-run. Pass --execute to apply changes.
 * API: import runTennisExpansion and call with { execute }.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { BlogTenant, IBlogTenant } from '../models/BlogTenant';
import { Post } from '../models/Post';
import { expandPost, Edition2026 } from '../services/claude';

interface GuideSpec {
  titleMatch: string;
  targetWordCount: number;
  edition2026: Edition2026;
  personaTag: string;
}

const GUIDES: GuideSpec[] = [
  { titleMatch: 'Wimbledon Betting',      targetWordCount: 1800, edition2026: 'retrospective', personaTag: 'yolandi' },
  { titleMatch: 'Roland Garros',          targetWordCount: 1800, edition2026: 'none',          personaTag: 'yolandi' },
  { titleMatch: 'Grass Court Betting',    targetWordCount: 2000, edition2026: 'none',          personaTag: 'yolandi' },
  { titleMatch: 'Clay Court Tennis',      targetWordCount: 2000, edition2026: 'none',          personaTag: 'yolandi' },
  { titleMatch: 'Clay Court Betting',     targetWordCount: 2000, edition2026: 'none',          personaTag: 'yolandi' },
  { titleMatch: 'ATP Masters',            targetWordCount: 1800, edition2026: 'none',          personaTag: 'yolandi' },
  { titleMatch: 'WTA Grand Slam',         targetWordCount: 1800, edition2026: 'none',          personaTag: 'yolandi' },
  { titleMatch: 'US Open',               targetWordCount: 1800, edition2026: 'preview',       personaTag: 'yolandi' },
  { titleMatch: 'Set Handicap',           targetWordCount: 1600, edition2026: 'none',          personaTag: 'yolandi' },
  { titleMatch: 'Total Games',            targetWordCount: 1600, edition2026: 'none',          personaTag: 'yolandi' },
  { titleMatch: 'Head-to-Head Records',   targetWordCount: 1600, edition2026: 'none',          personaTag: 'yolandi' },
  { titleMatch: 'Short-Odds Favourites',  targetWordCount: 1600, edition2026: 'none',          personaTag: 'yolandi' },
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

export interface TitleInfo {
  title: string;
  status: string;
  wordCount: number;
}

export interface PlanEntry {
  specTitle: string;
  dbTitle: string | null;
  found: boolean;
  targetWordCount: number;
  edition2026: Edition2026;
  currentWordCount: number | null;
}

export interface ExpansionResult {
  dbTitle: string;
  success: boolean;
  newWordCount?: number;
  error?: string;
  skipped?: boolean;
}

export interface TennisExpansionOutput {
  allTitles: TitleInfo[];
  plan: PlanEntry[];
  unmatched: string[];
  tenantWordCountUpdated: boolean;
  results: ExpansionResult[];
}

export async function runTennisExpansion(
  execute: boolean,
  tenant: IBlogTenant,
): Promise<TennisExpansionOutput> {
  const allPosts = await Post.find({ tenant_id: tenant.id }).sort({ created_at: -1 });

  const allTitles: TitleInfo[] = allPosts.map(p => ({
    title: p.title,
    status: p.status,
    wordCount: p.word_count ?? countWords(p.content),
  }));

  const plan: PlanEntry[] = GUIDES.map(spec => {
    const post = allPosts.find(p => p.title.toLowerCase().includes(spec.titleMatch.toLowerCase()));
    return {
      specTitle: spec.titleMatch,
      dbTitle: post?.title ?? null,
      found: !!post,
      targetWordCount: spec.targetWordCount,
      edition2026: spec.edition2026,
      currentWordCount: post ? (post.word_count ?? countWords(post.content)) : null,
    };
  });

  const unmatched = plan.filter(p => !p.found).map(p => p.specTitle);

  let tenantWordCountUpdated = false;
  const results: ExpansionResult[] = [];

  if (execute) {
    await BlogTenant.updateOne({ _id: tenant._id }, { $set: { blog_word_count: 1500 } });
    tenantWordCountUpdated = true;

    for (const spec of GUIDES) {
      const post = allPosts.find(p => p.title.toLowerCase().includes(spec.titleMatch.toLowerCase()));
      if (!post) continue;

      const currentWords = post.word_count ?? countWords(post.content);
      if (currentWords >= spec.targetWordCount) {
        results.push({ dbTitle: post.title, success: true, newWordCount: currentWords, skipped: true });
        continue;
      }

      try {
        const expanded = await expandPost({
          title: post.title,
          existingContent: post.content,
          targetWordCount: spec.targetWordCount,
          tenant,
          personaTag: spec.personaTag,
          edition2026: spec.edition2026,
        });

        const wordCount = countWords(expanded.content);
        await Post.updateOne(
          { _id: post._id },
          {
            $set: {
              content: expanded.content,
              excerpt: expanded.excerpt,
              seo_title: expanded.seo_title,
              seo_description: expanded.seo_description,
              categories: expanded.categories,
              tags: [...new Set([...post.tags, ...expanded.tags])],
              word_count: wordCount,
              reading_time: Math.ceil(wordCount / 200),
            },
          }
        );

        results.push({ dbTitle: post.title, success: true, newWordCount: wordCount });
      } catch (err: any) {
        results.push({ dbTitle: post.title, success: false, error: err?.message ?? String(err) });
      }
    }
  }

  return { allTitles, plan, unmatched, tenantWordCountUpdated, results };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  const execute = process.argv.includes('--execute');
  await mongoose.connect(uri);

  const tenant = await BlogTenant.findOne({ siteId: 'satennis' });
  if (!tenant) { console.error('SA Tennis Bets tenant not found'); process.exit(1); }

  const output = await runTennisExpansion(execute, tenant);

  console.log('='.repeat(60));
  console.log('SA Tennis Bets — ALL post titles in DB');
  console.log('='.repeat(60));
  for (const t of output.allTitles) {
    console.log(`  [${t.status}] ${t.wordCount}w  "${t.title}"`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Plan');
  console.log('='.repeat(60));
  for (const entry of output.plan) {
    const found = entry.found ? `→ "${entry.dbTitle}" (${entry.currentWordCount}w)` : 'NOT FOUND';
    console.log(`  ${entry.found ? '✓' : '✗'} "${entry.specTitle}" ${found}`);
  }

  if (output.unmatched.length) {
    console.log(`\nWARNING — ${output.unmatched.length} unmatched:`);
    output.unmatched.forEach(t => console.log(`  ✗ ${t}`));
  }

  if (output.tenantWordCountUpdated) {
    console.log('\nTenant blog_word_count updated → 1500');
  }

  if (output.results.length) {
    console.log('\n' + '='.repeat(60));
    console.log('Expansion results');
    console.log('='.repeat(60));
    for (const r of output.results) {
      if (r.success) {
        console.log(`  ✓ "${r.dbTitle}" → ${r.newWordCount}w`);
      } else {
        console.log(`  ✗ "${r.dbTitle}" — ${r.error}`);
      }
    }
  }

  if (!execute) {
    console.log('\n[DRY RUN] Pass --execute to apply changes.');
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch(err => { console.error(err); process.exit(1); });
}
