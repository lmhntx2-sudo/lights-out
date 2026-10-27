// Second-generation careers: a retired parent's kid carries on the family name.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, pickOffer, autoPick, skipToDecision } from '../js/engine/game.js';
import { heirOf, inheritance, allTime, familyLine, RICH, INHERIT_CAP, TIERS } from '../js/engine/legacy.js';
import { replayCareer, validateSetup, ReplayError } from '../js/engine/replay.js';
import { dailySetup } from '../js/engine/daily.js';
import { EVENTS } from '../js/engine/events.js';
import { EVENTS_ZH } from '../js/engine/events.zh.js';
import { BACKGROUNDS, START_YEAR } from '../js/engine/constants.js';
import { NATIONS } from '../js/data/nations.js';
import { val } from '../js/engine/helpers.js';
import { setLang } from '../js/i18n.js';
import { handleLeaderboard } from '../netlify/lib/leaderboard.mjs';

afterEach(() => setLang('en'));

const HELMET = { c1: '#FFD23F', c2: '#2FD27A' };
const base = (seed, extra = {}) => ({ seed, first: 'Ayrton', last: 'Vale', nat: 'BR', style: 'fighter', bg: 'prodigy', helmet: { ...HELMET }, number: 12, ...extra });

// A player who says yes to love and family (unless told not to), and otherwise plays it fairly safe.
const FAMILY = ['romance', 'proposal', 'baby'];
function play(s, { onChoice, family = true } = {}) {
  let k = 0;
  while (s.stage !== 'retired' && k++ < 30000) {
    const p = prompt(s);
    if (p.type === 'choice') {
      onChoice?.(s);
      choose(s, FAMILY.includes(s.pending.id) ? (family ? 0 : p.choices.length - 1) : s.fn % 3 ? autoPick(s) : s.fn % p.choices.length);
    } else if (p.type === 'offers') {
      const j = p.offers.findIndex((o) => ['seat', 'stay', 'reserve'].includes(o.kind) && !(o.cost > s.driver.money));
      pickOffer(s, j < 0 || s.driver.age >= 38 ? p.offers.length - 1 : j);
    } else if (p.type === 'race' && k % 5 === 0) skipToDecision(s);
    else advance(s);
  }
  return s;
}

function parentCareer(from = 0) {
  for (let i = from; i < from + 40; i++) {
    const s = play(newGame(base(`family-${i}`)));
    if (heirOf(s)) return s;
  }
  throw new Error('no career ended with a kid');
}

// What the title screen builds from a heir: surname, flag and background are fixed.
const kidSetup = (heir, seed, extra = {}) => ({ seed, first: 'Junior', last: heir.last, nat: heir.nat, style: 'qualifier', bg: heir.bg, helmet: heir.helmet, number: 33, daily: null, legacy: heir.legacy, ...extra });

const parent = parentCareer();
const heir = heirOf(parent);
const kid = play(newGame(validateSetup(kidSetup(heir, 'kid-one'))));

const code = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof ReplayError, e.message);
    return e.code;
  }
  return 'accepted';
};

test('a retired parent hands the kid the family name, flag, helmet and a capped start', () => {
  const lg = heir.legacy;
  assert.equal(heir.last, parent.driver.last);
  assert.equal(heir.nat, parent.driver.nat);
  assert.deepEqual(heir.helmet, parent.driver.helmet);
  assert.equal(lg.gen, 2);
  assert.equal(lg.tier, parent.retired.tierKey);
  assert.deepEqual([lg.titles, lg.wins, lg.starts], [parent.career.tot.F1.titles, parent.career.tot.F1.wins, parent.career.tot.F1.starts]);
  assert.ok(lg.year > parent.year, 'the kid starts after the parent retires');
  assert.equal(heir.bg, parent.retired.worth >= RICH ? 'royalty' : 'prodigy');
  assert.equal(heirOf(play(newGame(base('no-kids')), { family: false })), null, 'no kid, no heir');

  const s = newGame(validateSetup(kidSetup(heir, 'kid-start')));
  const bg = BACKGROUNDS[heir.bg];
  assert.equal(s.year, lg.year);
  assert.equal(s.driver.money, bg.money + lg.money);
  assert.equal(s.driver.fame, bg.fame + lg.fame);
  assert.equal(s.driver.last, parent.driver.last);
  if (lg.rival) {
    const rv = s.drivers[s.rivalId];
    assert.equal(rv.last, lg.rival.last, 'the karting rival is the old rival’s kid');
    assert.equal(rv.nat, lg.rival.nat);
  }
});

