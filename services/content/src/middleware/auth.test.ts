import { createHmac } from 'crypto';
import { Request, Response, NextFunction } from 'express';

// ─── JWT helpers ──────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-jwt-secret';

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function makeToken(payload: object, secret = TEST_SECRET): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body   = b64url(payload);
  const sig    = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

// ─── Request / Response fakes ─────────────────────────────────────────────────

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function makeRes() {
  const status = jest.fn().mockReturnThis();
  const json   = jest.fn().mockReturnThis();
  return { res: { status, json } as unknown as Response, status, json };
}

// ─── Import after env setup ───────────────────────────────────────────────────

let requireAdminJwt: (req: Request, res: Response, next: NextFunction) => void;

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
  // require after env is set so verifyAdminJwt picks up the secret
  ({ requireAdminJwt } = require('./auth'));
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

// ─── requireAdminJwt ─────────────────────────────────────────────────────────

describe('requireAdminJwt', () => {
  it('returns 401 when Authorization header is absent', () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();
    requireAdminJwt(makeReq(), res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is not Bearer', () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();
    requireAdminJwt(makeReq({ authorization: 'Basic abc123' }), res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token is signed with wrong secret', () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();
    const token = makeToken({ role: 'super-admin', exp: Math.floor(Date.now() / 1000) + 3600 }, 'wrong-secret');
    requireAdminJwt(makeReq({ authorization: `Bearer ${token}` }), res, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token has expired', () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();
    const token = makeToken({ role: 'super-admin', exp: Math.floor(Date.now() / 1000) - 1 });
    requireAdminJwt(makeReq({ authorization: `Bearer ${token}` }), res, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not super-admin', () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();
    const token = makeToken({ role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    requireAdminJwt(makeReq({ authorization: `Bearer ${token}` }), res, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token has 2 parts only (malformed)', () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();
    requireAdminJwt(makeReq({ authorization: 'Bearer abc.def' }), res, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for a valid super-admin token', () => {
    const { res } = makeRes();
    const next = jest.fn();
    const token = makeToken({ role: 'super-admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    requireAdminJwt(makeReq({ authorization: `Bearer ${token}` }), res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() for a token with no exp (non-expiring)', () => {
    const { res } = makeRes();
    const next = jest.fn();
    const token = makeToken({ role: 'super-admin' });
    requireAdminJwt(makeReq({ authorization: `Bearer ${token}` }), res, next);
    expect(next).toHaveBeenCalled();
  });
});
