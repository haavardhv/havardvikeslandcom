import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ------------------------------------------------------------------ *
 *  Setup
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('scene');
const hint = document.getElementById('hint');
const muteBtn = document.getElementById('mute');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
if (coarse) hint.textContent = 'touch to hold the light';

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  document.documentElement.classList.add('no-webgl');
  throw err;
}
const pixelRatio = Math.min(window.devicePixelRatio, coarse ? 1.5 : 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const VOID = 0x08070c;
const scene = new THREE.Scene();
scene.background = new THREE.Color(VOID);
scene.fog = new THREE.FogExp2(VOID, 0.026);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.6, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (speed, dt) => 1 - Math.exp(-speed * dt);
const smooth = (x) => x * x * (3 - 2 * x);
const rand = (a, b) => a + Math.random() * (b - a);

// Rises fast, holds, falls over the last 45% of `dur`.
function pokeEnv(t, dur) {
  if (t >= dur) return 0;
  return smooth(Math.min(clamp(t / 0.2, 0, 1), clamp((dur - t) / (dur * 0.45), 0, 1)));
}

const matCache = new Map();
function std(color, roughness = 0.85, metalness = 0) {
  const key = `${color}-${roughness}-${metalness}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return matCache.get(key);
}
// Unlit and brighter than white, so the bloom pass makes it glow.
function glow(r, g, b, extra = {}) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), ...extra });
}

const GEO = {
  sphere: new THREE.SphereGeometry(1, 32, 20),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cone: new THREE.ConeGeometry(1, 1, 24),
  box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.18, 12, 40),
};

function part(geo, mat, { p = [0, 0, 0], r = [0, 0, 0], s = 1, parent, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p);
  m.rotation.set(...r);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  if (parent) parent.add(m);
  return m;
}

function group(parent, p = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...p);
  if (parent) parent.add(g);
  return g;
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

// Turn `obj` (forward = +Z in its parent's frame) toward a world point.
function faceToward(obj, target, dt, maxYaw, maxPitch, speed) {
  obj.rotation.order = 'YXZ';
  obj.parent.updateWorldMatrix(true, false);
  const local = obj.parent.worldToLocal(_v.copy(target)).sub(obj.position);
  const yaw = clamp(Math.atan2(local.x, local.z), -maxYaw, maxYaw);
  const pitch = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -maxPitch, maxPitch);
  const k = damp(speed, dt);
  obj.rotation.y += (yaw - obj.rotation.y) * k;
  obj.rotation.x += (pitch - obj.rotation.x) * k;
}

/* ------------------------------------------------------------------ *
 *  Light & world
 * ------------------------------------------------------------------ */

scene.add(new THREE.HemisphereLight(0x55638c, 0x0a0810, 0.5));

const moonLight = new THREE.DirectionalLight(0xaebfff, 1.5);
moonLight.position.set(-8, 10, -34);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
Object.assign(moonLight.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
moonLight.shadow.normalBias = 0.05;
scene.add(moonLight);

// The cursor's lantern.
const lantern = new THREE.PointLight(0xffc78a, 70, 26, 1.6);
lantern.castShadow = !coarse;
lantern.shadow.mapSize.set(1024, 1024);
lantern.shadow.camera.near = 0.3;
lantern.shadow.bias = -0.003;
lantern.position.set(0, 3, 3);
scene.add(lantern);
const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12), glow(9, 6, 3.2));
lantern.add(orb);
const halo = new THREE.Sprite(new THREE.SpriteMaterial({
  map: radialTexture([[0, 'rgba(255,210,150,0.9)'], [0.25, 'rgba(255,170,90,0.25)'], [1, 'rgba(255,140,60,0)']]),
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
}));
halo.scale.setScalar(2.6);
lantern.add(halo);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std(0x16131b, 0.93));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

/* ------------------------------------------------------------------ *
 *  Sound (synthesised, no files)
 * ------------------------------------------------------------------ */

const audio = {
  ctx: null,
  out: null,
  muted: false,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.4;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  play(name) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (ctx) SOUNDS[name](ctx, this.out, ctx.currentTime + 0.01);
  },
};

function envGain(ctx, out, t, peak, attack, hold, release) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  g.connect(out);
  return g;
}

function noise(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

const SOUNDS = {
  // distant, sinking horn
  horn(ctx, out, t) {
    const g = envGain(ctx, out, t, 0.5, 0.5, 0.9, 2.2);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 3.4);
    f.Q.value = 3;
    f.connect(g);
    for (const freq of [55, 82.4, 110.6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq * 1.05, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 3.5);
      o.connect(f);
      o.start(t);
      o.stop(t + 3.7);
    }
  },
  // sputtering engine rumble
  rumble(ctx, out, t) {
    const src = noise(ctx, 2.4);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 170;
    const g = envGain(ctx, out, t, 1.4, 0.08, 1.0, 1.2);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.value = 9;
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g);
    src.start(t);
    lfo.start(t);
    src.stop(t + 2.4);
    lfo.stop(t + 2.4);
  },
  // old hinge
  creak(ctx, out, t) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const curve = new Float32Array(32).map((_, i) => 34 - i * 0.6 + Math.random() * 9);
    o.frequency.setValueCurveAtTime(curve, t, 1.6);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = 1300;
    f1.Q.value = 9;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 620;
    f2.Q.value = 6;
    const g = envGain(ctx, out, t, 1.6, 0.08, 1.1, 0.5);
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    o.start(t);
    o.stop(t + 1.8);
  },
  // two slow heartbeats
  heartbeat(ctx, out, t) {
    [0, 0.26, 1.05, 1.31].forEach((k, i) => {
      const s = t + k;
      const g = envGain(ctx, out, s, i % 2 ? 0.7 : 1.0, 0.012, 0.03, 0.28);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(62, s);
      o.frequency.exponentialRampToValueAtTime(34, s + 0.2);
      o.connect(g);
      o.start(s);
      o.stop(s + 0.4);
    });
  },
};

try { audio.muted = localStorage.getItem('muted') === '1'; } catch { /* storage unavailable */ }
function syncMute() {
  const label = audio.muted ? 'Unmute sounds' : 'Mute sounds';
  muteBtn.setAttribute('aria-pressed', String(audio.muted));
  muteBtn.setAttribute('aria-label', label);
  muteBtn.title = label;
}
syncMute();
muteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  try { localStorage.setItem('muted', audio.muted ? '1' : '0'); } catch { /* ignore */ }
  syncMute();
});

/* ------------------------------------------------------------------ *
 *  Particles (sparks, moths)
 * ------------------------------------------------------------------ */

class Particles {
  constructor(max = 260) {
    this.pool = [];
    for (let i = 0; i < max; i++) {
      const mesh = new THREE.Mesh(GEO.sphere, glow(1, 1, 1));
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 0.05, gravity: 0, drag: 0, flutter: 0 });
    }
    this.next = 0;
  }
  spawn({ pos, vel, life = 1, size = 0.05, color = [4, 2, 0.6], gravity = 0, drag = 0, flutter = 0 }) {
    const p = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    p.mesh.material.color.setRGB(...color);
    p.mesh.position.copy(pos);
    p.mesh.visible = true;
    p.vel.copy(vel);
    Object.assign(p, { life, maxLife: life, size, gravity, drag, flutter });
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0 || p.mesh.position.y < 0) { p.mesh.visible = false; continue; }
      p.vel.y += p.gravity * dt;
      if (p.flutter) {
        p.vel.x += (Math.random() - 0.5) * p.flutter * dt * 10;
        p.vel.y += (Math.random() - 0.5) * p.flutter * dt * 10;
        p.vel.z += (Math.random() - 0.5) * p.flutter * dt * 10;
      }
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.mesh.position.addScaledVector(p.vel, dt);
      const k = p.life / p.maxLife;
      p.mesh.scale.setScalar(p.size * Math.min(1, k * 2.5));
    }
  }
}
const fx = new Particles();

/* ------------------------------------------------------------------ *
 *  Things
 * ------------------------------------------------------------------ */

class Thing {
  constructor() {
    this.root = new THREE.Group();
    this.root.userData.thing = this;
    this.center = new THREE.Vector3(0, 1, 0);
    this.excite = 0;
    this.hovered = false;
    this.pokeT = 99;
    scene.add(this.root);
  }
  update(dt, t) {
    this.pokeT += dt;
    this.animate(dt, t);
  }
  poke() { this.pokeT = 0; }
  animate() {}
}

/* ---- The elephant on impossibly long legs ---- */

class Elephant extends Thing {
  constructor() {
    super();
    this.L = 5;
    this.center.set(0, this.L + 0.6, 0);
    const bone = std(0xd8cfbf, 0.92);
    const boneDark = std(0xa99f8c, 0.9);
    const ink = std(0x050407, 0.12, 0.3);

    this.legs = [];
    for (const [x, z, ph] of [[-1.0, 0.42, 0], [-1.0, -0.42, Math.PI], [1.05, 0.42, Math.PI], [1.05, -0.42, 0]]) {
      const hip = group(this.root, [x, this.L, z]);
      part(GEO.cyl, bone, { p: [0, -this.L / 2, 0], s: [0.05, this.L, 0.05], parent: hip });
      part(GEO.sphere, bone, { p: [0, -this.L * 0.52, 0], s: 0.08, parent: hip });
      part(GEO.cyl, boneDark, { p: [0, -this.L + 0.04, 0], s: [0.13, 0.08, 0.13], parent: hip });
      hip.userData.phase = ph;
      this.legs.push(hip);
    }

    this.body = group(this.root, [0, this.L + 0.55, 0]);
    part(GEO.sphere, bone, { s: [1.65, 1.0, 0.95], parent: this.body });

    this.tail = group(this.body, [1.6, 0.25, 0]);
    this.tail.rotation.z = 0.25;
    part(GEO.cyl, bone, { p: [0, -0.45, 0], s: [0.022, 0.9, 0.022], parent: this.tail });

    // a cairn with a lit candle, balanced on its back
    const cairn = group(this.body, [0.15, 0.93, 0]);
    part(GEO.sphere, std(0x3a3640, 0.7), { p: [0, 0.08, 0], s: [0.42, 0.14, 0.34], parent: cairn });
    part(GEO.sphere, std(0x4a4550, 0.7), { p: [0.04, 0.3, 0], s: [0.3, 0.12, 0.26], parent: cairn });
    part(GEO.sphere, std(0x2c2932, 0.7), { p: [-0.02, 0.49, 0], s: [0.2, 0.1, 0.17], parent: cairn });
    part(GEO.cyl, std(0xece4d2, 0.6), { p: [0, 0.75, 0], s: [0.05, 0.4, 0.05], parent: cairn });
    this.flame = part(GEO.sphere, glow(8, 3.8, 1.1), { p: [0, 1.02, 0], s: [0.045, 0.1, 0.045], parent: cairn, shadow: false });

    // head (forward = +Z inside `look`)
    this.head = group(this.body, [-1.72, 0.3, 0]);
    this.head.rotation.y = -Math.PI / 2;
    this.look = group(this.head);
    const L = this.look;
    part(GEO.sphere, bone, { s: [0.68, 0.72, 0.75], parent: L });
    this.ears = [-1, 1].map((side) => {
      const ear = group(L, [side * 0.5, 0.15, -0.2]);
      part(GEO.cyl, bone, { p: [side * 0.08, -0.35, -0.15], r: [0, 0, Math.PI / 2], s: [0.85, 0.035, 0.7], parent: ear });
      ear.userData.side = side;
      return ear;
    });
    for (const side of [-1, 1]) {
      part(GEO.sphere, ink, { p: [side * 0.36, 0.18, 0.6], s: 0.075, parent: L });
      part(GEO.cone, std(0xf1ead9, 0.5), { p: [side * 0.24, -0.42, 0.6], r: [1.35, 0, 0], s: [0.045, 0.75, 0.045], parent: L });
    }
    this.trunk = [];
    let tp = group(L, [0, -0.3, 0.6]);
    for (let i = 0; i < 13; i++) {
      const seg = group(tp, i === 0 ? [0, 0, 0] : [0, -0.26, 0]);
      const r = 0.19 - i * 0.0105;
      part(GEO.sphere, bone, { s: r, parent: seg });
      part(GEO.cyl, bone, { p: [0, -0.13, 0], s: [r, 0.28, r], parent: seg });
      this.trunk.push(seg);
      tp = seg;
    }
  }
  animate(dt, t) {
    const env = pokeEnv(this.pokeT, 4.2);
    const k = 1 + 0.6 * env; // legs stretch when poked
    const w = 0.8;
    for (const hip of this.legs) {
      hip.position.y = this.L * k;
      hip.scale.y = k;
      hip.rotation.z = Math.sin(t * w + hip.userData.phase) * 0.07;
    }
    this.body.position.y = this.L * k + 0.55 + Math.sin(t * w * 2) * 0.05;
    this.body.rotation.z = Math.sin(t * w) * 0.02;

    faceToward(this.look, lantern.position, dt, 1.2, 0.5, 1.4);
    for (const ear of this.ears) ear.rotation.y = ear.userData.side * (0.1 + Math.sin(t * 0.6) * 0.06 + this.excite * 0.25);
    this.trunk.forEach((seg, i) => {
      seg.rotation.x = 0.02 - this.excite * 0.11 + Math.sin(t * 1.1 - i * 0.45) * 0.045;
      seg.rotation.z = Math.sin(t * 0.7 - i * 0.35) * 0.05;
    });
    this.tail.rotation.x = Math.sin(t * 1.7) * 0.2;
    const f = 1 + Math.sin(t * 17) * 0.12 + Math.random() * 0.15;
    this.flame.scale.set(0.045, 0.1 * f, 0.045);
  }
  poke() {
    super.poke();
    audio.play('horn');
  }
}

/* ---- The rocket hanging upside down from a thread ---- */

class HangingRocket extends Thing {
  constructor() {
    super();
    this.top = 26;
    this.len = 18.5;
    this.center.set(0, this.top - this.len - 1.6, 0);
    this.ax = 0; this.az = 0; this.vx = 0; this.vz = 0;

    this.pivot = group(this.root, [0, this.top, 0]);
    part(GEO.cyl, std(0xcfc6b5, 0.6), { p: [0, -this.len / 2, 0], s: [0.018, this.len, 0.018], parent: this.pivot });
    this.spin = group(this.pivot, [0, -this.len, 0]);
    const ship = group(this.spin, [0, -0.27, 0]);
    ship.rotation.z = Math.PI;

    const hull = std(0x55505a, 0.38, 0.6);
    const accent = std(0x5e1716, 0.55, 0.3);
    const metal = std(0x7a736b, 0.35, 0.85);
    const profile = [[0.001, 0], [0.42, 0], [0.62, 0.35], [0.72, 1.0], [0.7, 1.7], [0.58, 2.25], [0.001, 2.27]];
    part(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 40), hull, { parent: ship });
    part(GEO.cone, accent, { p: [0, 2.72, 0], s: [0.585, 0.95, 0.585], parent: ship });
    part(GEO.cyl, accent, { p: [0, 0.55, 0], s: [0.668, 0.12, 0.668], parent: ship });

    const port = group(ship, [0, 1.42, 0.68]);
    part(GEO.torus, metal, { s: [0.3, 0.3, 0.45], parent: port });
    this.window = part(GEO.sphere, glow(2.6, 1.4, 0.55), { s: [0.28, 0.28, 0.08], parent: port, shadow: false });

    const fin = new THREE.Shape();
    fin.moveTo(0, 1.0);
    fin.lineTo(0.5, 0.35);
    fin.lineTo(0.62, -0.32);
    fin.lineTo(0.36, -0.22);
    fin.lineTo(0, 0.12);
    const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    finGeo.translate(0, 0, -0.035);
    for (const a of [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 - (2 * Math.PI) / 3]) {
      const g = group(ship);
      g.rotation.y = a;
      part(finGeo, accent, { p: [0.5, 0, 0], parent: g });
    }
    part(new THREE.CylinderGeometry(0.3, 0.4, 0.3, 28), metal, { p: [0, -0.12, 0], parent: ship });

    this.flame = group(ship, [0, -0.27, 0]);
    part(GEO.cone, glow(7, 2.6, 0.6), { p: [0, -0.5, 0], r: [Math.PI, 0, 0], s: [0.28, 1, 0.28], parent: this.flame, shadow: false });
    part(GEO.cone, glow(9, 7, 4), { p: [0, -0.33, 0], r: [Math.PI, 0, 0], s: [0.15, 0.65, 0.15], parent: this.flame, shadow: false });
    this.flame.visible = false;
    this.sparks = 0;
  }
  animate(dt, t) {
    const env = pokeEnv(this.pokeT, 2.4);

    // The light pushes it away, like a draught.
    this.spin.updateWorldMatrix(true, false);
    const pos = _v.setFromMatrixPosition(this.spin.matrixWorld);
    pos.y -= 1.6 * this.root.scale.y;
    const dx = pos.x - lantern.position.x;
    const dy = pos.y - lantern.position.y;
    const dz = pos.z - lantern.position.z;
    const d2 = dx * dx + dy * dy + dz * dz + 1;
    const push = 0.35 / d2;
    const g = 9.8 / this.len;
    let accZ = -g * this.az - 0.22 * this.vz + (dx / Math.sqrt(d2)) * push + Math.sin(t * 0.31) * 0.004;
    let accX = -g * this.ax - 0.22 * this.vx - (dz / Math.sqrt(d2)) * push * 0.5;
    if (env > 0) {
      accZ += (Math.random() - 0.5) * 0.5 * env;
      accX += (Math.random() - 0.5) * 0.3 * env;
    }
    this.vz += accZ * dt; this.az += this.vz * dt;
    this.vx += accX * dt; this.ax += this.vx * dt;
    this.pivot.rotation.set(this.ax, 0, this.az);
    this.spin.rotation.y += dt * (0.12 + env * 7);

    this.flame.visible = env > 0.02;
    if (this.flame.visible) this.flame.scale.set(1, env * (1.2 + Math.random() * 0.5), 1);
    this.window.material.color.setRGB(2.6 + this.excite * 2, 1.4 + this.excite * 1.1, 0.55 + this.excite * 0.4);

    if (env > 0.25) {
      this.sparks += dt * 70;
      this.flame.updateWorldMatrix(true, false);
      const fp = _v2.setFromMatrixPosition(this.flame.matrixWorld);
      while (this.sparks >= 1) {
        this.sparks -= 1;
        fx.spawn({
          pos: fp,
          vel: new THREE.Vector3(rand(-1.5, 1.5), rand(3, 7), rand(-1.5, 1.5)),
          life: rand(0.6, 1.4), size: rand(0.02, 0.05), color: [7, rand(2, 4), 0.6], gravity: -7, drag: 0.6,
        });
      }
    }
  }
  poke() {
    super.poke();
    this.vz += (Math.random() - 0.5) * 0.5;
    audio.play('rumble');
  }
}

/* ---- A door standing alone, with something bright behind it ---- */

class Door extends Thing {
  constructor() {
    super();
    const W = 1.3;
    const H = 3.2;
    this.W = W; this.H = H;
    this.center.set(0, H / 2, 0);
    const wood = std(0x2a201c, 0.78);
    const panelMat = std(0x3a2b24, 0.7);
    const brass = std(0x9c7a45, 0.35, 0.8);
    const r = this.root;

    for (const side of [-1, 1]) part(GEO.box, wood, { p: [side * (W / 2 + 0.08), (H + 0.16) / 2, 0], s: [0.16, H + 0.16, 0.28], parent: r });
    part(GEO.box, wood, { p: [0, H + 0.08, 0], s: [W + 0.32, 0.16, 0.28], parent: r });
    part(GEO.box, wood, { p: [0, 0.03, 0.02], s: [W + 0.32, 0.06, 0.34], parent: r });

    this.lightMat = glow(5, 3.6, 2.2);
    part(new THREE.PlaneGeometry(W, H), this.lightMat, { p: [0, H / 2, -0.06], parent: r, shadow: false });

    this.hinge = group(r, [-W / 2, 0, 0.02]);
    part(GEO.box, panelMat, { p: [W / 2, H / 2, 0], s: [W, H, 0.07], parent: this.hinge });
    part(GEO.sphere, brass, { p: [W - 0.15, H * 0.47, 0.07], s: 0.05, parent: this.hinge });

    this.spot = new THREE.SpotLight(0xffc890, 0, 16, 0.8, 0.75, 1.4);
    this.spot.position.set(0, H * 0.75, -0.25);
    this.spot.target.position.set(0, 0, 5);
    this.spot.castShadow = !coarse;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.bias = -0.002;
    r.add(this.spot, this.spot.target);

    this.open = 0.24;
    this.moths = 0;
  }
  animate(dt, t) {
    const env = pokeEnv(this.pokeT, 4.0);
    const target = 0.24 + this.excite * 0.4 + env * 1.2;
    this.open += (target - this.open) * damp(env > 0 ? 3 : 1.4, dt);
    this.hinge.rotation.y = -this.open;
    const flicker = 0.88 + 0.12 * Math.sin(t * 13) * Math.sin(t * 7.3) + Math.random() * 0.04;
    this.spot.intensity = (30 + 150 * smooth(clamp(this.open / 1.3, 0, 1))) * flicker;
    this.lightMat.color.setRGB(5 * flicker, 3.6 * flicker, 2.2 * flicker);

    if (env > 0.4) {
      this.moths += dt * 14;
      while (this.moths >= 1) {
        this.moths -= 1;
        const p = this.root.localToWorld(new THREE.Vector3(rand(-0.4, 0.5), rand(0.6, this.H - 0.3), 0.1));
        const v = new THREE.Vector3(rand(-0.6, 0.6), rand(-0.1, 0.5), rand(1, 2.4)).applyQuaternion(this.root.quaternion);
        fx.spawn({ pos: p, vel: v, life: rand(2, 3.5), size: rand(0.025, 0.04), color: [5, 4, 2.6], flutter: 6, drag: 0.4 });
      }
    }
  }
  poke() {
    super.poke();
    audio.play('creak');
  }
}

/* ---- The moon, which is an eye ---- */

function moonTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#d9d1c2';
  g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = rand(8, 70);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(120,110,100,${rand(0.05, 0.2)})`);
    grad.addColorStop(1, 'rgba(120,110,100,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // a few bloodshot veins
  g.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    let x = Math.random() * 1024;
    let y = Math.random() * 512;
    let a = Math.random() * Math.PI * 2;
    g.strokeStyle = `rgba(140,30,30,${rand(0.15, 0.45)})`;
    g.lineWidth = rand(0.6, 2.2);
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 30; s++) {
      a += rand(-0.5, 0.5);
      x += Math.cos(a) * 6;
      y += Math.sin(a) * 6;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Drawn in polar space: x = angle around the pupil, y = distance from it.
function irisTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1c0604');
  grad.addColorStop(0.3, '#6e1a0e');
  grad.addColorStop(0.65, '#a8461b');
  grad.addColorStop(0.88, '#4a1007');
  grad.addColorStop(1, '#0b0203');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 1100; i++) {
    const x = Math.random() * 512;
    const warm = Math.random() < 0.5;
    g.strokeStyle = warm ? `rgba(230,140,70,${rand(0.08, 0.3)})` : `rgba(20,4,2,${rand(0.1, 0.4)})`;
    g.lineWidth = rand(0.5, 2);
    g.beginPath();
    g.moveTo(x, rand(10, 90));
    g.lineTo(x + rand(-3, 3), rand(120, 240));
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class MoonEye extends Thing {
  constructor() {
    super();
    const R = 6;
    this.center.set(0, 0, 0);
    this.ball = group(this.root);
    part(new THREE.SphereGeometry(R, 64, 32), glow(1.2, 1.14, 1.04, { map: moonTexture(), fog: false }), { parent: this.ball, shadow: false });
    part(new THREE.SphereGeometry(R * 1.01, 64, 16, 0, Math.PI * 2, 0, 0.42).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: irisTexture(), fog: false }), { parent: this.ball, shadow: false });
    this.pupil = part(new THREE.SphereGeometry(R * 1.022, 48, 8, 0, Math.PI * 2, 0, 0.17).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x020102, fog: false }), { parent: this.ball, shadow: false });
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture([[0, 'rgba(255,240,220,0.35)'], [0.45, 'rgba(200,190,220,0.08)'], [1, 'rgba(0,0,0,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
    }));
    corona.scale.setScalar(R * 5);
    corona.position.z = -R;
    this.root.add(corona);
    this.pupilSize = 1;
    this.blinkIn = rand(3, 6);
    this.blinkT = 0;
  }
  animate(dt) {
    // Look at the light, exaggerated so the movement reads from this far away.
    const eyePos = this.root.getWorldPosition(new THREE.Vector3());
    const toCam = _v.copy(camera.position).sub(eyePos).normalize();
    const toLight = _v2.copy(lantern.position).sub(eyePos).normalize();
    toLight.sub(toCam).multiplyScalar(3.2).add(toCam).normalize();
    _m.lookAt(toLight.add(eyePos), eyePos, UP);
    _q.setFromRotationMatrix(_m);
    this.ball.quaternion.slerp(_q, damp(3, dt));

    let target = 1 + this.excite * 0.35;
    if (this.pokeT < 0.35) target = 0.45;
    else if (this.pokeT < 3.5) target = 1.75;
    this.pupilSize += (target - this.pupilSize) * damp(this.pokeT < 0.35 ? 18 : 2.5, dt);
    this.pupil.scale.set(this.pupilSize, this.pupilSize, 1);

    this.blinkIn -= dt;
    if (this.blinkIn <= 0) { this.blinkT = 0.32; this.blinkIn = rand(4, 9); }
    let lid = 1;
    if (this.blinkT > 0) { this.blinkT -= dt; lid = Math.max(0.03, Math.abs(this.blinkT / 0.16 - 1)); }
    this.root.scale.y = this.root.userData.scale * lid;
  }
  poke() {
    super.poke();
    audio.play('heartbeat');
  }
}