test('the inheritance never beats a royalty start', () => {
  const royal = BACKGROUNDS.royalty;
  for (const worth of [0, 1e5, 2e6, 5e7, 1e8, RICH - 1, RICH, 3e9, 1e11]) {
    for (const tier of Object.keys(TIERS)) {
      const inh = inheritance(worth, tier);
      const bg = BACKGROUNDS[inh.bg];
      assert.ok(bg.money + inh.money <= royal.money, `money for ${worth}/${tier}`);
      assert.ok(bg.fame + inh.fame <= royal.fame, `fame for ${worth}/${tier}`);
      assert.ok(inh.money <= INHERIT_CAP.money && inh.fame <= INHERIT_CAP.fame);
      assert.equal(inh.bg, worth >= RICH ? 'royalty' : 'prodigy');
      if (inh.bg === 'royalty') assert.deepEqual([inh.money, inh.fame], [0, 0], 'the fortune is the background');
    }
  }
});

test('a kid career plays to retirement, keeps both family records and replays exactly', () => {
  assert.equal(kid.stage, 'retired');
  assert.deepEqual(kid.retired.family, { gen: 2, parent: parent.driver.name, tierKey: parent.retired.tierKey });
  assert.equal(familyLine(kid.retired.family), `Second generation, child of ${parent.driver.name}.`);
  assert.ok(kid.retired.lines.some((l) => l.includes(parent.driver.name)), 'the epilogue compares the two careers');
  const rows = allTime(kid);
  if (heir.legacy.starts) assert.ok(rows.some((r) => r.kind === 'parent' && r.name === parent.driver.name && r.wins === heir.legacy.wins), 'the parent is in the all-time records');
  if (kid.career.tot.F1.starts) assert.ok(rows.some((r) => r.kind === 'me'), 'and so is the kid');

  const saved = JSON.parse(JSON.stringify(kid));
  const r = replayCareer(saved.setup, saved.log);
  const { at, ...want } = kid.retired;
  const { at: at2, ...got } = r.retired;
  assert.deepEqual(got, want);
  assert.deepEqual(r.setup.legacy, heir.legacy);
});

test('the family storyline shows up in kid careers, in both languages, and plays the same', () => {
  const seen = new Set();
  const CJK = /[㐀-鿿]/;
  const outcome = (s) => ({ rng: s.rng, fn: s.fn, score: s.retired.score, worth: s.retired.worth, ach: s.ach.join() });
  for (let i = 0; i < 6; i++) {
    const setup = validateSetup(kidSetup(heir, `kid-lang-${i}`, { number: i % 2 ? heir.legacy.number : 33 + i }));
    setLang('en');
    const en = play(newGame(setup), { onChoice: (s) => s.pending.id.startsWith('legacy_') && seen.add(s.pending.id) });
    setLang('zh');
    const zh = play(newGame(setup), {
      onChoice: (s) => {
        const { id, c } = s.pending;
        if (!id.startsWith('legacy_') && !id.startsWith('pro_')) return;
        const e = s.feed.find((x) => x.n === s.pending.n);
        assert.ok(CJK.test(e.title) && CJK.test(e.text), `${id} reads in Chinese`);
        assert.ok(!/undefined|NaN/.test(e.title + e.text), `${id} text is complete`);
        assert.equal(val(EVENTS_ZH[id].choices, s, c).length, val(EVENTS[id].choices, s, c).length, `${id} has the same choices in both languages`);
      },
    });
    assert.deepEqual(outcome(zh), outcome(en), `kid-lang-${i} differs between languages`);
    const ret = zh.feed.find((e) => e.k === 'retire');
    for (const line of ret.lines) assert.ok(CJK.test(line), `epilogue in Chinese: ${line}`);
  }
  for (const id of ['legacy_press', 'legacy_pitwall', 'legacy_number']) assert.ok(seen.has(id), `${id} came up`);
});

test('ordinary careers never meet the family storyline', () => {
  const plain = validateSetup(base('plain'));
  assert.ok(!('legacy' in plain), 'no legacy key on an ordinary setup');
  assert.ok(!('legacy' in validateSetup({ ...base('plain'), legacy: null })));
  for (let i = 0; i < 6; i++) {
    const s = play(newGame(base(`ordinary-${i}`)));
    assert.ok(!('legacy' in s.setup));
    assert.ok(!Object.keys(s.seen).some((id) => id.startsWith('legacy_')), 'no family events');
    assert.ok(!('family' in s.retired));
    assert.ok(!s.ach.includes('heir') && !s.ach.includes('surpass'));
    assert.ok(!allTime(s).some((r) => r.kind === 'parent'));
  }
});

