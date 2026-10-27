import { h, download, toast } from './dom.js';
import { store } from '../store.js';
import { money, stars, plural } from '../core/fmt.js';
import { STATS } from '../engine/constants.js';
import { standingsOrder, slPoints } from '../engine/market.js';
import { nameOf } from '../engine/world.js';
import { overall } from '../engine/player.js';
import { sponsorKind } from '../engine/helpers.js';
import { ACHIEVEMENTS, netWorth, achWords } from '../engine/achievements.js';
import { nation } from '../data/nations.js';
import { GAME } from '../config.js';
import { allTime, summaryWords, familyLine } from '../engine/legacy.js';
import { todayKey, dailySetup, dailyGoalText } from '../engine/daily.js';
import { checkDisplayName, NAME_MIN, NAME_MAX } from '../core/displayname.js';
import { fetchBoard, submitCareer, localizeError } from '../api.js';
import { setSound } from './sfx.js';
import { t, tn, LANGS, getLang, statName, statHint, seriesName, trainingText } from '../i18n.js';

export function openDialog(title, body, { onClose } = {}) {
  const dlg = h('dialog', { 'aria-label': title });
  const close = h('button', { class: 'btn btn-ghost icon-btn', 'aria-label': t('Close'), onClick: () => dlg.close() }, '✕');
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
      h('button', { class: 'btn btn-ghost', onClick: () => dlg.close() }, t('Cancel')),
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

const teamOf = (s, id) => Object.values(s.teams).find((x) => x.seats.includes(id));

// ------------------------------------------------------------ standings

export function standingsTable(s, limit = 99) {
  const se = s.season;
  const order = standingsOrder(se.stand).slice(0, limit);
  return h(
    'table',
    { class: 'table' },
    h('thead', null, h('tr', null, h('th', { class: 'r' }, t('Pos')), h('th', null, t('Driver')), h('th', null, t('Team')), h('th', { class: 'r' }, t('Wins')), h('th', { class: 'r' }, t('Pts')))),
    h(
      'tbody',
      null,
      order.map((id, i) => {
        const team = teamOf(s, id);
        const st = se.stand[id];
        return h(
          'tr',
          { class: id === 'P' ? 'me' : '' },
          h('td', { class: 'r' }, i + 1),
          h('td', null, h('span', { class: 'dot', style: `background:${team?.color || '#555'};margin-right:8px` }), nameOf(s, id)),
          h('td', null, team?.short || t('Reserve')),
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
      h('thead', null, h('tr', null, h('th', { class: 'r' }, t('Pos')), h('th', null, t('Team')), h('th', { class: 'r' }, t('Pts')))),
      h('tbody', null, rows.map(([id, pts], i) => h('tr', { class: id === s.career.team ? 'me' : '' }, h('td', { class: 'r' }, i + 1), h('td', null, h('span', { class: 'dot', style: `background:${s.teams[id].color};margin-right:8px` }), s.teams[id].name), h('td', { class: 'r' }, pts)))),
    );
  };
  openDialog(t('{year} {series}', { year: se.year, series: seriesName(se.series) }), tabs([[t('Drivers'), () => standingsTable(s)], [t('Teams'), teamsTable]]));
}

// ------------------------------------------------------------ driver profile

export function statBars(s) {
  const st = s.driver.stats;
  const rows = STATS.map((k) => {
    const v = Math.round(st[k]);
    return h(
      'div',
      { class: 'statbar' },
      h('span', null, statName(k)),
      h('div', { class: 'track' }, h('i', { class: v >= 88 ? 'hi' : v >= 75 ? 'good' : '', style: `width:${v}%` })),
      h('b', null, v),
      h('small', null, statHint(k)),
    );
  });
  return h('div', { class: 'statbars' }, rows);
}

const SPONSOR_LIFE = {
  doner: () => t('Sponsored by Dönerland Express since age 14'),
  hk: () => t('Sponsored by Sun Keung Kee Café since age 14'),
  tw: () => t('Sponsored by A-Ma Boba since age 14'),
  mo: () => t('Sponsored by Ping Kee since age 14'),
};

export function openProfile(app) {
  const s = app.s;
  const d = s.driver;
  const c = s.career;
  const statsTab = () =>
    h(
      'div',
      null,
      h('p', { style: 'margin-top:0;color:var(--ink-2)' }, t('Overall {n}. Scouts rate your potential {stars}. Winter focus: {focus}.', { n: Math.round(overall(d.stats)), stars: stars((d.pot - 66) / 6), focus: trainingText(d.training, 'name') || t('rest') })),
      statBars(s),
    );
  const careerTab = () => {
    const f = c.tot.F1;
    const j = c.tot.junior;
    return h(
      'div',
      null,
      h('div', { class: 'kv' }, ...[
        [t('F1 starts'), f.starts], [t('Wins'), f.wins], [t('Podiums'), f.podiums], [t('Poles'), f.poles], [t('Points'), f.points], [t('Titles'), f.titles],
      ].map(([k, v]) => h('span', null, `${k} `, h('b', null, v)))),
      h('div', { class: 'kv', style: 'margin-top:6px' }, ...[
        [t('Junior starts'), j.starts], [t('Junior wins'), j.wins], [t('Junior titles'), j.titles], [t('Superlicence points (3 yrs)'), slPoints(s)],
      ].map(([k, v]) => h('span', null, `${k} `, h('b', null, v)))),
      h('div', { class: 'sec' }, t('Season by season')),
      c.hist.length
        ? h(
            'table',
            { class: 'table' },
            h('thead', null, h('tr', null, h('th', null, t('Year')), h('th', null, t('Series')), h('th', null, t('Team')), h('th', { class: 'r' }, t('Pos')), h('th', { class: 'r' }, t('Wins')), h('th', { class: 'r' }, t('Pts')))),
            h('tbody', null, [...c.hist].reverse().map((x) => h('tr', { class: x.champion ? 'me' : '' }, h('td', null, x.year), h('td', null, x.series), h('td', null, h('span', { class: 'dot', style: `background:${x.color};margin-right:6px` }), x.role === 'reserve' ? t('{team} (reserve)', { team: x.teamName }) : x.teamName), h('td', { class: 'r' }, x.pos ? `P${x.pos}` : '–'), h('td', { class: 'r' }, x.wins), h('td', { class: 'r' }, x.pts)))),
          )
        : h('p', { class: 'empty' }, t('No seasons finished yet.')),
    );
  };
  const lifeTab = () => {
    const rows = [
      [t('Bank balance'), money(d.money)],
      [t('Net worth'), money(netWorth(s))],
      [t('Fame'), `${Math.round(d.fame)} / 100`],
      [t('Team trust'), `${Math.round(d.teamRel)} / 100`],
      [t('Contract'), c.contract ? t('{years} left, {money} a year', { years: plural(c.contract.years, 'year'), money: money(c.contract.salary) }) : t('Season by season')],
      [t('Junior academy'), d.academy ? s.teams[d.academy].academy : t('Independent')],
    ];
    const life = [];
    if (s.flags.married) life.push(t('Married'));
    else if (s.flags.partner) life.push(t('In a relationship'));
    if (s.flags.parent) life.push(t('Parent'));
    if (s.flags.foundation) life.push(t('Runs the Lights Out Foundation'));
    if (s.flags.mentor) life.push(t('Mentored by a three-time champion'));
    if (s.flags.kebab) life.push(SPONSOR_LIFE[sponsorKind(d.nat)]());
    if (s.career.macau?.length) life.push(t('Raced the Macau Grand Prix: {results}', { results: s.career.macau.map((m) => `${m.year} ${m.dnf ? t('DNF') : `P${m.pos}`}`).join(', ') }));
    return h(
      'div',
      { class: 'life' },
      rows.map(([k, v]) => h('div', { class: 'life-row' }, h('span', { class: 's' }, k), h('span', { class: 't' }, v))),
      d.assets.length ? h('div', { class: 'sec' }, t('Things you own')) : null,
      // Asset names are saved in English, which is also their key.
      d.assets.map((a) => h('div', { class: 'life-row' }, h('span', { class: 't' }, t(a.name)), h('span', { class: 's' }, money(a.value)))),
      life.length ? h('div', { class: 'sec' }, t('Life')) : null,
      life.map((line) => h('div', { class: 'life-row' }, h('span', { class: 't' }, line), h('span'))),
    );
  };
  openDialog(`${d.name} ${nation(d.nat).flag}`, tabs([[t('Stats'), statsTab], [t('Career'), careerTab], [t('Life'), lifeTab]]));
}

// ------------------------------------------------------------ achievements & hall of fame

export function allUnlocked(app) {
  const set = store.ach();
  for (const id of app.s?.ach || []) set.add(id);
  return set;
}

export function openAchievements(app) {
  const got = allUnlocked(app);
  // Named for the driver on screen, or else the most recent one.
  const nat = app.s?.driver.nat ?? [...store.lives()].sort((a, b) => (b.at || 0) - (a.at || 0))[0]?.nat;
  const grid = h(
    'div',
    { class: 'ach-grid' },
    ACHIEVEMENTS.map((a) => {
      const w = achWords(a, nat);
      return h('div', { class: `ach ${got.has(a.id) ? 'got' : 'locked'}` }, h('span', { class: 'ic' }, w.icon), h('div', null, h('b', null, w.name), h('span', null, w.desc)));
    }),
  );
  openDialog(t('Achievements {got}/{all}', { got: got.size, all: ACHIEVEMENTS.length }), grid);
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
              h('div', { class: 's' }, t('{tier}. {record}. Retired at {age} in {year}.', {
                tier: summaryWords(l).tier,
                record: l.f1.starts ? t('{titles}, {wins}, {starts}', { titles: plural(l.f1.titles, 'title'), wins: plural(l.f1.wins, 'win'), starts: plural(l.f1.starts, 'start') }) : t('No Grand Prix start'),
                age: l.age,
                year: l.endYear,
              })),
              l.family ? h('div', { class: 's' }, familyLine(l.family)) : null,
              h('div', { class: 's' }, t('Legacy {score}. Seed {seed}', { score: l.score, seed: l.seed })),
            ),
            h('button', { class: 'btn btn-sm', onClick: () => { dlg.close(); app.showTitle({ seed: l.seed }); } }, t('Replay seed')),
          ),
        ),
      )
    : h('p', { class: 'empty' }, t('Finish a career and it will be remembered here.'));
  dlg = openDialog(t('Hall of fame'), body);
}

