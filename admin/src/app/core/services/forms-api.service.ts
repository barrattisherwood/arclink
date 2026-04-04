import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface FormSubmission {
  _id: string;
  tenant_id: string;
  tenant_name: string;
  fields: Record<string, unknown>;
  submitted_at: string;
}

@Injectable({ providedIn: 'root' })
export class FormsApiService {
  private http = inject(HttpClient);
  private base = environment.formsApiUrl;

  private get headers(): HttpHeaders {
    return new HttpHeaders();
  }

  getSubmissions(tenantId: string, params?: { limit?: number; offset?: number }) {
    let httpParams = new HttpParams();
    if (params?.limit) httpParams = httpParams.set('limit', params.limit);
    if (params?.offset) httpParams = httpParams.set('offset', params.offset);
    return this.http.get<{ submissions: FormSubmission[]; total: number; limit: number; offset: number }>(
      `${this.base}/submissions/${tenantId}`, { headers: this.headers, params: httpParams }
    );
  }

  deleteSubmission(tenantId: string, id: string) {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/submissions/${tenantId}/${id}`, { headers: this.headers }
    );
  }
}
