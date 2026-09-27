const mockPostFind = jest.fn();
const mockPostUpdateMany = jest.fn();
const mockBlogTenantFindOne = jest.fn();
const mockTriggerDeploy = jest.fn();
const mockTriggerDeployNow = jest.fn();

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('./models/Post', () => ({
  Post: {
    find: (...a: any[]) => mockPostFind(...a),
    updateMany: (...a: any[]) => mockPostUpdateMany(...a),
  },
}));
jest.mock('./models/BlogTenant', () => ({
  BlogTenant: { findOne: (...a: any[]) => mockBlogTenantFindOne(...a) },
}));
jest.mock('./services/deploy-hook', () => ({
  triggerDeploy: (...a: any[]) => mockTriggerDeploy(...a),
  triggerDeployNow: (...a: any[]) => mockTriggerDeployNow(...a),
  DEPLOY_HOOK_SPORT_KEYS: ['rugby_union', 'football', 'cricket', 'tennis'],
}));

import { runScheduledPublisher, runDailyRebuild } from './scheduler';

function makePost(overrides: Record<string, any> = {}) {
  return {
    id: 'post-1',
    _id: 'post-1',
    tenant_id: 'tenant-1',
    slug: 'post-1-slug',
    status: 'scheduled',
    ...overrides,
  };
}

const NOW = new Date('2026-04-30T08:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockPostUpdateMany.mockResolvedValue({});
  mockBlogTenantFindOne.mockResolvedValue({ id: 'tenant-1', sport_key: 'football' });
});

describe('runScheduledPublisher — no due posts', () => {
  it('does nothing when the queue is empty', async () => {
    mockPostFind.mockResolvedValue([]);
    await runScheduledPublisher(NOW);
    expect(mockPostUpdateMany).not.toHaveBeenCalled();
    expect(mockTriggerDeploy).not.toHaveBeenCalled();
  });
});

describe('runScheduledPublisher — due posts', () => {
  it('publishes matching posts', async () => {
    const post = makePost();
    mockPostFind.mockResolvedValue([post]);
    await runScheduledPublisher(NOW);
    expect(mockPostUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: [post._id] } },
      { $set: { status: 'published', published_at: NOW } },
    );
  });

  it('triggers a rebuild for each published post using the tenant sport_key', async () => {
    const post = makePost({ slug: 'my-post' });
    mockPostFind.mockResolvedValue([post]);
    await runScheduledPublisher(NOW);
    expect(mockTriggerDeploy).toHaveBeenCalledWith('football');
  });

  it('looks up the tenant only once per unique tenant_id in a batch', async () => {
    const p1 = makePost({ id: 'p1', _id: 'p1', tenant_id: 'tenant-1', slug: 'a' });
    const p2 = makePost({ id: 'p2', _id: 'p2', tenant_id: 'tenant-1', slug: 'b' });
    mockPostFind.mockResolvedValue([p1, p2]);
    await runScheduledPublisher(NOW);
    expect(mockBlogTenantFindOne).toHaveBeenCalledTimes(1);
    expect(mockTriggerDeploy).toHaveBeenCalledTimes(2);
  });

  it('skips triggering a rebuild when the tenant has no sport_key', async () => {
    const post = makePost();
    mockPostFind.mockResolvedValue([post]);
    mockBlogTenantFindOne.mockResolvedValue({ id: 'tenant-1', sport_key: '' });
    await runScheduledPublisher(NOW);
    expect(mockTriggerDeploy).not.toHaveBeenCalled();
  });

  it('skips triggering a rebuild when the tenant is not found', async () => {
    const post = makePost();
    mockPostFind.mockResolvedValue([post]);
    mockBlogTenantFindOne.mockResolvedValue(null);
    await runScheduledPublisher(NOW);
    expect(mockTriggerDeploy).not.toHaveBeenCalled();
  });
});

describe('runDailyRebuild', () => {
  it('triggers an immediate rebuild for every sport with a deploy hook', async () => {
    await runDailyRebuild();
    expect(mockTriggerDeployNow).toHaveBeenCalledTimes(4);
    for (const sportKey of ['rugby_union', 'football', 'cricket', 'tennis']) {
      expect(mockTriggerDeployNow).toHaveBeenCalledWith(sportKey);
    }
  });
});
