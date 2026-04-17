import cron from 'node-cron';
import axios from 'axios';
import slugify from 'slugify';
import { ContentType } from './models/ContentType';
import { ContentEntry } from './models/ContentEntry';

// ---------------------------------------------------------------------------
// SportDB config — mirrors services/blog/src/services/sportdb.ts
// ---------------------------------------------------------------------------
const SPORTDB_BASE = 'https://api.sportdb.dev';
const SPORTDB_HEADERS = () => ({ 'X-API-Key': process.env['SPORTDB_API_KEY']! });

interface LiveFixture {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string; // ISO UTC
}

const CRICKET_COMPETITIONS = [
  { path: '/api/flashscore/cricket/world:8/one-day-international:OG7nzYAD',   name: 'ODI Series' },
  { path: '/api/flashscore/cricket/world:8/twenty20-international:2i0B6Zul',  name: 'T20 International' },
  { path: '/api/flashscore/cricket/world:8/test-series:AkPEBy3K',             name: 'Test Series' },
  { path: '/api/flashscore/cricket/south-africa:175/sa20:YVsYtcmb',           name: 'SA20' },
  { path: '/api/flashscore/cricket/india:93/ipl:KfDQ6H86',                    name: 'IPL' },
  { path: '/api/flashscore/cricket/south-africa:175/csa-t20-challenge:AVrQexSr', name: 'CSA T20 Challenge' },
];

const RUGBY_COMPETITIONS = [
  { path: '/api/flashscore/rugby-union/world:8/united-rugby-championship:jBHqXTNh', name: 'United Rugby Championship' },
  { path: '/api/flashscore/rugby-union/south-africa:175/currie-cup:pjUEaE29',       name: 'Currie Cup' },
  { path: '/api/flashscore/rugby-union/world:8/rugby-championship:xxwSbYzH',        name: 'Rugby Championship' },
  { path: '/api/flashscore/rugby-union/world:8/super-rugby:Stv0V7h5',               name: 'Super Rugby' },
];

const TENNIS_COMPETITIONS = [
  // Grand Slams — ATP
  { path: '/api/flashscore/tennis/atp-singles:5724/australian-open:MP4jLdJh', name: 'Australian Open' },
  { path: '/api/flashscore/tennis/atp-singles:5724/french-open:tItR6sEf',    name: 'French Open' },
  { path: '/api/flashscore/tennis/atp-singles:5724/wimbledon:nZi4fKds',      name: 'Wimbledon' },
  { path: '/api/flashscore/tennis/atp-singles:5724/us-open:65k5lHxU',        name: 'US Open' },
  // ATP Masters 1000
  { path: '/api/flashscore/tennis/atp-singles:5724/indian-wells:EuEPYusS',   name: 'Indian Wells' },
  { path: '/api/flashscore/tennis/atp-singles:5724/miami:lYvC7qBE',          name: 'Miami Open' },
  { path: '/api/flashscore/tennis/atp-singles:5724/monte-carlo:IsxHSx6l',    name: 'Monte Carlo' },
  { path: '/api/flashscore/tennis/atp-singles:5724/madrid:632P4ana',         name: 'Madrid Open' },
  { path: '/api/flashscore/tennis/atp-singles:5724/rome:xIkUr2vO',           name: 'Rome' },
  { path: '/api/flashscore/tennis/atp-singles:5724/cincinnati:vo6KqUyn',     name: 'Cincinnati' },
  { path: '/api/flashscore/tennis/atp-singles:5724/paris:pOtlc1qr',          name: 'Paris Masters' },
  { path: '/api/flashscore/tennis/atp-singles:5724/finals-turin:MeRVE9s8',   name: 'ATP Finals' },
  // ATP 500
  { path: '/api/flashscore/tennis/atp-singles:5724/rotterdam:r5DdTIZC',      name: 'Rotterdam' },
  { path: '/api/flashscore/tennis/atp-singles:5724/dubai:xKbLXKij',          name: 'Dubai' },
  { path: '/api/flashscore/tennis/atp-singles:5724/rio-de-janeiro:bZLCRom0', name: 'Rio de Janeiro' },
  { path: '/api/flashscore/tennis/atp-singles:5724/barcelona:rZvXbpeD',      name: 'Barcelona' },
  { path: '/api/flashscore/tennis/atp-singles:5724/munich:6ccef0Jo',         name: 'Munich' },
  { path: '/api/flashscore/tennis/atp-singles:5724/halle:0pOdQOCg',          name: 'Halle' },
  { path: '/api/flashscore/tennis/atp-singles:5724/london:SUpSZy5K',         name: "Queen's Club" },
  { path: '/api/flashscore/tennis/atp-singles:5724/hamburg:I5j9PrSa',        name: 'Hamburg' },
  { path: '/api/flashscore/tennis/atp-singles:5724/washington:rgTHIK74',     name: 'Washington' },
  { path: '/api/flashscore/tennis/atp-singles:5724/beijing:UirAofN6',        name: 'Beijing' },
  { path: '/api/flashscore/tennis/atp-singles:5724/tokyo:lAzP4qg4',          name: 'Tokyo' },
  { path: '/api/flashscore/tennis/atp-singles:5724/vienna:GvgalJQT',         name: 'Vienna' },
  { path: '/api/flashscore/tennis/atp-singles:5724/basel:t8icmqob',          name: 'Basel' },
  // Grand Slams — WTA
  { path: '/api/flashscore/tennis/wta-singles:5725/australian-open:0G3fKGYb', name: 'Australian Open (W)' },
  { path: '/api/flashscore/tennis/wta-singles:5725/wimbledon:hl1W8RZs',       name: 'Wimbledon (W)' },
  { path: '/api/flashscore/tennis/wta-singles:5725/us-open:6g0xhggi',         name: 'US Open (W)' },
];