/* ------------------------------------------------------------------ *
 *  Drifting debris and dust
 * ------------------------------------------------------------------ */

const debrisGeos = [new THREE.IcosahedronGeometry(1, 0), new THREE.BoxGeometry(1, 1, 1), new THREE.OctahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1, 0)];
const debris = [];
for (let i = 0; i < 34; i++) {
  const mat = Math.random() < 0.15 ? std(0xcfc6b5, 0.8) : std(Math.random() < 0.5 ? 0x2d2a33 : 0x3b3640, 0.7);
  const m = part(debrisGeos[i % debrisGeos.length], mat, { s: rand(0.07, 0.42) });
  m.position.set(rand(-18, 18), rand(0, 18), rand(-20, -1));
  m.userData = { vy: rand(0.12, 0.4), spin: new THREE.Vector3(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5)), off: new THREE.Vector3(), home: m.position.clone() };
  scene.add(m);
  debris.push(m);
}

const dustCount = 500;
const dustPos = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  dustPos[i * 3] = rand(-16, 16);
  dustPos[i * 3 + 1] = rand(0, 12);
  dustPos[i * 3 + 2] = rand(-14, 6);
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xffe2b8, size: 0.035, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
}));
scene.add(dust);

function updateWorld(dt, t) {
  for (const m of debris) {
    const u = m.userData;
    u.home.y += u.vy * dt;
    if (u.home.y > 19) u.home.y = -1;
    m.rotation.x += u.spin.x * dt;
    m.rotation.y += u.spin.y * dt;
    m.rotation.z += u.spin.z * dt;
    _v.copy(u.home).add(u.off).sub(lantern.position);
    const d = _v.length();
    if (d < 3.5) u.off.addScaledVector(_v.normalize(), (3.5 - d) * dt * 2);
    u.off.multiplyScalar(1 - dt * 0.3);
    m.position.copy(u.home).add(u.off);
  }
  dust.rotation.y = t * 0.01;
  dust.position.y = Math.sin(t * 0.2) * 0.3;
}

