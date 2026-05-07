# Persona Dialogue Format — Full Build Spec
## Covers: arclink API · arclink Admin · sarugbybets Angular frontend

---

## What We're Building

A dialogue-format article type where Kwagga van der Berg and Marcus Webb take turns
analysing a rugby fixture. Instead of a flat blog post, the article renders as
alternating persona blocks — each with avatar, name, descriptor, and their
section of analysis.

This format is unique in the SA sports betting space. No competitor does it.

### The End Result

```
Article page on sarugbybets.co.za:

  ┌──────────────────────────────────────────────────────┐
  │  [DV]  Kwagga van der Berg                    [blue left border]
  │        SA rugby correspondent
  │
  │  Start where the game starts. Not with the backline,
  │  not with the attack shapes — with the scrum. Because
  │  when the Bulls and Sharks meet at Loftus...
  └──────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │  [MW]  Marcus Webb                    [orange left border]
  │        Rugby tactics & markets
  │
  │  Kwagga's right about the scrum, which I don't always
  │  say. But I'll add this: the Sharks' defensive line
  │  speed has been inconsistent when rotating personnel...
  └──────────────────────────────────────────────────────┘
```

---

## Part 1 — arclink API (blog service)

### 1.1 Generation Prompt Change

The current generation produces unstructured prose with persona names as
inline headers (`Kwagga van der Berg:`). This is fragile to parse.

**Required change:** output explicitly delimited persona blocks.

Update `buildPersonaUserMessage()` in `claude.ts`:

```typescript
function buildPersonaUserMessage(
  tenant: IBlogTenant,
  title: string,
  personaTag: string
): string {
  const personas = Array.from(tenant.blog_persona_prompts?.keys() ?? []);
  const otherPersona = personas.find(p => p !== personaTag) ?? null;

  return `Write a rugby betting analysis piece with the following title:

"${title}"

FORMAT — CRITICAL:
This is a dialogue-format article. Two analysts take turns.
You must use these exact delimiters for each persona block:

[DANIE]
...Kwagga's analysis here...
[/DANIE]

[MARCUS]
...Marcus's analysis here...
[/MARCUS]

Structure:
1. [DANIE] opens with set piece / conditions angle (200–250 words)
2. [MARCUS] responds with tactical / market angle, references Kwagga's point (200–250 words)
3. [DANIE] closes with final bookmaker recommendation (80–100 words)

Rules:
- Each block stays fully in that persona's voice (defined in your system prompt)
- Marcus may agree or push back on Kwagga — genuine dialogue, not just two monologues
- Each block must reference a specific SA bookmaker with a "Bet at [Bookmaker]" CTA
- Never break the delimiter format — the frontend parser depends on it
- Do not add any text outside the delimiters (no intro paragraph, no conclusion)

JSON frontmatter before the delimiters:
{
  "seo_title": "...",
  "seo_description": "...",
  "excerpt": "One sentence summary of the fixture and key angle",
  "categories": ["Fixture Previews"],
  "tags": ["${personaTag}", "${otherPersona ?? ''}", "urc", "fixture-preview"]
}

Site: ${tenant.name}
Audience: ${tenant.blog_audience}
Word count per block: ~225 words`;
}
```

### 1.2 Post Model — Add article_format Field

```typescript
// arclink/services/blog/src/models/Post.ts

// Add to IPost interface:
article_format: 'standard' | 'dialogue';

// Add to PostSchema:
article_format: {
  type: String,
  enum: ['standard', 'dialogue'],
  default: 'standard'
},
```

### 1.3 Parser — Extract Dialogue Blocks

Add a utility that parses the raw Claude output into structured blocks.
This runs at save time so the stored post has pre-parsed blocks.

```typescript
// arclink/services/blog/src/utils/dialogue-parser.ts

export interface DialogueBlock {
  persona: string;         // 'danie' | 'marcus'
  content: string;         // markdown content for this block
  order: number;           // 1, 2, 3...
}

export interface ParsedDialogue {
  blocks: DialogueBlock[];
  isValid: boolean;
  error?: string;
}

export function parseDialogueContent(raw: string): ParsedDialogue {
  const blockRegex = /\[(DANIE|MARCUS)\]([\s\S]*?)\[\/(DANIE|MARCUS)\]/gi;
  const blocks: DialogueBlock[] = [];
  let match;
  let order = 1;

  while ((match = blockRegex.exec(raw)) !== null) {
    const openTag = match[1].toLowerCase();
    const closeTag = match[3].toLowerCase();

    if (openTag !== closeTag) {
      return {
        blocks: [],
        isValid: false,
        error: `Mismatched tags: [${openTag}] closed with [/${closeTag}]`
      };
    }

    blocks.push({
      persona: openTag,
      content: match[2].trim(),
      order: order++
    });
  }

  if (blocks.length < 2) {
    return {
      blocks: [],
      isValid: false,
      error: `Expected at least 2 dialogue blocks, found ${blocks.length}`
    };
  }

  return { blocks, isValid: true };
}
```

