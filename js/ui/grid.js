// The custom grid editor: rename the eleven Formula 1 teams on this device and
// share the set as a link. See js/core/grid.js.
import { h, toast, copyText } from './dom.js';
import { store } from '../store.js';
import { openDialog } from './modals.js';
import { F1_TEAMS } from '../data/teams.js';
import { cleanGrid, encodeGrid, GRID_NAME_MAX, GRID_SHORT_MAX } from '../core/grid.js';
import { t } from '../i18n.js';
import { siteUrl } from './day.js';

export function gridLink(grid) {
  const code = encodeGrid(grid);
  // The real site even in a portal copy, like the other share links.
  return code ? `${siteUrl()}?grid=${code}` : '';
}

// incoming: a friend's grid from a link. It fills the boxes; nothing is kept until Save.
export function openGrid(app, { incoming = null } = {}) {
  const start = incoming || store.grid();
  const rows = F1_TEAMS.map((team) => {
    const cur = start[team.id];
    const name = h('input', { class: 'input', maxlength: GRID_NAME_MAX, placeholder: team.name, 'aria-label': t('Team name for {team}', { team: team.name }) });
    const short = h('input', { class: 'input', maxlength: GRID_SHORT_MAX, placeholder: team.short, 'aria-label': t('Short name for {team}', { team: team.name }) });
    name.value = cur?.name || '';
    short.value = cur?.short || '';
    const row = h('div', { class: 'grid-row' }, h('span', { class: 'dot', style: `background:${team.color}` }), name, short);
    return { team, name, short, row };
  });
  const read = () => {
    const raw = {};
    for (const r of rows) {
      const name = r.name.value.trim();
      if (name) raw[r.team.id] = { name, short: r.short.value.trim() || undefined };
    }
    return raw;
  };
  let dlg;
  const save = () => {
    const raw = read();
    const g = cleanGrid(raw);
    const dropped = Object.keys(raw).filter((id) => !g[id] && raw[id].name !== F1_TEAMS.find((x) => x.id === id).name);
    store.setGrid(g);
    dlg.close();
    toast(dropped.length ? t('Saved. Some names were left out: use letters, numbers, spaces and basic punctuation only.') : t('Saved. Careers you start from now on use these names.'));
  };
  const share = async () => {
    const link = gridLink(read());
    if (!link) return toast(t('Rename at least one team first.'));
    toast((await copyText(link)) ? t('Link copied. Anyone who opens it can use your grid.') : link);
  };
  const reset = () => rows.forEach((r) => { r.name.value = ''; r.short.value = ''; });
  const body = h(
    'div',
    null,
    incoming ? h('p', { class: 'grid-note' }, t('A friend shared these team names. Save to use them in careers you start from now on.')) : null,
    h('p', { style: 'margin-top:0;color:var(--ink-2)' }, t('Give the eleven Formula 1 teams your own names. Only the names change: the cars, the colours and the leaderboard stay the same. Names stay on this device; a career already under way keeps the names it started with.')),
    h('div', { class: 'grid-head' }, h('span'), h('span', null, t('Team name')), h('span', null, t('Short name'))),
    rows.map((r) => r.row),
    h(
      'div',
      { class: 'row', style: 'flex-wrap:wrap;justify-content:flex-end;margin-top:16px;gap:8px' },
      h('button', { class: 'btn btn-ghost', onClick: reset }, t('Clear all')),
      h('button', { class: 'btn', onClick: share }, t('Copy share link')),
      h('button', { class: 'btn btn-go', style: 'font-size:16px;padding:10px 16px', onClick: save }, incoming ? t('Use this grid') : t('Save')),
    ),
  );
  dlg = openDialog(t('Custom grid'), body, {
    onClose: () => {
      if (!incoming) return;
      const u = new URL(location.href);
      u.searchParams.delete('grid');
      history.replaceState(null, '', u.pathname + u.search);
    },
  });
  return dlg;
}
