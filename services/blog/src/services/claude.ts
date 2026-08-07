import Anthropic from '@anthropic-ai/sdk';
import { IBlogTenant } from '../models/BlogTenant';
import { IFixtureEntry } from '../models/Post';
import { CalendarContentType } from '../models/TitleQueue';

const client = new Anthropic();

export function deriveWordCount(contentType: CalendarContentType | undefined, tenantDefault: number): number {
  switch (contentType) {
    case 'match-preview':
    case 'post-match':
      return 800;
    case 'evergreen':
    case 'season-preview':
    case 'tournament-window':
      return 1500;
    case 'bookmaker-review':
      return 1000;
    default:
      return tenantDefault;
  }
}

function buildStandardUserMessage(tenant: IBlogTenant, title: string, recentTitles: string[], additionalContext: string | null | undefined, wordCount: number): string {
  const tagInstruction = tenant.blog_predefined_tags.length > 0
    ? `Choose 3–5 tags from this list where relevant, but you may add new ones if needed: ${tenant.blog_predefined_tags.join(', ')}.`
    : 'Generate 3–5 relevant tags for this post.';

  const categoryInstruction = tenant.blog_predefined_categories?.length > 0
    ? `Choose 1–2 categories from this list: ${tenant.blog_predefined_categories.join(', ')}.`
    : 'Assign 1–2 broad topic categories for this post.';

  return `You are a professional blog writer and SEO specialist. Write a high-quality blog post for the following brief.

Blog subject: ${tenant.blog_subject}
Target audience: ${tenant.blog_audience}
Tone: ${tenant.blog_tone}
Target word count: approximately ${wordCount} words
Post title: ${title}

${additionalContext ? `Editorial brief:\n${additionalContext}\n` : ''}${recentTitles.length > 0 ? `Recent posts (avoid overlap):\n${recentTitles.map(t => `- ${t}`).join('\n')}` : ''}

Write the full blog post in markdown. Do not include the title as an H1 — start directly with the introduction.

After the post, output a JSON block (fenced with \`\`\`json) with this exact structure:
{
  "seo_title": "SERP-optimised title, max 60 characters",
  "seo_description": "Meta description, max 155 characters",
  "excerpt": "2–3 sentence preview, max 300 chars",
  "categories": ["Category1"],
  "tags": ["tag1", "tag2", "tag3"],
  "unsplash_keyword": "2–3 word Unsplash search term",
  "alt_text": "descriptive alt text for the featured image"
}

${tagInstruction}
${categoryInstruction}`;
}

function buildSinglePersonaUserMessage(tenant: IBlogTenant, title: string, recentTitles: string[], additionalContext: string | null | undefined, wordCount: number): string {
  const tagInstruction = tenant.blog_predefined_tags.length > 0
    ? `Choose 3–5 tags from this list where relevant, but you may add new ones if needed: ${tenant.blog_predefined_tags.join(', ')}.`
    : 'Generate 3–5 relevant tags for this post.';

  const categoryInstruction = tenant.blog_predefined_categories?.length > 0
    ? `Choose 1–2 categories from this list: ${tenant.blog_predefined_categories.join(', ')}.`
    : 'Assign 1–2 broad topic categories for this post.';

  return `Write a high-quality article in your distinctive voice for the following brief.

Site: ${tenant.name}
Audience: ${tenant.blog_audience}
Target word count: approximately ${wordCount} words
Post title: ${title}

${additionalContext ? `Editorial brief:\n${additionalContext}\n` : ''}${recentTitles.length > 0 ? `Recent posts (avoid overlap):\n${recentTitles.map(t => `- ${t}`).join('\n')}` : ''}

Write the full article in markdown. Do not include the title as an H1 — start directly with the introduction. Write entirely in your established voice and analytical style.

After the article, output a JSON block (fenced with \`\`\`json) with this exact structure:
{
  "seo_title": "SERP-optimised title, max 60 characters",
  "seo_description": "Meta description, max 155 characters",
  "excerpt": "2–3 sentence preview, max 300 chars",
  "categories": ["Category1"],
  "tags": ["tag1", "tag2", "tag3"],
  "unsplash_keyword": "2–3 word Unsplash search term",
  "alt_text": "descriptive alt text for the featured image"
}

${tagInstruction}
${categoryInstruction}`;
}

