// Retirement: the career summary, the epilogue and the share text.
import { nation, flagOf } from '../data/nations.js';
import { LEGENDS } from '../data/legends.js';
import { SINFO, BACKGROUNDS, STYLES } from './constants.js';
import { netWorth } from './achievements.js';
import { overall } from './player.js';
import { money, plural } from '../core/fmt.js';

function tierOf(s, how) {
  const f = s.career.tot.F1;
  if (f.titles >= 7) return 'The greatest of all time';
  if (f.titles >= 4) return 'All-time great';
  if (f.titles >= 2) return 'Multiple world champion';
  if (f.titles === 1) return 'World champion';
  if (f.wins >= 10) return 'Serial race winner';
  if (f.wins >= 1) return 'Grand Prix winner';
  if (f.podiums >= 1) return 'Podium finisher';
  if (f.starts >= 1) return 'Formula 1 driver';
  if (how === 'endurance') return 'Endurance racer';
  const reached = s.career.hist.some((h) => h.series === 'F2');
  return reached ? 'Formula 2 graduate' : 'Junior formula racer';
}

function epilogue(s, how) {
  const d = s.driver;
  const f = s.career.tot.F1;
  const lines = [];
  const ov = overall(d.stats);
  if (how === 'endurance') {
    lines.push(ov >= 80 ? 'You win Le Mans twice and become the face of endurance racing.' : 'You win your class at Le Mans and only miss single-seaters on Sundays.');
  }
  const lastF1 = [...s.career.hist].reverse().find((h) => h.series === 'F1' && h.role === 'race');
  if (f.titles >= 1 && d.stats.technical >= 78 && lastF1) lines.push(`Ten years later you return to the paddock as team principal of ${lastF1.teamName}.`);
  else if (d.fame >= 65) lines.push('You become the sharpest TV pundit in the paddock. Drivers dread your analysis.');
  else if (d.stats.technical >= 75) lines.push('You become a driver coach. Three of your students reach Formula 1.');
  else lines.push('You open a karting track near where you grew up. The coffee is terrible and the kids love it.');

  if (s.flags.foundation) lines.push('The Lights Out Foundation has put hundreds of kids into karting. Two of them are in Formula 3.');
  if (s.flags.yacht) lines.push('Your yacht spends the summer moored within sight of the Swimming Pool chicane.');
  else if (s.flags.monaco) lines.push('You still live in Monaco and watch the Grand Prix from your balcony.');
  if (s.flags.parent) lines.push('Your kid has just started karting. You are the most nervous parent at the track.');
  else if (s.flags.married) lines.push('You and your partner still have no idea what DRS stands for, between you.');
  if (s.flags.kebab_f1) lines.push('Dönerland Express now has forty branches. Every one has a photo of your helmet on the wall.');
  else if (s.flags.kebab) lines.push('Dönerland Express still has your first helmet sticker stuck to the till.');
  if (s.flags.crypto) lines.push("You still get letters from CoinRocket's lawyers.");
  if (s.flags.remortgage) lines.push(s.flags.paid_back ? "Your parents' new house has a trophy room. Your mum dusts it every day." : 'You never did pay back that mortgage. Your parents never once mentioned it.');

  const rv = s.drivers[s.rivalId];
  if (rv) {
    const name = `${rv.first} ${rv.last}`;
    if (rv.titles > 0 || rv.wins > 0) lines.push(`${name}, your karting rival, finished with ${plural(rv.wins, 'win')} and ${plural(rv.titles, 'title')}. You never did get that Christmas card.`);
    else if (rv.starts > 0) lines.push(`${name}, your karting rival, made it to Formula 1 but never won. You were very gracious about it in public.`);
    else lines.push(`${name}, your karting rival, never made it to Formula 1 and now sells car insurance. You feel fine about it. Mostly.`);
  }
  if (f.starts === 0 && how !== 'endurance') lines.push('You never started a Grand Prix, but for a few years you were one of the fastest teenagers on Earth.');
  return lines;
}

