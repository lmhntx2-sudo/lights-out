// The career state machine. Everything the UI does goes through:
//   newGame(setup)  prompt(s)  advance(s)  choose(s, i)  pickOffer(s, i)
//   skipToDecision(s)  simToSeasonEnd(s)  retireNow(s)
import { Rng, hashSeed } from '../core/rng.js';
import { START_YEAR, START_AGE, SINFO, SERIES, BACKGROUNDS } from './constants.js';
import { TRACKS, CALENDARS } from '../data/tracks.js';
import { nation, flagOf } from '../data/nations.js';
import { ACADEMY_TEAMS, F1_TEAMS } from '../data/teams.js';
import { createWorld, makeAIDriver, teamsOf, seatsOf, nameOf, teammateOf, carTier, carRank } from './world.js';
import { createPlayer, growPlayer, overall, ovr } from './player.js';
import { prepareRace, classify, pointsFor } from './race.js';
import { EVENTS, PROLOGUE, PROLOGUE_AGE } from './events.js';
import { pickEvent, present, resolve } from './story.js';
import { checkAch, unlock } from './achievements.js';
import {
  newStand, addResult, tallyAI, standingsOrder, simSeriesSeason, offseasonAI, generateOffers,
  takeOffer, offseasonFill, teamDevelopment, slPoints, rivalNews, playerValue, wantF1,
} from './market.js';
import { pushFeed, story } from './helpers.js';
import { buildSummary } from './legacy.js';
import { checkDaily } from './daily.js';
import { money } from '../core/fmt.js';

// ------------------------------------------------------------------ setup

export function newGame(setup) {
  const s = {
    v: 1,
    seed: setup.seed,
    rng: hashSeed(setup.seed),
    daily: setup.daily || null,
    stage: 'prologue',
    proStep: 0,
    year: START_YEAR,
    raceIdx: 0,
    fn: 0,
    feed: [],
    flags: {},
    seen: {},
    ach: [],
    queue: [],
    pending: null,
    offers: null,
    champions: [],
    lastStand: {},
    season: null,
    retired: null,
  };
  const r = new Rng(s);
  createWorld(s, r);
  s.driver = createPlayer(setup, r);
  s.drivers.P = { id: 'P', first: s.driver.first, last: s.driver.last, code: s.driver.code, nat: s.driver.nat, isPlayer: true };
  s.career = {
    series: 'F4', team: null, role: 'race', contract: null,
    sl: [], licensed: false, hist: [], f1Teams: [], rookieYear: null, rookieAge: null, dnfStreak: 0, firsts: {},
    tot: {
      F1: { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, fl: 0, dnf: 0, titles: 0 },
      junior: { starts: 0, wins: 0, podiums: 0, poles: 0, titles: 0 },
    },
  };
  const rival = makeAIDriver(s, r, { series: 'F4', age: START_AGE, skill: overall(s.driver.stats) + r.range(-1, 3), pot: r.range(86, 96) });
  rival.rival = true;
  s.rivalId = rival.id;
  placeStart(s, r);
  s.acads = r.shuffle(ACADEMY_TEAMS).slice(0, 2);

  const n = nation(s.driver.nat);
  pushFeed(s, {
    k: 'chapter',
    year: START_YEAR - 7,
    big: 'Prologue',
    title: `${s.driver.name}, ${n.adj.toLowerCase()} and eight years old`,
    sub: BACKGROUNDS[s.driver.bg].desc,
  });
  presentPrologue(s);
  return s;
}

function placeStart(s, r) {
  const teams = teamsOf(s, 'F4').sort((a, b) => b.perf - a.perf);
  const band = { top: [0, 1], mid: [3, 5], midlow: [5, 7], low: [8, 10] }[BACKGROUNDS[s.driver.bg].seat];
  const t = teams[r.int(band[0], band[1])];
  const out = t.seats[1];
  s.drivers[out].out = true;
  s.drivers[out].team = null;
  t.seats[1] = 'P';
  s.career.team = t.id;

  const rt = teams.filter((x) => x.id !== t.id)[r.int(0, 3)];
  const bumped = rt.seats[0];
  s.drivers[bumped].out = true;
  s.drivers[bumped].team = null;
  rt.seats[0] = s.rivalId;
  s.drivers[s.rivalId].team = rt.id;
}

