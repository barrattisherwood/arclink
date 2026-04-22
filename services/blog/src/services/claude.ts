import Anthropic from '@anthropic-ai/sdk';
import { IBlogTenant } from '../models/BlogTenant';
import { IFixtureEntry } from '../models/Post';

const client = new Anthropic();

function buildStandardUserMessage(tenant: IBlogTenant, title: string, recentTitles: string[]): string {
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
Target word count: approximately ${tenant.blog_word_count} words
Post title: ${title}

${recentTitles.length > 0 ? `Recent posts (avoid overlap):\n${recentTitles.map(t => `- ${t}`).join('\n')}` : ''}

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

function buildDialogueUserMessage(
  tenant: IBlogTenant,
  title: string,
  personaTag: string,
  recentTitles: string[],
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

${recentTitles.length > 0 ? `Recent articles (avoid overlap):\n${recentTitles.map(t => `- ${t}`).join('\n')}` : ''}

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
1. [${p1}] opens with their primary analytical lens (200–250 words)
${p2 ? `2. [${p2}] responds with their angle, references ${personaTag}'s point (200–250 words)
3. [${p1}] closes with final bookmaker recommendation (80–100 words)` : '2. [${p1}] closes with bookmaker recommendation (80–100 words)'}

Rules:
- Each block stays fully in that persona's voice (defined in your system prompt)
${p2 ? `- ${otherPersona} may agree or push back — genuine dialogue, not just two monologues` : ''}
- Each block must include a "Bet at [Bookmaker]" CTA referencing a specific SA bookmaker
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
- Each speaker ends their block with one "Bet at [Bookmaker]" CTA — a specific SA bookmaker.
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

export async function generatePost(
  tenant: IBlogTenant,
  title: string,
  recentTitles: string[],
  personaTag?: string | null,
  fixtures?: IFixtureEntry[],
): Promise<GeneratedPost> {
  const isWeeklyRoundup = !!fixtures?.length;
  const personaPrompt = !isWeeklyRoundup && personaTag && tenant.blog_persona_prompts?.get(personaTag);

  const prompt = isWeeklyRoundup
    ? buildWeeklyRoundupMessage(tenant, title, fixtures!)
    : personaTag
      ? buildDialogueUserMessage(tenant, title, personaTag, recentTitles)
      : buildStandardUserMessage(tenant, title, recentTitles);

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
