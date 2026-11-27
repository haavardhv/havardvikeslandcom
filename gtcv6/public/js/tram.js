// Bybanen: the rails in the street, the platforms (Byparken and the stops along Kaigaten), and
// one tram, a five-section Stadler Variobahn, that waits at Byparken, rings its bell, runs out
// along its line to the edge of the map, and comes back. The livery is white with a dark window
// band and Bybanen's orange; swap COLORS for the real one.
import * as THREE from '../vendor/three.module.min.js';

const COLORS = { body: 0xf2f2ee, band: 0x1d2228, accent: 0xf07c1a, skirt: 0x3a3f45, roof: 0xb9bdc2 };
const GAUGE = 1.435;
const SECTIONS = [6.6, 6.0, 6.4, 6.0, 6.6];       // cab, middle, middle (pantograph), middle, cab
const GAP = 0.45;                                  // the bellows between sections

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};

// a polyline [x, z, x, z, ...] with distances along it
function pathOf(flat) {
  const P = [];
  for (let i = 0; i < flat.length; i += 2) P.push([flat[i], flat[i + 1]]);
  const D = [0];
  for (let i = 1; i < P.length; i++) D.push(D[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const at = (s, out) => {
    s = Math.max(0, Math.min(D[D.length - 1], s));
    let i = 1;
    while (i < D.length - 1 && D[i] < s) i++;
    const t = (s - D[i - 1]) / Math.max(1e-6, D[i] - D[i - 1]);
    const dx = P[i][0] - P[i - 1][0], dz = P[i][1] - P[i - 1][1], l = Math.hypot(dx, dz) || 1;
    out.x = P[i - 1][0] + dx * t; out.z = P[i - 1][1] + dz * t; out.dx = dx / l; out.dz = dz / l;
    return out;
  };
  return { P, D, len: D[D.length - 1], at };
}

export function buildTram(scene, data, { terrain, polys }) {
  if (!data || !data.route || data.route.length < 4) return { update() {}, sections: [] };
  const ground = (x, z) => terrain.height(x, z);

  // ------------------------------------------------ rails: two steel ribbons per track, sampled every 2 m
  {
    const pos = [], idx = [];
    const ribbon = (x0, z0, x1, z1, off) => {
      const l = Math.hypot(x1 - x0, z1 - z0); if (l < 0.05) return;
      const nx = -(z1 - z0) / l, nz = (x1 - x0) / l, w = 0.04;
      const ax = x0 + nx * off, az = z0 + nz * off, bx = x1 + nx * off, bz = z1 + nz * off;
      const b = pos.length / 3;
      const ya = ground(ax, az) + 0.025, yb = ground(bx, bz) + 0.025;
      pos.push(ax - nx * w, ya, az - nz * w, ax + nx * w, ya, az + nz * w, bx + nx * w, yb, bz + nz * w, bx - nx * w, yb, bz - nz * w);
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    };
    for (const t of data.tracks) {
      const p = pathOf(t), a = { x: 0, z: 0 }, b = { x: 0, z: 0 };
      for (let s = 0; s < p.len; s += 2) {
        p.at(s, a); p.at(Math.min(p.len, s + 2), b);
        for (const off of [-GAUGE / 2, GAUGE / 2]) ribbon(a.x, a.z, b.x, b.z, off);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, std({ color: 0x9da3a8, metalness: 0.85, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true;
    scene.add(m);
  }

  // ------------------------------------------------ platforms: raised concrete, a white edge, a shelter and a sign
  const signTex = (name) => canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = COLORS.accent === 0xf07c1a ? '#f07c1a' : '#' + COLORS.accent.toString(16); c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    let s = 72; do { c.font = `800 ${s}px "Archivo", sans-serif`; s -= 4; } while (c.measureText(name).width > w - 60 && s > 20);
    c.fillText(name, w / 2, h / 2 + 4);
  });
  const concrete = std({ color: 0xb8b6b0, roughness: 0.9 }), edgeM = std({ color: 0xf4f2ea, roughness: 0.7 });
  const steel = std({ color: 0x40464c, metalness: 0.6, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe0e8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  const seen = new Set();
  for (const pl of data.platforms) {
    const pts = [];
    for (let i = 0; i < pl.p.length; i += 2) pts.push(new THREE.Vector2(pl.p[i], pl.p[i + 1]));
    if (pts.length < 3) continue;
    let cx = 0, cz = 0; for (const p of pts) { cx += p.x; cz += p.y; } cx /= pts.length; cz /= pts.length;
    let gmin = Infinity; for (const p of pts) gmin = Math.min(gmin, ground(p.x, p.y));
    const top = Math.max(gmin, ground(cx, cz)) + 0.3;
    // the slab
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, -p.y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: top - gmin + 0.4, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); geo.translate(0, gmin - 0.4, 0);
    const slab = new THREE.Mesh(geo, [concrete, concrete]); slab.receiveShadow = true; slab.castShadow = true;
    scene.add(slab);
    polys.add(Float32Array.from(pl.p), gmin - 0.4, top, { kind: 'flat', walk: true, noCam: true });
    // the long axis: the longest edge
    let best = 0, ax = 1, az = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], l = a.distanceTo(b);
      if (l > best) { best = l; ax = (b.x - a.x) / l; az = (b.y - a.y) / l; }
    }
    const rot = Math.atan2(ax, az);
    // a white line round the edge
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], l = a.distanceTo(b);
      if (l < 0.5) continue;
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, l), edgeM);
      e.position.set((a.x + b.x) / 2, top + 0.011, (a.y + b.y) / 2); e.rotation.y = Math.atan2(b.x - a.x, b.y - a.y);
      scene.add(e);
    }
    if (best < 12) continue;
    // a glass shelter on posts, and the name on an orange sign
    const sh = new THREE.Group(); sh.position.set(cx, top, cz); sh.rotation.y = rot;
    const L = Math.min(12, best * 0.4);
    for (const z of [-L / 2 + 0.3, L / 2 - 0.3]) for (const x of [-0.6]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), steel); post.position.set(x, 1.3, z); post.castShadow = true; sh.add(post); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, L), glass); roof.position.set(0, 2.65, 0); sh.add(roof);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, L), steel); beam.position.set(-0.6, 2.6, 0); sh.add(beam);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.9, L * 0.6), glass); back.position.set(-0.6, 1.2, 0); sh.add(back);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 2.4), std({ color: 0x9b6a3c })); bench.position.set(-0.3, 0.45, 0); sh.add(bench);
    if (pl.n && !seen.has(pl.n.split(' ')[0])) {
      seen.add(pl.n.split(' ')[0]);
      const name = pl.n.replace(/\s*\(?[A-Z]\)?$/, '');
      const sm = std({ map: signTex(name), emissive: 0xffffff, emissiveMap: signTex(name), emissiveIntensity: 0.35 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), steel); pole.position.set(0.6, 1.6, L / 2 + 0.8); sh.add(pole);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 1.8), [sm, sm, steel, steel, steel, steel]); sign.position.set(0.6, 3.0, L / 2 + 0.8); sh.add(sign);
    }
    scene.add(sh);
  }

  // ------------------------------------------------ the tram
  const route = pathOf(data.route);
  const sideTex = (cab) => canvasTex(512, 256, (c, w, h) => {
    const hex = (v) => '#' + v.toString(16).padStart(6, '0');
    c.fillStyle = hex(COLORS.body); c.fillRect(0, 0, w, h);
    c.fillStyle = hex(COLORS.skirt); c.fillRect(0, h * 0.86, w, h * 0.14);
    c.fillStyle = hex(COLORS.accent); c.fillRect(0, h * 0.78, w, h * 0.05);
    c.fillStyle = hex(COLORS.band); c.fillRect(0, h * 0.2, w, h * 0.38);                  // the window band
    c.fillStyle = 'rgba(255,255,255,0.08)'; for (let x = 0; x < w; x += 128) c.fillRect(x, h * 0.2, 4, h * 0.38);
    // a door: orange, glass in the top
    const dx = cab ? w * 0.62 : w * 0.38, dw = w * 0.24;
    c.fillStyle = hex(COLORS.accent); c.fillRect(dx, h * 0.12, dw, h * 0.74);
    c.fillStyle = hex(COLORS.band); c.fillRect(dx + 8, h * 0.18, dw / 2 - 12, h * 0.46); c.fillRect(dx + dw / 2 + 4, h * 0.18, dw / 2 - 12, h * 0.46);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(dx + dw / 2 - 2, h * 0.12, 4, h * 0.74);
  });
  const frontTex = canvasTex(256, 256, (c, w, h) => {
    const hex = (v) => '#' + v.toString(16).padStart(6, '0');
    c.fillStyle = hex(COLORS.body); c.fillRect(0, 0, w, h);
    c.fillStyle = hex(COLORS.band); c.beginPath(); c.moveTo(20, 40); c.lineTo(w - 20, 40); c.lineTo(w - 10, 150); c.lineTo(10, 150); c.fill();   // windscreen
    c.fillStyle = '#ff9a2e'; c.fillRect(30, 46, w - 60, 22);                                                                      // destination
    c.fillStyle = '#1d2228'; c.font = '700 18px "Archivo", sans-serif'; c.textAlign = 'center'; c.fillText('1  Flesland', w / 2, 63);
    c.fillStyle = hex(COLORS.accent); c.fillRect(0, h * 0.78, w, h * 0.05);
    c.fillStyle = '#fff6d8'; for (const x of [40, w - 40]) { c.beginPath(); c.arc(x, 185, 12, 0, 7); c.fill(); }                  // lamps
    c.fillStyle = hex(COLORS.skirt); c.fillRect(0, h * 0.86, w, h * 0.14);
  });
  const sideM = [std({ map: sideTex(false) }), std({ map: sideTex(true) })];
  const frontM = std({ map: frontTex, emissive: 0xffffff, emissiveMap: frontTex, emissiveIntensity: 0.15 });
  const roofM = std({ color: COLORS.roof, metalness: 0.4 }), bodyM = std({ color: COLORS.body });
  const W = 2.65, Hb = 3.3, FLOOR = 0.3;
  const total = SECTIONS.reduce((a, b) => a + b, 0) + GAP * (SECTIONS.length - 1);
  const sections = SECTIONS.map((len, k) => {
    const cab = k === 0 || k === SECTIONS.length - 1;
    const g = new THREE.Group();
    const sm = sideM[cab ? 1 : 0];
    // box faces: +x, -x, +y, -y, +z, -z (z is along the track)
    // local +z points along the tram towards its front (Byparken); the first section's nose is at
    // +z, the last one's at -z
    const nd = k === 0 ? 1 : -1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, Hb - FLOOR, len - (cab ? 1.2 : 0)), [sm, sm, roofM, bodyM, bodyM, bodyM]);
    body.position.set(0, FLOOR + (Hb - FLOOR) / 2, cab ? -nd * 0.6 : 0);
    body.castShadow = true;
    g.add(body);
    if (cab) {
      // the nose, tapered at the top and the sides, with the windscreen on its end
      const nose = new THREE.Mesh(new THREE.BoxGeometry(W, Hb - FLOOR, 1.2), [sm, sm, roofM, bodyM, nd > 0 ? frontM : bodyM, nd > 0 ? bodyM : frontM]);
      const a = nose.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { const z = a.getZ(i), y = a.getY(i); if (z * nd > 0.5) { if (y > 0) a.setZ(i, z - nd * 0.45); a.setX(i, a.getX(i) * 0.9); } }
      nose.geometry.computeVertexNormals();
      nose.position.set(0, FLOOR + (Hb - FLOOR) / 2, nd * (len / 2 - 0.6));
      nose.castShadow = true;
      g.add(nose);
    }
    // roof equipment, and the pantograph on the middle section
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, len * 0.5), roofM); box.position.set(0, Hb + 0.15, 0); g.add(box);
    if (k === 2) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.8), std({ color: 0x222222 })); arm.position.set(0, Hb + 0.75, 0); arm.rotation.x = 0.55; g.add(arm);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.08), std({ color: 0x222222 })); shoe.position.set(0, Hb + 1.15, 0.3); g.add(shoe);
    }
    g.visible = false;
    scene.add(g);
    return { g, len, off: 0, x: 0, z: 0, h: 0 };
  });
  // offsets of each section's centre from the front of the tram (towards the start of the route)
  { let o = 0; for (const s of sections) { s.off = o + s.len / 2; o += s.len + GAP; } }

  // the timetable: wait at Byparken, run out to the end of the line in the map, wait out of sight, come back
  const HOME = 4;                                    // the front stops 4 m from the buffer stop
  const OUT = route.len + total + 5;                 // well past the edge of the map
  const tr = { s: HOME, v: 0, phase: 'dwell', t: 25, dir: 1 };
  const tmp = {};
  const place = () => {
    for (const sec of sections) {
      const sAt = tr.s + sec.off;
      const vis = sAt < route.len + sec.len / 2;
      sec.g.visible = vis;
      if (!vis) { sec.x = sec.z = 1e9; continue; }
      route.at(sAt, tmp);
      sec.x = tmp.x; sec.z = tmp.z; sec.h = Math.atan2(-tmp.dx, -tmp.dz);     // the front looks back towards Byparken
      sec.g.position.set(tmp.x, ground(tmp.x, tmp.z) + 0.03, tmp.z);
      sec.g.rotation.y = sec.h;
    }
  };
  place();
  const VMAX = 9;
  return {
    sections, tram: tr, total,
    // returns 'bell' when the tram is about to leave or arrives
    update(dt) {
      let ev = null;
      tr.t -= dt;
      if (tr.phase === 'dwell') {
        tr.v = 0;
        if (tr.t <= 0) { tr.phase = 'out'; ev = 'bell'; }
      } else if (tr.phase === 'out') {
        tr.v = Math.min(VMAX, tr.v + 1.1 * dt);
        tr.s += tr.v * dt;
        if (tr.s >= OUT) { tr.phase = 'away'; tr.t = 40; tr.v = 0; }
      } else if (tr.phase === 'away') {
        if (tr.t <= 0) { tr.phase = 'in'; tr.v = VMAX; }
      } else if (tr.phase === 'in') {
        const left = tr.s - HOME;
        tr.v = Math.max(0.6, Math.min(VMAX, Math.sqrt(2 * 1.0 * Math.max(0, left))));
        tr.s -= tr.v * dt;
        if (tr.s <= HOME) { tr.s = HOME; tr.phase = 'dwell'; tr.t = 30; tr.v = 0; ev = 'bell'; }
      }
      place();
      return ev;
    },
    // the speed the tram moves at, with its direction along the route (+ out, - in)
    velocity() { return tr.phase === 'out' ? tr.v : tr.phase === 'in' ? -tr.v : 0; },
    W,
  };
}
