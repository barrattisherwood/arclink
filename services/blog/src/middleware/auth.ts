import { Request, Response, NextFunction } from 'express';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { BlogTenant, IBlogTenant } from '../models/BlogTenant';

declare global {
  namespace Express {
    interface Request {
      tenant?: IBlogTenant;
    }
  }
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

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

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { tenantId } = req.params;

  // Super-admin JWT bypass (used by admin dashboard)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAdminJwt(authHeader.slice(7));
    if (payload?.role === 'super-admin') {
      const tenant = await BlogTenant.findOne({ id: tenantId });
      if (!tenant || !tenant.active) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
      req.tenant = tenant;
      next();
      return;
    }
  }

  // API key auth (used by external clients)
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }

  const tenant = await BlogTenant.findOne({ id: tenantId });

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
  const { tenantId } = req.params;
  const tenant = await BlogTenant.findOne({ id: tenantId, active: true });

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  req.tenant = tenant;
  next();
}
