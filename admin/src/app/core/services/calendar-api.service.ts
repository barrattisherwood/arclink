import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CalendarEvent, FixtureEntry, CalendarContentType } from '../../models/blog.model';
import { BlogApiService } from './blog-api.service';
import { AuthService } from './auth.service';

export interface ScheduleEventPayload {
  title: string;
  generate_at: string;
  publish_at?: string;
  persona_tag?: string;
  notes?: string;
  fixture_date?: string;
  fixture_label?: string;
  competition?: string;
  fixtures?: FixtureEntry[];
  content_type?: CalendarContentType;
}

export interface UpdateEventPayload {
  title?: string;
  generate_at?: string;
  publish_at?: string | null;
  persona_tag?: string | null;
  notes?: string | null;
  fixture_date?: string | null;
  fixture_label?: string | null;
  competition?: string | null;
  fixtures?: FixtureEntry[];
  content_type?: CalendarContentType;
}

@Injectable({ providedIn: 'root' })
export class CalendarApiService {
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

  getEvents() {
    return this.http.get<{ items: CalendarEvent[] }>(
      `${this.base}/calendar/${this.blog.activeTenantId}`,
      { headers: this.headers }
    );
  }

  scheduleEvent(payload: ScheduleEventPayload) {
    return this.http.post<{ item: CalendarEvent }>(
      `${this.base}/calendar/${this.blog.activeTenantId}`,
      payload,
      { headers: this.headers }
    );
  }

  updateEvent(itemId: string, payload: UpdateEventPayload) {
    return this.http.patch<{ item: CalendarEvent }>(
      `${this.base}/calendar/${this.blog.activeTenantId}/${itemId}`,
      payload,
      { headers: this.headers }
    );
  }

  deleteEvent(itemId: string) {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/calendar/${this.blog.activeTenantId}/${itemId}`,
      { headers: this.headers }
    );
  }
}
