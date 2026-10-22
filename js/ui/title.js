import { h } from './dom.js';
import { helmet } from './helmet.js';
import { NATIONS, REGIONS, nation } from '../data/nations.js';
import { NAME_POOLS } from '../data/names.js';
import { STYLES, BACKGROUNDS, HELMET_COLORS, SUPPORTER_COLORS } from '../engine/constants.js';
import { newSeed, cleanSeed } from '../core/rng.js';
import { todayKey, dailySetup, dailyGoalText } from '../engine/daily.js';
import { ACHIEVEMENTS } from '../engine/achievements.js';
import { store } from '../store.js';
import { coffeeButton } from './donate.js';
import { openHallOfFame, openAchievements, openSettings, openBackup, openAbout, allUnlocked, openLeaderboard } from './modals.js';
import { car } from './car.js';
import { sfx } from './sfx.js';
import { t, getLang, LANGS, loc, natName, styleName, styleDesc, bgText } from '../i18n.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function randomName(nat) {
  const pool = NAME_POOLS[nation(nat).names] || NAME_POOLS.en;
  return { first: pick(pool.f), last: pick(pool.l) };
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

// The button that flips to the other language, written in that language.
function langButton(app) {
  const [code, label] = LANGS.find(([c]) => c !== getLang());
  return h('button', { class: 'btn btn-ghost', lang: code === 'zh' ? 'zh-Hant' : 'en', onClick: () => app.setLanguage(code) }, `🌐 ${label}`);
}

