# arclink — Editorial Calendar Build Spec
## Phase 1: Calendar UI + Scheduled Publishing
## Phase 2: Fixture-Aware Content Suggestions

---

## What Already Exists in arclink

Before building anything, understand the current state:

```
arclink/services/blog/
├── models/
│   ├── BlogTenant.ts         ← tenant config, persona prompts, sport_key
│   ├── Post.ts               ← published posts, article_format, featured
│   └── TitleQueue.ts         ← flat queue of titles awaiting generation
├── routes/
│   ├── generate.ts           ← POST /generate/:tenantId
│   ├── posts.ts              ← CRUD, /featured, /feature, /generate-roundup
│   └── queue.ts              ← queue management
├── services/
│   ├── claude.ts             ← generatePost(), buildRoundupMessage()
│   └── sportdb.ts            ← fetchUpcomingFixtures(), fixture scoring
├── utils/
│   └── dialogue-parser.ts    ← parseWeeklyRoundup(), parseDialogueContent()
└── scheduler-weekly-roundup.ts ← Tuesday 04:00 UTC cron
```

The existing queue is a flat list — titles sit there until manually triggered.
There is no scheduling, no calendar view, no fixture awareness in the queue.
That is what this spec adds.

---

## Phase 1 — Calendar UI + Scheduled Publishing

### What Phase 1 Adds

- `publish_at` field on Post — future-dated publishing
- `generate_at` field on TitleQueue — scheduled generation trigger
- `content_type` field on TitleQueue — categorises content for calendar display
- `fixture_date` field on TitleQueue — links content to a real sporting event date
- A publishing scheduler that checks every hour for posts ready to go live
- A generation scheduler that checks every hour for queue items ready to generate
- A calendar view in the arclink admin showing all content mapped to dates
- A calendar add form that creates queue items with full scheduling metadata

---

### 1.1 — Model Changes

#### TitleQueue — Add Scheduling Fields

```typescript
// arclink/services/blog/src/models/TitleQueue.ts

// Add to interface:
export type ContentType =
  | 'weekly-roundup'      // automated Tuesday roundup
  | 'match-preview'       // single fixture preview
  | 'season-preview'      // competition season preview
  | 'evergreen'           // timeless guide, review, explainer
  | 'tournament-window'   // tournament/series preview
  | 'post-match'          // post-match analysis
  | 'bookmaker-review';   // bookmaker guide

export interface IQueueItem {
  // ...existing fields...
  content_type:   ContentType;
  generate_at:    Date | null;   // null = generate immediately
  publish_at:     Date | null;   // null = save as draft, publish manually
  fixture_date:   Date | null;   // the actual sporting event date
  fixture_label:  string | null; // e.g. "Bulls vs Sharks · Sat 17:00"
  competition:    string | null; // e.g. "URC", "PSL", "Currie Cup"
  status:         'pending' | 'generating' | 'generated' | 'published' | 'failed';
}

// Add to schema:
content_type:  { type: String, enum: [...], default: 'evergreen' },
generate_at:   { type: Date, default: null },
publish_at:    { type: Date, default: null },
fixture_date:  { type: Date, default: null },
fixture_label: { type: String, default: null },
competition:   { type: String, default: null },
status:        { type: String, enum: [...], default: 'pending' },
```

#### Post — Add publish_at and scheduled status

```typescript
// arclink/services/blog/src/models/Post.ts

// Add to interface:
publish_at: Date | null;   // if set, post auto-publishes at this datetime
scheduled:  boolean;       // true if awaiting auto-publish

// Add to schema:
publish_at: { type: Date, default: null },
scheduled:  { type: Boolean, default: false },

// Update status enum to include 'scheduled':
status: {
  type: String,
  enum: ['draft', 'scheduled', 'published'],
  default: 'draft'
},
```

---

### 1.2 — New Schedulers

#### Generation Scheduler — Checks Hourly

Runs every hour, finds queue items where `generate_at` has passed, triggers generation.

