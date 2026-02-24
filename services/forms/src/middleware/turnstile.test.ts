import { Request, Response, NextFunction } from 'express';
import { turnstileVerify } from './turnstile';

// Mock the https module
const mockWrite = jest.fn();
const mockEnd = jest.fn();
const mockOnRequest = jest.fn();

let capturedResCallback: ((res: any) => void) | null = null;

const mockRequest = {
  on: mockOnRequest,
  write: mockWrite,
  end: mockEnd,
};

jest.mock('https', () => ({
  request: jest.fn((_opts: any, callback: (res: any) => void) => {
    capturedResCallback = callback;
    return mockRequest;
  }),
}));

import https from 'https';
const mockHttpsRequest = https.request as jest.Mock;

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    body: { 'cf-turnstile-response': 'valid-token', email: 'a@b.com' },
    headers: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

function simulateTurnstileResponse(statusCode: number, body: string): void {
  const fakeRes = {
    statusCode,
    headers: { 'cf-ray': 'abc123-AMS', server: 'cloudflare' },
    setEncoding: jest.fn(),
    on: jest.fn((event: string, cb: (data?: string) => void) => {
      if (event === 'data') cb(body);
      if (event === 'end') cb();
    }),
  };
  capturedResCallback!(fakeRes);
}

const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV, TURNSTILE_SECRET_KEY: 'test-secret' };
  capturedResCallback = null;
  mockWrite.mockReset();
  mockEnd.mockReset();
  mockOnRequest.mockReset();
  mockOnRequest.mockImplementation(() => mockRequest);
  mockHttpsRequest.mockImplementation((_opts: any, callback: (res: any) => void) => {
    capturedResCallback = callback;
    return mockRequest;
  });
});

afterEach(() => {
  process.env = OLD_ENV;
});

describe('turnstileVerify', () => {
  it('returns 422 when cf-turnstile-response token is missing', async () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();
    const req = makeReq({ body: {} });

    await turnstileVerify(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({ error: 'Missing Turnstile token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when TURNSTILE_SECRET_KEY is not set', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const { res, status, json } = makeRes();
    const next = jest.fn();

    await turnstileVerify(makeReq(), res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Server configuration error' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 on network error', async () => {
    mockOnRequest.mockImplementation((event: string, cb: (err: Error) => void) => {
      if (event === 'error') cb(new Error('ECONNREFUSED'));
      return mockRequest;
    });

    const { res, status, json } = makeRes();
    const next = jest.fn();

    await turnstileVerify(makeReq(), res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Server configuration error' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 422 when Cloudflare returns a non-200 status', async () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();

    const promise = turnstileVerify(makeReq(), res, next as NextFunction);
    simulateTurnstileResponse(405, 'Method Not Allowed');
    await promise;

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({ error: 'Turnstile verification failed' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 422 when response body is not valid JSON', async () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();

    const promise = turnstileVerify(makeReq(), res, next as NextFunction);
    simulateTurnstileResponse(200, 'not-json{{{');
    await promise;

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({ error: 'Turnstile verification failed' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 422 when Turnstile returns success: false', async () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();

    const promise = turnstileVerify(makeReq(), res, next as NextFunction);
    simulateTurnstileResponse(200, JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }));
    await promise;

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({ error: 'Turnstile verification failed' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when Turnstile returns success: true', async () => {
    const { res } = makeRes();
    const next = jest.fn();

    const promise = turnstileVerify(makeReq(), res, next as NextFunction);
    simulateTurnstileResponse(200, JSON.stringify({ success: true, hostname: 'example.com' }));
    await promise;

    expect(next).toHaveBeenCalled();
  });

  it('includes remoteip in request body when x-forwarded-for header is present', async () => {
    const { res } = makeRes();
    const next = jest.fn();
    const req = makeReq({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });

    const promise = turnstileVerify(req, res, next as NextFunction);
    simulateTurnstileResponse(200, JSON.stringify({ success: true }));
    await promise;

    const writtenBody = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(writtenBody.remoteip).toBe('1.2.3.4');
  });
});
