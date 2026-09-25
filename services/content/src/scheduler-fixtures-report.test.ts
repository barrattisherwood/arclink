// Mocks must be declared before any imports that use them
const mockCronSchedule = jest.fn();
const mockCronLogCreate = jest.fn();
const mockCronLogUpdate = jest.fn();
const mockContentTypeFind = jest.fn();
const mockContentEntryUpdate = jest.fn();
const mockAxiosGet = jest.fn();
const mockSendReport = jest.fn();

jest.mock('node-cron', () => ({ schedule: (...args: any[]) => mockCronSchedule(...args) }));
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
jest.mock('./services/report-email', () => ({
  sendFixtureSyncReport: (...args: any[]) => mockSendReport(...args),
}));

import { startFixtureScheduler } from './scheduler-fixtures';

// Bug: only the cricket/football cron jobs used to call sendFixtureSyncReport(),
// so a silent failure in the tennis/rugby-only jobs never reached an inbox.
// These tests guard that all four sports' cron jobs report every run.

const CRON_EXPRESSIONS: Record<string, string[]> = {
  tennis:   ['0 2 * * 1', '0 2 * * 4'],
  cricket:  ['30 2 * * 1', '30 2 * * 4'],
  rugby:    ['0 3 * * 2', '0 3 * * 5'],
  football: ['30 3 * * 2', '30 3 * * 5'],
};

function getCallback(cronExpr: string): () => Promise<void> {
  startFixtureScheduler();
  const call = mockCronSchedule.mock.calls.find(([expr]) => expr === cronExpr);
  if (!call) throw new Error(`No cron.schedule call found for "${cronExpr}"`);
  return call[1];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCronLogCreate.mockResolvedValue({ _id: 'log-id' });
  mockCronLogUpdate.mockResolvedValue({});
  // Short-circuits syncFixtures before it ever touches ContentEntry.
  mockContentTypeFind.mockResolvedValue(null);
  // Fast-fails every competition lookup so each run resolves quickly.
  mockAxiosGet.mockRejectedValue(new Error('network down'));
});

describe('startFixtureScheduler — job registration', () => {
  it('registers two cron jobs for each of the four sports', () => {
    startFixtureScheduler();
    expect(mockCronSchedule).toHaveBeenCalledTimes(8);
  });
});

describe('startFixtureScheduler — fixture sync report is sent after every sport', () => {
  for (const [sport, exprs] of Object.entries(CRON_EXPRESSIONS)) {
    for (const expr of exprs) {
      it(`sends the fixture sync report after the ${sport} run (${expr})`, async () => {
        const callback = getCallback(expr);
        await callback();
        expect(mockSendReport).toHaveBeenCalledTimes(1);
      });
    }
  }
});

describe('startFixtureScheduler — report still sends when the sport run fails outright', () => {
  it('sends the report even if the underlying sync throws', async () => {
    mockCronLogCreate.mockRejectedValueOnce(new Error('DB connection lost'));
    const callback = getCallback('0 2 * * 1'); // tennis Monday
    await callback();
    expect(mockSendReport).toHaveBeenCalledTimes(1);
  });
});
