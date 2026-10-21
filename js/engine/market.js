// The off-season: AI careers move on, teams develop, and the player gets offers.
import { SINFO, RETIRE_AGE } from './constants.js';
import { TRACKS, CALENDARS } from '../data/tracks.js';
import { teamsOf, seatsOf, newJunior, makeAIDriver, removeFromSeats, carTier, nameOf } from './world.js';
import { developAI, overall } from './player.js';
import { quickRace, pointsFor } from './race.js';
import { clamp } from '../core/fmt.js';

export const newStand = () => ({ pts: 0, w: 0, pod: 0, pole: 0, best: 99, starts: 0 });

export function standingsOrder(stand) {
  return Object.entries(stand)
    .filter(([, a]) => a.starts > 0)
    .sort(([, a], [, b]) => b.pts - a.pts || b.w - a.w || b.pod - a.pod || a.best - b.best)
    .map(([id]) => id);
}

export function addResult(stand, id, i, e) {
  const st = stand[id] || (stand[id] = newStand());
  st.starts++;
  st.pts += pointsFor(i, e);
  if (!e.dnf) {
    if (i === 0) st.w++;
    if (i < 3) st.pod++;
    st.best = Math.min(st.best, i + 1);
  }
}

export function tallyAI(s, e, i) {
  const d = s.drivers[e.id];
  if (!d || e.id === 'P') return;
  d.starts++;
  if (!e.dnf && i === 0) d.wins++;
  if (!e.dnf && i < 3) d.podiums++;
}

// Simulate a whole season of a series the player isn't racing in.
export function simSeriesSeason(s, r, series) {
  const stand = {};
  for (const { id } of seatsOf(s, series)) stand[id] = newStand();
  for (const tid of CALENDARS[series]) {
    const { grid, order } = quickRace(s, r, TRACKS[tid], series);
    if (grid[0]) stand[grid[0].id].pole++;
    order.forEach((e, i) => {
      addResult(stand, e.id, i, e);
      if (series === 'F1') tallyAI(s, e, i);
    });
  }
  return standingsOrder(stand);
}

// ---------------------------------------------------------------- valuation

export const wantF1 = (t) => 74 + (t.perf - 72) * 0.45;

export function playerValue(s) {
  const d = s.driver;
  let v = overall(d.stats);
  const h = s.career.hist[s.career.hist.length - 1];
  if (h && h.pos) {
    const p = h.pos;
    if (h.series === 'F1') v += p === 1 ? 3 : p <= 3 ? 2 : p <= 6 ? 1 : p > 14 ? -1.5 : 0;
    else v += p === 1 ? 2.5 : p <= 3 ? 1.5 : p <= 6 ? 0.5 : p > 12 ? -1.5 : 0;
    if (h.beatTm) v += 0.8;
  }
  v += (d.fame - 50) / 40;
  return v;
}

function teamBonus(s, t) {
  const d = s.driver;
  let b = 0;
  if (d.academy && (d.academy === t.id || s.teams[d.academy]?.sister === t.id)) b += 3;
  if (t.budget < 0.8 && d.money > 15e6) b += 2;
  if (t.id === s.career.team) b += (d.teamRel - 50) / 10;
  return b;
}

export function salaryFor(pv, t) {
  const base = Math.max(0.6, (Math.max(0, pv - 72) / 22) ** 2 * 45) * 1e6;
  return Math.round((base * (0.55 + 0.5 * t.budget)) / 1e5) * 1e5;
}

function seatCost(s, t, pv) {
  const info = SINFO[t.series];
  if (!info.cost || s.driver.academy) return 0;
  const tierF = [0, 0.6, 0.8, 1, 1.2, 1.45][carTier(s, t)];
  const discount = clamp((pv - (info.skill[0] + 8)) / 14, 0, 0.85);
  return Math.round((info.cost * tierF * (1 - discount)) / 5000) * 5000;
}

