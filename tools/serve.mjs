// Tiny static file server for local play-testing. No dependencies for the game
// itself; after `npm install` it also runs the global leaderboard function.
// Usage: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// Dev helper: POST /__save/assets/og.png (or /__save/tmp/x.png) with a PNG body writes it
// to disk. Used to export images rendered in the browser (social preview, app icons).
async function save(req, res, path) {
  const m = /^\/__save\/(assets|tmp)\/([a-z0-9-]+\.png)$/.exec(path);
  if (!m) {
    res.writeHead(400).end('bad name');
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const dir = join(root, m[1]);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, m[2]), Buffer.concat(chunks));
  res.writeHead(200).end('saved');
}

// Dev helper: /api/leaderboard runs the real Netlify Function against Netlify's
// local Blobs server (data in tmp/blobs). Without `npm install` the game still
// runs and the leaderboard just shows its "not available" message.
async function startLeaderboard() {
  try {
    const { startLocalBlobs } = await import('./local-blobs.mjs');
    const { default: fn } = await import('../netlify/functions/leaderboard.mjs');
    await startLocalBlobs();
    return fn;
  } catch {
    console.log('Global leaderboard is off. Run npm install to try it locally.');
    return null;
  }
}

const leaderboard = await startLeaderboard();

async function api(req, res) {
  if (!leaderboard) {
    res.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'The global leaderboard is not running. Run npm install, then npm start.' }));
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks);
  const request = new Request(new URL(req.url, `http://localhost:${port}`), { method: req.method, headers: req.headers, body });
  const out = await leaderboard(request, { ip: req.socket.remoteAddress, deploy: { context: 'dev' } });
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/leaderboard') return await api(req, res);
    if (req.method === 'POST' && url.pathname.startsWith('/__save/')) return await save(req, res, url.pathname);
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let file = join(root, path);
    if (!file.startsWith(root)) throw new Error('outside root');
    const info = await stat(file).catch(() => null);
    if (!info) file = join(root, 'index.html');
    else if (info.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, () => console.log(`Lights Out running at http://localhost:${port}`));
