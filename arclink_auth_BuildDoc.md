# arclink — JWT Authentication Feature
**Scope:** All services in the arclink monorepo  
**Services affected:** `services/content`, `services/forms`, `services/blog`  
**New service:** `services/auth`  
**Shared:** `shared/types/auth.ts`, `shared/middleware/auth.ts`  
**Last updated:** March 2026

---

## 1. Overview

JWT authentication is to be implemented consistently across all arclink services in a single feature sprint. No service should have partial auth — it goes in everywhere at once.

**Approach:**
- A dedicated `services/auth` handles registration, login, and token issuance
- A shared middleware in `shared/middleware/auth.ts` is imported by every service
- All services share the same `JWT_SECRET` environment variable
- Two roles: `super-admin` (Machinum.io) and `client` (tenant user)
- No auth on public GET endpoints (published content is public)
- Auth required on all write operations (POST, PATCH, DELETE) and admin reads

---

## 2. Shared Types

### shared/types/auth.ts

```typescript
export type UserRole = 'super-admin' | 'client'

export interface JwtPayload {
  userId:  string
  siteId:  string       // '*' for super-admin (all sites)
  role:    UserRole
  email:   string
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}
```

---

## 3. Shared Middleware

### shared/middleware/auth.ts

Create this file. Every service imports it directly.

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '../types/auth'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'super-admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  })
}

export function requireSiteAccess(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const { siteId } = req.params
    const user = req.user!
    if (user.role === 'super-admin') return next()
    if (user.siteId !== siteId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  })
}
```

---

## 4. Auth Service

### services/auth — File Structure

```
services/auth/
├── .env
├── .env.example
├── nixpacks.toml
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── middleware/
    │   ├── cors.ts
    │   └── rateLimit.ts
    ├── models/
    │   └── User.ts
    ├── routes/
    │   ├── login.ts
    │   ├── register.ts
    │   └── me.ts
    └── scripts/
        └── seed-super-admin.ts
```

---

### .env.example

```env
PORT=3004
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-shared-jwt-secret
JWT_EXPIRES_IN=7d
```

> ⚠️ JWT_SECRET must be identical across all services. Set it in Railway per service, same value.

---

### src/models/User.ts

```typescript
import mongoose, { Schema, Document } from 'mongoose'
import bcrypt from 'bcryptjs'
import { UserRole } from '../../../shared/types/auth'

export interface IUser extends Document {
  email:        string
  passwordHash: string
  role:         UserRole
  siteId:       string       // '*' for super-admin
  createdAt:    Date
  comparePassword(password: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>({
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['super-admin', 'client'], required: true },
  siteId:       { type: String, required: true },
}, { timestamps: true })

UserSchema.methods.comparePassword = async function(password: string) {
  return bcrypt.compare(password, this.passwordHash)
}

export default mongoose.model<IUser>('User', UserSchema)
```

---

### src/routes/login.ts

```typescript
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  const user = await User.findOne({ email })
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign(
    { userId: user._id, siteId: user.siteId, role: user.role, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

  res.json({ token, role: user.role, siteId: user.siteId })
})

export default router
```

---

### src/routes/register.ts

```typescript
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User'
import { requireSuperAdmin } from '../../../shared/middleware/auth'

const router = Router()

// Only super-admin can create new users
router.post('/register', requireSuperAdmin, async (req, res) => {
  const { email, password, role, siteId } = req.body
  if (!email || !password || !role || !siteId) {
    return res.status(400).json({ error: 'email, password, role and siteId required' })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await User.create({ email, passwordHash, role, siteId })
  res.status(201).json({ userId: user._id, email: user.email, role: user.role })
})

export default router
```

---

### src/routes/me.ts

```typescript
import { Router } from 'express'
import { requireAuth } from '../../../shared/middleware/auth'

const router = Router()

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user)
})

export default router
```

---

### src/scripts/seed-super-admin.ts

Run once to create the Machinum.io super-admin account.

```typescript
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import User from '../models/User'

