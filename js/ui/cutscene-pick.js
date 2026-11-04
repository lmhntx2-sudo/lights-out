// Which 3D cutscene, if any, a button press has earned. Pure: it reads the career
// before and after the press and the feed entries the press added, and never
// touches the engine, so careers play and replay exactly the same with or
// without cutscenes. At most one scene per press: the biggest moment wins.
import { nation } from '../data/nations.js';
import { TRACKS } from '../data/tracks.js';
import { ACH_BY_ID, achWords } from '../engine/achievements.js';
import { t, trackName } from '../i18n.js';

// Places with a scene of their own. Everyone else gets a home crowd in their flag's colours.
export const PLACES = { HK: 'hk', JP: 'jp', KR: 'kr', TW: 'tw', MO: 'mo' };

export const SCENES = ['debut', 'win', 'title', 'proposal', 'baby', 'retire', 'hk', 'jp', 'kr', 'tw', 'mo', 'home'];

// What act() remembers from before a press.
export const snapshot = (s) => ({ firsts: { ...s.career.firsts }, flags: { ...s.flags } });

export function pickCutscene(s, before, fresh, resolved) {
  const nat = s.driver.nat;
  const n = nation(nat);
  const place = PLACES[nat] || 'home';
  const isNew = (k) => !!s.career.firsts[k] && !before.firsts[k];
  const flagNew = (k) => !!s.flags[k] && !before.flags[k];
  const mile = (icon) => fresh.find((e) => e.k === 'mile' && e.icon === icon);
  const race = fresh.filter((e) => e.k === 'race').pop();
  const at = race?.track || '';
  const scene = (name, title, sub, extra) => ({ scene: name, title, sub, ...extra });

  const champ = fresh.find((e) => e.k === 'season' && e.champion && e.series === 'F1');
  if (champ) return scene('title', `${t('World')} ${t('Champion')}`, String(champ.year), { kicker: '🏆', title2: [t('World'), t('Champion')] });

  if (isNew('f1natwin')) return scene(place, mile(n.flag)?.title, at, { kicker: n.flag });
  if (flagNew('macau_win') && isNew('macau')) return scene('mo', mile('🏮')?.title, at, { kicker: '🏮' });
  const homeWin = fresh.find((e) => e.k === 'ach' && e.id === 'home_win');
  if (homeWin) return scene(place, achWords(ACH_BY_ID.home_win, nat).name, at, { kicker: n.flag });
  if (isNew('f1win')) return scene('win', mile('🏁')?.title, at, { kicker: '🏁' });
  if (isNew('koreagp')) return scene('kr', mile(n.flag)?.title, trackName(TRACKS.korea), { kicker: n.flag });
  if (isNew('f1first')) return scene(place, mile(n.flag)?.title, at, { kicker: n.flag });
  if (isNew('f1start')) return scene('debut', mile('🏎️')?.title, at, { kicker: '🚦' });

  if (flagNew('married') && resolved) return scene('proposal', resolved.title, resolved.out, { kicker: '💍' });
  if (flagNew('parent') && resolved) return scene('baby', resolved.title, resolved.out, { kicker: '🍼' });

  const done = fresh.find((e) => e.k === 'retire');
  if (done) return scene('retire', done.name, done.tier, { kicker: '🏁' });
  return null;
}
