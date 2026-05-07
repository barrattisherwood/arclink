# Persona Dialogue Format — Updated Build Spec v2
## Weekly Roundup Format + Homepage Integration
## Covers: arclink API · arclink Admin · sarugbybets Angular frontend

---

## What Changed From v1

v1 spec: one fixture → one dialogue post → accessed via article card link
v2 spec: multiple fixtures → one weekly roundup post → rendered inline on homepage

The dialogue block architecture from v1 is unchanged.
These are the additions and changes on top of it.

---

## The Homepage Vision

```
┌─────────────────────────────────────────────────────────────────┐
│  HERO — "Smart rugby betting starts with better analysis"       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  THIS WEEKEND'S FIXTURES                    5 April 2026        │
│  Kwagga and Marcus break down the URC weekend                   │
│                                                                 │
│  ── Bulls vs Sharks · Loftus · Sat 17:00 ──────────────────    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [KV]  Kwagga van der Berg       [blue left border]      │   │
│  │       SA rugby correspondent                            │   │
│  │  Start where the game starts. Not with the backline...  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [MW]  Marcus Webb               [orange left border]    │   │
│  │       Rugby tactics & markets                           │   │
│  │  Kwagga's right about the scrum, which I don't always.. │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ── Lions vs Stormers · Ellis Park · Sat 19:30 ─────────────   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [KV]  Kwagga van der Berg       [blue left border]      │   │
│  │  Let's start where this match gets decided...           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [MW]  Marcus Webb               [orange left border]    │   │
│  │  Kwagga's right about the lineout loading...            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ── Connacht vs Ulster · Galway · Fri 20:15 ────────────────   │
│  ...                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  LICENSED SA BOOKMAKERS                                         │
│  Hollywoodbets · Betway · 10bet · Supabets                     │
└─────────────────────────────────────────────────────────────────┘
```

The "Latest analysis" card grid is removed from the homepage entirely.
It lives on `/analysis` as a full article archive. The homepage is now
a single, focused editorial experience — this weekend's dialogue.

---

## Part 1 — arclink API Changes

### 1.1 Post Model — Add featured and fixtures Fields

```typescript
// arclink/services/blog/src/models/Post.ts

// Add to IPost interface:
featured: boolean;           // marks the current weekly roundup
fixture_list: FixtureEntry[]; // structured fixture data for the roundup

export interface FixtureEntry {
  homeTeam: string;
  awayTeam: string;
  competition: string;  // 'URC' | 'Currie Cup' | 'Springboks' etc
  venue: string;
  kickoff: string;      // ISO datetime string
  matchLabel: string;   // e.g. 'Bulls vs Sharks · Loftus · Sat 17:00'
}

// Add to PostSchema:
featured: { type: Boolean, default: false },
fixture_list: {
  type: [{
    homeTeam: String,
    awayTeam: String,
    competition: String,
    venue: String,
    kickoff: String,
    matchLabel: String,
  }],
  default: []
},
```

### 1.2 TitleQueue — Add fixtures Array

When a weekly roundup title is queued, the fixture list travels with it
so the generation prompt has the match data it needs.

```typescript
// arclink/services/blog/src/models/TitleQueue.ts

// Add to interface:
fixtures: FixtureEntry[];  // imported from Post model types

// Add to schema:
fixtures: {
  type: [{
    homeTeam: String,
    awayTeam: String,
    competition: String,
    venue: String,
    kickoff: String,
    matchLabel: String,
  }],
  default: []
},
```

### 1.3 Generation Prompt — Weekly Roundup Format

```typescript
// arclink/services/blog/src/services/claude.ts

function buildWeeklyRoundupMessage(
  tenant: IBlogTenant,
  title: string,
  fixtures: FixtureEntry[]
): string {
  const fixtureList = fixtures
    .map((f, i) => `${i + 1}. ${f.matchLabel} (${f.competition})`)
    .join('\n');

  return `Write a weekly rugby betting dialogue for the following title:

"${title}"

This weekend's fixtures to cover:
${fixtureList}

FORMAT — CRITICAL:
For each fixture, produce one dialogue exchange using these exact delimiters:

[FIXTURE: ${fixtures[0]?.matchLabel ?? 'Fixture 1'}]
[KWAGGA]
...Kwagga's analysis...
[/KWAGGA]
[MARCUS]
...Marcus's response...
[/MARCUS]
[/FIXTURE]

