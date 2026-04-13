import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ContentSuggestion } from '../../models/blog.model';
import { BlogApiService } from './blog-api.service';
import { AuthService } from './auth.service';

export interface ApprovePayload {
  title?:         string;
  persona_tag?:   string | null;
  generate_at?:   string;
  publish_at?:    string;
  competition?:   string;
  fixture_label?: string;
}

@Injectable({ providedIn: 'root' })
export class SuggestionsApiService {
  private http = inject(HttpClient);
  private blog = inject(BlogApiService);
  private auth = inject(AuthService);
  private base = environment.blogApiUrl;

  private get headers(): HttpHeaders {
    const token = this.auth.getToken();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  private get tenantId(): string {
    return this.blog.activeTenantId;
  }

  getSuggestions() {
    return this.http.get<{ suggestions: ContentSuggestion[] }>(
      `${this.base}/suggestions/${this.tenantId}`,
      { headers: this.headers }
    );
  }

  getCount() {
    return this.http.get<{ count: number }>(
      `${this.base}/suggestions/${this.tenantId}/count`,
      { headers: this.headers }
    );
  }

  approve(id: string, overrides: ApprovePayload = {}) {
    return this.http.post<{ item: unknown }>(
      `${this.base}/suggestions/${this.tenantId}/${id}/approve`,
      overrides,
      { headers: this.headers }
    );
  }

  dismiss(id: string) {
    return this.http.post<{ ok: boolean }>(
      `${this.base}/suggestions/${this.tenantId}/${id}/dismiss`,
      {},
      { headers: this.headers }
    );
  }

  trigger() {
    return this.http.post<{ ok: boolean; created: number }>(
      `${this.base}/suggestions/${this.tenantId}/trigger`,
      {},
      { headers: this.headers }
    );
  }
}