function presentPrologue(s) {
  const age = PROLOGUE_AGE[s.proStep];
  const c = { age, year: START_YEAR - (START_AGE - age), rival: nameOf(s, s.rivalId), acads: s.acads };
  present(s, EVENTS[PROLOGUE[s.proStep]], c, 'prologue');
}

// ------------------------------------------------------------------ flow

export function prompt(s) {
  if (s.stage === 'retired') return { type: 'retired' };
  if (s.pending) {
    const e = s.feed.find((x) => x.n === s.pending.n);
    return { type: 'choice', n: s.pending.n, choices: e ? e.choices : [] };
  }
  switch (s.stage) {
    case 'prologue':
      return { type: 'continue', label: 'Continue' };
    case 'preseason':
      return { type: 'continue', label: `Start the ${s.year} season` };
    case 'race': {
      const se = s.season;
      const t = TRACKS[se.cal[se.round]];
      return { type: 'race', round: se.round + 1, of: se.cal.length, next: t.name, flag: flagOf(t.nat) };
    }
    case 'seasonEnd':
      return { type: 'continue', label: 'Season review' };
    case 'offers':
      return { type: 'offers', offers: s.offers };
    default:
      return { type: 'continue', label: 'Continue' };
  }
}

export function advance(s) {
  if (s.pending || s.stage === 'retired') return;
  const r = new Rng(s);
  if (s.stage === 'prologue') presentPrologue(s);
  else if (s.stage === 'preseason') startSeason(s, r);
  else if (s.stage === 'race') runRound(s, r);
  else if (s.stage === 'seasonEnd') endSeason(s, r);
}

export function choose(s, i) {
  if (!s.pending) return;
  const r = new Rng(s);
  const after = resolve(s, r, i);
  if (after === 'race') finishRace(s, r);
  else if (after === 'prologue') {
    s.proStep++;
    if (s.proStep < PROLOGUE.length) presentPrologue(s);
    else {
      s.stage = 'preseason';
      const t = s.teams[s.career.team];
      story(s, `It's ${START_YEAR}. You're fifteen, and ${t.name} have given you a seat in ${SINFO.F4.name}. ${s.driver.academy ? `The ${s.teams[s.driver.academy].academy} is paying the bills.` : `You pay your own way: ${money(s.driver.money)} in the bank.`}`, { title: 'Into the cars' });
    }
  }
  if (!s.pending && s.queue.length) {
    const q = s.queue.shift();
    present(s, EVENTS[q.id], q.c, q.after);
  }
}

// Pick the option an autopilot would: best odds, and on ties the calmer, later one.
export function autoPick(s) {
  if (!s.pending) return 0;
  if (s.pending.id === 'training') {
    const keys = ['sim', 'craft', 'fitness', 'wet', 'rest'];
    return Math.max(0, keys.indexOf(s.driver.training));
  }
  const e = s.feed.find((x) => x.n === s.pending.n);
  let best = 0;
  e.choices.forEach((c, i) => {
    if (c.chance >= e.choices[best].chance) best = i;
  });
  return best;
}

export function skipToDecision(s) {
  let guard = 0;
  do {
    advance(s);
  } while (!s.pending && s.stage === 'race' && ++guard < 60);
}

export function simToSeasonEnd(s) {
  let guard = 0;
  while (s.stage === 'race' && ++guard < 400) {
    if (s.pending) choose(s, autoPick(s));
    else advance(s);
  }
  if (s.pending && s.stage === 'race') choose(s, autoPick(s));
}

// ------------------------------------------------------------------ season