```typescript
// arclink/services/blog/src/scheduler-generation.ts

import cron from 'node-cron';
import { TitleQueue } from './models/TitleQueue';
import { BlogTenant } from './models/BlogTenant';
import { generatePost } from './services/claude';
import { Post } from './models/Post';
import { parseWeeklyRoundup, parseDialogueContent } from './utils/dialogue-parser';

// Every hour at :05
cron.schedule('5 * * * *', async () => {
  const now = new Date();

  const dueItems = await TitleQueue.find({
    status: 'pending',
    generate_at: { $lte: now },
  }).populate('tenant_id');

  console.log(`[Generation Scheduler] ${dueItems.length} items due`);

  for (const item of dueItems) {
    try {
      await item.updateOne({ status: 'generating' });

      const tenant = await BlogTenant.findOne({ id: item.tenant_id });
      if (!tenant) throw new Error('Tenant not found');

      const isRoundup = item.is_weekly_roundup && item.fixtures?.length;
      const generated = await generatePost(
        tenant,
        item.title,
        item.persona ?? undefined,
        isRoundup ? item.fixtures : undefined
      );

      const parsed = isRoundup
        ? parseWeeklyRoundup(generated.content)
        : { fixtures: [{ matchLabel: '', blocks: parseDialogueContent(generated.content).blocks }], isValid: true };

      // Determine initial status
      const hasScheduledPublish = !!item.publish_at && item.publish_at > now;
      const postStatus = hasScheduledPublish ? 'scheduled' : 'draft';

      await Post.create({
        tenant_id: tenant.id,
        title: generated.title,
        slug: generated.slug,
        content: generated.content,
        excerpt: generated.excerpt,
        seo_title: generated.seo_title,
        seo_description: generated.seo_description,
        tags: generated.tags,
        categories: generated.categories,
        article_format: isRoundup ? 'weekly-roundup' : 'dialogue',
        dialogue_blocks: parsed.fixtures.flatMap(f => f.blocks),
        fixture_dialogues: parsed.fixtures,
        fixture_list: item.fixtures ?? [],
        featured: false,
        status: postStatus,
        scheduled: hasScheduledPublish,
        publish_at: item.publish_at ?? null,
        generated: true,
        word_count: generated.word_count,
        reading_time: generated.reading_time,
        created_at: new Date(),
        // Calendar metadata from queue item
        content_type: item.content_type,
        fixture_date: item.fixture_date,
        fixture_label: item.fixture_label,
        competition: item.competition,
      });

      await item.updateOne({ status: 'generated' });
      console.log(`[Generation Scheduler] Generated: "${item.title}"`);

    } catch (err) {
      await item.updateOne({ status: 'failed' });
      console.error(`[Generation Scheduler] Failed: "${item.title}"`, err);
    }
  }
});
```

#### Publishing Scheduler — Checks Hourly

Runs every hour at :30, finds posts where `publish_at` has passed, publishes them.

```typescript
// arclink/services/blog/src/scheduler-publishing.ts

import cron from 'node-cron';
import { Post } from './models/Post';

// Every hour at :30
cron.schedule('30 * * * *', async () => {
  const now = new Date();

  const duePosts = await Post.find({
    status: 'scheduled',
    publish_at: { $lte: now },
  });

  console.log(`[Publishing Scheduler] ${duePosts.length} posts due to publish`);

  for (const post of duePosts) {
    await post.updateOne({
      status: 'published',
      scheduled: false,
      published_at: now,
    });
    console.log(`[Publishing Scheduler] Published: "${post.title}"`);
  }
});
```

Register both in `index.ts`:

```typescript
// arclink/services/blog/src/index.ts
import './scheduler-weekly-roundup';
import './scheduler-generation';   // NEW
import './scheduler-publishing';   // NEW
```

---

### 1.3 — New API Routes

#### Calendar Feed — For Admin Calendar View

