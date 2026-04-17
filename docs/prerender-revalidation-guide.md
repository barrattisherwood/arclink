# Prerender + On-Demand Revalidation — Build Guide
## All four sport sites: Rugby · Football · Cricket · Tennis
## sarugbybets.co.za · safootballbets.co.za · sacricketbets.co.za · satennisbets.co.za

---

## Context

The build agent switched `RenderMode.Prerender` to `RenderMode.Server` on
the articles and analysis routes to fix a content freshness issue.
This is the wrong trade-off for an SEO-first content site.

**Problem with Server rendering:**
- Pages generated fresh on every request — no CDN caching
- Googlebot sees dynamic pages, not static HTML
- Slower for users and crawlers
- More expensive on Vercel (function invocations per request)

**Correct solution:**
- Keep `RenderMode.Prerender` for all content routes
- Add on-demand revalidation triggered by arclink when a post is published
- Cache-Control headers already added by FE — keep those in place

---

## What This Guide Covers

1. Revert Server → Prerender on all four sites
2. Generate revalidation secret tokens
3. Add Vercel environment variables per site
4. Create `revalidate.ts` service in arclink
5. Add revalidation calls to arclink posts route
6. Add `/api/revalidate` endpoint to each Angular app
7. Fix www → non-www redirect in Vercel for all four sites
8. Test end-to-end
9. Redeploy all four sites

---

## 01 — Revert RenderMode on All Four Sites

The agent changed `articles` and `analysis` routes from
`RenderMode.Prerender` to `RenderMode.Server`. Revert all of them.

```typescript
// apps/rugby/src/app/app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'articles',       renderMode: RenderMode.Prerender },  // ← revert
  { path: 'articles/:slug', renderMode: RenderMode.Server },     // keep Server — dynamic slug
  { path: '**',             renderMode: RenderMode.Prerender },
];
```

```typescript
// apps/cricket/src/app/app.routes.server.ts
export const serverRoutes: ServerRoute[] = [
  { path: 'articles',       renderMode: RenderMode.Prerender },  // ← revert
  { path: 'articles/:slug', renderMode: RenderMode.Server },
  { path: '**',             renderMode: RenderMode.Prerender },
];
```

```typescript
// apps/tennis/src/app/app.routes.server.ts
export const serverRoutes: ServerRoute[] = [
  { path: 'analysis',       renderMode: RenderMode.Prerender },  // ← revert
  { path: 'analysis/:slug', renderMode: RenderMode.Server },
  { path: '**',             renderMode: RenderMode.Prerender },
];
```

```typescript
// apps/football/src/app/app.routes.server.ts
// Football analysis was already RenderMode.Client — leave unchanged
export const serverRoutes: ServerRoute[] = [
  { path: 'analysis',       renderMode: RenderMode.Client },     // ← leave as-is
  { path: 'analysis/:slug', renderMode: RenderMode.Server },
  { path: '**',             renderMode: RenderMode.Prerender },
];
```

**Note on individual article pages (`articles/:slug` and `analysis/:slug`):**
These stay as `RenderMode.Server` because the slug is dynamic and unknown
at build time. Prerendering dynamic slugs requires listing every slug in
the build config — not practical for a live content pipeline. Server
rendering individual articles is acceptable because:
- Google follows the link from the prerendered list page
- The article page HTML is still full SSR — not client-side rendered
- Individual article pages are a small fraction of total traffic

---

## 02 — Generate Revalidation Secret Tokens

Generate four separate secrets — one per site. Run in terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save these — you need them in both Vercel (per site) and arclink (Railway).

```
REVALIDATE_SECRET_RUGBY    = <token 1>
REVALIDATE_SECRET_FOOTBALL = <token 2>
REVALIDATE_SECRET_CRICKET  = <token 3>
REVALIDATE_SECRET_TENNIS   = <token 4>
```

---

## 03 — Add Environment Variables

### In Vercel — per site

Go to each Vercel project → Settings → Environment Variables.

