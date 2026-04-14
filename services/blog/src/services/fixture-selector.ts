import { SportDbFixture } from './sportdb';

// ─── Football ────────────────────────────────────────────────────────────────

const FOOTBALL_COMPETITION_SCORES: Record<string, number> = {
  'Champions League': 50,
  'Premier League': 45,
  'PSL': 40, 'Betway Premiership': 40,
  'Europa League': 35,
  'AFCON': 35, 'Africa Cup of Nations': 35,
  'CAF Champions League': 30,
  'Nedbank Cup': 25, 'Carling Knockout': 25, 'MTN 8': 25,
  'COSAFA Cup': 20,
};

// ─── Rugby ────────────────────────────────────────────────────────────────────

const RUGBY_SA_TEAMS = [
  'Bulls', 'Stormers', 'Lions', 'Sharks', 'Cheetahs',
  'South Africa', 'Springboks',
];

const RUGBY_COMPETITION_SCORES: Record<string, number> = {
  'URC': 40, 'United Rugby Championship': 40,
  'Rugby Championship': 35,
  'Currie Cup': 30,
  'Super Rugby Pacific': 20,
  'Six Nations': 15,
  'Premiership Rugby': 10,
};

const SA_DERBIES = [
  ['Bulls', 'Lions'], ['Bulls', 'Sharks'],
  ['Stormers', 'Sharks'], ['Stormers', 'Lions'],
  ['Lions', 'Sharks'], ['Bulls', 'Stormers'],
];

// ─── Tennis ──────────────────────────────────────────────────────────────────

const TENNIS_COMPETITION_SCORES: Record<string, number> = {
  'Australian Open': 50, 'French Open': 50, 'Wimbledon': 50, 'US Open': 50,
  'Australian Open (W)': 50, 'Wimbledon (W)': 50, 'US Open (W)': 50,
  'Indian Wells': 35, 'Miami Open': 35, 'Monte Carlo': 35,
  'Madrid Open': 35, 'Rome': 35, 'Cincinnati': 35,
  'Paris Masters': 35, 'ATP Finals': 40,
  'Davis Cup': 25,
};

// ─── Cricket ─────────────────────────────────────────────────────────────────

const CRICKET_COMPETITION_SCORES: Record<string, number> = {
  'Test Series': 40,
  'ODI Series': 35,
  'T20 International': 30,
  'SA20': 40,
  'IPL': 35,
  'CSA T20 Challenge': 25,
};

// ─── Selector ────────────────────────────────────────────────────────────────

export function scoreAndSelectFixtures(
  fixtures: SportDbFixture[],
  sport = 'football',
  max = 5,
): SportDbFixture[] {

  const competitionScores =
    sport === 'rugby_union' ? RUGBY_COMPETITION_SCORES :
    sport === 'tennis'      ? TENNIS_COMPETITION_SCORES :
    sport === 'cricket'     ? CRICKET_COMPETITION_SCORES :
    FOOTBALL_COMPETITION_SCORES;

  const scored = fixtures.map(f => {
    let score = 0;
    const home = f.homeTeam;
    const away = f.awayTeam;

    // Competition tier
    for (const [comp, pts] of Object.entries(competitionScores)) {
      if (f.competition.includes(comp)) { score += pts; break; }
    }

    // Rugby-only: SA team involvement + derby bonus + weekend timing
    if (sport === 'rugby_union') {
      if (RUGBY_SA_TEAMS.some(t => home.includes(t) || away.includes(t)))
        score += 50;
      if (SA_DERBIES.some(([a, b]) =>
        (home.includes(a) && away.includes(b)) ||
        (home.includes(b) && away.includes(a))
      )) score += 25;
      const day = new Date(f.kickoff).getDay();
      if (day === 6 || day === 0) score += 20;
      if (day === 5) score += 10;
    }

    return { fixture: f, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(s => s.fixture);
}