[FIXTURE: ${fixtures[1]?.matchLabel ?? 'Fixture 2'}]
[KWAGGA]
...
[/KWAGGA]
[MARCUS]
...
[/MARCUS]
[/FIXTURE]

...and so on for all ${fixtures.length} fixtures.

Rules per fixture:
- Kwagga opens (150–180 words): set piece, conditions, provincial angle
- Marcus responds (150–180 words): defensive structure, market angle,
  may agree or push back on Kwagga — genuine dialogue
- Each speaker ends their block with one "Bet at [Bookmaker]" CTA
- Different bookmakers across the roundup where possible
- Marcus references Kwagga's point by name in his response
- Kwagga and Marcus can disagree on the same fixture — that is the point

Persona reminder:
- Kwagga: dry SA rugby authority, set-piece obsessed, conditions-first
- Marcus: tactical precision, market inefficiency lens, sardonic about odds

JSON frontmatter before all fixtures:
{
  "seo_title": "...",
  "seo_description": "Weekend URC betting preview — Kwagga and Marcus...",
  "excerpt": "This weekend: ${fixtureList.split('\n').join(', ')}",
  "categories": ["Fixture Previews"],
  "tags": ["kwagga", "marcus", "urc", "fixture-preview", "weekly-roundup"]
}

Site: ${tenant.name}
Audience: ${tenant.blog_audience}`;
}
```

Detect roundup vs single fixture in `generatePost`:

```typescript
export async function generatePost(
  tenant: IBlogTenant,
  title: string,
  personaTag?: string,
  fixtures?: FixtureEntry[]
): Promise<GeneratedPost> {

  const isWeeklyRoundup = fixtures && fixtures.length > 0;

  const userMessage = isWeeklyRoundup
    ? buildWeeklyRoundupMessage(tenant, title, fixtures)
    : personaTag
      ? buildPersonaUserMessage(tenant, title, personaTag)
      : buildDefaultUserMessage(tenant, title);

  // For weekly roundup — no single system prompt, use general tone
  // Both personas are embedded in the user message instructions
  const systemPrompt = isWeeklyRoundup
    ? buildCombinedPersonaSystem(tenant)  // see below
    : personaTag
      ? tenant.blog_persona_prompts?.get(personaTag)
      : undefined;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,  // higher for weekly roundup
    ...(systemPrompt && { system: systemPrompt }),
    messages: [{ role: 'user', content: userMessage }]
  });

  return parseClaudeResponse(response, isWeeklyRoundup ? 'roundup' : personaTag);
}


function buildCombinedPersonaSystem(tenant: IBlogTenant): string {
  const kwagga = tenant.blog_persona_prompts?.get('kwagga') ?? '';
  const marcus = tenant.blog_persona_prompts?.get('marcus') ?? '';

  return `You are writing as TWO personas alternating within a single article.

PERSONA 1 — KWAGGA (writes [KWAGGA] blocks):
${kwagga}

PERSONA 2 — MARCUS (writes [MARCUS] blocks):
${marcus}

Switch fully into each persona when writing their blocks.
The two voices must be genuinely distinct. Kwagga and Marcus are allowed
to disagree and often do. Marcus should acknowledge Kwagga's point before
building his own angle. Kwagga may be unmoved by Marcus's market analysis.`;
}
```

### 1.4 Parser — Extended for Weekly Roundup Format

```typescript
// arclink/services/blog/src/utils/dialogue-parser.ts

export interface FixtureDialogue {
  matchLabel: string;
  blocks: DialogueBlock[];
}

export interface ParsedWeeklyRoundup {
  fixtures: FixtureDialogue[];
  isValid: boolean;
  error?: string;
}

