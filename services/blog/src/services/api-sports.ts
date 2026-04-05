import axios from 'axios';

const BASE = 'https://v1.rugby.api-sports.io';
const KEY = process.env['API_SPORTS_KEY']!;

// Confirm these IDs by calling GET /leagues first
const LEAGUE_IDS: Record<string, number[]> = {
  rugby_union: [
    61,   // URC — VERIFY
    116,  // Currie Cup — VERIFY
    58,   // Rugby Championship — VERIFY
    48,   // Super Rugby Pacific — VERIFY
  ]
};

export interface ApiSportsFixture {
  id: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  venue: string;
  kickoff: string;   // ISO string
  matchLabel: string; // e.g. "Bulls vs Sharks · Loftus · Sat 17:00"
}

export async function fetchUpcomingFixtures(
  sport: string,
  daysAhead: number
): Promise<ApiSportsFixture[]> {

  const leagueIds = LEAGUE_IDS[sport] ?? [];
  const fixtures: ApiSportsFixture[] = [];
  const season = new Date().getFullYear();

  for (const leagueId of leagueIds) {
    try {
      const { data } = await axios.get<{ response?: any[] }>(`${BASE}/games`, {
        headers: { 'x-apisports-key': KEY },
        params: { league: leagueId, season, next: daysAhead }
      });
      fixtures.push(...(data.response ?? []).map(mapFixture));
    } catch (err) {
      console.error(`[API-Sports] League ${leagueId} failed:`, err);
    }
  }

  return fixtures;
}

function mapFixture(g: any): ApiSportsFixture {
  const kickoff = new Date(g.date);
  const day = kickoff.toLocaleDateString('en-ZA', {
    weekday: 'short', timeZone: 'Africa/Johannesburg'
  });
  const time = kickoff.toLocaleTimeString('en-ZA', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'
  });
  return {
    id: g.id,
    homeTeam: g.teams.home.name,
    awayTeam: g.teams.away.name,
    competition: g.league.name,
    venue: g.venue?.name ?? 'TBC',
    kickoff: g.date,
    matchLabel: `${g.teams.home.name} vs ${g.teams.away.name} · ${g.venue?.name ?? 'TBC'} · ${day} ${time}`
  };
}
