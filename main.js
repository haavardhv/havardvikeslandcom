import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Setup
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('scene');
const hint = document.getElementById('hint');
const muteBtn = document.getElementById('mute');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  document.documentElement.classList.add('no-webgl');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xffffff, 0xffc9a8, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.position.set(6, 12, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 5;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.ShadowMaterial({ color: 0x5a3a7a, opacity: 0.14 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (speed, dt) => 1 - Math.exp(-speed * dt);
const smooth = (x) => x * x * (3 - 2 * x);
const easeOutBack = (x) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;

// Envelope that rises fast, holds, and falls over the last 40% of `dur`.
function pokeEnv(t, dur) {
  if (t >= dur) return 0;
  const rise = clamp(t / 0.15, 0, 1);
  const fall = clamp((dur - t) / (dur * 0.4), 0, 1);
  return smooth(Math.min(rise, fall));
}

const toonGradient = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const toonCache = new Map();
function toon(color) {
  if (!toonCache.has(color)) toonCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: toonGradient }));
  return toonCache.get(color);
}

const GEO = {
  sphere: new THREE.SphereGeometry(1, 32, 20),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 28),
  cone: new THREE.ConeGeometry(1, 1, 28),
  torus: new THREE.TorusGeometry(1, 0.2, 14, 40),
  box: new THREE.BoxGeometry(1, 1, 1),
};

function part(geo, mat, { p = [0, 0, 0], r = [0, 0, 0], s = 1, parent, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p);
  m.rotation.set(...r);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
  m.castShadow = shadow;
  if (parent) parent.add(m);
  return m;
}

function group(parent, p = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...p);
  if (parent) parent.add(g);
  return g;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

/* ------------------------------------------------------------------ *
 *  Sound (tiny Web Audio synths, no files)
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
      this.out.gain.value = 0.32;
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

const SOUNDS = {
  trumpet(ctx, out, t) {
    const g = envGain(ctx, out, t, 0.55, 0.05, 0.45, 0.4);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    f.Q.value = 4;
    f.connect(g);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 7;
    lfoGain.gain.value = 14;
    lfo.connect(lfoGain);
    for (const detune of [-8, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(520, t + 0.12);
      o.frequency.setValueAtTime(520, t + 0.3);
      o.frequency.exponentialRampToValueAtTime(380, t + 0.9);
      lfoGain.connect(o.frequency);
      o.connect(f);
      o.start(t);
      o.stop(t + 1);
    }
    lfo.start(t);
    lfo.stop(t + 1);
  },
  quack(ctx, out, t) {
    for (const k of [0, 0.19]) {
      const g = envGain(ctx, out, t + k, 0.6, 0.01, 0.06, 0.09);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1150;
      f.Q.value = 2.2;
      f.connect(g);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(560, t + k);
      o.frequency.exponentialRampToValueAtTime(300, t + k + 0.15);
      o.connect(f);
      o.start(t + k);
      o.stop(t + k + 0.2);
    }
  },
  whoosh(ctx, out, t) {
    const len = 1.8;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(250, t);
    f.frequency.exponentialRampToValueAtTime(2800, t + 1.5);
    const g = envGain(ctx, out, t, 0.9, 0.35, 0.5, 0.9);
    src.connect(f).connect(g);
    src.start(t);
    src.stop(t + len);
  },
  bloop(ctx, out, t) {
    [660, 990, 1320, 880, 1760, 1175].forEach((freq, i) => {
      const s = t + i * 0.075;
      const g = envGain(ctx, out, s, 0.28, 0.005, 0.03, 0.08);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(freq * 0.7, s);
      o.frequency.exponentialRampToValueAtTime(freq, s + 0.04);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 3000;
      o.connect(f).connect(g);
      o.start(s);
      o.stop(s + 0.14);
    });
  },
};

try { audio.muted = localStorage.getItem('muted') === '1'; } catch { /* storage unavailable */ }
const syncMute = () => {
  muteBtn.setAttribute('aria-pressed', String(audio.muted));
  const label = audio.muted ? 'Unmute sounds' : 'Mute sounds';
  muteBtn.setAttribute('aria-label', label);
  muteBtn.title = label;
};
syncMute();
muteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  try { localStorage.setItem('muted', audio.muted ? '1' : '0'); } catch { /* ignore */ }
  syncMute();
});

