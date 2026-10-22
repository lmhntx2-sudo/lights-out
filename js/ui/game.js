import { h, toast, copyText } from './dom.js';
import { helmet } from './helmet.js';
import { prompt, advance, choose, pickOffer, skipToDecision, simToSeasonEnd, retireNow } from '../engine/game.js';
import { PROLOGUE_AGE } from '../engine/events.js';
import { SINFO, STAT_LABEL } from '../engine/constants.js';
import { standingsOrder } from '../engine/market.js';
import { nameOf } from '../engine/world.js';
import { ovr } from '../engine/player.js';
import { ACH_BY_ID } from '../engine/achievements.js';
import { shareText } from '../engine/legacy.js';
import { nation } from '../data/nations.js';
import { money, plural, stars } from '../core/fmt.js';
import { store } from '../store.js';
import {
  openStandings, openProfile, openAchievements, openHallOfFame, openSettings, openBackup, openAbout,
  openDialog, confirmDialog, statBars, openLeaderboard, openSubmitDialog, boardResultText,
} from './modals.js';
import { canSubmit } from '../api.js';
import { openDonate, maybeNudge, coffeeButton } from './donate.js';
import { openRecords } from './modals.js';
import { car } from './car.js';
import { raceNumber } from '../engine/player.js';
import { confetti, takeover } from './celebrate.js';
import { sfx } from './sfx.js';
import { openShare } from './share.js';

const ROW = 26;

export function mountGame(app) {
  const hud = h('header', { class: 'hud' });
  const side = h('aside', { class: 'side', 'aria-label': 'Championship standings' });
  const feed = h('div', { class: 'feed' });
  const dock = h('div', { class: 'dock', role: 'region', 'aria-label': 'Your decision' });
  document.getElementById('app').replaceChildren(h('div', { class: 'game' }, hud, side, h('main', { class: 'main' }, feed, dock)));
  app.view = { hud, side, feed, dock, lastN: 0, latestRace: null };
  app.refresh = () => {
    renderHud(app);
    renderSide(app);
    renderDock(app);
  };
  renderFeedAll(app);
  app.refresh();
  requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
}

// Run an engine action, then patch the screen.
function act(app, fn, { animate = false } = {}) {
  const s = app.s;
  const pendN = s.pending?.n;
  const achBefore = s.ach.length;
  try {
    fn(s);
  } catch (e) {
    console.error(e);
    toast('Something went wrong with that step. Your career is saved up to the previous one.');
  }
  if (s.stage === 'retired' && s.retired && !s.retired.saved) {
    s.retired.saved = true;
    store.addLife(s.retired);
  }
  const freshAch = app.save();
  const prevN = app.view.lastN;
  const updated = pendN ? rerender(app, pendN) : null;
  const animated = animate && app.settings.anim !== 'off';
  const added = appendNew(app, animated);
  app.refresh();
  for (const id of s.ach.slice(achBefore)) if (freshAch.includes(id)) achToast(id);
  celebrate(app, s.feed.filter((e) => e.n > prevN), pendN ? s.feed.find((e) => e.n === pendN) : null, animated);
  if (s.nudge) {
    const reason = s.nudge;
    delete s.nudge;
    app.save();
    setTimeout(() => maybeNudge(app, reason), 2500);
  }
  reveal(app, updated, added);
}

// Sounds, confetti and the championship moment.
function celebrate(app, fresh, resolved, animated) {
  const motion = app.settings.anim !== 'off';
  if (resolved?.rolled) (resolved.ok ? sfx.ok : sfx.ko)();
  if (fresh.some((e) => e.k === 'event' && e.radio && e.picked == null)) setTimeout(sfx.radio, 300);
  const champ = fresh.find((e) => e.k === 'season' && e.champion);
  const win = fresh.filter((e) => e.k === 'race' && e.me && !e.me.dnf && e.me.pos === 1).pop();
  if (champ) {
    sfx.title();
    if (motion) confetti([champ.car?.color || '#e10600', '#ffffff', '#d4af37', '#b05cff'], { count: 260, duration: 3400 });
    takeover({
      lines: champ.series === 'F1' ? ['World', 'Champion'] : [champ.seriesName, 'Champion'],
      year: String(champ.year),
      sub: `${plural(champ.pts, 'point')} and ${plural(champ.wins, 'win')}. ${champ.series === 'F1' ? 'Your name is on the trophy forever.' : 'The next rung of the ladder is waiting.'}`,
      livery: champ.car ? { ...champ.car, helmet: app.s.driver.helmet?.c1 } : null,
    });
  } else if (win) {
    const fire = () => {
      sfx.win();
      if (motion) confetti([win.winner.color, '#ffffff', '#ffd12e']);
    };
    if (animated) setTimeout(fire, 1450 * (app.settings.anim === 'fast' ? 0.5 : 1));
    else fire();
  }
}

