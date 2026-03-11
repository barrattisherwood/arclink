export type UserRole = 'super-admin' | 'client';

export interface JwtPayload {
  userId: string;
  siteId: string; // '*' for super-admin (all sites)
  role: UserRole;
  email: string;
}
