// Home-crowd cutscenes: the driver's city celebrating. Hong Kong, Japan, Korea,
// Taiwan and Macau each have their own; every other country gets a grandstand
// in its flag's colours. Same contract as moments.js.
import {
  THREE, sky, lights, mat, glowMat, halo, ground, makeTrack, makeCar, makeFigure, makeCrowd, makeFireworks, makeFalling,
  makePuffs, makeFlag, makeHills, makeWater, makeSkyline, mirror, neonSign, canvasTexture, windowsTexture, cameraPath, dot,
  clamp, lerp, seg, smooth, easeOut, rand, FLAG_COLORS,
} from './kit.js';

// Put an object somewhere and return it.
const at = (o, x, y, z) => (o.position.set(x, y, z), o);

const NEON = ['#ff3b7a', '#ff2a2a', '#38e8ff', '#3dff8a', '#ffd23d', '#b35cff'];

// A tower lit up in the driver's colours, with the race number on it.
function tribute(ctx, w = 9, h = 70) {
  const tex = canvasTexture(128, 512, (g, cw, ch) => {
    g.fillStyle = ctx.car.color;
    g.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? ctx.helmet.c2 : ctx.helmet.c1;
      g.fillRect(0, ch * 0.06 + i * 26, cw, 14);
      g.fillRect(0, ch * 0.8 + i * 26, cw, 14);
    }
    g.fillStyle = ctx.car.accent;
    g.font = '900 italic 88px Saira, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(ctx.number), cw / 2, ch / 2);
  });
  const sideTex = windowsTexture(77, { lit: 0.6 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), [
    new THREE.MeshLambertMaterial({ color: '#141824', emissive: '#ffffff', emissiveMap: sideTex }),
    new THREE.MeshLambertMaterial({ color: '#141824', emissive: '#ffffff', emissiveMap: sideTex }),
    mat('#141824'),
    mat('#141824'),
    new THREE.MeshBasicMaterial({ map: tex, fog: false }),
    new THREE.MeshLambertMaterial({ color: '#141824', emissive: '#ffffff', emissiveMap: sideTex }),
  ]);
  m.position.y = h / 2;
  return m;
}

// A tower that tapers: square in plan, `rb` at the bottom and `rt` at the top.
function taper(rb, rt, h, seed, color = '#141824', lit = 0.5) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, 4, 1);
  const uv = geo.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 4, uv.getY(k) * (h / 14));
  const tex = windowsTexture(seed, { lit, cool: '#cfe6ff' });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, emissive: '#ffffff', emissiveMap: tex }));
  m.rotation.y = Math.PI / 4;
  m.position.y = h / 2;
  return m;
}

function outline(mesh, color) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color, fog: false }));
  l.position.copy(mesh.position);
  l.rotation.copy(mesh.rotation);
  return l;
}

function fireworksShow(scene, fw, { from, n, x = [-80, 80], y = [40, 70], z = -90, colors, gap = 0.32, seed = 3 }) {
  const r = rand(seed);
  for (let i = 0; i < n; i++) fw.launch(from + i * gap + r() * 0.15, [lerp(x[0], x[1], r()), lerp(y[0], y[1], r()), z - r() * 30], colors[i % colors.length]);
}

// A street of buildings with neon signs hanging over it, running along z.
function neonStreet(scene, { words, z0 = 40, z1 = 140, half = 9, seed = 2 }) {
  const r = rand(seed);
  const signs = [];
  for (const side of [-1, 1]) {
    let z = z0;
    while (z < z1) {
      const w = 6 + r() * 4;
      const h = 16 + r() * 26;
      const b = new THREE.Mesh(new THREE.BoxGeometry(8, h, w), new THREE.MeshLambertMaterial({ color: '#141721', emissive: '#ffffff', emissiveMap: windowsTexture(seed * 13 + Math.floor(z), { lit: 0.5 }) }));
      b.position.set(side * (half + 4), h / 2, z + w / 2);
      scene.add(b);
      for (let k = 0; k < 2; k++) {
        const word = words[Math.floor(r() * words.length)];
        const sign = neonSign(word, NEON[Math.floor(r() * NEON.length)], { vertical: [...word].length > 1 && r() < 0.7, w: 3 + [...word].length * 0.9, h: 1.6 });
        sign.position.set(side * (half - 1.4 - r() * 1.6), 6 + r() * (h - 10), z + 1 + r() * (w - 2));
        scene.add(sign);
        signs.push(sign);
      }
      z += w + 0.4;
    }
  }
  const road = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 20, z1 - z0 + 30), mat('#121319', { rough: 0.35, metal: 0.4 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.06, (z0 + z1) / 2);
  scene.add(road);
  return {
    update(t) {
      for (const s of signs) {
        const f = s.userData.flicker;
        s.material.color.setScalar(Math.sin(t * 23 + f * 7) > 0.97 ? 0.35 : 1);
      }
    },
  };
}

// ------------------------------------------------------------------ Hong Kong: neon street, then the harbour

