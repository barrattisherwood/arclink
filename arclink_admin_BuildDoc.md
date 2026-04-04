# admin.arclink.dev — Build Brief
**Project:** Unified admin frontend — Machinum.io shared infrastructure  
**Stack:** Angular 18+, TailwindCSS, Angular Signals  
**Hosted:** Vercel  
**Part of:** arclink.dev microservices platform  
**Companion docs:** arclink_content_BuildDoc.md, arclink_auth_BuildDoc.md  
**Last updated:** March 2026

---

## 1. Overview

admin.arclink.dev is the single Angular admin application for all Machinum.io client sites. Clients manage their content, view form submissions, and control site settings — one login, one interface.

**Core principles:**
- One Angular app, multi-tenant via `siteId`
- Forms and content lists are **dynamically generated from API schema** — no hardcoded forms per client
- Auth is deferred — implement as open routes for now, wire JWT when `services/auth` is built
- Cloudinary handles all image uploads via the content API's `/upload` endpoint
- New microservice = new sidebar section, no structural refactor

---

## 2. Project Structure

```
admin.arclink.dev/
├── angular.json
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── .env.example
└── src/
    ├── main.ts
    ├── app/
    │   ├── app.component.ts
    │   ├── app.config.ts
    │   ├── app.routes.ts
    │   │
    │   ├── core/
    │   │   ├── interceptors/
    │   │   │   └── auth.interceptor.ts
    │   │   ├── guards/
    │   │   │   ├── auth.guard.ts
    │   │   │   └── super-admin.guard.ts
    │   │   └── services/
    │   │       ├── auth.service.ts
    │   │       ├── content-api.service.ts
    │   │       ├── forms-api.service.ts
    │   │       └── upload.service.ts
    │   │
    │   ├── shared/
    │   │   ├── components/
    │   │   │   ├── sidebar/
    │   │   │   ├── topbar/
    │   │   │   └── toast/
    │   │   └── layout/
    │   │       └── shell.component.ts
    │   │
    │   ├── features/
    │   │   ├── auth/
    │   │   │   └── login/
    │   │   ├── dashboard/
    │   │   ├── content/
    │   │   │   ├── entry-list/
    │   │   │   └── entry-form/
    │   │   │       └── fields/           ← dynamic field components live here
    │   │   ├── forms/
    │   │   │   └── submissions/
    │   │   ├── settings/
    │   │   └── super-admin/
    │   │       ├── sites/
    │   │       └── schema/
    │   │
    │   └── models/
    │       ├── content-type.model.ts
    │       ├── content-entry.model.ts
    │       └── tenant.model.ts
    │
    └── environments/
        ├── environment.ts
        └── environment.prod.ts
```

---

## 3. Environment Variables

```env
CONTENT_API_URL=https://content.arclink.dev
FORMS_API_URL=https://forms.arclink.dev
AUTH_API_URL=https://auth.arclink.dev
```

`environment.ts`:
```typescript
export const environment = {
  production: false,
  contentApiUrl: 'http://localhost:3003',
  formsApiUrl:   'http://localhost:3001',
  authApiUrl:    'http://localhost:3004',
}
```

---

## 4. Routes

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component') },

  {
    path: 'sites/:siteId',
    component: ShellComponent,
    // canActivate: [AuthGuard],        // TODO: wire when auth service is live
    children: [
      { path: '',        loadComponent: () => import('./features/dashboard/dashboard.component') },
      { path: 'content/:typeSlug',     loadComponent: () => import('./features/content/entry-list/entry-list.component') },
      { path: 'content/:typeSlug/new', loadComponent: () => import('./features/content/entry-form/entry-form.component') },
      { path: 'content/:typeSlug/:slug', loadComponent: () => import('./features/content/entry-form/entry-form.component') },
      { path: 'forms',                 loadComponent: () => import('./features/forms/submissions/submissions.component') },
      { path: 'settings',              loadComponent: () => import('./features/settings/settings.component') },
    ]
  },

  {
    path: 'admin',
    component: ShellComponent,
    // canActivate: [AuthGuard, SuperAdminGuard],   // TODO: wire when auth service is live
    children: [
      { path: '',                      loadComponent: () => import('./features/super-admin/sites/sites.component') },
      { path: 'sites/:siteId/schema',  loadComponent: () => import('./features/super-admin/schema/schema.component') },
    ]
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
]
```

---

## 5. Models

### src/app/models/content-type.model.ts

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

export interface ContentType {
  _id:       string
  siteId:    string
  name:      string
  slug:      string
  fields:    FieldDefinition[]
  createdAt: string
  updatedAt: string
}

export interface Coordinates {
  lat: number
  lng: number
}
```

