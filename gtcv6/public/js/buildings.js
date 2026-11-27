// Buildings from OpenStreetMap outlines, with facades that make sense:
//  - no windows on party walls (edges another building touches, found by tools/build_map.py),
//  - storeys counted down from the eaves, windows only where the bay is above the ground,
//  - a stone plinth that follows the slope, a front door on the edge facing the street,
//  - shopfronts on commercial ground floors, corner boards on wooden houses,
//  - gable roofs with an attic window and a chimney, parapets on flat roofs.
// Everything for a 100 m tile is merged into three meshes (walls, windows+doors+trims,
// roofs) that share texture atlases, so a tile costs three draw calls. Each tile also has a
// cheap far version (walls with painted windows, no separate window geometry).
import * as THREE from '../vendor/three.module.min.js';
import { rng } from './textures.js';

const TILE = 100;
const STOREY = 2.9;
// one atlas for walls, roofs and street surfaces: 4 x 4 cells of 256 px
export const STYLE = { w: 0, y: 1, p: 2, b: 3, stone: 4, gravel: 5, wfar: 6, pfar: 7, roof: 8, asphalt: 9, cobble: 10, paving: 11, steps: 12, side: 13, foot: 14 };
const TILE_M = [1.2, 1.2, 3.0, 1.6, 2.4, 3.0, 2.4, 2.4, 1.0, 4.0, 2.4, 2.4, 0.64, 3.0, 3.0, 1.0];   // metres per texture repeat

