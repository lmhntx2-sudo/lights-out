// Game portals such as itch.io serve the game from their own domain and call the
// API on this site, so the functions answer any origin. Nothing here depends on
// cookies or logins, anyone can already call the API directly, and the rate
// limits still apply per connection.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// The browser asks before a cross-site POST with a JSON body.
export const preflight = () => new Response(null, { status: 204, headers: CORS });

// The same response with the CORS headers added.
export function withCors(res) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
