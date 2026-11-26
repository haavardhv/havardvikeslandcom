// Characters and props built from primitives: people, seagulls, e-scooters,
// pickups and the objective marker.
import * as THREE from '../vendor/three.module.min.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const box = (w, h, d, m) => { const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); x.castShadow = true; return x; };

export class Humanoid {
  constructor({ jacket = 0xf2c12e, pants = 0x2b3140, skin = 0xe8c4a6, hat = 0xb3261e, hair = 0x5a3a22, umbrella = null, boots = 0x1b1b1b, scale = 1 } = {}) {
    this.root = new THREE.Group();
    const body = new THREE.Group();
    body.scale.setScalar(scale);
    this.root.add(body);
    this.body = body;
    const mJ = mat(jacket, { roughness: 0.45 }), mP = mat(pants), mS = mat(skin), mB = mat(boots, { roughness: 0.4 });
    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.11 * s, 0.9, 0);
      const leg = box(0.17, 0.82, 0.19, mP); leg.position.y = -0.41;
      const boot = box(0.19, 0.12, 0.3, mB); boot.position.set(0, -0.84, 0.04);
      hip.add(leg, boot);
      body.add(hip);
      this.legs.push(hip);
    }
    // torso: raincoat with a hood folded at the back
    const torso = new THREE.Group();
    torso.position.y = 0.9;
    body.add(torso);
    this.torso = torso;
    const coat = box(0.48, 0.66, 0.28, mJ); coat.position.y = 0.33;
    const hem = box(0.5, 0.16, 0.3, mJ); hem.position.y = 0.02;
    const hood = box(0.32, 0.14, 0.12, mJ); hood.position.set(0, 0.62, -0.16);
    torso.add(coat, hem, hood);
    // zip line
    const zip = box(0.02, 0.6, 0.01, mat(0x333333)); zip.position.set(0, 0.33, 0.145);
    torso.add(zip);
    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(0.31 * s, 0.6, 0);
      const arm = box(0.14, 0.58, 0.15, mJ); arm.position.y = -0.27;
      const hand = box(0.11, 0.12, 0.12, mS); hand.position.y = -0.62;
      sh.add(arm, hand);
      torso.add(sh);
      this.arms.push(sh);
    }
    // head
    const head = new THREE.Group();
    head.position.y = 0.72;
    torso.add(head);
    this.head = head;
    const face = box(0.27, 0.3, 0.27, mS); face.position.y = 0.15;
    const hairM = box(0.29, 0.1, 0.29, mat(hair)); hairM.position.set(0, 0.24, -0.01);
    const eyeM = mat(0x111111);
    for (const s of [-1, 1]) { const e = box(0.04, 0.04, 0.01, eyeM); e.position.set(0.065 * s, 0.17, 0.137); head.add(e); }
    head.add(face, hairM);
    if (hat !== null) {
      const beanie = box(0.3, 0.14, 0.3, mat(hat, { roughness: 1 })); beanie.position.y = 0.32;
      const pom = box(0.09, 0.08, 0.09, mat(0xf3f2ee, { roughness: 1 })); pom.position.y = 0.43;
      const fold = box(0.31, 0.06, 0.31, mat(hat, { roughness: 1 })); fold.position.y = 0.26;
      head.add(beanie, pom, fold);
    }
    // umbrella held in the right hand
    if (umbrella !== null) {
      const u = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), mat(0x222222));
      pole.position.y = 0.45;
      const can = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.28, 8, 1, true), mat(umbrella, { roughness: 0.5, side: THREE.DoubleSide }));
      can.position.y = 0.98; can.castShadow = true;
      u.add(pole, can);
      u.position.set(0, -0.62, 0.06);
      this.arms[1].add(u);
      this.umbrella = u;
    }
    this.phase = Math.random() * 10;
    this.punchT = 0;
    this.state = 'idle';
  }
  // speed in m/s, state: idle | walk | jump | ride | down | sit | wave
  animate(dt, speed, state, grounded = true) {
    this.phase += dt * (2.2 + speed * 1.35);
    const s = Math.sin(this.phase);
    const amp = Math.min(1, speed / 6) * 0.9 + (speed > 0.2 ? 0.15 : 0);
    let lL = 0, lR = 0, aL = 0, aR = 0, lean = 0, bob = 0, aLz = 0, aRz = 0;
    if (state === 'ride') {
      lL = -0.05; lR = 0.25; aL = -1.0; aR = -1.0; aLz = 0.15; aRz = -0.15; lean = 0.12;
    } else if (state === 'sit') {
      lL = lR = -1.5; aL = aR = -0.4; lean = -0.05;
    } else if (state === 'down') {
      lL = lR = 0.1; aL = aR = -2.6; lean = 1.45;
    } else if (!grounded) {
      lL = -0.6; lR = 0.3; aL = -2.2; aR = -2.0; aLz = 0.3; aRz = -0.3;
    } else if (speed > 0.15) {
      lL = s * amp; lR = -s * amp; aL = -s * amp * 0.9; aR = s * amp * 0.9; lean = Math.min(0.25, speed * 0.03);
      bob = Math.abs(Math.cos(this.phase)) * 0.05 * amp;
    } else {
      aL = Math.sin(this.phase * 0.3) * 0.03; aR = -aL;
    }
    if (this.umbrella) { aR = -0.35; aRz = -0.1; }
    if (state === 'wave') { aR = -2.8 + Math.sin(this.phase * 3) * 0.3; aRz = -0.3; }
    if (this.punchT > 0) {
      this.punchT -= dt;
      const k = Math.sin(Math.min(1, this.punchT / 0.28) * Math.PI);
      aR = -1.6 * k + aR * (1 - k);
      lean += 0.15 * k;
      this.torso.rotation.y = -0.4 * k;
    } else this.torso.rotation.y *= 0.8;
    const L = (a, b) => a + (b - a) * Math.min(1, dt * 14);
    this.legs[0].rotation.x = L(this.legs[0].rotation.x, lL);
    this.legs[1].rotation.x = L(this.legs[1].rotation.x, lR);
    this.arms[0].rotation.x = L(this.arms[0].rotation.x, aL);
    this.arms[1].rotation.x = L(this.arms[1].rotation.x, aR);
    this.arms[0].rotation.z = L(this.arms[0].rotation.z, aLz - 0.06);
    this.arms[1].rotation.z = L(this.arms[1].rotation.z, aRz + 0.06);
    this.body.rotation.x = L(this.body.rotation.x, lean);
    this.body.position.y = state === 'sit' ? -0.45 : state === 'down' ? 0.16 : bob;
  }
  punch() { this.punchT = 0.28; }
}

