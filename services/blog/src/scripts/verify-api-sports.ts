/**
 * Verify API-Sports league IDs and test fixture fetching.
 * Run via: railway run npx ts-node src/scripts/verify-api-sports.ts
 *
 * Prints all rugby leagues (to confirm IDs) then fetches upcoming fixtures.
 */
import 'dotenv/config';
import axios from 'axios';
import { fetchUpcomingFixtures } from '../services/sportdb';
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

  // 2. Probe the first league with raw logging to diagnose
  console.log('\n--- Raw probe: URC (76) next 10 games, season 2025 ---');
  const now = new Date();
  const season = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
  console.log('  Using season:', season);

  const probeNext = await axios.get<any>(`${BASE}/games`, {
    headers: { 'x-apisports-key': key },
    params: { league: 76, season, next: 10 }
  });
  console.log('  results (next):', probeNext.data.results, '| errors:', JSON.stringify(probeNext.data.errors));
  if (probeNext.data.response?.length) {
    console.log('  first game:', JSON.stringify(probeNext.data.response[0], null, 2));
  }

  // Also try with from/to dates
  const from = now.toISOString().split('T')[0];
  const to = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
  console.log(`\n--- Raw probe: URC (76) from ${from} to ${to} ---`);
  const probeDate = await axios.get<any>(`${BASE}/games`, {
    headers: { 'x-apisports-key': key },
    params: { league: 76, season, from, to }
  });
  console.log('  results (date range):', probeDate.data.results, '| errors:', JSON.stringify(probeDate.data.errors));
  if (probeDate.data.response?.length) {
    console.log('  first game:', JSON.stringify(probeDate.data.response[0], null, 2));
  }

  // 3. Fetch upcoming fixtures
  console.log('\n--- Fetching upcoming fixtures (next 14 days) ---');
  const fixtures = await fetchUpcomingFixtures('rugby_union', 14);
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
