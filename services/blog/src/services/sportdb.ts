import axios from 'axios';

const BASE = 'https://api.sportdb.dev';
const KEY = process.env['SPORTDB_API_KEY']!;
const HEADERS = () => ({ 'X-API-Key': KEY });

// Competition endpoints confirmed live 6 April 2026
const COMPETITIONS: Record<string, Array<{ path: string; name: string }>> = {
  rugby_union: [
    {
      path: '/api/flashscore/rugby-union/world:8/united-rugby-championship:jBHqXTNh',
      name: 'United Rugby Championship',
    },
    {
      path: '/api/flashscore/rugby-union/south-africa:175/currie-cup:pjUEaE29',
      name: 'Currie Cup',
    },
    {
      path: '/api/flashscore/rugby-union/world:8/rugby-championship:xxwSbYzH',
      name: 'Rugby Championship',
    },
    {
      path: '/api/flashscore/rugby-union/world:8/super-rugby:Stv0V7h5',
      name: 'Super Rugby',
    },
  ],
  // Cricket endpoints confirmed live 10 April 2026
  cricket: [
    {
      path: '/api/flashscore/cricket/south-africa:175/sa20:YVsYtcmb',
      name: 'SA20',
    },
    {
      path: '/api/flashscore/cricket/world:8/test-series:AkPEBy3K',
      name: 'Test Series',
    },
    {
      path: '/api/flashscore/cricket/world:8/one-day-international:OG7nzYAD',
      name: 'ODI Series',
    },
    {
      path: '/api/flashscore/cricket/world:8/twenty20-international:2i0B6Zul',
      name: 'T20 International',
    },
    {
      path: '/api/flashscore/cricket/south-africa:175/csa-t20-challenge:AVrQexSr',
      name: 'CSA T20 Challenge',
    },
    {
      path: '/api/flashscore/cricket/india:93/ipl:KfDQ6H86',
      name: 'IPL',
    },
  ],
};

export interface SportDbFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  venue: string;
  kickoff: string;   // ISO string
  matchLabel: string;
}

export async function fetchUpcomingFixtures(
  sport: string,
  daysAhead: number
): Promise<SportDbFixture[]> {
  const competitions = COMPETITIONS[sport] ?? [];
  const fixtures: SportDbFixture[] = [];
  const cutoff = new Date(Date.now() + daysAhead * 86400000);

  for (const comp of competitions) {
    try {
      // Step 1: get competition metadata → seasons
      const { data: meta } = await axios.get<{ seasons?: Array<{ season: string; fixtures: string }> }>(
        `${BASE}${comp.path}`,
        { headers: HEADERS() }
      );

      const seasons = meta.seasons ?? [];
      if (!seasons.length) {
        console.warn(`[SportDB] No seasons for ${comp.name}`);
        continue;
      }

      // Step 2: try up to 3 seasons — the API may list a future season first with no
      // current fixtures, so we scan until we find matches within the window.
      const now = new Date();
      let found = false;
      for (const season of seasons.slice(0, 3)) {
        const { data: rows } = await axios.get<any[]>(
          `${BASE}${season.fixtures}`,
          { headers: HEADERS() }
        );

        const upcoming = (rows ?? [])
          .filter(f => {
            if (!f.startDateTimeUtc) return false;
            const kickoff = new Date(f.startDateTimeUtc);
            return kickoff > now && kickoff <= cutoff;
          })
          .map(f => mapFixture(f, comp.name));

        if (upcoming.length) {
          fixtures.push(...upcoming);
          found = true;
          break;
        }

        // If every fixture in this season is already past, no point checking older ones
        const allPast = (rows ?? []).every(f => !f.startDateTimeUtc || new Date(f.startDateTimeUtc) <= now);
        if (allPast && rows?.length) break;
      }

      if (!found) console.log(`[SportDB] No upcoming fixtures for ${comp.name}`);
    } catch (err) {
      console.error(`[SportDB] Failed for ${comp.name}:`, err);
    }
  }

  return fixtures;
}

function mapFixture(f: any, competitionName: string): SportDbFixture {
  const kickoff = new Date(f.startDateTimeUtc);
  const day = kickoff.toLocaleDateString('en-ZA', {
    weekday: 'short', timeZone: 'Africa/Johannesburg'
  });
  const time = kickoff.toLocaleTimeString('en-ZA', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'
  });

  const home = f.homeName || 'TBC';
  const away = f.awayName || 'TBC';

  return {
    id: f.eventId || '',
    homeTeam: home,
    awayTeam: away,
    competition: competitionName,
    venue: 'TBC',
    kickoff: f.startDateTimeUtc,
    matchLabel: `${home} vs ${away} · ${day} ${time}`,
  };
}
