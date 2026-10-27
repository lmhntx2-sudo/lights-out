// "Fuel the dev": the donation modal, the gentle nudges and the supporter badge.
import { DONATE, isPlaceholder, liveMethods, price, tierLink, tipJarOpen } from '../config.js';
import { h, toast } from './dom.js';
import { openDialog } from './modals.js';
import { store } from '../store.js';
import { t, loc, isZh, htmlLang } from '../i18n.js';

const DAY = 24 * 60 * 60 * 1000;

const linkProps = (url) => ({ href: url, target: '_blank', rel: 'noopener noreferrer' });

const isLocal = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.hostname.endsWith('.localhost');

function tierCard(tier, url, app) {
  const kids = [
    h('span', { class: 'e', 'aria-hidden': 'true' }, tier.emoji),
    h('div', null, h('b', null, loc('donate', tier.id, 'name', tier.name)), h('span', null, loc('donate', tier.id, 'blurb', tier.blurb))),
    h('span', { class: 'amt' }, price(tier.amount)),
  ];
  return url ? h('a', { class: 'tier', ...linkProps(url), onClick: () => onDonateClick(app) }, kids) : h('div', { class: 'tier' }, kids);
}

// What to show for one payment method: amount cards that link out, or a QR code.
function methodPanel(id, app) {
  const m = DONATE.methods[id];
  if (id === 'payme') {
    const amounts = DONATE.tiers.map((tier) => price(tier.amount));
    return [
      m.qr ? h('figure', { class: 'qr' }, h('img', { src: m.qr, alt: t('PayMe QR code'), width: 200, height: 200 }), h('figcaption', null, t('Scan with PayMe to send any amount'))) : null,
      !isPlaceholder(m.url) ? h('div', { class: 'platforms', style: 'justify-content:center' }, h('a', { class: 'btn btn-sm btn-coffee', ...linkProps(m.url), onClick: () => onDonateClick(app) }, t('Open PayMe'))) : null,
      h('p', { class: 'suggest' }, t('Suggested: {some} or {last}.', { some: amounts.slice(0, -1).join(t(', ')), last: amounts[amounts.length - 1] })),
    ];
  }
  const links = DONATE.tiers.map((tier) => ({ tier, url: tierLink(tier, id) }));
  const note = id === 'paypal' && (m.me || m.email) ? t('Each amount opens PayPal with it filled in.') : id === 'bmc' ? t('You can change the amount on the next page.') : null;
  return [h('div', { class: 'tiers' }, links.map(({ tier, url }) => tierCard(tier, url, app))), note ? h('p', { class: 'suggest' }, note) : null];
}

export function openDonate(app, reason = '') {
  const open = tipJarOpen();
  // PayMe is how Hong Kong pays day to day, so Hong Kong players see it first.
  const methods = liveMethods().sort((a, b) => (htmlLang() === 'zh-Hant-HK' ? (b === 'payme') - (a === 'payme') : 0));
  const intro = {
    retire: () => t('That was a whole career. If it made you grin, a coffee keeps the next update coming.'),
    first_win: () => t('Your first Grand Prix win deserves champagne. The developer would settle for a coffee.'),
    title: () => t('World champion! The developer is celebrating too, with a very small coffee.'),
  }[reason]?.();
  const lead = open
    ? t('Lights Out is free, has no ads and no paywalls. It is made by one person in their spare time. Amounts are in Hong Kong dollars.')
    : t('Lights Out is free, has no ads and no paywalls. It is made by one person in their spare time. The tip jar opens very soon. Thanks for wanting to chip in!');

  const panel = h('div', { role: methods.length > 1 ? 'tabpanel' : null });
  let picker = null;
  if (open) {
    const show = (id) => panel.replaceChildren(...methodPanel(id, app).filter(Boolean));
    if (methods.length > 1) {
      picker = h('div', { class: 'seg methods', role: 'tablist', 'aria-label': t('Payment method') });
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
        }, loc('method', id, null, DONATE.methods[id].label)),
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
          ? h('span', null, t('☕ You are in the pit crew. Thank you, genuinely.'))
          : [
              h('span', null, t('Already chipped in? Claim your gold helmet ring and the Pit crew badge.')),
              h('button', { class: 'btn btn-sm btn-coffee', onClick: () => { claimSupporter(app); dlg.close(); } }, t('I supported the dev')),
            ],
      );

  const body = h(
    'div',
    null,
    isLocal() && !open
      ? h('div', { class: 'dev-warning' }, t('Only you see this, on localhost: no payment method is set up yet. Fill one in '), h('code', null, 'js/config.js'), t('.'))
      : null,
    h('div', { class: 'donate-hero' }, h('span', { class: 'cup', 'aria-hidden': 'true' }, '☕'), h('p', null, intro ? h('b', null, intro, isZh() ? '' : ' ') : null, lead)),
    picker,
    open ? panel : null,
    claim,
  );
  dlg = openDialog(t('Fuel the dev'), body);
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
  toast(h('div', null, h('b', null, t('☕ Welcome to the pit crew')), h('div', null, t('Gold helmet ring and supporter colours unlocked. Thank you.'))), { cls: 'coffee', ms: 7000 });
  app.refresh?.();
}

// A small, dismissable reminder after big moments. Never more than once a week,
// never for supporters, never blocking the game.
export function maybeNudge(app, reason) {
  if (!DONATE.enabled || !tipJarOpen() || store.supporter()) return;
  if (Date.now() - store.lastNudge() < DONATE.nudgeCooldownDays * DAY) return;
  store.setNudge();
  const text = {
    first_win: () => t('First Grand Prix win! If Lights Out made your day, you can fuel the dev with a coffee.'),
    title: () => t('World champion! Fancy buying the dev a celebratory coffee?'),
  }[reason]?.();
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
        h('button', { class: 'btn btn-sm btn-coffee', onClick: () => { el?.remove(); openDonate(app, reason); } }, t('☕ Fuel the dev')),
        h('button', { class: 'btn btn-sm btn-ghost', onClick: () => el?.remove() }, t('Not now')),
      ),
    ),
    { cls: 'coffee', ms: 14000 },
  );
}

export function coffeeButton(app, { label = t('☕ Fuel the dev'), cls = 'btn btn-coffee', reason = '' } = {}) {
  return h('button', { class: cls, onClick: () => openDonate(app, reason) }, label);
}
