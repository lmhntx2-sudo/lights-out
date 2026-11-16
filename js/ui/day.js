// Words for the daily season: the result to copy, and the challenge to send a friend.
import { daySquares, dayNumber } from '../engine/oneseason.js';
import { dayVs, careerVs } from '../core/vs.js';
import { SERVER } from '../config.js';
import { plural } from '../core/fmt.js';
import { t, trackShort, trackName, getLang } from '../i18n.js';

// The sharer's language rides along, so the link preview speaks it (netlify/lib/preview.mjs).
const lang = () => (getLang() && getLang() !== 'en' ? `&l=${getLang()}` : '');
import { raceWeekend } from '../data/weekends.js';
import { TRACKS } from '../data/tracks.js';

// The game's own address. A copy on a game portal runs on the portal's domain,
// so links go to the real site.
export function siteUrl() {
  if (SERVER.origin) return `${SERVER.origin}/`;
  return typeof location === 'undefined' ? '' : location.origin + location.pathname;
}

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// On a real Grand Prix weekend: the round of the day's season that is the same
// race, and how it went. Null on other days, or if the season stopped before it.
export function dayWeekend(d) {
  const w = raceWeekend(d.date);
  const x = w && d.rounds[w.round];
  if (!x) return w ? { ...w, name: trackName(TRACKS[w.track]), short: trackShort(TRACKS[w.track]), result: '' } : null;
  return { ...w, name: trackName(TRACKS[w.track]), short: trackShort(TRACKS[w.track]), result: !x.p ? t('Did not race') : x.d ? t('DNF') : `P${x.p}` };
}

// The result as a few lines of text and coloured squares: no names, no spoilers,
// and it pastes anywhere.
export function dayShareText(sum, { streak = 0, tier = 0, url = siteUrl() } = {}) {
  const d = sum.day;
  const gp = dayWeekend(d);
  const result = d.pos ? t('P{pos} · {pts}', { pos: d.pos, pts: plural(d.pts, 'point') }) : plural(d.pts, 'point');
  return [
    t('Lights Out daily season #{n}', { n: dayNumber(d.date) }),
    [sum.flag, d.team, tier ? stars(tier) : ''].filter(Boolean).join(' '),
    `${result}${d.met ? ' 🎯' : ''}`,
    ...daySquares(d.rounds, d.of),
    gp?.result ? `🏁 ${gp.short}: ${gp.result}` : '',
    streak > 1 ? `🔥 ${streak}` : '',
    url ? `${url}?daily=${d.date}${lang()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// A link that hands the friend today's season with your points to beat.
export function dayChallengeText(sum, url = siteUrl()) {
  const d = sum.day;
  return [
    t('I scored {pts} (P{pos}) in today’s Lights Out daily season. Same car, same grid, same luck. Beat it:', { pts: plural(d.pts, 'point'), pos: d.pos }),
    `${url}?daily=${d.date}&vs=${encodeURIComponent(dayVs(sum))}${lang()}`,
  ].join('\n');
}

// The link for a full career: the same world, with your legacy score to beat.
export const careerChallengeUrl = (sum, url = siteUrl()) => `${url}?seed=${encodeURIComponent(sum.seed)}&vs=${encodeURIComponent(careerVs(sum))}${sum.diff === 'legend' ? '&d=legend' : ''}${lang()}`;
