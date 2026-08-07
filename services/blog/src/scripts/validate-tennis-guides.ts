import 'dotenv/config';
import mongoose from 'mongoose';
import { BlogTenant } from '../models/BlogTenant';
import { Post } from '../models/Post';

const GUIDE_TARGETS: { title: string; minWords: number }[] = [
  { title: 'Wimbledon Betting',       minWords: 1800 },
  { title: 'Roland Garros',           minWords: 1800 },
  { title: 'Grass Court Betting',     minWords: 2000 },
  { title: 'Clay Court Tennis',       minWords: 2000 },
  { title: 'Clay Court Betting',      minWords: 2000 },
  { title: 'ATP Masters',             minWords: 1800 },
  { title: 'WTA Grand Slam',          minWords: 1800 },
  { title: 'US Open',                 minWords: 1800 },
  { title: 'Set Handicap',            minWords: 1600 },
  { title: 'Total Games',             minWords: 1600 },
  { title: 'Head-to-Head Records',    minWords: 1600 },
  { title: 'Short-Odds Favourites',   minWords: 1600 },
];

const PROHIBITED_CTAS = ['bet now', 'sign up', 'claim your', 'join today', 'place a wager on', 'back '];

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

function countH2s(content: string): number {
  return (content.match(/^## /gm) || []).length;
}

function hasFaq(content: string): boolean {
  return /^## (faq|frequently asked questions)/im.test(content);
}

function hasBookmakersLink(content: string): boolean {
  return content.includes('/bookmakers');
}

function findProhibitedCtas(content: string): string[] {
  const lower = content.toLowerCase();
  return PROHIBITED_CTAS.filter(cta => lower.includes(cta));
}

function checkSeoDescription(desc: string | undefined): string {
  if (!desc) return 'MISSING';
  const len = desc.length;
  if (len < 140) return `TOO SHORT (${len} chars, need 140+)`;
  if (len > 160) return `TOO LONG (${len} chars, max 160)`;
  return `OK (${len} chars)`;
}

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);

  const tenant = await BlogTenant.findOne({ siteId: 'satennis' });
  if (!tenant) { console.error('SA Tennis Bets tenant not found'); process.exit(1); }

  console.log('='.repeat(60));
  console.log('SA Tennis Bets — ALL post titles in DB');
  console.log('='.repeat(60));

  const allPosts = await Post.find({ tenant_id: tenant.id }).sort({ created_at: -1 });
  for (const p of allPosts) {
    console.log(`  [${p.status}] ${p.word_count ?? '?'}w  "${p.title}"`);
  }

  console.log(`\nTotal posts: ${allPosts.length}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('Validation report — 12 guide articles');
  console.log('='.repeat(60));

  let passCount = 0;
  let failCount = 0;
  let notFoundCount = 0;

  for (const spec of GUIDE_TARGETS) {
    const post = allPosts.find(p => p.title.toLowerCase().includes(spec.title.toLowerCase()));

    if (!post) {
      console.log(`\n[ NOT FOUND ] "${spec.title}"`);
      notFoundCount++;
      continue;
    }

    const words = countWords(post.content);
    const h2s = countH2s(post.content);
    const faq = hasFaq(post.content);
    const bookmakers = hasBookmakersLink(post.content);
    const ctas = findProhibitedCtas(post.content);
    const seoDesc = checkSeoDescription(post.seo_description);

    const wordOk = words >= spec.minWords;
    const h2Ok = h2s >= 4;
    const faqOk = faq;
    const bookmakersOk = bookmakers;
    const ctaOk = ctas.length === 0;
    const seoOk = seoDesc.startsWith('OK');

    const allOk = wordOk && h2Ok && faqOk && bookmakersOk && ctaOk && seoOk;
    if (allOk) passCount++; else failCount++;

    const tick = (ok: boolean) => ok ? '✓' : '✗';

    console.log(`\n${allOk ? '[PASS]' : '[FAIL]'} "${post.title}"`);
    console.log(`  ${tick(wordOk)} Word count: ${words} (target: ${spec.minWords}+)`);
    console.log(`  ${tick(h2Ok)} H2 headings: ${h2s} (need 4+)`);
    console.log(`  ${tick(faqOk)} FAQ section: ${faq ? 'present' : 'MISSING'}`);
    console.log(`  ${tick(bookmakersOk)} /bookmakers link: ${bookmakers ? 'present' : 'MISSING'}`);
    console.log(`  ${tick(ctaOk)} Prohibited CTAs: ${ctas.length === 0 ? 'none' : ctas.join(', ')}`);
    console.log(`  ${tick(seoOk)} seo_description: ${seoDesc}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${passCount} passed, ${failCount} failed, ${notFoundCount} not found`);
  console.log('='.repeat(60));

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
