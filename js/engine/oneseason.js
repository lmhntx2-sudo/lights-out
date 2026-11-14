// The daily season: one Formula 1 season as a rookie, in a seat picked for the
// day. Everyone gets the same driver, the same car and the same luck, so the
// only difference is the calls they make. Most points wins the day.
//
// A one-season career is an ordinary career with s.setup.mode set: the engine
// skips the karting years and the junior ladder, and stops after the season
// review. Ordinary careers have no mode key at all and none of this runs.
import { hashSeed, Rng } from '../core/rng.js';
import { NATIONS } from '../data/nations.js';
import { STYLES, BACKGROUNDS, STATS } from './constants.js';
import { teamsOf } from './world.js';
import { standingsOrder } from './market.js';
import { clamp } from '../core/fmt.js';

export const ONE_SEASON = 'oneseason';
export const isOneSeason = (s) => s?.setup?.mode === ONE_SEASON;

// Nationalities added after this mode shipped stay out, so the pick for any date never changes.
const DAY_NATIONS = NATIONS.filter((n) => (n.cv ?? 1) <= 3);

// Day 1 of the daily season. The number in "Daily #12" counts from here.
const FIRST_DAY = Date.UTC(2026, 10, 14);

export function dayNumber(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - FIRST_DAY) / 86400000) + 1;
}

// Car stars by rank, the same split carTier makes of an eleven-team grid.
const TIER = [5, 5, 4, 4, 3, 3, 3, 2, 2, 1, 1];

// What the day hands out. `rank` is the car, from the best (1) down; `level` is
// how good the rookie is. A slow car comes with a better driver, so a bad draw
// still has points to fight for.
export function daySetup(date) {
  const r = new Rng({ rng: hashSeed(`day-${date}`) });
  const nat = r.pick(DAY_NATIONS).id;
  const style = r.pick(Object.keys(STYLES));
  const bg = r.pick(Object.keys(BACKGROUNDS));
  const rank = r.int(1, 9);
  const age = r.int(19, 24);
  const level = 79 + Math.round(rank * 0.7) + r.int(0, 4);
  return { date, seed: `day-${date}`, nat, style, bg, rank, age, level, tier: TIER[rank - 1] };
}

// Turn the fifteen-year-old newGame made into the day's rookie, and give them the day's seat.
export function seatRookie(s, r) {
  const day = daySetup(s.setup.day);
  const d = s.driver;
  const bias = STYLES[d.style].bias;
  for (const k of STATS) {
    const v = clamp(day.level + (bias[k] || 0) * 0.6 + r.normal(0, 1.5), 55, 97);
    d.stats[k] = v;
    d.caps[k] = Math.min(99, v + 4);
  }
  d.age = day.age;
  d.fame = 30;
  d.money = 500000;

  const teams = teamsOf(s, 'F1').sort((a, b) => b.perf - a.perf);
  const t = teams[Math.min(teams.length, day.rank) - 1];
  // The rookie takes the seat of the weaker of the team's two drivers.
  const k = s.drivers[t.seats[0]].skill <= s.drivers[t.seats[1]].skill ? 0 : 1;
  const bumped = s.drivers[t.seats[k]];
  bumped.team = null;
  bumped.free = true;
  t.seats[k] = 'P';

  const c = s.career;
  c.series = 'F1';
  c.team = t.id;
  c.role = 'race';
  c.contract = { years: 1, salary: 1000000 };
  c.licensed = true;

  // The rival is the lead driver of the next team along: the car you should be racing.
  const near = teams[day.rank] || teams[day.rank - 2];
  const rv = near.seats.map((id) => s.drivers[id]).sort((a, b) => b.skill - a.skill)[0];
  rv.rival = true;
  s.rivalId = rv.id;
  s.acads = [];
  return t;
}

// The day's result, for the summary, the board and the share text. The score is
// the points, with finishing positions as the tie-break.
export function dayResult(s) {
  const st = s.season?.stand?.P;
  const rounds = s.season?.rounds || [];
  const pos = s.season ? standingsOrder(s.season.stand).indexOf('P') + 1 : 0;
  const tie = rounds.reduce((n, x) => n + (x.p > 0 && !x.d ? Math.max(0, 23 - x.p) : 0), 0);
  const goal = s.season?.goal || null;
  const met = goal ? (goal.type === 'points' ? (st?.pts || 0) >= goal.n : pos > 0 && pos <= goal.n) : false;
  const t = s.teams[s.career.team];
  return {
    date: s.setup.day,
    pos,
    pts: st?.pts || 0,
    wins: st?.w || 0,
    podiums: st?.pod || 0,
    poles: st?.pole || 0,
    of: s.season?.cal.length || 0,
    done: rounds.length,
    rounds: rounds.map((x) => ({ p: x.p, ...(x.d ? { d: 1 } : {}) })),
    goal: goal ? { type: goal.type, n: goal.n } : null,
    met,
    team: t?.name || '',
    tier: daySetup(s.setup.day).tier,
    teamId: t?.id || null,
    color: t?.color || null,
    score: (st?.pts || 0) * 1000 + Math.min(999, tie),
  };
}

// One square per round, the way the results strip colours them.
export function daySquares(rounds, of = rounds.length) {
  const sq = (x) => (!x ? '▫️' : x.p === 0 ? '➖' : x.d ? '🟥' : x.p === 1 ? '🟪' : x.p <= 3 ? '🟩' : x.p <= 10 ? '⬜' : '⬛');
  const all = Array.from({ length: of }, (_, i) => sq(rounds[i]));
  const half = Math.ceil(all.length / 2);
  return all.length > 14 ? [all.slice(0, half).join(''), all.slice(half).join('')] : [all.join('')];
}