### src/app/models/content-entry.model.ts

```typescript
export interface ContentEntry {
  _id:             string
  siteId:          string
  contentTypeSlug: string
  slug:            string
  published:       boolean
  data:            Record<string, any>
  createdAt:       string
  updatedAt:       string
}
```

---

## 6. Core Services

### src/app/core/services/content-api.service.ts

```typescript
import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { environment } from '../../../environments/environment'
import { ContentType } from '../../models/content-type.model'
import { ContentEntry } from '../../models/content-entry.model'

@Injectable({ providedIn: 'root' })
export class ContentApiService {
  private http = inject(HttpClient)
  private base = environment.contentApiUrl

  // Content Types
  getTypes(siteId: string) {
    return this.http.get<ContentType[]>(`${this.base}/api/sites/${siteId}/types`)
  }

  getType(siteId: string, slug: string) {
    return this.http.get<ContentType>(`${this.base}/api/sites/${siteId}/types/${slug}`)
  }

  // Entries
  getEntries(siteId: string, typeSlug: string, params?: Record<string, any>) {
    let httpParams = new HttpParams()
    if (params) Object.entries(params).forEach(([k, v]) => httpParams = httpParams.set(k, v))
    return this.http.get<ContentEntry[]>(`${this.base}/api/sites/${siteId}/${typeSlug}`, { params: httpParams })
  }

  getEntry(siteId: string, typeSlug: string, slug: string) {
    return this.http.get<ContentEntry>(`${this.base}/api/sites/${siteId}/${typeSlug}/${slug}`)
  }

  createEntry(siteId: string, typeSlug: string, data: Partial<ContentEntry>) {
    return this.http.post<ContentEntry>(`${this.base}/api/sites/${siteId}/${typeSlug}`, data)
  }

  updateEntry(siteId: string, typeSlug: string, slug: string, data: Partial<ContentEntry>) {
    return this.http.patch<ContentEntry>(`${this.base}/api/sites/${siteId}/${typeSlug}/${slug}`, data)
  }

  deleteEntry(siteId: string, typeSlug: string, slug: string) {
    return this.http.delete(`${this.base}/api/sites/${siteId}/${typeSlug}/${slug}`)
  }

  togglePublish(siteId: string, typeSlug: string, slug: string) {
    return this.http.post<ContentEntry>(`${this.base}/api/sites/${siteId}/${typeSlug}/${slug}/publish`, {})
  }
}
```

### src/app/core/services/upload.service.ts

```typescript
import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../../environments/environment'

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient)
  private base = environment.contentApiUrl

  uploadSingle(siteId: string, typeSlug: string, file: File) {
    const form = new FormData()
    form.append('file', file)
    form.append('typeSlug', typeSlug)
    return this.http.post<{ url: string }>(`${this.base}/api/upload/${siteId}`, form)
  }

  uploadBatch(siteId: string, typeSlug: string, files: File[]) {
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    form.append('typeSlug', typeSlug)
    return this.http.post<{ urls: string[] }>(`${this.base}/api/upload/${siteId}/batch`, form)
  }
}
```

### src/app/core/services/auth.service.ts

```typescript
import { Injectable, signal } from '@angular/core'

export type UserRole = 'super-admin' | 'client'

export interface AuthUser {
  userId: string
  siteId: string
  role:   UserRole
  email:  string
  token:  string
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<AuthUser | null>(null)
  readonly user = this._user.asReadonly()

  // TODO: replace with real auth.arclink.dev call when auth service is live
  // For now, set user manually during development:
  setDevUser(siteId: string, role: UserRole = 'super-admin') {
    this._user.set({ userId: 'dev', siteId, role, email: 'dev@machinum.io', token: 'dev-token' })
  }

  get isLoggedIn() { return this._user() !== null }
  get isSuperAdmin() { return this._user()?.role === 'super-admin' }
  get currentSiteId() { return this._user()?.siteId ?? null }

  logout() { this._user.set(null) }
}
```