/* ------------------------------------------------------------------ *
 *  Particles
 * ------------------------------------------------------------------ */

class Particles {
  constructor(max = 400) {
    this.pool = [];
    for (let i = 0; i < max; i++) {
      const mesh = new THREE.Mesh(GEO.sphere, toon(0xffffff));
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 0.1, gravity: 0, drag: 0, grow: 0, floor: false });
    }
    this.next = 0;
  }
  spawn({ pos, vel, life = 1, size = 0.1, color = 0xffffff, gravity = -9.8, drag = 0, grow = 0, floor = false }) {
    const p = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    p.mesh.material = toon(color);
    p.mesh.position.copy(pos);
    p.mesh.visible = true;
    p.vel.copy(vel);
    Object.assign(p, { life, maxLife: life, size, gravity, drag, grow, floor });
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.mesh.position.addScaledVector(p.vel, dt);
      const k = p.life / p.maxLife;
      const s = p.size * (1 + p.grow * (1 - k)) * Math.min(1, k * 3);
      if (p.mesh.position.y < s) {
        if (p.floor) { p.mesh.position.y = s; p.vel.y = Math.abs(p.vel.y) * 0.2; }
        else { p.mesh.visible = false; continue; }
      }
      p.mesh.scale.setScalar(s);
    }
  }
}
const fx = new Particles();

/* ------------------------------------------------------------------ *
 *  Googly eyes
 * ------------------------------------------------------------------ */

const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
const pupilMat = new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: 0.3 });
const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

class GooglyEye {
  constructor(parent, radius, pos) {
    this.group = group(parent, pos);
    part(GEO.sphere, eyeWhite, { s: radius, parent: this.group });
    this.pivot = group(this.group);
    part(GEO.sphere, pupilMat, { p: [0, 0, radius * 0.8], s: [radius * 0.52, radius * 0.52, radius * 0.26], parent: this.pivot });
    part(GEO.sphere, shineMat, { p: [radius * 0.16, radius * 0.18, radius * 1.03], s: radius * 0.11, parent: this.pivot, shadow: false });
    this.dir = new THREE.Vector3(0, 0, 1);
    this.vel = new THREE.Vector3();
  }
  update(target, dt) {
    this.group.updateWorldMatrix(true, false);
    const want = this.group.worldToLocal(_v.copy(target)).normalize();
    if (want.z < 0.35) { want.z = 0.35; want.normalize(); }
    // A wobbly spring makes the pupils overshoot like real googly eyes.
    _v2.copy(want).sub(this.dir).multiplyScalar(170).addScaledVector(this.vel, -10);
    this.vel.addScaledVector(_v2, dt);
    this.dir.addScaledVector(this.vel, dt).normalize();
    this.pivot.quaternion.setFromUnitVectors(Z, this.dir);
  }
  jiggle(amount) {
    this.vel.x += (Math.random() - 0.5) * amount;
    this.vel.y += (Math.random() - 0.5) * amount;
  }
}

/* ------------------------------------------------------------------ *
 *  Character base
 * ------------------------------------------------------------------ */

