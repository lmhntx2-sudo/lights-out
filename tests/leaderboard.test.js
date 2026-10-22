import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, pickOffer, autoPick, skipToDecision, simToSeasonEnd, retireNow } from '../js/engine/game.js';
import { replayCareer, validateSetup, ReplayError } from '../js/engine/replay.js';
import { dailySetup } from '../js/engine/daily.js';
import { checkDisplayName } from '../js/core/displayname.js';
import { handleLeaderboard, removeEntry, KEYS, LIMITS } from '../netlify/lib/leaderboard.mjs';
import { isBlocked } from '../netlify/lib/blocklist.mjs';

const HELMET = { c1: '#F2F2F2', c2: '#E8002D' };
const setup = (seed, extra = {}) => ({ seed, first: 'Test', last: 'Driver', nat: 'GB', style: 'fighter', bg: 'prodigy', helmet: { ...HELMET }, number: 44, ...extra });

function dailyFor(date) {
  const d = dailySetup(date);
  return setup(d.seed, { nat: d.nat, style: d.style, bg: d.bg, daily: { date: d.date, goal: d.goal, goalText: d.goalText } });
}

// A deterministic player that uses every kind of button the UI has.
function play(s, { policy = 0, roundTrip = false } = {}) {
  let k = 0;
  while (s.stage !== 'retired' && k++ < 30000) {
    const p = prompt(s);
    if (p.type === 'choice') choose(s, policy === 0 ? autoPick(s) : (s.fn * (policy + 1)) % p.choices.length);
    else if (p.type === 'offers') {
      const ok = p.offers.map((o, i) => ({ o, i })).filter(({ o }) => (o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve') && !(o.cost && o.cost > s.driver.money));
      const rank = (o) => (o.series === 'F1' ? 100 : 0) + ({ F2: 30, F3: 20, F4: 10 }[o.series] || 0) + (o.kind === 'reserve' ? -50 : 0) + (o.tier || 0) * 2;
      ok.sort((a, b) => rank(b.o) - rank(a.o));
      pickOffer(s, !ok.length || s.driver.age >= 36 + policy ? p.offers.length - 1 : ok[0].i);
    } else if (p.type === 'race') (k % 7 === 0 ? simToSeasonEnd : k % 3 === 0 ? skipToDecision : advance)(s);
    else advance(s);
    if (roundTrip && k % 41 === 0) s = JSON.parse(JSON.stringify(s));
  }
  return s;
}

const withoutTime = ({ at, ...rest }) => rest;

// ------------------------------------------------------------ replay

test('a recorded career replays to the same summary', () => {
  for (const [i, opts] of [{}, { policy: 1 }, { policy: 2, roundTrip: true }].entries()) {
    const s = play(newGame(setup(`replay-${i}`)), opts);
    assert.equal(s.stage, 'retired');
    assert.ok(s.log.length > 100, 'every call was logged');
    assert.ok(s.log.every((a) => /^(a|r|[co]\d+)$/.test(a)), 'log is compact');
    const saved = JSON.parse(JSON.stringify(s));
    const r = replayCareer(saved.setup, saved.log);
    assert.deepEqual(withoutTime(r.retired), withoutTime(s.retired));
    assert.deepEqual(r.log, s.log);
  }
});

test('retiring from the menu mid-season is recorded and replays', () => {
  const s = newGame(setup('menu-retire'));
  for (let k = 0; k < 60; k++) {
    const p = prompt(s);
    if (p.type === 'choice') choose(s, 0);
    else if (p.type === 'offers') pickOffer(s, 0);
    else advance(s);
  }
  retireNow(s);
  assert.equal(s.log.at(-1), 'r');
  assert.deepEqual(withoutTime(replayCareer(s.setup, s.log).retired), withoutTime(s.retired));
});

test('tampered action logs are rejected', () => {
  const s = play(newGame(setup('tamper')));
  const log = s.log;
  const code = (fn) => {
    try {
      fn();
    } catch (e) {
      assert.ok(e instanceof ReplayError, e.message);
      return e.code;
    }
    return 'accepted';
  };
  assert.equal(code(() => replayCareer(s.setup, log.slice(0, -1))), 'unfinished', 'stopping before retirement');
  assert.equal(code(() => replayCareer(s.setup, [...log, 'a'])), 'log', 'acting after retirement');
  assert.equal(code(() => replayCareer(s.setup, log.map((a, i) => (i === 3 ? 'x9' : a)))), 'log', 'unknown action');
  assert.equal(code(() => replayCareer(s.setup, log.map((a, i) => (i === 0 ? 'c99' : a)))), 'log', 'a choice that was never offered');
  assert.equal(code(() => replayCareer(s.setup, ['a', ...log])), 'log', 'skipping the first decision');
  assert.equal(code(() => replayCareer(s.setup, log, { maxActions: 50 })), 'log', 'too many actions');

  // Buying a seat the driver can't afford: the engine would allow it, the UI never does.
  const poor = newGame(setup('poor-0', { bg: 'grafter', nat: 'GB', number: 9 }));
  while (prompt(poor).type !== 'offers' || !poor.offers.some((o) => o.cost > poor.driver.money)) {
    const p = prompt(poor);
    if (p.type === 'choice') choose(poor, autoPick(poor));
    else if (p.type === 'offers') pickOffer(poor, 0);
    else advance(poor);
  }
  const j = poor.offers.findIndex((o) => o.kind !== 'retire' && o.cost > poor.driver.money);
  assert.equal(code(() => replayCareer(poor.setup, [...poor.log, `o${j}`, 'r'])), 'log', 'an unaffordable seat');
});

test('setups the title screen could not make are rejected', () => {
  const bad = [
    { ...setup('ok'), seed: 'Bad Seed!' },
    { ...setup('ok'), nat: 'XX' },
    { ...setup('ok'), bg: 'billionaire' },
    { ...setup('ok'), number: 1 },
    { ...setup('ok'), helmet: { c1: 'red', c2: '#000000' } },
    { ...setup('ok'), first: '', last: ' ' },
    { ...setup('ok'), bg: 'constructor' },
  ];
  for (const b of bad) assert.throws(() => validateSetup(b), ReplayError, JSON.stringify(b));

  const d = dailyFor('2026-10-20');
  assert.deepEqual(validateSetup(d).daily, { date: '2026-10-20', goal: d.daily.goal, goalText: d.daily.goalText });
  assert.equal(validateSetup({ ...d, daily: { ...d.daily, done: true } }).daily.done, undefined, 'a completed flag is dropped');
  assert.equal(validateSetup({ ...d, daily: { ...d.daily, goalText: '贏一場一級方程式比賽。' } }).daily.goalText, d.daily.goalText, 'a translated goal text is fine');
  assert.throws(() => validateSetup({ ...d, daily: { ...d.daily, goal: 'jrtitle' } }), ReplayError, 'an easier goal');
  assert.throws(() => validateSetup({ ...d, bg: d.bg === 'royalty' ? 'grafter' : 'royalty' }), ReplayError, 'a different background');
  assert.throws(() => validateSetup({ ...d, daily: { ...d.daily, date: '2026-10-21' } }), ReplayError, 'another day');
});

// ------------------------------------------------------------ names

test('display names: length, characters and the blocklist', () => {
  for (const ok of ['Lewis', 'Max Power 33', "D'Artagnan", 'Zoë', '陳大文', 'Kimi-Matias R.', 'Ab']) assert.ok(checkDisplayName(ok).ok, ok);
  const zalgo = [...'Zalgo'].map((c) => `${c}\u0337\u0322\u031b\u0334`).join('');
  for (const bad of ['A', 'x'.repeat(21), 'Max 🏎️', '<script>', '!!!', 'Zero\u200bWidth', zalgo]) assert.ok(!checkDisplayName(bad).ok, bad);
  assert.equal(checkDisplayName('  Max   Power  ').name, 'Max Power');
  for (const bad of ['f u c k', 'Sh1t Driver', 'Big Ass', '屌你', 'FUUUCK']) assert.ok(isBlocked(bad), bad);
  for (const ok of ['Hancock', 'Scunthorpe', 'Yoshitaka', 'Wankel', 'Dickens', 'Pornchai', 'Sussex']) assert.ok(!isBlocked(ok), ok);
});

// ------------------------------------------------------------ the function

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

const NOW = Date.parse('2026-10-20T12:00:00Z');
const post = (body, raw) => new Request('https://x.test/api/leaderboard', { method: 'POST', body: raw ?? JSON.stringify(body) });
const get = (q) => new Request(`https://x.test/api/leaderboard${q}`);
const submission = (s, displayName = 'Speedy') => ({ setup: s.setup, actions: s.log, displayName, score: s.retired.score });

test('the function verifies, stores and ranks careers', async () => {
  const store = memoryStore();
  const purged = [];
  const ctx = { store, ip: '203.0.113.7', now: NOW, purge: async (t) => purged.push(...t) };
  const a = play(newGame(setup('board-a')));
  const b = play(newGame(setup('board-b')), { policy: 1 });

  let res = await handleLeaderboard(post(submission(a, 'Ayrton Fan')), ctx);
  assert.equal(res.status, 201);
  const first = await res.json();
  assert.equal(first.ranks.all, 1);
  assert.equal(first.entry.score, a.retired.score);
  assert.equal(first.entry.name, 'Ayrton Fan');
  assert.equal(first.entry.driver, 'Test Driver');
  assert.deepEqual(purged, ['lb-all']);

  res = await handleLeaderboard(post(submission(b, 'Bee')), ctx);
  assert.equal(res.status, 201);

  res = await handleLeaderboard(get('?board=all'), ctx);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Netlify-CDN-Cache-Control'), /max-age=30/);
  const board = await res.json();
  assert.equal(board.entries.length, 2);
  assert.ok(board.entries[0].score >= board.entries[1].score);

  // Sending the same career again changes nothing.
  res = await handleLeaderboard(post(submission(a, 'Someone Else')), ctx);
  assert.equal(res.status, 200);
  const again = await res.json();
  assert.equal(again.duplicate, true);
  assert.equal(again.entry.name, 'Ayrton Fan');
  assert.equal((await (await handleLeaderboard(get('?board=all'), ctx)).json()).entries.length, 2);

  // Only a hash of the IP is kept.
  const record = await store.get(KEYS.entry(first.entry.id));
  assert.match(record.ipHash, /^[0-9a-f]{32}$/);
  assert.ok(![...store.data.values()].some((v) => v.body.includes('203.0.113.7')), 'raw IP is never stored');
  assert.ok(!('ipHash' in board.entries[0]), 'the public board has no IP hash');

  // Moderation removes it everywhere and keeps it off.
  assert.equal(await removeEntry(store, first.entry.id), true);
  assert.equal((await (await handleLeaderboard(get('?board=all'), ctx)).json()).entries.length, 1);
  res = await handleLeaderboard(post(submission(a)), { ...ctx, ip: '198.51.100.1' });
  assert.equal(res.status, 410);
});

test('the function rejects tampered, unfinished and oversized submissions', async () => {
  const store = memoryStore();
  const ctx = { store, ip: '203.0.113.8', now: NOW };
  const s = play(newGame(setup('reject')));
  const send = async (body, raw) => {
    const res = await handleLeaderboard(post(body, raw), { ...ctx, ip: `10.0.0.${Math.floor(Math.random() * 250)}` });
    return { status: res.status, body: await res.json() };
  };

  // A save edited to claim a better score.
  let r = await send({ ...submission(s), score: s.retired.score + 1000 });
  assert.equal(r.status, 422);
  assert.equal(r.body.code, 'mismatch');

  // One decision changed: the career no longer matches what was claimed.
  const k = s.log.findIndex((a, i) => i > 200 && /^c[1-9]/.test(a));
  r = await send({ ...submission(s), actions: s.log.map((a, i) => (i === k ? 'c0' : a)) });
  assert.equal(r.status, 422);

  r = await send({ ...submission(s), actions: s.log.slice(0, 300) });
  assert.equal(r.status, 422);
  assert.match(r.body.error, /finished careers/);

  r = await send(null, `{"setup":{},"actions":["a"],"displayName":"Big","pad":"${'x'.repeat(LIMITS.bodyBytes)}"}`);
  assert.equal(r.status, 413);

  r = await send(null, 'not json');
  assert.equal(r.status, 400);

  r = await send({ ...submission(s), displayName: 'x' });
  assert.equal(r.status, 400);
  r = await send({ ...submission(s), displayName: 'Sh1t Racer' });
  assert.equal(r.status, 400);

  r = await send({ ...submission(s), actions: Array(LIMITS.actions + 1).fill('a') });
  assert.ok(r.status === 413 || r.status === 422, `too many steps gave ${r.status}`);

  assert.equal((await (await handleLeaderboard(get('?board=all'), ctx)).json()).entries.length, 0, 'nothing was stored');
});

test('submissions are rate limited per IP', async () => {
  const store = memoryStore();
  const s = play(newGame(setup('rate')));
  const ctx = { store, ip: '192.0.2.1', now: NOW };
  for (let i = 0; i < LIMITS.burst.max; i++) {
    const res = await handleLeaderboard(post(submission(s)), { ...ctx, now: NOW + i * 1000 });
    assert.ok(res.status < 300, `submission ${i} gave ${res.status}`);
  }
  const res = await handleLeaderboard(post(submission(s)), { ...ctx, now: NOW + 10_000 });
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get('Retry-After')) > 0);
  const other = await handleLeaderboard(post(submission(s)), { ...ctx, ip: '192.0.2.2', now: NOW + 10_000 });
  assert.ok(other.status < 300, 'another IP is not affected');
  const later = await handleLeaderboard(post(submission(s)), { ...ctx, now: NOW + LIMITS.burst.ms + 2000 });
  assert.ok(later.status < 300, 'the window moves on');
});

