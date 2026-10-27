// Small helpers shared by the engine and the event scripts.

export const val = (x, s, c) => (typeof x === 'function' ? x(s, c) : x);

// Scale an F1-sized cheque down to junior-formula money.
export function pay(s, f1Amount) {
  const k = { F1: 1, F2: 0.08, F3: 0.04, F4: 0.02 }[s.career?.series] ?? 0.02;
  return Math.round((f1Amount * k) / 1000) * 1000;
}

// The content version a career started with (see CONTENT_VERSION).
export const contentVersion = (s) => s.setup?.cv ?? 1;

export const firstName = (full) => String(full || '').split(' ')[0];

// Second-generation careers carry the parent's story in s.setup.legacy (see
// legacy.js). Ordinary careers have none, and nothing family-related ever runs for them.
export const legacyOf = (s) => s.setup?.legacy || null;

export function pushFeed(s, entry) {
  entry.n = ++s.fn;
  entry.yr = s.year;
  s.feed.push(entry);
  if (s.feed.length > 260) s.feed.splice(0, s.feed.length - 260);
  return entry;
}

export const story = (s, text, extra = {}) => pushFeed(s, { k: 'story', text, ...extra });