### 1.4 Store Parsed Blocks on Post

Update the generate route to parse and store dialogue blocks alongside raw content:

```typescript
// arclink/services/blog/src/routes/generate.ts

import { parseDialogueContent } from '../utils/dialogue-parser';

// After generating the post:
const parsed = parseDialogueContent(post.content);

const saved = await Post.create({
  // ...existing fields...
  article_format: parsed.isValid ? 'dialogue' : 'standard',
  dialogue_blocks: parsed.isValid ? parsed.blocks : [],
  content: post.content,  // keep raw content as fallback
});
```

Add `dialogue_blocks` to Post model:

```typescript
// In Post model:
dialogue_blocks: {
  type: [{
    persona: String,
    content: String,
    order: Number
  }],
  default: []
},
```

### 1.5 API Response — Include dialogue_blocks

The public posts endpoint already returns the full post object.
No route changes needed — `dialogue_blocks` is returned automatically.

Confirm the public endpoint response includes:
```json
{
  "id": "...",
  "title": "Bulls vs Sharks: Who Controls the Set Piece Controls the Result",
  "article_format": "dialogue",
  "dialogue_blocks": [
    { "persona": "danie", "content": "Start where the game starts...", "order": 1 },
    { "persona": "marcus", "content": "Kwagga's right about the scrum...", "order": 2 },
    { "persona": "danie", "content": "Bet at Hollywoodbets on the handicap...", "order": 3 }
  ],
  "content": "[DANIE]\nStart where the game starts...[/DANIE]\n[MARCUS]...",
  "tags": ["danie", "marcus", "urc", "fixture-preview"],
  ...
}
```

---

## Part 2 — arclink Admin

The admin needs to:
1. Show dialogue posts visually differently from standard posts
2. Allow editors to preview the dialogue format before publishing
3. Allow manual editing of individual persona blocks

### 2.1 Post List — Format Badge

In the published/drafts post list, add a badge showing article format.

```typescript
// arclink/admin/src/app/features/blog/published/published.component.html

@if (post.article_format === 'dialogue') {
  <span class="badge badge-dialogue">Dialogue</span>
} @else {
  <span class="badge badge-standard">Standard</span>
}
```

```css
.badge-dialogue {
  background: #e0e7ff;
  color: #3730a3;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
```

### 2.2 Post Preview — Dialogue Renderer

The existing post preview shows raw markdown. For dialogue posts, show the
parsed blocks in a visual preview matching the frontend layout.

```typescript
// arclink/admin/src/app/features/blog/post-preview/post-preview.component.ts

@Component({
  selector: 'app-post-preview',
  standalone: true,
  template: `
    @if (post.article_format === 'dialogue' && post.dialogue_blocks?.length) {
      <div class="dialogue-preview">
        @for (block of post.dialogue_blocks; track block.order) {
          <div class="dialogue-block"
               [class.danie]="block.persona === 'danie'"
               [class.marcus]="block.persona === 'marcus'">
            <div class="dialogue-header">
              <div class="persona-avatar">
                {{ block.persona === 'danie' ? 'DV' : 'MW' }}
              </div>
              <div class="persona-info">
                <strong>{{ block.persona === 'danie' ? 'Kwagga van der Berg' : 'Marcus Webb' }}</strong>
                <span>{{ block.persona === 'danie' ? 'SA rugby correspondent' : 'Rugby tactics & markets' }}</span>
              </div>
            </div>
            <div class="dialogue-content" [innerHTML]="renderMarkdown(block.content)">
            </div>
          </div>
        }
      </div>
    } @else {
      <!-- existing standard markdown preview -->
      <div class="standard-preview" [innerHTML]="renderMarkdown(post.content)"></div>
    }
  `
})
export class PostPreviewComponent {
  post = input.required<Post>();
  // renderMarkdown() already exists in the component
}
```

### 2.3 Post Editor — Block Editing

For dialogue posts, allow editors to edit each block independently rather
than editing the raw delimited markdown.

