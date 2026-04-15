import 'dotenv/config';
import mongoose from 'mongoose';
import { createHash } from 'crypto';
import { ContentTenant } from '../models/Tenant';
import { ContentType } from '../models/ContentType';

const SITE_ID = 'satennis';
const RAW_API_KEY = 'satennis-key-change-me';

const fixtureContentType = {
  name: 'Fixture',
  slug: 'fixture',
  fields: [
    { key: 'homeTeam',           label: 'Player / Home',        type: 'text',   required: true,  order: 1 },
    { key: 'awayTeam',           label: 'Player / Away',        type: 'text',   required: true,  order: 2 },
    { key: 'kickoff',            label: 'Match Time (UTC)',      type: 'date',   required: true,  order: 3 },
    { key: 'competition',        label: 'Tournament',           type: 'text',   required: true,  order: 4 },
    { key: 'surface',            label: 'Surface',              type: 'text',   required: false, order: 5 },
    { key: 'round',              label: 'Round',                type: 'text',   required: false, order: 6 },
    { key: 'matchContext',       label: 'Match Context',        type: 'text',   required: false, order: 7 },
    { key: 'featuredBookmakers', label: 'Featured Bookmakers',  type: 'tags',   required: false, order: 8 },
    { key: 'relatedArticleSlug', label: 'Related Article Slug', type: 'text',   required: false, order: 9 },
  ],
};

async function seed(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const existing = await ContentTenant.findOne({ siteId: SITE_ID });
  if (!existing) {
    await ContentTenant.create({
      siteId: SITE_ID,
      name: 'SA Tennis Bets',
      domain: 'satennisbets.co.za',
      adminUsers: [],
      api_key: createHash('sha256').update(RAW_API_KEY).digest('hex'),
      active: true,
    });
    console.log(`Tenant created (raw key: ${RAW_API_KEY})`);
  } else {
    console.log('Tenant already exists — skipping');
  }

  await ContentType.findOneAndUpdate(
    { siteId: SITE_ID, slug: fixtureContentType.slug },
    { siteId: SITE_ID, ...fixtureContentType },
    { upsert: true, new: true }
  );
  console.log(`ContentType seeded: ${fixtureContentType.name}`);

  console.log('SA Tennis Bets content seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
