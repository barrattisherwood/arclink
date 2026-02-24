import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { Tenant } from '../models/Tenant';

async function seed(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  // ── Site contact form ────────────────────────────────────────────────────
  const existingSite = await Tenant.findOne({ name: 'findtherapy.care — Site Contact' });
  if (existingSite) {
    console.log('Site contact tenant already exists — skipping.');
    console.log('Tenant ID:', existingSite.id);
  } else {
    const siteKey = randomBytes(32).toString('hex');
    const siteTenant = await Tenant.create({
      id: randomUUID(),
      api_key: createHash('sha256').update(siteKey).digest('hex'),
      name: 'findtherapy.care — Site Contact',
      allowed_origin: 'https://findtherapy.care',
      recipient_email: 'b4rr4tt@gmail.com',
      reply_to_field: 'email',
      brand_color: '#4b5443',
      rate_limit: 10,
      active: true,
      created_at: new Date(),
    });

    console.log('Site contact tenant created.');
    console.log('---');
    console.log('Tenant ID:  ', siteTenant.id);
    console.log('API Key:    ', siteKey);
    console.log('---');
  }

  // ── Provider contact form ────────────────────────────────────────────────
  const existingProvider = await Tenant.findOne({ name: 'findtherapy.care — Provider Contact' });
  if (existingProvider) {
    console.log('Provider contact tenant already exists — skipping.');
    console.log('Tenant ID:', existingProvider.id);
  } else {
    const providerKey = randomBytes(32).toString('hex');
    const providerTenant = await Tenant.create({
      id: randomUUID(),
      api_key: createHash('sha256').update(providerKey).digest('hex'),
      name: 'findtherapy.care — Provider Contact',
      allowed_origin: 'https://findtherapy.care',
      recipient_email: 'b4rr4tt@gmail.com',
      recipient_field: 'provider_email',
      reply_to_field: 'email',
      brand_color: '#4b5443',
      rate_limit: 10,
      active: true,
      created_at: new Date(),
    });

    console.log('Provider contact tenant created.');
    console.log('---');
    console.log('Tenant ID:  ', providerTenant.id);
    console.log('API Key:    ', providerKey);
    console.log('---');
    console.log('Frontend: include a hidden field named "provider_email" with the provider\'s email address.');
  }

  console.log('Save API keys — they cannot be recovered.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