function contextBase(s, r) {
  const c = s.career;
  const t = s.teams[c.team];
  const tmId = c.role === 'race' ? teammateOf(s) : null;
  const cityTrack = TRACKS[r.pick(CALENDARS.F1)];
  const ctx = {
    year: s.year,
    series: c.series,
    seriesName: SINFO[c.series].name,
    team: t?.short || 'the team',
    teamId: t?.id,
    color: t?.color,
    eng: t?.engineer || 'Your engineer',
    rank: t ? carRank(s, t) : 0,
    ovr: ovr(s),
    city: cityTrack.place,
    contractYears: c.contract?.years ?? 0,
    academy: s.driver.academy ? s.teams[s.driver.academy].academy : null,
    tm: tmId ? { id: tmId, name: nameOf(s, tmId), last: s.drivers[tmId].last, ovr: Math.round(s.drivers[tmId].skill) } : null,
  };
  const rv = s.drivers[s.rivalId];
  if (rv && !rv.out) ctx.rival = { name: nameOf(s, rv.id), last: rv.last };
  if (s.season && s.season.round >= 4 && c.role === 'race') {
    const pos = standingsOrder(s.season.stand).indexOf('P') + 1;
    ctx.struggling = pos > ctx.rank * 2 + 5;
  }
  if (c.series === 'F1' && c.role === 'race' && t) {
    const pv = playerValue(s);
    const suitors = teamsOf(s, 'F1').filter((x) => x.id !== t.id && x.perf > t.perf + 2 && pv >= wantF1(x));
    if (suitors.length) {
      const sut = suitors.sort((a, b) => b.perf - a.perf)[0];
      ctx.suitor = { id: sut.id, name: sut.name, short: sut.short };
    }
  }
  return ctx;
}

function startSeason(s, r) {
  const c = s.career;
  const series = c.series;
  const t = s.teams[c.team];
  s.season = { year: s.year, series, cal: CALENDARS[series].slice(), round: 0, stand: {}, tstand: {}, race: null, role: c.role, decider: false };
  for (const { id } of seatsOf(s, series)) s.season.stand[id] = newStand();
  for (const tm of teamsOf(s, series)) s.season.tstand[tm.id] = 0;
  delete s.flags.academyWarn;

  const tmId = c.role === 'race' ? teammateOf(s) : null;
  pushFeed(s, {
    k: 'chapter',
    year: s.year,
    big: String(s.year),
    title: c.role === 'reserve' ? `Reserve driver, ${t.name}` : `${SINFO[series].name} with ${t.name}`,
    sub: c.role === 'reserve'
      ? 'No race seat. You test, you simulate, you wait for the phone to ring.'
      : `Age ${s.driver.age}. Car rated ${'★'.repeat(carTier(s, t))}${'☆'.repeat(5 - carTier(s, t))}.${tmId ? ` Teammate: ${nameOf(s, tmId)}.` : ''}`,
    color: t.color,
    series,
  });

  const ctx = contextBase(s, r);
  s.stage = 'race';
  present(s, EVENTS.training, ctx, null);
  if (tmId && s.flags.lastTm !== tmId) {
    s.queue.push({ id: 'teammate', c: ctx, after: null });
    s.flags.lastTm = tmId;
  }
  if (series === 'F1' && c.role === 'race') s.queue.push({ id: 'car_launch', c: ctx, after: null });
}

function titleCtx(s) {
  const se = s.season;
  const ord = standingsOrder(se.stand);
  const pi = ord.indexOf('P');
  if (pi < 0 || pi > 1 || ord.length < 2) return null;
  const opp = pi === 0 ? ord[1] : ord[0];
  const gap = Math.abs(se.stand.P.pts - se.stand[opp].pts);
  const left = se.cal.length - se.round;
  return { fight: gap <= 25 * left, lead: pi === 0, gap, opp: nameOf(s, opp) };
}

function raceCtx(s, race, track) {
  const se = s.season;
  const { order } = classify(race);
  const pi = order.findIndex((e) => e.id === 'P');
  const pe = order[pi];
  const person = (e) => e && { id: e.id, name: nameOf(s, e.id), last: s.drivers[e.id].last, code: s.drivers[e.id].code };
  const ahead = pi > 0 && !pe.dnf ? person(order[pi - 1]) : null;
  const behind = !pe.dnf && order[pi + 1] && !order[pi + 1].dnf ? person(order[pi + 1]) : null;
  const tmE = race.entries.find((e) => e.team === pe.team && e.id !== 'P');
  const team = s.teams[pe.team];
  const n = nation(s.driver.nat);
  const c = {
    series: se.series,
    f1: se.series === 'F1',
    track: track.short,
    gp: track.name,
    place: track.place,
    trackId: track.id,
    laps: track.laps,
    lap: Math.max(2, Math.round(track.laps * 0.72)),
    wet: race.wet,
    sc: race.sc,
    grid: pe.grid,
    pos: pi + 1,
    field: order.length,
    pdnf: pe.dnf,
    pdnfWhy: pe.dnfWhy,
    ahead,
    behind,
    team: team.short,
    color: team.color,
    eng: team.engineer,
    home: n.home.includes(track.id),
    adj: n.adj,
    round: se.round + 1,
    of: se.cal.length,
    last: se.round + 1 === se.cal.length,
    standin: race.mode === 'standin',
  };
  if (tmE) {
    c.tm = { id: tmE.id, name: nameOf(s, tmE.id), last: s.drivers[tmE.id].last, pos: order.indexOf(tmE) + 1 };
    c.tmAhead = ahead?.id === tmE.id;
    c.tmBehind = behind?.id === tmE.id;
  }
  const rv = race.entries.find((e) => e.id === s.rivalId);
  if (rv) {
    c.rival = { name: nameOf(s, rv.id), last: s.drivers[rv.id].last, directlyAhead: ahead?.id === rv.id, directlyBehind: behind?.id === rv.id };
  }
  if (c.last && race.mode === 'race') c.title = titleCtx(s);
  return c;
}

