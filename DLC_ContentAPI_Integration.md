# DLC Town Planning — Content API Integration Guide

**API Base URL:** `https://content.arclink.dev/api/sites/dlc-townplanning`  
**Environment:** Production  
**Last updated:** March 2026

---

## Overview

This document outlines the integration requirements for the DLC Town Planning CMS Content API. The frontend Angular application consumes content from the API to display projects, services, news, and other dynamic content.

---

## API Endpoints

### 1. Projects

**Endpoint:** `GET /project?published=true`

**Purpose:** Retrieve all published projects for display on the projects page and featured projects on the home page.

**Query Parameters:**
- `published` (boolean, required): Filter for published projects only
- `featured` (boolean, optional): Filter for featured projects only
- `region` (string, optional): Filter by region (e.g., "East Africa", "Southern Africa")
- `category` (string, optional): Filter by category (e.g., "Residential", "Commercial", "Industrial")

**Response Format:**
```json
{
  "data": [
    {
      "id": "string",
      "title": "string",
      "slug": "string",
      "location": "string",
      "region": "string",
      "country": "string",
      "category": "string",
      "description": "string (markdown supported)",
      "image": "string (URL)",
      "images": ["string (URL)", "..."],
      "videoUrl": "string (YouTube/Vimeo URL, optional)",
      "projectUrl": "string (external website URL, optional)",
      "latitude": "number (optional)",
      "longitude": "number (optional)",
      "boundary": ["array of [lat, lng] coordinates (optional)"],
      "featured": "boolean",
      "completionDate": "string (YYYY format or full date)",
      "published": "boolean",
      "createdAt": "ISO 8601 timestamp",
      "updatedAt": "ISO 8601 timestamp"
    }
  ],
  "meta": {
    "total": "number",
    "page": "number",
    "pageSize": "number"
  }
}
```

**Frontend Integration:**
- File: `src/app/services/cms.service.ts`
- Method: `getProjects()` and `getFeaturedProjects()`
- Used by: `ProjectsComponent`, `HomeComponent`

**Example Request:**
```typescript
GET https://content.arclink.dev/api/sites/dlc-townplanning/project?published=true&featured=true
```

---

### 2. Services

**Endpoint:** `GET /service?published=true`

**Purpose:** Retrieve all published services for display on the services page and home page teasers.

**Query Parameters:**
- `published` (boolean, required): Filter for published services only
- `featured` (boolean, optional): Filter for featured services

**Response Format:**
```json
{
  "data": [
    {
      "id": "string",
      "slug": "string",
      "title": "string",
      "summary": "string (short description)",
      "description": "string (full markdown content)",
      "icon": "string (icon identifier: 'land', 'township', 'environment', etc.)",
      "category": "string (optional)",
      "image": "string (URL, optional)",
      "featured": "boolean",
      "published": "boolean",
      "order": "number (for sorting)",
      "createdAt": "ISO 8601 timestamp",
      "updatedAt": "ISO 8601 timestamp"
    }
  ]
}
```

**Frontend Integration:**
- File: `src/app/services/cms.service.ts`
- Method: `getServices()` and `getServiceBySlug(slug: string)`
- Used by: `ServicesComponent`, `ServiceDetailComponent`, `HomeComponent`

**Example Request:**
```typescript
GET https://content.arclink.dev/api/sites/dlc-townplanning/service?published=true
```

---

### 3. About Content

**Endpoint:** `GET /about`

**Purpose:** Retrieve company about information, mission, vision, and pillars.

**Response Format:**
```json
{
  "data": {
    "id": "string",
    "companyStory": "string (markdown)",
    "mission": "string",
    "vision": "string",
    "yearsEstablished": "string (YYYY)",
    "accreditations": ["string", "..."],
    "pillars": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "icon": "string (optional)"
      }
    ],
    "teamMembers": [
      {
        "id": "string",
        "name": "string",
        "title": "string",
        "bio": "string (optional)",
        "email": "string (optional)",
        "image": "string (URL, optional)"
      }
    ],
    "updatedAt": "ISO 8601 timestamp"
  }
}
```