export function openRecords(app) {
  const s = app.s;
  if (!s) return;
  const rows = allTime(s);
  const byWins = [...rows].sort((a, b) => b.wins - a.wins || b.titles - a.titles);
  // Era is a year range, or a word the engine wrote when the list was built.
  const table = (list) =>
    h(
      'table',
      { class: 'table' },
      h('thead', null, h('tr', null, h('th', { class: 'r' }, '#'), h('th', null, t('Driver')), h('th', { class: 'r' }, t('Titles')), h('th', { class: 'r' }, t('Wins')), h('th', { class: 'r' }, t('Starts')), h('th', null, t('Era')))),
      h(
        'tbody',
        null,
        // The top 25, plus you and your parent wherever you rank.
        list.map((r, i) =>
          i < 25 || r.kind === 'me' || r.kind === 'parent'
            ? h('tr', { class: r.kind === 'me' || r.kind === 'rival' || r.kind === 'parent' ? r.kind : '' }, h('td', { class: 'r' }, i + 1), h('td', null, `${r.flag} ${r.name}`), h('td', { class: 'r' }, r.titles), h('td', { class: 'r' }, r.wins), h('td', { class: 'r' }, r.starts), h('td', null, r.era))
            : null,
        ),
      ),
    );
  const me = rows.find((r) => r.kind === 'me');
  const intro = me
    ? t('You rank #{titles} for titles and #{wins} for wins among {of} Grand Prix drivers.', { titles: rows.indexOf(me) + 1, wins: byWins.indexOf(me) + 1, of: rows.length })
    : t('Start a Formula 1 race to appear here.');
  openDialog(t('All-time records'), h('div', null, h('p', { style: 'margin-top:0;color:var(--ink-2)' }, intro), tabs([[t('Most titles'), () => table(rows)], [t('Most wins'), () => table(byWins)]])));
}

