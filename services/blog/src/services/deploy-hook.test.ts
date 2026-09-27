const ORIGINAL_ENV = process.env;

function setHookEnv() {
  process.env = {
    ...ORIGINAL_ENV,
    VERCEL_DEPLOY_HOOK_RUGBY: 'https://api.vercel.com/v1/integrations/deploy/rugby-hook',
    VERCEL_DEPLOY_HOOK_FOOTBALL: 'https://api.vercel.com/v1/integrations/deploy/football-hook',
    VERCEL_DEPLOY_HOOK_CRICKET: 'https://api.vercel.com/v1/integrations/deploy/cricket-hook',
    VERCEL_DEPLOY_HOOK_TENNIS: 'https://api.vercel.com/v1/integrations/deploy/tennis-hook',
  };
}

let mockFetch: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  setHookEnv();
  mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
  global.fetch = mockFetch as any;
});

afterEach(() => {
  jest.useRealTimers();
  process.env = ORIGINAL_ENV;
});

describe('triggerDeploy — debounce', () => {
  it('does not call the hook immediately', () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('football');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls the correct hook URL after the debounce window elapses', async () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('football');
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(mockFetch).toHaveBeenCalledWith('https://api.vercel.com/v1/integrations/deploy/football-hook', { method: 'POST' });
  });

  it('collapses a burst of calls for the same sport into a single request', async () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('rugby_union');
    triggerDeploy('rugby_union');
    triggerDeploy('rugby_union');
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('re-triggering before the window elapses resets the debounce timer', async () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('cricket');
    await jest.advanceTimersByTimeAsync(90 * 1000); // 1:30 — under the 2:00 window
    triggerDeploy('cricket'); // resets the timer
    await jest.advanceTimersByTimeAsync(90 * 1000); // another 1:30 — still under 2:00 from the reset
    expect(mockFetch).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(60 * 1000); // now past 2:00 from the reset
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('debounces each sport independently', async () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('tennis');
    triggerDeploy('cricket');
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith('https://api.vercel.com/v1/integrations/deploy/tennis-hook', { method: 'POST' });
    expect(mockFetch).toHaveBeenCalledWith('https://api.vercel.com/v1/integrations/deploy/cricket-hook', { method: 'POST' });
  });

  it('does not call fetch for a sport with no configured hook', async () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('unknown-sport');
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('triggerDeployNow', () => {
  it('calls the hook immediately, with no debounce wait', async () => {
    const { triggerDeployNow } = require('./deploy-hook');
    await triggerDeployNow('football');
    expect(mockFetch).toHaveBeenCalledWith('https://api.vercel.com/v1/integrations/deploy/football-hook', { method: 'POST' });
  });

  it('does not throw when the hook responds with a non-ok status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    const { triggerDeployNow } = require('./deploy-hook');
    await expect(triggerDeployNow('football')).resolves.toBeUndefined();
  });

  it('does not throw when fetch itself rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const { triggerDeployNow } = require('./deploy-hook');
    await expect(triggerDeployNow('football')).resolves.toBeUndefined();
  });

  it('does nothing for a sport with no configured hook', async () => {
    const { triggerDeployNow } = require('./deploy-hook');
    await triggerDeployNow('unknown-sport');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('DEPLOY_HOOK_SPORT_KEYS', () => {
  it('lists all four sports', () => {
    const { DEPLOY_HOOK_SPORT_KEYS } = require('./deploy-hook');
    expect(DEPLOY_HOOK_SPORT_KEYS.sort()).toEqual(['cricket', 'football', 'rugby_union', 'tennis']);
  });
});