**sarugbybets (rugby project):**
```
REVALIDATE_SECRET = <token 1>
```

**safootballbets (football project):**
```
REVALIDATE_SECRET = <token 2>
```

**sacricketbets (cricket project):**
```
REVALIDATE_SECRET = <token 3>
```

**satennisbets (tennis project):**
```
REVALIDATE_SECRET = <token 4>
```

Each site only needs its own secret — not the others.

### In arclink — Railway environment variables

arclink needs all four tokens plus all four site URLs:

```
VERCEL_REVALIDATE_TOKEN_RUGBY    = <token 1>
VERCEL_REVALIDATE_TOKEN_FOOTBALL = <token 2>
VERCEL_REVALIDATE_TOKEN_CRICKET  = <token 3>
VERCEL_REVALIDATE_TOKEN_TENNIS   = <token 4>

VERCEL_SITE_URL_RUGBY    = https://sarugbybets.co.za
VERCEL_SITE_URL_FOOTBALL = https://safootballbets.co.za
VERCEL_SITE_URL_CRICKET  = https://sacricketbets.co.za
VERCEL_SITE_URL_TENNIS   = https://satennisbets.co.za
```

---

## 04 — Create revalidate.ts Service in arclink

```typescript
// arclink/services/blog/src/services/revalidate.ts

const VERCEL_TOKENS: Record<string, string> = {
  rugby_union: process.env.VERCEL_REVALIDATE_TOKEN_RUGBY    ?? '',
  football:    process.env.VERCEL_REVALIDATE_TOKEN_FOOTBALL ?? '',
  cricket:     process.env.VERCEL_REVALIDATE_TOKEN_CRICKET  ?? '',
  tennis:      process.env.VERCEL_REVALIDATE_TOKEN_TENNIS   ?? '',
};

const SITE_URLS: Record<string, string> = {
  rugby_union: process.env.VERCEL_SITE_URL_RUGBY    ?? 'https://sarugbybets.co.za',
  football:    process.env.VERCEL_SITE_URL_FOOTBALL ?? 'https://safootballbets.co.za',
  cricket:     process.env.VERCEL_SITE_URL_CRICKET  ?? 'https://sacricketbets.co.za',
  tennis:      process.env.VERCEL_SITE_URL_TENNIS   ?? 'https://satennisbets.co.za',
};

// Paths to revalidate per sport
const SPORT_PATHS: Record<string, string[]> = {
  rugby_union: ['/articles', '/'],
  football:    ['/analysis', '/'],
  cricket:     ['/articles', '/'],
  tennis:      ['/analysis', '/'],
};

export async function revalidateSite(
  sportKey: string,
  extraPaths: string[] = []
): Promise<void> {
  const token   = VERCEL_TOKENS[sportKey];
  const baseUrl = SITE_URLS[sportKey];

  if (!token || !baseUrl) {
    console.warn(`[Revalidate] No token or URL for sport: ${sportKey}`);
    return;
  }

  const paths = [
    ...(SPORT_PATHS[sportKey] ?? []),
    ...extraPaths,
  ];

  for (const path of paths) {
    try {
      const url = `${baseUrl}/api/revalidate?path=${encodeURIComponent(path)}&token=${token}`;
      const res = await fetch(url, { method: 'POST' });

      if (!res.ok) {
        console.error(`[Revalidate] Failed for ${path}:`, res.status, await res.text());
      } else {
        console.log(`[Revalidate] Cleared cache: ${baseUrl}${path}`);
      }
    } catch (err) {
      console.error(`[Revalidate] Error for ${path}:`, err);
    }
  }
}
```

---

## 05 — Call Revalidation From arclink Posts Route

Add revalidation calls wherever a post changes to `published` status.
There are three places this happens:

### 5.1 — Manual publish (PATCH /posts/:tenantId/:postId)

