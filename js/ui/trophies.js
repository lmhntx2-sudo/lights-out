// The trophy room, the season-by-season chart and the round-by-round results
// strip. All of it is drawn from records the engine keeps for display only:
// s.career.cups (race wins), s.season.rounds (this season's results) and
// s.career.hist (finished seasons). Careers from before those records existed
// fall back to what the history and the feed still hold.
import { h } from './dom.js';
import { TRACKS } from '../data/tracks.js';
import { flagOf } from '../data/nations.js';
import { t, seriesName, trackShortById, trackName } from '../i18n.js';

const SVG = 'http://www.w3.org/2000/svg';
const svgEl = (markup) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstChild;
};

// ------------------------------------------------------------------ results strip

// How a round went, as a timing colour: purple win, green podium, white points,
// grey outside the points, red retirement, dashed for a race you missed.
export function roundClass(r) {
  if (!r) return 'fut';
  if (!r.p) return 'out';
  if (r.d) return 'dnf';
  if (r.p === 1) return 'win';
  if (r.p <= 3) return 'pod';
  return r.p <= 10 ? 'pts' : 'nop';
}

const roundText = (r) => (!r ? '' : !r.p ? '–' : r.d ? '✕' : String(r.p));
const roundWords = (r) => (!r ? '' : !r.p ? t('Did not race') : r.d ? t('DNF') : `P${r.p}`);

// This season's rounds. Saves from before s.season.rounds existed rebuild them
// from the race cards still in the feed.
export function seasonRounds(s) {
  const se = s.season;
  if (!se) return [];
  if (se.rounds) return se.rounds;
  return s.feed
    .filter((e) => e.k === 'race' && !e.special && e.yr === se.year && e.series === se.series)
    .map((e) => ({ t: e.trackId, p: e.me ? e.me.pos : 0, ...(e.me?.dnf ? { d: 1 } : {}) }));
}

export function resultStrip(cal, rounds) {
  return h(
    'ol',
    { class: 'strip', 'aria-label': t('Results by round') },
    cal.map((id, i) => {
      const r = rounds[i];
      const name = trackShortById(id, TRACKS[id]?.short || id);
      const words = r ? `${name}: ${roundWords(r)}` : name;
      return h(
        'li',
        { class: `rd r-${roundClass(r)}${r?.q ? ' pole' : ''}`, title: words, 'aria-label': t('Round {n}: {result}', { n: i + 1, result: words }) },
        h('span', { class: 'fl', 'aria-hidden': 'true' }, flagOf(TRACKS[id]?.nat || '')),
        h('b', { 'aria-hidden': 'true' }, roundText(r)),
      );
    }),
  );
}

// ------------------------------------------------------------------ trophies

const METALS = {
  gold: ['#fff4bf', '#e3bd48', '#8c6510'],
  silver: ['#ffffff', '#c9d0d8', '#69727e'],
  bronze: ['#ffe0c2', '#cf8f5d', '#6b3c1a'],
};
let uid = 0;

function metalDefs(id, metal) {
  const [a, b, c] = METALS[metal];
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}"/><stop offset=".28" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
}

// A championship trophy: a tall cup with handles and a star, on a dark plinth.
function titleCup(metal, label) {
  const id = `tt${++uid}`;
  return svgEl(`<svg class="cup big" viewBox="0 0 60 92" xmlns="${SVG}" role="img" aria-label="${label}">
    <defs>${metalDefs(id, metal)}</defs>
    <ellipse cx="30" cy="88" rx="22" ry="3" fill="rgba(0,0,0,.45)"/>
    <path d="M13 74h34l-2 14H15z" fill="#241a12"/>
    <path d="M13 74h34v3H13z" fill="#3a2a1c"/>
    <rect x="21" y="79" width="18" height="5" rx="1" fill="url(#${id})"/>
    <path d="M25 74 27.5 58h5L35 74z" fill="url(#${id})"/>
    <ellipse cx="30" cy="58" rx="7" ry="2.6" fill="url(#${id})"/>
    <path d="M13 22C3 21 3 41 17 43" fill="none" stroke="url(#${id})" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M47 22C57 21 57 41 43 43" fill="none" stroke="url(#${id})" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M11 13c0 27 8.5 41 19 43 10.5-2 19-16 19-43z" fill="url(#${id})"/>
    <ellipse cx="30" cy="13" rx="19" ry="4.4" fill="url(#${id})"/>
    <ellipse cx="30" cy="13.2" rx="15.5" ry="2.8" fill="rgba(0,0,0,.35)"/>
    <path d="M17 18c0 15 3.6 26 8.6 32" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-linecap="round"/>
    <path d="M30 24.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="rgba(0,0,0,.28)"/>
  </svg>`);
}

