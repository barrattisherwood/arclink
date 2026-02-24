import { Request, Response, NextFunction } from 'express';
import https from 'https';

const TURNSTILE_HOST = 'challenges.cloudflare.com';
const TURNSTILE_PATH = '/turnstile/v0/siteverify';

function httpsPost(body: string): Promise<{ status: number; raw: string }> {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(body, 'utf8');
    const req = https.request(
      {
        hostname: TURNSTILE_HOST,
        port: 443,
        path: TURNSTILE_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': bodyBuf.byteLength,
          'Accept': 'application/json',
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          const cfRay = res.headers['cf-ray'];
          const server = res.headers['server'];
          console.log('[turnstile] response headers: cf-ray=%s server=%s', cfRay, server);
          resolve({ status: res.statusCode ?? 0, raw });
        });
      },
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

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

  const ip = req.headers['x-forwarded-for'];
  const clientIp = ip
    ? (Array.isArray(ip) ? ip[0] : ip.split(',')[0]).trim()
    : undefined;

  const jsonBody: Record<string, string> = { secret, response: token };
  if (clientIp) jsonBody.remoteip = clientIp;

  console.log('[turnstile] verifying, token length:', token.length);

  let status: number;
  let raw: string;
  try {
    ({ status, raw } = await httpsPost(JSON.stringify(jsonBody)));
  } catch (err) {
    console.error('[turnstile] network error:', err);
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  console.log(`[turnstile] status=${status} body=${raw.substring(0, 300)}`);

  if (status !== 200) {
    console.error('[turnstile] unexpected HTTP status:', status);
    res.status(422).json({ error: 'Turnstile verification failed' });
    return;
  }

  let result: { success: boolean; 'error-codes'?: string[] };
  try {
    result = JSON.parse(raw);
  } catch {
    console.error('[turnstile] JSON parse error, raw body:', raw);
    res.status(422).json({ error: 'Turnstile verification failed' });
    return;
  }

  if (!result.success) {
    console.error('[turnstile] failed:', result['error-codes']);
    res.status(422).json({ error: 'Turnstile verification failed' });
    return;
  }

  next();
}