---

## 7. Shell Layout

### src/app/shared/layout/shell.component.ts

```typescript
import { Component, inject, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { ActivatedRoute } from '@angular/router'
import { ContentApiService } from '../../core/services/content-api.service'
import { ContentType } from '../../models/content-type.model'
import { SidebarComponent } from '../components/sidebar/sidebar.component'
import { TopbarComponent } from '../components/topbar/topbar.component'

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <div class="flex h-screen bg-gray-50">
      <app-sidebar [siteId]="siteId" [contentTypes]="contentTypes" />
      <div class="flex flex-col flex-1 overflow-hidden">
        <app-topbar />
        <main class="flex-1 overflow-y-auto p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class ShellComponent implements OnInit {
  private route   = inject(ActivatedRoute)
  private content = inject(ContentApiService)

  siteId       = ''
  contentTypes: ContentType[] = []

  ngOnInit() {
    this.siteId = this.route.snapshot.params['siteId']
    this.content.getTypes(this.siteId).subscribe(types => this.contentTypes = types)
  }
}
```

---

## 8. Dynamic Form Renderer

This is the core of the admin UI. The entry form component fetches the ContentType schema and renders the appropriate field component for each field.

### src/app/features/content/entry-form/entry-form.component.ts

```typescript
import { Component, inject, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { ContentApiService } from '../../../core/services/content-api.service'
import { ContentType, FieldDefinition } from '../../../models/content-type.model'
import { ContentEntry } from '../../../models/content-entry.model'
import { FieldRendererComponent } from './fields/field-renderer.component'
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms'

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, FieldRendererComponent],
  template: `
    <div *ngIf="contentType" class="max-w-3xl mx-auto">
      <h1 class="text-2xl font-semibold mb-6">{{ isEdit ? 'Edit' : 'New' }} {{ contentType.name }}</h1>

      <form [formGroup]="form" (ngSubmit)="onSave()">
        <!-- Published toggle -->
        <div class="mb-6 flex items-center gap-3">
          <label class="font-medium text-sm">Published</label>
          <input type="checkbox" formControlName="published" />
        </div>

        <!-- Dynamic fields -->
        <div class="space-y-6">
          @for (field of orderedFields; track field.key) {
            <app-field-renderer
              [field]="field"
              [control]="form.get('data.' + field.key)"
              [siteId]="siteId"
              [typeSlug]="typeSlug"
            />
          }
        </div>

        <!-- Errors -->
        <div *ngIf="apiErrors" class="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">
          {{ apiErrors | json }}
        </div>

        <div class="mt-8 flex gap-3">
          <button type="submit" class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            {{ isEdit ? 'Save Changes' : 'Create' }}
          </button>
        </div>
      </form>
    </div>
  `
})
export class EntryFormComponent implements OnInit {
  private route   = inject(ActivatedRoute)
  private content = inject(ContentApiService)
  private fb      = inject(FormBuilder)

  siteId    = ''
  typeSlug  = ''
  entrySlug = ''
  isEdit    = false

  contentType?: ContentType
  entry?:       ContentEntry
  form!:        FormGroup
  apiErrors:    any = null

  get orderedFields(): FieldDefinition[] {
    return [...(this.contentType?.fields ?? [])].sort((a, b) => a.order - b.order)
  }

  ngOnInit() {
    this.siteId    = this.route.snapshot.params['siteId']
    this.typeSlug  = this.route.snapshot.params['typeSlug']
    this.entrySlug = this.route.snapshot.params['slug']
    this.isEdit    = !!this.entrySlug

    this.content.getType(this.siteId, this.typeSlug).subscribe(type => {
      this.contentType = type
      this.buildForm(type)

      if (this.isEdit) {
        this.content.getEntry(this.siteId, this.typeSlug, this.entrySlug).subscribe(entry => {
          this.entry = entry
          this.form.patchValue({ published: entry.published, data: entry.data })
        })
      }
    })
  }

  buildForm(type: ContentType) {
    const dataControls: Record<string, any> = {}
    for (const field of type.fields) {
      dataControls[field.key] = [null, field.required ? Validators.required : []]
    }
    this.form = this.fb.group({
      published: [false],
      data: this.fb.group(dataControls)
    })
  }

  onSave() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return }
    const payload = this.form.value

    const req = this.isEdit
      ? this.content.updateEntry(this.siteId, this.typeSlug, this.entrySlug, payload)
      : this.content.createEntry(this.siteId, this.typeSlug, payload)

    req.subscribe({
      next: () => { /* navigate back to list, show toast */ },
      error: err => this.apiErrors = err.error?.errors ?? err.message
    })
  }
}
```

