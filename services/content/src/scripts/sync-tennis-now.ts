import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import slugify from 'slugify';
import { ContentType } from '../models/ContentType';
import { ContentEntry } from '../models/ContentEntry';

const BASE = 'https://api.sportdb.dev';
const HEADERS = () => ({ 'X-API-Key': process.env['SPORTDB_API_KEY']! });
const DAYS_AHEAD = 14;

const COMPETITIONS = [
  { path: '/api/flashscore/tennis/atp-singles:5724/australian-open:MP4jLdJh',      name: 'Australian Open',     tag: 'australian-open' },
  { path: '/api/flashscore/tennis/atp-singles:5724/french-open:tItR6sEf',          name: 'French Open',         tag: 'french-open' },
  { path: '/api/flashscore/tennis/atp-singles:5724/wimbledon:nZi4fKds',            name: 'Wimbledon',           tag: 'wimbledon' },
  { path: '/api/flashscore/tennis/atp-singles:5724/us-open:65k5lHxU',              name: 'US Open',             tag: 'us-open' },
  { path: '/api/flashscore/tennis/atp-singles:5724/indian-wells:EuEPYusS',         name: 'Indian Wells',        tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/miami:lYvC7qBE',                name: 'Miami Open',          tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/monte-carlo:IsxHSx6l',          name: 'Monte Carlo',         tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/madrid:632P4ana',               name: 'Madrid Open',         tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/rome:xIkUr2vO',                 name: 'Rome',                tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/cincinnati:vo6KqUyn',            name: 'Cincinnati',          tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/paris:pOtlc1qr',                name: 'Paris Masters',       tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/finals-turin:MeRVE9s8',         name: 'ATP Finals',          tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/barcelona:rZvXbpeD',            name: 'Barcelona',           tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/munich:6ccef0Jo',               name: 'Munich',              tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/halle:0pOdQOCg',                name: 'Halle',               tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/london:SUpSZy5K',               name: "Queen's Club",        tag: 'atp' },
  { path: '/api/flashscore/tennis/wta-singles:5725/australian-open:0G3fKGYb',      name: 'Australian Open (W)', tag: 'australian-open' },
  { path: '/api/flashscore/tennis/wta-singles:5725/wimbledon:hl1W8RZs',            name: 'Wimbledon (W)',        tag: 'wimbledon' },
  { path: '/api/flashscore/tennis/wta-singles:5725/us-open:6g0xhggi',              name: 'US Open (W)',          tag: 'us-open' },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
  await mongoose.connect(process.env['MONGODB_URI']!);
  console.log('Connected. Syncing tennis fixtures...\n');

  const now = new Date();
  const cutoff = new Date(Date.now() + DAYS_AHEAD * 86_400_000);
  const fixtures: Array<{ homeTeam: string; awayTeam: string; competition: string; tag: string; kickoff: string }> = [];

  for (const comp of COMPETITIONS) {
    try {
      await sleep(300);
      const { data: meta } = await axios.get<{ seasons?: Array<{ season: string; fixtures: string }> }>(
        `${BASE}${comp.path}`, { headers: HEADERS() }
      );
      for (const season of (meta.seasons ?? []).slice(0, 3)) {
        await sleep(200);
        const { data: rows } = await axios.get<any[]>(`${BASE}${season.fixtures}`, { headers: HEADERS() });
        const upcoming = (rows ?? [])
          .filter(f => f.startDateTimeUtc && new Date(f.startDateTimeUtc) > now && new Date(f.startDateTimeUtc) <= cutoff)
          .map(f => ({ homeTeam: f.homeName || 'TBC', awayTeam: f.awayName || 'TBC', competition: comp.name, tag: comp.tag, kickoff: f.startDateTimeUtc }));
        if (upcoming.length) { fixtures.push(...upcoming); console.log(`  ✓ ${comp.name}: ${upcoming.length} fixture(s)`); break; }
        const allPast = (rows ?? []).every(f => !f.startDateTimeUtc || new Date(f.startDateTimeUtc) <= now);
        if (allPast && rows?.length) break;
      }
    } catch (err: any) {
      console.error(`  ✗ ${comp.name}:`, err.message);
    }
  }

  const contentType = await ContentType.findOne({ siteId: 'satennis', slug: 'fixture' });
  if (!contentType) { console.error('No fixture content type for satennis'); process.exit(1); }

  for (const f of fixtures) {
    const dateTag = new Date(f.kickoff).toISOString().slice(0, 10).replace(/-/g, '');
    const slug = slugify(`${f.homeTeam}-vs-${f.awayTeam}-${dateTag}`, { lower: true, strict: true });
    await ContentEntry.findOneAndUpdate(
      { siteId: 'satennis', contentTypeSlug: 'fixture', slug },
      { $set: { siteId: 'satennis', contentTypeId: contentType._id, contentTypeSlug: 'fixture', slug, published: true, data: { homeTeam: f.homeTeam, awayTeam: f.awayTeam, kickoff: f.kickoff, competition: f.competition, tag: f.tag } } },
      { upsert: true, new: true }
    );
  }

  console.log(`\nDone. ${fixtures.length} tennis fixture(s) synced.`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
