// Building blocks for the cutscenes: a renderer, skies, camera moves and a small
// set of low-poly props (cars, people, crowds, cities) plus particle effects.
// Everything is made in code, so there are no model or texture files to load.
import * as THREE from '../vendor/three.module.min.js';

export { THREE };

// ------------------------------------------------------------------ maths

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = (u) => u * u * (3 - 2 * u);
export const easeOut = (u) => 1 - (1 - u) ** 3;
export const easeIn = (u) => u * u * u;
// Progress 0..1 of t through the window [a, b].
export const seg = (t, a, b) => clamp((t - a) / (b - a));

// A seeded random, so a scene looks the same every time it plays.
export function rand(seed = 1) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

// Camera path: keys [{ t, pos: [x, y, z], look: [x, y, z], fov }], eased between keys.
export function cameraPath(camera, keys) {
  const p = new THREE.Vector3();
  const l = new THREE.Vector3();
  return (t) => {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i];
    const b = keys[Math.min(i + 1, keys.length - 1)];
    const u = a === b ? 1 : smooth(seg(t, a.t, b.t));
    p.set(lerp(a.pos[0], b.pos[0], u), lerp(a.pos[1], b.pos[1], u), lerp(a.pos[2], b.pos[2], u));
    l.set(lerp(a.look[0], b.look[0], u), lerp(a.look[1], b.look[1], u), lerp(a.look[2], b.look[2], u));
    camera.position.copy(p);
    camera.lookAt(l);
    const fov = lerp(a.fov ?? 40, b.fov ?? 40, u);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  };
}

// ------------------------------------------------------------------ stage

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const small = Math.min(innerWidth, innerHeight) < 600;
  renderer.setPixelRatio(Math.min(small ? 1.5 : 2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);
  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep a sensible field of view on tall phone screens.
    camera.zoom = camera.aspect < 0.8 ? camera.aspect / 0.8 : 1;
    camera.updateProjectionMatrix();
  };
  resize();
  const dispose = () => {
    scene.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of ['map', 'emissiveMap', 'alphaMap']) m[k]?.dispose();
        m.dispose();
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
  };
  return { renderer, scene, camera, resize, dispose };
}

// A gradient dome, with an optional sun glow and stars.
export function sky(scene, { top, mid, bottom, sun, sunColor = '#ffd9a0', stars = 0, fog }) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      mid: { value: new THREE.Color(mid ?? top) },
      bottom: { value: new THREE.Color(bottom) },
      sunDir: { value: new THREE.Vector3(...(sun || [0, -1, 0])).normalize() },
      sunCol: { value: new THREE.Color(sunColor) },
      sunOn: { value: sun ? 1 : 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunOn; varying vec3 vDir;
      void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.6)) : mix(mid, bottom, pow(-h, 0.5));
      float s = max(dot(vDir, sunDir), 0.0); c += sunOn * sunCol * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.35);
      gl_FragColor = vec4(c, 1.0); }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), mat);
  dome.renderOrder = -1;
  scene.add(dome);
  if (fog) scene.fog = new THREE.Fog(fog[0], fog[1], fog[2]);
  if (stars) {
    const r = rand(7);
    const pos = [];
    for (let i = 0; i < stars; i++) {
      const th = r() * Math.PI * 2;
      const ph = Math.acos(lerp(0.15, 1, r()));
      pos.push(Math.cos(th) * Math.sin(ph) * 1300, Math.cos(ph) * 1300, Math.sin(th) * Math.sin(ph) * 1300);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
  }
  return dome;
}

export function lights(scene, { sky: skyC = '#9ec5ff', ground = '#3a2f28', amb = 1, sun = '#ffffff', sunI = 2, sunPos = [30, 50, 20] } = {}) {
  scene.add(new THREE.HemisphereLight(skyC, ground, amb));
  const d = new THREE.DirectionalLight(sun, sunI);
  d.position.set(...sunPos);
  scene.add(d);
  return d;
}

// ------------------------------------------------------------------ materials and textures

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0.1, emissive: o.emissive ?? '#000000', emissiveIntensity: o.glow ?? 1, flatShading: o.flat ?? false, side: o.side ?? THREE.FrontSide, transparent: o.opacity != null, opacity: o.opacity ?? 1 });
export const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, fog: false });

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A soft round dot, for glows and particles.
let dotTex = null;
export function dot() {
  if (!dotTex) {
    dotTex = canvasTexture(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.25, 'rgba(255,255,255,.85)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
    });
  }
  return dotTex;
}