```typescript
// arclink/admin/src/app/features/blog/post-editor/post-editor.component.ts

// If article_format === 'dialogue', show block editors instead of single textarea

@if (post.article_format === 'dialogue') {
  <div class="block-editors">
    @for (block of editableBlocks; track block.order) {
      <div class="block-editor" [class]="block.persona">
        <label>
          {{ block.persona === 'danie' ? 'Kwagga van der Berg' : 'Marcus Webb' }}
          — Block {{ block.order }}
        </label>
        <textarea
          [(ngModel)]="block.content"
          (change)="onBlockChange()"
          rows="10">
        </textarea>
      </div>
    }
  </div>
} @else {
  <!-- existing single content editor -->
}
```

When saved, reconstruct the raw delimited content from edited blocks:

```typescript
onBlockChange(): void {
  // Reconstruct raw content from blocks
  this.post.content = this.editableBlocks
    .map(b => `[${b.persona.toUpperCase()}]\n${b.content}\n[/${b.persona.toUpperCase()}]`)
    .join('\n\n');

  // Re-parse to update dialogue_blocks
  const parsed = parseDialogueContent(this.post.content);
  this.post.dialogue_blocks = parsed.blocks;
}
```

### 2.4 Queue — Persona Assignment UI

When adding titles to the queue manually, show a persona selector:

```typescript
// arclink/admin/src/app/features/blog/queue/queue.component.html

<div class="add-to-queue">
  <input placeholder="Article title" [(ngModel)]="newTitle" />

  <select [(ngModel)]="newPersona">
    <option value="">Auto (alternate)</option>
    <option value="danie">Kwagga van der Berg — Set piece / conditions</option>
    <option value="marcus">Marcus Webb — Tactical / market</option>
  </select>

  <button (click)="addToQueue()">Add to queue</button>
</div>
```

Pass `persona` when creating the queue item:

```typescript
addToQueue(): void {
  this.blogApi.addToQueue([this.newTitle], this.newPersona || undefined).subscribe(...);
}
```

Update `addToQueue` in `BlogApiService` to accept optional persona:

```typescript
addToQueue(titles: string[], persona?: string) {
  return this.http.post(
    `${this.base}/queue/${this.tenantId}`,
    { titles, persona },
    { headers: this.headers }
  );
}
```

---

## Part 3 — sarugbybets Angular Frontend

### 3.1 Update Article Model

```typescript
// libs/models/src/lib/article.model.ts

export interface DialogueBlock {
  persona: 'danie' | 'marcus';
  content: string;
  order: number;
}

export interface Article {
  // ...existing fields...
  articleFormat: 'standard' | 'dialogue';
  dialogueBlocks: DialogueBlock[];
}
```

### 3.2 Update ArclinkBlogService — Map Dialogue Blocks

```typescript
// libs/data-access/arclink/src/lib/arclink-blog.service.ts

private mapToArticle(p: any): Article {
  const personaTag = p.tags?.find(
    (t: string) => (['danie', 'marcus'] as string[]).includes(t)
  );

  return {
    // ...existing fields...
    articleFormat: p.article_format ?? 'standard',
    dialogueBlocks: (p.dialogue_blocks ?? []).map((b: any) => ({
      persona: b.persona as 'danie' | 'marcus',
      content: b.content,
      order: b.order,
    })),
    persona: personaTag,
  };
}
```

### 3.3 PersonaDialogueBlockComponent — New Component

```
npx nx g @nx/angular:component persona-dialogue-block \
  --project=ui-content \
  --standalone \
  --no-interactive
```

```typescript
// libs/ui/content/src/lib/persona-dialogue-block/
//   persona-dialogue-block.component.ts

import { Component, input } from '@angular/core';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { DialogueBlock } from '@odds-nx/models';

const PERSONA_CONFIG = {
  danie: {
    name: 'Kwagga van der Berg',
    descriptor: 'SA rugby correspondent',
    initials: 'DV',
    avatarClass: 'bg-blue-100 text-blue-800',
    borderClass: 'border-l-blue-600',
    labelClass: 'text-blue-700',
  },
  marcus: {
    name: 'Marcus Webb',
    descriptor: 'Rugby tactics & markets',
    initials: 'MW',
    avatarClass: 'bg-orange-100 text-orange-800',
    borderClass: 'border-l-orange-500',
    labelClass: 'text-orange-700',
  },
} as const;

@Component({
  selector: 'lib-persona-dialogue-block',
  standalone: true,
  imports: [MarkdownPipe],
  templateUrl: './persona-dialogue-block.component.html',
})
export class PersonaDialogueBlockComponent {
  block = input.required<DialogueBlock>();

  get config() {
    return PERSONA_CONFIG[this.block().persona];
  }
}
```

