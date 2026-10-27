// Retirement: the career summary, the epilogue and the share text. Also the
// family line: what a retired parent passes on to a second-generation career.
import { nation, flagOf } from '../data/nations.js';
import { LEGENDS } from '../data/legends.js';
import { SINFO, BACKGROUNDS, START_YEAR, START_AGE } from './constants.js';
import { netWorth } from './achievements.js';
import { overall, fullName } from './player.js';
import { legacyOf } from './helpers.js';
import { money, plural } from '../core/fmt.js';
import { t as tr, loc, bgText, styleName, seriesName } from '../i18n.js';

export const TIERS = {
  goat: 'The greatest of all time',
  great: 'All-time great',
  multi: 'Multiple world champion',
  champ: 'World champion',
  serial: 'Serial race winner',
  winner: 'Grand Prix winner',
  podium: 'Podium finisher',
  f1: 'Formula 1 driver',
  endurance: 'Endurance racer',
  f2: 'Formula 2 graduate',
  junior: 'Junior formula racer',
};

function tierOf(s, how) {
  return tierFromRecord(s.career.tot.F1, how, s.career.hist.some((h) => h.series === 'F2'));
}

// The tier a Formula 1 record (titles, wins, podiums, starts) earns.
export function tierFromRecord(f, how, reachedF2) {
  if (f.titles >= 7) return 'goat';
  if (f.titles >= 4) return 'great';
  if (f.titles >= 2) return 'multi';
  if (f.titles === 1) return 'champ';
  if (f.wins >= 10) return 'serial';
  if (f.wins >= 1) return 'winner';
  if (f.podiums >= 1) return 'podium';
  if (f.starts >= 1) return 'f1';
  if (how === 'endurance') return 'endurance';
  return reachedF2 ? 'f2' : 'junior';
}

// ------------------------------------------------------------ the family line
//
// A career that ends with a kid (the 'parent' flag) can be continued by that kid.
// Everything the kid inherits travels in setup.legacy, so the global leaderboard
// can replay the kid's career and check the inheritance (replay.js validateLegacy).
//
// The kid's start never beats a royalty start. A parent worth RICH (half a billion) or
// more means the royalty background itself and nothing on top: the family
// fortune is the background. Anyone else's kid is a karting prodigy with a share
// of the savings and a little of the fame, capped at the gap between the two
// backgrounds, so money and fame top out exactly at a royalty start's.
export const RICH = 5e8;
const SHARE = 0.02;
const ROYAL = BACKGROUNDS.royalty;
const PRODIGY = BACKGROUNDS.prodigy;
export const INHERIT_CAP = { money: Math.min(1e6, ROYAL.money - PRODIGY.money), fame: ROYAL.fame - PRODIGY.fame };
const TIER_FAME = { goat: 7, great: 7, multi: 6, champ: 5, serial: 4, winner: 3, podium: 2, f1: 2, endurance: 1, f2: 1, junior: 0 };
export const MAX_GEN = 20;

export function inheritance(worth, tier) {
  if (worth >= RICH) return { bg: 'royalty', money: 0, fame: 0 };
  return {
    bg: 'prodigy',
    money: Math.min(INHERIT_CAP.money, Math.round((Math.max(0, worth) * SHARE) / 10000) * 10000),
    fame: Math.min(INHERIT_CAP.fame, TIER_FAME[tier] ?? 0),
  };
}

// What a retired parent hands down: the setup.legacy for the kid's career, plus
// what the title screen fixes (surname, nationality, background) or suggests (helmet).
export function heirOf(s) {
  if (!s?.flags?.parent || s.stage !== 'retired' || !s.retired) return null;
  const d = s.driver;
  const f = s.career.tot.F1;
  const prev = legacyOf(s);
  const worth = Math.max(0, Math.min(1e11, Math.round(s.retired.worth)));
  const tier = s.retired.tierKey;
  const inh = inheritance(worth, tier);
  const rv = s.drivers[s.rivalId];
  // The kid is born the year after the news and starts in cars at fifteen,
  // but never before the parent has hung up the helmet.
  const year = Math.max(s.flags.parent + 1 + START_AGE, s.year + 1);
  const legacy = {
    gen: Math.min(MAX_GEN, (prev?.gen || 1) + 1),
    first: d.first,
    last: d.last,
    tier,
    titles: f.titles,
    wins: f.wins,
    podiums: f.podiums,
    poles: f.poles,
    starts: f.starts,
    worth,
    number: d.number,
    from: s.career.rookieYear ?? prev?.year ?? START_YEAR,
    to: s.year,
    year,
    rival: rv ? { first: rv.first, last: rv.last, nat: rv.nat } : null,
    money: inh.money,
    fame: inh.fame,
  };
  return { legacy, last: d.last, nat: d.nat, bg: inh.bg, helmet: { c1: d.helmet.c1, c2: d.helmet.c2 }, parent: d.name };
}

