import { Request, Response, NextFunction } from 'express';
import { corsCheck } from './cors';

const mockFindOne = jest.fn();

jest.mock('../models/Tenant', () => ({
  Tenant: { findOne: (...args: any[]) => mockFindOne(...args) },
}));

function makeReq(origin: string | undefined, tenantId: string): Request {
  return {
    headers: origin ? { origin } : {},
    params: { tenantId },
  } as unknown as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock; setHeader: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const res = { status, json, setHeader } as unknown as Response;
  return { res, status, json, setHeader };
}

beforeEach(() => mockFindOne.mockReset());

describe('corsCheck', () => {
  it('returns 403 when origin header is missing', async () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();

    await corsCheck(makeReq(undefined, 'tenant-1'), res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid origin' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when tenant is not found', async () => {
    mockFindOne.mockResolvedValue(null);
    const { res, status, json } = makeRes();
    const next = jest.fn();

    await corsCheck(makeReq('https://example.com', 'unknown-tenant'), res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid origin' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when origin does not match tenant allowed_origin', async () => {
    mockFindOne.mockResolvedValue({ allowed_origin: 'https://expected.com' });
    const { res, status, json } = makeRes();
    const next = jest.fn();

    await corsCheck(makeReq('https://attacker.com', 'tenant-1'), res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid origin' });
    expect(next).not.toHaveBeenCalled();
  });

  it('sets CORS headers and calls next() when origin matches', async () => {
    mockFindOne.mockResolvedValue({ allowed_origin: 'https://example.com' });
    const { res, setHeader, status } = makeRes();
    const next = jest.fn();

    await corsCheck(makeReq('https://example.com', 'tenant-1'), res, next as NextFunction);

    expect(setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    expect(setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'POST, OPTIONS');
    expect(setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('queries Tenant with the tenantId from route params', async () => {
    mockFindOne.mockResolvedValue(null);
    const { res } = makeRes();

    await corsCheck(makeReq('https://example.com', 'my-tenant-id'), res, jest.fn() as unknown as NextFunction);

    expect(mockFindOne).toHaveBeenCalledWith({ id: 'my-tenant-id' });
  });
});
