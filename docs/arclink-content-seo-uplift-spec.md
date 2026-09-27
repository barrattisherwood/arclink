# Arclink Spec: Content Quality & SEO Uplift — Betting Cluster

## Context

Four independent Angular/Node sites share arclink infrastructure and the odds-nx blog generation service:

| Site | Personas |
|------|----------|
| sarugbybets.co.za | kwagga + marcus |
| sacricketbets.co.za | deon + priya |
| safootballbets.co.za | lucky + callum |
| satennisbets.co.za | yolandi + damien |

This spec consolidates three categories of work:

1. **Blog generation service** — wire `content_type` through to word count, update persona hard rules
2. **Shared Angular component** — responsible gambling aside, injected into all article templates
3. **Site-specific tasks** — bookmaker review pages (cricket), evergreen guide expansion (tennis)

All changes in categories 1 and 2 affect every site. Category 3 is scoped per site.

---

## Part 1 — Blog Generation Service (`services/blog`)

### 1.1 Wire `content_type` through generation pipeline

**`services/blog/src/routes/generate.ts` — line 65**

Add `next.content_type` to the `generatePost` call:

```typescript
const result = await generatePost({
  title: next.title,
  fixtures: next.fixtures,
  additionalContext: next.additional_context,
  forceSinglePersona: next.force_single_persona,
  contentType: next.content_type, // previously absent — dead schema field
  tenant,
});
```

**`services/blog/src/services/claude.ts` — `generatePost` signature**

```typescript
interface GeneratePostParams {
  title: string;
  fixtures?: string;
  additionalContext?: string;
  forceSinglePersona?: boolean;
  contentType?: CalendarContentType; // add
  tenant: Tenant;
}
```

Derive `wordCount` before message builders:

```typescript
const wordCount = deriveWordCount(contentType, tenant.blog_word_count);
```

Replace the hardcoded `tenant.blog_word_count` reference in the user message string with `wordCount`.

**New pure function — extract and export for testability**

```typescript
export function deriveWordCount(
  contentType: CalendarContentType | undefined,
  tenantDefault: number
): number {
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
    case 'weekly-roundup':
    case 'article':
    default:
      return tenantDefault;
  }
}
```

**Dialogue builder — conditional block word counts**

The dialogue builder currently hardcodes `200-250 words per block`. Make conditional:

```typescript
const blockWordCount = (
  contentType === 'match-preview' || contentType === 'post-match'
) ? '150-180' : '200-250';
```

Inject `blockWordCount` into the message template string wherever the hardcoded range appears.

---

### 1.2 TDD — `deriveWordCount`

```typescript
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
```

---

### 1.3 Persona hard rules — `persona-registry.ts`

Add the following block to the `HARD RULES` section of **every persona** across all four sites (8 persona prompts total — both personas per site). Content is identical across all eight; only the sport-specific bookmaker context differs where noted.

```
HARD RULES:
- Word count is controlled externally by content_type. Do not override or pad to hit a target.
- Every article must include at least 4 H2 subheadings. Use them to structure argument, 
  not just label sections.
- Every article must include one contextual paragraph referencing SA-licensed bookmakers 
  (Hollywoodbets, Betway, 10bet) that cover this sport/market. This paragraph must read 
  as genuinely useful context, not a list. Link anchor text should be informational 
  ("SA bookmakers that cover this market") not promotional.
- Always include SA-specific context: Rand staking minimums, NLSA licensing, local 
  timezone considerations for live betting where relevant.
- End every article with this exact responsible gambling line as a standalone paragraph:
  "Gambling should be for entertainment only. Never bet more than you can afford to lose. 
  NLSA Helpline: 0800 006 008 (free, confidential, 24/7)."
- Never use imperative CTA language: do not write "bet now", "sign up", "claim", 
  "join today", "back", or "place a wager on".
- Describe bookmaker features and market availability factually. 
  Do not frame them as benefits the reader will experience.
- Bonus or offer references must be followed by "Subject to terms and conditions."
```

After edits: `POST /api/admin/sync-personas` to push all four sites. Verify via a test generation on each tenant before deploying to production.

---

## Part 2 — Shared Angular Component (`libs/shared` or equivalent arclink shared lib)

### 2.1 `ResponsibleGamblingComponent`

