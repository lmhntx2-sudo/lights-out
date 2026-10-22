// Display names for the global leaderboard. Shared by the browser (instant
// feedback) and the leaderboard function (the check that counts). The word
// blocklist lives only on the server, in netlify/lib/blocklist.mjs.

export const NAME_MIN = 2;
export const NAME_MAX = 20;

// Letters from any script (each may carry up to two accents), digits, spaces
// and a little punctuation. No emoji, symbols or invisible characters.
const ALLOWED = /^(?:[\p{L}\p{N}]\p{M}{0,2}|[ .,'’\-_!?&()])+$/u;
const HAS_WORD = /[\p{L}\p{N}]/u;

export function checkDisplayName(raw, { max = NAME_MAX } = {}) {
  const name = String(raw ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
  const len = [...name].length;
  if (len < NAME_MIN) return { ok: false, name, error: `Use at least ${NAME_MIN} characters.` };
  if (len > max) return { ok: false, name, error: `Use at most ${max} characters.` };
  if (!ALLOWED.test(name) || !HAS_WORD.test(name)) return { ok: false, name, error: 'Use letters, numbers, spaces and basic punctuation only.' };
  return { ok: true, name, error: null };
}
