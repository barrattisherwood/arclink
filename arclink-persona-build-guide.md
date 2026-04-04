# arclink — Rugby Persona Blog Build Guide
## Context for the arclink build agent

---

## What This Is

arclink is a headless CMS and microservices platform built by Machinum.
It already has a working blog service that:
- Manages a title queue
- Generates blog posts via Claude API
- Publishes posts with scheduling
- Serves posts via REST API to frontend Angular apps

**This guide adds persona-based content generation** to the blog service,
specifically for a new tenant: `BetWise Rugby` (sarugbybets.co.za).

The rugby site has two editorial personas — Kwagga van der Berg and Marcus Webb.
Every generated post must be written in one of their voices.
The persona is determined at generation time and stored as a tag on the post.
The Angular frontend reads the tag and renders the correct byline component.

---

## Current Architecture (what already exists)

```
arclink/
├── services/
│   └── blog/
│       ├── src/
│       │   ├── models/
│       │   │   ├── BlogTenant.ts       ← tenant config including blog_tone
│       │   │   ├── Post.ts             ← published posts
│       │   │   └── TitleQueue.ts       ← queued titles awaiting generation
│       │   ├── routes/
│       │   │   ├── generate.ts         ← POST /generate/:tenantId
│       │   │   ├── queue.ts            ← queue management
│       │   │   ├── posts.ts            ← CRUD + publish
│       │   │   └── suggest.ts          ← title suggestion
│       │   ├── services/
│       │   │   └── claude.ts           ← Claude API calls
│       │   └── scripts/
│       │       └── seed-tenant.ts      ← existing seed script template
```

### How generation currently works

1. `POST /generate/:tenantId` is called
2. `generatePost()` in `claude.ts` is called
3. It sends a single user message to Claude with `blog_tone` embedded in the prompt
4. Claude returns a post in the tenant's general tone
5. Post is saved with status `draft`

**The problem:** `blog_tone` is passed as part of the user message — there is
no `system` prompt, and there is no per-persona routing. Both Kwagga and Marcus
would need to be crammed into one `blog_tone` string, producing inconsistent
output that sounds like neither.

---

## What Needs To Be Built

### Overview

Three changes to the blog service:

1. **Schema** — add `blog_persona_prompts` field to `BlogTenant` model
2. **Queue** — add optional `persona` field to `TitleQueue` model
3. **Generation** — update `generatePost()` to accept a persona, look up its
   system prompt, and pass it as the `system` parameter to Claude

Plus one new script:

4. **Seed script** — `seed-betwise-rugby.ts` for the rugby tenant

---

## Change 1 — BlogTenant Model

Add `blog_persona_prompts` as a map of `tag → full system prompt string`.

```typescript
// arclink/services/blog/src/models/BlogTenant.ts

// Add to IBlogTenant interface:
blog_persona_prompts: Map<string, string>;
// e.g. { 'kwagga': '...full Kwagga system prompt...', 'marcus': '...full Marcus prompt...' }

// Add to BlogTenantSchema:
blog_persona_prompts: {
  type: Map,
  of: String,
  default: new Map()
},
```

If `blog_persona_prompts` is empty, generation falls back to the existing
`blog_tone` behaviour — backwards compatible, existing tenants unaffected.

---

## Change 2 — TitleQueue Model

Add an optional `persona` field so titles can be pre-assigned a voice.

```typescript
// arclink/services/blog/src/models/TitleQueue.ts

// Add to interface:
persona?: string;  // 'kwagga' | 'marcus' — optional, derived at generation if absent

// Add to schema:
persona: { type: String, default: null },
```

This means when you manually add a title like
"Bulls vs Sharks URC Preview — Set Piece Battle" to the queue,
you can tag it `persona: 'kwagga'` because it's a set-piece heavy preview.
Marcus gets the tactical/market angle pieces.

---

## Change 3 — Generation Logic

Update `claude.ts` and the generate route to handle persona routing.

### claude.ts — updated generatePost function

```typescript
// arclink/services/blog/src/services/claude.ts

export async function generatePost(
  tenant: IBlogTenant,
  title: string,
  personaTag?: string  // NEW optional parameter
): Promise<GeneratedPost> {

  // Determine which system prompt to use
  let systemPrompt: string | undefined;

  if (personaTag && tenant.blog_persona_prompts?.has(personaTag)) {
    // Use the persona-specific system prompt
    systemPrompt = tenant.blog_persona_prompts.get(personaTag);
  }

  // Build the user message
  const userMessage = systemPrompt
    ? buildPersonaUserMessage(tenant, title, personaTag!)
    : buildDefaultUserMessage(tenant, title);

  // Call Claude — with system prompt if persona exists
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    ...(systemPrompt && { system: systemPrompt }),  // only set if persona exists
    messages: [{ role: 'user', content: userMessage }]
  });

  return parseClaudeResponse(response, personaTag);
}


function buildPersonaUserMessage(
  tenant: IBlogTenant,
  title: string,
  personaTag: string
): string {
  return `Write a rugby betting analysis piece with the following title:

"${title}"

Guidelines:
- Word count: approximately ${tenant.blog_word_count} words
- Site: ${tenant.name} (${tenant.blog_canonical_base})
- Audience: ${tenant.blog_audience}
- Tag this post with: ${personaTag}

Include a JSON frontmatter block at the start with:
{
  "seo_title": "...",
  "seo_description": "...",
  "excerpt": "...",
  "categories": [...],
  "tags": ["${personaTag}", ...]
}

Then write the full article body in markdown.`;
}


function buildDefaultUserMessage(tenant: IBlogTenant, title: string): string {
  // Existing logic unchanged — for non-persona tenants
  return `Write a blog post titled "${title}".
Tone: ${tenant.blog_tone}
Word count: ${tenant.blog_word_count}
...`; // keep existing implementation
}
```

### generate.ts route — persona selection

```typescript
// arclink/services/blog/src/routes/generate.ts

router.post('/:tenantId', resolveTenant, async (req, res) => {
  const tenant = req.tenant!;

  // Get next item from queue
  const queueItem = await TitleQueue
    .findOne({ tenant_id: tenant.id })
    .sort({ priority: 1, created_at: 1 });

  if (!queueItem) {
    return res.status(404).json({ error: 'No titles in queue' });
  }

  // Determine persona for this generation
  const persona = resolvePersona(tenant, queueItem);

  // Generate with persona
  const post = await generatePost(tenant, queueItem.title, persona);

  // Save post — persona tag already included in post.tags from Claude response
  const saved = await Post.create({
    tenant_id: tenant.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    excerpt: post.excerpt,
    seo_title: post.seo_title,
    seo_description: post.seo_description,
    tags: post.tags,  // includes persona tag e.g. 'kwagga'
    categories: post.categories,
    status: 'draft',
    generated: true,
    word_count: post.word_count,
    reading_time: post.reading_time,
    created_at: new Date(),
  });

  // Remove from queue
  await queueItem.deleteOne();

  res.json({ post: saved });
});


function resolvePersona(tenant: IBlogTenant, queueItem: IQueueItem): string | undefined {
  // If the queue item has a pre-assigned persona, use it
  if (queueItem.persona && tenant.blog_persona_prompts?.has(queueItem.persona)) {
    return queueItem.persona;
  }

  // If no persona assigned, alternate between available personas
  const personas = Array.from(tenant.blog_persona_prompts?.keys() ?? []);
  if (personas.length === 0) return undefined;

  // Simple alternation — count existing posts to determine next persona
  // Even post count = first persona (kwagga), odd = second (marcus)
  // This keeps a rough 50/50 split without needing state
  return personas[Math.floor(Math.random() * personas.length)];
}
```

---

## Change 4 — Seed Script

Create this file at:
`arclink/services/blog/src/scripts/seed-betwise-rugby.ts`

```typescript
import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { BlogTenant } from '../models/BlogTenant';

// ─── PERSONA SYSTEM PROMPTS ────────────────────────────────────────────────

const KWAGGA_PROMPT = `You are Kwagga van der Berg, SA rugby correspondent for SA Rugby Bets (sarugbybets.co.za). You grew up in Pretoria, a Blue Bulls family. You have watched Currie Cup rugby since before Super Rugby existed. You write about SA provincial rugby — the URC, Currie Cup, Springbok tests — with the authority of someone who actually watches the game rather than the highlights. You are Afrikaans in your cultural frame of reference, though you write in English. You occasionally use an Afrikaans phrase when it fits naturally, never when it feels performed.

VOICE:
Dry, measured, direct. The cadence of someone who thinks before they speak. Not a cheerleader, not a pessimist — an analyst with strong opinions. Your sentences are deliberate. You build a case methodically before delivering a verdict. You never oversell a selection. You present your view as the obvious reading of the evidence.

WHAT YOU LOVE:
A dominant scrum used as a match-winning weapon. Teams that read the conditions and play accordingly. Proper Currie Cup rugby — physical, territorial, honest. Flyhalves who can kick under pressure. The Springboks when they play with structure. Lineouts that work in the wet.

WHAT YOU HATE:
Backline-first rugby that ignores the conditions. Bok selection that defies logic. Overseas coaches who haven't learned what the Currie Cup demands. Short-priced favourites on reputation alone. Pundits who only watch Springboks tests.

ANALYTICAL LENS:
Set piece first, always. Every preview must address the scrum and lineout matchup before anything else — this is where games are won and lost. Second: conditions and territory. Third: Springbok call-up impact on provincial squads — your value edge that European odds compilers miss.

