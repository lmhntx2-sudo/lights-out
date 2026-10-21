// Site settings. Edit this file to set your own donation links.

export const GAME = {
  title: 'Lights Out',
  version: '0.1.0',
  storagePrefix: 'lightsout.v1.',
};

// "Fuel the dev" donations. Replace YOUR_NAME with your real page.
// Buttons hide any platform whose url is empty. A tier without its own url
// opens primaryUrl, where the supporter picks the amount.
export const DONATE = {
  enabled: true,
  primaryUrl: 'https://www.buymeacoffee.com/YOUR_NAME',
  platforms: [
    { id: 'bmc', label: 'Buy Me a Coffee', url: 'https://www.buymeacoffee.com/YOUR_NAME' },
    { id: 'kofi', label: 'Ko-fi', url: '' },
    { id: 'paypal', label: 'PayPal', url: '' },
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
