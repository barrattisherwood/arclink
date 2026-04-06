import 'dotenv/config';
import { fetchUpcomingFixtures } from '../services/sportdb';
import { scoreAndSelectFixtures } from '../services/fixture-selector';

async function run() {
  if (!process.env.SPORTDB_API_KEY) { console.error('SPORTDB_API_KEY not set'); process.exit(1); }

  console.log('Fetching rugby union fixtures (next 14 days)...');
  const fixtures = await fetchUpcomingFixtures('rugby_union', 14);
  console.log(`Fetched ${fixtures.length} fixture(s)`);

  fixtures.forEach(f => console.log(`  ${f.matchLabel} [${f.competition}]`));

  const selected = scoreAndSelectFixtures(fixtures);
  console.log(`\nTop ${selected.length} selected:`);
  selected.forEach((f, i) => console.log(`  ${i + 1}. ${f.matchLabel}`));

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
