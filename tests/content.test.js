import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';
import { replayCareer, validateSetup, ReplayError } from '../js/engine/replay.js';
import { relocalize } from '../js/engine/story.js';
import { EVENTS } from '../js/engine/events.js';
import { EVENTS_ZH } from '../js/engine/events.zh.js';
import { val } from '../js/engine/helpers.js';
import { CONTENT_VERSION, STYLES, BACKGROUNDS } from '../js/engine/constants.js';
import { NATIONS } from '../js/data/nations.js';
import { setLang } from '../js/i18n.js';

const STYLE_KEYS = Object.keys(STYLES);
const BG_KEYS = Object.keys(BACKGROUNDS);
const CJK = /[㐀-鿿]/;
const VARIED = ['quali_lap', 'turn_one', 'mech_issue', 'defend', 'last_lap', 'safety_car', 'tyres_cliff', 'teammate', 'car_launch', 'stall_grid'];
const RESERVE = ['reserve_fp1', 'reserve_sim', 'reserve_seat_talk', 'reserve_rival_call', 'reserve_rookie'];

afterEach(() => setLang('en'));

function setup(seed, i = 0, extra = {}) {
  return {
    seed,
    first: 'Test',
    last: 'Driver',
    nat: NATIONS[i % NATIONS.length].id,
    style: STYLE_KEYS[i % STYLE_KEYS.length],
    bg: BG_KEYS[(i >> 2) % BG_KEYS.length],
    helmet: { c1: '#F2F2F2', c2: '#E8002D' },
    number: 2 + (i % 97),
    ...extra,
  };
}