// A glowing halo sprite.
export function halo(color, size, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.set(size, size, 1);
  return s;
}

// Lit windows for night-time buildings.
export function windowsTexture(seed, { lit = 0.45, warm = '#ffd58a', cool = '#bfe3ff', cols = 8, rows = 24 } = {}) {
  const r = rand(seed);
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#0d1017';
    g.fillRect(0, 0, w, h);
    const cw = w / cols;
    const rh = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (r() > lit) continue;
        g.fillStyle = r() < 0.7 ? warm : cool;
        g.globalAlpha = 0.55 + r() * 0.45;
        g.fillRect(x * cw + 2, y * rh + 2, cw - 4, rh - 4);
      }
    }
    g.globalAlpha = 1;
  });
}

// Words on a neon sign.
export function neonSign(text, color, { w = 3, h = 1.2, vertical = false } = {}) {
  const tex = canvasTexture(vertical ? 128 : 256, vertical ? 320 : 112, (g, cw, ch) => {
    g.fillStyle = '#0a0a10';
    g.fillRect(0, 0, cw, ch);
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.shadowColor = color;
    g.shadowBlur = 18;
    g.strokeRect(8, 8, cw - 16, ch - 16);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const font = (px) => `900 ${px}px "Noto Sans CJK TC", "Noto Sans JP", "Noto Sans KR", "Microsoft JhengHei", "Malgun Gothic", "Yu Gothic", sans-serif`;
    if (vertical) {
      const chars = [...text];
      const px = Math.min(92, (ch - 40) / chars.length);
      g.font = font(px);
      chars.forEach((c, i) => {
        g.shadowBlur = 22;
        g.fillText(c, cw / 2, 24 + px / 2 + i * px);
      });
    } else {
      g.font = font(Math.min(70, (cw - 40) / Math.max(2, [...text].length) * 1.1));
      g.shadowBlur = 22;
      g.fillText(text, cw / 2, ch / 2 + 2);
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? h : w, vertical ? w : h), new THREE.MeshBasicMaterial({ map: tex, fog: false, side: THREE.DoubleSide }));
  m.userData.flicker = Math.random() * 10;
  return m;
}

// ------------------------------------------------------------------ props

// A Formula 1 car pointing along +x, about 5 units long, wheels on y = 0.
export function makeCar({ color = '#e10600', accent = '#ffffff', helmet = { c1: '#f2f2f2', c2: '#e8002d' } } = {}) {
  const g = new THREE.Group();
  const body = mat(color, { rough: 0.35, metal: 0.35 });
  const trim = mat(accent, { rough: 0.4, metal: 0.2 });
  const carbon = mat('#15161b', { rough: 0.5, metal: 0.3 });
  const rubber = mat('#0c0c0e', { rough: 0.9 });

  const side = new THREE.Shape();
  [[-2.2, 0.22], [-2.2, 0.62], [-1.4, 0.74], [-0.7, 1.12], [-0.3, 1.12], [-0.05, 0.84], [0.9, 0.76], [2.65, 0.4], [2.65, 0.22]].forEach(([x, y], i) => (i ? side.lineTo(x, y) : side.moveTo(x, y)));
  const tubGeo = new THREE.ExtrudeGeometry(side, { depth: 0.72, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
  tubGeo.translate(0, 0, -0.36);
  g.add(new THREE.Mesh(tubGeo, body));
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.07, 1.55), carbon);
  floor.position.set(-0.1, 0.2, 0);
  g.add(floor);
  for (const z of [-0.56, 0.56]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 0.42), body);
    pod.position.set(-0.55, 0.45, z);
    g.add(pod);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.07, 0.43), trim);
    stripe.position.set(-0.55, 0.6, z);
    g.add(stripe);
    const inlet = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.36), carbon);
    inlet.position.set(0.42, 0.46, z);
    g.add(inlet);
  }
  // Front wing with endplates, rear wing on its pylon.
  const fw = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 2.05), trim);
  fw.position.set(2.55, 0.17, 0);
  g.add(fw);
  const fw2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 1.95), body);
  fw2.position.set(2.42, 0.25, 0);
  fw2.rotation.z = 0.12;
  g.add(fw2);
  for (const z of [-1.03, 1.03]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 0.04), carbon);
    ep.position.set(2.5, 0.25, z);
    g.add(ep);
  }
  const rw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 1.45), trim);
  rw.position.set(-2.3, 1.08, 0);
  g.add(rw);
  const rw2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 1.45), body);
  rw2.position.set(-2.18, 1.2, 0);
  rw2.rotation.z = -0.35;
  g.add(rw2);
  for (const z of [-0.74, 0.74]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.62, 0.04), body);
    ep.position.set(-2.3, 0.92, z);
    g.add(ep);
  }
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.08), carbon);
  pylon.position.set(-2.15, 0.82, 0);
  g.add(pylon);
  // Wheels.
  const wheels = [];
  for (const [x, r, w] of [[1.62, 0.34, 0.36], [-1.6, 0.38, 0.44]]) {
    for (const z of [-0.98, 0.98]) {
      const wg = new THREE.Group();
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22), rubber);
      tyre.rotation.x = Math.PI / 2;
      wg.add(tyre);
      const wall = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, 0.025, 4, 22), mat('#f2c230', { rough: 0.6 }));
      wall.position.z = (w / 2 + 0.002) * Math.sign(z);
      wg.add(wall);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.02, 10), mat('#2a2b31', { metal: 0.7, rough: 0.35 }));
      hub.rotation.x = Math.PI / 2;
      wg.add(hub);
      wg.position.set(x, r, z);
      g.add(wg);
      wheels.push(wg);
    }
  }
  // Halo and driver.
  const haloArc = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 18, Math.PI), carbon);
  haloArc.rotation.z = -Math.PI / 2;
  const haloG = new THREE.Group();
  haloG.add(haloArc);
  haloG.rotation.x = -Math.PI / 2;
  haloG.position.set(0.05, 1.0, 0);
  g.add(haloG);
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), carbon);
  pillar.position.set(0.4, 0.9, 0);
  g.add(pillar);
  const head = makeHelmet(helmet, 0.2);
  head.position.set(-0.1, 0.98, 0);
  g.add(head);
  // A soft shadow underneath.
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.6), new THREE.MeshBasicMaterial({ map: dot(), color: '#000000', transparent: true, opacity: 0.55, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);
  g.userData.wheels = wheels;
  g.userData.helmet = head;
  g.userData.shadow = shadow;
  g.userData.spin = (dist) => wheels.forEach((w) => (w.rotation.z = -dist / 0.36));
  return g;
}

