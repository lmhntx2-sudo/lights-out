// "Beat my score" links. A shared link can carry the sender's result, so the
// friend who opens it gets a target and a head-to-head at the end:
//   ?seed=abc123&vs=12340~3~41~Freddie%20Lockhart      a career: score, titles, wins, name
//   ?daily=2026-11-14&vs=86~7~Freddie%20Lockhart       a daily season: points, position, name
// It is only ever shown as text. Nothing in it is trusted or sent to the server.

const num = (v, hi) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= hi ? n : null;
};

// Control characters and angle brackets never belong in a name on screen.
const cleanName = (v) => String(v || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 40);

export function careerVs(sum) {
  return [sum.score, sum.f1.titles, sum.f1.wins, cleanName(sum.name)].join('~');
}

export function dayVs(sum) {
  return [sum.day.pts, sum.day.pos, cleanName(sum.name)].join('~');
}

// Returns { kind: 'career', score, titles, wins, name } or { kind: 'day', date, pts, pos, name }, or null.
export function parseVs(raw, date) {
  if (typeof raw !== 'string' || !raw || raw.length > 120) return null;
  const parts = raw.split('~');
  if (date) {
    if (parts.length < 3) return null;
    const pts = num(parts[0], 2000);
    const pos = num(parts[1], 30);
    const name = cleanName(parts.slice(2).join('~'));
    return pts == null || pos == null || !name ? null : { kind: 'day', date, pts, pos, name };
  }
  if (parts.length < 4) return null;
  const score = num(parts[0], 1e7);
  const titles = num(parts[1], 60);
  const wins = num(parts[2], 2000);
  const name = cleanName(parts.slice(3).join('~'));
  return score == null || titles == null || wins == null || !name ? null : { kind: 'career', score, titles, wins, name };
}