VOCABULARY:
Rugby-specific throughout. Breakdown, gainline, box kick, carry, lineout maul, jackal, tighthead, loosehead, loosie, flyhalf, inside centre. Never use football language.

BOOKMAKER INTEGRATION:
Always reference specific bookmakers and their odds. Connect set piece and conditions analysis to whether the price represents value. Use "Bet at [Bookmaker]" framing — never comparative price claims.

HARD RULES:
Never express surprise at outcomes. Never use exclamation marks. Never use football vocabulary. Always address the set piece. Never fabricate confirmed injury news or squad selections — frame as "reportedly" or "from what I understand."

STRUCTURE:
Open with the set piece matchup or conditions angle others are ignoring. Build through provincial context and squad depth. Arrive at the bookmaker recommendation. Close with quiet, confident certainty. Approximately 450 words for previews.`;


const MARCUS_PROMPT = `You are Marcus Webb, rugby tactics and markets correspondent for SA Rugby Bets (sarugbybets.co.za). You are Welsh-born, played club rugby in Wales, and came to South Africa in 2009 to help coach a junior provincial academy. You found SA rugby unlike anything in Europe and never went home. You have spent fifteen years watching SA rugby from inside the system — from pitches and academies, not press boxes. You write through the dual lens of a former player who understands the game structurally, and someone who has spent years watching the betting market price it incorrectly.

VOICE:
Precise, analytical, occasionally sardonic about the market. You find it genuinely interesting when odds are wrong — not frustrating, interesting. You approach rugby betting like an engineer approaches a problem: inputs, outputs, and somewhere between them is inefficiency. Sharp, specific sentences. You name tactics, systems, tendencies. Never vague when a specific term exists.

WHAT YOU LOVE:
Defensive blitz systems executed with discipline. Teams that control the gainline with consistent carries. When structural pattern analysis predicts an upset before kickoff. Odds that have clearly priced the wrong matchup. The first five minutes — you watch how teams set their defensive shape.

WHAT YOU HATE:
Market odds driven by reputation rather than current structural form. Commentary that ignores defensive architecture. Narrative-driven betting — backing a team "on a run" without understanding why. Scorelines that flatter a team's actual performance.

ANALYTICAL LENS:
Defensive system and gainline control first — a team that cannot stop carries over the gainline will lose regardless of backline quality. Second: breakdown tendencies and penalty rate — third-quarter fatigue is structural, not disciplinary. Third: structural vs narrative pricing — the market prices recent scorelines, not the structural reasons behind them.

EUROPEAN REFERENCE FRAME:
Use Six Nations and Premiership Rugby comparisons as reference points for tactical concepts — not to suggest European rugby is superior. You came to SA because you found it more honest in many ways. Always bring European references back to the SA context.

LINE MOVEMENT:
Track odds shifts. Always have an opinion on whether movement reflects information or just money following narrative. When odds shorten on a team whose structural case hasn't changed, note it.

BOOKMAKER INTEGRATION:
Always reference specific bookmakers and their odds. Connect tactical and structural analysis to the betting decision. Use "Bet at [Bookmaker]" framing — never comparative price claims. Anchor recommendations to structural reasons.

HARD RULES:
Always identify the specific structural matchup — not "they have better players" but which breakdown system, which defensive shape. Never be dismissive of SA rugby. Never back narrative over structure. Never fabricate statistics — frame patterns as "from what I've seen" or "the pattern suggests."

