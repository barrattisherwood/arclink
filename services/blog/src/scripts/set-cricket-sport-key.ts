import 'dotenv/config';
import mongoose from 'mongoose';
import { BlogTenant } from '../models/BlogTenant';

const TENANT_ID = 'dca2ef78-e282-429f-a410-f8ee246cc212';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);

  const result = await BlogTenant.findOneAndUpdate(
    { id: TENANT_ID },
    { $set: { sport_key: 'cricket', sport_label: 'Cricket' } },
    { new: true },
  );

  if (!result) {
    console.error('Tenant not found:', TENANT_ID);
    process.exit(1);
  }

  console.log(`✓ Updated tenant "${result.name}"`);
  console.log(`  sport_key:   ${result.sport_key}`);
  console.log(`  sport_label: ${result.sport_label}`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
