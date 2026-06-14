import { Router, Request, Response } from 'express';
import { Tenant } from '../models/Tenant';
import { Submission } from '../models/Submission';
import { sendFormEmail } from '../services/email';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const origin = req.headers.origin;
  const { site, form, data } = req.body as {
    site?: string;
    form?: string;
    data?: Record<string, unknown>;
  };

  if (!site || !data || typeof data !== 'object') {
    res.status(400).json({ error: 'Missing site or data' });
    return;
  }

  const tenant = await Tenant.findOne({ id: site });

  if (!tenant || !tenant.active) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }

  if (!origin || tenant.allowed_origin !== origin) {
    res.status(403).json({ error: 'Invalid origin' });
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);

  // Flatten: include form name as a context field so it appears in the email
  const fields: Record<string, unknown> = {
    ...(form ? { form } : {}),
    ...data,
  };

  await Submission.create({
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    fields,
  });

  try {
    await sendFormEmail(tenant, fields);
  } catch (err) {
    console.error('[submit-site] Email send failed:', err);
    res.status(502).json({ error: 'Failed to send email' });
    return;
  }

  res.status(200).json({ ok: true });
});

export default router;
