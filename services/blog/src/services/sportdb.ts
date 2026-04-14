import axios from 'axios';

const BASE = 'https://api.sportdb.dev';
const KEY = process.env['SPORTDB_API_KEY']!;
const HEADERS = () => ({ 'X-API-Key': KEY });

// Competition endpoints confirmed live 10 April 2026
const COMPETITIONS: Record<string, Array<{ path: string; name: string; tag?: string; surface?: string }>> = {
  football: [
    // SA domestic — confirmed live 6 April 2026
    {
      path: '/api/flashscore/football/south-africa:175/betway-premiership:WYFXQ1KH',
      name: 'PSL',
      tag: 'psl',
    },
    {
      path: '/api/flashscore/football/south-africa:175/nedbank-cup:WMffLgMb',
      name: 'Nedbank Cup',
      tag: 'psl',
    },
    {
      path: '/api/flashscore/football/south-africa:175/carling-knockout:t6G9wMZN',
      name: 'Carling Knockout',
      tag: 'psl',
    },
    {
      path: '/api/flashscore/football/south-africa:175/mtn-8-cup:hrHTRs5B',
      name: 'MTN 8',
      tag: 'psl',
    },
    // African — confirmed live 10 April 2026
    {
      path: '/api/flashscore/football/africa:1/caf-champions-league:EcZwBi3N',
      name: 'CAF Champions League',
      tag: 'afcon',
    },
    {
      path: '/api/flashscore/football/africa:1/africa-cup-of-nations:8bP2bXmH',
      name: 'AFCON',
      tag: 'afcon',
    },
    {
      path: '/api/flashscore/football/africa:1/cosafa-cup:tAF6Rzpl',
      name: 'COSAFA Cup',
      tag: 'bafana',
    },
    // European — confirmed live 10 April 2026
    {
      path: '/api/flashscore/football/england:198/premier-league:dYlOSQOD',
      name: 'Premier League',
      tag: 'epl',
    },
    {
      path: '/api/flashscore/football/europe:6/champions-league:xGrwqq16',
      name: 'Champions League',
      tag: 'ucl',
    },
    {
      path: '/api/flashscore/football/europe:6/europa-league:ClDjv3V5',
      name: 'Europa League',
      tag: 'ucl',
    },
  ],
  rugby_union: [
    {
      path: '/api/flashscore/rugby-union/world:8/united-rugby-championship:jBHqXTNh',
      name: 'United Rugby Championship',
      tag: 'urc',
    },
    {
      path: '/api/flashscore/rugby-union/south-africa:175/currie-cup:pjUEaE29',
      name: 'Currie Cup',
      tag: 'currie-cup',
    },
    {
      path: '/api/flashscore/rugby-union/world:8/rugby-championship:xxwSbYzH',
      name: 'Rugby Championship',
      tag: 'rugby-championship',
    },
    {
      path: '/api/flashscore/rugby-union/world:8/super-rugby:Stv0V7h5',
      name: 'Super Rugby',
      tag: 'super-rugby',
    },
  ],
  // Tennis — ATP Singles confirmed live 13 April 2026
  // WTA mirrors use wta-singles:5725 with same slug/id pattern
  tennis: [
    // Grand Slams — ATP
    { path: '/api/flashscore/tennis/atp-singles:5724/australian-open:MP4jLdJh', name: 'Australian Open', tag: 'australian-open', surface: 'hard' },
    { path: '/api/flashscore/tennis/atp-singles:5724/french-open:tItR6sEf',    name: 'French Open',     tag: 'french-open',    surface: 'clay' },
    { path: '/api/flashscore/tennis/atp-singles:5724/wimbledon:nZi4fKds',      name: 'Wimbledon',       tag: 'wimbledon',      surface: 'grass' },
    { path: '/api/flashscore/tennis/atp-singles:5724/us-open:65k5lHxU',        name: 'US Open',         tag: 'us-open',        surface: 'hard' },
    // ATP Masters 1000
    { path: '/api/flashscore/tennis/atp-singles:5724/indian-wells:EuEPYusS',   name: 'Indian Wells',    tag: 'atp',            surface: 'hard' },
    { path: '/api/flashscore/tennis/atp-singles:5724/miami:lYvC7qBE',          name: 'Miami Open',      tag: 'atp',            surface: 'hard' },
    { path: '/api/flashscore/tennis/atp-singles:5724/monte-carlo:IsxHSx6l',    name: 'Monte Carlo',     tag: 'atp',            surface: 'clay' },
    { path: '/api/flashscore/tennis/atp-singles:5724/madrid:632P4ana',         name: 'Madrid Open',     tag: 'atp',            surface: 'clay' },
    { path: '/api/flashscore/tennis/atp-singles:5724/rome:xIkUr2vO',           name: 'Rome',            tag: 'atp',            surface: 'clay' },
    { path: '/api/flashscore/tennis/atp-singles:5724/cincinnati:vo6KqUyn',     name: 'Cincinnati',      tag: 'atp',            surface: 'hard' },
    { path: '/api/flashscore/tennis/atp-singles:5724/paris:pOtlc1qr',          name: 'Paris Masters',   tag: 'atp',            surface: 'indoor-hard' },
    { path: '/api/flashscore/tennis/atp-singles:5724/finals-turin:MeRVE9s8',   name: 'ATP Finals',      tag: 'atp',            surface: 'indoor-hard' },
    // Grand Slams — WTA
    { path: '/api/flashscore/tennis/wta-singles:5725/australian-open:0G3fKGYb', name: 'Australian Open (W)', tag: 'australian-open', surface: 'hard' },
    { path: '/api/flashscore/tennis/wta-singles:5725/wimbledon:hl1W8RZs',       name: 'Wimbledon (W)',       tag: 'wimbledon',       surface: 'grass' },
    { path: '/api/flashscore/tennis/wta-singles:5725/us-open:6g0xhggi',         name: 'US Open (W)',         tag: 'us-open',         surface: 'hard' },
    // TODO: confirm WTA French Open ID (not found in initial scan — may be 'french-open' slug)
    // Davis Cup
    { path: '/api/flashscore/tennis/atp-singles:5724/davis-cup-world-group:fNKFHEIH', name: 'Davis Cup', tag: 'atp', surface: 'hard' },
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
  competitionTag?: string; // tag slug for filtering, e.g. "psl", "epl", "ucl"
  venue: string;
  kickoff: string;    // ISO string
  matchLabel: string;
  round?: string;     // e.g. "Final", "Semi-final", "Round of 16" (tennis/knockout sports)
  surface?: string;   // e.g. "clay", "grass", "hard", "indoor-hard" (tennis)
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchUpcomingFixtures(
  sport: string,
  daysAhead: number
): Promise<SportDbFixture[]> {
  const competitions = COMPETITIONS[sport] ?? [];
  const fixtures: SportDbFixture[] = [];
  const cutoff = new Date(Date.now() + daysAhead * 86400000);

  for (const comp of competitions) {
    try {
      await sleep(300);
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
        await sleep(200);
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
          .map(f => mapFixture(f, comp.name, comp.tag, comp.surface));

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

function mapFixture(f: any, competitionName: string, competitionTag?: string, surface?: string): SportDbFixture {
  const kickoff = new Date(f.startDateTimeUtc);
  const day = kickoff.toLocaleDateString('en-ZA', {
    weekday: 'short', timeZone: 'Africa/Johannesburg'
  });
  const time = kickoff.toLocaleTimeString('en-ZA', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'
  });

  const home = f.homeName || 'TBC';
  const away = f.awayName || 'TBC';

  const roundLabel = f.round ? ` · ${f.round}` : '';
  return {
    id: f.eventId || '',
    homeTeam: home,
    awayTeam: away,
    competition: competitionName,
    competitionTag,
    venue: 'TBC',
    kickoff: f.startDateTimeUtc,
    matchLabel: `${home} vs ${away}${roundLabel} · ${day} ${time}`,
    round: f.round || undefined,
    surface,
  };
}