```typescript
// arclink/services/blog/src/routes/calendar.ts
import { Router } from 'express';
import { TitleQueue } from '../models/TitleQueue';
import { Post } from '../models/Post';
import { resolveTenant } from '../middleware/resolveTenant';

const router = Router();

// GET /calendar/:tenantId?from=ISO&to=ISO
// Returns all queue items and posts within a date range for calendar display
router.get('/:tenantId', resolveTenant, async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };

  const fromDate = from ? new Date(from) : new Date();
  const toDate   = to   ? new Date(to)   : new Date(Date.now() + 30 * 86400000);

  // Queued items in range (by generate_at or fixture_date)
  const queued = await TitleQueue.find({
    tenant_id: req.params.tenantId,
    $or: [
      { generate_at: { $gte: fromDate, $lte: toDate } },
      { fixture_date: { $gte: fromDate, $lte: toDate } },
      { publish_at:   { $gte: fromDate, $lte: toDate } },
    ]
  });

  // Posts in range (by publish_at or published_at or created_at)
  const posts = await Post.find({
    tenant_id: req.params.tenantId,
    $or: [
      { publish_at:   { $gte: fromDate, $lte: toDate } },
      { published_at: { $gte: fromDate, $lte: toDate } },
    ]
  }).select('title slug status article_format content_type fixture_date fixture_label publish_at published_at competition');

  res.json({ queued, posts });
});

// POST /calendar/:tenantId/schedule
// Add a new scheduled content item to the queue
router.post('/:tenantId/schedule', resolveTenant, async (req, res) => {
  const {
    title,
    content_type,
    persona,
    fixtures,
    fixture_date,
    fixture_label,
    competition,
    generate_at,
    publish_at,
    is_weekly_roundup,
  } = req.body;

  const item = await TitleQueue.create({
    tenant_id:       req.params.tenantId,
    title,
    content_type:    content_type ?? 'evergreen',
    persona:         persona ?? null,
    fixtures:        fixtures ?? [],
    fixture_date:    fixture_date ? new Date(fixture_date) : null,
    fixture_label:   fixture_label ?? null,
    competition:     competition ?? null,
    generate_at:     generate_at ? new Date(generate_at) : null,
    publish_at:      publish_at  ? new Date(publish_at)  : null,
    is_weekly_roundup: is_weekly_roundup ?? false,
    status:          'pending',
    priority:        1,
    created_at:      new Date(),
  });

  res.json({ item });
});

export default router;
```

Register in main router:

```typescript
// arclink/services/blog/src/index.ts
import calendarRoutes from './routes/calendar';
app.use('/calendar', calendarRoutes);
```

---

### 1.4 — Admin Calendar UI

#### Calendar View Component

```bash
# Generate in arclink admin
ng g component features/calendar/calendar --standalone
ng g component features/calendar/calendar-event-card --standalone
ng g component features/calendar/schedule-content-modal --standalone
```

```typescript
// arclink/admin/src/app/features/calendar/calendar.component.ts

@Component({
  selector: 'app-calendar',
  standalone: true,
  templateUrl: './calendar.component.html',
})
export class CalendarComponent implements OnInit {
  private calendarApi = inject(CalendarApiService);
  private tenantId = inject(TENANT_ID);

  currentMonth = signal(new Date());
  events = signal<CalendarEvent[]>([]);
  loading = signal(true);

  // Grid of weeks for the current month
  weeks = computed(() => this.buildWeekGrid(this.currentMonth()));

  ngOnInit() {
    this.loadMonth();
  }

  loadMonth() {
    this.loading.set(true);
    const start = startOfMonth(this.currentMonth());
    const end   = endOfMonth(this.currentMonth());

    this.calendarApi.getCalendar(this.tenantId, start, end).subscribe(data => {
      this.events.set(this.mapToEvents(data));
      this.loading.set(false);
    });
  }

  prevMonth() {
    this.currentMonth.update(d => subMonths(d, 1));
    this.loadMonth();
  }

  nextMonth() {
    this.currentMonth.update(d => addMonths(d, 1));
    this.loadMonth();
  }

  eventsForDay(date: Date): CalendarEvent[] {
    return this.events().filter(e =>
      isSameDay(e.date, date)
    );
  }

  openScheduleModal(date?: Date) {
    // Open ScheduleContentModal with pre-filled date
  }

  private mapToEvents(data: { queued: any[]; posts: any[] }): CalendarEvent[] {
    const queued = data.queued.map(q => ({
      id:           q._id,
      title:        q.title,
      date:         new Date(q.fixture_date || q.generate_at || q.publish_at),
      type:         'queued' as const,
      contentType:  q.content_type,
      status:       q.status,
      competition:  q.competition,
      persona:      q.persona,
      generateAt:   q.generate_at ? new Date(q.generate_at) : null,
      publishAt:    q.publish_at  ? new Date(q.publish_at)  : null,
    }));

    const posts = data.posts.map(p => ({
      id:           p._id,
      title:        p.title,
      date:         new Date(p.publish_at || p.published_at),
      type:         'post' as const,
      contentType:  p.content_type,
      status:       p.status,
      competition:  p.competition,
      slug:         p.slug,
    }));

    return [...queued, ...posts];
  }

  private buildWeekGrid(month: Date): Date[][] {
    // Returns array of weeks, each week is array of 7 dates
    // Standard calendar grid implementation
    const start = startOfWeek(startOfMonth(month));
    const end   = endOfWeek(endOfMonth(month));
    const weeks: Date[][] = [];
    let current = start;
    while (current <= end) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(current);
        current = addDays(current, 1);
      }
      weeks.push(week);
    }
    return weeks;
  }
}
```

