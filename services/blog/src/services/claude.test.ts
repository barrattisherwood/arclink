const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { generatePost, deriveWordCount } from './claude';
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

// ─── deriveWordCount ──────────────────────────────────────────────────────────

describe('deriveWordCount', () => {
  const tenantDefault = 1200;

  it('returns 800 for match-preview', () =>
    expect(deriveWordCount('match-preview', tenantDefault)).toBe(800));
  it('returns 800 for post-match', () =>
    expect(deriveWordCount('post-match', tenantDefault)).toBe(800));
  it('returns 1500 for evergreen', () =>
    expect(deriveWordCount('evergreen', tenantDefault)).toBe(1500));
  it('returns 1500 for season-preview', () =>
    expect(deriveWordCount('season-preview', tenantDefault)).toBe(1500));
  it('returns 1500 for tournament-window', () =>
    expect(deriveWordCount('tournament-window', tenantDefault)).toBe(1500));
  it('returns 1000 for bookmaker-review', () =>
    expect(deriveWordCount('bookmaker-review', tenantDefault)).toBe(1000));
  it('falls back to tenant default for article', () =>
    expect(deriveWordCount('article', tenantDefault)).toBe(tenantDefault));
  it('falls back to tenant default for weekly-roundup', () =>
    expect(deriveWordCount('weekly-roundup', tenantDefault)).toBe(tenantDefault));
  it('falls back to tenant default for undefined', () =>
    expect(deriveWordCount(undefined, tenantDefault)).toBe(tenantDefault));
});

// ─── generatePost — standard (no persona) ────────────────────────────────────

describe('generatePost — standard (no persona)', () => {
  it('uses the standard prompt (no dialogue delimiters)', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Standard article content.'));
    await generatePost({ tenant: makeTenant(), title: 'Test Title', recentTitles: [] });
    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain('Test Title');
    expect(call.messages[0].content).not.toContain('[LUCKY]');
  });

  it('injects additionalContext into the prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Standard article content.'));
    await generatePost({ tenant: makeTenant(), title: 'Test Title', recentTitles: [], additionalContext: 'Focus on Brazil and Argentina.' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Focus on Brazil and Argentina.');
  });

  it('omits the editorial brief section when no additionalContext', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Standard article content.'));
    await generatePost({ tenant: makeTenant(), title: 'Test Title', recentTitles: [] });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('Editorial brief');
  });

  it('uses tenant default word count when no contentType', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Content.'));
    await generatePost({ tenant: makeTenant(), title: 'Test', recentTitles: [] });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('500 words');
  });

  it('uses 800-word target for match-preview contentType', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Content.'));
    await generatePost({ tenant: makeTenant(), title: 'Test', recentTitles: [], contentType: 'match-preview' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('800 words');
  });

  it('uses 1500-word target for evergreen contentType', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Content.'));
    await generatePost({ tenant: makeTenant(), title: 'Test', recentTitles: [], contentType: 'evergreen' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('1500 words');
  });
});

// ─── generatePost — dialogue (persona, two voices) ───────────────────────────

describe('generatePost — dialogue (persona, two voices)', () => {
  it('uses dialogue delimiters in the prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('[LUCKY]\nLucky content.\n[/LUCKY]\n[CALLUM]\nCallum content.\n[/CALLUM]'));
    await generatePost({ tenant: makeTenant(), title: 'Match Preview', recentTitles: [], personaTag: 'lucky' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('[LUCKY]');
    expect(prompt).toContain('[CALLUM]');
  });

  it('uses the persona system prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('[LUCKY]\nContent.\n[/LUCKY]\n[CALLUM]\nContent.\n[/CALLUM]'));
    await generatePost({ tenant: makeTenant(), title: 'Match Preview', recentTitles: [], personaTag: 'lucky' });
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('Lucky Dlamini');
  });

  it('injects additionalContext into the dialogue prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('[LUCKY]\nContent.\n[/LUCKY]\n[CALLUM]\nContent.\n[/CALLUM]'));
    await generatePost({ tenant: makeTenant(), title: 'Match Preview', recentTitles: [], personaTag: 'lucky', additionalContext: 'Cover the World Cup angle.' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Cover the World Cup angle.');
  });

  it('uses 150–180 word blocks for match-preview contentType', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('[LUCKY]\nContent.\n[/LUCKY]\n[CALLUM]\nContent.\n[/CALLUM]'));
    await generatePost({ tenant: makeTenant(), title: 'Match Preview', recentTitles: [], personaTag: 'lucky', contentType: 'match-preview' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('150–180');
    expect(prompt).not.toContain('200–250');
  });

  it('uses 150–180 word blocks for post-match contentType', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('[LUCKY]\nContent.\n[/LUCKY]\n[CALLUM]\nContent.\n[/CALLUM]'));
    await generatePost({ tenant: makeTenant(), title: 'Post Match', recentTitles: [], personaTag: 'lucky', contentType: 'post-match' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('150–180');
  });

  it('uses 200–250 word blocks for evergreen contentType', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('[LUCKY]\nContent.\n[/LUCKY]\n[CALLUM]\nContent.\n[/CALLUM]'));
    await generatePost({ tenant: makeTenant(), title: 'Evergreen Guide', recentTitles: [], personaTag: 'lucky', contentType: 'evergreen' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('200–250');
  });

  it('uses 200–250 word blocks when no contentType', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('[LUCKY]\nContent.\n[/LUCKY]\n[CALLUM]\nContent.\n[/CALLUM]'));
    await generatePost({ tenant: makeTenant(), title: 'Article', recentTitles: [], personaTag: 'lucky' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('200–250');
  });
});

// ─── generatePost — single persona ───────────────────────────────────────────

describe('generatePost — single persona (one voice, standard article)', () => {
  it('does NOT use dialogue delimiters in the prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Single voice article content.'));
    await generatePost({ tenant: makeTenant(), title: 'Brazil Preview', recentTitles: [], personaTag: 'callum', forceSinglePersona: true });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('[CALLUM]');
    expect(prompt).not.toContain('[/CALLUM]');
  });

  it('uses the persona system prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Single voice article content.'));
    await generatePost({ tenant: makeTenant(), title: 'Brazil Preview', recentTitles: [], personaTag: 'callum', forceSinglePersona: true });
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('Callum Reid');
  });

  it('injects additionalContext into the single-persona prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Single voice article content.'));
    await generatePost({ tenant: makeTenant(), title: 'Brazil Preview', recentTitles: [], personaTag: 'callum', forceSinglePersona: true, additionalContext: 'Focus on Vinicius Jr and the Golden Boot.' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Focus on Vinicius Jr');
  });

  it('returns a GeneratedPost with correct shape', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Single voice article.'));
    const result = await generatePost({ tenant: makeTenant(), title: 'Brazil Preview', recentTitles: [], personaTag: 'callum', forceSinglePersona: true });
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('seo_title');
    expect(result).toHaveProperty('tags');
    expect(Array.isArray(result.tags)).toBe(true);
  });

  it('uses 800-word target for match-preview contentType', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Content.'));
    await generatePost({ tenant: makeTenant(), title: 'Preview', recentTitles: [], personaTag: 'callum', forceSinglePersona: true, contentType: 'match-preview' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('800 words');
  });
});

// ─── generatePost — recentTitles ─────────────────────────────────────────────

describe('generatePost — recentTitles', () => {
  it('includes recent titles in the standard prompt', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('Content.'));
    await generatePost({ tenant: makeTenant(), title: 'New Article', recentTitles: ['Old Article One', 'Old Article Two'] });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Old Article One');
    expect(prompt).toContain('Old Article Two');
  });
});
