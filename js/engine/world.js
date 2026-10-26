import { F1_TEAMS, FEEDER_TEAMS, ENGINEERS } from '../data/teams.js';
import { NAME_POOLS, AI_NATIONS, driverCode } from '../data/names.js';
import { nation } from '../data/nations.js';
import { SINFO } from './constants.js';

const r1 = (v) => Math.round(v * 10) / 10;

export function makeAIDriver(s, r, { series, age, skill, pot, nat }) {
  const id = 'd' + s.nextId++;
  let first, last;
  for (let tries = 0; tries < 6; tries++) {
    const n = nat || r.weighted(AI_NATIONS, (x) => x[1])[0];
    const pool = NAME_POOLS[nation(n).names] || NAME_POOLS.en;
    first = r.pick(pool.f);
    last = r.pick(pool.l);
    nat = n;
    const clash = Object.values(s.drivers).some((d) => d.last === last && d.first === first);
    if (!clash) break;
  }
  const d = {
    id, first, last, code: driverCode(last), nat, age,
    skill: r1(skill), pot: r1(Math.max(pot ?? skill, skill)),
    wet: r1(r.normal(0, 4)), qb: r1(r.normal(0, 1.5)),
    series, team: null, contract: 0,
    starts: 0, wins: 0, podiums: 0, titles: 0, out: false,
  };
  s.drivers[id] = d;
  return d;
}

export function createWorld(s, r) {
  s.teams = {};
  s.drivers = {};
  s.nextId = 1;

  for (const t of F1_TEAMS) {
    s.teams[t.id] = { ...t, series: 'F1', perf: r1(t.perf + r.normal(0, 1.2)), seats: [null, null], engineer: r.pick(ENGINEERS) };
  }
  const f1 = Object.values(s.teams).sort((a, b) => b.perf - a.perf);
  const pool = [];
  for (let i = 0; i < 22; i++) {
    const age = r.int(19, 37);
    const skill = r.range(73, 93) - (age < 22 ? 3 : 0);
    const d = makeAIDriver(s, r, { series: 'F1', age, skill, pot: age < 26 ? skill + r.range(2, 8) : skill });
    d.contract = r.int(1, 3);
    d.starts = Math.max(0, (age - 20) * r.int(14, 22));
    d.wins = skill > 86 ? r.int(0, Math.max(1, (age - 21) * 2)) : 0;
    pool.push(d);
  }
  pool.sort((a, b) => b.skill + r.normal(0, 3) - (a.skill + r.normal(0, 3)));
  f1.forEach((t, i) => {
    t.seats = [pool[i * 2].id, pool[i * 2 + 1].id];
    t.seats.forEach((id) => (s.drivers[id].team = t.id));
  });

  for (const series of ['F2', 'F3', 'F4']) {
    const info = SINFO[series];
    const picks = r.shuffle(FEEDER_TEAMS).slice(0, 11);
    picks.forEach((tpl, i) => {
      const id = `${series.toLowerCase()}-${i}`;
      const t = {
        id, name: tpl.name, short: tpl.short || tpl.name.split(' ')[0], color: tpl.color, series,
        perf: r1(r.range(72, 90)), budget: r.range(0.5, 0.9), prestige: 50, rel: r.range(0.96, 0.985),
        seats: [null, null], engineer: r.pick(ENGINEERS),
      };
      s.teams[id] = t;
      for (let k = 0; k < 2; k++) {
        const d = newJunior(s, r, series);
        d.team = id;
        t.seats[k] = d.id;
      }
    });
    void info;
  }

  // A seasoned driver the teams call when someone is injured.
  const res = makeAIDriver(s, r, { series: 'RES', age: 26, skill: 74, pot: 74 });
  res.reserve = true;
  s.reserveId = res.id;
}

export function newJunior(s, r, series, ageOverride) {
  const info = SINFO[series];
  const age = ageOverride ?? r.int(info.age[0], info.age[1]);
  const skill = r.range(info.skill[0], info.skill[1] - 4) + (age - info.age[0]) * 1.2;
  const pot = Math.min(97, Math.max(skill + 3, r.normal(80, 7)));
  return makeAIDriver(s, r, { series, age, skill, pot });
}

export const teamsOf = (s, series) => Object.values(s.teams).filter((t) => t.series === series);

export function seatsOf(s, series) {
  const out = [];
  for (const t of teamsOf(s, series)) for (const id of t.seats) if (id) out.push({ id, team: t.id });
  return out;
}

export const isPlayer = (id) => id === 'P';

export function nameOf(s, id) {
  if (id === 'P' && s.driver?.name) return s.driver.name;
  const d = s.drivers[id];
  return d ? `${d.first} ${d.last}` : 'Unknown';
}

export const lastOf = (s, id) => s.drivers[id]?.last || 'Unknown';
export const codeOf = (s, id) => s.drivers[id]?.code || '???';

export function teamOfDriver(s, id) {
  for (const t of Object.values(s.teams)) if (t.seats.includes(id)) return t;
  return null;
}

export function teammateOf(s, id = 'P') {
  const t = teamOfDriver(s, id);
  if (!t) return null;
  return t.seats.find((x) => x && x !== id) || null;
}

// Car tier 1-5 from the team's rank within its series.
export function carTier(s, team) {
  const list = teamsOf(s, team.series).sort((a, b) => b.perf - a.perf);
  const rank = list.findIndex((t) => t.id === team.id);
  const frac = rank / Math.max(1, list.length - 1);
  return frac <= 0.12 ? 5 : frac <= 0.35 ? 4 : frac <= 0.6 ? 3 : frac <= 0.82 ? 2 : 1;
}

export function carRank(s, team) {
  return teamsOf(s, team.series).sort((a, b) => b.perf - a.perf).findIndex((t) => t.id === team.id) + 1;
}

export function removeFromSeats(s, id) {
  for (const t of Object.values(s.teams)) {
    const i = t.seats.indexOf(id);
    if (i >= 0) t.seats[i] = null;
  }
}
