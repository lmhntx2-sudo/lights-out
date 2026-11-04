// Cutscenes for the big moments of any career: debut, first win, world title,
// the proposal, the baby and retirement. Each returns { duration, capAt, cues,
// update(t, dt) }: capAt is when the caption shows, cues are [time, sound].
import {
  THREE, sky, lights, mat, glowMat, halo, ground, makeTrack, makeCar, makeFigure, makeCrowd, makeFireworks, makeFalling,
  makePuffs, makeFlag, checkers, makeHills, makeWater, canvasTexture, cameraPath, clamp, lerp, seg, smooth, easeOut, easeIn, rand,
} from './kit.js';

const gold = () => mat('#e2b33c', { metal: 0.45, rough: 0.28, emissive: '#5c3d00', glow: 0.6 });

function trophy(scale = 1) {
  const pts = [[0, 0], [0.42, 0], [0.42, 0.08], [0.16, 0.16], [0.11, 0.55], [0.14, 0.62], [0.44, 0.86], [0.52, 1.32], [0.46, 1.34], [0.0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), gold());
  const g = new THREE.Group();
  g.add(cup);
  for (const s of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 14, Math.PI * 1.2), gold());
    handle.position.set(s * 0.5, 1.02, 0);
    handle.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2 + Math.PI * 0.2;
    g.add(handle);
  }
  g.scale.setScalar(scale);
  return g;
}

function gantry(scene, x, width = 22) {
  const g = new THREE.Group();
  const steel = mat('#2a2d34', { metal: 0.6, rough: 0.4 });
  for (const z of [-width / 2, width / 2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), steel);
    post.position.set(0, 4, z);
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, width + 0.5), steel);
  beam.position.set(0, 7.6, 0);
  g.add(beam);
  g.position.x = x;
  scene.add(g);
  return g;
}

// ------------------------------------------------------------------ debut: five red lights

export function debut({ scene, camera }, ctx) {
  sky(scene, { top: '#1b2550', mid: '#e98a68', bottom: '#2c2333', sun: [-1, 0.06, -0.25], sunColor: '#ffb37a', fog: ['#7a5a62', 60, 420] });
  lights(scene, { sky: '#ffcfa8', ground: '#2a2420', amb: 1.1, sun: '#ffc08a', sunI: 2.2, sunPos: [-40, 18, -20] });
  ground(scene, '#283522');
  scene.add(makeTrack({ length: 900, width: 16 }));
  scene.add(makeHills({ z: 260, heights: [30, 70], color: '#2a2f3c', count: 8, width: 900 }));
  const grand = makeCrowd({ rows: 7, cols: 60, colors: ['#d63a2f', '#ffffff', '#2b4fa8', '#f2c230', '#1f8a4c'], seed: 4 });
  grand.position.set(10, 0, 14);
  scene.add(grand);

  const me = makeCar({ ...ctx.car, helmet: ctx.helmet });
  me.position.set(0, 0, -3.2);
  scene.add(me);
  const field = ctx.rivals.slice(0, 9).map((c, i) => {
    const car = makeCar({ ...c, helmet: { c1: '#e8e8e8', c2: c.color } });
    car.position.set(-7 * (i + 1) - 1, 0, i % 2 ? -3.2 : 3.2);
    if (i % 2 === 0) car.position.x += 3.5;
    scene.add(car);
    return { car, x0: car.position.x, react: 0.12 + ((i * 37) % 10) / 40 };
  });

  // The gantry and its five pairs of lights, facing the grid.
  gantry(scene, 16);
  const lamps = [];
  for (let k = 0; k < 5; k++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.9), mat('#0b0b0d', { rough: 0.6 }));
    box.position.set(15.5, 7.6, (k - 2) * 1.25);
    scene.add(box);
    const pair = [];
    for (const y of [7.95, 7.3]) {
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.24, 18), new THREE.MeshBasicMaterial({ color: '#2a0606' }));
      lamp.position.set(15.24, y, (k - 2) * 1.25);
      lamp.rotation.y = -Math.PI / 2;
      scene.add(lamp);
      const glow = halo('#ff2a1a', 1.6, 0);
      glow.position.copy(lamp.position).x -= 0.05;
      scene.add(glow);
      pair.push({ lamp, glow });
    }
    lamps.push(pair);
  }
  const ON = [1.8, 2.4, 3.0, 3.6, 4.2];
  const OUT = 5.0;
  const smoke = makePuffs(scene, { color: '#cfcfcf', life: 1.6, size: 2.4 });
  for (const f of [{ car: me, react: 0 }, ...field]) smoke.emit(OUT + f.react, [f.car.position.x - 1.6, 0.4, f.car.position.z], [-4, 1.2, 0], 6, 1);

  const xAt = (t, react) => {
    const u = Math.max(0, t - OUT - react);
    return 0.5 * 16 * u * u;
  };
  // A wide look at the grid, then the driver's view of the lights, then chase the car.
  const wide = cameraPath(camera, [
    { t: 0, pos: [-34, 11, -24], look: [-10, 0, 0], fov: 42 },
    { t: 1.7, pos: [-22, 7, -19], look: [0, 1, 0], fov: 42 },
  ]);
  const pov = cameraPath(camera, [
    { t: 1.7, pos: [-1.2, 1.5, -3.2], look: [15.2, 7.3, -2.2], fov: 52 },
    { t: OUT, pos: [-0.9, 1.45, -3.2], look: [15.2, 7.5, -2.2], fov: 44 },
  ]);
  return {
    duration: 8.2,
    capAt: 5.6,
    cues: [...ON.map((t) => [t, 'light']), [OUT, 'go']],
    update(t, dt) {
      lamps.forEach((pair, k) => {
        const on = t >= ON[k] && t < OUT;
        for (const { lamp, glow } of pair) {
          lamp.material.color.set(on ? '#ff3020' : '#2a0606');
          glow.material.opacity = on ? 0.95 : 0;
        }
      });
      const mx = xAt(t, 0);
      me.position.x = mx;
      me.userData.spin(mx);
      for (const f of field) {
        f.car.position.x = f.x0 + xAt(t, f.react);
        f.car.userData.spin(f.car.position.x);
      }
      smoke.update(t, dt);
      grand.userData.update(t, t > OUT ? 1 : 0.25);
      if (t < 1.7) wide(t);
      else if (t < OUT + 0.15) pov(t);
      else {
        const u = seg(t, OUT + 0.15, 8.2);
        camera.position.set(mx - lerp(5, 9, u), lerp(1.2, 2.2, u), lerp(-6.4, -7.5, u));
        camera.lookAt(mx + 6, 1, -1);
      }
    },
  };
}