class Character {
  constructor() {
    this.root = new THREE.Group();
    this.root.userData.character = this;
    this.base = group(this.root); // squash & stretch pivot at the feet
    this.eyes = [];
    this.squash = 0;
    this.squashV = 0;
    this.hovered = false;
    this.hoverAmt = 0;
    this.excite = 0;
    this.pokeT = 99;
    this.blinkIn = 1 + Math.random() * 3;
    this.blinkT = 0;
    this.center = 1.5; // height used for proximity checks
    scene.add(this.root);
  }
  eye(parent, r, pos) {
    const e = new GooglyEye(parent, r, pos);
    this.eyes.push(e);
    return e;
  }
  bump(strength) {
    this.squashV += strength;
    for (const e of this.eyes) e.jiggle(strength * 9);
  }
  face(obj, target, dt, maxYaw = 0.7, maxPitch = 0.35, speed = 6) {
    obj.rotation.order = 'YXZ';
    obj.parent.updateWorldMatrix(true, false);
    const local = obj.parent.worldToLocal(_v.copy(target)).sub(obj.position);
    const yaw = clamp(Math.atan2(local.x, local.z), -maxYaw, maxYaw);
    const pitch = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -maxPitch, maxPitch);
    const k = damp(speed, dt);
    obj.rotation.y += (yaw - obj.rotation.y) * k;
    obj.rotation.x += (pitch - obj.rotation.x) * k;
  }
  update(dt, t, ctx) {
    this.pokeT += dt;
    this.hoverAmt += ((this.hovered ? 1 : 0) - this.hoverAmt) * damp(10, dt);

    const a = -260 * this.squash - 13 * this.squashV;
    this.squashV += a * dt;
    this.squash += this.squashV * dt;
    const s = clamp(this.squash, -0.5, 0.6);
    this.base.scale.set(1 - s * 0.45, 1 + s, 1 - s * 0.45);

    this.animate(dt, t, ctx);

    this.blinkIn -= dt;
    if (this.blinkIn <= 0) { this.blinkT = 0.14; this.blinkIn = 2 + Math.random() * 4; }
    let lid = 1;
    if (this.blinkT > 0) { this.blinkT -= dt; lid = Math.max(0.08, Math.abs(this.blinkT / 0.07 - 1)); }
    const wide = 1 + 0.12 * this.hoverAmt + 0.35 * Math.exp(-this.pokeT * 3);
    for (const e of this.eyes) {
      e.group.scale.set(wide, wide * lid, wide);
      e.update(ctx.target, dt);
    }
  }
  hoverStart() { this.bump(2.2); }
  poke() { this.pokeT = 0; this.bump(4.5); }
  animate() {}
}

/* ------------------------------------------------------------------ *
 *  Elephant
 * ------------------------------------------------------------------ */

class Elephant extends Character {
  constructor() {
    super();
    this.center = 1.8;
    const skin = toon(0x9fb4e3);
    const skinDark = toon(0x8297cc);
    const pink = toon(0xffa9c9);
    const white = toon(0xfffaf0);
    const b = this.base;

    for (const [x, z] of [[-0.52, 0.35], [0.52, 0.35], [-0.52, -0.75], [0.52, -0.75]]) {
      part(GEO.cyl, skin, { p: [x, 0.45, z], s: [0.32, 0.9, 0.32], parent: b });
      for (const dx of [-0.12, 0, 0.12]) part(GEO.sphere, white, { p: [x + dx, 0.1, z + 0.29], s: [0.07, 0.07, 0.05], parent: b });
    }
    part(GEO.sphere, skin, { p: [0, 1.35, -0.25], s: [1.05, 0.95, 1.25], parent: b });

    this.tail = group(b, [0, 1.45, -1.45]);
    this.tail.rotation.x = -0.5;
    part(GEO.cyl, skin, { p: [0, -0.3, 0], s: [0.05, 0.6, 0.05], parent: this.tail });
    part(GEO.sphere, skinDark, { p: [0, -0.62, 0], s: 0.1, parent: this.tail });

    this.head = group(b, [0, 2.15, 0.7]);
    part(GEO.sphere, skin, { s: [0.95, 0.88, 0.85], parent: this.head });
    for (const side of [-1, 1]) part(GEO.sphere, pink, { p: [side * 0.55, -0.22, 0.6], s: [0.15, 0.09, 0.06], parent: this.head, shadow: false });

    this.ears = [-1, 1].map((side) => {
      const pivot = group(this.head, [side * 0.72, 0.15, -0.2]);
      part(GEO.cyl, skin, { p: [side * 0.7, 0, 0], r: [Math.PI / 2, 0, 0], s: [0.78, 0.08, 0.92], parent: pivot });
      part(GEO.cyl, pink, { p: [side * 0.7, -0.03, 0.05], r: [Math.PI / 2, 0, 0], s: [0.56, 0.05, 0.68], parent: pivot });
      pivot.userData.side = side;
      return pivot;
    });

    for (const side of [-1, 1]) part(GEO.cone, white, { p: [side * 0.3, -0.48, 0.62], r: [2.3, 0, side * 0.35], s: [0.07, 0.32, 0.07], parent: this.head });

    this.trunk = [];
    let parent = group(this.head, [0, -0.22, 0.72]);
    for (let i = 0; i < 7; i++) {
      const seg = group(parent, i === 0 ? [0, 0, 0] : [0, -0.2, 0]);
      const r = 0.24 - i * 0.017;
      part(GEO.sphere, skin, { p: [0, -0.1, 0], s: [r, 0.16, r], parent: seg });
      this.trunk.push(seg);
      parent = seg;
    }
    this.trunkTip = group(parent, [0, -0.22, 0]);

    const hat = group(this.head, [0.28, 0.72, -0.05]);
    hat.rotation.z = -0.3;
    part(GEO.cone, toon(0xffd166), { p: [0, 0.35, 0], s: [0.3, 0.7, 0.3], parent: hat });
    part(GEO.torus, toon(0xff6b9a), { p: [0, 0.1, 0], r: [Math.PI / 2, 0, 0], s: 0.27, parent: hat });
    part(GEO.torus, toon(0x5b7cff), { p: [0, 0.35, 0], r: [Math.PI / 2, 0, 0], s: 0.17, parent: hat });
    part(GEO.sphere, toon(0xff6b9a), { p: [0, 0.72, 0], s: 0.11, parent: hat });

    this.eye(this.head, 0.2, [-0.35, 0.2, 0.7]);
    this.eye(this.head, 0.2, [0.35, 0.2, 0.7]);

    this.flap = 0;
    this.spray = 0;
  }
  animate(dt, t, ctx) {
    const env = pokeEnv(this.pokeT, 1.7);
    const ex = this.excite;
    this.face(this.head, ctx.target, dt, 0.6, 0.3);
    this.head.rotation.x -= env * 0.35;

    this.flap += dt * (3 + ex * 9 + env * 14);
    const amp = 0.12 + ex * 0.22 + env * 0.3;
    for (const ear of this.ears) ear.rotation.y = ear.userData.side * (0.15 + Math.sin(this.flap) * amp);

    this.trunk.forEach((seg, i) => {
      seg.rotation.x = -0.09 - ex * 0.05 - env * 0.24 + Math.sin(t * 2.2 - i * 0.7) * 0.07;
      seg.rotation.z = Math.sin(t * 1.4 - i * 0.5) * 0.07 * (1 - env);
    });
    this.tail.rotation.z = Math.sin(t * 6) * 0.4;
    this.base.rotation.z = Math.sin(t * 1.3) * 0.02;

    if (env > 0.5) {
      this.spray += dt;
      this.trunkTip.updateWorldMatrix(true, false);
      const pos = _v.setFromMatrixPosition(this.trunkTip.matrixWorld).clone();
      const dir = _v2.set(0, -1, 0).transformDirection(this.trunkTip.matrixWorld);
      while (this.spray > 0.012) {
        this.spray -= 0.012;
        fx.spawn({
          pos,
          vel: dir.clone().multiplyScalar(6 + Math.random() * 2).add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)),
          life: 1.4, size: 0.06 + Math.random() * 0.06, color: Math.random() < 0.5 ? 0x7fd3ff : 0xb9e8ff, gravity: -11,
        });
      }
    }
  }
  poke() {
    super.poke();
    audio.play('trumpet');
  }
}

