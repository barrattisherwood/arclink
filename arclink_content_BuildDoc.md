# arclink / services / content — Build Brief
**Service:** content (Headless CMS API)  
**Monorepo path:** `services/content`  
**Part of:** arclink.dev microservices platform  
**Companion doc:** arclink_admin_BuildDoc.md  
**Pattern reference:** `services/forms`, `services/blog`  
**Last updated:** March 2026

---

## 1. Overview

The `content` service is a multi-tenant, schema-driven headless CMS API. It allows any Machinum.io client site to manage their own content types and entries through a private admin panel, exposed as a clean REST API consumed by Angular frontends.

**Core principles:**
- Follows the exact same structure as `services/forms` and `services/blog`
- Multi-tenant via `siteId` — one running instance, all clients isolated
- Schema-driven — content types and fields defined per tenant, not hardcoded
- Headless — pure REST API, no server-side rendering

---

## 2. File Structure

```
services/content/
├── .env
├── .env.example
├── nixpacks.toml
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── middleware/
    │   ├── auth.ts
    │   ├── cors.ts
    │   └── rateLimit.ts
    ├── models/
    │   ├── Tenant.ts
    │   ├── ContentType.ts
    │   └── ContentEntry.ts
    ├── routes/
    │   ├── sites.ts
    │   ├── types.ts
    │   ├── entries.ts
    │   └── upload.ts
    ├── scripts/
    │   ├── seed-tenant.ts
    │   └── seed-dlc-townplanning.ts
    └── services/
        ├── r2.ts
        └── validate.ts
```

---

## 3. Environment Variables

`.env.example`:
```env
PORT=3003
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-jwt-secret
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=arclink-content
CDN_BASE_URL=https://cdn.arclink.dev
```

---

## 4. package.json

Mirror `services/forms/package.json` exactly. Key dependencies to add:

```json
{
  "name": "@arclink/content",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "seed:dlc": "ts-node src/scripts/seed-dlc-townplanning.ts"
  },
  "dependencies": {
    "express": "^4.18.x",
    "mongoose": "^8.x",
    "cors": "^2.x",
    "dotenv": "^16.x",
    "slugify": "^1.x",
    "@aws-sdk/client-s3": "^3.x",
    "@aws-sdk/s3-request-presigner": "^3.x",
    "multer": "^1.x",
    "uuid": "^9.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "ts-node": "^10.x",
    "ts-node-dev": "^2.x",
    "@types/express": "^4.x",
    "@types/cors": "^2.x",
    "@types/multer": "^1.x",
    "@types/uuid": "^9.x"
  }
}
```

---

## 5. nixpacks.toml

```toml
[phases.build]
cmds = ["npm install", "npm run build"]

[start]
cmd = "npm start"
```

---

## 6. src/index.ts

```typescript
import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { corsMiddleware } from './middleware/cors'
import { rateLimitMiddleware } from './middleware/rateLimit'
import sitesRouter from './routes/sites'
import typesRouter from './routes/types'
import entriesRouter from './routes/entries'
import uploadRouter from './routes/upload'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3003

app.use(express.json())
app.use(corsMiddleware)
app.use(rateLimitMiddleware)

app.use('/api/sites', sitesRouter)
app.use('/api/sites', typesRouter)
app.use('/api/sites', entriesRouter)
app.use('/api/upload', uploadRouter)

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'content' }))

mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('MongoDB connected')
    app.listen(PORT, () => console.log(`Content service running on port ${PORT}`))
  })
  .catch(err => {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  })
```

---

## 7. Models

### src/models/Tenant.ts

Mirror `services/forms/src/models/Tenant.ts` pattern.

```typescript
import mongoose, { Schema, Document } from 'mongoose'

export interface ITenant extends Document {
  siteId: string
  name: string
  domain: string
  adminUsers: string[]
  createdAt: Date
}

const TenantSchema = new Schema<ITenant>({
  siteId:     { type: String, required: true, unique: true },
  name:       { type: String, required: true },
  domain:     { type: String, required: true },
  adminUsers: [{ type: String }],
}, { timestamps: true })

export default mongoose.model<ITenant>('ContentTenant', TenantSchema)
```

---

### src/models/ContentType.ts

