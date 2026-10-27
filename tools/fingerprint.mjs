// One hash over many complete careers, to prove an engine change leaves
// ordinary careers exactly as they were (every field of the final state except
// timestamps). Run it here and on an older copy of the game, and compare:
//
//   git archive <commit> js | tar -x -C /tmp/old
//   node tools/fingerprint.mjs /tmp/old 40 en
//   node tools/fingerprint.mjs . 40 en
//
// Usage: node tools/fingerprint.mjs [root=.] [careers=40] [lang=en]
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] || '.');
const N = Number(process.argv[3] || 40);
const lang = process.argv[4] || 'en';
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { newGame, prompt, advance, choose, pickOffer, autoPick, skipToDecision, simToSeasonEnd } = await imp('js/engine/game.js');
const { NATIONS } = await imp('js/data/nations.js');
const { STYLES, BACKGROUNDS } = await imp('js/engine/constants.js');
const { setLang } = await imp('js/i18n.js');
setLang(lang);

const SK = Object.keys(STYLES);
const BK = Object.keys(BACKGROUNDS);
const setup = (i) => ({
  seed: `fp-${i}`, first: 'Test', last: 'Driver', nat: NATIONS[(i * 7) % NATIONS.length].id,
  style: SK[i % SK.length], bg: BK[(i >> 1) % BK.length], helmet: { c1: '#F2F2F2', c2: '#E8002D' }, number: 2 + ((i * 13) % 97), daily: null,
});

// Even careers use every kind of button; odd ones play each race by hand and
// say yes to romance, so many of them end with a kid.
const FAMILY = ['romance', 'proposal', 'baby'];

function play(s, i) {
  let k = 0;
  while (s.stage !== 'retired' && k++ < 40000) {
    const p = prompt(s);
    if (p.type === 'choice') choose(s, i % 2 ? (FAMILY.includes(s.pending.id) ? 0 : autoPick(s)) : (s.fn + i) % 4 === 0 ? autoPick(s) : (s.fn * (i + 1)) % p.choices.length);
    else if (p.type === 'offers') {
      const ok = p.offers.map((o, j) => ({ o, j })).filter(({ o }) => (o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve') && !(o.cost && o.cost > s.driver.money));
      const rank = (o) => (o.series === 'F1' ? 100 : 0) + ({ F2: 30, F3: 20, F4: 10 }[o.series] || 0) + (o.kind === 'reserve' ? -50 : 0) + (o.tier || 0) * 2;
      ok.sort((a, b) => rank(b.o) - rank(a.o));
      pickOffer(s, !ok.length || s.driver.age >= 34 + (i % 6) ? p.offers.length - 1 : ok[0].j);
    } else if (p.type === 'race' && !(i % 2)) (k % 7 === 0 ? simToSeasonEnd : k % 3 === 0 ? skipToDecision : advance)(s);
    else advance(s);
  }
  return s;
}

const all = createHash('sha256');
let parents = 0;
for (let i = 0; i < N; i++) {
  const s = play(newGame(setup(i)), i);
  all.update(JSON.stringify(s, (k, v) => (k === 'at' ? undefined : v)));
  if (s.flags.parent) parents++;
}
console.log(`${N} careers (${lang}, ${parents} ending with a kid): ${all.digest('hex')}`);
