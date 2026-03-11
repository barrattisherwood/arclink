import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { ContentTenant } from '../models/Tenant';
import { requireAuth, resolveTenant } from '../middleware/auth';

const router = Router();

// POST /sites — create a new tenant
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { siteId, name, domain, adminUsers, apiKey } = req.body;

  if (!siteId || !name || !domain || !apiKey) {
    res.status(400).json({ error: 'siteId, name, domain, and apiKey are required' });
    return;
  }

  const existing = await ContentTenant.findOne({ siteId });
  if (existing) {
    res.status(409).json({ error: 'Tenant already exists' });
    return;
  }

  const tenant = await ContentTenant.create({
    siteId,
    name,
    domain,
    adminUsers: adminUsers ?? [],
    api_key: createHash('sha256').update(apiKey).digest('hex'),
    active: true,
  });

  res.status(201).json({ siteId: tenant.siteId, name: tenant.name, domain: tenant.domain });
});

// GET /sites/:siteId — get tenant details
router.get('/:siteId', resolveTenant, async (req: Request, res: Response): Promise<void> => {
  const tenant = req.tenant!;
  res.json({
    siteId: tenant.siteId,
    name: tenant.name,
    domain: tenant.domain,
    adminUsers: tenant.adminUsers,
  });
});

// PATCH /sites/:siteId — update tenant
router.patch('/:siteId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, domain, adminUsers, active } = req.body;
  const updates: Record<string, any> = {};

  if (name !== undefined) updates.name = name;
  if (domain !== undefined) updates.domain = domain;
  if (adminUsers !== undefined) updates.adminUsers = adminUsers;
  if (active !== undefined) updates.active = active;

  const tenant = await ContentTenant.findOneAndUpdate(
    { siteId: req.params.siteId },
    updates,
    { new: true }
  );

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  res.json({
    siteId: tenant.siteId,
    name: tenant.name,
    domain: tenant.domain,
    adminUsers: tenant.adminUsers,
    active: tenant.active,
  });
});

export default router;