/* ------------------------------------------------------------------ *
 *  Rocket
 * ------------------------------------------------------------------ */

class Rocket extends Character {
  constructor() {
    super();
    this.center = 2.4;
    this.hoverY = 1.25;
    const hull = toon(0xfff3e3);
    const red = toon(0xff5d73);
    const metal = toon(0xb7c0d8);

    this.ship = group(this.base, [0, this.hoverY, 0]);
    this.spin = group(this.ship);
    const s = this.spin;

    const profile = [[0.001, 0], [0.42, 0], [0.62, 0.35], [0.72, 1.0], [0.7, 1.7], [0.58, 2.25], [0.001, 2.27]];
    part(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 40), hull, { parent: s });
    part(GEO.cone, red, { p: [0, 2.72, 0], s: [0.585, 0.95, 0.585], parent: s });
    part(GEO.sphere, toon(0xffd166), { p: [0, 3.22, 0], s: 0.09, parent: s });
    part(GEO.cyl, red, { p: [0, 0.55, 0], s: [0.668, 0.16, 0.668], parent: s });

    const port = group(s, [0, 1.42, 0.68]);
    part(GEO.torus, metal, { s: [0.34, 0.34, 0.5], parent: port });
    part(GEO.sphere, toon(0x2b2f55), { p: [0, 0, -0.05], s: [0.33, 0.33, 0.1], parent: port });
    this.eye(port, 0.25, [0, 0, 0.02]);

