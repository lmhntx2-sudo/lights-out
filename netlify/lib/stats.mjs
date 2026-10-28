// The anonymous play counter, independent of Netlify like leaderboard.mjs, so
// tests and the local dev server can run it against any store with the
// Netlify Blobs interface.
//
// The browser sends { e, id }: e is 'open' (the game was opened), 'start' (a
// career started) or 'finish' (a career ended in retirement), and id is a
// random id made in that browser. The id lets us count people instead of page
// loads. Only a salted hash of it is kept, and nothing else about the player.
//
// Days are Hong Kong days (UTC+8, no daylight saving): that is where the
// players are, so "today" matches theirs.
//
// Keys:
//   days/<date>                    { visitors, players, starts, finishes } for that day
//   totals                         the same, all time, with the first day counted
//   seen/<date>/<v|p>/<id hash>    marks an id as already counted as a visitor or player that day
//   seen/all/<v|p>/<id hash>       the same, all time
//   rate/<ip hash>                 events in the current hour, for rate limiting
//   config/salt                    random secret for the hashes, made on first use
import { createHash, randomBytes } from 'node:crypto';

export const LIMITS = {
  bodyBytes: 512,
  hour: { max: 120, ms: 60 * 60 * 1000 },
  days: { default: 30, max: 90 },
};

export const TZ = 'Asia/Hong_Kong';
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const KEYS = {
  day: (date) => `days/${date}`,
  totals: 'totals',
  seen: (scope, kind, hash) => `seen/${scope}/${kind}/${hash}`,
  rate: (hash) => `rate/${hash}`,
  salt: 'config/salt',
};

const EVENTS = new Set(['open', 'start', 'finish']);
// crypto.randomUUID(), or 32 hex digits from older browsers.
const ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i;

const sha = (text) => createHash('sha256').update(text).digest('hex');
const empty = () => ({ visitors: 0, players: 0, starts: 0, finishes: 0 });

export const hkDay = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

// Compare-and-swap on one key, retried when another event got there first.
async function update(store, key, fn, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const cur = await store.getWithMetadata(key, { type: 'json' });
    const next = fn(cur ? cur.data : null);
    if (next === undefined) return;
    const res = await store.setJSON(key, next, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (res?.modified) return;
    await new Promise((ok) => setTimeout(ok, 15 * 2 ** i + Math.random() * 30));
  }
  throw new HttpError(503, 'The counter is busy.');
}

const salts = new WeakMap();

async function saltFor(store, envSalt) {
  if (envSalt) return envSalt;
  if (!salts.has(store)) {
    await store.setJSON(KEYS.salt, { salt: randomBytes(32).toString('hex') }, { onlyIfNew: true });
    const cur = await store.get(KEYS.salt, { type: 'json' });
    salts.set(store, cur.salt);
  }
  return salts.get(store);
}

// A fixed one-hour window per connection: plenty for anyone playing, too few
// to make the numbers mean nothing.
async function rateLimit(store, ipHash, now) {
  let over = false;
  await update(store, KEYS.rate(ipHash), (cur) => {
    const fresh = !cur || now - cur.start >= LIMITS.hour.ms;
    const win = fresh ? { start: now, n: 0 } : cur;
    over = win.n >= LIMITS.hour.max;
    if (over) return undefined;
    return { start: win.start, n: win.n + 1 };
  });
  if (over) throw new HttpError(429, 'Too many events.', { 'Retry-After': '3600' });
}

// True the first time this id is marked in this scope.
async function firstTime(store, scope, kind, idHash) {
  const res = await store.setJSON(KEYS.seen(scope, kind, idHash), 1, { onlyIfNew: true });
  return !!res?.modified;
}

async function readBody(req) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > LIMITS.bodyBytes) throw new HttpError(413, 'Too large.');
  const text = await req.text();
  if (text.length > LIMITS.bodyBytes) throw new HttpError(413, 'Too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Not JSON.');
  }
}

async function record(req, { store, ip, now, envSalt }) {
  const body = await readBody(req);
  const e = body?.e;
  const id = body?.id;
  if (!EVENTS.has(e) || typeof id !== 'string' || !ID.test(id)) throw new HttpError(400, 'Unknown event.');

  const salt = await saltFor(store, envSalt);
  await rateLimit(store, sha(`${salt}|ip|${ip || 'unknown'}`).slice(0, 32), now);

  const idHash = sha(`${salt}|id|${id.toLowerCase()}`).slice(0, 32);
  const date = hkDay(now);
  const add = empty();
  const addAll = empty();
  if (e === 'open') {
    if (await firstTime(store, date, 'v', idHash)) add.visitors = 1;
    if (await firstTime(store, 'all', 'v', idHash)) addAll.visitors = 1;
  } else if (e === 'start') {
    add.starts = addAll.starts = 1;
    if (await firstTime(store, date, 'p', idHash)) add.players = 1;
    if (await firstTime(store, 'all', 'p', idHash)) addAll.players = 1;
  } else {
    add.finishes = addAll.finishes = 1;
  }

  const bump = (cur, inc, extra = {}) => {
    if (!Object.values(inc).some(Boolean)) return undefined;
    const next = { ...empty(), ...extra, ...cur };
    for (const k of Object.keys(inc)) next[k] += inc[k];
    return next;
  };
  await update(store, KEYS.day(date), (cur) => bump(cur, add));
  await update(store, KEYS.totals, (cur) => bump(cur, addAll, { since: date }));
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

async function report(req, { store, now }) {
  const asked = Number(new URL(req.url).searchParams.get('days') || LIMITS.days.default);
  const n = Number.isFinite(asked) ? Math.min(LIMITS.days.max, Math.max(1, Math.floor(asked))) : LIMITS.days.default;
  const dates = Array.from({ length: n }, (_, i) => hkDay(now - i * DAY_MS));
  const [totals, ...days] = await Promise.all([
    store.get(KEYS.totals, { type: 'json' }),
    ...dates.map((d) => store.get(KEYS.day(d), { type: 'json' })),
  ]);
  return json({
    tz: TZ,
    today: dates[0],
    days: dates.map((date, i) => ({ date, ...empty(), ...days[i] })),
    totals: { ...empty(), since: null, ...totals },
  });
}

// GET  ?days=30                       ->  { tz, today, days: [newest first], totals }
// POST { e: 'open'|'start'|'finish', id }  ->  204
export async function handleStats(req, { store, ip, now = Date.now(), salt } = {}) {
  try {
    if (req.method === 'GET') return await report(req, { store, now });
    if (req.method === 'POST') return await record(req, { store, ip, now, envSalt: salt });
    return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status, e.headers);
    console.error(e);
    return json({ error: 'Something went wrong.' }, 500);
  }
}
