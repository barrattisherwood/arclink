import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { authGuard, superAdminGuard } from './auth.guard';

// Polyfill localStorage for vitest/jsdom
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

describe('Auth Guards', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });
  });

  beforeEach(() => {
    mockLocalStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
      ],
    });
  });

  afterEach(() => mockLocalStorage.clear());

  it('authGuard should block when not logged in', () => {
    const result = TestBed.runInInjectionContext(() => {
      return authGuard({} as any, {} as any);
    });
    expect(result).toBe(false);
  });

  it('authGuard should allow when logged in', () => {
    const payload = { userId: '1', siteId: 'site-1', role: 'client', email: 'user@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = `x.${btoa(JSON.stringify(payload))}.x`;
    mockLocalStorage.setItem('arclink_token', token);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
      ],
    });

    const result = TestBed.runInInjectionContext(() => {
      return authGuard({} as any, {} as any);
    });
    expect(result).toBe(true);
  });

  it('superAdminGuard should block client role', () => {
    const payload = { userId: '1', siteId: 'site-1', role: 'client', email: 'user@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = `x.${btoa(JSON.stringify(payload))}.x`;
    mockLocalStorage.setItem('arclink_token', token);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
      ],
    });

    const result = TestBed.runInInjectionContext(() => {
      return superAdminGuard({} as any, {} as any);
    });
    expect(result).toBe(false);
  });

  it('superAdminGuard should allow super-admin', () => {
    const payload = { userId: '1', siteId: '*', role: 'super-admin', email: 'admin@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = `x.${btoa(JSON.stringify(payload))}.x`;
    mockLocalStorage.setItem('arclink_token', token);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
      ],
    });

    const result = TestBed.runInInjectionContext(() => {
      return superAdminGuard({} as any, {} as any);
    });
    expect(result).toBe(true);
  });
});
