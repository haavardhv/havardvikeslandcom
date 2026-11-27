// Buildings from the cleaned-up OpenStreetMap outlines (see tools/build_map.py), with
// facades and roofs that make sense:
//  - no windows on party walls (edges another building touches),
//  - storeys counted down from the eaves, windows only where the bay is above the ground,
//  - a stone plinth that follows the slope, a front door on the edge facing the street,
//  - shopfronts on commercial ground floors, corner boards on wooden houses,
//  - roofs built as a height field over the footprint itself (gable, hip, pyramid or flat),
//    split into planar pieces where the slopes meet. The walls rise to exactly that roof line,
//    so a roof can never hang past its walls, and every gable is closed. Free edges get an
//    overhang with a soffit and a fascia board; edges against a neighbour stay flush.
//  - courtyards (holes), buildings bridging a street, and roofs on posts (canopies).
// Everything for a 100 m tile is merged into a few meshes (walls, windows+doors+trims) that
// share texture atlases. Each tile also has a cheap far version (walls with painted windows,
// no separate window geometry).
import * as THREE from '../vendor/three.module.min.js';
import { rng } from './textures.js';

const TILE = 100;
const STOREY = 2.9;
// one atlas for walls, roofs and street surfaces: 4 x 4 cells of 256 px
export const STYLE = { w: 0, y: 1, p: 2, b: 3, stone: 4, gravel: 5, wfar: 6, pfar: 7, roof: 8, asphalt: 9, cobble: 10, paving: 11, steps: 12, side: 13, foot: 14 };
export const TILE_M = [1.2, 1.2, 3.0, 1.6, 2.4, 3.0, 2.4, 2.4, 1.0, 4.0, 2.4, 2.4, 0.64, 3.0, 3.0, 1.0];   // metres per texture repeat

export function facadeAtlas(T) {
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
  // one triangle, wound so it faces along nrm
  tri3(a, b, c, nrm, ca, cb, cc, ua, ub, uc, sty) {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    const d = (e1y * e2z - e1z * e2y) * nrm[0] + (e1z * e2x - e1x * e2z) * nrm[1] + (e1x * e2y - e1y * e2x) * nrm[2];
    const V = d >= 0 ? [[a, ca, ua], [b, cb, ub], [c, cc, uc]] : [[a, ca, ua], [c, cc, uc], [b, cb, ub]];
    for (const [P, C, U] of V) {
      this.p.push(P[0], P[1], P[2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.c.push(C.r, C.g, C.b); this.u.push(U[0], U[1]);
      if (this.facade) this.s.push(sty);
    }
  }
  // a planar quad a-b-c-d (either winding), facing along nrm
  quad(a, b, c, d, nrm, col, uv, sty) {
    this.tri3(a, b, c, nrm, col[0], col[1], col[2], uv[0], uv[1], uv[2], sty);
    this.tri3(a, c, d, nrm, col[0], col[2], col[3], uv[0], uv[2], uv[3], sty);
  }
  tri(a, b, c, nrm, col, uv, sty) { this.tri3(a, b, c, nrm, col, col, col, uv[0], uv[1], uv[2], sty); }
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

// ---------------------------------------------------------------------------
// 2D helpers: rings are arrays of [x, z]
export function insideRings(rings, x, z) {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], zi = r[i][1], xj = r[j][0], zj = r[j][1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
    }
  }
  return c;
}
const ringsOf = (b) => [b.p, ...(b.h || [])].map(f => { const a = []; for (let i = 0; i < f.length; i += 2) a.push([f[i], f[i + 1]]); return a; });

// Split a convex polygon by the line A x + B z + C = 0.
function splitPoly(poly, L) {
  const s = poly.map(p => { const v = L[0] * p[0] + L[1] * p[1] + L[2]; return Math.abs(v) < 1e-7 ? 0 : v; });
  if (s.every(v => v >= 0) || s.every(v => v <= 0)) return [poly];
  const pos = [], neg = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length, P = poly[i], Q = poly[j], si = s[i], sj = s[j];
    if (si >= 0) pos.push(P);
    if (si <= 0) neg.push(P);
    if ((si > 0 && sj < 0) || (si < 0 && sj > 0)) {
      const t = si / (si - sj), X = [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];
      pos.push(X); neg.push(X);
    }
  }
  return [pos, neg].filter(p => p.length >= 3);
}
// triangles (convex pieces) over which the roof height field is planar
function planarPieces(tris, lines) {
  let cur = tris;
  for (const L of lines) { const nx = []; for (const p of cur) for (const q of splitPoly(p, L)) nx.push(q); cur = nx; }
  const out = [];
  for (const p of cur) for (let k = 1; k < p.length - 1; k++) {
    const a = p[0], b = p[k], c = p[k + 1];
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-6) out.push([a, b, c]);
  }
  return out;
}
function triangulate(rings) {
  const contour = rings[0].map(([x, z]) => new THREE.Vector2(x, z));
  const holes = rings.slice(1).map(r => r.map(([x, z]) => new THREE.Vector2(x, z)));
  const all = [...rings[0], ...rings.slice(1).flat()];
  return THREE.ShapeUtils.triangulateShape(contour, holes).map(([a, b, c]) => [all[a], all[b], all[c]]);
}
// where along a segment (0..1) the planar pieces change
function breaks(ax, az, bx, bz, lines) {
  const ts = [0, 1];
  for (const L of lines) {
    const sa = L[0] * ax + L[1] * az + L[2], sb = L[0] * bx + L[1] * bz + L[2];
    if ((sa > 1e-6 && sb < -1e-6) || (sa < -1e-6 && sb > 1e-6)) ts.push(sa / (sa - sb));
  }
  return ts.sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] > 1e-4);
}

