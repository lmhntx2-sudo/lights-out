import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';
import { relocalize } from '../js/engine/story.js';
import { offerNote, offerLabel } from '../js/engine/market.js';
import { EVENTS } from '../js/engine/events.js';
import { EVENTS_ZH } from '../js/engine/events.zh.js';
import { val } from '../js/engine/helpers.js';
import { ACHIEVEMENTS } from '../js/engine/achievements.js';
import { DAILY_GOALS } from '../js/engine/daily.js';
import { STYLES, BACKGROUNDS, TRAINING, STATS } from '../js/engine/constants.js';
import { TRACKS } from '../js/data/tracks.js';
import { NATIONS } from '../js/data/nations.js';
import { ZH } from '../js/lang/zh.js';
import { ZD } from '../js/lang/zh.data.js';
import { setLang, detectLang, t, trackName, trackShort } from '../js/i18n.js';
import { scanKeys } from '../tools/i18n-keys.mjs';

const STYLE_KEYS = Object.keys(STYLES);
const BG_KEYS = Object.keys(BACKGROUNDS);
const CJK = /[\u3400-\u9fff]/;

afterEach(() => setLang('en'));

function setup(seed, i = 0) {
  return {
    seed,
    first: 'Test',
    last: 'Driver',
    nat: NATIONS[i % NATIONS.length].id,
    style: STYLE_KEYS[i % STYLE_KEYS.length],
    bg: BG_KEYS[(i >> 2) % BG_KEYS.length],
    helmet: { c1: '#F2F2F2', c2: '#E8002D' },
    number: 2 + (i % 97),
  };
}

