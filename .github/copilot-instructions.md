# Arclink — Agent Instructions

## Project overview

Arclink is a headless CMS and microservices platform built by Machinum. It consists of:

- `services/auth` — authentication service
- `services/blog` — AI-powered blog generation service (Claude API, persona-based)
- `services/content` — headless CMS content/entry management
- `services/forms` — form submission handling
- `admin/` — Angular admin dashboard for content management
- `dashboard/` — Angular blog dashboard

Deployed on Railway. Shared MongoDB instance across services.

---

## Database scripts — Railway CLI rules

**Never ask for or use the public MongoDB URI (`MONGO_PUBLIC_URL`) to run scripts.**
The public URL exposes root credentials in plaintext on the command line and in shell history.

Always run database scripts using `railway run` from inside the relevant service directory:

```bash
cd services/blog          # or services/content, services/auth, etc.
railway service blog      # link to the correct Railway service
railway run npx ts-node src/scripts/your-script.ts
```

`railway run` injects all private environment variables (including `MONGODB_URI` pointing to the internal private hostname) automatically.

If `railway run` fails with a DNS or connection error for the internal hostname (`mongodb.railway.internal`), **do not fall back to the public URI**. Flag the issue to the developer — the script should be run as a Railway job instead.

---

## Credentials & security

- Service credentials are managed via Railway environment variable interpolation (e.g. `${{MongoDB.MONGO_URL}}`) — never hardcoded
- API keys are hashed with SHA-256 before storage; plaintext keys are only shown once at seed time
- The `mongo` root user is used by Railway internally — scripts should avoid using root credentials where possible

---

## Personas — SA Rugby Bets (betwise-rugby)

The blog tenant for SA Rugby Bets uses two editorial personas stored as system prompts on the `BlogTenant` model:

| Tag | Display name | Role |
|---|---|---|
| `kwagga` | Kwagga van der Berg | SA rugby correspondent — set piece, conditions, provincial context |
| `marcus` | Marcus Webb | Tactics & markets — defensive systems, structural betting analysis |

Persona is resolved at generation time via `resolvePersona()` in `services/blog/src/routes/generate.ts`. Queue items can be pre-tagged with a persona; otherwise one is selected at random from available personas.

The Angular frontend reads the persona tag from `post.tags` to render the correct byline.

---

## Content types — betwise-rugby

The content service has a `fixture` content type for the SA Rugby Bets site (`siteId: betwise-rugby`).
The `featuredBookmakers` field uses the `tags` field type (stores `string[]`).
Valid bookmaker keys: `hollywoodbets`, `betway`, `10bet`, `supabets`, `sportingbet`, `playa`, `wsb`.

---

## Key IDs (production)

| Resource | ID |
|---|---|
| BetWise Rugby blog tenant | `e03819eb-7d15-456d-b108-28e870fa9caa` |
| BetWise Rugby content site | `betwise-rugby` |