// ---------------------------------------------------------------------------
const gullMats = {
  white: mat(0xf4f4f2, { roughness: 0.9 }),
  grey: mat(0xa9b1b8, { roughness: 0.9 }),
  black: mat(0x1b1b1b),
  beak: mat(0xf0c419, { roughness: 0.5 }),
  red: mat(0xd2301f),
};
export class Gull {
  constructor() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), gullMats.white);
    body.scale.set(0.85, 0.8, 2.1);
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), gullMats.white);
    head.position.set(0, 0.1, 0.38);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 5), gullMats.beak);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.08, 0.53);
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 4, 3), gullMats.red);
    spot.position.set(0, 0.05, 0.56);
    const eyeG = new THREE.SphereGeometry(0.018, 4, 3);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(eyeG, gullMats.black); e.position.set(0.08 * s, 0.15, 0.44); g.add(e); }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.2), gullMats.black);
    tail.position.set(0, 0.02, -0.44);
    g.add(body, head, beak, spot, tail);
    this.wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(0.12 * s, 0.06, 0.02);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.3), gullMats.grey);
      inner.position.x = 0.21 * s; inner.castShadow = true;
      const outerG = new THREE.Group();
      outerG.position.x = 0.42 * s;
      const outer = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.22), gullMats.grey);
      outer.position.set(0.18 * s, 0, -0.03);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.022, 0.18), gullMats.black);
      tip.position.set(0.42 * s, 0, -0.05);
      outerG.add(outer, tip);
      w.add(inner, outerG);
      g.add(w);
      this.wings.push({ w, outerG, s });
    }
    // legs for standing
    this.legs = new THREE.Group();
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), gullMats.beak); l.position.set(0.05 * s, -0.22, 0); this.legs.add(l); }
    g.add(this.legs);
    this.root = g;
    this.phase = Math.random() * 6;
  }
  // flap: 0 glide .. 1 hard flapping; ground: standing on the ground
  animate(dt, flap, ground = false) {
    this.phase += dt * (6 + flap * 10);
    this.legs.visible = ground;
    for (const { w, outerG, s } of this.wings) {
      if (ground) { w.rotation.z = -s * 1.35; outerG.rotation.z = s * 2.6; w.rotation.y = -s * 0.25; continue; }
      w.rotation.y = 0;
      const a = flap > 0.05 ? Math.sin(this.phase) * 0.7 * flap + 0.1 : 0.06 + Math.sin(this.phase * 0.2) * 0.04;
      w.rotation.z = a * s;
      outerG.rotation.z = (flap > 0.05 ? Math.sin(this.phase - 0.8) * 0.5 * flap : -0.05) * s;
    }
  }
}

