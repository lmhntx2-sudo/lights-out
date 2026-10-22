// Netlify Function for the global leaderboard at /api/leaderboard.
// All the logic is in netlify/lib/leaderboard.mjs; this wires in Netlify Blobs,
// the caller's IP and CDN cache purging.
import { getStore } from '@netlify/blobs';
import { purgeCache } from '@netlify/functions';
import { handleLeaderboard } from '../lib/leaderboard.mjs';

const env = (k) => globalThis.Netlify?.env.get(k) ?? process.env[k];

// Production has its own store. Deploy previews, branch deploys and `netlify dev`
// each get a separate one, so testing never touches the real board.
function storeName(context) {
  const where = context?.deploy?.context;
  return !where || where === 'production' ? 'leaderboard' : `leaderboard-${where}`;
}

export default async (req, context) => {
  const store = getStore({ name: storeName(context), consistency: 'strong' });
  return handleLeaderboard(req, {
    store,
    ip: context?.ip,
    salt: env('LEADERBOARD_SALT'),
    purge: async (tags) => {
      try {
        await purgeCache({ tags });
      } catch (e) {
        // Purging only works on a deployed site; the cache expires in 30 seconds anyway.
        console.warn('Cache purge skipped:', e.message);
      }
    },
  });
};

export const config = {
  path: '/api/leaderboard',
  method: ['GET', 'POST'],
};