function pickRaceEvent(s, r, c) {
  if (c.series === 'F4' && s.career.tot.junior.starts === 0 && !s.seen.first_race) return EVENTS.first_race;
  if (c.series === 'F1' && s.career.tot.F1.starts === 0 && !s.seen.debut_f1) return EVENTS.debut_f1;
  if (c.last && c.title?.fight) {
    s.season.decider = true;
    return EVENTS.title_decider;
  }
  if (c.pdnf) return r.next() < 0.6 ? pickEvent(s, r, 'race', c) : null;
  if (r.next() >= (c.f1 ? 0.42 : 0.32)) return null;
  return pickEvent(s, r, 'race', c);
}

function runRound(s, r) {
  const se = s.season;
  const track = TRACKS[se.cal[se.round]];
  const swap = {};
  let mode = 'race';
  let victim = null;
  if (s.career.role === 'reserve') {
    mode = 'watch';
    if (r.next() < 0.08) {
      const own = s.teams[s.career.team].seats.filter(Boolean);
      const all = seatsOf(s, 'F1').map((x) => x.id);
      victim = r.next() < 0.5 && own.length ? r.pick(own) : r.pick(all);
      swap[victim] = 'P';
      mode = 'standin';
    }
  } else if (s.driver.injured > 0) {
    mode = 'injured';
    swap.P = s.reserveId;
  }
  const race = prepareRace(s, r, track, se.series, swap);
  race.mode = mode;
  race.victim = victim;
  se.race = race;
  if (mode === 'standin') {
    const vt = race.entries.find((e) => e.id === 'P');
    story(s, `${nameOf(s, victim)} has food poisoning. ${s.teams[vt.team].name} call you at midnight: you are racing in ${track.short} tomorrow.`, { title: 'The phone rings', tone: 'purple' });
  }
  if (mode === 'race' || mode === 'standin') {
    const c = raceCtx(s, race, track);
    const ev = pickRaceEvent(s, r, c);
    if (ev) {
      present(s, ev, c, 'race');
      return;
    }
  }
  finishRace(s, r);
}

function mile(s, key, icon, title, text, tone = 'green') {
  if (s.career.firsts[key]) return;
  s.career.firsts[key] = s.year;
  pushFeed(s, { k: 'mile', icon, title, text, tone });
}

