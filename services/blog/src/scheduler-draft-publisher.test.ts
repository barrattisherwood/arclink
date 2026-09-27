const mockPostFind = jest.fn();
const mockPostUpdateMany = jest.fn();
const mockSave = jest.fn();
const mockBlogTenantFindOne = jest.fn();
const mockTriggerDeploy = jest.fn();

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
}));

import { runDraftPublisher } from './scheduler-draft-publisher';

function makePost(overrides: Record<string, any> = {}) {
  return {
    id: 'post-1',
    tenant_id: 'tenant-1',
    slug: 'post-1-slug',
    status: 'draft',
    generated: true,
    article_format: 'dialogue',
    published_at: null,
    featured: false,
    save: mockSave,
    ...overrides,
  };
}

const NOW = new Date('2026-04-30T08:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockPostUpdateMany.mockResolvedValue({});
  mockSave.mockResolvedValue({});
  mockBlogTenantFindOne.mockResolvedValue({ id: 'tenant-1', sport_key: 'football' });
});

describe('runDraftPublisher — no drafts', () => {
  it('does nothing when queue is empty', async () => {
    mockPostFind.mockResolvedValue([]);
    await runDraftPublisher(NOW);
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe('runDraftPublisher — standard dialogue draft', () => {
  it('sets status to published', async () => {
    const post = makePost();
    mockPostFind.mockResolvedValue([post]);
    await runDraftPublisher(NOW);
    expect(post.status).toBe('published');
  });

  it('sets published_at to the provided now timestamp', async () => {
    const post = makePost();
    mockPostFind.mockResolvedValue([post]);
    await runDraftPublisher(NOW);
    expect(post.published_at).toBe(NOW);
  });

  it('does not feature a non-roundup post', async () => {
    const post = makePost({ article_format: 'dialogue' });
    mockPostFind.mockResolvedValue([post]);
    await runDraftPublisher(NOW);
    expect(post.featured).toBe(false);
    expect(mockPostUpdateMany).not.toHaveBeenCalled();
  });

  it('calls save', async () => {
    const post = makePost();
    mockPostFind.mockResolvedValue([post]);
    await runDraftPublisher(NOW);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});

describe('runDraftPublisher — weekly-roundup draft', () => {
  it('unfeaturs existing pinned posts for the tenant', async () => {
    const post = makePost({ article_format: 'weekly-roundup', tenant_id: 'tenant-1' });
    mockPostFind.mockResolvedValue([post]);
    await runDraftPublisher(NOW);
    expect(mockPostUpdateMany).toHaveBeenCalledWith(
      { tenant_id: 'tenant-1', featured: true },
      { $set: { featured: false } },
    );
  });

  it('sets featured to true on the new roundup', async () => {
    const post = makePost({ article_format: 'weekly-roundup' });
    mockPostFind.mockResolvedValue([post]);
    await runDraftPublisher(NOW);
    expect(post.featured).toBe(true);
  });

  it('still publishes the post', async () => {
    const post = makePost({ article_format: 'weekly-roundup' });
    mockPostFind.mockResolvedValue([post]);
    await runDraftPublisher(NOW);
    expect(post.status).toBe('published');
    expect(mockSave).toHaveBeenCalled();
  });
});

describe('runDraftPublisher — mixed batch', () => {
  it('publishes all drafts and only features the roundup', async () => {
    const dialogue = makePost({ id: 'p1', article_format: 'dialogue' });
    const roundup = makePost({ id: 'p2', article_format: 'weekly-roundup', save: mockSave });
    mockPostFind.mockResolvedValue([dialogue, roundup]);
    await runDraftPublisher(NOW);
    expect(dialogue.status).toBe('published');
    expect(roundup.status).toBe('published');
    expect(dialogue.featured).toBe(false);
    expect(roundup.featured).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(2);
  });
});

describe('runDraftPublisher — deploy hook', () => {
  it('triggers a rebuild for a published post using the tenant sport_key', async () => {
    const post = makePost({ tenant_id: 'tenant-1', slug: 'my-post' });
    mockPostFind.mockResolvedValue([post]);
    mockBlogTenantFindOne.mockResolvedValue({ id: 'tenant-1', sport_key: 'football' });
    await runDraftPublisher(NOW);
    expect(mockTriggerDeploy).toHaveBeenCalledWith('football');
  });

  it('looks up the tenant only once per unique tenant_id in a batch', async () => {
    const p1 = makePost({ id: 'p1', tenant_id: 'tenant-1', slug: 'a' });
    const p2 = makePost({ id: 'p2', tenant_id: 'tenant-1', slug: 'b' });
    mockPostFind.mockResolvedValue([p1, p2]);
    await runDraftPublisher(NOW);
    expect(mockBlogTenantFindOne).toHaveBeenCalledTimes(1);
    expect(mockTriggerDeploy).toHaveBeenCalledTimes(2);
  });

  it('skips triggering a rebuild when the tenant has no sport_key', async () => {
    const post = makePost();
    mockPostFind.mockResolvedValue([post]);
    mockBlogTenantFindOne.mockResolvedValue({ id: 'tenant-1', sport_key: '' });
    await runDraftPublisher(NOW);
    expect(mockTriggerDeploy).not.toHaveBeenCalled();
  });

  it('skips triggering a rebuild when the tenant is not found', async () => {
    const post = makePost();
    mockPostFind.mockResolvedValue([post]);
    mockBlogTenantFindOne.mockResolvedValue(null);
    await runDraftPublisher(NOW);
    expect(mockTriggerDeploy).not.toHaveBeenCalled();
  });
});
