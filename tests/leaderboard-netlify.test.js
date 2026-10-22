// Runs the real Netlify Function file against Netlify's own local Blobs server,
// the same one `netlify dev` uses. Skipped until `npm install` has been run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';

let BlobsServer = null;
let fn = null;
try {
  ({ BlobsServer } = await import('@netlify/blobs/server'));
  ({ default: fn } = await import('../netlify/functions/leaderboard.mjs'));
} catch {
  // dependencies not installed
}

function career(seed) {
  const s = newGame({ seed, first: 'Blob', last: 'Racer', nat: 'JP', style: 'fighter', bg: 'prodigy', helmet: { c1: '#F2F2F2', c2: '#E8002D' }, number: 22 });
  while (s.stage !== 'retired') {
    const p = prompt(s);
    if (p.type === 'choice') choose(s, autoPick(s));
    else if (p.type === 'offers') {
      const i = p.offers.findIndex((o) => !(o.cost > s.driver.money));
      pickOffer(s, s.driver.age >= 34 ? p.offers.length - 1 : i);
    }
    else advance(s);
  }
  return s;
}

test('the Netlify function stores and serves the board through Netlify Blobs', { skip: !fn && 'run npm install first' }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lights-out-blobs-'));
  const token = 'local-test-token';
  const server = new BlobsServer({ directory: dir, token });
  const { port } = await server.start();
  const url = `http://localhost:${port}`;
  globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify({ edgeURL: url, uncachedEdgeURL: url, siteID: 'local-site', token })).toString('base64');
  process.env.NETLIFY_LOCAL = 'true';
  const dev = { ip: '203.0.113.50', deploy: { context: 'dev' } };
  const api = 'http://localhost/api/leaderboard';
  try {
    const s = career('blobs-e2e');
    const body = JSON.stringify({ setup: s.setup, actions: s.log, displayName: 'Blob Racer', score: s.retired.score });

    let res = await fn(new Request(api, { method: 'POST', body }), dev);
    assert.equal(res.status, 201, await res.clone().text());
    const { entry, ranks } = await res.json();
    assert.equal(ranks.all, 1);
    assert.equal(entry.score, s.retired.score);

    res = await fn(new Request(api, { method: 'POST', body }), dev);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).duplicate, true);

    res = await fn(new Request(`${api}?board=all`), dev);
    const board = await res.json();
    assert.deepEqual(board.entries.map((e) => e.id), [entry.id]);

    // Production keeps its own store, so local and preview testing never touch it.
    res = await fn(new Request(`${api}?board=all`), { ...dev, deploy: { context: 'production' } });
    assert.equal((await res.json()).entries.length, 0);
  } finally {
    delete globalThis.netlifyBlobsContext;
    delete process.env.NETLIFY_LOCAL;
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