Create once in the arclink shared lib. Import into all four site article templates — not generated per-article by the LLM, rendered at the template level so it cannot be omitted.

**Component**

```typescript
// libs/shared/src/lib/responsible-gambling/
// responsible-gambling.component.ts

@Component({
  selector: 'app-responsible-gambling',
  templateUrl: './responsible-gambling.component.html',
  styleUrls: ['./responsible-gambling.component.scss'],
  standalone: true,
})
export class ResponsibleGamblingComponent {}
```

```html
<!-- responsible-gambling.component.html -->
<aside class="responsible-gambling" aria-label="Responsible gambling information">
  <h3>Bet Responsibly</h3>
  <p>
    Gambling should be for entertainment only. Never bet more than you can
    afford to lose. If you or someone you know needs support, free confidential
    help is available 24/7.
  </p>
  <ul>
    <li>NLSA Helpline: <a href="tel:0800006008">0800 006 008</a></li>
    <li>
      Self-exclusion: Contact your bookmaker directly to restrict or
      close your account.
    </li>
  </ul>
</aside>
```

**Inject into article templates on all four sites**

Add `<app-responsible-gambling />` at the bottom of:
- Each site's article/analysis detail component
- Each site's bookmaker review component (see Part 3)

### 2.2 TDD — `ResponsibleGamblingComponent`

```typescript
describe('ResponsibleGamblingComponent', () => {
  it('should render the aside with correct aria-label', () => {
    const aside = fixture.nativeElement
      .querySelector('[aria-label="Responsible gambling information"]');
    expect(aside).toBeTruthy();
  });
  it('should display NLSA helpline number', () => {
    expect(fixture.nativeElement.textContent).toContain('0800 006 008');
  });
  it('should include a tel: link', () => {
    const link = fixture.nativeElement.querySelector('a[href="tel:0800006008"]');
    expect(link).toBeTruthy();
  });
  it('should include self-exclusion text', () => {
    expect(fixture.nativeElement.textContent).toContain('Self-exclusion');
  });
});
```

---

## Part 3 — Site-Specific Tasks

### 3.1 sacricketbets.co.za — Bookmaker review pages

**New routes:**
- `/bookmakers/hollywoodbets`
- `/bookmakers/betway`
- `/bookmakers/10bet`

**New files:**

```
apps/cricket/src/app/pages/bookmakers/
  bookmaker-review/
    bookmaker-review.component.ts
    bookmaker-review.component.html
    bookmaker-review.component.scss
    bookmaker-review.component.spec.ts
  bookmaker-data/
    bookmaker.model.ts
    bookmakers.data.ts
```

**Data model (`bookmaker.model.ts`)**

```typescript
export interface BookmakerFeature {
  label: string;
  detail: string;
}

export interface BookmakerReview {
  slug: string;
  name: string;
  tagline: string;
  nlsaLicensed: boolean;
  established: number;
  cricketMarketsDepth: 'Basic' | 'Standard' | 'Deep';
  features: BookmakerFeature[];
  welcomeOffer: {
    description: string;
    termsUrl: string;
  } | null;
  minimumDepositRand: number;
  withdrawalTimeframe: string;
  platforms: string[];
  prosForCricket: string[];
  consForCricket: string[];
  affiliateUrl: string; // populate manually — do not guess
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
  };
}
```

**Component sections (in order):**

1. Breadcrumb — Home → Bookmakers → [Name]
2. Header — name, tagline, NLSA badge, established year, market depth indicator
3. Feature grid — 2-column, label + detail
4. Cricket markets section — factual prose, no promotional language
5. Practical info table — minimum deposit (Rand), withdrawal timeframe, platforms
6. Welcome offer block — if not null; must include T&C link and disclaimer
7. Pros and cons — cricket-focused, two columns
8. CTA block — see below
9. `<app-responsible-gambling />`

**CTA block**

```html
<div class="bookmaker-cta">
  <p class="cta-context">
    For full details on markets, odds, and account features, visit the
    {{ bookmaker.name }} website directly.
  </p>
  <a
    [href]="bookmaker.affiliateUrl"
    target="_blank"
    rel="noopener noreferrer sponsored"
    class="cta-link"
    [attr.aria-label]="'Visit ' + bookmaker.name + ' website'">
    Visit {{ bookmaker.name }}
  </a>
  <p class="cta-disclaimer">
    This is an affiliate link. SA Cricket Bets may earn a commission
    if you register. This does not affect our editorial review.
  </p>
</div>
```