/* ------------------------------------------------------------------ *
 *  Layout
 * ------------------------------------------------------------------ */

const elephant = new Elephant();
const rocket = new HangingRocket();
const door = new Door();
const eye = new MoonEye();
const things = [elephant, rocket, door, eye];

// Per layout: camera position, look-at, minimum visible width, and
// [x, y, z, yaw, scale] for each thing.
const LAYOUTS = {
  wide: {
    cam: [0, 3.2, 17], look: [0, 5.4, 0], width: 20,
    place: { elephant: [-0.3, 0, -3.5, -0.4, 1], rocket: [4.4, 0, -1, 0, 1], door: [8.6, 0, -6.5, -0.45, 1.2], eye: [-30, 31, -62, 0, 1] },
  },
  tall: {
    cam: [0, 4.4, 27], look: [0, 1.4, 0], width: 9, lookK: 0,
    place: { elephant: [-0.6, 0, -3, -0.5, 0.85], rocket: [2.6, -1.2, -1, 0, 0.8], door: [1.6, 0, -15, -0.2, 1.2], eye: [-2.5, 19, -60, 0, 0.9] },
  },
};

const camBase = new THREE.Vector3();
const lookAt = new THREE.Vector3();

function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  const cfg = aspect >= 1 ? LAYOUTS.wide : LAYOUTS.tall;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const dist = Math.max(cfg.cam[2], cfg.width / 2 / (Math.tan(halfFov) * aspect));
  camBase.set(cfg.cam[0], cfg.cam[1] + (dist - cfg.cam[2]) * 0.1, dist);
  camera.position.copy(camBase);
  lookAt.set(...cfg.look);
  lookAt.y += (dist - cfg.cam[2]) * (cfg.lookK ?? 0.18);

  const names = { elephant, rocket, door, eye };
  for (const [name, [x, y, z, yaw, s]] of Object.entries(cfg.place)) {
    const th = names[name];
    th.root.position.set(x, y, z);
    th.root.rotation.y = yaw;
    th.root.scale.setScalar(s);
    th.root.userData.scale = s;
  }
}
layout();
window.addEventListener('resize', layout);

