import { frag } from './dom.js';

// A side-on racing helmet in the driver's two colours. Supporters get a gold ring.
export function helmet({ c1 = '#F2F2F2', c2 = '#E8002D' } = {}, { gold = false, label } = {}) {
  return frag(`<svg viewBox="0 0 72 58" xmlns="http://www.w3.org/2000/svg" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>
    ${gold ? '<ellipse cx="37" cy="30" rx="35" ry="27.5" fill="none" stroke="#D4AF37" stroke-width="2.2" stroke-dasharray="4 3"/>' : ''}
    <path d="M8 38C8 18 22 6 40 6c16 0 26 11 26 25v9c0 5-4 8-9 8H16c-5 0-8-4-8-10z" fill="${c1}"/>
    <path d="M11 31C15 20 27 12 42 12c10 0 18 5 22 12" fill="none" stroke="${c2}" stroke-width="6" stroke-linecap="round"/>
    <path d="M38 21h27c1 3 1.5 7 1.5 10H41c-4 0-6-3-5.5-6z" fill="#0b1220"/>
    <path d="M41 24h20" stroke="#40577f" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M16 48h41c0 3-3 5-7 5H22c-4 0-6-2-6-5z" fill="${c2}"/>
  </svg>`);
}