---

## 9. Field Components

Each FieldType maps to one component. All accept `[field]: FieldDefinition` and `[control]: AbstractControl`.

### Field Type → Component

| FieldType | Component |
|---|---|
| `text` | `TextFieldComponent` |
| `richtext` | `RichTextComponent` — TipTap, stores markdown |
| `url` | `UrlFieldComponent` — input + URL validation indicator |
| `image` | `ImageUploadComponent` — drag/drop, Cloudinary via `/upload` |
| `images` | `ImageGalleryComponent` — multi-upload, drag to reorder |
| `video_url` | `VideoUrlComponent` — URL input + YouTube/Vimeo embed preview |
| `coordinates` | `CoordinatesComponent` — lat/lng number inputs (Maps picker is v2) |
| `boolean` | `ToggleComponent` — labelled toggle switch |
| `select` | `SelectComponent` — dropdown from `field.options[]` |
| `date` | `DatePickerComponent` — native date input, stores ISO string |

### Field Renderer (router component)

```typescript
// src/app/features/content/entry-form/fields/field-renderer.component.ts

@Component({
  selector: 'app-field-renderer',
  standalone: true,
  imports: [
    TextFieldComponent, RichTextComponent, UrlFieldComponent,
    ImageUploadComponent, ImageGalleryComponent, VideoUrlComponent,
    CoordinatesComponent, ToggleComponent, SelectComponent, DatePickerComponent,
    NgSwitch, NgSwitchCase, NgSwitchDefault
  ],
  template: `
    <div class="field-wrapper">
      <label class="block text-sm font-medium text-gray-700 mb-1">
        {{ field.label }}
        <span *ngIf="field.required" class="text-red-500 ml-1">*</span>
      </label>

      <ng-container [ngSwitch]="field.type">
        <app-text-field       *ngSwitchCase="'text'"        [control]="control" />
        <app-rich-text        *ngSwitchCase="'richtext'"    [control]="control" />
        <app-url-field        *ngSwitchCase="'url'"         [control]="control" />
        <app-image-upload     *ngSwitchCase="'image'"       [control]="control" [siteId]="siteId" [typeSlug]="typeSlug" />
        <app-image-gallery    *ngSwitchCase="'images'"      [control]="control" [siteId]="siteId" [typeSlug]="typeSlug" />
        <app-video-url        *ngSwitchCase="'video_url'"   [control]="control" />
        <app-coordinates      *ngSwitchCase="'coordinates'" [control]="control" />
        <app-toggle           *ngSwitchCase="'boolean'"     [control]="control" [label]="field.label" />
        <app-select           *ngSwitchCase="'select'"      [control]="control" [options]="field.options ?? []" />
        <app-date-picker      *ngSwitchCase="'date'"        [control]="control" />
        <app-text-field       *ngSwitchDefault               [control]="control" />
      </ng-container>

      <p *ngIf="field.helpText" class="text-xs text-gray-400 mt-1">{{ field.helpText }}</p>

      <p *ngIf="control?.invalid && control?.touched" class="text-xs text-red-500 mt-1">
        {{ field.label }} is required
      </p>
    </div>
  `
})
export class FieldRendererComponent {
  @Input() field!:    FieldDefinition
  @Input() control!:  AbstractControl | null
  @Input() siteId!:   string
  @Input() typeSlug!: string
}
```

---

## 10. Build Order

Build in this sequence. Each step is independently testable.

