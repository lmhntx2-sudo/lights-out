// The daily season: one Formula 1 season as a rookie in the day's seat. It has
// to end after one season, replay on the server, go on its own day's board only
// and leave ordinary careers exactly as they were.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, autoPick, retireNow, skipToDecision, dayBrief } from '../js/engine/game.js';
import { ONE_SEASON, daySetup, daySquares, dayNumber } from '../js/engine/oneseason.js';
import { replayCareer, validateSetup, ReplayError } from '../js/engine/replay.js';
import { handleLeaderboard, KEYS } from '../netlify/lib/leaderboard.mjs';

const HELMET = { c1: '#F2F2F2', c2: '#E8002D' };

function setupFor(date, extra = {}) {
  const d = daySetup(date);
  return { seed: d.seed, first: 'Test', last: 'Driver', nat: d.nat, style: d.style, bg: d.bg, helmet: { ...HELMET }, number: 44, daily: null, mode: ONE_SEASON, day: date, ...extra };
}

// policy 0 takes the best odds; the others pick by a pattern, so careers differ.
function play(s, policy = 0) {
  let k = 0;
  while (s.stage !== 'retired' && k++ < 3000) {
    const p = prompt(s);
    assert.notEqual(p.type, 'offers', 'a daily season never reaches the contract talks');
    if (p.type === 'choice') choose(s, policy === 0 ? autoPick(s) : (s.fn * (policy + 1)) % p.choices.length);
    else if (p.type === 'race' && policy === 2 && k % 3 === 0) skipToDecision(s);
    else advance(s);
  }
  return s;
}

const days = (n, from = '2026-11-14') => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
const withoutTime = ({ at, ...rest }) => rest;

test('a daily season is one Formula 1 season and then it is over', () => {
  for (const date of days(30)) {
    const s = play(newGame(setupFor(date)), date.endsWith('7') ? 1 : 0);
    assert.equal(s.stage, 'retired', date);
    const d = s.retired.day;
    assert.equal(s.retired.how, ONE_SEASON);
    assert.equal(s.career.hist.length, 1, 'one season in the history');
    assert.equal(s.career.hist[0].series, 'F1');
    assert.equal(d.date, date);
    assert.equal(d.done, d.of, 'every round was run');
    assert.ok(d.of >= 24 && d.rounds.length === d.of);
    assert.equal(d.pts, s.career.hist[0].pts);
    assert.equal(d.pos, s.career.hist[0].pos);
    assert.equal(d.wins, d.rounds.filter((x) => x.p === 1 && !x.d).length);
    assert.equal(Math.floor(d.score / 1000), d.pts, 'the score is the points, then a tie-break');
    assert.equal(s.retired.score, d.score);
    assert.ok(s.ach.every((id) => id === 'daily'), 'no career achievements');
    assert.equal(s.ach.includes('daily'), d.met, 'the daily achievement goes with the team target');
    assert.ok(s.log.length < 120, `about fifty presses, not ${s.log.length}`);
  }
});

test('the day decides the driver, and the brief matches the game', () => {
  const seen = new Set();
  for (const date of days(40)) {
    const b = dayBrief(date);
    const s = newGame(setupFor(date));
    assert.equal(s.teams[s.career.team].name, b.team);
    assert.equal(s.driver.age, b.age);
    assert.equal(s.career.series, 'F1');
    assert.ok(s.teams[s.career.team].seats.includes('P'));
    assert.ok(s.drivers[s.rivalId] && s.drivers[s.rivalId].team !== s.career.team, 'the rival drives for another team');
    assert.deepEqual(daySetup(date), daySetup(date));
    seen.add(b.team);
  }
  assert.ok(seen.size >= 6, 'different cars on different days');
  assert.equal(dayNumber('2026-11-14'), 1);
  assert.equal(dayNumber('2026-12-01'), 18);
});

test('the name, number and helmet change nothing about the season', () => {
  const date = '2026-11-20';
  const a = play(newGame(setupFor(date)));
  const b = play(newGame(setupFor(date, { first: '陳', last: '大文', number: 7, helmet: { c1: '#111827', c2: '#FFD23F', p: 'stars' } })));
  assert.deepEqual(a.retired.day, b.retired.day);
});