**`/bookmakers` hub update**

Add `[routerLink]="['/bookmakers', bookmaker.slug]"` to each existing card. No layout changes.

**Internal linking**

Homepage, fixtures page, and article template each need one contextual link to `/bookmakers`:
> "For a comparison of licensed South African bookmakers that cover this fixture, see our [bookmakers guide](/bookmakers)."

**TDD**

```typescript
describe('BookmakerReviewComponent', () => {

  describe('Routing', () => {
    it('renders correct bookmaker by slug', () => {});
    it('redirects to /bookmakers on invalid slug', () => {});
    it('calls SeoService.updateMeta with correct canonical on init', () => {});
  });

  describe('Content', () => {
    it('displays bookmaker name in header', () => {});
    it('displays NLSA Licensed badge when nlsaLicensed is true', () => {});
    it('renders all feature items', () => {});
    it('renders practical info table with correct Rand deposit amount', () => {});
    it('renders welcome offer block when present', () => {});
    it('does not render welcome offer block when null', () => {});
    it('renders pros and cons lists', () => {});
  });

  describe('CTA compliance', () => {
    it('affiliate link has rel="noopener noreferrer sponsored"', () => {});
    it('renders affiliate disclosure text', () => {});
    it('does not contain "Bet now"', () => {});
    it('does not contain "Sign up"', () => {});
    it('does not contain "Join today"', () => {});
    it('does not contain "Claim"', () => {});
  });

  describe('Responsible gambling', () => {
    it('renders app-responsible-gambling component', () => {});
  });

  describe('Accessibility', () => {
    it('CTA link has aria-label', () => {});
    it('renders breadcrumb nav', () => {});
  });

});
```

---

### 3.2 satennisbets.co.za — Evergreen guide expansion

Expand 12 existing thin guides from ~582–755 words to 1,500+ words. Edit in place — do not change slugs or create new routes.

**Priority order:**

| Priority | Article | Current | Target |
|----------|---------|---------|--------|
| 1 | Wimbledon Betting Preview | 628 | 1,800+ |
| 2 | Roland Garros 2026 Preview | 603 | 1,800+ |
| 3 | Grass Court Betting Guide | 627 | 2,000+ |
| 4 | Clay Court Tennis Betting | 696 | 2,000+ |
| 5 | Clay Court Betting Guide (SA) | 622 | 2,000+ |
| 6 | ATP Masters 1000 Guide | 651 | 1,800+ |
| 7 | WTA Grand Slam Betting Guide | 590 | 1,800+ |
| 8 | US Open Preview 2026 | 620 | 1,800+ |
| 9 | Set Handicap Betting | 582 | 1,600+ |
| 10 | Total Games Betting | 603 | 1,600+ |
| 11 | Head-to-Head Records Guide | 630 | 1,600+ |
| 12 | Why Short-Odds Favourites Lose | 616 | 1,600+ |

**Required additions to each guide:**

1. **SA-specific context H2** — which bookmakers offer this market, Rand staking context, live betting timezone notes. Link to `/bookmakers`.
2. **Market breakdown H2** — expand from naming markets to explaining them with worked examples (fictional odds).
3. **At least 4 H2 headings total** — restructure existing content if needed.
4. **FAQ section** — 3–4 Q&A items targeting featured snippet opportunities.
5. **`<app-responsible-gambling />`** — injected at template level, not written into content.

**Evergreen reframe (items 1, 2, 7, 8)**

Wimbledon, Roland Garros, US Open, and WTA Grand Slam preview pages must be restructured as perennial guides. 2026-specific match predictions or draw references go into a clearly labelled "2026 Edition" H2 section; the rest of the article should be evergreen and remain accurate in future seasons.

**SeoService check**

Verify each guide has a distinct keyword-rich title, 140–160 char meta description, and self-referencing canonical. Add via SeoService where missing.

**Internal linking**

Each expanded guide must add:
- One link to `/bookmakers` or a specific bookmaker review page
- One cross-link to a related guide (surface guides link to each other; tournament previews link to weekly preview index)

