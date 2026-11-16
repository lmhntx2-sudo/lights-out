// Real Grand Prix weekends. On these days the daily season points at the round
// its calendar shares with the race the world is watching. Words only: nothing
// here changes how a season plays, and a wrong date costs a line of text.
//
// Dates are Hong Kong days, like the daily season itself, Friday to Sunday.
// Add the next season's weekends here when its calendar is confirmed.
import { CALENDARS } from './tracks.js';

export const WEEKENDS = [
  { from: '2026-11-20', to: '2026-11-22', track: 'vegas' },
  { from: '2026-11-27', to: '2026-11-29', track: 'qatar' },
  { from: '2026-12-04', to: '2026-12-06', track: 'abudhabi' },
];

// The weekend a day falls in, with the round of the Formula 1 calendar it matches (from 0).
export function raceWeekend(date) {
  const w = typeof date === 'string' ? WEEKENDS.find((x) => date >= x.from && date <= x.to) : null;
  const round = w ? CALENDARS.F1.indexOf(w.track) : -1;
  return round < 0 ? null : { track: w.track, round };
}