**Frontend Integration:**
- File: `src/app/services/cms.service.ts`
- Method: `getAboutContent()`
- Used by: `AboutComponent`

---

### 4. News/Blog Posts (Future)

**Endpoint:** `GET /post?published=true`

**Purpose:** Retrieve blog posts and news articles.

**Query Parameters:**
- `published` (boolean, required)
- `limit` (number, optional): Number of posts to return
- `category` (string, optional)

**Response Format:**
```json
{
  "data": [
    {
      "id": "string",
      "slug": "string",
      "title": "string",
      "excerpt": "string",
      "content": "string (markdown)",
      "author": "string",
      "category": "string",
      "tags": ["string", "..."],
      "image": "string (URL)",
      "publishedAt": "ISO 8601 timestamp",
      "createdAt": "ISO 8601 timestamp",
      "updatedAt": "ISO 8601 timestamp"
    }
  ]
}
```

---

## Frontend Data Models

### TypeScript Interfaces

Located in: `src/app/services/cms.service.ts`

```typescript
export interface Project {
  id: string;
  title: string;
  slug?: string;
  location: string;
  region: string;
  country: string;
  category: string;
  description: string;
  image?: string;
  images?: string[];
  videoUrl?: string;
  projectUrl?: string;
  latitude?: number;
  longitude?: number;
  boundary?: [number, number][];
  featured?: boolean;
  completionDate?: string;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Service {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  icon: string;
  category?: string;
  image?: string;
  featured?: boolean;
  published?: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AboutContent {
  id: string;
  companyStory: string;
  mission: string;
  vision: string;
  yearsEstablished: string;
  accreditations: string[];
  pillars?: Pillar[];
  teamMembers?: TeamMember[];
  updatedAt?: string;
}

export interface Pillar {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  title: string;
  bio?: string;
  email?: string;
  image?: string;
}
```

---

## Service Implementation

### CMS Service (`src/app/services/cms.service.ts`)

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CmsService {
  private http = inject(HttpClient);
  private apiUrl = 'https://content.arclink.dev/api/sites/dlc-townplanning';

  getProjects(): Observable<Project[]> {
    return this.http.get<{ data: Project[] }>(`${this.apiUrl}/project?published=true`)
      .pipe(map(response => response.data));
  }

  getFeaturedProjects(): Observable<Project[]> {
    return this.http.get<{ data: Project[] }>(`${this.apiUrl}/project?published=true&featured=true`)
      .pipe(map(response => response.data));
  }

  getProjectsByRegion(region: string): Observable<Project[]> {
    return this.http.get<{ data: Project[] }>(`${this.apiUrl}/project?published=true&region=${encodeURIComponent(region)}`)
      .pipe(map(response => response.data));
  }

  getServices(): Observable<Service[]> {
    return this.http.get<{ data: Service[] }>(`${this.apiUrl}/service?published=true`)
      .pipe(map(response => response.data));
  }

  getServiceBySlug(slug: string): Observable<Service | undefined> {
    return this.http.get<{ data: Service[] }>(`${this.apiUrl}/service?published=true&slug=${slug}`)
      .pipe(map(response => response.data[0]));
  }

  getAboutContent(): Observable<AboutContent> {
    return this.http.get<{ data: AboutContent }>(`${this.apiUrl}/about`)
      .pipe(map(response => response.data));
  }
}
```

---

## Component Integration Examples

### Projects Page (`src/app/pages/projects/projects.component.ts`)

```typescript
export class ProjectsComponent implements OnInit {
  private cmsService = inject(CmsService);
  
  projects = signal<Project[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.cmsService.getProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load projects:', error);
        this.loading.set(false);
      }
    });
  }
}
```

### Home Page Featured Projects (`src/app/pages/home/home.component.ts`)

```typescript
export class HomeComponent implements OnInit {
  private cmsService = inject(CmsService);
  
