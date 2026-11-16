// Netlify Edge Function: link previews for daily season and challenge links
// (see netlify/lib/preview.mjs). Every other request passes straight through,
// and if anything goes wrong the page is served exactly as it is.
import { previewMeta, rewriteHead } from '../lib/preview.mjs';

export default async (request, context) => {
  let meta = null;
  try {
    meta = previewMeta(new URL(request.url));
  } catch {
    meta = null;
  }
  if (!meta) return context.next();
  const res = await context.next();
  try {
    if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return res;
    const html = await res.clone().text();
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    headers.delete('etag');
    return new Response(rewriteHead(html, meta), { status: res.status, headers });
  } catch {
    return res;
  }
};

export const config = { path: '/' };
