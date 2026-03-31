import { Router, Request, Response } from 'express';
import { BlogTenant } from '../models/BlogTenant';

const router = Router();

// GET /tenant/:siteId — check if a blog tenant exists for a given siteId
router.get('/:siteId', async (req: Request, res: Response): Promise<void> => {
  const tenant = await BlogTenant.findOne({ siteId: req.params.siteId, active: true });

  if (!tenant) {
    res.status(404).json({ exists: false });
    return;
  }

  res.json({ exists: true, tenantId: tenant.id });
});

export default router;
