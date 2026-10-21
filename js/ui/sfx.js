// Tiny synthesised sound effects. No audio files; everything is made with WebAudio.
// Browsers only allow sound after the player has clicked something, which suits us.
let ctx = null;
let enabled = true;

export function setSound(on) {
  enabled = !!on;
}

function audio() {
  if (!enabled) return null;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, dur, { type = 'sine', vol = 0.06, at = 0, slide } = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

export const sfx = {
  light: () => tone(820, 0.11, { type: 'square', vol: 0.03 }),
  go: () => {
    tone(70, 1.2, { type: 'sawtooth', vol: 0.045, slide: 380 });
    tone(140, 1.1, { type: 'square', vol: 0.015, slide: 760 });
  },
  radio: () => {
    tone(1300, 0.05, { type: 'square', vol: 0.025 });
    tone(980, 0.07, { type: 'square', vol: 0.025, at: 0.07 });
  },
  ok: () => {
    tone(660, 0.08, { type: 'triangle', vol: 0.05 });
    tone(990, 0.14, { type: 'triangle', vol: 0.05, at: 0.08 });
  },
  ko: () => tone(170, 0.28, { type: 'sawtooth', vol: 0.03, slide: 85 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.15, { type: 'triangle', vol: 0.06, at: i * 0.12 })),
  title: () => {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.06, at: i * 0.14 }));
    [523, 659, 784].forEach((f) => tone(f, 1.1, { type: 'triangle', vol: 0.035, at: 0.75 }));
  },
};