/* ------------------------------------------------------------------ *
 *  Pointer
 * ------------------------------------------------------------------ */

const raycaster = new THREE.Raycaster();
const pointer = { ndc: new THREE.Vector2(0, -0.2), active: false, lastMove: -99 };
const lightPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.5); // z = 2.5
const desired = new THREE.Vector3();
const clock = new THREE.Clock();
let hovered = null;
let poked = false;

function setPointer(e) {
  pointer.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  pointer.active = true;
  pointer.lastMove = clock.elapsedTime;
}

function pick() {
  raycaster.setFromCamera(pointer.ndc, camera);
  const hits = raycaster.intersectObjects(things.map((th) => th.root), true);
  for (const hit of hits) {
    let o = hit.object;
    if (!o.visible || o.isSprite) continue;
    while (o && !o.userData.thing) o = o.parent;
    if (o) return o.userData.thing;
  }
  return null;
}

window.addEventListener('pointermove', setPointer, { passive: true });
document.documentElement.addEventListener('mouseleave', () => { pointer.active = false; });
window.addEventListener('blur', () => { pointer.active = false; });
canvas.addEventListener('pointerdown', (e) => {
  setPointer(e);
  const th = pick();
  if (!th) return;
  th.poke();
  if (!poked) { poked = true; hint.classList.add('gone'); }
});