// ------------------------------------------------------------ global leaderboard

function boardTable(entries, mine, daily) {
  return h(
    'table',
    { class: 'table lb-table' },
    h('thead', null, h('tr', null, h('th', { class: 'r' }, '#'), h('th', null, t('Driver')), h('th', { class: 'r' }, t('Score')))),
    h(
      'tbody',
      null,
      entries.map((e, i) => {
        const record = e.starts ? t('{titles}, {wins}', { titles: plural(e.titles, 'title'), wins: plural(e.wins, 'win') }) : t('No Grand Prix start');
        return h(
          'tr',
          { class: mine.has(e.id) ? 'me' : '' },
          h('td', { class: 'r lb-pos' }, i + 1),
          h(
            'td',
            null,
            h('div', { class: 'lb-name' }, e.name, mine.has(e.id) ? h('span', { class: 'lb-you' }, t('You')) : null),
            h(
              'div',
              { class: 'lb-sub' },
              daily ? h('span', { class: `lb-goal${e.daily?.done ? ' ok' : ''}` }, e.daily?.done ? t('Goal met') : t('Goal missed')) : null,
              [e.flag, [e.driver, summaryWords(e).tier, record].filter(Boolean).join(' · ')].filter(Boolean).join(' '),
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
    const box = h('div', { 'aria-busy': 'true' }, h('p', { class: 'empty' }, t('Loading the leaderboard…')));
    fetchBoard(board, board === 'daily' ? date : null)
      .then((data) => {
        const empty = board === 'daily' ? t('Nobody has submitted today’s challenge yet. Be the first.') : t('No careers on the board yet. Finish one and be the first.');
        box.replaceChildren(data.entries.length ? boardTable(data.entries, mine, board === 'daily') : h('p', { class: 'empty' }, empty));
      })
      .catch((e) => {
        box.replaceChildren(h('p', { class: 'empty' }, t('The leaderboard could not be loaded.')));
        toast(e.message);
      })
      .finally(() => box.removeAttribute('aria-busy'));
    return box;
  };
  const allTab = () => h('div', null, h('p', { class: 'lb-intro' }, t('The top 100 careers by legacy score. The server replays every one from its seed before it goes on the board.')), load('all'));
  const dailyTab = () => {
    const d = dailySetup(date);
    return h(
      'div',
      null,
      h('p', { class: 'lb-intro' }, h('b', null, t('Goal for {date}: ', { date })), dailyGoalText(d.goal, d.goalText), ' ', t('Meeting it puts you above everyone who missed it, then legacy score decides.')),
      canPlay ? h('button', { class: 'btn btn-sm', style: 'margin-bottom:12px', onClick: () => { dlg.close(); app.showTitle({ daily: true }); } }, t('Play today’s challenge')) : null,
      load('daily'),
    );
  };
  dlg = openDialog(t('Global leaderboard'), tabs([[t('All-time'), allTab], [t('Today’s daily challenge'), dailyTab]], tab === 'daily' ? 1 : 0));
}

export function boardResultText(b, duplicate = false) {
  if (duplicate) return t('This career is already on the global leaderboard.');
  if (b.rank && b.daily) return t('You are #{rank} on the global leaderboard and #{daily} in the daily challenge.', { rank: b.rank, daily: b.daily });
  if (b.rank) return t('You are #{rank} on the global leaderboard.', { rank: b.rank });
  if (b.daily) return t('Career verified. It did not make the all-time top 100, but you are #{daily} in the daily challenge.', { daily: b.daily });
  return t('Career verified. It did not make the all-time top 100.');
}

export function openSubmitDialog(app, onDone) {
  const s = app.s;
  const sum = s.retired;
  const hint = t('Everyone can see it next to your score. {min} to {max} characters: letters, numbers, spaces and basic punctuation.', { min: NAME_MIN, max: NAME_MAX });
  let dlg;
  const input = h('input', { class: 'input', id: 'lb-name', maxlength: NAME_MAX, autocomplete: 'nickname', spellcheck: 'false', 'aria-describedby': 'lb-name-hint' });
  input.value = store.boardName() || '';
  const msg = h('p', { class: 'hint', id: 'lb-name-hint' }, hint);
  const go = h('button', { class: 'btn btn-go', type: 'submit' }, t('Submit career'));
  const form = h(
    'form',
    { class: 'lb-form', novalidate: true },
    h('p', { style: 'margin-top:0;color:var(--ink-2)' }, t('{name}, legacy score {score}. The server replays the whole career from its seed to check it.', { name: sum.name, score: sum.score })),
    sum.daily
      ? h('p', { style: 'color:var(--ink-2)' }, sum.daily.done ? t('It also goes on the daily challenge board for {date}, goal met.', { date: sum.daily.date }) : t('It also goes on the daily challenge board for {date}, goal missed.', { date: sum.daily.date }))
      : null,
    h('label', { for: 'lb-name' }, t('Display name')),
    input,
    msg,
    h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:16px' }, h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => dlg.close() }, t('Cancel')), go),
  );
  input.addEventListener('input', () => {
    msg.classList.remove('bad');
    msg.textContent = hint;
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const c = checkDisplayName(input.value);
    if (!c.ok) {
      msg.textContent = localizeError(c.error);
      msg.classList.add('bad');
      input.focus();
      return;
    }
    go.disabled = true;
    go.textContent = t('Checking your career…');
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
      go.textContent = t('Submit career');
    }
  });
  dlg = openDialog(t('Submit to the global leaderboard'), form);
  input.focus();
  input.select();
}

// ------------------------------------------------------------ settings, backup, about

export function openSettings(app) {
  let dlg;
  const seg = (opts, cur, onPick) => {
    const wrap = h('div', { class: 'seg' });
    const btns = opts.map(([v, label, lang]) => h('button', { lang, 'aria-pressed': v === cur ? 'true' : 'false', onClick: () => { btns.forEach((b) => b.setAttribute('aria-pressed', 'false')); btns[opts.findIndex((o) => o[0] === v)].setAttribute('aria-pressed', 'true'); onPick(v); } }, label));
    wrap.append(...btns);
    return wrap;
  };
  const langs = LANGS.map(([code, label]) => [code, label, code === 'zh' ? 'zh-Hant' : 'en']);
  const body = h(
    'div',
    null,
    // Written in both languages so anyone can find it.
    h('div', { class: 'setting' }, h('div', null, h('b', null, 'Language · 語言'), h('p', null, t('In a career already under way, the story so far stays in the language it was written in. Everything new uses the language you pick.'))), seg(langs, getLang(), (v) => {
      if (v === getLang()) return;
      dlg.close();
      app.setLanguage(v);
      openSettings(app);
    })),
    h('div', { class: 'setting' }, h('div', null, h('b', null, t('Race animations')), h('p', null, t('Start lights, the timing tower and confetti.'))), seg([['full', t('Full')], ['fast', t('Fast')], ['off', t('Off')]], app.settings.anim, (v) => { app.settings.anim = v; store.saveSettings(app.settings); })),
    h('div', { class: 'setting' }, h('div', null, h('b', null, t('Sound effects')), h('p', null, t('Start lights, team radio beeps and victory fanfares.'))), seg([[true, t('On')], [false, t('Off')]], app.settings.sound !== false, (v) => { app.settings.sound = v; setSound(v); store.saveSettings(app.settings); })),
  );
  dlg = openDialog(t('Settings'), body);
}

const NOT_BACKUP = 'This file is not a Lights Out backup.';

export function openBackup(app) {
  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr', id: 'import-file' });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      store.importAll(JSON.parse(await f.text()));
      app.afterRestore();
      toast(t('Backup restored.'));
      document.querySelector('dialog')?.close();
    } catch (e) {
      toast(e.message === NOT_BACKUP ? t('This file is not a Lights Out backup.') : e.message || t('That file could not be read.'));
    }
  });
  const body = h(
    'div',
    null,
    h('p', { style: 'margin-top:0;color:var(--ink-2)' }, t('Your career, hall of fame and achievements live in this browser only. Download a backup to move them to another device or keep them safe.')),
    h(
      'div',
      { class: 'row', style: 'flex-wrap:wrap' },
      h('button', { class: 'btn', onClick: () => { app.save(); download(`lights-out-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll())); } }, t('Download backup')),
      h('label', { class: 'btn', for: 'import-file' }, t('Restore from file')),
      file,
    ),
  );
  openDialog(t('Backup'), body);
}

export function openAbout() {
  const body = h(
    'div',
    null,
    h('p', { style: 'margin-top:0' }, t('Lights Out is a racing career life simulator. Start in karting at eight, climb through Formula 4, 3 and 2, and see how far you get in Formula 1.')),
    h('p', { style: 'color:var(--ink-2)' }, t('Every team, driver and sponsor in the game is fictional. Any resemblance to real people or teams is affectionate coincidence. This is a fan-made game and is not affiliated with Formula 1, the FIA or any team.')),
    h('p', { class: 'credits' }, ...tn('Flag emoji from {link} (CC-BY 4.0) via the country-flag-emoji-polyfill font. Type set in Saira. Version {version}.', {
      link: h('a', { href: 'https://github.com/jdecked/twemoji', target: '_blank', rel: 'noopener' }, 'Twemoji'),
      version: GAME.version,
    })),
  );
  openDialog(t('About Lights Out'), body);
}