export function makeHelmet({ c1 = '#f2f2f2', c2 = '#e8002d' } = {}, r = 0.22) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(c1, { rough: 0.25, metal: 0.2 })));
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, r * 0.16, 6, 24, Math.PI * 1.15), mat(c2, { rough: 0.3 }));
  stripe.rotation.y = Math.PI / 2;
  stripe.rotation.z = -0.1;
  g.add(stripe);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 16, 8, -0.9, 1.8, 1.15, 0.55), mat('#0b1220', { rough: 0.1, metal: 0.8 }));
  g.add(visor);
  return g;
}

// A toy-like figure, about 1.9 units tall: suit colour, and a helmet, a cap or a bare head.
export function makeFigure({ suit = '#e10600', helmet = null, cap = null, hair = null, head = '#e9dccb', scale = 1 } = {}) {
  const g = new THREE.Group();
  const suitM = mat(suit, { rough: 0.7 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.62, 4, 10), suitM);
  torso.position.y = 1.05;
  g.add(torso);
  for (const z of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 8), suitM);
    leg.position.set(0, 0.36, z);
    g.add(leg);
  }
  const arms = [];
  for (const z of [-0.36, 0.36]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 1.38, z);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), suitM);
    arm.position.y = -0.3;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(helmet ? '#202024' : head, { rough: 0.8 }));
    hand.position.y = -0.62;
    pivot.add(hand);
    g.add(pivot);
    arms.push(pivot);
  }
  let top;
  if (helmet) {
    top = makeHelmet(helmet, 0.25);
    top.rotation.y = 0;
  } else {
    top = new THREE.Group();
    top.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mat(head, { rough: 0.85 })));
    if (hair && !cap) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.9), mat(hair, { rough: 0.9 }));
      h.rotation.z = 0.35;
      top.add(h);
    }
    if (cap) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(cap, { rough: 0.7 }));
      top.add(c);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16, 1, false, -Math.PI / 2, Math.PI), mat(cap, { rough: 0.7 }));
      brim.position.set(0.12, 0.06, 0);
      top.add(brim);
    }
  }
  top.position.y = 1.7;
  g.add(top);
  g.scale.setScalar(scale);
  g.userData.arms = arms;
  g.userData.head = top;
  return g;
}

