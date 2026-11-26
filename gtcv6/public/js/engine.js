// Geometry batching (one mesh per material) and the collision world.
//
// The walkable world is a set of "blocks": rectangles in plan (x0..x1, z0..z1)
// with a bottom height and a top surface given by its four corner heights,
// so a block is either a flat box (floors, walls, furniture) or a ramp
// (the lane, stairs). Characters are vertical cylinders.
import * as THREE from '../vendor/three.module.min.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();

export class Geo {
  constructor() { this.map = new Map(); }
  _g(mat) {
    let g = this.map.get(mat);
    if (!g) { g = { p: [], n: [], u: [] }; this.map.set(mat, g); }
    return g;
  }
  // a,b,c,d: [x,y,z]; uv: [[u,v]x4]; n: intended outward normal (winding is fixed to match)
  quad(mat, a, b, c, d, uv, n) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _c.crossVectors(_a, _b);
    if (n && _c.dot(_n.set(n[0], n[1], n[2])) < 0) {
      [b, d] = [d, b];
      uv = [uv[0], uv[3], uv[2], uv[1]];
    }
    if (!n) { _c.normalize(); n = [_c.x, _c.y, _c.z]; }
    const g = this._g(mat);
    for (const [P, U] of [[a, uv[0]], [b, uv[1]], [c, uv[2]], [a, uv[0]], [c, uv[2]], [d, uv[3]]]) {
      g.p.push(P[0], P[1], P[2]); g.n.push(n[0], n[1], n[2]); g.u.push(U[0], U[1]);
    }
  }
  tri(mat, a, b, c, uv, n) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _c.crossVectors(_a, _b).normalize();
    if (n && _c.dot(_n.set(n[0], n[1], n[2])) < 0) { [b, c] = [c, b]; uv = [uv[0], uv[2], uv[1]]; }
    else if (!n) n = [_c.x, _c.y, _c.z];
    const g = this._g(mat);
    for (const [P, U] of [[a, uv[0]], [b, uv[1]], [c, uv[2]]]) {
      g.p.push(P[0], P[1], P[2]); g.n.push(n[0], n[1], n[2]); g.u.push(U[0], U[1]);
    }
  }
  // Axis-aligned box with world-space UVs (metres). skip: string of faces to omit, e.g. 'ny'
  box(mat, x0, y0, z0, x1, y1, z1, skip = '') {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    if (!skip.includes('px')) this.quad(mat, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]], [1, 0, 0]);
    if (!skip.includes('nx')) this.quad(mat, [x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [[-z1, y0], [-z0, y0], [-z0, y1], [-z1, y1]], [-1, 0, 0]);
    if (!skip.includes('py')) this.quad(mat, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], [0, 1, 0]);
    if (!skip.includes('ny')) this.quad(mat, [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]], [0, -1, 0]);
    if (!skip.includes('pz')) this.quad(mat, [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [[x0, y0], [x0, y1], [x1, y1], [x1, y0]], [0, 0, 1]);
    if (!skip.includes('nz')) this.quad(mat, [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [[-x1, y0], [-x1, y1], [-x0, y1], [-x0, y0]], [0, 0, -1]);
  }
  // Block with a (possibly sloped) top: h00 at (x0,z0), h10 at (x1,z0), h11 at (x1,z1), h01 at (x0,z1)
  prism(mat, x0, x1, z0, z1, h00, h10, h11, h01, bottom, sideMat = mat, skip = '') {
    const top = [[x0, h00, z0], [x1, h10, z0], [x1, h11, z1], [x0, h01, z1]];
    if (!skip.includes('py')) this.quad(mat, top[0], top[1], top[2], top[3], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], [0, 1, 0]);
    const B = bottom;
    if (!skip.includes('nz')) this.quad(sideMat, [x0, B, z0], [x1, B, z0], [x1, h10, z0], [x0, h00, z0], [[-x0, B], [-x1, B], [-x1, h10], [-x0, h00]], [0, 0, -1]);
    if (!skip.includes('pz')) this.quad(sideMat, [x0, B, z1], [x1, B, z1], [x1, h11, z1], [x0, h01, z1], [[x0, B], [x1, B], [x1, h11], [x0, h01]], [0, 0, 1]);
    if (!skip.includes('nx')) this.quad(sideMat, [x0, B, z0], [x0, B, z1], [x0, h01, z1], [x0, h00, z0], [[-z0, B], [-z1, B], [-z1, h01], [-z0, h00]], [-1, 0, 0]);
    if (!skip.includes('px')) this.quad(sideMat, [x1, B, z0], [x1, B, z1], [x1, h11, z1], [x1, h10, z0], [[z0, B], [z1, B], [z1, h11], [z0, h10]], [1, 0, 0]);
  }
  // Oriented box (centre, size, rotation), UVs in local metres
  obox(mat, cx, cy, cz, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const P = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(m); return [v.x, v.y, v.z]; };
    const N = (x, y, z) => { const v = new THREE.Vector3(x, y, z).transformDirection(m); return [v.x, v.y, v.z]; };
    this.quad(mat, P(hx, -hy, -hz), P(hx, -hy, hz), P(hx, hy, hz), P(hx, hy, -hz), [[0, 0], [sz, 0], [sz, sy], [0, sy]], N(1, 0, 0));
    this.quad(mat, P(-hx, -hy, hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(-hx, hy, hz), [[0, 0], [sz, 0], [sz, sy], [0, sy]], N(-1, 0, 0));
    this.quad(mat, P(-hx, hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), P(-hx, hy, hz), [[0, 0], [sx, 0], [sx, sz], [0, sz]], N(0, 1, 0));
    this.quad(mat, P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, -hy, -hz), P(-hx, -hy, -hz), [[0, 0], [sx, 0], [sx, sz], [0, sz]], N(0, -1, 0));
    this.quad(mat, P(-hx, -hy, hz), P(-hx, hy, hz), P(hx, hy, hz), P(hx, -hy, hz), [[0, 0], [0, sy], [sx, sy], [sx, 0]], N(0, 0, 1));
    this.quad(mat, P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, -hz), [[0, 0], [0, sy], [sx, sy], [sx, 0]], N(0, 0, -1));
  }
  // Any three.js geometry, transformed
  geom(mat, geometry, matrix) {
    const g0 = geometry.index ? geometry.toNonIndexed() : geometry;
    const gg = g0.clone();
    if (matrix) gg.applyMatrix4(matrix);
    const g = this._g(mat);
    const p = gg.attributes.position.array, n = gg.attributes.normal.array, u = gg.attributes.uv ? gg.attributes.uv.array : null;
    for (let i = 0; i < p.length / 3; i++) {
      g.p.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      g.n.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
      g.u.push(u ? u[i * 2] : 0, u ? u[i * 2 + 1] : 0);
    }
  }
  build(parent) {
    const meshes = [];
    for (const [mat, g] of this.map) {
      if (!g.p.length) continue;
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
      bg.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
      bg.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2));
      bg.computeBoundingSphere();
      const mesh = new THREE.Mesh(bg, mat);
      mesh.castShadow = !mat.userData.noCast;
      mesh.receiveShadow = !mat.userData.noReceive;
      mesh.matrixAutoUpdate = false;
      if (mat.transparent) mesh.renderOrder = 2;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.map.clear();
    return meshes;
  }
}