```html
<!-- calendar.component.html -->

<div class="calendar-page">

  <!-- Header -->
  <div class="calendar-header">
    <div class="calendar-nav">
      <button (click)="prevMonth()">‹</button>
      <h2>{{ currentMonth() | date:'MMMM yyyy' }}</h2>
      <button (click)="nextMonth()">›</button>
    </div>
    <button class="btn-schedule" (click)="openScheduleModal()">
      + Schedule content
    </button>
  </div>

  <!-- Legend -->
  <div class="calendar-legend">
    <span class="legend-item roundup">Weekly Roundup</span>
    <span class="legend-item preview">Match Preview</span>
    <span class="legend-item season">Season Preview</span>
    <span class="legend-item evergreen">Evergreen</span>
    <span class="legend-item scheduled">Scheduled</span>
    <span class="legend-item published">Published</span>
  </div>

  <!-- Calendar grid -->
  <div class="calendar-grid">

    <!-- Day headers -->
    <div class="day-header" *ngFor="let day of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']">
      {{ day }}
    </div>

    <!-- Weeks -->
    @for (week of weeks(); track $index) {
      @for (day of week; track day.toISOString()) {
        <div class="calendar-day"
             [class.today]="isToday(day)"
             [class.other-month]="!isSameMonth(day, currentMonth())"
             (click)="openScheduleModal(day)">

          <span class="day-number">{{ day | date:'d' }}</span>

          <!-- Events for this day -->
          @for (event of eventsForDay(day); track event.id) {
            <app-calendar-event-card
              [event]="event"
              (click)="$event.stopPropagation()" />
          }

        </div>
      }
    }
  </div>

</div>
```

#### Calendar Event Card

```html
<!-- calendar-event-card.component.html -->

<div class="event-card"
     [class]="event.contentType"
     [class.status-queued]="event.type === 'queued'"
     [class.status-scheduled]="event.status === 'scheduled'"
     [class.status-published]="event.status === 'published'"
     [class.status-failed]="event.status === 'failed'"
     [title]="event.title">

  <div class="event-meta">
    <span class="event-type-badge">{{ contentTypeLabel(event.contentType) }}</span>
    @if (event.competition) {
      <span class="event-competition">{{ event.competition }}</span>
    }
  </div>

  <div class="event-title">{{ event.title | slice:0:45 }}{{ event.title.length > 45 ? '...' : '' }}</div>

  <div class="event-footer">
    @if (event.persona) {
      <span class="event-persona">{{ event.persona }}</span>
    }
    <span class="event-status-dot" [class]="event.status"></span>
  </div>

</div>
```

#### Schedule Content Modal

```html
<!-- schedule-content-modal.component.html -->

<div class="modal-overlay" (click)="close()">
  <div class="modal" (click)="$event.stopPropagation()">

    <div class="modal-header">
      <h3>Schedule Content</h3>
      <button (click)="close()">✕</button>
    </div>

    <div class="modal-body">

      <!-- Content type -->
      <label>Content Type</label>
      <select [(ngModel)]="form.content_type" (change)="onContentTypeChange()">
        <option value="match-preview">Match Preview</option>
        <option value="season-preview">Season Preview</option>
        <option value="evergreen">Evergreen Guide</option>
        <option value="bookmaker-review">Bookmaker Review</option>
        <option value="tournament-window">Tournament Preview</option>
        <option value="post-match">Post-Match Analysis</option>
      </select>

      <!-- Competition -->
      <label>Competition</label>
      <select [(ngModel)]="form.competition">
        @for (comp of tenant.competitions; track comp.key) {
          <option [value]="comp.label">{{ comp.label }}</option>
        }
      </select>

      <!-- Title -->
      <label>Title</label>
      <input [(ngModel)]="form.title"
             placeholder="e.g. Bulls vs Sharks: Set Piece Battle Preview" />

      <!-- Persona -->
      <label>Persona</label>
      <select [(ngModel)]="form.persona">
        <option value="">Auto (alternate)</option>
        @for (p of tenantPersonas; track p.key) {
          <option [value]="p.key">{{ p.name }}</option>
        }
      </select>

      <!-- Fixture details (for match previews) -->
      @if (form.content_type === 'match-preview') {
        <label>Fixture Date & Time (SAST)</label>
        <input type="datetime-local" [(ngModel)]="form.fixture_date" />

        <label>Fixture Label</label>
        <input [(ngModel)]="form.fixture_label"
               placeholder="Bulls vs Sharks · Loftus · Sat 17:00" />
      }

      <!-- Generate at -->
      <label>Generate At</label>
      <input type="datetime-local" [(ngModel)]="form.generate_at" />
      <span class="hint">
        @if (form.content_type === 'match-preview') {
          Recommended: 48 hours before fixture
        } @else {
          Leave blank to generate immediately
        }
      </span>

      <!-- Publish at -->
      <label>Publish At</label>
      <input type="datetime-local" [(ngModel)]="form.publish_at" />
      <span class="hint">
        @if (form.content_type === 'match-preview') {
          Recommended: morning of match day (08:00 SAST)
        } @else {
          Leave blank to save as draft
        }
      </span>

    </div>

    <div class="modal-footer">
      <button (click)="close()">Cancel</button>
      <button class="btn-primary" (click)="schedule()">
        Schedule
      </button>
    </div>

  </div>
</div>
```

