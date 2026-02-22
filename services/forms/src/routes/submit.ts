import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { corsCheck } from '../middleware/cors';
import { perTenantRateLimit } from '../middleware/rateLimit';
import { turnstileVerify } from '../middleware/turnstile';
import { Tenant } from '../models/Tenant';
import { Submission } from '../models/Submission';
import { sendFormEmail } from '../services/email';

const router = Router();

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

router.post('/:tenantId', corsCheck, perTenantRateLimit, turnstileVerify, async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({ error: 'Missing or invalid API key' });
    return;
  }

  const tenant = await Tenant.findOne({ id: tenantId });

  if (!tenant || !tenant.active) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  if (tenant.api_key !== hashKey(apiKey)) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  const body = req.body as Record<string, unknown>;

  // Strip Turnstile token before storing/emailing
  const { 'cf-turnstile-response': _token, ...fields } = body;

  await Submission.create({
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    fields,
  });

  try {
    await sendFormEmail(tenant, fields);
  } catch (err) {
    console.error('Email send failed:', err);
    res.status(502).json({ error: 'Failed to send email' });
    return;
  }

  res.status(200).json({ ok: true });
});

export default router;
