// Mocks must be declared before any imports that use them
const mockCronLogCreate = jest.fn();
const mockCronLogUpdate = jest.fn();
const mockContentTypeFind = jest.fn();
const mockContentEntryUpdate = jest.fn();
const mockAxiosGet = jest.fn();

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: (...args: any[]) => mockAxiosGet(...args) }));
jest.mock('./models/CronLog', () => ({
  CronLog: {
    create: (...args: any[]) => mockCronLogCreate(...args),
    findByIdAndUpdate: (...args: any[]) => mockCronLogUpdate(...args),
  },
}));
jest.mock('./models/ContentType', () => ({
  ContentType: { findOne: (...args: any[]) => mockContentTypeFind(...args) },
}));
jest.mock('./models/ContentEntry', () => ({
  ContentEntry: { findOneAndUpdate: (...args: any[]) => mockContentEntryUpdate(...args) },
}));

import { runSport, FOOTBALL_COMPETITIONS } from './scheduler-fixtures';

const MINI_COMPETITIONS = FOOTBALL_COMPETITIONS.slice(0, 2); // PSL + Nedbank Cup

const MOCK_LOG_ID = 'log-id-123';

const MOCK_SEASON = { season: '2026', fixtures: '/api/fixtures/1' };

const MOCK_FIXTURE = {
  startDateTimeUtc: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  homeName: 'Sundowns',
  awayName: 'Pirates',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCronLogCreate.mockResolvedValue({ _id: MOCK_LOG_ID });
  mockCronLogUpdate.mockResolvedValue({});
  mockContentTypeFind.mockResolvedValue({ _id: 'type-id' });
  mockContentEntryUpdate.mockResolvedValue({});
});

// ─── Status: success ──────────────────────────────────────────────────────────

describe('runSport — success', () => {
  beforeEach(() => {
    mockAxiosGet
      .mockResolvedValueOnce({ data: { seasons: [MOCK_SEASON] } }) // comp 1 meta
      .mockResolvedValueOnce({ data: [MOCK_FIXTURE] })              // comp 1 fixtures
      .mockResolvedValueOnce({ data: { seasons: [MOCK_SEASON] } }) // comp 2 meta
      .mockResolvedValueOnce({ data: [MOCK_FIXTURE] });             // comp 2 fixtures
  });

  it('creates a CronLog with status running at start', async () => {
    await runSport('fixture-sync-football', MINI_COMPETITIONS, 'betwise-football');
    expect(mockCronLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'fixture-sync-football', status: 'running' })
    );
  });

  it('updates CronLog to success when all competitions succeed', async () => {
    await runSport('fixture-sync-football', MINI_COMPETITIONS, 'betwise-football');
    expect(mockCronLogUpdate).toHaveBeenCalledWith(
      MOCK_LOG_ID,
      expect.objectContaining({ status: 'success', syncErrors: [] })
    );
  });

  it('records the number of fixtures synced', async () => {
    await runSport('fixture-sync-football', MINI_COMPETITIONS, 'betwise-football');
    expect(mockCronLogUpdate).toHaveBeenCalledWith(
      MOCK_LOG_ID,
      expect.objectContaining({ fixturesSynced: 2 })
    );
  });

  it('sets a finishedAt timestamp', async () => {
    await runSport('fixture-sync-football', MINI_COMPETITIONS, 'betwise-football');
    const [, update] = mockCronLogUpdate.mock.calls[0];
    expect(update.finishedAt).toBeInstanceOf(Date);
  });
});

// ─── Status: partial ─────────────────────────────────────────────────────────

describe('runSport — partial (some 402, some succeed)', () => {
  beforeEach(() => {
    const err402 = Object.assign(new Error('Request failed'), { response: { status: 402 } });
    mockAxiosGet
      .mockRejectedValueOnce(err402)                                // comp 1 → 402
      .mockResolvedValueOnce({ data: { seasons: [MOCK_SEASON] } }) // comp 2 meta
      .mockResolvedValueOnce({ data: [MOCK_FIXTURE] });             // comp 2 fixtures
  });

  it('updates CronLog to partial', async () => {
    await runSport('fixture-sync-football', MINI_COMPETITIONS, 'betwise-football');
    expect(mockCronLogUpdate).toHaveBeenCalledWith(
      MOCK_LOG_ID,
      expect.objectContaining({ status: 'partial' })
    );
  });

  it('records the failing competition in syncErrors', async () => {
    await runSport('fixture-sync-football', MINI_COMPETITIONS, 'betwise-football');
    const [, update] = mockCronLogUpdate.mock.calls[0];
    expect(update.syncErrors).toHaveLength(1);
    expect(update.syncErrors[0].message).toBe('HTTP 402');
  });

  it('still records fixtures synced from the successful competition', async () => {
    await runSport('fixture-sync-football', MINI_COMPETITIONS, 'betwise-football');
    expect(mockCronLogUpdate).toHaveBeenCalledWith(
      MOCK_LOG_ID,
      expect.objectContaining({ fixturesSynced: 1 })
    );
  });
});

// ─── Status: failed ───────────────────────────────────────────────────────────

describe('runSport — failed (all 402)', () => {
  beforeEach(() => {
    const err402 = Object.assign(new Error('Request failed'), { response: { status: 402 } });
    mockAxiosGet.mockRejectedValue(err402);
  });

  it('updates CronLog to failed when nothing synced', async () => {
    await runSport('fixture-sync-football', MINI_COMPETITIONS, 'betwise-football');
    expect(mockCronLogUpdate).toHaveBeenCalledWith(
      MOCK_LOG_ID,
      expect.objectContaining({ status: 'failed', fixturesSynced: 0 })
    );
  });

  it('records an error entry for every competition that failed', async () => {
    await runSport('fixture-sync-football', MINI_COMPETITIONS, 'betwise-football');
    const [, update] = mockCronLogUpdate.mock.calls[0];
    expect(update.syncErrors).toHaveLength(MINI_COMPETITIONS.length);
  });
});

// ─── Status: failed (unexpected throw) ───────────────────────────────────────

describe('runSport — failed (unexpected error)', () => {
  it('updates CronLog to failed and includes error message', async () => {
    mockContentTypeFind.mockRejectedValueOnce(new Error('DB connection lost'));
    mockAxiosGet
      .mockResolvedValueOnce({ data: { seasons: [MOCK_SEASON] } })
      .mockResolvedValueOnce({ data: [MOCK_FIXTURE] });

    await runSport('fixture-sync-football', MINI_COMPETITIONS, 'betwise-football');

    expect(mockCronLogUpdate).toHaveBeenCalledWith(
      MOCK_LOG_ID,
      expect.objectContaining({
        status: 'failed',
        syncErrors: expect.arrayContaining([
          expect.objectContaining({ message: 'DB connection lost' }),
        ]),
      })
    );
  });
});
