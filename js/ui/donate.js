// "Fuel the dev": the donation modal, the gentle nudges and the supporter badge.
import { DONATE, isPlaceholder, liveMethods, price, tierLink, tipJarOpen } from '../config.js';
import { h, toast } from './dom.js';
import { openDialog } from './modals.js';
import { store } from '../store.js';

const DAY = 24 * 60 * 60 * 1000;

const linkProps = (url) => ({ href: url, target: '_blank', rel: 'noopener noreferrer' });

const isLocal = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.hostname.endsWith('.localhost');

function tierCard(t, url, app) {
  const kids = [
    h('span', { class: 'e', 'aria-hidden': 'true' }, t.emoji),
    h('div', null, h('b', null, t.name), h('span', null, t.blurb)),
    h('span', { class: 'amt' }, price(t.amount)),
  ];
  return url ? h('a', { class: 'tier', ...linkProps(url), onClick: () => onDonateClick(app) }, kids) : h('div', { class: 'tier' }, kids);
}

// What to show for one payment method: amount cards that link out, or a QR code.
function methodPanel(id, app) {
  const m = DONATE.methods[id];
  if (id === 'payme') {
    const amounts = DONATE.tiers.map((t) => price(t.amount));
    return [
      m.qr ? h('figure', { class: 'qr' }, h('img', { src: m.qr, alt: 'PayMe QR code', width: 200, height: 200 }), h('figcaption', null, 'Scan with PayMe to send any amount')) : null,
      !isPlaceholder(m.url) ? h('div', { class: 'platforms', style: 'justify-content:center' }, h('a', { class: 'btn btn-sm btn-coffee', ...linkProps(m.url), onClick: () => onDonateClick(app) }, 'Open PayMe')) : null,
      h('p', { class: 'suggest' }, `Suggested: ${amounts.slice(0, -1).join(', ')} or ${amounts[amounts.length - 1]}.`),
    ];
  }
  const links = DONATE.tiers.map((t) => ({ t, url: tierLink(t, id) }));
  const note = id === 'paypal' && m.me ? 'Each amount opens PayPal with it filled in.' : id === 'bmc' ? 'You can change the amount on the next page.' : null;
  return [h('div', { class: 'tiers' }, links.map(({ t, url }) => tierCard(t, url, app))), note ? h('p', { class: 'suggest' }, note) : null];
}

export function openDonate(app, reason = '') {
  const open = tipJarOpen();
  const methods = liveMethods();
  const intro = {
    retire: 'That was a whole career. If it made you grin, a coffee keeps the next update coming.',
    first_win: 'Your first Grand Prix win deserves champagne. The developer would settle for a coffee.',
    title: 'World champion! The developer is celebrating too, with a very small coffee.',
  }[reason];
  const lead = open
    ? 'Lights Out is free, has no ads and no paywalls. It is made by one person in their spare time. Amounts are in Hong Kong dollars.'
    : 'Lights Out is free, has no ads and no paywalls. It is made by one person in their spare time. The tip jar opens very soon. Thanks for wanting to chip in!';

  const panel = h('div', { role: methods.length > 1 ? 'tabpanel' : null });
  let picker = null;
  if (open) {
    const show = (id) => panel.replaceChildren(...methodPanel(id, app).filter(Boolean));
    if (methods.length > 1) {
      picker = h('div', { class: 'seg methods', role: 'tablist', 'aria-label': 'Payment method' });
      const btns = methods.map((id, i) =>
        h('button', {
          role: 'tab',
          'aria-selected': i === 0 ? 'true' : 'false',
          'aria-pressed': i === 0 ? 'true' : 'false',
          onClick: (e) => {
            btns.forEach((b) => { b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-selected', 'false'); });
            e.currentTarget.setAttribute('aria-pressed', 'true');
            e.currentTarget.setAttribute('aria-selected', 'true');
            show(id);
          },
        }, DONATE.methods[id].label),
      );
      picker.append(...btns);
    }
    show(methods[0]);
  }

  const supporter = store.supporter();
  let dlg;
  const claim = !open
    ? null
    : h(
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
    isLocal() && !open
      ? h('div', { class: 'dev-warning' }, 'Only you see this, on localhost: no payment method is set up yet. Fill one in ', h('code', null, 'js/config.js'), '.')
      : null,
    h('div', { class: 'donate-hero' }, h('span', { class: 'cup', 'aria-hidden': 'true' }, '☕'), h('p', null, intro ? h('b', null, intro, ' ') : null, lead)),
    picker,
    open ? panel : null,
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
  if (!DONATE.enabled || !tipJarOpen() || store.supporter()) return;
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
