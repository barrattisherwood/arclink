import 'dotenv/config';
import mongoose from 'mongoose';
import { createHash } from 'crypto';
import { ContentTenant } from '../models/Tenant';
import { ContentType } from '../models/ContentType';
import { ContentEntry } from '../models/ContentEntry';

const SITE_ID = 'betwise-rugby';
const RAW_API_KEY = 'betwise-rugby-key-change-me';

const fixtureContentType = {
  name: 'Fixture',
  slug: 'fixture',
  fields: [
    { key: 'homeTeam',           label: 'Home Team',             type: 'text',   required: true,  order: 1 },
    { key: 'awayTeam',           label: 'Away Team',             type: 'text',   required: true,  order: 2 },
    { key: 'kickoff',            label: 'Kickoff (UTC)',          type: 'date',   required: true,  order: 3 },
    { key: 'competition',        label: 'Competition',           type: 'text',   required: true,  order: 4 },
    { key: 'venue',              label: 'Venue',                 type: 'text',   required: false, order: 5 },
    { key: 'matchContext',       label: 'Match Context',         type: 'text',   required: false, order: 6 },
    // 'images' type is used here as the closest built-in type that accepts a string array
    { key: 'featuredBookmakers', label: 'Featured Bookmakers',   type: 'images', required: false, order: 7 },
    { key: 'relatedArticleSlug', label: 'Related Article Slug',  type: 'text',   required: false, order: 8 },
  ],
};

const fixtures = [
  // URC
  {
    slug: 'bulls-vs-stormers-2026-04-05',
    data: {
      homeTeam: 'Vodacom Bulls',
      awayTeam: 'DHL Stormers',
      kickoff: '2026-04-05T14:00:00Z',
      competition: 'URC',
      venue: 'Loftus Versfeld',
      matchContext: 'Top-of-the-table clash in the South African derby',
      featuredBookmakers: ['hollywoodbets', 'betway'],
    },
  },
  {
    slug: 'leinster-vs-munster-2026-04-05',
    data: {
      homeTeam: 'Leinster',
      awayTeam: 'Munster',
      kickoff: '2026-04-05T16:00:00Z',
      competition: 'URC',
      venue: 'Aviva Stadium',
      matchContext: "Pro-rugby's biggest derby — bragging rights on the line",
      featuredBookmakers: ['betway', 'bet365'],
    },
  },
  {
    slug: 'sharks-vs-lions-2026-04-12',
    data: {
      homeTeam: 'Cell C Sharks',
      awayTeam: 'Emirates Lions',
      kickoff: '2026-04-12T13:00:00Z',
      competition: 'URC',
      venue: 'Hollywoodbets Kings Park',
      matchContext: 'Both sides fighting for a home quarter-final',
      featuredBookmakers: ['hollywoodbets', 'betway'],
    },
  },
  {
    slug: 'glasgow-vs-scarlets-2026-04-12',
    data: {
      homeTeam: 'Glasgow Warriors',
      awayTeam: 'Scarlets',
      kickoff: '2026-04-12T15:00:00Z',
      competition: 'URC',
      venue: 'Scotstoun Stadium',
      featuredBookmakers: ['bet365', 'betway'],
    },
  },
  // Premiership Rugby
  {
    slug: 'harlequins-vs-bath-2026-04-11',
    data: {
      homeTeam: 'Harlequins',
      awayTeam: 'Bath Rugby',
      kickoff: '2026-04-11T14:30:00Z',
      competition: 'Premiership Rugby',
      venue: 'The Stoop',
      matchContext: 'Bath travel to The Stoop chasing a top-four spot',
      featuredBookmakers: ['bet365', 'betway'],
    },
  },
  {
    slug: 'northampton-vs-saracens-2026-04-11',
    data: {
      homeTeam: 'Northampton Saints',
      awayTeam: 'Saracens',
      kickoff: '2026-04-11T16:45:00Z',
      competition: 'Premiership Rugby',
      venue: "cinch Stadium at Franklin's Gardens",
      featuredBookmakers: ['bet365', 'betway'],
    },
  },
  // Super Rugby Pacific
  {
    slug: 'chiefs-vs-crusaders-2026-04-10',
    data: {
      homeTeam: 'Chiefs',
      awayTeam: 'Crusaders',
      kickoff: '2026-04-10T08:35:00Z',
      competition: 'Super Rugby Pacific',
      venue: 'FMG Stadium Waikato',
      matchContext: "New Zealand's fiercest Super Rugby rivalry",
      featuredBookmakers: ['betway', 'bet365'],
    },
  },
  {
    slug: 'blues-vs-highlanders-2026-04-17',
    data: {
      homeTeam: 'Blues',
      awayTeam: 'Highlanders',
      kickoff: '2026-04-17T09:05:00Z',
      competition: 'Super Rugby Pacific',
      venue: 'Eden Park',
      featuredBookmakers: ['betway', 'bet365'],
    },
  },
];

async function seed(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  // Only create the tenant if it doesn't already exist (avoids overwriting the live API key)
  const existing = await ContentTenant.findOne({ siteId: SITE_ID });
  if (!existing) {
    await ContentTenant.create({
      siteId: SITE_ID,
      name: 'Betwise Rugby',
      domain: 'betwise-rugby.vercel.app',
      adminUsers: [],
      api_key: createHash('sha256').update(RAW_API_KEY).digest('hex'),
      active: true,
    });
    console.log(`Tenant created (raw key: ${RAW_API_KEY})`);
  } else {
    console.log('Tenant already exists — skipping');
  }

  // Upsert the fixture content type
  const contentType = await ContentType.findOneAndUpdate(
    { siteId: SITE_ID, slug: fixtureContentType.slug },
    { siteId: SITE_ID, ...fixtureContentType },
    { upsert: true, new: true }
  );
  console.log(`ContentType seeded: ${fixtureContentType.name}`);

  // Upsert each fixture entry
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

  console.log('Betwise Rugby seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
