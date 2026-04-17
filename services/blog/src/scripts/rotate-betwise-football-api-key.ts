import 'dotenv/config';
import mongoose from 'mongoose';
import { randomBytes, createHash } from 'crypto';
import { BlogTenant } from '../models/BlogTenant';

async function rotate(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const tenant = await BlogTenant.findOne({ id: '9ba280aa-f92b-496b-927c-eb61026ad8df' });
  if (!tenant) {
    console.error('SA Football Bets tenant not found.');
    process.exit(1);
  }

  const plaintextKey = randomBytes(32).toString('hex');
  tenant.api_key = createHash('sha256').update(plaintextKey).digest('hex');
  await tenant.save();

  console.log('');
  console.log('✓ SA Football Bets API key rotated.');
  console.log('─────────────────────────────────────────────────────');
  console.log('Tenant ID: ', tenant.id);
  console.log('New API Key:', plaintextKey);
  console.log('─────────────────────────────────────────────────────');
  console.log('⚠  Save this key — it cannot be recovered.');
  console.log('');
  console.log('Update Vercel env vars (football project):');
  console.log('  ARCLINK_BLOG_TENANT_ID=9ba280aa-f92b-496b-927c-eb61026ad8df');
  console.log(`  ARCLINK_BLOG_API_KEY=${plaintextKey}`);
  console.log('');

  await mongoose.disconnect();
}

rotate().catch((err) => {
  console.error(err);
  process.exit(1);
});
