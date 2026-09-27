# Phase 5 — Tennis Evergreen Guide Expansion
## Instructions for odds-nx repo agent

---

## Context

You are expanding 12 existing thin tennis articles on `satennisbets.co.za` from ~600–750 words to 1,500+ words each. These are evergreen guides targeting competitive keywords in a YMYL-adjacent niche. Google is currently filtering them from its index due to thin content. Expanding them in place (same slugs, same URLs) is the fix.

The `ResponsibleGamblingComponent` is already injected at the article template level — do not add responsible gambling copy to the article body content.

---

## Your tasks

1. Locate the 12 articles listed below in this repo
2. Expand each one to the word count target in priority order
3. Each expanded article must meet the content requirements listed below
4. Do not change slugs, routes, or filenames
5. Submit all 12 URLs for re-indexing via Search Console after deploy (reminder at end)

---

## Priority order

Work in this sequence — Wimbledon is live right now so it is highest priority:

| Priority | Article | Target words |
|----------|---------|-------------|
| 1 | Wimbledon Betting Preview | 1,800+ |
| 2 | Roland Garros 2026 Preview | 1,800+ |
| 3 | Grass Court Betting Guide | 2,000+ |
| 4 | Clay Court Tennis Betting | 2,000+ |
| 5 | Clay Court Betting Guide (SA) | 2,000+ |
| 6 | ATP Masters 1000 Guide | 1,800+ |
| 7 | WTA Grand Slam Betting Guide | 1,800+ |
| 8 | US Open Preview 2026 | 1,800+ |
| 9 | Set Handicap Betting | 1,600+ |
| 10 | Total Games Betting | 1,600+ |
| 11 | Head-to-Head Records Guide | 1,600+ |
| 12 | Why Short-Odds Favourites Lose | 1,600+ |

---

## Content requirements — every article must include

### 1. At least 4 H2 headings
Restructure existing content under proper headings. Use this as a starting template, adapted per article:

```
H1: [Article Title]
H2: What Is [Topic] Betting?
H2: Key Factors to Analyse
H2: Markets and How They Work
H2: Betting on [Topic] from South Africa
H2: Common Mistakes to Avoid
H2: Frequently Asked Questions
```

Do not use this verbatim on every article — adapt headings to suit the specific topic.

### 2. SA-specific context section (dedicated H2)

Every article must have a section titled something like "Betting on [Topic] from South Africa" covering:
- Which of the three SA bookmakers (Hollywoodbets, Betway, 10bet) offer this market
- Rand staking context (minimum bet sizes where known)
- SA timezone considerations for live betting
- A contextual link to `/bookmakers` using informational anchor text such as "licensed SA bookmakers that cover this market"

### 3. Market breakdown section (dedicated H2)

Expand from naming markets to explaining them. For each relevant market:
- Plain-language explanation of what the market is
- How bookmakers typically price it
- What stats or signals should inform a bet
- A worked example using fictional odds (e.g. "If Alcaraz is priced at 1.65 to win a set...")

### 4. FAQ section (3–4 items)

Add at the end before the responsible gambling component. Target featured snippet opportunities. Example format:

```
**Does surface type affect tennis betting odds?**
Yes — bookmakers adjust lines based on surface statistics, 
but markets often underweight serve dominance on grass vs clay, 
creating value opportunities for bettors who track these splits.
```

### 5. Cross-links

Each article must link to at least one related guide within the site. Surface guides link to each other. Tournament previews link to the weekly preview index (`/analysis`).

---

## Evergreen reframe — applies to items 1, 2, 7, 8

Wimbledon, Roland Garros, WTA Grand Slam, and US Open preview pages must work as perennial guides, not 2026-specific previews. Structure them as:

- **Core evergreen content** (~1,400 words) — what to look for when betting on this tournament, surface characteristics, market analysis, SA bookmaker context, FAQ. This content should be accurate in 2027 and beyond.
- **"2026 Edition" H2 section** (~300–400 words) — current draw context, player form, specific matchups to watch. Clearly labelled so it can be updated each year without touching the evergreen body.

---

## Content rules — mandatory

**Voice:** Maintain Yolandi Coetzee and Damien Farrell editorial personas where the article has a byline. Do not introduce new personas.

**Regulatory compliance:**
- No imperative CTA language — do not write "bet now", "back", "sign up", "claim", "place a wager on"
- Describe bookmaker features factually, not as benefits ("Hollywoodbets offers live in-play markets on selected matches" not "never miss a live bet")
- Any bonus or offer reference must be followed by "Subject to terms and conditions"
- Frame everything as analytical and informational throughout

**No padding:** Every paragraph must answer a real question a bettor in South Africa would have. Do not add filler content to hit the word count.

---

## SeoService check

While expanding each article, verify its SeoService call includes:
- A distinct, keyword-rich title (not just the article headline)
- A meta description between 140–160 characters
- A self-referencing canonical URL

Add or correct these where missing.

---

## After deploy

Submit all 12 URLs for re-indexing via Google Search Console URL Inspection tool. Do this immediately after deploy — do not wait for Google to discover the changes organically. The URLs are:

```
https://www.satennisbets.co.za/[slug]
```

Find the exact slugs by checking the routes in the Angular app before deploying.

---

## Definition of done

- [ ] All 12 articles at or above target word count
- [ ] All 12 have 4+ H2 headings
- [ ] All 12 have an SA-specific context section with link to /bookmakers
- [ ] All 12 have a FAQ section
- [ ] All 12 cross-link to at least one related article
- [ ] Wimbledon and Roland Garros reframed as evergreen with labelled 2026 section
- [ ] No prohibited CTA language in any article
- [ ] SeoService correctly configured on all 12
- [ ] All 12 URLs submitted for re-indexing post-deploy
