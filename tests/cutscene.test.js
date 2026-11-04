import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';
import { pickCutscene, snapshot, SCENES, PLACES } from '../js/ui/cutscene-pick.js';
import { setLang } from '../js/i18n.js';

afterEach(() => setLang('en'));

const setup = (seed, nat, extra = {}) => ({
  seed, first: 'Test', last: 'Driver', nat, style: 'fighter', bg: 'royalty', helmet: { c1: '#F2F2F2', c2: '#E8002D' }, number: 44, ...extra,
});

function bestOffer(s, offers) {
  const ok = offers.map((o, i) => ({ o, i })).filter(({ o }) => (o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve') && !(o.cost && o.cost > s.driver.money));
  const rank = (o) => (o.series === 'F1' ? 100 : 0) + ({ F2: 30, F3: 20, F4: 10 }[o.series] || 0) + (o.kind === 'reserve' ? -50 : 0) + (o.tier || 0) * 2;
  ok.sort((a, b) => rank(b.o) - rank(a.o));
  return !ok.length || s.driver.age >= 37 ? offers.length - 1 : ok[0].i;
}

// Plays a career the way the game screen does, asking after every press which
// cutscene it would show. Says yes to romance, so families come up.
function play(s) {
  const cuts = [];
  for (let k = 0; k < 30000 && s.stage !== 'retired'; k++) {
    const before = snapshot(s);
    const lastN = s.fn;
    const pendN = s.pending?.n;
    const p = prompt(s);
    if (p.type === 'choice') choose(s, ['romance', 'proposal', 'baby'].includes(s.pending.id) ? 0 : s.fn % 3 === 0 ? autoPick(s) : s.fn % p.choices.length);
    else if (p.type === 'offers') pickOffer(s, bestOffer(s, p.offers));
    else advance(s);
    const fresh = s.feed.filter((e) => e.n > lastN);
    const resolved = pendN ? s.feed.find((e) => e.n === pendN) : null;
    const cut = pickCutscene(s, before, fresh, resolved);
    if (cut) cuts.push({ ...cut, year: s.year });
  }
  return { s, cuts };
}

test('careers get a cutscene for each big moment, never two in one press', () => {
  const seen = new Set();
  for (let i = 0; i < 16; i++) {
    const { s, cuts } = play(newGame(setup(`cut-${i}`, ['GB', 'JP', 'KR', 'HK', 'TW', 'MO', 'FR', 'BR'][i % 8])));
    for (const c of cuts) {
      assert.ok(SCENES.includes(c.scene), `unknown scene ${c.scene}`);
      assert.ok(c.title && typeof c.title === 'string', `${c.scene} has a title`);
      assert.ok(!/undefined|NaN/.test(`${c.title} ${c.sub}`), `${c.scene}: ${c.title} / ${c.sub}`);
      seen.add(c.scene);
    }
    const f1 = s.career.tot.F1;
    const debuts = cuts.filter((c) => c.scene === 'debut' || (c.scene in { ...Object.fromEntries(Object.values(PLACES).map((p) => [p, 1])), home: 1 } && c.year === s.career.firsts.f1start));
    if (f1.starts > 0) assert.ok(debuts.length >= 1, 'the first F1 start has a scene');
    assert.ok(cuts.filter((c) => c.scene === 'debut').length <= 1, 'one debut at most');
    assert.ok(cuts.filter((c) => c.scene === 'win').length <= 1, 'the win scene is for the first win only');
    assert.equal(cuts.filter((c) => c.scene === 'title').length, f1.titles, 'one title scene per world title');
    assert.equal(cuts.filter((c) => c.scene === 'retire').length, 1, 'retirement');
  }
  for (const k of ['debut', 'win', 'title', 'retire', 'proposal', 'baby']) assert.ok(seen.has(k), `${k} came up`);
});

test('drivers from Hong Kong, Japan, Korea, Taiwan and Macau get their own city', () => {
  for (const [nat, place] of Object.entries(PLACES)) {
    let found = null;
    for (let i = 0; i < 10 && !found; i++) found = play(newGame(setup(`place-${nat}-${i}`, nat))).cuts.find((c) => c.scene === place);
    assert.ok(found, `${nat} gets the ${place} scene`);
    assert.ok(found.title, `${nat}: caption`);
  }
});

test('the captions are in the game language', () => {
  setLang('ja');
  const { cuts } = play(newGame(setup('cut-ja', 'JP')));
  assert.ok(cuts.length > 2);
  // Retirement is captioned with the driver's own name, and the career tier underneath.
  for (const c of cuts) assert.match(c.scene === 'retire' ? c.sub : c.title, /[぀-ヿ一-鿿]/, `${c.scene}: ${c.title} / ${c.sub}`);
});
