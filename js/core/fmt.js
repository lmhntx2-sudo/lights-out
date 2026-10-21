export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function money(n) {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e7) return `${sign}$${Math.round(a / 1e6)}M`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  return `${sign}$${Math.round(a)}`;
}

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

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
