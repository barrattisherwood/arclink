# Machinum.io Blog Integration Guide

This guide documents the public Blog API endpoints for integrating the Arclink blog into machinum.io. All public endpoints require **no authentication**.

## Base URL

```
https://blog.arclink.dev
```

## Tenant ID

```
2fa2476c-e017-4e07-8af3-c57b44344099
```

---

## Public Endpoints

### 1. List Published Posts

```
GET /posts/{tenantId}
```

Returns paginated published posts (most recent first). `content` is excluded from list responses.

**Query Parameters:**

| Param   | Type   | Default | Max | Description         |
|---------|--------|---------|-----|---------------------|
| `page`  | number | 1       | —   | Page number         |
| `limit` | number | 10      | 50  | Posts per page       |

**Example:**

```
GET https://blog.arclink.dev/posts/2fa2476c-e017-4e07-8af3-c57b44344099?page=1&limit=10
```

**Response:**

```json
{
  "posts": [
    {
      "id": "uuid",
      "tenant_id": "2fa2476c-e017-4e07-8af3-c57b44344099",
      "title": "How to Validate Your SaaS Idea Before Writing Code",
      "slug": "how-to-validate-your-saas-idea-before-writing-code",
      "excerpt": "Most SaaS founders skip validation and jump straight to building. Here's a practical framework for testing demand before you invest months of development time.",
      "seo_title": "Validate Your SaaS Idea Before Building | Machinum",
      "seo_description": "Learn a proven framework to validate SaaS demand before writing code. Save months of wasted development with these practical steps.",
      "categories": ["Strategy"],
      "reading_time": 6,
      "status": "published",
      "tags": ["saas", "validation", "lean-startup"],
      "word_count": 1200,
      "generated": true,
      "scheduled_for": null,
      "published_at": "2026-03-01T09:00:00.000Z",
      "created_at": "2026-02-28T14:30:00.000Z",
      "featured_image": {
        "url": "https://images.unsplash.com/photo-...",
        "alt": "Entrepreneur sketching a business model on a whiteboard",
        "credit": {
          "photographer": "Jane Doe",
          "photographer_url": "https://unsplash.com/@janedoe",
          "unsplash_url": "https://unsplash.com/photos/abc123"
        }
      }
    }
  ],
  "total": 42,
  "page": 1,
  "pages": 5
}
```

**Notes:**
- `content` is **not** included in list responses — fetch the full post by slug
- `featured_image` can be `null` if no image was assigned
- `featured_image.credit` can be `null` if the image was uploaded manually (not from Unsplash)

---

### 2. Get Single Post by Slug

```
GET /posts/{tenantId}/{slug}
```

Returns a single published post **including full content**.

**Example:**

```
GET https://blog.arclink.dev/posts/2fa2476c-e017-4e07-8af3-c57b44344099/how-to-validate-your-saas-idea-before-writing-code
```

**Response:**

```json
{
  "post": {
    "id": "uuid",
    "title": "How to Validate Your SaaS Idea Before Writing Code",
    "slug": "how-to-validate-your-saas-idea-before-writing-code",
    "excerpt": "Most SaaS founders skip validation and jump straight to building...",
    "content": "## Why Most SaaS Ideas Fail\n\nThe article body in **Markdown** format...",
    "seo_title": "Validate Your SaaS Idea Before Building | Machinum",
    "seo_description": "Learn a proven framework to validate SaaS demand before writing code.",
    "categories": ["Strategy"],
    "reading_time": 6,
    "status": "published",
    "tags": ["saas", "validation", "lean-startup"],
    "word_count": 1200,
    "generated": true,
    "published_at": "2026-03-01T09:00:00.000Z",
    "created_at": "2026-02-28T14:30:00.000Z",
    "featured_image": { ... }
  }
}
```

**Returns 404** if the slug doesn't exist or the post isn't published.

---

### 3. RSS Feed

```
GET /posts/{tenantId}/feed.xml
```