export function hk({ scene, camera }, ctx) {
  sky(scene, { top: '#03050f', mid: '#18214d', bottom: '#0a0f22', stars: 120, fog: ['#0d1430', 160, 900] });
  scene.add(new THREE.HemisphereLight('#5a6cff', '#100a08', 0.6));
  scene.add(makeWater('#071226', 3000, 0.86));
  const island = new THREE.Group();
  island.add(makeSkyline({ count: 60, width: 460, depth: 30, heights: [14, 62], seed: 21, lit: 0.55 }));
  // Two Ifc: a tall tower with a stepped crown.
  const ifc = new THREE.Group();
  [[12, 120], [10, 14], [8, 10], [6, 8]].reduce((y, [w, h]) => {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshLambertMaterial({ color: '#1b2233', emissive: '#ffffff', emissiveMap: windowsTexture(41, { lit: 0.6, cool: '#d8ecff' }) }));
    part.position.y = y + h / 2;
    ifc.add(part);
    return y + h;
  }, 0);
  ifc.position.set(-80, 0, 0);
  island.add(ifc);
  // Bank of China: a tapering prism with lit edges.
  const boc = taper(10, 1.4, 140, 43);
  island.add(boc, outline(boc, '#e8f4ff'));
  // Central Plaza: a pointed top and a mast.
  const cp = new THREE.Group();
  const cpBody = new THREE.Mesh(new THREE.BoxGeometry(10, 104, 10), new THREE.MeshLambertMaterial({ color: '#1b2233', emissive: '#ffffff', emissiveMap: windowsTexture(45, { lit: 0.5, warm: '#ffe9a8' }) }));
  cpBody.position.y = 52;
  const cpTop = new THREE.Mesh(new THREE.ConeGeometry(7.5, 14, 4), glowMat('#ffd27a'));
  cpTop.rotation.y = Math.PI / 4;
  cpTop.position.y = 111;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 26, 6), glowMat('#ffd27a'));
  mast.position.y = 130;
  cp.add(cpBody, cpTop, mast);
  cp.position.set(70, 0, 6);
  island.add(cp);
  const tr = tribute(ctx, 9, 76);
  tr.position.x = -30;
  island.add(tr);
  island.position.z = -170;
  scene.add(island);
  const refl = mirror(island, 0.28);
  refl.position.z = -170;
  scene.add(refl);
  scene.add(makeHills({ count: 7, width: 800, z: -360, heights: [90, 170], color: '#0a0f1c', seed: 4 }));
  // A Symphony of Lights: lasers from the rooftops.
  const lasers = [[-80, 150, '#3cff9b'], [0, 140, '#4aa8ff'], [70, 130, '#c86bff'], [-30, 76, '#3cff9b'], [120, 60, '#4aa8ff'], [-150, 55, '#ff4fa3']].map(([x, y, c], i) => {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 400, 6), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    beam.geometry.translate(0, 200, 0);
    const holder = new THREE.Group();
    holder.position.set(x, y, -170);
    holder.add(beam);
    scene.add(holder);
    return { holder, i };
  });
  // The Star Ferry crossing the harbour.
  const ferry = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(14, 1.8, 4), mat('#f2f1ea', { rough: 0.6 }));
  hull.position.y = 0.9;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 3.6), mat('#2f7d4f', { rough: 0.6 }));
  deck.position.y = 2.6;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.3, 4), mat('#f2f1ea'));
  roof.position.y = 3.5;
  ferry.add(hull, deck, roof);
  for (let i = 0; i < 6; i++) {
    const l = halo('#ffe4a8', 1.2, 0.8);
    l.position.set(-5 + i * 2, 2.6, 2);
    ferry.add(l);
  }
  ferry.position.z = -70;
  scene.add(ferry);
  // Kowloon: the neon street the camera starts in.
  const street = neonStreet(scene, { words: ['茶餐廳', '大押', '海鮮酒家', '麻雀', '金行', '涼茶', '燒臘', '冰室'], seed: 3 });
  const promenade = new THREE.Mesh(new THREE.PlaneGeometry(400, 30), mat('#1a1b22', { rough: 0.8 }));
  promenade.rotation.x = -Math.PI / 2;
  promenade.position.set(0, 0.05, 25);
  scene.add(promenade);
  // A red taxi.
  const taxi = new THREE.Group();
  const tb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 4.2), mat('#c8102e', { rough: 0.4, metal: 0.3 }));
  tb.position.y = 0.7;
  const tc = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), mat('#c9ccd2', { rough: 0.3, metal: 0.4 }));
  tc.position.set(0, 1.4, 0.2);
  taxi.add(tb, tc);
  for (const x of [-0.6, 0.6]) {
    const head = halo('#fff6dc', 1.6, 0.9);
    head.position.set(x, 0.75, -2.2);
    taxi.add(head);
  }
  taxi.position.set(-2.5, 0, 120);
  scene.add(taxi);
  const fw = makeFireworks(scene, { size: 2.6 });
  fireworksShow(scene, fw, { from: 2.6, n: 18, x: [-120, 120], y: [50, 95], z: -110, colors: ['#ff3b3b', '#ffd76a', '#ffffff', '#ff7ac8', ctx.car.color], gap: 0.3 });
  const cam = cameraPath(camera, [
    { t: 0, pos: [0, 2.2, 128], look: [0, 8, 40], fov: 52 },
    { t: 2.6, pos: [0, 7, 84], look: [0, 22, -60], fov: 48 },
    { t: 8.6, pos: [0, 30, 40], look: [0, 46, -170], fov: 46 },
  ]);
  return {
    duration: 8.6,
    capAt: 3.0,
    cues: [],
    update(t, dt) {
      street.update(t);
      taxi.position.z = 120 - t * 18;
      ferry.position.x = -70 + t * 6;
      lasers.forEach(({ holder, i }) => {
        holder.rotation.z = Math.sin(t * 0.7 + i * 1.3) * 0.6;
        holder.rotation.x = -0.35 + Math.cos(t * 0.5 + i) * 0.25;
      });
      fw.update(t, dt);
      cam(t);
    },
  };
}

// ------------------------------------------------------------------ Japan: Suzuka in spring

function sakura(seed) {
  const g = new THREE.Group();
  const r = rand(seed);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 4, 7), mat('#4a3426', { rough: 1, flat: true }));
  trunk.position.y = 2;
  g.add(trunk);
  const pinks = ['#f7c6d9', '#f4b6cf', '#fbd7e5', '#efa9c4'];
  for (let i = 0; i < 6; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + r() * 1.1, 0), mat(pinks[i % 4], { rough: 0.9, flat: true }));
    blob.position.set((r() - 0.5) * 3, 4.6 + r() * 1.8, (r() - 0.5) * 3);
    g.add(blob);
  }
  return g;
}

function ferrisWheel(radius = 22) {
  const g = new THREE.Group();
  const steel = mat('#e9edf2', { rough: 0.4, metal: 0.5 });
  const wheel = new THREE.Group();
  wheel.position.y = radius + 4;
  g.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.35, 6, 64), steel));
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(radius * 0.92, 0.2, 6, 64), steel));
  const N = 24;
  const cars = [];
  const cols = ['#ff7a8a', '#ffd166', '#7bd3ff', '#9be58a', '#c79bff', '#ffffff'];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, radius, 0.12), steel);
    spoke.position.set(Math.cos(a) * radius / 2, Math.sin(a) * radius / 2, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
    const gond = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), mat(cols[i % cols.length], { rough: 0.5, emissive: cols[i % cols.length], glow: 0.25 }));
    wheel.add(gond);
    cars.push({ gond, a });
    const bulb = halo(cols[i % cols.length], 1.6, 0.9);
    bulb.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0.4);
    wheel.add(bulb);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.6, 16), steel);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  for (const z of [-1.2, 1.2]) for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, radius + 6, 0.6), steel);
    leg.position.set(s * 6, (radius + 4) / 2, z);
    leg.rotation.z = s * 0.24;
    g.add(leg);
  }
  g.userData.update = (t) => {
    wheel.rotation.z = t * 0.06;
    for (const c of cars) {
      c.gond.position.set(Math.cos(c.a) * radius, Math.sin(c.a) * radius - 1.2, 0);
      c.gond.rotation.z = -wheel.rotation.z;
    }
  };
  return g;
}