```typescript
// schedule-content-modal.component.ts — key logic

schedule() {
  // Auto-fill smart defaults based on content type
  const payload = {
    ...this.form,
    fixture_date: this.form.fixture_date
      ? new Date(this.form.fixture_date).toISOString()
      : null,
    generate_at: this.form.generate_at
      ? new Date(this.form.generate_at).toISOString()
      : this.getSmartGenerateAt(),
    publish_at: this.form.publish_at
      ? new Date(this.form.publish_at).toISOString()
      : this.getSmartPublishAt(),
  };

  this.calendarApi.scheduleContent(this.tenantId, payload).subscribe(() => {
    this.onScheduled.emit();
    this.close();
  });
}

private getSmartGenerateAt(): string | null {
  // For match previews: 48h before fixture
  if (this.form.content_type === 'match-preview' && this.form.fixture_date) {
    const fixture = new Date(this.form.fixture_date);
    return new Date(fixture.getTime() - 48 * 3600000).toISOString();
  }
  // For evergreen: generate now
  return new Date().toISOString();
}

private getSmartPublishAt(): string | null {
  // For match previews: 08:00 SAST on match day
  if (this.form.content_type === 'match-preview' && this.form.fixture_date) {
    const fixture = new Date(this.form.fixture_date);
    fixture.setHours(6, 0, 0, 0); // 08:00 SAST = 06:00 UTC
    return fixture.toISOString();
  }
  // For season previews: on the date set
  return null;
}
```

#### Add Calendar Route to Admin

```typescript
// arclink/admin/src/app/app.routes.ts — add:
{ path: 'calendar', component: CalendarComponent },

// Sidebar nav — add:
{ label: 'Calendar', path: '/calendar', icon: 'calendar' }
```

---

## Phase 2 — Fixture-Aware Content Suggestions

### What Phase 2 Adds

When sportdb returns new fixtures for a tenant's sport, the calendar automatically
suggests content pieces with pre-filled titles, personas, formats, and
generate/publish times. The editor reviews suggestions and approves, modifies,
or dismisses them. Nothing is added to the queue without editor approval.

---

### 2.1 — Content Suggestion Engine