export function slPoints(s) {
  return s.career.sl.filter((x) => x.year >= s.year - 2).reduce((a, b) => a + b.pts, 0);
}

export function hasLicence(s) {
  return s.career.licensed || (slPoints(s) >= 40 && s.driver.age >= 17);
}

// ------------------------------------------------------------ phase A

// Age everyone, retire veterans and let F1 teams decide on expiring contracts.
export function offseasonAI(s, r) {
  const news = [];
  for (const d of Object.values(s.drivers)) {
    if (d.id === 'P' || d.out || d.reserve) continue;
    d.age++;
    developAI(d, r);
  }
  for (const t of teamsOf(s, 'F1')) {
    t.seats.forEach((id, k) => {
      if (!id || id === 'P') return;
      const d = s.drivers[id];
      d.contract--;
      const retireP = d.age >= 39 ? 0.75 : d.age >= 36 ? 0.3 : d.age >= 34 ? 0.1 : 0;
      if (r.next() < retireP) {
        d.out = true;
        d.team = null;
        t.seats[k] = null;
        if (d.wins > 0 || d.titles > 0) news.push(`${d.first} ${d.last} retires with ${d.titles ? `${d.titles} ${d.titles === 1 ? 'title' : 'titles'} and ` : ''}${d.wins} ${d.wins === 1 ? 'win' : 'wins'}.`);
        return;
      }
      if (d.contract > 0) return;
      if (d.skill + r.normal(0, 2.5) >= wantF1(t) - 1) d.contract = r.int(1, 3);
      else {
        t.seats[k] = null;
        d.team = null;
        d.free = true;
      }
    });
  }
  return news;
}

// ------------------------------------------------------------ offers

const offerFrom = (s, t, extra) => ({ kind: 'seat', series: t.series, team: t.id, name: t.name, color: t.color, tier: carTier(s, t), ...extra });

function f1Pool(s) {
  const f2 = (s.lastStand.F2 || []).filter((id) => id !== 'P' && s.drivers[id] && !s.drivers[id].out).slice(0, 6);
  const free = Object.values(s.drivers).filter((d) => d.free && !d.out).map((d) => d.id);
  return [...new Set([...free, ...f2])].map((id) => s.drivers[id]);
}

function weakestSeat(s, t) {
  let k = -1;
  let low = Infinity;
  t.seats.forEach((id, i) => {
    if (!id || id === 'P') return;
    if (s.drivers[id].skill < low) {
      low = s.drivers[id].skill;
      k = i;
    }
  });
  return { k, skill: low };
}

function f1SeatOffers(s, r, pv, exclude) {
  const offers = [];
  const pool = f1Pool(s).map((d) => ({ d, score: d.skill + r.normal(0, 1.5) })).sort((a, b) => b.score - a.score);
  const teams = teamsOf(s, 'F1').sort((a, b) => b.prestige - a.prestige);
  for (const t of teams) {
    const open = t.seats.filter((x) => !x).length;
    const weak = weakestSeat(s, t);
    const rival = open ? pool.shift()?.score ?? 0 : weak.skill + 2.5;
    if (t.id === exclude) continue;
    if (!open && weak.k < 0) continue;
    const score = pv + teamBonus(s, t) + r.normal(0, 1.5);
    if (score >= wantF1(t) && score >= rival - 0.5) {
      const years = s.driver.age >= 33 ? 1 : pv >= 86 ? r.int(2, 3) : 2;
      offers.push(offerFrom(s, t, { years, salary: salaryFor(pv, t), note: open ? null : `${s.drivers[t.seats[weak.k]].last} would be dropped to make room.` }));
    }
  }
  return offers.sort((a, b) => b.tier - a.tier).slice(0, 4);
}

