const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { generatePost } from './claude';
import { IBlogTenant } from '../models/BlogTenant';

function makeTenant(overrides: Partial<IBlogTenant> = {}): IBlogTenant {
  return {
    id: 'tenant-1',
    name: 'SA Football Bets',
    blog_subject: 'SA football betting',
    blog_audience: 'SA football bettors',
    blog_tone: 'analytical',
    blog_word_count: 500,
    blog_predefined_tags: ['world-cup-2026', 'psl'],
    blog_predefined_categories: ['Fixture Previews'],
    blog_images_enabled: false,
    blog_persona_prompts: new Map([
      ['lucky', 'You are Lucky Dlamini, SA football correspondent.'],
      ['callum', 'You are Callum Reid, football tactics correspondent.'],
    ]),
    ...overrides,
  } as IBlogTenant;
}

function makeApiResponse(content: string) {
  return {
    content: [{
      type: 'text',
      text: `${content}\n\`\`\`json\n{"seo_title":"Test","seo_description":"Test desc","excerpt":"Test excerpt","categories":["Football"],"tags":["world-cup-2026"],"unsplash_keyword":"football match","alt_text":"test"}\n\`\`\``,
    }],
  };
}

beforeEach(() => jest.clearAllMocks());

describe('generatePost — standard (no persona)', () => {
  it('uses the standard prompt (no dialogue delimiters)', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Standard article content.'));
    await generatePost(makeTenant(), 'Test Title', []);
    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain('Test Title');
    expect(call.messages[0].content).not.toContain('[LUCKY]');
  });

  it('injects additionalContext into the prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Standard article content.'));
    await generatePost(makeTenant(), 'Test Title', [], null, undefined, 'Focus on Brazil and Argentina.');
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Focus on Brazil and Argentina.');
  });

  it('omits the editorial brief section when no additionalContext', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Standard article content.'));
    await generatePost(makeTenant(), 'Test Title', []);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('Editorial brief');
  });
});

describe('generatePost — dialogue (persona, two voices)', () => {
  it('uses dialogue delimiters in the prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('[LUCKY]\nLucky content.\n[/LUCKY]\n[CALLUM]\nCallum content.\n[/CALLUM]'));
    await generatePost(makeTenant(), 'Match Preview', [], 'lucky');
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('[LUCKY]');
    expect(prompt).toContain('[CALLUM]');
  });

  it('uses the persona system prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('[LUCKY]\nContent.\n[/LUCKY]\n[CALLUM]\nContent.\n[/CALLUM]'));
    await generatePost(makeTenant(), 'Match Preview', [], 'lucky');
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('Lucky Dlamini');
  });

  it('injects additionalContext into the dialogue prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('[LUCKY]\nContent.\n[/LUCKY]\n[CALLUM]\nContent.\n[/CALLUM]'));
    await generatePost(makeTenant(), 'Match Preview', [], 'lucky', undefined, 'Cover the World Cup angle.');
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Cover the World Cup angle.');
  });
});

describe('generatePost — single persona (one voice, standard article)', () => {
  it('does NOT use dialogue delimiters in the prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Single voice article content.'));
    await generatePost(makeTenant(), 'Brazil Preview', [], 'callum', undefined, null, true);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('[CALLUM]');
    expect(prompt).not.toContain('[/CALLUM]');
  });

  it('uses the persona system prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Single voice article content.'));
    await generatePost(makeTenant(), 'Brazil Preview', [], 'callum', undefined, null, true);
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('Callum Reid');
  });

  it('injects additionalContext into the single-persona prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Single voice article content.'));
    await generatePost(makeTenant(), 'Brazil Preview', [], 'callum', undefined, 'Focus on Vinicius Jr and the Golden Boot.', true);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Focus on Vinicius Jr');
  });

  it('returns a GeneratedPost with correct shape', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Single voice article.'));
    const result = await generatePost(makeTenant(), 'Brazil Preview', [], 'callum', undefined, null, true);
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('seo_title');
    expect(result).toHaveProperty('tags');
    expect(Array.isArray(result.tags)).toBe(true);
  });
});

describe('generatePost — recentTitles', () => {
  it('includes recent titles in the standard prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Content.'));
    await generatePost(makeTenant(), 'New Article', ['Old Article One', 'Old Article Two']);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Old Article One');
    expect(prompt).toContain('Old Article Two');
  });
});