```typescript
import mongoose, { Schema, Document } from 'mongoose'

export type FieldType =
  | 'text'
  | 'richtext'
  | 'url'
  | 'image'
  | 'images'
  | 'video_url'
  | 'coordinates'
  | 'boolean'
  | 'select'
  | 'date'

export interface IFieldDefinition {
  key:       string
  label:     string
  type:      FieldType
  required:  boolean
  options?:  string[]
  order:     number
  helpText?: string
}

export interface IContentType extends Document {
  siteId:    string
  name:      string
  slug:      string
  fields:    IFieldDefinition[]
  createdAt: Date
  updatedAt: Date
}

const FieldDefinitionSchema = new Schema<IFieldDefinition>({
  key:      { type: String, required: true },
  label:    { type: String, required: true },
  type:     { type: String, required: true },
  required: { type: Boolean, default: false },
  options:  [{ type: String }],
  order:    { type: Number, default: 0 },
  helpText: { type: String },
}, { _id: false })

const ContentTypeSchema = new Schema<IContentType>({
  siteId: { type: String, required: true },
  name:   { type: String, required: true },
  slug:   { type: String, required: true },
  fields: [FieldDefinitionSchema],
}, { timestamps: true })

ContentTypeSchema.index({ siteId: 1, slug: 1 }, { unique: true })

export default mongoose.model<IContentType>('ContentType', ContentTypeSchema)
```

---

### src/models/ContentEntry.ts

```typescript
import mongoose, { Schema, Document } from 'mongoose'

export interface IContentEntry extends Document {
  siteId:          string
  contentTypeId:   mongoose.Types.ObjectId
  contentTypeSlug: string
  slug:            string
  published:       boolean
  data:            Record<string, any>
  createdAt:       Date
  updatedAt:       Date
}

const ContentEntrySchema = new Schema<IContentEntry>({
  siteId:          { type: String, required: true },
  contentTypeId:   { type: Schema.Types.ObjectId, ref: 'ContentType', required: true },
  contentTypeSlug: { type: String, required: true },
  slug:            { type: String, required: true },
  published:       { type: Boolean, default: false },
  data:            { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true })

ContentEntrySchema.index({ siteId: 1, contentTypeSlug: 1, slug: 1 }, { unique: true })
ContentEntrySchema.index({ siteId: 1, contentTypeSlug: 1, published: 1 })

export default mongoose.model<IContentEntry>('ContentEntry', ContentEntrySchema)
```

---

## 8. Middleware

### src/middleware/auth.ts
Mirror `services/blog/src/middleware/auth.ts`. Verify JWT from `Authorization: Bearer <token>` header. Attach `req.user` with `{ userId, siteId, role }`.

```typescript
// role: 'super-admin' | 'client'
// client role: verify req.params.siteId matches token siteId
// super-admin role: allow all siteIds
```

### src/middleware/cors.ts
Mirror `services/forms/src/middleware/cors.ts`.

### src/middleware/rateLimit.ts
Mirror `services/forms/src/middleware/rateLimit.ts`.

---

## 9. Routes

### src/routes/sites.ts
```
POST   /api/sites                     Create site (super-admin only)
GET    /api/sites/:siteId             Get site details (auth required)
PATCH  /api/sites/:siteId             Update site (super-admin only)
```

### src/routes/types.ts
```
GET    /api/sites/:siteId/types               List content types
POST   /api/sites/:siteId/types               Create content type (super-admin only)
GET    /api/sites/:siteId/types/:slug         Get type + fields
PATCH  /api/sites/:siteId/types/:slug         Update type (super-admin only)
DELETE /api/sites/:siteId/types/:slug         Delete type (super-admin only)
```

### src/routes/entries.ts
```
GET    /api/sites/:siteId/:typeSlug                   List entries
       ?published=true|false                           Filter published
       ?[fieldKey]=[value]                             Filter any select/boolean field
       ?limit=20&offset=0                              Pagination

POST   /api/sites/:siteId/:typeSlug                   Create entry (auth required)
GET    /api/sites/:siteId/:typeSlug/:slug             Get single entry
PATCH  /api/sites/:siteId/:typeSlug/:slug             Update entry (auth required)
DELETE /api/sites/:siteId/:typeSlug/:slug             Delete entry (auth required)
POST   /api/sites/:siteId/:typeSlug/:slug/publish     Toggle published (auth required)
```

