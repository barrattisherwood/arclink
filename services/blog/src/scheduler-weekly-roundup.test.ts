const mockFetchFixtures = jest.fn();
const mockScoreAndSelect = jest.fn();
const mockGeneratePost = jest.fn();
const mockPostFindOne = jest.fn();
const mockPostCreate = jest.fn();
const mockCronLogCreate = jest.fn();
const mockCronLogUpdate = jest.fn();
const mockParseRoundup = jest.fn();

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('./services/db-fixtures', () => ({ fetchUpcomingFixturesFromDb: (...a: any[]) => mockFetchFixtures(...a) }));
jest.mock('./services/fixture-selector', () => ({ scoreAndSelectFixtures: (...a: any[]) => mockScoreAndSelect(...a) }));
jest.mock('./services/claude', () => ({ generatePost: (...a: any[]) => mockGeneratePost(...a) }));
jest.mock('./models/Post', () => ({ Post: { findOne: (...a: any[]) => mockPostFindOne(...a), create: (...a: any[]) => mockPostCreate(...a) } }));
jest.mock('./models/CronLog', () => ({ CronLog: { create: (...a: any[]) => mockCronLogCreate(...a), findByIdAndUpdate: (...a: any[]) => mockCronLogUpdate(...a) } }));
jest.mock('./utils/dialogue-parser', () => ({ parseWeeklyRoundup: (...a: any[]) => mockParseRoundup(...a) }));

import { runWeeklyRoundup } from './scheduler-weekly-roundup';
import { IBlogTenant } from './models/BlogTenant';

const LOG_ID = 'log-abc';

function makeTenant(overrides: Partial<IBlogTenant> = {}): IBlogTenant {
  return {
    id: 'tenant-1',
    siteId: 'betwise-football',
    name: 'SA Football Bets',
    sport_key: 'football',
    sport_label: 'Football',
    ...overrides,
  } as IBlogTenant;
}

const MOCK_FIXTURE = {
  id: 'fix-1', homeTeam: 'Sundowns', awayTeam: 'Pirates',
  competition: 'PSL', competitionTag: 'psl',
  venue: 'TBC', kickoff: '2026-04-26T13:00:00.000Z', matchLabel: 'Sundowns vs Pirates',
};

const MOCK_GENERATED = {
  content: 'Great match preview content here.',
  excerpt: 'Preview excerpt',
  seo_title: 'PSL Preview',
  seo_description: 'PSL this week',
  tags: ['psl'],
  categories: ['football'],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCronLogCreate.mockResolvedValue({ _id: LOG_ID });
  mockCronLogUpdate.mockResolvedValue({});
  mockPostFindOne.mockResolvedValue(null); // no slug collision
  mockPostCreate.mockResolvedValue({});
  mockParseRoundup.mockReturnValue({ fixtures: [] });
});

// ─── Skipped (no fixtures) ────────────────────────────────────────────────────

describe('runWeeklyRoundup — skipped', () => {
  beforeEach(() => {
    mockFetchFixtures.mockResolvedValue([]);
  });

  it('creates a running CronLog', async () => {
    await runWeeklyRoundup(makeTenant());
    expect(mockCronLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'running' })
    );
  });

  it('updates CronLog to skipped when no fixtures found', async () => {
    await runWeeklyRoundup(makeTenant());
    expect(mockCronLogUpdate).toHaveBeenCalledWith(
      LOG_ID,
      expect.objectContaining({ status: 'skipped', fixturesFound: 0 })
    );
  });

  it('does not call generatePost', async () => {
    await runWeeklyRoundup(makeTenant());
    expect(mockGeneratePost).not.toHaveBeenCalled();
  });
});

// ─── Success ──────────────────────────────────────────────────────────────────

describe('runWeeklyRoundup — success', () => {
  beforeEach(() => {
    mockFetchFixtures.mockResolvedValue([MOCK_FIXTURE, MOCK_FIXTURE]);
    mockScoreAndSelect.mockReturnValue([MOCK_FIXTURE]);
    mockGeneratePost.mockResolvedValue(MOCK_GENERATED);
  });

  it('updates CronLog to success', async () => {
    await runWeeklyRoundup(makeTenant());
    expect(mockCronLogUpdate).toHaveBeenCalledWith(
      LOG_ID,
      expect.objectContaining({ status: 'success' })
    );
  });

  it('records fixturesFound and fixturesSelected counts', async () => {
    await runWeeklyRoundup(makeTenant());
    expect(mockCronLogUpdate).toHaveBeenCalledWith(
      LOG_ID,
      expect.objectContaining({ fixturesFound: 2, fixturesSelected: 1 })
    );
  });

  it('records the post title in the log', async () => {
    await runWeeklyRoundup(makeTenant());
    const [, update] = mockCronLogUpdate.mock.calls[0];
    expect(update.postTitle).toMatch(/Football Weekly Preview/);
  });

  it('saves the post as a draft', async () => {
    await runWeeklyRoundup(makeTenant());
    expect(mockPostCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' })
    );
  });

  it('passes siteId to the fixture query', async () => {
    await runWeeklyRoundup(makeTenant({ siteId: 'betwise-rugby' }));
    expect(mockFetchFixtures).toHaveBeenCalledWith('betwise-rugby', 7);
  });

  it('includes competition tags merged from fixture list', async () => {
    await runWeeklyRoundup(makeTenant());
    const [post] = mockPostCreate.mock.calls[0];
    expect(post.tags).toContain('psl');
  });
});

// ─── Failed ───────────────────────────────────────────────────────────────────

describe('runWeeklyRoundup — failed', () => {
  beforeEach(() => {
    mockFetchFixtures.mockResolvedValue([MOCK_FIXTURE]);
    mockScoreAndSelect.mockReturnValue([MOCK_FIXTURE]);
    mockGeneratePost.mockRejectedValue(new Error('Claude API timeout'));
  });

  it('updates CronLog to failed', async () => {
    await expect(runWeeklyRoundup(makeTenant())).rejects.toThrow('Claude API timeout');
    expect(mockCronLogUpdate).toHaveBeenCalledWith(
      LOG_ID,
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('records the error message in the log', async () => {
    await expect(runWeeklyRoundup(makeTenant())).rejects.toThrow();
    const [, update] = mockCronLogUpdate.mock.calls[0];
    expect(update.error).toBe('Claude API timeout');
  });

  it('does not save a draft post', async () => {
    await expect(runWeeklyRoundup(makeTenant())).rejects.toThrow();
    expect(mockPostCreate).not.toHaveBeenCalled();
  });
});
