import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ContentType } from '../../models/content-type.model';
import { ContentEntry } from '../../models/content-entry.model';

@Injectable({ providedIn: 'root' })
export class ContentApiService {
  private http = inject(HttpClient);
  private base = environment.contentApiUrl;

  // Sites (super-admin)
  getSites() {
    return this.http.get<{ sites: { siteId: string; name: string; domain?: string; active: boolean }[] }>(
      `${this.base}/sites`
    );
  }

  // Content Types
  getTypes(siteId: string) {
    return this.http.get<{ types: ContentType[] }>(`${this.base}/types/${siteId}`);
  }

  getType(siteId: string, slug: string) {
    return this.http.get<ContentType>(`${this.base}/types/${siteId}/${slug}`);
  }

  // Entries
  getEntries(siteId: string, typeSlug: string, params?: Record<string, any>) {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => httpParams = httpParams.set(k, v));
    }
    return this.http.get<{ entries: ContentEntry[]; total: number; limit: number; offset: number }>(
      `${this.base}/entries/${siteId}/${typeSlug}`, { params: httpParams }
    );
  }

  getEntry(siteId: string, typeSlug: string, slug: string) {
    return this.http.get<ContentEntry>(`${this.base}/entries/${siteId}/${typeSlug}/${slug}`);
  }

  createEntry(siteId: string, typeSlug: string, data: any) {
    return this.http.post<ContentEntry>(`${this.base}/entries/${siteId}/${typeSlug}`, data);
  }

  updateEntry(siteId: string, typeSlug: string, slug: string, data: any) {
    return this.http.patch<ContentEntry>(`${this.base}/entries/${siteId}/${typeSlug}/${slug}`, data);
  }

  deleteEntry(siteId: string, typeSlug: string, slug: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/entries/${siteId}/${typeSlug}/${slug}`);
  }

  togglePublish(siteId: string, typeSlug: string, slug: string) {
    return this.http.post<{ published: boolean }>(`${this.base}/entries/${siteId}/${typeSlug}/${slug}/publish`, {});
  }

  // Upload
  uploadFile(siteId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string; publicId: string; width: number; height: number }>(
      `${this.base}/upload/${siteId}`, form
    );
  }

  uploadBatch(siteId: string, files: File[]) {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    return this.http.post<{ images: { url: string; publicId: string; width: number; height: number }[] }>(
      `${this.base}/upload/${siteId}/batch`, form
    );
  }
}
