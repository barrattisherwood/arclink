import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import slugify from 'slugify';
import { ContentType } from '../models/ContentType';
import { ContentEntry } from '../models/ContentEntry';

const SPORTDB_BASE = 'https://api.sportdb.dev';
const SPORTDB_HEADERS = () => ({ 'X-API-Key': process.env['SPORTDB_API_KEY']! });
const DAYS_AHEAD = 14;

const SPORTS: Array<{ siteId: string; competitions: Array<{ path: string; name: string; tag: string }> }> = [
  {
    siteId: 'betwise-cricket',
    competitions: [
      { path: '/api/flashscore/cricket/world:8/one-day-international:OG7nzYAD',      name: 'ODI Series',        tag: 'odi' },
      { path: '/api/flashscore/cricket/world:8/twenty20-international:2i0B6Zul',     name: 'T20 International', tag: 't20i' },
      { path: '/api/flashscore/cricket/world:8/test-series:AkPEBy3K',                name: 'Test Series',       tag: 'test' },
      { path: '/api/flashscore/cricket/south-africa:175/sa20:YVsYtcmb',              name: 'SA20',              tag: 'sa20' },
      { path: '/api/flashscore/cricket/india:93/ipl:KfDQ6H86',                       name: 'IPL',               tag: 'ipl' },
      { path: '/api/flashscore/cricket/south-africa:175/csa-t20-challenge:AVrQexSr', name: 'CSA T20 Challenge', tag: 'csa-t20' },
    ],
  },
  {
    siteId: 'betwise-rugby',
    competitions: [
      { path: '/api/flashscore/rugby-union/world:8/united-rugby-championship:jBHqXTNh', name: 'United Rugby Championship', tag: 'urc' },
      { path: '/api/flashscore/rugby-union/south-africa:175/currie-cup:pjUEaE29',       name: 'Currie Cup',                tag: 'currie-cup' },
      { path: '/api/flashscore/rugby-union/world:8/rugby-championship:xxwSbYzH',        name: 'Rugby Championship',        tag: 'rugby-championship' },
      { path: '/api/flashscore/rugby-union/world:8/super-rugby:Stv0V7h5',               name: 'Super Rugby',               tag: 'super-rugby' },
    ],
  },
  {
    siteId: 'betwise-football',
    competitions: [
      { path: '/api/flashscore/football/south-africa:175/betway-premiership:WYFXQ1KH', name: 'PSL',                  tag: 'psl' },
      { path: '/api/flashscore/football/south-africa:175/nedbank-cup:WMffLgMb',        name: 'Nedbank Cup',          tag: 'psl' },
      { path: '/api/flashscore/football/south-africa:175/carling-knockout:t6G9wMZN',   name: 'Carling Knockout',     tag: 'psl' },
      { path: '/api/flashscore/football/south-africa:175/mtn-8-cup:hrHTRs5B',          name: 'MTN 8',                tag: 'psl' },
      { path: '/api/flashscore/football/africa:1/caf-champions-league:EcZwBi3N',       name: 'CAF Champions League', tag: 'caf' },
      { path: '/api/flashscore/football/africa:1/africa-cup-of-nations:8bP2bXmH',      name: 'AFCON',                tag: 'afcon' },
      { path: '/api/flashscore/football/africa:1/cosafa-cup:tAF6Rzpl',                 name: 'COSAFA Cup',           tag: 'bafana' },
      { path: '/api/flashscore/football/england:198/premier-league:dYlOSQOD',          name: 'Premier League',       tag: 'epl' },
      { path: '/api/flashscore/football/europe:6/champions-league:xGrwqq16',           name: 'Champions League',     tag: 'ucl' },
      { path: '/api/flashscore/football/europe:6/europa-league:ClDjv3V5',              name: 'Europa League',        tag: 'ucl' },
    ],
  },
  {
    siteId: 'satennis',
    competitions: [
      { path: '/api/flashscore/tennis/atp-singles:5724/australian-open:MP4jLdJh',      name: 'Australian Open',   tag: 'australian-open' },
      { path: '/api/flashscore/tennis/atp-singles:5724/french-open:tItR6sEf',          name: 'French Open',       tag: 'french-open' },
      { path: '/api/flashscore/tennis/atp-singles:5724/wimbledon:nZi4fKds',            name: 'Wimbledon',         tag: 'wimbledon' },
      { path: '/api/flashscore/tennis/atp-singles:5724/us-open:65k5lHxU',              name: 'US Open',           tag: 'us-open' },
      { path: '/api/flashscore/tennis/atp-singles:5724/indian-wells:EuEPYusS',         name: 'Indian Wells',      tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/miami:lYvC7qBE',                name: 'Miami Open',        tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/monte-carlo:IsxHSx6l',          name: 'Monte Carlo',       tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/madrid:632P4ana',               name: 'Madrid Open',       tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/rome:xIkUr2vO',                 name: 'Rome',              tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/cincinnati:vo6KqUyn',            name: 'Cincinnati',        tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/paris:pOtlc1qr',                name: 'Paris Masters',     tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/finals-turin:MeRVE9s8',         name: 'ATP Finals',        tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/rotterdam:r5DdTIZC',            name: 'Rotterdam',         tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/dubai:xKbLXKij',                name: 'Dubai',             tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/rio-de-janeiro:bZLCRom0',       name: 'Rio de Janeiro',    tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/barcelona:rZvXbpeD',            name: 'Barcelona',         tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/munich:6ccef0Jo',               name: 'Munich',            tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/halle:0pOdQOCg',                name: 'Halle',             tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/london:SUpSZy5K',               name: "Queen's Club",      tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/hamburg:I5j9PrSa',              name: 'Hamburg',           tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/washington:rgTHIK74',           name: 'Washington',        tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/beijing:UirAofN6',              name: 'Beijing',           tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/tokyo:lAzP4qg4',                name: 'Tokyo',             tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/vienna:GvgalJQT',               name: 'Vienna',            tag: 'atp' },
      { path: '/api/flashscore/tennis/atp-singles:5724/basel:t8icmqob',                name: 'Basel',             tag: 'atp' },
      { path: '/api/flashscore/tennis/wta-singles:5725/australian-open:0G3fKGYb',      name: 'Australian Open (W)', tag: 'australian-open' },
      { path: '/api/flashscore/tennis/wta-singles:5725/wimbledon:hl1W8RZs',            name: 'Wimbledon (W)',       tag: 'wimbledon' },
      { path: '/api/flashscore/tennis/wta-singles:5725/us-open:6g0xhggi',              name: 'US Open (W)',         tag: 'us-open' },
    ],
  },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchFixtures(competitions: Array<{ path: string; name: string; tag: string }>) {
  const fixtures: Array<{ homeTeam: string; awayTeam: string; competition: string; tag: string; kickoff: string }> = [];
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
          .map(f => ({ homeTeam: f.homeName || 'TBC', awayTeam: f.awayName || 'TBC', competition: comp.name, tag: comp.tag, kickoff: f.startDateTimeUtc }));
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

async function syncFixtures(siteId: string, fixtures: Array<{ homeTeam: string; awayTeam: string; competition: string; tag: string; kickoff: string }>) {
  const contentType = await ContentType.findOne({ siteId, slug: 'fixture' });
  if (!contentType) { console.warn(`  No fixture content type for ${siteId} — skipping`); return; }

  for (const f of fixtures as any[]) {
    const dateTag = new Date(f.kickoff).toISOString().slice(0, 10).replace(/-/g, '');
    const slug = slugify(`${f.homeTeam}-vs-${f.awayTeam}-${dateTag}`, { lower: true, strict: true });
    await ContentEntry.findOneAndUpdate(
      { siteId, contentTypeSlug: 'fixture', slug },
      { $set: { siteId, contentTypeId: contentType._id, contentTypeSlug: 'fixture', slug, published: true, data: { homeTeam: f.homeTeam, awayTeam: f.awayTeam, kickoff: f.kickoff, competition: f.competition, tag: f.tag } } },
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
