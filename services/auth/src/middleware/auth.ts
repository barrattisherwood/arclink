import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  siteId: string;
  role: 'super-admin' | 'client';
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'super-admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  });
}

export function requireSiteAccess(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const { siteId } = req.params;
    const user = req.user!;
    if (user.role === 'super-admin') return next();
    if (user.siteId !== siteId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  });
}
