// Retirement: the career summary, the epilogue and the share text.
import { nation, flagOf } from '../data/nations.js';
import { LEGENDS } from '../data/legends.js';
import { SINFO } from './constants.js';
import { netWorth } from './achievements.js';
import { overall } from './player.js';
import { sponsorKind } from './helpers.js';
import { money, plural } from '../core/fmt.js';
import { t as tr, loc, bgText, styleName, seriesName, macauGreats } from '../i18n.js';

const TIERS = {
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
  const f = s.career.tot.F1;
  if (f.titles >= 7) return 'goat';
  if (f.titles >= 4) return 'great';
  if (f.titles >= 2) return 'multi';
  if (f.titles === 1) return 'champ';
  if (f.wins >= 10) return 'serial';
  if (f.wins >= 1) return 'winner';
  if (f.podiums >= 1) return 'podium';
  if (f.starts >= 1) return 'f1';
  if (how === 'endurance') return 'endurance';
  const reached = s.career.hist.some((h) => h.series === 'F2');
  return reached ? 'f2' : 'junior';
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

// Your first sponsor, years later: big if their logo went back on your helmet in F1.
const SPONSOR_LATER = {
  doner: (big) => (big ? tr('Dönerland Express now has forty branches. Every one has a photo of your helmet on the wall.') : tr('Dönerland Express still has your first helmet sticker stuck to the till.')),
  hk: (big) => (big ? tr('Sun Keung Kee now has forty branches. Every one has a photo of your helmet on the wall.') : tr('Sun Keung Kee still has your first helmet sticker on the milk tea urn.')),
  tw: (big) => (big ? tr('A-Ma Boba now has forty branches. Every one has a photo of your helmet on the wall.') : tr('A-Ma Boba still has your first helmet sticker on the cup-sealing machine.')),
  mo: (big) => (big ? tr('Ping Kee now has forty branches. Every one has a photo of your helmet on the wall.') : tr('Ping Kee still has your first helmet sticker on the grill hood.')),
};

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
  if (s.flags.kebab) lines.push(SPONSOR_LATER[sponsorKind(d.nat)](!!s.flags.kebab_f1));
  if (s.flags.macau_win) lines.push(tr('Your name is still on the list of Macau Grand Prix winners, a few lines below {senna} and {schumacher}.', macauGreats()));
  if (s.flags.crypto) lines.push(tr("You still get letters from CoinRocket's lawyers."));
  if (s.flags.remortgage) lines.push(s.flags.paid_back ? tr("Your parents' new house has a trophy room. Your mum dusts it every day.") : tr('You never did pay back that mortgage. Your parents never once mentioned it.'));

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
// from before 2026, every AI driver since, and you.
export function allTime(s) {
  const rows = LEGENDS.map((l) => ({ ...l, flag: flagOf(l.nat), kind: 'legend' }));
  for (const d of Object.values(s.drivers)) {
    if (d.isPlayer || d.reserve || !(d.starts > 0)) continue;
    rows.push({
      name: `${d.first} ${d.last}`, nat: d.nat, flag: flagOf(d.nat), titles: d.titles, wins: d.wins, podiums: d.podiums, starts: d.starts,
      era: d.out ? tr('Retired') : tr('Active'), kind: d.id === s.rivalId ? 'rival' : 'ai',
    });
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
    stats,
    tr('Net worth {money}. Legacy score {score}.', { money: money(sum.worth), score: sum.score }),
    tr('Seed: {seed}', { seed: sum.seed }),
    url ? tr('Play Lights Out: {url}', { url }) : '',
  ]
    .filter(Boolean)
    .join('\n');
}
