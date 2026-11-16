// The daily season's result as a picture: 1080x1920, the shape of an Instagram,
// Threads or WhatsApp story. One tile per round, the car in the day's livery,
// the points and the streak, and where to play.
import { h, toast, copyText } from './dom.js';
import { openDialog } from './modals.js';
import { carSvg } from './car.js';
import { helmetSvg } from './helmet.js';
import { circuitInset } from './circuit.js';
import { svgImage, setFont, fit, wrap, roundRect, cjk } from './share.js';
import { dayShareText, dayWeekend, siteUrl } from './day.js';
import { dayNumber } from '../engine/oneseason.js';
import { CALENDARS, TRACKS } from '../data/tracks.js';
import { F1_TEAMS } from '../data/teams.js';
import { flagOf } from '../data/nations.js';
import { plural } from '../core/fmt.js';
import { t } from '../i18n.js';

const W = 1080;
const H = 1920;
const RED = '#e10600';
const PURPLE = '#b05cff';

// Tile colours, the same as the results strip.
const TILE = {
  win: { bg: PURPLE, edge: PURPLE, ink: '#ffffff' },
  pod: { bg: '#10361f', edge: '#1f6b46', ink: '#22d36f' },
  pts: { bg: '#2c2c35', edge: '#44444f', ink: '#f7f7f9' },
  nop: { bg: '#15151c', edge: '#2a2a33', ink: '#82828f' },
  dnf: { bg: '#3d1210', edge: '#6b2a27', ink: '#ff7a70' },
  out: { bg: '#101016', edge: '#2a2a33', ink: '#55555f' },
};
const kind = (x) => (!x || x.p === 0 ? 'out' : x.d ? 'dnf' : x.p === 1 ? 'win' : x.p <= 3 ? 'pod' : x.p <= 10 ? 'pts' : 'nop');
const label = (x) => (!x || x.p === 0 ? '–' : x.d ? '✕' : `P${x.p}`);

function kerb(g, y, hh) {
  for (let x = 0; x < W; x += 60) {
    g.fillStyle = (x / 60) % 2 ? '#ffffff' : RED;
    g.fillRect(x, y, 60, hh);
  }
}

