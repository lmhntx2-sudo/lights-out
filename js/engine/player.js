import { STATS, STYLES, BACKGROUNDS, TRAINING } from './constants.js';
import { driverCode } from '../data/names.js';
import { clamp } from '../core/fmt.js';

export function overall(st) {
  return st.pace * 0.3 + st.racecraft * 0.2 + st.consistency * 0.2 + st.composure * 0.12 + st.technical * 0.06 + st.wet * 0.12;
}

export function createPlayer(setup, r) {
  const bg = BACKGROUNDS[setup.bg];
  const style = STYLES[setup.style];
  const pot = r.range(bg.pot[0], bg.pot[1]);
  const stats = {};
  const caps = {};
  for (const k of STATS) {
    const bias = style.bias[k] || 0;
    const bonus = bg.bonus[k] || 0;
    stats[k] = clamp(bg.base + r.normal(0, 2.2) + bias + bonus - (k === 'wet' ? 4 : 0), 20, 75);
    caps[k] = clamp(pot + bias * 0.5 + bonus * 0.3 + r.normal(0, 2), 50, 99);
  }
  const first = setup.first.trim();
  const last = setup.last.trim();
  const num = Math.round(Number(setup.number));
  // Chinese, Japanese and Korean names read family name first, with no space.
  // They also have no letters for a three-letter code, so the code is the name itself.
  const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(first + last);
  const code = cjk && !/[a-z]/i.test(first + last) ? [...`${last}${first}`].slice(0, 3).join('') : driverCode(last || first);
  return {
    first, last, name: cjk ? `${last}${first}` : `${first} ${last}`.trim(), code,
    number: num >= 2 && num <= 99 ? num : r.int(2, 99),
    nat: setup.nat, style: setup.style, bg: setup.bg, helmet: setup.helmet,
    age: 15, stats, caps, pot,
    fame: bg.fame, money: bg.money, teamRel: 60,
    assets: [], injured: 0, academy: null, training: 'sim',
  };
}

export function playerRatings(s, wet) {
  const st = s.driver.stats;
  let q = st.pace * 0.6 + st.consistency * 0.1 + st.composure * 0.15 + st.technical * 0.15;
  let rr = st.pace * 0.3 + st.racecraft * 0.3 + st.consistency * 0.25 + st.composure * 0.15;
  if (wet) {
    q = q * 0.45 + st.wet * 0.55;
    rr = rr * 0.45 + st.wet * 0.55;
  }
  return { q, r: rr };
}

export const ovr = (s) => Math.round(overall(s.driver.stats));

// The reigning champion may run #1 for a season.
export const raceNumber = (s) => (s.flags.useOne === s.year ? 1 : s.driver.number ?? 7);

// End-of-season development. Returns rounded stat changes for the summary.
export function growPlayer(s, r) {
  const d = s.driver;
  const age = d.age;
  const f = age <= 18 ? 0.19 : age <= 21 ? 0.21 : age <= 24 ? 0.2 : age <= 27 ? 0.16 : age <= 30 ? 0.08 : age <= 31 ? 0.03 : 0;
  const focus = TRAINING[d.training]?.stats || [];
  const deltas = {};
  for (const k of STATS) {
    const v = d.stats[k];
    const room = d.caps[k] - v;
    let g = room > 0 ? room * f * (focus.includes(k) ? 1.45 : 1) + r.normal(0, 0.5) : Math.min(0, room * 0.15);
    if (age >= 31) {
      const physical = k === 'pace' || k === 'consistency' || k === 'racecraft' || k === 'wet';
      g = physical ? -(age - 30) * r.range(0.35, 0.8) : r.range(0, 0.4);
    }
    const nv = clamp(v + g, 1, 99);
    d.stats[k] = nv;
    const dr = Math.round(nv) - Math.round(v);
    if (dr) deltas[k] = dr;
  }
  return deltas;
}

export function developAI(d, r) {
  const a = d.age;
  let g;
  if (a <= 24) g = (d.pot - d.skill) * 0.3;
  else if (a <= 28) g = (d.pot - d.skill) * 0.2;
  else if (a <= 31) g = 0;
  else g = -(a - 31) * r.range(0.3, 0.8);
  d.skill = Math.round(clamp(d.skill + g + r.normal(0, 0.8), 20, 97) * 10) / 10;
}
