import { frag } from './dom.js';

// Helmet designs: the base colour c1 with the second colour c2 laid on in a
// pattern. Older saves have no design and get the stripe they always had.
export const HELMET_DESIGNS = ['stripe', 'chevron', 'halves', 'stars', 'flames', 'checks'];

const SHELL = 'M7 37C6 19 20 6 39 6c16 0 27 10 28 24l.5 8c0 6-3.5 10-9.5 10.5L18 49c-7 0-10.5-5-11-12z';
const VISOR = 'M36 20c12-1.6 24-.6 30.6 3l.7 8.5c-7.3 1.5-19.3 2-27.3 1-4.5-.5-6-3.5-5.6-7.5.2-3 .6-4.7 1.6-5z';

function star(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function pattern(p, c1, c2) {
  switch (p) {
    case 'chevron':
      return `<path d="M3 13 12 9 40 30 12 51 3 47 28 30Z" fill="${c2}"/><path d="M-2 21 3 19 18 30 3 41-2 39 10 30Z" fill="${c2}"/>`;
    case 'halves':
      return `<path d="M0 0h72v21C52 25.5 28 26.5 0 20.5Z" fill="${c2}"/><path d="M0 23c28 6 52 5 72 .5" stroke="${c2}" stroke-width="1.6" fill="none"/>`;
    case 'stars':
      return `<path d="${star(19, 31, 7.5)}${star(29, 16, 5)}${star(13, 17, 3.4)}${star(30, 41, 3.2)}" fill="${c2}"/>`;
    case 'flames':
      return `<path d="M70 50H34C24 50 16 47 9 41c8 2.6 14 2.8 20 1.6C22 40 16 35.4 13 29c7 4.6 13 6.4 21 6.6C28 32 25 27 25 21c5 6 11 9.6 19 10.4C41 28 40 23.6 42 18.6c3 6.4 8 10.4 16 11.4L70 31Z" fill="${c2}"/>`;
    case 'checks': {
      let d = '';
      for (let row = 0; row < 3; row++) for (let col = 0; col < 16; col++) if ((row + col) % 2 === 0) d += `M${col * 5} ${33 + row * 5}h5v5h-5z`;
      return `<path d="${d}" fill="${c2}"/><path d="M0 32.5h72M0 48.5h72" stroke="${c2}" stroke-width="1.2"/>`;
    }
    default:
      return `<path d="M9 34C13 21 26 12.5 41.5 12.5c10 0 18.5 4.6 23 11.5" fill="none" stroke="${c2}" stroke-width="6.5" stroke-linecap="round"/><path d="M11 41c6-8 15-13 26-14" fill="none" stroke="${c2}" stroke-width="2" stroke-linecap="round"/>`;
  }
}

let uid = 0;

// A side-on racing helmet in the driver's colours and design. Supporters get a gold ring.
export function helmetSvg({ c1 = '#F2F2F2', c2 = '#E8002D', p = 'stripe' } = {}, { gold = false, label } = {}) {
  const id = `lh${++uid}`;
  return `<svg viewBox="0 0 72 58" xmlns="http://www.w3.org/2000/svg" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>
    <defs>
      <clipPath id="${id}c"><path d="${SHELL}"/></clipPath>
      <radialGradient id="${id}g" cx=".36" cy=".2" r=".8">
        <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity=".08"/>
        <stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/>
      </radialGradient>
      <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d4f86"/><stop offset=".55" stop-color="#0d1526"/><stop offset="1" stop-color="#05070c"/></linearGradient>
    </defs>
    ${gold ? '<ellipse cx="37" cy="30" rx="35" ry="27.5" fill="none" stroke="#D4AF37" stroke-width="2.2" stroke-dasharray="4 3"/>' : ''}
    <path d="M7.5 31 3 33.5 4.5 37.5 8 37Z" fill="#141419"/>
    <path d="${SHELL}" fill="${c1}"/>
    <g clip-path="url(#${id}c)">${pattern(p, c1, c2)}</g>
    <path d="${SHELL}" fill="url(#${id}g)"/>
    <path d="M15 16c3.6-4.4 7.6-7 12.4-8.4L25.6 13Z" fill="rgba(0,0,0,.55)"/>
    <path d="${VISOR}" fill="url(#${id}v)"/>
    <path d="${VISOR}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1.2"/>
    <path d="M40 23.6c8-1.2 16-.8 23 1.4" stroke="rgba(160,200,255,.55)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <circle cx="36.5" cy="33.6" r="2.1" fill="#16161b"/>
    <path d="M17 48.6 58.4 48c0 3.4-3 6-7 6H22.6c-3.6 0-5.6-2.6-5.6-5.4z" fill="${c2}"/>
    <path d="M17 48.6 58.4 48c0 3.4-3 6-7 6H22.6c-3.6 0-5.6-2.6-5.6-5.4z" fill="rgba(0,0,0,.25)"/>
    <path d="${SHELL}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>
  </svg>`;
}

export const helmet = (colors, opts) => frag(helmetSvg(colors, opts));
