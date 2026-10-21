// Picking, presenting and resolving decision moments.
import { EVENTS } from './events.js';
import { SINFO, STAT_LABEL } from './constants.js';
import { val, pushFeed } from './helpers.js';
import { overall } from './player.js';
import { unlock } from './achievements.js';
import { clamp, money } from '../core/fmt.js';

const DEFAULT_GAP = { race: 5, between: 10 };
const PER_YEAR = { between: true, offseason: true };

export function statVal(s, k) {
  return k === 'overall' ? overall(s.driver.stats) : s.driver.stats[k];
}

function refLevel(s) {
  if (s.stage === 'prologue') return 40;
  return SINFO[s.season?.series || s.career.series].ref;
}

export function chanceOf(s, ch) {
  if (ch.p != null) return ch.p;
  if (!ch.stat) return 100;
  return clamp(Math.round(ch.base + (statVal(s, ch.stat) - refLevel(s)) * 1.3), 5, 95);
}

export function choicesOf(ev, s, c) {
  return val(ev.choices, s, c);
}

function cooldownOk(s, e) {
  const seen = s.seen[e.id];
  if (!seen) return true;
  if (e.once) return false;
  if ((e.perYear ?? PER_YEAR[e.phase]) && seen.yr === s.year) return false;
  const gap = e.gap ?? DEFAULT_GAP[e.phase] ?? 0;
  return s.raceIdx - seen.at >= gap;
}

export function eligible(s, phase, c) {
  const series = c.series || s.career.series;
  return Object.values(EVENTS).filter((e) => {
    if (e.phase !== phase) return false;
    if (e.series && !e.series.includes(series)) return false;
    if (phase === 'race' && !!e.dnfOnly !== !!c.pdnf) return false;
    if (!cooldownOk(s, e)) return false;
    try {
      return !e.when || e.when(s, c);
    } catch {
      return false;
    }
  });
}

export function pickEvent(s, r, phase, c) {
  const list = eligible(s, phase, c).filter((e) => val(e.w ?? 1, s, c) > 0);
  if (!list.length) return null;
  return r.weighted(list, (e) => val(e.w ?? 1, s, c));
}

export function present(s, ev, c, after = null) {
  const choices = choicesOf(ev, s, c).map((ch) => ({
    label: val(ch.label, s, c),
    hint: val(ch.hint, s, c) || null,
    chance: chanceOf(s, ch),
    stat: ch.stat ? STAT_LABEL[ch.stat] : null,
    risky: !!ch.risky,
  }));
  const entry = pushFeed(s, {
    k: 'event',
    phase: ev.phase,
    title: val(ev.title, s, c),
    text: val(ev.text, s, c),
    radio: val(ev.radio, s, c) || null,
    eng: c.eng || null,
    color: c.color || null,
    choices,
    picked: null,
  });
  s.pending = { id: ev.id, c, after, n: entry.n };
  const seen = s.seen[ev.id] || { n: 0 };
  s.seen[ev.id] = { n: seen.n + 1, at: s.raceIdx, yr: s.year };
}

export function presentById(s, id, c, after) {
  present(s, EVENTS[id], c, after);
}

// Resolve the pending decision. Returns what should happen next.
export function resolve(s, r, i) {
  const p = s.pending;
  const ev = EVENTS[p.id];
  const choices = choicesOf(ev, s, p.c);
  const ch = choices[i] || choices[choices.length - 1];
  const entry = s.feed.find((e) => e.n === p.n);
  const chance = entry?.choices[i]?.chance ?? chanceOf(s, ch);
  const ok = chance >= 100 || r.next() * 100 < chance;
  const branch = ok ? ch.ok : ch.ko || ch.ok;
  const text = val(branch.text, s, p.c);
  const fx = val(branch.fx, s, p.c) || {};
  s.pending = null;
  const notes = applyFx(s, fx, p.c);
  if (entry) {
    entry.picked = i;
    entry.ok = ok;
    entry.rolled = chance < 100;
    entry.out = text;
    entry.notes = notes;
  }
  return p.after;
}

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

export function applyFx(s, fx, c = {}) {
  const d = s.driver;
  const notes = [];
  if (fx.stats) {
    for (const [k, v] of Object.entries(fx.stats)) {
      d.stats[k] = clamp(d.stats[k] + v, 1, 99);
      notes.push({ t: `${sign(v)} ${STAT_LABEL[k]}`, good: v > 0 });
    }
  }
  if (fx.fame) {
    d.fame = clamp(d.fame + fx.fame, 0, 100);
    notes.push({ t: `${sign(fx.fame)} Fame`, good: fx.fame > 0 });
  }
  if (fx.money) {
    d.money = Math.max(0, d.money + fx.money);
    notes.push({ t: `${fx.money > 0 ? '+' : '-'}${money(Math.abs(fx.money))}`, good: fx.money > 0 });
  }
  if (fx.teamRel) {
    d.teamRel = clamp(d.teamRel + fx.teamRel, 0, 100);
    notes.push({ t: `${sign(fx.teamRel)} Team trust`, good: fx.teamRel > 0 });
  }
  for (const f of [].concat(fx.flag || [])) s.flags[f] = s.year;
  if (fx.ach) unlock(s, fx.ach);
  if (fx.asset) d.assets.push({ ...fx.asset });
  if (fx.injury) {
    d.injured = Math.max(d.injured, fx.injury);
    notes.push({ t: `Injured: out for ${fx.injury} ${fx.injury === 1 ? 'race' : 'races'}`, good: false });
  }
  if (fx.academy !== undefined) d.academy = fx.academy;
  if (fx.training) d.training = fx.training;
  if (fx.signFor) s.flags.signFor = fx.signFor;
  if (fx.carPerf && s.career.team && s.teams[s.career.team]) {
    s.teams[s.career.team].perf = clamp(s.teams[s.career.team].perf + fx.carPerf, 60, 99);
    notes.push({ t: 'Car upgraded', good: true });
  }
  if (fx.salaryUp && s.career.contract) {
    s.career.contract.salary = Math.round(s.career.contract.salary * (1 + fx.salaryUp));
    notes.push({ t: `Salary now ${money(s.career.contract.salary)}`, good: true });
  }
  if (fx.extend && s.career.contract) {
    s.career.contract.years += fx.extend;
    notes.push({ t: `Contract +${fx.extend} years`, good: true });
  }
  const race = s.season?.race;
  const pe = race?.entries.find((e) => e.id === 'P');
  if (pe) {
    if (fx.mod) pe.mod += fx.mod;
    if (fx.qmod) pe.qmod += fx.qmod;
    if (fx.gain) pe.gain += fx.gain;
    if (fx.lose) pe.gain -= fx.lose;
    if (fx.saveDnf) {
      pe.dnf = false;
      pe.dnfWhy = null;
    }
    if (fx.dnf) {
      pe.dnf = true;
      pe.dnfWhy = 'event';
      pe.dnfLap = c.lap || 1;
    }
  }
  return notes;
}
