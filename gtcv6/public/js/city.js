// The real neighbourhood, built from map data (OpenStreetMap buildings and
// streets, Kartverket terrain) that tools/build_map.py packs into public/data.
import * as THREE from '../vendor/three.module.min.js';
import { Geo } from './engine.js';
import { rng } from './textures.js';

export async function loadMapData(base = '/data/') {
  const [map, terr, coarse, ground] = await Promise.all([
    fetch(base + 'map.json').then(r => r.json()),
    fetch(base + 'terrain.bin').then(r => r.arrayBuffer()),
    fetch(base + 'coarse.bin').then(r => r.arrayBuffer()),
    fetch(base + 'ground.bin').then(r => r.arrayBuffer()),
  ]);
  map.terrH = new Int16Array(terr);
  map.coarseH = new Int16Array(coarse);
  map.groundCls = new Uint8Array(ground);
  return map;
}

// ---------------------------------------------------------------------------
// Terrain sampling (bilinear on the fine grid, coarse grid outside it)
export class Terrain {
  constructor(map) {
    this.f = map.terrain; this.fh = map.terrH;
    this.c = map.coarse; this.ch = map.coarseH;
    this.clsArr = map.groundCls;
    this.masks = [];   // areas where the terrain is not ground (inside house 6)
  }
  _grid(g, h, x, z) {
    const fx = (x - g.x0) / g.step, fz = (z - g.z0) / g.step;
    const i = Math.floor(fx), j = Math.floor(fz);
    const i0 = Math.max(0, Math.min(g.nx - 2, i)), j0 = Math.max(0, Math.min(g.nz - 2, j));
    const tx = Math.max(0, Math.min(1, fx - i0)), tz = Math.max(0, Math.min(1, fz - j0));
    const a = h[j0 * g.nx + i0], b = h[j0 * g.nx + i0 + 1], c = h[(j0 + 1) * g.nx + i0], d = h[(j0 + 1) * g.nx + i0 + 1];
    // match the mesh triangulation (diagonal from (i,j+1) to (i+1,j))
    let v;
    if (tx + tz <= 1) v = a + (b - a) * tx + (c - a) * tz;
    else v = d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
    return v * g.scale;
  }
  inFine(x, z) {
    const g = this.f;
    return x >= g.x0 && z >= g.z0 && x <= g.x0 + (g.nx - 1) * g.step && z <= g.z0 + (g.nz - 1) * g.step;
  }
  height(x, z) {
    if (this.inFine(x, z)) return this._grid(this.f, this.fh, x, z);
    return this._grid(this.c, this.ch, x, z);
  }
  // ground for walking: -Infinity inside masked areas (floors come from the house there)
  ground(x, z) {
    for (const m of this.masks) if (m(x, z)) return -Infinity;
    return this.height(x, z);
  }
  cls(x, z) {
    const g = this.f;
    const i = Math.round((x - g.x0) / g.step), j = Math.round((z - g.z0) / g.step);
    if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) return 0;
    return this.clsArr[j * g.nx + i];
  }
}