test('stopping early banks the points so far', () => {
  const s = newGame(setupFor('2026-11-21'));
  for (let k = 0; k < 14; k++) {
    const p = prompt(s);
    if (p.type === 'choice') choose(s, autoPick(s));
    else advance(s);
  }
  if (s.pending) choose(s, autoPick(s));
  retireNow(s);
  assert.equal(s.stage, 'retired');
  assert.equal(s.retired.how, ONE_SEASON);
  assert.ok(s.retired.day.done > 0 && s.retired.day.done < s.retired.day.of);
  const r = replayCareer(s.setup, s.log);
  assert.deepEqual(withoutTime(r.retired), withoutTime(s.retired));
});

test('a daily season replays, and only the one for its date is accepted', () => {
  const date = '2026-11-15';
  for (const policy of [0, 1, 2]) {
    const s = play(newGame(setupFor(date)), policy);
    const saved = JSON.parse(JSON.stringify(s));
    const r = replayCareer(saved.setup, saved.log);
    assert.deepEqual(withoutTime(r.retired), withoutTime(s.retired));
  }
  // As the game stores it: newGame adds the content version.
  const good = newGame(setupFor(date)).setup;
  assert.equal(validateSetup(good).mode, ONE_SEASON);
  const d = daySetup(date);
  const otherNat = d.nat === 'GB' ? 'IT' : 'GB';
  const otherStyle = d.style === 'fighter' ? 'rain' : 'fighter';
  const bad = [
    { ...good, nat: otherNat },
    { ...good, style: otherStyle },
    { ...good, seed: 'day-2026-11-16' },
    { ...good, day: '2026-11-16' },
    { ...good, day: '2026-13-40' },
    { ...good, mode: 'endless' },
    { ...good, daily: { date, goal: 'f1win' } },
    { ...good, legacy: { gen: 2 } },
    { ...good, cv: 2 },
  ];
  for (const b of bad) assert.throws(() => validateSetup(b), ReplayError, JSON.stringify(b).slice(0, 90));
  // A career with no mode stays as it was: no mode or day key appears.
  const plain = validateSetup({ seed: 'abc123', first: 'A', last: 'B', nat: 'GB', style: 'fighter', bg: 'prodigy', helmet: { ...HELMET }, number: 5, cv: 3 });
  assert.ok(!('mode' in plain) && !('day' in plain));
  // A full career cannot ride on a daily season's seed and claim the mode later.
  assert.throws(() => replayCareer({ ...good, mode: undefined, day: undefined }, play(newGame(setupFor(date))).log), ReplayError);
});

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

const post = (s, displayName) => new Request('https://x.test/api/leaderboard', { method: 'POST', body: JSON.stringify({ setup: s.setup, actions: s.log, displayName, score: s.retired.score }) });
const get = (q) => new Request(`https://x.test/api/leaderboard${q}`);

