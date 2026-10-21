// localStorage wrapper. Every read and write is guarded: private windows and
// blocked storage must never break the game, they just stop remembering.
import { GAME } from './config.js';

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

  settings: () => ({ anim: reducedMotion() ? 'off' : 'full', ...get('settings', {}) }),
  saveSettings: (v) => set('settings', v),

  supporter: () => get('supporter', false),
  setSupporter: (v) => set('supporter', v),

  lastNudge: () => get('nudgeAt', 0),
  setNudge: () => set('nudgeAt', Date.now()),

  dailyDone: () => get('daily', {}),
  markDaily(date) {
    const d = get('daily', {});
    d[date] = true;
    set('daily', d);
  },

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
  }),
  importAll(data) {
    if (!data || data.app !== 'lights-out') throw new Error('This file is not a Lights Out backup.');
    if (data.save) set('save', data.save);
    if (Array.isArray(data.lives)) set('lives', data.lives);
    if (Array.isArray(data.ach)) set('ach', [...new Set([...get('ach', []), ...data.ach])]);
    if (data.settings) set('settings', data.settings);
    if (data.supporter) set('supporter', true);
    if (data.daily) set('daily', { ...get('daily', {}), ...data.daily });
  },
};