// A grandstand of people as one instanced mesh. Each person bounces on its own phase.
// `colors` are clothes/flag colours; `rows` x `cols` people, facing -z by default.
export function makeCrowd({ rows = 8, cols = 40, colors = ['#e10600', '#ffffff', '#1d3b8b'], spacing = 0.7, rise = 0.55, seed = 3, flags = 0.25, flagColors = null }) {
  const g = new THREE.Group();
  const r = rand(seed);
  const n = rows * cols;
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.32, 3, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
  const fl = flagColors || colors;
  const flagN = Math.round(n * flags);
  const flagMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.55, 0.36), new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), Math.max(1, flagN));
  const people = [];
  const c = new THREE.Color();
  const hairs = ['#2a1d14', '#1b1b1b', '#3d2a1a', '#6b4a2b', '#c9a46a'];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const p = { x: (col - cols / 2) * spacing + (r() - 0.5) * 0.2, y: row * rise, z: row * spacing * 1.1, ph: r() * Math.PI * 2, sp: 4 + r() * 4 };
      people.push(p);
      body.setColorAt(i, c.set(colors[Math.floor(r() * colors.length)]));
      heads.setColorAt(i, c.set(hairs[Math.floor(r() * hairs.length)]));
    }
  }
  const flaggers = people.map((p, i) => i).sort(() => r() - 0.5).slice(0, flagN);
  flaggers.forEach((idx, k) => flagMesh.setColorAt(k, c.set(fl[k % fl.length])));
  // Tiers to stand on.
  const tierMat = mat('#3b3f48', { rough: 0.9 });
  for (let row = 0; row < rows; row++) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(cols * spacing + 2, 0.3, spacing * 1.1), tierMat);
    tier.position.set(0, row * rise - 0.15, row * spacing * 1.1);
    g.add(tier);
  }
  g.add(body, heads, flagMesh);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();
  // energy 0..1: how wildly they jump. beat: optional shared rhythm instead of each on their own.
  g.userData.update = (t, energy = 0.6, beat = null) => {
    people.forEach((p, i) => {
      const b = beat != null ? beat : Math.max(0, Math.sin(t * p.sp + p.ph));
      const y = p.y + 0.36 + b * 0.22 * energy;
      m.compose(v.set(p.x, y, p.z), q.identity(), one);
      body.setMatrixAt(i, m);
      m.compose(v.set(p.x, y + 0.42, p.z), q.identity(), one);
      heads.setMatrixAt(i, m);
    });
    flaggers.forEach((idx, k) => {
      const p = people[idx];
      const b = beat != null ? beat : Math.max(0, Math.sin(t * p.sp + p.ph));
      e.set(0, Math.sin(t * 3 + p.ph) * 0.5, Math.sin(t * 5 + p.ph) * 0.4 * energy);
      q.setFromEuler(e);
      m.compose(v.set(p.x + 0.25, p.y + 1.25 + b * 0.22 * energy, p.z - 0.05), q, one);
      flagMesh.setMatrixAt(k, m);
    });
    body.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    flagMesh.instanceMatrix.needsUpdate = true;
  };
  g.userData.update(0);
  return g;
}

// Night-time buildings in a row along x. Returns the group; `heights` [min, max].
export function makeSkyline({ count = 30, width = 160, depth = 20, heights = [8, 40], seed = 11, base = '#141824', lit = 0.45, warm, cool } = {}) {
  const g = new THREE.Group();
  const r = rand(seed);
  const mats = [0, 1, 2, 3].map((k) => new THREE.MeshLambertMaterial({ color: base, emissive: '#ffffff', emissiveMap: windowsTexture(seed * 7 + k, { lit, warm, cool }), emissiveIntensity: 1 }));
  for (let i = 0; i < count; i++) {
    const w = 3 + r() * 6;
    const d = 3 + r() * 6;
    const h = lerp(heights[0], heights[1], r() ** 1.6);
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.max(1, w / 4), uv.getY(k) * Math.max(1, h / 12));
    const b = new THREE.Mesh(geo, mats[i % 4]);
    mats[i % 4].emissiveMap.wrapS = mats[i % 4].emissiveMap.wrapT = THREE.RepeatWrapping;
    b.position.set(-width / 2 + (i + r() * 0.8) * (width / count), h / 2, -r() * depth);
    g.add(b);
  }
  return g;
}

