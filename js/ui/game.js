import { h, toast, copyText } from './dom.js';
import { helmet } from './helmet.js';
import { prompt, advance, choose, pickOffer, skipToDecision, simToSeasonEnd, retireNow, roundName, goalText } from '../engine/game.js';
import { PROLOGUE_AGE } from '../engine/events.js';
import { standingsOrder, offerNote, offerLabel } from '../engine/market.js';
import { nameOf } from '../engine/world.js';
import { ovr } from '../engine/player.js';
import { ACH_BY_ID, achWords } from '../engine/achievements.js';
import { shareText, summaryWords } from '../engine/legacy.js';
import { dailyGoalText } from '../engine/daily.js';
import { TRACKS } from '../data/tracks.js';
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
import { t, tn, cat, isZh, statName, seriesName, trackShortById } from '../i18n.js';

const ROW = 26;

export function mountGame(app) {
  const hud = h('header', { class: 'hud' });
  const side = h('aside', { class: 'side', 'aria-label': t('Championship standings') });
  const feed = h('div', { class: 'feed' });
  const dock = h('div', { class: 'dock', role: 'region', 'aria-label': t('Your decision') });
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
    toast(t('Something went wrong with that step. Your career is saved up to the previous one.'));
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
  for (const id of s.ach.slice(achBefore)) if (freshAch.includes(id)) achToast(id, s.driver.nat);
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
    const record = t('{pts} and {wins}.', { pts: plural(champ.pts, 'point'), wins: plural(champ.wins, 'win') });
    takeover({
      lines: champ.series === 'F1' ? [t('World'), t('Champion')] : [seriesName(champ.series), t('Champion')],
      year: String(champ.year),
      sub: cat(record, champ.series === 'F1' ? t('Your name is on the trophy forever.') : t('The next rung of the ladder is waiting.')),
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

function achToast(id, nat) {
  const a = ACH_BY_ID[id];
  if (!a) return;
  const w = achWords(a, nat);
  toast(h('div', { class: 'ach-t' }, h('span', { style: 'font-size:24px' }, w.icon), h('div', null, h('b', null, t('Achievement unlocked')), w.name)), { cls: 'ach-t', ms: 4500 });
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

const toneClass = (tone) => (tone ? ` t-${tone}` : '');

const BANNERS = { sc: () => t('Safety car'), red: () => t('Red flag'), rain: () => t('Rain') };

// Race and season cards keep ids, so they follow the current language even in old entries.
const raceTrack = (e) => (e.trackId && TRACKS[e.trackId] ? roundName(TRACKS[e.trackId], e.series) : e.track);
const entryGoal = (e) => (e.gs ? goalText(e.gs) : e.goal);

const R = {
  chapter: (app, e) =>
    h(
      'section',
      { class: 'f-chapter' },
      h('div', { class: 'big', 'aria-hidden': 'true' }, e.big),
      e.car ? car({ ...e.car, helmet: app.s.driver.helmet?.c1 }, { label: t('Your {year} car, number {n}', { year: e.year, n: e.car.number }) }) : null,
      h(
        'div',
        { class: 'txt' },
        h('h2', null, e.color ? h('span', { class: 'dot', style: `background:${e.color}` }) : null, e.title),
        e.sub ? h('p', null, e.sub) : null,
        e.goal ? h('div', { class: 'goal' }, '🎯', h('span', null, ...tn('Team target: {goal}', { goal: h('b', null, entryGoal(e)) }))) : null,
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
          h('div', null, h('small', null, radioIcon(), t('Team radio')), h('q', null, e.radio)),
        )
      : null;
    let picked = null;
    if (!open) {
      const c = e.choices[e.picked];
      const res = !e.rolled
        ? h('span', { class: 'res sure' }, t('Done'))
        : e.ok
          ? h('span', { class: 'res ok' }, t('Success, {n}%', { n: c.chance }))
          : h('span', { class: 'res ko' }, t('Failed, {n}%', { n: c.chance }));
      picked = h(
        'div',
        { class: 'picked' },
        h('div', { class: 'choice-line' }, h('span', null, c.label), res),
        h('p', null, e.out),
        e.notes?.length ? h('div', { class: 'notes' }, e.notes.map((nt) => h('span', { class: `note ${nt.good ? 'good' : 'bad'}` }, nt.t))) : null,
      );
    }
    const banner = e.banner ? h('div', { class: `banner ${e.banner}` }, BANNERS[e.banner]?.(), h('small', null, t('Race control'))) : null;
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
      small = e.mode === 'injured' ? t('injured') : t('watched');
    } else if (me.dnf) {
      pos = t('DNF');
      cls = 'c-dnf';
      small = me.why === 'mech' ? t('mechanical') : t('retired');
    } else {
      pos = `P${me.pos}`;
      cls = me.pos === 1 ? 'c-win' : me.pos <= 3 ? 'c-pod' : me.pts ? 'c-pts' : 'c-nop';
      small = me.pts ? t('+{n} pts', { n: me.pts }) : t('from P{n}', { n: me.grid });
    }
    const rc = [e.wet ? h('span', { class: 'rc wet' }, t('Wet')) : null, e.sc ? h('span', { class: 'rc sc' }, t('SC')) : null].filter(Boolean);
    const podium = me && !me.dnf && me.pos <= 3 && e.rows.length >= 3
      ? h(
          'div',
          { class: 'podium', 'aria-label': t('Podium') },
          [1, 0, 2].map((i) => {
            const r = e.rows.find((x) => x.pos === i + 1);
            return h('div', { class: `p${i + 1}${r?.me ? ' me-p' : ''}` }, r?.code || '', h('span', null, i + 1));
          }),
        )
      : null;
    const sumBits = [];
    if (e.winner.me) sumBits.push(t('You win the race.'));
    else sumBits.push(t('Won by {name}.', { name: e.winner.name }));
    if (me?.pole) sumBits.push(t('Pole position.'));
    if (me?.fl) sumBits.push(t('Fastest lap.'));
    if (e.mode === 'standin') sumBits.push(t('Stand-in drive.'));
    if (e.special) sumBits.push(t('Non-championship race.'));
    if (e.champ) sumBits.push(t('Championship: P{pos}, {pts}.', { pos: e.champ.pos, pts: plural(e.champ.pts, 'point') }));
    const wrap = h('article', { class: `f-race${latest ? '' : ' compact'}` });
    const tw = tower(e, animate, app.settings.anim === 'fast' ? 0.5 : 1);
    const toggle = h('div', { class: 'toggle' }, h('button', { type: 'button', onClick: () => wrap.classList.toggle('show') }, t('Classification')));
    wrap.append(...[
      h(
        'div',
        { class: 'hd' },
        h('span', { class: 'rnd' }, e.special ? 'GP' : `R${e.round}`),
        h('span', { class: 'trk' }, `${e.flag} ${trackShortById(e.trackId, e.short)}`, rc),
        h('span', { class: `res-pos ${cls}` }, pos, h('small', null, small)),
      ),
      h('div', { class: 'sum' }, cat(...sumBits)),
      podium,
      toggle,
      tw,
    ].filter(Boolean));
    return wrap;
  },

  season: (app, e) => {
    const series = seriesName(e.series);
    const verdict = e.champion
      ? h('p', { class: 'verdict' }, h('b', null, t('{series} champion.', { series })), `${isZh() ? '' : ' '}${t('{wins}, {pts}.', { wins: plural(e.wins, 'win'), pts: plural(e.pts, 'point') })}`)
      : e.pos
        ? h('p', { class: 'verdict' }, ...tn('You finish {pos} with {pts}.', { pos: h('b', null, `P${e.pos}`), pts: plural(e.pts, 'point') }))
        : h('p', { class: 'verdict' }, t('A season on the sidelines.'));
    const table = h(
      'table',
      { class: 'mini-table' },
      h('tbody', null, e.top.map((r) => h('tr', { class: r.me ? 'me' : '' }, h('td', null, r.pos), h('td', null, h('span', { class: 'dot', style: `background:${r.color || '#555'};margin-right:8px` }), r.name), h('td', { class: 'pts' }, r.pts)))),
    );
    const deltas = Object.entries(e.deltas || {});
    const bits = [];
    if (e.pos) bits.push([t('Wins'), e.wins], [t('Podiums'), e.podiums], [t('Poles'), e.poles]);
    if (e.income) bits.push([t('Earned'), money(e.income)]);
    const sl =
      e.series !== 'F1'
        ? h(
            'div',
            null,
            h('div', { class: 'sl-bar', role: 'img', 'aria-label': t('Superlicence points {n} of 40', { n: e.slTotal }) }, h('i', { style: `width:${Math.min(100, (e.slTotal / 40) * 100)}%` })),
            h('div', { class: 'kv' }, h('span', null, t('Superlicence points '), h('b', null, `${e.slTotal}/40`), e.sl ? ` (+${e.sl})` : '', e.licensed ? t('. Licence secured.') : '')),
          )
        : null;
    return h(
      'section',
      { class: `f-season${e.champion ? ' champ' : ''}` },
      h('h3', null, t('{year} {series}', { year: e.year, series })),
      verdict,
      table,
      e.goal
        ? h(
            'div',
            { class: 'goal-line', style: 'margin:0 0 10px' },
            h('span', { class: `res ${e.goalMet ? 'ok' : 'ko'}` }, e.goalMet ? t('Target met') : t('Target missed')),
            h('span', null, t('{goal}.', { goal: entryGoal(e) }), e.goalMet ? t(' The team is delighted.') : t(' The team expected more.'), e.goalBonus ? t(' Bonus {money}.', { money: money(e.goalBonus) }) : ''),
          )
        : null,
      h('div', { class: 'kv' }, bits.map(([k, v]) => h('span', null, `${k} `, h('b', null, v)))),
      e.tm ? h('div', { class: 'kv', style: 'margin-top:4px' }, h('span', null, t('Teammate {name}: ', { name: e.tm }), h('b', null, e.beatTm ? t('beaten') : e.tmPos ? t('ahead of you') : t('n/a')))) : null,
      deltas.length ? h('div', { class: 'notes', style: 'margin-top:10px' }, deltas.map(([k, v]) => h('span', { class: `note ${v > 0 ? 'good' : 'bad'}` }, `${v > 0 ? '+' : ''}${v} ${statName(k)}`))) : null,
      sl,
      e.f1Champ ? h('div', { class: 'kv', style: 'margin-top:8px' }, h('span', null, t('Formula 1 champion: '), h('b', null, e.f1Champ))) : null,
    );
  },

  mile: (app, e) => h('section', { class: `f-mile${toneClass(e.tone)}` }, h('h3', null, h('span', { 'aria-hidden': 'true' }, e.icon), e.title), h('p', null, e.text)),

  ach: (app, e) => {
    const a = ACH_BY_ID[e.id];
    const w = a ? achWords(a, app.s.driver.nat) : { name: e.name, desc: e.desc };
    return h('div', { class: 'f-ach' }, h('span', { class: 'ic', 'aria-hidden': 'true' }, e.icon), h('span', null, ...tn('Achievement: {name}. {desc}', { name: h('b', null, w.name), desc: w.desc })));
  },

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
  const track = raceTrack(e);
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
    x.tp.textContent = x.r.dnf ? t('DNF') : x.r.pos;
    x.el.classList.toggle('out', x.r.dnf);
    const d = x.r.grid - x.r.pos;
    x.td.textContent = x.r.dnf ? '' : d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '–';
    x.td.className = `td ${!x.r.dnf && d > 0 ? 'up' : !x.r.dnf && d < 0 ? 'down' : ''}`;
  };
  if (!animate) {
    place(byFinal, finalLabel);
    status.textContent = t('Classification, {track}', { track });
  } else {
    place(byGrid, (x) => {
      x.tp.textContent = x.r.grid;
      x.td.textContent = '';
    });
    status.textContent = t('Lights out, {track}', { track });
    setTimeout(() => {
      place(mid, (x) => {
        x.tp.textContent = '·';
        if (x.r.dnf) {
          x.el.classList.add('out');
          x.td.textContent = t('OUT');
        }
      });
      status.textContent = t('Half distance');
    }, 450 * speed);
    setTimeout(() => {
      place(byFinal, finalLabel);
      status.textContent = t('Chequered flag');
    }, 1500 * speed);
  }
  return h('div', { class: 'tower-wrap' }, status, box);
}

// ------------------------------------------------------------------ retirement

function retireCard(app, e) {
  const f = e.f1;
  const words = summaryWords(e);
  const stats = f.starts
    ? [[t('Titles'), f.titles], [t('Wins'), f.wins], [t('Podiums'), f.podiums], [t('Starts'), f.starts]]
    : [[t('Junior titles'), e.junior.titles], [t('Junior wins'), e.junior.wins], [t('Seasons'), e.seasons], [t('Net worth'), money(e.worth)]];
  const shareBtn = h('button', { class: 'btn btn-go', style: 'font-size:16px;padding:10px 18px', onClick: () => openShare(e) }, t('Share your career card'));
  const copyBtn = h('button', {
    class: 'btn',
    onClick: async () => {
      const ok = await copyText(shareText(e, location.origin + location.pathname));
      toast(ok ? t('Career summary copied. Paste it anywhere.') : t('Copy failed. Your browser blocked the clipboard.'));
    },
  }, t('Copy as text'));
  const rankLine = e.ranks && (f.titles || f.wins)
    ? h('p', { style: 'margin:0 0 12px;color:var(--ink)' }, t('All-time: #{titles} for world titles and #{wins} for wins, out of {of} Grand Prix drivers in history.', e.ranks))
    : null;
  const how = e.how === 'endurance' ? t('Left for endurance racing at {age}, {year}.', { age: e.age, year: e.endYear }) : t('Retired at {age}, {year}.', { age: e.age, year: e.endYear });
  const daily = e.daily ? dailyGoalText(e.daily.goal, e.daily.goalText) : '';
  return h(
    'section',
    { class: 'f-retire' },
    h('div', { class: 'head' }, helmet(e.helmet, { gold: app.supporter }), h('div', null, h('b', null, `#${e.number ?? ''} ${e.name} ${e.flag}`), h('div', { style: 'color:var(--ink-3);font-size:14px' }, cat(how, t('{bg}, {style}.', { bg: words.bg, style: words.style.toLowerCase() }))))),
    h('div', { class: 'tier' }, words.tier),
    h('div', { class: 'grid4' }, stats.map(([k, v]) => h('div', { class: 'big-stat' }, h('b', null, v), h('span', null, k)))),
    rankLine,
    h('ul', null, e.lines.map((l) => h('li', null, l))),
    h('div', { class: 'kv' }, h('span', null, t('Net worth '), h('b', null, money(e.worth))), h('span', null, t('Legacy score '), h('b', null, e.score)), h('span', null, t('Seed '), h('b', null, e.seed))),
    e.daily ? h('div', { class: 'kv', style: 'margin-top:6px' }, h('span', null, t('Daily goal: {goal} ', { goal: daily }), h('b', null, e.daily.done ? t('Completed') : t('Not completed')))) : null,
    h('div', { class: 'row', style: 'flex-wrap:wrap;margin-top:14px' }, shareBtn, copyBtn, f.starts ? h('button', { class: 'btn', onClick: () => openRecords(app) }, t('All-time records')) : null, h('button', { class: 'btn', onClick: () => openHallOfFame(app) }, t('Hall of fame'))),
    boardBox(app, e),
    app.supporter
      ? h('div', { class: 'thanks-box' }, h('p', { style: 'margin:0' }, t('☕ Thank you for being in the pit crew. You keep this free for everyone.')))
      : h('div', { class: 'thanks-box' }, h('p', null, t('Enjoyed that career? Lights Out is free with no ads. A coffee keeps new teams, tracks and stories coming.')), coffeeButton(app, { reason: 'retire' })),
  );
}

// The global leaderboard part of the retirement card. It only goes online when
// a button is pressed, so the game itself never needs a connection.
function boardBox(app, e) {
  const box = h('div', { class: 'lb-box' });
  const draw = () => {
    const s = app.s;
    const b = s?.retired?.board;
    const view = h('button', { class: 'btn', onClick: () => openLeaderboard(app, { tab: e.daily ? 'daily' : 'all' }) }, t('View leaderboard'));
    let text;
    let submit = null;
    if (b) text = cat(boardResultText(b), t('Submitted as {name}.', { name: b.name }));
    else if (canSubmit(s)) {
      text = t('See how this career ranks against everyone else’s. The server replays it from the seed to check it.');
      submit = h('button', { class: 'btn btn-go', onClick: () => openSubmitDialog(app, draw) }, t('Submit to the global leaderboard'));
    } else text = t('This career began before the global leaderboard existed, so it cannot be verified. Your next one can.');
    box.replaceChildren(h('h4', null, t('Global leaderboard')), h('p', null, text), h('div', { class: 'row', style: 'flex-wrap:wrap' }, submit, view));
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
  const team = s.teams[c.team];
  const se = s.season;
  const order = se && se.stand.P ? standingsOrder(se.stand) : [];
  const champ = order.indexOf('P') + 1;
  const age = s.stage === 'prologue' ? PROLOGUE_AGE[s.proStep] ?? d.age : d.age;
  const num = raceNumber(s);
  app.view.hud.replaceChildren(
    h(
      'div',
      { class: 'who' },
      h('span', { class: `racenum${num === 1 ? ' one' : ''}`, 'aria-label': t('Race number {n}', { n: num }) }, num),
      helmet(d.helmet, { gold: app.supporter }),
      h(
        'div',
        { style: 'min-width:0' },
        h('div', { class: 'nm' }, `${d.name} `, nation(d.nat).flag),
        h(
          'div',
          { class: 'tm' },
          s.stage === 'prologue' ? t('Karting') : [h('span', { class: 'series' }, c.series), h('span', { class: 'dot', style: `background:${team?.color}` }), c.role === 'reserve' ? t('{team} reserve', { team: team?.short }) : team?.name],
          app.supporter ? h('span', { class: 'supporter' }, t('☕ Pit crew')) : null,
        ),
      ),
    ),
    h(
      'div',
      { class: 'chips' },
      stat(t('Age'), age),
      stat(t('Season'), s.stage === 'prologue' ? t('Kids') : s.year),
      stat(t('Rating'), ovr(s)),
      stat(t('Bank'), money(d.money)),
      stat(t('Fame'), Math.round(d.fame)),
      champ ? stat(t('Standing'), `P${champ}`) : null,
    ),
    h(
      'div',
      { class: 'hud-actions' },
      se ? h('button', { class: 'btn btn-sm', onClick: () => openStandings(app) }, t('Standings')) : null,
      h('button', { class: 'btn btn-sm', onClick: () => openProfile(app) }, t('Driver')),
      h('button', { class: 'btn btn-sm btn-coffee', onClick: () => openDonate(app), title: t('Fuel the dev'), 'aria-label': t('Fuel the dev') }, '☕', h('span', { class: 'wide-only' }, t('Fuel the dev'))),
      h('button', { class: 'btn btn-sm', onClick: () => openMenu(app) }, t('Menu')),
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
      const where = { pos, pts: plural(pts, 'point') };
      goalBox = h(
        'div',
        { class: `goal-box ${se.round ? (on ? 'on' : 'off') : ''}` },
        h('b', null, t('Team target: {goal}', { goal: goalText(se.goal) })),
        se.round ? (on ? t('On track. You are P{pos} with {pts}.', where) : t('Behind target. You are P{pos} with {pts}.', where)) : t('The season has not started yet.'),
      );
    }
    parts.push(
      h('h3', null, t('{year} {series}', { year: se.year, series: seriesName(se.series) })),
      h('div', { class: 'meta' }, se.round >= se.cal.length ? t('Final standings') : t('After round {round} of {of}', { round: se.round, of: se.cal.length })),
      goalBox,
      h(
        'ol',
        { class: 'stand' },
        order.map((id, i) => {
          const team = Object.values(s.teams).find((x) => x.seats.includes(id));
          return h(
            'li',
            { class: `${id === 'P' ? 'me' : ''}${i === 0 ? ' lead' : ''}` },
            h('span', { class: 'p' }, i + 1),
            h('i', { class: 'bar', style: `background:${team?.color || '#555'}` }),
            h('span', { class: 'n' }, id === 'P' ? s.driver.name : nameOf(s, id)),
            h('span', { class: 'pts' }, se.stand[id].pts),
          );
        }),
      ),
    );
  }
  parts.push(h('h3', { style: 'margin-top:22px' }, t('Your driver')), h('div', { class: 'meta' }, t('Overall {n}', { n: ovr(s) })), statBars(s));
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
      h('p', { class: 'dock-q' }, t('Your call')),
      ...p.choices.map((c, i) =>
        h(
          'button',
          { class: 'choice', onClick: () => act(app, (st) => choose(st, i), { animate: true }) },
          h('span', { class: `ring ${ringClass(c.chance)}`, style: `--p:${c.chance}`, 'aria-label': c.chance >= 100 ? t('Certain') : t('{n} percent chance', { n: c.chance }) }, h('span', null, c.chance >= 100 ? t('Safe') : `${c.chance}%`)),
          h('span', { class: 'lab' }, c.label, c.stat || c.hint ? h('small', null, c.hint || t('Depends on {stat}', { stat: c.stat.toLowerCase() })) : null),
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
          t('Next race'),
          h('small', null, t('{flag} {next}, round {round} of {of}', p)),
        ),
        h('button', { class: 'btn', onClick: () => act(app, skipToDecision), title: t('Race on until something needs your decision') }, t('Skip to next call')),
      ),
      h('div', { class: 'dock-more' }, h('button', { class: 'btn btn-ghost btn-sm', onClick: () => confirmDialog(t('Sim to the end of the season?'), t('Every remaining race runs automatically. Decisions are made for you, always taking the safest option.'), t('Sim the season'), () => act(app, simToSeasonEnd)) }, t('Sim to season end'))),
    );
  } else if (p.type === 'offers') {
    inner.append(h('p', { class: 'dock-q' }, t('Your options for {year}', { year: s.year + 1 })), h('div', { class: 'offers-wrap' }, p.offers.map((o, i) => offerButton(app, o, i))));
  } else if (p.type === 'retired') {
    inner.append(
      h(
        'div',
        { class: 'row', style: 'flex-wrap:wrap' },
        h('button', { class: 'btn btn-go', onClick: () => app.showTitle() }, t('Start a new career')),
      ),
    );
  } else {
    inner.append(h('button', { class: 'btn btn-go', onClick: () => act(app, advance) }, p.label));
  }
  dock.replaceChildren(inner);
}

const TAGS = { promo: () => t('Promotion'), stay: () => t('Same series'), renew: () => t('Renewal'), buyout: () => t('Buyout'), signed: () => t('Pre-signed') };

function offerButton(app, o, i) {
  const s = app.s;
  const go = () => act(app, (st) => pickOffer(st, i));
  const note = offerNote(o);
  if (o.kind === 'retire' || o.kind === 'endurance') {
    const label = offerLabel(o);
    return h(
      'button',
      { class: 'offer dim', onClick: () => confirmDialog(label, cat(note, t('This ends your career and shows your legacy.')), o.kind === 'retire' ? t('Retire') : t('Sign for endurance'), go) },
      h('i', { style: 'background:var(--line)' }),
      h('div', null, h('b', null, label), note ? h('span', { class: 'meta' }, note) : null),
      h('span'),
    );
  }
  const cant = !!o.cost && o.cost > s.driver.money;
  const tagText = TAGS[o.tag] ? TAGS[o.tag]() : o.kind === 'stay' ? t('Under contract') : o.kind === 'reserve' ? t('Reserve role') : t('New team');
  const moneyEl =
    o.series === 'F1'
      ? h('span', { class: 'money' }, `${money(o.salary)}`, h('small', null, o.kind === 'stay' ? t('a year') : t('a year, {years}', { years: plural(o.years, 'year') })))
      : h('span', { class: `money ${cant ? 'cant' : ''}` }, o.cost ? money(o.cost) : t('Free'), h('small', null, o.cost ? (cant ? t('You cannot afford it') : t('Seat cost')) : s.driver.academy ? t('Academy pays') : t('Team pays')));
  return h(
    'button',
    { class: 'offer', disabled: cant, onClick: go },
    h('i', { style: `background:${o.color}` }),
    h(
      'div',
      null,
      h('b', null, o.kind === 'stay' ? t('Stay at {team}', { team: o.name }) : o.kind === 'reserve' ? t('Reserve driver, {team}', { team: o.name }) : o.name, h('span', { class: 'series' }, o.series)),
      h('span', { class: 'meta' }, t('{tag}. Car ', { tag: tagText }), h('span', { class: 'tier-stars', 'aria-label': t('{n} out of 5', { n: o.tier }) }, stars(o.tier))),
      note ? h('span', { class: 'note' }, note) : null,
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
    item(t('Save and go to the title screen'), () => app.showTitle()),
    item(t('Achievements'), () => openAchievements(app)),
    item(t('Hall of fame'), () => openHallOfFame(app)),
    item(t('Global leaderboard'), () => openLeaderboard(app)),
    item(t('All-time records'), () => openRecords(app)),
    item(t('Settings'), () => openSettings(app)),
    item(t('Backup'), () => openBackup(app)),
    item(t('About'), () => openAbout()),
    app.s.stage !== 'retired'
      ? item(t('Retire now'), () => confirmDialog(t('Retire now?'), t('Your career ends here and your legacy is written.'), t('Retire'), () => act(app, retireNow)), 'btn btn-ghost')
      : null,
    h('p', { class: 'credits' }, t('Seed {seed}', { seed: app.s.seed })),
  );
  dlg = openDialog(t('Menu'), body);
}