function buildDialogueUserMessage(
  tenant: IBlogTenant,
  title: string,
  personaTag: string,
  recentTitles: string[],
  additionalContext: string | null | undefined,
  blockWords: string,
): string {
  const allPersonas = Array.from(tenant.blog_persona_prompts?.keys() ?? []);
  const otherPersona = allPersonas.find(p => p !== personaTag) ?? null;
  const p1 = personaTag.toUpperCase();
  const p2 = otherPersona?.toUpperCase() ?? null;

  const tagInstruction = tenant.blog_predefined_tags.length > 0
    ? `Choose 3–5 tags from this list where relevant: ${tenant.blog_predefined_tags.join(', ')}.`
    : 'Generate 3–5 relevant tags for this post.';

  return `Write a betting analysis article for the following title:

"${title}"

Site: ${tenant.name}
Audience: ${tenant.blog_audience}

${additionalContext ? `Editorial brief:\n${additionalContext}\n` : ''}${recentTitles.length > 0 ? `Recent articles (avoid overlap):\n${recentTitles.map(t => `- ${t}`).join('\n')}` : ''}

FORMAT — CRITICAL:
This is a dialogue-format article. Two analysts take turns. Use these exact delimiters:

[${p1}]
...${personaTag}'s analysis here...
[/${p1}]
${p2 ? `
[${p2}]
...${otherPersona}'s analysis here...
[/${p2}]
` : ''}
Structure:
1. [${p1}] opens with their primary analytical lens (${blockWords} words)
${p2 ? `2. [${p2}] responds with their angle, references ${personaTag}'s point (${blockWords} words)
3. [${p1}] closes with final bookmaker recommendation (80–100 words)` : '2. [${p1}] closes with bookmaker recommendation (80–100 words)'}

Rules:
- Each block stays fully in that persona's voice (defined in your system prompt)
${p2 ? `- ${otherPersona} may agree or push back — genuine dialogue, not just two monologues` : ''}
- Each block must end with a market observation referencing a specific SA bookmaker — frame it as analytical opinion, not a direct instruction (e.g. "The match winner market at Hollywoodbets looks underpriced here" not "Bet on X at Hollywoodbets")
- Never break the delimiter format — the frontend parser depends on it
- Do not add any text outside the delimiters (no intro paragraph, no conclusion)

After all dialogue blocks, output a JSON block (fenced with \`\`\`json):
{
  "seo_title": "SERP-optimised title, max 60 characters",
  "seo_description": "Meta description, max 155 characters",
  "excerpt": "One sentence summary of the fixture and key angle, max 200 chars",
  "categories": ["Fixture Previews"],
  "tags": ["${personaTag}"${otherPersona ? `, "${otherPersona}"` : ''}, "fixture-preview"],
  "unsplash_keyword": "${tenant.blog_subject.split(' ').slice(0, 3).join(' ')}",
  "alt_text": "${title}"
}

${tagInstruction}`;
}

function buildCombinedPersonaSystem(tenant: IBlogTenant): string {
  const personas = Array.from(tenant.blog_persona_prompts?.entries() ?? []);

  const blocks = personas.map(([tag, prompt], i) =>
    `PERSONA ${i + 1} — ${tag.toUpperCase()} (writes [${tag.toUpperCase()}] blocks):\n${prompt}`
  ).join('\n\n');

  const [p1, p2] = personas.map(([tag]) => tag);

  return `You are writing as ${personas.length === 1 ? 'ONE persona' : 'TWO personas alternating'} within a single article.

${blocks}

Switch fully into each persona when writing their blocks.
The two voices must be genuinely distinct.${p1 && p2 ? ` ${p2} should acknowledge ${p1}'s point before building their own angle. ${p1} may be unmoved by ${p2}'s response.` : ''}`;
}

