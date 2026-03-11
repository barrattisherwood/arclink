import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser, JwtPayload, LoginResponse } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private base = environment.authApiUrl;

  private _user = signal<AuthUser | null>(null);
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isSuperAdmin = computed(() => this._user()?.role === 'super-admin');

  constructor() {
    this.restoreSession();
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${this.base}/api/auth/login`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem('arclink_token', res.token);
        this._user.set(this.decodeUser(res.token));
      })
    );
  }

  logout(): void {
    localStorage.removeItem('arclink_token');
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('arclink_token');
  }

  private restoreSession(): void {
    const token = this.getToken();
    if (!token) return;

    try {
      const user = this.decodeUser(token);
      if (user && user.exp * 1000 > Date.now()) {
        this._user.set(user);
      } else {
        localStorage.removeItem('arclink_token');
      }
    } catch {
      localStorage.removeItem('arclink_token');
    }
  }

  private decodeUser(token: string): AuthUser & { exp: number } {
    const payload = JSON.parse(atob(token.split('.')[1])) as JwtPayload;
    return { ...payload, token, exp: payload.exp };
  }
}
