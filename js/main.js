import { renderTitle, lightsOverlay } from './ui/title.js';
import { mountGame } from './ui/game.js';
import { newGame } from './engine/game.js';
import { store } from './store.js';

const app = {
  s: null,
  view: null,
  refresh: null,
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
    app.s = newGame(setup);
    app.save();
    lightsOverlay(app, () => mountGame(app));
  },

  continueGame() {
    const s = store.loadGame();
    if (!s || s.v !== 1) return app.showTitle();
    app.s = s;
    mountGame(app);
  },
};

const params = new URLSearchParams(location.search);
renderTitle(app, { seed: params.get('seed') || undefined, daily: params.has('daily') });
