import { SportDbFixture as ApiSportsFixture } from './sportdb';

const SA_TEAMS = [
  'Bulls', 'Stormers', 'Lions', 'Sharks', 'Cheetahs',
  'South Africa', 'Springboks'
];

const COMPETITION_SCORES: Record<string, number> = {
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

export function scoreAndSelectFixtures(
  fixtures: ApiSportsFixture[],
  max = 5
): ApiSportsFixture[] {

  const scored = fixtures.map(f => {
    let score = 0;
    const home = f.homeTeam;
    const away = f.awayTeam;

    // SA team involvement
    if (SA_TEAMS.some(t => home.includes(t) || away.includes(t)))
      score += 50;

    // Competition tier
    for (const [comp, pts] of Object.entries(COMPETITION_SCORES)) {
      if (f.competition.includes(comp)) { score += pts; break; }
    }

    // Weekend timing
    const day = new Date(f.kickoff).getDay();
    if (day === 6 || day === 0) score += 20;
    if (day === 5) score += 10;

    // SA derby bonus
    if (SA_DERBIES.some(([a, b]) =>
      (home.includes(a) && away.includes(b)) ||
      (home.includes(b) && away.includes(a))
    )) score += 25;

    return { fixture: f, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(s => s.fixture);
}
