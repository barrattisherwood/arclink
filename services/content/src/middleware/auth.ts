import { Request, Response, NextFunction } from 'express';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { ContentTenant, IContentTenant } from '../models/Tenant';

function verifyAdminJwt(token: string): { role: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const sig = createHmac('sha256', secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url');

  const expected = Buffer.from(sig);
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const pad = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
    const payload = JSON.parse(Buffer.from(pad(parts[1]), 'base64').toString('utf8'));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdminJwt(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const payload = verifyAdminJwt(authHeader.slice(7));
  if (!payload || payload.role !== 'super-admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

declare global {
  namespace Express {
    interface Request {
      tenant?: IContentTenant;
    }
  }
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'];
  const siteId = req.params.siteId;

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({ error: 'Missing or invalid API key' });
    return;
  }

  const tenant = await ContentTenant.findOne({ siteId });

  if (!tenant || !tenant.active) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  if (tenant.api_key !== hashKey(apiKey)) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  req.tenant = tenant;
  next();
}

export async function resolveTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  const siteId = req.params.siteId;
  const tenant = await ContentTenant.findOne({ siteId, active: true });

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  req.tenant = tenant;
  next();
}
