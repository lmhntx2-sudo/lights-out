// Nationalities you can race for. `names` picks the name pool used for
// AI drivers, `home` lists Grands Prix that count as a home race, and
// `market` scales how much sponsors pay a driver from that country.

export const REGIONS = [
  { id: 'eu', name: 'Europe' },
  { id: 'am', name: 'Americas' },
  { id: 'ap', name: 'Asia and Oceania' },
  { id: 'me', name: 'Middle East and Africa' },
];

export const NATIONS = [
  { id: 'GB', name: 'Britain', adj: 'British', flag: '🇬🇧', region: 'eu', names: 'en', home: ['britain'], market: 1.3 },
  { id: 'NL', name: 'Netherlands', adj: 'Dutch', flag: '🇳🇱', region: 'eu', names: 'nl', home: ['netherlands'], market: 1.2 },
  { id: 'DE', name: 'Germany', adj: 'German', flag: '🇩🇪', region: 'eu', names: 'de', home: [], market: 1.2 },
  { id: 'FR', name: 'France', adj: 'French', flag: '🇫🇷', region: 'eu', names: 'fr', home: [], market: 1.1 },
  { id: 'IT', name: 'Italy', adj: 'Italian', flag: '🇮🇹', region: 'eu', names: 'it', home: ['italy'], market: 1.25 },
  { id: 'ES', name: 'Spain', adj: 'Spanish', flag: '🇪🇸', region: 'eu', names: 'es', home: ['spain', 'madrid'], market: 1.15 },
  { id: 'MC', name: 'Monaco', adj: 'Monégasque', flag: '🇲🇨', region: 'eu', names: 'fr', home: ['monaco'], market: 1.3 },
  { id: 'BE', name: 'Belgium', adj: 'Belgian', flag: '🇧🇪', region: 'eu', names: 'nl', home: ['belgium'], market: 1.0 },
  { id: 'AT', name: 'Austria', adj: 'Austrian', flag: '🇦🇹', region: 'eu', names: 'de', home: ['austria'], market: 1.0 },
  { id: 'CH', name: 'Switzerland', adj: 'Swiss', flag: '🇨🇭', region: 'eu', names: 'de', home: [], market: 1.1 },
  { id: 'FI', name: 'Finland', adj: 'Finnish', flag: '🇫🇮', region: 'eu', names: 'nordic', home: [], market: 0.9 },
  { id: 'DK', name: 'Denmark', adj: 'Danish', flag: '🇩🇰', region: 'eu', names: 'nordic', home: [], market: 0.9 },
  { id: 'SE', name: 'Sweden', adj: 'Swedish', flag: '🇸🇪', region: 'eu', names: 'nordic', home: [], market: 0.9 },
  { id: 'PL', name: 'Poland', adj: 'Polish', flag: '🇵🇱', region: 'eu', names: 'pl', home: [], market: 0.9 },
  { id: 'HU', name: 'Hungary', adj: 'Hungarian', flag: '🇭🇺', region: 'eu', names: 'pl', home: ['hungary'], market: 0.85 },
  { id: 'US', name: 'United States', adj: 'American', flag: '🇺🇸', region: 'am', names: 'en', home: ['miami', 'usa', 'vegas'], market: 1.4 },
  { id: 'CA', name: 'Canada', adj: 'Canadian', flag: '🇨🇦', region: 'am', names: 'en', home: ['canada'], market: 1.1 },
  { id: 'MX', name: 'Mexico', adj: 'Mexican', flag: '🇲🇽', region: 'am', names: 'latam', home: ['mexico'], market: 1.2 },
  { id: 'BR', name: 'Brazil', adj: 'Brazilian', flag: '🇧🇷', region: 'am', names: 'pt', home: ['brazil'], market: 1.15 },
  { id: 'AR', name: 'Argentina', adj: 'Argentine', flag: '🇦🇷', region: 'am', names: 'latam', home: [], market: 1.0 },
  { id: 'CO', name: 'Colombia', adj: 'Colombian', flag: '🇨🇴', region: 'am', names: 'latam', home: [], market: 0.9 },
  { id: 'AU', name: 'Australia', adj: 'Australian', flag: '🇦🇺', region: 'ap', names: 'en', home: ['australia'], market: 1.1 },
  { id: 'NZ', name: 'New Zealand', adj: 'Kiwi', flag: '🇳🇿', region: 'ap', names: 'en', home: [], market: 0.9 },
  { id: 'JP', name: 'Japan', adj: 'Japanese', flag: '🇯🇵', region: 'ap', names: 'jp', home: ['japan'], market: 1.2 },
  { id: 'CN', name: 'China', adj: 'Chinese', flag: '🇨🇳', region: 'ap', names: 'zh', home: ['china'], market: 1.3 },
  { id: 'TW', name: 'Taiwan', adj: 'Taiwanese', flag: '🇹🇼', region: 'ap', names: 'zh', home: [], market: 1.0 },
  { id: 'HK', name: 'Hong Kong', adj: 'Hongkonger', flag: '🇭🇰', region: 'ap', names: 'zh', home: [], market: 1.05 },
  { id: 'KR', name: 'South Korea', adj: 'Korean', flag: '🇰🇷', region: 'ap', names: 'kr', home: [], market: 1.0 },
  { id: 'TH', name: 'Thailand', adj: 'Thai', flag: '🇹🇭', region: 'ap', names: 'th', home: [], market: 0.95 },
  { id: 'IN', name: 'India', adj: 'Indian', flag: '🇮🇳', region: 'ap', names: 'in', home: [], market: 1.1 },
  { id: 'SG', name: 'Singapore', adj: 'Singaporean', flag: '🇸🇬', region: 'ap', names: 'zh', home: ['singapore'], market: 1.0 },
  { id: 'AE', name: 'UAE', adj: 'Emirati', flag: '🇦🇪', region: 'me', names: 'ar', home: ['abudhabi'], market: 1.2 },
  { id: 'SA', name: 'Saudi Arabia', adj: 'Saudi', flag: '🇸🇦', region: 'me', names: 'ar', home: ['saudi'], market: 1.2 },
  { id: 'ZA', name: 'South Africa', adj: 'South African', flag: '🇿🇦', region: 'me', names: 'en', home: [], market: 0.9 },
];

const BY_ID = Object.fromEntries(NATIONS.map((n) => [n.id, n]));

// Track host countries that aren't playable nationalities still need a flag.
const EXTRA_FLAGS = { BH: '🇧🇭', QA: '🇶🇦', AZ: '🇦🇿' };

export const nation = (id) => BY_ID[id] || BY_ID.GB;
export const flagOf = (id) => BY_ID[id]?.flag || EXTRA_FLAGS[id] || '🏁';
