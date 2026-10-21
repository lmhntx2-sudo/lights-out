// Site settings. Edit this file to set your own donation links.

export const GAME = {
  title: 'Lights Out',
  version: '0.1.0',
  storagePrefix: 'lightsout.v1.',
};

// "Fuel the dev" donations.
//
// While nothing below is filled in, the donation window says the tip jar opens
// soon, and the coffee reminders stay off. Fill in any one of these to open it:
//
//   primaryUrl   your main donation page. Buy Me a Coffee, a Stripe Payment Link,
//                a PayMe link: any URL works. Every amount card falls back to it.
//   qr.image     a QR code to scan, for example your PayMe QR. Save the picture as
//                assets/donate-qr.png and set image: 'assets/donate-qr.png'.
//   tiers[].url  a link for one exact amount, such as a Stripe Payment Link for $5.
//   platforms    extra buttons under the amounts. Empty ones are hidden.
export const DONATE = {
  enabled: true,
  primaryUrl: 'https://www.buymeacoffee.com/YOUR_NAME',
  qr: { image: '', label: 'Scan with PayMe to send any amount', alt: 'PayMe QR code' },
  platforms: [
    { id: 'bmc', label: 'Buy Me a Coffee', url: '' },
    { id: 'stripe', label: 'Pay by card', url: '' },
    { id: 'payme', label: 'PayMe', url: '' },
  ],
  tiers: [
    { id: 'espresso', emoji: '☕', name: 'Espresso shot', amount: 3, blurb: 'Keeps the dev awake through a red flag.', url: '' },
    { id: 'softs', emoji: '🛞', name: 'Fresh set of softs', amount: 5, blurb: 'Pays for an evening of new events.', url: '' },
    { id: 'wing', emoji: '🔧', name: 'Front wing upgrade', amount: 10, blurb: 'Funds a new feature, like new tracks or teams.', url: '' },
    { id: 'champagne', emoji: '🍾', name: 'Podium champagne', amount: 25, blurb: 'You are officially part of the pit crew.', url: '' },
  ],
  currency: '$',
  // Gentle reminders after big moments (first win, a title). Never more often than this.
  nudgeCooldownDays: 7,
};

export const isPlaceholder = (url) => !url || url.includes('YOUR_NAME');

export const tierUrl = (t) => (!isPlaceholder(t.url) ? t.url : !isPlaceholder(DONATE.primaryUrl) ? DONATE.primaryUrl : null);

export const tipJarOpen = () =>
  !isPlaceholder(DONATE.primaryUrl) ||
  !!DONATE.qr.image ||
  DONATE.platforms.some((p) => !isPlaceholder(p.url)) ||
  DONATE.tiers.some((t) => !isPlaceholder(t.url));
