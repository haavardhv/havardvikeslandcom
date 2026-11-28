// What stands in the street: the kiosks (OpenStreetMap's building=kiosk, with the shop inside them
// named on their sign; Rundetårn, the round 1929 kiosk on Vågsallmenningen, after its own
// shape), the bus stops with their shelters, and the city-bike stations.
// prepareStreet(map) takes the kiosks out of the generic builder; buildStreet() models them.
import * as THREE from '../vendor/three.module.min.js';
import { Geo } from './engine.js';

const FONT = '"Archivo", "Arial Narrow", sans-serif';
// kiosk chains: fascia colour, lettering, and an accent
export const KIOSK_BRANDS = {
  // after photos: a dark-blue oval with white NARVESEN, a green swoosh on the left and orange on the right
  narvesen: { bg: '#0f1d4a', fg: '#ffffff', acc: '#f26522', text: 'NARVESEN', oval: true },
  '7-eleven': { bg: '#ffffff', fg: '#008163', acc: '#f37021', text: '7-ELEVEn', stripes: ['#f37021', '#ee2526', '#008163'] },
  'deli de luca': { bg: '#1c1c1c', fg: '#f6a800', acc: '#f6a800', text: 'Deli de Luca' },
  default: { bg: '#2b3a44', fg: '#f4efe2', acc: '#c9a23a', text: 'KIOSK' },
};

const centroid = (p) => { let x = 0, z = 0; const n = p.length / 2; for (let i = 0; i < n; i++) { x += p[i * 2]; z += p[i * 2 + 1]; } return [x / n, z / n]; };

export function prepareStreet(map) {
  const kiosks = [];
  for (const b of map.buildings) if (b.k === 'kiosk' && !b.skip) { b.skip = true; kiosks.push(b); }
  return { kiosks };
}

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function fasciaTex(brand, name) {
  return tex(1024, 128, (g, w, h) => {
    g.fillStyle = brand.bg; g.fillRect(0, 0, w, h);
    if (brand.stripes) brand.stripes.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, h * (0.66 + i * 0.11), w, h * 0.11); });
    else { g.fillStyle = brand.acc; g.fillRect(0, h - 10, w, 10); }
    g.fillStyle = brand.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const text = name || brand.text;
    let s = 84; do { g.font = `900 ${s}px ${FONT}`; s -= 2; } while (g.measureText(text).width > w * 0.42 && s > 20);
    // the name twice along the band, so it shows from either side of a corner
    for (const x of [w * 0.25, w * 0.75]) {
      if (brand.oval) {
        const rx = w * 0.2, ry = h * 0.4;
        g.fillStyle = '#18328f'; g.beginPath(); g.ellipse(x, h / 2, rx, ry, 0, 0, 7); g.fill();
        g.lineWidth = 9; g.strokeStyle = '#3fb24a'; g.beginPath(); g.ellipse(x, h / 2, rx, ry, 0, Math.PI * 0.55, Math.PI * 1.45); g.stroke();
        g.strokeStyle = '#f26522'; g.beginPath(); g.ellipse(x, h / 2, rx, ry, 0, -Math.PI * 0.45, Math.PI * 0.45); g.stroke();
        g.fillStyle = brand.fg; let z = 54; do { g.font = `900 ${z}px ${FONT}`; z -= 2; } while (g.measureText(text).width > rx * 1.6); g.fillText(text, x, h / 2 + 3);
      } else g.fillText(text, x, brand.stripes ? h * 0.36 : h * 0.47);
    }
  });
}