// ---------------------------------------------------------------------------
// Polygon prisms (buildings) for collision and camera rays
export class PolyWorld {
  constructor(cell = 16) { this.items = []; this.grid = new Map(); this.cell = cell; this.stamp = 0; }
  add(pts, base, top, data = {}) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); z0 = Math.min(z0, pts[i + 1]); z1 = Math.max(z1, pts[i + 1]); }
    const it = { pts, base, top, x0, z0, x1, z1, _s: 0, ...data };
    this.items.push(it);
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const k = i * 100003 + j;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(it);
      }
    return it;
  }
  query(x0, z0, x1, z1, out = []) {
    out.length = 0;
    const s = ++this.stamp, c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const arr = this.grid.get(i * 100003 + j);
        if (!arr) continue;
        for (const it of arr) {
          if (it._s === s) continue;
          it._s = s;
          if (it.x1 < x0 || it.x0 > x1 || it.z1 < z0 || it.z0 > z1) continue;
          out.push(it);
        }
      }
    return out;
  }
  static inside(pts, x, z) {
    let c = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const xi = pts[i], zi = pts[i + 1], xj = pts[j], zj = pts[j + 1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
    }
    return c;
  }
  // nearest point on the outline
  static nearest(pts, x, z, out) {
    let bd = Infinity;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const ax = pts[j], az = pts[j + 1], bx = pts[i], bz = pts[i + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const px = ax + dx * t, pz = az + dz * t, d = (x - px) ** 2 + (z - pz) ** 2;
      if (d < bd) { bd = d; out.x = px; out.z = pz; }
    }
    return Math.sqrt(bd);
  }
  collide(pos, r, height, step) {
    let hit = null;
    const arr = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, this._q || (this._q = []));
    const np = this._np || (this._np = { x: 0, z: 0 });
    for (const it of arr) {
      if (it.top + (it.roof || 0) <= pos.y + step || it.base >= pos.y + height) continue;
      const d = PolyWorld.nearest(it.pts, pos.x, pos.z, np);
      const ins = PolyWorld.inside(it.pts, pos.x, pos.z);
      if (!ins && d >= r) continue;
      let nx = pos.x - np.x, nz = pos.z - np.z;
      const l = Math.hypot(nx, nz) || 1e-6;
      nx /= l; nz /= l;
      if (ins) { nx = -nx; nz = -nz; }
      pos.x = np.x + nx * r; pos.z = np.z + nz * r;
      hit = hit || { nx, nz, item: it };
    }
    return hit;
  }
  // highest roof under (x,z) that is at most `step` above y
  roofAt(x, z, y, step) {
    let best = -Infinity;
    for (const it of this.query(x, z, x, z, this._q1 || (this._q1 = []))) {
      if (it.walk && it.top <= y + step && it.top > best && PolyWorld.inside(it.pts, x, z)) best = it.top;
    }
    return best;
  }
  raycast(o, d, maxDist) {
    const ex = o.x + d.x * maxDist, ez = o.z + d.z * maxDist;
    const arr = this.query(Math.min(o.x, ex), Math.min(o.z, ez), Math.max(o.x, ex), Math.max(o.z, ez), this._q3 || (this._q3 = []));
    let best = Infinity;
    for (const it of arr) {
      if (it.noCam) continue;
      const p = it.pts;
      for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        const ax = p[j], az = p[j + 1], bx = p[i], bz = p[i + 1];
        const sx = bx - ax, sz = bz - az;
        const den = d.x * sz - d.z * sx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((ax - o.x) * sz - (az - o.z) * sx) / den;
        const u = ((ax - o.x) * d.z - (az - o.z) * d.x) / den;
        if (t < 0 || t > maxDist || u < 0 || u > 1 || t >= best) continue;
        const y = o.y + d.y * t;
        if (y >= it.base && y <= it.top + (it.roof || 0)) best = t;
      }
    }
    return best;
  }
}