// The roof as a height field over the footprint, in the frame from tools/build_map.py:
// centre (cx, cz), ridge direction u, half length hl along it and half width hw across.
// Returns the height function and the lines where it changes from one plane to another.
function roofField(b) {
  const top = b.t;
  if (!b.r) return { f: () => top, lines: [], rise: 0 };
  const [cx, cz, ux, uz, hl, hw] = b.rf, rise = b.rh;
  const vx = -uz, vz = ux;
  const U = (x, z) => (x - cx) * ux + (z - cz) * uz, V = (x, z) => (x - cx) * vx + (z - cz) * vz;
  let f, fl;
  if (b.r === 'g') {
    f = (x, z) => top + rise * (1 - Math.abs(V(x, z)) / hw);
    fl = [[0, 1, 0]];
  } else if (b.r === 'p') {
    f = (x, z) => top + rise * Math.min(1 - Math.abs(V(x, z)) / hw, 1 - Math.abs(U(x, z)) / hl);
    fl = [[0, 1, 0], [1, 0, 0], [-hw, hl, 0], [hw, hl, 0]];
  } else {
    const k = rise / hw, d = hw - hl;
    f = (x, z) => top + k * Math.min(hw - Math.abs(V(x, z)), hl - Math.abs(U(x, z)));
    fl = [[0, 1, 0], [1, 0, 0], [1, -1, d], [-1, -1, d], [1, 1, d], [-1, 1, d]];
  }
  // frame lines a u + b v + c = 0 -> world A x + B z + C = 0
  const lines = fl.map(([a, bb, c]) => { const A = a * ux + bb * vx, B = a * uz + bb * vz; return [A, B, c - A * cx - B * cz]; });
  return { f, lines, rise, ux, uz, hl, hw, cx, cz };
}

