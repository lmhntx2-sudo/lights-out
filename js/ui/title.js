import { h } from './dom.js';
import { helmet, HELMET_DESIGNS } from './helmet.js';
import { NATIONS, REGIONS, nation } from '../data/nations.js';
import { NAME_POOLS } from '../data/names.js';
import { STYLES, BACKGROUNDS, HELMET_COLORS, SUPPORTER_COLORS } from '../engine/constants.js';
import { newSeed, cleanSeed } from '../core/rng.js';
import { todayKey } from '../engine/daily.js';
import { dayBrief } from '../engine/game.js';
import { ONE_SEASON, dayNumber } from '../engine/oneseason.js';
import { ACHIEVEMENTS } from '../engine/achievements.js';
import { familyLine, heirOf } from '../engine/legacy.js';
import { money, plural } from '../core/fmt.js';
import { store } from '../store.js';
import { coffeeButton } from './donate.js';
import { openHallOfFame, openAchievements, openSettings, openBackup, openAbout, allUnlocked, openLeaderboard, confirmDialog } from './modals.js';
import { car } from './car.js';
import { circuit } from './circuit.js';
import { TRACKS, CALENDARS } from '../data/tracks.js';
import { flagOf } from '../data/nations.js';
import { sfx } from './sfx.js';
import { t, getLang, getVariant, LANGS, loc, natName, styleName, styleDesc, bgText, gap } from '../i18n.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// A kid whose family name is written in Chinese characters, kana or Hangul
// gets a given name in the same script. Kanji alone reads as Japanese when the
// game is in Japanese.
const HAN_GIVEN = ['卓言', '子朗', '心悅', '浩然', '曉晴', '天佑', '詠恩', '俊希', '嘉怡', '朗晴', '樂軒', '芷澄'];
const JA_GIVEN = ['翔太', '結衣', '蓮', '陽菜', '大翔', '美咲', '悠真', '葵', '颯', '凛', '湊', '結菜'];
const KO_GIVEN = ['민준', '서연', '도윤', '지우', '하준', '서윤', '시우', '하은', '주원', '지민', '예준', '수아'];

const DESIGN_NAMES = {
  stripe: () => t('Stripe'),
  chevron: () => t('Chevron'),
  halves: () => t('Halves'),
  stars: () => t('Stars'),
  flames: () => t('Flames'),
  checks: () => t('Checks'),
};

function givenIn(family = '') {
  if (/[\uac00-\ud7af]/.test(family)) return pick(KO_GIVEN);
  if (/[\u3040-\u30ff]/.test(family) || (getLang() === 'ja' && /[\u3400-\u9fff]/.test(family))) return pick(JA_GIVEN);
  if (/[\u3400-\u9fff]/.test(family)) return pick(HAN_GIVEN);
  return null;
}

// A new career starts with the flag that goes with the game's language.
const homeNat = () => ({ ja: 'JP', ko: 'KR', zh: getVariant() === 'tw' ? 'TW' : 'HK' })[getLang()] || 'GB';

function randomName(nat, family) {
  const pool = NAME_POOLS[nation(nat).names] || NAME_POOLS.en;
  return { first: givenIn(family || '') || pick(pool.f), last: pick(pool.l) };
}

function gantry() {
  const pods = Array.from({ length: 5 }, () => h('div', { class: 'pod' }, h('i', { class: 'lamp' }), h('i', { class: 'lamp' })));
  return { el: h('div', { class: 'gantry', 'aria-hidden': 'true' }, pods), pods };
}

// Five reds, one by one, then a random hold and lights out.
export function runLights(pods, { step = 520, done } = {}) {
  const lamps = (p) => p.querySelectorAll('.lamp');
  pods.forEach((p) => lamps(p).forEach((l) => l.classList.remove('on')));
  pods.forEach((p, i) =>
    setTimeout(() => {
      lamps(p).forEach((l) => l.classList.add('on'));
      sfx.light();
    }, step * (i + 1)),
  );
  const hold = step * 5 + 450 + Math.random() * 700;
  setTimeout(() => {
    pods.forEach((p) => lamps(p).forEach((l) => l.classList.remove('on')));
    sfx.go();
    done?.();
  }, hold);
}

