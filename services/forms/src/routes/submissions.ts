import { Router, Request, Response } from 'express';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { Tenant } from '../models/Tenant';
import { Submission } from '../models/Submission';

const router = Router();

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function verifyAdminJwt(token: string): { role: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const sig = createHmac('sha256', secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url');

  const expected = Buffer.from(sig);
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const pad = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
    const payload = JSON.parse(Buffer.from(pad(parts[1]), 'base64').toString('utf8'));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function requireAuth(req: Request, res: Response): Promise<boolean> {
  const { tenantId } = req.params;

  // Super-admin JWT bypass (used by admin dashboard)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAdminJwt(authHeader.slice(7));
    if (payload?.role === 'super-admin') {
      const tenant = await Tenant.findOne({ id: tenantId });
      if (!tenant || !tenant.active) {
        res.status(404).json({ error: 'Tenant not found' });
        return false;
      }
      return true;
    }
  }

  // API key auth (used by external clients)
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