    const fin = new THREE.Shape();
    fin.moveTo(0, 1.0);
    fin.lineTo(0.5, 0.35);
    fin.lineTo(0.62, -0.32);
    fin.lineTo(0.36, -0.22);
    fin.lineTo(0, 0.12);
    const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    finGeo.translate(0, 0, -0.05);
    for (const a of [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 - (2 * Math.PI) / 3]) {
      const g = group(s);
      g.rotation.y = a;
      part(finGeo, red, { p: [0.5, 0, 0], parent: g });
    }
    part(new THREE.CylinderGeometry(0.3, 0.4, 0.3, 28), metal, { p: [0, -0.12, 0], parent: s });

    this.flame = group(this.ship, [0, -0.27, 0]);
    part(GEO.cone, new THREE.MeshBasicMaterial({ color: 0xff8a3d }), { p: [0, -0.45, 0], r: [Math.PI, 0, 0], s: [0.3, 0.9, 0.3], parent: this.flame, shadow: false });
    part(GEO.cone, new THREE.MeshBasicMaterial({ color: 0xffe066 }), { p: [0, -0.3, 0], r: [Math.PI, 0, 0], s: [0.17, 0.6, 0.17], parent: this.flame, shadow: false });

    this.flight = null;
    this.smoke = 0;
  }
  animate(dt, t, ctx) {
    const ex = this.excite;
    let y = this.hoverY + Math.sin(t * 2.1) * 0.12;
    let thrust = 0.8 + ex * 0.7 + this.hoverAmt * 0.3;

    if (this.flight) {
      const f = this.flight;
      f.t += dt;
      if (f.phase === 'up') {
        y = this.hoverY + 8 * f.t * f.t;
        this.spin.rotation.y += dt * (5 + f.t * 12);
        thrust = 2.2;
        if (y > 28) { f.phase = 'down'; f.t = 0; }
      } else {
        const p = Math.min(1, f.t / 1.8);
        y = lerp(28, this.hoverY, easeOutBack(p));
        thrust = 1.3;
        if (p >= 1) this.flight = null;
      }
    }
    if (!this.flight) {
      const target = Math.round(this.spin.rotation.y / (Math.PI * 2)) * Math.PI * 2;
      this.spin.rotation.y += (target - this.spin.rotation.y) * damp(4, dt);
    }
    this.ship.position.y = y;

    this.face(this.ship, ctx.target, dt, 0.5, 0.18, 4);
    const lean = clamp(-(ctx.target.x - this.root.position.x) * 0.035, -0.22, 0.22);
    this.ship.rotation.z += (lean - this.ship.rotation.z) * damp(4, dt);
    if (ex > 0.3 && !this.flight) this.ship.position.x = (Math.random() - 0.5) * 0.03 * ex;

    const flick = 1 + Math.sin(t * 43) * 0.08 + Math.random() * 0.1;
    this.flame.scale.set(0.9 + thrust * 0.15, thrust * flick, 0.9 + thrust * 0.15);

    this.smoke += dt * (this.flight ? 60 : 2.5 + ex * 10);
    if (this.smoke >= 1) {
      this.flame.updateWorldMatrix(true, false);
      const pos = _v.setFromMatrixPosition(this.flame.matrixWorld).clone();
      pos.y -= 0.4;
      while (this.smoke >= 1) {
        this.smoke -= 1;
        fx.spawn({
          pos,
          vel: new THREE.Vector3((Math.random() - 0.5) * 1.6, -1.5 - Math.random() * 1.5, (Math.random() - 0.5) * 1.6),
          life: 1 + Math.random() * 0.5, size: this.flight ? 0.12 + Math.random() * 0.1 : 0.07 + Math.random() * 0.06, color: 0xffffff,
          gravity: 1.2, drag: 1.8, grow: this.flight ? 2.2 : 1.4, floor: true,
        });
      }
    }
  }
  poke() {
    super.poke();
    if (this.flight) return;
    this.flight = { phase: 'up', t: 0 };
    audio.play('whoosh');
  }
}

/* ------------------------------------------------------------------ *
 *  Duck
 * ------------------------------------------------------------------ */

