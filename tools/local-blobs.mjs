// Netlify's own local Blobs server (the one `netlify dev` uses), storing data in
// tmp/blobs. Lets `npm start` and the admin tool run the leaderboard offline.
// Needs `npm install`; throws if @netlify/blobs is missing.
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const LOCAL_SITE_ID = 'local';
// What the function names its store under `netlify dev` and `npm start`.
export const LOCAL_STORE = 'leaderboard-dev';

export async function startLocalBlobs() {
  const { BlobsServer } = await import('@netlify/blobs/server');
  const token = randomBytes(16).toString('hex');
  const server = new BlobsServer({ directory: join(root, 'tmp', 'blobs'), token });
  const { port } = await server.start();
  const url = `http://localhost:${port}`;
  const context = { edgeURL: url, uncachedEdgeURL: url, siteID: LOCAL_SITE_ID, token };
  // getStore() inside the function reads this, just as it does on Netlify.
  globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify(context)).toString('base64');
  // Tells purgeCache() it is running locally.
  process.env.NETLIFY_LOCAL = 'true';
  return { ...context, stop: () => server.stop() };
}
