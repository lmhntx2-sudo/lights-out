// Site settings. Edit this file to set your own donation links.

export const GAME = {
  title: 'Lights Out',
  version: '0.1.0',
  storagePrefix: 'lightsout.v1.',
};

// "Fuel the dev" donations, in Hong Kong dollars.
//
// Fill in any payment method below and it appears in the donation window, with a
// switcher when there is more than one. While none is filled in, the window says
// the tip jar opens soon and the coffee reminders stay off.
//
//   card     Stripe. Put one payment page in url, or give each amount its own
//            Stripe Payment Link in tiers[].stripe.
//   paypal   Your PayPal.me name in me (for paypal.me/yourname). Each amount card
//            then opens PayPal with that amount filled in. Or put any PayPal link in url.
//   payme    Save your PayMe QR as assets/donate-qr.png and set qr to that path.
//            url can hold your payme.hsbc link for people on their phone.
//   bmc      Buy Me a Coffee page.
export const DONATE = {
  enabled: true,
  currency: 'HKD',
  symbol: 'HK$',
  methods: {
    card: { label: 'Card', url: '' },
    paypal: { label: 'PayPal', me: '', url: '' },
    payme: { label: 'PayMe', qr: '', url: '' },
    bmc: { label: 'Buy Me a Coffee', url: 'https://www.buymeacoffee.com/YOUR_NAME' },
  },
  tiers: [
    { id: 'espresso', emoji: '☕', name: 'Espresso shot', amount: 30, blurb: 'Keeps the dev awake through a red flag.', stripe: '' },
    { id: 'softs', emoji: '🛞', name: 'Fresh set of softs', amount: 50, blurb: 'Pays for an evening of new events.', stripe: '' },
    { id: 'wing', emoji: '🔧', name: 'Front wing upgrade', amount: 100, blurb: 'Funds a new feature, like new tracks or teams.', stripe: '' },
    { id: 'champagne', emoji: '🍾', name: 'Podium champagne', amount: 200, blurb: 'You are officially part of the pit crew.', stripe: '' },
  ],
  // Gentle reminders after big moments (first win, a title). Never more often than this.
  nudgeCooldownDays: 7,
};

const ORDER = ['card', 'paypal', 'payme', 'bmc'];

export const isPlaceholder = (url) => !url || url.includes('YOUR_NAME');

function methodLive(id) {
  const m = DONATE.methods[id];
  if (!m) return false;
  if (id === 'card') return !isPlaceholder(m.url) || DONATE.tiers.some((t) => !isPlaceholder(t.stripe));
  if (id === 'paypal') return !!m.me || !isPlaceholder(m.url);
  if (id === 'payme') return !!m.qr || !isPlaceholder(m.url);
  return !isPlaceholder(m.url);
}

export const liveMethods = () => ORDER.filter(methodLive);
export const tipJarOpen = () => DONATE.enabled && liveMethods().length > 0;
export const price = (amount) => `${DONATE.symbol}${amount}`;

// Where an amount card should send people for a given payment method (null if nowhere).
export function tierLink(t, id) {
  const m = DONATE.methods[id];
  if (id === 'card') return !isPlaceholder(t.stripe) ? t.stripe : !isPlaceholder(m.url) ? m.url : null;
  if (id === 'paypal') return m.me ? `https://paypal.me/${encodeURIComponent(m.me)}/${t.amount}${DONATE.currency}` : !isPlaceholder(m.url) ? m.url : null;
  if (id === 'payme') return null;
  return !isPlaceholder(m.url) ? m.url : null;
}
