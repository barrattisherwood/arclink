# SA Football Bets — Bug Fix Guide
## safootballbets.co.za
## Two issues: past fixtures showing, all competition pages showing same content

---

## Overview

Two separate bugs identified from the live site screenshot dated 11–16 April 2026:

1. **Fixture filter broken** — past fixtures appearing in "Upcoming fixtures" section
2. **Competition pages all show same content** — `/epl`, `/ucl`, `/afcon`, `/international` all render identical analysis

Fix these in order — fixture bug first, competition pages second.

---

## Bug 1 — Past Fixtures Appearing

### Root Cause

The `isUpcoming()` function in `sportdb.ts` is either:
- Using the wrong field name for the kickoff date
- Not filtering `kickoff > now` correctly
- Not being called at all in the fixture pipeline

### Step 1 — Inspect The Raw Response

Run this before touching any code. The date field name in the sportdb
response determines everything else:

```bash
# PSL fixtures
curl -s -H "X-API-Key: jBF4QQRf4zQqJioackM8xbw0YDE9xaiXJCQx8OnP" \
  "https://api.sportdb.dev/api/flashscore/football/south-africa:175/betway-premiership:WYFXQ1KH" \
  > /tmp/psl-fixtures.json && node -e "
const d = require('/tmp/psl-fixtures.json');
if (!d || !d.length) { console.log('Empty or unexpected:', JSON.stringify(d)); process.exit(); }
console.log('Keys on first item:', Object.keys(d[0]));
console.log('First item full:', JSON.stringify(d[0], null, 2));
console.log('Second item full:', JSON.stringify(d[1], null, 2));
"
```

Paste the output. The date field will be one of:
`startTime`, `kickoff`, `date`, `time`, `startDate`, `scheduledAt`

### Step 2 — Fix isUpcoming() in sportdb.ts

Once you know the actual field name from Step 1, update `isUpcoming()`:

```typescript
// arclink/services/blog/src/services/sportdb.ts

function isUpcoming(fixture: any, daysAhead: number): boolean {
  // Try all known field names — update based on Step 1 output
  const kickoffField =
    fixture.startTime    ??
    fixture.kickoff      ??
    fixture.date         ??
    fixture.time         ??
    fixture.startDate    ??
    fixture.scheduledAt  ??
    null;

  if (!kickoffField) {
    console.warn('[SportDB] No date field found on fixture:', Object.keys(fixture));
    return false;
  }

  const kickoff = new Date(kickoffField);

  // Validate — reject invalid dates
  if (isNaN(kickoff.getTime())) {
    console.warn('[SportDB] Invalid date value:', kickoffField);
    return false;
  }

  const now = new Date();
  const cutoff = new Date(Date.now() + daysAhead * 86400000);

  // Must be STRICTLY in the future and within the daysAhead window
  return kickoff > now && kickoff < cutoff;
}
```

### Step 3 — Fix mapFixture() in sportdb.ts

The same date field issue affects `mapFixture()` — the kickoff stored
on the fixture object must use the correct field name:

```typescript
function mapFixture(f: any, competitionName: string): SportDbFixture {
  // Use same field resolution as isUpcoming()
  const kickoffRaw =
    f.startTime ?? f.kickoff ?? f.date ?? f.time ?? f.startDate ?? '';

  const home = f.homeTeam?.name ?? f.home ?? f.homeTeam ?? 'TBC';
  const away = f.awayTeam?.name ?? f.away ?? f.awayTeam ?? 'TBC';
  const venue = f.venue?.name ?? f.stadium ?? f.venue ?? 'TBC';

  return {
    id:           f.id?.toString() ?? '',
    homeTeam:     home,
    awayTeam:     away,
    competition:  competitionName,
    venue:        venue,
    kickoff:      kickoffRaw,
    matchLabel:   buildMatchLabel(f, home, away, venue),
  };
}

function buildMatchLabel(f: any, home: string, away: string, venue: string): string {
  const kickoffRaw = f.startTime ?? f.kickoff ?? f.date ?? f.time ?? '';
  if (!kickoffRaw) return `${home} vs ${away}`;

  const kickoff = new Date(kickoffRaw);
  if (isNaN(kickoff.getTime())) return `${home} vs ${away}`;

  const day = kickoff.toLocaleDateString('en-ZA', {
    weekday: 'short',
    timeZone: 'Africa/Johannesburg'
  });
  const time = kickoff.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg'
  });

  return `${home} vs ${away} · ${venue} · ${day} ${time}`;
}
```

### Step 4 — Add Debug Logging Temporarily

