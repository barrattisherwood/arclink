# Arclink Content Guide — SA Cricket Bets

This document describes exactly what fields the SA Cricket Bets site reads from Arclink.
Use it when configuring the cricket site and content types in the Arclink CMS.

---

## 1. Register the cricket site

Two things need to be created in Arclink before content can be authored:

| What | Action |
|---|---|
| **Fixtures site** | Create a new site named `betwise-cricket` in the Arclink Sites dashboard |
| **Blog tenant** | Create a new blog tenant (or reuse the rugby one). Note the tenant ID and API key — they go into Vercel env vars |

Once created, update the dev environment file at `apps/cricket/src/environments/environment.ts` with the real values:

```typescript
export const environment = {
  production: false,
  siteUrl: 'http://localhost:4201',
  arclinkBlogTenantId: '<YOUR_CRICKET_TENANT_ID>',
  arclinkBlogApiKey: '<YOUR_CRICKET_API_KEY>',
  arclinkSiteId: 'betwise-cricket',
};
```

---

## 2. Site identifiers

| Config key | Value |
|---|---|
| `arclinkSiteId` | `betwise-cricket` |
| `arclinkBlogTenantId` | *(your new cricket tenant ID)* |

---

## 3. Content type — Fixture

**Endpoints consumed:**
```
GET /api/entries/betwise-cricket/fixture?published=true&limit=20
GET /api/entries/betwise-cricket/fixture/{slug}
```

### Example entry

```json
{
  "_id": "...",
  "slug": "proteas-vs-england-1st-odi-2026",
  "data": {
    "homeTeam": "South Africa",
    "awayTeam": "England",
    "kickoff": "2026-09-12T13:00:00Z",
    "competition": "England Tour of SA — ODI Series",
    "venue": "The Wanderers, Johannesburg",
    "matchContext": "First ODI of the five-match series",
    "featuredBookmakers": ["hollywoodbets", "betway", "10bet"],
    "relatedArticleSlug": "proteas-vs-england-1st-odi-preview"
  }
}
```

### Field reference

| Field | Required | Arclink field type | Notes |
|---|---|---|---|
| `slug` | ✅ | text | URL-safe, kebab-case. Becomes the page URL `/fixtures/{slug}`. Example: `proteas-vs-england-1st-odi-2026` |
| `data.homeTeam` | ✅ | text | Full team name as you want it displayed. E.g. `"South Africa"` or `"Proteas"` |
| `data.awayTeam` | ✅ | text | Full team name. E.g. `"England"` |
| `data.kickoff` | ✅ | datetime or text | ISO 8601 string. Use the `datetime` field type if available. Otherwise enter as text: `"2026-09-12T13:00:00+02:00"` or `"2026-09-12T11:00:00Z"`. Displayed as `"Saturday, 12 September 2026 — 13:00"`. |
| `data.competition` | ✅ | text | Series/competition name. Shown in the match header banner. E.g. `"England Tour of SA — 1st ODI"` or `"SA20 2026 · Match 14"` |
| `data.venue` | ❌ | text | Stadium + city. Displayed with a 📍 icon. Omit to hide. |
| `data.matchContext` | ❌ | text | 1–2 sentences shown in italics under the venue. E.g. `"Decider — series level at 2-2"` |
| `data.featuredBookmakers` | ❌ | multi-select, tags, or text | Controls which bookmakers appear on the fixture page. Preferred: native string array. If no array type, use comma-separated text: `"hollywoodbets,betway,10bet"`. If omitted, all 7 bookmakers appear. See valid keys in section 5 below. |
| `data.relatedArticleSlug` | ❌ | text | Slug of a related blog article. Creates a cross-link at the bottom of the fixture page. |

---

## 4. Content type — Article (Blog Post)

**Endpoints consumed:**
```
GET /api/posts/{tenantId}?page=1&limit=12
GET /api/posts/{tenantId}/{slug}
GET /api/posts/{tenantId}?limit=500        ← build-time only, for prerendering
```
Header on all requests: `x-api-key: {arclinkBlogApiKey}`

### Example post

```json
{
  "id": "...",
  "slug": "proteas-vs-england-1st-odi-preview",
  "title": "Proteas vs England 1st ODI: Series Opener Preview",
  "excerpt": "South Africa host England at the Wanderers in what should be a high-scoring opener — here's where the value lies.",
  "content": "<p>Full article HTML...</p>",
  "seo_title": "Proteas vs England ODI Preview | SA Cricket Bets",
  "seo_description": "Our analysis of the SA vs England first ODI — form, pitch conditions and best-value betting angles.",
  "categories": ["Analysis", "ODI Series"],
  "tags": ["graeme", "odi", "proteas", "england"],
  "reading_time": 5,
  "published_at": "2026-09-10T08:00:00Z",
  "featured_image": {
    "url": "https://cdn.example.com/proteas-wanderers.jpg",
    "alt": "Proteas batting at The Wanderers"
  }
}
```

