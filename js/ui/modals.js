import { h, download, toast } from './dom.js';
import { store } from '../store.js';
import { money, stars, plural } from '../core/fmt.js';
import { STATS, STAT_LABEL, STAT_HINT, SINFO, TRAINING } from '../engine/constants.js';
import { standingsOrder, slPoints } from '../engine/market.js';
import { nameOf } from '../engine/world.js';
import { overall } from '../engine/player.js';
import { ACHIEVEMENTS, netWorth } from '../engine/achievements.js';
import { nation } from '../data/nations.js';
import { GAME } from '../config.js';
import { allTime } from '../engine/legacy.js';
import { todayKey, dailySetup } from '../engine/daily.js';
import { checkDisplayName, NAME_MIN, NAME_MAX } from '../core/displayname.js';
import { fetchBoard, submitCareer } from '../api.js';
import { setSound } from './sfx.js';

export function openDialog(title, body, { onClose } = {}) {
  const dlg = h('dialog', { 'aria-label': title });
  const close = h('button', { class: 'btn btn-ghost icon-btn', 'aria-label': 'Close', onClick: () => dlg.close() }, '✕');
  dlg.append(h('div', { class: 'dlg-head' }, h('h2', null, title), close), h('div', { class: 'dlg-body' }, body));
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener('close', () => {
    dlg.remove();
    onClose?.();
  });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

export function confirmDialog(title, text, okLabel, onOk) {
  let dlg;
  const body = h(
    'div',
    null,
    h('p', { style: 'margin-top:0;color:var(--ink-2)' }, text),
    h(
      'div',
      { class: 'row', style: 'justify-content:flex-end;margin-top:16px' },
      h('button', { class: 'btn btn-ghost', onClick: () => dlg.close() }, 'Cancel'),
      h('button', { class: 'btn btn-go', style: 'font-size:16px;padding:10px 16px', onClick: () => { dlg.close(); onOk(); } }, okLabel),
    ),
  );
  dlg = openDialog(title, body);
}

function tabs(spec, start = 0) {
  const bar = h('div', { class: 'tabs', role: 'tablist' });
  const panel = h('div', { role: 'tabpanel' });
  const btns = spec.map(([label, render], i) => {
    const b = h('button', {
      role: 'tab',
      'aria-selected': i === start ? 'true' : 'false',
      onClick: () => {
        btns.forEach((x) => x.setAttribute('aria-selected', 'false'));
        b.setAttribute('aria-selected', 'true');
        panel.replaceChildren(render());
      },
    }, label);
    return b;
  });
  bar.append(...btns);
  panel.append(spec[start][1]());
  return h('div', null, spec.length > 1 ? bar : null, panel);
}

const teamOf = (s, id) => Object.values(s.teams).find((t) => t.seats.includes(id));

// ------------------------------------------------------------ standings

export function standingsTable(s, limit = 99) {
  const se = s.season;
  const order = standingsOrder(se.stand).slice(0, limit);
  return h(
    'table',
    { class: 'table' },
    h('thead', null, h('tr', null, h('th', { class: 'r' }, 'Pos'), h('th', null, 'Driver'), h('th', null, 'Team'), h('th', { class: 'r' }, 'Wins'), h('th', { class: 'r' }, 'Pts'))),
    h(
      'tbody',
      null,
      order.map((id, i) => {
        const t = teamOf(s, id);
        const st = se.stand[id];
        return h(
          'tr',
          { class: id === 'P' ? 'me' : '' },
          h('td', { class: 'r' }, i + 1),
          h('td', null, h('span', { class: 'dot', style: `background:${t?.color || '#555'};margin-right:8px` }), nameOf(s, id)),
          h('td', null, t?.short || 'Reserve'),
          h('td', { class: 'r' }, st.w),
          h('td', { class: 'r' }, st.pts),
        );
      }),
    ),
  );
}

export function openStandings(app) {
  const s = app.s;
  if (!s.season) return;
  const se = s.season;
  const teamsTable = () => {
    const rows = Object.entries(se.tstand).sort((a, b) => b[1] - a[1]);
    return h(
      'table',
      { class: 'table' },
      h('thead', null, h('tr', null, h('th', { class: 'r' }, 'Pos'), h('th', null, 'Team'), h('th', { class: 'r' }, 'Pts'))),
      h('tbody', null, rows.map(([id, pts], i) => h('tr', { class: id === s.career.team ? 'me' : '' }, h('td', { class: 'r' }, i + 1), h('td', null, h('span', { class: 'dot', style: `background:${s.teams[id].color};margin-right:8px` }), s.teams[id].name), h('td', { class: 'r' }, pts)))),
    );
  };
  openDialog(`${se.year} ${SINFO[se.series].name}`, tabs([['Drivers', () => standingsTable(s)], ['Teams', teamsTable]]));
}

// ------------------------------------------------------------ driver profile

export function statBars(s) {
  const st = s.driver.stats;
  const rows = STATS.map((k) => {
    const v = Math.round(st[k]);
    return h(
      'div',
      { class: 'statbar' },
      h('span', null, STAT_LABEL[k]),
      h('div', { class: 'track' }, h('i', { class: v >= 88 ? 'hi' : v >= 75 ? 'good' : '', style: `width:${v}%` })),
      h('b', null, v),
      h('small', null, STAT_HINT[k]),
    );
  });
  return h('div', { class: 'statbars' }, rows);
}

export function openProfile(app) {
  const s = app.s;
  const d = s.driver;
  const c = s.career;
  const statsTab = () =>
    h(
      'div',
      null,
      h('p', { style: 'margin-top:0;color:var(--ink-2)' }, `Overall ${Math.round(overall(d.stats))}. Scouts rate your potential ${stars((d.pot - 66) / 6)}. Winter focus: ${TRAINING[d.training]?.name || 'rest'}.`),
      statBars(s),
    );
  const careerTab = () => {
    const f = c.tot.F1;
    const j = c.tot.junior;
    return h(
      'div',
      null,
      h('div', { class: 'kv' }, ...[
        ['F1 starts', f.starts], ['Wins', f.wins], ['Podiums', f.podiums], ['Poles', f.poles], ['Points', f.points], ['Titles', f.titles],
      ].map(([k, v]) => h('span', null, `${k} `, h('b', null, v)))),
      h('div', { class: 'kv', style: 'margin-top:6px' }, ...[
        ['Junior starts', j.starts], ['Junior wins', j.wins], ['Junior titles', j.titles], ['Superlicence points (3 yrs)', slPoints(s)],
      ].map(([k, v]) => h('span', null, `${k} `, h('b', null, v)))),
      h('div', { class: 'sec' }, 'Season by season'),
      c.hist.length
        ? h(
            'table',
            { class: 'table' },
            h('thead', null, h('tr', null, h('th', null, 'Year'), h('th', null, 'Series'), h('th', null, 'Team'), h('th', { class: 'r' }, 'Pos'), h('th', { class: 'r' }, 'Wins'), h('th', { class: 'r' }, 'Pts'))),
            h('tbody', null, [...c.hist].reverse().map((x) => h('tr', { class: x.champion ? 'me' : '' }, h('td', null, x.year), h('td', null, x.series), h('td', null, h('span', { class: 'dot', style: `background:${x.color};margin-right:6px` }), x.role === 'reserve' ? `${x.teamName} (reserve)` : x.teamName), h('td', { class: 'r' }, x.pos ? `P${x.pos}` : '–'), h('td', { class: 'r' }, x.wins), h('td', { class: 'r' }, x.pts)))),
          )
        : h('p', { class: 'empty' }, 'No seasons finished yet.'),
    );
  };
  const lifeTab = () => {
    const rows = [
      ['Bank balance', money(d.money)],
      ['Net worth', money(netWorth(s))],
      ['Fame', `${Math.round(d.fame)} / 100`],
      ['Team trust', `${Math.round(d.teamRel)} / 100`],
      ['Contract', c.contract ? `${plural(c.contract.years, 'year')} left, ${money(c.contract.salary)} a year` : 'Season by season'],
      ['Junior academy', d.academy ? s.teams[d.academy].academy : 'Independent'],
    ];
    const life = [];
    if (s.flags.married) life.push('Married');
    else if (s.flags.partner) life.push('In a relationship');
    if (s.flags.parent) life.push('Parent');
    if (s.flags.foundation) life.push('Runs the Lights Out Foundation');
    if (s.flags.mentor) life.push('Mentored by a three-time champion');
    if (s.flags.kebab) life.push('Sponsored by Dönerland Express since age 14');
    return h(
      'div',
      { class: 'life' },
      rows.map(([k, v]) => h('div', { class: 'life-row' }, h('span', { class: 's' }, k), h('span', { class: 't' }, v))),
      d.assets.length ? h('div', { class: 'sec' }, 'Things you own') : null,
      d.assets.map((a) => h('div', { class: 'life-row' }, h('span', { class: 't' }, a.name), h('span', { class: 's' }, money(a.value)))),
      life.length ? h('div', { class: 'sec' }, 'Life') : null,
      life.map((t) => h('div', { class: 'life-row' }, h('span', { class: 't' }, t), h('span'))),
    );
  };
  openDialog(`${d.name} ${nation(d.nat).flag}`, tabs([['Stats', statsTab], ['Career', careerTab], ['Life', lifeTab]]));
}

// ------------------------------------------------------------ achievements & hall of fame

export function allUnlocked(app) {
  const set = store.ach();
  for (const id of app.s?.ach || []) set.add(id);
  return set;
}

export function openAchievements(app) {
  const got = allUnlocked(app);
  const grid = h(
    'div',
    { class: 'ach-grid' },
    ACHIEVEMENTS.map((a) => h('div', { class: `ach ${got.has(a.id) ? 'got' : 'locked'}` }, h('span', { class: 'ic' }, a.icon), h('div', null, h('b', null, a.name), h('span', null, a.desc)))),
  );
  openDialog(`Achievements ${got.size}/${ACHIEVEMENTS.length}`, grid);
}

export function openHallOfFame(app) {
  const lives = store.lives().sort((a, b) => b.score - a.score);
  let dlg;
  const body = lives.length
    ? h(
        'div',
        { class: 'life' },
        lives.map((l, i) =>
          h(
            'div',
            { class: 'life-row' },
            h(
              'div',
              null,
              h('div', { class: 't' }, `${i + 1}. ${l.name} ${l.flag}`),
              h('div', { class: 's' }, `${l.tier}. ${l.f1.starts ? `${plural(l.f1.titles, 'title')}, ${plural(l.f1.wins, 'win')}, ${plural(l.f1.starts, 'start')}` : 'No Grand Prix start'}. Retired at ${l.age} in ${l.endYear}.`),
              h('div', { class: 's' }, `Legacy ${l.score}. Seed ${l.seed}`),
            ),
            h('button', { class: 'btn btn-sm', onClick: () => { dlg.close(); app.showTitle({ seed: l.seed }); } }, 'Replay seed'),
          ),
        ),
      )
    : h('p', { class: 'empty' }, 'Finish a career and it will be remembered here.');
  dlg = openDialog('Hall of fame', body);
}

export function openRecords(app) {
  const s = app.s;
  if (!s) return;
  const rows = allTime(s);
  const byWins = [...rows].sort((a, b) => b.wins - a.wins || b.titles - a.titles);
  const table = (list) =>
    h(
      'table',
      { class: 'table' },
      h('thead', null, h('tr', null, h('th', { class: 'r' }, '#'), h('th', null, 'Driver'), h('th', { class: 'r' }, 'Titles'), h('th', { class: 'r' }, 'Wins'), h('th', { class: 'r' }, 'Starts'), h('th', null, 'Era'))),
      h(
        'tbody',
        null,
        list.slice(0, 25).map((r, i) =>
          h('tr', { class: r.kind === 'me' ? 'me' : r.kind === 'rival' ? 'rival' : '' }, h('td', { class: 'r' }, i + 1), h('td', null, `${r.flag} ${r.name}`), h('td', { class: 'r' }, r.titles), h('td', { class: 'r' }, r.wins), h('td', { class: 'r' }, r.starts), h('td', null, r.era)),
        ),
      ),
    );
  const me = rows.find((r) => r.kind === 'me');
  const intro = me
    ? `You rank #${rows.indexOf(me) + 1} for titles and #${byWins.indexOf(me) + 1} for wins among ${rows.length} Grand Prix drivers.`
    : 'Start a Formula 1 race to appear here.';
  openDialog('All-time records', h('div', null, h('p', { style: 'margin-top:0;color:var(--ink-2)' }, intro), tabs([['Most titles', () => table(rows)], ['Most wins', () => table(byWins)]])));
}

// ------------------------------------------------------------ global leaderboard

function boardTable(entries, mine, daily) {
  return h(
    'table',
    { class: 'table lb-table' },
    h('thead', null, h('tr', null, h('th', { class: 'r' }, '#'), h('th', null, 'Driver'), h('th', { class: 'r' }, 'Score'))),
    h(
      'tbody',
      null,
      entries.map((e, i) => {
        const record = e.starts ? `${plural(e.titles, 'title')}, ${plural(e.wins, 'win')}` : 'No Grand Prix start';
        return h(
          'tr',
          { class: mine.has(e.id) ? 'me' : '' },
          h('td', { class: 'r lb-pos' }, i + 1),
          h(
            'td',
            null,
            h('div', { class: 'lb-name' }, e.name, mine.has(e.id) ? h('span', { class: 'lb-you' }, 'You') : null),
            h(
              'div',
              { class: 'lb-sub' },
              daily ? h('span', { class: `lb-goal${e.daily?.done ? ' ok' : ''}` }, e.daily?.done ? 'Goal met' : 'Goal missed') : null,
              [e.flag, [e.driver, e.tier, record].filter(Boolean).join(' · ')].filter(Boolean).join(' '),
            ),
          ),
          h('td', { class: 'r lb-score' }, e.score),
        );
      }),
    ),
  );
}

export function openLeaderboard(app, { tab = 'all' } = {}) {
  const mine = store.boardMine();
  const date = todayKey();
  const canPlay = !app.s || app.s.stage === 'retired';
  let dlg;
  const load = (board) => {
    const box = h('div', { 'aria-busy': 'true' }, h('p', { class: 'empty' }, 'Loading the leaderboard…'));
    fetchBoard(board, board === 'daily' ? date : null)
      .then((data) => {
        const empty = board === 'daily' ? 'Nobody has submitted today’s challenge yet. Be the first.' : 'No careers on the board yet. Finish one and be the first.';
        box.replaceChildren(data.entries.length ? boardTable(data.entries, mine, board === 'daily') : h('p', { class: 'empty' }, empty));
      })
      .catch((e) => {
        box.replaceChildren(h('p', { class: 'empty' }, 'The leaderboard could not be loaded.'));
        toast(e.message);
      })
      .finally(() => box.removeAttribute('aria-busy'));
    return box;
  };
  const allTab = () => h('div', null, h('p', { class: 'lb-intro' }, 'The top 100 careers by legacy score. The server replays every one from its seed before it goes on the board.'), load('all'));
  const dailyTab = () =>
    h(
      'div',
      null,
      h('p', { class: 'lb-intro' }, h('b', null, `Goal for ${date}: `), dailySetup(date).goalText, ' Meeting it puts you above everyone who missed it, then legacy score decides.'),
      canPlay ? h('button', { class: 'btn btn-sm', style: 'margin-bottom:12px', onClick: () => { dlg.close(); app.showTitle({ daily: true }); } }, 'Play today’s challenge') : null,
      load('daily'),
    );
  dlg = openDialog('Global leaderboard', tabs([['All-time', allTab], ['Today’s daily challenge', dailyTab]], tab === 'daily' ? 1 : 0));
}

export function boardResultText(b, duplicate = false) {
  if (duplicate) return 'This career is already on the global leaderboard.';
  const daily = b.daily ? `#${b.daily} in the daily challenge` : null;
  if (b.rank) return `You are #${b.rank} on the global leaderboard${daily ? ` and ${daily}` : ''}.`;
  return `Career verified. It did not make the all-time top 100${daily ? `, but you are ${daily}` : ''}.`;
}

export function openSubmitDialog(app, onDone) {
  const s = app.s;
  const sum = s.retired;
  const hint = `Everyone can see it next to your score. ${NAME_MIN} to ${NAME_MAX} characters: letters, numbers, spaces and basic punctuation.`;
  let dlg;
  const input = h('input', { class: 'input', id: 'lb-name', maxlength: NAME_MAX, autocomplete: 'nickname', spellcheck: 'false', 'aria-describedby': 'lb-name-hint' });
  input.value = store.boardName() || '';
  const msg = h('p', { class: 'hint', id: 'lb-name-hint' }, hint);
  const go = h('button', { class: 'btn btn-go', type: 'submit' }, 'Submit career');
  const form = h(
    'form',
    { class: 'lb-form', novalidate: true },
    h('p', { style: 'margin-top:0;color:var(--ink-2)' }, `${sum.name}, legacy score ${sum.score}. The server replays the whole career from its seed to check it.`),
    sum.daily ? h('p', { style: 'color:var(--ink-2)' }, `It also goes on the daily challenge board for ${sum.daily.date}, goal ${sum.daily.done ? 'met' : 'missed'}.`) : null,
    h('label', { for: 'lb-name' }, 'Display name'),
    input,
    msg,
    h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:16px' }, h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => dlg.close() }, 'Cancel'), go),
  );
  input.addEventListener('input', () => {
    msg.classList.remove('bad');
    msg.textContent = hint;
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const c = checkDisplayName(input.value);
    if (!c.ok) {
      msg.textContent = c.error;
      msg.classList.add('bad');
      input.focus();
      return;
    }
    go.disabled = true;
    go.textContent = 'Checking your career…';
    try {
      const res = await submitCareer(s, c.name);
      store.setBoardName(c.name);
      store.addBoardMine(res.entry.id);
      sum.board = { id: res.entry.id, name: res.entry.name, rank: res.ranks.all, daily: res.ranks.daily, dailyDate: res.dailyBoard };
      app.save();
      dlg.close();
      toast(boardResultText(sum.board, res.duplicate));
      onDone?.();
    } catch (e) {
      toast(e.message);
      go.disabled = false;
      go.textContent = 'Submit career';
    }
  });
  dlg = openDialog('Submit to the global leaderboard', form);
  input.focus();
  input.select();
}

// ------------------------------------------------------------ settings, backup, about

export function openSettings(app) {
  const seg = (opts, cur, onPick) => {
    const wrap = h('div', { class: 'seg' });
    const btns = opts.map(([v, label]) => h('button', { 'aria-pressed': v === cur ? 'true' : 'false', onClick: () => { btns.forEach((b) => b.setAttribute('aria-pressed', 'false')); btns[opts.findIndex((o) => o[0] === v)].setAttribute('aria-pressed', 'true'); onPick(v); } }, label));
    wrap.append(...btns);
    return wrap;
  };
  const body = h(
    'div',
    null,
    h('div', { class: 'setting' }, h('div', null, h('b', null, 'Race animations'), h('p', null, 'Start lights, the timing tower and confetti.')), seg([['full', 'Full'], ['fast', 'Fast'], ['off', 'Off']], app.settings.anim, (v) => { app.settings.anim = v; store.saveSettings(app.settings); })),
    h('div', { class: 'setting' }, h('div', null, h('b', null, 'Sound effects'), h('p', null, 'Start lights, team radio beeps and victory fanfares.')), seg([[true, 'On'], [false, 'Off']], app.settings.sound !== false, (v) => { app.settings.sound = v; setSound(v); store.saveSettings(app.settings); })),
  );
  openDialog('Settings', body);
}

export function openBackup(app) {
  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr', id: 'import-file' });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      store.importAll(JSON.parse(await f.text()));
      toast('Backup restored.');
      app.showTitle();
      document.querySelector('dialog')?.close();
    } catch (e) {
      toast(e.message || 'That file could not be read.');
    }
  });
  const body = h(
    'div',
    null,
    h('p', { style: 'margin-top:0;color:var(--ink-2)' }, 'Your career, hall of fame and achievements live in this browser only. Download a backup to move them to another device or keep them safe.'),
    h(
      'div',
      { class: 'row', style: 'flex-wrap:wrap' },
      h('button', { class: 'btn', onClick: () => { app.save(); download(`lights-out-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll())); } }, 'Download backup'),
      h('label', { class: 'btn', for: 'import-file' }, 'Restore from file'),
      file,
    ),
  );
  openDialog('Backup', body);
}

export function openAbout() {
  const body = h(
    'div',
    null,
    h('p', { style: 'margin-top:0' }, 'Lights Out is a racing career life simulator. Start in karting at eight, climb through Formula 4, 3 and 2, and see how far you get in Formula 1.'),
    h('p', { style: 'color:var(--ink-2)' }, 'Every team, driver and sponsor in the game is fictional. Any resemblance to real people or teams is affectionate coincidence. This is a fan-made game and is not affiliated with Formula 1, the FIA or any team.'),
    h('p', { class: 'credits' }, 'Flag emoji from ', h('a', { href: 'https://github.com/jdecked/twemoji', target: '_blank', rel: 'noopener' }, 'Twemoji'), ' (CC-BY 4.0) via the country-flag-emoji-polyfill font. Type set in Saira. Version ', GAME.version, '.'),
  );
  openDialog('About Lights Out', body);
}