export function jp({ scene, camera }, ctx) {
  sky(scene, { top: '#3d5d9a', mid: '#f4a983', bottom: '#8a6276', sun: [0.55, 0.1, -1], sunColor: '#ffbf8a', fog: ['#d9a088', 90, 900] });
  lights(scene, { sky: '#ffd6c2', ground: '#3b4a2a', amb: 1.2, sun: '#ffc79a', sunI: 2.2, sunPos: [60, 25, -100] });
  ground(scene, '#557f3c');
  scene.add(makeTrack({ length: 1000, width: 14 }));
  // Mount Fuji far away, with its snow cap.
  const fuji = new THREE.Mesh(new THREE.ConeGeometry(300, 170, 9), mat('#56658a', { rough: 1, flat: true }));
  fuji.position.set(-260, 85, -820);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(300 * (52 / 170), 52, 9), mat('#f4f1f6', { rough: 1, flat: true }));
  cap.position.set(-260, 170 - 26 + 0.5, -820);
  scene.add(fuji, cap, makeHills({ count: 9, width: 1200, z: -500, heights: [30, 70], color: '#5f6f86', seed: 8 }));
  const wheel = ferrisWheel(24);
  wheel.position.set(70, 0, -90);
  scene.add(wheel);
  // A torii by the track.
  const torii = new THREE.Group();
  const red = mat('#d6452b', { rough: 0.6 });
  for (const x of [-3.6, 3.6]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 9, 12), red);
    p.position.set(x, 4.5, 0);
    torii.add(p);
  }
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.55, 0.5), red);
  nuki.position.y = 7;
  const shimaki = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.55, 0.85), red);
  shimaki.position.y = 8.6;
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.45, 1.05), mat('#1d1b1b'));
  kasagi.position.y = 9.1;
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.4), red);
  strut.position.y = 7.9;
  torii.add(nuki, shimaki, kasagi, strut);
  torii.position.set(-18, 0, -13);
  torii.rotation.y = 0.15;
  scene.add(torii);
  const r = rand(5);
  for (let i = 0; i < 18; i++) {
    const tree = sakura(i + 1);
    tree.position.set(-70 + i * 9 + r() * 4, 0, -16 - r() * 18);
    tree.scale.setScalar(0.9 + r() * 0.5);
    scene.add(tree);
  }
  const crowd = makeCrowd({ rows: 9, cols: 90, colors: ['#ffffff', '#bc002d', '#ffffff', '#1d3b8b', ctx.car.color, '#f2c230'], flagColors: ['#ffffff', '#bc002d'], flags: 0.3, seed: 12 });
  crowd.position.set(0, 0, 12);
  scene.add(crowd);
  const hinomaru = makeFlag((g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#bc002d';
    g.beginPath();
    g.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2);
    g.fill();
  }, { w: 4.5, h: 3, pole: 10 });
  hinomaru.position.set(-30, 0, 10);
  scene.add(hinomaru);
  const me = makeCar({ ...ctx.car, helmet: ctx.helmet });
  me.position.set(-140, 0, -2.5);
  scene.add(me);
  const petals = makeFalling(scene, { count: 600, colors: ['#ffd1e0', '#ffc0d6', '#ffe6ef', '#f7b3cc'], center: [-10, 12, -6], area: [45, 6, 22], speed: 1.1, drift: 1.8, shape: 'petal', size: [0.28, 0.28], unlit: true });
  const fw = makeFireworks(scene, { size: 2.4 });
  fireworksShow(scene, fw, { from: 3.6, n: 12, x: [-60, 120], y: [55, 85], z: -120, colors: ['#ff9ec4', '#ffd76a', '#9ad0ff', '#ffffff', ctx.car.color], gap: 0.38, seed: 9 });
  const shot2 = cameraPath(camera, [
    { t: 3.6, pos: [-6, 9, 44], look: [-10, 18, -100], fov: 46 },
    { t: 8.6, pos: [8, 15, 52], look: [-30, 34, -220], fov: 48 },
  ]);
  return {
    duration: 8.6,
    capAt: 3.4,
    cues: [],
    update(t, dt) {
      const x = -140 + t * 70;
      me.position.x = x;
      me.userData.spin(x);
      wheel.userData.update(t);
      hinomaru.userData.update(t, 5, 0.3);
      crowd.userData.update(t, t > 1.6 ? 1 : 0.4);
      petals.update(t);
      fw.update(t, dt);
      if (t < 3.6) {
        camera.position.set(lerp(-4, 2, t / 3.6), 1.4, -9);
        camera.lookAt(clamp(x, -40, 40), 1.4, 0);
        if (camera.fov !== 38) {
          camera.fov = 38;
          camera.updateProjectionMatrix();
        }
      } else shot2(t);
    },
  };
}

// ------------------------------------------------------------------ Korea: the Han river at night

