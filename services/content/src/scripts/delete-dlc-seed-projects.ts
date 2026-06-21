import 'dotenv/config';
import mongoose from 'mongoose';
import { ContentEntry } from '../models/ContentEntry';

const SITE_ID = 'dlc-townplanning';

const SEED_SLUGS = [
  'sandton-mixed-use-development',
  'cape-town-waterfront-residential',
  'durban-industrial-park',
  'tatu-city',
  'pretoria-office-park',
  'stellenbosch-residential-estate',
  'port-elizabeth-township',
  'midrand-logistics-hub',
  'umhlanga-retail-centre',
];

async function run(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const result = await ContentEntry.deleteMany({
    siteId: SITE_ID,
    slug: { $in: SEED_SLUGS },
  });

  console.log(`Deleted ${result.deletedCount} seed entries from site '${SITE_ID}'.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
