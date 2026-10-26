import { renderTitle, lightsOverlay } from './ui/title.js';
import { mountGame } from './ui/game.js';
import { newGame } from './engine/game.js';
import { relocalize } from './engine/story.js';
import { store } from './store.js';
import { setSound } from './ui/sfx.js';
import { setLang, htmlLang, t } from './i18n.js';

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
    store.saveGame(app.s);
    if (app.s.daily?.done) store.markDaily(app.s.daily.date);
    return store.addAch(app.s.ach);
  },

  showTitle(opts = {}) {
    if (app.s) app.save();
    app.s = null;
    app.view = null;
    app.refresh = null;
    renderTitle(app, opts);
  },

  startGame(setup) {
    app.title = null;
    app.s = newGame(setup);
    app.save();
    lightsOverlay(app, () => mountGame(app));
  },

  continueGame() {
    const s = store.loadGame();
    if (!s || s.v !== 1) return app.showTitle();
    app.title = null;
    app.s = s;
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
renderTitle(app, { seed: params.get('seed') || undefined, daily: params.has('daily') });