export function parseWeeklyRoundup(raw: string): ParsedWeeklyRoundup {
  // Match [FIXTURE: label]...[/FIXTURE] blocks
  const fixtureRegex = /\[FIXTURE:\s*([^\]]+)\]([\s\S]*?)\[\/FIXTURE\]/gi;
  const fixtures: FixtureDialogue[] = [];
  let match;

  while ((match = fixtureRegex.exec(raw)) !== null) {
    const matchLabel = match[1].trim();
    const fixtureContent = match[2];

    // Parse persona blocks within each fixture
    const parsed = parseDialogueContent(fixtureContent);

    if (!parsed.isValid) {
      return {
        fixtures: [],
        isValid: false,
        error: `Invalid dialogue in fixture "${matchLabel}": ${parsed.error}`
      };
    }

    fixtures.push({ matchLabel, blocks: parsed.blocks });
  }

  if (fixtures.length === 0) {
    // Try single-fixture fallback (v1 format)
    const parsed = parseDialogueContent(raw);
    if (parsed.isValid) {
      return {
        fixtures: [{ matchLabel: '', blocks: parsed.blocks }],
        isValid: true
      };
    }
    return {
      fixtures: [],
      isValid: false,
      error: 'No fixture blocks found'
    };
  }

  return { fixtures, isValid: true };
}
```

### 1.5 Store Roundup Structure on Post

```typescript
// In generate.ts route — update save logic

const isRoundup = !!queueItem.fixtures?.length;
const parsed = isRoundup
  ? parseWeeklyRoundup(post.content)
  : { fixtures: [{ matchLabel: '', blocks: parseDialogueContent(post.content).blocks }], isValid: true };

const saved = await Post.create({
  // ...existing fields...
  article_format: isRoundup ? 'weekly-roundup' : 'dialogue',
  dialogue_blocks: parsed.fixtures.flatMap(f => f.blocks),  // flat array for API compat
  fixture_dialogues: parsed.fixtures,  // structured roundup data
  fixture_list: queueItem.fixtures ?? [],
  featured: false,  // manually promoted to featured in admin
  content: post.content,
});
```

Add `fixture_dialogues` to Post model:

```typescript
fixture_dialogues: {
  type: [{
    matchLabel: String,
    blocks: [{
      persona: String,
      content: String,
      order: Number,
    }]
  }],
  default: []
},
```

### 1.6 New API Endpoint — Featured Post

The homepage needs to fetch the current featured weekly roundup.
Add one endpoint to the posts route:

```typescript
// arclink/services/blog/src/routes/posts.ts

// GET /posts/:tenantId/featured
// Returns the current pinned weekly roundup for homepage use
router.get('/:tenantId/featured', resolveTenant, async (req, res) => {
  const post = await Post.findOne({
    tenant_id: req.params.tenantId,
    featured: true,
    status: 'published'
  }).sort({ published_at: -1 });

  if (!post) {
    return res.status(404).json({ error: 'No featured post found' });
  }

  res.json({ post });
});
```

### 1.7 Admin — Promote to Featured

When a weekly roundup is ready to go live on the homepage, the editor
promotes it to featured. This unpins any previous featured post automatically.

```typescript
// arclink/services/blog/src/routes/posts.ts

// POST /posts/:tenantId/:postId/feature
router.post('/:tenantId/:postId/feature', resolveTenant, async (req, res) => {
  // Unpin previous featured post
  await Post.updateMany(
    { tenant_id: req.params.tenantId, featured: true },
    { $set: { featured: false } }
  );

  // Pin this post
  const post = await Post.findOneAndUpdate(
    { tenant_id: req.params.tenantId, id: req.params.postId },
    { $set: { featured: true } },
    { new: true }
  );

  res.json({ post });
});
```

---

## Part 2 — arclink Admin Changes

### 2.1 Queue — Fixture List Input

When adding a weekly roundup to the queue, the editor inputs the fixture list.

```typescript
// arclink/admin/src/app/features/blog/queue/queue.component.html

