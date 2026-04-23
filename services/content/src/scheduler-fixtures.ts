import cron from 'node-cron';
import axios from 'axios';
import slugify from 'slugify';
import { ContentType } from './models/ContentType';
import { ContentEntry } from './models/ContentEntry';
import { CronLog } from './models/CronLog';

// ---------------------------------------------------------------------------
// SportDB config — mirrors services/blog/src/services/sportdb.ts
// ---------------------------------------------------------------------------
const SPORTDB_BASE = 'https://api.sportdb.dev';
const SPORTDB_HEADERS = () => ({ 'X-API-Key': process.env['SPORTDB_API_KEY']! });

interface LiveFixture {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  tag: string;
  kickoff: string; // ISO UTC
}

export const CRICKET_COMPETITIONS = [
  { path: '/api/flashscore/cricket/world:8/one-day-international:OG7nzYAD',      name: 'ODI Series',        tag: 'odi' },
  { path: '/api/flashscore/cricket/world:8/twenty20-international:2i0B6Zul',     name: 'T20 International', tag: 't20i' },
  { path: '/api/flashscore/cricket/world:8/test-series:AkPEBy3K',                name: 'Test Series',       tag: 'test' },
  { path: '/api/flashscore/cricket/south-africa:175/sa20:YVsYtcmb',              name: 'SA20',              tag: 'sa20' },
  { path: '/api/flashscore/cricket/india:93/ipl:KfDQ6H86',                       name: 'IPL',               tag: 'ipl' },
  { path: '/api/flashscore/cricket/south-africa:175/csa-t20-challenge:AVrQexSr', name: 'CSA T20 Challenge', tag: 'csa-t20' },
];

export const RUGBY_COMPETITIONS = [
  { path: '/api/flashscore/rugby-union/world:8/united-rugby-championship:jBHqXTNh', name: 'United Rugby Championship', tag: 'urc' },
  { path: '/api/flashscore/rugby-union/south-africa:175/currie-cup:pjUEaE29',       name: 'Currie Cup',                tag: 'currie-cup' },
  { path: '/api/flashscore/rugby-union/world:8/rugby-championship:xxwSbYzH',        name: 'Rugby Championship',        tag: 'rugby-championship' },
  { path: '/api/flashscore/rugby-union/world:8/super-rugby:Stv0V7h5',               name: 'Super Rugby',               tag: 'super-rugby' },
];