function feederOffers(s, r, pv, series, tag) {
  const info = SINFO[series];
  const teams = teamsOf(s, series).sort((a, b) => b.perf - a.perf);
  const n = teams.length;
  const fits = [];
  teams.forEach((t, i) => {
    const req = info.skill[0] + 12 - (i / (n - 1)) * 17;
    const cost = seatCost(s, t, pv);
    const payBonus = s.driver.money >= cost * 1.3 && cost > 0 ? 4 : 0;
    const acad = s.driver.academy ? 2 : 0;
    if (pv + payBonus + acad + r.normal(0, 2) >= req) fits.push({ t, cost });
  });
  const chosen = fits.slice(0, 2);
  const rest = fits.slice(2);
  if (rest.length) chosen.push(rest[r.int(0, rest.length - 1)]);
  if (!chosen.length) chosen.push({ t: teams[n - 1 - r.int(0, 2)], cost: seatCost(s, teams[n - 1], pv) });
  return chosen.map(({ t, cost }) => offerFrom(s, t, { years: 1, cost, tag }));
}

export function generateOffers(s, r) {
  const d = s.driver;
  const c = s.career;
  const retire = (label, note) => ({ kind: 'retire', label, note });
  if (d.age + 1 >= RETIRE_AGE) return [retire('Retire', 'Your body has made the decision for you.')];
  if (s.flags.farewell) return [retire('Retire on your own terms', 'The farewell tour is over.')];

  const pv = playerValue(s);
  const offers = [];
  const endurance = { kind: 'endurance', label: 'Join a factory endurance team', note: 'Swap single-seaters for Le Mans. This ends your formula career.' };

  if (s.flags.signFor && s.teams[s.flags.signFor]) {
    const t = s.teams[s.flags.signFor];
    delete s.flags.signFor;
    offers.push(offerFrom(s, t, { years: 2, salary: salaryFor(pv, t), tag: 'signed', note: 'The pre-contract you signed takes effect.' }));
    if (d.age >= 30) offers.push(retire('Retire instead'));
    return offers;
  }

  if (c.series === 'F1' && c.role === 'race') {
    const own = s.teams[c.team];
    if (c.contract && c.contract.years > 0) {
      offers.push({ kind: 'stay', series: 'F1', team: own.id, name: own.name, color: own.color, tier: carTier(s, own), years: c.contract.years, salary: c.contract.salary, note: `${c.contract.years} ${c.contract.years === 1 ? 'year' : 'years'} left on your contract.` });
      const better = f1SeatOffers(s, r, pv, own.id).filter((o) => s.teams[o.team].perf > own.perf + 2);
      if (better[0]) offers.push({ ...better[0], tag: 'buyout', note: `${s.teams[better[0].team].short} will pay your release clause.` });
    } else {
      const want = wantF1(own);
      if (pv + teamBonus(s, own) + r.normal(0, 1.5) >= want - 3) {
        offers.push(offerFrom(s, own, { years: d.age >= 33 ? 1 : r.int(1, 3), salary: Math.round(salaryFor(pv, own) * 1.05), tag: 'renew', note: 'Your current team wants to keep you.' }));
      }
      offers.push(...f1SeatOffers(s, r, pv, own.id).slice(0, 3));
    }
    if (!offers.length) {
      const res = reserveOffer(s, r, pv);
      if (res) offers.push(res);
      offers.push(endurance);
    }
  } else if (c.role === 'reserve') {
    offers.push(...f1SeatOffers(s, r, pv, null).slice(0, 3));
    const res = reserveOffer(s, r, pv, c.team);
    if (res) offers.push(res);
    offers.push(endurance);
  } else {
    const series = c.series;
    const lvl = SINFO[series].lvl;
    const h = c.hist[c.hist.length - 1];
    if (series === 'F2' && hasLicence(s)) {
      offers.push(...f1SeatOffers(s, r, pv, null).slice(0, 3));
      if (!offers.length) {
        const res = reserveOffer(s, r, pv);
        if (res) offers.push(res);
      }
    }
    if (lvl < 2) {
      const next = ['F4', 'F3', 'F2'][lvl + 1];
      const promote = (h && h.pos && h.pos <= 10) || overall(d.stats) >= SINFO[next].skill[0] + 2;
      if (promote) offers.push(...feederOffers(s, r, pv, next, 'promo'));
    }
    const stay = feederOffers(s, r, pv, series, 'stay');
    const ownTeam = s.teams[c.team];
    const hasOwn = stay.some((o) => o.team === ownTeam?.id);
    offers.push(...stay.slice(0, hasOwn ? 2 : 1));
    if (!hasOwn && ownTeam) offers.push(offerFrom(s, ownTeam, { years: 1, cost: seatCost(s, ownTeam, pv), tag: 'stay' }));
    if (series === 'F2' && d.age >= 21) offers.push(endurance);
    makeOneAffordable(s, offers);
  }
  offers.push(retire(d.age < 28 ? 'Walk away from racing' : 'Retire'));
  return offers;
}