function buildWeeklyRoundupMessage(
  tenant: IBlogTenant,
  title: string,
  fixtures: IFixtureEntry[],
): string {
  const personas = Array.from(tenant.blog_persona_prompts?.keys() ?? []);
  const [p1, p2] = personas;
  const P1 = p1?.toUpperCase() ?? 'ANALYST1';
  const P2 = p2?.toUpperCase() ?? null;

  const fixtureList = fixtures
    .map((f, i) => `${i + 1}. ${f.matchLabel} (${f.competition})`)
    .join('\n');

  const fixtureBlocks = fixtures
    .map(f => `[FIXTURE: ${f.matchLabel}]
[${P1}]
...${p1}'s analysis for ${f.matchLabel}...
[/${P1}]
${P2 ? `[${P2}]
...${p2}'s response for ${f.matchLabel}...
[/${P2}]` : ''}
[/FIXTURE]`)
    .join('\n\n');

  const personaTags = personas.map(p => `"${p}"`).join(', ');

  return `Write a weekly ${tenant.sport_label || 'sports'} betting dialogue for the following title:

"${title}"

Site: ${tenant.name}
Audience: ${tenant.blog_audience}

This weekend's fixtures to cover:
${fixtureList}

FORMAT — CRITICAL. For each fixture produce one exchange using these exact delimiters:

${fixtureBlocks}

Rules per fixture:
- ${p1 ?? 'Analyst 1'} opens (150–180 words): their primary analytical lens. Authoritative.
${P2 ? `- ${p2} responds (150–180 words): their angle. May agree or push back — genuine dialogue.
- ${p2} must reference ${p1}'s point by name in their response.` : ''}
- Each speaker ends their block with a market observation referencing a specific SA bookmaker — frame it as analytical opinion, not a direct instruction (e.g. "The games handicap at Hollywoodbets looks overpriced to me" not "Bet on X at Hollywoodbets").
- Use different bookmakers across the roundup where possible.
- Valid bookmakers: Hollywoodbets, Betway, 10bet.

After all fixture blocks, output a JSON block (fenced with \`\`\`json):
{
  "seo_title": "Weekly ${tenant.sport_label || 'sports'} betting preview max 60 chars",
  "seo_description": "Meta description max 155 chars",
  "excerpt": "Brief summary of what this roundup covers, max 200 chars",
  "categories": ["Fixture Previews"],
  "tags": [${personaTags}, "fixture-preview", "weekly-roundup"],
  "unsplash_keyword": "${tenant.sport_label ? tenant.sport_label.toLowerCase() + ' match' : 'sports betting'}",
  "alt_text": "${title}"
}`;
}

export interface GeneratedPost {
  content: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  categories: string[];
  tags: string[];
  unsplash_keyword: string;
  alt_text: string;
}

export interface RankedQueue {
  ids: string[];
  reasoning: string;
}

export type Edition2026 = 'none' | 'retrospective' | 'preview';

export interface ExpandPostParams {
  title: string;
  existingContent: string;
  targetWordCount: number;
  tenant: IBlogTenant;
  personaTag?: string | null;
  edition2026?: Edition2026;
}

export async function expandPost({
  title,
  existingContent,
  targetWordCount,
  tenant,
  personaTag,
  edition2026 = 'none',
}: ExpandPostParams): Promise<GeneratedPost> {
  const personaPrompt = personaTag ? tenant.blog_persona_prompts?.get(personaTag) : undefined;

  const edition2026Block = edition2026 === 'retrospective'
    ? `\nEVERGREEN STRUCTURE: Write approximately ${targetWordCount - 300} words of evergreen content that will remain accurate in future years, then add a clearly labelled "## 2026 Edition" H2 section (~300 words) covering what happened in the 2026 tournament: key results, standout performances, notable storylines. The 2026 section is retrospective — the tournament is complete.`
    : edition2026 === 'preview'
    ? `\nEVERGREEN STRUCTURE: Write approximately ${targetWordCount - 300} words of evergreen content that will remain accurate in future years, then add a clearly labelled "## 2026 Edition" H2 section (~300 words) previewing the upcoming 2026 tournament: player form, surface preparation, draw considerations, markets to watch.`
    : '';

  const tagInstruction = tenant.blog_predefined_tags.length > 0
    ? `Choose 3–5 tags from this list where relevant: ${tenant.blog_predefined_tags.join(', ')}.`
    : 'Generate 3–5 relevant tags.';

  const categoryInstruction = tenant.blog_predefined_categories?.length > 0
    ? `Choose 1–2 categories: ${tenant.blog_predefined_categories.join(', ')}.`
    : 'Assign 1–2 broad topic categories.';

  const prompt = `You are expanding an existing tennis betting guide for ${tenant.name}.

Audience: ${tenant.blog_audience}

ARTICLE TITLE: ${title}

EXISTING ARTICLE — use as the basis, preserve factual accuracy, expand substantially:
${existingContent}

TARGET WORD COUNT: approximately ${targetWordCount} words. Every paragraph must answer a real question a South African bettor would have. Do not pad.

REQUIRED STRUCTURE — every article must include:
- At least 4 H2 subheadings (## in markdown)
- A dedicated SA context H2 section: which SA bookmakers (Hollywoodbets, Betway, 10bet) offer this market, Rand staking context, SA timezone notes for live betting, and a contextual link to /bookmakers using informational anchor text such as "licensed SA bookmakers that cover this market"
- A dedicated market breakdown H2 section: explain each relevant market in plain language, how bookmakers price it, what stats or signals inform a bet, and a worked example using fictional odds (e.g. "If Alcaraz is priced at 1.65...")
- A FAQ section (## FAQ or ## Frequently Asked Questions) with 3–4 Q&A items targeting featured snippet opportunities
- At least one cross-link to a related article on the site (surface guides link to each other, tournament guides link to /analysis)${edition2026Block}

HARD RULES:
- Do NOT include responsible gambling copy — this is injected at the template level.
- Never use imperative CTA language: do not write "bet now", "sign up", "claim", "join today", "place a wager on".
- Describe bookmaker features factually. Do not frame them as benefits the reader will experience.
- Any bonus or offer reference must be followed by "Subject to terms and conditions."
- Frame everything as analytical and informational throughout.

Write the full article in markdown. Do not include the title as an H1 — start directly with the introduction or first H2.

After the article, output a JSON block (fenced with \`\`\`json):
{
  "seo_title": "keyword-rich SERP title, max 60 characters, distinct from the article headline",
  "seo_description": "meta description, between 140 and 160 characters",
  "excerpt": "2–3 sentence summary, max 300 characters",
  "categories": ["Category1"],
  "tags": ["tag1", "tag2", "tag3"],
  "unsplash_keyword": "2–3 word Unsplash search term",
  "alt_text": "descriptive alt text for the featured image"
}

${tagInstruction}
${categoryInstruction}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    ...(personaPrompt ? { system: personaPrompt } : {}),
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) throw new Error('expandPost: Claude did not return expected JSON block');

  const meta = JSON.parse(jsonMatch[1]) as {
    seo_title: string;
    seo_description: string;
    excerpt: string;
    categories: string[];
    tags: string[];
    unsplash_keyword: string;
    alt_text: string;
  };

  const content = raw.slice(0, raw.lastIndexOf('```json')).trim();

  return {
    content,
    excerpt: meta.excerpt,
    seo_title: meta.seo_title || title.slice(0, 60),
    seo_description: meta.seo_description || meta.excerpt.slice(0, 155),
    categories: meta.categories || [],
    tags: meta.tags,
    unsplash_keyword: meta.unsplash_keyword,
    alt_text: meta.alt_text,
  };
}

export interface GeneratePostParams {
  tenant: IBlogTenant;
  title: string;
  recentTitles: string[];
  personaTag?: string | null;
  fixtures?: IFixtureEntry[];
  additionalContext?: string | null;
  forceSinglePersona?: boolean;
  contentType?: CalendarContentType;
}

export async function generatePost({
  tenant,
  title,
  recentTitles,
  personaTag,
  fixtures,
  additionalContext,
  forceSinglePersona = false,
  contentType,
}: GeneratePostParams): Promise<GeneratedPost> {
  const isWeeklyRoundup = !!fixtures?.length;
  const personaPrompt = !isWeeklyRoundup && personaTag && tenant.blog_persona_prompts?.get(personaTag);
  // Treat as single-persona if explicitly flagged, or if the tenant only has one persona
  const effectivelySinglePersona = forceSinglePersona || (tenant.blog_persona_prompts?.size === 1);

  const wordCount = deriveWordCount(contentType, tenant.blog_word_count);
  const dialogueBlockWords = (contentType === 'match-preview' || contentType === 'post-match') ? '150–180' : '200–250';

  const prompt = isWeeklyRoundup
    ? buildWeeklyRoundupMessage(tenant, title, fixtures!)
    : effectivelySinglePersona && personaTag
      ? buildSinglePersonaUserMessage(tenant, title, recentTitles, additionalContext, wordCount)
      : personaTag
        ? buildDialogueUserMessage(tenant, title, personaTag, recentTitles, additionalContext, dialogueBlockWords)
        : buildStandardUserMessage(tenant, title, recentTitles, additionalContext, wordCount);

  const systemPrompt = isWeeklyRoundup
    ? buildCombinedPersonaSystem(tenant)
    : personaPrompt || undefined;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: isWeeklyRoundup ? 8000 : 4096,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = message.content[0].type === 'text' ? message.content[0].text : '';

  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) throw new Error('Claude did not return expected JSON block');

  const meta = JSON.parse(jsonMatch[1]) as {
    seo_title: string;
    seo_description: string;
    excerpt: string;
    categories: string[];
    tags: string[];
    unsplash_keyword: string;
    alt_text: string;
  };

  const content = raw.slice(0, raw.lastIndexOf('```json')).trim();

  return {
    content,
    excerpt: meta.excerpt,
    seo_title: meta.seo_title || title.slice(0, 60),
    seo_description: meta.seo_description || meta.excerpt.slice(0, 155),
    categories: meta.categories || [],
    tags: meta.tags,
    unsplash_keyword: meta.unsplash_keyword,
    alt_text: meta.alt_text,
  };
}

