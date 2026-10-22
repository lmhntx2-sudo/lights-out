// A shareable career card: a 1080x1350 image for Instagram, WhatsApp and friends.
import { h, toast, copyText } from './dom.js';
import { openDialog } from './modals.js';
import { carSvg } from './car.js';
import { helmetSvg } from './helmet.js';
import { shareText, summaryWords } from '../engine/legacy.js';
import { money } from '../core/fmt.js';
import { t } from '../i18n.js';

const W = 1080;
const H = 1350;
const RED = '#e10600';
// Saira and Titillium have no Chinese, so names and text in Chinese fall back to these.
const CJK = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';

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

// Latin text breaks between words. Chinese has no spaces and may break between
// any two characters, but never just before a comma or a full stop.
const CJK_CHAR = '\u2E80-\u2FFF\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF';
const CLOSING = '、。，．：；！？」』）〉》】';
const TOKENS = new RegExp(`[${CJK_CHAR}][${CLOSING}]*|[^\\s${CJK_CHAR}]+[${CLOSING}]*\\s*|\\s+`, 'g');

function wrap(g, text, maxW) {
  const lines = [];
  let line = '';
  for (const tok of text.match(TOKENS) || []) {
    const next = line + tok;
    if (g.measureText(next.trimEnd()).width > maxW && line.trim()) {
      lines.push(line.trimEnd());
      line = tok.trimStart();
    } else line = next;
  }
  if (line.trim()) lines.push(line.trimEnd());
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
      document.fonts.load(`600 30px "Titillium Web", ${CJK}`),
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
  setFont(g, `italic 900 46px Saira, ${CJK}`, 'expanded');
  g.fillText('LIGHTS OUT', 64, 100);
  setFont(g, `600 26px "Titillium Web", ${CJK}`);
  g.fillStyle = '#b9b9c6';
  g.fillText(t('Racing career simulator'), 66, 136);
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
  const nameSize = fit(g, `${sum.name} ${sum.flag}`, 62, W - 260, (s) => `700 ${s}px "Twemoji Country Flags", "Titillium Web", ${CJK}`);
  setFont(g, `700 ${nameSize}px "Twemoji Country Flags", "Titillium Web", ${CJK}`);
  g.fillText(`${sum.name} ${sum.flag}`, 180, 568);
  setFont(g, `600 28px "Titillium Web", ${CJK}`);
  g.fillStyle = '#b9b9c6';
  const words = summaryWords(sum);
  g.fillText(`#${sum.number ?? ''}  ${t('{bg}, {style}', { bg: words.bg, style: words.style.toLowerCase() })}`, 182, 606);

  g.fillStyle = champ ? '#d4af37' : '#ffffff';
  setFont(g, `italic 900 86px Saira, ${CJK}`, 'expanded');
  let size = 86;
  const tier = words.tier.toUpperCase();
  let lines = wrap(g, tier, W - 128);
  while (lines.length > 2 && size > 40) {
    size -= 6;
    setFont(g, `italic 900 ${size}px Saira, ${CJK}`, 'expanded');
    lines = wrap(g, tier, W - 128);
  }
  lines.forEach((l, i) => g.fillText(l, 60, 712 + i * size * 0.95));
  const tierBottom = 712 + (lines.length - 1) * size * 0.95;

  // stat boxes
  const f = sum.f1;
  const stats = f.starts
    ? [[t('Titles'), f.titles], [t('Wins'), f.wins], [t('Podiums'), f.podiums], [t('Starts'), f.starts]]
    : [[t('Junior titles'), sum.junior.titles], [t('Junior wins'), sum.junior.wins], [t('Seasons'), sum.seasons], [t('Net worth'), money(sum.worth)]];
  const bw = (W - 128 - 3 * 20) / 4;
  const by = tierBottom + 50;
  stats.forEach(([k, v], i) => {
    const x = 64 + i * (bw + 20);
    g.fillStyle = '#0b0b10';
    roundRect(g, x, by, bw, 168, 14);
    g.fill();
    g.fillStyle = i === 0 && champ ? '#d4af37' : '#ffffff';
    fit(g, String(v), 76, bw - 40, (s) => `italic 900 ${s}px Saira, ${CJK}`);
    g.fillText(String(v), x + 22, by + 96);
    setFont(g, `600 26px "Titillium Web", ${CJK}`);
    g.fillStyle = '#82828f';
    g.fillText(k, x + 24, by + 140);
  });

  // story lines
  let y = by + 230;
  setFont(g, `600 30px "Titillium Web", ${CJK}`);
  g.fillStyle = '#f7f7f9';
  const facts = [];
  if (sum.ranks && (f.titles || f.wins)) facts.push(t('#{titles} all-time for titles, #{wins} for wins.', sum.ranks));
  const end = { age: sum.age, year: sum.endYear, money: money(sum.worth) };
  facts.push(sum.how === 'endurance' ? t('Left for endurance racing at {age} in {year}. Net worth {money}.', end) : t('Retired at {age} in {year}. Net worth {money}.', end));
  for (const fact of facts) {
    for (const l of wrap(g, fact, W - 128)) {
      g.fillText(l, 64, y);
      y += 42;
    }
  }
  if (sum.lines?.[0] && y < H - 230) {
    g.fillStyle = '#b9b9c6';
    setFont(g, `italic 600 28px "Titillium Web", ${CJK}`);
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
  setFont(g, `700 36px "Titillium Web", ${CJK}`);
  g.fillText(t('Play free at {host}', { host: location.host }), 64, H - 82);
  setFont(g, `600 26px "Titillium Web", ${CJK}`);
  g.fillStyle = '#82828f';
  g.fillText(t('Seed {seed}: same seed, same world', { seed: sum.seed }), 64, H - 40);
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
    h('a', { class: 'btn btn-go', href: url, download: `lights-out-${slug}.png`, style: 'font-size:16px;padding:10px 18px' }, t('Download image')),
    canShareFile
      ? h('button', {
          class: 'btn',
          onClick: async () => {
            try {
              await navigator.share({ files: [file], title: t('My Lights Out career'), text });
            } catch {
              // the player closed the share sheet
            }
          },
        }, t('Share'))
      : null,
    h('button', {
      class: 'btn',
      onClick: async () => toast((await copyText(text)) ? t('Career summary copied. Paste it anywhere.') : t('Copy failed. Your browser blocked the clipboard.')),
    }, t('Copy text')),
  ];
  openDialog(t('Share your career'), h('div', { class: 'share-preview' }, h('img', { src: url, alt: t('Career card for {name}: {tier}', { name: sum.name, tier: summaryWords(sum).tier }) }), h('div', { class: 'row' }, buttons)));
}
