// Bybanen: the rails set in granite setts, the overhead line on its masts, the platforms
// (Byparken, Kaigaten, Nonneseter, Bystasjonen, Nygård), and one tram, a five-section Stadler
// Variobahn, that waits at Byparken, rings its bell, runs out along its line to the edge of the
// map, and comes back. After photos: white sides with a big dark window band and a thin orange
// line under the roof, and the orange-red cab round a huge black windscreen with the amber
// "1 Bergen lufthavn" display.
import * as THREE from '../vendor/three.module.min.js';

const COLORS = { body: 0xeceeef, band: 0x16191c, accent: 0xe4532a, skirt: 0x4a4f55, roof: 0xc4c8cc };
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

  // ------------------------------------------------ the track bed: granite setts round and between the rails
  {
    const sett = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#5b5a57'; c.fillRect(0, 0, w, h);
      let s = 7;
      const R = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
      for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) { const v = 120 + R() * 50; c.fillStyle = `rgb(${v},${v - 2},${v - 6})`; c.beginPath(); c.roundRect(i * w / 6 + (j % 2) * w / 12 + 2, j * h / 8 + 2, w / 6 - 4, h / 8 - 4, 5); c.fill(); }
    });
    sett.wrapS = sett.wrapT = THREE.RepeatWrapping;
    const pos = [], uv = [], idx = [];
    for (const t of data.tracks.slice(0, data.nLight ?? data.tracks.length)) {
      const p = pathOf(t), a = { x: 0, z: 0 }, b = { x: 0, z: 0 };
      if (p.len < 1) continue;
      for (let s = 0; s < p.len - 0.01; s += 2) {
        p.at(s, a); p.at(Math.min(p.len, s + 2), b);
        const l = Math.hypot(b.x - a.x, b.z - a.z); if (l < 0.05) continue;
        const nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l, hw = 1.5, k = pos.length / 3;
        for (const [x, z, off] of [[a.x, a.z, -hw], [a.x, a.z, hw], [b.x, b.z, hw], [b.x, b.z, -hw]]) { const px = x + nx * off, pz = z + nz * off; pos.push(px, ground(px, pz) + 0.015, pz); uv.push(px / 1.5, pz / 1.5); }
        idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, std({ map: sett, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    scene.add(m);
  }

  // ------------------------------------------------ the overhead line: galvanised masts every 30 m with a
  // horizontal arm out over the track, and the contact wire 5.9 m over each rail pair
  {
    const mastM = std({ color: 0x8e9499, metalness: 0.6, roughness: 0.45 });
    const mastG = new THREE.Group(); scene.add(mastG);
    const wires = [];
    const placed = [];
    const lightTracks = data.tracks.filter((t, i) => i < (data.nLight ?? data.tracks.length));
    const paths = lightTracks.map(pathOf).filter(p => p.len > 2);
    const tmpA = { x: 0, z: 0 }, tmpB = { x: 0, z: 0 };
    const nearOther = (p0, x, z) => { let best = Infinity; for (const p of paths) { if (p === p0) continue; for (let i = 0; i < p.P.length; i++) { const d = Math.hypot(p.P[i][0] - x, p.P[i][1] - z); if (d < best) best = d; } } return best; };
    for (const p of paths) {
      for (let s = 0; s <= p.len; s += 10) { p.at(s, tmpA); wires.push([tmpA.x, ground(tmpA.x, tmpA.z) + 5.9, tmpA.z]); if (s + 10 > p.len) break; p.at(Math.min(p.len, s + 10), tmpB); wires.push([tmpB.x, ground(tmpB.x, tmpB.z) + 5.9, tmpB.z]); }
      for (let s = 6; s < p.len; s += 30) {
        p.at(s, tmpA);
        const nx = -tmpA.dz, nz = tmpA.dx;
        // the mast stands on the outside of a double track: the side where the other track is not
        let side = 1;
        const dPlus = nearOther(p, tmpA.x + nx * 3.5, tmpA.z + nz * 3.5), dMinus = nearOther(p, tmpA.x - nx * 3.5, tmpA.z - nz * 3.5);
        if (dPlus < dMinus) side = -1;
        const mx = tmpA.x + nx * side * 2.4, mz = tmpA.z + nz * side * 2.4;
        if (placed.some(q => Math.hypot(q[0] - mx, q[1] - mz) < 9)) continue;
        if (polys.nearBuilding(mx, mz, 0.4)) continue;
        placed.push([mx, mz]);
        const gy = ground(mx, mz), reach = Math.min(dPlus, dMinus) < 6 ? 6.4 : 3.0;      // over both tracks, or one
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.26, 7.6, 0.26), mastM); mast.position.set(mx, gy + 3.8, mz); mast.castShadow = true; mastG.add(mast);
        for (const y of [6.3, 7.1]) {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, reach), mastM);
          arm.position.set(mx - nx * side * reach / 2, gy + y, mz - nz * side * reach / 2); arm.rotation.y = Math.atan2(nx, nz); mastG.add(arm);
        }
        polys.add(Float32Array.from([mx - 0.15, mz - 0.15, mx + 0.15, mz - 0.15, mx + 0.15, mz + 0.15, mx - 0.15, mz + 0.15]), gy - 1, gy + 7.6, { tree: true, noCam: true });
      }
    }
    const wg = new THREE.BufferGeometry().setFromPoints(wires.map(w => new THREE.Vector3(...w)));
    scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x2a2d30 })));
  }

  // ------------------------------------------------ platforms: raised concrete, a white edge, a shelter and a sign
  const signTex = (name) => canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = COLORS.accent === 0xf07c1a ? '#f07c1a' : '#' + COLORS.accent.toString(16); c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    let s = 72; do { c.font = `800 ${s}px "Archivo", sans-serif`; s -= 4; } while (c.measureText(name).width > w - 60 && s > 20);
    c.fillText(name, w / 2, h / 2 + 4);
  });
  const concrete = std({ color: 0xb8b6b0, roughness: 0.9 }), edgeM = std({ color: 0xdedbd2, roughness: 0.7 });
  const tactileM = std({ color: 0x3b3a38, roughness: 0.8 });
  const insideFlat = (p, x, z) => { let c = false; for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) { const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
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
    // a light granite edge, and the dark ribbed tactile strip just inside it, along the long sides
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], l = a.distanceTo(b);
      if (l < 0.5) continue;
      let nx = -(b.y - a.y) / l, nz = (b.x - a.x) / l;
      const mx = (a.x + b.x) / 2, mz = (a.y + b.y) / 2;
      if (!insideFlat(pl.p, mx + nx * 0.3, mz + nz * 0.3)) { nx = -nx; nz = -nz; }        // n: into the platform
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, l), edgeM);
      e.position.set(mx + nx * 0.15, top + 0.012, mz + nz * 0.15); e.rotation.y = Math.atan2(b.x - a.x, b.y - a.y);
      scene.add(e);
      if (l < 4) continue;
      const tac = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, l - 0.6), tactileM);
      tac.position.set(mx + nx * 0.75, top + 0.013, mz + nz * 0.75); tac.rotation.y = e.rotation.y;
      scene.add(tac);
    }
    if (best < 12) continue;
    // a glass shelter on posts, and the name on an orange sign
    const sh = new THREE.Group(); sh.position.set(cx, top, cz); sh.rotation.y = rot;
    const L = Math.min(12, best * 0.4);
    for (const z of [-L / 2 + 0.3, L / 2 - 0.3]) for (const x of [-0.6]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), steel); post.position.set(x, 1.3, z); post.castShadow = true; sh.add(post); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, L + 0.4), std({ color: 0x2f3236, roughness: 0.6 })); roof.position.set(-0.1, 2.7, 0); roof.castShadow = true; sh.add(roof);
    const light = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.02, L), std({ color: 0xfff2d6, emissive: 0xffe2b0, emissiveIntensity: 0.6 })); light.position.set(-0.1, 2.61, 0); sh.add(light);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 1.2), std({ color: COLORS.accent, emissive: COLORS.accent, emissiveIntensity: 0.25 })); panel.position.set(-0.6, 1.25, -L / 2 + 0.9); sh.add(panel);
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
  const hex = (v) => '#' + v.toString(16).padStart(6, '0');
  // the sides: white, a thin orange line under the roof, a big dark window band, grey skirt, and
  // double doors of glass in dark frames
  const sideTex = (cab) => canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = hex(COLORS.body); c.fillRect(0, 0, w, h);
    c.fillStyle = hex(COLORS.accent); c.fillRect(0, h * 0.03, w, h * 0.035);
    c.fillStyle = hex(COLORS.band); c.fillRect(0, h * 0.16, w, h * 0.46);
    c.fillStyle = 'rgba(255,255,255,0.10)'; for (let x = 0; x < w; x += 128) c.fillRect(x, h * 0.16, 5, h * 0.46);
    c.fillStyle = 'rgba(180,200,215,0.12)'; c.fillRect(0, h * 0.16, w, h * 0.12);
    c.fillStyle = hex(COLORS.skirt); c.fillRect(0, h * 0.88, w, h * 0.12);
    const dx = cab ? w * 0.58 : w * 0.36, dw = w * 0.26;
    c.fillStyle = '#3a3f44'; c.fillRect(dx, h * 0.12, dw, h * 0.76);
    c.fillStyle = '#1b2026'; c.fillRect(dx + 7, h * 0.15, dw / 2 - 10, h * 0.7); c.fillRect(dx + dw / 2 + 3, h * 0.15, dw / 2 - 10, h * 0.7);
    c.fillStyle = 'rgba(190,210,225,0.18)'; c.fillRect(dx + 7, h * 0.15, dw / 2 - 10, h * 0.25); c.fillRect(dx + dw / 2 + 3, h * 0.15, dw / 2 - 10, h * 0.25);
    c.fillStyle = hex(COLORS.accent); c.fillRect(dx + 6, h * 0.66, dw - 12, 5);
    if (cab) { c.fillStyle = hex(COLORS.accent); c.font = '700 22px "Archivo", sans-serif'; c.fillText('skyss', w * 0.08, h * 0.8); }
  });
  // the cab's sides: orange, with the driver's window
  const cabSideTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = hex(COLORS.accent); c.fillRect(0, 0, w, h);
    c.fillStyle = hex(COLORS.band); c.beginPath(); c.moveTo(0, h * 0.16); c.lineTo(w * 0.85, h * 0.16); c.quadraticCurveTo(w, h * 0.18, w, h * 0.4); c.lineTo(w, h * 0.62); c.lineTo(0, h * 0.62); c.fill();
    c.fillStyle = hex(COLORS.body); c.fillRect(0, h * 0.66, w * 0.6, h * 0.2);
  });
  // the front: the orange-red frame round a huge black windscreen with the amber destination,
  // a white panel with the lamps in a black band, and the orange skirt
  const frontTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = hex(COLORS.accent); c.fillRect(0, 0, w, h);
    c.fillStyle = '#0f1214'; c.beginPath(); c.roundRect(16, 8, w - 32, 150, [30, 30, 8, 8]); c.fill();
    c.fillStyle = 'rgba(150,170,185,0.15)'; c.beginPath(); c.roundRect(22, 14, w - 44, 60, [24, 24, 0, 0]); c.fill();
    c.fillStyle = '#ffb21e'; c.font = '700 19px "Archivo", sans-serif'; c.textAlign = 'center'; c.fillText('1  Bergen lufthavn', w / 2, 40);
    c.fillStyle = hex(COLORS.body); c.fillRect(30, 166, w - 60, 50);
    c.fillStyle = '#121416'; c.fillRect(30, 182, w - 60, 18);
    c.fillStyle = '#fff6e0'; for (const x of [52, 74, w - 74, w - 52]) { c.beginPath(); c.arc(x, 191, 7, 0, 7); c.fill(); }
    c.fillStyle = '#ff2a1a'; for (const x of [96, w - 96]) { c.beginPath(); c.arc(x, 191, 5, 0, 7); c.fill(); }
    c.fillStyle = '#ffffff'; c.font = '700 14px "Archivo", sans-serif'; c.fillText('skyss', w / 2, 232);
  });
  const sideM = [std({ map: sideTex(false) }), std({ map: sideTex(true) })];
  const cabSideM = std({ map: cabSideTex });
  const frontM = std({ map: frontTex, emissive: 0xffffff, emissiveMap: frontTex, emissiveIntensity: 0.15 });
  const roofM = std({ color: COLORS.roof, metalness: 0.4 }), bodyM = std({ color: COLORS.body }), orangeM = std({ color: COLORS.accent });
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
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, Hb - FLOOR, len - (cab ? 1.4 : 0)), [sm, sm, roofM, bodyM, bodyM, bodyM]);
    body.position.set(0, FLOOR + (Hb - FLOOR) / 2, cab ? -nd * 0.7 : 0);
    body.castShadow = true;
    g.add(body);
    if (cab) {
      // the nose, tapered at the top and the sides, with the windscreen on its end
      const nose = new THREE.Mesh(new THREE.BoxGeometry(W, Hb - FLOOR, 1.4), [cabSideM, cabSideM, orangeM, bodyM, nd > 0 ? frontM : bodyM, nd > 0 ? bodyM : frontM]);
      const a = nose.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { const z = a.getZ(i), y = a.getY(i); if (z * nd > 0.6) { if (y > 0) a.setZ(i, z - nd * (0.3 + 0.25 * y / (Hb / 2))); a.setX(i, a.getX(i) * 0.92); } }
      nose.geometry.computeVertexNormals();
      nose.position.set(0, FLOOR + (Hb - FLOOR) / 2, nd * (len / 2 - 0.7));
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