class Duck extends Character {
  constructor() {
    super();
    this.center = 1.3;
    const yellow = toon(0xffd23f);
    const orange = toon(0xff9a3c);

    this.bod = group(this.base);
    const b = this.bod;
    for (const side of [-1, 1]) part(GEO.sphere, orange, { p: [side * 0.35, 0.05, 0.4], s: [0.24, 0.06, 0.32], parent: b });
    part(GEO.sphere, yellow, { p: [0, 0.85, -0.1], s: [0.88, 0.75, 1.02], parent: b });
    part(GEO.cone, yellow, { p: [0, 1.15, -1.0], r: [-0.95, 0, 0], s: [0.32, 0.6, 0.32], parent: b });

    this.wings = [-1, 1].map((side) => {
      const pivot = group(b, [side * 0.8, 1.05, -0.1]);
      part(GEO.sphere, toon(0xffc21a), { p: [0, -0.25, 0], s: [0.12, 0.34, 0.55], parent: pivot });
      pivot.userData.side = side;
      return pivot;
    });

    this.head = group(b, [0, 1.72, 0.35]);
    part(GEO.sphere, yellow, { s: 0.58, parent: this.head });
    part(GEO.sphere, orange, { p: [0, -0.07, 0.55], s: [0.3, 0.09, 0.3], parent: this.head });
    this.jaw = group(this.head, [0, -0.13, 0.32]);
    part(GEO.sphere, orange, { p: [0, -0.02, 0.2], s: [0.25, 0.06, 0.24], parent: this.jaw });
    for (const side of [-1, 1]) part(GEO.sphere, toon(0xff9ab8), { p: [side * 0.36, -0.12, 0.38], s: [0.1, 0.06, 0.05], parent: this.head, shadow: false });

    this.eye(this.head, 0.15, [-0.22, 0.16, 0.45]);
    this.eye(this.head, 0.15, [0.22, 0.16, 0.45]);

    // propeller beanie
    const cap = group(this.head, [0, 0.42, -0.02]);
    cap.rotation.x = -0.15;
    part(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x5b7cff), { s: [0.42, 0.3, 0.42], parent: cap });
    part(GEO.torus, toon(0xff5d73), { r: [Math.PI / 2, 0, 0], s: [0.42, 0.42, 0.25], parent: cap });
    part(GEO.cyl, toon(0xffd166), { p: [0, 0.38, 0], s: [0.04, 0.2, 0.04], parent: cap });
    this.prop = group(cap, [0, 0.48, 0]);
    part(GEO.box, toon(0xff5d73), { p: [0.3, 0, 0], r: [0.3, 0, 0], s: [0.55, 0.03, 0.14], parent: this.prop });
    part(GEO.box, toon(0x22b39a), { p: [-0.3, 0, 0], r: [-0.3, 0, 0], s: [0.55, 0.03, 0.14], parent: this.prop });
    part(GEO.sphere, toon(0xffd166), { s: 0.06, parent: this.prop });

    this.jumpT = 99;
  }
  animate(dt, t, ctx) {
    const ex = this.excite;
    const env = pokeEnv(this.pokeT, 1.0);
    this.face(this.head, ctx.target, dt, 0.8, 0.4, 7);

    this.bod.rotation.z = Math.sin(t * 3) * 0.06 * (1 + ex * 1.5);
    this.head.position.y = 1.72 + Math.abs(Math.sin(t * 3)) * 0.04;
    this.prop.rotation.y += dt * (3 + ex * 25 + env * 40);

    this.jumpT += dt;
    const jp = this.jumpT / 0.85;
    if (jp < 1) {
      this.bod.position.y = 4 * 1.5 * jp * (1 - jp);
      this.bod.rotation.y = smooth(jp) * Math.PI * 2;
    } else {
      this.bod.position.y = 0;
      this.bod.rotation.y = 0;
    }

    const flap = env > 0 ? Math.sin(t * 32) * 0.7 * env : ex * Math.sin(t * 14) * 0.15;
    for (const w of this.wings) w.rotation.z = w.userData.side * (0.12 + Math.max(0, flap) + env * 0.4);

    const q = this.pokeT;
    this.jaw.rotation.x = (q < 0.16 || (q > 0.19 && q < 0.35)) ? 0.45 : 0;
  }
  poke() {
    super.poke();
    if (this.jumpT > 0.85) this.jumpT = 0;
    audio.play('quack');
  }
}

/* ------------------------------------------------------------------ *
 *  UFO
 * ------------------------------------------------------------------ */

