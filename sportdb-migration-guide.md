# SportDB.dev — Fixture API Migration Guide
## Replaces: api-sports.io (rugby $15/mo + football $10/mo)
## Replaces with: sportdb.dev (free, one key, all sports)

---

## What Changed and Why

During API evaluation we discovered **sportdb.dev** covers every sport on the
roadmap under a single free API key — rugby union, football, tennis, and cricket
— confirmed live against the API on 6 April 2026.

The complete spec (`dialogue-complete-spec.html`) references `api-sports.io` and
a file called `api-sports.ts`. This guide tells the build agent exactly what to
change. Everything else in the spec remains identical.

---

## Confirmed Coverage

| Competition | sportdb.dev ID | Endpoint |
|---|---|---|
| United Rugby Championship | `jBHqXTNh` | `/api/flashscore/rugby-union/world:8/united-rugby-championship:jBHqXTNh` |
| Currie Cup | `pjUEaE29` | `/api/flashscore/rugby-union/south-africa:175/currie-cup:pjUEaE29` |
| Rugby Championship | `xxwSbYzH` | `/api/flashscore/rugby-union/world:8/rugby-championship:xxwSbYzH` |
| Super Rugby | `Stv0V7h5` | `/api/flashscore/rugby-union/world:8/super-rugby:Stv0V7h5` |
| PSL (Betway Premiership) | `WYFXQ1KH` | `/api/flashscore/football/south-africa:175/betway-premiership:WYFXQ1KH` |
| Tennis | sport id 2 | `/api/flashscore/tennis` |
| Cricket | sport id 13 | `/api/flashscore/cricket` |

---

## API Key

```
SPORTDB_API_KEY=jBF4QQRf4zQqJioackM8xbw0YDE9xaiXJCQx8OnP
```

Add this to:
- Railway environment variables (arclink blog service)
- `.env` in the arclink blog service locally

Do NOT add to Vercel — the fixture fetch runs server-side in arclink only.
The Angular frontend never calls sportdb.dev directly.

---

## Plan Status

```
x-plan: free
x-quota: 1000 requests/month
x-usage-month: 3 (as of 6 April 2026)
```

Estimated monthly usage for the Tuesday roundup pipeline:
```
4 competition fetches × 1 request = 4 requests per run
4 runs per month (weekly) = 16 requests/month
```

**16 out of 1,000. Free plan covers this indefinitely.**

---

## File Changes — arclink Blog Service

### Change 1 — Rename and rewrite the fixture fetcher

**Delete:** `arclink/services/blog/src/services/api-sports.ts`

**Create:** `arclink/services/blog/src/services/sportdb.ts`