// A race-winner's cup, smaller and plainer. Macau's has a red base.
function winCup(metal, label, base = '#241a12') {
  const id = `tw${++uid}`;
  return svgEl(`<svg class="cup" viewBox="0 0 40 58" xmlns="${SVG}" role="img" aria-label="${label}">
    <defs>${metalDefs(id, metal)}</defs>
    <ellipse cx="20" cy="55" rx="14" ry="2.4" fill="rgba(0,0,0,.45)"/>
    <path d="M9 46h22l-1.4 9H10.4z" fill="${base}"/>
    <path d="M17 46 18.4 36h3.2L23 46z" fill="url(#${id})"/>
    <ellipse cx="20" cy="36" rx="4.6" ry="1.8" fill="url(#${id})"/>
    <path d="M9 13C3 13 3 25 11 26" fill="none" stroke="url(#${id})" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M31 13C37 13 37 25 29 26" fill="none" stroke="url(#${id})" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M7.5 8c0 17 5.6 26 12.5 27.5C26.9 34 32.5 25 32.5 8z" fill="url(#${id})"/>
    <ellipse cx="20" cy="8" rx="12.5" ry="3" fill="url(#${id})"/>
    <ellipse cx="20" cy="8.2" rx="10" ry="1.8" fill="rgba(0,0,0,.35)"/>
    <path d="M12 12c0 9 2.4 16 5.6 19.6" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`);
}

// Every trophy the career has won, grouped into shelves.
export function trophyList(s) {
  const c = s.career;
  const titles = c.hist.filter((x) => x.champion).map((x) => ({ year: x.year, series: x.series }));
  const cups = [...(c.cups || [])];
  // Seasons won before race wins were recorded: one cup per win, without a track.
  const known = new Map();
  for (const w of cups) known.set(`${w.y}${w.s}`, (known.get(`${w.y}${w.s}`) || 0) + 1);
  for (const x of c.hist) {
    const missing = x.wins - (known.get(`${x.year}${x.series}`) || 0);
    for (let i = 0; i < missing; i++) cups.push({ y: x.year, s: x.series, t: null });
  }
  cups.sort((a, b) => a.y - b.y);
  const macau = (c.macau || []).filter((m) => !m.dnf && m.pos === 1);
  return { titles, f1: cups.filter((w) => w.s === 'F1'), junior: cups.filter((w) => w.s !== 'F1'), macau };
}

function shelf(title, items) {
  if (!items.length) return null;
  return h('section', { class: 'shelf-wrap' }, h('h4', null, title, h('span', null, items.length)), h('div', { class: 'shelf' }, items));
}

export function trophyRoom(s) {
  const { titles, f1, junior, macau } = trophyList(s);
  if (!titles.length && !f1.length && !junior.length && !macau.length) {
    return h('div', { class: 'trophies empty-room' }, winCup('silver', ''), h('p', { class: 'empty' }, t('No trophies yet. Win a race and the cup goes on this shelf.')));
  }
  const titleItem = (x) => {
    const series = seriesName(x.series);
    const label = `${series} ${x.year}`;
    return h('figure', { class: `trophy${x.series === 'F1' ? ' world' : ''}`, title: label }, titleCup(x.series === 'F1' ? 'gold' : 'silver', label), h('figcaption', null, h('b', null, series), h('span', null, x.year)));
  };
  const cupItem = (w, metal) => {
    const tr = w.t && TRACKS[w.t];
    const place = tr ? trackShortById(w.t, tr.short) : seriesName(w.s);
    const label = tr ? `${roundTitle(tr, w.s)} ${w.y}` : `${seriesName(w.s)} ${w.y}`;
    return h('figure', { class: 'trophy', title: label }, winCup(metal, label), h('figcaption', null, h('b', null, tr ? `${flagOf(tr.nat)} ${place}` : place), h('span', null, w.y)));
  };
  const f1Titles = titles.filter((x) => x.series === 'F1');
  const jrTitles = titles.filter((x) => x.series !== 'F1');
  return h(
    'div',
    { class: 'trophies' },
    shelf(t('World titles'), f1Titles.map(titleItem)),
    shelf(t('Grand Prix wins'), f1.map((w) => cupItem(w, 'gold'))),
    shelf(trackName(TRACKS.macau), macau.map((m) => h('figure', { class: 'trophy', title: `${trackName(TRACKS.macau)} ${m.year}` }, winCup('gold', `${trackName(TRACKS.macau)} ${m.year}`, '#9c1420'), h('figcaption', null, h('b', null, `${flagOf('MO')} ${trackShortById('macau', 'Macau')}`), h('span', null, m.year))))),
    shelf(t('Junior titles'), jrTitles.map(titleItem)),
    shelf(t('Junior race wins'), junior.map((w) => cupItem(w, 'silver'))),
  );
}