Returns an RSS 2.0 XML feed of the 20 most recent published posts.

**Example:**

```
GET https://blog.arclink.dev/posts/2fa2476c-e017-4e07-8af3-c57b44344099/feed.xml
```

Use this for:
- RSS feed widget on machinum.io
- SEO `<link rel="alternate" type="application/rss+xml">` tag in `<head>`
- Syndication to third-party readers

---

### 4. Sitemap

```
GET /posts/{tenantId}/sitemap.xml
```

Returns an XML sitemap of all published post URLs. Include this in your `robots.txt` or link it from your main sitemap.

**Example:**

```
GET https://blog.arclink.dev/posts/2fa2476c-e017-4e07-8af3-c57b44344099/sitemap.xml
```

---

## Post Object Schema

| Field              | Type                  | Description                                       |
|--------------------|-----------------------|---------------------------------------------------|
| `id`               | string (UUID)         | Unique post identifier                            |
| `title`            | string                | Post title (display heading)                      |
| `slug`             | string                | URL-friendly slug (unique per tenant)             |
| `excerpt`          | string                | Preview summary for blog listing cards (up to 300 chars) |
| `seo_title`        | string                | SERP-optimised title (max 60 chars) — use for `<title>` and `og:title` |
| `seo_description`  | string                | Meta description (max 155 chars) — use for `<meta name="description">` and `og:description` |
| `categories`       | string[]              | Broad topic categories (e.g. "Strategy", "Technology") |
| `reading_time`     | number                | Estimated reading time in minutes                 |
| `content`          | string                | Full article body in **Markdown** (only on single post endpoint) |
| `status`           | `"published"`         | Always `"published"` on public endpoints          |
| `tags`             | string[]              | Specific topic tags                               |
| `word_count`       | number                | Approximate word count                            |
| `generated`        | boolean               | Whether the post was AI-generated                 |
| `published_at`     | string (ISO 8601)     | Publication timestamp                             |
| `created_at`       | string (ISO 8601)     | Creation timestamp                                |
| `scheduled_for`    | null                  | Always null for published posts                   |
| `featured_image`   | object \| null        | See below                                         |

### Featured Image Object

| Field                    | Type           | Description                          |
|--------------------------|----------------|--------------------------------------|
| `url`                    | string         | Image URL (Unsplash CDN or base64 data URL) |
| `alt`                    | string         | Alt text for accessibility           |
| `credit`                 | object \| null | Unsplash attribution (null if uploaded) |
| `credit.photographer`    | string         | Photographer name                    |
| `credit.photographer_url`| string         | Photographer's Unsplash profile URL  |
| `credit.unsplash_url`    | string         | Photo page on Unsplash               |

**Important:** When `credit` is present (non-null), display Unsplash attribution — e.g., "Photo by {photographer}" linking to their profile.

---

## SEO Implementation Guide

### Meta Tags (per post page)

Use `seo_title` and `seo_description` (not `title` and `excerpt`) for SEO tags. The `title` and `excerpt` are for display; the `seo_*` fields are optimised for search engines.

```html
<!-- Primary Meta -->
<title>{post.seo_title}</title>
<meta name="description" content="{post.seo_description}" />
<link rel="canonical" href="https://machinum.io/blog/{post.slug}" />

<!-- Open Graph -->
<meta property="og:type" content="article" />
<meta property="og:title" content="{post.seo_title}" />
<meta property="og:description" content="{post.seo_description}" />
<meta property="og:url" content="https://machinum.io/blog/{post.slug}" />
<meta property="og:image" content="{post.featured_image.url}" />
<meta property="og:site_name" content="Machinum" />
<meta property="article:published_time" content="{post.published_at}" />
<meta property="article:tag" content="{tag}" />  <!-- one per tag -->

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{post.seo_title}" />
<meta name="twitter:description" content="{post.seo_description}" />
<meta name="twitter:image" content="{post.featured_image.url}" />
```

**Note:** Skip `og:image` / `twitter:image` if `featured_image` is null or the URL starts with `data:` (base64).

