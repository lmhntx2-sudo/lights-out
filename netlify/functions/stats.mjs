// Netlify Function for the anonymous play counter at /api/stats.
// All the logic is in netlify/lib/stats.mjs; this wires in Netlify Blobs and
// the caller's IP (used only, hashed, for rate limiting).
import { getStore } from '@netlify/blobs';
import { handleStats } from '../lib/stats.mjs';

const env = (k) => globalThis.Netlify?.env.get(k) ?? process.env[k];

// Production counts real players. Deploy previews, branch deploys and local runs
// each get their own store, so testing never adds to the real numbers.
function storeName(context) {
  const where = context?.deploy?.context;
  return !where || where === 'production' ? 'stats' : `stats-${where}`;
}

export default async (req, context) => {
  const store = getStore({ name: storeName(context), consistency: 'strong' });
  return handleStats(req, { store, ip: context?.ip, salt: env('STATS_SALT') || env('LEADERBOARD_SALT') });
};

export const config = {
  path: '/api/stats',
  method: ['GET', 'POST'],
};
