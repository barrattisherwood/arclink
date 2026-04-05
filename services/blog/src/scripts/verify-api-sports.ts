/**
 * Verify API-Sports league IDs and test fixture fetching.
 * Run via: railway run npx ts-node src/scripts/verify-api-sports.ts
 *
 * Prints all rugby leagues (to confirm IDs) then fetches upcoming fixtures.
 */
import 'dotenv/config';
import axios from 'axios';
import { fetchUpcomingFixtures } from '../services/api-sports';
import { scoreAndSelectFixtures } from '../services/fixture-selector';

const BASE = 'https://v1.rugby.api-sports.io';

async function run() {
  const key = process.env.API_SPORTS_KEY;
  if (!key) { console.error('API_SPORTS_KEY not set'); process.exit(1); }

  // 1. List all leagues so you can confirm IDs
  console.log('--- All Rugby Leagues ---');
  const { data } = await axios.get<{ response: any[] }>(`${BASE}/leagues`, {
    headers: { 'x-apisports-key': key },
  });

  (data.response ?? []).forEach((l: any) => {
    console.log(`  ${String(l.id).padEnd(6)} ${l.name}`);
  });

  // 2. Fetch upcoming fixtures
  console.log('\n--- Fetching upcoming fixtures (next 7 days) ---');
  const fixtures = await fetchUpcomingFixtures('rugby_union', 7);
  console.log(`Fetched ${fixtures.length} total fixtures`);

  // 3. Score and select
  const selected = scoreAndSelectFixtures(fixtures);
  console.log(`\n--- Top ${selected.length} selected ---`);
  selected.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.matchLabel} [${f.competition}]`);
  });

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
