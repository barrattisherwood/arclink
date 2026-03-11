export type UserRole = 'super-admin' | 'client';

export interface JwtPayload {
  userId: string;
  siteId: string;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  userId: string;
  siteId: string;
  role: UserRole;
  email: string;
  token: string;
}

export interface LoginResponse {
  token: string;
  role: UserRole;
  siteId: string;
}