function reveal(app, updated, added) {
  const last = added[added.length - 1] || updated;
  if (!last) return;
  requestAnimationFrame(() => {
    const dockH = app.view.dock.offsetHeight + 12;
    const bottom = last.getBoundingClientRect().bottom + window.scrollY + dockH - window.innerHeight;
    const y = Math.max(window.scrollY, bottom);
    window.scrollTo({ top: y, behavior: app.settings.anim === 'off' ? 'auto' : 'smooth' });
  });
}

function achToast(id) {
  const a = ACH_BY_ID[id];
  if (!a) return;
  toast(h('div', { class: 'ach-t' }, h('span', { style: 'font-size:24px' }, a.icon), h('div', null, h('b', null, 'Achievement unlocked'), a.name)), { cls: 'ach-t', ms: 4500 });
}

// ------------------------------------------------------------------ feed

function renderFeedAll(app) {
  const { feed } = app.view;
  const entries = app.s.feed;
  const lastRace = [...entries].reverse().find((e) => e.k === 'race');
  feed.replaceChildren(...entries.map((e) => renderEntry(app, e, { latest: e === lastRace, animate: false })));
  app.view.lastN = entries.length ? entries[entries.length - 1].n : 0;
  app.view.latestRace = lastRace ? feed.querySelector(`[data-n="${lastRace.n}"]`) : null;
}

function appendNew(app, animate) {
  const v = app.view;
  const fresh = app.s.feed.filter((e) => e.n > v.lastN);
  const lastRace = [...fresh].reverse().find((e) => e.k === 'race');
  const els = fresh.map((e) => renderEntry(app, e, { latest: e === lastRace, animate: animate && e === lastRace }));
  if (lastRace && v.latestRace) v.latestRace.classList.add('compact');
  v.feed.append(...els);
  if (lastRace) v.latestRace = els[fresh.indexOf(lastRace)];
  if (fresh.length) v.lastN = fresh[fresh.length - 1].n;
  return els;
}

function rerender(app, n) {
  const old = app.view.feed.querySelector(`[data-n="${n}"]`);
  const e = app.s.feed.find((x) => x.n === n);
  if (!old || !e) return null;
  const el = renderEntry(app, e, {});
  old.replaceWith(el);
  return el;
}

function renderEntry(app, e, opts) {
  const fn = R[e.k];
  const el = fn ? fn(app, e, opts) : h('div', null);
  el.dataset.n = e.n;
  return el;
}

const toneClass = (t) => (t ? ` t-${t}` : '');

const BANNERS = { sc: 'Safety car', red: 'Red flag', rain: 'Rain' };