<div class="add-to-queue">

  <input placeholder="Post title e.g. 'URC Weekend Preview — 5 April'"
         [(ngModel)]="newTitle" />

  <div class="post-type-toggle">
    <label>
      <input type="radio" [(ngModel)]="postType" value="single" />
      Single fixture dialogue
    </label>
    <label>
      <input type="radio" [(ngModel)]="postType" value="roundup" />
      Weekly roundup
    </label>
  </div>

  @if (postType === 'single') {
    <select [(ngModel)]="newPersona">
      <option value="">Auto (alternate)</option>
      <option value="kwagga">Kwagga opens — Set piece / conditions</option>
      <option value="marcus">Marcus opens — Tactical / market</option>
    </select>
  }

  @if (postType === 'roundup') {
    <div class="fixture-list-builder">
      <p class="label">Fixtures this weekend</p>

      @for (fixture of newFixtures; track $index) {
        <div class="fixture-row">
          <input placeholder="Home team" [(ngModel)]="fixture.homeTeam" />
          <span>vs</span>
          <input placeholder="Away team" [(ngModel)]="fixture.awayTeam" />
          <input placeholder="Competition" [(ngModel)]="fixture.competition" />
          <input placeholder="Venue" [(ngModel)]="fixture.venue" />
          <input type="datetime-local" [(ngModel)]="fixture.kickoff" />
          <button (click)="removeFixture($index)">✕</button>
        </div>
      }

      <button (click)="addFixture()">+ Add fixture</button>
    </div>
  }

  <button (click)="addToQueue()">Add to queue</button>
</div>
```

```typescript
// queue.component.ts

postType: 'single' | 'roundup' = 'roundup'; // default to roundup
newFixtures: Partial<FixtureEntry>[] = [{}]; // start with one empty row

addFixture() {
  this.newFixtures.push({});
}

removeFixture(index: number) {
  this.newFixtures.splice(index, 1);
}

buildMatchLabel(f: Partial<FixtureEntry>): string {
  if (!f.homeTeam || !f.awayTeam) return '';
  const kickoffDate = f.kickoff ? new Date(f.kickoff) : null;
  const dayTime = kickoffDate
    ? kickoffDate.toLocaleDateString('en-ZA', { weekday: 'short' }) + ' ' +
      kickoffDate.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
    : '';
  return `${f.homeTeam} vs ${f.awayTeam} · ${f.venue ?? ''} · ${dayTime}`;
}

addToQueue() {
  const fixtures = this.postType === 'roundup'
    ? this.newFixtures.map(f => ({
        ...f,
        matchLabel: this.buildMatchLabel(f)
      })) as FixtureEntry[]
    : [];

  this.blogApi.addToQueue(
    [this.newTitle],
    this.postType === 'single' ? this.newPersona : undefined,
    fixtures
  ).subscribe(() => {
    this.newTitle = '';
    this.newFixtures = [{}];
    this.loadQueue();
  });
}
```

Update `BlogApiService.addToQueue`:

```typescript
addToQueue(titles: string[], persona?: string, fixtures: FixtureEntry[] = []) {
  return this.http.post(
    `${this.base}/queue/${this.tenantId}`,
    { titles, persona, fixtures },
    { headers: this.headers }
  );
}
```

### 2.2 Post List — Feature Button

In the published posts list, add a "Set as homepage" button for weekly roundup posts:

```typescript
// published.component.html

@if (post.article_format === 'weekly-roundup') {
  <button (click)="setFeatured(post.id)"
          [class.active]="post.featured"
          class="btn-feature">
    {{ post.featured ? '★ Homepage' : '☆ Set as homepage' }}
  </button>
}
```

```typescript
setFeatured(postId: string) {
  this.blogApi.featurePost(postId).subscribe(() => {
    this.loadPosts(); // refresh list
  });
}
```

Add to `BlogApiService`:

```typescript
featurePost(postId: string) {
  return this.http.post(
    `${this.base}/posts/${this.tenantId}/${postId}/feature`,
    {},
    { headers: this.headers }
  );
}
```

### 2.3 Post Preview — Weekly Roundup Renderer

Extend the preview component to handle the roundup format:

```typescript
// post-preview.component.html

@if (post.article_format === 'weekly-roundup') {
  <div class="roundup-preview">
    <div class="roundup-header">
      <h2>{{ post.title }}</h2>
      <span class="badge badge-roundup">Weekly Roundup</span>
    </div>

    @for (fixture of post.fixture_dialogues; track fixture.matchLabel) {
      <div class="fixture-section">
        <div class="fixture-label">{{ fixture.matchLabel }}</div>

        @for (block of fixture.blocks; track block.order) {
          <div class="dialogue-block" [class]="block.persona">
            <strong>{{ block.persona === 'kwagga' ? 'Kwagga' : 'Marcus' }}</strong>
            <p>{{ block.content | slice:0:200 }}...</p>
          </div>
        }
      </div>
    }
  </div>
}
```

---

## Part 3 — sarugbybets Angular Frontend

### 3.1 Update Article Model

```typescript
// libs/models/src/lib/article.model.ts

