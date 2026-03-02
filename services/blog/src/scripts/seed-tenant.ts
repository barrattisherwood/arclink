import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { BlogTenant } from '../models/BlogTenant';

async function seed(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const existing = await BlogTenant.findOne({ name: 'Machinum Agency Site' });
  if (existing) {
    console.log('Blog tenant already exists — skipping.');
    console.log('Tenant ID:', existing.id);
    await mongoose.disconnect();
    return;
  }

  const plaintextKey = randomBytes(32).toString('hex');
  const hashedKey = createHash('sha256').update(plaintextKey).digest('hex');

  const tenant = await BlogTenant.create({
    id: randomUUID(),
    api_key: hashedKey,
    name: 'Machinum Agency Site',
    allowed_origin: 'https://machinum.io',
    active: true,
    blog_subject: 'Full-stack web application development, Angular architecture, and creative technology solutions for digital products',
    blog_audience: 'Startup founders, product managers, and technical decision-makers building innovative digital products and scalable web applications',
    blog_tone: 'Direct and technically confident without unnecessary jargon - honest insights from hands-on development experience, brutally practical, no corporate fluff',
    blog_word_count: 1500,
    blog_cadence: 1,
    blog_publish_day: 2,
    blog_publish_hour: 9,
    blog_predefined_tags: [],
    created_at: new Date(),
  });

  console.log('Blog tenant created successfully.');
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