// ---------------------------------------------------------------------------
export function buildBuildings(scene, map, terrain, polys, T, opts) {
  const facadeTex = opts.atlas || facadeAtlas(T);
  const winTex = windowAtlas();
  const facadeMat = facadeMaterial(facadeTex);
  const winMat = new THREE.MeshStandardMaterial({ map: winTex, vertexColors: true, roughness: 0.35, metalness: 0.05 });
  // At night the glass of some windows glows: a window is marked lit by a vertex colour a hair
  // off white (blue 0.996), which nobody can see by day; the glass is where the texture is blue-grey.
  const nightGlow = { value: 0 };
  winMat.onBeforeCompile = (sh) => {
    sh.uniforms.nightGlow = nightGlow;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float nightGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_COLOR
        {
          float litW = step(0.9995, vColor.r) * step(0.9995, vColor.g) * (1.0 - step(0.9985, vColor.b));
          float glassM = smoothstep(0.015, 0.06, diffuseColor.b - diffuseColor.r);
          totalEmissiveRadiance += vec3(1.0, 0.7, 0.4) * litW * glassM * nightGlow * 1.8;
        }
        #endif`);
  };
  winMat.customProgramCacheKey = () => 'nightWindows';
  const tiles = new Map();
  const tileOf = (x, z) => {
    const k = Math.floor(x / TILE) * 1000 + Math.floor(z / TILE);
    if (!tiles.has(k)) {
      const wall = new Batch(true), far = new Batch(true);
      // roof (and street) geometry goes into both levels of detail
      const both = { quad: (...a) => { wall.quad(...a); far.quad(...a); }, tri: (...a) => { wall.tri(...a); far.tri(...a); }, tri3: (...a) => { wall.tri3(...a); far.tri3(...a); } };
      tiles.set(k, { cx: (Math.floor(x / TILE) + 0.5) * TILE, cz: (Math.floor(z / TILE) + 0.5) * TILE, wall, far, win: new Batch(false), roof: both });
    }
    return tiles.get(k);
  };
  const col = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  const shade = (c, k) => new THREE.Color(c.r * k, c.g * k, c.b * k);
  const W4 = [white, white, white, white];
  const lit = new THREE.Color(1, 1, 0.996), L4 = [lit, lit, lit, lit];
  const RL = (() => { let sd = 777; return () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646; })();
  const wu = cellUV(WIN.white, 0.5, 0.5), WU4 = [wu, wu, wu, wu];
  const winUV = (kind) => [cellUV(kind, 0, 0), cellUV(kind, 1, 0), cellUV(kind, 1, 1), cellUV(kind, 0, 1)];
  const DOORCOLS = ['#2b2f33', '#7a2e28', '#2f4a35', '#3b5a78', '#f2f1ec', '#5b3a29'];
  const named = [];
  const popcount = m => ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1) + ((m >> 4) & 1));
  const ROOF_LIFT = 0.15;       // roof thickness above the soffit

  for (const b of map.buildings) {
    const rings = ringsOf(b);
    const outer = rings[0], n = outer.length;
    if (n < 3) continue;
    const T0 = tileOf(outer[0][0], outer[0][1]);
    const R = rng(Math.floor(Math.abs(outer[0][0] * 131 + outer[0][1] * 71)) + n);
    col.set(b.c);
    const top = b.t, base = b.b, el = !!b.el;
    const style = b.s || 'w';
    const church = b.k === 'church';
    const sty = church ? STYLE.p : (STYLE[style] ?? 0);
    const farSty = style === 'p' || style === 'b' || church ? STYLE.pfar : STYLE.wfar;
    const wood = (style === 'w' || style === 'y') && !church;
    const winKind = style === 'y' ? WIN.sixpane : style === 'p' || style === 'b' ? (R() < 0.5 ? WIN.modern : WIN.sixpane) : (R() < 0.75 ? WIN.classic : WIN.sixpane);
    const winW = style === 'y' ? 0.7 : style === 'p' || style === 'b' ? 1.1 : 0.95;
    const winH = style === 'y' ? 1.0 : style === 'p' || style === 'b' ? 1.55 : 1.3;
    const doorCol = new THREE.Color(DOORCOLS[Math.floor(R() * DOORCOLS.length)]);
    const roof = roofField(b);
    const pitched = !!b.r;
    const F = roof.f;
    // the wall reaches the roof line (the top of the roof slab on pitched roofs)
    const wallTop = (x, z) => pitched ? F(x, z) + ROOF_LIFT : top;
    const door = b.d;
    const ringNormals = [];     // per ring: per edge outward normal [nx, nz]

    // ---------------------------------------------------------------- walls
    rings.forEach((ring, ri) => {
      const masks = ri === 0 ? (b.e || []) : ((b.he || [])[ri - 1] || []);
      const nrms = [];
      ringNormals.push(nrms);
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 0.05) { nrms.push(null); continue; }
        const dx = (bx - ax) / L, dz = (bz - az) / L;
        let nx = dz, nz = -dx;
        if (insideRings(rings, (ax + bx) / 2 + nx * 0.05, (az + bz) / 2 + nz * 0.05)) { nx = -nx; nz = -nz; }
        nrms.push([nx, nz]);
        const N = [nx, 0, nz];
        const m = masks[i] ?? 31;
        const P = (t, y) => [ax + (bx - ax) * t, y, az + (bz - az) * t];
        // the ground along this wall
        let gMin = Infinity;
        for (let k = 0; k <= 4; k++) gMin = Math.min(gMin, terrain.height(ax + (bx - ax) * k / 4 + nx * 0.3, az + (bz - az) * k / 4 + nz * 0.3));
        const plinth = el ? base : Math.min(top - 1, Math.max(base + 0.1, gMin + (wood ? 0.45 : 0.2)));
        const ts = breaks(ax, az, bx, bz, roof.lines);
        for (let s = 0; s < ts.length - 1; s++) {
          const ta = ts[s], tb = ts[s + 1];
          const ya = wallTop(ax + (bx - ax) * ta, az + (bz - az) * ta), yb = wallTop(ax + (bx - ax) * tb, az + (bz - az) * tb);
          const uvq = (y0a, y0b, y1a, y1b) => [[L * ta, y0a], [L * tb, y0b], [L * tb, y1b], [L * ta, y1a]];
          // stone plinth below, cladding above, darker towards the ground (ambient occlusion)
          if (!el) T0.wall.quad(P(ta, base), P(tb, base), P(tb, plinth), P(ta, plinth), N, [shade(white, 0.5), shade(white, 0.5), shade(white, 0.85), shade(white, 0.85)], uvq(base, base, plinth, plinth), STYLE.stone);
          const c0 = shade(col, el ? 0.6 : 0.78);
          T0.wall.quad(P(ta, plinth), P(tb, plinth), P(tb, yb), P(ta, ya), N, [c0, c0, col, col], uvq(plinth, plinth, ya, yb), sty);
          T0.far.quad(P(ta, base), P(tb, base), P(tb, yb), P(ta, ya), N, [shade(col, 0.7), shade(col, 0.7), col, col], uvq(base, base, ya, yb), farSty);
        }
        if (ri === 0 && wood && m !== 0) {
          // corner board at the start of this edge (both faces of the corner are done from each side)
          const g0 = Math.max(plinth - 0.25, base);
          const y1 = wallTop(ax, az);
          const ux = dx * 0.14, uz = dz * 0.14, e = 0.02;
          const A = [ax + nx * e, g0, az + nz * e], B = [ax + ux + nx * e, g0, az + uz + nz * e];
          T0.win.quad(A, B, [B[0], y1 - 0.05, B[2]], [A[0], y1 - 0.05, A[2]], N, W4, WU4, 0);
          const y2 = wallTop(bx, bz);
          const C = [bx + nx * e, g0, bz + nz * e], D = [bx - ux + nx * e, g0, bz - uz + nz * e];
          T0.win.quad(C, D, [D[0], y2 - 0.05, D[2]], [C[0], y2 - 0.05, C[2]], N, W4, WU4, 0);
        }
        if (m === 0 || (b.plain && !(ri === 0 && door))) continue;
        // windows: storeys counted down from the eaves
        const doorHere = ri === 0 && door && door[0] === i;
        const doorT = doorHere ? door[1] : -1;
        const doorG = doorHere ? terrain.height(ax + (bx - ax) * doorT + nx * 0.8, az + (bz - az) * doorT + nz * 0.8) : 0;
        const bays = L < 1.3 ? 0 : Math.max(1, Math.floor((L - 0.5) / (style === 'p' || style === 'b' ? 2.6 : 2.3)));
        const o = 0.05;
        const q = (tt, y, off = o) => { const p = P(tt, y); return [p[0] + nx * off, p[1], p[2] + nz * off]; };
        for (let k = 0; k < bays; k++) {
          const t = (k + 0.5) / bays;
          const bit = Math.min(4, Math.floor(t * 5));
          if (!(m & (1 << bit))) continue;
          const gHere = terrain.height(ax + (bx - ax) * t + nx * 0.4, az + (bz - az) * t + nz * 0.4);
          const floor0 = el ? base : Math.max(gHere, plinth);
          for (let f = 0; f < 12; f++) {
            const yTop = top - f * STOREY - 0.55;
            const ww = church ? 1.2 : winW, wh = church ? 2.6 : winH;
            const y0 = yTop - wh;
            if (y0 < floor0 + 0.45) break;
            // the door takes the bay it stands in
            if (doorHere && Math.abs(t - doorT) * L < 1.1 && y0 < doorG + 2.4) continue;
            const shop = b.shop && f > 0 && y0 - STOREY < floor0 + 0.45;
            const kind = church ? WIN.church : winKind;
            const t0 = t - ww / 2 / L, t1 = t + ww / 2 / L;
            if (t0 < 0.02 || t1 > 0.98) continue;
            T0.win.quad(q(t0, y0), q(t1, y0), q(t1, yTop), q(t0, yTop), N, RL() < 0.45 ? L4 : W4, winUV(kind), 0);
            // sill
            const s0 = q(t0 - 0.06 / L, y0 - 0.06), s1 = q(t1 + 0.06 / L, y0 - 0.06);
            T0.win.quad(s0, s1, [s1[0] + nx * 0.1, s1[1], s1[2] + nz * 0.1], [s0[0] + nx * 0.1, s0[1], s0[2] + nz * 0.1], [0, 1, 0], W4, WU4, 0);
            if (shop) {
              // a shopfront under this window
              const sy1 = floor0 + 2.6, sy0 = floor0 + 0.15;
              const st0 = t - 1.0 / L, st1 = t + 1.0 / L;
              if (st0 > 0.02 && st1 < 0.98) T0.win.quad(q(st0, sy0), q(st1, sy0), q(st1, sy1), q(st0, sy1), N, L4, winUV(WIN.shop), 0);
            }
          }
        }
        // a window in the gable
        if (pitched && !church && popcount(m) >= 4 && L > 3.5) {
          let tm = -1, fm = -Infinity;
          for (const t of ts) { const v = F(ax + (bx - ax) * t, az + (bz - az) * t); if (v > fm) { fm = v; tm = t; } }
          const hwin = 0.38 / L;
          if (fm - top > 2.2 && tm - hwin > 0.1 && tm + hwin < 0.9) {
            const wy0 = top + 0.45;
            const wy1 = Math.min(top + 1.5, Math.min(F(...P(tm - hwin, 0).filter((_, k) => k !== 1)), F(...P(tm + hwin, 0).filter((_, k) => k !== 1))) - 0.4);
            if (wy1 - wy0 > 0.6) T0.win.quad(q(tm - hwin, wy0), q(tm + hwin, wy0), q(tm + hwin, wy1), q(tm - hwin, wy1), N, RL() < 0.35 ? L4 : W4, winUV(WIN.attic), 0);
          }
        }
        if (doorHere) {
          const dw = (b.plain ? 2.4 : 1.0) / L, kind = b.plain ? WIN.garage : (b.shop ? WIN.glassdoor : WIN.door);
          const t0 = doorT - dw / 2, t1 = doorT + dw / 2;
          const y0 = doorG - 0.05, y1 = doorG + (b.plain ? 2.3 : 2.2);
          const dc = kind === WIN.door ? doorCol : white;
          T0.win.quad(q(t0, y0, 0.06), q(t1, y0, 0.06), q(t1, y1, 0.06), q(t0, y1, 0.06), N, [dc, dc, dc, dc], winUV(kind), 0);
          // white casing around the door
          for (const [ta, tb, ya, yb] of [[t0 - 0.1 / L, t0, y0, y1 + 0.1], [t1, t1 + 0.1 / L, y0, y1 + 0.1], [t0 - 0.1 / L, t1 + 0.1 / L, y1, y1 + 0.12]])
            T0.win.quad(q(ta, ya, 0.07), q(tb, ya, 0.07), q(tb, yb, 0.07), q(ta, yb, 0.07), N, W4, WU4, 0);
        }
      }
    });

    // ---------------------------------------------------------------- roof
    const rc = new THREE.Color(b.rc);
    if (pitched) {
      // eaves overhang on the free edges; none against a neighbour
      const nrms = ringNormals[0], masks = b.e || [];
      const off = outer.map((_, i) => (nrms[i] && popcount(masks[i] ?? 31) >= 4 ? 0.35 : 0));
      const exp = outer.map((p, i) => {
        const ip = (i - 1 + n) % n;
        const n0 = nrms[ip] || nrms[i] || [0, 0], n1 = nrms[i] || n0, o0 = off[ip], o1 = off[i];
        if (!o0 && !o1) return [p[0], p[1]];
        // intersect the two offset edge lines
        const d0 = [outer[i][0] - outer[ip][0], outer[i][1] - outer[ip][1]], d1 = [outer[(i + 1) % n][0] - p[0], outer[(i + 1) % n][1] - p[1]];
        const P0 = [p[0] + n0[0] * o0, p[1] + n0[1] * o0], P1 = [p[0] + n1[0] * o1, p[1] + n1[1] * o1];
        const den = d0[0] * d1[1] - d0[1] * d1[0];
        let x, z;
        if (!(Math.abs(den) > 0.05 * Math.hypot(...d0) * Math.hypot(...d1))) { x = (P0[0] + P1[0]) / 2; z = (P0[1] + P1[1]) / 2; }
        else { const s = ((P1[0] - P0[0]) * d1[1] - (P1[1] - P0[1]) * d1[0]) / den; x = P0[0] + d0[0] * s; z = P0[1] + d0[1] * s; }
        if (!isFinite(x + z)) return [p[0], p[1]];
        const dd = Math.hypot(x - p[0], z - p[1]);
        if (dd > 1.0) { x = p[0] + (x - p[0]) / dd; z = p[1] + (z - p[1]) / dd; }
        return [x, z];
      });
      const colAt = (y) => shade(rc, 0.78 + 0.22 * Math.max(0, Math.min(1, (y - top) / (roof.rise || 1))));
      // roof surface over the expanded outline
      for (const [a, c1, c2] of planarPieces(triangulate([exp]), roof.lines)) {
        const A = [a[0], F(a[0], a[1]) + ROOF_LIFT, a[1]], B = [c1[0], F(c1[0], c1[1]) + ROOF_LIFT, c1[1]], C = [c2[0], F(c2[0], c2[1]) + ROOF_LIFT, c2[1]];
        const nv = new THREE.Vector3(B[0] - A[0], B[1] - A[1], B[2] - A[2]).cross(new THREE.Vector3(C[0] - A[0], C[1] - A[1], C[2] - A[2])).normalize();
        if (nv.y < 0) nv.negate();
        // tiles run along the eaves: v goes down the slope
        let ex = 1, ez = 0, sx = 0, sz = 1;
        const hl = Math.hypot(nv.x, nv.z);
        if (hl > 1e-3) { sx = nv.x / hl; sz = nv.z / hl; ex = -sz; ez = sx; }
        const uvp = (P) => [P[0] * ex + P[2] * ez, (P[0] * sx + P[2] * sz) / Math.max(0.3, nv.y)];
        T0.roof.tri3(A, B, C, [nv.x, nv.y, nv.z], colAt(A[1]), colAt(B[1]), colAt(C[1]), uvp(A), uvp(B), uvp(C), STYLE.roof);
      }
      // soffits under the overhang and a white fascia board along its edge
      const soffit = shade(white, 0.78);
      for (let i = 0; i < n; i++) {
        if (!off[i]) continue;
        const j = (i + 1) % n;
        for (const [a, c1, c2] of planarPieces([[outer[i], outer[j], exp[j]], [outer[i], exp[j], exp[i]]], roof.lines)) {
          T0.roof.tri3([a[0], F(a[0], a[1]), a[1]], [c1[0], F(c1[0], c1[1]), c1[1]], [c2[0], F(c2[0], c2[1]), c2[1]], [0, -1, 0], soffit, soffit, soffit, [a[0], a[1]], [c1[0], c1[1]], [c2[0], c2[1]], STYLE.p);
        }
        const [ax, az] = exp[i], [bx, bz] = exp[j], N = [nrms[i][0], 0, nrms[i][1]];
        const ts = breaks(ax, az, bx, bz, roof.lines);
        for (let s = 0; s < ts.length - 1; s++) {
          const pa = [ax + (bx - ax) * ts[s], az + (bz - az) * ts[s]], pb = [ax + (bx - ax) * ts[s + 1], az + (bz - az) * ts[s + 1]];
          const fa = F(pa[0], pa[1]), fb = F(pb[0], pb[1]);
          T0.win.quad([pa[0], fa - 0.12, pa[1]], [pb[0], fb - 0.12, pb[1]], [pb[0], fb + ROOF_LIFT + 0.03, pb[1]], [pa[0], fa + ROOF_LIFT + 0.03, pa[1]], N, W4, WU4, 0);
        }
      }
      // chimney on the ridge of most wooden houses
      if (wood && R() < 0.65 && roof.hl > 2.5) {
        const t = (R() - 0.5) * 1.2 * Math.max(0, roof.hl - 1.5);
        const cx = roof.cx + roof.ux * t, cz = roof.cz + roof.uz * t;
        if (insideRings(rings, cx, cz) && insideRings(rings, cx + 0.5, cz + 0.5) && insideRings(rings, cx - 0.5, cz - 0.5)) {
          const s = 0.32, y0 = F(cx, cz) - 1.2, y1 = F(cx, cz) + ROOF_LIFT + 0.9;
          const stone = shade(white, 0.75), S4 = [stone, stone, stone, stone];
          for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const px = cx + ox * s, pz = cz + oz * s, tx = -oz * s, tz = ox * s;
            T0.wall.quad([px - tx, y0, pz - tz], [px + tx, y0, pz + tz], [px + tx, y1, pz + tz], [px - tx, y1, pz - tz], [ox, 0, oz], S4, [[0, y0], [2 * s, y0], [2 * s, y1], [0, y1]], STYLE.b);
          }
          const k = shade(white, 0.3), K4 = [k, k, k, k];
          T0.roof.quad([cx - s - 0.05, y1, cz - s - 0.05], [cx - s - 0.05, y1, cz + s + 0.05], [cx + s + 0.05, y1, cz + s + 0.05], [cx + s + 0.05, y1, cz - s - 0.05], [0, 1, 0], K4, [[0, 0], [0, 1], [1, 1], [1, 0]], STYLE.stone);
        }
      }
      polys.add(Float32Array.from(b.p), base, top, { roof: roof.rise + ROOF_LIFT, kind: 'house', holes: b.h });
    } else {
      // flat roof (courtyards cut out) with a parapet
      const tris = triangulate(rings);
      const g = shade(rc, 1.0);
      for (const [a, c1, c2] of tris) {
        const A = [a[0], top + 0.02, a[1]], B = [c1[0], top + 0.02, c1[1]], C = [c2[0], top + 0.02, c2[1]];
        T0.roof.tri(A, B, C, [0, 1, 0], g, [[A[0], A[2]], [B[0], B[2]], [C[0], C[2]]], STYLE.gravel);
        // the underside of a building bridging a street
        if (el) T0.roof.tri([A[0], base, A[2]], [B[0], base, B[2]], [C[0], base, C[2]], [0, -1, 0], shade(col, 0.5), [[A[0], A[2]], [B[0], B[2]], [C[0], C[2]]], sty);
      }
      rings.forEach((ring, ri) => {
        ring.forEach(([ax, az], i) => {
          const nr = ringNormals[ri][i];
          if (!nr) return;
          const [bx, bz] = ring[(i + 1) % ring.length];
          const L = Math.hypot(bx - ax, bz - az);
          const [nx, nz] = nr, y0 = top, y1 = top + 0.6;
          const uv = [[0, y0], [L, y0], [L, y1], [0, y1]];
          const C4 = [col, col, col, col];
          T0.roof.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], [nx, 0, nz], C4, uv, sty);
          // inner face, a little darker, and the stone cap
          const k = shade(col, 0.7), K4 = [k, k, k, k];
          const Ai = [ax - nx * 0.25, y0, az - nz * 0.25], Bi = [bx - nx * 0.25, y0, bz - nz * 0.25];
          T0.wall.quad(Ai, Bi, [Bi[0], y1, Bi[2]], [Ai[0], y1, Ai[2]], [-nx, 0, -nz], K4, uv, STYLE.p);
          const capc = shade(white, 0.72), CC = [capc, capc, capc, capc];
          T0.wall.quad([ax, y1, az], [bx, y1, bz], [Bi[0], y1, Bi[2]], [Ai[0], y1, Ai[2]], [0, 1, 0], CC, [[0, 0], [L, 0], [L, 0.25], [0, 0.25]], STYLE.stone);
        });
      });
      polys.add(Float32Array.from(b.p), base, top, { roof: 0, kind: 'flat', walk: !el, holes: b.h, el });
    }

    if (church) {
      // a tower at one end of the church, inside its footprint
      let ux = 1, uz = 0, hl = 0, cx = 0, cz = 0;
      if (b.rf) [cx, cz, ux, uz, hl] = b.rf;
      else {
        let bi = 0, bl = 0;
        for (let i = 0; i < n; i++) { const j = (i + 1) % n, l = Math.hypot(outer[j][0] - outer[i][0], outer[j][1] - outer[i][1]); if (l > bl) { bl = l; bi = i; } }
        const j = (bi + 1) % n; ux = (outer[j][0] - outer[bi][0]) / bl; uz = (outer[j][1] - outer[bi][1]) / bl;
        cx = outer.reduce((s, p) => s + p[0], 0) / n; cz = outer.reduce((s, p) => s + p[1], 0) / n;
        hl = Math.max(...outer.map(p => Math.abs((p[0] - cx) * ux + (p[1] - cz) * uz)));
      }
      const vx = -uz, vz = ux, hs = 3.5;
      for (const sgn of [-1, 1]) {
        const tx = cx + ux * sgn * (hl - hs - 0.5), tz = cz + uz * sgn * (hl - hs - 0.5);
        const ok = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].every(([a, c]) => insideRings(rings, tx + (ux * a + vx * c) * hs, tz + (uz * a + vz * c) * hs));
        if (!ok) continue;
        const ry = Math.atan2(-uz, ux);
        const ttop = top + (roof.rise || 0) + 12;
        opts.geo.obox(opts.stone, tx, (base + ttop) / 2, tz, hs * 2, ttop - base, hs * 2, 0, ry, 0);
        opts.geo.geom(opts.copper, new THREE.ConeGeometry(hs * 1.45, 12, 4), new THREE.Matrix4().makeRotationY(Math.PI / 4 + ry).premultiply(new THREE.Matrix4().makeTranslation(tx, ttop + 6, tz)));
        const sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([a, c]) => [tx + (ux * a + vx * c) * hs, tz + (uz * a + vz * c) * hs]);
        polys.add(Float32Array.from(sq), base, ttop, {});
        break;
      }
    }
    if (b.n) named.push(b);
  }

  // ---------------------------------------------------------------- canopies: a roof on posts
  for (const cn of map.canopies || []) {
    const ring = []; for (let i = 0; i < cn.p.length; i += 2) ring.push([cn.p[i], cn.p[i + 1]]);
    const T0 = tileOf(ring[0][0], ring[0][1]);
    const y1 = cn.y, y0 = cn.y - 0.25;
    const top = shade(white, 0.42), under = shade(white, 0.7);
    for (const [a, c1, c2] of triangulate([ring])) {
      T0.roof.tri([a[0], y1, a[1]], [c1[0], y1, c1[1]], [c2[0], y1, c2[1]], [0, 1, 0], top, [a, c1, c2], STYLE.gravel);
      T0.roof.tri([a[0], y0, a[1]], [c1[0], y0, c1[1]], [c2[0], y0, c2[1]], [0, -1, 0], under, [a, c1, c2], STYLE.p);
    }
    const posts = [];
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      let nx = (bz - az) / L, nz = -(bx - ax) / L;
      if (insideRings([ring], (ax + bx) / 2 + nx * 0.05, (az + bz) / 2 + nz * 0.05)) { nx = -nx; nz = -nz; }
      T0.win.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], [nx, 0, nz], W4, WU4, 0);
      const k = Math.max(1, Math.round(L / 6));
      for (let s = 0; s < k; s++) posts.push([ax + (bx - ax) * s / k - nx * 0.25, az + (bz - az) * s / k - nz * 0.25]);
    }
    const pc = shade(white, 0.25), P4 = [pc, pc, pc, pc];
    for (const [px, pz] of posts) {
      const g = terrain.height(px, pz) - 0.2, s = 0.09;
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cx = px + ox * s, cz = pz + oz * s, tx = -oz * s, tz = ox * s;
        T0.wall.quad([cx - tx, g, cz - tz], [cx + tx, g, cz + tz], [cx + tx, y0, cz + tz], [cx - tx, y0, cz - tz], [ox, 0, oz], P4, [[0, g], [0.2, g], [0.2, y0], [0, y0]], STYLE.stone);
      }
      polys.add(Float32Array.from([px - 0.1, pz - 0.1, px + 0.1, pz - 0.1, px + 0.1, pz + 0.1, px - 0.1, pz + 0.1]), g, y0, { tree: true, noCam: true });
    }
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
    lod.autoUpdate = true;
    // LOD distance is measured to the object's position: put it at the tile centre
    // (the meshes do not update their own matrices: do it here, or the far level is drawn displaced)
    for (const ch of [near, far]) if (ch) { ch.position.set(-t.cx, 0, -t.cz); ch.updateMatrix(); }
    lod.position.set(t.cx, 0, t.cz);
    scene.add(lod);
    lods.push(lod);
  }
  return { named, lods, facadeMat, nightGlow };
}