```typescript
// arclink/services/blog/src/services/content-suggester.ts

import { IBlogTenant } from '../models/BlogTenant';
import { IQueueItem } from '../models/TitleQueue';
import { ApiSportsFixture } from './sportdb';

export interface ContentSuggestion {
  title:         string;
  content_type:  string;
  persona:       string | null;
  fixture_date:  Date | null;
  fixture_label: string | null;
  competition:   string;
  generate_at:   Date;
  publish_at:    Date;
  reason:        string;  // why this was suggested — shown in admin UI
}

export function suggestContentForFixtures(
  tenant: IBlogTenant,
  fixtures: ApiSportsFixture[]
): ContentSuggestion[] {
  const suggestions: ContentSuggestion[] = [];
  const personas = Array.from(tenant.blog_persona_prompts?.keys() ?? []);
  const [persona1, persona2] = personas;

  for (const fixture of fixtures) {
    const kickoff = new Date(fixture.kickoff);
    const home = fixture.homeTeam;
    const away = fixture.awayTeam;

    // Match preview — 48h before, published match morning 08:00 SAST
    const generateAt = new Date(kickoff.getTime() - 48 * 3600000);
    const publishAt  = new Date(kickoff);
    publishAt.setHours(6, 0, 0, 0); // 08:00 SAST

    suggestions.push({
      title:        `${home} vs ${away}: ${getPreviewAngle(fixture, persona1)}`,
      content_type: 'match-preview',
      persona:      persona1 ?? null,
      fixture_date: kickoff,
      fixture_label: fixture.matchLabel,
      competition:  fixture.competition,
      generate_at:  generateAt,
      publish_at:   publishAt,
      reason:       `Fixture detected: ${fixture.matchLabel}`,
    });

    // For SA derbies — suggest a dialogue format preview
    if (isSADerby(fixture)) {
      suggestions.push({
        title:        `${home} vs ${away} — ${persona1} and ${persona2} Disagree`,
        content_type: 'match-preview',
        persona:      null,  // both personas
        fixture_date: kickoff,
        fixture_label: fixture.matchLabel,
        competition:  fixture.competition,
        generate_at:  generateAt,
        publish_at:   publishAt,
        reason:       `SA derby detected — dialogue format recommended`,
      });
    }
  }

  return suggestions;
}

function getPreviewAngle(fixture: ApiSportsFixture, persona: string): string {
  // Returns a compelling angle for the title based on persona
  const angles: Record<string, string[]> = {
    kwagga: ['Set Piece Preview', 'Conditions Analysis', 'The Scrum Battle'],
    marcus: ['Market Analysis', 'Defensive Structure Preview', 'Finding the Value'],
    lucky:  ['PSL Preview', 'The Home Advantage', 'Domestic Form Analysis'],
    callum: ['Tactical Preview', 'European Lens', 'Market Inefficiency'],
    deon:   ['Pitch and Conditions', 'The Bowling Matchup', 'Ground Analysis'],
    priya:  ['Data Preview', 'Market Analysis', 'Statistical Edge'],
  };
  const personaAngles = angles[persona] ?? ['Preview'];
  return personaAngles[Math.floor(Math.random() * personaAngles.length)];
}

function isSADerby(fixture: ApiSportsFixture): boolean {
  const SA_DERBIES = [
    ['Bulls', 'Lions'], ['Bulls', 'Sharks'], ['Bulls', 'Stormers'],
    ['Stormers', 'Sharks'], ['Lions', 'Sharks'],
    ['Pirates', 'Chiefs'], ['Sundowns', 'Pirates'],
  ];
  return SA_DERBIES.some(([a, b]) =>
    (fixture.homeTeam.includes(a) && fixture.awayTeam.includes(b)) ||
    (fixture.homeTeam.includes(b) && fixture.awayTeam.includes(a))
  );
}
```

### 2.2 — New Model: ContentSuggestion

Suggestions are stored temporarily — the editor sees them in a dedicated
inbox in the admin and approves or dismisses them. Approved suggestions
become TitleQueue items.

```typescript
// arclink/services/blog/src/models/ContentSuggestion.ts

export interface IContentSuggestion {
  id:            string;
  tenant_id:     string;
  title:         string;
  content_type:  string;
  persona:       string | null;
  fixture_date:  Date | null;
  fixture_label: string | null;
  competition:   string;
  generate_at:   Date;
  publish_at:    Date;
  reason:        string;
  status:        'pending' | 'approved' | 'dismissed';
  created_at:    Date;
}

// Schema — simple, short-lived collection
const ContentSuggestionSchema = new Schema({
  id:           { type: String, required: true },
  tenant_id:    { type: String, required: true },
  title:        { type: String, required: true },
  content_type: { type: String, required: true },
  persona:      { type: String, default: null },
  fixture_date: { type: Date,   default: null },
  fixture_label:{ type: String, default: null },
  competition:  { type: String, default: null },
  generate_at:  { type: Date,   required: true },
  publish_at:   { type: Date,   required: true },
  reason:       { type: String, default: '' },
  status:       { type: String, enum: ['pending','approved','dismissed'], default: 'pending' },
  created_at:   { type: Date,   default: Date.now },
});
```

### 2.3 — Fixture Detection Scheduler

Runs every Wednesday 06:00 SAST — after Tuesday's roundup has run.
Fetches next 14 days of fixtures and generates content suggestions.

