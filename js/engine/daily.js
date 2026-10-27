// One shared career a day: same seed, same driver, same goal for everyone.
import { hashSeed, Rng } from '../core/rng.js';
import { NATIONS } from '../data/nations.js';
import { STYLES, BACKGROUNDS } from './constants.js';
import { netWorth, unlock } from './achievements.js';
import { pushFeed } from './helpers.js';
import { t, loc } from '../i18n.js';

export const DAILY_GOALS = [
  { id: 'f1win', text: 'Win a Formula 1 race.', test: (s) => s.career.tot.F1.wins >= 1 },
  { id: 'young', text: 'Start a Formula 1 race before turning 20.', test: (s) => s.career.rookieAge != null && s.career.rookieAge < 20 },
  { id: 'jrtitle', text: 'Win a junior formula title.', test: (s) => s.career.tot.junior.titles >= 1 },
  { id: 'title', text: 'Become world champion.', test: (s) => s.career.tot.F1.titles >= 1 },
  { id: 'podiums', text: 'Score ten Formula 1 podiums.', test: (s) => s.career.tot.F1.podiums >= 10 },
  { id: 'rich', text: 'Reach a net worth of $50M.', test: (s) => netWorth(s) >= 5e7 },
  { id: 'points', text: 'Score 500 Formula 1 points.', test: (s) => s.career.tot.F1.points >= 500 },
  { id: 'rossa', text: 'Drive for Scuderia Rossa.', test: (s) => s.career.f1Teams.includes('rossa') },
];

// The goal in the current language, from its id (saves keep the English text too).
export const dailyGoalText = (id, fallback) => loc('daily', id, null, DAILY_GOALS.find((g) => g.id === id)?.text ?? fallback);

export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Nationalities added later stay out, so the pick for any date never changes.
const DAILY_NATIONS = NATIONS.filter((n) => !n.cv);

export function dailySetup(dateKey) {
  const h = { rng: hashSeed(`daily-${dateKey}`) };
  const r = new Rng(h);
  const goal = r.pick(DAILY_GOALS);
  return {
    date: dateKey,
    seed: `daily-${dateKey}`,
    nat: r.pick(DAILY_NATIONS).id,
    style: r.pick(Object.keys(STYLES)),
    bg: r.pick(Object.keys(BACKGROUNDS)),
    goal: goal.id,
    goalText: goal.text,
  };
}

export function checkDaily(s) {
  if (!s.daily || s.daily.done) return;
  const g = DAILY_GOALS.find((x) => x.id === s.daily.goal);
  if (g && g.test(s)) {
    s.daily.done = true;
    pushFeed(s, { k: 'mile', icon: '📅', title: t('Daily challenge complete'), text: dailyGoalText(g.id, g.text), tone: 'purple' });
    unlock(s, 'daily');
  }
}