export const parentName = (lg) => fullName(lg.first, lg.last);
export const tierName = (key) => loc('tier', key, null, TIERS[key]);

const GEN_WORDS = { 2: () => tr('Second generation'), 3: () => tr('Third generation'), 4: () => tr('Fourth generation'), 5: () => tr('Fifth generation') };

// "Second generation, child of Lennox Hartley." Saved summaries keep the numbers,
// so this follows the current language.
export function familyLine(fam) {
  if (!fam) return '';
  const gen = GEN_WORDS[fam.gen] ? GEN_WORDS[fam.gen]() : tr('Generation {n}', { n: fam.gen });
  return tr('{gen}, child of {parent}.', { gen, parent: fam.parent });
}

// Tier, background and style of a saved career in the current language. Careers
// saved before languages existed only have the English words.
export function summaryWords(sum) {
  return {
    tier: sum.tierKey ? loc('tier', sum.tierKey, null, TIERS[sum.tierKey]) : sum.tier,
    bg: sum.bgId ? bgText(sum.bgId, 'name') : sum.bg,
    style: sum.styleId ? styleName(sum.styleId) : sum.style,
  };
}

function epilogue(s, how) {
  const d = s.driver;
  const f = s.career.tot.F1;
  const lines = [];
  const ov = overall(d.stats);
  if (how === 'endurance') {
    lines.push(ov >= 80 ? tr('You win Le Mans twice and become the face of endurance racing.') : tr('You win your class at Le Mans and only miss single-seaters on Sundays.'));
  }
  const lastF1 = [...s.career.hist].reverse().find((h) => h.series === 'F1' && h.role === 'race');
  if (f.titles >= 1 && d.stats.technical >= 78 && lastF1) lines.push(tr('Ten years later you return to the paddock as team principal of {team}.', { team: lastF1.teamName }));
  else if (d.fame >= 65) lines.push(tr('You become the sharpest TV pundit in the paddock. Drivers dread your analysis.'));
  else if (d.stats.technical >= 75) lines.push(tr('You become a driver coach. Three of your students reach Formula 1.'));
  else lines.push(tr('You open a karting track near where you grew up. The coffee is terrible and the kids love it.'));

  if (s.flags.foundation) lines.push(tr('The Lights Out Foundation has put hundreds of kids into karting. Two of them are in Formula 3.'));
  if (s.flags.yacht) lines.push(tr('Your yacht spends the summer moored within sight of the Swimming Pool chicane.'));
  else if (s.flags.monaco) lines.push(tr('You still live in Monaco and watch the Grand Prix from your balcony.'));
  if (s.flags.parent) lines.push(tr('Your kid has just started karting. You are the most nervous parent at the track.'));
  else if (s.flags.married) lines.push(tr('You and your partner still have no idea what DRS stands for, between you.'));
  if (s.flags.kebab_f1) lines.push(tr('Dönerland Express now has forty branches. Every one has a photo of your helmet on the wall.'));
  else if (s.flags.kebab) lines.push(tr('Dönerland Express still has your first helmet sticker stuck to the till.'));
  if (s.flags.crypto) lines.push(tr("You still get letters from CoinRocket's lawyers."));
  if (s.flags.remortgage) lines.push(s.flags.paid_back ? tr("Your parents' new house has a trophy room. Your mum dusts it every day.") : tr('You never did pay back that mortgage. Your parents never once mentioned it.'));

  const lg = legacyOf(s);
  if (lg) {
    const parent = parentName(lg);
    const mine = [f.titles, f.wins, f.podiums, f.starts];
    const theirs = [lg.titles, lg.wins, lg.podiums, lg.starts];
    const k = mine.findIndex((v, i) => v !== theirs[i]);
    if (k < 0 && !f.starts) lines.push(tr('Neither you nor {parent} ever started a Grand Prix. The kart track still has both your names on the wall.', { parent }));
    else if (k < 0) lines.push(tr('You finished with exactly the same record as {parent}. The family still argues about who was better.', { parent }));
    else if (mine[k] > theirs[k]) lines.push(tr('You finished with a better record than {parent}, and you mention it at every family dinner.', { parent }));
    else lines.push(tr('{parent} still has the better record, and brings it up at every family dinner.', { parent }));
    if (s.flags.family_loan) lines.push(tr('You paid {parent} back every cent. They framed the cheque.', { parent }));
  }

  const rv = s.drivers[s.rivalId];
  if (rv) {
    const name = `${rv.first} ${rv.last}`;
    if (rv.titles > 0 || rv.wins > 0) lines.push(tr('{name}, your karting rival, finished with {wins} and {titles}. You never did get that Christmas card.', { name, wins: plural(rv.wins, 'win'), titles: plural(rv.titles, 'title') }));
    else if (rv.starts > 0) lines.push(tr('{name}, your karting rival, made it to Formula 1 but never won. You were very gracious about it in public.', { name }));
    else lines.push(tr('{name}, your karting rival, never made it to Formula 1 and now sells car insurance. You feel fine about it. Mostly.', { name }));
  }
  if (f.starts === 0 && how !== 'endurance') lines.push(tr('You never started a Grand Prix, but for a few years you were one of the fastest teenagers on Earth.'));
  return lines;
}