### JSON-LD Structured Data (per post page)

Add this `<script>` tag to the `<head>` of each blog post page for rich search results:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "{post.seo_title}",
  "description": "{post.seo_description}",
  "image": "{post.featured_image.url}",
  "datePublished": "{post.published_at}",
  "dateModified": "{post.published_at}",
  "wordCount": {post.word_count},
  "author": {
    "@type": "Organization",
    "name": "Machinum"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Machinum",
    "logo": {
      "@type": "ImageObject",
      "url": "https://machinum.io/logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://machinum.io/blog/{post.slug}"
  },
  "keywords": "{post.tags.join(', ')}",
  "articleSection": "{post.categories[0]}"
}
</script>
```

### Blog Listing Page JSON-LD

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Blog",
  "name": "Machinum Blog",
  "description": "Insights on SaaS automation, AI, and business growth",
  "url": "https://machinum.io/blog"
}
</script>
```

### RSS Feed Link

Add to the `<head>` of every page (or at least the blog section):

```html
<link rel="alternate" type="application/rss+xml" title="Machinum Blog"
  href="https://blog.arclink.dev/posts/2fa2476c-e017-4e07-8af3-c57b44344099/feed.xml" />
```

### Sitemap

Reference the blog sitemap from your `robots.txt` or main sitemap:

```
Sitemap: https://blog.arclink.dev/posts/2fa2476c-e017-4e07-8af3-c57b44344099/sitemap.xml
```

Or merge it into your main sitemap index.

---

## Content Rendering

Post `content` is **Markdown**. You'll need a Markdown-to-HTML renderer. Recommended libraries:

- **React:** `react-markdown` or `marked` + `DOMPurify`
- **Vue:** `marked` + `v-html`
- **Vanilla JS:** `marked`

The content may include:
- Headings (`## h2` through `#### h4`)
- Bold, italic, inline code
- Bullet and numbered lists
- Code blocks with language hints (` ```javascript `)
- Links and blockquotes

---

## Integration Patterns

### Blog Listing Page (`/blog`)

1. Fetch `GET /posts/{tenantId}?page=1&limit=10`
2. Render cards with: `title`, `excerpt`, `featured_image`, `published_at`, `categories`, `reading_time`
3. Link each card to `/blog/{slug}`
4. Implement pagination using `pages` and `total` from the response

### Single Post Page (`/blog/:slug`)

1. Fetch `GET /posts/{tenantId}/{slug}`
2. Set all SEO meta tags using `seo_title`, `seo_description`, `featured_image`
3. Inject JSON-LD structured data
4. Render `title` as the page `<h1>` (use `title`, not `seo_title`, for the visible heading)
5. Render `featured_image` as hero banner (with credit attribution if `credit` exists)
6. Render `content` as Markdown to HTML
7. Display `published_at`, `categories`, `tags`, `reading_time` as metadata

### Homepage Blog Preview

1. Fetch `GET /posts/{tenantId}?limit=3`
2. Show the 3 most recent posts as cards
3. Link "View all" to the blog listing page

---

## CORS

The API allows requests from configured origins. If machinum.io calls the API directly from the browser, the CORS config on the blog service may need updating to include `machinum.io` origins. Alternatively, proxy requests through your own backend to avoid CORS entirely.

---

## Example: Fetch Posts (JavaScript)

```javascript
const BLOG_API = 'https://blog.arclink.dev';
const TENANT_ID = '2fa2476c-e017-4e07-8af3-c57b44344099';

// List posts
const res = await fetch(`${BLOG_API}/posts/${TENANT_ID}?page=1&limit=10`);
const { posts, total, pages } = await res.json();

// Single post
const postRes = await fetch(`${BLOG_API}/posts/${TENANT_ID}/${slug}`);
const { post } = await postRes.json();

// Set meta tags (framework-agnostic)
document.title = post.seo_title;
document.querySelector('meta[name="description"]')?.setAttribute('content', post.seo_description);
```