// The language picker, each language written in itself.
function langButton(app) {
  const list = h(
    'select',
    { class: 'lang-pick', 'aria-label': 'Language · 語言 · 言語 · 언어', onChange: (e) => app.setLanguage(e.target.value) },
    LANGS.map(([code, label, tag]) => h('option', { value: code, lang: tag, selected: code === getLang() }, label)),
  );
  return h('label', { class: 'btn btn-ghost lang-btn' }, '🌐 ', list);
}

// heir: a retired parent's kid (legacy.js heirOf). Surname, nationality and
// background come from the family; the helmet starts in the family colours.
// daily: today's daily season. vs: a friend's result to beat, from a challenge
// link. missed: the link was for another day's season.
export function renderTitle(app, { seed, daily, form: kept, heir, vs = null, missed = false } = {}) {
  const root = document.getElementById('app');
  const save = store.loadGame();
  const today = todayKey();
  const dly = daily && !heir ? dayBrief(today) : null;
  // Today's daily season, if this browser has started or finished it.
  const daySave = store.loadDay();
  const dayNow = daySave?.setup?.day === today ? daySave : null;
  const dayDone = store.days()[today] || null;
  const streak = store.streak(today);
  // A language switch redraws the title with the same form, and without the intro again.
  const anim = app.settings.anim !== 'off' && !kept;

  const nat = homeNat();
  const init = randomName(nat);
  const form = kept || {
    first: init.first,
    last: init.last,
    nat,
    style: 'fighter',
    bg: 'prodigy',
    helmet: { c1: '#F2F2F2', c2: '#E8002D', p: 'stripe' },
    number: 2 + Math.floor(Math.random() * 98),
    seed: cleanSeed(seed) || newSeed(),
  };
  if (dly && !kept) Object.assign(form, { ...(store.dayDriver() || {}), nat: dly.nat, style: dly.style, bg: dly.bg, seed: dly.seed });
  if (heir && !kept) Object.assign(form, { first: randomName(heir.nat, heir.last).first, last: heir.last, nat: heir.nat, bg: heir.bg, helmet: { ...heir.helmet } });
  app.title = { opts: { seed, daily, heir, vs, missed }, form };
  // Fields the family decides, like the daily challenge decides its own.
  const fixed = !!dly || !!heir;

  // ---------------------------------------------------------------- hero
  const builder = h('section', { class: 'builder', 'aria-labelledby': 'build-h' });
  const g = gantry();
  const word = h('h1', { class: `wordmark ${anim ? 'wait' : ''}` }, h('span', null, 'Lights'), h('span', null, 'Out'));
  // Beside "Out", a light laps a circuit from the calendar, a different one each visit.
  const lapId = CALENDARS.F1[Math.floor(Math.random() * CALENDARS.F1.length)];
  const lap = h('div', { class: 'hero-lap', 'aria-hidden': 'true' }, circuit(lapId, { size: 'big', trail: anim }), h('small', null, `${flagOf(TRACKS[lapId].nat)} ${TRACKS[lapId].place}`));
  const launch = h('div', { class: 'launch', 'aria-hidden': 'true' }, h('div', { class: 'grid-box' }), h('div', { class: 'marks' }), car({ color: '#E10600', accent: '#FFFFFF', number: form.number }));
  const ach = allUnlocked(app);
  const actions = h('div', { class: 'hero-actions' });
  if (save && save.stage !== 'retired') {
    actions.append(
      h('button', { class: 'btn btn-go', onClick: () => app.continueGame() }, t('Continue career'), h('small', { style: 'font-style:normal;font-weight:600;opacity:.85' }, t('{name}, {year}', { name: save.driver.name, year: save.year }))),
    );
  }
  // A retired parent's kid can still be picked up later, even after a reload.
  const waiting = !heir && !dly && save?.stage === 'retired' ? heirOf(save) : null;
  if (waiting) {
    actions.append(
      h('button', { class: 'btn btn-go', onClick: () => app.showTitle({ heir: waiting }) }, t('Continue with your kid'), h('small', { style: 'font-style:normal;font-weight:600;opacity:.85' }, t('Child of {parent}', { parent: waiting.parent }))),
    );
  }
  if (!dly) {
    const toBuilder = () => {
      document.getElementById('first')?.focus({ preventScroll: true });
      builder.scrollIntoView({ behavior: anim ? 'smooth' : 'auto', block: 'start' });
    };
    actions.append(h('button', { class: (save && save.stage !== 'retired') || waiting ? 'btn' : 'btn btn-go', onClick: toBuilder }, t('New career')));
  }
  actions.append(
    dly || heir
      ? h('button', { class: 'btn', onClick: () => app.showTitle() }, t('Back to free play'))
      : h(
          'button',
          { class: `btn btn-day${dayDone ? ' done' : ''}`, onClick: () => app.openDaily() },
          t('Daily season'),
          h('small', null, dayDone
            ? `✓ ${dayDone.pos ? t('P{pos} · {pts}', { pos: dayDone.pos, pts: plural(dayDone.pts, 'point') }) : plural(dayDone.pts, 'point')}`
            : dayNow?.season
              ? t('Round {round} of {of}', { round: Math.min(dayNow.season.round + 1, dayNow.season.cal.length), of: dayNow.season.cal.length })
              : t('5 minutes')),
          streak > 0 ? h('span', { class: 'streak', title: t('{n}-day streak', { n: streak }) }, `🔥 ${streak}`) : null,
        ),
  );
  const hero = h(
    'section',
    { class: 'hero' },
    g.el,
    launch,
    h('div', { class: 'word-wrap' }, word, lap),
    h('p', { class: 'tagline' }, t('A racing life, from a battered kart at eight to your final lap in Formula 1. '), h('strong', null, t('Every call on the pit wall is yours.'))),
    actions,
    h(
      'nav',
      { class: 'title-links', 'aria-label': t('More') },
      h('button', { class: 'btn btn-ghost', onClick: () => openLeaderboard(app, { tab: dly ? 'day' : 'all' }) }, `🏆 ${t('Global leaderboard')}`),
      h('button', { class: 'btn btn-ghost', onClick: () => openHallOfFame(app) }, t('Hall of fame')),
      h('button', { class: 'btn btn-ghost', onClick: () => openAchievements(app) }, t('Achievements {got}/{all}', { got: ach.size, all: ACHIEVEMENTS.length })),
      h('button', { class: 'btn btn-ghost', onClick: () => openBackup(app) }, t('Backup')),
      h('button', { class: 'btn btn-ghost', onClick: () => openSettings(app) }, t('Settings')),
      h('button', { class: 'btn btn-ghost', onClick: () => openAbout() }, t('About')),
      langButton(app),
    ),
    h(
      'div',
      { class: 'fuel-line' },
      h('p', null, app.supporter ? t('You are in the pit crew. Thank you for keeping this free for everyone.') : t('Free to play, no ads, made by one person. If you enjoy it, you can keep it running.')),
      coffeeButton(app),
    ),
  );

  // ---------------------------------------------------------------- builder
  const preview = h('div');
  const carPreview = h('div', { class: 'car-preview' });
  const designRow = h('div', { class: 'designs', role: 'group', 'aria-label': t('Helmet design') });
  const drawDesigns = () =>
    designRow.replaceChildren(
      ...HELMET_DESIGNS.map((p) => {
        const name = DESIGN_NAMES[p]();
        const b = h('button', { class: 'design', type: 'button', 'aria-pressed': (form.helmet.p || 'stripe') === p ? 'true' : 'false', title: name, 'aria-label': name }, helmet({ ...form.helmet, p }));
        b.addEventListener('click', () => {
          form.helmet.p = p;
          updatePreview();
        });
        return b;
      }),
    );
  const updatePreview = () => {
    preview.replaceChildren(helmet(form.helmet, { gold: app.supporter, label: t('Your helmet') }));
    drawDesigns();
    carPreview.replaceChildren(car({ color: form.helmet.c1, accent: form.helmet.c2, number: form.number, helmet: form.helmet.c1 }, { label: t('Your car, number {n}', { n: form.number }) }));
  };

  const numIn = h('input', { class: 'input num-input', type: 'number', min: 2, max: 99, value: form.number, 'aria-label': t('Race number, 2 to 99') });
  numIn.addEventListener('input', () => {
    const n = Math.round(Number(numIn.value));
    if (n >= 2 && n <= 99) {
      form.number = n;
      updatePreview();
    }
  });
  const numDice = h('button', {
    class: 'btn icon-btn', type: 'button', title: t('Random number'), 'aria-label': t('Random number'),
    onClick: () => {
      form.number = 2 + Math.floor(Math.random() * 98);
      numIn.value = form.number;
      updatePreview();
    },
  }, '🎲');

  const first = h('input', { class: 'input', id: 'first', maxlength: 18, autocomplete: 'off', value: form.first, 'aria-label': t('First name'), placeholder: t('First name') });
  const last = h('input', { class: 'input', id: 'last', maxlength: 22, autocomplete: 'off', value: form.last, 'aria-label': t('Last name'), placeholder: t('Last name'), disabled: !!heir, title: heir ? t('The family name') : null });
  first.addEventListener('input', () => (form.first = first.value));
  last.addEventListener('input', () => (form.last = last.value));
  const dice = h('button', {
    class: 'btn icon-btn', type: 'button', title: t('Random name'), 'aria-label': t('Random name'),
    onClick: () => {
      const n = randomName(form.nat, heir && form.last);
      form.first = first.value = n.first;
      if (!heir) form.last = last.value = n.last;
    },
  }, '🎲');

  // nationality
  const natGrid = h('div', { class: 'nat-grid', role: 'group', 'aria-label': t('Nationality') });
  const natBtns = NATIONS.map((n) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': n.id === form.nat ? 'true' : 'false', 'data-q': `${n.name} ${n.adj} ${loc('nation', n.id, null, '')}`.toLowerCase(), disabled: fixed && n.id !== form.nat },
      h('span', { class: 'flag' }, n.flag), natName(n));
    b.addEventListener('click', () => {
      form.nat = n.id;
      natBtns.forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
    });
    return b;
  });
  const order = REGIONS.flatMap((r) => natBtns.filter((_, i) => NATIONS[i].region === r.id));
  natGrid.append(...order);
  const natFilter = h('input', { class: 'input nat-filter', placeholder: t('Search countries'), 'aria-label': t('Search countries'), disabled: fixed });
  natFilter.addEventListener('input', () => {
    const q = natFilter.value.trim().toLowerCase();
    natBtns.forEach((b) => (b.style.display = !q || b.dataset.q.includes(q) ? '' : 'none'));
  });

  const optGroup = (entries, key, render, locked = !!dly) => {
    const wrap = h('div', { class: 'opts', role: 'group' });
    const btns = entries.map(([id]) => {
      const b = h('button', { class: 'opt', type: 'button', 'aria-pressed': form[key] === id ? 'true' : 'false', disabled: locked && form[key] !== id }, render(id));
      b.addEventListener('click', () => {
        form[key] = id;
        btns.forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
      });
      return b;
    });
    wrap.append(...btns);
    return wrap;
  };
  const styles = optGroup(Object.entries(STYLES), 'style', (id) => [h('b', null, styleName(id)), h('span', null, styleDesc(id))]);
  const bgs = optGroup(Object.entries(BACKGROUNDS), 'bg', (id) => [
    h('b', null, bgText(id, 'name')),
    h('span', null, bgText(id, 'desc')),
    h('div', { class: 'tags' }, h('span', { class: 'tag up' }, bgText(id, 'pros')), h('span', { class: 'tag down' }, bgText(id, 'cons'))),
  ], fixed);

  // helmet colours
  const palette = [...HELMET_COLORS, ...SUPPORTER_COLORS];
  const swatchRow = (slot) => {
    const row = h('div', { class: 'swatches', role: 'group', 'aria-label': slot === 'c1' ? t('Helmet base colour') : t('Helmet stripe colour') });
    const btns = palette.map((col) => {
      const locked = SUPPORTER_COLORS.includes(col) && !app.supporter;
      const b = h('button', {
        class: `sw ${locked ? 'locked' : ''}`, type: 'button', style: `background:${col}`,
        'aria-pressed': form.helmet[slot] === col ? 'true' : 'false',
        title: locked ? t('Supporter colour: fuel the dev to unlock') : col,
        'aria-label': locked ? t('Supporter colour, locked') : t('Colour {col}', { col }),
      });
      b.addEventListener('click', () => {
        if (locked) return;
        form.helmet[slot] = col;
        btns.forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        updatePreview();
      });
      return b;
    });
    row.append(...btns);
    return row;
  };
  updatePreview();

  const seedIn = h('input', { class: 'input', value: form.seed, maxlength: 24, 'aria-label': t('World seed'), disabled: !!dly });
  seedIn.addEventListener('input', () => (form.seed = cleanSeed(seedIn.value)));
  const seedDice = h('button', { class: 'btn icon-btn', type: 'button', title: t('New seed'), 'aria-label': t('New seed'), disabled: !!dly, onClick: () => { form.seed = seedIn.value = newSeed(); } }, '🎲');

  const start = h('button', { class: 'btn btn-go', type: 'button' }, dly ? t('Start the daily season') : t('Start your engine'));
  start.addEventListener('click', () => {
    if (!form.first.trim() && !form.last.trim()) {
      const n = randomName(form.nat, heir && form.last);
      form.first = first.value = n.first;
      if (!heir) form.last = n.last;
    }
    if (!form.seed) form.seed = newSeed();
    if (dly) {
      // Its own save, so a career in progress is safe. Remember the driver for tomorrow.
      store.setDayDriver({ first: form.first, last: form.last, number: form.number, helmet: { ...form.helmet } });
      return app.startGame({ ...form, helmet: { ...form.helmet }, daily: null, mode: ONE_SEASON, day: dly.date }, { vs });
    }
    const go = () => app.startGame({ ...form, helmet: { ...form.helmet }, daily: null, ...(heir ? { legacy: heir.legacy } : {}) }, { vs });
    if (save && save.stage !== 'retired') confirmDialog(t('Start a new career?'), t("Starting a new career replaces {name}'s unfinished one. Continue?", { name: save.driver.name }), t('Start a new career'), go);
    else go();
  });

  builder.append(...[
    h('h2', { id: 'build-h' }, dly ? t('Daily season #{n}', { n: dayNumber(dly.date) }) : heir ? t('Your kid') : t('Build your driver')),
    h('p', { class: 'sub' }, dly ? t('One Formula 1 season in about five minutes. Everyone gets the same driver, the same car and the same luck today. Most points wins the day.') : heir ? t('Same surname, same flag, and the family helmet colours to start from. The rest is up to you.') : t('Who are you, where are you from, and how do you drive?')),
    dly ? dayBanner(dly) : null,
    missed ? h('div', { class: 'daily-banner' }, t('That challenge was for an earlier day. Here is today’s season instead.')) : null,
    vs ? vsBanner(vs) : null,
    heir ? heirBanner(heir) : null,
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Name')), h('div', { class: 'row' }, first, last, dice)),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Race number')), h('p', { class: 'hint' }, t('From 2 to 99. Win the world title and you can run the #1.')), h('div', { class: 'row', style: 'align-items:center' }, numIn, numDice)),
    dly ? null : h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Nationality')), h('p', { class: 'hint' }, t('Sets your home Grand Prix and how much sponsors pay.')), natFilter, natGrid),
    dly ? null : h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Driving style')), styles),
    dly ? null : h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Background')), bgs),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Helmet and personal livery')), h('div', { class: 'helmet-pick' }, preview, h('div', null, swatchRow('c1'), swatchRow('c2'))), h('p', { class: 'hint', style: 'margin:12px 0 6px' }, t('Helmet design')), designRow, carPreview, app.supporter ? null : h('p', { class: 'hint', style: 'margin-top:6px' }, t('Gold and chrome are supporter colours.'))),
    dly ? null : h('div', { class: 'field seed-row' }, h('span', { class: 'lbl' }, t('World seed')), h('p', { class: 'hint' }, t('The same seed and the same choices replay the same life. Send it to a friend.')), h('div', { class: 'row' }, seedIn, seedDice)),
    h('div', { class: 'start-row' }, start),
  ].filter(Boolean));

  root.replaceChildren(h('main', { class: 'title' }, hero, builder));
  if (!kept) window.scrollTo({ top: 0 });

  if (anim) {
    runLights(g.pods, {
      step: app.settings.anim === 'fast' ? 260 : 480,
      done: () => {
        launch.classList.add('go');
        setTimeout(() => word.classList.replace('wait', 'go'), 240);
      },
    });
  }
}