function taegukgi(g, w, h) {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const R = h * 0.25;
  g.save();
  g.translate(cx, cy);
  g.rotate(-Math.atan2(2, 3));
  g.fillStyle = '#0047a0';
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#cd2e3a';
  g.beginPath();
  g.arc(0, 0, R, Math.PI, 0);
  g.fill();
  g.beginPath();
  g.arc(-R / 2, 0, R / 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0047a0';
  g.beginPath();
  g.arc(R / 2, 0, R / 2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // The four trigrams, drawn as bars along the diagonals.
  const tri = (angle, pattern) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    g.fillStyle = '#000000';
    pattern.forEach((broken, i) => {
      const y = R * 1.55 + i * R * 0.24;
      if (broken) {
        g.fillRect(-R * 0.5, y, R * 0.45, R * 0.15);
        g.fillRect(R * 0.05, y, R * 0.45, R * 0.15);
      } else g.fillRect(-R * 0.5, y, R, R * 0.15);
    });
    g.restore();
  };
  const a = Math.atan2(2, 3);
  tri(-Math.PI / 2 - a + Math.PI, [0, 0, 0]);
  tri(Math.PI / 2 - a + Math.PI, [1, 1, 1]);
  tri(-Math.PI / 2 + a, [1, 0, 1]);
  tri(Math.PI / 2 + a, [0, 1, 0]);
}

// The cheer: "Dae-han-min-guk!" then clap clap, clap clap clap. Returns 0..1 for how high everyone is.
const CLAPS = [1.25, 1.5, 1.85, 2.02, 2.19];
function chant(t) {
  const u = t % 2.4;
  if (u < 1.0) return Math.max(0, Math.sin((u / 1.0) * Math.PI)) * 1.6;
  let b = 0;
  for (const c of CLAPS) b = Math.max(b, Math.max(0, 1 - Math.abs(u - c) / 0.08) * 0.5);
  return b;
}

export function kr({ scene, camera }, ctx) {
  sky(scene, { top: '#04050d', mid: '#171c46', bottom: '#0b0d1c', stars: 220, fog: ['#10142e', 180, 1000] });
  scene.add(new THREE.HemisphereLight('#5a62c8', '#140a0a', 0.8));
  // Floodlights on the riverside crowd, from the water and from behind.
  const front = new THREE.SpotLight('#ffe6d6', 600, 70, 0.75, 0.5, 1.2);
  front.position.set(0, 16, -6);
  front.target.position.set(0, 2, 18);
  const back = new THREE.PointLight('#ffd2b0', 200, 26, 1.4);
  back.position.set(0, 10, 30);
  scene.add(front, front.target, back);
  const river = makeWater('#070f24', 3000, 0.86);
  scene.add(river);
  const city = new THREE.Group();
  city.add(makeSkyline({ count: 56, width: 560, depth: 30, heights: [12, 56], seed: 31, lit: 0.5, cool: '#cfe6ff' }));
  const lotte = taper(12, 2.5, 190, 33, '#18202c', 0.55);
  lotte.position.x = 75;
  city.add(lotte, outline(lotte, '#bfe1ff'));
  const crown = halo('#e8f6ff', 12, 0.8);
  crown.position.set(75, 192, 0);
  city.add(crown);
  city.position.z = -190;
  scene.add(city);
  const refl = mirror(city, 0.28);
  refl.position.z = -190;
  scene.add(refl);
  // Namsan and N Seoul Tower, its observation deck changing colour.
  const namsan = new THREE.Mesh(new THREE.ConeGeometry(110, 70, 9), mat('#0b1220', { rough: 1, flat: true }));
  namsan.position.set(-110, 35, -330);
  scene.add(namsan);
  const tower = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.8, 44, 12), mat('#d8dde6', { rough: 0.5 }));
  stem.position.y = 22;
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 5.5, 7, 20), new THREE.MeshBasicMaterial({ color: '#7ad7ff', fog: false }));
  pod.position.y = 46;
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 34, 6), mat('#d8dde6'));
  ant.position.y = 66;
  const tip = halo('#ff4d4d', 4, 0.9);
  tip.position.y = 84;
  tower.add(stem, pod, ant, tip);
  tower.position.set(-110, 68, -330);
  scene.add(tower);
  // Banpo Bridge and its rainbow fountain.
  const bridge = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(700, 2, 12), mat('#2b3140', { rough: 0.7 }));
  deck.position.y = 7;
  bridge.add(deck);
  for (let x = -330; x <= 330; x += 30) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 7, 6), mat('#2b3140'));
    pier.position.set(x, 3.5, 0);
    bridge.add(pier);
  }
  bridge.position.z = -80;
  scene.add(bridge);
  const JETS = 70;
  const PER = 40;
  const fpos = new Float32Array(JETS * PER * 3);
  const fcol = new Float32Array(JETS * PER * 3);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  fg.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  const fountain = new THREE.Points(fg, new THREE.PointsMaterial({ size: 1.7, map: dot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(fountain);
  const hue = new THREE.Color();
  const updateFountain = (t) => {
    for (let j = 0; j < JETS; j++) {
      const x = -300 + j * (600 / JETS);
      for (let k = 0; k < PER; k++) {
        const u = (k / PER + t * 0.5) % 1;
        const i = (j * PER + k) * 3;
        fpos[i] = x;
        fpos[i + 1] = 6.4 + 4 * u - 10.4 * u * u;
        fpos[i + 2] = -73.5 + 16 * u;
        hue.setHSL(((x + 300) / 600 + t * 0.08) % 1, 1, 0.5);
        fcol[i] = hue.r;
        fcol[i + 1] = hue.g;
        fcol[i + 2] = hue.b;
      }
    }
    fg.attributes.position.needsUpdate = true;
    fg.attributes.color.needsUpdate = true;
  };
  // The riverside: the red crowd, neon behind them.
  const park = new THREE.Mesh(new THREE.PlaneGeometry(400, 80), mat('#10180f', { rough: 1 }));
  park.rotation.x = -Math.PI / 2;
  park.position.set(0, 0.05, 40);
  scene.add(park);
  const crowd = makeCrowd({ rows: 8, cols: 54, colors: ['#d7141f', '#c10f1a', '#e63a3a', '#d7141f', '#ffffff'], flagColors: ['#ffffff'], flags: 0.22, seed: 21 });
  crowd.position.set(0, 0.05, 14);
  scene.add(crowd);
  const flag = makeFlag(taegukgi, { w: 4.5, h: 3, pole: 9 });
  flag.position.set(-11, 0, 12);
  scene.add(flag);
  const flag2 = makeFlag(taegukgi, { w: 4.5, h: 3, pole: 9 });
  flag2.position.set(13, 0, 13);
  scene.add(flag2);
  const r = rand(14);
  const words = ['치킨', 'PC방', '노래방', '호프', '편의점', '떡볶이'];
  const signs = [];
  for (let i = 0; i < 9; i++) {
    const h = 14 + r() * 20;
    const b = new THREE.Mesh(new THREE.BoxGeometry(9, h, 8), new THREE.MeshLambertMaterial({ color: '#151826', emissive: '#ffffff', emissiveMap: windowsTexture(60 + i, { lit: 0.5 }) }));
    b.position.set(-44 + i * 11, h / 2, 46);
    scene.add(b);
    const sign = neonSign(words[i % words.length], NEON[i % NEON.length], { w: 6, h: 2.2 });
    sign.position.set(-44 + i * 11, 6 + r() * (h - 9), 41.9);
    sign.rotation.y = Math.PI;
    scene.add(sign);
    signs.push(sign);
  }
  const fw = makeFireworks(scene, { size: 2.6 });
  fireworksShow(scene, fw, { from: 3.4, n: 16, x: [-140, 140], y: [50, 90], z: -120, colors: ['#ffd76a', '#ffffff', '#cd2e3a', '#4a8bff', ctx.car.color], gap: 0.3, seed: 6 });
  const shot1 = cameraPath(camera, [
    { t: 0, pos: [-3, 2.4, 3], look: [0, 3.2, 20], fov: 46 },
    { t: 3.4, pos: [3, 3, 5], look: [0, 3.6, 20], fov: 42 },
  ]);
  const shot2 = cameraPath(camera, [
    { t: 3.4, pos: [0, 10, 32], look: [0, 14, -80], fov: 48 },
    { t: 8.8, pos: [10, 18, 40], look: [-30, 34, -220], fov: 50 },
  ]);
  const cues = [];
  for (const k of [0, 1]) for (const c of CLAPS) cues.push([0.3 + k * 2.4 + c, 'clap']);
  return {
    duration: 8.8,
    capAt: 3.0,
    cues,
    update(t, dt) {
      const beat = chant(Math.max(0, t - 0.3));
      crowd.userData.update(t, 1, beat);
      flag.userData.update(t, 5, 0.3);
      flag2.userData.update(t + 1, 5, 0.3);
      updateFountain(t);
      pod.material.color.setHSL((t * 0.08) % 1, 0.8, 0.6);
      for (const s of signs) s.material.color.setScalar(Math.sin(t * 19 + s.userData.flicker * 5) > 0.97 ? 0.35 : 1);
      fw.update(t, dt);
      (t < 3.4 ? shot1 : shot2)(t);
    },
  };
}

// ------------------------------------------------------------------ Taiwan: sky lanterns and Taipei 101

function taipei101() {
  const g = new THREE.Group();
  const lines = [];
  const add = (mesh) => {
    g.add(mesh);
    const l = outline(mesh, '#7affd6');
    g.add(l);
    lines.push(l);
  };
  const base = new THREE.Mesh(new THREE.CylinderGeometry(13, 16, 36, 4), new THREE.MeshLambertMaterial({ color: '#16202a', emissive: '#ffffff', emissiveMap: windowsTexture(101, { lit: 0.45, cool: '#bfffe8' }) }));
  base.rotation.y = Math.PI / 4;
  base.position.y = 18;
  add(base);
  let y = 36;
  for (let i = 0; i < 8; i++) {
    const seg8 = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 9.5, 16, 4), new THREE.MeshLambertMaterial({ color: '#16202a', emissive: '#ffffff', emissiveMap: windowsTexture(102 + i, { lit: 0.5, cool: '#bfffe8' }) }));
    seg8.rotation.y = Math.PI / 4;
    seg8.position.y = y + 8;
    add(seg8);
    y += 16;
  }
  for (const [rb, rt, h] of [[7, 5, 8], [4.5, 3, 7], [2.5, 1.6, 6]]) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 4), mat('#1d2832'));
    top.rotation.y = Math.PI / 4;
    top.position.y = y + h / 2;
    add(top);
    y += h;
  }
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 34, 6), mat('#d8dde6'));
  spire.position.y = y + 17;
  g.add(spire);
  const tip = halo('#ff4d4d', 6, 0.9);
  tip.position.y = y + 35;
  g.add(tip);
  g.userData.lines = lines;
  g.userData.height = y + 35;
  return g;
}

