import 'dotenv/config';
import mongoose from 'mongoose';
import { createHash } from 'crypto';
import { ContentTenant } from '../models/Tenant';
import { ContentType } from '../models/ContentType';
import { ContentEntry } from '../models/ContentEntry';

const SITE_ID = 'betwise-football';
const RAW_API_KEY = 'safootball-key-change-me';

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
    { key: 'featuredBookmakers', label: 'Featured Bookmakers',  type: 'tags',   required: false, order: 7 },
    { key: 'relatedArticleSlug', label: 'Related Article Slug', type: 'text',   required: false, order: 8 },
  ],
};

// Near-term PSL + EPL + UCL fixtures — April 2026
const fixtures = [
  // PSL — April 2026
  {
    slug: 'orlando-pirates-vs-kaizer-chiefs-psl-20260411',
    data: {
      homeTeam: 'Orlando Pirates',
      awayTeam: 'Kaizer Chiefs',
      kickoff: '2026-04-11T15:00:00Z',
      competition: 'PSL',
      venue: 'Orlando Stadium, Soweto',
      matchContext: 'Soweto derby — Pirates lead the head-to-head this season 1-0',
      featuredBookmakers: ['hollywoodbets', 'betway'],
    },
  },
  {
    slug: 'mamelodi-sundowns-vs-supersport-united-psl-20260412',
    data: {
      homeTeam: 'Mamelodi Sundowns',
      awayTeam: 'SuperSport United',
      kickoff: '2026-04-12T13:00:00Z',
      competition: 'PSL',
      venue: 'Loftus Versfeld, Pretoria',
      matchContext: 'Sundowns look to extend title lead over second-placed SuperSport',
      featuredBookmakers: ['hollywoodbets', 'betway'],
    },
  },
  {
    slug: 'stellenbosch-vs-cape-town-city-psl-20260413',
    data: {
      homeTeam: 'Stellenbosch FC',
      awayTeam: 'Cape Town City',
      kickoff: '2026-04-13T13:00:00Z',
      competition: 'PSL',
      venue: 'Danie Craven Stadium, Stellenbosch',
      matchContext: 'Western Cape derby — both clubs in top-half form',
      featuredBookmakers: ['hollywoodbets', 'betway'],
    },
  },
  // EPL — April 2026
  {
    slug: 'arsenal-vs-chelsea-epl-20260412',
    data: {
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      kickoff: '2026-04-12T14:00:00Z',
      competition: 'Premier League',
      venue: 'Emirates Stadium, London',
      matchContext: 'North London vs West London — Arsenal chasing Champions League spot',
      featuredBookmakers: ['hollywoodbets', 'betway'],
    },
  },
  {
    slug: 'manchester-city-vs-liverpool-epl-20260413',
    data: {
      homeTeam: 'Manchester City',
      awayTeam: 'Liverpool',
      kickoff: '2026-04-13T16:30:00Z',
      competition: 'Premier League',
      venue: 'Etihad Stadium, Manchester',
      matchContext: 'Title race flashpoint — two points separate the sides',
      featuredBookmakers: ['hollywoodbets', 'betway'],
    },
  },
  // UCL — April 2026
  {
    slug: 'ucl-qf-leg2-real-madrid-vs-barcelona-20260415',
    data: {
      homeTeam: 'Real Madrid',
      awayTeam: 'Barcelona',
      kickoff: '2026-04-15T19:00:00Z',
      competition: 'Champions League',
      venue: 'Santiago Bernabéu, Madrid',
      matchContext: 'UCL quarter-final 2nd leg — El Clásico in Europe',
      featuredBookmakers: ['hollywoodbets', 'betway'],
    },
  },
  {
    slug: 'ucl-qf-leg2-man-city-vs-psg-20260416',
    data: {
      homeTeam: 'Manchester City',
      awayTeam: 'Paris Saint-Germain',
      kickoff: '2026-04-16T19:00:00Z',
      competition: 'Champions League',
      venue: 'Etihad Stadium, Manchester',
      matchContext: 'UCL quarter-final 2nd leg — City overturn first-leg deficit',
      featuredBookmakers: ['hollywoodbets', 'betway'],
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
      name: 'SA Football Bets',
      domain: 'safootballbets.co.za',
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

  console.log('SA Football Bets seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