// ---------------------------------------------------------------------------
function facadeTexture() {
  // One storey bay: 2.4 m wide, 2.9 m tall. RGB is the final colour of frames and
  // glass; alpha says how much the building's own colour tints it (1 = cladding).
  const W = 128, H = 160;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const R = rng(3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4;
    // horizontal boards
    const board = (y % 11);
    const v = board === 10 ? 170 : board === 9 ? 215 : 238 + Math.floor(R() * 10);
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
    img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // window: centred, sill at 0.9 m, 1.3 m tall, 0.95 m wide (y measured from the top of the bay)
  const sx = W / 2.4, sy = H / 2.9;
  const wx = (2.4 - 0.95) / 2 * sx, ww = 0.95 * sx, wy = (2.9 - 0.9 - 1.3) * sy, wh = 1.3 * sy;
  const frame = 0.11 * sx;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(244,243,238,1)';   // alpha 1 here, fixed below
  g.fillRect(wx - frame, wy - frame, ww + frame * 2, wh + frame * 2);
  const grd = g.createLinearGradient(0, wy, 0, wy + wh);
  grd.addColorStop(0, '#9fb3bf'); grd.addColorStop(0.45, '#5f7482'); grd.addColorStop(1, '#3a4853');
  g.fillStyle = grd; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = '#f4f3ee';
  g.fillRect(wx + ww / 2 - frame / 3, wy, frame * 0.66, wh);
  g.fillRect(wx, wy + wh * 0.3, ww, frame * 0.66);
  g.fillRect(wx - frame * 1.6, wy + wh + frame, ww + frame * 3.2, frame * 0.9);
  // Alpha marks what the building colour tints (255 cladding, 0 window). A canvas
  // would wipe the colour of fully transparent pixels, so build the data by hand,
  // bottom row first.
  const src = g.getImageData(0, 0, W, H).data;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inWin = x >= wx - frame * 1.6 && x <= wx + ww + frame * 1.6 && y >= wy - frame && y <= wy + wh + frame * 1.9;
    const si = (y * W + x) * 4, di = ((H - 1 - y) * W + x) * 4;
    data[di] = src[si]; data[di + 1] = src[si + 1]; data[di + 2] = src[si + 2];
    data[di + 3] = inWin ? 0 : 255;
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function tintedFacadeMaterial(tex) {
  const m = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.82 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 texelColor = texture2D( map, vMapUv );
        #endif`)
      .replace('#include <color_fragment>', `
        #ifdef USE_MAP
          diffuseColor.rgb = mix(texelColor.rgb, texelColor.rgb * vColor.rgb, texelColor.a);
        #endif`);
  };
  m.customProgramCacheKey = () => 'tintedFacade';
  return m;
}

function detailTexture(size, seed, base, amp) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size), R = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const v = base + (R() - 0.5) * amp;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < size; k++) {
    g.fillStyle = `rgba(0,0,0,${R() * 0.12})`;
    g.beginPath(); g.arc(R() * size, R() * size, 1 + R() * size * 0.04, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function stepsTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a96'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#5f605e'; g.fillRect(0, 0, 64, 10);
  g.fillStyle = '#b4b4ae'; g.fillRect(0, 10, 64, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------
export function buildCity(scene, map, T, opts) {
  const terrain = new Terrain(map);
  const polys = new PolyWorld(16);
  const geo = new Geo();
  const col = new THREE.Color();
  const carve = opts.carve;       // (x,z) => lowered height or null: only for the rendered mesh

  // -------------------------------------------------------------- terrain mesh (fine)
  {
    const g = map.terrain, nx = g.nx, nz = g.nz;
    const pos = new Float32Array(nx * nz * 3), colr = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
    const R = rng(5);
    const C = {
      0: new THREE.Color(0x5d6a4c), 1: new THREE.Color(0x56733d), 2: new THREE.Color(0x3a5530), 3: new THREE.Color(0x77777a), 4: new THREE.Color(0x2e4652),
    };
    const centre = new THREE.Color(0x707173), rock = new THREE.Color(0x6b6a66);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = g.x0 + i * g.step, z = g.z0 + j * g.step;
      let h = map.terrH[k] * g.scale;
      const cv = carve(x, z);
      if (cv !== null && h > cv) h = cv;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      uv[k * 2] = x / 3; uv[k * 2 + 1] = z / 3;
      const cl = map.groundCls[k];
      col.copy(C[cl] || C[0]);
      if (cl === 0 && x < -230) col.copy(centre);            // the city centre is paved
      // steep ground shows rock
      const hx = map.terrH[Math.min(k + 1, j * nx + nx - 1)] - map.terrH[Math.max(k - 1, j * nx)];
      const hz = map.terrH[Math.min(k + nx, (nz - 1) * nx + i)] - map.terrH[Math.max(k - nx, i)];
      const slope = Math.hypot(hx, hz) * g.scale / (2 * g.step);
      if (slope > 0.9 && cl !== 3) col.lerp(rock, Math.min(1, (slope - 0.9) * 1.5));
      const n = 0.92 + R() * 0.16;
      colr[k * 3] = col.r * n; colr[k * 3 + 1] = col.g * n; colr[k * 3 + 2] = col.b * n;
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bg.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    bg.setIndex(idx);
    bg.computeVertexNormals();
    // split into ~150 m tiles so the camera can skip what it cannot see
    const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTexture(256, 9, 200, 70), roughness: 0.9 });
    const nrm = bg.attributes.normal.array, TS = 60;
    for (let tj = 0; tj < nz - 1; tj += TS) for (let ti = 0; ti < nx - 1; ti += TS) {
      const i1 = Math.min(nx - 1, ti + TS), j1 = Math.min(nz - 1, tj + TS), w = i1 - ti + 1, h = j1 - tj + 1;
      const P = new Float32Array(w * h * 3), N = new Float32Array(w * h * 3), Cc = new Float32Array(w * h * 3), U = new Float32Array(w * h * 2);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const src = (tj + j) * nx + ti + i, dst = j * w + i;
        for (let k = 0; k < 3; k++) { P[dst * 3 + k] = pos[src * 3 + k]; N[dst * 3 + k] = nrm[src * 3 + k]; Cc[dst * 3 + k] = colr[src * 3 + k]; }
        U[dst * 2] = uv[src * 2]; U[dst * 2 + 1] = uv[src * 2 + 1];
      }
      const ix = [];
      for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i, b = a + 1, c = a + w, d = c + 1; ix.push(a, c, b, b, c, d); }
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(P, 3));
      tg.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      tg.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
      tg.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      tg.setIndex(ix);
      tg.computeBoundingSphere();
      const m = new THREE.Mesh(tg, tmat);
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      scene.add(m);
    }
  }

  // -------------------------------------------------------------- distant terrain (coarse)
  {
    const g = map.coarse, nx = g.nx, nz = g.nz, f = map.terrain;
    const fx0 = f.x0 + 40, fx1 = f.x0 + (f.nx - 1) * f.step - 40, fz0 = f.z0 + 40, fz1 = f.z0 + (f.nz - 1) * f.step - 40;
    const pos = new Float32Array(nx * nz * 3), colr = new Float32Array(nx * nz * 3);
    const R = rng(8);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = g.x0 + i * g.step, z = g.z0 + j * g.step;
      let h = map.coarseH[k] * g.scale;
      if (x > fx0 && x < fx1 && z > fz0 && z < fz1) h -= 30;     // hidden under the detailed terrain
      pos[k * 3] = x; pos[k * 3 + 1] = Math.max(h, -30); pos[k * 3 + 2] = z;
      const t = R() * 0.06;
      if (h > 470) col.setRGB(0.88 + t, 0.9 + t, 0.92 + t);          // first snow on the tops
      else if (h > 330) col.setRGB(0.45 + t, 0.45 + t, 0.42 + t);
      else if (h > 12) col.setRGB(0.2 + t, 0.3 + t, 0.17 + t);
      else col.setRGB(0.36 + t, 0.37 + t, 0.36 + t);
      colr[k * 3] = col.r; colr[k * 3 + 1] = col.g; colr[k * 3 + 2] = col.b;
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bg.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    bg.setIndex(idx);
    bg.computeVertexNormals();
    scene.add(new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));
    // conifers on the mountain sides
    const treeGeo = new THREE.ConeGeometry(3, 10, 5); treeGeo.translate(0, 5, 0);
    const inst = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: 0x23361f, roughness: 1, flatShading: true }), 3000);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0;
    for (let tries = 0; tries < 30000 && n < 3000; tries++) {
      const x = g.x0 + R() * (nx - 1) * g.step, z = g.z0 + R() * (nz - 1) * g.step;
      if (x > fx0 - 60 && x < fx1 + 60 && z > fz0 - 60 && z < fz1 + 60) continue;
      const h = terrain.height(x, z);
      if (h < 15 || h > 360) continue;
      const k = 0.7 + R() * 0.8;
      m4.compose(p.set(x, h - 1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), s.set(k, k * (0.8 + R() * 0.5), k));
      inst.setMatrixAt(n++, m4);
    }
    inst.count = n;
    scene.add(inst);
  }

  // -------------------------------------------------------------- water (Vågen)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: 0x4a6b78, roughness: 0.18, metalness: 0.15 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.15;
  water.receiveShadow = true;
  scene.add(water);

  // -------------------------------------------------------------- buildings
  const facade = tintedFacadeMaterial(facadeTexture());
  facade.map.repeat.set(1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: T.roof.clone(), roughness: 0.6 });
  roofMat.map.repeat.set(1, 1); roofMat.map.needsUpdate = true;
  const flatRoofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const tiles = new Map();
  const tileOf = (x, z) => {
    const k = Math.floor(x / 150) * 1000 + Math.floor(z / 150);
    if (!tiles.has(k)) tiles.set(k, { bp: { p: [], n: [], u: [], c: [] }, rp: { p: [], n: [], u: [], c: [] }, fp: { p: [], n: [], c: [] } });
    return tiles.get(k);
  };
  let bp, rp, fp;
  const pushTri = (dst, a, b, c, n, ua, ub, uc, colr) => {
    for (const [P, U] of [[a, ua], [b, ub], [c, uc]]) {
      dst.p.push(P[0], P[1], P[2]); dst.n.push(n[0], n[1], n[2]);
      if (dst.u) dst.u.push(U[0], U[1]);
      dst.c.push(colr.r, colr.g, colr.b);
    }
  };
  const quad = (dst, a, b, c, d, n, uv, colr) => {
    // ensure the winding faces n
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { [b, d] = [d, b]; uv = [uv[0], uv[3], uv[2], uv[1]]; }
    pushTri(dst, a, b, c, n, uv[0], uv[1], uv[2], colr);
    pushTri(dst, a, c, d, n, uv[0], uv[2], uv[3], colr);
  };
  const named = [];
  for (const b of map.buildings) {
    const pts = b.p, n = pts.length / 2;
    ({ bp, rp, fp } = tileOf(pts[0], pts[1]));
    let area2 = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; area2 += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]; }
    const sgn = area2 > 0 ? 1 : -1;
    col.set(b.c);
    const top = b.t, base = b.b;
    let along = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = pts[i * 2], az = pts[i * 2 + 1], bx = pts[j * 2], bz = pts[j * 2 + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.05) continue;
      // outward normal (polygon winding known from the signed area)
      const nx = (bz - az) / len * sgn, nz = -(bx - ax) / len * sgn;
      const u0 = along / 2.4, u1 = (along + len) / 2.4;
      // keep whole windows: snap the repeat to the edge length
      const bays = Math.max(1, Math.round(len / 2.4));
      // v runs downwards from the eaves so the top storey's windows sit under the roof
      const v1 = (base - top) / 2.9;
      quad(bp, [ax, top, az], [bx, top, bz], [bx, base, bz], [ax, base, az], [nx, 0, nz],
        [[0, 0], [bays, 0], [bays, v1], [0, v1]], col);
      void u0; void u1;
      along += len;
    }
    // roof
    const rc = new THREE.Color(b.rc);
    if (b.g) {
      const g = b.g;
      const c = [[g[0], g[1]], [g[2], g[3]], [g[4], g[5]], [g[6], g[7]]];
      const l01 = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]), l12 = Math.hypot(c[2][0] - c[1][0], c[2][1] - c[1][1]);
      // ridge runs along the long side
      const [p0, p1, p2, p3] = l01 >= l12 ? c : [c[1], c[2], c[3], c[0]];
      const short = Math.min(l01, l12);
      const rise = b.k === 'bryggen' ? Math.min(7.5, short / 2 * Math.tan(0.95)) : Math.min(5.5, short / 2 * Math.tan(0.66));
      const m03 = [(p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2], m12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      const ov = 0.35;
      const ex = (p, q) => { const dx = p[0] - q[0], dz = p[1] - q[1], l = Math.hypot(dx, dz) || 1; return [p[0] + dx / l * ov, p[1] + dz / l * ov]; };
      // slight overhang at the eaves
      const e0 = ex(p0, p3), e1 = ex(p1, p2), e2 = ex(p2, p1), e3 = ex(p3, p0);
      const R0 = [m03[0], top + rise, m03[1]], R1 = [m12[0], top + rise, m12[1]];
      const E0 = [e0[0], top - 0.25, e0[1]], E1 = [e1[0], top - 0.25, e1[1]], E2 = [e2[0], top - 0.25, e2[1]], E3 = [e3[0], top - 0.25, e3[1]];
      const nrm = (a, b2, c2) => {
        const v1 = new THREE.Vector3(b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]), v2 = new THREE.Vector3(c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]);
        const v = v1.cross(v2).normalize(); if (v.y < 0) v.negate(); return [v.x, v.y, v.z];
      };
      const sl = Math.hypot(short / 2 + ov, rise);
      const lenR = Math.max(l01, l12);
      quad(rp, E0, E1, R1, R0, nrm(E0, E1, R1), [[0, 0], [lenR, 0], [lenR, sl], [0, sl]], rc);
      quad(rp, E3, E2, R1, R0, nrm(E3, E2, R1), [[0, 0], [lenR, 0], [lenR, sl], [0, sl]], rc);
      // gable ends in the wall colour
      for (const [a, b2, mm] of [[p0, p3, m03], [p1, p2, m12]]) {
        const A = [a[0], top, a[1]], B = [b2[0], top, b2[1]], M = [mm[0], top + rise, mm[1]];
        const dx = b2[0] - a[0], dz = b2[1] - a[1], l = Math.hypot(dx, dz) || 1;
        const cxm = (p0[0] + p1[0] + p2[0] + p3[0]) / 4, czm = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
        let nx = dz / l, nz = -dx / l;
        if ((mm[0] - cxm) * nx + (mm[1] - czm) * nz < 0) { nx = -nx; nz = -nz; }
        pushTri(bp, A, B, M, [nx, 0, nz], [0, -0.08], [0.02, -0.08], [0.01, -0.05], col);
        pushTri(bp, A, M, B, [-nx, 0, -nz], [0, -0.08], [0.01, -0.05], [0.02, -0.08], col);
      }
      polys.add(Float32Array.from(pts), base, top, { roof: rise, kind: 'house' });
    } else {
      // flat roof
      const contour = [];
      for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(pts[i * 2], pts[i * 2 + 1]));
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      for (const [a, b2, c2] of tris) {
        const A = [pts[a * 2], top, pts[a * 2 + 1]], B = [pts[b2 * 2], top, pts[b2 * 2 + 1]], Cc = [pts[c2 * 2], top, pts[c2 * 2 + 1]];
        // face up
        const e1x = B[0] - A[0], e1z = B[2] - A[2], e2x = Cc[0] - A[0], e2z = Cc[2] - A[2];
        const up = e1z * e2x - e1x * e2z;   // y of cross product
        for (const P of up > 0 ? [A, B, Cc] : [A, Cc, B]) { fp.p.push(...P); fp.n.push(0, 1, 0); fp.c.push(rc.r, rc.g, rc.b); }
      }
      polys.add(Float32Array.from(pts), base, top, { roof: 0, kind: 'flat', walk: true });
    }
    if (b.k === 'church') {
      // a tower at the west end of the church
      let wi = 0;
      for (let i = 1; i < n; i++) if (pts[i * 2] < pts[wi * 2]) wi = i;
      const tx = pts[wi * 2] + 4.5, tz = pts[wi * 2 + 1];
      geo.box(opts.stone, tx - 3.5, base, tz - 3.5, tx + 3.5, top + 14, tz + 3.5);
      geo.geom(opts.copper, new THREE.ConeGeometry(5.2, 12, 4), new THREE.Matrix4().makeRotationY(Math.PI / 4).premultiply(new THREE.Matrix4().makeTranslation(tx, top + 20, tz)));
      polys.add(Float32Array.from([tx - 3.5, tz - 3.5, tx + 3.5, tz - 3.5, tx + 3.5, tz + 3.5, tx - 3.5, tz + 3.5]), base, top + 14, {});
    }
    if (b.n) named.push(b);
  }
  const mk = (src, mat, hasUv = true) => {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(src.p, 3));
    bg.setAttribute('normal', new THREE.Float32BufferAttribute(src.n, 3));
    if (hasUv) bg.setAttribute('uv', new THREE.Float32BufferAttribute(src.u, 2));
    bg.setAttribute('color', new THREE.Float32BufferAttribute(src.c, 3));
    bg.computeBoundingSphere();
    const m = new THREE.Mesh(bg, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    scene.add(m);
    return m;
  };
  for (const t of tiles.values()) {
    if (t.bp.p.length) mk(t.bp, facade);
    if (t.rp.p.length) mk(t.rp, roofMat);
    if (t.fp.p.length) mk(t.fp, flatRoofMat, false);
  }

  // -------------------------------------------------------------- roads, lanes, steps
  const roadMats = {
    road: new THREE.MeshStandardMaterial({ color: 0x45474b, roughness: 0.42, map: detailTexture(128, 21, 190, 60) }),
    sett: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, map: T.cobble.clone() }),
    foot: new THREE.MeshStandardMaterial({ color: 0x8b8a86, roughness: 0.6, map: detailTexture(128, 22, 210, 40) }),
    side: new THREE.MeshStandardMaterial({ color: 0x8f8e8a, roughness: 0.55, map: detailTexture(128, 23, 215, 30) }),
    ped: new THREE.MeshStandardMaterial({ color: 0xa29d93, roughness: 0.55, map: T.slab.clone() }),
    steps: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, map: stepsTexture() }),
  };
  roadMats.sett.map.repeat.set(1 / 2.4, 1 / 2.4); roadMats.sett.map.needsUpdate = true;
  roadMats.ped.map.repeat.set(1 / 2.4, 1 / 2.4); roadMats.ped.map.needsUpdate = true;
  roadMats.road.map.repeat.set(1 / 4, 1 / 4);
  roadMats.foot.map.repeat.set(1 / 3, 1 / 3);
  roadMats.side.map.repeat.set(1 / 3, 1 / 3);
  const order = { road: 1, sett: 2, ped: 3, side: 4, foot: 5, steps: 6 };
  for (const k in roadMats) {
    roadMats[k].polygonOffset = true;
    roadMats[k].polygonOffsetFactor = -1 - order[k];
    roadMats[k].polygonOffsetUnits = -2 - order[k] * 2;
  }
  const stepsMask = new Map();          // 1 m cells on steps
  const roadMask = new Map();           // 2 m cells on any road
  const rgTiles = new Map();
  const rgOf = (x, z, k) => {
    const key = Math.floor(x / 150) * 1000 + Math.floor(z / 150) + ':' + k;
    if (!rgTiles.has(key)) rgTiles.set(key, { k, p: [], n: [], u: [] });
    return rgTiles.get(key);
  };
  for (const r of map.roads) {
    const p = r.p, w = r.w / 2;
    // resample
    const pts = [];
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
      const l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(l / 2));
      for (let s = 0; s < n; s++) pts.push([ax + (bx - ax) * s / n, az + (bz - az) * s / n]);
    }
    pts.push([p[p.length - 2], p[p.length - 1]]);
    const g = rgOf(p[0], p[1], r.k);
    let dist = 0;
    let prevL = null, prevR = null, prevD = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const [x, z] = pts[i];
      if (i > 0) dist += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      const lx = x - dz * w, lz = z + dx * w, rx = x + dz * w, rz = z - dx * w;
      const L = [lx, terrain.height(lx, lz) + 0.07, lz], Rr = [rx, terrain.height(rx, rz) + 0.07, rz];
      // keep the cross-section level-ish so narrow lanes do not tilt into the hillside
      const mid = terrain.height(x, z) + 0.07;
      L[1] = Math.max(L[1] * 0.3 + mid * 0.7, mid - 0.4); Rr[1] = Math.max(Rr[1] * 0.3 + mid * 0.7, mid - 0.4);
      if (prevL) {
        const vs = r.k === 'steps' ? 1 / 0.32 : 1;
        const u0 = r.k === 'steps' ? [0, prevD * vs] : [prevL[0], prevL[2]];
        void u0;
        const uv = r.k === 'steps'
          ? [[0, prevD * vs], [1, prevD * vs], [1, dist * vs], [0, dist * vs]]
          : [[prevL[0], prevL[2]], [prevR[0], prevR[2]], [Rr[0], Rr[2]], [L[0], L[2]]];
        const P = [prevL, prevR, Rr, L];
        const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const nl = Math.hypot(...n) || 1;
        let N = n.map(v => v / nl);
        let Q = P, UV = uv;
        if (N[1] < 0) { Q = [P[0], P[3], P[2], P[1]]; UV = [uv[0], uv[3], uv[2], uv[1]]; N = N.map(v => -v); }
        for (const t of [[0, 1, 2], [0, 2, 3]]) for (const q of t) { g.p.push(...Q[q]); g.n.push(...N); g.u.push(...UV[q]); }
      }
      prevL = L; prevR = Rr; prevD = dist;
      // masks
      const steps = r.k === 'steps';
      for (let s = -w; s <= w + 0.01; s += 1) {
        const mx = x - dz * s, mz = z + dx * s;
        if (steps) stepsMask.set(Math.round(mx) * 100003 + Math.round(mz), 1);
        roadMask.set(Math.round(mx / 2) * 100003 + Math.round(mz / 2), r.k);
      }
    }
  }
  for (const g of rgTiles.values()) {
    if (!g.p.length) continue;
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
    bg.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
    bg.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2));
    bg.computeBoundingSphere();
    const m = new THREE.Mesh(bg, roadMats[g.k]);
    m.receiveShadow = true;
    m.renderOrder = 1;
    m.matrixAutoUpdate = false;
    scene.add(m);
  }
  const onSteps = (x, z) => stepsMask.has(Math.round(x) * 100003 + Math.round(z));
  const onRoad = (x, z) => roadMask.get(Math.round(x / 2) * 100003 + Math.round(z / 2));

  // -------------------------------------------------------------- trees
  {
    const R = rng(31);
    const spots = [];
    for (let i = 0; i < map.trees.length; i += 2) spots.push([map.trees[i], map.trees[i + 1]]);
    // gardens and slopes on the hillside: add trees where nothing else is
    const g = map.terrain;
    for (let k = 0; k < 2600 && spots.length < 1100; k++) {
      const x = g.x0 + R() * (g.nx - 1) * g.step, z = g.z0 + R() * (g.nz - 1) * g.step;
      const cl = terrain.cls(x, z);
      if (!(cl === 1 || cl === 2 || (cl === 0 && x > -150))) continue;
      if (R() < (cl === 2 ? 0.1 : 0.55)) continue;
      if (onRoad(x, z) || onRoad(x + 2, z) || onRoad(x - 2, z) || onRoad(x, z + 2) || onRoad(x, z - 2)) continue;
      if (polys.query(x - 2, z - 2, x + 2, z + 2).length) continue;
      if (opts.keepClear(x, z)) continue;
      spots.push([x, z]);
    }
    const trunkG = new THREE.CylinderGeometry(0.14, 0.22, 3.2, 6); trunkG.translate(0, 1.6, 0);
    const crownG = new THREE.IcosahedronGeometry(1.8, 0); crownG.translate(0, 4.2, 0);
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 }), spots.length);
    const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pp = new THREE.Vector3();
    const greens = [0x4f7037, 0x3f6233, 0x5a7a3c, 0x6b8a3e, 0x445f2e];
    spots.forEach(([x, z], i) => {
      const k = 0.7 + R() * 0.7;
      m4.compose(pp.set(x, terrain.height(x, z) - 0.1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), s.set(k, k * (0.85 + R() * 0.4), k));
      trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4);
      crowns.setColorAt(i, col.set(greens[Math.floor(R() * greens.length)]));
      polys.add(Float32Array.from([x - 0.25, z - 0.25, x + 0.25, z - 0.25, x + 0.25, z + 0.25, x - 0.25, z + 0.25]), terrain.height(x, z) - 1, terrain.height(x, z) + 3 * k, { tree: true, noCam: true });
    });
    trunks.castShadow = crowns.castShadow = true;
    scene.add(trunks, crowns);
  }

  // -------------------------------------------------------------- Fløibanen
  const fl = map.funicular;
  const fpts = [];
  for (let i = 0; i < fl.length; i += 2) fpts.push(new THREE.Vector3(fl[i], terrain.height(fl[i], fl[i + 1]) + 0.8, fl[i + 1]));
  const funiCurve = new THREE.CatmullRomCurve3(fpts, false, 'centripetal');
  const track = new THREE.Mesh(new THREE.TubeGeometry(funiCurve, 400, 1.1, 4, false), new THREE.MeshStandardMaterial({ color: 0x55524c, roughness: 0.9 }));
  track.receiveShadow = true;
  scene.add(track);
  const cars = [];
  for (const c of [0x2f6db5, 0xc4312a]) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 11), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));
    body.position.y = 1.9; body.castShadow = true;
    const win = new THREE.Mesh(new THREE.BoxGeometry(3.05, 1.1, 10), new THREE.MeshStandardMaterial({ color: 0x1b2730, roughness: 0.1, metalness: 0.5 }));
    win.position.y = 2.5;
    car.add(body, win);
    scene.add(car);
    cars.push(car);
  }
  // Fløien Folkerestaurant at the top station
  {
    const top = fpts[fpts.length - 1];
    const rest = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 12), new THREE.MeshStandardMaterial({ color: 0xeeede6, roughness: 0.8 }));
    rest.position.set(top.x + 14, top.y + 3, top.z + 6);
    const rr = new THREE.Mesh(new THREE.ConeGeometry(14, 5, 4), new THREE.MeshStandardMaterial({ color: 0x3a2d28 }));
    rr.position.set(top.x + 14, top.y + 9.5, top.z + 6); rr.rotation.y = Math.PI / 4; rr.scale.set(1, 1, 0.6);
    scene.add(rest, rr);
  }
  // Ulriken's TV tower
  {
    const ux = 2937, uz = 1735, uh = terrain.height(ux, uz);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3.5, 70, 8), new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.6 }));
    mast.position.set(ux, uh + 35, uz);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 30, 6), new THREE.MeshStandardMaterial({ color: 0xb52a1d, emissive: 0x5a0f08 }));
    tip.position.set(ux, uh + 85, uz);
    scene.add(mast, tip);
  }

  geo.build(scene);

  return { terrain, polys, funiCurve, cars, onSteps, onRoad, named };
}