function reserveOffer(s, r, pv, current) {
  if (pv < 70 || !hasLicence(s)) return null;
  const tops = teamsOf(s, 'F1').sort((a, b) => b.prestige - a.prestige).slice(0, 5);
  const t = (current && s.teams[current]) || tops[r.int(0, tops.length - 1)];
  return { kind: 'reserve', series: 'F1', team: t.id, name: t.name, color: t.color, tier: carTier(s, t), years: 1, salary: 500000, note: 'Test, simulate, and wait for a call. Someone always gets ill.' };
}

function makeOneAffordable(s, offers) {
  const paid = offers.filter((o) => o.kind === 'seat' && o.cost);
  if (!paid.length) return;
  if (offers.some((o) => o.kind === 'seat' && (o.cost || 0) <= s.driver.money)) return;
  const cheapest = paid.sort((a, b) => a.cost - b.cost)[0];
  cheapest.cost = Math.floor((s.driver.money * 0.6) / 5000) * 5000;
  cheapest.note = 'They will take what you can pay. Someone believes in you.';
}

export function takeOffer(s, o) {
  const c = s.career;
  const d = s.driver;
  if (o.kind === 'stay') return;
  if (o.kind === 'reserve') {
    removeFromSeats(s, 'P');
    c.series = 'F1';
    c.team = o.team;
    c.role = 'reserve';
    c.contract = { years: 1, salary: o.salary };
    return;
  }
  const t = s.teams[o.team];
  const changed = c.team !== t.id || c.role !== 'race';
  removeFromSeats(s, 'P');
  let k = t.seats.findIndex((x) => !x);
  if (k < 0) {
    k = weakestSeat(s, t).k;
    const bumped = s.drivers[t.seats[k]];
    bumped.team = null;
    if (t.series === 'F1') bumped.free = true;
    else bumped.out = true;
  }
  t.seats[k] = 'P';
  c.series = t.series;
  c.team = t.id;
  c.role = 'race';
  c.contract = t.series === 'F1' ? { years: o.years, salary: o.salary } : null;
  if (o.cost) d.money = Math.max(0, d.money - o.cost);
  if (changed) d.teamRel = 60;
  if (t.series === 'F1' && !c.f1Teams.includes(t.id)) c.f1Teams.push(t.id);
}

// ------------------------------------------------------------ phase B

function assign(t, k, d) {
  t.seats[k] = d.id;
  d.team = t.id;
  d.series = t.series;
  d.free = false;
}

function takeBest(pool, scoreOf) {
  let best = -1;
  let bi = -1;
  pool.forEach((d, i) => {
    const sc = scoreOf(d);
    if (sc > best) {
      best = sc;
      bi = i;
    }
  });
  return bi < 0 ? null : pool.splice(bi, 1)[0];
}