function finishRace(s, r) {
  const se = s.season;
  const race = se.race;
  const track = TRACKS[race.trackId];
  const series = se.series;
  const { grid, order, fl } = classify(race);
  if (grid[0]) (se.stand[grid[0].id] ||= newStand()).pole++;
  order.forEach((e, i) => {
    addResult(se.stand, e.id, i, e);
    se.tstand[e.team] = (se.tstand[e.team] || 0) + pointsFor(i, e);
    if (series === 'F1') tallyAI(s, e, i);
  });
  s.raceIdx++;

  const pi = order.findIndex((e) => e.id === 'P');
  const d = s.driver;
  let me = null;
  let x = null;
  if (pi >= 0) {
    const pe = order[pi];
    const pos = pi + 1;
    const pts = pointsFor(pi, pe);
    const pole = grid[0].id === 'P';
    const isFl = fl === 'P' && !pe.dnf;
    const f1 = series === 'F1';
    const tot = f1 ? s.career.tot.F1 : s.career.tot.junior;
    tot.starts++;
    if (pole) tot.poles++;
    if (!pe.dnf && pos === 1) tot.wins++;
    if (!pe.dnf && pos <= 3) tot.podiums++;
    if (f1) {
      tot.points += pts;
      if (isFl) tot.fl++;
      if (pe.dnf) tot.dnf++;
      s.career.licensed = true;
      if (!s.career.rookieYear) {
        s.career.rookieYear = s.year;
        s.career.rookieAge = d.age;
      }
      if (!s.career.f1Teams.includes(pe.team)) s.career.f1Teams.push(pe.team);
    }
    s.career.dnfStreak = pe.dnf ? (s.career.dnfStreak || 0) + 1 : 0;
    if (f1 && s.career.contract) d.money += Math.round(s.career.contract.salary / se.cal.length);
    if (!pe.dnf && pos === 1) d.fame = Math.min(100, d.fame + (f1 ? 3 : 1));
    else if (!pe.dnf && pos <= 3 && f1) d.fame = Math.min(100, d.fame + 1);
    if (!pe.dnf && pos <= 3) d.teamRel = Math.min(100, d.teamRel + 1);
    if (pe.dnf && pe.dnfWhy !== 'mech') d.teamRel = Math.max(0, d.teamRel - 1);

    me = { pos, grid: pe.grid, dnf: pe.dnf, why: pe.dnfWhy, pts, pole, fl: isFl };
    x = { series, pos, dnf: pe.dnf, grid: pe.grid, pole, fl: isFl, wet: race.wet, trackId: track.id, home: nation(d.nat).home.includes(track.id), standin: race.mode === 'standin', pts, team: pe.team };

    if (f1) {
      if (tot.starts === 1) mile(s, 'f1start', '🏎️', 'Formula 1 driver', `Race one done at ${track.short}. Whatever happens now, you are one of only a few hundred people in history to start a Grand Prix.`, 'purple');
      if (pts > 0) mile(s, 'f1pts', '🔟', 'First Formula 1 points', `P${pos} at ${track.short}. ${pts} ${pts === 1 ? 'point' : 'points'} that nobody can ever take away.`);
      if (!pe.dnf && pos <= 3) mile(s, 'f1pod', '🍾', 'First Formula 1 podium', `P${pos} at the ${track.name}. You spray champagne badly and get most of it in your own eye.`);
      if (pole) mile(s, 'f1pole', '⏱️', 'First pole position', `Fastest of all on Saturday at ${track.short}.`, 'purple');
      if (!pe.dnf && pos === 1) {
        if (!s.career.firsts.f1win) s.nudge = 'first_win';
        mile(s, 'f1win', '🏁', 'Grand Prix winner', `You win the ${track.name}. ${s.flags.remortgage ? 'Your parents are in the garage, holding each other, crying.' : 'The team carries you on their shoulders.'}${s.flags.kebab ? ' Dönerland Express gives free kebabs to the whole town.' : ''}`, 'purple');
      }
    } else if (!pe.dnf && pos === 1) {
      mile(s, 'jrwin', '🥇', 'First win in cars', `You win at ${track.short} in ${SINFO[series].name}. You scream so loudly on the radio your engineer has to take the headset off.`);
    }

    if (pe.dnf && pe.dnfWhy === 'crash' && r.next() < 0.06) {
      d.injured = r.int(1, 3);
      story(s, `The crash at ${track.short} was heavier than it looked. A fractured wrist: you will miss the next ${d.injured === 1 ? 'race' : `${d.injured} races`}.`, { title: 'Injury', tone: 'red' });
    }
  }
  if (race.mode === 'injured') d.injured = Math.max(0, d.injured - 1);

  pushFeed(s, raceCard(s, race, track, grid, order, me));
  if (x) checkAch(s, 'race', x);

  if (series === 'F1') for (const t of teamsOf(s, 'F1')) t.perf = Math.round((t.perf + r.normal(0, 0.12)) * 100) / 100;
  se.race = null;
  se.round++;
  if (se.round >= se.cal.length) {
    s.stage = 'seasonEnd';
    return;
  }
  if (r.next() < (series === 'F1' ? 0.16 : 0.12)) {
    const c = contextBase(s, r);
    const ev = pickEvent(s, r, 'between', c);
    if (ev) present(s, ev, c, null);
  }
}

