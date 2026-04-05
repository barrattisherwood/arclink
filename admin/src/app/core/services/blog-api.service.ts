import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Post, QueueItem, TitleSuggestion, FixtureEntry } from '../../models/blog.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class BlogApiService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = environment.blogApiUrl;
  private tenantId = environment.blogTenantId;

  setActiveTenant(tenantId: string): void {
    this.tenantId = tenantId;
  }

  private get headers(): HttpHeaders {
    const token = this.auth.getToken();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  // Queue
  suggest(count: number) {
    return this.http.post<{ suggestions: TitleSuggestion[] }>(
      `${this.base}/suggest/${this.tenantId}`, { count }, { headers: this.headers }
    );
  }

  getQueue() {
    return this.http.get<{ items: QueueItem[] }>(
      `${this.base}/queue/${this.tenantId}`, { headers: this.headers }
    );
  }

  addToQueue(titles: Array<{ title: string; persona_tag?: string; fixtures?: FixtureEntry[] }>) {
    return this.http.post<{ items: QueueItem[] }>(
      `${this.base}/queue/${this.tenantId}`, { titles }, { headers: this.headers }
    );
  }

  reorderQueue(ids: string[]) {
    return this.http.patch<{ items: QueueItem[] }>(
      `${this.base}/queue/${this.tenantId}`, { ids }, { headers: this.headers }
    );
  }

  removeFromQueue(titleId: string) {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/queue/${this.tenantId}/${titleId}`, { headers: this.headers }
    );
  }

  prioritise() {
    return this.http.post<{ items: QueueItem[]; reasoning: string }>(
      `${this.base}/prioritise/${this.tenantId}`, {}, { headers: this.headers }
    );
  }

  generate() {
    return this.http.post<{ post: Post }>(
      `${this.base}/generate/${this.tenantId}`, {}, { headers: this.headers }
    );
  }

  // Posts
  getDrafts() {
    return this.http.get<{ posts: Post[] }>(
      `${this.base}/posts/${this.tenantId}/drafts`, { headers: this.headers }
    );
  }

  getScheduled() {
    return this.http.get<{ posts: Post[] }>(
      `${this.base}/posts/${this.tenantId}/scheduled`, { headers: this.headers }
    );
  }

  reorderScheduled(ids: string[]) {
    return this.http.patch<{ posts: Post[] }>(
      `${this.base}/posts/${this.tenantId}/scheduled/reorder`, { ids }, { headers: this.headers }
    );
  }

  getPublished(page = 1, limit = 20) {
    return this.http.get<{ posts: Post[]; total: number; pages: number }>(
      `${this.base}/posts/${this.tenantId}?page=${page}&limit=${limit}`, { headers: this.headers }
    );
  }

  getPost(postId: string) {
    return this.http.get<{ post: Post }>(
      `${this.base}/posts/${this.tenantId}/preview/${postId}`, { headers: this.headers }
    );
  }

  updatePost(postId: string, data: Partial<Post>) {
    return this.http.patch<{ post: Post }>(
      `${this.base}/posts/${this.tenantId}/${postId}`, data, { headers: this.headers }
    );
  }

  publishPost(postId: string) {
    return this.http.patch<{ post: Post }>(
      `${this.base}/posts/${this.tenantId}/${postId}`, { status: 'published' }, { headers: this.headers }
    );
  }

  deletePost(postId: string) {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/posts/${this.tenantId}/${postId}`, { headers: this.headers }
    );
  }

  featurePost(postId: string) {
    return this.http.post<{ post: Post }>(
      `${this.base}/posts/${this.tenantId}/${postId}/feature`, {}, { headers: this.headers }
    );
  }

  checkTenant(siteId: string) {
    return this.http.get<{ exists: boolean; tenantId?: string }>(
      `${this.base}/tenant/${siteId}`
    ).pipe(
      tap(res => { if (res.tenantId) this.setActiveTenant(res.tenantId); })
    );
  }

  uploadImage(postId: string, image: string, alt?: string) {
    return this.http.post<{ post: Post }>(
      `${this.base}/posts/${this.tenantId}/${postId}/upload-image`, { image, alt }, { headers: this.headers }
    );
  }

  regenerateImage(postId: string, keyword?: string) {
    return this.http.post<{ post: Post }>(
      `${this.base}/posts/${this.tenantId}/${postId}/regenerate-image`,
      keyword ? { keyword } : {},
      { headers: this.headers }
    );
  }
}