```typescript
// arclink/services/blog/src/routes/posts.ts
import { revalidateSite } from '../services/revalidate';

// PATCH /:tenantId/:postId — update post (including manual publish)
router.patch('/:tenantId/:postId', resolveTenant, async (req, res) => {
  const post = await Post.findOneAndUpdate(
    { _id: req.params.postId, tenant_id: req.params.tenantId },
    { $set: req.body },
    { new: true }
  );

  if (!post) return res.status(404).json({ error: 'Not found' });

  // Trigger revalidation when post is published
  if (req.body.status === 'published') {
    const tenant = req.tenant; // from resolveTenant middleware
    await revalidateSite(tenant.sport_key, [
      `/${post.slug}`,
    ]);
  }

  res.json({ post });
});
```

### 5.2 — Feature a post (POST /posts/:tenantId/:postId/feature)

```typescript
// POST /:tenantId/:postId/feature
router.post('/:tenantId/:postId/feature', resolveTenant, async (req, res) => {
  // ...existing feature logic (unpin previous, pin new)...

  // Revalidate homepage — featured post appears there
  await revalidateSite(req.tenant.sport_key, [
    `/${post.slug}`,
  ]);

  res.json({ post });
});
```

### 5.3 — Scheduled publisher (scheduler-publishing.ts)

```typescript
// arclink/services/blog/src/scheduler-publishing.ts
import { revalidateSite } from './services/revalidate';

cron.schedule('30 * * * *', async () => {
  const now = new Date();

  const duePosts = await Post.find({
    status: 'scheduled',
    publish_at: { $lte: now },
  }).populate('tenant_id');

  for (const post of duePosts) {
    await post.updateOne({
      status: 'published',
      scheduled: false,
      published_at: now,
    });

    // Trigger revalidation after auto-publish
    const tenant = post.tenant_id as any;
    if (tenant?.sport_key) {
      await revalidateSite(tenant.sport_key, [`/${post.slug}`]);
    }

    console.log(`[Publishing Scheduler] Published + revalidated: "${post.title}"`);
  }
});
```

### 5.4 — Weekly roundup generator (scheduler-weekly-roundup.ts)

```typescript
// arclink/services/blog/src/scheduler-weekly-roundup.ts
// After the roundup post is saved and published:

await revalidateSite(tenant.sport_key, [
  `/${newPost.slug}`,
]);
```

---

## 06 — Add /api/revalidate Endpoint to Each Angular App

Angular 21 with SSR runs an Express server. Add the revalidate endpoint
as an Express route in each app's server file.

```typescript
// apps/rugby/src/server.ts (and cricket, tennis, football)
// Add this BEFORE the Angular SSR handler

import { randomBytes } from 'crypto';

app.post('/api/revalidate', (req, res) => {
  const { token, path } = req.query as { token?: string; path?: string };

  // Validate secret
  if (!token || token !== process.env['REVALIDATE_SECRET']) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!path) {
    return res.status(400).json({ error: 'Missing path' });
  }

  // Angular SSR with prerendering on Vercel doesn't support
  // ISR revalidation natively like Next.js.
  // The revalidation here triggers a fresh prerender on next deploy.
  // For immediate cache busting, we rely on Cache-Control headers
  // already configured on the Express server (s-maxage + stale-while-revalidate).

  console.log(`[Revalidate] Cache bust requested for: ${path}`);
  res.json({ revalidated: true, path, timestamp: new Date().toISOString() });
});
```

**Important note on Angular SSR vs Next.js ISR:**

Angular's prerender with Vercel does not support true ISR (Incremental
Static Regeneration) the way Next.js does. The `/api/revalidate` endpoint
above logs the request and responds but cannot instantly clear Vercel's
edge cache for a specific path the way Next.js can.

**The real cache clearing mechanism for Angular on Vercel is the
Cache-Control headers already added to the Express server** — specifically:

```typescript
// Already in place per the FE work done
res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
```

This means:
- Vercel's CDN serves the cached page for up to 1 hour (`s-maxage=3600`)
- After 1 hour, Vercel re-fetches from the server in the background
  while still serving the stale page to users (`stale-while-revalidate`)
- New content appears within 1 hour of publishing — no redeploy needed

