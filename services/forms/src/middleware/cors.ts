import { Request, Response, NextFunction } from 'express';
import { Tenant } from '../models/Tenant';

export async function corsCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  const origin = req.headers.origin;
  const tenantId = req.params.tenantId;

  if (!origin) {
    res.status(403).json({ error: 'Invalid origin' });
    return;
  }

  const tenant = await Tenant.findOne({ id: tenantId });

  if (!tenant || tenant.allowed_origin !== origin) {
    res.status(403).json({ error: 'Invalid origin' });
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  next();
}
