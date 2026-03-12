import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { Tenant } from '../models/Tenant';
import { Submission } from '../models/Submission';

const router = Router();

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function requireAuth(req: Request, res: Response): Promise<boolean> {
  const { tenantId } = req.params;
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({ error: 'Missing or invalid API key' });
    return false;
  }

  const tenant = await Tenant.findOne({ id: tenantId });

  if (!tenant || !tenant.active) {
    res.status(404).json({ error: 'Tenant not found' });
    return false;
  }

  if (tenant.api_key !== hashKey(apiKey)) {
    res.status(401).json({ error: 'Invalid API key' });
    return false;
  }

  return true;
}

// GET /submissions/:tenantId — list submissions with pagination
router.get('/:tenantId', async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAuth(req, res))) return;

  const { tenantId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const [submissions, total] = await Promise.all([
    Submission.find({ tenant_id: tenantId })
      .sort({ submitted_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    Submission.countDocuments({ tenant_id: tenantId }),
  ]);

  res.json({ submissions, total, limit, offset });
});

// GET /submissions/:tenantId/:id — single submission
router.get('/:tenantId/:id', async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAuth(req, res))) return;

  const submission = await Submission.findById(req.params.id).lean();

  if (!submission || submission.tenant_id !== req.params.tenantId) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  res.json({ submission });
});

// DELETE /submissions/:tenantId/:id — delete submission
router.delete('/:tenantId/:id', async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAuth(req, res))) return;

  const result = await Submission.findOneAndDelete({
    _id: req.params.id,
    tenant_id: req.params.tenantId,
  });

  if (!result) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  res.json({ deleted: true });
});

export default router;
