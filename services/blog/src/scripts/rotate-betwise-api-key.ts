import 'dotenv/config';
import mongoose from 'mongoose';
import { randomBytes, createHash } from 'crypto';
import { BlogTenant } from '../models/BlogTenant';

async function rotate(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const tenant = await BlogTenant.findOne({ id: 'e03819eb-7d15-456d-b108-28e870fa9caa' });
  if (!tenant) {
    console.error('BetWise Rugby tenant not found.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const plaintextKey = randomBytes(32).toString('hex');
  tenant.api_key = createHash('sha256').update(plaintextKey).digest('hex');
  await tenant.save();

  console.log('');
  console.log('✓ BetWise Rugby API key rotated.');
  console.log('─────────────────────────────────────────────────────');
  console.log('New API Key:', plaintextKey);
  console.log('─────────────────────────────────────────────────────');
  console.log('⚠  Save this key — it cannot be recovered.');
  console.log('');
  console.log('Update these environment variables:');
  console.log('  sarugbybets.co.za (Vercel): ARCLINK_BLOG_API_KEY');
  console.log('  Arclink admin dashboard: blog API key for betwise-rugby');
  console.log('');

  await mongoose.disconnect();
}

rotate().catch((err) => {
  console.error(err);
  process.exit(1);
});
