import { frag } from './dom.js';

function isLight(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

// A top-down Formula 1 car, nose to the right, in the team's livery with the race number.
export function carSvg({ color = '#E10600', accent = '#FFFFFF', number = '', helmet = '#F2F2F2' } = {}, { label } = {}) {
  const ink = isLight(color) ? '#111111' : '#FFFFFF';
  return `<svg class="car" viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>
    <ellipse cx="112" cy="50" rx="104" ry="30" fill="rgba(0,0,0,.35)"/>
    <path d="M34 22 150 26l36 12v14l-36 12-116 4z" fill="#0d0d12"/>
    <g stroke="#2b2b34" stroke-width="2.4" stroke-linecap="round">
      <path d="M46 23 60 33M46 67 60 57M166 25 148 38M174 25 156 39M166 65 148 52M174 65 156 51"/>
    </g>
    <rect x="22" y="3" width="38" height="21" rx="5" fill="#121217"/>
    <rect x="22" y="66" width="38" height="21" rx="5" fill="#121217"/>
    <rect x="35" y="5" width="11" height="17" rx="2" fill="#1d1d24"/>
    <rect x="35" y="68" width="11" height="17" rx="2" fill="#1d1d24"/>
    <rect x="158" y="9" width="30" height="17" rx="4" fill="#121217"/>
    <rect x="158" y="64" width="30" height="17" rx="4" fill="#121217"/>
    <path d="M30 34c4-6 18-10 40-11 22-1 38 1 52 7l18 6v18l-18 6c-14 6-30 8-52 7-22-1-36-5-40-11z" fill="${color}"/>
    <path d="M44 27c26-2 56 0 78 6M44 63c26 2 56 0 78-6" fill="none" stroke="${accent}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M136 37 196 41c4 1 4 7 0 8l-60 4z" fill="${color}"/>
    <path d="M150 41.5h40" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="192" y="11" width="13" height="68" rx="3" fill="${accent}"/>
    <rect x="190" y="9" width="17" height="5" rx="1.5" fill="#15151a"/>
    <rect x="190" y="76" width="17" height="5" rx="1.5" fill="#15151a"/>
    <rect x="7" y="13" width="15" height="64" rx="2.5" fill="${accent}"/>
    <rect x="5" y="11" width="19" height="5" rx="1.5" fill="#15151a"/>
    <rect x="5" y="74" width="19" height="5" rx="1.5" fill="#15151a"/>
    <ellipse cx="108" cy="45" rx="5.5" ry="4" fill="#111116"/>
    <ellipse cx="128" cy="45" rx="10.5" ry="6.5" fill="#09090d"/>
    <circle cx="125" cy="45" r="4.4" fill="${helmet}"/>
    <path d="M116 37.5c10-3 20-1 26 7.5-6 8.5-16 10.5-26 7.5M140 45h8" fill="none" stroke="#1b1b22" stroke-width="3" stroke-linecap="round"/>
    ${number !== '' ? `<text x="78" y="51.5" text-anchor="middle" font-family="Saira, sans-serif" font-weight="900" font-style="italic" font-size="17" fill="${ink}">${number}</text>` : ''}
  </svg>`;
}

export const car = (opts, extra) => frag(carSvg(opts, extra));