export function tw({ scene, camera }, ctx) {
  sky(scene, { top: '#050816', mid: '#1f2554', bottom: '#2a1f3a', stars: 320, fog: ['#1a1830', 140, 1000] });
  scene.add(new THREE.HemisphereLight('#6a66c8', '#1a1008', 0.55));
  const warm = new THREE.PointLight('#ffb35a', 60, 40, 1.4);
  warm.position.set(0, 6, 6);
  scene.add(warm);
  ground(scene, '#0e1410');
  scene.add(makeHills({ count: 8, width: 900, z: -230, heights: [22, 48], color: '#0e1322', seed: 2 }));
  scene.add(makeHills({ count: 10, width: 700, z: -100, heights: [10, 24], color: '#121a2a', seed: 3 }));
  const t101 = taipei101();
  t101.position.set(60, 0, -330);
  scene.add(t101);
  const city = makeSkyline({ count: 40, width: 260, depth: 30, heights: [6, 26], seed: 51, lit: 0.6 });
  city.position.set(60, 0, -315);
  scene.add(city);
  // A little village street with paper lanterns strung across it.
  const r = rand(4);
  const wall = mat('#3a332c', { rough: 0.9 });
  const roofM = mat('#4a2a22', { rough: 0.9, flat: true });
  for (let i = 0; i < 10; i++) {
    const h = 3.5 + r() * 2.5;
    const house = new THREE.Mesh(new THREE.BoxGeometry(6, h, 5), wall);
    house.position.set(-36 + i * 8, h / 2, -22 - r() * 6);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 4.4, 2, 4), roofM);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.8;
    roof.position.set(house.position.x, h + 1, house.position.z);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1), glowMat('#ffc070'));
    win.position.set(house.position.x + (r() - 0.5) * 2, h * 0.55, house.position.z + 2.51);
    scene.add(house, roof, win);
  }
  for (let i = 0; i < 18; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), glowMat('#e8302a'));
    l.scale.y = 1.25;
    l.position.set(-30 + i * 3.6, 7 + Math.sin(i * 0.9) * 0.5, -16);
    scene.add(l, at(halo('#ff5a3a', 2.2, 0.5), l.position.x, l.position.y, l.position.z));
  }
  // The people letting their lanterns go.
  const people = [0, 1, 2, 3, 4].map((i) => {
    const f = makeFigure({ suit: [ctx.car.color, '#f2efe8', '#2b4fa8', '#e8b04a', '#3d7f3c'][i], head: '#e9dccb', hair: ['#1b1b1b', '#3d2a1a', '#2a1d14', '#1b1b1b', '#6b4a2b'][i] });
    f.position.set(-5 + i * 2.5, 0, 2 + (i % 2) * 1.5);
    f.rotation.y = -Math.PI / 2 + (i - 2) * 0.15;
    scene.add(f);
    return f;
  });
  // Lanterns: one per person (the first carries the number) and hundreds rising from the valley.
  const paper = (text) => canvasTexture(64, 96, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ffe6a8');
    gr.addColorStop(1, '#ff9a3a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    if (text) {
      g.fillStyle = '#c0121a';
      g.font = '900 26px "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif';
      g.textAlign = 'center';
      g.fillText('加油', w / 2, 40);
      g.font = '900 italic 24px Saira, sans-serif';
      g.fillText(text, w / 2, 74);
    }
  });
  const heroes = people.map((p, i) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.42, 1.2, 4, 1), new THREE.MeshBasicMaterial({ map: paper(i === 0 ? `#${ctx.number}` : ''), fog: false }));
    l.rotation.y = Math.PI / 4;
    const glow = halo('#ffad55', 3.2, 0.55);
    scene.add(l, glow);
    return { l, glow, p, at: 1.0 + i * 0.25, sp: 1.6 + i * 0.12, ph: i };
  });
  const N = 320;
  const lanterns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.38, 1, 4, 1), new THREE.MeshBasicMaterial({ color: '#ffb04d', fog: false }), N);
  const gpos = new Float32Array(N * 3);
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  const glows = new THREE.Points(gg, new THREE.PointsMaterial({ size: 3, map: dot(), color: '#ff9a3a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const fly = Array.from({ length: N }, () => ({ x: (r() - 0.5) * 260, y: r() * 70, z: -10 - r() * 200, sp: 1 + r() * 1.8, ph: r() * 6 }));
  scene.add(lanterns, glows);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0));
  const one = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();
  const fw = makeFireworks(scene, { size: 3.2 });
  const top = t101.userData.height;
  const T = t101.position;
  for (let i = 0; i < 18; i++) fw.launch(2.4 + i * 0.3, [T.x + (i % 2 ? 1 : -1) * (16 + (i % 3) * 7), 50 + ((i * 37) % Math.round(top - 60)), T.z + 6], ['#ffd76a', '#ff4d4d', '#ffffff', ctx.car.color][i % 4]);
  const shot1 = cameraPath(camera, [
    { t: 0, pos: [3, 1.6, 13], look: [0, 2.6, 0], fov: 46 },
    { t: 3.2, pos: [2, 2.2, 14], look: [0, 14, -10], fov: 48 },
  ]);
  const shot2 = cameraPath(camera, [
    { t: 3.2, pos: [-6, 7, 26], look: [30, 60, -330], fov: 46 },
    { t: 8.8, pos: [-14, 12, 42], look: [45, 95, -330], fov: 48 },
  ]);
  return {
    duration: 8.8,
    capAt: 3.2,
    cues: [],
    update(t, dt) {
      heroes.forEach((h) => {
        const up = Math.max(0, t - h.at);
        const hand = h.p.position;
        h.l.position.set(hand.x + Math.sin(up * 0.8 + h.ph) * up * 0.3, 2.6 + up * h.sp + up * up * 0.25, hand.z + Math.cos(up * 0.6 + h.ph) * up * 0.2);
        h.glow.position.copy(h.l.position);
        h.p.userData.arms.forEach((a) => (a.rotation.x = up > 0 ? -2.7 + Math.min(1.6, up) : -2.9));
      });
      fly.forEach((f, i) => {
        const y = (f.y + t * f.sp) % 90;
        v.set(f.x + Math.sin(t * 0.4 + f.ph) * 1.5, y, f.z);
        m4.compose(v, q, one);
        lanterns.setMatrixAt(i, m4);
        gpos[i * 3] = v.x;
        gpos[i * 3 + 1] = v.y;
        gpos[i * 3 + 2] = v.z;
      });
      lanterns.instanceMatrix.needsUpdate = true;
      gg.attributes.position.needsUpdate = true;
      t101.userData.lines.forEach((l, i) => l.material.color.setHSL((0.42 + t * 0.05 + i * 0.01) % 1, 0.9, 0.6));
      fw.update(t, dt);
      (t < 3.2 ? shot1 : shot2)(t);
    },
  };
}