function dropLeavers(s, r, series) {
  const info = SINFO[series];
  const order = s.lastStand[series] || [];
  const maxAge = info.age[1] + (series === 'F2' ? 3 : series === 'F3' ? 2 : 1);
  for (const t of teamsOf(s, series)) {
    t.seats.forEach((id, k) => {
      if (!id || id === 'P') return;
      const d = s.drivers[id];
      const pos = order.indexOf(id) + 1 || 99;
      const tooOld = d.age > maxAge;
      const churn = pos > 11 && r.next() < 0.3;
      const moveOn = series === 'F2' && pos <= 3 && r.next() < 0.5;
      if (tooOld || churn || moveOn) {
        t.seats[k] = null;
        d.team = null;
        d.out = true;
      }
    });
  }
}

function fillFrom(s, r, upper, lower) {
  const order = (s.lastStand[lower] || []).filter((id) => {
    const d = s.drivers[id];
    return id !== 'P' && d && !d.out && d.series === lower;
  });
  const pool = order.slice(0, 10).map((id) => s.drivers[id]);
  for (const t of teamsOf(s, upper).sort((a, b) => b.perf - a.perf)) {
    for (let k = 0; k < 2; k++) {
      if (t.seats[k]) continue;
      const best = takeBest(pool, (d) => d.skill + r.normal(0, 2) + (10 - order.indexOf(d.id)) * 0.3 + (d.id === s.rivalId ? 3 : 0));
      if (best) {
        removeFromSeats(s, best.id);
        assign(t, k, best);
      } else assign(t, k, newJunior(s, r, upper));
    }
  }
}

export function offseasonFill(s, r) {
  const pool = f1Pool(s);
  for (const t of teamsOf(s, 'F1').sort((a, b) => b.prestige - a.prestige)) {
    for (let k = 0; k < 2; k++) {
      if (t.seats[k]) continue;
      const best = takeBest(pool, (d) => d.skill + r.normal(0, 2) + (d.id === s.rivalId ? 2 : 0) + (s.lastStand.F2?.[0] === d.id ? 2 : 0));
      if (best) {
        removeFromSeats(s, best.id);
        assign(t, k, best);
        best.contract = r.int(1, 3);
      } else {
        const d = makeAIDriver(s, r, { series: 'F1', age: r.int(21, 25), skill: r.range(74, 80), pot: Math.min(95, r.normal(85, 4)) });
        assign(t, k, d);
        d.contract = 2;
      }
    }
  }
  for (const d of Object.values(s.drivers)) {
    if (d.free) {
      d.free = false;
      d.out = true;
    }
  }
  dropLeavers(s, r, 'F2');
  fillFrom(s, r, 'F2', 'F3');
  dropLeavers(s, r, 'F3');
  fillFrom(s, r, 'F3', 'F4');
  dropLeavers(s, r, 'F4');
  for (const t of teamsOf(s, 'F4')) {
    for (let k = 0; k < 2; k++) if (!t.seats[k]) assign(t, k, newJunior(s, r, 'F4', 15));
  }
}

const REG_YEARS = [2030, 2035, 2040, 2045];

export function teamDevelopment(s, r, nextYear) {
  const reg = REG_YEARS.includes(nextYear);
  for (const t of Object.values(s.teams)) {
    if (t.series === 'F1') {
      let delta = (80 - t.perf) * 0.24 + (t.budget - 0.82) * 8 + r.normal(0, 2);
      if (s.career.team === t.id && s.career.role === 'race') delta += Math.max(0, s.driver.stats.technical - 75) * 0.025;
      if (reg) delta += r.normal(0, 4.5);
      t.perf = Math.round(clamp(t.perf + delta, 70, 96) * 10) / 10;
      t.budget = clamp(t.budget + r.normal(0, 0.02), 0.6, 1);
    } else {
      t.perf = Math.round(clamp(t.perf + r.normal(0, 1.5), 68, 93) * 10) / 10;
    }
  }
  return reg;
}

export function rivalNews(s) {
  const d = s.drivers[s.rivalId];
  if (!d) return null;
  if (d.out) return null;
  const t = s.teams[d.team];
  if (!t) return null;
  return `${nameOf(s, d.id)}, your old karting rival, will race in ${SINFO[t.series].name} with ${t.name}.`;
}
