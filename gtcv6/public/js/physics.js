// One collision interface over the three kinds of world geometry:
//  - the terrain heightfield (Kartverket DTM),
//  - building outlines (OpenStreetMap) as polygon prisms,
//  - box worlds in a local, rotated frame (house 6 and its terrace).
import * as THREE from '../vendor/three.module.min.js';

export class Physics {
  constructor(terrain, polys) {
    this.terrain = terrain;
    this.polys = polys;
    this.locals = [];
    this._l = new THREE.Vector3();
    this._d = new THREE.Vector3();
  }
  // world -> local frame with origin (ox, oz) and unit axes u, v (in x,z)
  addLocal(world, ox, oz, ux, uz) {
    const L = { world, ox, oz, ux, uz, vx: -uz, vz: ux, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    // world-space bounds of the local blocks, for a quick reject
    for (const b of world.blocks) {
      for (const [u, v] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) {
        const x = ox + L.ux * u + L.vx * v, z = oz + L.uz * u + L.vz * v;
        L.x0 = Math.min(L.x0, x); L.x1 = Math.max(L.x1, x); L.z0 = Math.min(L.z0, z); L.z1 = Math.max(L.z1, z);
      }
    }
    this.locals.push(L);
    return L;
  }
  toLocal(L, p, out) {
    const dx = p.x - L.ox, dz = p.z - L.oz;
    return out.set(dx * L.ux + dz * L.uz, p.y, dx * L.vx + dz * L.vz);
  }
  toWorld(L, p, out) {
    return out.set(L.ox + L.ux * p.x + L.vx * p.z, p.y, L.oz + L.uz * p.x + L.vz * p.z);
  }
  _near(L, x, z, r) { return x > L.x0 - r && x < L.x1 + r && z > L.z0 - r && z < L.z1 + r; }

  // highest walkable surface at (x,z) no more than `step` above y
  floorAt(x, z, y, step = 0.5, info) {
    let best = -Infinity, kind = null, block = null;
    const g = this.terrain.ground(x, z);
    if (g > -1e8 && (g <= y + step || g - y < 2.5)) { best = g; kind = 'terrain'; }
    const r = this.polys.roofAt(x, z, y, step);
    if (r > best) { best = r; kind = 'roof'; }
    for (const L of this.locals) {
      if (!this._near(L, x, z, 0.1)) continue;
      const dx = x - L.ox, dz = z - L.oz;
      const lx = dx * L.ux + dz * L.uz, lz = dx * L.vx + dz * L.vz;
      const inf = info ? {} : null;
      const f = L.world.floorAt(lx, lz, y, step, inf);
      if (f > best) { best = f; kind = 'local'; block = inf && inf.block; }
    }
    if (info) { info.kind = kind; info.block = block; }
    return best;
  }
  ceilingAt(x, z, y, height) {
    let best = Infinity;
    for (const L of this.locals) {
      if (!this._near(L, x, z, 0.1)) continue;
      const dx = x - L.ox, dz = z - L.oz;
      best = Math.min(best, L.world.ceilingAt(dx * L.ux + dz * L.uz, dx * L.vx + dz * L.vz, y, height));
    }
    return best;
  }
  collide(pos, r, height, step = 0.5) {
    let hit = this.polys.collide(pos, r, height, step);
    for (const L of this.locals) {
      if (!this._near(L, pos.x, pos.z, r + 0.5)) continue;
      const lp = this.toLocal(L, pos, this._l);
      const h = L.world.collide(lp, r, height, step);
      if (h) {
        this.toWorld(L, lp, pos);
        hit = hit || { nx: h.nx * L.ux + h.nz * L.vx, nz: h.nx * L.uz + h.nz * L.vz, block: h.block };
      }
    }
    return hit;
  }
  raycast(o, d, maxDist, terrainToo = true) {
    let best = this.polys.raycast(o, d, maxDist);
    for (const L of this.locals) {
      const ex = o.x + d.x * maxDist, ez = o.z + d.z * maxDist;
      if (Math.max(o.x, ex) < L.x0 - 1 || Math.min(o.x, ex) > L.x1 + 1 || Math.max(o.z, ez) < L.z0 - 1 || Math.min(o.z, ez) > L.z1 + 1) continue;
      const lo = this.toLocal(L, o, this._l);
      const ld = this._d.set(d.x * L.ux + d.z * L.uz, d.y, d.x * L.vx + d.z * L.vz);
      best = Math.min(best, L.world.raycast(lo, ld, maxDist));
    }
    if (terrainToo) {
      const n = Math.ceil(Math.min(best, maxDist) / 0.4);
      for (let i = 1; i <= n; i++) {
        const t = Math.min(best, maxDist) * i / n;
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        const g = this.terrain.ground(x, z);
        if (g > -1e8 && y < g + 0.15) { best = Math.min(best, Math.max(0, t - 0.4)); break; }
      }
    }
    return best;
  }
}
