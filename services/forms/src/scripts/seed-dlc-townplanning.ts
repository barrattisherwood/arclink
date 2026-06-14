import 'dotenv/config';
import mongoose from 'mongoose';
import { randomBytes, createHash } from 'crypto';
import { Tenant } from '../models/Tenant';

async function seed(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const existing = await Tenant.findOne({ id: 'dlc-townplanning' });
  if (existing) {
    console.log('Tenant already exists — skipping.');
    console.log('Tenant ID: dlc-townplanning');
    await mongoose.disconnect();
    return;
  }

  const rawKey = randomBytes(32).toString('hex');

  await Tenant.create({
    id: 'dlc-townplanning',
    api_key: createHash('sha256').update(rawKey).digest('hex'),
    name: 'DLC Town Planning',
    allowed_origin: 'https://dlctownplanning.co.za',
    recipient_email: 'fj@dlcgroup.co.za',
    reply_to_field: 'email',
    brand_color: '#1a3a5c',
    rate_limit: 10,
    active: true,
    created_at: new Date(),
  });

  console.log('DLC Town Planning forms tenant created.');
  console.log('---');
  console.log('Tenant ID:  dlc-townplanning');
  console.log('API Key:    ', rawKey);
  console.log('---');
  console.log('Save the API key — it cannot be recovered.');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
