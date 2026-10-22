import { h } from './dom.js';
import { car } from './car.js';
import { t } from '../i18n.js';

const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// A burst of confetti in the given colours. Draws on a throwaway canvas.
export function confetti(colors = ['#e10600', '#ffffff', '#ffd12e'], { count = 170, duration = 2600 } = {}) {
  if (reduced()) return;
  const canvas = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
  document.body.append(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = (canvas.width = innerWidth * dpr);
  const H = (canvas.height = innerHeight * dpr);
  const g = canvas.getContext('2d');
  const parts = Array.from({ length: count }, () => ({
    x: W * (0.15 + Math.random() * 0.7),
    y: H * (0.25 + Math.random() * 0.2),
    vx: (Math.random() - 0.5) * 14 * dpr,
    vy: (-8 - Math.random() * 11) * dpr,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: (6 + Math.random() * 6) * dpr,
    h: (3 + Math.random() * 4) * dpr,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (now) => {
    const t = now - start;
    g.clearRect(0, 0, W, H);
    g.globalAlpha = Math.max(0, 1 - Math.max(0, t - duration * 0.6) / (duration * 0.4));
    for (const p of parts) {
      p.vy += 0.32 * dpr;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
      g.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

// Full-screen moment for a championship.
export function takeover({ lines, year, sub, livery, onClose }) {
  const btn = h('button', { class: 'btn btn-go' }, t('Continue'));
  const el = h(
    'div',
    { class: 'takeover', role: 'dialog', 'aria-modal': 'true', 'aria-label': lines.join(' ') },
    h(
      'div',
      { class: 'in' },
      livery ? car(livery, { label: t('Your championship-winning car') }) : null,
      h('div', { class: 'yr' }, year),
      h('h2', null, h('span', null, lines[0]), lines[1]),
      sub ? h('p', null, sub) : null,
      btn,
    ),
  );
  const close = () => {
    el.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' || e.key === 'Enter') close();
  };
  btn.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(el);
  btn.focus();
}