// ------------------------------------------------------------------ Macau: the Guia Circuit at night

export function mo({ scene, camera }, ctx) {
  sky(scene, { top: '#05060f', mid: '#1d1a44', bottom: '#120f22', stars: 150, fog: ['#141230', 140, 1000] });
  scene.add(new THREE.HemisphereLight('#6a64c8', '#140c08', 0.7));
  ground(scene, '#16171d');
  scene.add(makeTrack({ length: 900, width: 11, color: '#26272d' }));
  // Armco, catch fencing and floodlights.
  const steel = mat('#b9bec8', { metal: 0.7, rough: 0.35 });
  for (const z of [-6.3, 6.3]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(900, 0.5, 0.2), steel);
    rail.position.set(0, 0.7, z);
    scene.add(rail);
  }
  const fenceTex = canvasTexture(64, 64, (g) => {
    g.strokeStyle = 'rgba(210,215,225,.75)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(64, 64);
    g.moveTo(64, 0);
    g.lineTo(0, 64);
    g.stroke();
  });
  fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping;
  fenceTex.repeat.set(300, 2);
  const fence = new THREE.Mesh(new THREE.PlaneGeometry(900, 4.5), new THREE.MeshBasicMaterial({ map: fenceTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  fence.position.set(0, 3, 6.6);
  scene.add(fence);
  for (let x = -180; x <= 180; x += 40) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 14, 6), steel);
    pole.position.set(x, 7, -9);
    const pool = new THREE.PointLight('#fff1d8', 220, 40, 1.5);
    pool.position.set(x, 12, -6);
    scene.add(pole, pool, at(halo('#fff3d6', 5, 0.7), x, 14, -9));
  }
  scene.add(new THREE.AmbientLight('#ffe9c8', 0.4));
  neonStreet(scene, { words: ['葡撻', '杏仁餅', '酒店', '茶餐廳', '豬扒包', '當舖'], z0: -60, z1: -14, half: 30, seed: 7 });
  // Grand Lisboa, Macau Tower and the Guia lighthouse.
  const lisboa = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c99a2e', { emissive: '#ffb733', glow: 0.7, metal: 0.4 }));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 84, 10), new THREE.MeshLambertMaterial({ color: '#3a2c14', emissive: '#ffffff', emissiveMap: windowsTexture(88, { lit: 0.7, warm: '#ffd36b' }) }));
  body.position.y = 52;
  const crownL = new THREE.Mesh(new THREE.CylinderGeometry(24, 7, 44, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#ffc94a', side: THREE.DoubleSide, wireframe: true, fog: false }));
  crownL.position.y = 116;
  const ball = halo('#ffe08a', 26, 0.6);
  ball.position.y = 120;
  lisboa.add(dome, body, crownL, ball);
  lisboa.position.set(50, 0, -170);
  scene.add(lisboa);
  const mtower = new THREE.Group();
  const mstem = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 5, 150, 12), mat('#c9ced8', { rough: 0.5, emissive: '#3a4a66', glow: 0.6 }));
  mstem.position.y = 75;
  const mpod = new THREE.Mesh(new THREE.CylinderGeometry(11, 9.5, 9, 24), new THREE.MeshLambertMaterial({ color: '#202a3a', emissive: '#ffffff', emissiveMap: windowsTexture(89, { lit: 0.8, cool: '#bfe3ff' }) }));
  mpod.position.y = 140;
  const mring = new THREE.Mesh(new THREE.TorusGeometry(11.5, 0.4, 6, 40), glowMat('#7fd6ff'));
  mring.rotation.x = Math.PI / 2;
  mring.position.y = 145;
  const mmast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 44, 6), mat('#c9ced8', { emissive: '#3a4a66', glow: 0.6 }));
  mmast.position.y = 166;
  const mtip = halo('#ff4d4d', 4, 0.9);
  mtip.position.y = 189;
  mtower.add(mstem, mpod, mring, mmast, mtip);
  mtower.position.set(-75, 0, -260);
  scene.add(mtower);
  const hill = new THREE.Mesh(new THREE.ConeGeometry(80, 60, 9), mat('#0d1418', { rough: 1, flat: true }));
  hill.position.set(-10, 30, -380);
  const house = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 14, 10), mat('#f2f2ee', { rough: 0.6 }));
  house.position.set(-10, 67, -380);
  const lamp = halo('#fff6cc', 5, 0.95);
  lamp.position.set(-10, 75, -380);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 9, 260, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.geometry.translate(0, 130, 0);
  beam.rotation.z = Math.PI / 2;
  const beamHolder = new THREE.Group();
  beamHolder.position.set(-10, 75, -380);
  beamHolder.add(beam);
  scene.add(hill, house, lamp, beamHolder);
  const me = makeCar({ ...ctx.car, helmet: ctx.helmet });
  me.position.set(-60, 0, 3.5);
  scene.add(me);
  const sparks = makePuffs(scene, { color: '#ffb347', life: 0.35, size: 0.6, additive: true, max: 200 });
  for (let i = 0; i < 60; i++) sparks.emit(0.6 + i * 0.03, [0, 0.1, 3.5], [-12, 2, 0], 1, 2);
  const fw = makeFireworks(scene, { size: 2.8 });
  fireworksShow(scene, fw, { from: 3.2, n: 16, x: [-120, 140], y: [60, 110], z: -230, colors: ['#ffd76a', '#ffffff', '#3cd28a', '#ff6b6b', ctx.car.color], gap: 0.32, seed: 10 });
  const shot2 = cameraPath(camera, [
    { t: 3.3, pos: [-6, 10, 18], look: [-10, 50, -220], fov: 50 },
    { t: 8.8, pos: [6, 20, 30], look: [-20, 75, -260], fov: 52 },
  ]);
  return {
    duration: 8.8,
    capAt: 3.2,
    cues: [],
    update(t, dt) {
      const x = -62 + t * 50;
      me.position.x = x;
      me.userData.spin(x);
      // Sparks follow the car as it scrapes along.
      sparks.update(t, dt);
      if (t < 2.6) for (let i = 0; i < 2; i++) sparks.emit(t, [x - 1.8, 0.1, 3.5 + (Math.random() - 0.5)], [-10, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3], 1, 1.5);
      beamHolder.rotation.y = t * 1.2;
      crownL.rotation.y = t * 0.2;
      fw.update(t, dt);
      if (t < 3.3) {
        camera.position.set(8, 0.9, -5);
        camera.lookAt(clamp(x, -30, 60), 1, 3);
        if (camera.fov !== 36) {
          camera.fov = 36;
          camera.updateProjectionMatrix();
        }
      } else shot2(t);
    },
  };
}