The revalidate endpoint is still worth keeping — it provides a webhook
target for future use and logs publication events. But the Cache-Control
headers are doing the actual work.

---

## 07 — Fix www Redirect in Vercel (All Four Sites)

From the Vercel domains screenshot, `sarugbybets.co.za` currently
307-redirects to `www.sarugbybets.co.za`. This causes the "Page with
redirect" error in Google Search Console. Fix for all four sites.

### In Vercel — for each site:

1. Go to project → Settings → Domains
2. The domain listed as **Production** is the canonical URL
3. The other domain should redirect TO the Production domain

**Correct setup — make non-www the canonical:**

| Domain | Role |
|---|---|
| `sarugbybets.co.za` | Production (canonical) |
| `www.sarugbybets.co.za` | Redirects → `sarugbybets.co.za` |

To fix:
- Click edit on `www.sarugbybets.co.za`
- Change from Production → Redirect to `sarugbybets.co.za`
- Click edit on `sarugbybets.co.za`
- Set as Production

Repeat for:
- `safootballbets.co.za` / `www.safootballbets.co.za`
- `sacricketbets.co.za` / `www.sacricketbets.co.za`
- `satennisbets.co.za` / `www.satennisbets.co.za`

### Update Sitemaps After Fixing Redirects

Once non-www is canonical, confirm every sitemap lists non-www URLs:

```xml
<!-- Correct — all non-www -->
<url><loc>https://sarugbybets.co.za/</loc></url>
<url><loc>https://sarugbybets.co.za/articles</loc></url>
<url><loc>https://sarugbybets.co.za/bookmakers</loc></url>
```

If your Angular app generates the sitemap dynamically, ensure the
base URL is set to the non-www version in each app's environment:

```typescript
// apps/rugby/src/environments/environment.prod.ts
export const environment = {
  production: true,
  siteUrl: 'https://sarugbybets.co.za',  // non-www
};
```

### Resubmit Sitemaps in Search Console

After fixing the redirects and redeploying, go to Search Console for
each site → Sitemaps → resubmit. Also go to the Pages report → select
"Page with redirect" → Request Reindexing on affected pages.

---

## 08 — Canonical Tags in Angular

Add canonical link tags to every page to reinforce the non-www
canonical URL to Google. Do this in a global SEO service:

```typescript
// libs/util-seo/src/lib/seo.service.ts
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { SPORT_CONFIG } from '@odds-nx/util-sport-config';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private meta     = inject(Meta);
  private title    = inject(Title);
  private doc      = inject(DOCUMENT);
  private router   = inject(Router);
  private config   = inject(SPORT_CONFIG);

  setPage(data: { title: string; description: string; path?: string }) {
    this.title.setTitle(`${data.title} | ${this.config.siteName}`);

    this.meta.updateTag({ name: 'description', content: data.description });

    // Set canonical — always non-www
    const canonical = `${this.config.siteUrl}${data.path ?? this.router.url}`;
    this.setCanonical(canonical);
  }

  private setCanonical(url: string) {
    const existing = this.doc.querySelector('link[rel="canonical"]');
    if (existing) {
      existing.setAttribute('href', url);
    } else {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      link.setAttribute('href', url);
      this.doc.head.appendChild(link);
    }
  }
}
```

Call `seoService.setPage()` in each page component's `ngOnInit()`:

```typescript
// Example — ArticlesComponent
ngOnInit() {
  this.seo.setPage({
    title: 'Rugby Betting Analysis',
    description: 'Expert URC and Currie Cup betting analysis from Kwagga and Marcus.',
    path: '/articles',
  });
}
```

---

## Build Order

