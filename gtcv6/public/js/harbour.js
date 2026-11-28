// The marinas: OpenStreetMap's piers and pontoons (tools/build_map.py exports them as
// `map.piers`) with leisure boats moored along the floating ones. In Vågen and off Nordnes the
// guest berths have boats lying alongside; in the boat clubs on Store Lungegårdsvann (Neptun,
// Draugen, Marineholmen, Solheimsviken) they lie bow in, side by side, as Norwegian marinas
// moor them. Boats and pontoons ride a slow swell in the vertex shader.
import * as THREE from '../vendor/three.module.min.js';
import { Geo } from './engine.js';
import { triangulate } from './buildings.js';

const SEA = 0.15;

function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

// A hull along +z (bow) of length L, beam B, from `under` below the waterline to `free` above
// it: a box drawn in to a sharp bow and a narrower transom, with the sides flaring a little.
function hullGeo(L, B, free, under) {
  const g = new THREE.BoxGeometry(B, free + under, L, 1, 1, 6);
  g.translate(0, (free - under) / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / (L / 2), y = p.getY(i), up = (y + under) / (free + under);
    const k = z > 0 ? 1 - Math.pow(z, 2.2) * 0.97 : 1 - Math.pow(-z, 4) * 0.25;
    p.setX(i, p.getX(i) * Math.max(0.03, k) * (0.72 + 0.28 * up));
    if (z > 0.3 && y > 0) p.setY(i, y + (z - 0.3) * 0.35);          // the sheer rising to the bow
  }
  g.computeVertexNormals();
  return g.toNonIndexed();
}

