// Rebuild a finished career from its setup and action log (s.setup, s.log).
// The engine is deterministic, so the same setup and the same calls give the
// same life. The global leaderboard replays every submission with this.
//
// Only calls the game's own buttons could have made are accepted: an action
// that the engine would ignore, a choice that isn't on screen, or a seat the
// driver can't afford is rejected rather than skipped.
import { newGame, prompt, advance, choose, pickOffer, retireNow } from './game.js';
import { cleanSeed } from '../core/rng.js';
import { NATIONS } from '../data/nations.js';
import { STYLES, BACKGROUNDS, START_YEAR, CONTENT_VERSION } from './constants.js';
import { dailySetup } from './daily.js';
import { TIERS, tierFromRecord, inheritance, MAX_GEN } from './legacy.js';

// A long career is about 1,500 calls; this leaves plenty of room.
export const MAX_ACTIONS = 12000;

export class ReplayError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new ReplayError(code, message);
};

const own = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);
const HEX = /^#[0-9a-f]{6}$/i;
const DAILY_SEED = /^daily-(\d{4}-\d{2}-\d{2})$/;

// Check a setup as the title screen builds it, and return a clean copy with only
// the fields newGame reads. Anything the title screen could not produce is refused.
export function validateSetup(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('setup', 'The career setup is missing.');
  const { seed, first, last, nat, style, bg, helmet, number, daily, legacy } = raw;
  // Careers from before content versions have no cv: they replay on version 1.
  const cv = raw.cv ?? 1;
  if (!Number.isInteger(cv) || cv < 1 || cv > CONTENT_VERSION) fail('setup', 'The content version is not valid.');
  if (typeof seed !== 'string' || !seed || cleanSeed(seed) !== seed) fail('setup', 'The world seed is not valid.');
  if (typeof first !== 'string' || typeof last !== 'string' || first.length > 30 || last.length > 30) fail('setup', 'The driver name is not valid.');
  if (!first.trim() && !last.trim()) fail('setup', 'The driver needs a name.');
  if (!NATIONS.some((n) => n.id === nat && (n.cv ?? 1) <= cv)) fail('setup', 'The nationality is not valid.');
  if (!own(STYLES, style)) fail('setup', 'The driving style is not valid.');
  if (!own(BACKGROUNDS, bg)) fail('setup', 'The background is not valid.');
  if (!helmet || !HEX.test(helmet.c1) || !HEX.test(helmet.c2)) fail('setup', 'The helmet colours are not valid.');
  if (!Number.isInteger(number) || number < 2 || number > 99) fail('setup', 'The race number is not valid.');

  // cv is always passed on, so newGame never mistakes an old career for a new one.
  const setup = { seed, first, last, nat, style, bg, helmet: { c1: helmet.c1, c2: helmet.c2 }, number, daily: null, cv };
  if (daily != null) {
    // A daily challenge has to be exactly the one the title screen hands out for
    // that date: same seed, driver and goal, and never already completed. The goal
    // text is only for display (and may be translated), so it isn't compared.
    const m = DAILY_SEED.exec(seed);
    const want = m && typeof daily === 'object' && daily.date === m[1] ? dailySetup(m[1]) : null;
    if (!want || nat !== want.nat || style !== want.style || bg !== want.bg || daily.goal !== want.goal) {
      fail('setup', 'This daily challenge does not match the one for its date.');
    }
    setup.daily = { date: want.date, goal: want.goal, goalText: want.goalText };
  }
  // Ordinary careers have no legacy key at all, so their setups stay byte for byte as they were.
  if (legacy != null) {
    if (setup.daily) fail('legacy', 'A daily challenge cannot be a second-generation career.');
    setup.legacy = validateLegacy(legacy, setup);
  }
  return setup;
}

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const name = (v) => typeof v === 'string' && v.length <= 30;

