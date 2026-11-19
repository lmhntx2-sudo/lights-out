// Custom grid: team names a player picks, carried in a share code and copied
// into a career at the start. Names only; nothing that is replayed changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { F1_TEAMS } from '../js/data/teams.js';
import { cleanGrid, encodeGrid, decodeGrid, applyGrid } from '../js/core/grid.js';
import { newGame, advance, prompt, choose, autoPick, pickOffer } from '../js/engine/game.js';
import { STYLES, BACKGROUNDS } from '../js/engine/constants.js';

test('cleanGrid keeps good names, drops unknown teams, bad names and defaults', () => {
  const g = cleanGrid({
    rossa: { name: '  Ferrari   Team ', short: '' },
    papaya: { name: 'Papaya Racing', short: 'Papaya' },
    nope: { name: 'Ghost Racing' },
    haven: { name: '💥💥', short: 'X' },
    grove: { name: '威廉士車隊', short: '威廉士' },
    azur: { name: 'A'.repeat(25) },
  });
  assert.deepEqual(g, { rossa: { name: 'Ferrari Team', short: 'Ferrari' }, grove: { name: '威廉士車隊', short: '威廉士' } });
  assert.deepEqual(cleanGrid(null), {});
  assert.deepEqual(cleanGrid([1, 2]), {});
});

test('a share code round-trips, including CJK names', () => {
  const g = { rossa: { name: 'Scuderia Ferrari', short: 'Ferrari' }, crest: { name: '凱迪拉克', short: '凱迪' }, grove: { name: 'Williams', short: 'Williams' } };
  const code = encodeGrid(g);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeGrid(code), cleanGrid(g));
  assert.equal(encodeGrid({}), '');
});

test('decodeGrid refuses junk without throwing', () => {
  for (const bad of [null, '', 'not a code!', 'AAAA', 'x'.repeat(3000), btoa('{"a":1}'), btoa(JSON.stringify(Array(20).fill(0)))]) {
    assert.equal(decodeGrid(bad), null, String(bad).slice(0, 20));
  }
  // Bad names inside a well-formed code are dropped like any other bad name.
  const code = btoa(JSON.stringify([['<script>', 'x'], ['Fine Name', 'Fine']])).replace(/=+$/, '');
  assert.deepEqual(decodeGrid(code), { silverline: { name: 'Fine Name', short: 'Fine' } });
});

// Plays a whole career the same way every time: the safest choice, the first offer.
function play(s) {
  for (let i = 0; i < 30000 && s.stage !== 'retired'; i++) {
    const p = prompt(s);
    if (p.type === 'choice') choose(s, autoPick(s));
    else if (p.type === 'offers') pickOffer(s, 0);
    else advance(s);
  }
  return s;
}

test('a custom grid renames teams and changes nothing else', () => {
  const setup = { seed: 'grid-test', first: 'Ana', last: 'Lee', nat: 'GB', style: Object.keys(STYLES)[0], bg: Object.keys(BACKGROUNDS)[0], helmet: { c1: '#ffffff', c2: '#ff0000' }, number: 7 };
  const plain = play(newGame(setup));
  const g = Object.fromEntries(F1_TEAMS.map((t, i) => [t.id, { name: `Team Number ${i + 1}`, short: `T${i + 1}` }]));
  const named = play(applyGrid(newGame(setup), g));
  assert.equal(named.teams.rossa.name, 'Team Number 1');
  assert.equal(named.teams.rossa.short, 'T1');
  assert.equal(named.rng, plain.rng, 'same random draws');
  assert.equal(named.stage, 'retired');
  assert.equal(named.year, plain.year);
  assert.ok(named.career.hist.some((x) => x.series === 'F1' && /^Team Number/.test(x.teamName)) || !plain.career.hist.some((x) => x.series === 'F1'), 'F1 seasons carry the new names');
  assert.deepEqual(named.career.hist.map((x) => [x.year, x.series, x.pos, x.pts]), plain.career.hist.map((x) => [x.year, x.series, x.pos, x.pts]));
  assert.deepEqual(named.setup, plain.setup, 'the setup the server replays is untouched');
});