```typescript
// arclink/services/blog/src/scheduler-suggestions.ts

import cron from 'node-cron';
import { BlogTenant } from './models/BlogTenant';
import { ContentSuggestion } from './models/ContentSuggestion';
import { TitleQueue } from './models/TitleQueue';
import { fetchUpcomingFixtures } from './services/sportdb';
import { suggestContentForFixtures } from './services/content-suggester';
import { randomUUID } from 'crypto';

// Wednesday 06:00 SAST = Wednesday 04:00 UTC
cron.schedule('0 4 * * 3', async () => {
  console.log('[Suggestion Scheduler] Generating content suggestions...');

  const tenants = await BlogTenant.find({
    active: true,
    sport_key: { $exists: true, $ne: '' }
  });

  for (const tenant of tenants) {
    try {
      // Fetch next 14 days — wider window for forward planning
      const fixtures = await fetchUpcomingFixtures(tenant.sport_key, 14);

      // Generate suggestions
      const suggestions = suggestContentForFixtures(tenant, fixtures);

      // Check which fixtures already have content queued or published
      // to avoid duplicate suggestions
      const existingLabels = await TitleQueue.distinct('fixture_label', {
        tenant_id: tenant.id,
        fixture_label: { $ne: null },
      });

      const newSuggestions = suggestions.filter(s =>
        !existingLabels.includes(s.fixture_label)
      );

      if (newSuggestions.length === 0) {
        console.log(`[Suggestion Scheduler] No new suggestions for ${tenant.name}`);
        continue;
      }

      // Store as pending suggestions
      await ContentSuggestion.insertMany(
        newSuggestions.map(s => ({
          id: randomUUID(),
          tenant_id: tenant.id,
          ...s,
          status: 'pending',
          created_at: new Date(),
        }))
      );

      console.log(
        `[Suggestion Scheduler] ${newSuggestions.length} suggestions for ${tenant.name}`
      );

    } catch (err) {
      console.error(`[Suggestion Scheduler] Failed for ${tenant.name}:`, err);
    }
  }
});
```

### 2.4 — Suggestions Routes

```typescript
// arclink/services/blog/src/routes/suggestions.ts

// GET /suggestions/:tenantId — pending suggestions inbox
router.get('/:tenantId', resolveTenant, async (req, res) => {
  const suggestions = await ContentSuggestion.find({
    tenant_id: req.params.tenantId,
    status: 'pending',
  }).sort({ generate_at: 1 });

  res.json({ suggestions });
});

// POST /suggestions/:tenantId/:suggestionId/approve
// Approves a suggestion and creates a TitleQueue item from it
router.post('/:tenantId/:id/approve', resolveTenant, async (req, res) => {
  const suggestion = await ContentSuggestion.findOne({
    id: req.params.id,
    tenant_id: req.params.tenantId,
  });

  if (!suggestion) return res.status(404).json({ error: 'Not found' });

  // Optional overrides from editor
  const overrides = req.body;

  await TitleQueue.create({
    tenant_id:     suggestion.tenant_id,
    title:         overrides.title         ?? suggestion.title,
    content_type:  overrides.content_type  ?? suggestion.content_type,
    persona:       overrides.persona       ?? suggestion.persona,
    fixture_date:  overrides.fixture_date  ?? suggestion.fixture_date,
    fixture_label: overrides.fixture_label ?? suggestion.fixture_label,
    competition:   overrides.competition   ?? suggestion.competition,
    generate_at:   overrides.generate_at   ?? suggestion.generate_at,
    publish_at:    overrides.publish_at    ?? suggestion.publish_at,
    status:        'pending',
    priority:      1,
    created_at:    new Date(),
  });

  await suggestion.updateOne({ status: 'approved' });
  res.json({ ok: true });
});

// POST /suggestions/:tenantId/:suggestionId/dismiss
router.post('/:tenantId/:id/dismiss', resolveTenant, async (req, res) => {
  await ContentSuggestion.updateOne(
    { id: req.params.id, tenant_id: req.params.tenantId },
    { status: 'dismissed' }
  );
  res.json({ ok: true });
});
```

### 2.5 — Suggestions Inbox in Admin

A dedicated inbox view showing pending suggestions. The editor reviews each
one, edits the title or dates if needed, and approves or dismisses.

```html
<!-- suggestions-inbox.component.html -->

<div class="suggestions-page">
  <h1>Content Suggestions</h1>
  <p class="subtitle">
    Generated from upcoming fixtures. Review, edit if needed, then approve to schedule.
  </p>

  @if (suggestions().length === 0) {
    <div class="empty-state">
      No pending suggestions. Check back after Wednesday's fixture scan.
    </div>
  }

  @for (s of suggestions(); track s.id) {
    <div class="suggestion-card">

      <div class="suggestion-meta">
        <span class="competition-badge">{{ s.competition }}</span>
        <span class="content-type-badge">{{ s.content_type }}</span>
        @if (s.persona) {
          <span class="persona-badge">{{ s.persona }}</span>
        }
        <span class="reason">{{ s.reason }}</span>
      </div>

      <div class="suggestion-title">
        <input [(ngModel)]="s.title" class="title-edit" />
      </div>

      <div class="suggestion-dates">
        <div>
          <label>Generate at</label>
          <input type="datetime-local" [(ngModel)]="s.generate_at" />
        </div>
        <div>
          <label>Publish at</label>
          <input type="datetime-local" [(ngModel)]="s.publish_at" />
        </div>
        @if (s.fixture_date) {
          <div class="fixture-ref">
            📅 Fixture: {{ s.fixture_label }}
          </div>
        }
      </div>

      <div class="suggestion-actions">
        <button class="btn-dismiss" (click)="dismiss(s.id)">Dismiss</button>
        <button class="btn-approve" (click)="approve(s)">
          ✓ Approve & Schedule
        </button>
      </div>

    </div>
  }

</div>
```

