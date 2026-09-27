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

describe('triggerDeploy — debounce, keyed by siteId', () => {
  it('does not call the hook immediately', () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('betwise-football');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls the correct hook URL for the site after the debounce window elapses', async () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('betwise-football');
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(mockFetch).toHaveBeenCalledWith('https://api.vercel.com/v1/integrations/deploy/football-hook', { method: 'POST' });
  });

  it('resolves "satennis" to the tennis hook', async () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('satennis');
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(mockFetch).toHaveBeenCalledWith('https://api.vercel.com/v1/integrations/deploy/tennis-hook', { method: 'POST' });
  });

  it('collapses a burst of calls for the same site into a single request', async () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('betwise-rugby');
    triggerDeploy('betwise-rugby');
    triggerDeploy('betwise-rugby');
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('debounces each site independently', async () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('satennis');
    triggerDeploy('betwise-cricket');
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not call fetch for a site with no configured hook', async () => {
    const { triggerDeploy } = require('./deploy-hook');
    triggerDeploy('unknown-site');
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('triggerDeployNow', () => {
  it('calls the hook immediately, with no debounce wait', async () => {
    const { triggerDeployNow } = require('./deploy-hook');
    await triggerDeployNow('betwise-football');
    expect(mockFetch).toHaveBeenCalledWith('https://api.vercel.com/v1/integrations/deploy/football-hook', { method: 'POST' });
  });

  it('does not throw when the hook responds with a non-ok status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    const { triggerDeployNow } = require('./deploy-hook');
    await expect(triggerDeployNow('betwise-football')).resolves.toBeUndefined();
  });

  it('does not throw when fetch itself rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const { triggerDeployNow } = require('./deploy-hook');
    await expect(triggerDeployNow('betwise-football')).resolves.toBeUndefined();
  });
});

describe('DEPLOY_HOOK_SITE_IDS', () => {
  it('lists all four sites', () => {
    const { DEPLOY_HOOK_SITE_IDS } = require('./deploy-hook');
    expect(DEPLOY_HOOK_SITE_IDS.sort()).toEqual(['betwise-cricket', 'betwise-football', 'betwise-rugby', 'satennis']);
  });
});
