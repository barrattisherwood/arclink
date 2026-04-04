import 'dotenv/config';
import mongoose from 'mongoose';
import { randomBytes, createHash } from 'crypto';
import { ContentTenant } from '../models/Tenant';
import { ContentType } from '../models/ContentType';

const SITE_ID = 'betwise-rugby';

const contentTypes = [
  {
    name: 'Fixture',
    slug: 'fixture',
    fields: [
      { key: 'homeTeam',            label: 'Home Team',             type: 'text',   required: true,  order: 1, helpText: 'Full team name, e.g. "Springboks"' },
      { key: 'awayTeam',            label: 'Away Team',             type: 'text',   required: true,  order: 2, helpText: 'Full team name, e.g. "Australia"' },
      { key: 'kickoff',             label: 'Kickoff',               type: 'text',   required: true,  order: 3, helpText: 'ISO 8601 datetime with timezone, e.g. "2026-07-18T19:00:00+02:00"' },
      { key: 'competition',         label: 'Competition',           type: 'text',   required: true,  order: 4, helpText: 'e.g. "Rugby Championship" or "URC Round 18"' },
      { key: 'venue',               label: 'Venue',                 type: 'text',   required: false, order: 5, helpText: 'Stadium + city, e.g. "DHL Newlands, Cape Town". Omit to hide.' },
      { key: 'matchContext',        label: 'Match Context',         type: 'text',   required: false, order: 6, helpText: '1–2 sentences shown in italics under the venue.' },
      {
        key: 'featuredBookmakers',
        label: 'Featured Bookmakers',
        type: 'tags',
        required: false,
        order: 7,
        helpText: 'Comma-separated subset to show on this fixture page. Valid keys: hollywoodbets, betway, 10bet, supabets, sportingbet, playa, wsb. Leave blank to show all 7.',
      },
      { key: 'relatedArticleSlug',  label: 'Related Article Slug',  type: 'text',   required: false, order: 8, helpText: 'Slug of a blog article to cross-link at the bottom of the fixture page.' },
    ],
  },
];

async function seed(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const existing = await ContentTenant.findOne({ siteId: SITE_ID });

  let rawApiKey: string;

  if (existing) {
    console.log('betwise-rugby tenant already exists — updating content types only.');
    rawApiKey = '(existing key unchanged)';
  } else {
    rawApiKey = randomBytes(32).toString('hex');
    await ContentTenant.create({
      siteId: SITE_ID,
      name: 'BetWise Rugby',
      domain: 'sarugbybets.co.za',
      adminUsers: [],
      api_key: createHash('sha256').update(rawApiKey).digest('hex'),
      active: true,
    });
    console.log('');
    console.log('✓ betwise-rugby content tenant created.');
    console.log('─────────────────────────────────────────────────────');
    console.log('Content API Key:', rawApiKey);
    console.log('─────────────────────────────────────────────────────');
    console.log('⚠  Save this key — it cannot be recovered.');
    console.log('');
  }

  for (const ct of contentTypes) {
    await ContentType.findOneAndUpdate(
      { siteId: SITE_ID, slug: ct.slug },
      { siteId: SITE_ID, ...ct },
      { upsert: true, new: true }
    );
    console.log(`ContentType seeded: ${ct.name}`);
  }

  console.log('');
  console.log('betwise-rugby content seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
