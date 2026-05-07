import { Router, Request, Response } from 'express';
import { requireAdminJwt } from '../middleware/auth';
import { BlogTenant } from '../models/BlogTenant';
import { PERSONA_REGISTRY } from '../services/persona-registry';

const router = Router();

// POST /api/admin/sync-personas
// Applies the latest persona prompts from the in-code registry to all tenants in MongoDB.
// Auth: super-admin JWT (same token used by the admin dashboard).
router.post('/sync-personas', requireAdminJwt, async (_req: Request, res: Response): Promise<void> => {
  const results: Array<{ tenantName: string; status: 'updated' | 'not_found' }> = [];

  for (const config of PERSONA_REGISTRY) {
    const tenant = await BlogTenant.findOne({ name: config.tenantName });

    if (!tenant) {
      console.warn(`[SyncPersonas] Tenant not found: ${config.tenantName}`);
      results.push({ tenantName: config.tenantName, status: 'not_found' });
      continue;
    }

    tenant.blog_persona_prompts = config.personas;
    await tenant.save();

    console.log(`[SyncPersonas] Updated "${config.tenantName}" — personas: ${[...config.personas.keys()].join(', ')}`);
    results.push({ tenantName: config.tenantName, status: 'updated' });
  }

  const updated = results.filter(r => r.status === 'updated').length;
  res.json({ ok: true, updated, results });
});

export default router;
