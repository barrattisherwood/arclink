# Football Fixtures Integration Guide
## safootballbets.co.za — Arclink Content API

---

## Overview

Fixtures are stored in the Arclink **content service** as `ContentEntry` records
under the `betwise-football` site. They are synced from SportDB every Tuesday
and Friday at 03:30 UTC, covering 14 days ahead.

Each fixture has these fields inside its `data` object:

```json
{
  "homeTeam": "Mamelodi Sundowns",
  "awayTeam": "Orlando Pirates",
  "kickoff":  "2026-04-19T14:00:00.000Z",
  "competition": "PSL"
}
```

---

## API Base

```
https://content.arclink.dev
```

---

## Endpoints

### All upcoming fixtures (all competitions)

```
GET /api/entries/betwise-football/fixture?published=true&upcoming=true
```

Returns all published fixtures with a kickoff date in the future, sorted by
`createdAt` descending. Use `limit` and `offset` for pagination.

```
GET /api/entries/betwise-football/fixture?published=true&upcoming=true&limit=20&offset=0
```

### Filter by competition

Pass any `data.*` field as a query param for exact-match filtering:

```
GET /api/entries/betwise-football/fixture?published=true&upcoming=true&competition=PSL
GET /api/entries/betwise-football/fixture?published=true&upcoming=true&competition=Champions+League
GET /api/entries/betwise-football/fixture?published=true&upcoming=true&competition=Premier+League
```

### Competition name reference

Use these exact strings in the `competition` query param:

| Page / Section     | `competition` value     |
|--------------------|-------------------------|
| PSL                | `PSL`                   |
| EPL                | `Premier League`        |
| UCL / Europa       | `Champions League`      |
|                    | `Europa League`         |
| CAF                | `CAF Champions League`  |
| AFCON              | `AFCON`                 |
| Nedbank Cup        | `Nedbank Cup`           |
| Carling Knockout   | `Carling Knockout`      |
| MTN 8              | `MTN 8`                 |
| COSAFA             | `COSAFA Cup`            |

---

## Response Shape

```json
{
  "entries": [
    {
      "_id": "...",
      "siteId": "betwise-football",
      "contentTypeSlug": "fixture",
      "slug": "mamelodi-sundowns-vs-orlando-pirates-20260419",
      "published": true,
      "data": {
        "homeTeam": "Mamelodi Sundowns",
        "awayTeam": "Orlando Pirates",
        "kickoff":  "2026-04-19T14:00:00.000Z",
        "competition": "PSL"
      },
      "createdAt": "2026-04-17T20:00:00.000Z",
      "updatedAt": "2026-04-17T20:00:00.000Z"
    }
  ],
  "total": 44,
  "limit": 50,
  "offset": 0
}
```

---

## Displaying Fixtures by Section

### Main fixtures page — all competitions

```typescript
const res = await fetch(
  'https://content.arclink.dev/api/entries/betwise-football/fixture?published=true&upcoming=true&limit=20'
);
const { entries } = await res.json();
```

### Competition-specific page (e.g. PSL page)

```typescript
const competition = encodeURIComponent('PSL'); // or 'Champions League', etc.
const res = await fetch(
  `https://content.arclink.dev/api/entries/betwise-football/fixture?published=true&upcoming=true&competition=${competition}&limit=10`
);
const { entries } = await res.json();
```

### Kickoff display — convert UTC to SAST

All kickoff timestamps are UTC. Display in Africa/Johannesburg (SAST = UTC+2):

```typescript
function formatKickoff(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
// → "Sat, 19 Apr, 16:00"
```

---

## Sorting by Kickoff Date

The endpoint sorts by `createdAt` (insertion order). To display fixtures in
chronological kickoff order, sort client-side:

```typescript
entries.sort((a, b) =>
  new Date(a.data.kickoff).getTime() - new Date(b.data.kickoff).getTime()
);
```

---

## No Auth Required

The fixture endpoint is public — no API key needed for `GET` requests.
Only `POST`/`PATCH`/`DELETE` require the `x-api-key` header.

---

## Refresh Cadence

| When              | What happens                                      |
|-------------------|---------------------------------------------------|
| Tuesday 03:30 UTC | Full sync — all competitions, 14 days ahead       |
| Friday 03:30 UTC  | Full sync — all competitions, 14 days ahead       |
| Manual            | Run `services/content/src/scripts/sync-fixtures-now.ts` |

Stale/past fixtures remain in the DB but are excluded by `?upcoming=true`.

---

## Notes for the Build Agent

- Always use `?upcoming=true` to exclude past fixtures automatically
- The `competition` filter is **case-sensitive** and must match exactly
- If a competition has no fixtures in the next 14 days, the response will
  return `"entries": []` with `"total": 0` — handle this gracefully with
  an empty state component
- Do not hard-code fixture data — always fetch from the API at render time
  or via SSR so content stays current after each Tuesday/Friday sync