function bestOffer(offers, age) {
  const seats = offers.map((o, i) => ({ o, i })).filter(({ o }) => o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve');
  if (!seats.length || age >= 38) return offers.length - 1;
  const rank = (o) => (o.series === 'F1' ? 100 : 0) + ({ F2: 30, F3: 20, F4: 10 }[o.series] || 0) + (o.kind === 'reserve' ? -50 : 0) + (o.tier || 0) * 2;
  seats.sort((a, b) => rank(b.o) - rank(a.o));
  return seats[0].i;
}

// Plays a career; `onChoice` and `onOffers` can inspect the state first.
function play(s, { onChoice, onOffers, onStep } = {}) {
  let steps = 0;
  while (s.stage !== 'retired' && steps < 30000) {
    onStep?.(s, steps);
    const p = prompt(s);
    if (p.type === 'choice') {
      onChoice?.(s);
      choose(s, s.fn % 3 === 0 ? autoPick(s) : s.fn % p.choices.length);
    } else if (p.type === 'offers') {
      onOffers?.(p.offers);
      pickOffer(s, bestOffer(p.offers, s.driver.age));
    } else advance(s);
    steps++;
  }
  return s;
}

const outcome = (s) => ({ rng: s.rng, fn: s.fn, feed: s.feed.length, f1: s.retired.f1, junior: s.retired.junior, worth: s.retired.worth, score: s.retired.score, ach: s.ach.join(), age: s.driver.age });

test('every event has Chinese words, and nothing else does', () => {
  const missing = Object.keys(EVENTS).filter((id) => !EVENTS_ZH[id]);
  const extra = Object.keys(EVENTS_ZH).filter((id) => !EVENTS[id]);
  assert.deepEqual(missing, [], `events without a translation: ${missing.join(', ')}`);
  assert.deepEqual(extra, [], `translations for events that do not exist: ${extra.join(', ')}`);
  for (const [id, z] of Object.entries(EVENTS_ZH)) {
    const ev = EVENTS[id];
    assert.ok(z.title && z.text, `${id} needs a title and text`);
    assert.equal(!!z.radio, !!ev.radio, `${id}: radio line must exist in both languages or neither`);
    // Lists built from the context are compared while careers play, below.
    if (Array.isArray(ev.choices) && Array.isArray(z.choices)) {
      assert.equal(z.choices.length, ev.choices.length, `${id}: choice count`);
      ev.choices.forEach((ch, i) => {
        const zc = z.choices[i];
        assert.ok(zc?.label && zc.ok, `${id} choice ${i} needs a label and an ok text`);
        assert.equal(!!zc.ko, !!ch.ko, `${id} choice ${i}: ko text must exist in both languages or neither`);
      });
    }
  }
});

test('Chinese careers play out exactly like English ones', () => {
  for (let i = 0; i < 12; i++) {
    setLang('en');
    const en = outcome(play(newGame(setup(`lang-${i}`, i))));
    setLang('zh');
    const zh = outcome(play(newGame(setup(`lang-${i}`, i))));
    assert.deepEqual(zh, en, `seed lang-${i} differs between languages`);
  }
});

test('a Chinese career reads in Chinese from start to finish', () => {
  setLang('zh');
  const leftovers = new Set();
  const check = (where, text) => {
    if (typeof text !== 'string' || !text.trim()) return;
    if (/undefined|\[object|NaN/.test(text)) leftovers.add(`${where}: ${text}`);
    if (!CJK.test(text)) leftovers.add(`${where}: ${text}`);
  };
  const seenEvents = new Set();
  for (let i = 0; i < 40; i++) {
    const s = play(newGame(setup(`zh-${i}`, i)), {
      onChoice: (st) => {
        const { id, c } = st.pending;
        seenEvents.add(id);
        const en = val(EVENTS[id].choices, st, c);
        const zh = val(EVENTS_ZH[id].choices, st, c);
        assert.equal(zh.length, en.length, `${id}: Chinese and English offer different numbers of choices`);
        zh.forEach((zc, k) => {
          check(`${id} label`, val(zc.label, st, c));
          check(`${id} ok`, val(zc.ok, st, c));
          if (zc.ko) check(`${id} ko`, val(zc.ko, st, c));
        });
      },
      onOffers: (offers) => offers.forEach((o) => {
        check('offer note', offerNote(o));
        if (o.kind === 'retire' || o.kind === 'endurance') check('offer label', offerLabel(o));
      }),
    });
    for (const e of s.feed) {
      const where = `feed ${e.k}`;
      if (e.k === 'event') {
        [e.title, e.text, e.radio, e.out].forEach((x) => check(where, x));
        e.choices.forEach((c) => check(`${where} choice`, c.label));
        (e.notes || []).forEach((nt) => check(`${where} note`, nt.t.replace(/^[+-]?\$?[\d.]+/, '')));
      }
      if (e.k === 'story' || e.k === 'mile') [e.title, e.text].forEach((x) => check(where, x));
      if (e.k === 'chapter') [e.big, e.title, e.sub, e.goal].forEach((x) => check(where, x === String(e.year) ? '年' : x));
      if (e.k === 'news') [e.title, ...e.lines].forEach((x) => check(where, x));
      if (e.k === 'ach') [e.name, e.desc].forEach((x) => check(where, x === 'Multi 21' ? '無視' : x));
      if (e.k === 'retire') [e.tier, e.bg, e.style, ...e.lines].forEach((x) => check(where, x));
      if (e.k === 'race') check(where, e.track);
    }
  }
  assert.deepEqual([...leftovers].slice(0, 20), [], 'text that is still in English or broken');
  assert.ok(seenEvents.size > 50, `only ${seenEvents.size} different events came up`);
});

test('switching language mid-career rewrites the open decision and plays on', () => {
  setLang('en');
  let switched = 0;
  const s = play(newGame(setup('switch', 9)), {
    onStep: (st, step) => {
      if (step % 150 !== 0 || !st.pending) return;
      setLang(switched % 2 ? 'en' : 'zh');
      relocalize(st);
      const e = st.feed.find((x) => x.n === st.pending.n);
      const zh = switched % 2 === 0;
      assert.equal(CJK.test(e.title + e.text), zh, 'the open decision follows the new language');
      switched++;
    },
  });
  assert.equal(s.stage, 'retired');
  assert.ok(switched >= 2, 'switched language at least twice');
  setLang('en');
  const plain = play(newGame(setup('switch', 9)));
  assert.deepEqual(outcome(s), outcome(plain), 'switching language does not change the career');
});

test('every interface string has a translation with the same placeholders', () => {
  const { keys, dynamic } = scanKeys();
  assert.deepEqual(dynamic, [], 'translation keys must be plain strings, not template literals');
  const missing = [...keys.keys()].filter((k) => ZH[k] == null);
  assert.deepEqual(missing, [], 'English text without a Chinese translation');
  // The Chinese may use extra values the caller passes (it names the country, English uses the adjective).
  const EXTRA = { '{name}, {adj} and eight years old': ['{nation}'] };
  const holes = (x) => (x.match(/\{\w+\}/g) || []).sort();
  for (const [k, v] of Object.entries(ZH)) {
    if (typeof v !== 'string') continue;
    const want = holes(k).filter((x) => !(k in EXTRA) || x !== '{adj}');
    assert.deepEqual(holes(v).filter((x) => !(EXTRA[k] || []).includes(x)), want, `placeholders differ for ${JSON.stringify(k)}`);
  }
});

test('game data has Chinese names', () => {
  for (const k of STATS) assert.ok(ZD.stat[k] && ZD.statHint[k], `stat ${k}`);
  for (const id of Object.keys(STYLES)) assert.ok(ZD.style[id]?.name && ZD.style[id]?.desc, `style ${id}`);
  for (const id of Object.keys(BACKGROUNDS)) for (const f of ['name', 'desc', 'pros', 'cons']) assert.ok(ZD.bg[id]?.[f], `background ${id} ${f}`);
  for (const id of Object.keys(TRAINING)) assert.ok(ZD.training[id]?.name && ZD.training[id]?.desc, `training ${id}`);
  for (const id of Object.keys(TRACKS)) for (const f of ['name', 'short', 'place']) assert.ok(ZD.track[id]?.[f], `track ${id} ${f}`);
  for (const n of NATIONS) assert.ok(ZD.nation[n.id], `nation ${n.id}`);
  for (const a of ACHIEVEMENTS) assert.ok(ZD.ach[a.id]?.name && ZD.ach[a.id]?.desc, `achievement ${a.id}`);
  for (const g of DAILY_GOALS) assert.ok(ZD.daily[g.id], `daily goal ${g.id}`);
});

test('the browser language picks the default', () => {
  assert.equal(detectLang('zh-HK').lang, 'zh');
  assert.equal(detectLang('zh-TW').lang, 'zh');
  assert.equal(detectLang('zh-Hant-TW').lang, 'zh');
  assert.equal(detectLang('zh-hant').lang, 'zh');
  assert.equal(detectLang('zh-CN').lang, 'en');
  assert.equal(detectLang('en-GB', ['zh-HK']).lang, 'en');
  assert.equal(detectLang('zh-TW').variant, 'tw');
  assert.equal(detectLang('zh-HK').variant, 'hk');
  assert.equal(detectLang('en-US', ['zh-TW']).variant, 'tw');
  assert.equal(detectLang('').lang, 'en');
});

test('Hong Kong and Taiwan spellings', () => {
  setLang('zh', 'hk');
  assert.equal(trackName(TRACKS.italy), '意大利大獎賽');
  assert.equal(t('{track} round', { track: trackShort(TRACKS.imola) }), '伊莫拉站');
  setLang('zh', 'tw');
  assert.equal(trackName(TRACKS.italy), '義大利大獎賽');
  setLang('en', 'hk');
  assert.equal(trackName(TRACKS.italy), 'Italian Grand Prix');
});
