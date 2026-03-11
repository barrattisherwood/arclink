import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { ContentTenant, IContentTenant } from '../models/Tenant';

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
