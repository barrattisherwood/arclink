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
// Cron — every Tuesday 03:30 UTC (30 min before blog roundup at 04:00 UTC)
// ---------------------------------------------------------------------------
export function startFixtureScheduler(): void {
  cron.schedule('30 3 * * 2', async () => {
    console.log('[FixtureScheduler] Tuesday run started');

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

    console.log('[FixtureScheduler] Tuesday run complete');
  });

  console.log('Fixture scheduler started — fires every Tuesday 03:30 UTC');
}