export type ArticleFormat = 'standard' | 'dialogue' | 'weekly-roundup';

export interface FixtureEntry {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  venue: string;
  kickoff: Date;
  matchLabel: string;
}

export interface FixtureDialogue {
  matchLabel: string;
  blocks: DialogueBlock[];
}

export interface Article {
  // ...existing fields...
  articleFormat: ArticleFormat;
  dialogueBlocks: DialogueBlock[];     // flat — used for single dialogue
  fixtureDialogues: FixtureDialogue[]; // structured — used for weekly roundup
  fixtureList: FixtureEntry[];
  featured: boolean;
}
```

### 3.2 Update ArclinkBlogService

Add `getFeaturedPost()` method for homepage use:

```typescript
// libs/data-access/arclink/src/lib/arclink-blog.service.ts

getFeaturedPost() {
  const key = makeStateKey<Article>(`featured_${this.config.arclinkBlogTenantId}`);
  const cached = this.ts.get(key, null);
  if (cached) return of(cached);

  return this.http
    .get<{ post: any }>(
      `${BASE}/posts/${this.config.arclinkBlogTenantId}/featured`,
      { headers: this.headers }
    )
    .pipe(
      map(r => this.mapToArticle(r.post)),
      tap(data => this.ts.set(key, data))
    );
}

// Update mapToArticle to include new fields:
private mapToArticle(p: any): Article {
  return {
    // ...existing fields...
    articleFormat: p.article_format ?? 'standard',
    dialogueBlocks: (p.dialogue_blocks ?? []).map(/* existing mapping */),
    fixtureDialogues: (p.fixture_dialogues ?? []).map((fd: any) => ({
      matchLabel: fd.matchLabel,
      blocks: fd.blocks.map((b: any) => ({
        persona: b.persona as 'kwagga' | 'marcus',
        content: b.content,
        order: b.order,
      }))
    })),
    fixtureList: (p.fixture_list ?? []).map((f: any) => ({
      ...f,
      kickoff: new Date(f.kickoff),
    })),
    featured: p.featured ?? false,
  };
}
```

### 3.3 FixtureDialogueSectionComponent — New Component

Renders one fixture's dialogue exchange. Used in both homepage and article detail.

```
npx nx g @nx/angular:component fixture-dialogue-section \
  --project=ui-content \
  --standalone \
  --no-interactive
```

```typescript
// libs/ui/content/src/lib/fixture-dialogue-section/
//   fixture-dialogue-section.component.ts

import { Component, input } from '@angular/core';
import { PersonaDialogueBlockComponent } from '../persona-dialogue-block/persona-dialogue-block.component';
import { FixtureDialogue } from '@odds-nx/models';

@Component({
  selector: 'lib-fixture-dialogue-section',
  standalone: true,
  imports: [PersonaDialogueBlockComponent],
  templateUrl: './fixture-dialogue-section.component.html',
})
export class FixtureDialogueSectionComponent {
  fixture = input.required<FixtureDialogue>();
  showDivider = input<boolean>(true);
}
```

```html
<!-- fixture-dialogue-section.component.html -->

<div class="fixture-section mb-10">

  <!-- Fixture header divider -->
  @if (showDivider()) {
    <div class="flex items-center gap-3 mb-6">
      <div class="h-px flex-1 bg-gray-200"></div>
      <span class="text-xs font-mono text-gray-500 whitespace-nowrap px-2">
        {{ fixture().matchLabel }}
      </span>
      <div class="h-px flex-1 bg-gray-200"></div>
    </div>
  }

  <!-- Dialogue blocks for this fixture -->
  @for (block of fixture().blocks; track block.order) {
    <lib-persona-dialogue-block [block]="block" />
  }

</div>
```

### 3.4 WeeklyRoundupComponent — Homepage Section

This is the main homepage section replacing the "Latest analysis" card grid.

```
npx nx g @nx/angular:component weekly-roundup \
  --project=ui-content \
  --standalone \
  --no-interactive
```

```typescript
// libs/ui/content/src/lib/weekly-roundup/weekly-roundup.component.ts