// "Monaco Grand Prix" in F1, "Monaco" with the series in the junior formulas.
function roundTitle(tr, series) {
  return series === 'F1' ? trackName(tr) : `${seriesName(series)} ${trackShortById(tr.id, tr.short)}`;
}

// ------------------------------------------------------------------ career chart

const SERIES_COL = { F4: '#9a9aae', F3: '#3bb3ff', F2: '#22d36f', F1: '#ff3b30' };

// Championship position season by season, P1 at the top, coloured by series,
// with a gold star for every title.
export function careerChart(hist) {
  const seasons = hist.filter((x) => x.pos > 0);
  if (seasons.length < 2) return null;
  const W = 600;
  const H = 210;
  const L = 34;
  const R = 14;
  const T = 14;
  const B = 28;
  const worst = Math.max(...seasons.map((x) => x.pos));
  const maxPos = Math.min(24, Math.max(10, worst));
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, seasons.length - 1);
  const y = (p) => T + ((Math.min(p, maxPos) - 1) * (H - T - B)) / (maxPos - 1);
  const grid = [1, 5, 10, 15, 20].filter((p) => p <= maxPos);
  const every = Math.ceil(seasons.length / 10);
  let lines = '';
  for (let i = 1; i < seasons.length; i++) {
    lines += `<line x1="${x(i - 1)}" y1="${y(seasons[i - 1].pos)}" x2="${x(i)}" y2="${y(seasons[i].pos)}" stroke="${SERIES_COL[seasons[i].series]}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  const dots = seasons
    .map((s, i) => {
      const cx = x(i);
      const cy = y(s.pos);
      const tip = `<title>${s.year} ${seriesName(s.series)}: P${s.pos}</title>`;
      if (s.champion) {
        const pts = [];
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          const r = k % 2 ? 3.4 : 8;
          pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
        }
        return `<polygon points="${pts.join(' ')}" fill="#d4af37" stroke="#15151e" stroke-width="1.2">${tip}</polygon>`;
      }
      return `<circle cx="${cx}" cy="${cy}" r="4.2" fill="${SERIES_COL[s.series]}" stroke="#15151e" stroke-width="1.6">${tip}</circle>`;
    })
    .join('');
  const yl = grid.map((p) => `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}" class="gl"/><text x="${L - 8}" y="${y(p) + 4}" text-anchor="end">P${p}</text>`).join('');
  const xl = seasons.map((s, i) => (i % every === 0 || i === seasons.length - 1 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${s.year}</text>` : '')).join('');
  const used = [...new Set(seasons.map((s) => s.series))];
  return h(
    'figure',
    { class: 'career-chart' },
    h('figcaption', null, t('Championship position by season')),
    svgEl(`<svg viewBox="0 0 ${W} ${H}" xmlns="${SVG}" role="img" aria-label="${t('Championship position by season')}">${yl}${xl}${lines}${dots}</svg>`),
    h('div', { class: 'legend' }, used.map((k) => h('span', null, h('i', { style: `background:${SERIES_COL[k]}` }), seriesName(k))), seasons.some((s) => s.champion) ? h('span', null, h('i', { class: 'star' }), t('Champion')) : null),
  );
}