class Ufo extends Character {
  constructor() {
    super();
    this.hoverY = 3.1;
    this.center = 3.2;
    const mint = toon(0x7de3c4);
    const dark = toon(0x4a5a8a);
    const green = toon(0x9be564);

    this.craft = group(this.base, [0, this.hoverY, 0]);
    this.saucer = group(this.craft);
    part(GEO.sphere, mint, { s: [1.35, 0.3, 1.35], parent: this.saucer });
    part(GEO.sphere, dark, { p: [0, -0.17, 0], s: [0.7, 0.15, 0.7], parent: this.saucer });
    this.lights = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const m = part(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0xffffff }), { p: [Math.cos(a) * 1.16, -0.1, Math.sin(a) * 1.16], s: 0.09, parent: this.saucer, shadow: false });
      this.lights.push(m);
    }

    this.alien = group(this.craft, [0, 0.2, 0]);
    part(GEO.sphere, green, { p: [0, 0.32, 0], s: [0.42, 0.45, 0.4], parent: this.alien });
    for (const side of [-1, 1]) {
      part(GEO.cyl, green, { p: [side * 0.17, 0.85, 0], r: [0, 0, -side * 0.35], s: [0.025, 0.3, 0.025], parent: this.alien });
      part(GEO.sphere, toon(0xff6b9a), { p: [side * 0.23, 1.0, 0], s: 0.06, parent: this.alien });
    }
    this.eye(this.alien, 0.11, [-0.16, 0.38, 0.32]);
    this.eye(this.alien, 0.11, [0.16, 0.38, 0.32]);
    this.eye(this.alien, 0.09, [0, 0.6, 0.3]);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false })
    );
    dome.position.y = 0.12;
    dome.scale.y = 1.25;
    this.craft.add(dome);

    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.5, 1, 32, 1, true), this.beamMat);
    this.beam.visible = false;
    this.base.add(this.beam);

    this.spinV = 0;
    this.sparkle = 0;
  }
  animate(dt, t, ctx) {
    const ex = this.excite;
    const env = pokeEnv(this.pokeT, 2.0);
    const groundY = -this.root.userData.lift / this.root.scale.y;

    this.craft.position.y = this.hoverY + Math.sin(t * 1.6) * 0.2;
    this.craft.position.x = Math.sin(this.pokeT * 16) * 0.35 * env;
    this.craft.rotation.z = Math.sin(t * 1.1) * 0.08 + Math.sin(t * 9) * 0.05 * ex;
    this.saucer.rotation.y += dt * (0.6 + ex * 4 + env * 14);
    this.face(this.alien, ctx.target, dt, 0.9, 0.4, 6);

    this.lights.forEach((m, i) => m.material.color.setHSL((i / 10 + t * (0.25 + ex)) % 1, 0.9, 0.62));

    const beamH = this.craft.position.y - 0.2 - groundY;
    this.beam.visible = env > 0.01;
    this.beam.scale.set(1, beamH, 1);
    this.beam.position.set(this.craft.position.x, this.craft.position.y - 0.2 - beamH / 2, 0);
    this.beamMat.opacity = env * 0.4;

    if (env > 0.3) {
      this.sparkle += dt * 40;
      while (this.sparkle >= 1) {
        this.sparkle -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.9;
        this.root.updateWorldMatrix(true, false);
        const pos = new THREE.Vector3(Math.cos(a) * r + this.craft.position.x, groundY + 0.2, Math.sin(a) * r).applyMatrix4(this.root.matrixWorld);
        fx.spawn({ pos, vel: new THREE.Vector3(0, 2.5 + Math.random() * 2, 0), life: 1.1, size: 0.05 + Math.random() * 0.05, color: Math.random() < 0.5 ? 0xfff3a0 : 0xffffff, gravity: 0 });
      }
    }
  }
  poke() {
    super.poke();
    audio.play('bloop');
  }
}

/* ------------------------------------------------------------------ *
 *  Scene layout
 * ------------------------------------------------------------------ */

const rocket = new Rocket();
const elephant = new Elephant();
const duck = new Duck();
const ufo = new Ufo();
const chars = [rocket, elephant, duck, ufo];

const LAYOUTS = {
  // [x, z, lift, yaw] per character, in the order of `chars`
  wide: { width: 17, lookY: 3.6, camY: 5.4, scale: 1, spots: [[-6.3, -0.2, 0, 0.35], [-2.3, 0.5, 0, 0.15], [1.8, 0.8, 0, -0.15], [6, -0.6, 0.4, -0.3]] },
  tall: { width: 6.6, lookY: 4.4, camY: 7, scale: 0.9, spots: [[-1.55, -3.2, 2.6, 0.25], [-1.0, 1.4, 0, 0.15], [1.65, 1.9, 0, -0.2], [1.6, -3.6, 2.2, -0.2]] },
};

