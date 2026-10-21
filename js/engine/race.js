import { SINFO, POINTS } from './constants.js';
import { teamsOf } from './world.js';
import { playerRatings } from './player.js';

// Build a race. Everything random is rolled here, up front, so a choice made
// during the race only nudges the player's numbers before classification.
// `swap` maps a seated driver id to whoever drives the car this weekend.
export function prepareRace(s, r, track, series, swap = {}) {
  const info = SINFO[series];
  const wet = r.next() < track.rain;
  const sc = r.next() < track.sc;
  const entries = [];
  for (const t of teamsOf(s, series)) {
    for (const seat of t.seats) {
      if (!seat) continue;
      const id = swap[seat] || seat;
      let q;
      let rr;
      let cons;
      if (id === 'P') {
        ({ q, r: rr } = playerRatings(s, wet));
        cons = s.driver.stats.consistency;
      } else {
        const d = s.drivers[id];
        q = d.skill + d.qb + (wet ? d.wet : 0);
        rr = d.skill + (wet ? d.wet : 0);
        cons = d.skill;
      }
      entries.push({ id, team: t.id, car: t.perf, q, rr, cons, mod: 0, qmod: 0, gain: 0 });
    }
  }
  const wc = info.wc;
  const sq = wet ? 2.4 : 1.6;
  const sr = (wet ? 3.2 : 2.3) + (sc ? 0.7 : 0);
  for (const e of entries) {
    e.qs = e.car * wc + e.q * (1 - wc) + r.normal(0, sq);
    e.base = e.car * wc + e.rr * (1 - wc) + r.normal(0, sr);
    const mech = (1 - s.teams[e.team].rel) * (series === 'F1' ? 1 : 0.8);
    const crash = info.dnf * (1.45 - e.cons / 100) * (wet ? 1.8 : 1);
    e.dnf = r.next() < mech + crash;
    e.dnfWhy = e.dnf ? (r.next() < mech / (mech + crash) ? 'mech' : 'crash') : null;
    e.dnfLap = r.int(1, Math.max(2, track.laps - 1));
    e.flr = r.next();
  }
  return { trackId: track.id, series, wet, sc, gw: (1 - track.ot) * 0.45, entries };
}

export function classify(race) {
  const grid = [...race.entries].sort((a, b) => b.qs + b.qmod - (a.qs + a.qmod));
  grid.forEach((e, i) => (e.grid = i + 1));
  const running = grid
    .filter((e) => !e.dnf)
    .map((e) => ({ e, score: e.base + e.mod - (e.grid - 1) * race.gw }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
  const pi = running.findIndex((e) => e.id === 'P');
  if (pi >= 0 && running[pi].gain) {
    const p = running[pi];
    const ni = Math.max(0, Math.min(running.length - 1, pi - p.gain));
    running.splice(pi, 1);
    running.splice(ni, 0, p);
  }
  const outs = grid.filter((e) => e.dnf).sort((a, b) => b.dnfLap - a.dnfLap);
  const order = [...running, ...outs];
  // Fastest lap goes to one of the front-runners.
  const pool = running.slice(0, 6);
  let fl = null;
  if (pool.length) {
    let best = -1;
    for (const e of pool) if (e.flr > best) { best = e.flr; fl = e.id; }
  }
  return { grid, order, fl };
}

export const pointsFor = (i, e) => (!e.dnf && i < POINTS.length ? POINTS[i] : 0);

// Run a whole race with no player input. Used for series the player isn't in.
export function quickRace(s, r, track, series) {
  const race = prepareRace(s, r, track, series);
  return classify(race);
}