// ------------------------------------------------------------------ first win: flag, then podium

export function win({ scene, camera }, ctx) {
  sky(scene, { top: '#2f5d9e', mid: '#f3c48a', bottom: '#6b5a52', sun: [1, 0.18, -0.6], sunColor: '#ffd38a', fog: ['#c9a882', 80, 500] });
  lights(scene, { sky: '#ffe2b8', ground: '#3d3326', amb: 1.15, sun: '#ffd9a0', sunI: 2.4, sunPos: [60, 30, -40] });
  ground(scene, '#3f5f2e');
  scene.add(makeTrack({ length: 1200, width: 16 }));
  const grand = makeCrowd({ rows: 9, cols: 90, colors: [ctx.car.color, '#ffffff', '#f2c230', '#2b4fa8', '#d63a2f'], seed: 6 });
  grand.position.set(0, 0, 14);
  scene.add(grand);
  gantry(scene, 0, 24);
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 22), new THREE.MeshStandardMaterial({ map: canvasTexture(512, 32, (g, w, h) => {
    for (let x = 0; x < 64; x++) for (let y = 0; y < 4; y++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5';
      g.fillRect(x * 8, y * 8, 8, 8);
    }
  }) }));
  banner.position.set(-0.45, 7.6, 0);
  scene.add(banner);
  const flag = makeFlag(checkers, { w: 2.4, h: 1.6, pole: 3.2 });
  flag.position.set(2, 6.6, -10.8);
  flag.rotation.y = Math.PI;
  scene.add(flag);
  const marshal = makeFigure({ suit: '#f28c1a', cap: '#f28c1a' });
  marshal.position.set(2, 6.6 - 1.9 + 0.4, -10.5);
  scene.add(marshal);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 2), mat('#4a4d55'));
  platform.position.set(2, 6.55 - 1.9 + 0.25, -10.5);
  scene.add(platform);

  const me = makeCar({ ...ctx.car, helmet: ctx.helmet });
  me.position.set(-120, 0, -2);
  scene.add(me);
  const carX = (t) => -95 + t * 62 - Math.max(0, t - 1.6) ** 2 * 6;

  // The podium, built away from the track so the cut is clean.
  const P = new THREE.Vector3(400, 0, 0);
  const pod = new THREE.Group();
  pod.position.copy(P);
  scene.add(pod);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshStandardMaterial({ map: canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#121318';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? ctx.car.color : '#1d1f27';
      g.fillRect(i * (w / 6), h * 0.72, w / 6, h * 0.28);
    }
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.08;
    for (let i = 0; i < 12; i++) g.fillRect(i * 44, 0, 2, h);
  }), roughness: 0.8 }));
  wall.position.set(0, 3.25, -4);
  pod.add(wall);
  for (let i = 0; i < 14; i++) {
    const bulb = halo('#ffe2a0', 0.9, 0.9);
    bulb.position.set(-12.5 + i * (25 / 13), 6.6, -3.9);
    pod.add(bulb);
  }
  const steps = [[0, 1.6, '1'], [-2.6, 1.1, '2'], [2.6, 0.75, '3']].map(([x, h, n]) => {
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, h, 2.2), new THREE.MeshStandardMaterial({ map: canvasTexture(128, 96, (g, w, hh) => {
      g.fillStyle = '#e9e9ee';
      g.fillRect(0, 0, w, hh);
      g.fillStyle = '#111';
      g.font = '900 60px Saira, sans-serif';
      g.textAlign = 'center';
      g.fillText(n, w / 2, hh * 0.72);
    }), roughness: 0.6 }));
    step.position.set(x, h / 2, 0);
    pod.add(step);
    return { x, h };
  });
  const rivals = [ctx.rivals[0] || { color: '#1d3b8b' }, ctx.rivals[1] || { color: '#1f8a4c' }];
  const p1 = makeFigure({ suit: ctx.car.color, cap: ctx.helmet.c2 });
  p1.position.set(0, steps[0].h, 0.2);
  const p2 = makeFigure({ suit: rivals[0].color, cap: rivals[0].color });
  p2.position.set(steps[1].x, steps[1].h, 0.2);
  const p3 = makeFigure({ suit: rivals[1].color, cap: rivals[1].color });
  p3.position.set(steps[2].x, steps[2].h, 0.2);
  for (const f of [p1, p2, p3]) {
    f.rotation.y = -Math.PI / 2;
    pod.add(f);
  }
  const cup = trophy(0.75);
  cup.position.set(0, -0.62, 0);
  p1.userData.arms[1].add(cup);
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.5, 10), mat('#1d5b2a', { rough: 0.2, metal: 0.3 }));
  bottle.position.set(0, -0.7, 0);
  p1.userData.arms[0].add(bottle);
  const spray = makePuffs(scene, { color: '#fff6d2', life: 0.9, size: 0.35, additive: true, max: 400, gravity: 9, grow: 0.8 });
  for (let i = 0; i < 160; i++) {
    const at = 5.1 + i * 0.018;
    const sweep = Math.sin(i * 0.09) * 4;
    spray.emit(at, [P.x - 0.4, steps[0].h + 2.5, 0.5], [sweep, 4 + Math.random() * 2, 4 + Math.random() * 2], 1, 0.7);
  }
  const confetti = makeFalling(scene, { count: 500, colors: [ctx.car.color, ctx.car.accent, '#ffd12e', '#ffffff'], center: [P.x, 9, 1], area: [10, 3, 4], start: 4.6, speed: 2.4 });
  const fw = makeFireworks(scene);
  [[5.6, -8, '#ffd12e'], [6.2, 7, ctx.car.color], [6.9, 0, '#ffffff'], [7.5, -4, ctx.car.accent]].forEach(([at, x, c]) => fw.launch(at, [P.x + x, 22 + Math.random() * 6, -30], c));

  // Trackside by the line, the camera swings round with the car.
  const shot1 = (t, x) => {
    camera.position.set(lerp(9, 5, t / 3.1), lerp(1.1, 2, t / 3.1), -12.5);
    camera.lookAt(clamp(x, -50, 70) + 3, 1.4, -2);
    if (camera.fov !== 36) {
      camera.fov = 36;
      camera.updateProjectionMatrix();
    }
  };
  const shot2 = cameraPath(camera, [
    { t: 3.1, pos: [P.x, 1.6, 16], look: [P.x, 3.2, 0], fov: 38 },
    { t: 9, pos: [P.x + 2, 3.6, 11], look: [P.x, 3.6, 0], fov: 42 },
  ]);
  return {
    duration: 9,
    capAt: 4.4,
    cues: [[3.4, 'win']],
    update(t, dt) {
      const x = carX(t);
      me.position.x = x;
      me.userData.spin(x);
      flag.userData.update(t, 9, 0.35);
      marshal.userData.arms[0].rotation.x = -2.6 + Math.sin(t * 9) * 0.5;
      flag.rotation.z = Math.sin(t * 9) * 0.35;
      grand.userData.update(t, 1);
      // Podium: arms up with the trophy, the others clap.
      const up = easeOut(seg(t, 3.8, 4.5));
      p1.userData.arms[1].rotation.x = -up * 2.9;
      p1.userData.arms[0].rotation.x = -up * 2.2 - (t > 5.1 ? Math.sin(t * 14) * 0.15 : 0);
      for (const f of [p2, p3]) {
        f.userData.arms[0].rotation.x = -1.2 + Math.sin(t * 10) * 0.25;
        f.userData.arms[1].rotation.x = -1.2 - Math.sin(t * 10) * 0.25;
      }
      spray.update(t, dt);
      confetti.update(t);
      fw.update(t, dt);
      if (t < 3.1) shot1(t, x);
      else shot2(t);
    },
  };
}