const R = {
  chapter: (app, e) =>
    h(
      'section',
      { class: 'f-chapter' },
      h('div', { class: 'big', 'aria-hidden': 'true' }, e.big),
      e.car ? car({ ...e.car, helmet: app.s.driver.helmet?.c1 }, { label: `Your ${e.year} car, number ${e.car.number}` }) : null,
      h(
        'div',
        { class: 'txt' },
        h('h2', null, e.color ? h('span', { class: 'dot', style: `background:${e.color}` }) : null, e.title),
        e.sub ? h('p', null, e.sub) : null,
        e.goal ? h('div', { class: 'goal' }, '🎯', h('span', null, 'Team target: ', h('b', null, e.goal))) : null,
      ),
    ),

  story: (app, e) => h('div', { class: `f-story${toneClass(e.tone)}` }, e.title ? h('b', null, e.title) : null, e.text),

  event: (app, e) => {
    const open = e.picked == null;
    const radio = e.radio
      ? h(
          'div',
          { class: 'radio' },
          h('i', { style: `background:${e.color || 'var(--ink-3)'}` }),
          h('div', null, h('small', null, radioIcon(), 'Team radio'), h('q', null, e.radio)),
        )
      : null;
    let picked = null;
    if (!open) {
      const c = e.choices[e.picked];
      const res = !e.rolled ? h('span', { class: 'res sure' }, 'Done') : e.ok ? h('span', { class: 'res ok' }, `Success, ${c.chance}%`) : h('span', { class: 'res ko' }, `Failed, ${c.chance}%`);
      picked = h(
        'div',
        { class: 'picked' },
        h('div', { class: 'choice-line' }, h('span', null, c.label), res),
        h('p', null, e.out),
        e.notes?.length ? h('div', { class: 'notes' }, e.notes.map((nt) => h('span', { class: `note ${nt.good ? 'good' : 'bad'}` }, nt.t))) : null,
      );
    }
    const banner = e.banner ? h('div', { class: `banner ${e.banner}` }, BANNERS[e.banner], h('small', null, 'Race control')) : null;
    return h('article', { class: `f-event${open ? ' open' : ''}` }, banner, h('h3', null, e.title), h('p', null, e.text), radio, picked);
  },

  race: (app, e, { latest, animate } = {}) => {
    const me = e.me;
    let pos;
    let cls;
    let small;
    if (!me) {
      pos = '–';
      cls = 'c-nop';
      small = e.mode === 'injured' ? 'injured' : 'watched';
    } else if (me.dnf) {
      pos = 'DNF';
      cls = 'c-dnf';
      small = me.why === 'mech' ? 'mechanical' : 'retired';
    } else {
      pos = `P${me.pos}`;
      cls = me.pos === 1 ? 'c-win' : me.pos <= 3 ? 'c-pod' : me.pts ? 'c-pts' : 'c-nop';
      small = me.pts ? `+${me.pts} pts` : `from P${me.grid}`;
    }
    const rc = [e.wet ? h('span', { class: 'rc wet' }, 'Wet') : null, e.sc ? h('span', { class: 'rc sc' }, 'SC') : null].filter(Boolean);
    const podium = me && !me.dnf && me.pos <= 3 && e.rows.length >= 3
      ? h(
          'div',
          { class: 'podium', 'aria-label': 'Podium' },
          [1, 0, 2].map((i) => {
            const r = e.rows.find((x) => x.pos === i + 1);
            return h('div', { class: `p${i + 1}${r?.me ? ' me-p' : ''}` }, r?.code || '', h('span', null, i + 1));
          }),
        )
      : null;
    const sumBits = [];
    if (e.winner.me) sumBits.push('You win the race.');
    else sumBits.push(`Won by ${e.winner.name}.`);
    if (me?.pole) sumBits.push('Pole position.');
    if (me?.fl) sumBits.push('Fastest lap.');
    if (e.mode === 'standin') sumBits.push('Stand-in drive.');
    if (e.champ) sumBits.push(`Championship: P${e.champ.pos}, ${plural(e.champ.pts, 'point')}.`);
    const wrap = h('article', { class: `f-race${latest ? '' : ' compact'}` });
    const tw = tower(e, animate, app.settings.anim === 'fast' ? 0.5 : 1);
    const toggle = h('div', { class: 'toggle' }, h('button', { type: 'button', onClick: () => wrap.classList.toggle('show') }, 'Classification'));
    wrap.append(...[
      h(
        'div',
        { class: 'hd' },
        h('span', { class: 'rnd' }, `R${e.round}`),
        h('span', { class: 'trk' }, `${e.flag} ${e.short}`, rc),
        h('span', { class: `res-pos ${cls}` }, pos, h('small', null, small)),
      ),
      h('div', { class: 'sum' }, sumBits.join(' ')),
      podium,
      toggle,
      tw,
    ].filter(Boolean));
    return wrap;
  },

  season: (app, e) => {
    const verdict = e.champion
      ? h('p', { class: 'verdict' }, h('b', null, `${e.seriesName} champion.`), ` ${plural(e.wins, 'win')}, ${plural(e.pts, 'point')}.`)
      : e.pos
        ? h('p', { class: 'verdict' }, 'You finish ', h('b', null, `P${e.pos}`), ` with ${plural(e.pts, 'point')}.`)
        : h('p', { class: 'verdict' }, 'A season on the sidelines.');
    const table = h(
      'table',
      { class: 'mini-table' },
      h('tbody', null, e.top.map((r) => h('tr', { class: r.me ? 'me' : '' }, h('td', null, r.pos), h('td', null, h('span', { class: 'dot', style: `background:${r.color || '#555'};margin-right:8px` }), r.name), h('td', { class: 'pts' }, r.pts)))),
    );
    const deltas = Object.entries(e.deltas || {});
    const bits = [];
    if (e.pos) bits.push(['Wins', e.wins], ['Podiums', e.podiums], ['Poles', e.poles]);
    if (e.income) bits.push(['Earned', money(e.income)]);
    const sl =
      e.series !== 'F1'
        ? h(
            'div',
            null,
            h('div', { class: 'sl-bar', role: 'img', 'aria-label': `Superlicence points ${e.slTotal} of 40` }, h('i', { style: `width:${Math.min(100, (e.slTotal / 40) * 100)}%` })),
            h('div', { class: 'kv' }, h('span', null, 'Superlicence points ', h('b', null, `${e.slTotal}/40`), e.sl ? ` (+${e.sl})` : '', e.licensed ? '. Licence secured.' : '')),
          )
        : null;
    return h(
      'section',
      { class: `f-season${e.champion ? ' champ' : ''}` },
      h('h3', null, `${e.year} ${e.seriesName}`),
      verdict,
      table,
      e.goal
        ? h(
            'div',
            { class: 'goal-line', style: 'margin:0 0 10px' },
            h('span', { class: `res ${e.goalMet ? 'ok' : 'ko'}` }, e.goalMet ? 'Target met' : 'Target missed'),
            h('span', null, `${e.goal}.`, e.goalMet ? ' The team is delighted.' : ' The team expected more.', e.goalBonus ? ` Bonus ${money(e.goalBonus)}.` : ''),
          )
        : null,
      h('div', { class: 'kv' }, bits.map(([k, v]) => h('span', null, `${k} `, h('b', null, v)))),
      e.tm ? h('div', { class: 'kv', style: 'margin-top:4px' }, h('span', null, `Teammate ${e.tm}: `, h('b', null, e.beatTm ? 'beaten' : e.tmPos ? 'ahead of you' : 'n/a'))) : null,
      deltas.length ? h('div', { class: 'notes', style: 'margin-top:10px' }, deltas.map(([k, v]) => h('span', { class: `note ${v > 0 ? 'good' : 'bad'}` }, `${v > 0 ? '+' : ''}${v} ${STAT_LABEL[k]}`))) : null,
      sl,
      e.f1Champ ? h('div', { class: 'kv', style: 'margin-top:8px' }, h('span', null, 'Formula 1 champion: ', h('b', null, e.f1Champ))) : null,
    );
  },

  mile: (app, e) => h('section', { class: `f-mile${toneClass(e.tone)}` }, h('h3', null, h('span', { 'aria-hidden': 'true' }, e.icon), e.title), h('p', null, e.text)),

  ach: (app, e) => h('div', { class: 'f-ach' }, h('span', { class: 'ic', 'aria-hidden': 'true' }, e.icon), h('span', null, 'Achievement: ', h('b', null, e.name), `. ${e.desc}`)),

  news: (app, e) => h('section', { class: 'f-news' }, h('h4', null, e.title), h('ul', null, e.lines.map((l) => h('li', null, l)))),

  retire: (app, e) => retireCard(app, e),
};

function radioIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M2 6v4M5 4v8M8 2v12M11 4v8M14 6v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>';
  return svg;
}

// ------------------------------------------------------------------ timing tower

function tower(e, animate, speed) {
  const status = h('div', { class: 'tower-status' });
  const box = h('div', { class: 'tower', style: `height:${e.rows.length * ROW}px` });
  const rows = e.rows.map((r) => {
    const tp = h('span', { class: 'tp' });
    const td = h('span', { class: 'td' });
    const el = h('div', { class: `trow${r.me ? ' me' : ''}${r.rival ? ' rival' : ''}` }, tp, h('i', { class: 'tb', style: `background:${r.color}` }), h('span', { class: 'tc' }, r.code), h('span', { class: 'tn' }, r.name), td);
    box.append(el);
    return { r, el, tp, td };
  });
  const place = (order, label) =>
    order.forEach((x, i) => {
      x.el.style.transform = `translateY(${i * ROW}px)`;
      label(x, i);
    });
  const byGrid = [...rows].sort((a, b) => a.r.grid - b.r.grid);
  const mid = [...rows].sort((a, b) => a.r.dnf - b.r.dnf || a.r.grid + a.r.pos * 1.4 - (b.r.grid + b.r.pos * 1.4));
  const byFinal = [...rows].sort((a, b) => a.r.pos - b.r.pos);
  const finalLabel = (x) => {
    x.tp.textContent = x.r.dnf ? 'DNF' : x.r.pos;
    x.el.classList.toggle('out', x.r.dnf);
    const d = x.r.grid - x.r.pos;
    x.td.textContent = x.r.dnf ? '' : d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '–';
    x.td.className = `td ${!x.r.dnf && d > 0 ? 'up' : !x.r.dnf && d < 0 ? 'down' : ''}`;
  };
  if (!animate) {
    place(byFinal, finalLabel);
    status.textContent = `Classification, ${e.track}`;
  } else {
    place(byGrid, (x) => {
      x.tp.textContent = x.r.grid;
      x.td.textContent = '';
    });
    status.textContent = `Lights out, ${e.track}`;
    setTimeout(() => {
      place(mid, (x) => {
        x.tp.textContent = '·';
        if (x.r.dnf) {
          x.el.classList.add('out');
          x.td.textContent = 'OUT';
        }
      });
      status.textContent = 'Half distance';
    }, 450 * speed);
    setTimeout(() => {
      place(byFinal, finalLabel);
      status.textContent = 'Chequered flag';
    }, 1500 * speed);
  }
  return h('div', { class: 'tower-wrap' }, status, box);
}