Add this temporarily to `fetchUpcomingFixtures()` to confirm
the filter is working after your fix:

```typescript
export async function fetchUpcomingFixtures(
  sport: string,
  daysAhead: number
): Promise<SportDbFixture[]> {
  // ...existing fetch logic...

  const allFixtures = (data.response ?? data ?? []);
  const upcoming = allFixtures.filter((f: any) => isUpcoming(f, daysAhead));

  console.log(`[SportDB] ${sport}: ${allFixtures.length} total, ${upcoming.length} upcoming`);

  return upcoming.map((f: any) => mapFixture(f, competitionName));
}
```

If `upcoming` is 0 when fixtures exist, the date field name is still wrong.
If `upcoming` is correct, remove the console.log before deploying.

### Step 5 — Verify on the Frontend

After deploying the arclink fix, trigger a fresh fixture fetch:

```bash
# Call the generate-roundup endpoint to refresh fixture data
curl -X POST \
  -H "X-API-Key: YOUR_ARCLINK_API_KEY" \
  "https://your-arclink-url/posts/YOUR_TENANT_ID/generate-roundup"
```

Check the frontend — all fixture cards should now show future dates only.

---

## Bug 2 — All Competition Pages Show Same Content

### Root Cause

The section components (`EplSectionComponent`, `UclSectionComponent`,
`AfconSectionComponent`, `InternationalSectionComponent`) are all calling
`getArticles()` or `getFeaturedPost()` without passing a competition or
tag filter. They receive all posts for the tenant and display them all.

### Step 1 — Update ArclinkBlogService

Add tag and competition filter support to `getArticles()`:

```typescript
// libs/data-access/arclink/src/lib/arclink-blog.service.ts

getArticles(filters?: { tag?: string; competition?: string; limit?: number }) {
  const params: Record<string, string> = {};
  if (filters?.tag)         params['tag']         = filters.tag;
  if (filters?.competition) params['competition'] = filters.competition;
  if (filters?.limit)       params['limit']       = filters.limit.toString();

  const key = makeStateKey<Article[]>(
    `articles_${this.config.arclinkBlogTenantId}_${JSON.stringify(filters)}`
  );
  const cached = this.ts.get(key, null);
  if (cached) return of(cached);

  return this.http
    .get<{ posts: any[] }>(
      `${BASE}/posts/${this.config.arclinkBlogTenantId}`,
      { headers: this.headers, params }
    )
    .pipe(
      map(r => (r.posts ?? []).map(p => this.mapToArticle(p))),
      tap(data => this.ts.set(key, data))
    );
}
```

### Step 2 — Update the arclink blog posts route

The backend needs to accept and apply the tag filter:

```typescript
// arclink/services/blog/src/routes/posts.ts

// GET /posts/:tenantId
router.get('/:tenantId', resolveTenant, async (req, res) => {
  const { tag, competition, limit, status } = req.query as Record<string, string>;

  const query: Record<string, any> = {
    tenant_id: req.params.tenantId,
    status: status ?? 'published',
  };

  // Apply tag filter if provided
  if (tag) {
    query.tags = { $in: [tag] };
  }

  // Apply competition filter if provided
  if (competition) {
    query.competition = competition;
  }

  const posts = await Post
    .find(query)
    .sort({ published_at: -1 })
    .limit(limit ? parseInt(limit) : 20);

  res.json({ posts });
});
```

### Step 3 — Update Each Section Component

Each competition page must pass its own tag when fetching articles.

```typescript
// apps/football/src/app/pages/epl/epl-section.component.ts
export class EplSectionComponent implements OnInit {
  private blog = inject(ArclinkBlogService);
  articles = signal<Article[]>([]);
  loading  = signal(true);

  ngOnInit() {
    this.blog.getArticles({ tag: 'epl', limit: 12 }).subscribe({
      next: a => { this.articles.set(a); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
```

```typescript
// apps/football/src/app/pages/ucl/ucl-section.component.ts
ngOnInit() {
  this.blog.getArticles({ tag: 'ucl', limit: 12 }).subscribe({
    next: a => { this.articles.set(a); this.loading.set(false); },
    error: () => this.loading.set(false),
  });
}
```

```typescript
// apps/football/src/app/pages/afcon/afcon-section.component.ts
ngOnInit() {
  this.blog.getArticles({ tag: 'afcon', limit: 12 }).subscribe({
    next: a => { this.articles.set(a); this.loading.set(false); },
    error: () => this.loading.set(false),
  });
}
```

