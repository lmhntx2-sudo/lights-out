// Seeded randomness. The generator state lives on a plain object (the save
// file), so the same seed plus the same choices always replays the same life.

export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export class Rng {
  constructor(holder, key = 'rng') {
    this.h = holder;
    this.k = key;
  }

  // mulberry32
  next() {
    const a = (this.h[this.k] = (this.h[this.k] + 0x6d2b79f5) >>> 0);
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  range(a, b) {
    return a + this.next() * (b - a);
  }

  chance(p) {
    return this.next() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  normal(mu = 0, sd = 1) {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  weighted(items, weightOf) {
    const ws = items.map(weightOf);
    const total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= ws[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

const SEED_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

export function newSeed() {
  let s = '';
  for (let i = 0; i < 8; i++) s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
  return s;
}

export function cleanSeed(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 24);
}
