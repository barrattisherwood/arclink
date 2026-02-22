# arclink.dev — Platform API Brief

## Overview

arclink.dev is an internal shared services platform built and owned by Machinum (the agency). It provides reusable backend infrastructure that powers multiple client sites and Machinum's own products. Client sites and agency products consume arclink.dev services via API — they do not know or care that arclink powers them. The domain is intentionally brand-neutral.

---

## Architecture Philosophy

- **arclink.dev is infrastructure, not a product.** It is never marketed directly.
- Each client site or product is a **tenant**. Tenants are registered in arclink and issued an API key.
- Services are **configured per tenant**, not rebuilt per project.
- Product-specific business logic lives in that product's own API. arclink only handles generic, reusable concerns.
- Built for a **solo developer** — keep operational overhead low. No over-engineering.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Language:** TypeScript
- **Database:** MongoDB (via Mongoose)
- **Monorepo:** Yes — shared types across services
- **Architecture:** Separate Express services per domain (forms, auth, mail), deployed independently

---

## Phase 1 — Forms & Email Service

This is the first service to build. It is the most immediately useful and lowest complexity.

### What it does

Accepts form submissions from any registered tenant site, validates them, checks for spam, and sends an email to the configured recipient.

### Endpoint

```
POST /submit/:tenantId
```

**Headers required:**
- `x-api-key` — tenant API key
- `Origin` — checked against tenant's allowed origin

**Body:** Any valid JSON object (flexible — fields vary per form)

### Middleware chain (in order)

1. CORS check — validate `Origin` against `tenant.allowed_origin`
2. Rate limiting — per tenant, configurable (default: 10 requests / 15 min per IP)
3. Spam protection — Cloudflare Turnstile token verification
4. Tenant lookup — resolve `tenantId`, validate `x-api-key`, check `active` status
5. Email send — format and fire via Resend
6. Response — return `200 OK` or appropriate error

### Tenant config schema (MongoDB)

```typescript
{
  id: string;                  // UUID
  api_key: string;             // Hashed secret
  name: string;                // Human-readable (e.g. "Machinum Agency Site")
  allowed_origin: string;      // e.g. "https://machinum.io"
  recipient_email: string;     // Where form submissions are sent
  reply_to_field: string;      // Which body field to use as Reply-To (e.g. "email")
  rate_limit: number;          // Requests per window (default 10)
  active: boolean;
  created_at: Date;
}
```

### Email provider

Use **Resend** (resend.com). Clean API, generous free tier, excellent deliverability.

```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
```

### Spam protection

Use **Cloudflare Turnstile** (free, frictionless, privacy-respecting). The client-side widget generates a token on form submit. The service verifies it against Cloudflare's API before processing.

Turnstile verify endpoint:
```
POST https://challenges.cloudflare.com/turnstile/v1/siteverify
```

### Email format

Subject: `New form submission — {tenant.name}`

Body: Dynamically built from all submitted fields (key: value pairs). Reply-To set to the value of `tenant.reply_to_field` from the submission body.

### Error responses

| Scenario | Status |
|---|---|
| Invalid origin | 403 |
| Invalid or missing API key | 401 |
| Turnstile verification failed | 422 |
| Tenant not found or inactive | 404 |
| Rate limit exceeded | 429 |
| Email send failure | 502 |

---

## Environment Variables

```env
PORT=3001
MONGODB_URI=
RESEND_API_KEY=
TURNSTILE_SECRET_KEY=
```

---

## Project Structure

```
arclink/
├── services/
│   └── forms/
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   │   └── submit.ts
│       │   ├── middleware/
│       │   │   ├── cors.ts
│       │   │   ├── rateLimit.ts
│       │   │   └── turnstile.ts
│       │   ├── models/
│       │   │   └── Tenant.ts
│       │   └── services/
│       │       └── email.ts
│       ├── package.json
│       └── tsconfig.json
├── shared/
│   └── types/
│       └── tenant.ts
└── package.json
```

---

## First Tenant — Machinum.io

Once the service is deployed, register Machinum's agency site as the first tenant:

- **name:** Machinum Agency Site
- **allowed_origin:** https://machinum.io
- **recipient_email:** [Barratt's contact email]
- **reply_to_field:** email

This doubles as the dogfood environment. Any bugs or UX issues with the service will be caught here before they affect client projects.

---

## Future Services (Do Not Build Yet)

- `auth.arclink.dev` — JWT issuance, refresh tokens, OAuth. Tenants register their app and delegate authentication here.
- `mail.arclink.dev` — General transactional email service (password resets, notifications etc), separate from form submissions.
- `media.arclink.dev` — File upload and storage abstraction.

---

## Future — Admin Dashboard (Much Later)

A simple internal dashboard at `dashboard.arclink.dev` for managing tenants, viewing form submission logs, rotating API keys, and toggling services. Not a client-facing product — internal tooling only. Architecture decisions made now should not prevent this from being bolted on later (i.e. keep tenant config in the DB from day one, not in env files).

---

## Constraints & Principles

- **No client should ever see "arclink" or "Machinum" branding** in their application's UI or documentation unless intentional.
- All secrets (API keys, Resend key, Turnstile secret) in environment variables — never hardcoded.
- Every config value that could vary per tenant (recipient, origin, rate limit) must be stored in the DB — never hardcoded.
- Keep the forms service stateless beyond the DB lookup — easy to scale or move later.
- TypeScript strict mode throughout.
