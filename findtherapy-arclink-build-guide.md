# FindTherapy.care — Arclink Blog Integration & Migration Guide

Build agent instructions for onboarding findtherapy.care onto Arclink and cutting over the frontend from the standalone backend to the Arclink blog API.

---

## Overview

The existing findtherapy.care blog runs on a standalone Node/Express backend with its own MongoDB instance. Arclink will replace it as the content store and generation engine. The migration is **non-destructive** — the standalone backend keeps running until the cutover is confirmed.

**What changes:**
- Blog content is fetched from `https://blog.arclink.dev` instead of `https://api.findtherapy.care`
- Existing posts are migrated (upserted) into Arclink — all slugs are preserved
- `views` and `likes` counts are carried over from the source
- New AI-generated content is produced by the Arclink blog service under the `naledi` persona
- The standalone backend can be decommissioned after cutover is confirmed

---

## Part 1 — Arclink Onboarding (Admin Steps)

These steps run inside the Arclink admin dashboard at `https://admin.arclink.dev`. They do not require terminal access.

### Step 1 — Seed the tenant

Navigate to the **Queue** page. Scroll to the **"Seed FindTherapy tenant"** card (teal button).

Click **⊕ Seed tenant**.

On success the card shows:
```
Tenant created (<tenantId>). API key: <rawKey>
```

**Copy the raw API key now** — it is only shown once. Store it in the findtherapy.care environment variables as `ARCLINK_API_KEY`.

If it shows `Tenant already exists (<tenantId>)` the seed has already been run — no action needed, no key is re-issued.

Note the `tenantId` UUID — you will need it for the frontend `.env`.

### Step 2 — Apply the persona prompt

Click **↻ Sync Personas** (violet button).

This pushes the Naledi Mokoena prompt from `persona-registry.ts` into the tenant's `blog_persona_prompts` map in MongoDB.

On success:
```
Personas updated — 5/5 tenants
```

### Step 3 — Migrate existing posts

Click **↓ Migrate posts** (orange button).

This fetches all published posts from `https://api.findtherapy.care/api/blog` (paginated, 50 per page) and upserts them into Arclink under the `findtherapy-care` tenant.

On success:
```
Migration complete — N upserted, 0 skipped (N fetched)
```

**This is idempotent** — re-running updates existing posts rather than duplicating them. Run it again any time to pull in posts added to the standalone backend before cutover.

---

## Part 2 — Arclink Blog API

All public endpoints require no authentication. No CORS configuration is needed — the tenant's `allowed_origin` is already set to `https://findtherapy.care`.

### Base URL

```
https://blog.arclink.dev
```

### Tenant ID

Retrieve from the Seed step above. Set it as an environment variable in the findtherapy.care app:

```
ARCLINK_TENANT_ID=<tenantId>
```

---

### Endpoint 1 — List published posts

```
GET /posts/{tenantId}
```

Returns published posts, most recent first. `content` field is **excluded** — fetch the single post endpoint for full body.

**Query parameters:**

| Param      | Type   | Default | Description                             |
|------------|--------|---------|-----------------------------------------|
| `page`     | number | 1       | Page number                             |
| `limit`    | number | 10      | Posts per page (max 50)                 |
| `category` | string | —       | Filter by category (case-insensitive)   |
| `tag`      | string | —       | Filter by tag (case-insensitive)        |
| `featured` | bool   | —       | Return only featured posts if `true`    |

**Example:**
```
GET https://blog.arclink.dev/posts/{tenantId}?page=1&limit=12
```

**Response:**
```json
{
  "posts": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "title": "What to Expect in Your First Therapy Session",
      "slug": "what-to-expect-in-your-first-therapy-session",
      "excerpt": "Starting therapy is a significant step. Here is an honest account of what most first sessions actually look like — and how to prepare.",
      "seo_title": "What to Expect in Your First Therapy Session | FindTherapy",
      "seo_description": "An honest guide to what happens in a first therapy session — what to say, what to ask, and how to prepare.",
      "categories": ["therapy guides"],
      "tags": ["first session", "therapy", "anxiety", "mental health"],
      "reading_time": 5,
      "word_count": 950,
      "status": "published",
      "generated": false,
      "featured": false,
      "views": 312,
      "likes": 18,
      "author_name": "Dr Naledi Mokoena",
      "featured_image": {
        "url": "https://res.cloudinary.com/...",
        "alt": "What to Expect in Your First Therapy Session",
        "credit": null
      },
      "published_at": "2025-11-04T10:00:00.000Z",
      "created_at": "2025-11-04T10:00:00.000Z"
    }
  ],
  "total": 18,
  "page": 1,
  "pages": 2
}
```