```
Step 1   Angular project init     ng new admin --standalone --routing --style=none
                                  Install TailwindCSS, configure tailwind.config.js

Step 2   Models                   content-type.model.ts, content-entry.model.ts, tenant.model.ts

Step 3   Core services            content-api.service.ts, upload.service.ts, auth.service.ts (stub)
                                  Wire HttpClient in app.config.ts

Step 4   Shell layout             shell.component.ts, sidebar.component.ts, topbar.component.ts
                                  Dynamic sidebar from ContentTypes

Step 5   Login page               Static form, calls auth.service.setDevUser() for now
                                  Redirects to /sites/:siteId

Step 6   Dashboard                /sites/:siteId — stats cards, quick actions, recent entries

Step 7   Entry list               /content/:typeSlug — table, pagination, inline publish toggle, delete

Step 8   Text + select fields     TextFieldComponent, SelectComponent, ToggleComponent, UrlFieldComponent
                                  Wire FieldRendererComponent with these four working

Step 9   Entry form (partial)     EntryFormComponent working with text/select/toggle fields
                                  Create + edit + save

Step 10  Image upload fields      ImageUploadComponent, ImageGalleryComponent
                                  Wire to upload.service.ts → content API /upload

Step 11  Remaining field types    RichTextComponent (TipTap), VideoUrlComponent,
                                  CoordinatesComponent, DatePickerComponent

Step 12  Form submissions         /forms — table, mark read, expand row

Step 13  Site settings            /settings — reuses entry form with site-settings type

Step 14  Super-admin views        /admin sites list, schema editor
                                  Lock behind isSuperAdmin check in AuthService

Step 15  Auth wiring              When auth service is live:
                                  - Replace auth.service.ts stub with real JWT login
                                  - Uncomment route guards
                                  - Wire auth interceptor to attach Bearer token
```

---

## 11. Auth Interceptor (stub now, wire later)

```typescript
// src/app/core/interceptors/auth.interceptor.ts

import { HttpInterceptorFn } from '@angular/common/http'
import { inject } from '@angular/core'
import { AuthService } from '../services/auth.service'

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth  = inject(AuthService)
  const token = auth.user()?.token

  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
  }

  return next(req)
}
```

Register in `app.config.ts`:
```typescript
provideHttpClient(withInterceptors([authInterceptor]))
```

---

## 12. Toast Notifications

Every action (save, publish, delete, error) shows a toast. Build a lightweight `ToastService` using Angular Signals — no third-party library needed for v1.

```typescript
@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<{ message: string; type: 'success' | 'error' }[]>([])
  readonly toasts = this._toasts.asReadonly()

  success(message: string) { this.add(message, 'success') }
  error(message: string)   { this.add(message, 'error') }

  private add(message: string, type: 'success' | 'error') {
    this._toasts.update(t => [...t, { message, type }])
    setTimeout(() => this._toasts.update(t => t.slice(1)), 3000)
  }
}
```

---

## 13. Design Guidelines

- **Admin chrome:** neutral greys — never uses client site brand colours
- **Primary action colour:** Machinum.io accent (dark blue or slate)
- **Typography:** Inter
- **Density:** comfortable, this is a tool not a marketing page
- **Empty states:** every list has a meaningful empty state with a CTA
- **Mobile:** functional but desktop-first — admin is not a mobile product

---

## 14. Out of Scope (v1)

- Real auth login page (deferred to auth sprint)
- Route guards (deferred to auth sprint)
- Dark mode
- Mobile-optimised layout
- Content versioning
- Scheduled publishing
- In-admin reply to form submissions
- Notification emails on form submission
- White-labelled admin per client

---

## 15. Open Questions

- [ ] Rich text storage — confirm markdown (not HTML) matches content API
- [ ] Coordinates field — lat/lng inputs only for v1, Google Maps picker for v2?
- [ ] `ng new` command — add any specific flags for current Angular version?
- [ ] admin.arclink.dev DNS — Cloudflare + Vercel setup confirmed?

---

*Follow services/forms conventions for anything not specified here. Cross-reference with arclink_content_BuildDoc.md and arclink_auth_BuildDoc.md during build.*