```typescript
// arclink/services/blog/src/services/sportdb.ts

import axios from 'axios';

const BASE = 'https://api.sportdb.dev/api/flashscore';
const KEY = process.env['SPORTDB_API_KEY']!;

const HEADERS = { 'X-API-Key': KEY };

// Competition IDs confirmed live on 6 April 2026
export const COMPETITION_IDS = {
  rugby_union: {
    urc:               'jBHqXTNh',  // United Rugby Championship
    currie_cup:        'pjUEaE29',  // Currie Cup
    rugby_championship:'xxwSbYzH',  // Rugby Championship / Springboks
    super_rugby:       'Stv0V7h5',  // Super Rugby Pacific
  },
  football: {
    psl:               'WYFXQ1KH',  // Betway Premiership (PSL)
    motsepe:           '2HPP8Pog',  // Motsepe Foundation Championship
    nedbank:           'WMffLgMb',  // Nedbank Cup
  }
};

// Country / region IDs
const REGION_IDS = {
  sa_rugby:   'south-africa:175',
  world_rugby:'world:8',
  sa_football:'south-africa:175',
};

export interface SportDbFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  venue: string;
  kickoff: string;   // ISO string
  matchLabel: string;
}

export async function fetchUpcomingFixtures(
  sport: string,
  daysAhead: number
): Promise<SportDbFixture[]> {

  const competitions = getCompetitionsForSport(sport);
  const fixtures: SportDbFixture[] = [];

  for (const { endpoint, competitionName } of competitions) {
    try {
      // Fetch seasons for this competition first
      const { data: seasons } = await axios.get(
        `${BASE}/${endpoint}`,
        { headers: HEADERS }
      );

      // Get the current/latest season
      const currentSeason = findCurrentSeason(seasons);
      if (!currentSeason) continue;

      // Fetch fixtures for current season
      const { data: fixtureData } = await axios.get(
        `${BASE}/${currentSeason.link || endpoint}/fixtures`,
        { headers: HEADERS }
      );

      const upcoming = (fixtureData || [])
        .filter((f: any) => isUpcoming(f, daysAhead))
        .map((f: any) => mapFixture(f, competitionName));

      fixtures.push(...upcoming);
    } catch (err) {
      console.error(`[SportDB] Failed for ${competitionName}:`, err);
    }
  }

  return fixtures;
}

function getCompetitionsForSport(sport: string): { endpoint: string; competitionName: string }[] {
  switch (sport) {
    case 'rugby_union':
      return [
        {
          endpoint: `rugby-union/${REGION_IDS.world_rugby}/united-rugby-championship:${COMPETITION_IDS.rugby_union.urc}`,
          competitionName: 'United Rugby Championship'
        },
        {
          endpoint: `rugby-union/${REGION_IDS.sa_rugby}/currie-cup:${COMPETITION_IDS.rugby_union.currie_cup}`,
          competitionName: 'Currie Cup'
        },
        {
          endpoint: `rugby-union/${REGION_IDS.world_rugby}/rugby-championship:${COMPETITION_IDS.rugby_union.rugby_championship}`,
          competitionName: 'Rugby Championship'
        },
      ];
    case 'football':
      return [
        {
          endpoint: `football/${REGION_IDS.sa_football}/betway-premiership:${COMPETITION_IDS.football.psl}`,
          competitionName: 'Betway Premiership (PSL)'
        },
      ];
    default:
      return [];
  }
}

function findCurrentSeason(seasons: any[]): any {
  if (!Array.isArray(seasons) || seasons.length === 0) return null;
  // Return first item — SportDB returns current season first
  return seasons[0];
}

function isUpcoming(fixture: any, daysAhead: number): boolean {
  if (!fixture.startTime && !fixture.date) return false;
  const kickoff = new Date(fixture.startTime || fixture.date);
  const now = new Date();
  const cutoff = new Date(Date.now() + daysAhead * 86400000);
  return kickoff > now && kickoff < cutoff;
}

function buildMatchLabel(fixture: any): string {
  const kickoff = new Date(fixture.startTime || fixture.date);
  const day = kickoff.toLocaleDateString('en-ZA', {
    weekday: 'short',
    timeZone: 'Africa/Johannesburg'
  });
  const time = kickoff.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg'
  });
  const home = fixture.homeTeam?.name || fixture.home || 'TBC';
  const away = fixture.awayTeam?.name || fixture.away || 'TBC';
  const venue = fixture.venue?.name || fixture.stadium || 'TBC';
  return `${home} vs ${away} · ${venue} · ${day} ${time}`;
}

function mapFixture(f: any, competitionName: string): SportDbFixture {
  const home = f.homeTeam?.name || f.home || 'TBC';
  const away = f.awayTeam?.name || f.away || 'TBC';
  return {
    id: f.id?.toString() || '',
    homeTeam: home,
    awayTeam: away,
    competition: competitionName,
    venue: f.venue?.name || f.stadium || 'TBC',
    kickoff: f.startTime || f.date || '',
    matchLabel: buildMatchLabel(f),
  };
}
```

---

### Change 2 — Update the scheduler import

In `scheduler-weekly-roundup.ts`, change the import:

```typescript
// BEFORE
import { fetchUpcomingFixtures } from './services/api-sports';

// AFTER
import { fetchUpcomingFixtures } from './services/sportdb';
```

No other changes to the scheduler — the function signature is identical.

---

### Change 3 — Update the fixture-selector import

In `fixture-selector.ts`, change the import:

```typescript
// BEFORE
import { ApiSportsFixture } from './api-sports';

// AFTER
import { SportDbFixture as ApiSportsFixture } from './sportdb';
```

Using `as ApiSportsFixture` means the rest of `fixture-selector.ts` needs
zero changes — the interface shape is identical.

---

### Change 4 — Update environment variable name

In `.env` (arclink blog service):

```bash
# REMOVE:
API_SPORTS_KEY=...

# ADD:
SPORTDB_API_KEY=jBF4QQRf4zQqJioackM8xbw0YDE9xaiXJCQx8OnP
```

In Railway environment variables — same change.

---

### Change 5 — Update BlogTenant sport_key values

The `sport_key` field on `BlogTenant` now maps to sportdb sport slugs:

```typescript
// seed-betwise-rugby.ts
sport_key: 'rugby_union',   // unchanged — maps to sportdb rugby-union
sport_label: 'Rugby',       // unchanged
```

No changes needed — `rugby_union` and `football` are the same sport keys
used in `getCompetitionsForSport()` in `sportdb.ts`.

---

## Testing After Migration

### Step 1 — Verify the fetcher works

Create a quick test script:

```typescript
// arclink/services/blog/src/scripts/test-sportdb.ts
import 'dotenv/config';
import { fetchUpcomingFixtures } from '../services/sportdb';

async function test() {
  console.log('Fetching rugby union fixtures...');
  const fixtures = await fetchUpcomingFixtures('rugby_union', 14);
  console.log(`Found ${fixtures.length} fixtures:`);
  fixtures.forEach(f => console.log(' -', f.matchLabel));
}

test().catch(console.error);
```

Run it:

```bash
npx ts-node src/scripts/test-sportdb.ts
```

Expected output:
```
Fetching rugby union fixtures...
Found 8 fixtures:
 - Bulls vs Sharks · Loftus · Sat 17:00
 - Lions vs Stormers · Ellis Park · Sat 19:30
 - ...
```

### Step 2 — Verify the full pipeline

```typescript
// In a test script or REPL:
import { runWeeklyRoundup } from '../scheduler-weekly-roundup';
import { BlogTenant } from '../models/BlogTenant';

const tenant = await BlogTenant.findOne({ name: 'BetWise Rugby' });
await runWeeklyRoundup(tenant);
// Check MongoDB for the new draft post
```

### Step 3 — Verify fixture data shape

The SportDB response structure may differ slightly from what the spec assumed
for API-Sports. If `mapFixture()` in `sportdb.ts` produces empty team names
or missing kickoff times, run a raw fetch first to inspect the actual response:

```bash
curl -s -H "X-API-Key: jBF4QQRf4zQqJioackM8xbw0YDE9xaiXJCQx8OnP" \
  "https://api.sportdb.dev/api/flashscore/rugby-union/world:8/united-rugby-championship:jBHqXTNh" \
  | python3 -m json.tool | head -60
```

Adjust the field mappings in `mapFixture()` to match the actual response
shape. The field names (`startTime`, `homeTeam.name`, `venue.name`) are
educated guesses based on their football endpoint — confirm against the live
response and update accordingly.

---

## Summary of All File Changes

```
RENAME/REWRITE
  api-sports.ts → sportdb.ts (full rewrite)

UPDATE IMPORTS (2 files)
  scheduler-weekly-roundup.ts  — import from './services/sportdb'
  fixture-selector.ts          — import SportDbFixture as ApiSportsFixture

UPDATE ENV VAR (2 places)
  .env                         — API_SPORTS_KEY → SPORTDB_API_KEY
  Railway dashboard            — same

NO CHANGES NEEDED
  dialogue-parser.ts
  claude.ts
  generate.ts route
  Post model
  TitleQueue model
  BlogTenant model
  seed-betwise-rugby.ts
  scheduler-weekly-roundup.ts (logic)
  fixture-selector.ts (logic)
  Angular frontend (anything)
```

---

## Competition IDs Quick Reference

Save these — they go into `COMPETITION_IDS` in `sportdb.ts`:

```
Rugby Union
  URC:                jBHqXTNh
  Currie Cup:         pjUEaE29
  Rugby Championship: xxwSbYzH
  Super Rugby:        Stv0V7h5

Football
  PSL (Betway Prem):  WYFXQ1KH
  Motsepe Champ:      2HPP8Pog
  Nedbank Cup:        WMffLgMb
  Carling Knockout:   t6G9wMZN
  MTN 8:              hrHTRs5B

Region IDs
  South Africa (rugby): south-africa:175
  South Africa (football): south-africa:175
  World (rugby): world:8
```

---

## Important Note on Response Shape

The `mapFixture()` function in `sportdb.ts` contains field name guesses
based on the football countries response structure we confirmed. The actual
fixture response shape needs to be verified by running:

```bash
curl -s -H "X-API-Key: jBF4QQRf4zQqJioackM8xbw0YDE9xaiXJCQx8OnP" \
  "https://api.sportdb.dev/api/flashscore/rugby-union/world:8/united-rugby-championship:jBHqXTNh" \
  | python3 -m json.tool
```

**Run this command before writing any mapping code.** The actual field names
will be in the response — update `homeTeam`, `awayTeam`, `startTime`,
`venue` references in `mapFixture()` to match exactly.