function raceCard(s, race, track, grid, order, me) {
  const se = s.season;
  const show = new Set(order.slice(0, 10).map((e) => e.id));
  if (order.some((e) => e.id === 'P')) show.add('P');
  if (order.some((e) => e.id === s.rivalId)) show.add(s.rivalId);
  const rows = order
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => show.has(e.id))
    .map(({ e, i }) => ({
      code: e.id === 'P' ? s.driver.code : s.drivers[e.id].code,
      name: nameOf(s, e.id),
      color: s.teams[e.team].color,
      grid: e.grid,
      pos: i + 1,
      dnf: e.dnf,
      me: e.id === 'P',
      rival: e.id === s.rivalId,
    }));
  const w = order[0];
  const ord = standingsOrder(se.stand);
  return {
    k: 'race',
    series: se.series,
    round: se.round + 1,
    of: se.cal.length,
    track: track.name,
    short: track.short,
    flag: flagOf(track.nat),
    wet: race.wet,
    sc: race.sc,
    mode: race.mode,
    me,
    winner: { name: nameOf(s, w.id), color: s.teams[w.team].color, me: w.id === 'P' },
    rows,
    champ: ord.includes('P') ? { pos: ord.indexOf('P') + 1, pts: se.stand.P.pts } : null,
  };
}

function endSeason(s, r) {
  const se = s.season;
  const series = se.series;
  const c = s.career;
  const d = s.driver;
  const order = standingsOrder(se.stand);
  s.lastStand = { [series]: order };
  for (const other of SERIES) if (other !== series) s.lastStand[other] = simSeriesSeason(s, r, other);

  const f1Champ = s.lastStand.F1[0];
  if (f1Champ && f1Champ !== 'P' && s.drivers[f1Champ]) s.drivers[f1Champ].titles++;
  const champTeam = Object.values(s.teams).find((t) => t.seats.includes(f1Champ));
  s.champions.push({ year: s.year, name: nameOf(s, f1Champ), team: champTeam?.name || '', me: f1Champ === 'P' });

  const pos = order.indexOf('P') + 1;
  const st = se.stand.P || newStand();
  const champion = pos === 1;
  const tmId = c.role === 'race' ? teammateOf(s) : null;
  const tmPos = tmId ? order.indexOf(tmId) + 1 : 0;
  const beatTm = !!(pos && tmPos && pos < tmPos);
  const team = s.teams[c.team];
  c.hist.push({
    year: s.year, series, team: c.team, teamName: team?.name, color: team?.color, role: c.role,
    pos, pts: st.pts, wins: st.w, podiums: st.pod, poles: st.pole, starts: st.starts, champion, beatTm,
    tm: tmId ? nameOf(s, tmId) : null, tmPos,
  });
  if (champion) {
    if (series === 'F1') c.tot.F1.titles++;
    else c.tot.junior.titles++;
    d.fame = Math.min(100, d.fame + (series === 'F1' ? 15 : 5));
  }

  const sl = pos ? SINFO[series].sl[pos - 1] || 0 : 0;
  c.sl.push({ year: s.year, pts: sl });
  const slTotal = slPoints(s);
  let newLicence = false;
  if (!c.licensed && slTotal >= 40 && d.age >= 17) {
    c.licensed = true;
    newLicence = true;
    unlock(s, 'superlicence');
  }

  const info = SINFO[series];
  const prize = pos >= 1 && pos <= 3 ? info.prize[pos - 1] || 0 : 0;
  const sponsor = Math.round(info.sponsor * (d.fame / 100) ** 2 * nation(d.nat).market * (s.flags.agent ? 1.25 : 1));
  const family = series === 'F1' ? 0 : BACKGROUNDS[d.bg].yearly;
  d.money += prize + sponsor + family;

  const deltas = growPlayer(s, r);
  d.fame = Math.max(0, d.fame - 2);

  let academyNote = null;
  if (d.academy && series !== 'F1') {
    const warned = s.flags.academyWarn === s.year && pos > 3;
    const ruthless = d.academy === 'torque' && series !== 'F4' && pos > 6;
    if (warned || ruthless) {
      academyNote = `The ${s.teams[d.academy].academy} has dropped you. From now on, you pay your own way.`;
      d.academy = null;
    }
  }
  if (c.contract) c.contract.years = Math.max(0, c.contract.years - 1);

  const top = order.slice(0, 5).map((id, i) => ({ pos: i + 1, name: nameOf(s, id), color: (Object.values(s.teams).find((t) => t.seats.includes(id)) || {}).color, pts: se.stand[id].pts, me: id === 'P' }));
  if (pos > 5) top.push({ pos, name: d.name, color: team?.color, pts: st.pts, me: true });
  pushFeed(s, {
    k: 'season', year: s.year, series, seriesName: info.name, role: c.role,
    pos, pts: st.pts, wins: st.w, podiums: st.pod, poles: st.pole, champion,
    top, deltas, sl, slTotal, newLicence, licensed: c.licensed,
    income: prize + sponsor + family, tm: tmId ? nameOf(s, tmId) : null, tmPos, beatTm,
    f1Champ: series !== 'F1' ? `${nameOf(s, f1Champ)}${champTeam ? ` (${champTeam.short})` : ''}` : null,
  });
  if (academyNote) story(s, academyNote, { title: 'Dropped', tone: 'red' });

  checkAch(s, 'season', { series, pos, champion });
  if (champion && series === 'F1') {
    if (se.decider) unlock(s, 'decider');
    s.nudge = 'title';
  }
  checkDaily(s);

  const news = offseasonAI(s, r);
  if (news.length) pushFeed(s, { k: 'news', title: 'Paddock news', lines: news });

  s.offers = generateOffers(s, r);
  s.stage = 'offers';
  if (r.next() < 0.55) {
    const ctx = { ...contextBase(s, r), champion };
    const ev = pickEvent(s, r, 'offseason', ctx);
    if (ev) present(s, ev, ctx, null);
  }
}