**TDD additions per guide**

```typescript
describe('Evergreen guide — [ArticleName]', () => {
  it('renders at least 4 H2 headings', () => {
    const h2s = fixture.nativeElement.querySelectorAll('h2');
    expect(h2s.length).toBeGreaterThanOrEqual(4);
  });
  it('contains South Africa context', () => {
    expect(fixture.nativeElement.textContent).toContain('South Africa');
  });
  it('includes a link to /bookmakers', () => {
    const links = fixture.nativeElement.querySelectorAll('a[href*="bookmakers"]');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });
  it('renders app-responsible-gambling', () => {
    const el = fixture.nativeElement.querySelector('app-responsible-gambling');
    expect(el).toBeTruthy();
  });
  it('does not contain imperative CTA "Bet on"', () => {
    expect(fixture.nativeElement.innerHTML).not.toMatch(/>\s*Bet on\s/i);
  });
});
```

**Post-expansion**

Submit all 12 URLs for re-indexing via Search Console URL Inspection tool immediately after deploy.

---

## Build order

### Phase 1 — Generation service (no Angular changes)
1. Extract and export `deriveWordCount` as pure function
2. Write and pass unit tests
3. Wire `contentType` through `generate.ts` → `generatePost` → message builders
4. Make dialogue builder block lengths conditional on `contentType`
5. Verify existing integration tests pass
6. Deploy blog service

### Phase 2 — Persona hard rules
1. Edit all 8 persona prompts in `persona-registry.ts`
2. `POST /api/admin/sync-personas`
3. Run one test generation per tenant, verify hard rules are reflected in output

### Phase 3 — Shared component
1. Create `ResponsibleGamblingComponent` in shared lib
2. Write and pass component tests
3. Inject into article templates on all four sites
4. Deploy

### Phase 4 — Cricket bookmaker review pages
1. `bookmaker.model.ts` + `bookmakers.data.ts` (populate affiliate URLs manually)
2. `BookmakerReviewComponent` shell — routing and SeoService wired
3. Write all tests (expect failures)
4. Implement template sections until tests pass
5. Update `/bookmakers` hub with `routerLink`
6. Add internal links to homepage, fixtures, article template
7. Deploy + submit sitemap

### Phase 5 — Tennis evergreen expansion
1. Expand guides in priority order — Wimbledon and Roland Garros first (Wimbledon live now)
2. Add FAQ sections
3. Verify SeoService configuration on each
4. Run tests
5. Deploy + submit all 12 URLs for re-indexing via Search Console

---

## Definition of done

### Generation service
- [ ] `deriveWordCount` unit tests passing
- [ ] `content_type` flows from `TitleQueue` through to message builder word count
- [ ] Dialogue builder block lengths conditional on `contentType`
- [ ] Test generation on each tenant confirms correct word count target per content type

### Persona hard rules
- [ ] All 8 persona prompts updated in `persona-registry.ts`
- [ ] Sync confirmed via `POST /api/admin/sync-personas`
- [ ] Test generation output reflects hard rules on each site

### Shared component
- [ ] `ResponsibleGamblingComponent` tests passing
- [ ] Component injected into article templates on all four sites
- [ ] NLSA helpline number, tel: link, and self-exclusion text render correctly

### Cricket bookmaker pages
- [ ] All three review pages render at their routes
- [ ] Invalid slug redirects to `/bookmakers`
- [ ] SeoService called with correct canonical per page
- [ ] No prohibited CTA language (enforced by tests)
- [ ] Affiliate links use `rel="noopener noreferrer sponsored"`
- [ ] Affiliate disclosure visible without scrolling on desktop
- [ ] Internal links added to homepage, fixtures, article template
- [ ] Sitemap submitted post-deploy

### Tennis evergreen expansion
- [ ] All 12 guides at 1,500+ words
- [ ] All 12 have 4+ H2 headings
- [ ] All 12 have SA-specific context section
- [ ] All 12 link to `/bookmakers` or a review page
- [ ] `app-responsible-gambling` renders on all 12
- [ ] SeoService correctly configured on all 12
- [ ] All Jest tests passing
- [ ] All 12 URLs submitted for re-indexing
