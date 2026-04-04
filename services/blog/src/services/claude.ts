import Anthropic from '@anthropic-ai/sdk';
import { IBlogTenant } from '../models/BlogTenant';

const client = new Anthropic();

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
  personaTag?: string,
): Promise<GeneratedPost> {
  if (personaTag && tenant.blog_persona_prompts?.has(personaTag)) {
    return generatePersonaPost(tenant, title, personaTag, recentTitles);
  }

  const tagInstruction = tenant.blog_predefined_tags.length > 0
    ? `Choose 3–5 tags from this list where relevant, but you may add new ones if needed: ${tenant.blog_predefined_tags.join(', ')}.`
    : 'Generate 3–5 relevant tags for this post.';

  const categoryInstruction = tenant.blog_predefined_categories?.length > 0
    ? `Choose 1–2 categories from this list: ${tenant.blog_predefined_categories.join(', ')}.`
    : 'Assign 1–2 broad topic categories for this post (e.g. "Strategy", "Technology", "Growth").';

  const prompt = `You are a professional blog writer and SEO specialist. Write a high-quality blog post for the following brief.

Blog subject: ${tenant.blog_subject}
Target audience: ${tenant.blog_audience}
Tone: ${tenant.blog_tone}
Target word count: approximately ${tenant.blog_word_count} words
Post title: ${title}

${recentTitles.length > 0 ? `Recent posts (avoid overlap, look for internal linking opportunities):\n${recentTitles.map(t => `- ${t}`).join('\n')}` : ''}

Write the full blog post in markdown. Do not include the title as an H1 — start directly with the introduction.

After the post, output a JSON block (fenced with \`\`\`json) with this exact structure:
{
  "seo_title": "SERP-optimised title, max 60 characters — concise, includes primary keyword, may differ from the post title",
  "seo_description": "Meta description for search results, max 155 characters — includes primary keyword, has a clear value proposition or call-to-action",
  "excerpt": "A 2–3 sentence preview for blog listing cards (max 300 chars) — engaging summary that makes people want to read more",
  "categories": ["Category1"],
  "tags": ["tag1", "tag2", "tag3"],
  "unsplash_keyword": "a short 2–3 word search term for a relevant Unsplash photo",
  "alt_text": "descriptive alt text for the featured image"
}

SEO title guidelines:
- Must be under 60 characters (Google truncates at ~60)
- Include the primary keyword near the front
- Make it compelling for click-through in search results
- Can differ from the post title if the post title is too long or not SERP-friendly

Meta description guidelines:
- Must be under 155 characters (Google truncates at ~155-160)
- Include the primary keyword naturally
- End with a value proposition or subtle CTA
- Should read as a complete thought, not a truncated sentence

${tagInstruction}
${categoryInstruction}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
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

async function generatePersonaPost(
  tenant: IBlogTenant,
  title: string,
  personaTag: string,
  recentTitles: string[],
): Promise<GeneratedPost> {
  const systemPrompt = tenant.blog_persona_prompts.get(personaTag)!;
  const userMessage = buildPersonaUserMessage(tenant, title, personaTag, recentTitles);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
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

function buildPersonaUserMessage(
  tenant: IBlogTenant,
  title: string,
  personaTag: string,
  recentTitles: string[],
): string {
  const tagInstruction = tenant.blog_predefined_tags.length > 0
    ? `Choose tags from this list where relevant, and always include '${personaTag}': ${tenant.blog_predefined_tags.join(', ')}.`
    : `Generate 3–5 relevant tags and always include '${personaTag}'.`;

  const categoryInstruction = tenant.blog_predefined_categories?.length > 0
    ? `Choose 1–2 categories from this list: ${tenant.blog_predefined_categories.join(', ')}.`
    : 'Assign 1–2 broad topic categories.';

  const recentSection = recentTitles.length > 0
    ? `\nRecent posts (avoid overlap, look for internal linking opportunities):\n${recentTitles.map(t => `- ${t}`).join('\n')}\n`
    : '';

  return `Write a rugby betting analysis piece with the following title:

"${title}"

- Site: ${tenant.name} (${tenant.blog_canonical_base})
- Audience: ${tenant.blog_audience}
- Target word count: approximately ${tenant.blog_word_count} words
${recentSection}
Write the full article in markdown. Do not include the title as an H1 — start directly with the introduction.

After the article, output a JSON block (fenced with \`\`\`json) with this exact structure:
{
  "seo_title": "SERP-optimised title, max 60 characters",
  "seo_description": "Meta description, max 155 characters",
  "excerpt": "2–3 sentence preview for article cards, max 300 characters",
  "categories": ["Category1"],
  "tags": ["${personaTag}", "tag2", "tag3"],
  "unsplash_keyword": "2–3 word search term for a relevant Unsplash photo",
  "alt_text": "descriptive alt text for the featured image"
}

${tagInstruction}
${categoryInstruction}`;
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