// A second-generation career: the parent's record, and what the kid inherits from
// it. The parent's career is not submitted, so this is a claim, but only one the
// title screen could make: every number is bounded, the record has to add up,
// and the background, money and fame must be exactly what the parent's net worth
// and tier hand down (legacy.js inheritance), which never beats a royalty start.
export function validateLegacy(raw, setup) {
  const bad = (what) => fail('legacy', `The family inheritance is not valid: ${what}.`);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad('it is not a record');
  const { gen, first, last, tier, titles, wins, podiums, poles, starts, worth, number, from, to, year, rival, money, fame } = raw;
  if (!int(gen, 2, MAX_GEN)) bad('generation');
  if (!name(first) || !name(last) || (!first.trim() && !last.trim())) bad('parent name');
  if (last !== setup.last) bad('the family name');
  if (!int(starts, 0, 1000) || !int(wins, 0, starts) || !int(podiums, wins, starts) || !int(poles, 0, starts) || !int(titles, 0, Math.min(50, starts))) bad('parent record');
  if (!own(TIERS, tier)) bad('tier');
  const rec = { titles, wins, podiums, starts };
  if (starts > 0 ? tier !== tierFromRecord(rec) : !['endurance', 'f2', 'junior'].includes(tier) || titles || wins || podiums || poles) bad('tier and record');
  if (!int(worth, 0, 1e11)) bad('net worth');
  if (!int(number, 2, 99)) bad('race number');
  if (!int(year, START_YEAR + 1, START_YEAR + 60 * (gen - 1))) bad('start year');
  if (!int(from, START_YEAR, year - 1) || !int(to, from, year - 1)) bad('era');
  let rv = null;
  if (rival != null) {
    if (typeof rival !== 'object' || !name(rival.first) || !name(rival.last) || !NATIONS.some((n) => n.id === rival.nat)) bad('rival');
    rv = { first: rival.first, last: rival.last, nat: rival.nat };
  }
  const inh = inheritance(worth, tier);
  if (setup.bg !== inh.bg) bad('background');
  if (money !== inh.money || fame !== inh.fame) bad('money or fame');
  return { gen, first, last, tier, titles, wins, podiums, poles, starts, worth, number, from, to, year, rival: rv, money, fame };
}

function step(s, a, k) {
  const m = typeof a === 'string' ? /^(?:(a|r)|(c|o)(\d{1,2}))$/.exec(a) : null;
  if (!m) fail('log', `Action ${k} is not a game action.`);
  if (s.stage === 'retired') fail('log', `Action ${k} comes after retirement.`);
  const kind = m[1] || m[2];
  const i = m[3] == null ? -1 : Number(m[3]);
  if (kind === 'a') {
    if (s.pending) fail('log', `Action ${k} skips a decision.`);
    return () => advance(s);
  }
  if (kind === 'c') {
    const p = prompt(s);
    if (p.type !== 'choice' || i >= p.choices.length) fail('log', `Action ${k} picks a choice that was not offered.`);
    return () => choose(s, i);
  }
  if (kind === 'o') {
    const o = !s.pending && s.stage === 'offers' ? s.offers?.[i] : null;
    if (!o) fail('log', `Action ${k} picks an offer that was not on the table.`);
    const priced = o.kind !== 'retire' && o.kind !== 'endurance';
    if (priced && o.cost && o.cost > s.driver.money) fail('log', `Action ${k} buys a seat the driver could not afford.`);
    return () => pickOffer(s, i);
  }
  return () => retireNow(s);
}

// Returns the retired career state. Throws ReplayError if the log is not a
// complete, legal career.
export function replayCareer(rawSetup, actions, { maxActions = MAX_ACTIONS } = {}) {
  const setup = validateSetup(rawSetup);
  if (!Array.isArray(actions) || !actions.length) fail('log', 'The career log is empty.');
  if (actions.length > maxActions) fail('log', `The career log is longer than ${maxActions} actions.`);
  const s = newGame(setup);
  for (let k = 0; k < actions.length; k++) {
    const run = step(s, actions[k], k);
    // The UI catches an engine error on one click and carries on from there,
    // so the replay does the same to stay in step with what the player saw.
    try {
      run();
    } catch {
      // keep going, exactly like the browser did
    }
  }
  if (s.stage !== 'retired' || !s.retired) fail('unfinished', 'The career has not ended in retirement yet.');
  return s;
}
