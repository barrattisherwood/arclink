import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { BlogTenant } from '../models/BlogTenant';

async function seed(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const existing = await BlogTenant.findOne({ name: 'BetWise Rugby' });
  if (existing) {
    console.log('BetWise Rugby tenant already exists — skipping.');
    console.log('Tenant ID:', existing.id);
    await mongoose.disconnect();
    return;
  }

  const plaintextKey = randomBytes(32).toString('hex');
  const hashedKey = createHash('sha256').update(plaintextKey).digest('hex');

  const tenant = await BlogTenant.create({
    id: randomUUID(),
    api_key: hashedKey,
    name: 'BetWise Rugby',
    allowed_origin: 'https://your-rugby-domain.co.za', // update before go-live
    active: true,

    blog_subject:
      'South African rugby betting — URC odds analysis, Currie Cup fixture previews, ' +
      'Springbok test match previews, bookmaker comparisons, and value bet ' +
      'identification for SA and international rugby markets',

    blog_audience:
      'South African rugby bettors aged 25–50 who follow the Currie Cup, URC, ' +
      'and Springboks. Comfortable with decimal odds. Want informed set-piece ' +
      'and tactical analysis alongside the betting angle, not just score predictions',

    blog_tone:
      'Two distinct editorial voices. Voice 1 — Danie van Wyk: dry SA rugby authority, ' +
      'set-piece obsessed, Afrikaans-adjacent cultural texture, builds his case ' +
      'methodically and always connects analysis to the specific odds on offer. ' +
      'Voice 2 — Marcus Webb: Welsh-born, 15 years in SA rugby, tactical precision ' +
      'focused on defensive systems and market inefficiencies, sardonic about odds that ' +
      'have clearly not watched the team. Both voices: never fabricate statistics, ' +
      'always connect insight to the betting decision, never use football vocabulary.',

    blog_word_count: 450,
    blog_cadence: 2,       // 2 posts per week — matches URC/Currie Cup rhythm
    blog_publish_day: 5,   // Friday — ahead of Saturday fixtures
    blog_publish_hour: 7,  // 07:00 — morning before matchday build-up

    blog_predefined_tags: [
      'urc',
      'currie-cup',
      'springboks',
      'super-rugby',
      'fixture-preview',
      'odds-analysis',
      'value-bets',
      'set-piece',
      'danie',    // routes to Danie van Wyk persona byline
      'marcus',   // routes to Marcus Webb persona byline
    ],

    blog_predefined_categories: [
      'Fixture Previews',
      'Odds Analysis',
      'Bookmaker Reviews',
      'Rugby Betting Guide',
    ],

    blog_canonical_base: 'https://your-rugby-domain.co.za', // update before go-live

    created_at: new Date(),
  });

  console.log('');
  console.log('✓ BetWise Rugby blog tenant created successfully.');
  console.log('─────────────────────────────────────────────');
  console.log('Tenant ID:  ', tenant.id);
  console.log('API Key:    ', plaintextKey);
  console.log('─────────────────────────────────────────────');
  console.log('⚠  Save the API key now — it cannot be recovered.');
  console.log('   Add both values to:');
  console.log('   • apps/rugby/src/environments/environment.ts');
  console.log('   • Vercel project environment variables');
  console.log('');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});