function facadeAtlas(T) {
  const C = 256, c = document.createElement('canvas');
  c.width = C * 4; c.height = C * 4;
  const g = c.getContext('2d');
  const R = rng(91);
  const cell = (i, draw) => { g.save(); g.translate((i % 4) * C, Math.floor(i / 4) * C); g.beginPath(); g.rect(0, 0, C, C); g.clip(); draw(); g.restore(); };
  const noise = (amt, n = 2500) => { for (let k = 0; k < n; k++) { const v = (R() - 0.5) * amt; g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`; g.fillRect(R() * C, R() * C, 2, 2); } };
  // 0: horizontal weatherboards (Fjellet), 1.2 m = 6 boards
  cell(0, () => {
    for (let j = 0; j < 6; j++) {
      const y = j * C / 6, h = C / 6;
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.8, '#ebebeb'); gr.addColorStop(1, '#a8a8a8');
      g.fillStyle = gr; g.fillRect(0, y, C, h);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + h - 2, C, 2);
    }
    noise(14);
  });
  // 1: vertical boards with battens (Bryggen)
  cell(1, () => {
    for (let i = 0; i < 6; i++) {
      const x = i * C / 6, w = C / 6;
      const gr = g.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, '#f2f2f2'); gr.addColorStop(0.75, '#e2e2e2'); gr.addColorStop(1, '#8a8a8a');
      g.fillStyle = gr; g.fillRect(x, 0, w, C);
      g.fillStyle = '#d0d0d0'; g.fillRect(x + w - 6, 0, 6, C);
    }
    noise(18, 4000);
  });
  // 2: plaster
  cell(2, () => { g.fillStyle = '#efefef'; g.fillRect(0, 0, C, C); noise(22, 9000); for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(0,0,0,${R() * 0.04})`; g.beginPath(); g.arc(R() * C, R() * C, 10 + R() * 30, 0, 7); g.fill(); } });
  // 3: brick
  cell(3, () => {
    g.fillStyle = '#d9d4cc'; g.fillRect(0, 0, C, C);
    const rows = 20, h = C / rows, w = h * 2.6;
    for (let j = 0; j < rows; j++) for (let x = -(j % 2) * w / 2; x < C; x += w) {
      const v = 200 + R() * 55;
      g.fillStyle = `rgb(${v},${v * 0.98},${v * 0.95})`;
      g.fillRect(x + 1.5, j * h + 1.5, w - 3, h - 3);
    }
  });
  // 4: rough stone (plinths)
  cell(4, () => {
    g.fillStyle = '#6a6a68'; g.fillRect(0, 0, C, C);
    let y = 0;
    while (y < C) {
      const h = 22 + R() * 26; let x = -R() * 40;
      while (x < C) { const w = 34 + R() * 60, v = 150 + R() * 70; g.fillStyle = `rgb(${v},${v},${v * 0.97})`; g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, h - 4, 6); g.fill(); x += w; }
      y += h;
    }
    noise(20);
  });
  // 5: gravel / tar for flat roofs
  cell(5, () => { g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, C, C); noise(70, 14000); });
  // 6, 7: far versions with painted windows (weatherboards, plaster), one 2.4 x 2.9 bay -> squashed to the cell
  const farWin = (i, base) => cell(i, () => {
    base();
    const sx = C / 2.4, sy = C / 2.4;
    const wx = (2.4 - 0.95) / 2 * sx, ww = 0.95 * sx, wy = 0.55 * sy, wh = 1.25 * sy;
    g.fillStyle = '#f4f3ee'; g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
    const gr = g.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, '#9fb3bf'); gr.addColorStop(1, '#3a4853');
    g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
  });
  farWin(6, () => { g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, C, C); for (let j = 0; j < 6; j++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, j * C / 6 + C / 6 - 2, C, 2); } });
  farWin(7, () => { g.fillStyle = '#ececec'; g.fillRect(0, 0, C, C); noise(18, 5000); });
  // 8: roof slate / tiles (white, tinted per building), from the shared roof texture
  cell(8, () => { g.drawImage(T.roof.image, 0, 0, C, C); });
  // 9: wet asphalt
  cell(9, () => { g.fillStyle = '#4a4c50'; g.fillRect(0, 0, C, C); noise(40, 12000); for (let k = 0; k < 12; k++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(R() * C, R() * C, 20 + R() * 40, 8 + R() * 16, R() * 3, 0, 7); g.fill(); } });
  // 10: cobbles (sett)
  cell(10, () => { g.drawImage(T.cobble.image, 0, 0, C, C); });
  // 11: paving slabs
  cell(11, () => { g.drawImage(T.slab.image, 0, 0, C, C); g.fillStyle = 'rgba(160,155,145,0.35)'; g.fillRect(0, 0, C, C); });
  // 12: stone steps: a dark nosing and a lit tread, repeating along the stair
  cell(12, () => { g.fillStyle = '#9a9a96'; g.fillRect(0, 0, C, C); g.fillStyle = '#5f605e'; g.fillRect(0, 0, C, C * 0.16); g.fillStyle = '#b8b8b2'; g.fillRect(0, C * 0.16, C, C * 0.06); noise(24, 3000); });
  // 13: pavement
  cell(13, () => { g.fillStyle = '#8f8e8a'; g.fillRect(0, 0, C, C); for (let k = 1; k < 4; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, k * C / 4, C, 2); g.fillRect(k * C / 4, 0, 2, C); } noise(26, 6000); });
  // 14: gravel path
  cell(14, () => { g.fillStyle = '#8d8778'; g.fillRect(0, 0, C, C); noise(60, 14000); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// windows, doors and trim: 4 x 4 cells of 128 px, plain UVs (no tiling)
const WIN = { classic: 0, sixpane: 1, modern: 2, shop: 3, door: 4, glassdoor: 5, garage: 6, white: 7, attic: 8, church: 9 };
function windowAtlas() {
  const C = 128, c = document.createElement('canvas');
  c.width = c.height = C * 4;
  const g = c.getContext('2d');
  const cell = (i, draw) => { g.save(); g.translate((i % 4) * C, Math.floor(i / 4) * C); draw(); g.restore(); };
  const glass = (x, y, w, h) => {
    const gr = g.createLinearGradient(x, y, x + w * 0.4, y + h);
    gr.addColorStop(0, '#b7c8d2'); gr.addColorStop(0.35, '#6f8796'); gr.addColorStop(0.36, '#5b7282'); gr.addColorStop(1, '#2c3943');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    // a hint of curtains
    g.fillStyle = 'rgba(235,228,210,0.35)'; g.fillRect(x, y, w * 0.18, h); g.fillRect(x + w * 0.82, y, w * 0.18, h);
  };
  const frame = (f, panesX, panesY) => {
    g.fillStyle = '#f5f4ef'; g.fillRect(0, 0, C, C);
    glass(f, f, C - 2 * f, C - 2 * f);
    g.fillStyle = '#f5f4ef';
    for (let i = 1; i < panesX; i++) g.fillRect(f + (C - 2 * f) * i / panesX - 3, f, 6, C - 2 * f);
    for (let j = 1; j < panesY; j++) g.fillRect(f, f + (C - 2 * f) * j / panesY - 3, C - 2 * f, 6);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.strokeRect(f, f, C - 2 * f, C - 2 * f);
  };
  cell(WIN.classic, () => { frame(11, 2, 1); g.fillStyle = '#f5f4ef'; g.fillRect(11, C * 0.32, C - 22, 6); });
  cell(WIN.sixpane, () => frame(10, 2, 3));
  cell(WIN.modern, () => { frame(8, 1, 1); g.fillStyle = '#f5f4ef'; g.fillRect(C / 2 - 3, 8, 6, C - 16); });
  cell(WIN.shop, () => { g.fillStyle = '#3a3d40'; g.fillRect(0, 0, C, C); glass(6, 6, C - 12, C - 12); g.fillStyle = 'rgba(255,214,150,0.35)'; g.fillRect(6, C * 0.55, C - 12, C * 0.45 - 6); g.fillStyle = '#3a3d40'; g.fillRect(C * 0.62, 6, 5, C - 12); });
  cell(WIN.door, () => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, C, C);       // tinted per building
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 4;
    g.strokeRect(14, 12, C / 2 - 20, C * 0.38); g.strokeRect(C / 2 + 6, 12, C / 2 - 20, C * 0.38);
    g.strokeRect(14, C * 0.56, C / 2 - 20, C * 0.38); g.strokeRect(C / 2 + 6, C * 0.56, C / 2 - 20, C * 0.38);
    g.fillStyle = '#c9a23a'; g.fillRect(C * 0.8, C * 0.5, 6, 14);
  });
  cell(WIN.glassdoor, () => { g.fillStyle = '#2d3135'; g.fillRect(0, 0, C, C); glass(10, 10, C - 20, C - 26); });
  cell(WIN.garage, () => { g.fillStyle = '#d8d8d4'; g.fillRect(0, 0, C, C); for (let j = 0; j < 8; j++) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, j * C / 8, C, 3); } });
  cell(WIN.white, () => { g.fillStyle = '#f5f4ef'; g.fillRect(0, 0, C, C); });
  cell(WIN.attic, () => { frame(14, 1, 1); });
  cell(WIN.church, () => { g.fillStyle = '#d8d3c4'; g.fillRect(0, 0, C, C); g.fillStyle = '#3c4a5a'; g.beginPath(); g.moveTo(20, C); g.lineTo(20, 40); g.arc(C / 2, 44, C / 2 - 20, Math.PI, 0); g.lineTo(C - 20, C); g.fill(); g.strokeStyle = '#8a8574'; g.lineWidth = 3; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(20, 40 + k * 22); g.lineTo(C - 20, 40 + k * 22); g.stroke(); } });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const cellUV = (i, u, v) => [((i % 4) + 0.03 + u * 0.94) / 4, 1 - (Math.floor(i / 4) + 0.03 + (1 - v) * 0.94) / 4];