// Hills as dark low-poly cones.
export function makeHills({ count = 6, width = 400, z = -200, heights = [40, 110], color = '#10151f', seed = 5 }) {
  const g = new THREE.Group();
  const r = rand(seed);
  const m = mat(color, { rough: 1, flat: true });
  for (let i = 0; i < count; i++) {
    const h = lerp(heights[0], heights[1], r());
    const cone = new THREE.Mesh(new THREE.ConeGeometry(h * (1.4 + r()), h, 7 + Math.floor(r() * 4)), m);
    cone.position.set(-width / 2 + (i + r()) * (width / count), h / 2 - 2, z - r() * 60);
    cone.rotation.y = r() * 3;
    g.add(cone);
  }
  return g;
}

// Water: a translucent plane. Put mirrored copies of lit things underneath it for reflections.
export function makeWater(color = '#0b1830', size = 1200, opacity = 0.82) {
  const w = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.5, transparent: true, opacity }));
  w.rotation.x = -Math.PI / 2;
  return w;
}

export function mirror(obj, opacity = 0.35) {
  const m = obj.clone(true);
  m.scale.y *= -1;
  m.traverse((o) => {
    if (!o.material) return;
    o.material = (Array.isArray(o.material) ? o.material : [o.material]).map((x) => {
      const c = x.clone();
      c.transparent = true;
      c.opacity = (x.opacity ?? 1) * opacity;
      c.depthWrite = false;
      c.side = THREE.DoubleSide;
      return c;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  return m;
}

// A plain track: a tarmac ribbon along x with kerbs and white lines.
export function makeTrack({ length = 400, width = 14, z = 0, color = '#2b2d33', kerb = ['#d01818', '#f4f4f4'] } = {}) {
  const g = new THREE.Group();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(length, width), mat(color, { rough: 0.95 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, z);
  g.add(road);
  const kerbTex = canvasTexture(64, 16, (c, w, h) => {
    c.fillStyle = kerb[0];
    c.fillRect(0, 0, w / 2, h);
    c.fillStyle = kerb[1];
    c.fillRect(w / 2, 0, w / 2, h);
  });
  kerbTex.wrapS = THREE.RepeatWrapping;
  kerbTex.repeat.set(length / 3, 1);
  for (const s of [-1, 1]) {
    const k = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.9), new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.8 }));
    k.rotation.x = -Math.PI / 2;
    k.position.set(0, 0.02, z + s * (width / 2 + 0.45));
    g.add(k);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.18), mat('#e8e8e8', { rough: 0.9 }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.025, z + s * (width / 2 - 0.4));
    g.add(line);
  }
  return g;
}

export function ground(scene, color = '#2f4a2a', size = 2000) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat(color, { rough: 1 }));
  g.rotation.x = -Math.PI / 2;
  scene.add(g);
  return g;
}

// ------------------------------------------------------------------ particles