// ------------------------------------------------------------------ world title

export function title({ scene, camera }, ctx) {
  sky(scene, { top: '#04060f', mid: '#141a3a', bottom: '#07080f', stars: 400, fog: ['#0b0e1e', 80, 500] });
  lights(scene, { sky: '#6a7cd0', ground: '#14141a', amb: 1, sun: '#c8d4ff', sunI: 1.2, sunPos: [-20, 30, 30] });
  ground(scene, '#121418');
  scene.add(makeTrack({ length: 900, width: 18, color: '#24262c' }));
  const grand = makeCrowd({ rows: 10, cols: 80, colors: ['#ffffff', ctx.car.color, '#d4af37', '#888888'], seed: 8 });
  grand.position.set(0, 0, 18);
  scene.add(grand);
  const me = makeCar({ ...ctx.car, helmet: ctx.helmet });
  me.position.set(0, 0, 0);
  me.rotation.y = 0.35;
  scene.add(me);
  // The trophy rises on a plinth behind the car.
  const plinth = new THREE.Group();
  const block = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 2, 32), mat('#15161c', { metal: 0.4, rough: 0.3 }));
  block.position.y = 1;
  plinth.add(block);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.06, 6, 48), glowMat('#ffd76a'));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2;
  plinth.add(ring);
  const cup = trophy(3);
  cup.position.y = 2;
  plinth.add(cup);
  plinth.position.set(-4, -9, -9);
  scene.add(plinth);
  const spot = new THREE.SpotLight('#fff1c9', 900, 70, 0.4, 0.5, 1.4);
  spot.position.set(-4, 26, -2);
  spot.target.position.set(-4, 3, -9);
  scene.add(spot, spot.target);
  for (const x of [-30, 30]) {
    const flood = new THREE.PointLight('#cfdcff', 300, 90, 1.4);
    flood.position.set(x, 18, 8);
    scene.add(flood);
  }
  // Search-light beams sweeping the sky.
  const beams = [-1, 1, -0.5, 0.5].map((s, i) => {
    const b = new THREE.Mesh(new THREE.ConeGeometry(3, 90, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    b.geometry.translate(0, -45, 0);
    const holder = new THREE.Group();
    holder.position.set(s * 30, 0, -30 - i * 4);
    b.rotation.x = Math.PI;
    holder.add(b);
    scene.add(holder);
    return { holder, s, i };
  });
  const fw = makeFireworks(scene, { size: 2 });
  const cols = ['#ffd76a', ctx.car.color, '#ffffff', ctx.car.accent, '#b05cff'];
  for (let i = 0; i < 16; i++) fw.launch(1 + i * 0.42, [-40 + ((i * 29) % 80), 20 + ((i * 13) % 12), -60 - ((i * 7) % 30)], cols[i % cols.length]);
  const confetti = makeFalling(scene, { count: 700, colors: ['#d4af37', '#f5e6a8', '#ffffff', ctx.car.color], center: [-2, 14, -2], area: [14, 4, 10], start: 2.6, speed: 2.6, size: [0.22, 0.12] });
  return {
    duration: 8.4,
    capAt: 2.6,
    cues: [[0.3, 'title']],
    update(t, dt) {
      plinth.position.y = lerp(-9, 0, easeOut(seg(t, 0.6, 2.6)));
      cup.rotation.y = t * 0.6;
      ring.material.opacity = 1;
      beams.forEach(({ holder, s, i }) => {
        holder.rotation.z = s * 0.35 + Math.sin(t * 0.8 + i) * 0.35;
        holder.rotation.x = -0.25 + Math.cos(t * 0.6 + i) * 0.15;
      });
      grand.userData.update(t, 1);
      fw.update(t, dt);
      confetti.update(t);
      const a = lerp(-0.9, 0.7, smooth(seg(t, 0, 8.4)));
      const r = lerp(19, 15, smooth(seg(t, 0, 8.4)));
      camera.position.set(Math.sin(a) * r - 2, lerp(4.5, 2.6, seg(t, 0, 8.4)), Math.cos(a) * r - 4);
      camera.lookAt(-2.5, lerp(3, 7, seg(t, 0.6, 3)), -6);
    },
  };
}

// ------------------------------------------------------------------ the proposal, on a beach after the race

function palm(height = 9, lean = 0.25, seed = 1) {
  const g = new THREE.Group();
  const r = rand(seed);
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    pts.push(new THREE.Vector3(Math.sin(u * 1.4) * lean * height, u * height, 0));
  }
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.28, 7, false), mat('#7a5a3c', { rough: 1, flat: true }));
  g.add(trunk);
  const top = pts[pts.length - 1];
  for (let k = 0; k < 8; k++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4.2, 4, 1), mat(k % 2 ? '#2f6b34' : '#3d7f3c', { rough: 0.9, flat: true }));
    leaf.geometry.translate(0, 2.1, 0);
    leaf.scale.z = 0.25;
    const holder = new THREE.Group();
    holder.position.copy(top);
    holder.rotation.y = (k / 8) * Math.PI * 2 + r();
    leaf.rotation.z = -1.15 - r() * 0.3;
    holder.add(leaf);
    g.add(holder);
  }
  return g;
}

