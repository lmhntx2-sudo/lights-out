// Picking, presenting and resolving decision moments.
import { EVENTS } from './events.js';
import { EVENTS_ZH } from './events.zh.js';
import { SINFO } from './constants.js';
import { isZh, statName, t as tr } from '../i18n.js';
import { val, pushFeed } from './helpers.js';
import { overall } from './player.js';
import { unlock } from './achievements.js';
import { clamp, money, plural } from '../core/fmt.js';

const DEFAULT_GAP = { race: 5, between: 10 };
const MOD_SCALE = { F1: 0.55, F2: 0.8, F3: 0.85, F4: 0.9 };
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
  return clamp(Math.round(ch.base + (statVal(s, ch.stat) - refLevel(s)) * 1.1), 5, 95);
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

// Which wording of an event to show: 0 is its own text, 1.. its variants.
// The first time is always the original; after that the wordings that fit the
// moment take turns, starting after the one used last time (s.seen[id].v).
// Only the context and s.seen are read, never the RNG, so both languages and a
// replay always land on the same wording.
export function wordingOf(s, ev, c) {
  if (!ev.variants?.length) return 0;
  const fits = [0];
  ev.variants.forEach((v, i) => {
    try {
      if (!v.when || v.when(s, c)) fits.push(i + 1);
    } catch {
      // a variant that can't read the context just sits this one out
    }
  });
  const last = s.seen[ev.id]?.v ?? -1;
  return fits.find((k) => k > last) ?? fits[0];
}

// The words for an event in the current language and wording, most specific
// first. A translation or variant only ever replaces text: choices, odds and
// outcomes always come from the event itself in events.js.
function wordsOf(ev, k) {
  const z = isZh() ? EVENTS_ZH[ev.id] : null;
  const pick = (w) => (k ? w?.variants?.[k - 1] : null);
  return (z ? [pick(z), z] : [pick(ev)]).filter(Boolean);
}

const field = (layers, key, s, c) => {
  const w = layers.find((l) => l[key] != null);
  return w ? val(w[key], s, c) : undefined;
};

function choiceWords(layers, s, c) {
  return layers.map((l) => {
    try {
      return val(l.choices, s, c) || [];
    } catch {
      return [];
    }
  });
}

function render(ev, s, c, k) {
  const layers = wordsOf(ev, k);
  const lists = choiceWords(layers, s, c);
  const word = (i, key, ch) => {
    const l = lists.find((x) => x[i]?.[key] != null);
    return val(l ? l[i][key] : ch[key], s, c);
  };
  const choices = choicesOf(ev, s, c).map((ch, i) => ({
    label: word(i, 'label', ch),
    hint: word(i, 'hint', ch) || null,
    chance: chanceOf(s, ch),
    stat: ch.stat ? statName(ch.stat) : null,
    risky: !!ch.risky,
  }));
  return {
    title: field(layers, 'title', s, c) ?? val(ev.title, s, c),
    text: field(layers, 'text', s, c) ?? val(ev.text, s, c),
    radio: (field(layers, 'radio', s, c) ?? val(ev.radio, s, c)) || null,
    choices,
  };
}