```typescript
// apps/football/src/app/pages/international/international-section.component.ts
ngOnInit() {
  this.blog.getArticles({ tag: 'bafana', limit: 12 }).subscribe({
    next: a => { this.articles.set(a); this.loading.set(false); },
    error: () => this.loading.set(false),
  });
}
```

```typescript
// apps/football/src/app/pages/psl/psl-section.component.ts
// PSL already works — but confirm it is also tag-filtered:
ngOnInit() {
  this.blog.getArticles({ tag: 'psl', limit: 12 }).subscribe({
    next: a => { this.articles.set(a); this.loading.set(false); },
    error: () => this.loading.set(false),
  });
}
```

### Step 4 — Add Empty State to Each Section

Right now there is no content tagged `epl`, `ucl`, `afcon`, or `bafana`
because those articles haven't been generated yet. Each section must
handle the empty state gracefully:

```html
<!-- Shared empty state — add to each section component template -->
@if (loading()) {
  <div class="skeleton-grid">
    <div class="skeleton-card" *ngFor="let i of [1,2,3]"></div>
  </div>
}

@else if (articles().length === 0) {
  <div class="empty-state">
    <h3>Analysis coming soon</h3>
    <p>
      Lucky and Callum cover {{ competitionLabel }} every matchweek.
      Check back Friday morning for this week's preview.
    </p>
  </div>
}

@else {
  <div class="article-grid">
    @for (article of articles(); track article.slug) {
      <lib-article-card [article]="article" />
    }
  </div>
}
```

Add a `competitionLabel` input to each component so the empty state
message is specific:

```typescript
// In each section component:
competitionLabel = 'Premier League';    // change per section
// 'Champions League' / 'AFCON' / 'Bafana Bafana'
```

### Step 5 — Verify Tag Assignment on Generated Posts

For future content to appear on the correct section page, arclink
must tag posts correctly at generation time. Confirm the Claude
generation prompt includes the right tags in the JSON frontmatter:

```
// In buildRoundupMessage() — tags must match section filters

EPL content must include tag:    'epl'
UCL content must include tag:    'ucl'
AFCON content must include tag:  'afcon'
PSL content must include tag:    'psl'
Bafana content must include tag: 'bafana'

// In the seed script blog_predefined_tags array — confirm these exist:
blog_predefined_tags: [
  'psl', 'epl', 'ucl', 'afcon', 'bafana',
  'fixture-preview', 'odds-analysis', 'weekly-roundup',
  'lucky', 'callum',
],
```

---

## Build Order

```
Step 1  Run sportdb curl on PSL endpoint — identify actual date field name
Step 2  Update isUpcoming() in sportdb.ts with correct field name
Step 3  Update mapFixture() in sportdb.ts with correct field name
Step 4  Add debug logging — deploy and verify fixture counts in logs
Step 5  Confirm upcoming fixtures showing correct future dates on frontend
Step 6  Remove debug logging
Step 7  Update posts route in arclink — add tag and competition filter params
Step 8  Update getArticles() in ArclinkBlogService — add filters param
Step 9  Update EplSectionComponent — getArticles({ tag: 'epl' })
Step 10 Update UclSectionComponent — getArticles({ tag: 'ucl' })
Step 11 Update AfconSectionComponent — getArticles({ tag: 'afcon' })
Step 12 Update InternationalSectionComponent — getArticles({ tag: 'bafana' })
Step 13 Confirm PslSectionComponent is also tag-filtered ({ tag: 'psl' })
Step 14 Add empty state to each section component template
Step 15 Test: navigate to /epl — confirm empty state shows (no EPL content yet)
Step 16 Test: navigate to /psl — confirm PSL analysis shows correctly
Step 17 Generate one EPL article in arclink with tag 'epl' — confirm it appears on /epl only
Step 18 Confirm EPL article does NOT appear on /ucl or /psl
```

---

## Test Checklist

### Bug 1 — Fixtures
- [ ] No past dates in upcoming fixtures section
- [ ] All fixture cards show future kickoff times
- [ ] Fixture count in logs matches expected upcoming matches
- [ ] PSL, EPL, UCL fixtures all filtered correctly

### Bug 2 — Competition Pages
- [ ] `/psl` shows only PSL-tagged articles
- [ ] `/epl` shows empty state (no EPL content yet) or EPL-tagged articles
- [ ] `/ucl` shows empty state or UCL-tagged articles
- [ ] `/afcon` shows empty state or AFCON-tagged articles
- [ ] `/international` shows empty state or bafana-tagged articles
- [ ] Empty state message is competition-specific (not generic)
- [ ] An article tagged 'epl' appears on /epl and nowhere else
- [ ] Generating a weekly roundup with PSL fixtures tags posts correctly