```html
<!-- persona-dialogue-block.component.html -->

<div class="border-l-4 rounded-r-lg bg-white shadow-sm mb-6 overflow-hidden"
     [class]="config.borderClass">

  <!-- Persona header -->
  <div class="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
    <div class="w-10 h-10 rounded-full flex items-center justify-center
                text-sm font-semibold flex-shrink-0"
         [class]="config.avatarClass">
      {{ config.initials }}
    </div>
    <div>
      <p class="text-sm font-semibold text-gray-900 leading-tight">
        {{ config.name }}
      </p>
      <p class="text-xs leading-tight" [class]="config.labelClass">
        {{ config.descriptor }}
      </p>
    </div>
  </div>

  <!-- Block content -->
  <div class="px-5 py-4 prose prose-sm max-w-none text-gray-700
              prose-p:leading-relaxed prose-p:mb-3 prose-p:last:mb-0"
       [innerHTML]="block().content | markdown">
  </div>

</div>
```

### 3.4 Update ArticleDetailComponent — Conditional Rendering

The article detail page currently renders a flat markdown body.
Update it to check `articleFormat` and render accordingly.

```typescript
// apps/rugby/src/app/pages/article-detail/article-detail.component.ts

import { PersonaDialogueBlockComponent } from '@odds-nx/ui-content';
import { PersonaBylineComponent } from '@odds-nx/ui-content';

@Component({
  selector: 'app-article-detail',
  standalone: true,
  imports: [
    PersonaDialogueBlockComponent,
    PersonaBylineComponent,
    MarkdownPipe,
    DatePipe,
    AsyncPipe,
  ],
  templateUrl: './article-detail.component.html',
})
export class ArticleDetailComponent implements OnInit {
  article = signal<Article | null>(null);

  // ...existing load logic...
}
```

```html
<!-- article-detail.component.html -->

@if (article(); as a) {

  <!-- Article header — same for both formats -->
  <div class="max-w-2xl mx-auto px-4 pt-10 pb-6">
    <div class="flex items-center gap-2 mb-4">
      @for (cat of a.categories; track cat) {
        <span class="text-xs font-medium px-2.5 py-1 rounded-full
                     bg-blue-50 text-blue-700">
          {{ cat }}
        </span>
      }
    </div>

    <h1 class="text-3xl font-bold text-gray-900 leading-tight mb-4">
      {{ a.title }}
    </h1>

    <div class="flex items-center gap-4 text-sm text-gray-500 mb-6">
      <span>{{ a.readingTime }} min read</span>
      <span>{{ a.publishedAt | date:'d MMMM yyyy' }}</span>
    </div>

    @if (a.featuredImage) {
      <img [src]="a.featuredImage.url"
           [alt]="a.featuredImage.alt"
           class="w-full rounded-xl object-cover aspect-video mb-8" />
    }
  </div>

  <!-- DIALOGUE FORMAT -->
  @if (a.articleFormat === 'dialogue' && a.dialogueBlocks.length > 0) {
    <div class="max-w-2xl mx-auto px-4 pb-12">

      <!-- Dialogue label -->
      <div class="flex items-center gap-2 mb-6">
        <span class="text-xs font-mono uppercase tracking-widest text-gray-400">
          Dialogue analysis
        </span>
        <div class="flex-1 h-px bg-gray-200"></div>
        <div class="flex items-center gap-1">
          <span class="w-5 h-5 rounded-full bg-blue-100 text-blue-800
                       text-xs font-semibold flex items-center justify-center">
            DV
          </span>
          <span class="w-5 h-5 rounded-full bg-orange-100 text-orange-800
                       text-xs font-semibold flex items-center justify-center">
            MW
          </span>
        </div>
      </div>

      <!-- Dialogue blocks -->
      @for (block of a.dialogueBlocks; track block.order) {
        <lib-persona-dialogue-block [block]="block" />
      }

    </div>
  }

  <!-- STANDARD FORMAT — fallback -->
  @else {
    <div class="max-w-2xl mx-auto px-4 pb-12">
      @if (a.persona) {
        <div class="mb-6">
          <lib-persona-byline [personaKey]="a.persona" />
        </div>
      }
      <div class="prose prose-gray max-w-none"
           [innerHTML]="a.content | markdown">
      </div>
    </div>
  }

}
```

### 3.5 Article Card — Show Dialogue Indicator

Update `ArticleCardComponent` to show a small indicator for dialogue articles:

```html
<!-- libs/ui/content/src/lib/article-card/article-card.component.html -->

<!-- In the card footer, alongside reading time: -->
@if (article().articleFormat === 'dialogue') {
  <span class="inline-flex items-center gap-1 text-xs text-gray-400">
    <span class="w-3 h-3 rounded-full bg-blue-200 inline-block"></span>
    <span class="w-3 h-3 rounded-full bg-orange-200 inline-block -ml-1"></span>
    Dialogue
  </span>
}
```