test("a daily season goes on its own day's board, by points, and nowhere else", async () => {
  const store = memoryStore();
  const date = '2026-11-16';
  const now = Date.parse(`${date}T12:00:00Z`);
  const runs = [0, 1, 2, 3].map((policy) => play(newGame(setupFor(date)), policy));
  for (const [i, s] of runs.entries()) {
    const res = await handleLeaderboard(post(s, `Day ${i}`), { store, ip: `192.0.2.${50 + i}`, now: now + i });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.dayBoard, date);
    assert.equal(body.ranks.all, null);
    assert.ok(body.ranks.day >= 1);
    assert.equal(body.entry.day.pts, s.retired.day.pts);
  }
  const board = await (await handleLeaderboard(get(`?board=day&date=${date}`), { store })).json();
  assert.equal(board.entries.length, 4);
  for (let i = 1; i < board.entries.length; i++) assert.ok(board.entries[i - 1].score >= board.entries[i].score, 'most points first');
  assert.equal((await (await handleLeaderboard(get('?board=all'), { store })).json()).entries.length, 0, 'never on the all-time board');
  assert.equal(await store.get(KEYS.all), null);

  // Yesterday's season can still come in today; last week's cannot, and leaves nothing behind.
  const size = store.data.size;
  const old = play(newGame(setupFor('2026-11-08')));
  const late = await handleLeaderboard(post(old, 'Late'), { store, ip: '192.0.2.90', now });
  assert.equal(late.status, 422);
  assert.equal((await late.json()).code, 'closed');
  assert.ok(![...store.data.keys()].some((k) => k.startsWith('entries/') && store.data.get(k).body.includes('2026-11-08')), 'a closed day stores no entry');
  assert.ok(store.data.size <= size + 2, 'only the rate limit and salt may have changed');
  const yesterday = await handleLeaderboard(post(play(newGame(setupFor('2026-11-15'))), 'Yesterday'), { store, ip: '192.0.2.91', now });
  assert.equal(yesterday.status, 201);

  // A changed score is refused like any other career.
  const cheat = runs[0];
  const res = await handleLeaderboard(new Request('https://x.test/api/leaderboard', { method: 'POST', body: JSON.stringify({ setup: cheat.setup, actions: cheat.log, displayName: 'Cheat', score: cheat.retired.score + 1000 }) }), { store, ip: '192.0.2.92', now });
  assert.equal(res.status, 422);
  assert.equal((await handleLeaderboard(get('?board=day&date=nope'), { store })).status, 400);
});

test('result squares: one per round, in two rows', () => {
  const rounds = [{ p: 1 }, { p: 3 }, { p: 7 }, { p: 14 }, { p: 5, d: 1 }, { p: 0 }];
  assert.deepEqual(daySquares(rounds), ['🟪🟩⬜⬛🟥➖']);
  const full = daySquares(Array.from({ length: 24 }, () => ({ p: 4 })));
  assert.equal(full.length, 2);
  assert.equal([...full[0]].length, 12);
  assert.equal(daySquares(rounds, 8)[0].endsWith('▫️▫️'), true, 'rounds not run yet are shown empty');
});

test('challenge links carry a score to beat and nothing else', async () => {
  const { careerVs, dayVs, parseVs } = await import('../js/core/vs.js');
  const sum = { score: 12340, f1: { titles: 3, wins: 41 }, name: 'Freddie ~ Lockhart <b>', day: { pts: 86, pos: 7 } };
  assert.deepEqual(parseVs(careerVs(sum)), { kind: 'career', score: 12340, titles: 3, wins: 41, name: 'Freddie ~ Lockhart b' });
  assert.deepEqual(parseVs(dayVs(sum), '2026-11-14'), { kind: 'day', date: '2026-11-14', pts: 86, pos: 7, name: 'Freddie ~ Lockhart b' });
  for (const bad of [null, '', 'abc', '1~2~3', '-5~1~1~X', '1e9~1~1~X', '10~1~1~', `1~1~1~${'x'.repeat(200)}`]) assert.equal(parseVs(bad), null, String(bad));
  assert.equal(parseVs('86~99~X', '2026-11-14'), null, 'a position off the grid');
  assert.equal(parseVs('5000~1~12~陳大文').name, '陳大文');
});

test('daily seasons are counted on their own in the play stats', async () => {
  const { handleStats } = await import('../netlify/lib/stats.mjs');
  const store = memoryStore();
  const now = Date.parse('2026-11-14T04:00:00Z');
  const send = (e, id) => handleStats(new Request('https://x.test/api/stats', { method: 'POST', body: JSON.stringify({ e, id }) }), { store, ip: '192.0.2.1', now });
  const id = '0123456789abcdef0123456789abcdef';
  for (const e of ['open', 'dstart', 'dfinish', 'dstart', 'start']) assert.equal((await send(e, id)).status, 204);
  const data = await (await handleStats(new Request('https://x.test/api/stats?days=2'), { store, now })).json();
  assert.deepEqual(data.days[0], { date: '2026-11-14', visitors: 1, players: 1, starts: 1, finishes: 0, dstarts: 2, dfinishes: 1 });
  assert.deepEqual(data.days[1], { date: '2026-11-13', visitors: 0, players: 0, starts: 0, finishes: 0 }, 'a day without daily seasons looks as it always did');
  assert.equal(data.totals.dstarts, 2);
});
