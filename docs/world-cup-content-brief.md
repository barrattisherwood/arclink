# World Cup 2026 — arclink Content Brief
## safootballbets.co.za
## Generate immediately — tournament starts June 11

---

## Context For Generation

FIFA World Cup 2026. June 11 – July 19. 48 teams, USA/Canada/Mexico.
SA bettors follow Brazil, Argentina, England, France, Morocco heavily.
Bafana did not qualify. Lucky writes from SA domestic football lens.
Callum writes from European tactical and market lens.
All CTAs point to Hollywoodbets. Betway exception only when warranted.
Tag every article: `world-cup-2026`

---

## Article 1 — Tournament Winner Betting Guide

**Title:** World Cup 2026 Tournament Winner Betting Guide — Lucky and Callum's Picks

**Format:** dialogue
**Personas:** lucky + callum
**Tags:** world-cup-2026, odds-analysis, fixture-preview
**Word count:** 500
**Publish:** immediately

**Brief:**
Lucky opens with the SA bettor's perspective — which nations SA fans
back and why. Argentina as defending champions. Brazil's Vinicius-led
squad. Morocco as Africa's best hope and why SA bettors should care.
Lucky recommends the market at Hollywoodbets.

Callum responds with the market angle — where the odds are compressed
(France, England) versus where the value sits. Identifies one
non-obvious selection the market is underpricing. Tactical reasoning
for why a specific team suits the tournament format.

Both personas must name a specific Hollywoodbets market.
Neither should pick the same winner.

---

## Article 2 — Group Stage Betting Guide

**Title:** World Cup 2026 Group Stage Betting Guide — Where the Value Sits

**Format:** dialogue
**Personas:** lucky + callum
**Tags:** world-cup-2026, odds-analysis
**Word count:** 550
**Publish:** immediately

**Brief:**
Structure as three fixture blocks — pick three specific group stage
matches that offer betting value. Suggested matchups:
- Argentina vs Chile (Group B) — continental derby, SA bettors love this
- England vs Serbia (Group D) — Callum's natural territory
- Morocco vs Croatia (Group J) — African interest, tactical intrigue

For each fixture: Lucky covers the SA bettor angle and motivation.
Callum covers the tactical matchup and market pricing.
Each fixture block ends with a specific Hollywoodbets CTA.

---

## Article 3 — Brazil Betting Preview

**Title:** Brazil at World Cup 2026 — Vinicius Jr, the Golden Boot, and Whether the Seleção Can Finally Win It

**Format:** standard
**Persona:** callum
**Tags:** world-cup-2026, odds-analysis, brazil
**Word count:** 600
**Publish:** immediately

**Brief:**
Callum analyses Brazil's tournament chances through a tactical and
market lens. Cover: Dorival Júnior's system, Vinicius Jr as both
tournament winner and Golden Boot candidate, Brazil's draw and
likely knockout path, and why the market may be underpricing or
overpricing them relative to European competition.

Specific Hollywoodbets markets to reference:
tournament winner, Golden Boot (Vinicius Jr), Brazil to reach semi-final.

---

## Article 4 — Argentina Defending Champions Preview

**Title:** Argentina at World Cup 2026 — Can the Defending Champions Do It Again?

**Format:** standard
**Persona:** lucky
**Tags:** world-cup-2026, odds-analysis, argentina
**Word count:** 600
**Publish:** immediately

**Brief:**
Lucky covers Argentina from the SA bettor perspective — Messi context,
defending champion psychology, squad depth beyond the star. How SA
football fans relate to Argentina's style and history.
Group B analysis — Chile, Ivory Coast, Slovakia — path to knockout rounds.
Lucky's honest assessment of whether Argentina can repeat.

Specific Hollywoodbets markets: Argentina tournament winner,
Argentina to reach final, Messi assists market if available.

---

## Article 5 — Africa at the World Cup

**Title:** Africa at World Cup 2026 — Morocco, Nigeria, Senegal and the Continent's Best Chance Yet

**Format:** dialogue
**Personas:** lucky + callum
**Tags:** world-cup-2026, odds-analysis, afcon
**Word count:** 500
**Publish:** immediately

**Brief:**
This is the highest-SA-relevance angle outside of the major European
nations. Lucky leads — African football identity, SA's connection to
the continent's teams, Morocco's 2022 semi-final legacy and whether
they can match it, Nigeria and Senegal as dark horses.

Callum responds with tactical and market analysis — how African sides
match up against European opposition tactically, where the market
systematically undervalues African teams in group stage matchups.

End with Hollywoodbets CTA on Morocco to reach knockout rounds.

---

## Article 6 — Golden Boot Betting Guide

**Title:** World Cup 2026 Golden Boot Betting Guide — Callum Runs the Numbers

**Format:** standard
**Persona:** callum
**Tags:** world-cup-2026, odds-analysis
**Word count:** 500
**Publish:** June 10 (day before tournament)

**Brief:**
Pure market analysis from Callum. Cover the top candidates:
Vinicius Jr, Mbappé, Harry Kane, Lautaro Martínez, Erling Haaland.
For each: tournament path (how many matches they're likely to play),
team's scoring distribution (do they rely on this player for goals),
historical Golden Boot pattern (tournament top scorers tend to come
from teams that go deep — always reference this structural point).

Identify one value pick the market underrates.
Specific Hollywoodbets Golden Boot market CTA.

---

## Article 7 — England Preview (Callum's Personal Take)

**Title:** England at World Cup 2026 — Callum's Honest Assessment of Whether It's Finally Coming Home

**Format:** standard
**Persona:** callum
**Tags:** world-cup-2026, odds-analysis, england
**Word count:** 550
**Publish:** June 10

**Brief:**
Callum as a Scotsman writing honestly about England — use this tension.
He respects the squad quality, is sceptical of the tournament mentality,
and has specific tactical concerns. Cover: Gareth Southgate's legacy
vs new manager's approach, squad depth, Group D path, knockout draw.

This piece should have genuine editorial voice — Callum's dry Scottish
scepticism applied to England's perennial tournament hope.

Hollywoodbets markets: England tournament winner,
England to reach semi-final, first match result vs Serbia.

---

## Generation curl override

If arclink supports title/brief injection via curl, use this pattern
to trigger generation with a custom title instead of the queue default:

```bash
# Override title and brief for a specific queue item
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_ARCLINK_API_KEY" \
  -d '{
    "title": "World Cup 2026 Tournament Winner Betting Guide — Lucky and Callum'\''s Picks",
    "persona": "lucky",
    "additional_context": "World Cup 2026. June 11 start. SA bettor focus. Argentina defending, Brazil favoured, Morocco African hope. Hollywoodbets primary CTA.",
    "tags": ["world-cup-2026", "odds-analysis"],
    "article_format": "dialogue"
  }' \
  "https://YOUR_ARCLINK_URL/posts/YOUR_FOOTBALL_TENANT_ID/generate"
```

If the generate endpoint does not yet accept `additional_context`,
the title alone is enough to guide the generation — the persona
system prompts and blog_subject on the tenant provide the rest.
```

---

## Publish Schedule

| Article | Publish date | Priority |
|---|---|---|
| Tournament winner guide | Today | P1 |
| Group stage betting guide | Today | P1 |
| Brazil preview | Today | P1 |
| Argentina preview | Today | P1 |
| Africa at the World Cup | Today | P1 |
| Golden Boot guide | June 10 | P2 |
| England preview | June 10 | P2 |

All seven pieces should be live before June 11 kickoff.
