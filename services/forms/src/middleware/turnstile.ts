import { Request, Response, NextFunction } from 'express';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v1/siteverify';

export async function turnstileVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.body?.['cf-turnstile-response'] as string | undefined;

  if (!token) {
    res.status(422).json({ error: 'Missing Turnstile token' });
    return;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not set');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const formData = new URLSearchParams();
  formData.append('secret', secret);
  formData.append('response', token);

  const ip = req.headers['x-forwarded-for'];
  if (ip) {
    const clientIp = Array.isArray(ip) ? ip[0] : ip.split(',')[0];
    formData.append('remoteip', clientIp.trim());
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    res.status(422).json({ error: 'Turnstile verification failed' });
    return;
  }

  const result = await response.json() as { success: boolean };

  if (!result.success) {
    res.status(422).json({ error: 'Turnstile verification failed' });
    return;
  }

  next();
}
