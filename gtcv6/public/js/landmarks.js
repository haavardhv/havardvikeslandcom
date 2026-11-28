// The town's landmarks, modelled after photographs, on their OpenStreetMap outlines: the
// churches (Domkirken, Korskirken, Mariakirken, Johanneskirken), Bergenhus (Håkonshallen and
// Rosenkrantztårnet), the railway station, the city hall, Mathallen and the fish market,
// Den blå steinen, the bandstand in Byparken, the Seamen's monument on Torgallmenningen, the
// statues, the fountain in Lille Lungegårdsvann and the fire station tower on Skansen.
//
// prepareLandmarks(map) runs before the town is built: it takes the buildings that get a model
// of their own out of the generic builder (`skip`), and restyles the ones that only need
// their real colours or height. buildLandmarks() then builds the models.
import * as THREE from '../vendor/three.module.min.js';
import { Geo } from './engine.js';
import { triangulate, planarPieces, breaks, insideRings } from './buildings.js';

// ---------------------------------------------------------------------------- finding buildings
const centroid = (p) => { let x = 0, z = 0; const n = p.length / 2; for (let i = 0; i < n; i++) { x += p[i * 2]; z += p[i * 2 + 1]; } return [x / n, z / n]; };
function insideP(p, x, z) {
  let c = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const byName = (map, n) => map.buildings.find(b => b.n === n);
const atPoint = (map, x, z) => map.buildings.find(b => insideP(b.p, x, z));
const ringOf = (p) => { const a = []; for (let i = 0; i < p.length; i += 2) a.push([p[i], p[i + 1]]); return a; };

// An oriented frame for a footprint: the longest edge's direction, the extents along it and
// across it, and the centre of that box.
function frameOf(p, dir) {
  const r = ringOf(p);
  let ux, uz;
  if (dir) [ux, uz] = dir;
  else {
    let bl = 0;
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length, l = Math.hypot(r[j][0] - r[i][0], r[j][1] - r[i][1]);
      if (l > bl) { bl = l; ux = (r[j][0] - r[i][0]) / l; uz = (r[j][1] - r[i][1]) / l; }
    }
  }
  const vx = -uz, vz = ux;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, z] of r) { const u = x * ux + z * uz, v = x * vx + z * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  if (!dir && v1 - v0 > u1 - u0) return frameOf(p, [vx, vz]);
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const cx = cu * ux + cv * vx, cz = cu * uz + cv * vz;
  return { cx, cz, ux, uz, vx, vz, hl: (u1 - u0) / 2, hw: (v1 - v0) / 2, at: (u, v) => [cx + ux * u + vx * v, cz + uz * u + vz * v], ang: Math.atan2(ux, uz) };
}

// ---------------------------------------------------------------------------- before the town is built
export function prepareLandmarks(map) {
  const L = {};
  const take = (key, b) => { if (b) { b.skip = true; L[key] = b; } };
  take('dom', byName(map, 'Bergen domkirke'));
  take('kors', byName(map, 'Korskirken'));
  take('maria', byName(map, 'Mariakirken'));
  take('pavilion', byName(map, 'Musikkpaviljongen'));
  take('seamen', byName(map, 'Sjømannsmonumentet'));
  take('mathallen', byName(map, 'Mathallen'));
  take('hakon', byName(map, 'Håkonshallen'));
  take('rosen', byName(map, 'Rosenkrantztårnet'));
  take('johannes', byName(map, 'Johanneskirken') || atPoint(map, -772, 508));
  take('grieg', byName(map, 'Grieghallen'));
  // Fløyen: OpenStreetMap draws the upper station and Fløien Folkerestaurant as one outline round
  // the end of the track; both are modelled below, with the viewing terrace you step out onto
  { const f = map.funicular; if (f && f.length >= 4) take('floyen', atPoint(map, f[f.length - 2], f[f.length - 1])); }
  take('uimuseum', byName(map, 'De naturhistoriske samlinger (Universitetsmuseet – Naturhistorie)'));
  // restyled, with towers and details added below
  take('radhus', byName(map, 'Bergen rådhus'));
  take('station', byName(map, 'Bergen'));
  const kj = byName(map, 'Kjøttbasaren');
  if (kj) { L.kjott = kj; Object.assign(kj, { c: '#a8492f', s: 'b', rc: '#3b3c3f' }); }
  const sk = byName(map, 'Skansen brannstasjon');
  if (sk) { L.skansen = sk; Object.assign(sk, { c: '#f1eee6', s: 'w', rc: '#2f3134' }); }
  // Kong Olav Vs plass 4: the salmon-pink building with Bergens Tidende's neon sign on its roof
  const bt = atPoint(map, -602, 155);
  if (bt) { L.bt = bt; Object.assign(bt, { c: '#e8c6b4', rc: '#a7553a', s: 'p' }); }
  const pm = byName(map, 'Permanenten');
  if (pm) { L.perm = pm; Object.assign(pm, { c: '#a3472f', s: 'b', rc: '#55806d' }); }
  const lib = byName(map, 'Bergen Offentlige Bibliotek');
  if (lib) { L.lib = lib; Object.assign(lib, { c: '#9d9688', s: 'p', rc: '#3b3d40' }); }
  // Bryggen, after photos: narrow houses with steep gables to the harbour (the ridge runs back
  // from the quay, not along the row), mostly red and oxblood with white, ochre and pale yellow
  // ones between, orange clay tiles, grey-green bargeboards and corner boards on the red houses,
  // and shops on the ground floor
  const BRY = ['#b23a2b', '#8c2c24', '#b23a2b', '#a5352e', '#efece3', '#c24e37', '#97302a', '#b8402f', '#d6a03f', '#8c2c24', '#efece3', '#b23a2b', '#e6cf86', '#a5352e'];
  for (const b of map.buildings) {
    if (b.k !== 'bryggen' || b.skip) continue;
    const [cx, cz] = centroid(b.p), h = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1;
    b.c = BRY[Math.floor(h * BRY.length)];
    const light = ['#efece3', '#e6cf86', '#d6a03f', '#d9b45c'].includes(b.c);
    b.trim = light ? '#f3f1ea' : '#62776a';
    b.rc = h * 7 % 1 < 0.82 ? '#b2552f' : '#4a4643';
    b.s = 'y'; b.shop = 1; b.plain = 0;
    if (b.rf && (b.r === 'g' || b.r === 'h')) {
      const [x, z, ux, uz, hl, hw] = b.rf;
      if (hl < hw) b.rf = [x, z, -uz, ux, hw, hl];
      b.r = 'g'; b.rh = Math.max(b.rh || 0, b.rf[5] * 1.5);
    }
  }
  return L;
}

// ---------------------------------------------------------------------------- materials
function canvasTex(size, draw, metres, opts = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.repeat.set(1 / metres, 1 / (opts.metresV || metres));
  return t;
}
function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
function makeMaterials() {
  const R = rnd(17);
  const speck = (g, S, n, a) => { for (let k = 0; k < n; k++) { const v = R() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${R() * a})`; g.fillRect(R() * S, R() * S, 2, 2); } };
  // whitewashed plaster with soft streaks
  const plaster = (base) => canvasTex(256, (g, S) => {
    g.fillStyle = base; g.fillRect(0, 0, S, S); speck(g, S, 5000, 0.05);
    for (let k = 0; k < 10; k++) { const x = R() * S, w = 4 + R() * 14, h = 60 + R() * 150, y = R() * S, gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(70,66,60,0.05)'); gr.addColorStop(1, 'rgba(70,66,60,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.fillRect(x, y - S, w, h); }
  }, 4);
  // dressed granite blocks (Domkirken's base, Bergenhus)
  const ashlar = (base, rows) => canvasTex(256, (g, S) => {
    g.fillStyle = '#6f6c66'; g.fillRect(0, 0, S, S);
    const h = S / rows;
    for (let j = 0; j < rows; j++) { let x = -(j % 2) * 40 - R() * 30; while (x < S) { const w = 50 + R() * 50, v = R() * 22 - 11; g.fillStyle = base; g.globalAlpha = 1; g.fillRect(x + 2, j * h + 2, w - 3, h - 3); g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 120})` : `rgba(0,0,0,${-v / 100})`; g.fillRect(x + 2, j * h + 2, w - 3, h - 3); x += w; } }
    speck(g, S, 4000, 0.12);
  }, 3);
  // rubble stone (Mariakirken, Håkonshallen)
  const rubble = (base) => canvasTex(256, (g, S) => {
    g.fillStyle = '#5d5953'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 140; k++) { const x = R() * S, y = R() * S, rx = 8 + R() * 18, ry = 6 + R() * 10, v = 0.82 + R() * 0.3; g.fillStyle = base; g.globalAlpha = 1; g.beginPath(); g.ellipse(x, y, rx, ry, R() * 0.6 - 0.3, 0, 7); g.fill(); g.fillStyle = `rgba(${v > 1 ? '255,255,255' : '0,0,0'},${Math.abs(v - 1) * 0.6})`; g.fill(); }
    speck(g, S, 3000, 0.1);
  }, 3);
  const brick = (base) => canvasTex(256, (g, S) => {
    g.fillStyle = '#bdb5a8'; g.fillRect(0, 0, S, S);
    const rows = 24, h = S / rows, w = h * 2.7;
    for (let j = 0; j < rows; j++) for (let x = -(j % 2) * w / 2; x < S; x += w) { const v = 0.85 + R() * 0.25; g.fillStyle = base; g.globalAlpha = 1; g.fillRect(x + 1.5, j * h + 1.5, w - 3, h - 3); g.fillStyle = `rgba(0,0,0,${(1.1 - v) * 0.6})`; g.fillRect(x + 1.5, j * h + 1.5, w - 3, h - 3); }
  }, 1.6);
  // standing-seam copper, gone green
  const copper = canvasTex(256, (g, S) => {
    g.fillStyle = '#6f9e88'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '30,70,55' : '190,225,205'},${R() * 0.12})`; g.fillRect(R() * S, R() * S, 3 + R() * 8, 2 + R() * 8); }
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(30,60,48,0.35)'; g.fillRect(i * S / 8, 0, 2, S); g.fillStyle = 'rgba(220,240,230,0.25)'; g.fillRect(i * S / 8 + 2, 0, 2, S); }
  }, 2);
  const slate = (base) => canvasTex(256, (g, S) => {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    const rows = 16, h = S / rows;
    for (let j = 0; j < rows; j++) for (let x = -(j % 2) * 12; x < S; x += 24) { const v = R() * 0.18; g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${v})`; g.fillRect(x + 1, j * h + 1, 22, h - 2); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, j * h + h - 2, 24, 2); }
  }, 2.4);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  const M = {
    plasterW: std({ map: plaster('#ece8dd') }),
    plasterCream: std({ map: plaster('#e9dfc8') }),
    plasterYellow: std({ map: plaster('#e8c55e') }),
    granite: std({ map: ashlar('#a9a69e', 8) }),
    graniteDark: std({ map: ashlar('#8c8981', 8) }),
    rubble: std({ map: rubble('#9b968a') }),
    brickRed: std({ map: brick('#9b3f2c') }),
    copper: std({ map: copper, roughness: 0.6, metalness: 0.15 }),
    slateDark: std({ map: slate('#3a3b3e'), roughness: 0.6 }),
    shingle: std({ map: slate('#2e2a27'), roughness: 0.8 }),
    trim: std({ color: 0xb7b3a8 }),
    white: std({ color: 0xf0eee8 }),
    dark: std({ color: 0x222426, roughness: 0.6 }),
    iron: std({ color: 0x2c3a33, roughness: 0.45, metalness: 0.5 }),
    gold: std({ color: 0xd2a640, roughness: 0.3, metalness: 0.8 }),
    bronze: std({ color: 0x4b5a4c, roughness: 0.45, metalness: 0.6 }),
    wood: std({ color: 0x7a5434 }),
  };
  return M;
}

// windows and doors as decals on the walls (a little proud, drawn first in depth)
function decalTex(draw, w = 128, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function decalMaterials() {
  const mk = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, transparent: !!o.transparent, alphaTest: o.transparent ? 0.5 : 0, ...o.m });
  const lancet = decalTex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    const arch = (inset) => { g.beginPath(); g.moveTo(inset, h); g.lineTo(inset, w * 0.6); g.quadraticCurveTo(inset, inset * 0.6, w / 2, inset * 0.4); g.quadraticCurveTo(w - inset, inset * 0.6, w - inset, w * 0.6); g.lineTo(w - inset, h); g.closePath(); };
    g.fillStyle = '#b5b0a4'; arch(0); g.fill();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5f7089'); gr.addColorStop(1, '#262d3b'); g.fillStyle = gr; arch(12); g.fill();
    g.save(); arch(12); g.clip();
    for (let k = 0; k < 60; k++) { g.fillStyle = ['rgba(170,60,50,0.35)', 'rgba(210,180,90,0.3)', 'rgba(80,130,180,0.35)'][k % 3]; g.fillRect(12 + (k * 37) % (w - 24), (k * 53) % h, 10, 10); }
    g.strokeStyle = 'rgba(25,25,25,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    for (let y = 40; y < h; y += 18) { g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.restore();
  });
  const round = decalTex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    const arch = (i) => { g.beginPath(); g.moveTo(i, h); g.lineTo(i, w / 2); g.arc(w / 2, w / 2, w / 2 - i, Math.PI, 0); g.lineTo(w - i, h); g.closePath(); };
    g.fillStyle = '#c9c4b6'; arch(0); g.fill();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#556274'); gr.addColorStop(1, '#22272f'); g.fillStyle = gr; arch(14); g.fill();
  });
  const slit = decalTex((g, w, h) => { g.fillStyle = '#9d988c'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c1f24'; g.beginPath(); g.moveTo(w * 0.3, h); g.lineTo(w * 0.3, h * 0.2); g.lineTo(w / 2, 4); g.lineTo(w * 0.7, h * 0.2); g.lineTo(w * 0.7, h); g.fill(); });
  const clock = decalTex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#1d1f22'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 1, 0, 7); g.fill();
    g.fillStyle = '#f4f1e6'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 7, 0, 7); g.fill();
    g.fillStyle = '#1d1f22'; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.fillRect(w / 2 + Math.cos(a) * (w / 2 - 16) - 3, h / 2 + Math.sin(a) * (w / 2 - 16) - 3, 6, 6); }
    g.lineWidth = 5; g.lineCap = 'round'; g.strokeStyle = '#1d1f22';
    g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 26, h / 2 - 22); g.stroke();
    g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - 6, h / 2 - 44); g.stroke();
  }, 128, 128);
  const door = decalTex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#9e998d'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, w * 0.55); g.quadraticCurveTo(0, 0, w / 2, 0); g.quadraticCurveTo(w, 0, w, w * 0.55); g.lineTo(w, h); g.fill();
    g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(14, h); g.lineTo(14, w * 0.6); g.quadraticCurveTo(14, 16, w / 2, 14); g.quadraticCurveTo(w - 14, 16, w - 14, w * 0.6); g.lineTo(w - 14, h); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, 20); g.lineTo(w / 2, h); g.stroke();
    for (let y = 90; y < h; y += 28) { g.beginPath(); g.moveTo(14, y); g.lineTo(w - 14, y); g.stroke(); }
  });
  const sash = decalTex((g, w, h) => {
    g.fillStyle = '#f2f0e8'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w * 0.4, h); gr.addColorStop(0, '#a9bcc8'); gr.addColorStop(0.4, '#5d7484'); gr.addColorStop(1, '#2a3540'); g.fillStyle = gr; g.fillRect(9, 9, w - 18, h - 18);
    g.fillStyle = '#f2f0e8'; g.fillRect(w / 2 - 3, 9, 6, h - 18); for (let j = 1; j < 4; j++) g.fillRect(9, 9 + (h - 18) * j / 4 - 3, w - 18, 6);
  }, 96, 160);
  return { lancet: mk(lancet, { transparent: true }), round: mk(round, { transparent: true }), slit: mk(slit), clock: mk(clock, { transparent: true }), door: mk(door, { transparent: true }), sash: mk(sash) };
}

