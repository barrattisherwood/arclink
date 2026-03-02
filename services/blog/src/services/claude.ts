import Anthropic from '@anthropic-ai/sdk';
import { IBlogTenant } from '../models/BlogTenant';

const client = new Anthropic();

export interface GeneratedPost {
  content: string;
  excerpt: string;
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
): Promise<GeneratedPost> {
  const tagInstruction = tenant.blog_predefined_tags.length > 0
    ? `Choose 3–5 tags from this list where relevant, but you may add new ones if needed: ${tenant.blog_predefined_tags.join(', ')}.`
    : 'Generate 3–5 relevant tags for this post.';

  const prompt = `You are a professional blog writer. Write a high-quality blog post for the following brief.

Blog subject: ${tenant.blog_subject}
Target audience: ${tenant.blog_audience}
Tone: ${tenant.blog_tone}
Target word count: approximately ${tenant.blog_word_count} words
Post title: ${title}

${recentTitles.length > 0 ? `Recent posts (avoid overlap, look for internal linking opportunities):\n${recentTitles.map(t => `- ${t}`).join('\n')}` : ''}

Write the full blog post in markdown. Do not include the title as an H1 — start directly with the introduction.

After the post, output a JSON block (fenced with \`\`\`json) with this exact structure:
{
  "excerpt": "A 1–2 sentence meta description optimised for SEO (max 160 chars)",
  "tags": ["tag1", "tag2", "tag3"],
  "unsplash_keyword": "a short 2–3 word search term for a relevant Unsplash photo",
  "alt_text": "descriptive alt text for the featured image"
}

${tagInstruction}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';

  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) throw new Error('Claude did not return expected JSON block');

  const meta = JSON.parse(jsonMatch[1]) as {
    excerpt: string;
    tags: string[];
    unsplash_keyword: string;
    alt_text: string;
  };

  const content = raw.slice(0, raw.lastIndexOf('```json')).trim();

  return {
    content,
    excerpt: meta.excerpt,
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
