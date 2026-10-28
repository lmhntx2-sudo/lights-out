// The anonymous play counter (netlify/lib/stats.mjs), run against an in-memory
// store with the Netlify Blobs interface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleStats, hkDay, LIMITS } from '../netlify/lib/stats.mjs';

function memoryStore() {
  const data = new Map();
  let n = 0;
  return {
    data,
    async get(key) {
      const v = data.get(key);
      return v ? JSON.parse(v.body) : null;
    },
    async getWithMetadata(key) {
      const v = data.get(key);
      return v ? { data: JSON.parse(v.body), etag: v.etag, metadata: {} } : null;
    },
    async setJSON(key, value, { onlyIfNew, onlyIfMatch } = {}) {
      const cur = data.get(key);
      if ((onlyIfNew && cur) || (onlyIfMatch && cur?.etag !== onlyIfMatch)) return { modified: false };
      const etag = `"${++n}"`;
      data.set(key, { body: JSON.stringify(value), etag });
      return { modified: true, etag };
    },
  };
}

// 20:00 in Hong Kong on 20 October.
const NOW = Date.parse('2026-10-20T12:00:00Z');
const A = '0f8fad5b-d9cb-469f-a165-70867728950e';
const B = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const C = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const post = (body, raw) => new Request('https://x.test/api/stats', { method: 'POST', body: raw ?? JSON.stringify(body) });
const get = (q = '') => new Request(`https://x.test/api/stats${q}`);

async function send(store, e, id, { ip = '203.0.113.7', now = NOW } = {}) {
  const res = await handleStats(post({ e, id }), { store, ip, now });
  assert.equal(res.status, 204, await res.clone().text());
}

async function report(store, now = NOW, q = '') {
  const res = await handleStats(get(q), { store, now });
  assert.equal(res.status, 200);
  return res.json();
}

test('counts visitors and players once per browser, careers every time', async () => {
  const store = memoryStore();
  await send(store, 'open', A);
  await send(store, 'open', A);
  await send(store, 'open', B);
  await send(store, 'start', A);
  await send(store, 'start', A);
  await send(store, 'finish', A);
  await send(store, 'open', C);

  const { days, totals, today } = await report(store);
  assert.equal(today, '2026-10-20');
  assert.deepEqual(days[0], { date: '2026-10-20', visitors: 3, players: 1, starts: 2, finishes: 1 });
  assert.deepEqual(totals, { visitors: 3, players: 1, starts: 2, finishes: 1, since: '2026-10-20' });
});

test('days follow Hong Kong time, and all-time uniques span days', async () => {
  assert.equal(hkDay(Date.parse('2026-10-20T15:59:59Z')), '2026-10-20');
  assert.equal(hkDay(Date.parse('2026-10-20T16:00:00Z')), '2026-10-21');

  const store = memoryStore();
  await send(store, 'open', A, { now: Date.parse('2026-10-20T15:59:59Z') });
  await send(store, 'start', A, { now: Date.parse('2026-10-20T15:59:59Z') });
  await send(store, 'open', A, { now: Date.parse('2026-10-20T16:00:00Z') });
  await send(store, 'start', A, { now: Date.parse('2026-10-20T16:00:00Z') });

  const { days, totals } = await report(store, Date.parse('2026-10-21T04:00:00Z'));
  assert.deepEqual(days.slice(0, 2).map((d) => [d.date, d.visitors, d.players, d.starts]), [
    ['2026-10-21', 1, 1, 1],
    ['2026-10-20', 1, 1, 1],
  ]);
  assert.equal(totals.visitors, 1, 'the same browser on two days is one visitor all time');
  assert.equal(totals.players, 1);
  assert.equal(totals.starts, 2);
  assert.equal(totals.since, '2026-10-20');
});

test('the report covers the asked-for days, newest first, with empty days as zeros', async () => {
  const store = memoryStore();
  const empty = await report(store);
  assert.equal(empty.tz, 'Asia/Hong_Kong');
  assert.equal(empty.days.length, LIMITS.days.default);
  assert.equal(empty.days[0].date, '2026-10-20');
  assert.equal(empty.days.at(-1).date, '2026-09-21');
  assert.deepEqual(empty.days[5], { date: '2026-10-15', visitors: 0, players: 0, starts: 0, finishes: 0 });
  assert.deepEqual(empty.totals, { visitors: 0, players: 0, starts: 0, finishes: 0, since: null });

  assert.equal((await report(store, NOW, '?days=7')).days.length, 7);
  assert.equal((await report(store, NOW, '?days=9999')).days.length, LIMITS.days.max);
  assert.equal((await report(store, NOW, '?days=0')).days.length, 1);
  assert.equal((await report(store, NOW, '?days=abc')).days.length, LIMITS.days.default);
});