// ---------------------------------------------------------------------------- geometry helpers
// A body over a footprint with walls rising to a roof made of gable "arms": each arm a gable
// along its own axis (cx, cz, ux, uz, hl, hw, rise). Where arms cross (a cruciform church)
// the roof is the higher of them, with valleys where they meet. Walls stop at the roof line,
// so gables are always closed.
function roofedBody(G, ring, base, top, arms, wallMat, roofMat, opts = {}) {
  const A = arms.map(a => ({ ...a, vx: -a.uz, vz: a.ux }));
  const F = (x, z) => {
    let h = top;
    for (const a of A) {
      const u = (x - a.cx) * a.ux + (z - a.cz) * a.uz, v = (x - a.cx) * a.vx + (z - a.cz) * a.vz;
      if (Math.abs(u) <= a.hl + 0.01 && Math.abs(v) <= a.hw + 0.01) h = Math.max(h, top + a.rise * (1 - Math.abs(v) / a.hw));
    }
    return h;
  };
  const lines = [];
  const L = (au, av, c, a) => { const Ax = au * a.ux + av * a.vx, Az = au * a.uz + av * a.vz; lines.push([Ax, Az, c - Ax * a.cx - Az * a.cz]); };
  for (const a of A) { L(0, 1, 0, a); L(1, 0, -a.hl, a); L(1, 0, a.hl, a); L(0, 1, -a.hw, a); L(0, 1, a.hw, a); }
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) for (const si of [1, -1]) for (const sj of [1, -1]) {
    const a = A[i], b = A[j], ka = a.rise * si / a.hw, kb = b.rise * sj / b.hw;
    const Ax = -ka * a.vx + kb * b.vx, Az = -ka * a.vz + kb * b.vz;
    const C = a.rise - b.rise + ka * (a.cx * a.vx + a.cz * a.vz) - kb * (b.cx * b.vx + b.cz * b.vz);
    if (Math.hypot(Ax, Az) > 1e-6) lines.push([Ax, Az, C]);
  }
  const lift = opts.lift ?? 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    let nx = (bz - az) / len, nz = -(bx - ax) / len;
    if (insideRings([ring], (ax + bx) / 2 + nx * 0.05, (az + bz) / 2 + nz * 0.05)) { nx = -nx; nz = -nz; }
    const ts = breaks(ax, az, bx, bz, lines);
    for (let s = 0; s < ts.length - 1; s++) {
      const t0 = ts[s], t1 = ts[s + 1];
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const y0 = F(x0, z0) + lift, y1 = F(x1, z1) + lift;
      G.quad(wallMat, [x0, base, z0], [x1, base, z1], [x1, y1, z1], [x0, y0, z0], [[len * t0, base], [len * t1, base], [len * t1, y1], [len * t0, y0]], [nx, 0, nz]);
    }
  }
  for (const [a, b, c] of planarPieces(triangulate([ring]), lines)) {
    const P = (q) => [q[0], F(q[0], q[1]) + lift, q[1]];
    const pa = P(a), pb = P(b), pc = P(c);
    const n = new THREE.Vector3(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]).cross(new THREE.Vector3(pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2])).normalize();
    if (n.y < 0) n.negate();
    const k = Math.max(0.3, n.y);
    const uv = (q) => [q[0] * (Math.abs(n.z) > Math.abs(n.x) ? 1 : 0) + q[2] * (Math.abs(n.z) > Math.abs(n.x) ? 0 : 1), (q[0] * n.x + q[2] * n.z) / Math.hypot(n.x, n.z || 1e-6) / k];
    G.tri(F(a[0], a[1]) > top + 0.01 || F(b[0], b[1]) > top + 0.01 || F(c[0], c[1]) > top + 0.01 ? roofMat : (opts.flatMat || roofMat), pa, pb, pc, [uv(pa), uv(pb), uv(pc)], [n.x, n.y, n.z]);
  }
  return F;
}
// a box standing on its base, turned by ang (radians, as three.js rotation.y)
function boxAt(G, mat, x, y0, z, w, h, d, ang) { G.obox(mat, x, y0 + h / 2, z, w, h, d, 0, ang, 0); }
// a turned profile (r, y pairs) round the y axis: domes, bell roofs, round spires
function lathe(G, mat, x, y, z, prof, segs = 16, ang = 0) {
  const g = new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), segs);
  G.geom(mat, g, new THREE.Matrix4().makeRotationY(ang).premultiply(new THREE.Matrix4().makeTranslation(x, y, z)));
}
function cone(G, mat, x, y, z, r, h, sides, ang = 0) {
  const g = new THREE.ConeGeometry(r, h, sides); g.translate(0, h / 2, 0);
  G.geom(mat, g, new THREE.Matrix4().makeRotationY(ang + (sides === 4 ? Math.PI / 4 : 0)).premultiply(new THREE.Matrix4().makeTranslation(x, y, z)));
}
function cyl(G, mat, x, y, z, r0, r1, h, sides = 12) {
  const g = new THREE.CylinderGeometry(r1, r0, h, sides); g.translate(0, h / 2, 0);
  G.geom(mat, g, new THREE.Matrix4().makeTranslation(x, y, z));
}
function sphere(G, mat, x, y, z, r) { G.geom(mat, new THREE.SphereGeometry(r, 10, 8), new THREE.Matrix4().makeTranslation(x, y, z)); }
// a decal on a vertical face: centre (x, z) on the face, normal (nx, nz), bottom y0, size w x h
function decal(G, mat, x, z, nx, nz, y0, w, h, out = 0.04) {
  // t runs to the right of someone facing the wall, so lettering reads the right way round
  const tx = nz, tz = -nx, hx = tx * w / 2, hz = tz * w / 2, ox = x + nx * out, oz = z + nz * out;
  G.quad(mat, [ox - hx, y0, oz - hz], [ox + hx, y0, oz + hz], [ox + hx, y0 + h, oz + hz], [ox - hx, y0 + h, oz - hz], [[0, 0], [1, 0], [1, 1], [0, 1]], [nx, 0, nz]);
}
// decals along every long wall of a footprint, between y0 and y0 + h, one every `step` metres
function windowsAlong(G, mat, ring, y0, w, h, step, minLen = 4, skipNear = null) {
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], len = Math.hypot(bx - ax, bz - az);
    if (len < minLen) continue;
    let nx = (bz - az) / len, nz = -(bx - ax) / len;
    if (insideRings([ring], (ax + bx) / 2 + nx * 0.05, (az + bz) / 2 + nz * 0.05)) { nx = -nx; nz = -nz; }
    const n = Math.max(1, Math.floor((len - 1) / step));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (skipNear && skipNear(x, z)) continue;
      decal(G, mat, x, z, nx, nz, typeof y0 === 'function' ? y0(x, z) : y0, w, h);
    }
  }
}

