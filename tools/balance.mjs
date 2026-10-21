// Balance check: plays many careers with an autopilot and prints outcomes per background.
// Usage: node tools/balance.mjs [careers]
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';
import { NATIONS } from '../js/data/nations.js';
import { overall } from '../js/engine/player.js';

const BG = ['royalty', 'prodigy', 'grafter', 'simracer'];
const ST = ['qualifier', 'fighter', 'whisperer', 'rain'];
const N = Number(process.argv[2] || 120);

function bestOffer(offers, age) {
  const seats = offers.map((o, i) => ({ o, i })).filter(({ o }) => o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve');
  if (!seats.length || age >= 38) return offers.length - 1;
  const rank = (o) => (o.series === 'F1' ? 100 : 0) + ({ F2: 30, F3: 20, F4: 10 }[o.series] || 0) + (o.kind === 'reserve' ? -50 : 0) + (o.tier || 0) * 2;
  seats.sort((a, b) => rank(b.o) - rank(a.o));
  return seats[0].i;
}

const rows = {};
for (let i = 0; i < N; i++) {
  const bg = BG[i % 4];
  const s = newGame({ seed: `bal-${i}`, first: 'A', last: 'B', nat: NATIONS[i % NATIONS.length].id, style: ST[(i >> 2) % 4], bg, helmet: {} });
  let peak = 0;
  let steps = 0;
  let last = '';
  let same = 0;
  while (s.stage !== 'retired' && steps < 20000) {
    const p = prompt(s);
    const sig = `${s.stage}|${s.year}|${s.season?.round}|${p.type}|${s.fn}`;
    same = sig === last ? same + 1 : 0;
    last = sig;
    if (same > 50) {
      console.log('STUCK', `bal-${i}`, sig, JSON.stringify(p).slice(0, 300));
      break;
    }
    if (p.type === 'choice') choose(s, autoPick(s));
    else if (p.type === 'offers') pickOffer(s, bestOffer(p.offers, s.driver.age));
    else advance(s);
    peak = Math.max(peak, overall(s.driver.stats));
    steps++;
  }
  if (s.stage !== 'retired') {
    console.log('DID NOT FINISH', `bal-${i}`, s.stage, s.year, steps);
    continue;
  }
  const r = (rows[bg] ||= { n: 0, f1: 0, win: 0, champ: 0, titles: 0, wins: 0, peak: 0, f1age: 0, worth: 0, seasons: 0 });
  const f = s.career.tot.F1;
  r.n++;
  if (f.starts) {
    r.f1++;
    r.f1age += s.career.rookieAge;
  }
  if (f.wins) r.win++;
  if (f.titles) r.champ++;
  r.titles += f.titles;
  r.wins += f.wins;
  r.peak += peak;
  r.worth += s.retired.worth;
  r.seasons += s.career.hist.length;
}
for (const [k, r] of Object.entries(rows)) {
  console.log(
    k.padEnd(9),
    `n=${r.n} reachedF1=${r.f1} raceWinner=${r.win} champion=${r.champ} avgTitles=${(r.titles / r.n).toFixed(2)} avgWins=${(r.wins / r.n).toFixed(1)}`,
    `peakOvr=${(r.peak / r.n).toFixed(1)} rookieAge=${(r.f1age / Math.max(1, r.f1)).toFixed(1)} seasons=${(r.seasons / r.n).toFixed(1)} worth=$${(r.worth / r.n / 1e6).toFixed(0)}M`,
  );
}
