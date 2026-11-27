// The real neighbourhood, built from map data (OpenStreetMap buildings and
// streets, Kartverket terrain) that tools/build_map.py packs into public/data.
import * as THREE from '../vendor/three.module.min.js';
import { Geo } from './engine.js';
import { rng } from './textures.js';
import { buildBuildings } from './buildings.js';

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
    // courtyards: every ring (outline first, then holes) as flat [x, z, ...] arrays
    it.rings = data.holes && data.holes.length ? [pts, ...data.holes.map(h => Float32Array.from(h))] : null;
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
  // inside the footprint, courtyards excluded
  static insideItem(it, x, z) {
    if (!it.rings) return PolyWorld.inside(it.pts, x, z);
    let c = false;
    for (const r of it.rings) if (PolyWorld.inside(r, x, z)) c = !c;
    return c;
  }
  static nearestItem(it, x, z, out) {
    if (!it.rings) return PolyWorld.nearest(it.pts, x, z, out);
    let bd = Infinity;
    const tmp = { x: 0, z: 0 };
    for (const r of it.rings) { const d = PolyWorld.nearest(r, x, z, tmp); if (d < bd) { bd = d; out.x = tmp.x; out.z = tmp.z; } }
    return bd;
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
      const d = PolyWorld.nearestItem(it, pos.x, pos.z, np);
      const ins = PolyWorld.insideItem(it, pos.x, pos.z);
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
      if (it.walk && it.top <= y + step && it.top > best && PolyWorld.insideItem(it, x, z)) best = it.top;
    }
    return best;
  }
  raycast(o, d, maxDist) {
    const ex = o.x + d.x * maxDist, ez = o.z + d.z * maxDist;
    const arr = this.query(Math.min(o.x, ex), Math.min(o.z, ez), Math.max(o.x, ex), Math.max(o.z, ez), this._q3 || (this._q3 = []));
    let best = Infinity;
    for (const it of arr) {
      if (it.noCam) continue;
      for (const p of it.rings || [it.pts]) {
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
    }
    return best;
  }
  // 2D distance from (x, z) along (dx, dz) to the first building wall (0 inside a building)
  clearance(x, z, dx, dz, maxd) {
    const ex = x + dx * maxd, ez = z + dz * maxd;
    let best = maxd;
    for (const it of this.query(Math.min(x, ex), Math.min(z, ez), Math.max(x, ex), Math.max(z, ez), this._q4 || (this._q4 = []))) {
      if (it.tree || it.noCam || it.el) continue;
      if (PolyWorld.insideItem(it, x, z)) return 0;
      for (const p of it.rings || [it.pts]) {
        for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
          const ax = p[j], az = p[j + 1], sx = p[i] - ax, sz = p[i + 1] - az;
          const den = dx * sz - dz * sx;
          if (Math.abs(den) < 1e-9) continue;
          const t = ((ax - x) * sz - (az - z) * sx) / den;
          const u = ((ax - x) * dz - (az - z) * dx) / den;
          if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
        }
      }
    }
    return best;
  }
  // is any building wall within r of (x, z)?
  nearBuilding(x, z, r) {
    const np = { x: 0, z: 0 };
    for (const it of this.query(x - r, z - r, x + r, z + r, this._q5 || (this._q5 = []))) {
      if (it.tree || it.noCam || it.el) continue;
      if (PolyWorld.insideItem(it, x, z) || PolyWorld.nearestItem(it, x, z, np) < r) return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
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
    const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTexture(256, 9, 200, 70), roughness: 0.9 });
    const nrm = bg.attributes.normal.array, TS = 40;
    // contact shadow: darken the ground next to buildings (baked ambient occlusion from the outlines)
    {
      const cover = new Uint8Array(nx * nz);
      for (const b of map.buildings) {
        if (b.el) continue;
        const p = b.p;
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (let k = 0; k < p.length; k += 2) { x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); z0 = Math.min(z0, p[k + 1]); z1 = Math.max(z1, p[k + 1]); }
        for (let jj = Math.max(0, Math.floor((z0 - g.z0) / g.step)); jj <= Math.min(nz - 1, Math.ceil((z1 - g.z0) / g.step)); jj++)
          for (let ii = Math.max(0, Math.floor((x0 - g.x0) / g.step)); ii <= Math.min(nx - 1, Math.ceil((x1 - g.x0) / g.step)); ii++)
            if (PolyWorld.inside(p, g.x0 + ii * g.step, g.z0 + jj * g.step)) cover[jj * nx + ii] = 1;
      }
      for (let jj = 2; jj < nz - 2; jj++) for (let ii = 2; ii < nx - 2; ii++) {
        const k = jj * nx + ii;
        if (cover[k]) continue;
        let c = 0;
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) c += cover[k + dj * nx + di] * (Math.abs(di) <= 1 && Math.abs(dj) <= 1 ? 2 : 1);
        if (!c) continue;
        const f = 1 - Math.min(0.42, c / 34 * 0.9);
        colr[k * 3] *= f; colr[k * 3 + 1] *= f; colr[k * 3 + 2] *= f;
      }
    }
    // Tiles of 100 m with three levels of detail (2.5, 5 and 10 m between vertices), each with a
    // skirt hanging down from its edges so the seams between levels never open into cracks.
    const tileMesh = (ti, tj, i1, j1, stride) => {
      const cols = [], rows = [];
      for (let i = ti; i < i1; i += stride) cols.push(i); cols.push(i1);
      for (let j = tj; j < j1; j += stride) rows.push(j); rows.push(j1);
      const w = cols.length, h = rows.length, nv = w * h + 2 * (w + h) * 1;
      const P = [], N = [], Cc = [], U = [], ix = [];
      for (const j of rows) for (const i of cols) {
        const src = j * nx + i;
        P.push(pos[src * 3], pos[src * 3 + 1], pos[src * 3 + 2]); N.push(nrm[src * 3], nrm[src * 3 + 1], nrm[src * 3 + 2]);
        Cc.push(colr[src * 3], colr[src * 3 + 1], colr[src * 3 + 2]); U.push(uv[src * 2], uv[src * 2 + 1]);
      }
      for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i, b = a + 1, c = a + w, d = c + 1; ix.push(a, c, b, b, c, d); }
      // skirts
      const edge = (list, inward) => {
        const base = P.length / 3;
        for (const v of list) { P.push(P[v * 3], P[v * 3 + 1] - 3, P[v * 3 + 2]); N.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); Cc.push(Cc[v * 3] * 0.7, Cc[v * 3 + 1] * 0.7, Cc[v * 3 + 2] * 0.7); U.push(U[v * 2], U[v * 2 + 1]); }
        for (let k = 0; k < list.length - 1; k++) {
          const a = list[k], b = list[k + 1], c = base + k, d = base + k + 1;
          ix.push(a, c, b, b, c, d, a, b, c, b, d, c);     // both sides: cheap and never wrong
          void inward;
        }
      };
      edge(cols.map((_, i) => i), true);                                   // top row
      edge(cols.map((_, i) => (h - 1) * w + i), false);                    // bottom row
      edge(rows.map((_, j) => j * w), false);                              // left column
      edge(rows.map((_, j) => j * w + w - 1), true);                       // right column
      void nv;
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      tg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      tg.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
      tg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      tg.setIndex(ix);
      tg.computeBoundingSphere();
      const m = new THREE.Mesh(tg, tmat);
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      tmat.side = THREE.FrontSide;
      return m;
    };
    for (let tj = 0; tj < nz - 1; tj += TS) for (let ti = 0; ti < nx - 1; ti += TS) {
      const i1 = Math.min(nx - 1, ti + TS), j1 = Math.min(nz - 1, tj + TS);
      const cx = g.x0 + (ti + i1) / 2 * g.step, cz = g.z0 + (tj + j1) / 2 * g.step;
      const lod = new THREE.LOD();
      lod.position.set(cx, 0, cz);
      for (const [stride, dist] of [[1, 0], [2, 110], [4, 260]]) {
        const m = tileMesh(ti, tj, i1, j1, stride);
        m.position.set(-cx, 0, -cz); m.updateMatrix();
        lod.addLevel(m, dist);
      }
      scene.add(lod);
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
  // a tiling normal map of small waves (sum of sines, so it wraps seamlessly)
  const waveTex = (() => {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S);
    const H = (x, y) => {
      let h = 0;
      for (const [fx, fy, a, ph] of [[1, 2, 1, 0.3], [3, -1, 0.6, 1.1], [-2, 3, 0.5, 2.0], [5, 4, 0.25, 0.7], [-6, 5, 0.2, 2.6], [7, -8, 0.12, 1.9]])
        h += a * Math.sin((fx * x + fy * y) * Math.PI * 2 / S + ph);
      return h;
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = H(x + 1, y) - H(x - 1, y), dy = H(x, y + 1) - H(x, y - 1);
      const n = new THREE.Vector3(-dx * 3, -dy * 3, 1).normalize();
      const k = (y * S + x) * 4;
      img.data[k] = (n.x * 0.5 + 0.5) * 255; img.data[k + 1] = (n.y * 0.5 + 0.5) * 255; img.data[k + 2] = (n.z * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1300, 1300);
    return t;
  })();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: 0x2f4c58, roughness: 0.06, metalness: 0.0, normalMap: waveTex, normalScale: new THREE.Vector2(0.16, 0.16) }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.15;
  water.receiveShadow = true;
  scene.add(water);

  // -------------------------------------------------------------- buildings, then roads, lanes and steps
  // Street ribbons are draped on the terrain (which tools/build_map.py has levelled across every
  // street) and drawn with the same atlas material as the buildings, merged into the same 100 m
  // tiles (see buildings.js). The kinds are stacked a few centimetres apart instead of using
  // polygon offsets, so one material covers them all. OpenStreetMap only gives a centre line and
  // a typical width, so each side of a street is pulled in where a building wall is closer:
  // a street never runs under a house.
  const LIFT = { road: 0.08, sett: 0.085, ped: 0.09, side: 0.1, foot: 0.11, steps: 0.12 };
  const RSTY = { road: 'asphalt', sett: 'cobble', ped: 'paving', side: 'side', foot: 'foot', steps: 'steps' };
  const stepsMask = new Map();          // 1 m cells on steps
  const roadMask = new Map();           // 2 m cells on any road
  const white = new THREE.Color(1, 1, 1), W4 = [white, white, white, white];
  const buildRoads = (tileOf, STYLE) => {
    for (const r of map.roads) {
      const p = r.p, w = r.w / 2, lift = LIFT[r.k];
      const pts = [];
      for (let i = 0; i < p.length - 2; i += 2) {
        const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
        const l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(l / 1.5));
        for (let s = 0; s < n; s++) pts.push([ax + (bx - ax) * s / n, az + (bz - az) * s / n]);
      }
      pts.push([p[p.length - 2], p[p.length - 1]]);
      // rows every 1.5 m and a vertex about every 1.8 m across, so the surface follows the terrain mesh
      let dist = 0, prev = null, prevD = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let dx = b[0] - a[0], dz = b[1] - a[1];
        const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const [x, z] = pts[i];
        if (i > 0) dist += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
        // pull each side in to 15 cm short of the nearest wall
        const wl = Math.max(0, Math.min(w, polys.clearance(x, z, -dz, dx, w + 0.2) - 0.15));
        const wr = Math.max(0, Math.min(w, polys.clearance(x, z, dz, -dx, w + 0.2) - 0.15));
        if (wl + wr < 0.5) { prev = null; continue; }        // through a building: no street here
        const NC = Math.max(2, Math.ceil(r.w / 1.8));      // the same for every row of a street, so rows pair up
        const row = [];
        for (let k = 0; k <= NC; k++) {
          const o = -wl + (wl + wr) * k / NC, px = x + dz * o, pz = z - dx * o;
          row.push([px, terrain.height(px, pz) + lift, pz, (wl + wr) * k / NC]);
        }
        if (prev) {
          for (let k = 0; k < NC; k++) {
            const P = [prev[k], prev[k + 1], row[k + 1], row[k]];
            const uv = r.k === 'steps'
              ? [[P[0][3], prevD], [P[1][3], prevD], [P[2][3], dist], [P[3][3], dist]]
              : P.map(q => [q[0], q[2]]);
            const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
            const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
            const nl = Math.hypot(...n) || 1;
            let N = n.map(v => v / nl);
            if (N[1] < 0) N = N.map(v => -v);
            tileOf(P[0][0], P[0][2]).roof.quad(P[0], P[1], P[2], P[3], N, W4, uv, STYLE[RSTY[r.k]]);
          }
        }
        prev = row; prevD = dist;
        const steps = r.k === 'steps';
        for (let s = -wl; s <= wr + 0.01; s += 1) {
          const mx = x + dz * s, mz = z - dx * s;
          if (steps) stepsMask.set(Math.round(mx) * 100003 + Math.round(mz), 1);
          roadMask.set(Math.round(mx / 2) * 100003 + Math.round(mz / 2), r.k);
        }
      }
    }
  };
  const { named, lods: buildingLods, facadeMat } = buildBuildings(scene, map, terrain, polys, T, {
    geo, stone: opts.stone, copper: opts.copper, extra: buildRoads,
  });
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

  // -------------------------------------------------------------- walls, fences, hedges (OSM barriers)
  {
    const wallG = new Geo();
    const stoneM = new THREE.MeshStandardMaterial({ color: 0xa9a7a0, roughness: 0.95, map: T.stone.clone() });
    stoneM.map.repeat.set(1 / 2.5, 1 / 2.5); stoneM.map.needsUpdate = true;
    // picket fence: one textured panel per segment, gaps cut out with alpha testing
    const fenceTex = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      for (let i = 0; i < 4; i++) { g.fillStyle = '#f1eee6'; g.fillRect(i * 16 + 2, 4, 10, 60); g.beginPath(); g.moveTo(i * 16 + 2, 4); g.lineTo(i * 16 + 7, 0); g.lineTo(i * 16 + 12, 4); g.fill(); }
      g.fillStyle = '#e4e0d4'; g.fillRect(0, 16, 64, 5); g.fillRect(0, 46, 64, 5);
      const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return t;
    })();
    const fenceM = new THREE.MeshStandardMaterial({ map: fenceTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    fenceM.userData.noCast = false;
    const hedgeM = new THREE.MeshStandardMaterial({ color: 0x3d5a2c, roughness: 1, flatShading: true });
    const railM = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.4, metalness: 0.6 });
    const KIND = { wall: [stoneM, 1.1, 0.35], retaining_wall: [stoneM, 1.0, 0.45], fence: [fenceM, 1.05, 0.06], hedge: [hedgeM, 1.4, 0.8], guard_rail: [railM, 0.75, 0.08] };
    for (const br of map.barriers) {
      const [m, h, w] = KIND[br.k];
      const p = br.p;
      for (let i = 0; i < p.length - 2; i += 2) {
        const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 0.2) continue;
        const nseg = Math.max(1, Math.ceil(L / 3));
        for (let k = 0; k < nseg; k++) {
          const t0 = k / nseg, t1 = (k + 1) / nseg;
          const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
          const g0 = Math.min(terrain.height(x0, z0), terrain.height(x1, z1));
          const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0);
          const top = Math.max(terrain.height(x0, z0), terrain.height(x1, z1)) + h;
          if (br.k === 'fence') {
            const ya = terrain.height(x0, z0), yb = terrain.height(x1, z1), reps = len / 0.64;
            wallG.quad(m, [x0, ya, z0], [x1, yb, z1], [x1, yb + h, z1], [x0, ya + h, z0], [[0, 0], [reps, 0], [reps, 1], [0, 1]], null);
          } else {
            wallG.obox(m, cx, (g0 - 0.6 + top) / 2, cz, len + (br.k === 'hedge' ? 0.3 : 0.02), top - g0 + 0.6, w, 0, Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2, 0);
          }
        }
      }
    }
    // benches (OSM positions), facing the nearest street
    const benchM = new THREE.MeshStandardMaterial({ color: 0x6b4c33, roughness: 0.8 });
    const legM = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.5, metalness: 0.5 });
    for (let i = 0; i < map.benches.length; i += 2) {
      const x = map.benches[i], z = map.benches[i + 1], y = terrain.height(x, z), r = (x * 7 + z * 3) % 6.28;
      wallG.obox(benchM, x, y + 0.45, z, 1.6, 0.06, 0.45, 0, r, 0);
      wallG.obox(benchM, x - Math.sin(r + Math.PI / 2) * 0, y + 0.72, z, 1.6, 0.4, 0.05, 0, r, 0);
      wallG.obox(legM, x, y + 0.22, z, 1.4, 0.44, 0.08, 0, r, 0);
    }
    wallG.build(scene);
  }

  // -------------------------------------------------------------- street lamps and parked cars (instanced)
  {
    const R = rng(55);
    const lampSpots = [];
    for (let i = 0; i < map.lamps.length; i += 2) lampSpots.push([map.lamps[i], map.lamps[i + 1]]);
    // Bergen streets have lamps every 25-30 m: place them along the edges of the bigger streets
    const placed = new Map();
    const near = (x, z) => { const k = Math.round(x / 12) * 100003 + Math.round(z / 12); if (placed.has(k)) return true; placed.set(k, 1); return false; };
    for (const r of map.roads) {
      if (!['road', 'sett', 'ped'].includes(r.k)) continue;
      const p = r.p;
      let acc = 12 + R() * 10, side = 1;
      for (let i = 0; i < p.length - 2; i += 2) {
        const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az);
        if (L < 0.01) continue;
        const dx = (bx - ax) / L, dz = (bz - az) / L;
        for (let t = acc; t < L; t += 28) {
          const off = r.w / 2 + 0.5;
          const x = ax + dx * t - dz * off * side, z = az + dz * t + dx * off * side;
          side = -side;
          if (polys.nearBuilding(x, z, 0.6)) continue;
          if (!near(x, z)) lampSpots.push([x, z]);
          acc = t + 28 - L;
        }
        acc = Math.max(0, acc - L);
      }
    }
    const poleG = new THREE.CylinderGeometry(0.06, 0.09, 4.6, 6); poleG.translate(0, 2.3, 0);
    const headG = new THREE.CylinderGeometry(0.28, 0.18, 0.32, 8); headG.translate(0, 4.65, 0);
    const poles = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.5, metalness: 0.6 }), lampSpots.length);
    const heads = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffd9a0, emissiveIntensity: 1.4 }), lampSpots.length);
    const m4 = new THREE.Matrix4();
    lampSpots.forEach(([x, z], i) => {
      m4.makeTranslation(x, terrain.height(x, z), z);
      poles.setMatrixAt(i, m4); heads.setMatrixAt(i, m4);
      polys.add(Float32Array.from([x - 0.1, z - 0.1, x + 0.1, z - 0.1, x + 0.1, z + 0.1, x - 0.1, z + 0.1]), terrain.height(x, z) - 1, terrain.height(x, z) + 4.6, { noCam: true, tree: true });
    });
    poles.castShadow = true;
    scene.add(poles, heads);

    // parked cars: in OSM car parks and along residential streets in Fjellet and Marken
    const carSpots = [];
    for (const poly of map.parking) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 0; k < poly.length; k += 2) { x0 = Math.min(x0, poly[k]); x1 = Math.max(x1, poly[k]); z0 = Math.min(z0, poly[k + 1]); z1 = Math.max(z1, poly[k + 1]); }
      for (let x = x0 + 1.5; x < x1 - 1.5; x += 2.6) for (let z = z0 + 2.5; z < z1 - 2.5; z += 5.5)
        if (PolyWorld.inside(poly, x, z) && R() < 0.7 && !polys.query(x - 1, z - 1, x + 1, z + 1).length) carSpots.push([x, z, 0]);
    }
    for (const r of map.roads) {
      if (r.k !== 'road' || r.w > 6) continue;
      const p = r.p;
      for (let i = 0; i < p.length - 2; i += 2) {
        const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az);
        if (L < 6) continue;
        const dx = (bx - ax) / L, dz = (bz - az) / L, ang = Math.atan2(dx, dz);
        for (let t = 3; t < L - 3; t += 5.2) {
          if (R() < 0.6) continue;
          const off = r.w / 2 + 0.95;
          const x = ax + dx * t - dz * off, z = az + dz * t + dx * off;
          if (polys.query(x - 1.2, z - 1.2, x + 1.2, z + 1.2).length) continue;
          if (opts.keepClear(x, z)) continue;
          const slope = Math.abs(terrain.height(x + dx * 2, z + dz * 2) - terrain.height(x - dx * 2, z - dz * 2)) / 4;
          if (slope > 0.12) continue;     // nobody parks on the steepest bits
          carSpots.push([x, z, ang]);
        }
      }
    }
    const body = new THREE.BoxGeometry(1.75, 0.7, 4.2); body.translate(0, 0.55, 0);
    const cabin = new THREE.BoxGeometry(1.55, 0.55, 2.2); cabin.translate(0, 1.15, -0.2);
    const carG = new THREE.BufferGeometry();
    {
      const parts = [body, cabin].map(g => g.toNonIndexed());
      const pos = [], nrm = [], col = [];
      parts.forEach((g, pi) => {
        pos.push(...g.attributes.position.array); nrm.push(...g.attributes.normal.array);
        for (let k = 0; k < g.attributes.position.count; k++) col.push(...(pi === 0 ? [1, 1, 1] : [0.25, 0.3, 0.35]));
      });
      carG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      carG.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      carG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    const cars2 = new THREE.InstancedMesh(carG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 }), Math.max(1, carSpots.length));
    const carCols = [0xe8e8e8, 0x1d1f22, 0x8c9196, 0x2c4c7a, 0x7a2e28, 0xc9c9c4, 0x3f5d48, 0x30343a];
    const q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(1, 1, 1), p4 = new THREE.Vector3();
    carSpots.forEach(([x, z, a], i) => {
      m4.compose(p4.set(x, terrain.height(x, z), z), q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), s4);
      cars2.setMatrixAt(i, m4);
      cars2.setColorAt(i, col.set(carCols[Math.floor(R() * carCols.length)]));
      const c = Math.cos(a), sn = Math.sin(a), hw = 0.9, hl = 2.1;
      const pts = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([u, v]) => [x + u * c + v * sn, z - u * sn + v * c]).flat();
      polys.add(Float32Array.from(pts), terrain.height(x, z) - 0.5, terrain.height(x, z) + 1.45, { noCam: true, walk: true });
    });
    cars2.count = carSpots.length;
    cars2.castShadow = true; cars2.receiveShadow = true;
    scene.add(cars2);
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

  return { terrain, polys, funiCurve, cars, onSteps, onRoad, named, buildingLods, water };
}
