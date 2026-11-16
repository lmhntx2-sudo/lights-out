// Legend difficulty: a harder career with its own board. It has to replay on the
// server, be clearly harder than standard, and leave standard careers alone.
// Also here: the board that starts again every month.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';
import { replayCareer, validateSetup, ReplayError } from '../js/engine/replay.js';
import { chanceOf } from '../js/engine/story.js';
import { LEGEND } from '../js/engine/constants.js';
import { heirOf, shareText } from '../js/engine/legacy.js';
import { handleLeaderboard, removeEntry, KEYS, hkMonth } from '../netlify/lib/leaderboard.mjs';

const HELMET = { c1: '#F2F2F2', c2: '#E8002D' };
const setup = (seed, extra = {}) => ({ seed, first: 'Test', last: 'Driver', nat: 'GB', style: 'fighter', bg: 'prodigy', helmet: { ...HELMET }, number: 44, daily: null, ...extra });

function play(s) {
  for (let k = 0; k < 40000 && s.stage !== 'retired'; k++) {
    const p = prompt(s);
    if (p.type === 'choice') choose(s, autoPick(s));
    else if (p.type === 'offers') {
      const ok = p.offers.map((o, i) => ({ o, i })).filter(({ o }) => (o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve') && !(o.cost && o.cost > s.driver.money));
      const rank = (o) => (o.series === 'F1' ? 100 : 0) + ({ F2: 30, F3: 20, F4: 10 }[o.series] || 0) + (o.kind === 'reserve' ? -50 : 0) + (o.tier || 0) * 2;
      ok.sort((a, b) => rank(b.o) - rank(a.o));
      pickOffer(s, !ok.length || s.driver.age >= 37 ? p.offers.length - 1 : ok[0].i);
    } else advance(s);
  }
  return s;
}

const withoutTime = ({ at, ...rest }) => rest;

test('a Legend career replays, says what it is, and standard setups have no difficulty key', () => {
  const s = play(newGame(setup('legend-a', { diff: 'legend' })));
  assert.equal(s.stage, 'retired');
  assert.equal(s.retired.diff, 'legend');
  assert.equal(s.setup.diff, 'legend');
  assert.ok(s.feed.length && shareText(s.retired, 'https://x/').includes('Legend difficulty.'));
  const saved = JSON.parse(JSON.stringify(s));
  const r = replayCareer(saved.setup, saved.log);
  assert.deepEqual(withoutTime(r.retired), withoutTime(s.retired));

  // Claiming the same presses on standard difficulty is a different career.
  const { diff, ...standard } = saved.setup;
  let other = null;
  try {
    other = replayCareer(standard, saved.log);
  } catch (e) {
    assert.ok(e instanceof ReplayError);
  }
  if (other) assert.notDeepEqual(withoutTime(other.retired), withoutTime(s.retired));

  const plain = play(newGame(setup('legend-a')));
  assert.ok(!('diff' in plain.setup) && !('diff' in plain.retired));
  assert.ok(!('diff' in validateSetup(plain.setup)));
  for (const bad of [{ diff: 'easy' }, { diff: 'standard' }, { diff: true }, { diff: 'legend', cv: 2 }, { diff: 'legend', daily: { date: '2026-11-20', goal: 'f1win' } }]) {
    assert.throws(() => validateSetup({ ...s.setup, ...bad }), ReplayError, JSON.stringify(bad));
  }
});

test('Legend is harder: shorter odds, and far fewer wins over the same seeds', () => {
  const a = newGame(setup('odds'));
  const b = newGame(setup('odds', { diff: 'legend' }));
  const ch = { stat: 'pace', base: 60 };
  assert.equal(chanceOf(b, ch), chanceOf(a, ch) - LEGEND.odds);
  assert.equal(chanceOf(b, { stat: 'pace', base: 0 }), 5, 'never below five percent');
  assert.equal(chanceOf(b, { label: 'sure thing' }), 100, 'choices without a roll stay certain');
  assert.equal(chanceOf(b, { p: 40 }), 40, 'fixed odds stay fixed');

  let std = 0;
  let leg = 0;
  let legStarts = 0;
  for (let i = 0; i < 14; i++) {
    const bg = ['prodigy', 'royalty', 'grafter', 'simracer'][i % 4];
    std += play(newGame(setup(`hard-${i}`, { bg }))).retired.f1.wins;
    const l = play(newGame(setup(`hard-${i}`, { bg, diff: 'legend' }))).retired;
    leg += l.f1.wins;
    legStarts += l.f1.starts;
  }
  assert.ok(std > 60, `the standard fixture wins races (${std})`);
  assert.ok(leg < std * 0.7, `Legend wins clearly fewer (${leg} against ${std})`);
  assert.ok(legStarts > 500, `Legend careers still reach Formula 1 (${legStarts} starts)`);
});

test("a Legend parent's kid starts on Legend", () => {
  // Having a kid depends on the story; the flag is what heirOf goes by.
  const legend = play(newGame(setup('kid', { diff: 'legend', bg: 'royalty' })));
  legend.flags.parent = legend.year - 6;
  assert.equal(heirOf(legend).diff, 'legend');
  const standard = play(newGame(setup('kid', { bg: 'royalty' })));
  standard.flags.parent = standard.year - 6;
  assert.equal(heirOf(standard).diff, null);
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
const board = async (store, q, now) => (await (await handleLeaderboard(get(q), { store, now })).json()).entries;

test('the Legend board takes Legend careers only, and the month board starts again each month', async () => {
  const store = memoryStore();
  // 30 November, 23:30 in Hong Kong, and then half an hour into December.
  const nov = Date.parse('2026-11-30T15:30:00Z');
  const dec = Date.parse('2026-11-30T16:30:00Z');
  assert.equal(hkMonth(nov), '2026-11');
  assert.equal(hkMonth(dec), '2026-12');

  const legend = play(newGame(setup('board-legend', { diff: 'legend' })));
  const standard = play(newGame(setup('board-standard')));
  const later = play(newGame(setup('board-later', { bg: 'royalty' })));

  let res = await handleLeaderboard(post(legend, 'Hard Way'), { store, ip: '192.0.2.1', now: nov });
  assert.equal(res.status, 201);
  let body = await res.json();
  assert.equal(body.entry.diff, 'legend');
  assert.deepEqual([body.ranks.all, body.ranks.month, body.ranks.legend], [1, 1, 1]);
  assert.equal(body.month, '2026-11');

  res = await handleLeaderboard(post(standard, 'Easy Way'), { store, ip: '192.0.2.2', now: nov + 1000 });
  body = await res.json();
  assert.equal(body.ranks.legend, null);
  assert.ok(body.ranks.month >= 1 && !('diff' in body.entry));

  res = await handleLeaderboard(post(later, 'December'), { store, ip: '192.0.2.3', now: dec });
  body = await res.json();
  assert.equal(body.month, '2026-12');
  assert.equal(body.ranks.month, 1, 'a new month starts empty');

  assert.equal((await board(store, '?board=all', dec)).length, 3);
  assert.deepEqual((await board(store, '?board=legend', dec)).map((e) => e.name), ['Hard Way']);
  assert.equal((await board(store, '?board=month', nov)).length, 2);
  assert.deepEqual((await board(store, '?board=month', dec)).map((e) => e.name), ['December'], 'the default is the current month');
  assert.equal((await board(store, '?board=month&month=2026-11', dec)).length, 2, 'older months can still be read');
  assert.equal((await handleLeaderboard(get('?board=month&month=2026-13'), { store, now: dec })).status, 400);

  // Sending November's career again in December does not move it into December.
  res = await handleLeaderboard(post(legend, 'Hard Way'), { store, ip: '192.0.2.4', now: dec + 5000 });
  body = await res.json();
  assert.equal(body.duplicate, true);
  assert.equal(body.month, '2026-11');
  assert.equal((await board(store, '?board=month', dec)).length, 1);

  // Moderation takes it off every board.
  assert.equal(await removeEntry(store, body.entry.id), true);
  assert.equal((await board(store, '?board=legend', dec)).length, 0);
  assert.equal((await board(store, '?board=month&month=2026-11', dec)).length, 1);
  assert.equal((await board(store, '?board=all', dec)).length, 2);
  assert.ok(await store.get(KEYS.legend));
});