// Fireworks. launch(at, pos, colour) schedules a burst at time `at` (seconds).
export function makeFireworks(scene, { size = 1.6, count = 140 } = {}) {
  const bursts = [];
  const queue = [];
  const tmpC = new THREE.Color();
  const spawn = (pos, color) => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const vel = [];
    const col = new Float32Array(count * 3);
    const c2 = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = 9 + Math.random() * 4;
      vel.push([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp]);
      p.set([pos[0], pos[1], pos[2]], i * 3);
      tmpC.copy(c2).lerp(new THREE.Color('#ffffff'), Math.random() * 0.35);
      col.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size, map: dot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pts = new THREE.Points(g, m);
    scene.add(pts);
    const glow = new THREE.PointLight(color, 40, 80, 1.6);
    glow.position.set(...pos);
    scene.add(glow);
    bursts.push({ pts, vel, age: 0, glow });
  };
  // A rising trail before the burst.
  const trails = [];
  return {
    launch(at, pos, color) {
      queue.push({ at, pos, color });
    },
    update(t, dt) {
      for (let i = queue.length - 1; i >= 0; i--) {
        const q = queue[i];
        if (t >= q.at - 0.6 && !q.trail) {
          const s = halo(q.color, 1.2, 0.9);
          s.position.set(q.pos[0], q.pos[1] - 18, q.pos[2]);
          scene.add(s);
          q.trail = s;
          trails.push(q);
        }
        if (t >= q.at) {
          spawn(q.pos, q.color);
          if (q.trail) scene.remove(q.trail);
          queue.splice(i, 1);
        }
      }
      for (const q of trails) if (q.trail?.parent) q.trail.position.y = q.pos[1] - 18 * (1 - easeOut(clamp((t - (q.at - 0.6)) / 0.6)));
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.age += dt;
        const pos = b.pts.geometry.attributes.position;
        for (let k = 0; k < b.vel.length; k++) {
          const v = b.vel[k];
          v[0] *= 0.965;
          v[1] = v[1] * 0.965 - 9.8 * dt * 0.35;
          v[2] *= 0.965;
          pos.setXYZ(k, pos.getX(k) + v[0] * dt, pos.getY(k) + v[1] * dt, pos.getZ(k) + v[2] * dt);
        }
        pos.needsUpdate = true;
        b.pts.material.opacity = clamp(1.4 - b.age / 1.6);
        b.glow.intensity = Math.max(0, 40 * (1 - b.age / 0.5));
        if (b.age > 2.4) {
          scene.remove(b.pts, b.glow);
          b.pts.geometry.dispose();
          b.pts.material.dispose();
          bursts.splice(i, 1);
        }
      }
    },
  };
}

// Falling bits: confetti, petals or ticker tape. `area` [x, y, z] half-sizes around `center`.
// unlit: glow in their own colour whatever the light (for petals against a sunset).
export function makeFalling(scene, { count = 400, colors = ['#e10600', '#ffffff', '#ffd12e'], center = [0, 10, 0], area = [12, 6, 8], size = [0.16, 0.09], speed = 2.2, drift = 0.8, start = 0, seed = 9, shape = 'rect', unlit = false } = {}) {
  const r = rand(seed);
  const geo = shape === 'petal' ? petalGeometry(size[0]) : new THREE.PlaneGeometry(size[0], size[1]);
  const material = unlit ? new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false }) : new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, metalness: 0.2, emissive: '#222222' });
  const mesh = new THREE.InstancedMesh(geo, material, count);
  const c = new THREE.Color();
  const bits = Array.from({ length: count }, (_, i) => {
    mesh.setColorAt(i, c.set(colors[i % colors.length]));
    return { x: center[0] + (r() - 0.5) * 2 * area[0], y: center[1] + r() * area[1] * 2, z: center[2] + (r() - 0.5) * 2 * area[2], ph: r() * 6.28, sp: speed * (0.6 + r() * 0.8), rx: r() * 6, ry: r() * 6, delay: r() * 1.5 };
  });
  scene.add(mesh);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  const update = (t) => {
    const tt = t - start;
    bits.forEach((b, i) => {
      const u = tt - b.delay;
      if (u < 0) {
        m.compose(v.set(0, -1000, 0), q.identity(), zero);
      } else {
        e.set(b.rx + u * 3, b.ry + u * 2, u * 1.5 + b.ph);
        q.setFromEuler(e);
        m.compose(v.set(b.x + Math.sin(u * 1.7 + b.ph) * drift, b.y - u * b.sp, b.z + Math.cos(u * 1.3 + b.ph) * drift), q, s);
      }
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { mesh, update };
}

function petalGeometry(size) {
  const s = new THREE.Shape();
  s.moveTo(0, -size / 2);
  s.quadraticCurveTo(size * 0.55, -size * 0.1, size * 0.18, size / 2);
  s.lineTo(0, size * 0.36);
  s.lineTo(-size * 0.18, size / 2);
  s.quadraticCurveTo(-size * 0.55, -size * 0.1, 0, -size / 2);
  return new THREE.ShapeGeometry(s);
}

// Puffs of smoke or spray: emit(at, pos, vel) and they grow and fade.
export function makePuffs(scene, { color = '#d8d8d8', max = 120, life = 1.4, size = 2, additive = false, gravity = 0, grow = 1.6 } = {}) {
  const puffs = [];
  const queue = [];
  return {
    emit(at, pos, vel = [0, 1, 0], n = 1, spread = 0.6) {
      for (let i = 0; i < n; i++) queue.push({ at: at + i * 0.01, pos: pos.slice(), vel: vel.map((x) => x + (Math.random() - 0.5) * spread * 2) });
    },
    update(t, dt) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (t < queue[i].at || puffs.length >= max) continue;
        const q = queue.splice(i, 1)[0];
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(), color, transparent: true, opacity: 0.7, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
        s.position.set(...q.pos);
        scene.add(s);
        puffs.push({ s, vel: q.vel, age: 0 });
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.age += dt;
        p.vel[1] -= gravity * dt;
        p.s.position.x += p.vel[0] * dt;
        p.s.position.y += p.vel[1] * dt;
        p.s.position.z += p.vel[2] * dt;
        const k = p.age / life;
        p.s.scale.setScalar(size * (0.4 + k * grow));
        p.s.material.opacity = 0.7 * (1 - k);
        if (k >= 1) {
          scene.remove(p.s);
          p.s.material.dispose();
          puffs.splice(i, 1);
        }
      }
    },
  };
}