**Public reads:** GET list and GET single for published entries — no auth required.
**All writes:** Auth required.

### src/routes/upload.ts
```
POST   /api/upload/:siteId            Upload single file → { url: string }
POST   /api/upload/:siteId/batch      Upload multiple files → { urls: string[] }
```

---

## 10. Services

### src/services/r2.ts

Cloudflare R2 via AWS S3-compatible SDK.

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function uploadToR2(
  siteId: string,
  typeSlug: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const key = `${siteId}/${typeSlug}/${Date.now()}-${filename}`
  await r2.send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME!,
    Key:         key,
    Body:        buffer,
    ContentType: mimeType,
  }))
  return `${process.env.CDN_BASE_URL}/${key}`
}
```

---

### src/services/validate.ts

Validates `ContentEntry.data` against a `ContentType` schema.

```typescript
import { IFieldDefinition } from '../models/ContentType'

export function validateEntryData(
  data: Record<string, any>,
  fields: IFieldDefinition[]
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  for (const field of fields) {
    const value = data[field.key]

    if (field.required && (value === undefined || value === null || value === '')) {
      errors[field.key] = `${field.label} is required`
      continue
    }
    if (value === undefined || value === null) continue

    switch (field.type) {
      case 'url':
      case 'video_url':
        try { new URL(value) } catch {
          errors[field.key] = `${field.label} must be a valid URL`
        }
        break
      case 'coordinates':
        if (typeof value.lat !== 'number' || typeof value.lng !== 'number') {
          errors[field.key] = `${field.label} must have lat and lng as numbers`
        }
        break
      case 'select':
        if (field.options && !field.options.includes(value)) {
          errors[field.key] = `${field.label} must be one of: ${field.options.join(', ')}`
        }
        break
      case 'images':
        if (!Array.isArray(value)) {
          errors[field.key] = `${field.label} must be an array of URLs`
        }
        break
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
```

---

## 11. DLC Town Planning Seed Script

### src/scripts/seed-dlc-townplanning.ts

Run once to create the tenant and all content types for DLC Town Planning.

```typescript
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Tenant from '../models/Tenant'
import ContentType from '../models/ContentType'

dotenv.config()

const SITE_ID = 'dlc-townplanning'

const contentTypes = [
  {
    name: 'Project', slug: 'project',
    fields: [
      { key: 'title',       label: 'Project Title',      type: 'text',        required: true,  order: 1 },
      { key: 'summary',     label: 'Short Summary',       type: 'text',        required: true,  order: 2 },
      { key: 'description', label: 'Full Description',    type: 'richtext',    required: true,  order: 3 },
      { key: 'location',    label: 'Location Name',       type: 'text',        required: true,  order: 4 },
      { key: 'coordinates', label: 'Coordinates',         type: 'coordinates', required: true,  order: 5 },
      { key: 'country',     label: 'Country',             type: 'text',        required: true,  order: 6 },
      { key: 'region',      label: 'Region',              type: 'select',      required: true,  order: 7,
        options: ['south-africa', 'africa', 'international'] },
      { key: 'category',    label: 'Category',            type: 'select',      required: true,  order: 8,
        options: ['master-planning', 'town-planning', 'project-management', 'environmental'] },
      { key: 'images',      label: 'Project Images',      type: 'images',      required: true,  order: 9 },
      { key: 'videoUrl',    label: 'Video URL',           type: 'video_url',   required: false, order: 10 },
      { key: 'projectUrl',  label: 'External URL',        type: 'url',         required: false, order: 11 },
      { key: 'featured',    label: 'Featured Project',    type: 'boolean',     required: false, order: 12 },
    ]
  },
  {
    name: 'Service', slug: 'service',
    fields: [
      { key: 'title',   label: 'Service Title',    type: 'text',     required: true,  order: 1 },
      { key: 'summary', label: 'Short Summary',    type: 'text',     required: true,  order: 2 },
      { key: 'body',    label: 'Full Description', type: 'richtext', required: true,  order: 3 },
      { key: 'icon',    label: 'Icon / Image',     type: 'image',    required: false, order: 4 },
      { key: 'order',   label: 'Display Order',    type: 'text',     required: false, order: 5 },
    ]
  },
  {
    name: 'Pillar', slug: 'pillar',
    fields: [
      { key: 'title',       label: 'Pillar Title', type: 'text',     required: true,  order: 1 },
      { key: 'description', label: 'Description',  type: 'richtext', required: true,  order: 2 },
      { key: 'icon',        label: 'Icon / Image', type: 'image',    required: false, order: 3 },
      { key: 'order',       label: 'Display Order',type: 'text',     required: false, order: 4 },
    ]
  },
  {
    name: 'Team', slug: 'team',
    fields: [
      { key: 'photo',   label: 'Team Photo', type: 'image', required: true,  order: 1 },
      { key: 'caption', label: 'Caption',    type: 'text',  required: false, order: 2 },
    ]
  },
  {
    name: 'Site Settings', slug: 'site-settings',
    fields: [
      { key: 'email',   label: 'Contact Email',    type: 'text',     required: true,  order: 1 },
      { key: 'phone',   label: 'Phone Number',     type: 'text',     required: true,  order: 2 },
      { key: 'address', label: 'Physical Address', type: 'richtext', required: false, order: 3 },
      { key: 'postal',  label: 'Postal Address',   type: 'richtext', required: false, order: 4 },
      { key: 'facebook',label: 'Facebook URL',     type: 'url',      required: false, order: 5 },
      { key: 'linkedin',label: 'LinkedIn URL',     type: 'url',      required: false, order: 6 },
    ]
  },
]

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI!)
  console.log('Connected to MongoDB')

  await Tenant.findOneAndUpdate(
    { siteId: SITE_ID },
    { siteId: SITE_ID, name: 'DLC Town Planning', domain: 'dlcgroup.co.za', adminUsers: [] },
    { upsert: true, new: true }
  )
  console.log('Tenant seeded')

  for (const ct of contentTypes) {
    await ContentType.findOneAndUpdate(
      { siteId: SITE_ID, slug: ct.slug },
      { siteId: SITE_ID, ...ct },
      { upsert: true, new: true }
    )
    console.log(`ContentType seeded: ${ct.name}`)
  }

  console.log('DLC Town Planning seed complete')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
```

---

## 12. Shared Types

Add to `shared/types/content.ts`:

```typescript
export type FieldType =
  | 'text' | 'richtext' | 'url' | 'image' | 'images'
  | 'video_url' | 'coordinates' | 'boolean' | 'select' | 'date'

export interface FieldDefinition {
  key:       string
  label:     string
  type:      FieldType
  required:  boolean
  options?:  string[]
  order:     number
  helpText?: string
}

export interface Coordinates {
  lat: number
  lng: number
}
```

---

## 13. Build Order

```
Step 1   Scaffold          Copy structure from services/forms, update package.json, tsconfig.json, nixpacks.toml
Step 2   Models            Tenant.ts, ContentType.ts, ContentEntry.ts
Step 3   index.ts          Express app, MongoDB connection, route registration, /health endpoint
Step 4   Auth middleware   Mirror services/blog/src/middleware/auth.ts
Step 5   Sites routes      POST + GET /api/sites/:siteId
Step 6   Types routes      Full CRUD for content types
Step 7   Seed script       Run seed-dlc-townplanning.ts — verify in MongoDB
Step 8   R2 service        r2.ts + upload routes — test with real file upload
Step 9   Validate service  validate.ts — test all field types
Step 10  Entries routes    Full CRUD + validation + publish toggle
Step 11  Deploy            Railway — set env vars, verify /health
Step 12  Smoke test        Seed DLC data, hit all endpoints, confirm responses
```

> ✅ After Step 7 — admin UI build can start in parallel
> ✅ After Step 12 — DLC Angular frontend can start consuming the API

---

## 14. Out of Scope (v1)

- Webhooks / build triggers on publish
- Content versioning / revision history
- Scheduled publishing
- Content relationships between types
- Full-text search
- Media library browser
- Role-based permissions beyond super-admin / client

---

## 15. Open Questions

- [ ] R2 bucket — shared `arclink-content` or per-client bucket?
- [ ] Rich text — confirm storing as markdown not HTML
- [ ] Auth microservice — confirm JWT_SECRET is shared across services
- [ ] Railway service name — confirm naming convention (e.g. `arclink-content`)
- [ ] CDN domain — cdn.arclink.dev Cloudflare setup confirmed?

---

*Follow services/forms conventions for anything not specified here. Cross-reference with arclink_admin_BuildDoc.md during build.*