export function buildHarbour(scene, map, { terrain, polys }) {
  const piers = map.piers || [];
  const ground = (x, z) => terrain.height(x, z);
  const time = { value: 0 };
  // the swell: a slow rise and fall that varies across the water, so a boat pitches a little
  const bob = (m) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSwell = time;
      sh.vertexShader = 'uniform float uSwell;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 wp = modelMatrix * vec4(position, 1.0);
          transformed.y += 0.06 * sin(uSwell * 1.1 + wp.x * 0.31 + wp.z * 0.23) + 0.03 * sin(uSwell * 1.9 - wp.x * 0.17 + wp.z * 0.41); }`);
    };
    return m;
  };
  const std = (o) => bob(new THREE.MeshStandardMaterial({ roughness: 0.55, ...o }));
  const planks = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), R = rnd(3);
    g.fillStyle = '#7d7468'; g.fillRect(0, 0, 128, 128);
    for (let j = 0; j < 8; j++) { g.fillStyle = `rgba(${R() < 0.5 ? '40,34,28' : '210,200,185'},${0.05 + R() * 0.12})`; g.fillRect(0, j * 16, 128, 16); g.fillStyle = 'rgba(25,22,18,0.6)'; g.fillRect(0, j * 16, 128, 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 1.4, 1 / 1.4); return t;
  })();
  const M = {
    deck: std({ map: planks, roughness: 0.9 }), float: std({ color: 0x3b3e42, roughness: 0.8 }), pile: std({ color: 0x4a4038, roughness: 0.9 }),
    white: std({ color: 0xf2f2ee, roughness: 0.35 }), cream: std({ color: 0xe9e2cf, roughness: 0.4 }), navy: std({ color: 0x1f2c48, roughness: 0.35 }),
    red: std({ color: 0xa8322a, roughness: 0.4 }), green: std({ color: 0x2f5a48, roughness: 0.4 }), wood: std({ color: 0x9a6a3c, roughness: 0.6 }),
    teak: std({ color: 0xb08a5c, roughness: 0.8 }), anti: std({ color: 0x5a2a26, roughness: 0.7 }), glass: std({ color: 0x1d252e, roughness: 0.1, metalness: 0.3 }),
    mast: std({ color: 0xc9ccd0, roughness: 0.3, metalness: 0.6 }), cover: std({ color: 0x24477a, roughness: 0.8 }), coverG: std({ color: 0x8a8f86, roughness: 0.8 }),
    engine: std({ color: 0x2a2c2f, roughness: 0.5 }),
  };
  // batched per 250 m cell, so marinas out of sight are not drawn
  const cells = new Map(), cellOf = (x, z) => { const k = Math.floor(x / 250) + ',' + Math.floor(z / 250); if (!cells.has(k)) cells.set(k, new Geo()); return cells.get(k); };
  let G = null;
  const T = (x, y, z, ang) => new THREE.Matrix4().makeRotationY(ang).premultiply(new THREE.Matrix4().makeTranslation(x, y, z));

  // ---------------------------------------------------------------- pontoons and piers
  // segments of every pier, to keep boats off them
  const segs = [];
  const deckY = (f) => (f ? SEA + 0.45 : SEA + 1.4);
  let nPont = 0;
  for (const pr of piers) {
    const p = pr.p, n = p.length / 2;
    let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += p[i * 2]; cz += p[i * 2 + 1]; } cx /= n; cz /= n;
    G = cellOf(cx, cz);
    // only what stands in the water; piers on land are part of the quay already
    let wet = 0; for (let i = 0; i < n; i++) if (ground(p[i * 2], p[i * 2 + 1]) < -0.3) wet++;
    if (wet < Math.max(1, n * 0.5) && ground(cx, cz) > -0.3) continue;
    const y = deckY(pr.f);
    if (pr.a) {
      const ring = []; for (let i = 0; i < n; i++) ring.push([p[i * 2], p[i * 2 + 1]]);
      for (const [a, b, c] of triangulate([ring])) G.tri(M.deck, [a[0], y, a[1]], [c[0], y, c[1]], [b[0], y, b[1]], [[a[0], a[1]], [c[0], c[1]], [b[0], b[1]]], [0, 1, 0]);
      for (let i = 0; i < n; i++) {
        const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % n], L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
        let nx = (bz - az) / L, nz = -(bx - ax) / L;
        // outward: away from the centre
        if ((ax + bx) / 2 * nx + (az + bz) / 2 * nz < cx * nx + cz * nz) { nx = -nx; nz = -nz; }
        G.quad(pr.f ? M.float : M.pile, [ax, SEA - 0.6, az], [bx, SEA - 0.6, bz], [bx, y, bz], [ax, y, az], [[0, 0], [L, 0], [L, 1], [0, 1]], [nx, 0, nz]);
        segs.push([ax, az, bx, bz, 0.3, pr.f, nx, nz]);
      }
      polys.add(Float32Array.from(p), SEA - 1, y, { kind: 'flat', walk: true, noCam: true });
    } else {
      const w = pr.w;
      for (let i = 0; i < n - 1; i++) {
        const ax = p[i * 2], az = p[i * 2 + 1], bx = p[i * 2 + 2], bz = p[i * 2 + 3], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
        const ang = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
        G.obox(M.deck, mx, y - 0.1, mz, w, 0.2, L + (i < n - 2 ? w * 0.5 : 0), 0, ang, 0);
        G.obox(pr.f ? M.float : M.pile, mx, y - 0.55, mz, w - 0.1, 0.7, L, 0, ang, 0);
        if (!pr.f) for (let s = 0; s <= L; s += 3) for (const sd of [-1, 1]) { const t = s / L, nx = Math.cos(ang), nz = -Math.sin(ang); G.obox(M.pile, ax + (bx - ax) * t + nx * sd * (w / 2 - 0.15), y - 2.5, az + (bz - az) * t + nz * sd * (w / 2 - 0.15), 0.25, 5, 0.25, 0, 0, 0); }
        segs.push([ax, az, bx, bz, w / 2, pr.f, 0, 0]);
        const dx = (bx - ax) / L, dz = (bz - az) / L, hx = -dz * w / 2, hz = dx * w / 2;
        polys.add(Float32Array.from([ax + hx, az + hz, bx + hx, bz + hz, bx - hx, bz - hz, ax - hx, az - hz]), SEA - 1, y, { kind: 'flat', walk: true, noCam: true });
      }
    }
    nPont++;
  }

  // ---------------------------------------------------------------- boats
  const R = rnd(77);
  const placed = [];                        // [cx, cz, ux, uz, hl, hw]
  // the pier segments near each 20 m cell
  const near = new Map(), key = (i, j) => i * 100003 + j;
  for (const sg of segs) {
    const [ax, az, bx, bz, hw] = sg, r = hw + 1;
    for (let i = Math.floor((Math.min(ax, bx) - r) / 20); i <= Math.floor((Math.max(ax, bx) + r) / 20); i++)
      for (let j = Math.floor((Math.min(az, bz) - r) / 20); j <= Math.floor((Math.max(az, bz) + r) / 20); j++) { const k = key(i, j); if (!near.has(k)) near.set(k, []); near.get(k).push(sg); }
  }
  const segDist = (x, z) => {
    let d = Infinity;
    for (const [ax, az, bx, bz, hw] of near.get(key(Math.floor(x / 20), Math.floor(z / 20))) || []) {
      const L2 = (bx - ax) ** 2 + (bz - az) ** 2, t = L2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2)) : 0;
      d = Math.min(d, Math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z) - hw);
    }
    return d;
  };
  const fits = (cx, cz, ux, uz, hl, hw) => {
    const vx = -uz, vz = ux;
    for (const u of [-1, -0.5, 0, 0.5, 1]) for (const v of [-1, 0, 1]) {
      const x = cx + ux * hl * u + vx * hw * v, z = cz + uz * hl * u + vz * hw * v;
      if (ground(x, z) > -0.7 || segDist(x, z) < 0.25 || polys.nearBuilding(x, z, 0.4)) return false;
    }
    for (const [qx, qz, qux, quz, qhl, qhw] of placed) {
      if (Math.hypot(qx - cx, qz - cz) > hl + qhl + 1) continue;
      // separating axes of the two rectangles (with a little room between them)
      const ax = [[ux, uz], [-uz, ux], [qux, quz], [-quz, qux]];
      let apart = false;
      for (const [ex, ez] of ax) {
        const r1 = hl * Math.abs(ux * ex + uz * ez) + hw * Math.abs(-uz * ex + ux * ez), r2 = qhl * Math.abs(qux * ex + quz * ez) + qhw * Math.abs(-quz * ex + qux * ez);
        if (Math.abs((qx - cx) * ex + (qz - cz) * ez) > r1 + r2 + 0.3) { apart = true; break; }
      }
      if (!apart) return false;
    }
    return true;
  };
  // unit hulls and boxes, made once and scaled for each boat
  const hullCache = new Map(), unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const H = (free, under, L, B) => { const k = free + '/' + under; if (!hullCache.has(k)) hullCache.set(k, hullGeo(1, 1, free, under)); return [hullCache.get(k), [B, 1, L]]; };
  const Bx = (sx, sy, sz) => [unitBox, [sx, sy, sz]];
  const HULLS = [M.white, M.white, M.white, M.cream, M.navy, M.white, M.red, M.green, M.white];
  const boat = (cx, cz, ang, kind, L, B) => {
    G = cellOf(cx, cz);
    const m = T(cx, SEA, cz, ang);
    // geo is a geometry, or [unit geometry, [sx, sy, sz]] from H() and Bx()
    const put = (mat, geo, x, y, z, ry = 0, rx = 0) => {
      const [g, sc] = Array.isArray(geo) ? geo : [geo, [1, 1, 1]];
      const mm = new THREE.Matrix4().makeScale(...sc).premultiply(new THREE.Matrix4().makeRotationX(rx)).premultiply(new THREE.Matrix4().makeRotationY(ry)).premultiply(new THREE.Matrix4().makeTranslation(x, y, z)).premultiply(m);
      G.geom(mat, g, mm);
    };
    const hm = kind === 'snekke' ? (R() < 0.5 ? M.wood : M.white) : HULLS[Math.floor(R() * HULLS.length)];
    const free = kind === 'snekke' ? 0.55 : kind === 'sail' ? 0.85 : 1.0;
    put(M.anti, H(0.02, 0.55, L * 0.97, B * 0.96), 0, 0, 0);
    put(hm, H(free, 0.02, L, B), 0, 0, 0);
    // the deck, a little inside the gunwale
    const deck = H(0.04, 0.0, L * 0.94, B * 0.86); put(kind === 'snekke' ? M.teak : M.white, deck, 0, free - 0.04 + 0.01, -L * 0.02);
    if (kind === 'motor') {
      const cl = L * 0.42, cw = B * 0.72, ch = 1.05;
      put(M.white, Bx(cw, ch, cl), 0, free + ch / 2, L * 0.05);
      put(M.glass, Bx(cw + 0.03, 0.42, cl * 0.8), 0, free + ch * 0.62, L * 0.05);
      put(M.glass, Bx(cw * 0.95, 0.5, 0.06), 0, free + ch + 0.05, L * 0.05 + cl / 2 - 0.25, 0, -0.6);
      put(M.teak, Bx(B * 0.7, 0.05, L * 0.3), 0, free + 0.02, -L * 0.3);
      put(M.engine, Bx(0.5, 0.8, 0.45), 0, free - 0.1, -L / 2 - 0.12);
    } else if (kind === 'sail') {
      const cl = L * 0.36, cw = B * 0.6;
      put(M.white, Bx(cw, 0.55, cl), 0, free + 0.27, L * 0.02);
      put(M.glass, Bx(cw + 0.03, 0.16, cl * 0.75), 0, free + 0.35, L * 0.02);
      const mh = L * 1.35, mast = new THREE.CylinderGeometry(0.06, 0.09, mh, 5); mast.translate(0, mh / 2, 0);
      put(M.mast, mast.toNonIndexed(), 0, free + 0.55, L * 0.12);
      const boom = new THREE.CylinderGeometry(0.06, 0.06, L * 0.42, 6); boom.rotateX(Math.PI / 2);
      put(M.mast, boom.toNonIndexed(), 0, free + 1.65, L * 0.12 - L * 0.21);
      const sail = new THREE.CylinderGeometry(0.2, 0.28, L * 0.4, 6); sail.rotateX(Math.PI / 2);
      put(R() < 0.7 ? M.cover : M.coverG, sail.toNonIndexed(), 0, free + 1.85, L * 0.12 - L * 0.2);
    } else {
      // an open boat: thwarts inside, an outboard on the transom, or a canvas cover over it all
      if (R() < 0.45) { const c = H(0.3, 0, L * 0.9, B * 0.84); put(R() < 0.6 ? M.cover : M.coverG, c, 0, free, 0); }
      else { put(M.teak, Bx(B * 0.8, 0.06, 0.3), 0, free - 0.12, 0); put(M.teak, Bx(B * 0.7, 0.06, 0.3), 0, free - 0.12, -L * 0.28); }
      put(M.engine, Bx(0.35, 0.65, 0.4), 0, free + 0.05, -L / 2 - 0.1);
    }
    // so you can jump aboard
    const ux = Math.sin(ang), uz = Math.cos(ang), vx = -uz, vz = ux, hl = L / 2 * 0.9, hw = B / 2 * 0.85, pts = [];
    for (const [u, v] of [[-hl, -hw], [hl * 0.6, -hw], [hl, 0], [hl * 0.6, hw], [-hl, hw]]) pts.push(cx + ux * u + vx * v, cz + uz * u + vz * v);
    polys.add(Float32Array.from(pts), SEA - 1, SEA + free, { kind: 'flat', walk: true, noCam: true });
  };
  const pickKind = (big) => { const r = R(); return big ? (r < 0.45 ? 'sail' : r < 0.85 ? 'motor' : 'snekke') : (r < 0.3 ? 'sail' : r < 0.6 ? 'motor' : 'snekke'); };
  const dims = (kind) => kind === 'sail' ? [8 + R() * 4, 0] : kind === 'motor' ? [6.5 + R() * 4, 0] : [4.2 + R() * 1.8, 0];
  let nBoats = 0;
  for (const [ax, az, bx, bz, hw, f, onx, onz] of segs.slice()) {
    if (!f) continue;
    const L = Math.hypot(bx - ax, bz - az); if (L < 4) continue;
    const dx = (bx - ax) / L, dz = (bz - az) / L;
    // Vågen and the harbour off Nordnes are guest berths (alongside); the clubs moor bow in
    const alongside = (ax + bx) / 2 < 0 && (az + bz) / 2 < 400;
    const sides = onx || onz ? [[onx, onz]] : [[-dz, dx], [dz, -dx]];
    for (const [nx, nz] of sides) {
      let s = 1.2;
      while (s < L - 1.2) {
        if (R() < 0.22) { s += 3; continue; }                 // an empty berth
        const kind = pickKind(alongside), [Lb] = dims(kind), B = Lb * (kind === 'snekke' ? 0.38 : 0.33);
        if (alongside) {
          const t = s + Lb / 2; if (t + Lb / 2 > L + 1) break;
          const off = hw + B / 2 + 0.45, cx = ax + dx * t + nx * off, cz = az + dz * t + nz * off;
          const ang = Math.atan2(dx, dz) + (R() < 0.5 ? Math.PI : 0);
          if (fits(cx, cz, Math.sin(ang), Math.cos(ang), Lb / 2, B / 2)) { boat(cx, cz, ang, kind, Lb, B); placed.push([cx, cz, Math.sin(ang), Math.cos(ang), Lb / 2, B / 2]); nBoats++; }
          s += Lb + 1.2 + R() * 2;
        } else {
          const t = s + B / 2, off = hw + Lb / 2 + 0.5, cx = ax + dx * t + nx * off, cz = az + dz * t + nz * off;
          const ang = Math.atan2(-nx, -nz);                   // bow to the pontoon
          if (fits(cx, cz, -nx, -nz, Lb / 2, B / 2)) { boat(cx, cz, ang, kind, Lb, B); placed.push([cx, cz, -nx, -nz, Lb / 2, B / 2]); nBoats++; s += B + 0.7; }
          else s += 1.5;
        }
      }
    }
  }
  const grp = new THREE.Group(); grp.name = 'harbour'; for (const g of cells.values()) { const sub = new THREE.Group(); g.build(sub); grp.add(sub); }
  grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(grp);
  return { pontoons: nPont, boats: nBoats, placed, update(t) { time.value = t; } };
}
