// Link previews: a shared daily season or challenge link gets its own title,
// in the sharer's language, and nothing from the link can break the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { previewMeta, rewriteHead } from '../netlify/lib/preview.mjs';

const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const at = (q) => new URL(`https://lights-out-racing.netlify.app/${q}`);
const tag = (html, attr, key) => new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`).exec(html)?.[1];

test('plain visits keep the page as it is', () => {
  assert.equal(previewMeta(at('')), null);
  assert.equal(previewMeta(at('?seed=abc123')), null, 'a seed alone is just a world');
  assert.equal(previewMeta(at('?seed=abc123&vs=nonsense')), null);
});

test('a daily season link names the day, and a challenge names the score', () => {
  const plain = previewMeta(at('?daily'));
  assert.equal(plain.title, 'Lights Out daily season');
  assert.match(plain.image, /og-daily\.png$/);
  assert.equal(previewMeta(at('?daily=2026-11-20')).title, 'Lights Out daily season #7');
  const vs = previewMeta(at('?daily=2026-11-20&vs=193~7~Alex%20Wong'));
  assert.equal(vs.title, 'Alex Wong scored 193 points (P7) in Lights Out daily season #7. Can you beat it?');
  assert.equal(vs.url, 'https://lights-out-racing.netlify.app/?daily=2026-11-20&vs=193~7~Alex%20Wong', 'og:url is the link itself, or crawlers would fetch the plain page');
  const zh = previewMeta(at('?daily=2026-11-20&vs=193~7~%E9%99%B3%E5%AD%90%E6%9C%97&l=zh'));
  assert.match(zh.title, /^陳子朗 在 Lights Out 每日賽季 #7 拿到 193 分/);
  assert.equal(previewMeta(at('?daily=2026-11-20&l=fr')).title, 'Lights Out daily season #7', 'unknown languages fall back to English');
  const career = previewMeta(at('?seed=abc123&vs=12340~3~41~Freddie'));
  assert.match(career.title, /^Freddie retired with a legacy score of 12340 \(3 titles, 41 wins\)/);
  assert.match(career.image, /og\.png$/);
});

test('the page head is rewritten, and escaped', () => {
  const meta = previewMeta(at('?daily=2026-11-20&vs=193~7~A%26B%22%3E%3Cscript%3E'));
  const html = rewriteHead(page, meta);
  assert.ok(!/content="[^"]*<script/.test(html), 'no markup gets into a tag');
  assert.match(tag(html, 'property', 'og:title'), /^A&amp;B&quot;script scored 193/);
  assert.equal(tag(html, 'property', 'og:title'), tag(html, 'name', 'twitter:title'));
  assert.equal(tag(html, 'property', 'og:image'), 'https://lights-out-racing.netlify.app/assets/og-daily.png');
  assert.match(tag(html, 'property', 'og:url'), /daily=2026-11-20&amp;vs=/);
  assert.match(tag(html, 'name', 'description'), /^One Formula 1 season/);
  assert.match(html, /<title>A&amp;B&quot;script scored 193 points/);
  assert.equal(html.split('<meta').length, page.split('<meta').length, 'no tags added or lost');
  assert.ok(html.includes('<script type="module" src="js/main.js"></script>'), 'the game still loads');
});

test('the edge function rewrites shared links and passes everything else through', async () => {
  const { default: edge, config } = await import('../netlify/edge-functions/preview.mjs');
  assert.equal(config.path, '/');
  let calls = 0;
  const ctx = (body = page, type = 'text/html; charset=utf-8') => ({
    next: async () => {
      calls++;
      return new Response(body, { status: 200, headers: { 'content-type': type, etag: '"abc"', 'content-length': String(body.length) } });
    },
  });
  const plain = await edge(new Request('https://lights-out-racing.netlify.app/'), ctx());
  assert.equal(await plain.text(), page, 'a plain visit is untouched');
  const shared = await edge(new Request('https://lights-out-racing.netlify.app/?daily=2026-11-20&vs=193~7~Alex'), ctx());
  const html = await shared.text();
  assert.match(html, /<meta property="og:title" content="Alex scored 193 points/);
  assert.equal(shared.headers.get('etag'), null, 'the old etag no longer matches');
  const css = await edge(new Request('https://lights-out-racing.netlify.app/?daily'), ctx('body{}', 'text/css'));
  assert.equal(await css.text(), 'body{}', 'only HTML is touched');
  assert.equal(calls, 3);
});
