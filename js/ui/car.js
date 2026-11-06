import { frag } from './dom.js';

function isLight(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

// Gradient ids must be unique on the page: two cars with the same id would
// share one definition, and a definition inside a hidden dialog doesn't paint.
let uid = 0;

// The body seen from above, nose to the right: a coke-bottle engine cover,
// sidepods that undercut at the front, a narrow cockpit and a long nose.
const BODY = 'M30 39.2C44 37.4 52 34.2 63 29.6 75 25.4 103 24.6 115.5 27.2L119.5 34C127 34.8 139 35.8 150 38.3L197.5 42.4C201.2 42.9 201.2 47.1 197.5 47.6L150 51.7C139 54.2 127 55.2 119.5 56L115.5 62.8C103 65.4 75 64.6 63 60.4 52 55.8 44 52.6 30 50.8Z';
// The floor, wider than the bodywork, with its edge wing visible past the sidepods.
const FLOOR = 'M30 35.5 46 26.2C56 21.4 70 18.6 86 18.4L115 19.2C123 19.6 127 23.6 128.5 29.5L131 39.5 133 45 131 50.5 128.5 60.5C127 66.4 123 70.4 115 70.8L86 71.6C70 71.4 56 68.6 46 63.8L30 54.5Z';

const tyre = (x, y, w, hgt, id) => `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="${hgt / 3.4}" fill="url(#${id}t)"/>
    <path d="M${x + 4} ${y + 2.2}h${w - 8}" stroke="rgba(255,255,255,.14)" stroke-width="1.2" stroke-linecap="round"/>`;

// A top-down Formula 1 car, nose to the right, in the team's livery with the race number.
export function carSvg({ color = '#E10600', accent = '#FFFFFF', number = '', helmet = '#F2F2F2' } = {}, { label } = {}) {
  const ink = isLight(color) ? '#111111' : '#FFFFFF';
  const edge = isLight(color) ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.18)';
  const id = `lc${++uid}`;
  return `<svg class="car" viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>
    <defs>
      <radialGradient id="${id}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".6" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34343c"/><stop offset=".45" stop-color="#16161b"/><stop offset="1" stop-color="#0c0c10"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".3" stop-color="#fff" stop-opacity=".06"/>
        <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/>
      </linearGradient>
      <linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".5" stop-color="#000" stop-opacity="0"/></linearGradient>
    </defs>
    <ellipse cx="111" cy="48" rx="106" ry="40" fill="url(#${id}s)"/>
    <g stroke="#26262e" stroke-width="2.1" stroke-linecap="round" fill="none">
      <path d="M40 37 39 21M50 35 42 21M40 53 39 69M50 55 42 69"/>
      <path d="M147 39 171 23M160 40.6 173 23M147 51 171 67M160 49.4 173 67"/>
    </g>
    ${tyre(22, 2.5, 38, 19, id)}
    ${tyre(22, 68.5, 38, 19, id)}
    ${tyre(158, 6.5, 31, 16.5, id)}
    ${tyre(158, 67, 31, 16.5, id)}
    <path d="${FLOOR}" fill="#0b0b0f"/>
    <path d="M52 23.6C64 20 76 19 90 19M52 66.4C64 70 76 71 90 71" stroke="rgba(255,255,255,.16)" stroke-width="1" fill="none"/>
    <rect x="8" y="11" width="16" height="68" rx="2.5" fill="${accent}"/>
    <rect x="8" y="11" width="16" height="68" rx="2.5" fill="url(#${id}w)"/>
    <path d="M15 12v66" stroke="rgba(0,0,0,.45)" stroke-width="1.4"/>
    <rect x="4.5" y="8.5" width="22" height="5" rx="1.6" fill="#141419"/>
    <rect x="4.5" y="76.5" width="22" height="5" rx="1.6" fill="#141419"/>
    <rect x="22" y="41.5" width="12" height="7" rx="1.5" fill="#141419"/>
    <path d="${BODY}" fill="${color}"/>
    <path d="M58 31.6C78 26.6 100 26.4 114 28.4M58 58.4C78 63.4 100 63.6 114 61.6" fill="none" stroke="${accent}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M151 41.4 194 43.4M151 48.6 194 46.6" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="${BODY}" fill="url(#${id}b)"/>
    <path d="${BODY}" fill="none" stroke="${edge}" stroke-width=".8"/>
    <path d="M46 37.8C60 33.6 76 29.4 104 28.8M152 40.4 192 43.2" stroke="rgba(255,255,255,.4)" stroke-width="1" stroke-linecap="round" fill="none"/>
    <path d="M38 45h66" stroke="rgba(0,0,0,.22)" stroke-width="1.1"/>
    <path d="M113.6 28 118.8 34.4 116 34.6 111.6 28.6ZM113.6 62 118.8 55.6 116 55.4 111.6 61.4Z" fill="#08080b"/>
    <path d="M123 34.6 125.5 30.4M123 55.4 125.5 59.6" stroke="#15151a" stroke-width="1.4"/>
    <ellipse cx="126.5" cy="29.6" rx="3.4" ry="1.9" fill="#15151a"/>
    <ellipse cx="126.5" cy="60.4" rx="3.4" ry="1.9" fill="#15151a"/>
    <ellipse cx="112.5" cy="45" rx="6.4" ry="4.4" fill="#0a0a0d"/>
    <ellipse cx="111.5" cy="43.6" rx="3.6" ry="1.6" fill="rgba(255,255,255,.14)"/>
    <ellipse cx="133" cy="45" rx="11.5" ry="6.6" fill="#07070a"/>
    <circle cx="129.6" cy="45" r="4.9" fill="${helmet}"/>
    <path d="M131.4 41.4a4.9 4.9 0 0 1 0 7.2" stroke="#0b1220" stroke-width="2.2" fill="none"/>
    <circle cx="128.2" cy="43.4" r="1.5" fill="rgba(255,255,255,.55)"/>
    <path d="M120.5 37.8C131 34 141.5 37.4 146 45 141.5 52.6 131 56 120.5 52.2M146 45h7.5" fill="none" stroke="#141419" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M122 37.2C131 34.6 140 37 144.4 43" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1" stroke-linecap="round"/>
    <path d="M190.5 11.5Q199.5 45 190.5 78.5" fill="none" stroke="#16161b" stroke-width="3.4"/>
    <path d="M195.5 10.5Q205 45 195.5 79.5" fill="none" stroke="${color}" stroke-width="4.6"/>
    <path d="M195.5 10.5Q205 45 195.5 79.5" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.4" transform="translate(-1.4 0)"/>
    <rect x="205" y="10.5" width="7.5" height="69" rx="2.4" fill="${accent}"/>
    <rect x="205" y="10.5" width="7.5" height="69" rx="2.4" fill="url(#${id}w)" opacity=".7"/>
    <rect x="187.5" y="7.4" width="26" height="4.2" rx="1.5" fill="#141419"/>
    <rect x="187.5" y="78.4" width="26" height="4.2" rx="1.5" fill="#141419"/>
    <path d="M196 42.6 205.5 43.6C207.6 44 207.6 46 205.5 46.4L196 47.4Z" fill="${color}"/>
    ${number !== '' ? `<text x="86" y="50.6" text-anchor="middle" font-family="Saira, sans-serif" font-weight="900" font-style="italic" font-size="15" fill="${ink}">${number}</text>` : ''}
  </svg>`;
}

export const car = (opts, extra) => frag(carSvg(opts, extra));