// ---------------------------------------------------------------------------- the landmarks
export function buildLandmarks(scene, map, L, { terrain, polys, onRoad }) {
  const M = makeMaterials(), D = decalMaterials();
  const glowMats = [[D.lancet, 0, 0.5], [D.round, 0, 0.45], [D.clock, 0.05, 0.9], [D.sash, 0, 0.35]];
  const groups = [];
  const artNamedFirst = (n) => (map.art || []).find(a => a.n === n);
  let glowNeon = null;
  const out = { update: null, spots: [] };
  const geoOf = () => { const G = new Geo(); return G; };
  const finish = (G, name) => { const g = new THREE.Group(); g.name = name; G.build(g); scene.add(g); groups.push(g); return g; };
  const ground = (x, z) => terrain.height(x, z);
  const groundUnder = (ring) => { let lo = Infinity, hi = -Infinity; for (const [x, z] of ring) { const h = ground(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); } return [lo, hi]; };
  const collide = (b, top, roof = 0) => polys.add(Float32Array.from(b.p), b.b ?? -5, top, { roof, kind: 'house', holes: b.h });
  const collideBox = (x, z, w, d, ang, y0, y1) => {
    const c = Math.cos(ang), s = Math.sin(ang), pts = [];
    for (const [u, v] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) pts.push(x + u * c + v * s, z - u * s + v * c);
    polys.add(Float32Array.from(pts), y0, y1, { kind: 'house' });
  };

  // ------------------------------------------------ Bergen domkirke
  // After photos: a tall square west tower, grey granite ashlar up to the belfry and whitewashed
  // above with grey quoins, a clock and lancet slits, under a green copper bell roof with an
  // octagonal lantern and a small cap; a round stair turret with a green cone beside it; the
  // nave whitewashed with Gothic windows under a green copper roof.
  if (L.dom) {
    const b = L.dom, ring = ringOf(b.p), F = frameOf(b.p, b.rf ? [b.rf[2], b.rf[3]] : null);
    const [lo, hi] = groundUnder(ring), G = geoOf();
    const wallTop = hi + 12, rise = Math.min(9, F.hw * 0.85);
    roofedBody(G, ring, lo - 3, wallTop, [{ cx: F.cx, cz: F.cz, ux: F.ux, uz: F.uz, hl: F.hl, hw: F.hw, rise }], M.plasterW, M.copper);
    // a granite plinth band round the nave
    roofedBody(G, ring.map(([x, z]) => { const [cx, cz] = [F.cx, F.cz], d = Math.hypot(x - cx, z - cz) || 1; return [x + (x - cx) / d * 0.12, z + (z - cz) / d * 0.12]; }), lo - 3, lo + 1.6, [], M.granite, M.granite);
    // the west tower: at the end of the nave the frame's +u points to (west, from the OSM outline)
    const westSign = F.ux < 0 ? 1 : -1;            // +u when it points west
    const tw = Math.min(12.5, F.hw * 1.25), tu = westSign * (F.hl - tw / 2 + 0.6);
    const [tx, tz] = F.at(tu, 0), gy = ground(tx, tz), ang = F.ang;
    const tTop = gy + 36, mid = gy + 19;
    boxAt(G, M.granite, tx, gy - 3, tz, tw, mid - gy + 3, tw, ang);
    boxAt(G, M.plasterW, tx, mid, tz, tw - 0.1, tTop - mid, tw - 0.1, ang);
    // quoins up the corners of the white part, and a cornice
    for (const [a, c] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const [qx, qz] = F.at(tu + a * (tw / 2 - 0.25), c * (tw / 2 - 0.25));
      for (let y = mid; y < tTop - 0.6; y += 1.2) boxAt(G, M.trim, qx, y, qz, 0.62, 0.6, 0.62, ang + (Math.round(y) % 2 ? 0 : 0.02));
    }
    boxAt(G, M.copper, tx, tTop, tz, tw + 0.5, 0.45, tw + 0.5, ang);
    // the bell roof, lantern, cap and finial
    lathe(G, M.copper, tx, tTop + 0.45, tz, [[tw / 2 + 0.25, 0], [tw / 2 - 0.4, 1.2], [tw / 2 - 1.6, 2.6], [tw / 2 - 3.2, 3.6], [2.3, 4.2], [2.3, 4.3]], 4, ang + Math.PI / 4);
    const lb = tTop + 4.75;
    cyl(G, M.copper, tx, lb, tz, 2.2, 2.2, 6, 8);
    cyl(G, M.copper, tx, lb + 6, tz, 2.55, 2.55, 0.35, 8);
    lathe(G, M.copper, tx, lb + 6.35, tz, [[2.5, 0], [2.3, 0.8], [1.4, 1.8], [0.5, 2.6], [0.15, 3.2], [0, 3.3]], 8);
    sphere(G, M.gold, tx, lb + 9.8, tz, 0.3);
    cyl(G, M.gold, tx, lb + 9.6, tz, 0.05, 0.05, 2.0, 4);
    // the tower's faces: a clock and lancet slits on three sides, the big window and the portal on the west
    for (const [du, dv] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) {
      const nx = F.ux * du * westSign + F.vx * dv, nz = F.uz * du * westSign + F.vz * dv;
      const [fx, fz] = [tx + nx * tw / 2, tz + nz * tw / 2];
      if (du !== -1) {
        decal(G, D.clock, fx, fz, nx, nz, gy + 25.5, 2.2, 2.2, 0.06);
        for (const s of [-2.2, 2.2]) { decal(G, D.slit, fx - nz * s, fz + nx * s, nx, nz, gy + 25.4, 0.55, 1.4); decal(G, D.slit, fx - nz * s, fz + nx * s, nx, nz, gy + 30.5, 0.55, 1.4); }
        decal(G, D.slit, fx, fz, nx, nz, gy + 22.0, 0.5, 1.2);
      }
      if (du === 1) {
        decal(G, D.lancet, fx, fz, nx, nz, gy + 8.6, 3.6, 7.0);
        decal(G, D.door, fx, fz, nx, nz, gy + 0.4, 2.4, 4.4);
        // steps up to the door
        for (let k = 0; k < 4; k++) boxAt(G, M.granite, fx + nx * (0.5 + k * 0.4), gy - 0.6, fz + nz * (0.5 + k * 0.4), 5.5, 1.0 - k * 0.2, 0.4, ang);
      }
    }
    // the round stair turret with its green cone, on the street side of the nave by the tower
    const sv = F.hw + 0.4, side = [1, -1].map(s => { const [x, z] = F.at(tu - westSign * (tw / 2 + 2.6), s * sv); return [s, ground(x, z)]; }).sort((a, c) => a[1] - c[1])[0][0];
    const [rx, rz] = F.at(tu - westSign * (tw / 2 + 2.6), side * (F.hw - 1.2));
    const ry = ground(rx, rz);
    cyl(G, M.granite, rx, ry - 2, rz, 2.4, 2.3, hi + 13 - ry + 2, 16);
    cone(G, M.copper, rx, hi + 13, rz, 2.6, 8.5, 16);
    sphere(G, M.gold, rx, hi + 21.6, rz, 0.18);
    // Gothic windows along the nave, high in the white walls
    windowsAlong(G, D.lancet, ring, hi + 3.4, 2.0, 6.0, 5.2, 6, (x, z) => Math.hypot(x - tx, z - tz) < tw * 0.8);
    finish(G, 'Domkirken');
    collide(b, wallTop, rise);
    collideBox(tx, tz, tw, tw, ang, gy - 3, tTop + 14);
    collideBox(rx, rz, 4.8, 4.8, 0, ry - 2, hi + 21);
    out.spots.push({ n: 'Domkirken', x: tx, z: tz });
  }

  // the arms of a cruciform church from its outline: the nave along the long axis and the
  // transept across it, each as wide as the outline is at its ends
  const crossArms = (b, rise) => {
    const F = frameOf(b.p), r = ringOf(b.p);
    const uv = r.map(([x, z]) => [(x - F.cx) * F.ux + (z - F.cz) * F.uz, (x - F.cx) * F.vx + (z - F.cz) * F.vz]);
    const nave = uv.filter(([u]) => Math.abs(u) > F.hl * 0.6).map(([, v]) => Math.abs(v));
    const hwN = Math.min(F.hw, Math.max(4, ...nave));
    const tr = uv.filter(([, v]) => Math.abs(v) > hwN + 1.5);
    const arms = [{ cx: F.cx, cz: F.cz, ux: F.ux, uz: F.uz, hl: F.hl, hw: hwN, rise: rise ?? hwN * 1.1 }];
    if (tr.length >= 2) {
      const us = tr.map(([u]) => u), u0 = Math.min(...us), u1 = Math.max(...us), hwT = Math.max(3, (u1 - u0) / 2);
      const [tx, tz] = F.at((u0 + u1) / 2, 0);
      arms.push({ cx: tx, cz: tz, ux: F.vx, uz: F.vz, hl: F.hw, hw: hwT, rise: hwT * 1.1 });
    }
    return { F, arms, hwN };
  };

  // ------------------------------------------------ Korskirken
  // After photos: cream rough-plastered walls, plain steep gables, near-black tiled roofs, big
  // round-arched windows, and a grey-white square west tower with a green copper bell roof and
  // a tall slender green spire.
  if (L.kors) {
    const b = L.kors, ring = ringOf(b.p), [lo, hi] = groundUnder(ring), G = geoOf();
    const { F, arms, hwN } = crossArms(b);
    const blackTile = new THREE.MeshStandardMaterial({ map: canvasTex(256, (g, S) => { g.fillStyle = '#2b2d31'; g.fillRect(0, 0, S, S); for (let j = 0; j < 12; j++) for (let x = (j % 2) * 10; x < S; x += 21) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, j * S / 12, 19, S / 12 - 3); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x, j * S / 12 + S / 12 - 3, 21, 3); } }, 1.6), roughness: 0.5 });
    const wallTop = hi + 9.5;
    roofedBody(G, ring, lo - 3, wallTop, arms, M.plasterCream, blackTile);
    const westSign = F.ux < 0 ? 1 : -1, tw = Math.min(8.5, hwN * 1.6);
    const tu = westSign * (F.hl - tw / 2 + 0.3), [tx, tz] = F.at(tu, 0), gy = ground(tx, tz), ang = F.ang;
    const tTop = gy + 24;
    boxAt(G, M.plasterW, tx, gy - 3, tz, tw, tTop - gy + 3, tw, ang);
    boxAt(G, M.trim, tx, tTop - 0.3, tz, tw + 0.3, 0.4, tw + 0.3, ang);
    lathe(G, M.copper, tx, tTop + 0.1, tz, [[tw / 2 + 0.2, 0], [tw / 2 + 0.1, 0.6], [tw / 2 - 0.6, 2.0], [tw / 2 - 1.8, 3.2], [1.0, 4.0], [0.9, 4.2]], 16);
    cone(G, M.copper, tx, tTop + 4.2, tz, 1.0, 17, 8);
    sphere(G, M.gold, tx, tTop + 21.3, tz, 0.22);
    cyl(G, M.gold, tx, tTop + 21.2, tz, 0.04, 0.04, 1.6, 4);
    for (const [du, dv] of [[1, 0], [0, 1], [0, -1]]) {
      const nx = F.ux * du * westSign + F.vx * dv, nz = F.uz * du * westSign + F.vz * dv, fx = tx + nx * tw / 2, fz = tz + nz * tw / 2;
      for (const s of [-1.2, 1.2]) decal(G, D.slit, fx - nz * s, fz + nx * s, nx, nz, gy + 19, 0.6, 1.6);
      if (du === 1) decal(G, D.door, fx, fz, nx, nz, gy + 0.05, 2.0, 3.6);
    }
    windowsAlong(G, D.round, ring, (x, z) => ground(x, z) + 2.6, 1.6, 3.6, 5.5, 5, (x, z) => Math.hypot(x - tx, z - tz) < tw);
    finish(G, 'Korskirken');
    collide(b, wallTop, hwN * 1.1);
    collideBox(tx, tz, tw, tw, ang, gy - 3, tTop + 6);
    out.spots.push({ n: 'Korskirken', x: tx, z: tz });
  }

  // ------------------------------------------------ Mariakirken (12th century)
  // Romanesque, of grey rubble stone, with the two west towers under tall dark pyramid spires,
  // a dark roof over the nave and small round-arched windows.
  if (L.maria) {
    const b = L.maria, ring = ringOf(b.p), [lo, hi] = groundUnder(ring), G = geoOf();
    const F = frameOf(b.p, b.rf ? [b.rf[2], b.rf[3]] : null);
    const wallTop = hi + 9, hw = F.hw;
    roofedBody(G, ring, lo - 3, wallTop, [{ cx: F.cx, cz: F.cz, ux: F.ux, uz: F.uz, hl: F.hl, hw, rise: hw * 1.15 }], M.rubble, M.shingle);
    const westSign = F.ux < 0 ? 1 : -1, ts = Math.min(6.5, hw * 0.75);
    let gy = Infinity;
    for (const s of [-1, 1]) { const [x, z] = F.at(westSign * (F.hl - ts / 2), s * (hw - ts / 2)); gy = Math.min(gy, ground(x, z)); }
    const tTop = gy + 22;
    for (const s of [-1, 1]) {
      const [x, z] = F.at(westSign * (F.hl - ts / 2), s * (hw - ts / 2));
      boxAt(G, M.rubble, x, gy - 3, z, ts, tTop - gy + 3, ts, F.ang);
      cone(G, M.shingle, x, tTop, z, ts / Math.SQRT2 + 0.2, 14, 4, F.ang);
      cyl(G, M.iron, x, tTop + 13.5, z, 0.05, 0.03, 2, 4);
      for (const [nx, nz] of [[F.ux * westSign, F.uz * westSign], [F.vx * s, F.vz * s]]) for (const y of [tTop - 3.2, tTop - 8]) decal(G, D.round, x + nx * ts / 2, z + nz * ts / 2, nx, nz, y, 0.9, 1.7);
      collideBox(x, z, ts, ts, F.ang, gy - 3, tTop + 14);
    }
    // the west portal between the towers
    { const nx = F.ux * westSign, nz = F.uz * westSign, [x, z] = F.at(westSign * F.hl, 0); decal(G, D.door, x, z, nx, nz, ground(x, z), 2.4, 4.2); decal(G, D.round, x, z, nx, nz, ground(x, z) + 6, 1.2, 2.2); }
    windowsAlong(G, D.round, ring, (x, z) => ground(x, z) + 4.2, 0.9, 2.0, 5, 6);
    finish(G, 'Mariakirken');
    collide(b, wallTop, hw * 1.15);
    out.spots.push({ n: 'Mariakirken', x: F.cx, z: F.cz });
  }

  // ------------------------------------------------ Johanneskirken (1894), up on Sydneshaugen
  // Neo-Gothic red brick, its 61 m tower and green copper spire over the town.
  if (L.johannes) {
    const b = L.johannes, ring = ringOf(b.p), [lo, hi] = groundUnder(ring), G = geoOf();
    const { F, arms, hwN } = crossArms(b);
    const wallTop = hi + 14;
    roofedBody(G, ring, lo - 3, wallTop, arms, M.brickRed, M.copper);
    // the tower stands at the end facing down to the town (towards the north-east)
    const endSign = (F.ux * 0.7 - F.uz * 0.7) > 0 ? 1 : -1, tw = Math.min(10, hwN * 1.3);
    const [tx, tz] = F.at(endSign * (F.hl - tw / 2), 0), gy = ground(tx, tz), tTop = gy + 34;
    boxAt(G, M.brickRed, tx, gy - 3, tz, tw, tTop - gy + 3, tw, F.ang);
    for (const [a, c] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const [qx, qz] = [tx + (F.ux * a + F.vx * c) * tw / 2, tz + (F.uz * a + F.vz * c) * tw / 2]; boxAt(G, M.brickRed, qx, gy - 3, qz, 1.4, tTop - gy + 5, 1.4, F.ang); cone(G, M.copper, qx, tTop + 2, qz, 0.9, 4, 4, F.ang); }
    cone(G, M.copper, tx, tTop, tz, tw * 0.62, 27, 8);
    cyl(G, M.gold, tx, tTop + 26.5, tz, 0.06, 0.04, 2.2, 4);
    for (const [nx, nz] of [[F.ux, F.uz], [-F.ux, -F.uz], [F.vx, F.vz], [-F.vx, -F.vz]]) { decal(G, D.lancet, tx + nx * tw / 2, tz + nz * tw / 2, nx, nz, tTop - 9, 1.6, 5.0); decal(G, D.clock, tx + nx * tw / 2, tz + nz * tw / 2, nx, nz, tTop - 13.5, 2.4, 2.4, 0.06); }
    windowsAlong(G, D.lancet, ring, hi + 4, 1.8, 6.5, 5, 6, (x, z) => Math.hypot(x - tx, z - tz) < tw);
    finish(G, 'Johanneskirken');
    collide(b, wallTop, hwN);
    collideBox(tx, tz, tw, tw, F.ang, gy - 3, tTop + 27);
    out.spots.push({ n: 'Johanneskirken', x: tx, z: tz });
  }

  // ------------------------------------------------ The University Museum (1865) on Nygårdshøyden
  // After photos: ochre-yellow plaster with white pilasters, cornices and window surrounds, a
  // taller central block facing Muséplass with a row of five arched windows, and wings with tall
  // arched windows above square ones; the Christie statue with its lion stands in front.
  if (L.uimuseum) {
    const b = L.uimuseum, ring = ringOf(b.p), [lo, hi] = groundUnder(ring), G = geoOf();
    const F = frameOf(b.p), top = hi + 11;
    roofedBody(G, ring, lo - 3, top, [], M.plasterYellow, new THREE.MeshStandardMaterial({ color: 0x5d5f62, roughness: 0.9 }));
    // the cornice round the top, and a white band over the ground floor
    roofedBody(G, ring.map(([x, z]) => { const d = Math.hypot(x - F.cx, z - F.cz) || 1; return [x + (x - F.cx) / d * 0.3, z + (z - F.cz) / d * 0.3]; }), top - 0.9, top, [], M.white, M.white);
    // the central block, on the side facing Muséplass (towards the Christie statue)
    const ch = artNamedFirst('Christiestøtten');
    const toward = ch ? Math.sign((ch.x - F.cx) * F.vx + (ch.z - F.cz) * F.vz) || 1 : 1;
    const cw = Math.min(16, F.hl * 0.45), [bx, bz] = F.at(0, toward * 0.6);
    boxAt(G, M.plasterYellow, bx, lo - 3, bz, cw, top + 6 - lo + 3, F.hw * 2 + 1.2, F.ang + Math.PI / 2);
    boxAt(G, M.white, bx, top + 5.2, bz, cw + 0.8, 0.9, F.hw * 2 + 2.0, F.ang + Math.PI / 2);
    for (const s2 of [-1, 1]) { const [qx, qz] = F.at(s2 * (cw / 2 - 0.6), toward * (F.hw + 1.2)); boxAt(G, M.white, qx, lo, qz, 1.3, top + 5 - lo, 0.4, F.ang + Math.PI / 2); }
    // the windows: the front of the central block, then the wings all round
    const fnx = F.vx * toward, fnz = F.vz * toward, [fx, fz] = F.at(0, toward * (F.hw + 1.2));
    for (let k = -2; k <= 2; k++) decal(G, D.round, fx + F.ux * k * 2.2, fz + F.uz * k * 2.2, fnx, fnz, top + 1.0, 1.3, 2.6);
    for (const k of [-1, 1]) { decal(G, D.round, fx + F.ux * k * 2.6, fz + F.uz * k * 2.6, fnx, fnz, hi + 5.6, 2.0, 3.6); decal(G, D.sash, fx + F.ux * k * 2.6, fz + F.uz * k * 2.6, fnx, fnz, hi + 1.4, 1.8, 2.2); }
    decal(G, D.door, fx, fz, fnx, fnz, hi + 0.1, 2.2, 3.6);
    windowsAlong(G, D.round, ring, hi + 5.6, 1.9, 3.4, 4.0, 6, (x, z) => Math.abs((x - F.cx) * F.ux + (z - F.cz) * F.uz) < cw / 2 + 1);
    windowsAlong(G, D.sash, ring, hi + 1.4, 1.7, 2.2, 4.0, 6, (x, z) => Math.abs((x - F.cx) * F.ux + (z - F.cz) * F.uz) < cw / 2 + 1);
    // steps up to the door
    for (let k = 0; k < 5; k++) { const [sx, sz] = F.at(0, toward * (F.hw + 1.6 + k * 0.4)); boxAt(G, M.granite, sx, lo - 0.5, sz, cw - 2, hi + 0.9 - k * 0.2 - lo + 0.5, 0.4, F.ang + Math.PI / 2); }
    finish(G, 'Universitetsmuseet');
    collide(b, top);
    collideBox(bx, bz, cw, F.hw * 2 + 1.2, F.ang + Math.PI / 2, lo - 3, top + 6);
    out.spots.push({ n: 'Universitetsmuseet', x: fx, z: fz });
  }

  // ------------------------------------------------ Grieghallen (1978)
  // After photos: a long upper volume clad in vertical bronze-brown fins with dark glass between
  // them, floating on columns over a recessed glass foyer and wide steps, a big banner on the
  // front, and the grey concrete stage towers behind.
  if (L.grieg) {
    const b = L.grieg, ring = ringOf(b.p), [lo, hi] = groundUnder(ring), G = geoOf();
    const F = frameOf(b.p);
    const fins = canvasTex(256, (g, S) => {
      g.fillStyle = '#1c2126'; g.fillRect(0, 0, S, S);
      g.fillStyle = 'rgba(120,140,155,0.18)'; g.fillRect(0, 0, S, S * 0.3);
      for (let x = 0; x < S; x += S / 4) { const gr = g.createLinearGradient(x, 0, x + S / 6, 0); gr.addColorStop(0, '#5a3a26'); gr.addColorStop(0.5, '#7b5236'); gr.addColorStop(1, '#4a2f1f'); g.fillStyle = gr; g.fillRect(x, 0, S / 6, S); }
      g.fillStyle = '#c46a2a'; g.fillRect(0, S - 6, S, 6);
    }, 3.6, { metresV: 11.5 });
    const finM = new THREE.MeshStandardMaterial({ map: fins, roughness: 0.55, metalness: 0.3 });
    const foyer = canvasTex(256, (g, S) => { g.fillStyle = '#2b3338'; g.fillRect(0, 0, S, S); g.fillStyle = 'rgba(255,214,160,0.35)'; g.fillRect(0, S * 0.4, S, S * 0.6); g.fillStyle = '#9aa0a4'; for (let x = 0; x < S; x += S / 3) g.fillRect(x, 0, 4, S); }, 4, { metresV: 4.5 });
    const foyerM = new THREE.MeshStandardMaterial({ map: foyer, roughness: 0.15, metalness: 0.2, emissive: 0xffffff, emissiveMap: foyer, emissiveIntensity: 0 });
    glowMats.push([foyerM, 0.1, 0.7]);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.95 });
    const inset = (d) => ring.map(([x, z]) => { const dd = Math.hypot(x - F.cx, z - F.cz) || 1; return [x - (x - F.cx) / dd * d, z - (z - F.cz) / dd * d]; });
    const fl = hi + 4.5, top = hi + 16;
    roofedBody(G, inset(3), lo - 3, fl, [], foyerM, M.white);
    roofedBody(G, ring, fl, top, [], finM, concrete);
    // the soffit under the floating volume
    for (const [a, c, d] of triangulate([ring])) G.tri(M.white, [a[0], fl, a[1]], [c[0], fl, c[1]], [d[0], fl, d[1]], [[0, 0], [1, 0], [0, 1]], [0, -1, 0]);
    // columns round the foyer
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], len = Math.hypot(bx - ax, bz - az);
      for (let t = 3; t < len - 2; t += 8) { const x = ax + (bx - ax) * t / len, z = az + (bz - az) * t / len, dd = Math.hypot(x - F.cx, z - F.cz) || 1; cyl(G, M.white, x - (x - F.cx) / dd * 1.2, lo - 1, z - (z - F.cz) / dd * 1.2, 0.35, 0.35, fl - lo + 1, 10); }
    }
    // the stage towers, at the end away from Lille Lungegårdsvann
    const lake = (map.waters || []).reduce((a, w) => (!a || w.a > a.a) && w.y < 2 ? w : a, null);
    const [lx, lz] = lake ? centroid(lake.p) : [F.cx, F.cz - 100];
    const endSign = ((F.cx + F.ux * F.hl - lx) ** 2 + (F.cz + F.uz * F.hl - lz) ** 2) > ((F.cx - F.ux * F.hl - lx) ** 2 + (F.cz - F.uz * F.hl - lz) ** 2) ? 1 : -1;
    for (const [u, w, h] of [[F.hl * 0.45, 26, 30], [F.hl * 0.2, 18, 24]]) {
      const [tx, tz] = F.at(endSign * u, 0);
      if (!insideRings([ring], tx, tz)) continue;
      boxAt(G, concrete, tx, hi, tz, Math.min(w, F.hw * 1.6), h, Math.min(w, F.hw * 1.6), F.ang);
      collideBox(tx, tz, Math.min(w, F.hw * 1.6), Math.min(w, F.hw * 1.6), F.ang, hi - 1, hi + h);
    }
    // the banner on the front, towards the lake
    {
      const [fx, fz] = F.at(-endSign * F.hl * 0.55, 0);
      let best = null;
      for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], len = Math.hypot(bx - ax, bz - az); if (len < 15) continue; const mx = (ax + bx) / 2, mz = (az + bz) / 2, d = Math.hypot(mx - lx, mz - lz); if (!best || d < best.d) best = { d, mx, mz, len, ax, az, bx, bz }; }
      if (best) {
        let nx = (best.bz - best.az) / best.len, nz = -(best.bx - best.ax) / best.len;
        if (insideRings([ring], best.mx + nx, best.mz + nz)) { nx = -nx; nz = -nz; }
        const banner = decalTex((g, w, h) => {
          g.fillStyle = '#0e6f73'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#f2efe6'; g.textAlign = 'center'; g.font = '900 29px Archivo, sans-serif'; g.fillText('BERGEN', w / 2, h * 0.62); g.fillText('FILHARMONISKE', w / 2, h * 0.7); g.fillText('ORKESTER', w / 2, h * 0.78);
          g.fillStyle = '#d9a441'; g.beginPath(); g.arc(w / 2, h * 0.3, w * 0.28, 0, 7); g.fill();
          g.fillStyle = '#0e6f73'; for (let k = 0; k < 5; k++) g.fillRect(w * 0.3, h * 0.22 + k * 14, w * 0.4, 3);
          g.fillStyle = '#ffffff'; g.font = '700 22px Archivo, sans-serif'; g.fillText('GRIEGHALLEN', w / 2, h * 0.9);
        }, 256, 512);
        decal(G, new THREE.MeshStandardMaterial({ map: banner, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), best.mx, best.mz, nx, nz, fl + 0.6, 5.5, 10.5, 0.1);
        // the wide steps up to the foyer
        for (let k = 0; k < 6; k++) { const x = best.mx + nx * (0.5 + k * 0.45), z = best.mz + nz * (0.5 + k * 0.45); boxAt(G, M.granite, x, lo - 0.5, z, 18, hi + 0.9 - k * 0.15 - lo + 0.5, 0.45, Math.atan2(nx, nz)); }
        void fx; void fz;
      }
    }
    finish(G, 'Grieghallen');
    collide(b, top);
  }

  // ------------------------------------------------ Fløibanen's lower station on Vetrlidsallmenningen: its name over the door
  {
    const b = map.buildings.find(q => (q.n || '').startsWith('Fløibanen'));
    if (b) {
      const r = ringOf(b.p);
      let best = null;
      for (let i = 0; i < r.length; i++) {
        const [ax, az] = r[i], [bx, bz] = r[(i + 1) % r.length], L2 = Math.hypot(bx - ax, bz - az);
        if (L2 < 2) continue;
        let nx = (bz - az) / L2, nz = -(bx - ax) / L2;
        if (insideRings([r], (ax + bx) / 2 + nx * 0.3, (az + bz) / 2 + nz * 0.3)) { nx = -nx; nz = -nz; }
        const t = b.d && b.d[0] === i ? b.d[1] : 0.5, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const score = (b.d && b.d[0] === i ? 100 : 0) + (onRoad && onRoad(x + nx * 3, z + nz * 3) ? 10 : 0) + L2;
        if (!best || score > best.score) best = { score, x, z, nx, nz };
      }
      if (best) {
        const G = geoOf(), gy = ground(best.x + best.nx, best.z + best.nz);
        const t = decalTex((g, w, h) => { g.fillStyle = '#16325c'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.font = '800 72px Archivo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FLØIBANEN', w / 2, h / 2 + 4); g.fillStyle = '#c4312a'; g.fillRect(0, h - 12, w, 12); }, 768, 128);
        const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
        glowMats.push([m, 0.1, 0.9]);
        decal(G, m, best.x, best.z, best.nx, best.nz, gy + 2.9, 4.2, 0.7, 0.12);
        decal(G, D.door, best.x, best.z, best.nx, best.nz, gy + 0.02, 2.0, 2.7, 0.08);
        finish(G, 'Fløibanen nedre stasjon');
      }
    }
  }

  // ------------------------------------------------ Fløyen: the upper station, Fløien Folkerestaurant, the terrace
  // After photos: a low glazed station hall over the end of the track; the restaurant on the uphill
  // side, white boards, a long glazed veranda and the taller square pavilion with its cupola, and
  // FLØIEN FOLKERESTAURANT over the door; a paved terrace on a stone wall beside the track, over
  // the drop towards the town, with a railing, flagpoles, lamps and benches. You step out onto it.
  if (map.funicular && map.funicular.length >= 4) {
    const f = map.funicular, n = f.length / 2;
    const ex = f[n * 2 - 2], ez = f[n * 2 - 1], px = f[n * 2 - 6], pz = f[n * 2 - 5];
    const ul = Math.hypot(ex - px, ez - pz) || 1, ux = (ex - px) / ul, uz = (ez - pz) / ul;   // u: along the track, uphill
    // v: across it, towards the lower side (the view)
    let vx = -uz, vz = ux;
    if (ground(ex + vx * 15, ez + vz * 15) > ground(ex - vx * 15, ez - vz * 15)) { vx = -vx; vz = -vz; }
    const at = (u, v) => [ex + ux * u + vx * v, ez + uz * u + vz * v];
    const fy = ground(ex, ez), ang = Math.atan2(ux, uz);
    const G = geoOf();
    const rect = (u0, u1, v0, v1) => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
    const woodT = canvasTex(256, (g, S) => { g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, S, S); for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, k * S / 8 + S / 8 - 3, S, 3); } }, 1.4);
    const woodM = new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.8 });
    const greyRoof = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.7 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x9fb6c2, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.45, depthWrite: false });
    // the station hall: a roof on posts over the last 16 m of track, glazed on the uphill side
    {
      const [hx, hz] = at(-6, 0.6);
      boxAt(G, M.white, hx, fy + 4.4, hz, 17, 0.35, 9.5, ang + Math.PI / 2);
      for (let u = -14; u <= 2; u += 4) for (const v of [-4.2, 4.6]) { const [qx, qz] = at(u, v); boxAt(G, M.iron, qx, fy - 0.5, qz, 0.18, 4.95, 0.18, ang); }
      const [gx, gz] = at(-6, -4.3);
      const gw = new THREE.Mesh(new THREE.BoxGeometry(16, 4.2, 0.06), glassM); gw.position.set(gx, fy + 2.1, gz); gw.rotation.y = ang + Math.PI / 2; scene.add(gw);
      const [bx, bz] = at(2.6, 0.2); boxAt(G, woodM, bx, fy - 1, bz, 0.4, 5.4, 9, ang + Math.PI / 2);
      // the platform beside the car, level with the terrace
      const plat = rect(-15, 2.4, 1.5, 4.8);
      roofedBody(G, plat, fy - 3, fy + 0.05, [], M.granite, M.granite);
      polys.add(Float32Array.from(plat.flat()), fy - 3, fy + 0.05, { kind: 'flat', walk: true, noCam: true });
      const sign = decalTex((g, w, h) => { g.fillStyle = '#16325c'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.font = '800 64px Archivo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FLØYEN  320 moh.', w / 2, h / 2 + 3); }, 1024, 128);
      const sm = new THREE.MeshStandardMaterial({ map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.15 });
      glowMats.push([sm, 0.1, 0.8]);
      const [sx2, sz2] = at(-6, 4.75); const sg = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.875), sm); sg.position.set(sx2, fy + 3.85, sz2); sg.rotation.y = Math.atan2(vx, vz); scene.add(sg);
      collideBox(gx, gz, 16, 0.3, ang + Math.PI / 2, fy - 1, fy + 4.4);
    }
    // the terrace: a paved deck on a stone wall, beside the track and out over the drop
    const deck = rect(-26, 3, 4.8, 17);
    roofedBody(G, deck, fy - 8, fy + 0.05, [], M.rubble, new THREE.MeshStandardMaterial({ color: 0xa9a7a0, roughness: 0.85, map: M.granite.map }));
    polys.add(Float32Array.from(deck.flat()), fy - 8, fy + 0.05, { kind: 'flat', walk: true, noCam: true });
    // the railing along its outer edges, and along the track side west of the platform
    const rail = (u0, v0, u1, v1) => {
      const [ax, az] = at(u0, v0), [bx, bz] = at(u1, v1), L2 = Math.hypot(bx - ax, bz - az), a2 = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
      G.obox(M.iron, (ax + bx) / 2, fy + 1.05, (az + bz) / 2, L2, 0.07, 0.07, 0, a2, 0);
      G.obox(M.iron, (ax + bx) / 2, fy + 0.55, (az + bz) / 2, L2, 0.04, 0.04, 0, a2, 0);
      for (let k = 0; k <= Math.floor(L2 / 1.5); k++) { const t = k * 1.5 / L2; G.obox(M.iron, ax + (bx - ax) * t, fy + 0.55, az + (bz - az) * t, 0.05, 1.05, 0.05, 0, 0, 0); }
      polys.add(Float32Array.from([ax - 0.1, az - 0.1, bx - 0.1, bz - 0.1, bx + 0.1, bz + 0.1, ax + 0.1, az + 0.1]), fy - 1, fy + 1.1, { tree: true, noCam: true });
    };
    rail(-26, 4.8, -26, 17); rail(-26, 17, 3, 17); rail(-26, 4.8, -15, 4.8);
    // flagpoles, lamps, benches and coin binoculars along it
    const flagCols = [0xc8102e, 0x00205b, 0xc8102e, 0xffffff];
    for (let k = 0; k < 4; k++) {
      const [qx, qz] = at(-2 - k * 3, 15.5); cyl(G, M.white, qx, fy, qz, 0.08, 0.05, 11, 6);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), new THREE.MeshStandardMaterial({ color: flagCols[k], side: THREE.DoubleSide, roughness: 0.9 }));
      fl.position.set(qx + vx * 0.0 + ux * 0.95, fy + 10.2, qz + uz * 0.95); fl.rotation.y = ang + Math.PI / 2; scene.add(fl);
    }
    for (const u of [-22, -12]) { const [qx, qz] = at(u, 16); cyl(G, M.iron, qx, fy, qz, 0.07, 0.05, 4, 6); sphere(G, M.white, qx, fy + 4.1, qz, 0.25); }
    for (const u of [-20, -14, -8]) { const [qx, qz] = at(u, 15.9); G.obox(M.wood, qx, fy + 0.45, qz, 1.8, 0.06, 0.45, 0, ang, 0); G.obox(M.wood, qx, fy + 0.75, qz - 0.0, 1.8, 0.4, 0.05, 0, ang, 0); }
    { const [qx, qz] = at(-24, 15.6); cyl(G, M.iron, qx, fy, qz, 0.06, 0.06, 1.1, 6); G.obox(new THREE.MeshStandardMaterial({ color: 0x2f6db5 }), qx, fy + 1.25, qz, 0.25, 0.25, 0.55, 0, ang + Math.PI / 2, 0); }
    // Fløien Folkerestaurant on the uphill side: white boards, two storeys under a dark hipped roof,
    // the glazed veranda along its front and the square pavilion at its far end
    {
      const body = rect(4, 30, -15, -1.5), [rx, rz] = at(17, -8.25), rtop = fy + 8;
      roofedBody(G, body, fy - 4, rtop, [{ cx: rx, cz: rz, ux, uz, hl: 13, hw: 6.75, rise: 3 }], woodM, greyRoof);
      collide({ p: body.flat(), b: fy - 4 }, rtop, 3);
      windowsAlong(G, D.sash, body, fy + 0.8, 1.1, 1.8, 2.6, 4);
      windowsAlong(G, D.sash, body, fy + 4.6, 1.1, 1.8, 2.6, 4);
      const ver = rect(4, 26, -1.5, 2.8), [vx2, vz2] = at(15, 0.65);
      void vx2; void vz2;
      roofedBody(G, ver, fy - 1, fy + 3.4, [], glassM, greyRoof);
      { const [ax, az] = at(15, 2.95); G.obox(new THREE.MeshStandardMaterial({ color: 0x2e6b4c }), ax, fy + 3.2, az, 22.4, 0.45, 0.35, 0, ang + Math.PI / 2, 0); }
      collide({ p: ver.flat(), b: fy - 1 }, fy + 3.4);
      // the pavilion
      const pav = rect(26, 35, -15, -3), [cx2, cz2] = at(30.5, -9), ptop = fy + 11;
      roofedBody(G, pav, fy - 4, ptop, [], woodM, greyRoof);
      const pyr = new THREE.ConeGeometry(7.6, 3.2, 4); pyr.translate(0, 1.6, 0); pyr.rotateY(Math.PI / 4); pyr.scale(9 / 10.7, 1, 12 / 10.7);
      G.geom(greyRoof, pyr, new THREE.Matrix4().makeRotationY(ang).premultiply(new THREE.Matrix4().makeTranslation(cx2, ptop, cz2)));
      cyl(G, M.white, cx2, ptop + 2.6, cz2, 0.9, 0.9, 1.4, 8); cone(G, greyRoof, cx2, ptop + 4.0, cz2, 1.1, 1.2, 8);
      windowsAlong(G, D.sash, pav, fy + 0.8, 1.1, 1.8, 2.4, 4); windowsAlong(G, D.sash, pav, fy + 4.6, 1.1, 1.8, 2.4, 4); windowsAlong(G, D.round, pav, fy + 8.2, 1.0, 1.8, 2.4, 4);
      collide({ p: pav.flat(), b: fy - 4 }, ptop + 3);
      // the name over the door, facing the terrace
      const nameT = decalTex((g, w, h) => { g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2b2b2b'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#1e1e1e'; g.font = '700 58px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FLØIEN FOLKERESTAURANT', w / 2, h / 2 + 3); }, 1024, 112);
      const [nx2, nz2] = at(30.5, -2.95); decal(G, new THREE.MeshStandardMaterial({ map: nameT, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), nx2, nz2, vx, vz, fy + 4.2, 7.5, 0.82, 0.02);
      decal(G, D.door, nx2, nz2, vx, vz, fy + 0.02, 2.2, 3.4);
    }
    finish(G, 'Fløyen');
    out.floyenStop = (() => { const [x, z] = at(-6, 3.3); return new THREE.Vector3(x, fy + 0.05, z); })();
    out.floyenClear = [ex, ez, 45];
    out.floyenJump = (() => { const [x, z] = at(-23, 14.5); return { x, z }; })();     // the skydive starts at the terrace's far corner
    out.spots.push({ n: 'Fløien Folkerestaurant', x: at(17, -8)[0], z: at(17, -8)[1] });
  }

  // ------------------------------------------------ Statsraad Lehmkuhl at her berth by Bergenhus
  // After photos: the three-masted barque (1914), a white steel hull 84 m long with a dark-blue
  // band at the waterline, deckhouses, a long bowsprit, three masts of about 48 m with their
  // yards and the sails furled white on them, and the flag at the stern. She lies alongside the
  // quay nearest OSM's point for her, bow out towards the fjord.
  {
    const a0 = (map.art || []).find(a => /Lehmkuhl/.test(a.n));
    let best = null;
    if (a0) for (const f of map.coast || []) for (let i = 0; i < f.length - 2; i += 2) {
      const ax = f[i], az = f[i + 1], bx = f[i + 2], bz = f[i + 3], L2 = Math.hypot(bx - ax, bz - az);
      if (L2 < 4) continue;
      const t = Math.max(0, Math.min(L2, ((a0.x - ax) * (bx - ax) + (a0.z - az) * (bz - az)) / L2)), x = ax + (bx - ax) * t / L2, z = az + (bz - az) * t / L2, d = Math.hypot(x - a0.x, z - a0.z);
      if (!best || d < best.d) best = { d, x, z, dx: (bx - ax) / L2, dz: (bz - az) / L2 };
    }
    if (best && best.d < 150) {
      const wx = -best.dz, wz = best.dx;                     // water side: the right of the coastline
      // slide her along the quay, and out from it, to where the whole hull lies in open water
      let fit = null;
      for (let s = -70; s <= 70; s += 3.5) for (const off of [7.5, 10, 13, 17]) {
        let bad = 0;
        for (let k = -4; k <= 4; k++) for (const sd of [-6.5, 0, 6.5]) {
          const x = best.x + best.dx * (s + k * 10.5) + wx * (off + sd), z = best.z + best.dz * (s + k * 10.5) + wz * (off + sd);
          if (ground(x, z) > -0.5 || polys.nearBuilding(x, z, 1)) bad++;
        }
        const score = bad * 1000 + Math.abs(s) + off * 2;
        if (!fit || score < fit.score) fit = { score, s, off };
      }
      const cx = best.x + best.dx * fit.s + wx * fit.off, cz = best.z + best.dz * fit.s + wz * fit.off, ang = Math.atan2(best.dx, best.dz), wl = 0.15;
      const G = geoOf(), hullW = new THREE.MeshStandardMaterial({ color: 0xf3f3ef, roughness: 0.5 }), blueM = new THREE.MeshStandardMaterial({ color: 0x1d2f6b, roughness: 0.5 });
      const deckM = new THREE.MeshStandardMaterial({ color: 0xa9875a, roughness: 0.85 }), sailM = new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.9 });
      const P = (u, y, v) => new THREE.Matrix4().makeTranslation(cx + best.dx * u + wx * v, wl + y, cz + best.dz * u + wz * v);
      const R = new THREE.Matrix4().makeRotationY(ang);
      const put = (mat, geo, u, y, v) => G.geom(mat, geo, P(u, y, v).multiply(R));
      // the hull: a box tapered to a bow and a rounded stern, white over a blue waterline
      const hull = (w, h, len, y) => { const g = new THREE.BoxGeometry(w, h, len, 1, 1, 8), pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const z = pa.getZ(i), k = z > 0 ? 1 - Math.pow(z / (len / 2), 2) * 0.95 : 1 - Math.pow(-z / (len / 2), 3) * 0.6; pa.setX(i, pa.getX(i) * Math.max(0.05, k)); } g.computeVertexNormals(); return g; };
      put(blueM, hull(12.6, 1.6, 84, 0), 0, -0.2, 0);
      put(hullW, hull(12.6, 5.6, 84, 0), 0, 3.4, 0);
      put(deckM, (() => { const g = hull(12.0, 0.1, 83, 0); return g; })(), 0, 6.2, 0);
      // deckhouses and the poop deck
      put(hullW, new THREE.BoxGeometry(6, 2.2, 14), 0, 7.3, -6);
      put(hullW, new THREE.BoxGeometry(5, 2.0, 9), 0, 7.2, 18);
      put(hullW, new THREE.BoxGeometry(10, 1.4, 12), 0, 6.9, -34);
      // the bowsprit
      { const g = new THREE.CylinderGeometry(0.25, 0.4, 16, 8); g.rotateX(Math.PI / 2 - 0.25); put(new THREE.MeshStandardMaterial({ color: 0xd8d3c6 }), g, 0, 8.5, 48); }
      // three masts with yards and furled sails, the mizzen with a gaff
      for (const [u, h, yards] of [[26, 47, 6], [2, 48, 6], [-22, 40, 0]]) {
        const mast = new THREE.CylinderGeometry(0.28, 0.45, h, 8); mast.translate(0, h / 2, 0); put(sailM, mast, u, 6.2, 0);
        for (let k = 0; k < yards; k++) {
          const y = 14 + k * 5.2, w = 26 - k * 3.2;
          const yard = new THREE.CylinderGeometry(0.18, 0.18, w, 6); yard.rotateZ(Math.PI / 2); put(sailM, yard, u, 6.2 + y, 0);
          const furl = new THREE.CylinderGeometry(0.45, 0.45, w * 0.9, 6); furl.rotateZ(Math.PI / 2); put(sailM, furl, u, 6.2 + y - 0.45, 0);
        }
        if (!yards) { const gaff = new THREE.CylinderGeometry(0.15, 0.15, 12, 6); gaff.rotateX(Math.PI / 2 - 0.35); put(sailM, gaff, u - 6, 6.2 + 24, 0); }
      }
      // stays from the masts to the bowsprit and the stern, and the flag
      const lines = [];
      const W = (u, y, v) => new THREE.Vector3(cx + best.dx * u + wx * v, wl + y, cz + best.dz * u + wz * v);
      for (const [u, h] of [[26, 47], [2, 48], [-22, 40]]) { lines.push(W(u, 6.2 + h, 0), W(u + 22, 8, 0)); for (const s2 of [-1, 1]) lines.push(W(u, 6.2 + h * 0.8, 0), W(u - 3, 6.5, s2 * 6)); }
      lines.push(W(26, 53, 0), W(56, 10, 0), W(-22, 46, 0), W(-42, 7, 0));
      scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: 0x3a3a36 })));
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), new THREE.MeshStandardMaterial({ map: decalTex((g, w, h) => { g.fillStyle = '#ba0c2f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(w * 0.27, 0, w * 0.18, h); g.fillRect(0, h * 0.4, w, h * 0.2); g.fillStyle = '#00205b'; g.fillRect(w * 0.31, 0, w * 0.1, h); g.fillRect(0, h * 0.45, w, h * 0.1); }, 220, 160), side: THREE.DoubleSide }));
      const fp = W(-43, 9.5, 0); flag.position.copy(fp); flag.rotation.y = ang + Math.PI / 2; scene.add(flag);
      finish(G, 'Statsraad Lehmkuhl');
      // her side and stern stop you walking off the quay into her
      collideBox(cx, cz, 12.6, 84, ang, wl - 2, wl + 7.5);
      out.spots.push({ n: 'Statsraad Lehmkuhl', x: cx, z: cz });
    }
  }

  // ------------------------------------------------ Bergenhus: Håkonshallen and Rosenkrantztårnet
  // Håkonshallen: the king's hall of the 1260s, grey stone, crow-stepped gables at both ends
  // and a steep dark roof. Rosenkrantztårnet: the tall grey stone tower beside it.
  if (L.hakon) {
    const b = L.hakon, ring = ringOf(b.p), [lo, hi] = groundUnder(ring), G = geoOf();
    const F = frameOf(b.p), wallTop = hi + 12, rise = F.hw * 1.3;
    roofedBody(G, ring, lo - 3, wallTop, [{ cx: F.cx, cz: F.cz, ux: F.ux, uz: F.uz, hl: F.hl, hw: F.hw, rise }], M.rubble, M.copper);
    // crow steps up both gables
    for (const s of [-1, 1]) {
      const n = 6;
      for (let k = 0; k < n; k++) for (const side of [-1, 1]) {
        const v = side * F.hw * (1 - (k + 0.5) / n), [x, z] = F.at(s * (F.hl - 0.4), v);
        const y = wallTop + rise * (1 - Math.abs(v) / F.hw);
        boxAt(G, M.rubble, x, y - 0.4, z, F.hw / n + 0.05, 1.4, 0.9, F.ang);
      }
      const [x, z] = F.at(s * (F.hl - 0.4), 0); boxAt(G, M.rubble, x, wallTop + rise - 0.4, z, 1.2, 2.0, 0.9, F.ang);
      for (const v of [-2.2, 0, 2.2]) { const [wx, wz] = F.at(s * F.hl, v); decal(G, D.lancet, wx, wz, F.ux * s, F.uz * s, wallTop - 6, 1.1, 4.2); }
    }
    // two rows of Gothic windows along the sides: small below, tall pairs above
    windowsAlong(G, D.lancet, ring, (x, z) => ground(x, z) + 2.4, 0.8, 1.6, 3.6, 8);
    windowsAlong(G, D.lancet, ring, wallTop - 5.6, 1.0, 3.4, 3.6, 8);
    // a parapet along the eaves
    windowsAlong(G, D.slit, ring, wallTop - 0.9, 0.5, 0.7, 1.4, 8);
    finish(G, 'Håkonshallen');
    collide(b, wallTop, rise);
    out.spots.push({ n: 'Håkonshallen', x: F.cx, z: F.cz });
  }
  if (L.rosen) {
    const b = L.rosen, ring = ringOf(b.p), [lo, hi] = groundUnder(ring), G = geoOf();
    const F = frameOf(b.p), wallTop = hi + 24, rise = F.hw * 0.75;
    roofedBody(G, ring, lo - 3, wallTop, [{ cx: F.cx, cz: F.cz, ux: F.ux, uz: F.uz, hl: F.hl, hw: F.hw, rise }], M.rubble, M.slateDark);
    // a battlemented top storey, a little proud of the walls
    roofedBody(G, ring.map(([x, z]) => { const d = Math.hypot(x - F.cx, z - F.cz) || 1; return [x + (x - F.cx) / d * 0.35, z + (z - F.cz) / d * 0.35]; }), wallTop - 4, wallTop + 0.6, [], M.rubble, M.rubble);
    // the stair tower on its side, with a little spire
    const [sx, sz] = F.at(-F.hl * 0.4, F.hw + 1.4);
    cyl(G, M.rubble, sx, lo - 3, sz, 2.0, 2.0, wallTop - lo + 7, 12);
    cone(G, M.slateDark, sx, wallTop + 4, sz, 2.3, 6, 12);
    windowsAlong(G, D.slit, ring, (x, z) => ground(x, z) + 6, 0.7, 1.6, 3.2, 5);
    windowsAlong(G, D.slit, ring, (x, z) => ground(x, z) + 14, 0.7, 1.6, 3.2, 5);
    windowsAlong(G, D.round, ring, wallTop - 4, 0.9, 1.8, 3.2, 5);
    finish(G, 'Rosenkrantztårnet');
    collide(b, wallTop, rise);
    collideBox(sx, sz, 4, 4, 0, lo - 3, wallTop + 10);
    out.spots.push({ n: 'Rosenkrantztårnet', x: F.cx, z: F.cz });
  }

  // ------------------------------------------------ Bergen stasjon (1913)
  // After photos: rock-faced dark gneiss, a central gable with a huge semicircular window and a
  // clock over three arched doorways, wings with steep grey slate roofs and dormers, and a
  // pavilion at each end under a tall pyramid roof with a finial, the bigger one to the south-west.
  // The OSM outline is the whole station; the head-house is its north-west end, the train shed
  // behind it.
  if (L.station) {
    const b = L.station, ring = ringOf(b.p);
    // the front: the outline's edge facing north-west (the forecourt on Strømgaten)
    let fi = 0, best = -Infinity;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], len = Math.hypot(bx - ax, bz - az);
      let nx = (bz - az) / len, nz = -(bx - ax) / len;
      if (insideRings([ring], (ax + bx) / 2 + nx * 0.1, (az + bz) / 2 + nz * 0.1)) { nx = -nx; nz = -nz; }
      const score = len * Math.max(0, -nx * 0.6 - nz * 0.8);
      if (score > best) { best = score; fi = i; }
    }
    const A = ring[fi], B = ring[(fi + 1) % ring.length], FL = Math.hypot(B[0] - A[0], B[1] - A[1]);
    let tx = (B[0] - A[0]) / FL, tz = (B[1] - A[1]) / FL, nx = -tz, nz = tx;        // n: into the building
    if (!insideRings([ring], (A[0] + B[0]) / 2 + nx * 2, (A[1] + B[1]) / 2 + nz * 2)) { nx = -nx; nz = -nz; }
    // the big pavilion goes to the right as you face the station
    const rightIsB = (-nz * tx + nx * tz) > 0;
    const P = (s, d) => [A[0] + tx * s + nx * d, A[1] + tz * s + nz * d];       // s along the front from A, d in from it
    const rect = (s0, s1, d0, d1) => [P(s0, d0), P(s1, d0), P(s1, d1), P(s0, d1)];
    const gy = Math.min(ground(...P(FL / 2, -2)), ground(...P(4, -2)), ground(...P(FL - 4, -2)));
    const G = geoOf();
    const stoneT = canvasTex(256, (g, S) => {
      const R2 = rnd(5);
      g.fillStyle = '#3e3b37'; g.fillRect(0, 0, S, S);
      let y = 0;
      while (y < S) { const h = 18 + R2() * 16; let x = -R2() * 30; while (x < S) { const w = 26 + R2() * 40, v = 96 + R2() * 34; g.fillStyle = `rgb(${v + 6},${v},${v - 6})`; g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, h - 4, 5); g.fill(); for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(${R2() < 0.5 ? '0,0,0' : '255,255,255'},0.08)`; g.fillRect(x + R2() * w, y + R2() * h, 6, 4); } x += w; } y += h; }
    }, 3);
    const gneiss = new THREE.MeshStandardMaterial({ map: stoneT, roughness: 0.95 });
    const slateT = canvasTex(256, (g, S) => {
      g.fillStyle = '#6b706f'; g.fillRect(0, 0, S, S);
      // diamond-laid slate
      g.strokeStyle = 'rgba(40,44,44,0.55)'; g.lineWidth = 2;
      for (let k = -S; k < S * 2; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.stroke(); g.beginPath(); g.moveTo(k, S); g.lineTo(k + S, 0); g.stroke(); }
      const R2 = rnd(9); for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(${R2() < 0.5 ? '0,0,0' : '255,255,255'},0.07)`; g.fillRect(R2() * S, R2() * S, 8, 8); }
    }, 2.4);
    const slateRoof = new THREE.MeshStandardMaterial({ map: slateT, roughness: 0.7 });
    const D0 = 16, wallTop = gy + 14;
    const pw = 12, centreW = 17;
    const sBig = rightIsB ? FL - pw / 2 : pw / 2, sSmall = rightIsB ? pw / 2 : FL - pw / 2;
    // the train shed: the whole outline, low walls and a long roof
    {
      const F = frameOf(b.p, [nx, nz]);
      roofedBody(G, ring, gy - 3, gy + 7.5, [{ cx: F.cx, cz: F.cz, ux: F.ux, uz: F.uz, hl: F.hl, hw: F.hw, rise: 6.5 }], gneiss, slateRoof);
    }
    // the wings, ridges along the front
    for (const [s0, s1] of [[pw, FL / 2 - centreW / 2], [FL / 2 + centreW / 2, FL - pw]]) {
      const r = rect(s0, s1, 0, D0), [cx, cz] = P((s0 + s1) / 2, D0 / 2);
      roofedBody(G, r, gy - 3, wallTop, [{ cx, cz, ux: tx, uz: tz, hl: (s1 - s0) / 2 + 0.01, hw: D0 / 2, rise: 7 }], gneiss, slateRoof);
      // dormers
      for (let s = s0 + 3; s < s1 - 2; s += 5) {
        const [dx, dz] = P(s, 2.2), dr = [P(s - 1.1, 1.0), P(s + 1.1, 1.0), P(s + 1.1, 3.4), P(s - 1.1, 3.4)];
        roofedBody(G, dr, wallTop, wallTop + 1.9, [{ cx: dx, cz: dz, ux: nx, uz: nz, hl: 1.2, hw: 1.1, rise: 1.2 }], M.white, slateRoof);
        decal(G, D.sash, ...P(s, 1.0), -nx, -nz, wallTop + 0.3, 1.0, 1.4, 0.03);
      }
      // three storeys of white-framed windows, arched on the ground floor
      for (let s = s0 + 2.2; s < s1 - 1.5; s += 3.2) {
        const [wx, wz] = P(s, 0);
        decal(G, D.round, wx, wz, -nx, -nz, gy + 1.0, 1.7, 2.6);
        decal(G, D.sash, wx, wz, -nx, -nz, gy + 5.2, 1.3, 2.1);
        decal(G, D.sash, wx, wz, -nx, -nz, gy + 9.2, 1.3, 2.1);
      }
      // a lighter string course between the storeys
      for (const y of [gy + 4.3, gy + 8.4, wallTop - 0.4]) { const [ax, az] = P(s0, -0.12), [bx, bz] = P(s1, -0.12); G.obox(M.graniteDark, (ax + bx) / 2, y, (az + bz) / 2, s1 - s0, 0.3, 0.3, 0, Math.atan2(tx, tz) + Math.PI / 2, 0); }
    }
    // the centre: a great gable with the half-round window and the clock, three doorways below
    {
      const s0 = FL / 2 - centreW / 2, s1 = FL / 2 + centreW / 2, r = rect(s0, s1, -1.2, D0 + 2), [cx, cz] = P(FL / 2, D0 / 2 + 0.4);
      roofedBody(G, r, gy - 3, wallTop + 1, [{ cx, cz, ux: nx, uz: nz, hl: D0 / 2 + 1.6, hw: centreW / 2, rise: 11 }], gneiss, slateRoof);
      const [fx, fz] = P(FL / 2, -1.2);
      const fan = decalTex((g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = '#5a5650'; g.beginPath(); g.arc(w / 2, h, w / 2, Math.PI, 0); g.fill();
        g.fillStyle = '#273038'; g.beginPath(); g.arc(w / 2, h, w / 2 - 14, Math.PI, 0); g.fill();
        g.strokeStyle = '#8a8a86'; g.lineWidth = 4;
        for (let x = 30; x < w; x += 30) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
        for (let y = h - 26; y > 0; y -= 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.arc(w / 2, h, w / 2, Math.PI, 0); g.fill();
      }, 512, 256);
      const fanM = new THREE.MeshStandardMaterial({ map: fan, transparent: true, alphaTest: 0.5, roughness: 0.2, metalness: 0.3, emissive: 0xffd9a0, emissiveMap: fan, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
      glowMats.push([fanM, 0, 0.8]);
      decal(G, fanM, fx, fz, -nx, -nz, gy + 6.4, 12.5, 6.25);
      // the gallery of columns under the window
      for (let k = -5; k <= 5; k++) { const [cx2, cz2] = P(FL / 2 + k * 1.1, -1.45); cyl(G, M.graniteDark, cx2, gy + 4.9, cz2, 0.16, 0.16, 1.5, 8); }
      { const [ax, az] = P(s0 + 1.5, -1.55), [bx, bz] = P(s1 - 1.5, -1.55); G.obox(M.graniteDark, (ax + bx) / 2, gy + 4.75, (az + bz) / 2, centreW - 3, 0.3, 0.6, 0, Math.atan2(tx, tz) + Math.PI / 2, 0); G.obox(M.graniteDark, (ax + bx) / 2, gy + 6.4, (az + bz) / 2, centreW - 3, 0.3, 0.6, 0, Math.atan2(tx, tz) + Math.PI / 2, 0); }
      decal(G, D.clock, fx, fz, -nx, -nz, gy + 7.3, 2.0, 2.0, 0.08);
      for (const k of [-1, 0, 1]) { const [dx, dz] = P(FL / 2 + k * 4.2, -1.2); decal(G, D.door, dx, dz, -nx, -nz, gy + 0.05, 2.6, 4.2); }
      // steps and the little green-roofed porches either side
      { const [sx, sz] = P(FL / 2, -2.2); boxAt(G, M.graniteDark, sx, gy - 0.5, sz, centreW - 2, 0.65, 2.0, Math.atan2(tx, tz)); }
      for (const k of [-1, 1]) { const [px, pz] = P(FL / 2 + k * (centreW / 2 + 1.6), -0.9); boxAt(G, gneiss, px, gy - 0.3, pz, 2.6, 4.1, 1.8, Math.atan2(tx, tz)); cone(G, M.copper, px, gy + 3.8, pz, 1.9, 1.5, 4, Math.atan2(tx, tz)); }
    }
    // the corner pavilions under their tall pyramid roofs
    for (const [s, big] of [[sBig, true], [sSmall, false]]) {
      const w = big ? pw + 1.5 : pw, d = big ? 15 : 13, top = wallTop + (big ? 3.5 : 0.5);
      const [cx, cz] = P(s, d / 2 - 0.6);
      boxAt(G, gneiss, cx, gy - 3, cz, w, top - gy + 3, d, Math.atan2(tx, tz));
      G.obox(M.graniteDark, cx, top - 0.2, cz, w + 0.5, 0.4, d + 0.5, 0, Math.atan2(tx, tz), 0);
      const rh = big ? 13 : 9;
      const pyr = new THREE.ConeGeometry((w + 0.6) / Math.SQRT2, rh, 4); pyr.translate(0, rh / 2, 0); pyr.rotateY(Math.PI / 4); pyr.scale(1, 1, d / w);
      G.geom(slateRoof, pyr, new THREE.Matrix4().makeRotationY(Math.atan2(tx, tz)).premultiply(new THREE.Matrix4().makeTranslation(cx, top, cz)));
      cyl(G, M.iron, cx, top + rh - 0.5, cz, 0.12, 0.03, 3.2, 6);
      // windows on its two outer faces
      for (const [fnx, fnz, span, off] of [[-nx, -nz, w, d / 2], [tx * (s > FL / 2 ? 1 : -1), tz * (s > FL / 2 ? 1 : -1), d, w / 2]]) {
        for (let k = -1; k <= 1; k++) {
          const ux2 = -fnz, uz2 = fnx, wx = cx + fnx * off + ux2 * k * span / 3.3, wz = cz + fnz * off + uz2 * k * span / 3.3;
          decal(G, D.round, wx, wz, fnx, fnz, gy + 1.0, 1.5, 2.6);
          for (const y of [gy + 5.2, gy + 9.2]) decal(G, D.sash, wx, wz, fnx, fnz, y, 1.2, 2.1);
          if (big) decal(G, D.sash, wx, wz, fnx, fnz, gy + 13.0, 1.1, 1.8);
        }
      }
      collideBox(cx, cz, w, d, Math.atan2(tx, tz), gy - 3, top + rh);
    }
    finish(G, 'Bergen stasjon');
    collide(b, wallTop);
    out.spots.push({ n: 'Bergen stasjon', x: P(FL / 2, -6)[0], z: P(FL / 2, -6)[1] });
  }

  // ------------------------------------------------ figures in bronze
  // a standing figure (about 1.8 m tall before scaling) facing (fx, fz): legs, coat, arms, head
  const figure = (G, mat, x, y, z, s, ang, pose = 'stand') => {
    const m = new THREE.Matrix4().makeRotationY(ang).premultiply(new THREE.Matrix4().makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeScale(s, s, s));
    const add = (geo, tx, ty, tz, rx = 0, rz = 0) => { geo.rotateX(rx); geo.rotateZ(rz); geo.translate(tx, ty, tz); G.geom(mat, geo, m); };
    add(new THREE.CylinderGeometry(0.11, 0.09, 0.85, 7), -0.12, 0.42, 0); add(new THREE.CylinderGeometry(0.11, 0.09, 0.85, 7), 0.12, 0.42, 0);
    add(new THREE.CylinderGeometry(0.2, 0.33, 0.95, 9), 0, 1.15, 0);                 // a long coat
    add(new THREE.CylinderGeometry(0.24, 0.2, 0.25, 9), 0, 1.6, 0);
    add(new THREE.SphereGeometry(0.13, 9, 7), 0, 1.86, 0.02);
    if (pose === 'violin') {                                                            // Ole Bull playing
      add(new THREE.CylinderGeometry(0.06, 0.05, 0.55, 6), -0.27, 1.55, 0.18, 1.1, 0.4);
      add(new THREE.CylinderGeometry(0.06, 0.05, 0.6, 6), 0.3, 1.5, 0.15, 1.2, -0.9);
      add(new THREE.BoxGeometry(0.2, 0.08, 0.55), -0.2, 1.68, 0.3, 0, 0.3);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 4), 0.1, 1.62, 0.35, 0, 1.3);
    } else if (pose === 'arm') {                                                       // one arm raised a little, speaking
      add(new THREE.CylinderGeometry(0.06, 0.05, 0.62, 6), -0.28, 1.3, 0, 0, 0.15);
      add(new THREE.CylinderGeometry(0.06, 0.05, 0.62, 6), 0.34, 1.5, 0.15, 1.0, -0.5);
    } else {
      add(new THREE.CylinderGeometry(0.06, 0.05, 0.62, 6), -0.28, 1.3, 0, 0, 0.12);
      add(new THREE.CylinderGeometry(0.06, 0.05, 0.62, 6), 0.28, 1.3, 0, 0, -0.12);
    }
  };
  const art = map.art || [];
  const artNamed = (n) => art.filter(a => a.n === n);
  const faceTo = (x, z) => { const d = streetDirFrom(x, z); return Math.atan2(d[0], d[1]); };
  function streetDirFrom(x, z) {
    // the way a statue faces: towards the most open side (the furthest from any building)
    let best = [0, 1], bd = -1;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a), c = polys.clearance(x, z, dx, dz, 40); if (c > bd) { bd = c; best = [dx, dz]; } }
    return best;
  }

  {
    const G = geoOf();
    const granite = M.granite, bronze = M.bronze;
    // Den blå steinen (Asbjørn Andresen, 1993) on Kong Olav Vs plass, after photos: a long, low,
    // sharp-edged wedge of polished dark blue stone (Azul Bahia slabs on a concrete core), about
    // 10 m long, rising from knee height to 1.5 m, with a rough granite block beside it and a
    // square pool of 2.8 m
    {
      const blue = canvasTex(256, (g, S) => {
        const R2 = rnd(31);
        g.fillStyle = '#2a3762'; g.fillRect(0, 0, S, S);
        for (let k = 0; k < 1200; k++) { g.fillStyle = `rgba(${R2() < 0.6 ? '18,24,52' : '110,130,190'},${R2() * 0.22})`; g.fillRect(R2() * S, R2() * S, 3 + R2() * 14, 2 + R2() * 5); }
        g.strokeStyle = 'rgba(200,205,220,0.35)'; g.lineWidth = 1.2;
        for (let k = 0; k < 10; k++) { g.beginPath(); let x = R2() * S, y = R2() * S; g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (R2() - 0.3) * 34; y += (R2() - 0.5) * 12; g.lineTo(x, y); } g.stroke(); }
        g.strokeStyle = 'rgba(10,12,25,0.7)'; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * S / 4, 0); g.lineTo(k * S / 4, S); g.stroke(); }
      }, 2.5);
      const blueM = new THREE.MeshStandardMaterial({ map: blue, roughness: 0.25, metalness: 0.05 });
      const named = art.find(a => /bl[åa] stein/i.test(a.n));
      const bx = named ? named.x : -576, bz = named ? named.z : 140, by = ground(bx, bz), ang = faceTo(bx, bz);
      // the wedge: 10 m along its axis, 1.8 m wide, 0.5 m high at one end and 1.5 m at the other
      const ux = Math.sin(ang), uz = Math.cos(ang), vx = uz, vz = -ux, len = 10, hw = 0.9;
      const P = (u, v, y) => [bx + ux * u + vx * v, by + y, bz + uz * u + vz * v];
      const H = (u) => 0.5 + (u + len / 2) / len * 1.0;
      const a = P(-len / 2, -hw, 0), b = P(len / 2, -hw, 0), c = P(len / 2, hw, 0), d = P(-len / 2, hw, 0);
      const at = P(-len / 2, -hw, H(-len / 2)), bt2 = P(len / 2, -hw, H(len / 2)), ct = P(len / 2, hw, H(len / 2)), dt = P(-len / 2, hw, H(-len / 2));
      G.quad(blueM, at, bt2, ct, dt, [[0, 0], [len, 0], [len, 1.8], [0, 1.8]], [0, 1, 0]);
      G.quad(blueM, a, b, bt2, at, [[0, 0], [len, 0], [len, H(len / 2)], [0, H(-len / 2)]], [-vx, 0, -vz]);
      G.quad(blueM, d, c, ct, dt, [[0, 0], [len, 0], [len, H(len / 2)], [0, H(-len / 2)]], [vx, 0, vz]);
      G.quad(blueM, b, c, ct, bt2, [[0, 0], [1.8, 0], [1.8, 1.5], [0, 1.5]], [ux, 0, uz]);
      G.quad(blueM, a, d, dt, at, [[0, 0], [1.8, 0], [1.8, 0.5], [0, 0.5]], [-ux, 0, -uz]);
      // the rough granite block beside it, and the square pool
      { const [gx, , gz] = P(len / 2 + 1.5, 2.2, 0); G.obox(M.granite, gx, ground(gx, gz) + 0.3, gz, 3.2, 0.8, 1.2, 0, ang, 0); }
      const [px, , pz] = P(-len / 2 - 2.4, 0, 0), py = ground(px, pz);
      for (const [ox, oz, w, d2] of [[0, 1.4, 3.0, 0.2], [0, -1.4, 3.0, 0.2], [1.4, 0, 0.2, 2.6], [-1.4, 0, 0.2, 2.6]]) G.obox(granite, px + ox, py + 0.15, pz + oz, w, 0.4, d2, 0, 0, 0);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshStandardMaterial({ color: 0x2d4650, roughness: 0.05, metalness: 0.2 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(px, py + 0.25, pz); scene.add(pool);
      collideBox(bx, bz, 1.8, len, ang, by - 1, by + 1.5);
      out.spots.push({ n: 'Den blå steinen', x: bx, z: bz });
      // Bergens Tidende's neon sign on the roof across the square, facing the stone
      if (L.bt) {
        const r = ringOf(L.bt.p);
        let best = null;
        for (let i = 0; i < r.length; i++) {
          const [ax, az] = r[i], [cx2, cz2] = r[(i + 1) % r.length], el = Math.hypot(cx2 - ax, cz2 - az);
          if (el < 6) continue;
          const mx = (ax + cx2) / 2, mz = (az + cz2) / 2, dd = Math.hypot(mx - bx, mz - bz);
          if (!best || dd < best.dd) best = { dd, mx, mz, tx: (cx2 - ax) / el, tz: (cz2 - az) / el, el };
        }
        if (best) {
          let nx = -best.tz, nz = best.tx;
          if ((bx - best.mx) * nx + (bz - best.mz) * nz < 0) { nx = -nx; nz = -nz; }
          const neon = decalTex((g, w, h) => {
            g.clearRect(0, 0, w, h);
            g.font = `italic 700 118px Georgia, "Times New Roman", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.lineWidth = 10; g.strokeStyle = '#7a0d08'; g.strokeText('Bergens Tidende', w / 2, h * 0.68);
            g.fillStyle = '#ff4a36'; g.fillText('Bergens Tidende', w / 2, h * 0.68);
            g.strokeStyle = '#f4efe6'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h * 0.26, 52, 0, 7); g.stroke();
            g.strokeStyle = '#ff4a36'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h * 0.26, 40, 0, 7); g.stroke();
            g.fillStyle = '#f4efe6'; for (const s2 of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s2 * 95, h * 0.24, 46, 16, s2 * 0.5, 0, 7); g.fill(); }
          }, 1024, 320);
          const neonM = new THREE.MeshBasicMaterial({ map: neon, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: 0xbbbbbb });
          glowNeon = neonM;
          const W = Math.min(14, best.el), Hh = W * 320 / 1024, y0 = L.bt.t + 0.6;
          const [sx, sz] = [best.mx - nx * 1.2, best.mz - nz * 1.2];
          const m = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), neonM);
          m.position.set(sx, y0 + Hh / 2, sz); m.rotation.y = Math.atan2(nx, nz);
          scene.add(m);
          // the frame it stands on
          for (const s2 of [-0.4, 0.4]) cyl(G, M.iron, sx + best.tx * W * s2, L.bt.t - 0.5, sz + best.tz * W * s2, 0.06, 0.06, 1.4, 6);
        }
      }
    }
    // Sjømannsmonumentet on Torgallmenningen: a tall granite column carved with seafarers in
    // relief, on steps, with bronze figures round its foot
    if (L.seamen) {
      const [sx, sz] = centroid(L.seamen.p), sy = ground(sx, sz);
      const relief = canvasTex(256, (g, S) => {
        g.fillStyle = '#a6a297'; g.fillRect(0, 0, S, S);
        const R2 = rnd(77);
        for (let row = 0; row < 4; row++) for (let k = 0; k < 5; k++) {
          const x = k * S / 5 + 10, y = row * S / 4 + 8, h = S / 4 - 14;
          g.fillStyle = 'rgba(60,58,52,0.35)'; g.fillRect(x + 8, y + h * 0.28, 22, h * 0.72); g.beginPath(); g.arc(x + 19, y + h * 0.18, 9, 0, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 6, y + h * 0.28, 4, h * 0.7);
        }
        for (let k = 0; k < 2000; k++) { g.fillStyle = `rgba(${R2() < 0.5 ? '0,0,0' : '255,255,255'},0.08)`; g.fillRect(R2() * S, R2() * S, 2, 2); }
      }, 2.4, { metresV: 3 });
      const reliefM = new THREE.MeshStandardMaterial({ map: relief, roughness: 0.9 });
      for (let k = 0; k < 3; k++) G.obox(granite, sx, sy + 0.15 + k * 0.3, sz, 6.4 - k * 0.9, 0.3, 6.4 - k * 0.9, 0, 0.45, 0);
      G.obox(granite, sx, sy + 1.4, sz, 3.2, 1.0, 3.2, 0, 0.45, 0);
      const col = new THREE.CylinderGeometry(1.0, 1.25, 8.5, 4, 1, false, Math.PI / 4); col.translate(0, 4.25, 0);
      G.geom(reliefM, col, new THREE.Matrix4().makeRotationY(0.45).premultiply(new THREE.Matrix4().makeTranslation(sx, sy + 1.9, sz)));
      G.obox(granite, sx, sy + 10.6, sz, 2.2, 0.5, 2.2, 0, 0.45, 0);
      for (let k = 0; k < 4; k++) { const a = 0.45 + k * Math.PI / 2 + Math.PI / 4; figure(G, bronze, sx + Math.sin(a) * 2.2, sy + 0.9, sz + Math.cos(a) * 2.2, 1.15, a); }
      figure(G, bronze, sx, sy + 10.85, sz, 1.2, 0.45, 'arm');
      polys.add(Float32Array.from([sx - 3.2, sz - 3.2, sx + 3.2, sz - 3.2, sx + 3.2, sz + 3.2, sx - 3.2, sz + 3.2]), sy - 1, sy + 0.9, { kind: 'flat', walk: true });
      collideBox(sx, sz, 3.2, 3.2, 0.45, sy, sy + 13);
      out.spots.push({ n: 'Sjømannsmonumentet', x: sx, z: sz });
    }
    // the aquarium's entrance: OSM has its ticket office as a named point
    if (!art.some(a => a.k === 'aquarium')) { const s = (map.shops || []).find(s => /^Akvariet/.test(s.n)); if (s) art.push({ n: s.n, k: 'aquarium', x: s.x, z: s.z }); }
    // the statues
    for (const a of art) {
      if (!/statue|sculpture|bust|aquarium/.test(a.k) && a.n !== 'Pacific Northwest Totem' || !a.n || /bl[åa] stein/i.test(a.n)) continue;
      let ang = faceTo(a.x, a.z);
      const y = ground(a.x, a.z);
      // Christie stands with his back to the University Museum, looking out over Muséplass
      if (a.n === 'Christiestøtten' && L.uimuseum) { const [mx, mz] = centroid(L.uimuseum.p); ang = Math.atan2(a.x - mx, a.z - mz); }
      if (a.n === 'Pacific Northwest Totem') {
        // the totem pole in Nordnesparken, Seattle's gift for Bergen's 900th year (Duane Pasco, 1970):
        // a tall carved cedar pole of stacked figures in red, black, white and turquoise, wings at the top
        const totem = canvasTex(128, (g, S) => {
          g.fillStyle = '#8a5a3a'; g.fillRect(0, 0, S, S);
          const cols = ['#b3261e', '#141414', '#e8e2d2', '#2f8f8a'];
          for (let k = 0; k < 4; k++) { const y = k * S / 4; g.fillStyle = cols[k]; g.beginPath(); g.ellipse(S * 0.3, y + 12, 12, 8, 0, 0, 7); g.ellipse(S * 0.7, y + 12, 12, 8, 0, 0, 7); g.fill(); g.fillStyle = cols[(k + 1) % 4]; g.fillRect(S * 0.35, y + 20, S * 0.3, 6); g.fillStyle = '#141414'; g.beginPath(); g.arc(S * 0.3, y + 12, 4, 0, 7); g.arc(S * 0.7, y + 12, 4, 0, 7); g.fill(); }
        }, 2.5, { metresV: 2.5 });
        const tm = new THREE.MeshStandardMaterial({ map: totem, roughness: 0.8 });
        cyl(G, tm, a.x, y - 0.5, a.z, 0.45, 0.38, 11, 10);
        for (const sd of [-1, 1]) G.obox(tm, a.x + Math.cos(ang) * sd * 1.1, y + 9.6, a.z - Math.sin(ang) * sd * 1.1, 1.6, 0.5, 0.12, 0, ang, sd * 0.35);
        collideBox(a.x, a.z, 1, 1, 0, y - 1, y + 11);
      } else if (a.k === 'aquarium') {
        // Akvariet's entrance after photos: a low pavilion with white posts under a dark slate roof,
        // AKVARIET I BERGEN in letters along its ridge, flagpoles beside it
        const W = 14, Dp = 4;
        const roof = new THREE.ConeGeometry(Math.hypot(W, Dp) / 2, 1.4, 4); roof.rotateY(Math.PI / 4); roof.scale(W / Math.hypot(W, Dp) * Math.SQRT2, 1, Dp / Math.hypot(W, Dp) * Math.SQRT2);
        G.geom(M.slateDark, roof, new THREE.Matrix4().makeRotationY(ang + Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(a.x, y + 3.2, a.z)));
        for (let k = -3; k <= 3; k++) for (const sd of [-1, 1]) { const px = a.x + Math.cos(ang) * k * 2.2 + Math.sin(ang) * sd * 1.6, pz = a.z - Math.sin(ang) * k * 2.2 + Math.cos(ang) * sd * 1.6; G.obox(M.white, px, y + 1.6, pz, 0.2, 3.2, 0.2, 0, ang, 0); }
        const letters = decalTex((g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#e8eef2'; g.font = '800 56px Archivo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AKVARIET I BERGEN', w / 2, h / 2); }, 1024, 96);
        const lm = new THREE.MeshStandardMaterial({ map: letters, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: letters, emissiveIntensity: 0.2 });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.95), lm); sign.position.set(a.x, y + 4.4, a.z); sign.rotation.y = ang; scene.add(sign);
        for (let k = 0; k < 4; k++) { const fx = a.x + Math.cos(ang) * (W / 2 + 2 + k * 1.4) + Math.sin(ang) * 3, fz = a.z - Math.sin(ang) * (W / 2 + 2 + k * 1.4) + Math.cos(ang) * 3; cyl(G, M.white, fx, y, fz, 0.06, 0.04, 9, 6); G.obox(new THREE.MeshStandardMaterial({ color: [0x2a5bb8, 0xc8102e, 0x2a5bb8, 0x3a8fd0][k], side: THREE.DoubleSide }), fx, y + 7.6, fz + 0.5, 0.02, 2.2, 0.9, 0, ang, 0); }
        collideBox(a.x, a.z, W, Dp, ang, y - 1, y + 3.5);
        out.spots.push({ n: 'Akvariet', x: a.x, z: a.z });
      } else if (a.n === 'Ole Bull') {
        // Ole Bull on his rock with the violin, water falling into the pool below (1901)
        const rock = new THREE.DodecahedronGeometry(2.0, 0); rock.scale(1.3, 0.9, 1.1); rock.translate(0, 1.2, 0);
        G.geom(M.graniteDark, rock, new THREE.Matrix4().makeTranslation(a.x, y, a.z));
        figure(G, bronze, a.x, y + 2.7, a.z, 1.35, ang, 'violin');
        collideBox(a.x, a.z, 4, 4, 0, y - 1, y + 5);
      } else if (a.n === 'Christian Michelsen') {
        // the tall column on Festplassen with the statesman on top (1938)
        G.obox(granite, a.x, y + 0.6, a.z, 4.2, 1.2, 4.2, 0, ang, 0);
        cyl(G, granite, a.x, y + 1.2, a.z, 1.0, 0.85, 15, 16);
        G.obox(granite, a.x, y + 16.4, a.z, 2.2, 0.5, 2.2, 0, ang, 0);
        figure(G, bronze, a.x, y + 16.65, a.z, 1.6, ang, 'arm');
        collideBox(a.x, a.z, 4.2, 4.2, ang, y - 1, y + 19);
      } else {
        const tall = a.n === 'Holbergstatuen' || a.n === 'Christiestøtten' ? 3.4 : a.n === 'Edvard Grieg' ? 1.6 : a.k === 'bust' ? 1.4 : 1.0;
        if (a.n === 'Christiestøtten') {
          // the lion lying at the foot of the pedestal
          const lion = new THREE.SphereGeometry(0.55, 10, 8); lion.scale(1.8, 0.8, 0.9);
          G.geom(M.graniteDark, lion, new THREE.Matrix4().makeTranslation(a.x + Math.sin(ang) * 1.3, y + 0.45, a.z + Math.cos(ang) * 1.3));
          sphere(G, M.graniteDark, a.x + Math.sin(ang) * 1.3 + Math.cos(ang) * 0.8, y + 0.85, a.z + Math.cos(ang) * 1.3 - Math.sin(ang) * 0.8, 0.35);
        }
        G.obox(granite, a.x, y + tall / 2, a.z, 1.4, tall, 1.4, 0, ang, 0);
        if (a.k === 'bust') { sphere(G, bronze, a.x, y + tall + 0.35, a.z, 0.3); cyl(G, bronze, a.x, y + tall, a.z, 0.35, 0.25, 0.3, 8); }
        else figure(G, bronze, a.x, y + tall, a.z, a.n === 'Holbergstatuen' || a.n === 'Edvard Grieg' ? 1.25 : 1.0, ang, a.n === 'Holbergstatuen' ? 'arm' : 'stand');
        collideBox(a.x, a.z, 1.4, 1.4, ang, y - 1, y + tall + 2);
      }
    }
    // Musikkpaviljongen in Byparken: an octagonal cast-iron bandstand on a stone base, slender
    // green columns, a white railing and a green copper roof with a lantern
    if (L.pavilion) {
      const [px, pz] = centroid(L.pavilion.p), py = ground(px, pz), r = 4.0;
      const base = new THREE.CylinderGeometry(r + 0.3, r + 0.5, 1.4, 8); base.translate(0, 0.3, 0);
      G.geom(granite, base, new THREE.Matrix4().makeRotationY(Math.PI / 8).premultiply(new THREE.Matrix4().makeTranslation(px, py, pz)));
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2, cx = px + Math.sin(a) * r, cz = pz + Math.cos(a) * r;
        cyl(G, M.iron, cx, py + 1.0, cz, 0.1, 0.08, 3.4, 8);
        const a2 = (k + 1) / 8 * Math.PI * 2, nx2 = px + Math.sin(a2) * r, nz2 = pz + Math.cos(a2) * r, len = Math.hypot(nx2 - cx, nz2 - cz), mid = [(cx + nx2) / 2, (cz + nz2) / 2], ang = Math.atan2(nx2 - cx, nz2 - cz) + Math.PI / 2;
        if (k !== 0) { G.obox(M.white, mid[0], py + 1.95, mid[1], len, 0.08, 0.08, 0, ang, 0); for (let j = 1; j < 7; j++) cyl(G, M.white, cx + (nx2 - cx) * j / 7, py + 1.0, cz + (nz2 - cz) * j / 7, 0.025, 0.025, 0.95, 4); }
        G.obox(M.iron, mid[0], py + 4.25, mid[1], len, 0.35, 0.12, 0, ang, 0);
      }
      lathe(G, M.copper, px, py + 4.4, pz, [[r + 0.6, 0], [r + 0.3, 0.5], [r - 0.6, 1.4], [r - 2.0, 2.3], [1.0, 2.9], [0.9, 3.0]], 8, Math.PI / 8);
      cyl(G, M.iron, px, py + 7.4, pz, 0.9, 0.9, 0.9, 8);
      cone(G, M.copper, px, py + 8.3, pz, 1.1, 1.6, 8);
      sphere(G, M.gold, px, py + 10.0, pz, 0.15);
      polys.add(Float32Array.from([px - r, pz - r, px + r, pz - r, px + r, pz + r, px - r, pz + r]), py - 1, py + 1.0, { kind: 'flat', walk: true });
      out.spots.push({ n: 'Musikkpaviljongen', x: px, z: pz });
    }
    finish(G, 'Monuments');
  }

  // ------------------------------------------------ the fountain in Lille Lungegårdsvann
  {
    const lake = (map.waters || []).reduce((a, w) => (!a || w.a > a.a) && w.y < 2 ? w : a, null);
    const f = art.find(a => a.k === 'fountain' && lake && Math.abs(a.x + 269) < 60 && Math.abs(a.z - 308) < 60) || (lake ? { x: -268.8, z: 308.5 } : null);
    if (f) {
      const jetT = canvasTex(64, (g, S) => { const R2 = rnd(3); g.clearRect(0, 0, S, S); for (let k = 0; k < 220; k++) { g.fillStyle = `rgba(255,255,255,${0.25 + R2() * 0.5})`; g.fillRect(R2() * S, R2() * S, 2, 5 + R2() * 8); } }, 1);
      jetT.repeat.set(3, 2);
      const jetM = new THREE.MeshBasicMaterial({ map: jetT, transparent: true, depthWrite: false, opacity: 0.85, side: THREE.DoubleSide, fog: true });
      const H = 22, wy = 0.2;
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.2, H, 12, 1, true), jetM);
      jet.position.set(f.x, wy + H / 2, f.z);
      const spray = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 0.8, 4, 16, 1, true), jetM.clone());
      spray.material.opacity = 0.5; spray.position.set(f.x, wy + 1.6, f.z);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 8), jetM.clone()); crown.material.opacity = 0.45; crown.position.set(f.x, wy + H, f.z); crown.scale.set(1, 1.6, 1);
      scene.add(jet, spray, crown);
      out.fountain = { jet, spray, crown, t: jetT };
    }
  }

  // ------------------------------------------------ Mathallen (2012) and the fish market on Torget
  // A glass ground floor open to the harbour, the upper floor clad in vertical boards in Bergen's
  // colours, ochre, dark red and white, in a changing rhythm; the fish market's stalls under
  // red-and-white awnings along the quay in front of it.
  if (L.mathallen) {
    const b = L.mathallen, ring = ringOf(b.p), [lo, hi] = groundUnder(ring), G = geoOf();
    const slats = canvasTex(512, (g, S) => {
      // glass in front, the wooden panels behind it in Bergen's colours, denser in places
      const R2 = rnd(12), cols = ['#b98a3a', '#7e3028', '#e3e0d6', '#b98a3a', '#e3e0d6'];
      const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#6f8794'); gr.addColorStop(1, '#3a4a53'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
      let x = 0; while (x < S) { const dense = Math.sin(x / S * Math.PI * 4) > 0, w = 5 + R2() * 5, gap = dense ? 3 + R2() * 4 : 14 + R2() * 24; g.fillStyle = cols[Math.floor(R2() * cols.length)]; g.globalAlpha = 0.85; g.fillRect(x, 0, w, S); x += w + gap; }
      g.globalAlpha = 1; g.fillStyle = 'rgba(220,230,235,0.12)'; g.fillRect(0, 0, S, S);
      g.fillStyle = '#9aa2a6'; for (let k = 0; k <= 4; k++) g.fillRect(k * S / 4 - 2, 0, 4, S); g.fillRect(0, 0, S, 6); g.fillRect(0, S - 6, S, 6);
    }, 6, { metresV: 4.2 });
    const glassT = canvasTex(256, (g, S) => {
      g.fillStyle = '#2d3a42'; g.fillRect(0, 0, S, S);
      g.fillStyle = 'rgba(255,205,140,0.35)'; g.fillRect(0, S * 0.55, S, S * 0.45);
      g.fillStyle = '#b8bcbe'; for (let x = 0; x < S; x += S / 4) g.fillRect(x, 0, 4, S); g.fillRect(0, S - 6, S, 6); g.fillRect(0, 0, S, 5);
    }, 3, { metresV: 4.4 });
    const glassM = new THREE.MeshStandardMaterial({ map: glassT, roughness: 0.1, metalness: 0.3, emissive: 0xffffff, emissiveMap: glassT, emissiveIntensity: 0 });
    glowMats.push([glassM, 0.1, 0.7]);
    const slatM = new THREE.MeshStandardMaterial({ map: slats, roughness: 0.8 });
    roofedBody(G, ring, lo - 3, hi + 4.4, [], glassM, M.trim);
    roofedBody(G, ring.map(([x, z]) => [x, z]), hi + 4.4, hi + 8.8, [], slatM, new THREE.MeshStandardMaterial({ color: 0x5a5c5e, roughness: 0.9 }), { lift: 0 });
    finish(G, 'Mathallen');
    collide(b, hi + 8.8);
    out.spots.push({ n: 'Mathallen', x: centroid(b.p)[0], z: centroid(b.p)[1] });
    // the stalls: along the quay nearest Mathallen
    const [mx, mz] = centroid(b.p), stalls = [];
    for (const f of map.coast || []) for (let i = 0; i < f.length - 2; i += 2) {
      const ax = f[i], az = f[i + 1], bx2 = f[i + 2], bz2 = f[i + 3], len = Math.hypot(bx2 - ax, bz2 - az);
      if (len < 1) continue;
      const dx = (bx2 - ax) / len, dz = (bz2 - az) / len, lx = dz, lz = -dx;
      for (let s = 2; s < len - 2; s += 4.2) {
        const x = ax + dx * s + lx * 6, z = az + dz * s + lz * 6;
        if (Math.hypot(x - mx, z - mz) > 60 || polys.nearBuilding(x, z, 2.5)) continue;
        stalls.push([x, z, Math.atan2(dx, dz)]);
      }
    }
    const SG = geoOf(), awning = canvasTex(64, (g, S) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f3f1ea' : '#c7281f'; g.fillRect(i * S / 8, 0, S / 8, S); } }, 1.2);
    const awnM = new THREE.MeshStandardMaterial({ map: awning, roughness: 0.7, side: THREE.DoubleSide });
    const iceM = new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.3 }), fishM = new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.4 });
    for (const [x, z, a] of stalls.slice(0, 24)) {
      const y = ground(x, z), ra = a + Math.PI / 2;           // ra: the stall's long side along the quay
      SG.obox(M.white, x, y + 0.45, z, 3.6, 0.9, 1.4, 0, ra, 0);
      SG.obox(iceM, x, y + 0.93, z, 3.4, 0.06, 1.2, 0, ra, 0);
      for (const o of [-1.1, -0.3, 0.5, 1.2]) SG.obox(fishM, x + Math.sin(a) * o, y + 1.0, z + Math.cos(a) * o, 0.5, 0.08, 0.9, 0, a, 0);
      for (const [u, v] of [[-1.8, -0.8], [1.8, -0.8], [-1.8, 1.4], [1.8, 1.4]]) SG.obox(M.white, x + Math.sin(a) * u + Math.cos(a) * v, y + 1.25, z + Math.cos(a) * u - Math.sin(a) * v, 0.06, 2.5, 0.06, 0, a, 0);
      // a pitched awning of striped canvas, two sloping halves
      for (const s2 of [-1, 1]) { const v = s2 * 0.55; SG.obox(awnM, x + Math.cos(a) * v, y + 2.85, z - Math.sin(a) * v, 3.9, 0.04, 1.25, s2 * 0.42, ra, 0); }
      collideBox(x, z, 3.6, 1.4, ra, y - 1, y + 1.0);
    }
    finish(SG, 'Fisketorget');
  }

  // ------------------------------------------------ Bergen rådhus: the 14-storey tower (1974)
  // Natural concrete with bands of dark windows, 51 m, on the long arm of the OSM outline.
  if (L.radhus) {
    const r = ringOf(L.radhus.p);
    let bi = 0, bl = 0;
    for (let i = 0; i < r.length; i++) { const j = (i + 1) % r.length, l = Math.hypot(r[j][0] - r[i][0], r[j][1] - r[i][1]); if (l > bl) { bl = l; bi = i; } }
    const A = r[bi], B = r[(bi + 1) % r.length], tx = (B[0] - A[0]) / bl, tz = (B[1] - A[1]) / bl;
    let nx = -tz, nz = tx;
    if (!insideRings([r], (A[0] + B[0]) / 2 + nx, (A[1] + B[1]) / 2 + nz)) { nx = -nx; nz = -nz; }
    const depth = 13.5, cx = (A[0] + B[0]) / 2 + nx * depth / 2, cz = (A[1] + B[1]) / 2 + nz * depth / 2, gy = ground(cx, cz);
    const bands = canvasTex(256, (g, S) => {
      g.fillStyle = '#a39b8e'; g.fillRect(0, 0, S, S);
      const R2 = rnd(4); for (let k = 0; k < 3000; k++) { g.fillStyle = `rgba(${R2() < 0.5 ? '60,55,48' : '220,214,200'},0.14)`; g.fillRect(R2() * S, R2() * S, 2, 2); }
      g.fillStyle = '#1f262c'; g.fillRect(0, S * 0.38, S, S * 0.4);
      g.fillStyle = '#8c857a'; for (let x = 0; x < S; x += S / 4) g.fillRect(x, S * 0.38, 6, S * 0.4);
    }, 3.6, { metresV: 3.6 });
    const G = geoOf();
    const bandM = new THREE.MeshStandardMaterial({ map: bands, roughness: 0.85 });
    // the low wing over the whole outline, the tower on its long arm, a little proud of it
    const [lo, hi] = groundUnder(r);
    roofedBody(G, r, lo - 3, hi + 11, [], bandM, new THREE.MeshStandardMaterial({ color: 0x7d776d, roughness: 0.9 }));
    collide(L.radhus, hi + 11);
    G.obox(bandM, cx - nx * 0.15, gy + 25, cz - nz * 0.15, bl + 0.3, 54, depth + 0.3, 0, Math.atan2(tx, tz) + Math.PI / 2, 0);
    G.obox(new THREE.MeshStandardMaterial({ color: 0x8f877b, roughness: 0.9 }), cx, gy + 52.4, cz, bl - 2.4, 1.4, depth - 2, 0, Math.atan2(tx, tz) + Math.PI / 2, 0);
    finish(G, 'Bergen rådhus');
    collideBox(cx, cz, bl - 0.4, depth, Math.atan2(tx, tz) + Math.PI / 2, gy - 2, gy + 53);
    out.spots.push({ n: 'Rådhuset', x: cx, z: cz });
  }

  // ------------------------------------------------ Skansen brannstasjon: the white watch tower
  if (L.skansen) {
    const [cx, cz] = centroid(L.skansen.p), gy = ground(cx, cz), G = geoOf(), top = L.skansen.t + 7;
    boxAt(G, M.white, cx, gy - 1, cz, 4.2, top - gy + 1, 4.2, 0.6);
    for (const [nx, nz] of [[Math.sin(0.6), Math.cos(0.6)], [-Math.sin(0.6), -Math.cos(0.6)], [Math.cos(0.6), -Math.sin(0.6)], [-Math.cos(0.6), Math.sin(0.6)]]) decal(G, D.sash, cx + nx * 2.1, cz + nz * 2.1, nx, nz, top - 2.4, 1.2, 1.8);
    cone(G, M.slateDark, cx, top, cz, 3.4, 4.5, 4, 0.6);
    cyl(G, M.iron, cx, top + 4.3, cz, 0.05, 0.03, 1.5, 4);
    finish(G, 'Skansen brannstasjon');
    collideBox(cx, cz, 4.2, 4.2, 0.6, gy - 1, top + 4);
  }

  // names for the map
  {
    const bry = map.buildings.filter(b => b.k === 'bryggen');
    if (bry.length) { let x = 0, z = 0; for (const b of bry) { const [cx, cz] = centroid(b.p); x += cx; z += cz; } out.spots.push({ n: 'Bryggen', x: x / bry.length, z: z / bry.length }); }
    const lake = (map.waters || []).reduce((a, w) => (!a || w.a > a.a) ? w : a, null);
    if (lake) { const [x, z] = centroid(lake.p); out.spots.push({ n: 'Lille Lungegårdsvann', x, z }); }
    out.spots.push({ n: 'Skuteviken', x: -690, z: -1040 }, { n: 'Torgallmenningen', x: -470, z: 0 });
  }

  out.update = (dt, lamp, time = 0) => {
    if (out.fountain) { out.fountain.t.offset.y = -time * 1.6; const s = 1 + Math.sin(time * 3.1) * 0.04; out.fountain.crown.scale.set(s, 1.6 * s, s); } for (const [m, day, night] of glowMats) m.emissiveIntensity = day + (night - day) * lamp; if (glowNeon) glowNeon.color.setScalar(0.75 + 0.6 * lamp); };
  return out;
}
