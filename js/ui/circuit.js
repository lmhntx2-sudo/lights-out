import { frag } from './dom.js';
import { CIRCUITS } from '../data/circuits.js';

// Circuit maps, drawn from the outlines in data/circuits.js. Lines keep their
// width at any size (non-scaling strokes), so the same map works as a 30px
// glyph on a button and as a big panel.

// Races run under lights. Abu Dhabi starts at dusk and ends in the dark.
const NIGHT = new Set(['bahrain', 'saudi', 'singapore', 'vegas', 'qatar', 'abudhabi']);
export const isNight = (id) => NIGHT.has(id);
export const hasCircuit = (id) => !!CIRCUITS[id];

// The start/finish line: a short bar across the track at the path's first point.
const starts = new Map();
function startLine(id) {
  if (!starts.has(id)) {
    const m = /^M(-?[\d.]+) (-?[\d.]+)l(-?[\d.]+)[ ]?(-?[\d.]+)/.exec(CIRCUITS[id].d);
    const [x, y, dx, dy] = m.slice(1).map(Number);
    const len = Math.hypot(dx, dy) || 1;
    const [px, py] = [(-dy / len) * 5, (dx / len) * 5];
    starts.set(id, `M${f1(x - px)} ${f1(y - py)}L${f1(x + px)} ${f1(y + py)}`);
  }
  return starts.get(id);
}

const f1 = (n) => n.toFixed(1);

// size: 'mini' (a glyph, no start line), 'card' or 'big' (thicker lines).
// trail: a light that laps the circuit, for decoration.
export function circuitSvg(id, { size = 'card', label, trail = false } = {}) {
  const c = CIRCUITS[id];
  if (!c) return '';
  const pad = size === 'mini' ? 4 : 8;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  const sf = size === 'mini' ? '' : `<path class="ck-sf" d="${startLine(id)}"/>`;
  return `<svg class="circuit ck-${size}" viewBox="${-pad} ${-pad} ${f1(c.w + pad * 2)} ${f1(c.h + pad * 2)}" xmlns="http://www.w3.org/2000/svg" ${a11y}>
    <path class="ck-edge" d="${c.d}"/><path class="ck-line" d="${c.d}"/>${sf}${trail ? `<path class="ck-trail" d="${c.d}" pathLength="1000"/>` : ''}
  </svg>`;
}

export const circuit = (id, opts) => frag(circuitSvg(id, opts));

// The circuit as a nested <svg> to drop into another drawing, fitted into the
// box x, y, w, h. Used to engrave a race winner's cup.
export function circuitInset(id, { x, y, w, h, stroke = 'rgba(0,0,0,.4)', width = 1.1 }) {
  const c = CIRCUITS[id];
  if (!c) return '';
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="-3 -3 ${f1(c.w + 6)} ${f1(c.h + 6)}"><path d="${c.d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
