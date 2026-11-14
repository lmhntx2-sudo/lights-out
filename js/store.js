// localStorage wrapper. Every read and write is guarded: private windows and
// blocked storage must never break the game, they just stop remembering.
import { GAME } from './config.js';
import { detectLang } from './i18n.js';

const P = GAME.storagePrefix;

function get(k, fallback) {
  try {
    const v = localStorage.getItem(P + k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function set(k, v) {
  try {
    localStorage.setItem(P + k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

function del(k) {
  try {
    localStorage.removeItem(P + k);
  } catch {
    // ignore
  }
}

const browserLang = () => {
  try {
    return detectLang(navigator.language, navigator.languages || []);
  } catch {
    return { lang: 'en', variant: 'hk' };
  }
};

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const store = {
  loadGame: () => get('save', null),
  saveGame: (s) => set('save', s),
  clearGame: () => del('save'),

  lives: () => get('lives', []),
  addLife(sum) {
    const lives = get('lives', []);
    lives.unshift(sum);
    set('lives', lives.slice(0, 60));
  },

  ach: () => new Set(get('ach', [])),
  addAch(ids) {
    const all = new Set(get('ach', []));
    const fresh = ids.filter((id) => !all.has(id));
    if (fresh.length) {
      fresh.forEach((id) => all.add(id));
      set('ach', [...all]);
    }
    return fresh;
  },

  // lang is 'en', 'zh', 'ja' or 'ko'. Until the player picks one, it follows the browser.
  settings: () => ({ anim: reducedMotion() ? 'off' : 'full', lang: browserLang().lang, ...get('settings', {}) }),
  langVariant: () => browserLang().variant,
  saveSettings: (v) => set('settings', v),

  supporter: () => get('supporter', false),
  setSupporter: (v) => set('supporter', v),

  lastNudge: () => get('nudgeAt', 0),
  setNudge: () => set('nudgeAt', Date.now()),

  // The daily season has its own save, so it never replaces a career in progress.
  loadDay: () => get('day', null),
  saveDay: (s) => set('day', s),
  // Finished daily seasons by date: { pos, pts, wins, met }.
  days: () => get('days', {}),
  markDay(day) {
    const all = get('days', {});
    all[day.date] = { pos: day.pos, pts: day.pts, wins: day.wins, met: !!day.met };
    const keep = Object.keys(all).sort().slice(-400);
    set('days', Object.fromEntries(keep.map((k) => [k, all[k]])));
  },
  // Days in a row with a finished daily season. Today counts once it is done;
  // until then the run up to yesterday still stands.
  streak(today) {
    const all = get('days', {});
    const back = (key) => new Date(Date.parse(`${key}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    let key = all[today] ? today : back(today);
    let n = 0;
    while (all[key]) {
      n++;
      key = back(key);
    }
    return n;
  },
  // The name, number and helmet used in the last daily season, to start the next one with.
  dayDriver: () => get('dayDriver', null),
  setDayDriver: (v) => set('dayDriver', v),

  dailyDone: () => get('daily', {}),
  markDaily(date) {
    const d = get('daily', {});
    d[date] = true;
    set('daily', d);
  },

  // Global leaderboard: the last display name used, and this browser's entries.
  boardName: () => get('boardName', ''),
  setBoardName: (v) => set('boardName', v),
  boardMine: () => new Set(get('boardMine', [])),
  addBoardMine(id) {
    const ids = get('boardMine', []).filter((x) => x !== id);
    ids.unshift(id);
    set('boardMine', ids.slice(0, 200));
  },

  // Random id for the anonymous play counter (see stats.js). Not in backups.
  statsId: () => get('statsId', ''),
  setStatsId: (v) => set('statsId', v),

  exportAll: () => ({
    app: 'lights-out',
    v: 1,
    at: new Date().toISOString(),
    save: get('save', null),
    lives: get('lives', []),
    ach: get('ach', []),
    settings: get('settings', {}),
    supporter: get('supporter', false),
    daily: get('daily', {}),
    days: get('days', {}),
    dayDriver: get('dayDriver', null),
  }),
  importAll(data) {
    if (!data || data.app !== 'lights-out') throw new Error('This file is not a Lights Out backup.');
    if (data.save) set('save', data.save);
    if (Array.isArray(data.lives)) set('lives', data.lives);
    if (Array.isArray(data.ach)) set('ach', [...new Set([...get('ach', []), ...data.ach])]);
    if (data.settings) set('settings', data.settings);
    if (data.supporter) set('supporter', true);
    if (data.daily) set('daily', { ...get('daily', {}), ...data.daily });
    if (data.days && typeof data.days === 'object') set('days', { ...get('days', {}), ...data.days });
    if (data.dayDriver) set('dayDriver', data.dayDriver);
  },
};
