import { scoreAndSelectFixtures } from './fixture-selector';
import { SportDbFixture } from './sportdb';

function makeFixture(overrides: Partial<SportDbFixture>): SportDbFixture {
  return {
    id: 'test-id',
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    competition: 'Unknown',
    venue: 'TBC',
    kickoff: '2026-04-26T14:00:00.000Z', // Saturday
    matchLabel: 'Team A vs Team B',
    ...overrides,
  };
}

// ─── Football ─────────────────────────────────────────────────────────────────

describe('scoreAndSelectFixtures — football', () => {
  it('ranks Champions League above PSL above unknown competition', () => {
    const fixtures = [
      makeFixture({ competition: 'Unknown Cup' }),
      makeFixture({ competition: 'PSL' }),
      makeFixture({ competition: 'Champions League' }),
    ];
    const result = scoreAndSelectFixtures(fixtures, 'football');
    expect(result[0].competition).toBe('Champions League');
    expect(result[1].competition).toBe('PSL');
    expect(result[2].competition).toBe('Unknown Cup');
  });

  it('ranks Premier League above Europa League', () => {
    const fixtures = [
      makeFixture({ competition: 'Europa League' }),
      makeFixture({ competition: 'Premier League' }),
    ];
    const result = scoreAndSelectFixtures(fixtures, 'football');
    expect(result[0].competition).toBe('Premier League');
  });

  it('respects the max limit', () => {
    const fixtures = Array.from({ length: 10 }, (_, i) =>
      makeFixture({ id: String(i), competition: 'PSL' })
    );
    const result = scoreAndSelectFixtures(fixtures, 'football', 3);
    expect(result).toHaveLength(3);
  });

  it('defaults to max=5', () => {
    const fixtures = Array.from({ length: 8 }, (_, i) =>
      makeFixture({ id: String(i), competition: 'PSL' })
    );
    expect(scoreAndSelectFixtures(fixtures, 'football')).toHaveLength(5);
  });

  it('returns all fixtures when count is below max', () => {
    const fixtures = [makeFixture({ competition: 'PSL' }), makeFixture({ competition: 'Champions League' })];
    expect(scoreAndSelectFixtures(fixtures, 'football')).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(scoreAndSelectFixtures([], 'football')).toEqual([]);
  });
});

// ─── Rugby ────────────────────────────────────────────────────────────────────

describe('scoreAndSelectFixtures — rugby_union', () => {
  it('boosts fixtures with SA teams', () => {
    const withSA = makeFixture({ competition: 'URC', homeTeam: 'Bulls', awayTeam: 'Bath' });
    const withoutSA = makeFixture({ competition: 'URC', homeTeam: 'Bath', awayTeam: 'Leinster' });
    const result = scoreAndSelectFixtures([withoutSA, withSA], 'rugby_union');
    expect(result[0].homeTeam).toBe('Bulls');
  });

  it('applies extra derby bonus for SA vs SA', () => {
    const derby = makeFixture({ competition: 'URC', homeTeam: 'Bulls', awayTeam: 'Lions' });
    const nonDerby = makeFixture({ competition: 'URC', homeTeam: 'Bulls', awayTeam: 'Bath' });
    const result = scoreAndSelectFixtures([nonDerby, derby], 'rugby_union');
    expect(result[0].awayTeam).toBe('Lions');
  });

  it('boosts weekend kickoffs over weekday', () => {
    // Saturday = day 6, Wednesday = day 3
    const weekend = makeFixture({ competition: 'Currie Cup', kickoff: '2026-04-25T14:00:00.000Z' }); // Saturday
    const weekday = makeFixture({ competition: 'Currie Cup', kickoff: '2026-04-22T14:00:00.000Z' }); // Wednesday
    const result = scoreAndSelectFixtures([weekday, weekend], 'rugby_union');
    expect(result[0].kickoff).toBe('2026-04-25T14:00:00.000Z');
  });
});

// ─── Tennis ───────────────────────────────────────────────────────────────────

describe('scoreAndSelectFixtures — tennis', () => {
  it('ranks Grand Slams above Masters 1000', () => {
    const masters = makeFixture({ competition: 'Madrid Open' });
    const grandSlam = makeFixture({ competition: 'French Open' });
    const result = scoreAndSelectFixtures([masters, grandSlam], 'tennis');
    expect(result[0].competition).toBe('French Open');
  });

  it('ranks Masters 1000 above ATP 500', () => {
    const atp500 = makeFixture({ competition: 'Barcelona' });
    const masters = makeFixture({ competition: 'Monte Carlo' });
    const result = scoreAndSelectFixtures([atp500, masters], 'tennis');
    expect(result[0].competition).toBe('Monte Carlo');
  });
});

// ─── Cricket ─────────────────────────────────────────────────────────────────

describe('scoreAndSelectFixtures — cricket', () => {
  it('ranks Test Series above ODI above T20', () => {
    const t20 = makeFixture({ competition: 'T20 International' });
    const odi = makeFixture({ competition: 'ODI Series' });
    const test = makeFixture({ competition: 'Test Series' });
    const result = scoreAndSelectFixtures([t20, odi, test], 'cricket');
    expect(result[0].competition).toBe('Test Series');
    expect(result[1].competition).toBe('ODI Series');
    expect(result[2].competition).toBe('T20 International');
  });

  it('ranks SA20 above IPL', () => {
    const ipl = makeFixture({ competition: 'IPL' });
    const sa20 = makeFixture({ competition: 'SA20' });
    const result = scoreAndSelectFixtures([ipl, sa20], 'cricket');
    expect(result[0].competition).toBe('SA20');
  });
});

// ─── Fallback ─────────────────────────────────────────────────────────────────

describe('scoreAndSelectFixtures — unknown sport', () => {
  it('falls back to football scores', () => {
    const fixtures = [
      makeFixture({ competition: 'PSL' }),
      makeFixture({ competition: 'Champions League' }),
    ];
    const result = scoreAndSelectFixtures(fixtures, 'unknown_sport');
    expect(result[0].competition).toBe('Champions League');
  });
});