---

### Endpoint 2 — Get single post by slug

```
GET /posts/{tenantId}/{slug}
```

Returns the full post including `content` (Markdown string).

**Example:**
```
GET https://blog.arclink.dev/posts/{tenantId}/what-to-expect-in-your-first-therapy-session
```

**Response:**
```json
{
  "post": {
    "id": "uuid",
    "title": "What to Expect in Your First Therapy Session",
    "slug": "what-to-expect-in-your-first-therapy-session",
    "excerpt": "...",
    "content": "## Before You Arrive\n\nYou don't need to have your story perfectly organised...",
    "seo_title": "...",
    "seo_description": "...",
    "categories": ["therapy guides"],
    "tags": ["first session", "therapy"],
    "reading_time": 5,
    "word_count": 950,
    "status": "published",
    "generated": false,
    "featured": false,
    "views": 312,
    "likes": 18,
    "author_name": "Dr Naledi Mokoena",
    "featured_image": { "url": "...", "alt": "...", "credit": null },
    "published_at": "2025-11-04T10:00:00.000Z",
    "created_at": "2025-11-04T10:00:00.000Z"
  }
}
```

Returns **404** if the slug does not exist or the post is not published.

---

### Endpoint 3 — RSS feed

```
GET /posts/{tenantId}/feed.xml
```

Returns RSS 2.0 XML of the 20 most recent published posts. Add this to:
- `<link rel="alternate" type="application/rss+xml" href="...">` in `<head>`
- `robots.txt` or main sitemap as a feed declaration

---

### Endpoint 4 — Sitemap

```
GET /posts/{tenantId}/sitemap.xml
```

Returns an XML sitemap of all published post URLs. Reference this in `robots.txt`:
```
Sitemap: https://findtherapy.care/sitemap.xml
```

The sitemap uses `blog_canonical_base` (`https://findtherapy.care/blog`) as the URL prefix — all post URLs will be `https://findtherapy.care/blog/{slug}`.

---

## Part 3 — Post Object Schema Reference

| Field            | Type              | Notes                                                      |
|------------------|-------------------|------------------------------------------------------------|
| `id`             | string (UUID)     | Unique post ID                                             |
| `title`          | string            | Display heading                                            |
| `slug`           | string            | URL slug — same values as the standalone backend           |
| `excerpt`        | string            | Summary for listing cards                                  |
| `content`        | string (Markdown) | Full body — **single post endpoint only**                  |
| `seo_title`      | string            | Use for `<title>` and `og:title` (≤60 chars)              |
| `seo_description`| string            | Use for `<meta name="description">` and `og:description`  |
| `categories`     | string[]          | Lowercased. e.g. `["therapy guides", "mental health"]`    |
| `tags`           | string[]          | Lowercased specific topic tags                             |
| `reading_time`   | number            | Minutes, calculated at import/generation time             |
| `word_count`     | number            | Approximate word count                                     |
| `status`         | `"published"`     | Always `"published"` on public endpoints                  |
| `generated`      | boolean           | `false` for migrated posts, `true` for AI-generated       |
| `featured`       | boolean           | Promoted post — use to populate a hero/featured slot       |
| `views`          | number            | View count carried over from the standalone backend        |
| `likes`          | number            | Like count carried over from the standalone backend        |
| `author_name`    | string \| null    | Display name from `authorDisplayName` on source. `null` if not set — default to site author name in UI |
| `featured_image` | object \| null    | See below                                                  |
| `published_at`   | ISO 8601 string   | Publication date                                           |
| `created_at`     | ISO 8601 string   | Record creation date                                       |

### `featured_image` object

| Field                     | Type           | Notes                                            |
|---------------------------|----------------|--------------------------------------------------|
| `url`                     | string         | Cloudinary URL (migrated posts) or Unsplash CDN  |
| `alt`                     | string         | Alt text for accessibility                       |
| `credit`                  | object \| null | `null` for migrated Cloudinary images            |
| `credit.photographer`     | string         | Unsplash photographer name (AI posts only)       |
| `credit.photographer_url` | string         | Unsplash profile URL                             |
| `credit.unsplash_url`     | string         | Unsplash photo page URL                          |

---

## Part 4 — Frontend Integration

### What changes from the existing API

The existing `GET /api/blog` endpoint returns a shape that is similar but not identical. Map the differences:

| Existing field       | Arclink field        | Notes                                      |
|----------------------|----------------------|--------------------------------------------|
| `featuredImage`      | `featured_image.url` | Arclink wraps image in an object           |
| `seoTitle`           | `seo_title`          | snake_case throughout                      |
| `seoDescription`     | `seo_description`    | snake_case throughout                      |
| `publishedAt`        | `published_at`       | snake_case throughout                      |
| `createdAt`          | `created_at`         | snake_case throughout                      |
| `readingTime`        | `reading_time`       | snake_case throughout                      |
| `authorDisplayName`  | `author_name`        | Flat string, not nested                    |
| pagination: `pages`  | `pages`              | Same field name                            |
| pagination: `total`  | `total`              | Same field name                            |

The existing API returns `posts` at the top level for the list response — Arclink does the same.

The existing single post endpoint wraps in `{ post: {} }` — Arclink does the same.

### Environment variables to set on findtherapy.care

```
ARCLINK_BLOG_BASE_URL=https://blog.arclink.dev
ARCLINK_TENANT_ID=<tenantId from seed step>
```

### Canonical URLs

All blog post canonical URLs should use `https://findtherapy.care/blog/{slug}`. This matches the `blog_canonical_base` already set on the Arclink tenant. Ensure the existing blog routes (`/blog` listing, `/blog/:slug` detail) are kept — only the data source changes.

### Rendering `content`

`content` is **Markdown**. If the existing frontend was rendering HTML from the standalone backend, swap in a Markdown renderer. Recommended: `marked` or `react-markdown` (or the Vue/Angular equivalent). The migrated posts have their content stored as Markdown in Arclink regardless of the original source format.

### Handling `author_name: null`

`author_name` is `null` for posts where `authorDisplayName` was not set in the source. Default to the site's editorial name in the UI:
```ts
const displayAuthor = post.author_name ?? 'FindTherapy Editorial';
```

### Views and likes

Arclink does not increment `views` automatically on the public read endpoint (unlike the standalone backend). If you want to preserve view-counting behaviour, call a lightweight endpoint on the findtherapy.care backend or implement a separate analytics event. For now, the migrated `views` and `likes` values are stored as-is and display correctly.

---

## Part 5 — Sitemap and SEO

Update `robots.txt` to reference the Arclink-sourced sitemap:

```
Sitemap: https://blog.arclink.dev/posts/{tenantId}/sitemap.xml
```

Or proxy it through your domain:
```
Sitemap: https://findtherapy.care/blog-sitemap.xml
```

And add a route that proxies `GET /blog-sitemap.xml` → `https://blog.arclink.dev/posts/{tenantId}/sitemap.xml`.

Add to `<head>` on all blog pages:
```html
<link rel="alternate" type="application/rss+xml"
      title="FindTherapy Blog"
      href="https://blog.arclink.dev/posts/{tenantId}/feed.xml" />
```

---

## Part 6 — Cutover Checklist

Work through this in order. Do not decommission the standalone backend until all items are ticked.

- [ ] Seed step completed — tenant ID and API key recorded
- [ ] Sync Personas clicked — Naledi prompt applied
- [ ] Migration run — all posts visible in Arclink (verify count matches standalone)
- [ ] Environment variables set on findtherapy.care (`ARCLINK_BLOG_BASE_URL`, `ARCLINK_TENANT_ID`)
- [ ] Frontend API calls updated to point at Arclink endpoints
- [ ] Field mapping applied (`featuredImage` → `featured_image.url`, camelCase → snake_case, etc.)
- [ ] Markdown renderer added for `content` field
- [ ] `author_name: null` fallback added
- [ ] Listing page renders correctly (pagination, images, excerpts)
- [ ] Single post page renders correctly (full content, SEO tags)
- [ ] Category and tag filters work (`?category=`, `?tag=`)
- [ ] Canonical `<link>` and `og:url` use `findtherapy.care/blog/{slug}` (not the Arclink domain)
- [ ] RSS feed `<link>` added to `<head>`
- [ ] Sitemap updated in `robots.txt`
- [ ] End-to-end smoke test: all existing slugs resolve correctly
- [ ] Standalone backend decommissioned (or kept in read-only mode as archive)

---

## Part 7 — Post-Migration: New AI Content

Once the tenant is live, new posts can be generated via the **Arclink admin dashboard** at `https://admin.arclink.dev` using the blog tenant selector.

The `naledi` persona is a single-author editorial voice — no dialogue format, no weekly roundup. Posts are generated as `article_format: 'standard'` with a target word count of ~1000 words.

To generate a post:
1. Select the **FindTherapy** tenant in the admin dashboard
2. Go to **Queue** → **Suggest 5** to get AI-generated title ideas
3. Add selected titles to the queue
4. Click **Generate** to produce a draft
5. Review, edit, and publish from the **Drafts** view

The scheduler will auto-generate and schedule posts according to the tenant's `blog_cadence` setting (currently 2 posts per week). This can be adjusted in the blog service configuration.