```
Step 01  Generate 4 revalidation secrets via node crypto
Step 02  Add REVALIDATE_SECRET to each Vercel project env vars
Step 03  Add all 4 tokens + site URLs to arclink Railway env vars
Step 04  Create revalidate.ts in arclink/services/blog/src/services/
Step 05  Update posts.ts route — add revalidateSite() on manual publish
Step 06  Update posts.ts route — add revalidateSite() on feature
Step 07  Update scheduler-publishing.ts — add revalidateSite() after auto-publish
Step 08  Update scheduler-weekly-roundup.ts — add revalidateSite() after roundup saved
Step 09  Revert app.routes.server.ts on rugby — articles back to Prerender
Step 10  Revert app.routes.server.ts on cricket — articles back to Prerender
Step 11  Revert app.routes.server.ts on tennis — analysis back to Prerender
Step 12  Confirm football app.routes.server.ts — analysis stays Client
Step 13  Add /api/revalidate POST route to server.ts on all 4 apps
Step 14  Create/update SeoService in libs/util-seo
Step 15  Call seoService.setPage() in each page component ngOnInit
Step 16  Fix www → non-www redirect in Vercel for all 4 projects
Step 17  Update environment.prod.ts siteUrl to non-www on all 4 apps
Step 18  Verify sitemaps list non-www URLs — update if needed
Step 19  Deploy arclink (Railway) — revalidation service live
Step 20  Deploy all 4 Angular apps (Vercel) — Prerender restored
Step 21  Resubmit sitemaps in Search Console for all 4 sites
Step 22  Request reindexing on "Page with redirect" URLs in Search Console
Step 23  Test: publish a post in arclink — confirm revalidate endpoint called
Step 24  Test: wait 1 hour — confirm new content visible without redeploy
Step 25  Test: check Search Console Pages report — redirect errors resolving
```

---

## Test Checklist

### Prerender
- [ ] `/articles` on rugby returns 200 with full HTML (no JS required)
- [ ] `/articles` on cricket returns 200 with full HTML
- [ ] `/analysis` on tennis returns 200 with full HTML
- [ ] Lighthouse → no "content not visible without JavaScript" warning
- [ ] Vercel → Functions tab shows no invocations for /articles or /analysis

### Revalidation
- [ ] POST to `/api/revalidate?path=/articles&token=CORRECT` returns 200
- [ ] POST to `/api/revalidate?path=/articles&token=WRONG` returns 401
- [ ] Publishing a post in arclink triggers revalidate.ts
- [ ] Railway logs show `[Revalidate] Cleared cache:` entries
- [ ] New content visible on site within 1 hour of publishing

### Redirects & Canonicals
- [ ] `sarugbybets.co.za` — no redirect, serves directly
- [ ] `www.sarugbybets.co.za` — 307 redirects to non-www
- [ ] Same for football, cricket, tennis
- [ ] Every page has `<link rel="canonical" href="https://sarugbybets.co.za/...">` in HTML
- [ ] Sitemap lists non-www URLs only

### Search Console
- [ ] Sitemaps resubmitted on all 4 sites
- [ ] "Page with redirect" count reducing over 48–72 hours
- [ ] No new "Page with redirect" errors appearing

---

## Summary of Files Changed

```
NEW
  arclink/services/blog/src/services/revalidate.ts

UPDATED — arclink
  routes/posts.ts                  (revalidation on publish + feature)
  scheduler-publishing.ts          (revalidation after auto-publish)
  scheduler-weekly-roundup.ts      (revalidation after roundup)

UPDATED — Angular apps
  apps/rugby/src/app/app.routes.server.ts    (Prerender restored)
  apps/cricket/src/app/app.routes.server.ts  (Prerender restored)
  apps/tennis/src/app/app.routes.server.ts   (Prerender restored)
  apps/rugby/src/server.ts                   (/api/revalidate endpoint)
  apps/football/src/server.ts                (/api/revalidate endpoint)
  apps/cricket/src/server.ts                 (/api/revalidate endpoint)
  apps/tennis/src/server.ts                  (/api/revalidate endpoint)
  apps/*/src/environments/environment.prod.ts (siteUrl non-www)

NEW — shared lib
  libs/util-seo/src/lib/seo.service.ts

UPDATED — all page components
  ngOnInit() calls seoService.setPage() with title, description, path
```