export function buildStreet(scene, map, S, { terrain, polys, onRoad }) {
  const ground = (x, z) => terrain.height(x, z);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
  const glow = [];
  const G = new Geo();
  const roofM = std({ color: 0x3a3d41 }), frameM = std({ color: 0x2a2d30, metalness: 0.4, roughness: 0.5 });
  const glassT = tex(256, 128, (g, w, h) => {
    g.fillStyle = '#ffe3a8'; g.fillRect(0, 0, w, h);
    // shelves of papers, sweets and drinks behind the glass
    const cols = ['#d23b2a', '#2a63b8', '#f2c12e', '#3b8f4a', '#f4f1ea', '#8a3fa0'];
    let k = 0;
    for (let y = 10; y < h - 10; y += 26) for (let x = 6; x < w - 6; x += 14) { g.fillStyle = cols[(k++ * 7) % cols.length]; g.fillRect(x, y, 11, 18); }
    g.fillStyle = 'rgba(40,40,40,0.5)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 4, h);
  });
  glassT.wrapS = THREE.RepeatWrapping;
  const glassM = std({ map: glassT, emissive: 0xffffff, emissiveMap: glassT, emissiveIntensity: 0.2, roughness: 0.15 });
  glow.push([glassM, 0.15, 0.9]);
  // a food kiosk's window: menu boards along the top, a warm counter with the grill behind it
  const foodT = tex(256, 128, (g, w, h) => {
    g.fillStyle = '#ffd99a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f1f1f'; for (let x = 8; x < w; x += 62) g.fillRect(x, 6, 56, 34);
    g.fillStyle = '#f4e9d0'; for (let x = 8; x < w; x += 62) for (let y = 12; y < 38; y += 7) g.fillRect(x + 6, y, 30 + (x % 3) * 4, 2);
    g.fillStyle = '#c0392b'; for (let x = 8; x < w; x += 62) g.fillRect(x + 42, 12, 8, 6);
    g.fillStyle = '#9aa0a5'; g.fillRect(0, 70, w, 10); g.fillStyle = '#e8e2d4'; g.fillRect(0, 80, w, h - 80);
    g.fillStyle = 'rgba(40,40,40,0.5)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 4, h);
  });
  foodT.wrapS = THREE.RepeatWrapping;
  const foodM = std({ map: foodT, emissive: 0xffffff, emissiveMap: foodT, emissiveIntensity: 0.2, roughness: 0.15 });
  glow.push([foodM, 0.15, 0.9]);
  const shops = map.shops || [];

  // ------------------------------------------------ kiosks
  for (const b of S.kiosks) {
    const [cx, cz] = centroid(b.p), gy = ground(cx, cz);
    if (b.bc === '' && shops.some(s => /trekroneren|3-kroneren/i.test(s.n) && Math.hypot(s.x - cx, s.z - cz) < 6)) continue;
    // the shop inside it, if OpenStreetMap knows one
    const inside = shops.filter(s => Math.hypot(s.x - cx, s.z - cz) < 8 && /kiosk|newsagent|convenience|fast_food|cafe|ice_cream/.test(s.k)).sort((a, c) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(c.x - cx, c.z - cz))[0];
    const key = inside ? (Object.keys(KIOSK_BRANDS).find(k => (inside.b || inside.n).toLowerCase().includes(k)) || 'default') : 'default';
    const brand = KIOSK_BRANDS[key];
    const name = key === 'default' && inside ? inside.n : null;
    const fascia = std({ map: fasciaTex(brand, name), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.0 });
    fascia.emissiveMap = fascia.map; glow.push([fascia, 0.05, 0.8]);
    const wallM = std({ color: b.bc === 'chestnut' ? 0x6b3f2a : 0xd9d4c7, roughness: 0.8 });
    const winM = inside && /fast_food|cafe|ice_cream/.test(inside.k) ? foodM : glassM;
    const n = b.p.length / 2;
    // Rundetårn: round, chestnut-brown boards, a ring of service windows, a flat roof disc
    let area = 0; for (let i = 0, j = n - 1; i < n; j = i++) area += b.p[j * 2] * b.p[i * 2 + 1] - b.p[i * 2] * b.p[j * 2 + 1];
    area = Math.abs(area) / 2;
    let maxR = 0; for (let i = 0; i < n; i++) maxR = Math.max(maxR, Math.hypot(b.p[i * 2] - cx, b.p[i * 2 + 1] - cz));
    const round = n >= 10 && Math.PI * maxR * maxR < area * 1.35;
    const H = 3.1;
    if (round) {
      const r = Math.sqrt(area / Math.PI);
      const cyl = (mat, y0, h, rr, open = false, seg = 28) => { const g = new THREE.CylinderGeometry(rr, rr, h, seg, 1, open); g.translate(0, h / 2, 0); G.geom(mat, g, new THREE.Matrix4().makeTranslation(cx, y0, cz)); };
      cyl(wallM, gy - 0.5, 1.5, r);
      cyl(winM, gy + 1.0, 1.25, r - 0.02, true);
      cyl(fascia, gy + 2.25, 0.75, r + 0.02, true);
      const disc = new THREE.CylinderGeometry(r + 0.6, r + 0.6, 0.2, 28); disc.translate(0, gy + 3.1, 0);
      G.geom(roofM, disc, new THREE.Matrix4().makeTranslation(cx, 0, cz));
    } else {
      // a rectangle-ish kiosk: walls up to the counter, service windows, the fascia, a roof with an overhang
      for (let i = 0; i < n; i++) {
        const ax = b.p[i * 2], az = b.p[i * 2 + 1], bx = b.p[((i + 1) % n) * 2], bz = b.p[((i + 1) % n) * 2 + 1], L = Math.hypot(bx - ax, bz - az);
        if (L < 0.05) continue;
        let nx = (bz - az) / L, nz = -(bx - ax) / L;
        if ((ax + bx) / 2 * nx + (az + bz) / 2 * nz < cx * nx + cz * nz) { nx = -nx; nz = -nz; }
        const quad = (mat, y0, y1, uv) => G.quad(mat, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], uv, [nx, 0, nz]);
        quad(wallM, gy - 0.5, gy + 1.0, [[0, 0], [L, 0], [L, 1.5], [0, 1.5]]);
        quad(winM, gy + 1.0, gy + 2.3, [[0, 0], [L / 4, 0], [L / 4, 1], [0, 1]]);
        quad(fascia, gy + 2.3, gy + 3.0, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      }
      const shape = new THREE.Shape(); for (let i = 0; i < n; i++) { const x = b.p[i * 2], z = b.p[i * 2 + 1]; if (i) shape.lineTo(x - cx, -(z - cz)); else shape.moveTo(x - cx, -(z - cz)); }
      const roof = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false }); roof.rotateX(-Math.PI / 2); roof.scale(1.18, 1, 1.18);
      G.geom(roofM, roof, new THREE.Matrix4().makeTranslation(cx, gy + 3.0, cz));
    }
    polys.add(Float32Array.from(b.p), gy - 1, gy + H, { kind: 'flat' });
  }

  // ------------------------------------------------ bus stops: a pole with the stop sign, and a glass shelter where OSM says there is one
  {
    const signT = tex(128, 128, (g, w, h) => {
      g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d4f9c'; g.fillRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(24, 34, 80, 50, 8); g.fill();
      g.fillStyle = '#1d4f9c'; g.fillRect(32, 42, 64, 18); g.beginPath(); g.arc(40, 88, 8, 0, 7); g.arc(88, 88, 8, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(40, 88, 4, 0, 7); g.arc(88, 88, 4, 0, 7); g.fill();
    });
    const signM = std({ map: signT });
    const poleM = std({ color: 0x8a9095, metalness: 0.6, roughness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xcfe0e8, roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false });
    const nameCache = new Map();
    for (const s of map.stops || []) {
      const gy = ground(s.x, s.z);
      // which way the road is: the shelter's open side faces it
      let best = null;
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a); for (const d of [2, 3.5, 5]) if (onRoad(s.x + dx * d, s.z + dz * d) === 'road') { if (!best || d < best.d) best = { d, dx, dz }; break; } }
      const dx = best ? best.dx : 0, dz = best ? best.dz : 1, ang = Math.atan2(dx, dz);
      G.obox(poleM, s.x + dx * 0.6, gy + 1.4, s.z + dz * 0.6, 0.07, 2.8, 0.07, 0, ang, 0);
      G.obox(signM, s.x + dx * 0.6, gy + 2.6, s.z + dz * 0.6, 0.5, 0.5, 0.04, 0, ang + Math.PI / 2, 0);
      if (s.n) {
        if (!nameCache.has(s.n)) nameCache.set(s.n, std({ map: tex(512, 64, (g, w, h) => { g.fillStyle = '#1b1e22'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; let z = 40; do { g.font = `800 ${z}px ${FONT}`; z -= 2; } while (g.measureText(s.n).width > w - 20); g.fillText(s.n, w / 2, h / 2 + 2); }) }));
        G.obox(nameCache.get(s.n), s.x + dx * 0.6, gy + 2.22, s.z + dz * 0.6, 0.9, 0.12, 0.03, 0, ang + Math.PI / 2, 0);
      }
      if (s.sh && !polys.nearBuilding(s.x - dx * 1.2, s.z - dz * 1.2, 0.8)) {
        const bx = s.x - dx * 0.6, bz = s.z - dz * 0.6, tx = dz, tz = -dx;
        for (const e of [-1.6, 1.6]) G.obox(frameM, bx + tx * e - dx * 0.55, gy + 1.2, bz + tz * e - dz * 0.55, 0.08, 2.4, 0.08, 0, ang, 0);
        G.obox(roofM, bx, gy + 2.45, bz, 3.6, 0.1, 1.5, 0, ang + Math.PI / 2, 0);
        const back = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.9, 0.03), glass); back.position.set(bx - dx * 0.6, gy + 1.25, bz - dz * 0.6); back.rotation.y = ang; scene.add(back);
        G.obox(std({ color: 0x9b6a3c }), bx - dx * 0.35, gy + 0.46, bz - dz * 0.35, 1.8, 0.06, 0.35, 0, ang + Math.PI / 2, 0);
        polys.add(Float32Array.from([bx - 0.2, bz - 0.2, bx + 0.2, bz - 0.2, bx + 0.2, bz + 0.2, bx - 0.2, bz + 0.2]), gy - 1, gy + 2.5, { tree: true, noCam: true });
      }
    }
  }

  // ------------------------------------------------ the city-bike stations: a row of docks with bikes in them
  {
    const dockM = std({ color: 0x2b2f33, metalness: 0.4 }), bikeM = std({ color: 0x1e5aa8, roughness: 0.5 }), tyreM = std({ color: 0x151617 });
    for (const bs of map.bikes || []) {
      const gy = ground(bs.x, bs.z);
      // the row runs along the nearest street
      let dir = [1, 0];
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI, dx = Math.sin(a), dz = Math.cos(a); if (onRoad(bs.x - dz * 3, bs.z + dx * 3) || onRoad(bs.x + dz * 3, bs.z - dx * 3)) { dir = [dx, dz]; break; } }
      const ang = Math.atan2(dir[0], dir[1]), n = Math.min(10, Math.max(4, Math.round(bs.c / 2)));
      for (let k = 0; k < n; k++) {
        const o = (k - (n - 1) / 2) * 0.85, x = bs.x + dir[0] * o, z = bs.z + dir[1] * o, y = ground(x, z);
        if (polys.nearBuilding(x, z, 0.5)) continue;
        G.obox(dockM, x, y + 0.45, z, 0.12, 0.9, 0.2, 0, ang, 0);
        if (k % 3 === 2) continue;                                   // an empty dock now and then
        // the bike: two wheels, a frame, a basket
        // the bike stands across the row: local z is its length
        const M = (lx, ly, lz) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(ang + Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(lx, ly, lz));
        for (const w of [-0.55, 0.55]) { const g = new THREE.TorusGeometry(0.3, 0.04, 6, 14); g.rotateY(Math.PI / 2); G.geom(tyreM, g, M(0, 0.32, w)); }
        G.geom(bikeM, new THREE.BoxGeometry(0.06, 0.08, 1.0), M(0, 0.6, 0));
        G.geom(bikeM, new THREE.BoxGeometry(0.06, 0.5, 0.06), M(0, 0.62, 0.45));
        G.geom(bikeM, new THREE.BoxGeometry(0.32, 0.2, 0.26), M(0, 0.9, 0.62));
      }
      polys.add(Float32Array.from([bs.x - 0.3, bs.z - 0.3, bs.x + 0.3, bs.z - 0.3, bs.x + 0.3, bs.z + 0.3, bs.x - 0.3, bs.z + 0.3]), gy - 1, gy + 1, { tree: true, noCam: true });
    }
  }

  // ------------------------------------------------ the trolleybus's overhead line (line 2)
  // A pair of wires 60 cm apart, 5.8 m over the street (a pair each way on two-way streets),
  // hung every 30 m from a span wire across the street, fixed to the facades where there are
  // walls close by, and to a grey pole where there are not.
  {
    const wires = [], spans = [];
    const poleM = std({ color: 0x7d8388, metalness: 0.5, roughness: 0.5 });
    const H = 5.8;
    for (const r of map.trolley || []) {
      const p = r.p, lanes = r.o ? [0] : [-r.w / 4, r.w / 4];
      // the wires: points every 8 m or less along the street, their heights smoothed so they
      // follow the street up and down without kinks where the ground jumps
      {
        const pts = [];
        for (let i = 0; i < p.length - 2; i += 2) {
          const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az);
          if (L < 0.05) continue;
          const n = Math.max(1, Math.ceil(L / 8));
          for (let k = 0; k < n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n, (bx - ax) / L, (bz - az) / L]);
          if (i + 4 >= p.length) pts.push([bx, bz, (bx - ax) / L, (bz - az) / L]);
        }
        const hs = pts.map(q => ground(q[0], q[1]));
        for (let it = 0; it < 4; it++) for (let i = 1; i < hs.length - 1; i++) hs[i] = (hs[i - 1] + 2 * hs[i] + hs[i + 1]) / 4;
        for (let i = 0; i < pts.length - 1; i++) for (const lane of lanes) for (const w of [-0.3, 0.3]) {
          const [x0, z0, dx0, dz0] = pts[i], [x1, z1, dx1, dz1] = pts[i + 1], o = lane + w;
          wires.push(x0 - dz0 * o, hs[i] + H, z0 + dx0 * o, x1 - dz1 * o, hs[i + 1] + H, z1 + dx1 * o);
        }
      }
      let acc = 15;
      for (let i = 0; i < p.length - 2; i += 2) {
        const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az);
        if (L < 0.05) continue;
        const dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz, nz = dx;
        // span wires
        for (let t = acc; t < L; t += 30) {
          const cx = ax + dx * t, cz = az + dz * t, gy = ground(cx, cz);
          const ends = [];
          for (const sd of [1, -1]) {
            const c = polys.clearance(cx, cz, nx * sd, nz * sd, 14);
            if (c < 14) ends.push([cx + nx * sd * (c - 0.05), cz + nz * sd * (c - 0.05), gy + H + 1.0]);
            else {
              // no wall: a pole at the edge of the street
              const off = r.w / 2 + 0.6, px = cx + nx * sd * off, pz = cz + nz * sd * off, py = ground(px, pz);
              G.obox(poleM, px, py + 3.9, pz, 0.22, 7.8, 0.22, 0, 0, 0);
              polys.add(Float32Array.from([px - 0.12, pz - 0.12, px + 0.12, pz - 0.12, px + 0.12, pz + 0.12, px - 0.12, pz + 0.12]), py - 1, py + 7.8, { tree: true, noCam: true });
              ends.push([px, pz, py + 7.3]);
            }
          }
          spans.push(ends[0][0], ends[0][2], ends[0][1], cx, gy + H + 0.45, cz, cx, gy + H + 0.45, cz, ends[1][0], ends[1][2], ends[1][1]);
          // the hangers down to the wires
          for (const lane of lanes) { const hx = cx + nx * lane, hz = cz + nz * lane; spans.push(hx, gy + H + 0.45, hz, hx, gy + H, hz); }
        }
        acc = Math.max(0, 30 - ((L - acc) % 30));
      }
    }
    // a line 2 trolleybus waiting at a stop or two on the wires, in Skyss livery after photos:
    // orange roof and front, white sides, a black window band, its two poles up to the wires
    {
      const hex = '#e4532a';
      const side = tex(512, 128, (g, w, h) => {
        g.fillStyle = '#eeeff0'; g.fillRect(0, 0, w, h);
        g.fillStyle = hex; g.fillRect(0, 0, w, h * 0.12);
        g.fillStyle = '#121518'; g.fillRect(0, h * 0.16, w, h * 0.42);
        g.fillStyle = 'rgba(160,180,195,0.18)'; g.fillRect(0, h * 0.16, w, h * 0.12);
        g.fillStyle = '#2f3438'; for (const x of [w * 0.1, w * 0.55]) g.fillRect(x, h * 0.14, w * 0.09, h * 0.8);
        g.fillStyle = '#16191c'; for (const x of [w * 0.3, w * 0.82]) { g.beginPath(); g.arc(x, h, h * 0.2, Math.PI, 0); g.fill(); }
        g.fillStyle = hex; g.font = '700 16px Archivo, sans-serif'; g.fillText('skyss', w * 0.66, h * 0.8);
      });
      const front = tex(256, 256, (g, w, h) => {
        g.fillStyle = hex; g.fillRect(0, 0, w, h);
        g.fillStyle = '#101315'; g.fillRect(14, 10, w - 28, 140);
        g.fillStyle = '#ffd200'; g.font = '700 26px Archivo, sans-serif'; g.textAlign = 'center'; g.fillText('2  Sentrum', w / 2, 40);
        g.fillStyle = '#fff3d8'; for (const x of [40, w - 40]) { g.beginPath(); g.arc(x, 200, 9, 0, 7); g.fill(); }
        g.fillStyle = '#ffffff'; g.font = '700 20px Archivo, sans-serif'; g.fillText('skyss', w / 2, 230);
      });
      const rear = tex(128, 128, (g, w, h) => { g.fillStyle = hex; g.fillRect(0, 0, w, h); g.fillStyle = '#121518'; g.fillRect(10, 8, w - 20, 50); g.fillStyle = '#ff2a1a'; for (const x of [16, w - 16]) g.fillRect(x - 6, 80, 12, 22); g.fillStyle = '#eeeff0'; g.fillRect(0, 108, w, 20); });
      const rearM = std({ map: rear });
      const sideM = std({ map: side }), frontM = std({ map: front, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: 0.1 }), orangeM = std({ color: 0xe4532a }), darkM = std({ color: 0x1b1e21 });
      const onLine = (x, z) => { for (const r of map.trolley || []) for (let i = 0; i < r.p.length - 2; i += 2) { const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3], L = Math.hypot(bx - ax, bz - az) || 1, t = Math.max(0, Math.min(L, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L)), px = ax + (bx - ax) * t / L, pz = az + (bz - az) * t / L; if (Math.hypot(x - px, z - pz) < 9) return { px, pz, dx: (bx - ax) / L, dz: (bz - az) / L, w: r.w, o: r.o }; } return null; };
      let placedBus = 0;
      for (const st of map.stops || []) {
        if (placedBus >= 2) break;
        const ln = onLine(st.x, st.z);
        if (!ln) continue;
        // in the lane on the stop's side
        const nx = -ln.dz, nz = ln.dx, sd = Math.sign((st.x - ln.px) * nx + (st.z - ln.pz) * nz) || 1, lane = ln.o ? 0 : sd * ln.w / 4;
        const cx = ln.px + nx * lane, cz = ln.pz + nz * lane, ang = Math.atan2(ln.dx, ln.dz);
        if (polys.nearBuilding(cx, cz, 1.6)) continue;
        placedBus++;
        const bus = new THREE.Group(), gy = ground(cx, cz);
        for (const [len, z0] of [[11, 3.5], [7, -6.2]]) {
          const body = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.85, len), [sideM, sideM, orangeM, darkM, z0 > 0 ? frontM : darkM, z0 > 0 ? darkM : rearM]);
          body.position.set(0, 0.35 + 1.42, z0); body.castShadow = true; bus.add(body);
        }
        const joint = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.7, 1.0), darkM); joint.position.set(0, 1.75, -2.25); bus.add(joint);
        // the trolley poles, from the back of the roof up to the wires
        for (const w of [-0.3, 0.3]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6.4, 5), darkM); pole.position.set(w, 3.2 + 1.3, -5.0 + 2.9); pole.rotation.x = -1.15; bus.add(pole); }
        bus.position.set(cx, gy, cz); bus.rotation.y = ang;
        scene.add(bus);
        const c = Math.cos(ang), sn = Math.sin(ang), pts = [];
        for (const [u, v] of [[-1.3, -9.7], [1.3, -9.7], [1.3, 9.0], [-1.3, 9.0]]) pts.push(cx + u * c + v * sn, cz - u * sn + v * c);
        polys.add(Float32Array.from(pts), gy - 0.5, gy + 3.2, { kind: 'flat', walk: true });
      }
    }
    const lm = new THREE.LineBasicMaterial({ color: 0x24272a });
    for (const arr of [wires, spans]) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      scene.add(new THREE.LineSegments(g, lm));
    }
  }

  // ------------------------------------------------ outdoor pools (Nordnes sjøbad): turquoise water with a white edge
  {
    const poolM = new THREE.MeshStandardMaterial({ color: 0x3fb7c4, roughness: 0.08, metalness: 0.1 }), edgeM = std({ color: 0xf2f0ea, roughness: 0.6 });
    for (const p of map.pools || []) {
      const n = p.length / 2;
      let gy = Infinity; for (let i = 0; i < n; i++) gy = Math.min(gy, ground(p[i * 2], p[i * 2 + 1]));
      gy = Math.max(gy, 0.3);                           // a sea-water pool by the fjord stays above the sea
      const sh = new THREE.Shape(); for (let i = 0; i < n; i++) (i ? sh.lineTo : sh.moveTo).call(sh, p[i * 2], -p[i * 2 + 1]);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), poolM); m.rotation.x = -Math.PI / 2; m.position.y = gy + 0.12; m.receiveShadow = true; scene.add(m);
      for (let i = 0; i < n; i++) {
        const ax = p[i * 2], az = p[i * 2 + 1], bx = p[((i + 1) % n) * 2], bz = p[((i + 1) % n) * 2 + 1], L = Math.hypot(bx - ax, bz - az);
        if (L < 0.1) continue;
        G.obox(edgeM, (ax + bx) / 2, gy + 0.05, (az + bz) / 2, L + 0.4, 0.35, 0.4, 0, Math.atan2(bx - ax, bz - az) + Math.PI / 2, 0);
      }
    }
  }

  G.build(scene);
  return { update(lamp) { for (const [m, d, n] of glow) m.emissiveIntensity = d + (n - d) * lamp; } };
}
