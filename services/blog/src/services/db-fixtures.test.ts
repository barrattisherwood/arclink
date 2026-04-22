const mockFind = jest.fn();

jest.mock('../models/ContentEntry', () => ({
  ContentEntry: {
    find: (...args: any[]) => mockFind(...args),
  },
}));

import { fetchUpcomingFixturesFromDb } from './db-fixtures';

function makeSortMock(entries: any[]) {
  return { sort: jest.fn().mockResolvedValue(entries) };
}

function makeEntry(data: Record<string, any>, slug = 'bulls-vs-lions-20260425') {
  return { slug, data };
}

beforeEach(() => mockFind.mockReset());

describe('fetchUpcomingFixturesFromDb', () => {
  it('queries by siteId, fixture contentTypeSlug, and date window', async () => {
    mockFind.mockReturnValue(makeSortMock([]));

    await fetchUpcomingFixturesFromDb('betwise-rugby', 7);

    const [query] = mockFind.mock.calls[0];
    expect(query.siteId).toBe('betwise-rugby');
    expect(query.contentTypeSlug).toBe('fixture');
    expect(query['data.kickoff'].$gt).toBeDefined();
    expect(query['data.kickoff'].$lte).toBeDefined();
  });

  it('cutoff is approximately daysAhead days from now', async () => {
    mockFind.mockReturnValue(makeSortMock([]));

    const before = Date.now();
    await fetchUpcomingFixturesFromDb('betwise-rugby', 7);
    const after = Date.now();

    const [query] = mockFind.mock.calls[0];
    const cutoff = new Date(query['data.kickoff'].$lte).getTime();
    const expectedMin = before + 7 * 86400000;
    const expectedMax = after + 7 * 86400000;

    expect(cutoff).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoff).toBeLessThanOrEqual(expectedMax);
  });

  it('maps ContentEntry data fields to SportDbFixture shape', async () => {
    const entry = makeEntry({
      homeTeam: 'Bulls',
      awayTeam: 'Lions',
      competition: 'URC',
      tag: 'urc',
      kickoff: '2026-04-25T14:00:00.000Z',
    });
    mockFind.mockReturnValue(makeSortMock([entry]));

    const [fixture] = await fetchUpcomingFixturesFromDb('betwise-rugby', 7);

    expect(fixture.homeTeam).toBe('Bulls');
    expect(fixture.awayTeam).toBe('Lions');
    expect(fixture.competition).toBe('URC');
    expect(fixture.competitionTag).toBe('urc');
    expect(fixture.kickoff).toBe('2026-04-25T14:00:00.000Z');
    expect(fixture.id).toBe('bulls-vs-lions-20260425');
  });

  it('builds a matchLabel with home vs away and SAST time', async () => {
    const entry = makeEntry({
      homeTeam: 'Bulls',
      awayTeam: 'Lions',
      competition: 'URC',
      tag: 'urc',
      kickoff: '2026-04-25T14:00:00.000Z', // 16:00 SAST
    });
    mockFind.mockReturnValue(makeSortMock([entry]));

    const [fixture] = await fetchUpcomingFixturesFromDb('betwise-rugby', 7);

    expect(fixture.matchLabel).toContain('Bulls vs Lions');
    expect(fixture.matchLabel).toContain('16:00'); // SAST offset
  });

  it('returns empty array when no entries found', async () => {
    mockFind.mockReturnValue(makeSortMock([]));
    const result = await fetchUpcomingFixturesFromDb('betwise-rugby', 7);
    expect(result).toEqual([]);
  });

  it('sorts by kickoff ascending', async () => {
    mockFind.mockReturnValue({
      sort: jest.fn().mockImplementation((sortArg) => {
        expect(sortArg).toEqual({ 'data.kickoff': 1 });
        return Promise.resolve([]);
      }),
    });
    await fetchUpcomingFixturesFromDb('betwise-rugby', 7);
  });
});
