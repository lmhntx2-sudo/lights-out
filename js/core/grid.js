// Custom grid: a player's own names for the eleven Formula 1 teams. They live
// on the player's device, are copied into a career when it starts, and travel
// between friends as a code in a link (?grid=...). Names only: colours, cars,
// pace and everything the server replays stay as shipped, so a custom grid
// never changes how a career plays out or what the leaderboard sees.
import { F1_TEAMS } from '../data/teams.js';
import { checkDisplayName } from './displayname.js';

export const GRID_NAME_MAX = 24;
export const GRID_SHORT_MAX = 12;
const CODE_MAX = 2000;

const firstWord = (name) => [...name.split(' ')[0]].slice(0, GRID_SHORT_MAX).join('');

// Keeps only known teams with acceptable names that differ from the shipped
// ones. A missing or bad short name falls back to the first word of the name.
export function cleanGrid(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const team of F1_TEAMS) {
    const e = raw[team.id];
    if (!e || typeof e !== 'object') continue;
    const n = checkDisplayName(e.name, { max: GRID_NAME_MAX });
    if (!n.ok) continue;
    let sh = checkDisplayName(e.short, { max: GRID_SHORT_MAX });
    if (!sh.ok) sh = checkDisplayName(firstWord(n.name), { max: GRID_SHORT_MAX });
    const short = sh.ok ? sh.name : team.short;
    if (n.name === team.name && short === team.short) continue;
    out[team.id] = { name: n.name, short };
  }
  return out;
}

export const gridSize = (grid) => Object.keys(cleanGrid(grid)).length;

function toB64url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// One slot per team in shipped order: 0 when unchanged, else [name, short].
export function encodeGrid(grid) {
  const g = cleanGrid(grid);
  if (!Object.keys(g).length) return '';
  const slots = F1_TEAMS.map((t) => (g[t.id] ? [g[t.id].name, g[t.id].short] : 0));
  while (slots.length && slots[slots.length - 1] === 0) slots.pop();
  return toB64url(JSON.stringify(slots));
}

// Returns the grid in a code, or null if the code is not one.
export function decodeGrid(code) {
  if (typeof code !== 'string' || !code || code.length > CODE_MAX || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const slots = JSON.parse(fromB64url(code));
    if (!Array.isArray(slots) || slots.length > F1_TEAMS.length) return null;
    const raw = {};
    slots.forEach((e, i) => {
      if (Array.isArray(e)) raw[F1_TEAMS[i].id] = { name: e[0], short: e[1] };
    });
    const g = cleanGrid(raw);
    return Object.keys(g).length ? g : null;
  } catch {
    return null;
  }
}

// Puts the names into a career's teams. Call it once, when the career starts.
export function applyGrid(s, grid) {
  const g = cleanGrid(grid);
  for (const [id, e] of Object.entries(g)) {
    if (s.teams?.[id]) {
      s.teams[id].name = e.name;
      s.teams[id].short = e.short;
    }
  }
  return s;
}