// ------------------------------------------------------------------ retirement

function retireCard(app, e) {
  const f = e.f1;
  const stats = f.starts
    ? [['Titles', f.titles], ['Wins', f.wins], ['Podiums', f.podiums], ['Starts', f.starts]]
    : [['Junior titles', e.junior.titles], ['Junior wins', e.junior.wins], ['Seasons', e.seasons], ['Net worth', money(e.worth)]];
  const shareBtn = h('button', { class: 'btn btn-go', style: 'font-size:16px;padding:10px 18px', onClick: () => openShare(e) }, 'Share your career card');
  const copyBtn = h('button', {
    class: 'btn',
    onClick: async () => {
      const ok = await copyText(shareText(e, location.origin + location.pathname));
      toast(ok ? 'Career summary copied. Paste it anywhere.' : 'Copy failed. Your browser blocked the clipboard.');
    },
  }, 'Copy as text');
  const rankLine = e.ranks && (f.titles || f.wins) ? h('p', { style: 'margin:0 0 12px;color:var(--ink)' }, `All-time: #${e.ranks.titles} for world titles and #${e.ranks.wins} for wins, out of ${e.ranks.of} Grand Prix drivers in history.`) : null;
  return h(
    'section',
    { class: 'f-retire' },
    h('div', { class: 'head' }, helmet(e.helmet, { gold: app.supporter }), h('div', null, h('b', null, `#${e.number ?? ''} ${e.name} ${e.flag}`), h('div', { style: 'color:var(--ink-3);font-size:14px' }, `${e.how === 'endurance' ? 'Left for endurance racing' : 'Retired'} at ${e.age}, ${e.endYear}. ${e.bg}, ${e.style.toLowerCase()}.`))),
    h('div', { class: 'tier' }, e.tier),
    h('div', { class: 'grid4' }, stats.map(([k, v]) => h('div', { class: 'big-stat' }, h('b', null, v), h('span', null, k)))),
    rankLine,
    h('ul', null, e.lines.map((l) => h('li', null, l))),
    h('div', { class: 'kv' }, h('span', null, 'Net worth ', h('b', null, money(e.worth))), h('span', null, 'Legacy score ', h('b', null, e.score)), h('span', null, 'Seed ', h('b', null, e.seed))),
    e.daily ? h('div', { class: 'kv', style: 'margin-top:6px' }, h('span', null, `Daily goal: ${e.daily.goalText} `, h('b', null, e.daily.done ? 'Completed' : 'Not completed'))) : null,
    h('div', { class: 'row', style: 'flex-wrap:wrap;margin-top:14px' }, shareBtn, copyBtn, f.starts ? h('button', { class: 'btn', onClick: () => openRecords(app) }, 'All-time records') : null, h('button', { class: 'btn', onClick: () => openHallOfFame(app) }, 'Hall of fame')),
    boardBox(app, e),
    app.supporter
      ? h('div', { class: 'thanks-box' }, h('p', { style: 'margin:0' }, '☕ Thank you for being in the pit crew. You keep this free for everyone.'))
      : h('div', { class: 'thanks-box' }, h('p', null, 'Enjoyed that career? Lights Out is free with no ads. A coffee keeps new teams, tracks and stories coming.'), coffeeButton(app, { reason: 'retire' })),
  );
}

