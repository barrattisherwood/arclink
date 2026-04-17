import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import slugify from 'slugify';
import { ContentType } from '../models/ContentType';
import { ContentEntry } from '../models/ContentEntry';

const SPORTDB_BASE = 'https://api.sportdb.dev';
const SPORTDB_HEADERS = () => ({ 'X-API-Key': process.env['SPORTDB_API_KEY']! });
const DAYS_AHEAD = 14;

const SPORTS: Array<{ siteId: string; competitions: Array<{ path: string; name: string }> }> = [
  {
    siteId: 'betwise-cricket',
    competitions: [
      { path: '/api/flashscore/cricket/world:8/one-day-international:OG7nzYAD',      name: 'ODI Series' },
      { path: '/api/flashscore/cricket/world:8/twenty20-international:2i0B6Zul',     name: 'T20 International' },
      { path: '/api/flashscore/cricket/world:8/test-series:AkPEBy3K',                name: 'Test Series' },
      { path: '/api/flashscore/cricket/south-africa:175/sa20:YVsYtcmb',              name: 'SA20' },
      { path: '/api/flashscore/cricket/india:93/ipl:KfDQ6H86',                       name: 'IPL' },
      { path: '/api/flashscore/cricket/south-africa:175/csa-t20-challenge:AVrQexSr', name: 'CSA T20 Challenge' },
    ],
  },
  {
    siteId: 'betwise-rugby',
    competitions: [
      { path: '/api/flashscore/rugby-union/world:8/united-rugby-championship:jBHqXTNh', name: 'United Rugby Championship' },
      { path: '/api/flashscore/rugby-union/south-africa:175/currie-cup:pjUEaE29',       name: 'Currie Cup' },
      { path: '/api/flashscore/rugby-union/world:8/rugby-championship:xxwSbYzH',        name: 'Rugby Championship' },
      { path: '/api/flashscore/rugby-union/world:8/super-rugby:Stv0V7h5',               name: 'Super Rugby' },
    ],
  },
  {
    siteId: 'betwise-football',
    competitions: [
      { path: '/api/flashscore/football/south-africa:175/betway-premiership:WYFXQ1KH', name: 'PSL' },
      { path: '/api/flashscore/football/south-africa:175/nedbank-cup:WMffLgMb',        name: 'Nedbank Cup' },
      { path: '/api/flashscore/football/south-africa:175/carling-knockout:t6G9wMZN',   name: 'Carling Knockout' },
      { path: '/api/flashscore/football/south-africa:175/mtn-8-cup:hrHTRs5B',          name: 'MTN 8' },
      { path: '/api/flashscore/football/africa:1/caf-champions-league:EcZwBi3N',       name: 'CAF Champions League' },
      { path: '/api/flashscore/football/africa:1/africa-cup-of-nations:8bP2bXmH',      name: 'AFCON' },
      { path: '/api/flashscore/football/africa:1/cosafa-cup:tAF6Rzpl',                 name: 'COSAFA Cup' },
      { path: '/api/flashscore/football/england:198/premier-league:dYlOSQOD',          name: 'Premier League' },
      { path: '/api/flashscore/football/europe:6/champions-league:xGrwqq16',           name: 'Champions League' },
      { path: '/api/flashscore/football/europe:6/europa-league:ClDjv3V5',              name: 'Europa League' },
    ],
  },
  {
    siteId: 'satennis',
    competitions: [
      { path: '/api/flashscore/tennis/atp-singles:5724/australian-open:MP4jLdJh',      name: 'Australian Open' },
      { path: '/api/flashscore/tennis/atp-singles:5724/french-open:tItR6sEf',          name: 'French Open' },
      { path: '/api/flashscore/tennis/atp-singles:5724/wimbledon:nZi4fKds',            name: 'Wimbledon' },
      { path: '/api/flashscore/tennis/atp-singles:5724/us-open:65k5lHxU',              name: 'US Open' },
      { path: '/api/flashscore/tennis/atp-singles:5724/indian-wells:EuEPYusS',         name: 'Indian Wells' },
      { path: '/api/flashscore/tennis/atp-singles:5724/miami:lYvC7qBE',               name: 'Miami Open' },
      { path: '/api/flashscore/tennis/atp-singles:5724/monte-carlo:IsxHSx6l',         name: 'Monte Carlo' },
      { path: '/api/flashscore/tennis/atp-singles:5724/madrid:632P4ana',              name: 'Madrid Open' },
      { path: '/api/flashscore/tennis/atp-singles:5724/rome:xIkUr2vO',               name: 'Rome' },
      { path: '/api/flashscore/tennis/atp-singles:5724/cincinnati:vo6KqUyn',          name: 'Cincinnati' },
      { path: '/api/flashscore/tennis/atp-singles:5724/paris:pOtlc1qr',              name: 'Paris Masters' },
      { path: '/api/flashscore/tennis/atp-singles:5724/finals-turin:MeRVE9s8',       name: 'ATP Finals' },
      { path: '/api/flashscore/tennis/atp-singles:5724/rotterdam:r5DdTIZC',          name: 'Rotterdam' },
      { path: '/api/flashscore/tennis/atp-singles:5724/dubai:xKbLXKij',              name: 'Dubai' },
      { path: '/api/flashscore/tennis/atp-singles:5724/rio-de-janeiro:bZLCRom0',     name: 'Rio de Janeiro' },
      { path: '/api/flashscore/tennis/atp-singles:5724/barcelona:rZvXbpeD',          name: 'Barcelona' },
      { path: '/api/flashscore/tennis/atp-singles:5724/munich:6ccef0Jo',             name: 'Munich' },
      { path: '/api/flashscore/tennis/atp-singles:5724/halle:0pOdQOCg',              name: 'Halle' },
      { path: '/api/flashscore/tennis/atp-singles:5724/london:SUpSZy5K',             name: "Queen's Club" },
      { path: '/api/flashscore/tennis/atp-singles:5724/hamburg:I5j9PrSa',            name: 'Hamburg' },
      { path: '/api/flashscore/tennis/atp-singles:5724/washington:rgTHIK74',         name: 'Washington' },
      { path: '/api/flashscore/tennis/atp-singles:5724/beijing:UirAofN6',            name: 'Beijing' },
      { path: '/api/flashscore/tennis/atp-singles:5724/tokyo:lAzP4qg4',              name: 'Tokyo' },
      { path: '/api/flashscore/tennis/atp-singles:5724/vienna:GvgalJQT',             name: 'Vienna' },
      { path: '/api/flashscore/tennis/atp-singles:5724/basel:t8icmqob',              name: 'Basel' },
      { path: '/api/flashscore/tennis/wta-singles:5725/australian-open:0G3fKGYb',    name: 'Australian Open (W)' },
      { path: '/api/flashscore/tennis/wta-singles:5725/wimbledon:hl1W8RZs',          name: 'Wimbledon (W)' },
      { path: '/api/flashscore/tennis/wta-singles:5725/us-open:6g0xhggi',            name: 'US Open (W)' },
    ],
  },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchFixtures(competitions: Array<{ path: string; name: string }>) {
  const fixtures: Array<{ homeTeam: string; awayTeam: string; competition: string; kickoff: string }> = [];
  const now = new Date();
  const cutoff = new Date(Date.now() + DAYS_AHEAD * 86_400_000);

  for (const comp of competitions) {
    try {
      await sleep(300);
      const { data: meta } = await axios.get<{ seasons?: Array<{ season: string; fixtures: string }> }>(
        `${SPORTDB_BASE}${comp.path}`, { headers: SPORTDB_HEADERS() }
      );
      for (const season of (meta.seasons ?? []).slice(0, 3)) {
        await sleep(200);
        const { data: rows } = await axios.get<any[]>(`${SPORTDB_BASE}${season.fixtures}`, { headers: SPORTDB_HEADERS() });
        const upcoming = (rows ?? [])
          .filter(f => f.startDateTimeUtc && new Date(f.startDateTimeUtc) > now && new Date(f.startDateTimeUtc) <= cutoff)
          .map(f => ({ homeTeam: f.homeName || 'TBC', awayTeam: f.awayName || 'TBC', competition: comp.name, kickoff: f.startDateTimeUtc }));
        if (upcoming.length) { fixtures.push(...upcoming); break; }
        const allPast = (rows ?? []).every(f => !f.startDateTimeUtc || new Date(f.startDateTimeUtc) <= now);
        if (allPast && rows?.length) break;
      }
    } catch (err: any) {
      console.error(`  ✗ ${comp.name}:`, err.message);
    }
  }
  return fixtures;
}

async function syncFixtures(siteId: string, fixtures: Array<{ homeTeam: string; awayTeam: string; competition: string; kickoff: string }>) {
  const contentType = await ContentType.findOne({ siteId, slug: 'fixture' });
  if (!contentType) { console.warn(`  No fixture content type for ${siteId} — skipping`); return; }

  for (const f of fixtures as any[]) {
    const dateTag = new Date(f.kickoff).toISOString().slice(0, 10).replace(/-/g, '');
    const slug = slugify(`${f.homeTeam}-vs-${f.awayTeam}-${dateTag}`, { lower: true, strict: true });
    await ContentEntry.findOneAndUpdate(
      { siteId, contentTypeSlug: 'fixture', slug },
      { $set: { siteId, contentTypeId: contentType._id, contentTypeSlug: 'fixture', slug, published: true, data: { homeTeam: f.homeTeam, awayTeam: f.awayTeam, kickoff: f.kickoff, competition: f.competition } } },
      { upsert: true, new: true } as any
    );
  }
  console.log(`  ✓ ${siteId}: ${fixtures.length} fixture(s) synced`);
}

async function run() {
  await mongoose.connect(process.env['MONGODB_URI']!);
  console.log('Connected. Syncing fixtures for all sports...\n');

  for (const sport of SPORTS) {
    console.log(`[${sport.siteId}]`);
    const fixtures = await fetchFixtures(sport.competitions);
    await syncFixtures(sport.siteId, fixtures);
  }

  console.log('\nDone.');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