// What today's daily season hands out: the car, in its livery, and the rookie.
function dayBanner(d) {
  const n = nation(d.nat);
  const stars = '★'.repeat(d.tier) + '☆'.repeat(5 - d.tier);
  return h(
    'div',
    { class: 'day-brief' },
    car({ color: d.color, accent: d.accent, number: '' }, { label: t('Today’s car: {team}', { team: d.team }) }),
    h(
      'div',
      null,
      h('b', null, `${n.flag} ${t('A rookie season at {team}', { team: d.team })}`),
      h('span', null, t('Car {stars}. Driver rated {ovr}, age {age}, {style}.', { stars, ovr: d.ovr, age: d.age, style: styleName(d.style).toLowerCase() })),
      h('span', null, t('Teammate: {name}.', { name: d.teammate }), ' ', t('Rival: {name}.', { name: d.rival })),
    ),
  );
}

// A friend's result to beat, from a challenge link.
function vsBanner(vs) {
  const text = vs.kind === 'day'
    ? t('{name} scored {pts} (P{pos}) in today’s season. Beat it.', { name: vs.name, pts: plural(vs.pts, 'point'), pos: vs.pos })
    : t('{name} retired with a legacy score of {score} ({titles}, {wins}) in this same world. Beat it.', { name: vs.name, score: vs.score, titles: plural(vs.titles, 'title'), wins: plural(vs.wins, 'win') });
  return h('div', { class: 'daily-banner vs-banner' }, h('b', null, t('Challenge: ')), text);
}