export function renderTitle(app, { seed, daily, form: kept } = {}) {
  const root = document.getElementById('app');
  const save = store.loadGame();
  const dly = daily ? dailySetup(todayKey()) : null;
  const doneToday = store.dailyDone()[todayKey()];
  // A language switch redraws the title with the same form, and without the intro again.
  const anim = app.settings.anim !== 'off' && !kept;

  const init = randomName('GB');
  const form = kept || {
    first: init.first,
    last: init.last,
    nat: 'GB',
    style: 'fighter',
    bg: 'prodigy',
    helmet: { c1: '#F2F2F2', c2: '#E8002D' },
    number: 2 + Math.floor(Math.random() * 98),
    seed: cleanSeed(seed) || newSeed(),
  };
  if (dly && !kept) Object.assign(form, { nat: dly.nat, style: dly.style, bg: dly.bg, seed: dly.seed });
  app.title = { opts: { seed, daily }, form };
  const goal = dly ? dailyGoalText(dly.goal, dly.goalText) : '';

  // ---------------------------------------------------------------- hero
  const g = gantry();
  const word = h('h1', { class: `wordmark ${anim ? 'wait' : ''}` }, h('span', null, 'Lights'), h('span', null, 'Out'));
  const launch = h('div', { class: 'launch', 'aria-hidden': 'true' }, h('div', { class: 'grid-box' }), h('div', { class: 'marks' }), car({ color: '#E10600', accent: '#FFFFFF', number: form.number }));
  const ach = allUnlocked(app);
  const actions = h('div', { class: 'hero-actions' });
  if (save && save.stage !== 'retired') {
    actions.append(
      h('button', { class: 'btn btn-go', onClick: () => app.continueGame() }, t('Continue career'), h('small', { style: 'font-style:normal;font-weight:600;opacity:.85' }, t('{name}, {year}', { name: save.driver.name, year: save.year }))),
    );
  }
  actions.append(
    dly
      ? h('button', { class: 'btn', onClick: () => app.showTitle() }, t('Back to free play'))
      : h('button', { class: 'btn', onClick: () => app.showTitle({ daily: true }) }, doneToday ? t('Daily challenge (done)') : t('Daily challenge')),
  );
  const hero = h(
    'section',
    { class: 'hero' },
    g.el,
    launch,
    word,
    h('p', { class: 'tagline' }, t('A racing life, from a battered kart at eight to your final lap in Formula 1. '), h('strong', null, t('Every call on the pit wall is yours.'))),
    actions,
    h(
      'nav',
      { class: 'title-links', 'aria-label': t('More') },
      h('button', { class: 'btn btn-ghost', onClick: () => openLeaderboard(app, { tab: dly ? 'daily' : 'all' }) }, `🏆 ${t('Global leaderboard')}`),
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
  const builder = h('section', { class: 'builder', 'aria-labelledby': 'build-h' });
  const preview = h('div');
  const carPreview = h('div', { class: 'car-preview' });
  const updatePreview = () => {
    preview.replaceChildren(helmet(form.helmet, { gold: app.supporter, label: t('Your helmet') }));
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
  const last = h('input', { class: 'input', id: 'last', maxlength: 22, autocomplete: 'off', value: form.last, 'aria-label': t('Last name'), placeholder: t('Last name') });
  first.addEventListener('input', () => (form.first = first.value));
  last.addEventListener('input', () => (form.last = last.value));
  const dice = h('button', {
    class: 'btn icon-btn', type: 'button', title: t('Random name'), 'aria-label': t('Random name'),
    onClick: () => {
      const n = randomName(form.nat);
      form.first = first.value = n.first;
      form.last = last.value = n.last;
    },
  }, '🎲');

  // nationality
  const natGrid = h('div', { class: 'nat-grid', role: 'group', 'aria-label': t('Nationality') });
  const natBtns = NATIONS.map((n) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': n.id === form.nat ? 'true' : 'false', 'data-q': `${n.name} ${n.adj} ${loc('nation', n.id, null, '')}`.toLowerCase(), disabled: dly && n.id !== form.nat },
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
  const natFilter = h('input', { class: 'input nat-filter', placeholder: t('Search countries'), 'aria-label': t('Search countries'), disabled: !!dly });
  natFilter.addEventListener('input', () => {
    const q = natFilter.value.trim().toLowerCase();
    natBtns.forEach((b) => (b.style.display = !q || b.dataset.q.includes(q) ? '' : 'none'));
  });

  const optGroup = (entries, key, render) => {
    const wrap = h('div', { class: 'opts', role: 'group' });
    const btns = entries.map(([id]) => {
      const b = h('button', { class: 'opt', type: 'button', 'aria-pressed': form[key] === id ? 'true' : 'false', disabled: dly && form[key] !== id }, render(id));
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
  ]);

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

  const start = h('button', { class: 'btn btn-go', type: 'button' }, dly ? t('Start the daily challenge') : t('Start your engine'));
  start.addEventListener('click', () => {
    if (!form.first.trim() && !form.last.trim()) {
      const n = randomName(form.nat);
      form.first = n.first;
      form.last = n.last;
    }
    if (!form.seed) form.seed = newSeed();
    if (save && save.stage !== 'retired' && !confirm(t("Starting a new career replaces {name}'s unfinished one. Continue?", { name: save.driver.name }))) return;
    app.startGame({ ...form, helmet: { ...form.helmet }, daily: dly ? { date: dly.date, goal: dly.goal, goalText: dly.goalText } : null });
  });

  builder.append(...[
    h('h2', { id: 'build-h' }, dly ? t('Daily challenge') : t('Build your driver')),
    h('p', { class: 'sub' }, dly ? t('Everyone gets the same driver and the same world today.') : t('Who are you, where are you from, and how do you drive?')),
    dly ? h('div', { class: 'daily-banner' }, h('b', null, t('Goal for {date}: ', { date: dly.date })), goal, doneToday ? t(' You have already completed it today.') : '') : null,
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Name')), h('div', { class: 'row' }, first, last, dice)),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Race number')), h('p', { class: 'hint' }, t('From 2 to 99. Win the world title and you can run the #1.')), h('div', { class: 'row', style: 'align-items:center' }, numIn, numDice)),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Nationality')), h('p', { class: 'hint' }, t('Sets your home Grand Prix and how much sponsors pay.')), natFilter, natGrid),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Driving style')), styles),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Background')), bgs),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('Helmet and personal livery')), h('div', { class: 'helmet-pick' }, preview, h('div', null, swatchRow('c1'), swatchRow('c2'))), carPreview, app.supporter ? null : h('p', { class: 'hint', style: 'margin-top:6px' }, t('Gold and chrome are supporter colours.'))),
    h('div', { class: 'field seed-row' }, h('span', { class: 'lbl' }, t('World seed')), h('p', { class: 'hint' }, t('The same seed and the same choices replay the same life. Send it to a friend.')), h('div', { class: 'row' }, seedIn, seedDice)),
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