export function proposal({ scene, camera }, ctx) {
  sky(scene, { top: '#30416e', mid: '#f59a6c', bottom: '#f7c08c', sun: [0, 0.03, -1], sunColor: '#ffb070', fog: ['#e8a07c', 60, 600] });
  lights(scene, { sky: '#ffc9a0', ground: '#7a5a40', amb: 1.2, sun: '#ffb27a', sunI: 2, sunPos: [0, 10, -60] });
  const sea = makeWater('#3b4f7a', 2000, 0.95);
  sea.position.y = -0.05;
  scene.add(sea);
  const sunDisc = halo('#ffd08a', 70, 0.9);
  sunDisc.position.set(0, 8, -600);
  scene.add(sunDisc);
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(14, 400), new THREE.MeshBasicMaterial({ color: '#ffc27a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glint.rotation.x = -Math.PI / 2;
  glint.position.set(0, 0.02, -260);
  scene.add(glint);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), mat('#e3c494', { rough: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.04, 26);
  scene.add(sand);
  const p1 = palm(9, 0.3, 2);
  p1.position.set(-7, 0, 6);
  const p2 = palm(11, -0.25, 5);
  p2.position.set(9, 0, 12);
  p2.rotation.y = Math.PI;
  scene.add(p1, p2);

  const me = makeFigure({ suit: ctx.car.color, cap: ctx.helmet.c1 });
  me.position.set(0.9, 0, 0);
  me.rotation.y = Math.PI;
  const love = makeFigure({ suit: '#f3efe6', head: '#e9dccb', hair: '#3a2a1e' });
  love.position.set(-0.9, 0, 0);
  scene.add(me, love);
  const box = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), mat('#7a1020', { rough: 0.5 }));
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), mat('#7a1020', { rough: 0.5 }));
  lid.geometry.translate(0, 0.03, -0.11);
  lid.position.set(0, 0.06, 0.11);
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 20), gold());
  ringM.position.y = 0.1;
  const sparkle = halo('#ffffff', 0.01, 0.95);
  sparkle.position.y = 0.2;
  box.add(base, lid, ringM, sparkle);
  box.visible = false;
  scene.add(box);
  // The mechanics hiding behind a palm tree.
  const crew = [0, 1, 2].map((i) => {
    const f = makeFigure({ suit: ctx.car.color, cap: ctx.car.accent });
    f.position.set(-7.6 - i * 0.2, 0, 7.2 + i * 0.7);
    f.rotation.y = -Math.PI / 2 + 0.4;
    scene.add(f);
    return f;
  });
  const hearts = makeFalling(scene, { count: 150, colors: ['#ff7a96', '#ffffff', '#ffc2d1', '#ffd36b'], center: [0, 3.6, 1], area: [5, 1.2, 3], start: 4.4, speed: 0.9, shape: 'petal', size: [0.2, 0.2], unlit: true });
  const cam = cameraPath(camera, [
    { t: 0, pos: [0, 4, 22], look: [0, 3, -40], fov: 40 },
    { t: 2.2, pos: [3.5, 1.6, 6], look: [0, 1.2, 0], fov: 36 },
    { t: 4.6, pos: [4.2, 1.2, 3.4], look: [-0.3, 1.0, 0], fov: 32 },
    { t: 8.5, pos: [-2, 3, 14], look: [-2, 1.5, 0], fov: 40 },
  ]);
  return {
    duration: 8.5,
    capAt: 4.8,
    cues: [[3.0, 'ok'], [4.6, 'win']],
    update(t, dt) {
      // Down on one knee, the box comes out and opens.
      const kneel = smooth(seg(t, 1.4, 2.4));
      me.position.y = -kneel * 0.45;
      me.rotation.z = kneel * 0.08;
      me.userData.arms[0].rotation.z = -kneel * 1.2;
      box.visible = t > 2.2;
      box.position.set(0.55, 1.05 - kneel * 0.45, 0);
      lid.rotation.x = -easeOut(seg(t, 2.8, 3.2)) * 1.9;
      sparkle.scale.setScalar(t > 3 ? 0.9 + Math.sin(t * 9) * 0.3 : 0.01);
      // Hands to the face, then yes.
      const yes = smooth(seg(t, 3.6, 4.2));
      love.userData.arms.forEach((a, i) => (a.rotation.x = -yes * 2.5 + (t > 4.6 ? Math.sin(t * 8 + i) * 0.2 : 0)));
      love.position.y = t > 4.6 ? Math.max(0, Math.sin((t - 4.6) * 7)) * 0.25 : 0;
      // The crew pops out and cheers.
      crew.forEach((f, i) => {
        const out = smooth(seg(t, 3.9 + i * 0.12, 4.4 + i * 0.12));
        f.position.x = -7.6 - i * 0.2 + out * (2.4 + i * 0.6);
        f.position.y = t > 4.6 ? Math.max(0, Math.sin((t - 4.6) * 8 + i)) * 0.4 : 0;
        f.userData.arms.forEach((a) => (a.rotation.x = -out * 2.8));
      });
      hearts.update(t);
      cam(t);
    },
  };
}

