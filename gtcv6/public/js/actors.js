// Characters and props built from primitives: people, seagulls, e-scooters,
// pickups and the objective marker.
import * as THREE from '../vendor/three.module.min.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const box = (w, h, d, m) => { const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); x.castShadow = true; return x; };

// The people who live at Cappes vei 6, from their photos (public/img/people)
export const PEOPLE = {
  havard:  { name: 'Håvard',  hair: '#6a5039', skin: '#d9ab95', shirt: '#8a7666', sleeve: 'long',  sleeveCol: '#8a7666', pants: '#2b3140' },
  oystein: { name: 'Øystein', hair: '#7c5f40', skin: '#e2ad97', shirt: '#141418', sleeve: 'short', sleeveCol: '#141418', pants: '#3b3b3b' },
  theodor: { name: 'Theodor', hair: '#3b2b21', skin: '#e7b4a4', shirt: '#2a211e', sleeve: 'short', sleeveCol: '#2a211e', pants: '#26292e' },
  martin:  { name: 'Martin',  hair: '#b89466', skin: '#e2a593', shirt: '#d9d1c6', sleeve: 'long',  sleeveCol: '#d9d1c6', pants: '#4a4f5a' },
  jaakko:  { name: 'Jaakko',  hair: '#e3cf98', skin: '#eab5a0', shirt: '#1d2026', sleeve: 'long',  sleeveCol: '#e8e8ea', pants: '#1d1d1d' },
};
// ---------------------------------------------------------------------------
// People: one skinned mesh each (one draw call), shaped from capsules and
// spheres with real proportions, elbows and knees, and a per-person texture
// atlas: their photo face projected onto a rounded head, their shirt on the
// chest, solid colour swatches for everything else.
const ATLAS = 512;
const FACE = { x: 0, y: 0, w: 224, h: 256 };
const SHIRT = { x: 256, y: 0, w: 256, h: 256 };
const SW = i => [(16 + (i % 10) * 48 + 20) / ATLAS, 1 - (300 + Math.floor(i / 10) * 48 + 20) / ATLAS];
const SWATCH = { skin: 0, hair: 1, shirt: 2, sleeve: 3, pants: 4, shoes: 5, jacket: 6, hat: 7, white: 8, lips: 9, iris: 10 };
const imgCache = new Map();
function loadImg(url) {
  if (!imgCache.has(url)) imgCache.set(url, new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }));
  return imgCache.get(url);
}
function makeAtlas(look, person) {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS;
  const g = c.getContext('2d');
  g.fillStyle = look.shirt; g.fillRect(0, 0, ATLAS, ATLAS);
  const sw = (i, col) => { g.fillStyle = col; g.fillRect(16 + (i % 10) * 48, 300 + Math.floor(i / 10) * 48, 40, 40); };
  sw(SWATCH.skin, look.skin); sw(SWATCH.hair, look.hair); sw(SWATCH.shirt, look.shirt); sw(SWATCH.sleeve, look.sleeve);
  sw(SWATCH.pants, look.pants); sw(SWATCH.shoes, look.shoes); sw(SWATCH.jacket, look.jacket || look.shirt); sw(SWATCH.hat, look.hat || look.hair);
  sw(SWATCH.white, '#f2f0ea'); sw(SWATCH.lips, '#b86a62'); sw(SWATCH.iris, '#3b4652');
  // a drawn face for people without a photo
  const drawFace = () => {
    const { x, y, w, h } = FACE;
    g.fillStyle = look.skin; g.fillRect(x, y, w, h);
    g.fillStyle = look.hair;
    g.beginPath(); g.ellipse(x + w / 2, y + h * 0.1, w * 0.62, h * 0.32, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(x, y, w * 0.12, h * 0.55); g.fillRect(x + w * 0.88, y, w * 0.12, h * 0.55);
    for (const s of [-1, 1]) {
      const ex = x + w / 2 + s * w * 0.18, ey = y + h * 0.47;
      g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(ex, ey, w * 0.075, h * 0.03, 0, 0, 7); g.fill();
      g.fillStyle = '#3b4652'; g.beginPath(); g.arc(ex, ey, h * 0.022, 0, 7); g.fill();
      g.strokeStyle = look.hair; g.lineWidth = 5; g.beginPath(); g.moveTo(ex - w * 0.09, ey - h * 0.06); g.lineTo(ex + w * 0.08, ey - h * 0.065); g.stroke();
    }
    g.strokeStyle = 'rgba(120,70,50,0.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + w / 2, y + h * 0.5); g.lineTo(x + w / 2 - 6, y + h * 0.63); g.lineTo(x + w / 2 + 6, y + h * 0.64); g.stroke();
    if (look.night) {
      // eye shadow, lashes and red lips
      for (const s of [-1, 1]) {
        const ex = x + w / 2 + s * w * 0.18, ey = y + h * 0.47;
        g.fillStyle = 'rgba(150,60,170,0.55)'; g.beginPath(); g.ellipse(ex, ey - h * 0.03, w * 0.09, h * 0.035, 0, Math.PI, 0); g.fill();
        g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.ellipse(ex, ey, w * 0.08, h * 0.032, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      }
      g.fillStyle = '#c4122e'; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.745, w * 0.11, h * 0.028, 0, 0, Math.PI * 2); g.fill();
    } else {
      g.strokeStyle = '#a5625a'; g.lineWidth = 6; g.beginPath(); g.moveTo(x + w * 0.4, y + h * 0.74); g.quadraticCurveTo(x + w / 2, y + h * 0.77, x + w * 0.6, y + h * 0.74); g.stroke();
    }
  };
  drawFace();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (person) {
    Promise.all([loadImg(`/img/people/${person}-face.jpg`), loadImg(`/img/people/${person}-shirt.jpg`)]).then(([face, shirt]) => {
      if (face) g.drawImage(face, FACE.x, FACE.y, FACE.w, FACE.h);
      if (shirt) {
        // the photo of the chest, faded into the shirt colour at the sides
        const o = document.createElement('canvas'); o.width = SHIRT.w; o.height = SHIRT.h;
        const og = o.getContext('2d');
        og.drawImage(shirt, shirt.width * 0.12, shirt.height * 0.2, shirt.width * 0.76, shirt.height * 0.5, 0, 0, SHIRT.w, SHIRT.h);
        og.globalCompositeOperation = 'destination-in';
        const gr = og.createLinearGradient(0, 0, SHIRT.w, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.2, 'rgba(0,0,0,1)'); gr.addColorStop(0.8, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        og.fillStyle = gr; og.fillRect(0, 0, SHIRT.w, SHIRT.h);
        g.drawImage(o, SHIRT.x, SHIRT.y);
      }
      tex.needsUpdate = true;
    });
  }
  return tex;
}

export class Humanoid {
  // night: { top, skirt, boots, boa } dresses a woman for a night on the corner: bare arms and legs,
  // a short skirt, knee boots, a boa, long hair, make-up, earrings and a handbag
  constructor({ jacket = 0xf2c12e, pants = 0x2b3140, skin = 0xe8c4a6, hat = 0xb3261e, hair = 0x5a3a22, umbrella = null, boots = 0x1b1b1b, scale = 1, person = null, night = null } = {}) {
    const hex = v => typeof v === 'number' ? '#' + v.toString(16).padStart(6, '0') : v;
    const P = person ? PEOPLE[person] : null;
    const look = P
      ? { skin: P.skin, hair: P.hair, shirt: P.shirt, sleeve: P.sleeveCol, pants: P.pants, shoes: '#2a2522', short: P.sleeve === 'short', coat: false, hat: null }
      : { skin: hex(skin), hair: hex(hair), shirt: hex(jacket), sleeve: hex(jacket), pants: hex(pants), shoes: hex(boots), jacket: hex(jacket), short: false, coat: true, hat: hat === null ? null : hex(hat) };
    if (night) Object.assign(look, { shirt: hex(night.top), sleeve: look.skin, pants: hex(night.skirt), shoes: hex(night.boots), jacket: hex(night.boa), short: true, coat: false, hat: null, night: true });
    if (P) this.name = P.name;
    this.root = new THREE.Group();

    // ---- skeleton
    const B = (name, x, y, z, parent) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) parent.add(b); return b; };
    const body = B('body', 0, 0, 0);
    const torso = B('torso', 0, 0.92, 0, body);
    const head = B('head', 0, 0.6, 0, torso);
    const hips = [B('hipR', -0.095, 0.92, 0, body), B('hipL', 0.095, 0.92, 0, body)];
    const knees = [B('kneeR', 0, -0.44, 0, hips[0]), B('kneeL', 0, -0.44, 0, hips[1])];
    const shoulders = [B('shR', -0.2, 0.52, 0, torso), B('shL', 0.2, 0.52, 0, torso)];
    const elbows = [B('elR', 0, -0.29, 0, shoulders[0]), B('elL', 0, -0.29, 0, shoulders[1])];
    const bones = [body, torso, head, ...hips, ...knees, ...shoulders, ...elbows];
    const bi = b => bones.indexOf(b);

    // ---- geometry
    const pos = [], nrm = [], uv = [], si = [], swt = [];
    const v3 = new THREE.Vector3(), n3 = new THREE.Vector3();
    const add = (geo, matrix, bone, uvFn) => {
      const gg = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
      const P2 = gg.attributes.position, N2 = gg.attributes.normal;
      const b = bi(bone);
      for (let i = 0; i < P2.count; i++) {
        v3.fromBufferAttribute(P2, i); n3.fromBufferAttribute(N2, i);
        pos.push(v3.x, v3.y, v3.z); nrm.push(n3.x, n3.y, n3.z);
        const t = uvFn(v3, n3); uv.push(t[0], t[1]);
        si.push(b, 0, 0, 0); swt.push(1, 0, 0, 0);
      }
    };
    const M = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    const solid = i => () => SW(i);
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
    // a limb segment: tapered, with rounded ends
    const limb = (r0, r1, l) => {
      const pts = [];
      for (let k = 0; k <= 4; k++) { const a = k / 4 * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r1, -l / 2 - Math.cos(a) * r1)); }
      for (let k = 4; k >= 0; k--) { const a = k / 4 * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r0, l / 2 + Math.cos(a) * r0)); }
      return new THREE.LatheGeometry(pts, 8);
    };
    // head: the face is projected from the front; the back and top are hair
    const HY = 1.665, HR = 0.115;
    const skull = new THREE.SphereGeometry(HR, 18, 14);
    {
      // taper the lower half into a jaw and chin
      const a = skull.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const y = a.getY(i) / HR;
        if (y < 0.1) { const k = 1 - 0.28 * Math.min(1, (0.1 - y) / 1.1); a.setX(i, a.getX(i) * k); a.setZ(i, a.getZ(i) * (0.92 + 0.08 * k)); }
      }
      skull.computeVertexNormals();
    }
    add(skull, M(0, HY, 0, 0.9, 1.12, 1.0), head, (p, n) => {
      const x = p.x, y = p.y - HY, z = p.z;
      if (z > -0.015) {
        const u = 0.5 + x / (2 * HR * 0.9) * 0.98, v = 0.5 - y / (2 * HR * 1.12) * 0.98;
        return [(FACE.x + u * FACE.w) / ATLAS, 1 - (FACE.y + v * FACE.h) / ATLAS];
      }
      return SW(y > -0.035 ? SWATCH.hair : SWATCH.skin);
    });
    // hair over the top and back
    add(new THREE.SphereGeometry(HR * 1.07, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M(0, HY + 0.008, -0.016, 0.92, 1.12, 1.02, -0.42), head, solid(SWATCH.hair));
    if (look.night) {
      // long hair down the back and over the shoulders
      add(new THREE.SphereGeometry(HR, 14, 10), M(0, HY - 0.13, -0.07, 1.05, 2.0, 0.62), head, solid(SWATCH.hair));
      for (const s of [-1, 1]) add(new THREE.SphereGeometry(HR * 0.5, 8, 8), M(s * HR * 0.85, HY - 0.1, -0.02, 0.7, 2.2, 0.8), head, solid(SWATCH.hair));
    }
    if (look.hat) add(new THREE.SphereGeometry(HR * 1.12, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), M(0, HY + 0.02, -0.005, 0.95, 1.15, 1.02, -0.15), head, solid(SWATCH.hat));
    // ears and neck
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.022, 6, 6), M(s * HR * 0.9, HY - 0.005, -0.005, 0.5, 1.2, 0.9), head, solid(SWATCH.skin));
    add(new THREE.CylinderGeometry(0.048, 0.056, 0.14, 10), M(0, 1.52, -0.005), head, solid(SWATCH.skin));
    // the trunk: one turned profile from the hips to the base of the neck (radius, height)
    const prof = [[0.0, 0.83], [0.11, 0.84], [0.165, 0.9], [0.168, 0.98], [0.148, 1.06], [0.142, 1.12], [0.152, 1.2], [0.168, 1.3], [0.178, 1.39], [0.165, 1.45], [0.12, 1.5], [0.06, 1.53], [0.0, 1.535]];
    const trunk = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 14);
    const WAIST = 1.04;
    add(trunk, M(0, 0, 0, 1.12, 1, 0.66), torso, (p, n) => {
      if (p.y < WAIST && !look.coat) return SW(SWATCH.pants);
      if (n.z > 0.3 && !look.coat && p.y > 1.08 && p.y < 1.46) {
        const u = 0.5 + p.x / 0.34, v = (1.46 - p.y) / 0.38;
        return [(SHIRT.x + Math.min(1, Math.max(0, u)) * SHIRT.w) / ATLAS, 1 - (SHIRT.y + Math.min(1, Math.max(0, v)) * SHIRT.h) / ATLAS];
      }
      return SW(look.coat ? SWATCH.jacket : SWATCH.shirt);
    });
    if (look.night) {
      // a short flared skirt and a feather boa
      add(new THREE.CylinderGeometry(0.168, 0.235, 0.22, 16), M(0, 0.9, 0, 1.08, 1, 0.74), torso, solid(SWATCH.pants));
      add(new THREE.TorusGeometry(0.115, 0.045, 7, 18), M(0, 1.47, 0.0, 1.15, 1, 0.82, Math.PI / 2 - 0.25), torso, solid(SWATCH.jacket));
    }
    // shoulder caps
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.062, 10, 8), M(s * 0.185, 1.415, 0, 1, 0.9, 0.95), torso, solid(look.coat ? SWATCH.jacket : SWATCH.shirt));
    if (look.coat) {
      add(new THREE.CylinderGeometry(0.19, 0.21, 0.34, 14, 1, true), M(0, 0.92, 0, 1.05, 1, 0.7), torso, solid(SWATCH.jacket));
      add(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0, 1.47, -0.08, 1.4, 0.7, 0.9, -1.2), torso, solid(SWATCH.jacket));   // hood
    }
    // arms
    for (let k = 0; k < 2; k++) {
      const sh = shoulders[k], el = elbows[k], sx = sh.position.x;
      const shY = 0.92 + 0.52, elY = shY - 0.29;
      if (look.short) {
        add(limb(0.06, 0.056, 0.07), M(sx, shY - 0.06, 0), sh, solid(SWATCH.sleeve));
        add(limb(0.047, 0.038, 0.2), M(sx, shY - 0.16, 0), sh, solid(SWATCH.skin));
      } else add(limb(0.054, 0.042, 0.22), M(sx, shY - 0.14, 0), sh, solid(SWATCH.sleeve));
      add(limb(0.041, 0.031, 0.2), M(sx, elY - 0.12, 0), el, solid(look.short ? SWATCH.skin : SWATCH.sleeve));
      add(new THREE.SphereGeometry(0.044, 8, 8), M(sx, elY - 0.285, 0.008, 0.62, 1.3, 0.42), el, solid(SWATCH.skin));
      add(new THREE.SphereGeometry(0.018, 6, 6), M(sx + (sx > 0 ? -0.02 : 0.02), elY - 0.27, 0.03, 0.8, 1.6, 0.8), el, solid(SWATCH.skin));
    }
    // legs
    for (let k = 0; k < 2; k++) {
      const hp = hips[k], kn = knees[k], x = hp.position.x;
      add(limb(0.082, 0.056, 0.32), M(x, 0.92 - 0.22, 0), hp, solid(look.night ? SWATCH.skin : SWATCH.pants));
      add(limb(look.night ? 0.06 : 0.055, 0.042, 0.32), M(x, 0.48 - 0.21, -0.005), kn, solid(look.night ? SWATCH.shoes : SWATCH.pants));
      add(limb(0.045, 0.05, 0.14), M(x, 0.05, 0.05, 1, 1, 0.68, Math.PI / 2), kn, solid(SWATCH.shoes));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(swt, 4));
    geo.computeBoundingSphere();
    const atlasTex = makeAtlas(look, person);
    // the women on the corners glow a little, so their outfits read in the dark under the lamps
    const material = new THREE.MeshStandardMaterial(look.night
      ? { map: atlasTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: atlasTex, emissiveIntensity: 0.5 }
      : { map: atlasTex, roughness: 0.88 });
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.add(body);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.mesh = mesh;
    const holder = new THREE.Group();
    holder.scale.setScalar(scale);
    holder.add(mesh);
    this.root.add(holder);

    this.body = body; this.torso = torso; this.head = head;
    this.legs = hips; this.knees = knees; this.arms = shoulders; this.elbows = elbows;
    // umbrella in the right hand
    if (umbrella !== null) {
      const u = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), mat(0x222222));
      pole.position.y = 0.45;
      const can = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.28, 8, 1, true), mat(umbrella, { roughness: 0.5, side: THREE.DoubleSide }));
      can.position.y = 0.98; can.castShadow = true;
      u.add(pole, can);
      u.position.set(0, -0.3, 0.05);
      elbows[1].add(u);
      this.umbrella = u;
    }
    if (look.night) {
      // a handbag on the left arm and gold hoops
      const gold = mat(0xd9b13b, { roughness: 0.3, metalness: 0.8 });
      const bag = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.19), mat(night.bag || 0x141414, { roughness: 0.35 }));
      body.position.set(0.03, -0.37, 0.02); body.castShadow = true;
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 4, 10, Math.PI), gold);
      strap.position.set(0.03, -0.3, 0.02); strap.rotation.y = Math.PI / 2;
      bag.add(body, strap);
      elbows[1].add(bag);
      for (const sx of [-1, 1]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 4, 12), gold);
        hoop.position.set(sx * HR * 0.92, HY - 0.05 - 0.92 - 0.6, 0); hoop.rotation.y = Math.PI / 2;
        head.add(hoop);
      }
    }
    this.phase = Math.random() * 10;
    this.punchT = 0;
    this.aim = null;          // { pitch, yaw }: the right arm points the pistol (pitch up, yaw relative to the body)
    this.recoilT = 0;
    this.state = 'idle';
  }
  // speed in m/s, state: idle | walk | jump | ride | down | sit | wave
  animate(dt, speed, state, grounded = true) {
    this.phase += dt * (2.2 + speed * 1.35);
    const s = Math.sin(this.phase);
    const amp = Math.min(1, speed / 6) * 0.75 + (speed > 0.2 ? 0.12 : 0);
    let lL = 0, lR = 0, aL = 0, aR = 0, lean = 0, bob = 0, aLz = 0, aRz = 0, kL = 0.05, kR = 0.05, eL = -0.18, eR = -0.18;
    if (state === 'ride') {
      lL = -0.05; lR = 0.2; kL = 0.1; kR = 0.25; aL = -0.9; aR = -0.9; eL = eR = -0.35; aLz = 0.12; aRz = -0.12; lean = 0.1;
    } else if (state === 'sit') {
      lL = lR = -1.5; kL = kR = 1.5; aL = aR = -0.35; eL = eR = -0.7; lean = -0.05;
    } else if (state === 'down') {
      lL = lR = 0.1; aL = aR = -2.6; eL = eR = -0.2; lean = 1.45;
    } else if (!grounded) {
      lL = -0.6; lR = 0.3; kL = 0.9; kR = 0.4; aL = -2.0; aR = -1.8; eL = eR = -0.5; aLz = 0.3; aRz = -0.3;
    } else if (speed > 0.15) {
      lL = s * amp; lR = -s * amp;
      // the knee bends as the leg swings back and lifts
      kL = Math.max(0, Math.sin(this.phase + 0.9)) * amp * 1.4 + 0.08;
      kR = Math.max(0, Math.sin(this.phase + 0.9 + Math.PI)) * amp * 1.4 + 0.08;
      aL = -s * amp * 0.8; aR = s * amp * 0.8; eL = -0.25 - Math.max(0, -aL) * 0.6; eR = -0.25 - Math.max(0, -aR) * 0.6;
      lean = Math.min(0.2, speed * 0.025);
      bob = Math.abs(Math.cos(this.phase)) * 0.04 * amp;
    } else {
      aL = Math.sin(this.phase * 0.3) * 0.03; aR = -aL; aLz = 0.06; aRz = -0.06;
    }
    if (this.umbrella) { aR = -0.45; eR = -1.0; aRz = -0.15; }
    if (state === 'pose') { aL = -0.35; aLz = 0.75; eL = -1.75; aR = 0.05; eR = -0.35; aRz = 0.05; lean = -0.04; }
    if (state === 'wave') { aR = -2.7 + Math.sin(this.phase * 3) * 0.25; eR = -0.6; aRz = -0.35; }
    if (this.punchT > 0) {
      this.punchT -= dt;
      const k = Math.sin(Math.min(1, this.punchT / 0.28) * Math.PI);
      aR = -1.55 * k + aR * (1 - k); eR = eR * (1 - k);
      lean += 0.12 * k;
      this.torso.rotation.y = -0.45 * k;
    } else this.torso.rotation.y *= 0.8;
    // aiming the pistol with the right arm (arms[0]), the torso turned towards the target
    if (this.aim && state !== 'down') {
      this.recoilT = Math.max(0, this.recoilT - dt);
      const kick = Math.sin(Math.min(1, this.recoilT / 0.12) * Math.PI) * 0.35;
      aL = -Math.PI / 2 - this.aim.pitch - kick; eL = -0.05 + kick * 0.5; aLz = 0.05;
      if (state !== 'ride') lean = Math.min(lean, 0.06);
      this.torso.rotation.y += (Math.max(-1.3, Math.min(1.3, this.aim.yaw)) - this.torso.rotation.y) * Math.min(1, dt * 18);
    } else if (this.punchT <= 0 && Math.abs(this.torso.rotation.y) > 1e-3) this.torso.rotation.y *= 0.8;
    const Lp = (a, b) => a + (b - a) * Math.min(1, dt * (this.aim ? 30 : 14));
    this.legs[0].rotation.x = Lp(this.legs[0].rotation.x, lL);
    this.legs[1].rotation.x = Lp(this.legs[1].rotation.x, lR);
    this.knees[0].rotation.x = Lp(this.knees[0].rotation.x, kL);
    this.knees[1].rotation.x = Lp(this.knees[1].rotation.x, kR);
    this.arms[0].rotation.x = Lp(this.arms[0].rotation.x, aL);
    this.arms[1].rotation.x = Lp(this.arms[1].rotation.x, aR);
    this.arms[0].rotation.z = Lp(this.arms[0].rotation.z, -aLz - 0.08);
    this.arms[1].rotation.z = Lp(this.arms[1].rotation.z, -aRz + 0.08);
    this.elbows[0].rotation.x = Lp(this.elbows[0].rotation.x, eL);
    this.elbows[1].rotation.x = Lp(this.elbows[1].rotation.x, eR);
    this.body.rotation.x = Lp(this.body.rotation.x, lean);
    this.body.position.y = state === 'sit' ? -0.45 : state === 'down' ? 0.16 : bob;
    this.head.rotation.y = Math.sin(this.phase * 0.21) * 0.12;
  }
  punch() { this.punchT = 0.28; }
  recoil() { this.recoilT = 0.12; }
}

