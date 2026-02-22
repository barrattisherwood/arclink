import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { Tenant } from '../models/Tenant';

async function seed(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const existing = await Tenant.findOne({ name: 'Machinum Agency Site' });
  if (existing) {
    console.log('Tenant already exists — skipping.');
    console.log('Tenant ID:', existing.id);
    await mongoose.disconnect();
    return;
  }

  const plaintextKey = randomBytes(32).toString('hex');
  const hashedKey = createHash('sha256').update(plaintextKey).digest('hex');

  const tenant = await Tenant.create({
    id: randomUUID(),
    api_key: hashedKey,
    name: 'Machinum Agency Site',
    allowed_origin: 'https://machinum.io',
    recipient_email: 'b4rr4tt@gmail.com',
    reply_to_field: 'email',
    rate_limit: 10,
    active: true,
    created_at: new Date(),
  });

  console.log('Tenant created successfully.');
  console.log('---');
  console.log('Tenant ID:  ', tenant.id);
  console.log('API Key:    ', plaintextKey);
  console.log('---');
  console.log('Save the API key — it cannot be recovered.');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