// ------------------------------------------------------------------ the baby: a nursery at night

export function baby({ scene, camera }, ctx) {
  scene.background = new THREE.Color('#0d0f18');
  scene.add(new THREE.HemisphereLight('#6f7fb8', '#2a2018', 0.5));
  const lamp = new THREE.PointLight('#ffc98a', 40, 30, 1.6);
  lamp.position.set(-3.5, 3.2, -1.5);
  scene.add(lamp);
  const moonLight = new THREE.DirectionalLight('#9fb4ff', 0.6);
  moonLight.position.set(2, 6, -8);
  scene.add(moonLight);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: canvasTexture(256, 256, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#8a6544' : '#7d5a3b';
      g.fillRect(0, i * 32, w, 32);
    }
  }), roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const wallM = mat('#cfd8e8', { rough: 0.95 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), wallM);
  back.position.set(0, 4, -5);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), wallM);
  left.rotation.y = Math.PI / 2;
  left.position.set(-6, 4, 0);
  scene.add(back, left);
  // A window with the moon and stars.
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.4), new THREE.MeshBasicMaterial({ map: canvasTexture(256, 200, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0b1433');
    gr.addColorStop(1, '#22306a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) g.fillRect((i * 97) % w, (i * 53) % (h * 0.8), 2, 2);
    g.fillStyle = '#fff6d8';
    g.beginPath();
    g.arc(w * 0.7, h * 0.3, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#22306a';
    g.beginPath();
    g.arc(w * 0.7 + 12, h * 0.3 - 6, 22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#f2f2f2';
    g.lineWidth = 8;
    g.strokeRect(0, 0, w, h);
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.lineTo(w / 2, h);
    g.stroke();
  }) }));
  win.position.set(1.8, 4.4, -4.98);
  scene.add(win);
  // The crib.
  const wood = mat('#f2efe8', { rough: 0.7 });
  const crib = new THREE.Group();
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 1.4), mat('#ffffff', { rough: 0.9 }));
  mattress.position.y = 0.9;
  crib.add(mattress);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 1.3), mat(ctx.car.color, { rough: 0.9 }));
  blanket.position.set(-0.5, 1.1, 0);
  crib.add(blanket);
  for (const z of [-0.72, 0.72]) {
    for (let i = 0; i <= 12; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), wood);
      bar.position.set(-1.3 + i * (2.6 / 12), 1.3, z);
      crib.add(bar);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.08, 0.08), wood);
    rail.position.set(0, 1.76, z);
    crib.add(rail);
  }
  for (const x of [-1.35, 1.35]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 1.5), wood);
    end.position.set(x, 0.95, 0);
    crib.add(end);
  }
  crib.position.set(0, 0, -2.6);
  scene.add(crib);
  // The mobile: tiny race cars in the team's colours.
  const mobile = new THREE.Group();
  mobile.position.set(0, 3.5, -2.6);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), wood);
  arm.position.set(0, 0.8, 0);
  mobile.add(arm);
  const spinner = new THREE.Group();
  mobile.add(spinner);
  const tiny = [ctx.car, ...ctx.rivals.slice(0, 3)];
  tiny.forEach((c, i) => {
    const a = (i / tiny.length) * Math.PI * 2;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 4), mat('#ffffff'));
    string.position.set(Math.cos(a) * 0.7, -0.3, Math.sin(a) * 0.7);
    spinner.add(string);
    const car = makeCar({ ...c, helmet: ctx.helmet });
    car.scale.setScalar(0.11);
    car.position.set(Math.cos(a) * 0.7, -0.68, Math.sin(a) * 0.7);
    car.rotation.y = -a + Math.PI / 2;
    car.userData.shadow.visible = false;
    spinner.add(car);
  });
  const star = halo('#ffe9a8', 0.5, 0.9);
  star.position.y = 0.05;
  spinner.add(star);
  scene.add(mobile);
  // A shelf with the tiny helmet and race boots.
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), wood);
  shelf.position.set(-3.2, 2.6, -4.7);
  scene.add(shelf);
  const helmet = makeFigure({ suit: '#000', helmet: ctx.helmet }).userData.head;
  helmet.scale.setScalar(1.1);
  helmet.position.set(-3.6, 2.92, -4.6);
  scene.add(helmet);
  for (const x of [-2.75, -2.45]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.34), mat(ctx.car.color, { rough: 0.6 }));
    boot.position.set(x, 2.74, -4.62);
    scene.add(boot);
  }
  const lampMesh = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.5, 20, 1, true), mat('#ffe6c2', { emissive: '#ffb366', glow: 1.2, side: THREE.DoubleSide }));
  lampMesh.position.copy(lamp.position);
  scene.add(lampMesh);
  // A night light throwing stars on the walls.
  const dots = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const s = halo('#ffe9a8', 0.16 + (i % 3) * 0.06, 0.6);
    s.position.set(-5.9, 2.5 + Math.sin(i * 1.7) * 2.2, -4 + (i * 0.37) % 8);
    dots.add(s);
  }
  scene.add(dots);
  const cam = cameraPath(camera, [
    { t: 0, pos: [3.5, 3.4, 6], look: [0, 2.4, -2.6], fov: 42 },
    { t: 7.5, pos: [1.2, 2.9, 1.2], look: [0, 2.9, -2.6], fov: 34 },
  ]);
  return {
    duration: 7.5,
    capAt: 3.4,
    cues: [[0.6, 'ok']],
    update(t) {
      spinner.rotation.y = t * 0.5;
      lamp.intensity = 38 + Math.sin(t * 2) * 2;
      dots.children.forEach((d, i) => (d.material.opacity = 0.35 + Math.sin(t * 1.5 + i) * 0.25));
      cam(t);
    },
  };
}