### Field reference

| Field | Required | Type | Notes |
|---|---|---|---|
| `slug` | ✅ | string | URL-safe. Used as `/articles/{slug}`. |
| `title` | ✅ | string | Main H1 heading. Falls back to this for `og:title` if `seo_title` not set. |
| `excerpt` | ✅ | string | 1–2 sentence summary. Shown on article cards and as `og:description` fallback. |
| `content` | ✅ | HTML string | Full article body. Rendered inside a `prose` container. Standard HTML tags: `<p>`, `<h2>`, `<ul>`, `<blockquote>`, etc. |
| `seo_title` | ❌ | string | Custom browser/social title. Falls back to `title` if blank. Keep under 60 characters. |
| `seo_description` | ❌ | string | Custom meta description. Falls back to `excerpt` if blank. Keep under 155 characters. |
| `categories` | ❌ | string[] | Displayed as coloured tags on article cards and detail pages. Recommended 1–2 per article. Examples: `["Analysis", "ODI Series"]`, `["SA20", "Preview"]`, `["Test Cricket", "Betting Guide"]` |
| `tags` | ❌ | string[] | **Must include exactly one persona tag** (see section below) to display a byline. Other tags are ignored by the app. |
| `reading_time` | ❌ | number | Integer minutes. Displayed as `"5 min read"`. Defaults to `0`. |
| `published_at` | ❌ | ISO 8601 date string | Displayed on cards as `"10 September 2026"`. If omitted, no date is shown. |
| `featured_image.url` | ❌ | string | Full URL of the hero image. If omitted, article cards show a 🏏 emoji placeholder. |
| `featured_image.alt` | ❌ | string | Alt text for the image. Always set when `url` is set. |

---

## 5. Persona / byline system

Cricket articles use two editorial personas. To show a byline, include the persona's tag in the article's `tags` array.

| Persona tag (in `tags`) | Display name | Role |
|---|---|---|
| `graeme` | Graeme Sherman | SA cricket correspondent |
| `hashim` | Hashim Amara | Stats & form specialist |

If no recognised persona tag is present, no byline is rendered.

> **Note:** The persona display names and avatars are configured in `libs/ui/content` — if you need to change the display name, update the persona map there.

---

## 6. Bookmaker keys (reference)

These are the valid values for `data.featuredBookmakers` on fixtures:

| Key | Display name |
|---|---|
| `hollywoodbets` | Hollywoodbets |
| `betway` | Betway |
| `10bet` | 10bet |
| `supabets` | Supabets |
| `sportingbet` | Sportingbet |
| `playa` | Playa |
| `wsb` | WSB |

---

## 7. Suggested competition names

Use consistent competition names for correct grouping on the `/fixtures` page (fixtures are grouped by `competition`).

| Format | Example values |
|---|---|
| Tour / series | `"England Tour of SA — 1st ODI"`, `"England Tour of SA — 2nd Test"` |
| SA20 | `"SA20 2027 · Eliminator"`, `"SA20 2027 · Final"` |
| CSA T20 Challenge | `"CSA T20 Challenge · Qualifier"` |
| Test series | `"Bangladesh Tour of SA — 1st Test"` |
| World Cup | `"ICC T20 World Cup — Super 8"` |

Keep names concise — they appear as uppercase headings above fixture groups.

---

## 8. Vercel environment variables (cricket project)

Set these on the **cricket** Vercel project (separate from the rugby project):

| Variable | Value |
|---|---|
| `ARCLINK_BLOG_TENANT_ID` | Your cricket blog tenant ID |
| `ARCLINK_BLOG_API_KEY` | Your cricket blog API key |
| `ARCLINK_SITE_ID` | `betwise-cricket` |
| `SITE_URL` | `https://sacricketbets.co.za` |

The build command generates `environment.production.ts` from these at build time:
```
node scripts/generate-env.js cricket && npx nx build cricket --configuration=production
```

---

## 9. Prerendering note

At build time the site fetches all article slugs (`limit=500`) and all fixture slugs from `betwise-cricket` to statically generate every page. This means:

- A newly published article or fixture will **SSR on first visit** without requiring a redeploy (`PrerenderFallback.Server`).
- To include a page in the initial static build output, publish it **before** the Vercel deployment runs.