// The global leaderboard part of the retirement card. It only goes online when
// a button is pressed, so the game itself never needs a connection.
function boardBox(app, e) {
  const box = h('div', { class: 'lb-box' });
  const draw = () => {
    const s = app.s;
    const b = s?.retired?.board;
    const view = h('button', { class: 'btn', onClick: () => openLeaderboard(app, { tab: e.daily ? 'daily' : 'all' }) }, 'View leaderboard');
    let text;
    let submit = null;
    if (b) text = `${boardResultText(b)} Submitted as ${b.name}.`;
    else if (canSubmit(s)) {
      text = 'See how this career ranks against everyone else’s. The server replays it from the seed to check it.';
      submit = h('button', { class: 'btn btn-go', onClick: () => openSubmitDialog(app, draw) }, 'Submit to the global leaderboard');
    } else text = 'This career began before the global leaderboard existed, so it cannot be verified. Your next one can.';
    box.replaceChildren(h('h4', null, 'Global leaderboard'), h('p', null, text), h('div', { class: 'row', style: 'flex-wrap:wrap' }, submit, view));
  };
  draw();
  return box;
}

// ------------------------------------------------------------------ header & side

function stat(label, value) {
  return h('div', { class: 'stat' }, h('b', null, value), h('span', null, label));
}

function renderHud(app) {
  const s = app.s;
  const d = s.driver;
  const c = s.career;
  const t = s.teams[c.team];
  const se = s.season;
  const order = se && se.stand.P ? standingsOrder(se.stand) : [];
  const champ = order.indexOf('P') + 1;
  const age = s.stage === 'prologue' ? PROLOGUE_AGE[s.proStep] ?? d.age : d.age;
  const num = raceNumber(s);
  app.view.hud.replaceChildren(
    h(
      'div',
      { class: 'who' },
      h('span', { class: `racenum${num === 1 ? ' one' : ''}`, 'aria-label': `Race number ${num}` }, num),
      helmet(d.helmet, { gold: app.supporter }),
      h(
        'div',
        { style: 'min-width:0' },
        h('div', { class: 'nm' }, `${d.name} `, nation(d.nat).flag),
        h(
          'div',
          { class: 'tm' },
          s.stage === 'prologue' ? 'Karting' : [h('span', { class: 'series' }, c.series), h('span', { class: 'dot', style: `background:${t?.color}` }), c.role === 'reserve' ? `${t?.short} reserve` : t?.name],
          app.supporter ? h('span', { class: 'supporter' }, '☕ Pit crew') : null,
        ),
      ),
    ),
    h(
      'div',
      { class: 'chips' },
      stat('Age', age),
      stat('Season', s.stage === 'prologue' ? 'Kids' : s.year),
      stat('Rating', ovr(s)),
      stat('Bank', money(d.money)),
      stat('Fame', Math.round(d.fame)),
      champ ? stat('Standing', `P${champ}`) : null,
    ),
    h(
      'div',
      { class: 'hud-actions' },
      se ? h('button', { class: 'btn btn-sm', onClick: () => openStandings(app) }, 'Standings') : null,
      h('button', { class: 'btn btn-sm', onClick: () => openProfile(app) }, 'Driver'),
      h('button', { class: 'btn btn-sm btn-coffee', onClick: () => openDonate(app), title: 'Fuel the dev', 'aria-label': 'Fuel the dev' }, '☕', h('span', { class: 'wide-only' }, 'Fuel the dev')),
      h('button', { class: 'btn btn-sm', onClick: () => openMenu(app) }, 'Menu'),
    ),
  );
}