// ------------------------------------------------------------------ retirement: the last evening in the pit lane

export function retire({ scene, camera }, ctx) {
  sky(scene, { top: '#2b3a66', mid: '#f08a5d', bottom: '#5b3b44', sun: [-1, 0.05, 0.2], sunColor: '#ff9a5a', fog: ['#b0705c', 60, 400] });
  lights(scene, { sky: '#ffbe8a', ground: '#2d2420', amb: 1, sun: '#ff9d63', sunI: 2.6, sunPos: [-60, 8, 20] });
  ground(scene, '#3a3a3e');
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(400, 14), mat('#4a4b52', { rough: 0.9 }));
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.01, 2);
  scene.add(lane);
  // The pit building with a row of garages whose lights go out one by one.
  const building = new THREE.Mesh(new THREE.BoxGeometry(120, 9, 8), mat('#d9d9de', { rough: 0.8 }));
  building.position.set(0, 4.5, -9);
  scene.add(building);
  const garages = [];
  for (let i = -5; i <= 5; i++) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshStandardMaterial({ color: '#1b1c20', emissive: '#ffd9a0', emissiveIntensity: 0.55 }));
    door.position.set(i * 9, 2.5, -4.98);
    scene.add(door);
    garages.push({ door, off: 3.2 + Math.abs(i) * 0.0 + (5 - i) * 0.32 });
  }
  const mine = garages[5].door;
  mine.material.emissive.set(ctx.car.color).lerp(new THREE.Color('#ffffff'), 0.5);
  const me = makeCar({ ...ctx.car, helmet: ctx.helmet });
  me.position.set(0, 0, 1.2);
  me.rotation.y = -0.25;
  scene.add(me);
  // The helmet comes off and goes on the nose of the car.
  me.userData.helmet.visible = false;
  me.updateMatrixWorld();
  const nose = me.localToWorld(new THREE.Vector3(2.1, 0.66, 0));
  const lid = makeFigure({ suit: '#000', helmet: ctx.helmet }).userData.head;
  lid.scale.setScalar(0.85);
  scene.add(lid);
  const driver = makeFigure({ suit: ctx.car.color, head: '#e9dccb', hair: '#2a1d14' });
  scene.add(driver);
  const cam = cameraPath(camera, [
    { t: 0, pos: [12, 2, 10], look: [-8, 2.4, -1], fov: 40 },
    { t: 8, pos: [20, 6.5, 19], look: [-14, 4, -4], fov: 46 },
  ]);
  return {
    duration: 8,
    capAt: 4.2,
    cues: [],
    update(t) {
      // Walk to the nose, put the helmet down, walk away into the sunset.
      const place = smooth(seg(t, 0.6, 2.2));
      const leave = seg(t, 2.6, 8);
      driver.position.set(lerp(4, 3.5, place) + leave * 10, 0, lerp(2.6, 2.4, place) + leave * 6);
      driver.rotation.y = leave > 0 ? -0.6 : Math.PI * 0.85;
      driver.position.y = leave > 0 ? Math.abs(Math.sin(t * 7)) * 0.06 : 0;
      driver.userData.arms[0].rotation.z = place < 1 ? -0.6 : 0;
      lid.position.lerpVectors(new THREE.Vector3(driver.position.x - 0.5, 1.2, driver.position.z - 0.2), nose, place);
      if (place >= 1) lid.position.copy(nose);
      lid.rotation.y = -0.25;
      garages.forEach((g) => {
        const k = clamp((t - g.off) / 0.25);
        g.door.material.emissiveIntensity = lerp(0.55, 0.02, easeIn(k));
      });
      mine.material.emissiveIntensity = t < 6.8 ? 1 : lerp(1, 0.02, seg(t, 6.8, 7.4));
      cam(t);
    },
  };
}