// Everyone who ever started a Grand Prix in this world: the fictional legends
// from before 2026, every AI driver since, and you.
export function allTime(s) {
  const rows = LEGENDS.map((l) => ({ ...l, flag: flagOf(l.nat), kind: 'legend' }));
  for (const d of Object.values(s.drivers)) {
    if (d.isPlayer || d.reserve || !(d.starts > 0)) continue;
    rows.push({
      name: `${d.first} ${d.last}`, nat: d.nat, flag: flagOf(d.nat), titles: d.titles, wins: d.wins, podiums: d.podiums, starts: d.starts,
      era: d.out ? 'Retired' : 'Active', kind: d.id === s.rivalId ? 'rival' : 'ai',
    });
  }
  const f = s.career.tot.F1;
  if (f.starts > 0) rows.push({ name: s.driver.name, nat: s.driver.nat, flag: flagOf(s.driver.nat), titles: f.titles, wins: f.wins, podiums: f.podiums, starts: f.starts, era: 'You', kind: 'me' });
  return rows.sort((a, b) => b.titles - a.titles || b.wins - a.wins || b.podiums - a.podiums);
}

export function allTimeRanks(s) {
  const rows = allTime(s);
  const me = rows.find((r) => r.kind === 'me');
  if (!me) return null;
  const byWins = [...rows].sort((a, b) => b.wins - a.wins || b.titles - a.titles);
  return { titles: rows.indexOf(me) + 1, wins: byWins.indexOf(me) + 1, of: rows.length };
}

// The colours of the team you had your best season with.
function liveryOf(s) {
  const seasons = s.career.hist.filter((h) => h.role === 'race');
  const best = [...seasons].sort((a, b) => SINFO[b.series].lvl - SINFO[a.series].lvl || b.pts - a.pts)[0];
  const t = s.teams[best?.team] || s.teams[s.career.team];
  return { color: t?.color || '#E10600', accent: t?.accent || '#FFFFFF' };
}

export function buildSummary(s, how) {
  const d = s.driver;
  const c = s.career;
  const f1 = { ...c.tot.F1 };
  const jr = { ...c.tot.junior };
  const worth = netWorth(s);
  const score = Math.round(f1.titles * 1000 + f1.wins * 50 + f1.podiums * 15 + f1.poles * 20 + f1.starts * 2 + jr.titles * 120 + jr.wins * 10 + d.fame * 3);
  const best = [...c.hist].sort((a, b) => SINFO[b.series].lvl - SINFO[a.series].lvl || (a.pos || 99) - (b.pos || 99))[0];
  return {
    name: d.name,
    code: d.code,
    nat: d.nat,
    flag: nation(d.nat).flag,
    bg: BACKGROUNDS[d.bg].name,
    style: STYLES[d.style].name,
    helmet: d.helmet,
    seed: s.seed,
    daily: s.daily ? { date: s.daily.date, goalText: s.daily.goalText, done: !!s.daily.done } : null,
    how,
    age: d.age,
    seasons: c.hist.length,
    endYear: s.year,
    f1,
    junior: jr,
    teams: c.f1Teams.map((id) => s.teams[id]?.name).filter(Boolean),
    worth,
    score,
    tier: tierOf(s, how),
    lines: epilogue(s, how),
    best: best ? `${best.year}: ${best.pos ? `P${best.pos}` : 'reserve'} in ${SINFO[best.series].name}${best.teamName ? ` with ${best.teamName}` : ''}` : null,
    ach: s.ach.length,
    number: s.driver.number,
    ranks: allTimeRanks(s),
    livery: liveryOf(s),
    at: Date.now(),
  };
}

export function shareText(sum, url) {
  const f = sum.f1;
  const stats = f.starts
    ? `${f.titles ? `${plural(f.titles, 'world title')}, ` : ''}${plural(f.wins, 'win')}, ${plural(f.podiums, 'podium')} in ${plural(f.starts, 'start')}`
    : `${plural(sum.junior.wins, 'junior win')}, no Grand Prix start`;
  return [
    `🏁 ${sum.name} ${sum.flag} retired at ${sum.age}: ${sum.tier}.`,
    stats + '.',
    `Net worth ${money(sum.worth)}. Legacy score ${sum.score}.`,
    `Seed: ${sum.seed}`,
    url ? `Play Lights Out: ${url}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