// ------------------------------------------------------------------ anywhere else: the home grandstand

const STRIPES = {
  v: { FR: ['#0055a4', '#ffffff', '#ef4135'], IT: ['#009246', '#ffffff', '#ce2b37'], BE: ['#000000', '#fae042', '#ed2939'] },
  h: {
    DE: ['#000000', '#dd0000', '#ffce00'], NL: ['#ae1c28', '#ffffff', '#21468b'], AT: ['#ed2939', '#ffffff', '#ed2939'], HU: ['#ce2939', '#ffffff', '#477050'],
    PL: ['#ffffff', '#dc143c'], CO: ['#fcd116', '#fcd116', '#003893', '#ce1126'], TH: ['#a51931', '#f4f5f8', '#2d2a4a', '#2d2a4a', '#f4f5f8', '#a51931'],
    AR: ['#74acdf', '#ffffff', '#74acdf'], IN: ['#ff9933', '#ffffff', '#138808'],
  },
  cross: { DK: ['#c8102e', '#ffffff'], SE: ['#006aa7', '#fecc00'], FI: ['#ffffff', '#002f6c'] },
};

// The flag drawn on a canvas, for the countries whose flag is stripes or a cross.
export function flagDrawer(nat) {
  if (STRIPES.v[nat]) return (g, w, h) => STRIPES.v[nat].forEach((c, i, a) => ((g.fillStyle = c), g.fillRect((i * w) / a.length, 0, w / a.length + 1, h)));
  if (STRIPES.h[nat]) {
    return (g, w, h) => {
      STRIPES.h[nat].forEach((c, i, a) => ((g.fillStyle = c), g.fillRect(0, (i * h) / a.length, w, h / a.length + 1)));
      if (nat === 'AR') ((g.fillStyle = '#f6b40e'), g.beginPath(), g.arc(w / 2, h / 2, h * 0.1, 0, 7), g.fill());
      if (nat === 'IN') ((g.strokeStyle = '#000080'), (g.lineWidth = 3), g.beginPath(), g.arc(w / 2, h / 2, h * 0.13, 0, 7), g.stroke());
    };
  }
  if (STRIPES.cross[nat]) {
    const [bg, fg] = STRIPES.cross[nat];
    return (g, w, h) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.fillStyle = fg;
      g.fillRect(w * 0.3, 0, h * 0.2, h);
      g.fillRect(0, h * 0.4, w, h * 0.2);
    };
  }
  if (nat === 'CH') return (g, w, h) => ((g.fillStyle = '#da291c'), g.fillRect(0, 0, w, h), (g.fillStyle = '#fff'), g.fillRect(w / 2 - 10, h / 2 - 34, 20, 68), g.fillRect(w / 2 - 34, h / 2 - 10, 68, 20));
  if (nat === 'BR') {
    return (g, w, h) => {
      g.fillStyle = '#009c3b';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffdf00';
      g.beginPath();
      g.moveTo(w / 2, 10);
      g.lineTo(w - 14, h / 2);
      g.lineTo(w / 2, h - 10);
      g.lineTo(14, h / 2);
      g.fill();
      g.fillStyle = '#002776';
      g.beginPath();
      g.arc(w / 2, h / 2, h * 0.24, 0, 7);
      g.fill();
    };
  }
  if (nat === 'JP') return (g, w, h) => ((g.fillStyle = '#fff'), g.fillRect(0, 0, w, h), (g.fillStyle = '#bc002d'), g.beginPath(), g.arc(w / 2, h / 2, h * 0.3, 0, 7), g.fill());
  if (nat === 'KR') return taegukgi;
  return null;
}

