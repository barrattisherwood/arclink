# Arclink Content Guide — SA Rugby Bets

This document describes exactly what fields the SA Rugby Bets site reads from Arclink.
Use it when configuring content types in the Arclink CMS.

---

## Site identifiers

| Config key | Value |
|---|---|
| `arclinkSiteId` | `betwise-rugby` |
| `arclinkBlogTenantId` | `e03819eb-7d15-456d-b108-28e870fa9caa` |

---

## Content type 1 — Fixture

**Endpoint consumed:**
```
GET /api/entries/betwise-rugby/fixture?published=true&limit=20
GET /api/entries/betwise-rugby/fixture/{slug}
```

The app expects entries shaped as:

```json
{
  "_id": "...",
  "slug": "springboks-vs-wallabies-july-2026",
  "data": {
    "homeTeam": "Springboks",
    "awayTeam": "Australia",
    "kickoff": "2026-07-18T19:00:00Z",
    "competition": "Rugby Championship",
    "venue": "DHL Newlands, Cape Town",
    "matchContext": "First home test of the series",
    "featuredBookmakers": ["hollywoodbets", "betway", "10bet"],
    "relatedArticleSlug": "springboks-vs-wallabies-preview"
  }
}
```

### Field reference

| Field | Required | Type | Notes |
|---|---|---|---|
| `slug` | ✅ | string | URL-safe, e.g. `springboks-vs-wallabies-july-2026`. Used as the page URL `/fixtures/{slug}`. |
| `data.homeTeam` | ✅ | string | Full team name, e.g. `"Springboks"` |
| `data.awayTeam` | ✅ | string | Full team name, e.g. `"Australia"` |
| `data.kickoff` | ✅ | ISO 8601 date string | Must include time + timezone, e.g. `"2026-07-18T19:00:00+02:00"`. Displayed as `"Saturday, 18 July 2026 — 19:00"`. |
| `data.competition` | ✅ | string | Competition name, e.g. `"Rugby Championship"` or `"URC Round 18"`. Shown in the page header banner. |
| `data.venue` | ❌ | string | Stadium + city. Displayed with a 📍 icon. Omit to hide. |
| `data.matchContext` | ❌ | string | 1–2 sentence context shown in italics under the venue, e.g. `"Decisive third test — series level at 1-1"`. |
| `data.featuredBookmakers` | ❌ | string[] | Subset of bookmaker keys to show on this fixture page. If omitted, all 7 bookmakers appear. Valid keys: `hollywoodbets`, `betway`, `10bet`, `supabets`, `sportingbet`, `playa`, `wsb`. |
| `data.relatedArticleSlug` | ❌ | string | Slug of a blog article to cross-link at the bottom of the fixture page. |

---

## Content type 2 — Article (Blog Post)

**Endpoint consumed:**
```
GET /api/posts/{tenantId}?page=1&limit=10
GET /api/posts/{tenantId}/{slug}
GET /api/posts/{tenantId}?limit=500        ← build-time only, for prerendering
```
Header on all requests: `x-api-key: {arclinkBlogApiKey}`

The app expects posts shaped as:

```json
{
  "id": "...",
  "slug": "springboks-vs-wallabies-preview",
  "title": "Springboks vs Australia: Rugby Championship Preview",
  "excerpt": "The Springboks host Australia in Cape Town in what looks like a chess match between two well-drilled defences.",
  "content": "<p>Full article HTML...</p>",
  "seo_title": "Springboks vs Australia Preview | SA Rugby Bets",
  "seo_description": "Our analysis of the Springboks vs Australia Rugby Championship clash.",
  "categories": ["Analysis", "Rugby Championship"],
  "tags": ["marcus", "springboks", "rugby-championship"],
  "reading_time": 5,
  "published_at": "2026-07-15T08:00:00Z",
  "featured_image": {
    "url": "https://cdn.example.com/springboks-preview.jpg",
    "alt": "Springboks training session"
  }
}
```