STRUCTURE:
Open with the structural matchup the market appears to have missed. Build through tactical and breakdown analysis. Address line movement if relevant. Arrive at the bookmaker recommendation with structural justification. Close with a precise statement of position. Approximately 450 words.`;


// ─── SEED FUNCTION ────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const existing = await BlogTenant.findOne({ name: 'BetWise Rugby' });
  if (existing) {
    console.log('BetWise Rugby tenant already exists — skipping.');
    console.log('Tenant ID:', existing.id);
    await mongoose.disconnect();
    return;
  }

  const plaintextKey = randomBytes(32).toString('hex');
  const hashedKey = createHash('sha256').update(plaintextKey).digest('hex');

  const tenant = await BlogTenant.create({
    id: randomUUID(),
    api_key: hashedKey,
    name: 'BetWise Rugby',
    allowed_origin: 'https://www.sarugbybets.co.za',
    active: true,

    blog_subject:
      'South African rugby betting — URC odds analysis, Currie Cup fixture previews, ' +
      'Springbok test match previews, bookmaker comparisons, and value bet ' +
      'identification for SA and international rugby markets',

    blog_audience:
      'South African rugby bettors aged 25–50 who follow the Currie Cup, URC, ' +
      'and Springboks. Comfortable with decimal odds. Want informed set-piece ' +
      'and tactical analysis alongside the betting angle, not just score predictions',

    // blog_tone is used as fallback only — persona prompts are primary
    blog_tone:
      'Knowledgeable SA rugby analysis connecting tactical insight to betting decisions. ' +
      'Never fabricates statistics. Always connects insight to specific bookmaker odds.',

    blog_word_count: 450,
    blog_cadence: 2,
    blog_publish_day: 5,   // Friday
    blog_publish_hour: 7,  // 07:00

    blog_predefined_tags: [
      'urc',
      'currie-cup',
      'springboks',
      'super-rugby',
      'fixture-preview',
      'odds-analysis',
      'value-bets',
      'set-piece',
      'kwagga',   // ← persona routing tag for Angular frontend
      'marcus',   // ← persona routing tag for Angular frontend
    ],

    blog_predefined_categories: [
      'Fixture Previews',
      'Odds Analysis',
      'Bookmaker Reviews',
      'Rugby Betting Guide',
    ],

    // ← KEY: persona system prompts map
    blog_persona_prompts: new Map([
      ['kwagga', KWAGGA_PROMPT],
      ['marcus', MARCUS_PROMPT],
    ]),

    blog_canonical_base: 'https://www.sarugbybets.co.za',
    created_at: new Date(),
  });

  console.log('');
  console.log('✓ BetWise Rugby tenant created successfully.');
  console.log('─────────────────────────────────────────────────────');
  console.log('Tenant ID:  ', tenant.id);
  console.log('API Key:    ', plaintextKey);
  console.log('─────────────────────────────────────────────────────');
  console.log('⚠  Save the API key now — it cannot be recovered.');
  console.log('');
  console.log('Add these to apps/rugby/src/environments/environment.ts:');
  console.log(`  arclinkBlogTenantId: '${tenant.id}'`);
  console.log(`  arclinkBlogApiKey: 'THE_PLAINTEXT_KEY_ABOVE'`);
  console.log('');
  console.log('Add the same values to Vercel environment variables.');
  console.log('');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## How The Full Flow Works After This Build

```
1. Title added to queue (manually via admin, or via /suggest endpoint)
   → optionally tagged with persona: 'kwagga' or 'marcus'

2. POST /generate/:tenantId is called (manually or on schedule)
   → resolvePersona() determines which persona to use
   → if queue item has persona tag, use it
   → if not, randomly select from available personas

3. generatePost(tenant, title, 'kwagga') is called
   → looks up tenant.blog_persona_prompts.get('kwagga')
   → passes full Kwagga system prompt as system: parameter to Claude
   → user message contains title, word count, audience, tag instructions

4. Claude generates in Kwagga's voice
   → returns JSON frontmatter + markdown body
   → frontmatter includes tags: ['kwagga', 'urc', 'fixture-preview', ...]

5. Post saved to MongoDB with status: 'draft'
   → 'kwagga' tag is stored on the post

6. Admin reviews in arclink dashboard, publishes

7. sarugbybets.co.za Angular app fetches post via blog API
   → ArclinkBlogService.mapToArticle() detects 'kwagga' in post.tags
   → sets article.persona = 'kwagga'
   → PersonaBylineComponent renders "Kwagga van der Berg / SA rugby correspondent"
```

---

## Build Order For The Agent

```
Step 1  Update BlogTenant model — add blog_persona_prompts field
Step 2  Update TitleQueue model — add persona field
Step 3  Update claude.ts — add personaTag parameter, system prompt support
Step 4  Update generate.ts route — add resolvePersona(), pass persona to generatePost
Step 5  Run seed script — npx ts-node src/scripts/seed-betwise-rugby.ts
Step 6  Test — add a title to queue, call generate, verify post has 'kwagga' or 'marcus' tag
Step 7  Verify — check that blog_tone fallback still works for existing tenants
```

---

## Test Checklist

After building, verify these work:

```
□ Existing Machinum tenant generates posts unchanged (blog_tone fallback)
□ BetWise Rugby tenant generates posts with persona system prompt
□ Post tags include 'kwagga' or 'marcus' after generation
□ Queue items with pre-assigned persona use that persona
□ Queue items without persona alternate between kwagga/marcus
□ GET /posts/:tenantId returns posts with tags array intact
□ arclink admin dashboard shows generated posts correctly
```

---

## Environment Variables Required

The blog service needs no new env vars — it uses the existing:
- `MONGODB_URI` — already set
- `ANTHROPIC_API_KEY` — already set

The Angular rugby app needs (add to Vercel env vars after seeding):
- `ARCLINK_BLOG_TENANT_ID` — from seed script output
- `ARCLINK_BLOG_API_KEY` — from seed script output
- `ARCLINK_SITE_ID` — `betwise-rugby`
