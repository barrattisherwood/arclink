import 'dotenv/config';
import mongoose from 'mongoose';
import { BlogTenant } from '../models/BlogTenant';

const TENANT_ID = 'e03819eb-7d15-456d-b108-28e870fa9caa';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);

  const result = await BlogTenant.findOneAndUpdate(
    { id: TENANT_ID },
    { $set: { sport_key: 'rugby_union', sport_label: 'Rugby' } },
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
