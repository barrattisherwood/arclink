import 'dotenv/config';
import mongoose from 'mongoose';
import { BlogTenant } from '../models/BlogTenant';
import { runWeeklyRoundup } from '../scheduler-weekly-roundup';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const tenantArg = process.argv[2]; // optional: siteId to run for one tenant only

  const tenants = await BlogTenant.find({
    active: true,
    sport_key: { $exists: true, $ne: '' },
    ...(tenantArg ? { siteId: tenantArg } : {}),
  });

  if (!tenants.length) {
    console.log('No matching tenants found');
    process.exit(0);
  }

  for (const tenant of tenants) {
    console.log(`\n--- Running roundup for: ${tenant.name} (${tenant.siteId}) ---`);
    try {
      await runWeeklyRoundup(tenant);
    } catch (err) {
      console.error(`Failed for ${tenant.name}:`, err);
    }
  }

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
