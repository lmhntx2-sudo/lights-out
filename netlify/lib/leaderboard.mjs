// The global leaderboard, independent of Netlify so tests and the local dev
// server can run it against any store with the Netlify Blobs interface:
//   get(key, { type: 'json' })  getWithMetadata(key, { type: 'json' })
//   setJSON(key, value, { onlyIfNew | onlyIfMatch })  ->  { modified }
//
// A submission is { setup, actions, displayName, score }. The career is
// replayed here with the game's own engine, so only lives the game could
// really have produced get on the board.
//
// Keys:
//   boards/all-time        top 100 by legacy score
//   boards/daily/<date>    top 100 for that daily challenge: goal met first, then score
//   entries/<id>           every accepted career in full (private: holds the IP hash)
//   rate/<ip hash>         recent submission times, for rate limiting
//   config/salt            random secret for the IP hash, made on first use
import { createHash, randomBytes } from 'node:crypto';
import { replayCareer, ReplayError, MAX_ACTIONS } from '../../js/engine/replay.js';
import { checkDisplayName } from '../../js/core/displayname.js';
import { dailySetup } from '../../js/engine/daily.js';
import { isBlocked } from './blocklist.mjs';

export const LIMITS = {
  bodyBytes: 100 * 1024,
  actions: MAX_ACTIONS,
  boardSize: 100,
  burst: { max: 5, ms: 10 * 60 * 1000 },
  day: { max: 30, ms: 24 * 60 * 60 * 1000 },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const KEYS = {
  all: 'boards/all-time',
  daily: (date) => `boards/daily/${date}`,
  entry: (id) => `entries/${id}`,
  rate: (hash) => `rate/${hash}`,
  salt: 'config/salt',
};

export const TAGS = { all: 'lb-all', daily: (date) => `lb-daily-${date}` };

const byScore = (a, b) => b.score - a.score || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
const byDaily = (a, b) => Number(!!b.daily?.done) - Number(!!a.daily?.done) || byScore(a, b);

const sha = (text) => createHash('sha256').update(text).digest('hex');

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

const isDate = (d) => typeof d === 'string' && DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// A daily challenge counts for its day's board if it is submitted around that
// day: players are in every time zone and a career can run past midnight.
export function dailyOpen(date, now) {
  const t = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${utcDay(now)}T00:00:00Z`);
  return t >= today - 2 * DAY_MS && t <= today + DAY_MS;
}

// Compare-and-swap on one key, retried when another submission got there first.
async function update(store, key, fn, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const cur = await store.getWithMetadata(key, { type: 'json' });
    const next = fn(cur ? cur.data : null);
    if (next === undefined) return;
    const res = await store.setJSON(key, next, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (res?.modified) return;
    await new Promise((ok) => setTimeout(ok, 15 * 2 ** i + Math.random() * 30));
  }
  throw new HttpError(503, 'The leaderboard is busy. Try again in a moment.');
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

async function rateLimit(store, ipHash, now) {
  let retryAfter = 0;
  await update(store, KEYS.rate(ipHash), (cur) => {
    const hits = (cur?.hits || []).filter((t) => now - t < LIMITS.day.ms);
    const recent = hits.filter((t) => now - t < LIMITS.burst.ms);
    retryAfter = 0;
    if (recent.length >= LIMITS.burst.max) retryAfter = recent[0] + LIMITS.burst.ms - now;
    else if (hits.length >= LIMITS.day.max) retryAfter = hits[0] + LIMITS.day.ms - now;
    if (retryAfter) return undefined;
    return { hits: [...hits, now] };
  });
  if (retryAfter) {
    const secs = Math.max(1, Math.ceil(retryAfter / 1000));
    const wait = secs > 90 * 60 ? `${Math.ceil(secs / 3600)} hours` : `${Math.ceil(secs / 60)} minutes`;
    throw new HttpError(429, `Too many submissions from your connection. Try again in about ${wait}.`, { headers: { 'Retry-After': String(secs) } });
  }
}

// The driver's own name is shown too, but only if it would pass as a display name.
function driverName(name) {
  const c = checkDisplayName(name, { max: 61 });
  return c.ok && !isBlocked(c.name) ? c.name : null;
}

function publicEntry(id, displayName, sum, at) {
  return {
    id,
    name: displayName,
    driver: driverName(sum.name),
    flag: sum.flag,
    nat: sum.nat,
    number: sum.number,
    color: sum.livery?.color || null,
    tier: sum.tier,
    tierKey: sum.tierKey || null,
    score: sum.score,
    titles: sum.f1.titles,
    wins: sum.f1.wins,
    podiums: sum.f1.podiums,
    starts: sum.f1.starts,
    jrTitles: sum.junior.titles,
    worth: sum.worth,
    age: sum.age,
    endYear: sum.endYear,
    how: sum.how,
    seed: sum.seed,
    daily: sum.daily ? { date: sum.daily.date, done: !!sum.daily.done } : null,
    at,
  };
}

// Put an entry on a board if it makes the top 100. Returns its rank, or null.
async function place(store, key, entry, cmp) {
  let rank = null;
  await update(store, key, (cur) => {
    const others = (cur?.entries || []).filter((e) => e.id !== entry.id);
    const all = [...others, entry].sort(cmp).slice(0, LIMITS.boardSize);
    const i = all.findIndex((e) => e.id === entry.id);
    rank = i >= 0 ? i + 1 : null;
    const already = cur?.entries?.findIndex((e) => e.id === entry.id);
    if (rank === null || already === i) return undefined;
    return { v: 1, entries: all };
  });
  return rank;
}

async function readBody(req) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > LIMITS.bodyBytes) throw new HttpError(413, 'That career log is too large to submit.');
  const text = await req.text();
  if (text.length > LIMITS.bodyBytes) throw new HttpError(413, 'That career log is too large to submit.');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'The submission could not be read.');
  }
}

async function submit(req, { store, ip, now, envSalt, purge }) {
  const body = await readBody(req);
  if (!body || typeof body !== 'object') throw new HttpError(400, 'The submission could not be read.');

  const nameCheck = checkDisplayName(body.displayName);
  if (!nameCheck.ok) throw new HttpError(400, `Display name: ${nameCheck.error}`);
  if (isBlocked(nameCheck.name)) throw new HttpError(400, 'Please pick a different display name.');
  const displayName = nameCheck.name;

  const ipHash = sha(`${await saltFor(store, envSalt)}|${ip || 'unknown'}`).slice(0, 32);
  await rateLimit(store, ipHash, now);

  let s;
  try {
    s = replayCareer(body.setup, body.actions, { maxActions: LIMITS.actions });
  } catch (e) {
    if (!(e instanceof ReplayError)) throw e;
    const msg = e.code === 'unfinished' ? 'Only finished careers can go on the leaderboard.' : `This career could not be verified. ${e.message}`;
    throw new HttpError(422, msg, { code: e.code });
  }
  const sum = s.retired;
  if (body.score != null && body.score !== sum.score) {
    throw new HttpError(422, 'This career did not replay to the same result. That happens when the game is updated while a career is in progress, or when a save has been edited.', { code: 'mismatch' });
  }

  // The same career always gets the same id, so sending it twice is harmless.
  const id = sha(JSON.stringify([s.setup, body.actions])).slice(0, 20);
  const at = new Date(now).toISOString();
  let record = {
    id,
    entry: publicEntry(id, displayName, sum, at),
    displayName,
    ipHash,
    at,
    setup: s.setup,
    actions: body.actions,
    summary: { ...sum, at: now },
  };
  const created = await store.setJSON(KEYS.entry(id), record, { onlyIfNew: true });
  const duplicate = !created?.modified;
  if (duplicate) {
    record = await store.get(KEYS.entry(id), { type: 'json' });
    if (record?.removed) throw new HttpError(410, 'This career was removed from the leaderboard.');
  }

  const entry = record.entry;
  const ranks = { all: await place(store, KEYS.all, entry, byScore), daily: null };
  const tags = [TAGS.all];
  const daily = entry.daily && isDate(entry.daily.date) && dailyOpen(entry.daily.date, now) ? entry.daily.date : null;
  if (daily) {
    ranks.daily = await place(store, KEYS.daily(daily), entry, byDaily);
    tags.push(TAGS.daily(daily));
  }
  await purge?.(tags);
  return json({ entry, ranks, duplicate, dailyBoard: daily }, duplicate ? 200 : 201);
}

async function getBoard(req, { store }) {
  const url = new URL(req.url);
  const board = url.searchParams.get('board') || 'all';
  let key;
  let extra = {};
  let tag;
  if (board === 'all') {
    key = KEYS.all;
    tag = TAGS.all;
  } else if (board === 'daily') {
    const date = url.searchParams.get('date');
    if (!isDate(date)) throw new HttpError(400, 'Pick a date as YYYY-MM-DD.');
    key = KEYS.daily(date);
    tag = TAGS.daily(date);
    extra = { date, goal: dailySetup(date).goalText };
  } else {
    throw new HttpError(400, 'Unknown leaderboard.');
  }
  const cur = await store.get(key, { type: 'json' });
  return json({ board, ...extra, entries: cur?.entries || [] }, 200, {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Netlify-CDN-Cache-Control': 'public, durable, max-age=30, stale-while-revalidate=60',
    'Netlify-Vary': 'query=board|date',
    'Netlify-Cache-Tag': tag,
  });
}

// GET  ?board=all | ?board=daily&date=YYYY-MM-DD   ->  { entries }
// POST { setup, actions, displayName, score }      ->  { entry, ranks }
export async function handleLeaderboard(req, { store, ip, now = Date.now(), salt, purge } = {}) {
  try {
    if (req.method === 'GET') return await getBoard(req, { store });
    if (req.method === 'POST') return await submit(req, { store, ip, now, envSalt: salt, purge });
    return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...(e.extra.code ? { code: e.extra.code } : {}) }, e.status, e.extra.headers || {});
    console.error(e);
    return json({ error: 'The leaderboard is having trouble. Try again later.' }, 500);
  }
}

// Moderation: hide a career for good. Its record stays, marked removed, so the
// same career can't simply be submitted again.
export async function removeEntry(store, id) {
  let record = null;
  await update(store, KEYS.entry(id), (cur) => {
    record = cur;
    if (!cur || cur.removed) return undefined;
    return { ...cur, removed: new Date().toISOString() };
  });
  if (!record) return false;
  const drop = (cur) => (cur?.entries?.some((e) => e.id === id) ? { ...cur, entries: cur.entries.filter((e) => e.id !== id) } : undefined);
  await update(store, KEYS.all, drop);
  if (record.entry.daily) await update(store, KEYS.daily(record.entry.daily.date), drop);
  return true;
}
