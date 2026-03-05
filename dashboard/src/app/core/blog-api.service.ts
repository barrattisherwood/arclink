import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TitleSuggestion {
  title: string;
  rationale: string;
}

export interface QueueItem {
  id: string;
  title: string;
  priority: number;
  notes: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: 'draft' | 'scheduled' | 'published';
  tags: string[];
  word_count: number;
  generated: boolean;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  content?: string;
  featured_image: {
    url: string;
    alt: string;
    credit: { photographer: string; photographer_url: string; unsplash_url: string };
  } | null;
}

@Injectable({ providedIn: 'root' })
export class BlogApiService {
  private http = inject(HttpClient);
  private base = environment.blogApiUrl;
  private tenantId = environment.blogTenantId;

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'x-api-key': environment.blogApiKey });
  }

  // Suggestions
  suggest(count = 5): Observable<{ suggestions: TitleSuggestion[] }> {
    return this.http.post<{ suggestions: TitleSuggestion[] }>(
      `${this.base}/suggest/${this.tenantId}`,
      { count },
      { headers: this.headers },
    );
  }

  // Queue
  getQueue(): Observable<{ items: QueueItem[] }> {
    return this.http.get<{ items: QueueItem[] }>(
      `${this.base}/queue/${this.tenantId}`,
      { headers: this.headers },
    );
  }

  addToQueue(titles: string[]): Observable<{ items: QueueItem[] }> {
    return this.http.post<{ items: QueueItem[] }>(
      `${this.base}/queue/${this.tenantId}`,
      { titles: titles.map(title => ({ title })) },
      { headers: this.headers },
    );
  }

  reorderQueue(ids: string[]): Observable<{ items: QueueItem[] }> {
    return this.http.patch<{ items: QueueItem[] }>(
      `${this.base}/queue/${this.tenantId}`,
      { ids },
      { headers: this.headers },
    );
  }

  removeFromQueue(titleId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/queue/${this.tenantId}/${titleId}`,
      { headers: this.headers },
    );
  }

  prioritise(): Observable<{ items: QueueItem[]; reasoning: string }> {
    return this.http.post<{ items: QueueItem[]; reasoning: string }>(
      `${this.base}/prioritise/${this.tenantId}`,
      {},
      { headers: this.headers },
    );
  }

  // Generation
  generate(): Observable<{ post: Post }> {
    return this.http.post<{ post: Post }>(
      `${this.base}/generate/${this.tenantId}`,
      {},
      { headers: this.headers },
    );
  }

  // Posts
  getDrafts(): Observable<{ posts: Post[] }> {
    return this.http.get<{ posts: Post[] }>(
      `${this.base}/posts/${this.tenantId}/drafts`,
      { headers: this.headers },
    );
  }

  getPublished(): Observable<{ posts: Post[]; total: number; pages: number }> {
    return this.http.get<{ posts: Post[]; total: number; pages: number }>(
      `${this.base}/posts/${this.tenantId}`,
    );
  }

  approvePost(postId: string): Observable<{ post: Post }> {
    return this.http.patch<{ post: Post }>(
      `${this.base}/posts/${this.tenantId}/${postId}`,
      { status: 'scheduled' },
      { headers: this.headers },
    );
  }

  getPost(postId: string): Observable<{ post: Post }> {
    return this.http.get<{ post: Post }>(
      `${this.base}/posts/${this.tenantId}/preview/${postId}`,
      { headers: this.headers },
    );
  }

  regenerateImage(postId: string, keyword?: string): Observable<{ post: Post }> {
    return this.http.post<{ post: Post }>(
      `${this.base}/posts/${this.tenantId}/${postId}/regenerate-image`,
      keyword ? { keyword } : {},
      { headers: this.headers },
    );
  }

  deletePost(postId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/posts/${this.tenantId}/${postId}`,
      { headers: this.headers },
    );
  }
}