function facadeMaterial(atlas) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.atlas = { value: atlas };
    sh.uniforms.tileM = { value: TILE_M };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 uvm; attribute float sty; varying vec2 vUvm; varying float vSty;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUvm = uvm; vSty = sty;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D atlas; uniform float tileM[16]; varying vec2 vUvm; varying float vSty;')
      .replace('#include <map_fragment>', `
        {
          int s = int(vSty + 0.5);
          float ts = tileM[s];
          vec2 cell = vec2(mod(float(s), 4.0), floor(float(s) / 4.0));
          vec2 p = vUvm / ts;
          vec2 f = fract(p);
          vec2 cs = vec2(0.25, 0.25);
          vec2 auv = (cell + 0.01 + vec2(f.x, 1.0 - f.y) * 0.98) * cs;
          auv.y = 1.0 - auv.y;
          vec4 tx = textureGrad(atlas, auv, dFdx(p) * cs * 0.98, dFdy(p) * cs * 0.98);
          diffuseColor.rgb *= tx.rgb;
        }`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        if (vSty > 8.5 && vSty < 13.5) roughnessFactor = 0.62;        // wet streets
        else if (vSty > 7.5 && vSty < 8.5) roughnessFactor = 0.55;    // roofs`);
  };
  m.customProgramCacheKey = () => 'facadeAtlas';
  return m;
}