function renderSide(app) {
  const s = app.s;
  const se = s.season;
  const side = app.view.side;
  const parts = [];
  if (se) {
    const order = standingsOrder(se.stand);
    let goalBox = null;
    if (se.goal) {
      const pos = order.indexOf('P') + 1;
      const pts = se.stand.P?.pts || 0;
      const on = se.goal.type === 'points' ? pts >= se.goal.n : pos > 0 && pos <= se.goal.n;
      goalBox = h(
        'div',
        { class: `goal-box ${se.round ? (on ? 'on' : 'off') : ''}` },
        h('b', null, `Team target: ${se.goal.text}`),
        se.round ? (on ? `On track. You are P${pos} with ${plural(pts, 'point')}.` : `Behind target. You are P${pos} with ${plural(pts, 'point')}.`) : 'The season has not started yet.',
      );
    }
    parts.push(
      h('h3', null, `${se.year} ${SINFO[se.series].name}`),
      h('div', { class: 'meta' }, se.round >= se.cal.length ? 'Final standings' : `After round ${se.round} of ${se.cal.length}`),
      goalBox,
      h(
        'ol',
        { class: 'stand' },
        order.map((id, i) => {
          const t = Object.values(s.teams).find((x) => x.seats.includes(id));
          return h(
            'li',
            { class: `${id === 'P' ? 'me' : ''}${i === 0 ? ' lead' : ''}` },
            h('span', { class: 'p' }, i + 1),
            h('i', { class: 'bar', style: `background:${t?.color || '#555'}` }),
            h('span', { class: 'n' }, id === 'P' ? s.driver.name : nameOf(s, id)),
            h('span', { class: 'pts' }, se.stand[id].pts),
          );
        }),
      ),
    );
  }
  parts.push(h('h3', { style: 'margin-top:22px' }, 'Your driver'), h('div', { class: 'meta' }, `Overall ${ovr(s)}`), statBars(s));
  side.replaceChildren(...parts.filter(Boolean));
}

// ------------------------------------------------------------------ dock

function ringClass(ch) {
  if (ch >= 100) return 'sure';
  if (ch >= 65) return 'hi';
  if (ch >= 35) return 'mid';
  return 'lo';
}

function renderDock(app) {
  const s = app.s;
  const p = prompt(s);
  const dock = app.view.dock;
  const inner = h('div', { class: 'dock-in' });

  if (p.type === 'choice') {
    inner.append(
      h('p', { class: 'dock-q' }, 'Your call'),
      ...p.choices.map((c, i) =>
        h(
          'button',
          { class: 'choice', onClick: () => act(app, (st) => choose(st, i), { animate: true }) },
          h('span', { class: `ring ${ringClass(c.chance)}`, style: `--p:${c.chance}`, 'aria-label': c.chance >= 100 ? 'Certain' : `${c.chance} percent chance` }, h('span', null, c.chance >= 100 ? 'Safe' : `${c.chance}%`)),
          h('span', { class: 'lab' }, c.label, c.stat || c.hint ? h('small', null, c.hint || `Depends on ${c.stat.toLowerCase()}`) : null),
        ),
      ),
    );
  } else if (p.type === 'race') {
    inner.append(
      h(
        'div',
        { class: 'race-next' },
        h(
          'button',
          { class: 'btn btn-go', onClick: () => act(app, advance, { animate: true }) },
          'Next race',
          h('small', null, `${p.flag} ${p.next}, round ${p.round} of ${p.of}`),
        ),
        h('button', { class: 'btn', onClick: () => act(app, skipToDecision), title: 'Race on until something needs your decision' }, 'Skip to next call'),
      ),
      h('div', { class: 'dock-more' }, h('button', { class: 'btn btn-ghost btn-sm', onClick: () => confirmDialog('Sim to the end of the season?', 'Every remaining race runs automatically. Decisions are made for you, always taking the safest option.', 'Sim the season', () => act(app, simToSeasonEnd)) }, 'Sim to season end')),
    );
  } else if (p.type === 'offers') {
    inner.append(h('p', { class: 'dock-q' }, `Your options for ${s.year + 1}`), h('div', { class: 'offers-wrap' }, p.offers.map((o, i) => offerButton(app, o, i))));
  } else if (p.type === 'retired') {
    inner.append(
      h(
        'div',
        { class: 'row', style: 'flex-wrap:wrap' },
        h('button', { class: 'btn btn-go', onClick: () => app.showTitle() }, 'Start a new career'),
      ),
    );
  } else {
    inner.append(h('button', { class: 'btn btn-go', onClick: () => act(app, advance) }, p.label));
  }
  dock.replaceChildren(inner);
}