function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  renderer.setSize(w, h, false);
  camera.aspect = aspect;

  const L = aspect >= 1.05 ? LAYOUTS.wide : LAYOUTS.tall;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const dist = Math.max(16, L.width / 2 / (Math.tan(halfFov) * aspect));
  camera.position.set(0, L.camY + (dist - 16) * 0.12, dist);
  // Short, wide screens: tilt up a little so the crew sits below the headline.
  const shortBoost = L === LAYOUTS.wide ? clamp((aspect - 1.6) * 1.6, 0, 1) : 0;
  camera.lookAt(0, L.lookY + shortBoost + (dist - 16) * 0.08, 0);
  camera.updateProjectionMatrix();

  chars.forEach((c, i) => {
    const [x, z, lift, yaw] = L.spots[i];
    c.root.position.set(x, lift, z);
    c.root.rotation.y = yaw;
    c.root.scale.setScalar(L.scale);
    c.root.userData.lift = lift;
  });
}
layout();
window.addEventListener('resize', layout);

/* ------------------------------------------------------------------ *
 *  Pointer & interaction
 * ------------------------------------------------------------------ */

const raycaster = new THREE.Raycaster();
const pointer = { ndc: new THREE.Vector2(0, 0), active: false, lastMove: -99, type: 'mouse' };
const lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -5);
const ctx = { target: new THREE.Vector3(0, 3, 8) };
const desired = new THREE.Vector3();
const clock = new THREE.Clock();
let hovered = null;
let poked = false;

function setPointer(e) {
  pointer.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  pointer.active = true;
  pointer.type = e.pointerType;
  pointer.lastMove = clock.elapsedTime;
}

function pick() {
  raycaster.setFromCamera(pointer.ndc, camera);
  const hits = raycaster.intersectObjects(chars.map((c) => c.root), true);
  for (const hit of hits) {
    if (!hit.object.visible) continue;
    let o = hit.object;
    while (o && !o.userData.character) o = o.parent;
    if (o) return o.userData.character;
  }
  return null;
}

window.addEventListener('pointermove', setPointer, { passive: true });
document.documentElement.addEventListener('mouseleave', () => { pointer.active = false; });
window.addEventListener('blur', () => { pointer.active = false; });

canvas.addEventListener('pointerdown', (e) => {
  setPointer(e);
  const c = pick();
  if (!c) return;
  c.poke();
  if (!poked) { poked = true; hint.classList.add('gone'); }
});

/* ------------------------------------------------------------------ *
 *  Loop
 * ------------------------------------------------------------------ */

const motion = reduceMotion ? 0.35 : 1;

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const t = clock.elapsedTime * motion;
  const aspect = camera.aspect;

  const idle = !pointer.active || clock.elapsedTime - pointer.lastMove > 6;
  if (!idle) {
    raycaster.setFromCamera(pointer.ndc, camera);
    if (!raycaster.ray.intersectPlane(lookPlane, desired)) desired.set(0, 3, 5);
  } else {
    desired.set(Math.sin(t * 0.45) * 6, 3 + Math.sin(t * 0.7) * 1.5, 6 + Math.sin(t * 0.3) * 2);
  }
  ctx.target.lerp(desired, damp(idle ? 2 : 14, dt));

  const now = pointer.active && pointer.type === 'mouse' ? pick() : null;
  if (now !== hovered) {
    if (now) now.hoverStart();
    if (hovered) hovered.hovered = false;
    hovered = now;
    if (hovered) hovered.hovered = true;
    canvas.style.cursor = hovered ? 'pointer' : '';
  }

  for (const c of chars) {
    let want = 0;
    if (!idle) {
      _v.copy(c.root.position);
      _v.y += c.center * c.root.scale.y;
      _v.project(camera);
      const d = Math.hypot((_v.x - pointer.ndc.x) * aspect, _v.y - pointer.ndc.y);
      want = clamp(1 - d / 0.7, 0, 1);
    }
    if (c.hovered) want = 1;
    c.excite += (want - c.excite) * damp(5, dt);
    c.update(dt * motion, t, ctx);
  }

  fx.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
