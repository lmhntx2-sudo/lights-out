// Builds js/data/circuits.js, the circuit maps, from track outlines in GeoJSON.
//
// Source: github.com/bacinger/f1-circuits (MIT, (c) Tomislav Bacinger). Download
// its circuits/*.geojson into a folder of their own and pass that folder:
//
//   node tools/circuits.mjs path/to/geojson-folder
//
// Each outline is projected flat, simplified, scaled so its longer side is 100
// units and written as one SVG path. The first point is the start/finish line
// and the points run in the race direction. Circuits the dataset has no outline
// for are drawn by hand in HAND below.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const SOURCE = {
  abudhabi: 'ae-2009', australia: 'au-1953', austria: 'at-1969', baku: 'az-2016', belgium: 'be-1925',
  bahrain: 'bh-2002', brazil: 'br-1940', canada: 'ca-1978', china: 'cn-2004', hockenheim: 'de-1932',
  spain: 'es-1991', madrid: 'es-2026', paulricard: 'fr-1969', britain: 'gb-1948', hungary: 'hu-1986',
  mugello: 'it-1914', italy: 'it-1922', imola: 'it-1953', japan: 'jp-1962', monaco: 'mc-1929',
  mexico: 'mx-1962', netherlands: 'nl-1948', qatar: 'qa-2004', saudi: 'sa-2021', singapore: 'sg-2008',
  usa: 'us-2012', miami: 'us-2022', vegas: 'us-2023',
};

// The dataset starts Monaco at Casino Square; the line is on Boulevard Albert 1er.
const START = { monaco: [43.7347, 7.4214] };

// Circuits outside the dataset, from OpenStreetMap raceway ways (ODbL,
// (c) OpenStreetMap contributors). Fetch them with an Overpass query such as
//   [out:json];(way(around:1500,34.733,126.417)["highway"="raceway"];
//   way(around:1200,43.962,12.683)["highway"="raceway"];
//   way(around:1200,42.159,12.369)["highway"="raceway"];);out geom tags;
// and pass the saved JSON as the second argument. The track is the longest loop
// the raceway segments around `near` make, or the `ways` given, in order (short
// gaps between them are bridged). `sf` is the start/finish line.
const OSM = {
  korea: { near: [34.733, 126.417], sf: [34.7313, 126.4170], dir: 'acw' },
  misano: { near: [43.962, 12.683], sf: [43.9625, 12.6845], dir: 'cw' },
  // The 4.1 km layout: Traguardo, Curvone, Cimini, Campagnano, Soratte, Trincea, Semaforo, Tornantino, Esse, Roma.
  vallelunga: { ways: [1499656409, 1499656395, 1499656396, 1499656397, 1499656398, 1499656399, 624366422, 1499656401, 1499656400, 1499656402, 1499656403, 1499937318, 1499937317, 1499656404, 1499656405, 1499656406, 1499656408, 1499656407, 1499656410, 1499656394], sf: [42.1561, 12.3693], dir: 'cw' },
};
const NOT_TRACK = /pit|kart|cart|rally|long lap|course|layout|permanent/i;

// Stylised outlines, start/finish first, in the race direction, on a 100-unit
// grid (y down), drawn from the circuit's published layout.
const HAND = {
  // Guia: the seafront straights to Lisboa, up the hill to the Melco hairpin and back down.
  macau: [[62, 74], [52, 79], [44, 82], [38, 87], [28, 92], [19, 96], [14, 93], [15, 87], [20, 81], [21, 74], [25, 67], [30, 62], [28, 56], [33, 50], [39, 46], [41, 40], [47, 35], [52, 29], [58, 27], [63, 21], [70, 17], [77, 13], [84, 7], [89, 4], [92, 7], [87, 13], [81, 21], [79, 30], [77, 39], [76, 47], [72, 58], [67, 67]],
};

// ---------------------------------------------------------------- OpenStreetMap
const metres = (a, b) => Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180));