export function pickOffer(s, i) {
  if (s.pending || s.stage !== 'offers' || !s.offers?.[i]) return;
  const r = new Rng(s);
  const o = s.offers[i];
  if (o.kind === 'retire') return retire(s, 'retired');
  if (o.kind === 'endurance') {
    unlock(s, 'endurance');
    return retire(s, 'endurance');
  }
  const wasF1 = s.career.series === 'F1' && s.career.role === 'race';
  const prevTeam = s.career.team;
  takeOffer(s, o);
  const t = s.teams[s.career.team];
  if (o.kind === 'seat' && t.series === 'F1' && !wasF1 && !s.career.firsts.f1seat) {
    s.career.firsts.f1seat = s.year;
    pushFeed(s, { k: 'mile', icon: '📝', title: 'You are a Formula 1 driver', text: `${t.name} sign you on a ${o.years}-year deal worth ${money(o.salary)} a year. ${s.flags.remortgage ? 'You call your parents. Nobody can speak for a while.' : 'You read the contract four times to make sure it is real.'}`, tone: 'purple' });
  } else if (o.kind === 'seat' && (prevTeam !== t.id || o.tag === 'renew')) {
    const cost = o.cost ? ` The seat costs ${money(o.cost)}.` : t.series !== 'F1' && s.driver.academy ? ' The academy pays.' : '';
    const pay = t.series === 'F1' ? ` ${o.years} ${o.years === 1 ? 'year' : 'years'}, ${money(o.salary)} a year.` : '';
    story(s, `${o.tag === 'renew' ? 'You re-sign with' : 'You sign for'} ${t.name} in ${SINFO[t.series].name}.${pay}${cost}`, { title: 'Contract' });
  } else if (o.kind === 'reserve') {
    story(s, `You join ${t.name} as reserve driver. Good money for sitting still, terrible for the soul.`, { title: 'Contract' });
  }

  offseasonFill(s, r);
  const reg = teamDevelopment(s, r, s.year + 1);
  const lines = [];
  const rn = rivalNews(s);
  if (rn) lines.push(rn);
  if (reg) lines.push(`New technical regulations arrive for ${s.year + 1}. Nobody knows who will be fast.`);
  if (lines.length) pushFeed(s, { k: 'news', title: 'Over the winter', lines });

  s.year++;
  s.driver.age++;
  s.offers = null;
  s.stage = 'preseason';
}

function retire(s, how) {
  s.pending = null;
  s.queue = [];
  s.offers = null;
  s.stage = 'retired';
  checkAch(s, 'retire', {});
  checkDaily(s);
  s.retired = buildSummary(s, how);
  pushFeed(s, { k: 'retire', ...s.retired });
}

export function retireNow(s) {
  if (s.stage === 'retired') return;
  retire(s, 'retired');
}
