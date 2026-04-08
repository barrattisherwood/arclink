import 'dotenv/config';
import mongoose from 'mongoose';
import { createHash } from 'crypto';
import { ContentTenant } from '../models/Tenant';
import { ContentType } from '../models/ContentType';
import { ContentEntry } from '../models/ContentEntry';

const SITE_ID = 'betwise-cricket';
const RAW_API_KEY = 'betwise-cricket-key-change-me';

const fixtureContentType = {
  name: 'Fixture',
  slug: 'fixture',
  fields: [
    { key: 'homeTeam',           label: 'Home Team',            type: 'text',   required: true,  order: 1 },
    { key: 'awayTeam',           label: 'Away Team',            type: 'text',   required: true,  order: 2 },
    { key: 'kickoff',            label: 'Kickoff (UTC)',         type: 'date',   required: true,  order: 3 },
    { key: 'competition',        label: 'Competition',          type: 'text',   required: true,  order: 4 },
    { key: 'venue',              label: 'Venue',                type: 'text',   required: false, order: 5 },
    { key: 'matchContext',       label: 'Match Context',        type: 'text',   required: false, order: 6 },
    { key: 'featuredBookmakers', label: 'Featured Bookmakers',  type: 'images', required: false, order: 7 },
    { key: 'relatedArticleSlug', label: 'Related Article Slug', type: 'text',   required: false, order: 8 },
  ],
};

const fixtures = [
  // England Tour of SA — ODI Series
  {
    slug: 'proteas-vs-england-1st-odi-2026',
    data: {
      homeTeam: 'South Africa',
      awayTeam: 'England',
      kickoff: '2026-09-12T11:00:00Z',
      competition: 'England Tour of SA — 1st ODI',
      venue: 'The Wanderers, Johannesburg',
      matchContext: 'Series opener — England arrive fresh off a home summer',
      featuredBookmakers: ['hollywoodbets', 'betway', '10bet'],
    },
  },
  {
    slug: 'proteas-vs-england-2nd-odi-2026',
    data: {
      homeTeam: 'South Africa',
      awayTeam: 'England',
      kickoff: '2026-09-15T11:00:00Z',
      competition: 'England Tour of SA — 2nd ODI',
      venue: 'SuperSport Park, Centurion',
      featuredBookmakers: ['hollywoodbets', 'betway', '10bet'],
    },
  },
  {
    slug: 'proteas-vs-england-3rd-odi-2026',
    data: {
      homeTeam: 'South Africa',
      awayTeam: 'England',
      kickoff: '2026-09-18T11:00:00Z',
      competition: 'England Tour of SA — 3rd ODI',
      venue: 'Newlands, Cape Town',
      matchContext: 'Series decider — winner takes the ODI trophy',
      featuredBookmakers: ['hollywoodbets', 'betway', '10bet', 'supabets'],
    },
  },
  // England Tour of SA — Test Series
  {
    slug: 'proteas-vs-england-1st-test-2026',
    data: {
      homeTeam: 'South Africa',
      awayTeam: 'England',
      kickoff: '2026-09-28T08:00:00Z',
      competition: 'England Tour of SA — 1st Test',
      venue: 'SuperSport Park, Centurion',
      matchContext: 'Five-day Test — Proteas looking to avenge last summer',
      featuredBookmakers: ['betway', '10bet', 'sportingbet'],
    },
  },
  {
    slug: 'proteas-vs-england-2nd-test-2026',
    data: {
      homeTeam: 'South Africa',
      awayTeam: 'England',
      kickoff: '2026-10-07T08:00:00Z',
      competition: 'England Tour of SA — 2nd Test',
      venue: 'Newlands, Cape Town',
      featuredBookmakers: ['betway', '10bet', 'sportingbet'],
    },
  },
  // SA20
  {
    slug: 'mi-cape-town-vs-paarl-royals-sa20-2027-m1',
    data: {
      homeTeam: 'MI Cape Town',
      awayTeam: 'Paarl Royals',
      kickoff: '2027-01-09T16:00:00Z',
      competition: 'SA20 2027 · Match 1',
      venue: 'Newlands, Cape Town',
      matchContext: 'SA20 season opener — defending champions MI Cape Town at home',
      featuredBookmakers: ['hollywoodbets', 'betway', 'supabets', 'playa'],
    },
  },
  {
    slug: 'sunrisers-eastern-cape-vs-durban-super-giants-sa20-2027-m2',
    data: {
      homeTeam: 'Sunrisers Eastern Cape',
      awayTeam: 'Durban Super Giants',
      kickoff: '2027-01-10T12:00:00Z',
      competition: 'SA20 2027 · Match 2',
      venue: 'St George\'s Park, Gqeberha',
      featuredBookmakers: ['hollywoodbets', 'betway', 'supabets'],
    },
  },
  {
    slug: 'joburg-super-kings-vs-pretoria-capitals-sa20-2027-m3',
    data: {
      homeTeam: 'Joburg Super Kings',
      awayTeam: 'Pretoria Capitals',
      kickoff: '2027-01-11T16:00:00Z',
      competition: 'SA20 2027 · Match 3',
      venue: 'The Wanderers, Johannesburg',
      matchContext: 'Highveld derby — rivals separated by 50km',
      featuredBookmakers: ['hollywoodbets', 'betway', 'wsb', 'playa'],
    },
  },
];

async function seed(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const existing = await ContentTenant.findOne({ siteId: SITE_ID });
  if (!existing) {
    await ContentTenant.create({
      siteId: SITE_ID,
      name: 'Betwise Cricket',
      domain: 'betwise-cricket.vercel.app',
      adminUsers: [],
      api_key: createHash('sha256').update(RAW_API_KEY).digest('hex'),
      active: true,
    });
    console.log(`Tenant created (raw key: ${RAW_API_KEY})`);
  } else {
    console.log('Tenant already exists — skipping');
  }

  const contentType = await ContentType.findOneAndUpdate(
    { siteId: SITE_ID, slug: fixtureContentType.slug },
    { siteId: SITE_ID, ...fixtureContentType },
    { upsert: true, new: true }
  );
  console.log(`ContentType seeded: ${fixtureContentType.name}`);

  for (const fixture of fixtures) {
    await ContentEntry.findOneAndUpdate(
      { siteId: SITE_ID, contentTypeSlug: 'fixture', slug: fixture.slug },
      {
        siteId: SITE_ID,
        contentTypeId: contentType._id,
        contentTypeSlug: 'fixture',
        slug: fixture.slug,
        published: true,
        data: fixture.data,
      },
      { upsert: true, new: true }
    );
    console.log(`  fixture: ${fixture.slug}`);
  }

  console.log('Betwise Cricket seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