// Ways joined end to end in the order given, each turned to follow the last.
function osmChain(elements, ids) {
  const pts = [];
  for (const id of ids) {
    const w = elements.find((e) => e.id === id);
    if (!w) throw new Error(`way ${id} missing`);
    let p = w.geometry.map((g) => [g.lat, g.lon]);
    if (pts.length && metres(pts.at(-1), p.at(-1)) < metres(pts.at(-1), p[0])) p = p.reverse();
    if (pts.length && metres(pts.at(-1), p[0]) > 120) throw new Error(`gap before way ${id}`);
    pts.push(...p);
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += metres(pts[i - 1], pts[i]);
  return { pts, len: len + metres(pts.at(-1), pts[0]) };
}

// The longest simple loop through the raceway segments near a circuit, as [lat, lon] points.
function osmLoop(elements, spec) {
  if (spec.ways) return osmChain(elements, spec.ways);
  const ways = elements.filter((e) => e.type === 'way' && e.geometry?.length > 1 && !NOT_TRACK.test(e.tags?.name || '') && e.tags?.area !== 'yes' && metres([e.geometry[0].lat, e.geometry[0].lon], spec.near) < 2500);
  const nodes = [];
  const nodeOf = (p) => {
    let i = nodes.findIndex((q) => metres(q, p) < 6);
    if (i < 0) { nodes.push(p); i = nodes.length - 1; }
    return i;
  };
  const edges = ways.map((w) => {
    const pts = w.geometry.map((g) => [g.lat, g.lon]);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += metres(pts[i - 1], pts[i]);
    return { a: nodeOf(pts[0]), b: metres(pts[0], pts.at(-1)) < 30 ? nodeOf(pts[0]) : nodeOf(pts.at(-1)), pts, len };
  });
  // A way that closes on itself is a whole circuit already.
  const closed = edges.filter((e) => e.a === e.b).sort((x, y) => y.len - x.len)[0];
  let best = closed ? { len: closed.len, path: [{ e: closed, fwd: true }] } : { len: 0, path: [] };
  const used = new Set();
  const seen = new Set();
  function walk(start, at, len, path) {
    for (const e of edges) {
      if (used.has(e) || e.a === e.b) continue;
      const fwd = e.a === at;
      if (!fwd && e.b !== at) continue;
      const next = fwd ? e.b : e.a;
      if (next === start) {
        if (len + e.len > best.len) best = { len: len + e.len, path: [...path, { e, fwd }] };
        continue;
      }
      if (seen.has(next)) continue;
      used.add(e); seen.add(next);
      walk(start, next, len + e.len, [...path, { e, fwd }]);
      used.delete(e); seen.delete(next);
    }
  }
  for (let n = 0; n < nodes.length; n++) { seen.clear(); seen.add(n); walk(n, n, 0, []); }
  const pts = [];
  for (const { e, fwd } of best.path) pts.push(...(fwd ? e.pts : [...e.pts].reverse()).slice(pts.length ? 1 : 0));
  return { pts, len: best.len };
}

// Signed area on screen (y down): positive runs clockwise.
const area = (p) => p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + x * y2 - x2 * y; }, 0);

// Turn the loop so it starts at the point nearest `sf` and runs in direction `dir`.
function startAt(ll, sf, dir) {
  let i0 = 0;
  ll.forEach((p, i) => { if (metres(p, sf) < metres(ll[i0], sf)) i0 = i; });
  let out = [...ll.slice(i0), ...ll.slice(0, i0)];
  if (dir) {
    const scr = out.map(([lat, lon]) => [lon, -lat]);
    if ((area(scr) > 0 ? 'cw' : 'acw') !== dir) out = [out[0], ...out.slice(1).reverse()];
  }
  return out;
}

// Ramer-Douglas-Peucker on a closed loop (last point = first), keeping the
// first point. The loop is cut at the point farthest from the start.
function simplify(pts, eps) {
  const keep = new Uint8Array(pts.length);
  let mid = 1;
  for (let i = 1; i < pts.length - 1; i++) {
    if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[mid][0] - pts[0][0], pts[mid][1] - pts[0][1])) mid = i;
  }
  keep[0] = keep[mid] = keep[pts.length - 1] = 1;
  const stack = [[0, mid], [mid, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-9;
    let far = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > far) { far = d; at = i; }
    }
    if (far > eps) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function fit(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const k = 100 / Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0);
  const out = pts.map(([x, y]) => [(x - x0) * k, (y - y0) * k]);
  return { pts: out, w: (Math.max(...xs) - x0) * k, h: (Math.max(...ys) - y0) * k };
}

