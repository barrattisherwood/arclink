import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { Tenant } from '../models/Tenant';

async function seed(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const existing = await Tenant.findOne({ name: 'Machinum Agency Site (dev)' });
  if (existing) {
    console.log('Dev tenant already exists — skipping.');
    console.log('Tenant ID:', existing.id);
    await mongoose.disconnect();
    return;
  }

  const plaintextKey = randomBytes(32).toString('hex');
  const hashedKey = createHash('sha256').update(plaintextKey).digest('hex');

  const tenant = await Tenant.create({
    id: randomUUID(),
    api_key: hashedKey,
    name: 'Machinum Agency Site (dev)',
    allowed_origin: 'http://localhost:4200',
    recipient_email: 'b4rr4tt@gmail.com',
    reply_to_field: 'email',
    rate_limit: 100,
    active: true,
    created_at: new Date(),
  });

  console.log('Dev tenant created.');
  console.log('---');
  console.log('Tenant ID:  ', tenant.id);
  console.log('API Key:    ', plaintextKey);
  console.log('---');
  console.log('Add these to machinum.io .env.local');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