test('refuses anything that is not a known event with a browser id', async () => {
  const store = memoryStore();
  const bad = [
    [{ e: 'click', id: A }],
    [{ e: 'open' }],
    [{ e: 'open', id: 'not-an-id' }],
    [{ e: 'open', id: 12345 }],
    [{ e: 'open', id: `${A}x` }],
    [null, 'not json'],
    [null, '"open"'],
  ];
  for (const [body, raw] of bad) {
    const res = await handleStats(post(body, raw), { store, ip: '203.0.113.7', now: NOW });
    assert.equal(res.status, 400, JSON.stringify(body ?? raw));
  }
  const big = await handleStats(post(null, JSON.stringify({ e: 'open', id: A, pad: 'x'.repeat(1000) })), { store, ip: '203.0.113.7', now: NOW });
  assert.equal(big.status, 413);
  const del = await handleStats(new Request('https://x.test/api/stats', { method: 'DELETE' }), { store });
  assert.equal(del.status, 405);
  assert.deepEqual((await report(store)).totals.visitors, 0, 'nothing was counted');
});

test('one connection can only send so many events an hour', async () => {
  const store = memoryStore();
  for (let i = 0; i < LIMITS.hour.max; i++) await send(store, 'start', A, { now: NOW + i });
  const over = await handleStats(post({ e: 'start', id: A }), { store, ip: '203.0.113.7', now: NOW + 5000 });
  assert.equal(over.status, 429);
  await send(store, 'start', A, { ip: '198.51.100.2', now: NOW + 5000 });
  await send(store, 'start', A, { now: NOW + LIMITS.hour.ms + 1 });
  assert.equal((await report(store, NOW + LIMITS.hour.ms + 1)).totals.starts, LIMITS.hour.max + 2);
});

test('stores neither the browser id nor the IP address', async () => {
  const store = memoryStore();
  await send(store, 'open', A, { ip: '203.0.113.99' });
  await send(store, 'start', A, { ip: '203.0.113.99' });
  const everything = JSON.stringify([...store.data.entries()]);
  for (const secret of [A, A.replace(/-/g, ''), '203.0.113.99']) assert.ok(!everything.includes(secret), secret);
});

// The real function file against Netlify's own local Blobs server.
let BlobsServer = null;
let fn = null;
try {
  ({ BlobsServer } = await import('@netlify/blobs/server'));
  ({ default: fn } = await import('../netlify/functions/stats.mjs'));
} catch {
  // dependencies not installed
}

test('the Netlify function counts through Netlify Blobs, apart from production', { skip: !fn && 'run npm install first' }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lights-out-stats-'));
  const token = 'local-test-token';
  const server = new BlobsServer({ directory: dir, token });
  const { port } = await server.start();
  const url = `http://localhost:${port}`;
  globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify({ edgeURL: url, uncachedEdgeURL: url, siteID: 'local-site', token })).toString('base64');
  process.env.NETLIFY_LOCAL = 'true';
  const dev = { ip: '203.0.113.50', deploy: { context: 'dev' } };
  const api = 'http://localhost/api/stats';
  try {
    let res = await fn(new Request(api, { method: 'POST', body: JSON.stringify({ e: 'open', id: A }) }), dev);
    assert.equal(res.status, 204, await res.clone().text());
    res = await fn(new Request(api, { method: 'POST', body: JSON.stringify({ e: 'start', id: A }) }), dev);
    assert.equal(res.status, 204);

    const mine = await (await fn(new Request(api), dev)).json();
    assert.equal(mine.totals.visitors, 1);
    assert.equal(mine.totals.starts, 1);

    const prod = await (await fn(new Request(api), { ...dev, deploy: { context: 'production' } })).json();
    assert.equal(prod.totals.visitors, 0);
  } finally {
    delete globalThis.netlifyBlobsContext;
    delete process.env.NETLIFY_LOCAL;
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
