import { h } from './dom.js';
import { helmet } from './helmet.js';
import { NATIONS, REGIONS, nation } from '../data/nations.js';
import { NAME_POOLS } from '../data/names.js';
import { STYLES, BACKGROUNDS, HELMET_COLORS, SUPPORTER_COLORS } from '../engine/constants.js';
import { newSeed, cleanSeed } from '../core/rng.js';
import { todayKey, dailySetup } from '../engine/daily.js';
import { ACHIEVEMENTS } from '../engine/achievements.js';
import { store } from '../store.js';
import { coffeeButton } from './donate.js';
import { openHallOfFame, openAchievements, openSettings, openBackup, openAbout, allUnlocked, openLeaderboard } from './modals.js';
import { car } from './car.js';
import { sfx } from './sfx.js';

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

export function renderTitle(app, { seed, daily } = {}) {
  const root = document.getElementById('app');
  const anim = app.settings.anim !== 'off';
  const save = store.loadGame();
  const dly = daily ? dailySetup(todayKey()) : null;
  const doneToday = store.dailyDone()[todayKey()];

  const init = randomName('GB');
  const form = {
    first: init.first,
    last: init.last,
    nat: 'GB',
    style: 'fighter',
    bg: 'prodigy',
    helmet: { c1: '#F2F2F2', c2: '#E8002D' },
    number: 2 + Math.floor(Math.random() * 98),
    seed: cleanSeed(seed) || newSeed(),
  };
  if (dly) Object.assign(form, { nat: dly.nat, style: dly.style, bg: dly.bg, seed: dly.seed });

  // ---------------------------------------------------------------- hero
  const g = gantry();
  const word = h('h1', { class: `wordmark ${anim ? 'wait' : ''}` }, h('span', null, 'Lights'), h('span', null, 'Out'));
  const launch = h('div', { class: 'launch', 'aria-hidden': 'true' }, h('div', { class: 'grid-box' }), h('div', { class: 'marks' }), car({ color: '#E10600', accent: '#FFFFFF', number: form.number }));
  const ach = allUnlocked(app);
  const actions = h('div', { class: 'hero-actions' });
  if (save && save.stage !== 'retired') {
    actions.append(
      h('button', { class: 'btn btn-go', onClick: () => app.continueGame() }, 'Continue career', h('small', { style: 'font-style:normal;font-weight:600;opacity:.85' }, `${save.driver.name}, ${save.year}`)),
    );
  }
  actions.append(
    dly
      ? h('button', { class: 'btn', onClick: () => app.showTitle() }, 'Back to free play')
      : h('button', { class: 'btn', onClick: () => app.showTitle({ daily: true }) }, doneToday ? 'Daily challenge (done)' : 'Daily challenge'),
  );
  const hero = h(
    'section',
    { class: 'hero' },
    g.el,
    launch,
    word,
    h('p', { class: 'tagline' }, 'A racing life, from a battered kart at eight to your final lap in Formula 1. ', h('strong', null, 'Every call on the pit wall is yours.')),
    actions,
    h(
      'nav',
      { class: 'title-links', 'aria-label': 'More' },
      h('button', { class: 'btn btn-ghost', onClick: () => openLeaderboard(app, { tab: dly ? 'daily' : 'all' }) }, '🏆 Global leaderboard'),
      h('button', { class: 'btn btn-ghost', onClick: () => openHallOfFame(app) }, 'Hall of fame'),
      h('button', { class: 'btn btn-ghost', onClick: () => openAchievements(app) }, `Achievements ${ach.size}/${ACHIEVEMENTS.length}`),
      h('button', { class: 'btn btn-ghost', onClick: () => openBackup(app) }, 'Backup'),
      h('button', { class: 'btn btn-ghost', onClick: () => openSettings(app) }, 'Settings'),
      h('button', { class: 'btn btn-ghost', onClick: () => openAbout() }, 'About'),
    ),
    h(
      'div',
      { class: 'fuel-line' },
      h('p', null, app.supporter ? 'You are in the pit crew. Thank you for keeping this free for everyone.' : 'Free to play, no ads, made by one person. If you enjoy it, you can keep it running.'),
      coffeeButton(app),
    ),
  );

  // ---------------------------------------------------------------- builder
  const builder = h('section', { class: 'builder', 'aria-labelledby': 'build-h' });
  const preview = h('div');
  const carPreview = h('div', { class: 'car-preview' });
  const updatePreview = () => {
    preview.replaceChildren(helmet(form.helmet, { gold: app.supporter, label: 'Your helmet' }));
    carPreview.replaceChildren(car({ color: form.helmet.c1, accent: form.helmet.c2, number: form.number, helmet: form.helmet.c1 }, { label: `Your car, number ${form.number}` }));
  };

  const numIn = h('input', { class: 'input num-input', type: 'number', min: 2, max: 99, value: form.number, 'aria-label': 'Race number, 2 to 99' });
  numIn.addEventListener('input', () => {
    const n = Math.round(Number(numIn.value));
    if (n >= 2 && n <= 99) {
      form.number = n;
      updatePreview();
    }
  });
  const numDice = h('button', {
    class: 'btn icon-btn', type: 'button', title: 'Random number', 'aria-label': 'Random number',
    onClick: () => {
      form.number = 2 + Math.floor(Math.random() * 98);
      numIn.value = form.number;
      updatePreview();
    },
  }, '🎲');

  const first = h('input', { class: 'input', id: 'first', maxlength: 18, autocomplete: 'off', value: form.first, 'aria-label': 'First name' });
  const last = h('input', { class: 'input', id: 'last', maxlength: 22, autocomplete: 'off', value: form.last, 'aria-label': 'Last name' });
  first.addEventListener('input', () => (form.first = first.value));
  last.addEventListener('input', () => (form.last = last.value));
  const dice = h('button', {
    class: 'btn icon-btn', type: 'button', title: 'Random name', 'aria-label': 'Random name',
    onClick: () => {
      const n = randomName(form.nat);
      form.first = first.value = n.first;
      form.last = last.value = n.last;
    },
  }, '🎲');

  // nationality
  const natGrid = h('div', { class: 'nat-grid', role: 'group', 'aria-label': 'Nationality' });
  const natBtns = NATIONS.map((n) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': n.id === form.nat ? 'true' : 'false', 'data-q': `${n.name} ${n.adj}`.toLowerCase(), disabled: dly && n.id !== form.nat },
      h('span', { class: 'flag' }, n.flag), n.name);
    b.addEventListener('click', () => {
      form.nat = n.id;
      natBtns.forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
    });
    return b;
  });
  const order = REGIONS.flatMap((r) => natBtns.filter((_, i) => NATIONS[i].region === r.id));
  natGrid.append(...order);
  const natFilter = h('input', { class: 'input nat-filter', placeholder: 'Search countries', 'aria-label': 'Search countries', disabled: !!dly });
  natFilter.addEventListener('input', () => {
    const q = natFilter.value.trim().toLowerCase();
    natBtns.forEach((b) => (b.style.display = !q || b.dataset.q.includes(q) ? '' : 'none'));
  });

  const optGroup = (entries, key, render) => {
    const wrap = h('div', { class: 'opts', role: 'group' });
    const btns = entries.map(([id, o]) => {
      const b = h('button', { class: 'opt', type: 'button', 'aria-pressed': form[key] === id ? 'true' : 'false', disabled: dly && form[key] !== id }, render(o));
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
  const styles = optGroup(Object.entries(STYLES), 'style', (o) => [h('b', null, o.name), h('span', null, o.desc)]);
  const bgs = optGroup(Object.entries(BACKGROUNDS), 'bg', (o) => [h('b', null, o.name), h('span', null, o.desc), h('div', { class: 'tags' }, h('span', { class: 'tag up' }, o.pros), h('span', { class: 'tag down' }, o.cons))]);

  // helmet colours
  const palette = [...HELMET_COLORS, ...SUPPORTER_COLORS];
  const swatchRow = (slot) => {
    const row = h('div', { class: 'swatches', role: 'group', 'aria-label': slot === 'c1' ? 'Helmet base colour' : 'Helmet stripe colour' });
    const btns = palette.map((col) => {
      const locked = SUPPORTER_COLORS.includes(col) && !app.supporter;
      const b = h('button', {
        class: `sw ${locked ? 'locked' : ''}`, type: 'button', style: `background:${col}`,
        'aria-pressed': form.helmet[slot] === col ? 'true' : 'false',
        title: locked ? 'Supporter colour: fuel the dev to unlock' : col,
        'aria-label': locked ? 'Supporter colour, locked' : `Colour ${col}`,
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

  const seedIn = h('input', { class: 'input', value: form.seed, maxlength: 24, 'aria-label': 'World seed', disabled: !!dly });
  seedIn.addEventListener('input', () => (form.seed = cleanSeed(seedIn.value)));
  const seedDice = h('button', { class: 'btn icon-btn', type: 'button', title: 'New seed', 'aria-label': 'New seed', disabled: !!dly, onClick: () => { form.seed = seedIn.value = newSeed(); } }, '🎲');

  const start = h('button', { class: 'btn btn-go', type: 'button' }, dly ? 'Start the daily challenge' : 'Start your engine');
  start.addEventListener('click', () => {
    if (!form.first.trim() && !form.last.trim()) {
      const n = randomName(form.nat);
      form.first = n.first;
      form.last = n.last;
    }
    if (!form.seed) form.seed = newSeed();
    if (save && save.stage !== 'retired' && !confirm(`Starting a new career replaces ${save.driver.name}'s unfinished one. Continue?`)) return;
    app.startGame({ ...form, helmet: { ...form.helmet }, daily: dly ? { date: dly.date, goal: dly.goal, goalText: dly.goalText } : null });
  });

  builder.append(...[
    h('h2', { id: 'build-h' }, dly ? 'Daily challenge' : 'Build your driver'),
    h('p', { class: 'sub' }, dly ? 'Everyone gets the same driver and the same world today.' : 'Who are you, where are you from, and how do you drive?'),
    dly ? h('div', { class: 'daily-banner' }, h('b', null, `Goal for ${dly.date}: `), dly.goalText, doneToday ? ' You have already completed it today.' : '') : null,
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Name'), h('div', { class: 'row' }, first, last, dice)),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Race number'), h('p', { class: 'hint' }, 'From 2 to 99. Win the world title and you can run the #1.'), h('div', { class: 'row', style: 'align-items:center' }, numIn, numDice)),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Nationality'), h('p', { class: 'hint' }, 'Sets your home Grand Prix and how much sponsors pay.'), natFilter, natGrid),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Driving style'), styles),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Background'), bgs),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Helmet and personal livery'), h('div', { class: 'helmet-pick' }, preview, h('div', null, swatchRow('c1'), swatchRow('c2'))), carPreview, app.supporter ? null : h('p', { class: 'hint', style: 'margin-top:6px' }, 'Gold and chrome are supporter colours.')),
    h('div', { class: 'field seed-row' }, h('span', { class: 'lbl' }, 'World seed'), h('p', { class: 'hint' }, 'The same seed and the same choices replay the same life. Send it to a friend.'), h('div', { class: 'row' }, seedIn, seedDice)),
    h('div', { class: 'start-row' }, start),
  ].filter(Boolean));

  root.replaceChildren(h('main', { class: 'title' }, hero, builder));
  window.scrollTo({ top: 0 });

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