/* ------------------------------------------------------------------ *
 *  Loop
 * ------------------------------------------------------------------ */

const motion = reduceMotion ? 0.4 : 1;
let first = true;

function frame() {
  const rawDt = Math.min(clock.getDelta(), 1 / 20);
  const dt = rawDt * motion;
  const t = clock.elapsedTime * motion;

  const idle = !pointer.active || clock.elapsedTime - pointer.lastMove > 8;
  if (!idle) {
    raycaster.setFromCamera(pointer.ndc, camera);
    if (!raycaster.ray.intersectPlane(lightPlane, desired)) desired.set(0, 3, 2.5);
    desired.y = Math.max(desired.y, 0.4);
  } else {
    desired.set(Math.sin(t * 0.21) * 6, 3 + Math.sin(t * 0.33) * 1.8, 2 + Math.sin(t * 0.17) * 1.5);
  }
  lantern.position.lerp(desired, damp(idle ? 1.2 : 12, rawDt));
  lantern.intensity = 70 * (0.94 + Math.sin(t * 9) * 0.03 + Math.random() * 0.03);

  // Gentle parallax.
  const px = pointer.active ? pointer.ndc.x : 0;
  const py = pointer.active ? pointer.ndc.y : 0;
  camera.position.x += (camBase.x + px * 0.9 - camera.position.x) * damp(2, rawDt);
  camera.position.y += (camBase.y + py * 0.4 - camera.position.y) * damp(2, rawDt);
  camera.position.z = camBase.z;
  camera.lookAt(lookAt);

  const now = pointer.active ? pick() : null;
  if (now !== hovered) {
    if (hovered) hovered.hovered = false;
    hovered = now;
    if (hovered) hovered.hovered = true;
  }
  const orbScale = hovered ? 1.8 : 1;
  orb.scale.setScalar(orb.scale.x + (orbScale - orb.scale.x) * damp(10, rawDt));

  for (const th of things) {
    let want = 0;
    if (!idle) {
      th.root.localToWorld(_v.copy(th.center)).project(camera);
      const d = Math.hypot((_v.x - pointer.ndc.x) * camera.aspect, _v.y - pointer.ndc.y);
      want = clamp(1 - d / 0.8, 0, 1);
    }
    if (th.hovered) want = 1;
    th.excite += (want - th.excite) * damp(3, rawDt);
    th.update(dt, t);
  }

  updateWorld(dt, t);
  fx.update(dt);
  composer.render();

  if (first) { first = false; canvas.classList.add('ready'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
