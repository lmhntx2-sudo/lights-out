import { isZh } from '../i18n.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const trim = (x) => x.replace(/\.?0+$/, '');

// Chinese counts money in 萬 (ten thousand) and 億 (a hundred million).
function moneyZh(sign, a) {
  if (a >= 1e8) return `${sign}$${trim((a / 1e8).toFixed(a >= 1e9 ? 1 : 2))}億`;
  if (a >= 1e5) return `${sign}$${Math.round(a / 1e4)}萬`;
  if (a >= 1e4) return `${sign}$${trim((a / 1e4).toFixed(1))}萬`;
  return `${sign}$${Math.round(a)}`;
}

export function money(n) {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (isZh()) return moneyZh(sign, a);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e7) return `${sign}$${Math.round(a / 1e6)}M`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  return `${sign}$${Math.round(a)}`;
}

// Measure words for counts in Chinese, keyed by the English singular.
const ZH_UNITS = {
  win: '場勝利',
  point: '分',
  year: '年',
  race: '場',
  title: '屆冠軍',
  'world title': '屆世界冠軍',
  start: '場出賽',
  podium: '次登台',
  'junior win': '場青年組勝利',
};

export const plural = (n, one, many = one + 's') => {
  if (isZh() && ZH_UNITS[one]) return `${n} ${ZH_UNITS[one]}`;
  return `${n} ${n === 1 ? one : many}`;
};

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function stars(n, max = 5) {
  const k = clamp(Math.round(n), 0, max);
  return '★'.repeat(k) + '☆'.repeat(max - k);
}

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