export function home({ scene, camera }, ctx) {
  const colors = FLAG_COLORS[ctx.nat] || ['#e10600', '#ffffff', '#1d3b8b'];
  sky(scene, { top: '#3f78c9', mid: '#b5d6f2', bottom: '#8aa0b0', sun: [0.4, 0.45, -1], sunColor: '#fff3d0', fog: ['#b9cde0', 120, 900] });
  lights(scene, { sky: '#dbeaff', ground: '#3b4a2a', amb: 1.3, sun: '#fff1d6', sunI: 2.4, sunPos: [40, 60, -60] });
  ground(scene, '#4f7d3a');
  scene.add(makeTrack({ length: 1000, width: 15 }));
  const crowd = makeCrowd({ rows: 12, cols: 110, colors: [...colors, ...colors, '#ffffff'], flagColors: colors, flags: 0.4, seed: 17 });
  crowd.position.set(0, 0, 12);
  scene.add(crowd);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(84, 0.6, 16), mat('#dfe3ea', { rough: 0.6 }));
  roof.position.set(0, 13, 18);
  scene.add(roof);
  for (const x of [-40, -13, 13, 40]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 13, 0.6), mat('#9aa1ad'));
    col.position.set(x, 6.5, 25.5);
    scene.add(col);
  }
  const draw = flagDrawer(ctx.nat);
  const flags = [];
  if (draw) {
    for (const x of [-24, 0, 24]) {
      const f = makeFlag(draw, { w: 5, h: 3.3, pole: 6 });
      f.position.set(x, 13.3, 12);
      scene.add(f);
      flags.push(f);
    }
  }
  // Coloured smoke flares in the stands.
  const flares = colors.map((c) => makePuffs(scene, { color: c, life: 3, size: 4, max: 60 }));
  flares.forEach((p, i) => {
    for (let k = 0; k < 40; k++) p.emit(0.5 + k * 0.18, [-30 + i * 22 + (k % 3) * 6, 4 + (k % 4), 16 + (k % 2) * 4], [0.6, 2.2, -0.6], 1, 0.6);
  });
  const me = makeCar({ ...ctx.car, helmet: ctx.helmet });
  scene.add(me);
  const glove = new THREE.Group();
  const gl = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), mat('#1b1b20'));
  gl.position.y = 0.3;
  glove.add(gl);
  glove.position.set(-0.05, 1.05, 0.28);
  me.add(glove);
  const confetti = makeFalling(scene, { count: 500, colors, center: [0, 14, 4], area: [30, 4, 8], start: 2.4, speed: 2, size: [0.3, 0.12] });
  const fw = makeFireworks(scene, { size: 3.4, count: 120 });
  fireworksShow(scene, fw, { from: 3, n: 10, x: [-60, 60], y: [40, 60], z: 60, colors, gap: 0.45, seed: 13 });
  const shot2 = cameraPath(camera, [
    { t: 3.4, pos: [6, 3, -16], look: [0, 6, 14], fov: 46 },
    { t: 8.4, pos: [-10, 9, -26], look: [0, 10, 14], fov: 50 },
  ]);
  return {
    duration: 8.4,
    capAt: 2.8,
    cues: [],
    update(t, dt) {
      const x = -60 + t * 14;
      me.position.set(x, 0, -3);
      me.userData.spin(x);
      glove.rotation.x = Math.sin(t * 6) * 0.6;
      crowd.userData.update(t, 1);
      flags.forEach((f, i) => f.userData.update(t + i, 5, 0.3));
      flares.forEach((p) => p.update(t, dt));
      confetti.update(t);
      fw.update(t, dt);
      if (t < 3.4) {
        camera.position.set(x + 7, 1.6, -11);
        camera.lookAt(x, 1.5, 4);
        if (camera.fov !== 40) {
          camera.fov = 40;
          camera.updateProjectionMatrix();
        }
      } else shot2(t);
    },
  };
}
