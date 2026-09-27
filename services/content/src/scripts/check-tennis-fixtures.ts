import 'dotenv/config';
import mongoose from 'mongoose';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const now = new Date().toISOString();
  const entries = await mongoose.connection.collection('contententries')
    .find({ siteId: 'satennis', 'data.kickoff': { $gt: now } })
    .sort({ 'data.kickoff': 1 })
    .toArray();

  console.log(`Upcoming tennis fixtures: ${entries.length}`);
  entries.forEach(e => console.log(
    e.data.competition, '|', e.data.homeTeam, 'vs', e.data.awayTeam, '|', e.data.kickoff
  ));
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