// What the family hands down, in words.
function heirBanner(heir) {
  const lg = heir.legacy;
  const bg = bgText(heir.bg, 'name');
  const text = heir.bg === 'royalty'
    ? t('Background: {bg}. {parent} retired worth {money}, so the family fortune is the whole inheritance.', { bg, parent: heir.parent, money: money(lg.worth) })
    : t('Background: {bg}. From the family: {money} and +{fame} fame.', { bg, money: money(lg.money), fame: lg.fame });
  return h('div', { class: 'daily-banner' }, h('b', null, familyLine({ gen: lg.gen, parent: heir.parent })), gap(), text);
}

// Full-screen lights before the first race of a new career.
export function lightsOverlay(app, done) {
  if (app.settings.anim === 'off') return done();
  const g = gantry();
  const ov = h('div', { style: 'position:fixed;inset:0;z-index:60;background:var(--asphalt);display:grid;place-items:center' }, h('div', { style: 'transform:scale(1.4)' }, g.el));
  document.body.append(ov);
  runLights(g.pods, {
    step: app.settings.anim === 'fast' ? 180 : 330,
    done: () => {
      done();
      ov.style.transition = 'opacity .35s';
      ov.style.opacity = '0';
      setTimeout(() => ov.remove(), 380);
    },
  });
}
