// Moderation for the global leaderboard: list the boards, remove an entry.
//
//   node tools/leaderboard-admin.mjs list                    the all-time board
//   node tools/leaderboard-admin.mjs list daily 2026-10-22   one day's board
//   node tools/leaderboard-admin.mjs remove <entry id>       take a career off every board for good
//
// For the live site, set NETLIFY_AUTH_TOKEN to a Netlify personal access token
// (User settings > Applications > Personal access tokens). Add --local to work on
// the data that `npm start` keeps in tmp/blobs instead.
import { getStore } from '@netlify/blobs';
import { KEYS, removeEntry } from '../netlify/lib/leaderboard.mjs';
import { startLocalBlobs, LOCAL_STORE } from './local-blobs.mjs';

// lights-out-racing
const SITE_ID = process.env.NETLIFY_SITE_ID || 'ed4244f5-cfd9-4fa1-b9ae-eccb6c92255a';

const args = process.argv.slice(2);
const local = args.includes('--local');
const [cmd, a, b] = args.filter((x) => x !== '--local');

if (!(cmd === 'list' && (!a || (a === 'daily' && b))) && !(cmd === 'remove' && a)) {
  console.log('Usage: node tools/leaderboard-admin.mjs list [daily YYYY-MM-DD] | remove <entry id>   [--local]');
  process.exit(1);
}

async function open() {
  if (local) {
    const blobs = await startLocalBlobs();
    return { store: getStore({ name: LOCAL_STORE, consistency: 'strong' }), stop: blobs.stop };
  }
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) {
    console.error('Set NETLIFY_AUTH_TOKEN to a Netlify personal access token, or add --local.');
    process.exit(1);
  }
  return { store: getStore({ name: 'leaderboard', siteID: SITE_ID, token }), stop: async () => {} };
}

const { store, stop } = await open();
try {
  if (cmd === 'list') {
    const key = a === 'daily' ? KEYS.daily(b) : KEYS.all;
    const board = await store.get(key, { type: 'json' });
    const rows = board?.entries || [];
    if (!rows.length) console.log('The board is empty.');
    rows.forEach((e, i) => {
      const goal = e.daily && a === 'daily' ? (e.daily.done ? ' [goal met]' : ' [goal missed]') : '';
      console.log(`${String(i + 1).padStart(3)}  ${e.id}  ${String(e.score).padStart(6)}  ${e.name}${e.driver ? ` (${e.driver})` : ''}${goal}  ${e.at.slice(0, 10)}`);
    });
  } else {
    console.log((await removeEntry(store, a)) ? `Removed ${a} from every board.` : `No entry with id ${a}.`);
  }
} finally {
  await stop();
}
