import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';
import { shareText } from '../js/engine/legacy.js';

const setup = (seed) => ({ seed, first: 'Test', last: 'Driver', nat: 'GB', style: 'fighter', bg: 'royalty', helmet: { c1: '#F2F2F2', c2: '#E8002D' }, number: 7 });

// Plays on, preferring a reserve role whenever one is offered, until `stop` says so.
function playUntil(s, stop, maxSteps = 20000) {
  for (let k = 0; k < maxSteps && s.stage !== 'retired'; k++) {
    if (stop(s)) return true;
    const p = prompt(s);
    if (p.type === 'choice') choose(s, autoPick(s));
    else if (p.type === 'offers') {
      const reserve = p.offers.findIndex((o) => o.kind === 'reserve');
      const seat = p.offers.findIndex((o) => o.kind === 'seat' && !(o.cost > s.driver.money));
      pickOffer(s, reserve >= 0 ? reserve : seat >= 0 ? seat : p.offers.length - 1);
    } else advance(s);
  }
  return false;
}

test('an injured reserve driver heals while watching and is never called up to race', () => {
  let found = 0;
  for (let i = 0; i < 40 && found < 3; i++) {
    const s = newGame(setup(`reserve-${i}`));
    const atReserveRace = (st) => st.career.role === 'reserve' && st.stage === 'race' && !st.pending && st.season.round < st.season.cal.length - 3;
    if (!playUntil(s, atReserveRace)) continue;
    found++;
    s.driver.injured = 2;
    for (let k = 0; k < 2; k++) {
      advance(s);
      const race = s.feed.filter((e) => e.k === 'race').pop();
      assert.notEqual(race.mode, 'standin', 'an injured driver is not called up');
      while (s.pending) choose(s, 0);
    }
    assert.equal(s.driver.injured, 0, 'two watched races heal a two-race injury');
  }
  assert.ok(found > 0, 'found a career with a reserve season to test');
});

test('junior teams have proper short names', () => {
  for (let i = 0; i < 30; i++) {
    const s = newGame(setup(`teams-${i}`));
    for (const t of Object.values(s.teams)) assert.ok(!['Van', 'Northern'].includes(t.short), `${t.name} is shortened to ${t.short}`);
  }
});

test('the shared text links to the same world', () => {
  const s = newGame(setup('share me'));
  playUntil(s, () => false);
  const text = shareText(s.retired, 'https://example.test/');
  assert.match(text, /https:\/\/example\.test\/\?seed=share%20me/);
});
