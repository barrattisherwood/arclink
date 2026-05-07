import { createHmac } from 'crypto';
import { Request, Response } from 'express';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRunSport   = jest.fn();
const mockCronFind   = jest.fn();
const mockCronCount  = jest.fn();

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios');
jest.mock('../models/CronLog',   () => ({}));
jest.mock('../models/ContentType',  () => ({}));
jest.mock('../models/ContentEntry', () => ({}));
jest.mock('../scheduler-fixtures', () => ({
  runSport:             (...a: any[]) => mockRunSport(...a),
  RUGBY_COMPETITIONS:    [{ path: '/rugby',    name: 'URC',  tag: 'urc' }],
  CRICKET_COMPETITIONS:  [{ path: '/cricket',  name: 'IPL',  tag: 'ipl' }],
  FOOTBALL_COMPETITIONS: [{ path: '/football', name: 'PSL',  tag: 'psl' }],
  TENNIS_COMPETITIONS:   [{ path: '/tennis',   name: 'Wimbledon', tag: 'wimbledon' }],
}));

// CronLog mock for GET endpoint
jest.mock('../models/CronLog', () => ({
  CronLog: {
    find:           () => ({ sort: () => ({ skip: () => ({ limit: () => mockCronFind() }) }) }),
    countDocuments: () => mockCronCount(),
  },
}));

// ─── JWT helper ───────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = TEST_SECRET;

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function makeToken(payload: object): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body   = b64url(payload);
  const sig    = createHmac('sha256', TEST_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

const VALID_TOKEN = makeToken({ role: 'super-admin', exp: Math.floor(Date.now() / 1000) + 3600 });

// ─── Router import (after mocks + env) ───────────────────────────────────────

import router from './cron-logs';
import express from 'express';
import request from 'supertest';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/', router);
  return a;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCronFind.mockResolvedValue([]);
  mockCronCount.mockResolvedValue(0);
  mockRunSport.mockResolvedValue(undefined);
});

// ─── GET /cron-logs ───────────────────────────────────────────────────────────

describe('GET / (cron-logs)', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app()).get('/');
    expect(res.status).toBe(401);
  });

  it('returns 403 with wrong role', async () => {
    const token = makeToken({ role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    const res = await request(app()).get('/').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns logs and total for super-admin', async () => {
    mockCronFind.mockResolvedValue([{ job: 'fixture-sync-rugby', status: 'success' }]);
    mockCronCount.mockResolvedValue(1);
    const res = await request(app()).get('/').set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.logs).toHaveLength(1);
  });
});

// ─── POST /sync-fixtures ──────────────────────────────────────────────────────

describe('POST /sync-fixtures', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app()).post('/sync-fixtures');
    expect(res.status).toBe(401);
  });

  it('returns 403 with wrong role', async () => {
    const token = makeToken({ role: 'editor', exp: Math.floor(Date.now() / 1000) + 3600 });
    const res = await request(app()).post('/sync-fixtures').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('syncs all 4 sports when no siteId given', async () => {
    const res = await request(app())
      .post('/sync-fixtures')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.results).toHaveLength(4);
    expect(mockRunSport).toHaveBeenCalledTimes(4);
  });

  it('returns ok status for each sport', async () => {
    const res = await request(app())
      .post('/sync-fixtures')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.body.results.every((r: any) => r.status === 'ok')).toBe(true);
  });

  it('scopes to a single sport when siteId is provided', async () => {
    const res = await request(app())
      .post('/sync-fixtures?siteId=betwise-rugby')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].siteId).toBe('betwise-rugby');
    expect(mockRunSport).toHaveBeenCalledTimes(1);
    expect(mockRunSport).toHaveBeenCalledWith(
      'fixture-sync-rugby-manual',
      expect.any(Array),
      'betwise-rugby',
    );
  });

  it('returns 400 for an unknown siteId', async () => {
    const res = await request(app())
      .post('/sync-fixtures?siteId=unknown-site')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Unknown siteId/);
    expect(mockRunSport).not.toHaveBeenCalled();
  });

  it('records failed status when runSport throws', async () => {
    mockRunSport.mockRejectedValueOnce(new Error('SportDB timeout'));

    const res = await request(app())
      .post('/sync-fixtures?siteId=betwise-rugby')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.results[0].status).toBe('failed: SportDB timeout');
  });

  it('continues syncing remaining sports after one failure', async () => {
    // First call (rugby) throws; the other three should still be called
    mockRunSport.mockRejectedValueOnce(new Error('API error'));

    const res = await request(app())
      .post('/sync-fixtures')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(mockRunSport).toHaveBeenCalledTimes(4);
    const statuses = res.body.results.map((r: any) => r.status);
    expect(statuses[0]).toBe('failed: API error');
    expect(statuses.slice(1).every((s: string) => s === 'ok')).toBe(true);
  });

  it('passes the correct job name and competitions to runSport', async () => {
    await request(app())
      .post('/sync-fixtures?siteId=betwise-cricket')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(mockRunSport).toHaveBeenCalledWith(
      'fixture-sync-cricket-manual',
      expect.arrayContaining([expect.objectContaining({ tag: 'ipl' })]),
      'betwise-cricket',
    );
  });
});
