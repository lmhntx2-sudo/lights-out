// Plays a 3D cutscene over the game: letterbox bars, a caption and a Skip button.
// three.js and the scenes load the first time they are needed (or quietly in
// the background once a career is on screen), so the game itself stays light.
// Anything that goes wrong (no WebGL, a slow network) just means no cutscene.
import { h } from './dom.js';
import { sfx } from './sfx.js';
import { F1_TEAMS } from '../data/teams.js';
import { raceNumber } from '../engine/player.js';
import { t } from '../i18n.js';

let loading = null;
const load = () => (loading ||= import('../scenes/index.js').catch((e) => {
  loading = null;
  throw e;
}));

export function prefetchCutscenes() {
  const go = () => load().catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 5000 });
  else setTimeout(go, 2000);
}

// On unless switched off in Settings; off by default when race animations are off.
export const cutscenesOn = (app) => app.settings.cuts ?? app.settings.anim !== 'off';

// The colours and numbers a scene needs from the career.
export function sceneContext(s) {
  const team = s.teams?.[s.career.team];
  const rivals = Object.values(s.teams || {})
    .filter((x) => x.series === 'F1' && x.id !== s.career.team)
    .map((x) => ({ color: x.color, accent: x.accent || '#ffffff' }));
  return {
    car: { color: team?.color || '#e10600', accent: team?.accent || '#ffffff' },
    helmet: { c1: '#f2f2f2', c2: '#e8002d', ...s.driver.helmet },
    number: raceNumber(s),
    nat: s.driver.nat,
    rivals: rivals.length ? rivals : F1_TEAMS.map((x) => ({ color: x.color, accent: x.accent || '#ffffff' })),
  };
}

const timeout = (ms) => new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms));

// cut: { scene, title, title2?, sub, kicker }. Resolves when the scene ends or is skipped.
// hold: for previews, play up to that second and stay there.
export async function playCutscene(cut, ctx, { hold = null } = {}) {
  let mod;
  try {
    mod = await Promise.race([load(), timeout(6000)]);
  } catch {
    return false;
  }
  const build = mod.BUILDERS[cut.scene];
  if (!build) return false;

  const canvas = h('canvas', { class: 'cs-canvas', 'aria-hidden': 'true' });
  const heading = cut.title2 ? h('h2', null, h('span', null, cut.title2[0]), cut.title2[1]) : h('h2', null, cut.title || '');
  const cap = h('div', { class: 'cs-cap' }, cut.kicker ? h('div', { class: 'cs-kicker', 'aria-hidden': 'true' }, cut.kicker) : null, heading, cut.sub ? h('p', null, cut.sub) : null);
  const skip = h('button', { class: 'cs-skip', type: 'button' }, t('Skip'), ' ▸');
  const el = h('div', { class: 'cutscene', role: 'dialog', 'aria-modal': 'true', 'aria-label': cut.title || '' }, canvas, h('div', { class: 'cs-bar top' }), h('div', { class: 'cs-bar bottom' }), cap, skip);
  const before = document.activeElement;
  document.body.append(el);

  let stage;
  let scene;
  try {
    stage = mod.createStage(canvas);
    scene = build(stage, ctx);
  } catch (e) {
    console.error(e);
    stage?.dispose();
    el.remove();
    return false;
  }

  return new Promise((resolve) => {
    const cues = (scene.cues || []).slice().sort((a, b) => a[0] - b[0]);
    let start = null;
    let last = 0;
    let raf = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', stage.resize);
      el.classList.add('out');
      setTimeout(() => {
        stage.dispose();
        el.remove();
        if (before?.isConnected) before.focus({ preventScroll: true });
        resolve(true);
      }, 450);
    };
    // Keys go to the cutscene only: Escape, Enter or Space skip it.
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', stage.resize);
    skip.addEventListener('click', finish);
    // A tap anywhere skips too, but not the tap that started it.
    el.addEventListener('click', () => start != null && performance.now() - start > 700 && finish());
    const frame = (now) => {
      if (start == null) {
        start = now;
        last = now;
        el.classList.add('in');
      }
      const time = hold == null ? (now - start) / 1000 : Math.min(hold, (now - start) / 1000);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      while (cues.length && cues[0][0] <= time) sfx[cues.shift()[1]]?.();
      try {
        scene.update(time, dt);
        stage.renderer.render(stage.scene, stage.camera);
      } catch (e) {
        console.error(e);
        return finish();
      }
      if (time >= scene.capAt) el.classList.add('cap');
      if (time >= scene.duration && hold == null) return finish();
      raf = requestAnimationFrame(frame);
    };
    skip.focus({ preventScroll: true });
    // A preview that stops at a given second: step there without waiting for
    // animation frames (a hidden tab gets none), then show that one frame.
    if (hold != null) {
      el.classList.add('in', 'still');
      for (let x = 0; x <= hold; x += 1 / 30) scene.update(x, 1 / 30);
      stage.renderer.render(stage.scene, stage.camera);
      if (hold >= scene.capAt) el.classList.add('cap');
      return;
    }
    raf = requestAnimationFrame(frame);
  });
}

// For trying scenes out on localhost: /#cutscene=hk, /#cutscene=home:FR, or
// /#cutscene=jp@4.5 to stop at 4.5 seconds.
export function previewCutscene(spec) {
  const [what, hold] = spec.split('@');
  const [scene, nat = 'GB'] = what.split(':');
  const teams = F1_TEAMS.map((x) => ({ color: x.color, accent: x.accent || '#ffffff' }));
  const ctx = { car: teams[0], helmet: { c1: '#f2f2f2', c2: '#e8002d' }, number: 44, nat, rivals: teams.slice(1) };
  return playCutscene({ scene, title: scene.toUpperCase(), sub: `Preview of the ${scene} scene`, kicker: '🎬' }, ctx, { hold: hold ? Number(hold) : null });
}