// A flag on a pole, waving: a plane with a canvas texture whose vertices ripple.
export function makeFlag(draw, { w = 3, h = 2, pole = 6, segs = 16 } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h, segs, 4);
  geo.translate(w / 2, 0, 0);
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: canvasTexture(192, 128, draw), side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.y = pole - h / 2;
  g.add(flag);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, pole, 8), mat('#cfd3da', { metal: 0.8, rough: 0.3 }));
  p.position.y = pole / 2;
  g.add(p);
  const base = geo.attributes.position.array.slice();
  g.userData.update = (t, speed = 6, amp = 0.25) => {
    const a = geo.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const x = base[i * 3];
      a.setZ(i, Math.sin(x * 1.6 - t * speed) * amp * (x / w));
    }
    a.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return g;
}

export const checkers = (g, w, h) => {
  const n = 8;
  for (let y = 0; y < n * (h / w); y++) for (let x = 0; x < n; x++) {
    g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5';
    g.fillRect((x * w) / n, (y * w) / n, w / n + 1, w / n + 1);
  }
};

// Flag colours for home crowds (the stripes, not the emblems).
export const FLAG_COLORS = {
  GB: ['#012169', '#ffffff', '#c8102e'], NL: ['#ae1c28', '#ffffff', '#21468b'], DE: ['#000000', '#dd0000', '#ffce00'], FR: ['#0055a4', '#ffffff', '#ef4135'],
  IT: ['#009246', '#ffffff', '#ce2b37'], ES: ['#aa151b', '#f1bf00'], MC: ['#ce1126', '#ffffff'], BE: ['#000000', '#fae042', '#ed2939'], AT: ['#ed2939', '#ffffff'],
  CH: ['#da291c', '#ffffff'], FI: ['#ffffff', '#002f6c'], DK: ['#c8102e', '#ffffff'], SE: ['#006aa7', '#fecc00'], PL: ['#ffffff', '#dc143c'], HU: ['#ce2939', '#ffffff', '#477050'],
  US: ['#b22234', '#ffffff', '#3c3b6e'], CA: ['#ff0000', '#ffffff'], MX: ['#006847', '#ffffff', '#ce1126'], BR: ['#009c3b', '#ffdf00', '#002776'], AR: ['#74acdf', '#ffffff', '#f6b40e'],
  CO: ['#fcd116', '#003893', '#ce1126'], AU: ['#012169', '#ffffff', '#e4002b'], NZ: ['#012169', '#ffffff', '#c8102e'], JP: ['#ffffff', '#bc002d'], CN: ['#de2910', '#ffde00'],
  TW: ['#fe0000', '#000095', '#ffffff'], HK: ['#de2910', '#ffffff'], MO: ['#00785e', '#ffffff', '#fbd116'], KR: ['#ffffff', '#cd2e3a', '#0047a0'], TH: ['#a51931', '#f4f5f8', '#2d2a4a'],
  IN: ['#ff9933', '#ffffff', '#138808'], SG: ['#ef3340', '#ffffff'], AE: ['#00732f', '#ffffff', '#000000', '#ff0000'], SA: ['#006c35', '#ffffff'], ZA: ['#007a4d', '#ffb612', '#de3831', '#002395'],
};