  featuredProjects = signal<Project[]>([]);

  ngOnInit() {
    this.cmsService.getFeaturedProjects().subscribe({
      next: (projects) => {
        this.featuredProjects.set(projects);
      },
      error: (error) => {
        console.error('Failed to load featured projects:', error);
      }
    });
  }
}
```

---

## API Requirements & Constraints

### Required Fields
- All `id` fields must be unique strings (UUID recommended)
- `published` boolean controls visibility on frontend
- `slug` fields must be URL-safe (lowercase, hyphens only)

### Optional Fields
- Fields marked optional can be `null` or omitted from response
- Frontend will handle missing optional fields gracefully

### Image URLs
- Must be fully qualified URLs (https://)
- Recommended formats: JPEG, PNG, WebP
- Recommended sizes:
  - Project cards: 800x600px minimum
  - Hero images: 1920x1080px minimum
  - Thumbnails: 400x300px

### Video URLs
- Supported: YouTube, Vimeo
- Format: Full video URL (e.g., `https://www.youtube.com/watch?v=...`)
- Frontend extracts video ID and converts to embed format

### Markdown Support
- Fields supporting markdown: `description`, `companyStory`, `content`
- Frontend uses markdown parser for rendering
- Supported: headings, lists, bold, italic, links, images

---

## Error Handling

### API Errors

The frontend expects standard HTTP status codes:

- `200 OK` - Successful request
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

**Error Response Format:**
```json
{
  "error": {
    "message": "string",
    "code": "string",
    "details": {}
  }
}
```

### Frontend Fallbacks

- Loading states displayed during API calls
- Error messages shown on failure
- Fallback to placeholder data if API unavailable
- Graceful degradation for missing images

---

## CORS Configuration

The API must allow requests from:
- `http://localhost:4201` (development)
- `https://dlctownplanning.co.za` (production)
- `https://www.dlctownplanning.co.za` (production)

**Required CORS Headers:**
```
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Performance Considerations

### Caching
- API responses should include appropriate cache headers
- Recommended: `Cache-Control: public, max-age=300` (5 minutes)
- ETags supported for conditional requests

### Pagination
- For large datasets, implement pagination with `page` and `pageSize` query params
- Default page size: 50 items
- Include pagination metadata in response

### Response Size
- Keep individual API responses under 1MB
- Use image CDN for large media files
- Return image URLs, not base64 encoded data

---

## Testing Endpoints

### Development Testing

Test the API endpoints using:

```bash
# Get all published projects
curl -X GET "https://content.arclink.dev/api/sites/dlc-townplanning/project?published=true"

# Get featured projects only
curl -X GET "https://content.arclink.dev/api/sites/dlc-townplanning/project?published=true&featured=true"

# Get all services
curl -X GET "https://content.arclink.dev/api/sites/dlc-townplanning/service?published=true"

# Get about content
curl -X GET "https://content.arclink.dev/api/sites/dlc-townplanning/about"
```

---

## Deployment Checklist

- [ ] API endpoints return correct data structure
- [ ] All required fields are populated
- [ ] Image URLs are accessible and properly formatted
- [ ] CORS headers configured for production domains
- [ ] Cache headers configured appropriately
- [ ] Error responses follow standard format
- [ ] Pagination implemented for large datasets
- [ ] SSL certificate valid for `content.arclink.dev`
- [ ] API rate limiting configured (if applicable)
- [ ] Monitoring and logging in place

---

## Contact & Support

**Frontend Developer:** [Contact details]  
**API Developer:** [Contact details]  
**Project Manager:** [Contact details]

**Issue Reporting:**  
Create issues in the project repository with:
- Endpoint URL
- Request parameters
- Expected response
- Actual response
- Timestamp

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-14 | 1.0 | Initial API integration specification |

