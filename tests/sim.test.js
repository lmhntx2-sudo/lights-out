import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';
import { NATIONS } from '../js/data/nations.js';
import { STYLES, BACKGROUNDS } from '../js/engine/constants.js';

const STYLE_KEYS = Object.keys(STYLES);
const BG_KEYS = Object.keys(BACKGROUNDS);

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

// A deterministic "player": sometimes takes the safest option, sometimes rotates.
function bestOffer(offers, age) {
  const seats = offers.map((o, i) => ({ o, i })).filter(({ o }) => o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve');
  if (!seats.length || age >= 38) return offers.length - 1;
  const rank = (o) => (o.series === 'F1' ? 100 : 0) + ({ F2: 30, F3: 20, F4: 10 }[o.series] || 0) + (o.kind === 'reserve' ? -50 : 0) + (o.tier || 0) * 2;
  seats.sort((a, b) => rank(b.o) - rank(a.o));
  return seats[0].i;
}

function play(s, { maxSteps = 30000, roundTrip = false } = {}) {
  let steps = 0;
  while (s.stage !== 'retired' && steps < maxSteps) {
    const p = prompt(s);
    if (p.type === 'choice') choose(s, s.fn % 3 === 0 ? autoPick(s) : s.fn % p.choices.length);
    else if (p.type === 'offers') pickOffer(s, bestOffer(p.offers, s.driver.age));
    else advance(s);
    if (roundTrip && steps % 97 === 0) s = JSON.parse(JSON.stringify(s));
    steps++;
  }
  return { s, steps };
}

test('careers always run to retirement without errors', () => {
  const tally = { f1: 0, win: 0, title: 0, steps: 0 };
  const N = 120;
  for (let i = 0; i < N; i++) {
    const { s, steps } = play(newGame(setup(`fuzz-${i}`, i)));
    assert.equal(s.stage, 'retired', `seed fuzz-${i} did not finish (stuck at ${s.stage})`);
    assert.ok(s.retired && s.retired.tier, 'summary built');
    assert.ok(Number.isFinite(s.driver.money), 'money is a number');
    for (const t of Object.values(s.teams)) assert.equal(t.seats.length, 2);
    if (s.career.tot.F1.starts) tally.f1++;
    if (s.career.tot.F1.wins) tally.win++;
    if (s.career.tot.F1.titles) tally.title++;
    tally.steps += steps;
  }
  console.log(`reached F1 ${tally.f1}/${N}, won a race ${tally.win}/${N}, champion ${tally.title}/${N}, avg steps ${Math.round(tally.steps / N)}`);
  assert.ok(tally.f1 > N * 0.2, 'a fair share of careers reach F1');
  assert.ok(tally.title < N * 0.8, 'titles are not handed out to everyone');
});

test('same seed and same choices replay the same life', () => {
  const a = play(newGame(setup('replay-me', 3))).s;
  const b = play(newGame(setup('replay-me', 3))).s;
  assert.deepEqual(a.retired.f1, b.retired.f1);
  assert.equal(a.retired.worth, b.retired.worth);
  assert.equal(a.feed.length, b.feed.length);
});

test('a save survives JSON round trips mid-career', () => {
  const { s } = play(newGame(setup('roundtrip', 5)), { roundTrip: true });
  assert.equal(s.stage, 'retired');
});

test('grids stay full and nobody is in two seats', () => {
  let s = newGame(setup('grid-check', 7));
  for (let k = 0; k < 4000 && s.stage !== 'retired'; k++) {
    const p = prompt(s);
    if (p.type === 'choice') choose(s, 0);
    else if (p.type === 'offers') {
      pickOffer(s, bestOffer(p.offers, s.driver.age));
      if (s.stage === 'retired') break;
      const seen = new Set();
      for (const t of Object.values(s.teams)) {
        for (const id of t.seats) {
          assert.ok(id, `${t.name} has an empty seat`);
          assert.ok(!seen.has(id), `${id} sits in two cars`);
          seen.add(id);
        }
      }
    } else advance(s);
  }
});
