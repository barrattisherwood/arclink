import 'dotenv/config';
import mongoose from 'mongoose';
import { BlogTenant } from '../models/BlogTenant';

// Maps tenant name → siteId (the URL slug used in the admin, e.g. /sites/:siteId)
// Override via env vars: MACHINUM_SITE_ID
const TENANT_SITE_IDS: Record<string, string> = {
  'Machinum Agency Site': process.env.MACHINUM_SITE_ID ?? 'machinum',
};

async function migrate(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  for (const [name, siteId] of Object.entries(TENANT_SITE_IDS)) {
    const tenant = await BlogTenant.findOne({ name });
    if (!tenant) {
      console.log(`Tenant "${name}" not found — skipping.`);
      continue;
    }
    if (tenant.siteId === siteId) {
      console.log(`Tenant "${name}" already has siteId="${siteId}" — skipping.`);
      continue;
    }
    await BlogTenant.updateOne({ name }, { $set: { siteId } });
    console.log(`Updated "${name}" → siteId="${siteId}"`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
