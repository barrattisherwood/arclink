import { Router, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { BlogTenant } from '../models/BlogTenant';

const router = Router();

function isSuperAdmin(req: Request): boolean {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const sig = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  const expected = Buffer.from(sig);
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try {
    const pad = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
    const p = JSON.parse(Buffer.from(pad(parts[1]), 'base64').toString('utf8'));
    return p.role === 'super-admin' && (!p.exp || p.exp * 1000 > Date.now());
  } catch { return false; }
}

// GET /tenant/:siteId — check if a blog tenant exists for a given siteId (or tenant UUID)
router.get('/:siteId', async (req: Request, res: Response): Promise<void> => {
  const { siteId } = req.params;

  const tenant = await BlogTenant.findOne({
    $or: [{ siteId }, { id: siteId }],
    active: true,
  });

  if (!tenant) {
    res.status(404).json({ exists: false });
    return;
  }

  res.json({
    exists: true,
    tenantId: tenant.id,
    roundupEnabled: !!(tenant.sport_key),
    sportLabel: tenant.sport_label || '',
  });
});

// PATCH /tenant/:tenantId/site-id — super-admin: set siteId on a tenant
router.patch('/:tenantId/site-id', async (req: Request, res: Response): Promise<void> => {
  if (!isSuperAdmin(req)) {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }

  const { siteId } = req.body as { siteId?: string };
  if (!siteId || typeof siteId !== 'string') {
    res.status(400).json({ error: 'siteId is required' });
    return;
  }

  const tenant = await BlogTenant.findOneAndUpdate(
    { id: req.params.tenantId },
    { siteId },
    { new: true },
  );

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  res.json({ ok: true, tenantId: tenant.id, siteId: tenant.siteId });
});

// PATCH /tenant/:tenantId/settings — super-admin: update tenant settings
router.patch('/:tenantId/settings', async (req: Request, res: Response): Promise<void> => {
  if (!isSuperAdmin(req)) {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }

  const allowed = ['blog_images_enabled', 'siteId', 'blog_cadence', 'blog_word_count', 'sport_key', 'sport_label'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = (req.body as Record<string, unknown>)[key];
  }

  const tenant = await BlogTenant.findOneAndUpdate(
    { id: req.params.tenantId },
    updates,
    { new: true },
  );

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  res.json({ ok: true, tenantId: tenant.id, blog_images_enabled: tenant.blog_images_enabled });
});

export default router;
