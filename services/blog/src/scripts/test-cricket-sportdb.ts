import 'dotenv/config';
import { fetchUpcomingFixtures } from '../services/sportdb';

process.env.SPORTDB_API_KEY = process.env.SPORTDB_API_KEY || 'jBF4QQRf4zQqJioackM8xbw0YDE9xaiXJCQx8OnP';

async function run() {
  console.log('Fetching cricket fixtures (next 14 days)...');
  const fixtures = await fetchUpcomingFixtures('cricket', 14);
  console.log(`Fetched ${fixtures.length} fixture(s)`);
  fixtures.forEach(f => console.log(`  ${f.matchLabel} [${f.competition}]`));
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
