// A shareable career card: a 1080x1350 image for Instagram, WhatsApp and friends.
import { h, toast, copyText } from './dom.js';
import { openDialog } from './modals.js';
import { carSvg } from './car.js';
import { helmetSvg } from './helmet.js';
import { shareText } from '../engine/legacy.js';
import { money } from '../core/fmt.js';

const W = 1080;
const H = 1350;
const RED = '#e10600';

function svgImage(markup) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

function setFont(g, font, stretch = 'normal') {
  g.font = font;
  if ('fontStretch' in g) g.fontStretch = stretch;
}

// Shrink a font until the text fits.
function fit(g, text, base, maxW, make) {
  let size = base;
  setFont(g, make(size), 'expanded');
  while (g.measureText(text).width > maxW && size > 20) {
    size -= 2;
    setFont(g, make(size), 'expanded');
  }
  return size;
}

function wrap(g, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(g, x, y, w, hh, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + hh, r);
  g.arcTo(x + w, y + hh, x, y + hh, r);
  g.arcTo(x, y + hh, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export async function renderCard(sum) {
  try {
    await Promise.all([
      document.fonts.load('italic 900 80px Saira'),
      document.fonts.load('700 60px "Titillium Web"'),
      document.fonts.load('600 30px "Titillium Web"'),
      document.fonts.load('60px "Twemoji Country Flags"', sum.flag),
    ]);
  } catch {
    // fall back to whatever fonts are available
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const champ = sum.f1.titles > 0;
  const livery = sum.livery || { color: RED, accent: '#ffffff' };

  g.fillStyle = '#15151e';
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < W; x += 12) g.fillRect(x, y, 6, 6);
  const glow = g.createRadialGradient(W * 0.62, 360, 40, W * 0.62, 360, 720);
  glow.addColorStop(0, champ ? 'rgba(176,92,255,0.30)' : 'rgba(225,6,0,0.22)');
  glow.addColorStop(1, 'rgba(21,21,30,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 60) {
    g.fillStyle = (x / 60) % 2 ? '#ffffff' : RED;
    g.fillRect(x, 0, 60, 18);
  }

  // brand and start lights
  g.fillStyle = '#ffffff';
  setFont(g, 'italic 900 46px Saira', 'expanded');
  g.fillText('LIGHTS OUT', 64, 100);
  setFont(g, '600 26px "Titillium Web"');
  g.fillStyle = '#b9b9c6';
  g.fillText('Racing career simulator', 66, 136);
  for (let i = 0; i < 5; i++) {
    const x = W - 64 - (5 - i) * 56 + 8;
    g.fillStyle = '#050508';
    roundRect(g, x, 52, 46, 92, 8);
    g.fill();
    for (const cy of [76, 120]) {
      g.beginPath();
      g.arc(x + 23, cy, 15, 0, Math.PI * 2);
      g.fillStyle = '#3a1416';
      g.fill();
    }
  }

  // race number, car and helmet
  g.save();
  setFont(g, 'italic 900 380px Saira', 'expanded');
  g.textAlign = 'right';
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(255,255,255,0.13)';
  g.strokeText(String(sum.number ?? ''), W - 40, 560);
  g.restore();
  const carImg = await svgImage(carSvg({ color: livery.color, accent: livery.accent, helmet: sum.helmet?.c1 || '#fff' }));
  if (carImg) g.drawImage(carImg, 40, 200, 660, 270);
  const helmImg = await svgImage(helmetSvg(sum.helmet || {}));
  if (helmImg) g.drawImage(helmImg, 64, 520, 96, 77);

  // name and tier
  g.fillStyle = '#ffffff';
  const nameSize = fit(g, `${sum.name} ${sum.flag}`, 62, W - 260, (s) => `700 ${s}px "Twemoji Country Flags", "Titillium Web"`);
  setFont(g, `700 ${nameSize}px "Twemoji Country Flags", "Titillium Web"`);
  g.fillText(`${sum.name} ${sum.flag}`, 180, 568);
  setFont(g, '600 28px "Titillium Web"');
  g.fillStyle = '#b9b9c6';
  g.fillText(`#${sum.number ?? ''}  ${sum.bg}, ${sum.style.toLowerCase()}`, 182, 606);

  g.fillStyle = champ ? '#d4af37' : '#ffffff';
  setFont(g, 'italic 900 86px Saira', 'expanded');
  let size = 86;
  let lines = wrap(g, sum.tier.toUpperCase(), W - 128);
  while (lines.length > 2 && size > 40) {
    size -= 6;
    setFont(g, `italic 900 ${size}px Saira`, 'expanded');
    lines = wrap(g, sum.tier.toUpperCase(), W - 128);
  }
  lines.forEach((l, i) => g.fillText(l, 60, 712 + i * size * 0.95));
  const tierBottom = 712 + (lines.length - 1) * size * 0.95;

  // stat boxes
  const f = sum.f1;
  const stats = f.starts
    ? [['Titles', f.titles], ['Wins', f.wins], ['Podiums', f.podiums], ['Starts', f.starts]]
    : [['Junior titles', sum.junior.titles], ['Junior wins', sum.junior.wins], ['Seasons', sum.seasons], ['Net worth', money(sum.worth)]];
  const bw = (W - 128 - 3 * 20) / 4;
  const by = tierBottom + 50;
  stats.forEach(([k, v], i) => {
    const x = 64 + i * (bw + 20);
    g.fillStyle = '#0b0b10';
    roundRect(g, x, by, bw, 168, 14);
    g.fill();
    g.fillStyle = i === 0 && champ ? '#d4af37' : '#ffffff';
    fit(g, String(v), 76, bw - 40, (s) => `italic 900 ${s}px Saira`);
    g.fillText(String(v), x + 22, by + 96);
    setFont(g, '600 26px "Titillium Web"');
    g.fillStyle = '#82828f';
    g.fillText(k, x + 24, by + 140);
  });

  // story lines
  let y = by + 230;
  setFont(g, '600 30px "Titillium Web"');
  g.fillStyle = '#f7f7f9';
  const facts = [];
  if (sum.ranks && (f.titles || f.wins)) facts.push(`#${sum.ranks.titles} all-time for titles, #${sum.ranks.wins} for wins.`);
  facts.push(`${sum.how === 'endurance' ? 'Left for endurance racing' : 'Retired'} at ${sum.age} in ${sum.endYear}. Net worth ${money(sum.worth)}.`);
  for (const fact of facts) {
    for (const l of wrap(g, fact, W - 128)) {
      g.fillText(l, 64, y);
      y += 42;
    }
  }
  if (sum.lines?.[0] && y < H - 230) {
    g.fillStyle = '#b9b9c6';
    setFont(g, 'italic 600 28px "Titillium Web"');
    for (const l of wrap(g, sum.lines[0], W - 128).slice(0, 2)) {
      g.fillText(l, 64, y + 6);
      y += 40;
    }
  }

  // footer
  g.fillStyle = '#0b0b10';
  g.fillRect(0, H - 150, W, 150);
  for (let x = 0; x < W; x += 60) {
    g.fillStyle = (x / 60) % 2 ? '#ffffff' : RED;
    g.fillRect(x, H - 150, 60, 8);
  }
  g.fillStyle = '#ffffff';
  setFont(g, '700 36px "Titillium Web"');
  g.fillText(`Play free at ${location.host}`, 64, H - 82);
  setFont(g, '600 26px "Titillium Web"');
  g.fillStyle = '#82828f';
  g.fillText(`Seed ${sum.seed}: same seed, same world`, 64, H - 40);
  return c;
}

export async function openShare(sum) {
  const canvas = await renderCard(sum);
  const url = canvas.toDataURL('image/png');
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const slug = sum.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'career';
  const file = blob ? new File([blob], `lights-out-${slug}.png`, { type: 'image/png' }) : null;
  const text = shareText(sum, location.origin + location.pathname);
  const canShareFile = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));

  const buttons = [
    h('a', { class: 'btn btn-go', href: url, download: `lights-out-${slug}.png`, style: 'font-size:16px;padding:10px 18px' }, 'Download image'),
    canShareFile
      ? h('button', {
          class: 'btn',
          onClick: async () => {
            try {
              await navigator.share({ files: [file], title: 'My Lights Out career', text });
            } catch {
              // the player closed the share sheet
            }
          },
        }, 'Share')
      : null,
    h('button', {
      class: 'btn',
      onClick: async () => toast((await copyText(text)) ? 'Career summary copied. Paste it anywhere.' : 'Copy failed. Your browser blocked the clipboard.'),
    }, 'Copy text'),
  ];
  openDialog('Share your career', h('div', { class: 'share-preview' }, h('img', { src: url, alt: `Career card for ${sum.name}: ${sum.tier}` }), h('div', { class: 'row' }, buttons)));
}
