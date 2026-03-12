import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

// Polyfill localStorage for vitest/jsdom
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });
  });

  beforeEach(() => {
    mockLocalStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    mockLocalStorage.clear();
  });

  function makeToken(payload: Record<string, any>): string {
    return `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload))}.fakesig`;
  }

  it('should start logged out', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('should login and store token', () => {
    const payload = { userId: '1', siteId: '*', role: 'super-admin', email: 'test@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = makeToken(payload);

    service.login('test@test.com', 'password').subscribe();

    const req = httpMock.expectOne(r => r.url.includes('/api/auth/login'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'test@test.com', password: 'password' });
    req.flush({ token });

    expect(service.isLoggedIn()).toBe(true);
    expect(service.user()?.email).toBe('test@test.com');
    expect(service.isSuperAdmin()).toBe(true);
    expect(mockLocalStorage.getItem('arclink_token')).toBe(token);
  });

  it('should logout and clear token', () => {
    const payload = { userId: '1', siteId: '*', role: 'super-admin', email: 'test@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = makeToken(payload);

    service.login('test@test.com', 'password').subscribe();
    httpMock.expectOne(r => r.url.includes('/api/auth/login')).flush({ token });

    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.user()).toBeNull();
    expect(mockLocalStorage.getItem('arclink_token')).toBeNull();
  });

  it('should return token from getToken()', () => {
    mockLocalStorage.setItem('arclink_token', 'test-token');
    expect(service.getToken()).toBe('test-token');
  });

  it('should identify non-super-admin correctly', () => {
    const payload = { userId: '1', siteId: 'site-1', role: 'client', email: 'user@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = makeToken(payload);

    service.login('user@test.com', 'password').subscribe();
    httpMock.expectOne(r => r.url.includes('/api/auth/login')).flush({ token });

    expect(service.isSuperAdmin()).toBe(false);
    expect(service.user()?.siteId).toBe('site-1');
  });
});
