// Numbering of the daily season, with nothing else attached, so the link
// previews on the server can use it without loading the game.

// Day 1 of the daily season. The number in "Daily #12" counts from here.
const FIRST_DAY = Date.UTC(2026, 10, 14);

export function dayNumber(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - FIRST_DAY) / 86400000) + 1;
}

export const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
