// Anonymous play counter. Tells /api/stats when the game is opened, when a
// career starts and when one finishes, so we know how many people play. Each
// event carries a random id made in this browser, so the server counts people
// instead of page loads; nothing else about the player is sent. Browsers that
// ask not to be tracked (Global Privacy Control, Do Not Track) send nothing.
// Fire and forget: it never shows an error and never holds up the game.
import { store } from './store.js';

const API = '/api/stats';
let cached = null;

function optedOut() {
  try {
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  } catch {
    return false;
  }
}

function newId() {
  try {
    if (crypto.randomUUID) return crypto.randomUUID();
    return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

// Kept in localStorage so a returning player counts once. If storage is blocked
// it still lasts for this visit.
function playerId() {
  if (!cached) cached = store.statsId() || null;
  if (!cached) {
    cached = newId();
    if (cached) store.setStatsId(cached);
  }
  return cached;
}

// e: 'open' | 'start' | 'finish'
export function ping(e) {
  try {
    if (optedOut()) return;
    const id = playerId();
    if (!id) return;
    const body = JSON.stringify({ e, id });
    if (navigator.sendBeacon?.(API, body)) return;
    fetch(API, { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // counting must never break the game
  }
}