### Field reference

| Field | Required | Type | Notes |
|---|---|---|---|
| `slug` | ✅ | string | URL-safe. Used as `/articles/{slug}`. |
| `title` | ✅ | string | Main H1 heading. Falls back to this for `og:title` if `seo_title` not set. |
| `excerpt` | ✅ | string | 1–2 sentence summary. Shown on article cards and used for `og:description` fallback. |
| `content` | ✅ | HTML string | Full article body. Rendered as raw HTML inside a `prose` container. Standard HTML tags are fine (`<p>`, `<h2>`, `<ul>`, `<blockquote>`, etc.). |
| `seo_title` | ❌ | string | Custom browser/social title. Falls back to `title` if blank. Keep under 60 characters. |
| `seo_description` | ❌ | string | Custom meta description. Falls back to `excerpt` if blank. Keep under 155 characters. |
| `categories` | ❌ | string[] | Displayed as coloured tags on cards and detail pages. Recommended 1–2 categories, e.g. `["Analysis", "Rugby Championship"]`. |
| `tags` | ❌ | string[] | **Must include exactly one persona tag** (see below) to display a byline. Other tags are ignored by the app. |
| `reading_time` | ❌ | number | Integer minutes. Displayed as `"5 min read"`. Defaults to `0`. |
| `published_at` | ❌ | ISO 8601 date string | Displayed on cards as `"15 July 2026"`. If omitted, no date is shown. |
| `featured_image.url` | ❌ | string | Full URL of the hero image. If omitted, cards show a 🏉 emoji placeholder and the detail page shows no image. |
| `featured_image.alt` | ❌ | string | Alt text for the image. Always include when `url` is set. |

---

## Persona / byline system

Articles can be attributed to one of four editorial personas. To show a byline, include the persona's tag in the article's `tags` array.

| Persona tag (in `tags`) | Display name | Style |
|---|---|---|
| `kwagga` | Kwagga van der Berg | Local rugby analyst |
| `marcus` | Marcus Osei | Stats & form specialist |
| `seamus` | Seamus O'Brien | Betting strategy |
| `kofi` | Kofi Mensah | News & fixtures |

If no persona tag is present, no byline is rendered.

---

## Bookmaker keys (reference)

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

## Frontend Display Requirements — Analysis Page

**List View (Analysis page):**
- Sort by `published_at` descending (newest first)
- Show 10 articles per page with pagination
- Each card displays: `featured_image` (or 🏉 emoji placeholder), `title`, `excerpt`, `categories` (colored tags), persona byline, `reading_time`
- Categories shown: max 2 on card, full list on detail page
- If no `featured_image.url`, show 🏉 emoji placeholder with gradient background

**Detail View (Article page):**
- Full `content` rendered as HTML with prose styling
- All categories displayed as colored tags
- Show persona byline + reading time + published date in header
- Hero image (if `featured_image.url` present) displayed full-width above article
- Related fixtures can be linked via `data.relatedArticleSlug` (reverse lookup from fixture entries)

**Empty State:**
- Message: "No articles yet. Content is on its way — check back soon."
- Display 📝✏️ emoji placeholder

**Persona Byline Logic:**
- Extract the first matching persona tag from `tags` array (`kwagga`, `marcus`, `seamus`, `kofi`)
- If multiple persona tags present, use the first one found
- If no persona tag present, do not render any byline
- Display format: "By [Display Name]" (e.g., "By Kwagga van der Berg")

**Category Display:**
- Categories are free-form strings defined by content editors
- Recommend 1–2 categories per article for clarity
- Frontend should display all categories but prioritize first 2 on list cards

---

## Prerendering note

At build time the site fetches **all article slugs** (`limit=500`) and **all fixture slugs** to statically generate every page. This means:

- A newly published article or fixture will be SSR-rendered on first visit even without a rebuild (Angular `PrerenderFallback.Server`).
- To include a page in the initial static build, publish it before deployment.