import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ArclinkBlogService } from '@odds-nx/data-access-arclink';
import { FixtureDialogueSectionComponent } from '../fixture-dialogue-section/fixture-dialogue-section.component';
import { Article } from '@odds-nx/models';

@Component({
  selector: 'lib-weekly-roundup',
  standalone: true,
  imports: [DatePipe, RouterLink, FixtureDialogueSectionComponent],
  templateUrl: './weekly-roundup.component.html',
})
export class WeeklyRoundupComponent implements OnInit {
  private blog = inject(ArclinkBlogService);

  post = signal<Article | null>(null);
  loading = signal(true);
  error = signal(false);

  ngOnInit() {
    this.blog.getFeaturedPost().subscribe({
      next: (article) => {
        this.post.set(article);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }
}
```

```html
<!-- weekly-roundup.component.html -->

<section class="py-12 px-4 max-w-3xl mx-auto">

  @if (loading()) {
    <!-- Skeleton loader -->
    <div class="animate-pulse">
      <div class="h-4 bg-gray-200 rounded w-48 mb-2"></div>
      <div class="h-8 bg-gray-200 rounded w-full mb-6"></div>
      <div class="h-32 bg-gray-100 rounded mb-4"></div>
      <div class="h-32 bg-gray-100 rounded mb-4"></div>
    </div>
  }

  @else if (error() || !post()) {
    <!-- Empty state — before first roundup is published -->
    <div class="text-center py-12 text-gray-400">
      <p class="text-sm">This weekend's analysis coming soon.</p>
      <p class="text-xs mt-1">Check back Friday morning.</p>
    </div>
  }

  @else if (post(); as article) {
    <!-- Roundup header -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-mono uppercase tracking-widest text-gray-400">
          This weekend's fixtures
        </span>
        <span class="text-xs text-gray-400">
          {{ article.publishedAt | date:'d MMMM yyyy' }}
        </span>
      </div>
      <h2 class="text-2xl font-bold text-gray-900">{{ article.title }}</h2>
      <p class="text-sm text-gray-500 mt-1">{{ article.excerpt }}</p>

      <!-- Persona duo indicator -->
      <div class="flex items-center gap-2 mt-3">
        <div class="flex items-center gap-1">
          <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-800
                       text-xs font-semibold flex items-center justify-center">
            KV
          </span>
          <span class="w-6 h-6 rounded-full bg-orange-100 text-orange-800
                       text-xs font-semibold flex items-center justify-center">
            MW
          </span>
        </div>
        <span class="text-xs text-gray-400">
          Kwagga van der Berg & Marcus Webb
        </span>
      </div>
    </div>

    <!-- Fixture dialogues -->
    @for (fixture of article.fixtureDialogues; track fixture.matchLabel; let first = $first) {
      <lib-fixture-dialogue-section
        [fixture]="fixture"
        [showDivider]="true" />
    }

    <!-- Link to full article page -->
    <div class="mt-6 pt-6 border-t border-gray-100 text-center">
      <a [routerLink]="['/analysis', article.slug]"
         class="text-sm text-blue-600 hover:text-blue-800 font-medium">
        View full analysis →
      </a>
    </div>
  }

</section>
```

### 3.5 Update HomeComponent

Replace the existing fixtures section and "Latest analysis" card grid
with the `WeeklyRoundupComponent`:

```typescript
// apps/rugby/src/app/pages/home/home.component.ts

import { WeeklyRoundupComponent } from '@odds-nx/ui-content';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [WeeklyRoundupComponent],
  template: `
    <app-hero />
    <lib-weekly-roundup />
    <!-- bookmakers footer strip stays -->
  `
})
export class HomeComponent {}
```

### 3.6 Update ArticleDetailComponent

The article detail page also needs to handle weekly-roundup format.
It renders exactly like the homepage section but with the full article
header (title, date, image) above it.

```html
<!-- article-detail.component.html — add this format case -->

@if (a.articleFormat === 'weekly-roundup' && a.fixtureDialogues.length > 0) {
  <div class="max-w-3xl mx-auto px-4 pb-12">

    <div class="flex items-center gap-2 mb-6">
      <span class="text-xs font-mono uppercase tracking-widest text-gray-400">
        Weekend dialogue
      </span>
      <div class="flex-1 h-px bg-gray-200"></div>
      <div class="flex items-center gap-1">
        <span class="w-5 h-5 rounded-full bg-blue-100 text-blue-800
                     text-xs font-semibold flex items-center justify-center">KV</span>
        <span class="w-5 h-5 rounded-full bg-orange-100 text-orange-800
                     text-xs font-semibold flex items-center justify-center">MW</span>
      </div>
    </div>

    @for (fixture of a.fixtureDialogues; track fixture.matchLabel) {
      <lib-fixture-dialogue-section [fixture]="fixture" [showDivider]="true" />
    }

  </div>
}
```

### 3.7 Update lib Exports

```typescript
// libs/ui/content/src/index.ts

export * from './lib/persona-dialogue-block/persona-dialogue-block.component';
export * from './lib/fixture-dialogue-section/fixture-dialogue-section.component';
export * from './lib/weekly-roundup/weekly-roundup.component';
export * from './lib/article-card/article-card.component';
export * from './lib/persona-byline/persona-byline.component';
export * from './lib/match-card/match-card.component';
export * from './lib/pipes/markdown.pipe';
```

---

## Build Order

### arclink (first)

```
Step 1   Add featured, fixture_list, fixture_dialogues fields to Post model
Step 2   Add fixtures field to TitleQueue model
Step 3   Update dialogue-parser.ts — add parseWeeklyRoundup()
Step 4   Update claude.ts — add buildWeeklyRoundupMessage(),
         buildCombinedPersonaSystem(), extend generatePost() signature
Step 5   Update generate.ts — handle fixtures from queue,
         store fixture_dialogues, set article_format: 'weekly-roundup'
Step 6   Add GET /posts/:tenantId/featured endpoint
Step 7   Add POST /posts/:tenantId/:postId/feature endpoint
Step 8   Update admin queue — fixture list builder UI
Step 9   Update admin post list — "Set as homepage" button
Step 10  Update admin post preview — weekly roundup renderer
Step 11  Update BlogApiService — add featurePost(), update addToQueue()
Step 12  Test: add a roundup to queue with 3 fixtures, generate,
         verify fixture_dialogues in API response
Step 13  Test: call /featured — returns null (no featured yet)
Step 14  Publish the generated post, set as featured
Step 15  Test: call /featured — returns the roundup post
```

### sarugbybets Angular (after Step 15 confirmed)

```
Step 16  Update Article model — new fields and types
Step 17  Update ArclinkBlogService — getFeaturedPost(), mapToArticle()
Step 18  Generate FixtureDialogueSectionComponent
Step 19  Generate WeeklyRoundupComponent
Step 20  Update HomeComponent — replace card grid with WeeklyRoundupComponent
Step 21  Update ArticleDetailComponent — weekly-roundup format case
Step 22  Export new components from ui-content index.ts
Step 23  Test homepage: loading skeleton shows, then dialogue renders
Step 24  Test: before any featured post — empty state shows correctly
Step 25  Test: click "View full analysis" — links to correct article slug
Step 26  Test: article detail page renders roundup format correctly
Step 27  Test: standard and single dialogue formats unaffected (no regression)
```

---

## Test Checklist

### arclink API
```
□ Queue item with fixtures array generates weekly-roundup format post
□ fixture_dialogues has one entry per fixture in queue item
□ Each fixture_dialogue has correct matchLabel and 2 blocks (kwagga + marcus)
□ GET /featured returns 404 when no featured post exists
□ POST /feature promotes post and demotes previous featured
□ GET /featured returns promoted post
□ Single dialogue format posts unaffected
□ Standard format posts unaffected
```

### sarugbybets Homepage
```
□ WeeklyRoundupComponent shows skeleton while loading
□ Empty state shows when no featured post exists
□ Fixture dialogue sections render in correct order
□ Fixture header dividers show correct match labels
□ Kwagga blocks: blue left border, KV initials, correct name
□ Marcus blocks: orange left border, MW initials, correct name
□ "View full analysis" link points to correct /analysis/:slug route
□ Mobile: blocks stack cleanly, readable at 375px
□ No "Latest analysis" card grid on homepage
```

### sarugbybets Article Detail
```
□ Weekly roundup article renders fixture sections with dividers
□ Single dialogue article still renders flat blocks
□ Standard article still renders prose
□ All three formats accessible via /analysis/:slug
```
