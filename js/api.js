// The global leaderboard, the only part of the game that needs the internet.
// Nothing calls it on its own: every request comes from a button, and any
// failure comes back as one plain sentence to show the player.
const API = '/api/leaderboard';

async function call(url, opts = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('You are offline. Connect to the internet to use the global leaderboard.');
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  let res;
  try {
    res = await fetch(url, { ...opts, signal: ctl.signal });
  } catch {
    throw new Error('Could not reach the global leaderboard. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    // not JSON: the function is missing or something in between failed
  }
  if (!res.ok || !body || body.error) throw new Error(body?.error || 'The global leaderboard is not available right now. Try again later.');
  return body;
}

// board: 'all' or 'daily' (with date YYYY-MM-DD)
export const fetchBoard = (board, date) => call(`${API}?board=${board}${date ? `&date=${encodeURIComponent(date)}` : ''}`);

// Careers started before the leaderboard existed have no log to verify.
export const canSubmit = (s) => !!(s?.retired && s.setup && Array.isArray(s.log) && s.log.length);

export function submitCareer(s, displayName) {
  return call(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setup: s.setup, actions: s.log, displayName, score: s.retired.score }),
  });
}