test('the all-time board keeps the top 100 only', async () => {
  const store = memoryStore();
  const fake = Array.from({ length: 100 }, (_, i) => ({ id: `f${i}`, name: 'Fake', score: 900000 - i, at: '2026-01-01T00:00:00.000Z' }));
  await store.setJSON(KEYS.all, { v: 1, entries: fake });
  const s = play(newGame(setup('top100')));
  const res = await handleLeaderboard(post(submission(s)), { store, ip: '192.0.2.9', now: NOW });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).ranks.all, null);
  const board = await store.get(KEYS.all);
  assert.equal(board.entries.length, 100);
  assert.ok(!board.entries.some((e) => e.id.length === 20), 'the low score did not get in');
});

test('daily boards rank completed goals first, then score', async () => {
  const store = memoryStore();
  const date = '2026-10-20';
  const careers = [0, 1, 2, 3].map((policy) => play(newGame(dailyFor(date)), { policy }));
  assert.ok(careers.some((s) => s.retired.daily.done) && careers.some((s) => !s.retired.daily.done), 'fixture has both outcomes');
  for (const [i, s] of careers.entries()) {
    const res = await handleLeaderboard(post(submission(s, `Daily ${i}`)), { store, ip: `192.0.2.${20 + i}`, now: NOW + i });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).dailyBoard, date);
  }
  const res = await handleLeaderboard(get(`?board=daily&date=${date}`), { store });
  const board = await res.json();
  assert.equal(board.goal, dailySetup(date).goalText);
  assert.equal(board.entries.length, 4);
  const key = (e) => [e.daily.done ? 1 : 0, e.score];
  for (let i = 1; i < board.entries.length; i++) {
    const [d0, s0] = key(board.entries[i - 1]);
    const [d1, s1] = key(board.entries[i]);
    assert.ok(d0 > d1 || (d0 === d1 && s0 >= s1), 'sorted by goal, then score');
  }
  assert.ok(board.entries[0].daily.done);

  // An old daily still counts all-time, but its day's board has closed.
  const late = await handleLeaderboard(post(submission(play(newGame(dailyFor('2026-09-01'))), 'Late')), { store, ip: '192.0.2.40', now: NOW });
  const lateBody = await late.json();
  assert.equal(lateBody.dailyBoard, null);
  assert.ok(lateBody.ranks.all >= 1);

  assert.equal((await handleLeaderboard(get('?board=daily&date=2026-13-45'), { store })).status, 400);
  assert.equal((await handleLeaderboard(get('?board=weekly'), { store })).status, 400);
  assert.equal((await handleLeaderboard(new Request('https://x.test/api/leaderboard', { method: 'DELETE' }), { store })).status, 405);
});