class Batch {
  constructor(facade) { this.p = []; this.n = []; this.c = []; this.u = []; this.s = []; this.facade = facade; }
  quad(a, b, c, d, nrm, col, uv, sty) {
    // a,b,c,d counter-clockwise seen from the normal side
    for (const [P, U, C] of [[a, uv[0], col[0]], [b, uv[1], col[1]], [c, uv[2], col[2]], [a, uv[0], col[0]], [c, uv[2], col[2]], [d, uv[3], col[3]]]) {
      this.p.push(P[0], P[1], P[2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.c.push(C.r, C.g, C.b); this.u.push(U[0], U[1]);
      if (this.facade) this.s.push(sty);
    }
  }
  tri(a, b, c, nrm, col, uv, sty) {
    for (const [P, U] of [[a, uv[0]], [b, uv[1]], [c, uv[2]]]) {
      this.p.push(P[0], P[1], P[2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.c.push(col.r, col.g, col.b); this.u.push(U[0], U[1]);
      if (this.facade) this.s.push(sty);
    }
  }
  mesh(mat, shadow = true) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute(this.facade ? 'uvm' : 'uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (this.facade) g.setAttribute('sty', new THREE.Float32BufferAttribute(this.s, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    return m;
  }
}

export function buildBuildings(scene, map, terrain, polys, T, opts) {
  const facadeTex = facadeAtlas(T);
  const winTex = windowAtlas();
  const facadeMat = facadeMaterial(facadeTex);
  const winMat = new THREE.MeshStandardMaterial({ map: winTex, vertexColors: true, roughness: 0.35, metalness: 0.05 });
  const tiles = new Map();
  const tileOf = (x, z) => {
    const k = Math.floor(x / TILE) * 1000 + Math.floor(z / TILE);
    if (!tiles.has(k)) {
      const wall = new Batch(true), far = new Batch(true);
      // roof (and street) geometry goes into both levels of detail
      const both = { quad: (...a) => { wall.quad(...a); far.quad(...a); }, tri: (...a) => { wall.tri(...a); far.tri(...a); } };
      tiles.set(k, { cx: (Math.floor(x / TILE) + 0.5) * TILE, cz: (Math.floor(z / TILE) + 0.5) * TILE, wall, far, win: new Batch(false), roof: both });
    }
    return tiles.get(k);
  };
  const col = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  const shade = (c, k) => new THREE.Color(c.r * k, c.g * k, c.b * k);
  const DOORCOLS = ['#2b2f33', '#7a2e28', '#2f4a35', '#3b5a78', '#f2f1ec', '#5b3a29'];
  const named = [];

  for (const b of map.buildings) {
    const pts = b.p, n = pts.length / 2;
    if (n < 3) continue;
    const T0 = tileOf(pts[0], pts[1]);
    const R = rng(Math.floor(Math.abs(pts[0] * 131 + pts[1] * 71)) + n);
    let area2 = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; area2 += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]; }
    const sgn = area2 > 0 ? 1 : -1;
    col.set(b.c);
    const top = b.t, base = b.b;
    const style = b.s || 'w';
    const sty = STYLE[style] ?? 0;
    const farSty = style === 'p' || style === 'b' ? STYLE.pfar : STYLE.wfar;
    const wood = style === 'w' || style === 'y';
    const winKind = style === 'y' ? WIN.sixpane : style === 'p' || style === 'b' ? (R() < 0.5 ? WIN.modern : WIN.sixpane) : (R() < 0.75 ? WIN.classic : WIN.sixpane);
    const winW = style === 'y' ? 0.7 : style === 'p' || style === 'b' ? 1.1 : 0.95;
    const winH = style === 'y' ? 1.0 : style === 'p' || style === 'b' ? 1.55 : 1.3;
    const doorCol = new THREE.Color(DOORCOLS[Math.floor(R() * DOORCOLS.length)]);
    const church = b.k === 'church';
    const masks = b.e || [];
    const door = b.d;
    const corners = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = pts[i * 2], az = pts[i * 2 + 1], bx = pts[j * 2], bz = pts[j * 2 + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      const nx = dz * sgn, nz = -dx * sgn;            // outward
      const N = [nx, 0, nz];
      const m = masks[i] ?? 31;
      // the ground along this wall
      const gs = [];
      for (let k = 0; k <= 4; k++) gs.push(terrain.height(ax + (bx - ax) * k / 4 + nx * 0.3, az + (bz - az) * k / 4 + nz * 0.3));
      const gMin = Math.min(...gs);
      const plinth = Math.min(top - 1, Math.max(base + 0.1, gMin + (wood ? 0.45 : 0.2)));
      const P = (t, y) => [ax + (bx - ax) * t, y, az + (bz - az) * t];
      const ccw = (a2, b2, c2, d2) => {        // order so the quad faces N
        const e1 = [b2[0] - a2[0], b2[1] - a2[1], b2[2] - a2[2]], e2 = [c2[0] - a2[0], c2[1] - a2[1], c2[2] - a2[2]];
        const cx = e1[1] * e2[2] - e1[2] * e2[1], cz = e1[0] * e2[1] - e1[1] * e2[0];
        return cx * nx + cz * nz >= 0 ? [a2, b2, c2, d2] : [a2, d2, c2, b2];
      };
      const wallQuad = (batch, y0, y1, styl, c0, c1) => {
        const A = P(0, y0), B = P(1, y0), C2 = P(1, y1), D = P(0, y1);
        const uA = [0, y0], uB = [L, y0], uC = [L, y1], uD = [0, y1];
        // (B - A) x (D - A) = L h (-dz, 0, dx): pick the winding that faces outwards
        if (-dz * nx + dx * nz >= 0) batch.quad(A, B, C2, D, N, [c0, c0, c1, c1], [uA, uB, uC, uD], styl);
        else batch.quad(A, D, C2, B, N, [c0, c1, c1, c0], [uA, uD, uC, uB], styl);
      };
      // walls: stone plinth below, cladding above; darker towards the ground (ambient occlusion)
      wallQuad(T0.wall, base, plinth, STYLE.stone, shade(white, 0.5), shade(white, 0.85));
      wallQuad(T0.wall, plinth, top, church ? STYLE.p : sty, shade(col, 0.78), col);
      wallQuad(T0.far, base, top, church ? STYLE.p : farSty, shade(col, 0.7), col);
      if (wood && !church && m !== 0) corners.push(i);
      if (m === 0 || b.plain && !door) continue;
      // windows: storeys counted down from the eaves
      const bays = L < 1.3 ? 0 : Math.max(1, Math.floor((L - 0.5) / (style === 'p' || style === 'b' ? 2.6 : 2.3)));
      const doorHere = door && door[0] === i;
      const doorT = doorHere ? door[1] : -1;
      const doorG = doorHere ? terrain.height(ax + (bx - ax) * doorT + nx * 0.8, az + (bz - az) * doorT + nz * 0.8) : 0;
      for (let k = 0; k < bays; k++) {
        const t = (k + 0.5) / bays;
        const bit = Math.min(4, Math.floor(t * 5));
        if (!(m & (1 << bit))) continue;
        const gHere = terrain.height(ax + (bx - ax) * t + nx * 0.4, az + (bz - az) * t + nz * 0.4);
        const half = winW / 2 / L;
        for (let f = 0; f < 8; f++) {
          const yTop = top - f * STOREY - 0.55;
          const y0 = yTop - winH;
          if (y0 < Math.max(gHere, plinth) + 0.45) break;
          // the door takes the bay it stands in
          if (doorHere && Math.abs(t - doorT) * L < 1.1 && y0 < doorG + 2.4) continue;
          const shop = b.shop && f > 0 && y0 - STOREY < Math.max(gHere, plinth) + 0.45;
          const kind = church ? WIN.church : winKind;
          const ww = church ? 1.2 : winW, wh = church ? 2.6 : winH;
          const t0 = t - ww / 2 / L, t1 = t + ww / 2 / L;
          if (t0 < 0.02 || t1 > 0.98) continue;
          const o = 0.05;
          const q = (tt, y) => { const p = P(tt, y); return [p[0] + nx * o, p[1], p[2] + nz * o]; };
          const [A, B, C2, D] = [q(t0, yTop - wh), q(t1, yTop - wh), q(t1, yTop), q(t0, yTop)];
          const uv = [cellUV(kind, 0, 0), cellUV(kind, 1, 0), cellUV(kind, 1, 1), cellUV(kind, 0, 1)];
          const ord = ccw(A, B, C2, D);
          const uvo = ord[1] === B ? uv : [uv[0], uv[3], uv[2], uv[1]];
          T0.win.quad(ord[0], ord[1], ord[2], ord[3], N, [white, white, white, white], uvo, 0);
          // sill
          const s0 = q(t0 - 0.06 / L, yTop - wh - 0.06), s1 = q(t1 + 0.06 / L, yTop - wh - 0.06);
          const s2 = [s1[0] + nx * 0.1, s1[1], s1[2] + nz * 0.1], s3 = [s0[0] + nx * 0.1, s0[1], s0[2] + nz * 0.1];
          const wu = cellUV(WIN.white, 0.5, 0.5);
          T0.win.quad(s0, s3, s2, s1, [0, 1, 0], [white, white, white, white], [wu, wu, wu, wu], 0);
          if (shop) {
            // a shopfront under this window
            const sy1 = Math.max(gHere, plinth) + 2.6, sy0 = Math.max(gHere, plinth) + 0.15;
            const st0 = t - 1.0 / L, st1 = t + 1.0 / L;
            if (st0 > 0.02 && st1 < 0.98) {
              const [a3, b3, c3, d3] = [q(st0, sy0), q(st1, sy0), q(st1, sy1), q(st0, sy1)];
              const u3 = [cellUV(WIN.shop, 0, 0), cellUV(WIN.shop, 1, 0), cellUV(WIN.shop, 1, 1), cellUV(WIN.shop, 0, 1)];
              const o3 = ccw(a3, b3, c3, d3);
              T0.win.quad(o3[0], o3[1], o3[2], o3[3], N, [white, white, white, white], o3[1] === b3 ? u3 : [u3[0], u3[3], u3[2], u3[1]], 0);
            }
          }
        }
      }
      if (doorHere) {
        const dw = (b.plain ? 2.4 : 1.0) / L, kind = b.plain ? WIN.garage : (b.shop ? WIN.glassdoor : WIN.door);
        const t0 = doorT - dw / 2, t1 = doorT + dw / 2;
        const o = 0.06;
        const q = (tt, y) => { const p = P(tt, y); return [p[0] + nx * o, p[1], p[2] + nz * o]; };
        const y0 = doorG - 0.05, y1 = doorG + (b.plain ? 2.3 : 2.2);
        const [A, B, C2, D] = [q(t0, y0), q(t1, y0), q(t1, y1), q(t0, y1)];
        const uv = [cellUV(kind, 0, 0), cellUV(kind, 1, 0), cellUV(kind, 1, 1), cellUV(kind, 0, 1)];
        const ord = ccw(A, B, C2, D);
        const dc = kind === WIN.door ? doorCol : white;
        T0.win.quad(ord[0], ord[1], ord[2], ord[3], N, [dc, dc, dc, dc], ord[1] === B ? uv : [uv[0], uv[3], uv[2], uv[1]], 0);
        // white casing around the door
        const wu = cellUV(WIN.white, 0.5, 0.5);
        for (const [ta, tb, ya, yb] of [[t0 - 0.1 / L, t0, y0, y1 + 0.1], [t1, t1 + 0.1 / L, y0, y1 + 0.1], [t0 - 0.1 / L, t1 + 0.1 / L, y1, y1 + 0.12]]) {
          const [a3, b3, c3, d3] = [q(ta, ya), q(tb, ya), q(tb, yb), q(ta, yb)].map(p => [p[0] + nx * 0.01, p[1], p[2] + nz * 0.01]);
          const o3 = ccw(a3, b3, c3, d3);
          T0.win.quad(o3[0], o3[1], o3[2], o3[3], N, [white, white, white, white], [wu, wu, wu, wu], 0);
        }
      }
    }
    // corner boards on wooden houses
    if (wood) {
      const wu = cellUV(WIN.white, 0.5, 0.5);
      for (const i of corners) {
        const x = pts[i * 2], z = pts[i * 2 + 1];
        const g0 = terrain.height(x, z) + 0.2;
        const pv = (i - 1 + n) % n, nx2 = (i + 1) % n;
        for (const o of [pv, nx2]) {
          const ox = pts[o * 2] - x, oz = pts[o * 2 + 1] - z, l = Math.hypot(ox, oz) || 1;
          if (l < 0.5) continue;
          const ux = ox / l * 0.14, uz = oz / l * 0.14;
          // outward normal of that wall
          let nx = uz / 0.14 * sgn, nz = -ux / 0.14 * sgn;
          if (o === pv) { nx = -nx; nz = -nz; }
          const e = 0.02;
          const A = [x + nx * e, Math.max(base, g0 - 0.3), z + nz * e], B = [x + ux + nx * e, A[1], z + uz + nz * e];
          const C2 = [B[0], top, B[2]], D = [A[0], top, A[2]];
          const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
          const crx = e1[1] * e2[2] - e1[2] * e2[1], crz = e1[0] * e2[1] - e1[1] * e2[0];
          if (crx * nx + crz * nz >= 0) T0.win.quad(A, B, C2, D, [nx, 0, nz], [white, white, white, white], [wu, wu, wu, wu], 0);
          else T0.win.quad(A, D, C2, B, [nx, 0, nz], [white, white, white, white], [wu, wu, wu, wu], 0);
        }
      }
    }
    // roof
    const rc = new THREE.Color(b.rc);
    if (b.g) {
      const g = b.g;
      const c = [[g[0], g[1]], [g[2], g[3]], [g[4], g[5]], [g[6], g[7]]];
      const l01 = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]), l12 = Math.hypot(c[2][0] - c[1][0], c[2][1] - c[1][1]);
      const [p0, p1, p2, p3] = l01 >= l12 ? c : [c[1], c[2], c[3], c[0]];
      const short = Math.min(l01, l12), lenR = Math.max(l01, l12);
      const rise = b.k === 'bryggen' ? Math.min(7.5, short / 2 * Math.tan(0.95)) : Math.min(5.5, short / 2 * Math.tan(0.66));
      const m03 = [(p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2], m12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      const ov = 0.4;
      const ex = (p, q) => { const dx = p[0] - q[0], dz = p[1] - q[1], l = Math.hypot(dx, dz) || 1; return [p[0] + dx / l * ov, p[1] + dz / l * ov]; };
      // eaves overhang along the slope and a little past the gables
      const along = [(p1[0] - p0[0]) / lenR * 0.3, (p1[1] - p0[1]) / lenR * 0.3];
      const e0 = ex(p0, p3), e1 = ex(p1, p2), e2 = ex(p2, p1), e3 = ex(p3, p0);
      const E0 = [e0[0] - along[0], top - 0.3, e0[1] - along[1]], E1 = [e1[0] + along[0], top - 0.3, e1[1] + along[1]];
      const E2 = [e2[0] + along[0], top - 0.3, e2[1] + along[1]], E3 = [e3[0] - along[0], top - 0.3, e3[1] - along[1]];
      const R0 = [m03[0] - along[0], top + rise, m03[1] - along[1]], R1 = [m12[0] + along[0], top + rise, m12[1] + along[1]];
      const nrm = (a, b2, c2) => {
        const v1 = new THREE.Vector3(b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]), v2 = new THREE.Vector3(c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]);
        const v = v1.cross(v2).normalize(); if (v.y < 0) v.negate(); return [v.x, v.y, v.z];
      };
      const slope = Math.hypot(short / 2 + ov, rise);
      for (const [A, B, C2, D] of [[E0, E1, R1, R0], [E3, E2, R1, R0]]) {
        const N = nrm(A, B, C2);
        const e1v = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2v = [C2[0] - A[0], C2[1] - A[1], C2[2] - A[2]];
        const cy = e1v[2] * e2v[0] - e1v[0] * e2v[2];
        const uv = [[0, 0], [lenR, 0], [lenR, slope], [0, slope]];
        const cA = shade(rc, 0.8);
        if (cy >= 0) T0.roof.quad(A, B, C2, D, N, [cA, cA, rc, rc], uv, STYLE.roof);
        else T0.roof.quad(A, D, C2, B, N, [cA, rc, rc, cA], [uv[0], uv[3], uv[2], uv[1]], STYLE.roof);
        // white fascia board along the eave
        const wu = cellUV(WIN.white, 0.5, 0.5);
        const F0 = [A[0], A[1] - 0.22, A[2]], F1 = [B[0], B[1] - 0.22, B[2]];
        const outN = [N[0], 0, N[2]];
        T0.win.quad(F0, F1, B, A, outN, [white, white, white, white], [wu, wu, wu, wu], 0);
        T0.win.quad(F0, A, B, F1, outN, [white, white, white, white], [wu, wu, wu, wu], 0);
      }
      // gable triangles in the wall material, with an attic window
      const cxm = (p0[0] + p1[0] + p2[0] + p3[0]) / 4, czm = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
      for (const [a, b2, mm] of [[p0, p3, m03], [p1, p2, m12]]) {
        const A = [a[0], top, a[1]], B = [b2[0], top, b2[1]], M = [mm[0], top + rise, mm[1]];
        const dx = b2[0] - a[0], dz = b2[1] - a[1], l = Math.hypot(dx, dz) || 1;
        let nx = dz / l, nz = -dx / l;
        if ((mm[0] - cxm) * nx + (mm[1] - czm) * nz < 0) { nx = -nx; nz = -nz; }
        const ua = [0, top], ub = [l, top], um = [l / 2, top + rise];
        const e1v = [B[0] - A[0], 0, B[2] - A[2]], e2v = [M[0] - A[0], M[1] - A[1], M[2] - A[2]];
        const cr = (e1v[1] * e2v[2] - e1v[2] * e2v[1]) * nx + (e1v[0] * e2v[1] - e1v[1] * e2v[0]) * nz;
        if (cr >= 0) T0.wall.tri(A, B, M, [nx, 0, nz], col, [ua, ub, um], sty); else T0.wall.tri(A, M, B, [nx, 0, nz], col, [ua, um, ub], sty);
        if (cr >= 0) T0.far.tri(A, B, M, [nx, 0, nz], col, [ua, ub, um], sty); else T0.far.tri(A, M, B, [nx, 0, nz], col, [ua, um, ub], sty);
        if (l > 4.5 && rise > 1.8 && !church) {
          const wy0 = top + 0.35, wy1 = top + Math.min(1.25, rise * 0.55), hw = 0.38;
          const o = 0.05, cxw = mm[0] + nx * o, czw = mm[1] + nz * o;
          const ux = dx / l, uz = dz / l;
          const A2 = [cxw - ux * hw, wy0, czw - uz * hw], B2 = [cxw + ux * hw, wy0, czw + uz * hw], C3 = [B2[0], wy1, B2[2]], D3 = [A2[0], wy1, A2[2]];
          const uv = [cellUV(WIN.attic, 0, 0), cellUV(WIN.attic, 1, 0), cellUV(WIN.attic, 1, 1), cellUV(WIN.attic, 0, 1)];
          const e3 = [B2[0] - A2[0], 0, B2[2] - A2[2]];
          const crz = -e3[2] * (wy1 - wy0) * nx + e3[0] * (wy1 - wy0) * nz;
          if (crz >= 0) T0.win.quad(A2, B2, C3, D3, [nx, 0, nz], [white, white, white, white], uv, 0);
          else T0.win.quad(A2, D3, C3, B2, [nx, 0, nz], [white, white, white, white], [uv[0], uv[3], uv[2], uv[1]], 0);
        }
      }
      // chimney on most wooden houses
      if (wood && R() < 0.65 && lenR > 5) {
        const t = 0.25 + R() * 0.5, cx = m03[0] + (m12[0] - m03[0]) * t, cz = m03[1] + (m12[1] - m03[1]) * t;
        const s = 0.32, y0 = top + rise - 1.2, y1 = top + rise + 0.9;
        const stone = shade(white, 0.75);
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const px = cx + ox * s, pz = cz + oz * s, tx = -oz * s, tz = ox * s;
          const A = [px - tx, y0, pz - tz], B = [px + tx, y0, pz + tz], C2 = [px + tx, y1, pz + tz], D = [px - tx, y1, pz - tz];
          const crz = -(B[2] - A[2]) * (y1 - y0) * ox + (B[0] - A[0]) * (y1 - y0) * oz;
          const uv = [[0, y0], [2 * s, y0], [2 * s, y1], [0, y1]];
          if (crz >= 0) T0.wall.quad(A, B, C2, D, [ox, 0, oz], [stone, stone, stone, stone], uv, STYLE.b);
          else T0.wall.quad(A, D, C2, B, [ox, 0, oz], [stone, stone, stone, stone], [uv[0], uv[3], uv[2], uv[1]], STYLE.b);
        }
        const k = shade(white, 0.3);
        T0.roof.quad([cx - s - 0.05, y1, cz - s - 0.05], [cx - s - 0.05, y1, cz + s + 0.05], [cx + s + 0.05, y1, cz + s + 0.05], [cx + s + 0.05, y1, cz - s - 0.05], [0, 1, 0], [k, k, k, k], [[0, 0], [0, 1], [1, 1], [1, 0]], STYLE.stone);
      }
      polys.add(Float32Array.from(pts), base, top, { roof: rise, kind: 'house' });
    } else {
      // flat roof with a parapet
      const contour = [];
      for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(pts[i * 2], pts[i * 2 + 1]));
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      const g = shade(rc, 1.0);
      for (const [a, b2, c2] of tris) {
        const A = [pts[a * 2], top + 0.02, pts[a * 2 + 1]], B = [pts[b2 * 2], top + 0.02, pts[b2 * 2 + 1]], Cc = [pts[c2 * 2], top + 0.02, pts[c2 * 2 + 1]];
        const up = (B[2] - A[2]) * (Cc[0] - A[0]) - (B[0] - A[0]) * (Cc[2] - A[2]);
        const tri = up > 0 ? [A, B, Cc] : [A, Cc, B];
        T0.wall.tri(tri[0], tri[1], tri[2], [0, 1, 0], g, tri.map(p => [p[0], p[2]]), STYLE.gravel);
        T0.far.tri(tri[0], tri[1], tri[2], [0, 1, 0], g, tri.map(p => [p[0], p[2]]), STYLE.gravel);
      }
      // parapet: the wall rises 0.6 m above the roof, with a cap
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = pts[i * 2], az = pts[i * 2 + 1], bx = pts[j * 2], bz = pts[j * 2 + 1];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 0.05) continue;
        const nx = (bz - az) / L * sgn, nz = -(bx - ax) / L * sgn;
        const y0 = top, y1 = top + 0.6;
        const A = [ax, y0, az], B = [bx, y0, bz], C2 = [bx, y1, bz], D = [ax, y1, az];
        const crz = -(B[2] - A[2]) * (y1 - y0) * nx + (B[0] - A[0]) * (y1 - y0) * nz;
        const uv = [[0, y0], [L, y0], [L, y1], [0, y1]];
        for (const bt of [T0.wall, T0.far]) {
          if (crz >= 0) bt.quad(A, B, C2, D, [nx, 0, nz], [col, col, col, col], uv, church ? STYLE.p : sty);
          else bt.quad(A, D, C2, B, [nx, 0, nz], [col, col, col, col], [uv[0], uv[3], uv[2], uv[1]], church ? STYLE.p : sty);
        }
        // inner face, a little darker
        const k = shade(col, 0.7);
        const Ai = [ax - nx * 0.25, y0, az - nz * 0.25], Bi = [bx - nx * 0.25, y0, bz - nz * 0.25];
        const Ci = [Bi[0], y1, Bi[2]], Di = [Ai[0], y1, Ai[2]];
        if (crz >= 0) T0.wall.quad(Ai, Di, Ci, Bi, [-nx, 0, -nz], [k, k, k, k], [uv[0], uv[3], uv[2], uv[1]], STYLE.p);
        else T0.wall.quad(Ai, Bi, Ci, Di, [-nx, 0, -nz], [k, k, k, k], uv, STYLE.p);
        const capc = shade(white, 0.72);
        T0.wall.quad(D, C2, Ci, Di, [0, 1, 0], [capc, capc, capc, capc], [[0, 0], [L, 0], [L, 0.25], [0, 0.25]], STYLE.stone);
      }
      polys.add(Float32Array.from(pts), base, top, { roof: 0, kind: 'flat', walk: true });
    }
    if (church) {
      // a tower at the west end of the church
      let wi = 0;
      for (let i = 1; i < n; i++) if (pts[i * 2] < pts[wi * 2]) wi = i;
      const tx = pts[wi * 2] + 4.5, tz = pts[wi * 2 + 1];
      opts.geo.box(opts.stone, tx - 3.5, base, tz - 3.5, tx + 3.5, top + 14, tz + 3.5);
      opts.geo.geom(opts.copper, new THREE.ConeGeometry(5.2, 12, 4), new THREE.Matrix4().makeRotationY(Math.PI / 4).premultiply(new THREE.Matrix4().makeTranslation(tx, top + 20, tz)));
      polys.add(Float32Array.from([tx - 3.5, tz - 3.5, tx + 3.5, tz - 3.5, tx + 3.5, tz + 3.5, tx - 3.5, tz + 3.5]), base, top + 14, {});
    }
    if (b.n) named.push(b);
  }

  if (opts.extra) opts.extra(tileOf, STYLE);

  // one LOD per tile: near = walls, roofs, streets + windows; far = the same with painted windows
  const lods = [];
  for (const t of tiles.values()) {
    const near = new THREE.Group();
    const w = t.wall.mesh(facadeMat), win = t.win.mesh(winMat, false);
    if (w) near.add(w);
    if (win) near.add(win);
    const far = t.far.mesh(facadeMat);
    const lod = new THREE.LOD();
    lod.addLevel(near, 0);
    if (far) lod.addLevel(far, 230);
    lod.position.set(0, 0, 0);
    lod.autoUpdate = true;
    // LOD distance is measured to the object's position: put it at the tile centre
    for (const ch of [near, far]) if (ch) ch.position.set(-t.cx, 0, -t.cz);
    lod.position.set(t.cx, 0, t.cz);
    scene.add(lod);
    lods.push(lod);
  }
  return { named, lods, facadeMat };
}