### 3.6 MarkdownPipe — Confirm It Exists

The dialogue block content is markdown. Confirm a `MarkdownPipe` exists in
`libs/ui/content/src/lib/pipes/markdown.pipe.ts`. If not, create it:

```typescript
// libs/ui/content/src/lib/pipes/markdown.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | undefined): SafeHtml {
    if (!value) return '';
    const html = marked(value) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
```

Install marked if not already present:
```bash
npm install marked
npm install -D @types/marked
```

---

## Build Order

### arclink (do first — frontend depends on it)

```
Step 1  Add article_format and dialogue_blocks fields to Post model
Step 2  Add persona field to TitleQueue model
Step 3  Create dialogue-parser.ts utility
Step 4  Update buildPersonaUserMessage() in claude.ts with delimiter format
Step 5  Update generate.ts route to parse and store dialogue blocks
Step 6  Update admin post list — add format badge
Step 7  Update admin post preview — dialogue renderer
Step 8  Update admin post editor — block editing
Step 9  Update admin queue — persona selector
Step 10 Re-seed BetWise Rugby tenant (or update existing tenant
        with PATCH if schema migration is cleaner)
Step 11 Test: generate one post, verify dialogue_blocks in API response
```

### sarugbybets Angular frontend (after arclink API is confirmed working)

```
Step 12 Update Article model — add articleFormat and dialogueBlocks fields
Step 13 Update ArclinkBlogService.mapToArticle() — map new fields
Step 14 Generate PersonaDialogueBlockComponent in ui-content lib
Step 15 Create MarkdownPipe if it doesn't exist, install marked
Step 16 Update ArticleDetailComponent — conditional dialogue/standard rendering
Step 17 Update ArticleCardComponent — dialogue indicator
Step 18 Export new components from ui-content index.ts
Step 19 Test: visit an article page — confirm dialogue blocks render
Step 20 Test: visit a standard article — confirm fallback still works
```

---

## Test Checklist

### arclink API
```
□ POST /generate/:rugbyTenantId returns a post with article_format: 'dialogue'
□ dialogue_blocks array has 3 items (danie, marcus, danie)
□ Each block has persona, content, order fields
□ content field still contains raw delimited markdown as fallback
□ Existing Machinum tenant posts unaffected (article_format: 'standard')
□ Queue item with persona: 'danie' generates Danie-first dialogue
□ Queue item without persona generates dialogue with random first persona
```

### arclink Admin
```
□ Post list shows 'Dialogue' badge on dialogue format posts
□ Post preview shows alternating colour-coded blocks
□ Block editor shows separate textareas per persona block
□ Saving edited blocks reconstructs correct delimited content
□ Queue UI shows persona selector when adding titles
```

### sarugbybets Frontend
```
□ Dialogue article shows alternating DV/MW blocks with correct colours
□ Danie blocks have blue left border and blue avatar
□ Marcus blocks have orange left border and orange avatar
□ Persona name and descriptor render correctly in each block header
□ Markdown within blocks renders correctly (bold, italics, paragraphs)
□ Article card shows dialogue indicator on dialogue format articles
□ Standard format articles still render as flat prose (no regression)
□ Mobile: dialogue blocks stack cleanly, readable on small screens
```

---

## What The Generated Content Must Look Like

For the delimiter parsing to work, Claude must output this exact structure.
If you need to manually fix a post, edit it to match this format:

```
[DANIE]
Start where the game starts. Not with the backline, not with the attack
shapes — with the scrum. Because when the Bulls and Sharks meet at Loftus,
the game is often decided before the flyhalf touches the ball.

The Bulls loosehead and tighthead combination has been quietly one of the
more functional in the URC this season...

Bet at Hollywoodbets on the Bulls handicap, not the head-to-head. The
head-to-head price is already baked in.
[/DANIE]

[MARCUS]
Kwagga's right about the scrum, which I don't always say. But I'll add
this: the Sharks' defensive line speed has been inconsistent when they're
rotating personnel...

Bet at Betway on the total points under. Neither side scores freely
against organised defence, and this has the look of a grind.
[/MARCUS]

[DANIE]
Marcus has the under right. I'd combine it with the Bulls -8 handicap
at Hollywoodbets if you can get it. Two legs, both defensible.
[/DANIE]
```

**Nothing should appear outside these delimiters** — no intro paragraph,
no section headers, no conclusion. The JSON frontmatter comes before the
first delimiter, everything else is inside them.