export async function renderDayCard(sum, { streak = 0 } = {}) {
  const d = sum.day;
  try {
    await Promise.all([
      document.fonts.load('italic 900 80px Saira'),
      document.fonts.load('700 60px "Titillium Web"'),
      document.fonts.load(`600 30px "Titillium Web", ${cjk()}`),
      document.fonts.load('40px "Twemoji Country Flags"', '🇬🇧🇮🇹🇯🇵'),
    ]);
  } catch {
    // fall back to whatever fonts are available
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const team = F1_TEAMS.find((x) => x.id === d.teamId) || { color: d.color || RED, accent: '#ffffff' };
  const gp = dayWeekend(d);

  // background
  g.fillStyle = '#15151e';
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < W; x += 12) g.fillRect(x, y, 6, 6);
  const glow = g.createRadialGradient(W * 0.55, 470, 40, W * 0.55, 470, 760);
  glow.addColorStop(0, d.pos === 1 ? 'rgba(176,92,255,0.34)' : 'rgba(225,6,0,0.24)');
  glow.addColorStop(1, 'rgba(21,21,30,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  kerb(g, 0, 22);

  // brand and day
  g.fillStyle = '#ffffff';
  setFont(g, `italic 900 54px Saira, ${cjk()}`, 'expanded');
  g.fillText('LIGHTS OUT', 64, 118);
  g.fillStyle = PURPLE;
  setFont(g, `italic 900 40px Saira, ${cjk()}`, 'expanded');
  g.textAlign = 'right';
  g.fillText(t('Daily #{n}', { n: dayNumber(d.date) }), W - 64, 112);
  g.textAlign = 'left';
  setFont(g, `600 28px "Titillium Web", ${cjk()}`);
  g.fillStyle = '#b9b9c6';
  g.fillText(t('One Formula 1 season. Same car, same grid, same luck for everyone.'), 66, 162);

  // car, helmet, name
  g.save();
  setFont(g, 'italic 900 340px Saira', 'expanded');
  g.textAlign = 'right';
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.strokeText(String(sum.number ?? ''), W - 40, 520);
  g.restore();
  const carImg = await svgImage(carSvg({ color: team.color, accent: team.accent || '#ffffff', number: sum.number ?? '', helmet: sum.helmet?.c1 || '#fff' }));
  if (carImg) g.drawImage(carImg, 60, 210, 760, 311);
  const helmImg = await svgImage(helmetSvg(sum.helmet || {}));
  if (helmImg) g.drawImage(helmImg, 64, 560, 104, 84);
  g.fillStyle = '#ffffff';
  const who = `${sum.name} ${sum.flag}`;
  const nameSize = fit(g, who, 58, W - 270, (s) => `700 ${s}px "Twemoji Country Flags", "Titillium Web", ${cjk()}`);
  setFont(g, `700 ${nameSize}px "Twemoji Country Flags", "Titillium Web", ${cjk()}`);
  g.fillText(who, 190, 606);
  setFont(g, `600 30px "Titillium Web", ${cjk()}`);
  g.fillStyle = '#b9b9c6';
  g.fillText(`${d.team}  ${'★'.repeat(d.tier || 0)}${'☆'.repeat(5 - (d.tier || 0))}`, 192, 648);

  // the result
  const big = d.pos ? `P${d.pos}` : '–';
  g.fillStyle = d.pos === 1 ? '#d4af37' : d.pos && d.pos <= 3 ? '#22d36f' : '#ffffff';
  setFont(g, 'italic 900 230px Saira', 'expanded');
  g.fillText(big, 54, 880);
  const bigW = g.measureText(big).width;
  g.fillStyle = '#ffffff';
  setFont(g, 'italic 900 96px Saira', 'expanded');
  g.fillText(String(d.pts), 54 + bigW + 50, 800);
  setFont(g, `700 34px "Titillium Web", ${cjk()}`);
  g.fillStyle = '#b9b9c6';
  g.fillText(t('points'), 58 + bigW + 50, 850);
  setFont(g, `600 28px "Titillium Web", ${cjk()}`);
  g.fillStyle = '#82828f';
  g.fillText(cat([plural(d.wins, 'win'), plural(d.podiums, 'podium'), plural(d.poles, 'pole')]), 58, 940);

  // one tile per round
  const cal = CALENDARS.F1;
  const cols = 6;
  const gap = 14;
  const tw = (W - 128 - gap * (cols - 1)) / cols;
  const th = 118;
  const top = 990;
  for (let i = 0; i < d.of; i++) {
    const x = 64 + (i % cols) * (tw + gap);
    const y = top + Math.floor(i / cols) * (th + gap);
    const r = d.rounds[i];
    const k = kind(r);
    const col = TILE[k];
    g.fillStyle = col.bg;
    roundRect(g, x, y, tw, th, 14);
    g.fill();
    g.lineWidth = gp && gp.round === i ? 6 : 2;
    g.strokeStyle = gp && gp.round === i ? PURPLE : col.edge;
    g.stroke();
    const track = TRACKS[cal[i]];
    if (track) {
      const map = await svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${circuitInset(track.id, { x: 0, y: 0, w: 100, h: 100, stroke: k === 'win' ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.18)', width: 2.2 })}</svg>`);
      if (map) g.drawImage(map, x + tw - 64, y + 10, 54, 54);
      setFont(g, '34px "Twemoji Country Flags", sans-serif');
      g.fillText(flagOf(track.nat), x + 14, y + 46);
    }
    g.fillStyle = col.ink;
    setFont(g, 'italic 900 44px Saira', 'expanded');
    g.fillText(label(r), x + 14, y + th - 18);
  }
  let y = top + Math.ceil(d.of / cols) * (th + gap) + 30;

  // the real race this weekend, the team target and the streak
  setFont(g, `700 32px "Titillium Web", ${cjk()}`);
  const notes = [];
  if (gp?.result) notes.push([PURPLE, `🏁 ${t('{gp}: {result}', { gp: gp.name, result: gp.result })}`]);
  if (d.goal) notes.push([d.met ? '#22d36f' : '#ff7a70', d.met ? t('Team target met') : t('Team target missed')]);
  if (streak > 1) notes.push(['#ffd12e', `🔥 ${t('{n}-day streak', { n: streak })}`]);
  for (const [color, text] of notes) {
    g.fillStyle = color;
    for (const l of wrap(g, text, W - 128)) {
      g.fillText(l, 64, y);
      y += 46;
    }
  }

  // footer
  g.fillStyle = '#0b0b10';
  g.fillRect(0, H - 230, W, 230);
  kerb(g, H - 230, 10);
  g.fillStyle = '#ffffff';
  setFont(g, `italic 900 52px Saira, ${cjk()}`, 'expanded');
  const dare = t('Can you beat it?');
  fit(g, dare, 52, W - 128, (s) => `italic 900 ${s}px Saira, ${cjk()}`);
  g.fillText(dare, 64, H - 140);
  setFont(g, `700 34px "Titillium Web", ${cjk()}`);
  g.fillStyle = '#b9b9c6';
  g.fillText(t('Play free at {host}', { host: hostOf() }), 64, H - 74);
  return c;
}

const cat = (parts) => parts.filter(Boolean).join(' · ');

function hostOf() {
  try {
    return new URL(siteUrl()).host;
  } catch {
    return 'lights-out-racing.netlify.app';
  }
}

export async function openDayShare(sum, { streak = 0 } = {}) {
  const canvas = await renderDayCard(sum, { streak });
  const url = canvas.toDataURL('image/png');
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const name = `lights-out-daily-${sum.day.date}.png`;
  const file = blob ? new File([blob], name, { type: 'image/png' }) : null;
  const text = dayShareText(sum, { streak, tier: sum.day.tier });
  const canShareFile = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  const buttons = [
    h('a', { class: 'btn btn-go', href: url, download: name, style: 'font-size:16px;padding:10px 18px' }, t('Download image')),
    canShareFile
      ? h('button', {
          class: 'btn',
          onClick: async () => {
            try {
              await navigator.share({ files: [file], text });
            } catch {
              // the player closed the share sheet
            }
          },
        }, t('Share'))
      : null,
    h('button', {
      class: 'btn',
      onClick: async () => toast((await copyText(text)) ? t('Result copied. Paste it anywhere.') : t('Copy failed. Your browser blocked the clipboard.')),
    }, t('Copy text')),
  ];
  openDialog(
    t('Share your season'),
    h('div', { class: 'share-preview day-preview' }, h('img', { src: url, alt: t('Daily season #{n}: P{pos}, {pts}', { n: dayNumber(sum.day.date), pos: sum.day.pos, pts: plural(sum.day.pts, 'point') }) }), h('div', { class: 'row' }, buttons)),
  );
}