// Everyone who ever started a Grand Prix in this world: the fictional legends
// from before 2026, every AI driver since, your parent if you are the second
// generation, and you.
export function allTime(s) {
  const rows = LEGENDS.map((l) => ({ ...l, flag: flagOf(l.nat), kind: 'legend' }));
  for (const d of Object.values(s.drivers)) {
    if (d.isPlayer || d.reserve || !(d.starts > 0)) continue;
    rows.push({
      name: `${d.first} ${d.last}`, nat: d.nat, flag: flagOf(d.nat), titles: d.titles, wins: d.wins, podiums: d.podiums, starts: d.starts,
      era: d.out ? tr('Retired') : tr('Active'), kind: d.id === s.rivalId ? 'rival' : 'ai',
    });
  }
  const lg = legacyOf(s);
  if (lg?.starts > 0) {
    rows.push({ name: parentName(lg), nat: s.driver.nat, flag: flagOf(s.driver.nat), titles: lg.titles, wins: lg.wins, podiums: lg.podiums, starts: lg.starts, era: `${lg.from}-${lg.to}`, kind: 'parent' });
  }
  const f = s.career.tot.F1;
  if (f.starts > 0) rows.push({ name: s.driver.name, nat: s.driver.nat, flag: flagOf(s.driver.nat), titles: f.titles, wins: f.wins, podiums: f.podiums, starts: f.starts, era: tr('You'), kind: 'me' });
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

function bestSeason(b) {
  const v = { pos: b.pos ? `P${b.pos}` : tr('reserve'), series: seriesName(b.series), team: b.teamName };
  return b.teamName ? tr('{pos} in {series} with {team}', v) : tr('{pos} in {series}', v);
}

export function buildSummary(s, how) {
  const d = s.driver;
  const c = s.career;
  const f1 = { ...c.tot.F1 };
  const jr = { ...c.tot.junior };
  const worth = netWorth(s);
  const score = Math.round(f1.titles * 1000 + f1.wins * 50 + f1.podiums * 15 + f1.poles * 20 + f1.starts * 2 + jr.titles * 120 + jr.wins * 10 + d.fame * 3);
  const best = [...c.hist].sort((a, b) => SINFO[b.series].lvl - SINFO[a.series].lvl || (a.pos || 99) - (b.pos || 99))[0];
  const lg = legacyOf(s);
  return {
    name: d.name,
    code: d.code,
    nat: d.nat,
    flag: nation(d.nat).flag,
    bg: bgText(d.bg, 'name'),
    bgId: d.bg,
    style: styleName(d.style),
    styleId: d.style,
    helmet: d.helmet,
    seed: s.seed,
    daily: s.daily ? { date: s.daily.date, goal: s.daily.goal, goalText: s.daily.goalText, done: !!s.daily.done } : null,
    how,
    age: d.age,
    seasons: c.hist.length,
    endYear: s.year,
    f1,
    junior: jr,
    teams: c.f1Teams.map((id) => s.teams[id]?.name).filter(Boolean),
    worth,
    score,
    tier: loc('tier', tierOf(s, how), null, TIERS[tierOf(s, how)]),
    tierKey: tierOf(s, how),
    lines: epilogue(s, how),
    best: best ? `${best.year}: ${bestSeason(best)}` : null,
    ach: s.ach.length,
    number: s.driver.number,
    ranks: allTimeRanks(s),
    livery: liveryOf(s),
    ...(lg ? { family: { gen: lg.gen, parent: parentName(lg), tierKey: lg.tier } } : {}),
    at: Date.now(),
  };
}

export function shareText(sum, url) {
  const f = sum.f1;
  const n = { titles: plural(f.titles, 'world title'), wins: plural(f.wins, 'win'), podiums: plural(f.podiums, 'podium'), starts: plural(f.starts, 'start') };
  const stats = !f.starts
    ? tr('{wins}, no Grand Prix start.', { wins: plural(sum.junior.wins, 'junior win') })
    : f.titles
      ? tr('{titles}, {wins}, {podiums} in {starts}.', n)
      : tr('{wins}, {podiums} in {starts}.', n);
  return [
    tr('🏁 {name} {flag} retired at {age}: {tier}.', { name: sum.name, flag: sum.flag, age: sum.age, tier: summaryWords(sum).tier }),
    familyLine(sum.family),
    stats,
    tr('Net worth {money}. Legacy score {score}.', { money: money(sum.worth), score: sum.score }),
    tr('Seed: {seed}', { seed: sum.seed }),
    url ? tr('Play Lights Out: {url}', { url: `${url}?seed=${encodeURIComponent(sum.seed)}` }) : '',
  ]
    .filter(Boolean)
    .join('\n');
}
