import slugify from 'slugify';

// Mock heavy dependencies so importing the scheduler doesn't try to connect
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('./models/ContentType', () => ({}));
jest.mock('./models/ContentEntry', () => ({}));

import {
  FOOTBALL_COMPETITIONS,
  RUGBY_COMPETITIONS,
  CRICKET_COMPETITIONS,
  TENNIS_COMPETITIONS,
} from './scheduler-fixtures';

// ─── Slug generation ──────────────────────────────────────────────────────────
// Mirrors the slug logic in syncFixtures — if this changes, existing DB records
// would get duplicates on the next sync run.

describe('fixture slug generation', () => {
  function makeSlug(homeTeam: string, awayTeam: string, kickoff: string): string {
    const dateTag = new Date(kickoff).toISOString().slice(0, 10).replace(/-/g, '');
    return slugify(`${homeTeam}-vs-${awayTeam}-${dateTag}`, { lower: true, strict: true });
  }

  it('produces a stable slug from team names and kickoff date', () => {
    expect(makeSlug('Bulls', 'Lions', '2026-04-25T14:00:00.000Z')).toBe('bulls-vs-lions-20260425');
  });

  it('normalises special characters to url-safe output', () => {
    const slug = makeSlug("Queen's Park", 'FC Bayern München', '2026-05-01T19:00:00.000Z');
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('uses only the date portion of kickoff, not the time', () => {
    const morning = makeSlug('Arsenal', 'Chelsea', '2026-05-10T10:00:00.000Z');
    const evening = makeSlug('Arsenal', 'Chelsea', '2026-05-10T20:00:00.000Z');
    expect(morning).toBe(evening);
  });

  it('produces different slugs for same teams on different dates', () => {
    const first = makeSlug('Bulls', 'Lions', '2026-04-25T14:00:00.000Z');
    const second = makeSlug('Bulls', 'Lions', '2026-05-10T14:00:00.000Z');
    expect(first).not.toBe(second);
  });
});

// ─── Date window filtering ────────────────────────────────────────────────────
// Mirrors the filter applied in fetchFixtures.

describe('fixture date window filtering', () => {
  function isInWindow(kickoffIso: string, daysAhead: number): boolean {
    const now = new Date();
    const cutoff = new Date(Date.now() + daysAhead * 86_400_000);
    const kickoff = new Date(kickoffIso);
    return kickoff > now && kickoff <= cutoff;
  }

  it('includes a fixture kicking off tomorrow', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(isInWindow(tomorrow, 14)).toBe(true);
  });

  it('excludes a fixture that already kicked off', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    expect(isInWindow(yesterday, 14)).toBe(false);
  });

  it('excludes a fixture beyond the lookahead window', () => {
    const tooFar = new Date(Date.now() + 15 * 86_400_000).toISOString();
    expect(isInWindow(tooFar, 14)).toBe(false);
  });

  it('includes a fixture exactly at the cutoff boundary', () => {
    const boundary = new Date(Date.now() + 14 * 86_400_000).toISOString();
    expect(isInWindow(boundary, 14)).toBe(true);
  });

  it('excludes a fixture kicking off right now (not strictly future)', () => {
    const now = new Date().toISOString();
    expect(isInWindow(now, 14)).toBe(false);
  });
});

// ─── Competition tag assignments ──────────────────────────────────────────────
// Guards against accidental tag renames — the frontend filters by these slugs
// (e.g. ?tag=ucl, ?tag=psl) so changing a tag here breaks the FE filter.

describe('competition tag assignments', () => {
  const ALL = [
    ...FOOTBALL_COMPETITIONS,
    ...RUGBY_COMPETITIONS,
    ...CRICKET_COMPETITIONS,
    ...TENNIS_COMPETITIONS,
  ];

  function tagFor(name: string) {
    return ALL.find(c => c.name === name)?.tag;
  }

  const cases: Array<[string, string]> = [
    ['PSL',              'psl'],
    ['Premier League',   'epl'],
    ['Champions League', 'ucl'],
    ['United Rugby Championship', 'urc'],
    ['Currie Cup',       'currie-cup'],
    ['French Open',      'french-open'],
    ['Australian Open',  'australian-open'],
    ['Wimbledon',        'wimbledon'],
    ['US Open',          'us-open'],
    ['ODI Series',       'odi'],
    ['T20 International','t20i'],
    ['SA20',             'sa20'],
    ['IPL',              'ipl'],
  ];

  it.each(cases)('%s → tag "%s"', (competition, expectedTag) => {
    expect(tagFor(competition)).toBe(expectedTag);
  });

  it('every competition has a non-empty tag', () => {
    for (const comp of ALL) {
      expect(comp.tag).toBeTruthy();
    }
  });
});
