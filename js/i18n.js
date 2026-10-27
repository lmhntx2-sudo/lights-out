// Languages. English is the source text and the key; Traditional Chinese
// (繁體中文) is written for Hong Kong and Taiwan players.
//
//   t('Hall of fame')                    '名人堂'
//   t('Goal for {date}: ', { date })     placeholders go in braces
//   tn('You finish {pos}.', { pos: h('b', null, 'P3') })
//                                        a list of strings and nodes, for h()
//
// The engine writes story text into the save once, in whatever language is
// active at that moment. Only words depend on the language, never the game.
import { ZH } from './lang/zh.js';
import { ZD } from './lang/zh.data.js';
import { STAT_LABEL, STAT_HINT, SINFO, STYLES, BACKGROUNDS, TRAINING } from './engine/constants.js';

export const LANGS = [
  ['en', 'English'],
  ['zh', '繁體中文'],
];

let lang = 'en';
// Place names differ between Hong Kong and Taiwan (意大利 or 義大利), so the
// browser's region picks the spelling.
let variant = 'hk';

export const getLang = () => lang;
export const isZh = () => lang === 'zh';
export const htmlLang = () => (lang === 'zh' ? (variant === 'tw' ? 'zh-Hant-TW' : 'zh-Hant-HK') : 'en');

export function setLang(l, v) {
  lang = l === 'zh' ? 'zh' : 'en';
  if (v) variant = v === 'tw' ? 'tw' : 'hk';
}

// 繁體中文 for zh-HK, zh-TW, zh-MO and zh-Hant browsers, English for everyone else.
export function detectLang(primary = '', all = []) {
  const list = [primary, ...all].map((x) => String(x || '').toLowerCase());
  const region = list.map((x) => /^zh-(?:hant-)?(hk|tw|mo)\b/.exec(x)?.[1]).find(Boolean);
  return {
    lang: /^zh-(hk|tw|mo|hant)/.test(list[0]) ? 'zh' : 'en',
    variant: region ? (region === 'tw' ? 'tw' : 'hk') : list[0].startsWith('zh-hant') ? 'tw' : 'hk',
  };
}

const pick = (v) => (v && typeof v === 'object' ? v[variant] ?? v.hk : v);

function fill(tpl, vars) {
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
}

function template(en) {
  if (lang !== 'zh') return en;
  const z = ZH[en];
  return z == null ? en : z;
}

export function t(en, vars) {
  const tpl = template(en);
  return typeof tpl === 'function' ? tpl(vars || {}) : fill(tpl, vars);
}

// Sentences side by side: a space between them in English, none after a Chinese full stop.
export const cat = (...parts) => parts.filter(Boolean).join(lang === 'zh' ? '' : ' ');

// Like t(), but placeholders may be DOM nodes. Returns a list to pass to h().
export function tn(en, vars = {}) {
  const tpl = template(en);
  const s = typeof tpl === 'function' ? tpl(vars) : tpl;
  return s
    .split(/(\{\w+\})/)
    .filter((x) => x !== '')
    .map((x) => {
      const m = /^\{(\w+)\}$/.exec(x);
      return m && vars[m[1]] != null ? vars[m[1]] : x;
    });
}

// A localised field of game data, falling back to the English value.
export function loc(kind, id, field, en) {
  if (lang !== 'zh') return en;
  const row = ZD[kind]?.[id];
  const v = field ? row?.[field] : row;
  return v == null ? en : pick(v);
}

export const statName = (k) => loc('stat', k, null, STAT_LABEL[k]);
export const statHint = (k) => loc('statHint', k, null, STAT_HINT[k]);
export const seriesName = (id) => loc('series', id, null, SINFO[id]?.name || id);
export const styleName = (id) => loc('style', id, 'name', STYLES[id]?.name);
export const styleDesc = (id) => loc('style', id, 'desc', STYLES[id]?.desc);
export const bgText = (id, field) => loc('bg', id, field, BACKGROUNDS[id]?.[field]);
export const trainingText = (id, field) => loc('training', id, field, TRAINING[id]?.[field]);

// Tracks and nations are passed in whole (or by id with an English fallback).
export const trackName = (tr) => (tr ? loc('track', tr.id, 'name', tr.name) : '');
export const trackShort = (tr) => (tr ? loc('track', tr.id, 'short', tr.short) : '');
export const trackPlace = (tr) => (tr ? loc('track', tr.id, 'place', tr.place) : '');
export const trackShortById = (id, en) => loc('track', id, 'short', en);
export const trackPlaceById = (id, en) => loc('track', id, 'place', en);
export const natName = (n) => (n ? loc('nation', n.id, null, n.name) : '');

// Two real Macau Grand Prix winners (1983 and 1990), spelled the local way.
export const macauGreats = () => ({ senna: loc('person', 'senna', null, 'Senna'), schumacher: loc('person', 'schumacher', null, 'Schumacher') });