test('a second-generation career with an out-of-range or made-up inheritance is refused', () => {
  const good = kidSetup(heir, 'kid-check');
  assert.deepEqual(validateSetup(good).legacy, heir.legacy);
  assert.equal(validateSetup({ ...good, legacy: { ...heir.legacy, extra: 1e9 } }).legacy.extra, undefined, 'unknown fields are dropped');

  const lg = heir.legacy;
  const poor = { ...lg, worth: 2e7, tier: 'f1', titles: 0, wins: 0, podiums: 0, poles: 0, starts: 40, money: inheritance(2e7, 'f1').money, fame: inheritance(2e7, 'f1').fame };
  const poorSetup = { ...good, bg: 'prodigy', legacy: poor };
  assert.deepEqual(validateSetup(poorSetup).legacy, poor, 'a modest parent passes too');
  const rich = { ...poor, worth: RICH, money: 0, fame: 0 };
  assert.deepEqual(validateSetup({ ...good, bg: 'royalty', legacy: rich }).legacy, rich);

  const bad = {
    'money above the cap': { ...poorSetup, legacy: { ...poor, money: INHERIT_CAP.money + 10000 } },
    'money the record does not earn': { ...poorSetup, legacy: { ...poor, money: poor.money + 10000 } },
    'fame above the cap': { ...poorSetup, legacy: { ...poor, fame: INHERIT_CAP.fame + 1 } },
    'negative fame': { ...poorSetup, legacy: { ...poor, fame: -1 } },
    'money on top of royalty': { ...good, bg: 'royalty', legacy: { ...rich, money: 500000 } },
    'fame on top of royalty': { ...good, bg: 'royalty', legacy: { ...rich, fame: 3 } },
    'royalty from a modest parent': { ...poorSetup, bg: 'royalty' },
    'prodigy from a rich parent': { ...good, bg: 'prodigy', legacy: rich },
    'a background no title screen offers': { ...poorSetup, bg: 'grafter' },
    'generation one': { ...good, legacy: { ...lg, gen: 1 } },
    'generation too high': { ...good, legacy: { ...lg, gen: 99 } },
    'fractional generation': { ...good, legacy: { ...lg, gen: 2.5 } },
    'race number out of range': { ...good, legacy: { ...lg, number: 100 } },
    'a different family name': { ...good, last: `${good.last}x` },
    'a goat tier without titles': { ...poorSetup, legacy: { ...poor, tier: 'goat' } },
    'more wins than starts': { ...poorSetup, legacy: { ...poor, wins: 41, podiums: 41 } },
    'fewer podiums than wins': { ...poorSetup, legacy: { ...poor, wins: 5, podiums: 2, tier: 'winner' } },
    'a record without starts': { ...poorSetup, legacy: { ...poor, starts: 0, tier: 'junior', wins: 0, podiums: 0, titles: 0, poles: 3 } },
    'negative net worth': { ...poorSetup, legacy: { ...poor, worth: -1 } },
    'absurd net worth': { ...good, bg: 'royalty', legacy: { ...rich, worth: 1e13 } },
    'a start year before the parent': { ...good, legacy: { ...lg, year: START_YEAR } },
    'a start year far in the future': { ...good, legacy: { ...lg, year: START_YEAR + 500 } },
    'an era after the kid starts': { ...good, legacy: { ...lg, to: lg.year } },
    'an era backwards': { ...good, legacy: { ...lg, from: lg.to + 1 } },
    'a rival from nowhere': { ...good, legacy: { ...lg, rival: { first: 'A', last: 'B', nat: 'XX' } } },
    'a rival with a huge name': { ...good, legacy: { ...lg, rival: { first: 'A', last: 'B'.repeat(40), nat: 'GB' } } },
    'a parent with no name': { ...good, legacy: { ...lg, first: ' ', last: '' }, last: '' },
    'a parent name too long': { ...good, legacy: { ...lg, first: 'x'.repeat(31) } },
    'a list instead of a record': { ...good, legacy: [lg] },
    'a string instead of a record': { ...good, legacy: 'royalty' },
    'a numeric string': { ...poorSetup, legacy: { ...poor, money: String(poor.money) } },
  };
  for (const [why, b] of Object.entries(bad)) assert.equal(code(() => validateSetup(b)), 'legacy', why);

  const d = dailySetup('2026-10-20');
  const daily = { ...base(d.seed), nat: d.nat, style: d.style, bg: d.bg, daily: { date: d.date, goal: d.goal, goalText: d.goalText } };
  assert.equal(code(() => validateSetup({ ...daily, last: lg.last, legacy: lg })), 'legacy', 'a daily challenge cannot inherit anything');
  assert.ok(NATIONS.some((n) => n.id === heir.nat));
});

test('the leaderboard function accepts a kid career and refuses a forged inheritance', async () => {
  const data = new Map();
  let n = 0;
  const store = {
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
  const send = async (body, ip) => {
    const req = new Request('https://x.test/api/leaderboard', { method: 'POST', body: JSON.stringify(body) });
    const res = await handleLeaderboard(req, { store, ip, now: Date.parse('2026-10-20T12:00:00Z') });
    return { status: res.status, body: await res.json() };
  };
  const ok = await send({ setup: kid.setup, actions: kid.log, displayName: 'Family Fan', score: kid.retired.score }, '203.0.113.20');
  assert.equal(ok.status, 201);
  assert.equal(ok.body.entry.score, kid.retired.score);

  const forged = { ...kid.setup, legacy: { ...kid.setup.legacy, fame: kid.setup.legacy.fame + 5, money: kid.setup.legacy.money + 1e6 } };
  const no = await send({ setup: forged, actions: kid.log, displayName: 'Family Fan', score: kid.retired.score }, '203.0.113.21');
  assert.equal(no.status, 422);
});
