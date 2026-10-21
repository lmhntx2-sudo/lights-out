// "Fuel the dev": the donation modal, the gentle nudges and the supporter badge.
import { DONATE, isPlaceholder } from '../config.js';
import { h, toast } from './dom.js';
import { openDialog } from './modals.js';
import { store } from '../store.js';

const DAY = 24 * 60 * 60 * 1000;

const linkProps = (url) => ({ href: url, target: '_blank', rel: 'noopener noreferrer' });

export function openDonate(app, reason = '') {
  const placeholder = isPlaceholder(DONATE.primaryUrl);
  const intro = {
    retire: 'That was a whole career. If it made you grin, a coffee keeps the next update coming.',
    first_win: 'Your first Grand Prix win deserves champagne. The developer would settle for a coffee.',
    title: 'World champion! The developer is celebrating too, with a very small coffee.',
  }[reason];
  const tiers = DONATE.tiers.map((t) =>
    h(
      'a',
      { class: 'tier', ...linkProps(t.url || DONATE.primaryUrl), onClick: () => onDonateClick(app) },
      h('span', { class: 'e', 'aria-hidden': 'true' }, t.emoji),
      h('div', null, h('b', null, t.name), h('span', null, t.blurb)),
      h('span', { class: 'amt' }, `${DONATE.currency}${t.amount}`),
    ),
  );
  const platforms = DONATE.platforms
    .filter((p) => p.url)
    .map((p) => h('a', { class: 'btn btn-sm', ...linkProps(p.url), onClick: () => onDonateClick(app) }, p.label));

  const supporter = store.supporter();
  let dlg;
  const claim = h(
    'div',
    { class: 'claim' },
    supporter
      ? h('span', null, '☕ You are in the pit crew. Thank you, genuinely.')
      : [
          h('span', null, 'Already chipped in? Claim your gold helmet ring and the Pit crew badge.'),
          h('button', { class: 'btn btn-sm btn-coffee', onClick: () => { claimSupporter(app); dlg.close(); } }, 'I supported the dev'),
        ],
  );

  const body = h(
    'div',
    null,
    placeholder
      ? h('div', { class: 'dev-warning' }, 'Developer note: the donation link is still a placeholder. Set your page in ', h('code', null, 'js/config.js'), ' before you publish.')
      : null,
    h(
      'div',
      { class: 'donate-hero' },
      h('span', { class: 'cup', 'aria-hidden': 'true' }, '☕'),
      h('p', null, intro ? h('b', null, intro, ' ') : null, 'Lights Out is free, has no ads and no paywalls. It is made by one person in their spare time. Pick an amount below; you can change it on the next page.'),
    ),
    h('div', { class: 'tiers' }, tiers),
    platforms.length > 1 ? h('div', { class: 'platforms' }, h('span', { style: 'color:var(--ink-3);font-size:13px;align-self:center' }, 'Or use:'), platforms) : null,
    claim,
  );
  dlg = openDialog('Fuel the dev', body);
}

function onDonateClick(app) {
  app.donateClicked = true;
}

// Honour system: we cannot see payments, so we simply trust people.
export function claimSupporter(app) {
  store.setSupporter(true);
  app.supporter = true;
  store.addAch(['pit_crew']);
  if (app.s && !app.s.ach.includes('pit_crew')) app.s.ach.push('pit_crew');
  toast(h('div', null, h('b', null, '☕ Welcome to the pit crew'), h('div', null, 'Gold helmet ring and supporter colours unlocked. Thank you.')), { cls: 'coffee', ms: 7000 });
  app.refresh?.();
}

// A small, dismissable reminder after big moments. Never more than once a week,
// never for supporters, never blocking the game.
export function maybeNudge(app, reason) {
  if (!DONATE.enabled || store.supporter()) return;
  if (Date.now() - store.lastNudge() < DONATE.nudgeCooldownDays * DAY) return;
  store.setNudge();
  const text = {
    first_win: 'First Grand Prix win! If Lights Out made your day, you can fuel the dev with a coffee.',
    title: 'World champion! Fancy buying the dev a celebratory coffee?',
  }[reason];
  if (!text) return;
  let el;
  el = toast(
    h(
      'div',
      null,
      h('p', null, text),
      h(
        'div',
        { class: 'acts' },
        h('button', { class: 'btn btn-sm btn-coffee', onClick: () => { el?.remove(); openDonate(app, reason); } }, '☕ Fuel the dev'),
        h('button', { class: 'btn btn-sm btn-ghost', onClick: () => el?.remove() }, 'Not now'),
      ),
    ),
    { cls: 'coffee', ms: 14000 },
  );
}

export function coffeeButton(app, { label = '☕ Fuel the dev', cls = 'btn btn-coffee', reason = '' } = {}) {
  return h('button', { class: cls, onClick: () => openDonate(app, reason) }, label);
}
