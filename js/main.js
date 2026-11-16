import { renderTitle, lightsOverlay } from './ui/title.js';
import { mountGame } from './ui/game.js';
import { newGame } from './engine/game.js';
import { relocalize } from './engine/story.js';
import { store } from './store.js';
import { setSound } from './ui/sfx.js';
import { setLang, htmlLang, t } from './i18n.js';
import { ping } from './stats.js';
import { isOneSeason } from './engine/oneseason.js';
import { todayKey } from './engine/daily.js';
import { parseVs } from './core/vs.js';

function applyLang(lang) {
  setLang(lang, store.langVariant());
  document.documentElement.lang = htmlLang();
  document.title = t('Lights Out: racing career simulator');
}

const app = {
  s: null,
  view: null,
  refresh: null,
  title: null,
  settings: store.settings(),
  supporter: store.supporter(),

  // Persist the career and return achievements that are new to this browser.
  save() {
    if (!app.s) return [];
    // The daily season keeps its own save, beside the career.
    if (isOneSeason(app.s)) store.saveDay(app.s);
    else {
      store.saveGame(app.s);
      if (app.s.daily?.done) store.markDaily(app.s.daily.date);
    }
    return store.addAch(app.s.ach);
  },

  showTitle(opts = {}) {
    if (app.s) app.save();
    app.s = null;
    app.view = null;
    app.refresh = null;
    renderTitle(app, opts);
  },

  // vs: a friend's result to beat, from a challenge link. It is only shown, never sent anywhere.
  startGame(setup, { vs } = {}) {
    app.title = null;
    app.s = newGame(setup);
    if (vs) app.s.vs = vs;
    app.save();
    ping(isOneSeason(app.s) ? 'dstart' : 'start');
    lightsOverlay(app, () => mountGame(app));
  },

  continueGame() {
    const s = store.loadGame();
    if (!s || s.v !== 1) return app.showTitle();
    app.title = null;
    app.s = s;
    mountGame(app);
  },

  // Today's daily season: carry on with it (or look at the result) if it has
  // been started, otherwise show what today hands out.
  openDaily(opts = {}) {
    const day = store.loadDay();
    if (!day || day.v !== 1 || day.setup?.day !== todayKey()) return app.showTitle({ daily: true, ...opts });
    if (app.s) app.save();
    app.title = null;
    app.s = day;
    mountGame(app);
  },

  // A restored backup replaces the saved career and settings. The career on
  // screen is not in it, so drop it without saving, then pick up the settings.
  afterRestore() {
    app.s = null;
    app.view = null;
    app.refresh = null;
    app.settings = store.settings();
    app.supporter = store.supporter();
    applyLang(app.settings.lang);
    setSound(app.settings.sound !== false);
    renderTitle(app);
  },

  // Switch language and redraw whatever is on screen. A career in progress keeps
  // its story so far as written; the open decision and everything new switch.
  setLanguage(lang) {
    app.settings.lang = lang;
    store.saveSettings(app.settings);
    applyLang(lang);
    if (app.s) {
      relocalize(app.s);
      app.save();
      mountGame(app);
    } else if (app.title) {
      renderTitle(app, { ...app.title.opts, form: app.title.form });
    }
  },
};

applyLang(app.settings.lang);
setSound(app.settings.sound !== false);

const params = new URLSearchParams(location.search);
if (params.has('daily')) {
  // A challenge link names its day. Yesterday's target means nothing against today's car.
  const day = params.get('daily');
  app.openDaily({ vs: day === todayKey() ? parseVs(params.get('vs'), day) : null, missed: !!day && day !== todayKey() && params.has('vs') });
} else {
  const seed = params.get('seed') || undefined;
  renderTitle(app, { seed, vs: seed ? parseVs(params.get('vs')) : null, diff: params.get('d') === 'legend' ? 'legend' : null });
}
// Try a cutscene on its own, on localhost only: /#cutscene=jp or /#cutscene=home:FR
if (['localhost', '127.0.0.1'].includes(location.hostname) && location.hash.startsWith('#cutscene=')) {
  import('./ui/cutscene.js').then((m) => m.previewCutscene(decodeURIComponent(location.hash.slice(10))));
}
ping('open');