export const TENNIS_COMPETITIONS = [
  // Grand Slams — ATP
  { path: '/api/flashscore/tennis/atp-singles:5724/australian-open:MP4jLdJh', name: 'Australian Open',   tag: 'australian-open' },
  { path: '/api/flashscore/tennis/atp-singles:5724/french-open:tItR6sEf',    name: 'French Open',       tag: 'french-open' },
  { path: '/api/flashscore/tennis/atp-singles:5724/wimbledon:nZi4fKds',      name: 'Wimbledon',         tag: 'wimbledon' },
  { path: '/api/flashscore/tennis/atp-singles:5724/us-open:65k5lHxU',        name: 'US Open',           tag: 'us-open' },
  // ATP Masters 1000
  { path: '/api/flashscore/tennis/atp-singles:5724/indian-wells:EuEPYusS',   name: 'Indian Wells',      tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/miami:lYvC7qBE',          name: 'Miami Open',        tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/monte-carlo:IsxHSx6l',    name: 'Monte Carlo',       tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/madrid:632P4ana',         name: 'Madrid Open',       tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/rome:xIkUr2vO',           name: 'Rome',              tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/cincinnati:vo6KqUyn',     name: 'Cincinnati',        tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/paris:pOtlc1qr',          name: 'Paris Masters',     tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/finals-turin:MeRVE9s8',   name: 'ATP Finals',        tag: 'atp' },
  // ATP 500
  { path: '/api/flashscore/tennis/atp-singles:5724/rotterdam:r5DdTIZC',      name: 'Rotterdam',         tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/dubai:xKbLXKij',          name: 'Dubai',             tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/rio-de-janeiro:bZLCRom0', name: 'Rio de Janeiro',    tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/barcelona:rZvXbpeD',      name: 'Barcelona',         tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/munich:6ccef0Jo',         name: 'Munich',            tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/halle:0pOdQOCg',          name: 'Halle',             tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/london:SUpSZy5K',         name: "Queen's Club",      tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/hamburg:I5j9PrSa',        name: 'Hamburg',           tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/washington:rgTHIK74',     name: 'Washington',        tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/beijing:UirAofN6',        name: 'Beijing',           tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/tokyo:lAzP4qg4',          name: 'Tokyo',             tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/vienna:GvgalJQT',         name: 'Vienna',            tag: 'atp' },
  { path: '/api/flashscore/tennis/atp-singles:5724/basel:t8icmqob',          name: 'Basel',             tag: 'atp' },
  // Grand Slams — WTA
  { path: '/api/flashscore/tennis/wta-singles:5725/australian-open:0G3fKGYb', name: 'Australian Open (W)', tag: 'australian-open' },
  { path: '/api/flashscore/tennis/wta-singles:5725/wimbledon:hl1W8RZs',       name: 'Wimbledon (W)',       tag: 'wimbledon' },
  { path: '/api/flashscore/tennis/wta-singles:5725/us-open:6g0xhggi',         name: 'US Open (W)',         tag: 'us-open' },
];

export const FOOTBALL_COMPETITIONS = [
  // SA domestic — confirmed live 6 April 2026
  { path: '/api/flashscore/football/south-africa:175/betway-premiership:WYFXQ1KH', name: 'PSL',                 tag: 'psl' },
  { path: '/api/flashscore/football/south-africa:175/nedbank-cup:WMffLgMb',        name: 'Nedbank Cup',         tag: 'psl' },
  { path: '/api/flashscore/football/south-africa:175/carling-knockout:t6G9wMZN',   name: 'Carling Knockout',    tag: 'psl' },
  { path: '/api/flashscore/football/south-africa:175/mtn-8-cup:hrHTRs5B',          name: 'MTN 8',               tag: 'psl' },
  // African — confirmed live 10 April 2026
  { path: '/api/flashscore/football/africa:1/caf-champions-league:EcZwBi3N',       name: 'CAF Champions League', tag: 'caf' },
  { path: '/api/flashscore/football/africa:1/africa-cup-of-nations:8bP2bXmH',      name: 'AFCON',               tag: 'afcon' },
  { path: '/api/flashscore/football/africa:1/cosafa-cup:tAF6Rzpl',                 name: 'COSAFA Cup',          tag: 'bafana' },
  // European — confirmed live 10 April 2026
  { path: '/api/flashscore/football/england:198/premier-league:dYlOSQOD',          name: 'Premier League',      tag: 'epl' },
  { path: '/api/flashscore/football/europe:6/champions-league:xGrwqq16',           name: 'Champions League',    tag: 'ucl' },
  { path: '/api/flashscore/football/europe:6/europa-league:ClDjv3V5',              name: 'Europa League',       tag: 'ucl' },
];

interface FetchResult {
  fixtures: LiveFixture[];
  syncErrors: Array<{ competition: string; message: string }>;
}

async function fetchFixtures(
  competitions: Array<{ path: string; name: string; tag: string }>,
  daysAhead: number,
): Promise<FetchResult> {
  const fixtures: LiveFixture[] = [];
  const syncErrors: Array<{ competition: string; message: string }> = [];
  const now = new Date();
  const cutoff = new Date(Date.now() + daysAhead * 86_400_000);

  for (const comp of competitions) {
    try {
      const { data: meta } = await axios.get<{ seasons?: Array<{ season: string; fixtures: string }> }>(
        `${SPORTDB_BASE}${comp.path}`,
        { headers: SPORTDB_HEADERS() },
      );

      const seasons = meta.seasons ?? [];
      for (const season of seasons.slice(0, 3)) {
        const { data: rows } = await axios.get<any[]>(
          `${SPORTDB_BASE}${season.fixtures}`,
          { headers: SPORTDB_HEADERS() },
        );

        const upcoming = (rows ?? [])
          .filter(f => {
            if (!f.startDateTimeUtc) return false;
            const k = new Date(f.startDateTimeUtc);
            return k > now && k <= cutoff;
          })
          .map(f => ({
            homeTeam: f.homeName || 'TBC',
            awayTeam: f.awayName || 'TBC',
            competition: comp.name,
            tag: comp.tag,
            kickoff: f.startDateTimeUtc as string,
          }));

        if (upcoming.length) {
          fixtures.push(...upcoming);
          break;
        }

        const allPast = (rows ?? []).every(
          f => !f.startDateTimeUtc || new Date(f.startDateTimeUtc) <= now,
        );
        if (allPast && rows?.length) break;
      }
    } catch (err: any) {
      const message = err?.response?.status
        ? `HTTP ${err.response.status}`
        : (err?.message ?? 'Unknown error');
      console.error(`[FixtureScheduler] Failed for ${comp.name}: ${message}`);
      syncErrors.push({ competition: comp.name, message });
    }
  }

  return { fixtures, syncErrors };
}

// ---------------------------------------------------------------------------
// Upsert fixtures into the content service for a given siteId
// ---------------------------------------------------------------------------
async function syncFixtures(siteId: string, fixtures: LiveFixture[]): Promise<number> {
  const contentType = await ContentType.findOne({ siteId, slug: 'fixture' });
  if (!contentType) {
    console.warn(`[FixtureScheduler] No "fixture" content type for site ${siteId} — skipping`);
    return 0;
  }

  for (const f of fixtures) {
    const dateTag = new Date(f.kickoff).toISOString().slice(0, 10).replace(/-/g, '');
    const slugBase = slugify(`${f.homeTeam}-vs-${f.awayTeam}-${dateTag}`, { lower: true, strict: true });

    await ContentEntry.findOneAndUpdate(
      { siteId, contentTypeSlug: 'fixture', slug: slugBase },
      {
        $set: {
          siteId,
          contentTypeId: contentType._id,
          contentTypeSlug: 'fixture',
          slug: slugBase,
          published: true,
          data: { homeTeam: f.homeTeam, awayTeam: f.awayTeam, kickoff: f.kickoff, competition: f.competition, tag: f.tag },
        },
      },
      { upsert: true, new: true },
    );
  }

  console.log(`[FixtureScheduler] Synced ${fixtures.length} fixture(s) → ${siteId}`);
  return fixtures.length;
}

// ---------------------------------------------------------------------------
// Per-sport runners — isolated so each gets its own daily API quota.
// Each run is persisted as a CronLog document for debugging.
// ---------------------------------------------------------------------------
async function runSport(
  job: string,
  competitions: Array<{ path: string; name: string; tag: string }>,
  siteId: string,
): Promise<void> {
  const log = await CronLog.create({ job, startedAt: new Date(), status: 'running' });

  try {
    const { fixtures, syncErrors } = await fetchFixtures(competitions, 14);
    const synced = await syncFixtures(siteId, fixtures);
    const status = syncErrors.length === 0 ? 'success' : synced > 0 ? 'partial' : 'failed';
    await CronLog.findByIdAndUpdate(log._id, { finishedAt: new Date(), status, fixturesSynced: synced, syncErrors });
    console.log(`[CronLog] ${job} → ${status} (${synced} synced, ${syncErrors.length} syncErrors)`);
  } catch (err: any) {
    await CronLog.findByIdAndUpdate(log._id, {
      finishedAt: new Date(),
      status: 'failed',
      syncErrors: [{ competition: 'unknown', message: err?.message ?? 'Unexpected error' }],
    });
    console.error(`[CronLog] ${job} → failed:`, err);
  }
}

async function runTennis():  Promise<void> { await runSport('fixture-sync-tennis',   TENNIS_COMPETITIONS,   'satennis'); }
async function runCricket(): Promise<void> { await runSport('fixture-sync-cricket',  CRICKET_COMPETITIONS,  'betwise-cricket'); }
async function runRugby():   Promise<void> { await runSport('fixture-sync-rugby',    RUGBY_COMPETITIONS,    'betwise-rugby'); }
async function runFootball():Promise<void> { await runSport('fixture-sync-football', FOOTBALL_COMPETITIONS, 'betwise-football'); }

// ---------------------------------------------------------------------------
// Cron schedule — each sport on its own day to avoid sharing API quota:
//
//   Tennis  — Mon + Thu 02:00 UTC  (1 day ahead of Tuesday roundup)
//   Cricket — Mon + Thu 02:30 UTC  (1 day ahead of Tuesday roundup)
//   Rugby   — Tue + Fri 03:00 UTC  (fresh for Tuesday roundup at 04:00)
//   Football— Tue + Fri 03:30 UTC  (fresh for Tuesday roundup at 04:00)
// ---------------------------------------------------------------------------
export function startFixtureScheduler(): void {
  // Tennis — Monday + Thursday 02:00 UTC
  cron.schedule('0 2 * * 1', async () => {
    console.log('[FixtureScheduler] Tennis Monday run');
    try { await runTennis(); } catch (err) { console.error('[FixtureScheduler] Tennis failed:', err); }
  });
  cron.schedule('0 2 * * 4', async () => {
    console.log('[FixtureScheduler] Tennis Thursday run');
    try { await runTennis(); } catch (err) { console.error('[FixtureScheduler] Tennis failed:', err); }
  });

  // Cricket — Monday + Thursday 02:30 UTC
  cron.schedule('30 2 * * 1', async () => {
    console.log('[FixtureScheduler] Cricket Monday run');
    try { await runCricket(); } catch (err) { console.error('[FixtureScheduler] Cricket failed:', err); }
  });
  cron.schedule('30 2 * * 4', async () => {
    console.log('[FixtureScheduler] Cricket Thursday run');
    try { await runCricket(); } catch (err) { console.error('[FixtureScheduler] Cricket failed:', err); }
  });

  // Rugby — Tuesday + Friday 03:00 UTC
  cron.schedule('0 3 * * 2', async () => {
    console.log('[FixtureScheduler] Rugby Tuesday run');
    try { await runRugby(); } catch (err) { console.error('[FixtureScheduler] Rugby failed:', err); }
  });
  cron.schedule('0 3 * * 5', async () => {
    console.log('[FixtureScheduler] Rugby Friday run');
    try { await runRugby(); } catch (err) { console.error('[FixtureScheduler] Rugby failed:', err); }
  });

  // Football — Tuesday + Friday 03:30 UTC
  cron.schedule('30 3 * * 2', async () => {
    console.log('[FixtureScheduler] Football Tuesday run');
    try { await runFootball(); } catch (err) { console.error('[FixtureScheduler] Football failed:', err); }
  });
  cron.schedule('30 3 * * 5', async () => {
    console.log('[FixtureScheduler] Football Friday run');
    try { await runFootball(); } catch (err) { console.error('[FixtureScheduler] Football failed:', err); }
  });

  console.log('Fixture scheduler started — Tennis/Cricket Mon+Thu, Rugby/Football Tue+Fri');
}