// ---------------------------------------------------------------------------

export class World {
  constructor(cell = 6) {
    this.blocks = [];
    this.grid = new Map();
    this.cell = cell;
    this.stamp = 0;
  }
  // b: {x0,x1,z0,z1,bottom,h00,h10,h11,h01, walk, solid, cam, stairs, tag}
  add(b) {
    if (b.x0 > b.x1) [b.x0, b.x1] = [b.x1, b.x0];
    if (b.z0 > b.z1) [b.z0, b.z1] = [b.z1, b.z0];
    if (b.top !== undefined) b.h00 = b.h10 = b.h11 = b.h01 = b.top;
    b.maxTop = Math.max(b.h00, b.h10, b.h11, b.h01);
    b.flat = b.h00 === b.h10 && b.h10 === b.h11 && b.h11 === b.h01;
    if (b.walk === undefined) b.walk = true;
    if (b.solid === undefined) b.solid = true;
    if (b.cam === undefined) b.cam = true;
    b._s = 0;
    b.id = this.blocks.length;
    this.blocks.push(b);
    const c = this.cell;
    for (let i = Math.floor(b.x0 / c); i <= Math.floor(b.x1 / c); i++)
      for (let j = Math.floor(b.z0 / c); j <= Math.floor(b.z1 / c); j++) {
        const k = i * 100003 + j;
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(b);
      }
    return b;
  }
  // Remove a block from collision (used for doors that open)
  setEnabled(b, on) { b.disabled = !on; }
  query(x0, z0, x1, z1, out = []) {
    out.length = 0;
    const s = ++this.stamp, c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const arr = this.grid.get(i * 100003 + j);
        if (!arr) continue;
        for (const b of arr) {
          if (b._s === s || b.disabled) continue;
          b._s = s;
          if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
          out.push(b);
        }
      }
    return out;
  }
  topAt(b, x, z) {
    if (b.flat) return b.h00;
    const tx = Math.min(1, Math.max(0, (x - b.x0) / (b.x1 - b.x0)));
    const tz = Math.min(1, Math.max(0, (z - b.z0) / (b.z1 - b.z0)));
    const a = b.h00 + (b.h10 - b.h00) * tx, c = b.h01 + (b.h11 - b.h01) * tx;
    return a + (c - a) * tz;
  }
  // Highest walkable surface at (x,z) that is at most `step` above y
  floorAt(x, z, y, step = 0.45, info) {
    let best = -Infinity, bb = null;
    for (const b of this.query(x, z, x, z, this._q1 || (this._q1 = []))) {
      if (!b.walk || x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      const t = this.topAt(b, x, z);
      if (t <= y + step && t > best) { best = t; bb = b; }
    }
    if (info) info.block = bb;
    return best;
  }
  // Lowest block bottom above head
  ceilingAt(x, z, y, height) {
    let best = Infinity;
    for (const b of this.query(x, z, x, z, this._q1 || (this._q1 = []))) {
      if (!b.solid || x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      if (b.bottom >= y + 0.3 && b.bottom < best) best = b.bottom;
    }
    return best;
  }
  // Push a vertical cylinder out of blocking blocks. Returns hit info.
  collide(pos, r, height, step = 0.45) {
    let hit = null;
    const arr = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, this._q2 || (this._q2 = []));
    for (let iter = 0; iter < 2; iter++) {
      for (const b of arr) {
        if (!b.solid) continue;
        if (b.bottom >= pos.y + height - 0.05) continue;
        const cx = Math.min(b.x1, Math.max(b.x0, pos.x));
        const cz = Math.min(b.z1, Math.max(b.z0, pos.z));
        const top = this.topAt(b, cx, cz);
        if (top <= pos.y + step) continue;
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = r - d;
          dx /= d; dz /= d;
          pos.x += dx * push; pos.z += dz * push;
          hit = hit || { nx: dx, nz: dz, block: b };
        } else {
          // centre inside: push out along least penetration
          const l = pos.x - b.x0 + r, rr = b.x1 - pos.x + r, f = pos.z - b.z0 + r, k = b.z1 - pos.z + r;
          const m = Math.min(l, rr, f, k);
          if (m === l) { pos.x -= l; hit = { nx: -1, nz: 0, block: b }; }
          else if (m === rr) { pos.x += rr; hit = { nx: 1, nz: 0, block: b }; }
          else if (m === f) { pos.z -= f; hit = { nx: 0, nz: -1, block: b }; }
          else { pos.z += k; hit = { nx: 0, nz: 1, block: b }; }
        }
      }
    }
    return hit;
  }
  // Ray vs block AABBs (with max top). Returns distance or Infinity.
  raycast(o, d, maxDist) {
    const ex = o.x + d.x * maxDist, ez = o.z + d.z * maxDist;
    const arr = this.query(Math.min(o.x, ex), Math.min(o.z, ez), Math.max(o.x, ex), Math.max(o.z, ez), this._q3 || (this._q3 = []));
    let best = Infinity;
    for (const b of arr) {
      if (!b.cam) continue;
      let tmin = 0, tmax = maxDist;
      const lo = [b.x0, b.bottom, b.z0], hi = [b.x1, b.maxTop, b.z1], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
      let ok = true;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(dd[i]) < 1e-9) { if (oo[i] < lo[i] || oo[i] > hi[i]) { ok = false; break; } continue; }
        let t1 = (lo[i] - oo[i]) / dd[i], t2 = (hi[i] - oo[i]) / dd[i];
        if (t1 > t2) [t1, t2] = [t2, t1];
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { ok = false; break; }
      }
      if (!ok) continue;
      if (!b.flat) {
        // sloped top: check the hit point is under the surface
        const px = o.x + d.x * tmin, py = o.y + d.y * tmin, pz = o.z + d.z * tmin;
        if (py > this.topAt(b, px, pz) + 0.05) {
          // march a few steps
          let found = false;
          for (let s = 1; s <= 8; s++) {
            const t = tmin + (tmax - tmin) * s / 8;
            if (o.y + d.y * t <= this.topAt(b, o.x + d.x * t, o.z + d.z * t)) { tmin = t; found = true; break; }
          }
          if (!found) continue;
        }
      }
      if (tmin < best) best = tmin;
    }
    return best;
  }
}