const FOOTBALL_COMPETITIONS = [
  // SA domestic — confirmed live 6 April 2026
  { path: '/api/flashscore/football/south-africa:175/betway-premiership:WYFXQ1KH', name: 'PSL' },
  { path: '/api/flashscore/football/south-africa:175/nedbank-cup:WMffLgMb',        name: 'Nedbank Cup' },
  { path: '/api/flashscore/football/south-africa:175/carling-knockout:t6G9wMZN',   name: 'Carling Knockout' },
  { path: '/api/flashscore/football/south-africa:175/mtn-8-cup:hrHTRs5B',          name: 'MTN 8' },
  // African — confirmed live 10 April 2026
  { path: '/api/flashscore/football/africa:1/caf-champions-league:EcZwBi3N',       name: 'CAF Champions League' },
  { path: '/api/flashscore/football/africa:1/africa-cup-of-nations:8bP2bXmH',      name: 'AFCON' },
  { path: '/api/flashscore/football/africa:1/cosafa-cup:tAF6Rzpl',                 name: 'COSAFA Cup' },
  // European — confirmed live 10 April 2026
  { path: '/api/flashscore/football/england:198/premier-league:dYlOSQOD',          name: 'Premier League' },
  { path: '/api/flashscore/football/europe:6/champions-league:xGrwqq16',           name: 'Champions League' },
  { path: '/api/flashscore/football/europe:6/europa-league:ClDjv3V5',              name: 'Europa League' },
];

async function fetchFixtures(
  competitions: Array<{ path: string; name: string }>,
  daysAhead: number,
): Promise<LiveFixture[]> {
  const fixtures: LiveFixture[] = [];
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
    } catch (err) {
      console.error(`[FixtureScheduler] Failed for ${comp.name}:`, err);
    }
  }

  return fixtures;
}

// ---------------------------------------------------------------------------
// Upsert fixtures into the content service for a given siteId
// ---------------------------------------------------------------------------
async function syncFixtures(
  siteId: string,
  fixtures: LiveFixture[],
): Promise<void> {
  const contentType = await ContentType.findOne({ siteId, slug: 'fixture' });
  if (!contentType) {
    console.warn(`[FixtureScheduler] No "fixture" content type for site ${siteId} — skipping`);
    return;
  }

  for (const f of fixtures) {
    const kickoffDate = new Date(f.kickoff);
    const dateTag = kickoffDate.toISOString().slice(0, 10).replace(/-/g, '');
    const slugBase = slugify(`${f.homeTeam}-vs-${f.awayTeam}-${dateTag}`, {
      lower: true,
      strict: true,
    });

    await ContentEntry.findOneAndUpdate(
      { siteId, contentTypeSlug: 'fixture', slug: slugBase },
      {
        $set: {
          siteId,
          contentTypeId: contentType._id,
          contentTypeSlug: 'fixture',
          slug: slugBase,
          published: true,
          data: {
            homeTeam: f.homeTeam,
            awayTeam: f.awayTeam,
            kickoff: f.kickoff,
            competition: f.competition,
          },
        },
      },
      { upsert: true, new: true },
    );
  }

  console.log(`[FixtureScheduler] Synced ${fixtures.length} fixture(s) → ${siteId}`);
}

// ---------------------------------------------------------------------------
// Shared sync runner — exported so it can be triggered via admin endpoint
// ---------------------------------------------------------------------------
async function runAllSports(): Promise<void> {
  try {
    const cricketFixtures = await fetchFixtures(CRICKET_COMPETITIONS, 14);
    await syncFixtures('betwise-cricket', cricketFixtures);
  } catch (err) {
    console.error('[FixtureScheduler] Cricket sync failed:', err);
  }

  try {
    const rugbyFixtures = await fetchFixtures(RUGBY_COMPETITIONS, 14);
    await syncFixtures('betwise-rugby', rugbyFixtures);
  } catch (err) {
    console.error('[FixtureScheduler] Rugby sync failed:', err);
  }

  try {
    const footballFixtures = await fetchFixtures(FOOTBALL_COMPETITIONS, 14);
    await syncFixtures('betwise-football', footballFixtures);
  } catch (err) {
    console.error('[FixtureScheduler] Football sync failed:', err);
  }

  try {
    const tennisFixtures = await fetchFixtures(TENNIS_COMPETITIONS, 14);
    await syncFixtures('satennis', tennisFixtures);
  } catch (err) {
    console.error('[FixtureScheduler] Tennis sync failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Cron — Tuesday 03:30 UTC (before blog roundup at 04:00 UTC)
//        Friday  03:30 UTC (mid-week refresh for weekend fixtures)
// ---------------------------------------------------------------------------
export function startFixtureScheduler(): void {
  cron.schedule('30 3 * * 2', async () => {
    console.log('[FixtureScheduler] Tuesday run started');
    await runAllSports();
    console.log('[FixtureScheduler] Tuesday run complete');
  });

  cron.schedule('30 3 * * 5', async () => {
    console.log('[FixtureScheduler] Friday run started');
    await runAllSports();
    console.log('[FixtureScheduler] Friday run complete');
  });

  console.log('Fixture scheduler started — fires Tuesday + Friday 03:30 UTC');
}