export interface TitleSuggestion {
  title: string;
  rationale: string;
}

export async function suggestTitles(
  tenant: IBlogTenant,
  count: number,
  existingTitles: string[],
): Promise<TitleSuggestion[]> {
  const prompt = `You are an SEO content strategist. Suggest ${count} blog post titles for a blog with this profile:

Blog subject: ${tenant.blog_subject}
Target audience: ${tenant.blog_audience}
Tone: ${tenant.blog_tone}

${existingTitles.length > 0 ? `Already published or queued (do not repeat or closely overlap):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n` : ''}

Requirements:
- Each title should target a realistic search query the audience would use
- Mix pillar topics (broad) with cluster topics (specific, long-tail)
- Titles should feel genuinely useful, not clickbait
- Match the tone of the blog

Return a JSON block (fenced with \`\`\`json) with this exact structure:
{
  "suggestions": [
    { "title": "...", "rationale": "one sentence on why this works for the audience and SEO" }
  ]
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) throw new Error('Claude did not return expected JSON block');

  const parsed = JSON.parse(jsonMatch[1]) as { suggestions: TitleSuggestion[] };
  return parsed.suggestions;
}

export async function prioritiseQueue(
  tenant: IBlogTenant,
  titles: Array<{ id: string; title: string; notes: string | null }>,
  publishedTitles: string[],
): Promise<RankedQueue> {
  const prompt = `You are an SEO strategist. Rank the following blog post titles in order of priority for a blog with this profile:

Blog subject: ${tenant.blog_subject}
Target audience: ${tenant.blog_audience}

${publishedTitles.length > 0 ? `Already published posts:\n${publishedTitles.map(t => `- ${t}`).join('\n')}\n` : ''}

Titles to rank (with IDs):
${titles.map(t => `- ID: ${t.id} | Title: ${t.title}${t.notes ? ` | Notes: ${t.notes}` : ''}`).join('\n')}

Rank by:
1. Topical authority building (pillar topics before cluster topics)
2. Search intent match for the target audience
3. Internal linking opportunity with published posts
4. Long-tail specificity (faster ranking wins for newer sites)

Return a JSON block (fenced with \`\`\`json) with this exact structure:
{
  "ids": ["id-highest-priority", "id-second", ...],
  "reasoning": "brief explanation of the ranking logic"
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) throw new Error('Claude did not return expected JSON block');

  return JSON.parse(jsonMatch[1]) as RankedQueue;
}
