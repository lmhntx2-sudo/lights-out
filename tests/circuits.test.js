// Every track the game can race on has a circuit map, and each map is a closed
// outline that fits its box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS } from '../js/data/tracks.js';
import { CIRCUITS } from '../js/data/circuits.js';

function points(d) {
  assert.match(d, /^M[-\d. ]+(l[-\d. ]+)+z$/, 'one move, then relative lines, then close');
  const parts = d.slice(1, -1).split('l');
  let x = 0;
  let y = 0;
  return parts.map((p, i) => {
    const [a, b] = p.match(/-?(\d+\.?\d*|\.\d+)/g).map(Number);
    if (i === 0) [x, y] = [a, b];
    else [x, y] = [x + a, y + b];
    return [x, y];
  });
}

test('every track has a circuit map', () => {
  for (const id of Object.keys(TRACKS)) assert.ok(CIRCUITS[id], `no map for ${id}`);
});

test('each map fits its box and has a real shape', () => {
  for (const [id, c] of Object.entries(CIRCUITS)) {
    assert.ok(Math.max(c.w, c.h) === 100, `${id}: the longer side is 100 units`);
    const pts = points(c.d);
    assert.ok(pts.length >= 15, `${id}: at least 15 points`);
    for (const [x, y] of pts) {
      assert.ok(x > -0.6 && x < c.w + 0.6 && y > -0.6 && y < c.h + 0.6, `${id}: (${x}, ${y}) is inside ${c.w} x ${c.h}`);
    }
  }
});