function offerButton(app, o, i) {
  const s = app.s;
  const go = () => act(app, (st) => pickOffer(st, i));
  if (o.kind === 'retire' || o.kind === 'endurance') {
    return h(
      'button',
      { class: 'offer dim', onClick: () => confirmDialog(o.label, `${o.note ? `${o.note} ` : ''}This ends your career and shows your legacy.`, o.kind === 'retire' ? 'Retire' : 'Sign for endurance', go) },
      h('i', { style: 'background:var(--line)' }),
      h('div', null, h('b', null, o.label), o.note ? h('span', { class: 'meta' }, o.note) : null),
      h('span'),
    );
  }
  const cant = !!o.cost && o.cost > s.driver.money;
  const tagText = { promo: 'Promotion', stay: 'Same series', renew: 'Renewal', buyout: 'Buyout', signed: 'Pre-signed' }[o.tag] || (o.kind === 'stay' ? 'Under contract' : o.kind === 'reserve' ? 'Reserve role' : 'New team');
  const moneyEl =
    o.series === 'F1'
      ? h('span', { class: 'money' }, `${money(o.salary)}`, h('small', null, o.kind === 'stay' ? 'a year' : `a year, ${plural(o.years, 'year')}`))
      : h('span', { class: `money ${cant ? 'cant' : ''}` }, o.cost ? money(o.cost) : 'Free', h('small', null, o.cost ? (cant ? 'You cannot afford it' : 'Seat cost') : s.driver.academy ? 'Academy pays' : 'Team pays'));
  return h(
    'button',
    { class: 'offer', disabled: cant, onClick: go },
    h('i', { style: `background:${o.color}` }),
    h(
      'div',
      null,
      h('b', null, o.kind === 'stay' ? `Stay at ${o.name}` : o.kind === 'reserve' ? `Reserve driver, ${o.name}` : o.name, h('span', { class: 'series' }, o.series)),
      h('span', { class: 'meta' }, `${tagText}. Car `, h('span', { class: 'tier-stars', 'aria-label': `${o.tier} out of 5` }, stars(o.tier))),
      o.note ? h('span', { class: 'note' }, o.note) : null,
    ),
    moneyEl,
  );
}

// ------------------------------------------------------------------ menu

function openMenu(app) {
  let dlg;
  const item = (label, fn, cls = 'btn') => h('button', { class: cls, onClick: () => { dlg.close(); fn(); } }, label);
  const body = h(
    'div',
    { class: 'menu-list' },
    item('Save and go to the title screen', () => app.showTitle()),
    item('Achievements', () => openAchievements(app)),
    item('Hall of fame', () => openHallOfFame(app)),
    item('Global leaderboard', () => openLeaderboard(app)),
    item('All-time records', () => openRecords(app)),
    item('Settings', () => openSettings(app)),
    item('Backup', () => openBackup(app)),
    item('About', () => openAbout()),
    app.s.stage !== 'retired'
      ? item('Retire now', () => confirmDialog('Retire now?', 'Your career ends here and your legacy is written.', 'Retire', () => act(app, retireNow)), 'btn btn-ghost')
      : null,
    h('p', { class: 'credits' }, `Seed ${app.s.seed}`),
  );
  dlg = openDialog('Menu', body);
}