export function present(s, ev, c, after = null) {
  const k = wordingOf(s, ev, c);
  const w = render(ev, s, c, k);
  const entry = pushFeed(s, {
    k: 'event',
    phase: ev.phase,
    title: w.title,
    text: w.text,
    radio: w.radio,
    banner: val(ev.banner, s, c) || null,
    eng: c.eng || null,
    color: c.color || null,
    choices: w.choices,
    picked: null,
  });
  s.pending = { id: ev.id, c, after, n: entry.n, v: k };
  const seen = s.seen[ev.id] || { n: 0 };
  s.seen[ev.id] = { n: seen.n + 1, at: s.raceIdx, yr: s.year };
  if (ev.variants?.length) s.seen[ev.id].v = k;
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
  const key = ok || !ch.ko ? 'ok' : 'ko';
  const idx = choices.indexOf(ch);
  const words = choiceWords(wordsOf(ev, p.v ?? 0), s, p.c).find((l) => l[idx]?.[key] != null);
  const text = val(words ? words[idx][key] : branch.text, s, p.c);
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

// After a language switch: rewrite the open decision in the new language.
// The odds shown stay exactly as they were.
export function relocalize(s) {
  const p = s.pending;
  const ev = p && EVENTS[p.id];
  const entry = ev && s.feed.find((e) => e.n === p.n);
  if (!entry) return;
  const w = render(ev, s, p.c, p.v ?? 0);
  entry.title = w.title;
  entry.text = w.text;
  entry.radio = w.radio;
  entry.choices = w.choices.map((ch, i) => ({ ...ch, chance: entry.choices[i]?.chance ?? ch.chance }));
}

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

export function applyFx(s, fx, c = {}) {
  const d = s.driver;
  const notes = [];
  if (fx.stats) {
    for (const [k, v] of Object.entries(fx.stats)) {
      // Past your natural ceiling, extra work only helps a little.
      const gain = v > 0 && d.stats[k] >= d.caps[k] ? v * 0.2 : v;
      d.stats[k] = clamp(d.stats[k] + gain, 1, 99);
      notes.push({ t: `${sign(v)} ${statName(k)}`, good: v > 0 });
    }
  }
  if (fx.fame) {
    d.fame = clamp(d.fame + fx.fame, 0, 100);
    notes.push({ t: tr('{n} Fame', { n: sign(fx.fame) }), good: fx.fame > 0 });
  }
  if (fx.money) {
    d.money = Math.max(0, d.money + fx.money);
    notes.push({ t: `${fx.money > 0 ? '+' : '-'}${money(Math.abs(fx.money))}`, good: fx.money > 0 });
  }
  if (fx.teamRel) {
    d.teamRel = clamp(d.teamRel + fx.teamRel, 0, 100);
    notes.push({ t: tr('{n} Team trust', { n: sign(fx.teamRel) }), good: fx.teamRel > 0 });
  }
  for (const f of [].concat(fx.flag || [])) s.flags[f] = s.year;
  if (fx.ach) unlock(s, fx.ach);
  if (fx.asset) d.assets.push({ ...fx.asset });
  if (fx.injury) {
    d.injured = Math.max(d.injured, fx.injury);
    notes.push({ t: tr('Injured: out for {races}', { races: plural(fx.injury, 'race') }), good: false });
  }
  if (fx.academy !== undefined) d.academy = fx.academy;
  if (fx.training) d.training = fx.training;
  if (fx.signFor) s.flags.signFor = fx.signFor;
  if (fx.carPerf && s.career.team && s.teams[s.career.team]) {
    s.teams[s.career.team].perf = clamp(s.teams[s.career.team].perf + fx.carPerf, 60, 99);
    notes.push({ t: tr('Car upgraded'), good: true });
  }
  if (fx.budget && s.career.team && s.teams[s.career.team]) {
    const t = s.teams[s.career.team];
    t.budget = clamp(t.budget + fx.budget, 0.5, 1);
    notes.push({ t: fx.budget > 0 ? tr('Team budget up') : tr('Team budget down'), good: fx.budget > 0 });
  }
  if (fx.useOne) s.flags.useOne = s.year;
  if (fx.salaryUp && s.career.contract) {
    s.career.contract.salary = Math.round(s.career.contract.salary * (1 + fx.salaryUp));
    notes.push({ t: tr('Salary now {money}', { money: money(s.career.contract.salary) }), good: true });
  }
  if (fx.extend && s.career.contract) {
    s.career.contract.years += fx.extend;
    notes.push({ t: tr('Contract +{n} years', { n: fx.extend }), good: true });
  }
  const race = s.season?.race;
  const pe = race?.entries.find((e) => e.id === 'P');
  if (pe) {
    // In F1 the car dominates, so a single call moves the needle less.
    const scale = MOD_SCALE[race.series] ?? 1;
    if (fx.mod) pe.mod += fx.mod * scale;
    if (fx.qmod) pe.qmod += fx.qmod * scale;
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