dotenv.config()

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI!)

  const email    = 'barratt@machinum.io'   // update as needed
  const password = process.env.ADMIN_SEED_PASSWORD!

  if (!password) {
    console.error('Set ADMIN_SEED_PASSWORD in .env before running')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await User.findOneAndUpdate(
    { email },
    { email, passwordHash, role: 'super-admin', siteId: '*' },
    { upsert: true, new: true }
  )

  console.log(`Super-admin seeded: ${email}`)
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
```

---

### src/index.ts

```typescript
import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { corsMiddleware } from './middleware/cors'
import { rateLimitMiddleware } from './middleware/rateLimit'
import loginRouter from './routes/login'
import registerRouter from './routes/register'
import meRouter from './routes/me'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3004

app.use(express.json())
app.use(corsMiddleware)
app.use(rateLimitMiddleware)

app.use('/api/auth', loginRouter)
app.use('/api/auth', registerRouter)
app.use('/api/auth', meRouter)

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'auth' }))

mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('MongoDB connected')
    app.listen(PORT, () => console.log(`Auth service running on port ${PORT}`))
  })
  .catch(err => { console.error(err); process.exit(1) })
```

---

## 5. Applying Auth to Existing Services

Once `services/auth` is deployed, apply the shared middleware to each service.

### services/content

Replace the `// TODO: auth middleware` comments with real middleware:

```typescript
import { requireAuth, requireSuperAdmin, requireSiteAccess } from '../../../shared/middleware/auth'

// types routes
router.post('/:siteId/types',         requireSuperAdmin,   createContentType)
router.patch('/:siteId/types/:slug',  requireSuperAdmin,   updateContentType)
router.delete('/:siteId/types/:slug', requireSuperAdmin,   deleteContentType)
router.get('/:siteId/types',          requireSiteAccess,   listContentTypes)
router.get('/:siteId/types/:slug',    requireSiteAccess,   getContentType)

// entries routes — public reads, auth writes
router.get('/:siteId/:typeSlug',              /* public */         listEntries)
router.get('/:siteId/:typeSlug/:slug',        /* public */         getEntry)
router.post('/:siteId/:typeSlug',             requireSiteAccess,   createEntry)
router.patch('/:siteId/:typeSlug/:slug',      requireSiteAccess,   updateEntry)
router.delete('/:siteId/:typeSlug/:slug',     requireSiteAccess,   deleteEntry)
router.post('/:siteId/:typeSlug/:slug/publish', requireSiteAccess, togglePublish)

// upload routes
router.post('/:siteId',       requireSiteAccess,  uploadSingle)
router.post('/:siteId/batch', requireSiteAccess,  uploadBatch)
```

### services/forms and services/blog

Apply `requireAuth` or `requireSiteAccess` to any write/admin routes following the same pattern.

---

## 6. Environment Variables — All Services

Add `JWT_SECRET` to every service on Railway. Same value across all:

```bash
railway service auth     && railway variables set JWT_SECRET=xxx
railway service content  && railway variables set JWT_SECRET=xxx
railway service forms    && railway variables set JWT_SECRET=xxx
railway service blog     && railway variables set JWT_SECRET=xxx
```

---

## 7. API Summary

```
POST   /api/auth/login        { email, password } → { token, role, siteId }
POST   /api/auth/register     (super-admin only) → create client user
GET    /api/auth/me           (auth required) → current user payload
```

---

## 8. Build Order

```
Step 1   shared/types/auth.ts         UserRole, JwtPayload, Express Request extension
Step 2   shared/middleware/auth.ts    requireAuth, requireSuperAdmin, requireSiteAccess
Step 3   services/auth scaffold       Mirror services/forms structure
Step 4   User model                   Email, passwordHash, role, siteId
Step 5   Login route                  POST /api/auth/login
Step 6   Register route               POST /api/auth/register (super-admin only)
Step 7   Me route                     GET /api/auth/me
Step 8   Seed super-admin             Run seed-super-admin.ts
Step 9   Deploy auth service          Railway — set env vars, verify /health
Step 10  Apply to services/content    Wire requireSiteAccess / requireSuperAdmin
Step 11  Apply to services/forms      Same pattern
Step 12  Apply to services/blog       Same pattern
Step 13  Update JWT_SECRET            Set on all Railway services — same value
Step 14  Smoke test                   Login → get token → hit protected route
```

---

## 9. Dependencies to Add

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.x",
    "bcryptjs": "^2.x"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.x",
    "@types/bcryptjs": "^2.x"
  }
}
```

Add to `services/auth/package.json` and also `jsonwebtoken` + `@types/jsonwebtoken` to any service importing the shared middleware.

---

## 10. Out of Scope

- Refresh tokens (JWT expiry handled by re-login for now)
- Password reset flow
- Email verification
- OAuth / social login
- Session management

---

*Implement in one sprint across all services. Do not partially implement per service.*
