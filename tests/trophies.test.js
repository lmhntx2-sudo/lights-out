// The trophy room and the results strip read records the engine keeps for
// display only: s.career.cups (every race win) and s.season.rounds (each
// round's result). They must match the career's own totals, and careers saved
// before the records existed still get a trophy for every win.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';
import { trophyList, roundClass } from '../js/ui/trophies.js';

function play(seed, bg) {
  const s = newGame({ seed, first: 'Test', last: 'Driver', nat: 'GB', style: 'fighter', bg, helmet: { c1: '#F2F2F2', c2: '#E8002D', p: 'stars' }, number: 9 });
  const seasons = [];
  for (let k = 0; k < 40000 && s.stage !== 'retired'; k++) {
    const q = prompt(s);
    if (q.type === 'choice') choose(s, autoPick(s));
    else if (q.type === 'offers') {
      const seat = q.offers.findIndex((o) => o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve');
      pickOffer(s, s.driver.age >= 34 || seat < 0 ? q.offers.length - 1 : seat);
    } else advance(s);
    const last = s.feed[s.feed.length - 1];
    if (last?.k === 'season' && !seasons.includes(last)) seasons.push(last);
  }
  return { s, seasons };
}

test('every race win gets a cup, and every round a result', () => {
  let cups = 0;
  for (let i = 0; i < 12; i++) {
    const { s, seasons } = play(`cups-${i}`, i % 2 ? 'royalty' : 'prodigy');
    const c = s.career;
    const won = c.cups || [];
    assert.equal(won.filter((w) => w.s === 'F1').length, c.tot.F1.wins, 'F1 cups match F1 wins');
    assert.equal(won.filter((w) => w.s !== 'F1').length, c.tot.junior.wins, 'junior cups match junior wins');
    for (const w of won) assert.ok(w.t && w.y && w.s, 'each cup names its track, year and series');
    for (const e of seasons) {
      assert.ok(Array.isArray(e.rounds), 'the season review keeps its rounds');
      assert.equal(e.rounds.filter((r) => r.p === 1 && !r.d).length, e.wins, 'wins in the strip match the season');
    }
    const list = trophyList(s);
    assert.equal(list.f1.length, c.tot.F1.wins);
    assert.equal(list.titles.length, c.tot.F1.titles + c.tot.junior.titles);
    cups += won.length;
  }
  assert.ok(cups > 0, 'some of these careers win races');
});

test('careers from before the records still fill the trophy room from their history', () => {
  const { s } = play('cups-old', 'royalty');
  delete s.career.cups;
  const list = trophyList(s);
  assert.equal(list.f1.length, s.career.tot.F1.wins);
  assert.equal(list.junior.length, s.career.tot.junior.wins);
  for (const w of [...list.f1, ...list.junior]) assert.equal(w.t, null, 'without a record, a cup has no track');
});

test('round results map to timing colours', () => {
  assert.equal(roundClass(undefined), 'fut');
  assert.equal(roundClass({ t: 'monaco', p: 0 }), 'out');
  assert.equal(roundClass({ t: 'monaco', p: 4, d: 1 }), 'dnf');
  assert.equal(roundClass({ t: 'monaco', p: 1 }), 'win');
  assert.equal(roundClass({ t: 'monaco', p: 3 }), 'pod');
  assert.equal(roundClass({ t: 'monaco', p: 10 }), 'pts');
  assert.equal(roundClass({ t: 'monaco', p: 11 }), 'nop');
});