// Takes a reserve seat over a junior one, so reserve seasons come up often.
// With money given it only buys seats the UI would let the driver buy.
function bestOffer(offers, age, money = Infinity) {
  const seats = offers.map((o, i) => ({ o, i })).filter(({ o }) => (o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve') && !(o.cost && o.cost > money));
  if (!seats.length || age >= 38) return offers.length - 1;
  const rank = (o) => (o.series === 'F1' ? 100 : 0) + ({ F2: 30, F3: 20, F4: 10 }[o.series] || 0) + (o.kind === 'reserve' ? -50 : 0) + (o.tier || 0) * 2;
  seats.sort((a, b) => rank(b.o) - rank(a.o));
  return seats[0].i;
}

function play(s, { onChoice, affordable = false } = {}) {
  let steps = 0;
  while (s.stage !== 'retired' && steps++ < 30000) {
    const p = prompt(s);
    if (p.type === 'choice') {
      onChoice?.(s);
      choose(s, s.fn % 3 === 0 ? autoPick(s) : s.fn % p.choices.length);
    } else if (p.type === 'offers') pickOffer(s, bestOffer(p.offers, s.driver.age, affordable ? s.driver.money : Infinity));
    else advance(s);
  }
  return s;
}

// ------------------------------------------------------------ content version

test('careers started before content version 2 play exactly as they did', () => {
  // Computed on commit d1cdbdf, before content versions existed: 40 careers,
  // hashed on everything the leaderboard and the save depend on, not on words.
  const h = createHash('sha256');
  for (let i = 0; i < 40; i++) {
    const s = play(newGame(setup(`cv1-${i}`, i, { cv: 1 })));
    const r = s.retired;
    h.update(JSON.stringify([s.rng, s.feed.length, s.fn, s.log.length, r.score, r.worth, r.f1, r.junior, r.age, r.seasons, r.ach, r.tierKey]));
  }
  assert.equal(h.digest('hex').slice(0, 24), '51532c8d1417b901d058fe9b');
});

test('new careers record the content version, old ones keep having none', () => {
  assert.equal(CONTENT_VERSION, 2);
  assert.equal(newGame(setup('cv-new')).setup.cv, CONTENT_VERSION);
  assert.equal('cv' in newGame(setup('cv-old', 0, { cv: 1 })).setup, false, 'version 1 is stored as no cv, like saves from before');

  // A setup from before content versions is checked and replayed as version 1.
  assert.equal(validateSetup(setup('cv-check')).cv, 1);
  assert.equal(validateSetup(setup('cv-check', 0, { cv: 2 })).cv, 2);
  for (const cv of [0, 3, 1.5, '2']) {
    assert.throws(() => validateSetup(setup('cv-check', 0, { cv })), ReplayError, `cv ${cv}`);
  }

  // Both kinds replay, and an old career gets back exactly the setup it had.
  for (const cv of [1, 2]) {
    const s = play(newGame(validateSetup(setup(`cv-replay-${cv}`, cv, { cv }))), { affordable: true });
    const saved = JSON.parse(JSON.stringify(s));
    const r = replayCareer(saved.setup, saved.log);
    assert.deepEqual(r.setup, s.setup);
    assert.equal(r.retired.score, s.retired.score);
    assert.equal(r.rng, s.rng);
  }
});

test('reserve-season events come up in new careers only, and only for reserves', () => {
  const seen = { 1: new Set(), 2: new Set() };
  let reserveShown = 0;
  for (let i = 0; i < 24; i++) {
    for (const cv of [1, 2]) {
      play(newGame(setup(`reserve-${i}`, i, { cv })), {
        onChoice: (s) => {
          const id = s.pending.id;
          if (!RESERVE.includes(id)) return;
          seen[cv].add(id);
          assert.equal(s.career.role, 'reserve', `${id} came up for a driver with a race seat`);
          reserveShown++;
        },
      });
    }
  }
  assert.deepEqual([...seen[1]], [], 'careers from before the update never see the new events');
  assert.deepEqual([...seen[2]].sort(), [...RESERVE].sort(), 'every reserve event comes up');
  assert.ok(reserveShown > 24, `only ${reserveShown} reserve moments in 24 careers`);
});

// ------------------------------------------------------------ text variants

test('every variant has Chinese words with the same shape', () => {
  for (const id of VARIED) assert.ok(EVENTS[id].variants?.length >= 2, `${id} needs at least two variants`);
  for (const [id, ev] of Object.entries(EVENTS)) {
    const z = EVENTS_ZH[id];
    if (!ev.variants) {
      assert.equal(z.variants, undefined, `${id}: Chinese variants for an event without any`);
      continue;
    }
    assert.equal(z.variants?.length, ev.variants.length, `${id}: variant count`);
    ev.variants.forEach((v, k) => {
      const zv = z.variants[k];
      assert.equal(zv.when, undefined, `${id} variant ${k + 1}: conditions belong in events.js`);
      for (const f of ['title', 'text', 'radio']) assert.equal(zv[f] != null, v[f] != null, `${id} variant ${k + 1}: ${f} in both languages or neither`);
      assert.ok(v.text || v.title || v.radio, `${id} variant ${k + 1} changes no words`);
      assert.equal(typeof zv.choices, typeof v.choices, `${id} variant ${k + 1}: choices`);
      if (Array.isArray(v.choices)) {
        assert.equal(zv.choices.length, v.choices.length, `${id} variant ${k + 1}: choice count`);
        if (Array.isArray(ev.choices)) assert.equal(v.choices.length, ev.choices.length, `${id} variant ${k + 1}: same choices as the event`);
        v.choices.forEach((vc, i) => {
          for (const f of ['ok', 'ko']) assert.equal(zv.choices[i]?.[f] != null, vc?.[f] != null, `${id} variant ${k + 1} choice ${i}: ${f}`);
          assert.equal(vc.label, undefined, `${id} variant ${k + 1}: labels stay the same`);
          if (Array.isArray(ev.choices)) assert.equal(vc.ko != null, !!ev.choices[i].ko, `${id} variant ${k + 1} choice ${i}: ko only where the event has one`);
        });
      }
    });
  }
});

test('every variant comes up and reads properly in both languages', () => {
  const covered = new Set();
  const bad = [];
  const words = (where, x, zh) => {
    if (typeof x !== 'string' || !x.trim() || /undefined|\[object|NaN/.test(x) || (zh && !CJK.test(x))) bad.push(`${where}: ${x}`);
  };
  const checkAll = (s) => {
    const p = s.pending;
    const ev = EVENTS[p.id];
    if (!ev.variants) return;
    const entry = s.feed.find((e) => e.n === p.n);
    const keep = { v: p.v, title: entry.title, text: entry.text, radio: entry.radio, choices: entry.choices };
    ev.variants.forEach((v, j) => {
      if (v.when && !v.when(s, p.c)) return;
      for (const lang of ['en', 'zh']) {
        setLang(lang);
        p.v = j + 1;
        relocalize(s);
        const where = `${lang} ${p.id} variant ${j + 1}`;
        [entry.title, entry.text].forEach((x) => words(where, x, lang === 'zh'));
        if (ev.radio || v.radio) words(`${where} radio`, entry.radio, lang === 'zh');
        assert.deepEqual(entry.choices.map((c) => c.chance), keep.choices.map((c) => c.chance), `${where}: the odds never change`);
        const base = val(ev.choices, s, p.c);
        const lists = [lang === 'zh' && val(EVENTS_ZH[p.id].variants[j].choices, s, p.c), val(v.choices, s, p.c)].filter(Boolean);
        assert.ok(lists[0].length >= base.length, `${where}: a line for every choice`);
        base.forEach((ch, i) => {
          words(`${where} ok ${i}`, val(lists[0][i]?.ok, s, p.c), lang === 'zh');
          if (ch.ko) words(`${where} ko ${i}`, val(lists[0][i]?.ko, s, p.c), lang === 'zh');
        });
      }
      covered.add(`${p.id}:${j + 1}`);
    });
    setLang('en');
    Object.assign(p, { v: keep.v });
    Object.assign(entry, { title: keep.title, text: keep.text, radio: keep.radio, choices: keep.choices });
  };
  for (let i = 0; i < 40; i++) play(newGame(setup(`variants-${i}`, i)), { onChoice: checkAll });
  assert.deepEqual(bad.slice(0, 20), [], 'broken or untranslated variant text');
  const all = Object.entries(EVENTS).flatMap(([id, ev]) => (ev.variants || []).map((_, j) => `${id}:${j + 1}`));
  assert.deepEqual(all.filter((x) => !covered.has(x)), [], 'variants that never came up');
});

test('wordings take turns without touching the odds or the story', () => {
  const runs = {};
  let firstOriginal = 0;
  const s = play(newGame(setup('rotation', 3)), {
    onChoice: (st) => {
      const { id, v } = st.pending;
      if (!EVENTS[id].variants) return;
      (runs[id] ||= []).push(v);
    },
  });
  for (const [id, vs] of Object.entries(runs)) {
    assert.equal(vs[0], 0, `${id}: the first time reads as it always did`);
    firstOriginal++;
    for (let k = 1; k < vs.length; k++) assert.notEqual(vs[k], vs[k - 1], `${id}: the same wording twice in a row`);
  }
  assert.ok(firstOriginal >= 6, 'several varied events came up');
  // The wording never changes what happens: the same career in Chinese.
  setLang('zh');
  const zh = play(newGame(setup('rotation', 3)));
  assert.equal(zh.rng, s.rng);
  assert.equal(zh.retired.score, s.retired.score);
  assert.deepEqual(zh.seen, s.seen);
});