// ---------------------------------------------------------------------------
export function makeScooter() {
  const g = new THREE.Group();
  const deckM = mat(0x22272b, { roughness: 0.5 }), bodyM = mat(0x2bb673, { roughness: 0.35 }), tyreM = mat(0x111111);
  const deck = box(0.2, 0.06, 0.95, deckM); deck.position.set(0, 0.13, 0);
  const strip = box(0.21, 0.02, 0.6, bodyM); strip.position.set(0, 0.17, -0.05);
  const stem = box(0.06, 1.05, 0.06, bodyM); stem.position.set(0, 0.62, 0.45); stem.rotation.x = -0.18;
  const bar = box(0.55, 0.05, 0.05, deckM); bar.position.set(0, 1.12, 0.54);
  const lamp = box(0.08, 0.06, 0.04, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 })); lamp.position.set(0, 0.95, 0.53);
  g.add(deck, strip, stem, bar, lamp);
  for (const z of [-0.45, 0.48]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12), tyreM);
    w.rotation.z = Math.PI / 2; w.position.set(0, 0.11, z); w.castShadow = true;
    g.add(w);
  }
  return g;
}

// ---------------------------------------------------------------------------
export function makeItem(kind) {
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  switch (kind) {
    case 'laptop': {
      add(new THREE.BoxGeometry(0.34, 0.02, 0.24), mat(0xb8bcc2, { metalness: 0.6, roughness: 0.3 }), 0, 0.01, 0);
      const s = add(new THREE.BoxGeometry(0.34, 0.24, 0.015), mat(0xb8bcc2, { metalness: 0.6, roughness: 0.3 }), 0, 0.13, -0.12);
      s.rotation.x = -0.25;
      const sc = add(new THREE.PlaneGeometry(0.3, 0.2), mat(0x7fb6ff, { emissive: 0x3a6fd0, emissiveIntensity: 0.8 }), 0, 0.13, -0.11);
      sc.rotation.x = -0.25;
      break;
    }
    case 'candle': {
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), mat(0xf6f1e4), -0.08, 0.06, 0);
      add(new THREE.SphereGeometry(0.018, 6, 4), mat(0xffd27a, { emissive: 0xffa630, emissiveIntensity: 3 }), -0.08, 0.15, 0);
      add(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 8), mat(0xe6eef0, { roughness: 0.1, transparent: true, opacity: 0.6 }), 0.07, 0.08, 0);
      for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(0.035, 6, 4), mat([0xf2a33a, 0xf7e2b5, 0xe58e3c][i % 3]), 0.07 + Math.cos(i * 1.3) * 0.04, 0.2 + (i % 2) * 0.03, Math.sin(i * 1.3) * 0.04);
      break;
    }
    case 'cushion': {
      const c = add(new THREE.BoxGeometry(0.42, 0.14, 0.42), mat(0x3c5d8a, { roughness: 1 }), 0, 0.07, 0);
      c.scale.set(1, 1, 1);
      add(new THREE.BoxGeometry(0.38, 0.13, 0.38), mat(0x3c5d8a, { roughness: 1 }), 0.05, 0.19, 0.03).rotation.y = 0.4;
      break;
    }
    case 'plant': {
      add(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 8), mat(0xf3f2ee), 0, 0.06, 0);
      for (let i = 0; i < 7; i++) {
        const l = add(new THREE.SphereGeometry(0.06, 6, 4), mat(0x3f8a3a), Math.cos(i) * 0.09, 0.14 + (i % 3) * 0.05, Math.sin(i * 2) * 0.09);
        l.scale.set(1.3, 0.5, 0.9);
      }
      break;
    }
    case 'book': {
      add(new THREE.BoxGeometry(0.3, 0.04, 0.22), mat(0x2f5d8a), 0, 0.02, 0);
      add(new THREE.BoxGeometry(0.29, 0.03, 0.21), mat(0xf3eedd), 0.005, 0.02, 0);
      add(new THREE.CylinderGeometry(0.03, 0.025, 0.12, 8), mat(0xe6eef0, { roughness: 0.1, transparent: true, opacity: 0.6 }), 0.2, 0.06, 0.05);
      add(new THREE.SphereGeometry(0.04, 6, 4), mat(0xe27fa0), 0.2, 0.15, 0.05);
      break;
    }
    case 'router': {
      add(new THREE.BoxGeometry(0.26, 0.05, 0.16), mat(0x1c1d20), 0, 0.025, 0);
      for (const x of [-0.09, 0.09]) add(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 4), mat(0x1c1d20), x, 0.13, -0.07);
      for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.015, 0.01, 0.01), mat(0x46e37a, { emissive: 0x46e37a, emissiveIntensity: 2 }), -0.06 + i * 0.04, 0.05, 0.08);
      break;
    }
    case 'bolle': {
      const b = add(new THREE.CylinderGeometry(0.13, 0.15, 0.09, 14), mat(0xc0813f, { roughness: 0.8 }), 0, 0.045, 0);
      b.scale.set(1, 1, 1);
      const sw = add(new THREE.TorusGeometry(0.07, 0.025, 6, 14), mat(0x8a4f22), 0, 0.09, 0);
      sw.rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.1, 0.12, 0.012, 14), mat(0xf6efe2, { roughness: 1 }), 0, 0.093, 0);
      break;
    }
    case 'umbrella': {
      const c = add(new THREE.ConeGeometry(0.09, 0.75, 8), mat(0xd23a2b, { roughness: 0.5 }), 0, 0.45, 0);
      c.rotation.z = Math.PI;
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5), mat(0x222222), 0, 0.45, 0);
      const hdl = add(new THREE.TorusGeometry(0.05, 0.014, 5, 10, Math.PI), mat(0x4a3424), 0.05, 0.0, 0);
      hdl.rotation.z = Math.PI;
      break;
    }
  }
  return g;
}

// Objective marker: a tall soft beam with a ring at the base
export function makeMarker(color = 0xffcf3a) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 14, 24, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false })
  );
  beam.position.y = 7;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 0.95, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  g.add(beam, ring);
  g.renderOrder = 5;
  g.userData = { beam, ring };
  return g;
}

// A small bobbing arrow over pickups
export function makeArrow(color = 0xffcf3a) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 4), new THREE.MeshBasicMaterial({ color, fog: false }));
  m.rotation.x = Math.PI;
  return m;
}
