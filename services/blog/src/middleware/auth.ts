import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
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

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'];
  const { tenantId } = req.params;

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({ error: 'Missing or invalid API key' });
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
