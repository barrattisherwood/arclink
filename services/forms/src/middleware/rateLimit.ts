import { Request, Response, NextFunction } from 'express';
import { rateLimit, Store, Options, IncrementResponse } from 'express-rate-limit';
import { Tenant } from '../models/Tenant';

// Store rate limit instances per tenant so each uses its own configured limit
const limiters = new Map<string, ReturnType<typeof rateLimit>>();

export async function perTenantRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tenantId = req.params.tenantId;

  const tenant = await Tenant.findOne({ id: tenantId });
  if (!tenant) {
    // Tenant lookup failures are handled downstream — pass through
    next();
    return;
  }

  const max = tenant.rate_limit ?? 10;
  const key = `${tenantId}:${max}`;

  if (!limiters.has(key)) {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (request) => {
        const forwarded = request.headers['x-forwarded-for'];
        const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0] ?? request.ip ?? 'unknown');
        return `${tenantId}:${ip}`;
      },
      handler: (_req, _res, _next, options) => {
        res.status(options.statusCode).json({ error: 'Rate limit exceeded' });
      },
    });
    limiters.set(key, limiter);
  }

  const limiter = limiters.get(key)!;
  limiter(req, res, next);
}