const r1 = (n) => Math.round(n * 10) / 10;
const num = (n) => String(r1(n)).replace(/^(-?)0\./, '$1.');

// Relative path: short, and a straight segment costs one pair of numbers.
function pathOf(pts) {
  let d = `M${num(pts[0][0])} ${num(pts[0][1])}`;
  let [px, py] = [r1(pts[0][0]), r1(pts[0][1])];
  for (const [x, y] of pts.slice(1)) {
    const [rx, ry] = [r1(x), r1(y)];
    const dx = num(rx - px);
    const dy = num(ry - py);
    d += `l${dx}${dy.startsWith('-') ? '' : ' '}${dy}`;
    [px, py] = [rx, ry];
  }
  return `${d}z`;
}

// [lat, lon] loop -> simplified outline on the 100-unit grid. North is up; a
// degree of longitude shrinks with latitude.
function outline(ll) {
  if (metres(ll[0], ll.at(-1)) < 0.5) ll = ll.slice(0, -1);
  const lat0 = (ll.reduce((s, p) => s + p[0], 0) / ll.length) * (Math.PI / 180);
  const f = fit(ll.map(([lat, lon]) => [lon * Math.cos(lat0), -lat]));
  const s = simplify([...f.pts, f.pts[0]], 0.32).slice(0, -1);
  return { w: r1(f.w), h: r1(f.h), d: pathOf(s), n: s.length };
}

const [dir, osmFile] = process.argv.slice(2);
if (!dir || !osmFile) { console.error('usage: node tools/circuits.mjs <geojson folder> <overpass json>'); process.exit(1); }
const files = new Set(await readdir(dir));
const out = {};
for (const [id, file] of Object.entries(SOURCE)) {
  if (!files.has(`${file}.geojson`)) { console.error(`missing ${file}.geojson for ${id}`); process.exit(1); }
  const gj = JSON.parse(await readFile(join(dir, `${file}.geojson`), 'utf8'));
  let ll = gj.features[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  if (START[id]) ll = startAt(ll.slice(0, -1), START[id]);
  out[id] = outline(ll);
}
const osm = JSON.parse(await readFile(osmFile, 'utf8')).elements;
for (const [id, spec] of Object.entries(OSM)) {
  const loop = osmLoop(osm, spec);
  if (loop.len < 2000) { console.error(`no loop found for ${id} (${Math.round(loop.len)} m)`); process.exit(1); }
  out[id] = { ...outline(startAt(loop.pts, spec.sf, spec.dir)), osm: true };
  console.log(`${id}: ${Math.round(loop.len)} m of track`);
}
for (const [id, raw] of Object.entries(HAND)) {
  const f = fit(raw);
  out[id] = { w: r1(f.w), h: r1(f.h), d: pathOf(f.pts), n: f.pts.length, hand: true };
}

const lines = Object.entries(out).map(([id, c]) => `  ${id}: { w: ${c.w}, h: ${c.h}, d: '${c.d}' },${c.hand ? ' // drawn by hand' : c.osm ? ' // OpenStreetMap' : ''}`);
const src = `// Circuit maps: one closed SVG path per track on a grid whose longer side is
// 100 units. The path starts at the start/finish line and runs in the race
// direction. Generated by tools/circuits.mjs from github.com/bacinger/f1-circuits
// (MIT, (c) Tomislav Bacinger). The ones marked OpenStreetMap are derived from
// OpenStreetMap data, (c) OpenStreetMap contributors, available under the Open
// Database Licence (ODbL). Macau is drawn by hand and is stylised.
export const CIRCUITS = {
${lines.join('\n')}
};
`;
await writeFile(new URL('../js/data/circuits.js', import.meta.url), src);
console.log(Object.entries(out).map(([id, c]) => `${id}:${c.n}`).join(' '));
console.log(`${src.length} bytes`);
