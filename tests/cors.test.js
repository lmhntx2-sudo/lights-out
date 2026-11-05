// Game portals such as itch.io serve the game from their own domain, so the API
// has to answer other origins, including the browser's check before a JSON POST.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CORS, preflight, withCors } from '../netlify/lib/cors.mjs';
import { SERVER } from '../js/config.js';

let fns = null;
try {
  fns = {
    leaderboard: await import('../netlify/functions/leaderboard.mjs'),
    stats: await import('../netlify/functions/stats.mjs'),
  };
} catch {
  // dependencies not installed
}

test('responses carry the CORS headers and keep everything else', async () => {
  const pre = preflight();
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(pre.headers.get('Access-Control-Allow-Methods'), /POST/);
  assert.equal(pre.headers.get('Access-Control-Allow-Headers'), 'Content-Type');

  const res = withCors(new Response('{"error":"nope"}', { status: 400, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' } }));
  assert.equal(res.status, 400);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), CORS['Access-Control-Allow-Origin']);
  assert.deepEqual(await res.json(), { error: 'nope' });
});

test('both functions answer the browser\'s preflight check', { skip: !fns && 'run npm install first' }, async () => {
  for (const [name, mod] of Object.entries(fns)) {
    assert.ok(mod.config.method.includes('OPTIONS'), `${name} accepts OPTIONS`);
    const res = await mod.default(new Request(`http://localhost/api/${name}`, { method: 'OPTIONS' }), {});
    assert.equal(res.status, 204, name);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*', name);
  }
});

test('the site calls its own API; only the portal copy points elsewhere', async () => {
  assert.equal(SERVER.origin, '', 'the website uses relative addresses');
  const build = await readFile(new URL('../tools/build.mjs', import.meta.url), 'utf8');
  assert.match(build, /https:\/\/lights-out-racing\.netlify\.app/);
});