// ---------------------------------------------------------------------------
// A black pistol for the right hand. Built along the forearm: with the arm held straight out,
// local -y points down the barrel and +z is the top of the slide. `muzzle` marks the barrel's end.
export function makePistol() {
  const g = new THREE.Group();
  const black = mat(0x1a1b1d, { roughness: 0.35, metalness: 0.7 }), grip = mat(0x2a2522, { roughness: 0.8 });
  const slide = box(0.034, 0.2, 0.042, black); slide.position.set(0, -0.06, 0.035);
  const frame = box(0.03, 0.15, 0.03, black); frame.position.set(0, -0.04, 0.005);
  const handle = box(0.032, 0.05, 0.11, grip); handle.position.set(0, 0.0, -0.04); handle.rotation.x = -0.25;
  const guard = box(0.008, 0.05, 0.035, black); guard.position.set(0, -0.045, -0.018);
  const sight = box(0.008, 0.01, 0.012, black); sight.position.set(0, -0.15, 0.06);
  g.add(slide, frame, handle, guard, sight);
  for (const o of g.children) o.castShadow = true;
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.17, 0.035);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  g.position.set(0, -0.3, 0.02);
  return g;
}

// ---------------------------------------------------------------------------
export class Gull {
  static mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  // merged into five meshes (body, two inner and two outer wing parts) with vertex colours
  constructor() {
    const g = new THREE.Group();
    const merge = (parts) => {
      const pos = [], nrm = [], col = [], c = new THREE.Color();
      for (const [geo, m4, hex] of parts) {
        const gg = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m4);
        pos.push(...gg.attributes.position.array); nrm.push(...gg.attributes.normal.array);
        c.set(hex);
        for (let k = 0; k < gg.attributes.position.count; k++) col.push(c.r, c.g, c.b);
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      bg.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const m = new THREE.Mesh(bg, Gull.mat);
      m.castShadow = true;
      return m;
    };
    const T = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(sx, sy, sz));
    const body = merge([
      [new THREE.SphereGeometry(0.2, 8, 6), T(0, 0, 0, 0.85, 0.8, 2.1), 0xf4f4f2],
      [new THREE.SphereGeometry(0.12, 8, 6), T(0, 0.1, 0.38), 0xf4f4f2],
      [new THREE.ConeGeometry(0.035, 0.16, 5), T(0, 0.08, 0.53, 1, 1, 1, Math.PI / 2), 0xf0c419],
      [new THREE.SphereGeometry(0.018, 4, 3), T(0, 0.05, 0.56), 0xd2301f],
      [new THREE.SphereGeometry(0.018, 4, 3), T(0.08, 0.15, 0.44), 0x1b1b1b],
      [new THREE.SphereGeometry(0.018, 4, 3), T(-0.08, 0.15, 0.44), 0x1b1b1b],
      [new THREE.BoxGeometry(0.2, 0.03, 0.2), T(0, 0.02, -0.44), 0x1b1b1b],
    ]);
    g.add(body);
    this.legs = merge([[new THREE.BoxGeometry(0.02, 0.16, 0.02), T(0.05, -0.22, 0), 0xf0c419], [new THREE.BoxGeometry(0.02, 0.16, 0.02), T(-0.05, -0.22, 0), 0xf0c419]]);
    g.add(this.legs);
    this.wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(0.12 * s, 0.06, 0.02);
      const inner = merge([[new THREE.BoxGeometry(0.42, 0.025, 0.3), T(0.21 * s, 0, 0), 0xa9b1b8]]);
      const outerG = new THREE.Group();
      outerG.position.x = 0.42 * s;
      outerG.add(merge([[new THREE.BoxGeometry(0.36, 0.02, 0.22), T(0.18 * s, 0, -0.03), 0xa9b1b8], [new THREE.BoxGeometry(0.14, 0.022, 0.18), T(0.42 * s, 0, -0.05), 0x1b1b1b]]));
      w.add(inner, outerG);
      g.add(w);
      this.wings.push({ w, outerG, s });
    }
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
// every scooter's headlamp shares this material, so the night can turn them all up at once
export const SCOOTER_LAMP = mat(0xffffff, { emissive: 0xfff4e0, emissiveIntensity: 1 });
export function makeScooter() {
  const g = new THREE.Group();
  const deckM = mat(0x22272b, { roughness: 0.5 }), bodyM = mat(0x2bb673, { roughness: 0.35 }), tyreM = mat(0x111111);
  const deck = box(0.2, 0.06, 0.95, deckM); deck.position.set(0, 0.13, 0);
  const strip = box(0.21, 0.02, 0.6, bodyM); strip.position.set(0, 0.17, -0.05);
  const stem = box(0.06, 1.05, 0.06, bodyM); stem.position.set(0, 0.62, 0.45); stem.rotation.x = -0.18;
  const bar = box(0.55, 0.05, 0.05, deckM); bar.position.set(0, 1.12, 0.54);
  const lamp = box(0.08, 0.06, 0.04, SCOOTER_LAMP); lamp.position.set(0, 0.95, 0.53); lamp.castShadow = false;
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
