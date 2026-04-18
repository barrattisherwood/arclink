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
  "homeTeam":    "Mamelodi Sundowns",
  "awayTeam":    "Orlando Pirates",
  "kickoff":     "2026-04-19T14:00:00.000Z",
  "competition": "PSL",
  "tag":         "psl"
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

### Filter by tag (recommended)

Use the `tag` field — short slugs, stable, no exact-string fragility:

```
GET /api/entries/betwise-football/fixture?published=true&upcoming=true&tag=psl
GET /api/entries/betwise-football/fixture?published=true&upcoming=true&tag=ucl
GET /api/entries/betwise-football/fixture?published=true&upcoming=true&tag=epl
```

### Tag reference

| Page / Section          | `tag` value  | Competitions included                         |
|-------------------------|--------------|-----------------------------------------------|
| PSL / SA Football       | `psl`        | PSL, Nedbank Cup, Carling Knockout, MTN 8     |
| EPL                     | `epl`        | Premier League                                |
| UCL / Europa            | `ucl`        | Champions League, Europa League               |
| CAF Champions League    | `caf`        | CAF Champions League                          |
| AFCON                   | `afcon`      | Africa Cup of Nations                         |
| COSAFA / Bafana Bafana  | `bafana`     | COSAFA Cup                                    |

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
// Use tag slugs — stable, no string fragility
const tag = 'psl'; // or 'ucl', 'epl', 'caf', 'afcon', 'bafana'
const res = await fetch(
  `https://content.arclink.dev/api/entries/betwise-football/fixture?published=true&upcoming=true&tag=${tag}&limit=10`
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
