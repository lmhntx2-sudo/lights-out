import { pushFeed, legacyOf } from './helpers.js';
import { loc } from '../i18n.js';

// on: when the check runs. 'manual' ones are unlocked directly by events or the UI.
// x for race: { series, pos, dnf, grid, pole, fl, wet, trackId, home, standin, pts }
// x for season: { series, pos, champion }
const A = (id, icon, name, desc, on, test) => ({ id, icon, name, desc, on, test });

const f1 = (s) => s.career.tot.F1;
const won = (x) => x.series === 'F1' && x.pos === 1 && !x.dnf;

export const ACHIEVEMENTS = [
  A('lights_out', '🚦', 'Lights out', 'Start your first car race.', 'race', () => true),
  A('junior_win', '🥇', 'Silverware', 'Win a junior formula race.', 'race', (s, x) => x.series !== 'F1' && x.pos === 1 && !x.dnf),
  A('f4_champ', '🏆', 'F4 champion', 'Win the Formula 4 title.', 'season', (s, x) => x.series === 'F4' && x.champion),
  A('f3_champ', '🏆', 'F3 champion', 'Win the Formula 3 title.', 'season', (s, x) => x.series === 'F3' && x.champion),
  A('f2_champ', '🏆', 'F2 champion', 'Win the Formula 2 title.', 'season', (s, x) => x.series === 'F2' && x.champion),
  A('superlicence', '🪪', 'Superlicence', 'Earn 40 superlicence points.', 'manual'),
  A('f1_debut', '🏎️', 'Welcome to the show', 'Start a Formula 1 race.', 'race', (s, x) => x.series === 'F1'),
  A('f1_points', '🔟', 'On the board', 'Score your first Formula 1 points.', 'race', (s, x) => x.series === 'F1' && x.pts > 0),
  A('f1_podium', '🍾', 'Champagne', 'Finish on a Formula 1 podium.', 'race', (s, x) => x.series === 'F1' && x.pos <= 3 && !x.dnf),
  A('f1_win', '🏁', 'Grand Prix winner', 'Win a Formula 1 race.', 'race', (s, x) => won(x)),
  A('f1_pole', '⏱️', 'Pole sitter', 'Take pole position in Formula 1.', 'race', (s, x) => x.series === 'F1' && x.pole),
  A('f1_champ', '👑', 'World champion', 'Win the Formula 1 world title.', 'season', (s, x) => x.series === 'F1' && x.champion),
  A('double_champ', '✌️', 'Back to back', 'Win two Formula 1 titles in a row.', 'season', (s, x) => {
    const h = s.career.hist;
    const n = h.length;
    return x.series === 'F1' && x.champion && n >= 2 && h[n - 2].series === 'F1' && h[n - 2].champion;
  }),
  A('five_titles', '🖐️', 'Dynasty', 'Win five Formula 1 titles.', 'season', (s) => f1(s).titles >= 5),
  A('eight_titles', '🐐', 'The greatest', 'Win eight Formula 1 titles.', 'season', (s) => f1(s).titles >= 8),
  A('monaco_win', '💎', 'Jewel in the crown', 'Win the Monaco Grand Prix.', 'race', (s, x) => won(x) && x.trackId === 'monaco'),
  A('home_win', '🏠', 'Home hero', 'Win your home Grand Prix.', 'race', (s, x) => won(x) && x.home),
  A('wet_win', '🌧️', 'Rainmaster', 'Win a wet Formula 1 race.', 'race', (s, x) => won(x) && x.wet),
  A('from_back', '🚀', 'From the back', 'Win a Formula 1 race from P10 or lower.', 'race', (s, x) => won(x) && x.grid >= 10),
  A('grand_slam', '🎯', 'Grand slam', 'Pole, win and fastest lap in the same race.', 'race', (s, x) => won(x) && x.pole && x.fl),
  A('wins_10', '🔥', 'Serial winner', 'Win ten Formula 1 races.', 'race', (s) => f1(s).wins >= 10),
  A('wins_50', '🌋', 'Half century', 'Win fifty Formula 1 races.', 'race', (s) => f1(s).wins >= 50),
  A('starts_100', '💯', 'Centurion', 'Start one hundred Formula 1 races.', 'race', (s) => f1(s).starts >= 100),
  A('starts_300', '🦾', 'Iron man', 'Start three hundred Formula 1 races.', 'race', (s) => f1(s).starts >= 300),
  A('teen_winner', '🧒', 'Teen sensation', 'Win a Formula 1 race before turning 20.', 'race', (s, x) => won(x) && s.driver.age < 20),
  A('rookie_win', '⚡', 'Instant impact', 'Win a race in your rookie Formula 1 season.', 'race', (s, x) => won(x) && s.career.rookieYear === s.year),
  A('millionaire', '💰', 'Millionaire', 'Reach a net worth of $10M.', 'season', (s) => netWorth(s) >= 1e7),
  A('hundred_mil', '🛥️', 'Monaco money', 'Reach a net worth of $100M.', 'season', (s) => netWorth(s) >= 1e8),
  A('billionaire', '🏦', 'Billionaire', 'Reach a net worth of $1B.', 'season', (s) => netWorth(s) >= 1e9),
  A('tifosi', '🔴', 'Tifosi', 'Race for Scuderia Rossa.', 'race', (s, x) => x.series === 'F1' && x.team === 'rossa'),
  A('red_legend', '🐎', 'Red legend', 'Win the world title with Scuderia Rossa.', 'season', (s, x) => x.series === 'F1' && x.champion && s.career.team === 'rossa'),
  A('loyal', '🤝', 'One-team driver', 'Retire after 8+ Formula 1 seasons at a single team.', 'retire', (s) => f1Seasons(s) >= 8 && s.career.f1Teams.length === 1),
  A('journeyman', '🧳', 'Journeyman', 'Race for five different Formula 1 teams.', 'race', (s) => s.career.f1Teams.length >= 5),
  A('super_sub', '🦸', 'Super sub', 'Score points as a stand-in driver.', 'race', (s, x) => x.standin && x.pts > 0),
  A('never_f1', '🥲', 'So close', 'Retire without starting a Formula 1 race.', 'retire', (s) => f1(s).starts === 0),
  A('multi21', '📻', 'Multi 21', 'Ignore a team order.', 'manual'),
  A('crash_magnet', '💥', 'Crash magnet', 'Retire from three races in a row.', 'race', (s) => (s.career.dnfStreak || 0) >= 3),
  A('teammate_destroyer', '🪓', 'Teammate destroyer', 'Beat your teammate in five Formula 1 seasons.', 'season', (s) => s.career.hist.filter((h) => h.series === 'F1' && h.beatTm).length >= 5),
  A('crypto_bust', '📉', 'To the moon', 'Survive a sponsor collapse.', 'manual'),
  A('kebab_king', '🥙', 'Kebab king', 'Win a Formula 1 race with your first sponsor still cheering.', 'race', (s, x) => won(x) && s.flags.kebab),
  A('nemesis', '⚔️', 'Nemesis', 'Win the world title with your karting rival on the grid.', 'season', (s, x) => x.series === 'F1' && x.champion && s.drivers[s.rivalId]?.series === 'F1' && !s.drivers[s.rivalId]?.out),
  A('decider', '🎆', 'Final-round hero', 'Clinch the title at the last race.', 'manual'),
  A('foundation', '🫶', 'Giving back', 'Start your own karting foundation.', 'manual'),
  A('old_guard', '🧓', 'Old guard', 'Start a Formula 1 race aged 40 or older.', 'race', (s, x) => x.series === 'F1' && s.driver.age >= 40),
  A('points_1000', '🧮', 'Points machine', 'Score 1,000 Formula 1 points.', 'race', (s) => f1(s).points >= 1000),
  A('sim_to_real', '🎮', 'Sim to real', 'Win a Formula 1 race as a former sim racer.', 'race', (s, x) => won(x) && s.driver.bg === 'simracer'),
  A('underdog_champ', '🔧', 'From the garage', "Win the world title as a mechanic's kid.", 'season', (s, x) => x.series === 'F1' && x.champion && s.driver.bg === 'grafter'),
  A('paid_in_full', '🎩', 'Earned it', 'Win a Formula 1 race as paddock royalty.', 'race', (s, x) => won(x) && s.driver.bg === 'royalty'),
  A('endurance', '🕛', 'Endurance convert', 'Leave single-seaters for endurance racing.', 'manual'),
  A('family', '👶', 'Racing family', 'Become a parent.', 'manual'),
  A('heir', '🧬', 'Family business', 'Win a Grand Prix as a second-generation driver.', 'race', (s, x) => won(x) && !!legacyOf(s)),
  A('surpass', '📈', 'Out of the shadow', 'Win more Grands Prix than your parent did.', 'race', (s) => !!legacyOf(s) && f1(s).wins > legacyOf(s).wins),
  A('pit_crew', '☕', 'Pit crew', 'Fuel the developer with a coffee.', 'manual'),
  A('daily', '📅', 'Daily driver', 'Complete a daily challenge.', 'manual'),
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Name and description in the current language.
export const achWords = (a) => ({ name: loc('ach', a.id, 'name', a.name), desc: loc('ach', a.id, 'desc', a.desc) });

export function netWorth(s) {
  return s.driver.money + s.driver.assets.reduce((a, b) => a + b.value, 0);
}

export function f1Seasons(s) {
  return s.career.hist.filter((h) => h.series === 'F1' && h.starts > 0).length;
}

export function unlock(s, id) {
  if (!ACH_BY_ID[id] || s.ach.includes(id)) return false;
  s.ach.push(id);
  const a = ACH_BY_ID[id];
  pushFeed(s, { k: 'ach', id, icon: a.icon, ...achWords(a) });
  return true;
}

export function checkAch(s, on, x = {}) {
  for (const a of ACHIEVEMENTS) {
    if (a.on !== on || s.ach.includes(a.id)) continue;
    try {
      if (a.test(s, x)) unlock(s, a.id);
    } catch {
      // A broken check should never break the game.
    }
  }
}