---

## Build Order

### Phase 1

```
Step 1   Add content_type, generate_at, publish_at, fixture_date,
         fixture_label, competition, status fields to TitleQueue model
Step 2   Add publish_at, scheduled fields + 'scheduled' status to Post model
Step 3   Create scheduler-generation.ts (hourly, checks generate_at)
Step 4   Create scheduler-publishing.ts (hourly, checks publish_at)
Step 5   Register both schedulers in index.ts
Step 6   Create calendar.ts route (GET /calendar/:tenantId, POST /calendar/:tenantId/schedule)
Step 7   Register calendar route in main router
Step 8   Generate CalendarComponent in arclink admin
Step 9   Generate CalendarEventCardComponent
Step 10  Generate ScheduleContentModal
Step 11  Add calendar route to admin app.routes.ts
Step 12  Add Calendar link to admin sidebar
Step 13  Test: schedule a piece for 1 hour ahead — verify it generates
Step 14  Test: set publish_at — verify it auto-publishes at correct time
Step 15  Test: calendar view shows queued and published items on correct dates
```

### Phase 2

```
Step 16  Create ContentSuggestion model
Step 17  Create content-suggester.ts service
Step 18  Create scheduler-suggestions.ts (Wednesday 04:00 UTC)
Step 19  Register suggestions scheduler in index.ts
Step 20  Create suggestions.ts routes (GET, approve, dismiss)
Step 21  Register suggestions routes
Step 22  Generate SuggestionsInboxComponent in admin
Step 23  Add Suggestions Inbox link to admin sidebar with unread count badge
Step 24  Test: run scheduler manually — verify suggestions appear in inbox
Step 25  Test: approve a suggestion — verify TitleQueue item created
Step 26  Test: verify approved item generates and publishes on schedule
Step 27  Test: dismissed suggestions do not reappear
```

---

## Test Checklist

### Phase 1
```
□ Queue item with generate_at in the past generates immediately on next hourly run
□ Queue item with future generate_at waits correctly
□ Post with publish_at auto-publishes at correct time
□ Calendar view shows all queued and published items for the month
□ Schedule modal pre-fills smart generate_at/publish_at based on content type
□ Match preview default: generate 48h before fixture, publish 08:00 match day
□ Evergreen default: generate immediately, no scheduled publish
□ Navigation between months loads correct events
□ Event cards show correct colour per content type and status
```

### Phase 2
```
□ Wednesday scheduler runs and produces suggestions
□ Suggestions appear in admin inbox with correct fixture metadata
□ Editor can edit title and dates before approving
□ Approved suggestion creates TitleQueue item with correct fields
□ Dismissed suggestions are removed from inbox
□ Already-queued fixtures do not produce duplicate suggestions
□ SA derbies produce a dialogue-format suggestion alongside single-persona
□ Inbox shows unread count in sidebar nav badge
```

---

## Summary of New Files

```
NEW — arclink blog service
  models/ContentSuggestion.ts
  routes/calendar.ts
  routes/suggestions.ts
  services/content-suggester.ts
  scheduler-generation.ts
  scheduler-publishing.ts
  scheduler-suggestions.ts

UPDATED — arclink blog service
  models/TitleQueue.ts    (new scheduling fields)
  models/Post.ts          (publish_at, scheduled, status: 'scheduled')
  index.ts                (register 3 new schedulers + 2 new routes)

NEW — arclink admin
  features/calendar/calendar.component.ts/html
  features/calendar/calendar-event-card.component.ts/html
  features/calendar/schedule-content-modal.component.ts/html
  features/suggestions/suggestions-inbox.component.ts/html

UPDATED — arclink admin
  app.routes.ts           (calendar + suggestions routes)
  sidebar navigation      (Calendar + Suggestions links)
```
