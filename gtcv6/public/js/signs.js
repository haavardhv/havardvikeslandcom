// Shop signs: every named shop, café, restaurant, pub and pharmacy in OpenStreetMap gets its
// name on a sign over the street front of the building it is in (tools/build_map.py exports
// them). A few chains get their own colours; the rest are coloured by what they are. The names
// are painted into two texture atlases, so all the signs in town are two draw calls, and they
// light up at night.
import * as THREE from '../vendor/three.module.min.js';
import { PolyWorld } from './city.js';

const FONT = '"Archivo", "Arial Narrow", sans-serif';
// chain colours: background, text, and an optional accent stripe
const BRANDS = {
  'rema 1000': ['#1f3fa6', '#ffffff', '#e1251b'], 'kiwi': ['#5fa832', '#ffffff'], '7-eleven': ['#ffffff', '#0b7a44', '#f37021'],
  'meny': ['#d9131f', '#ffffff'], "mcdonald's": ['#d52b1e', '#ffc72c'], 'burger king': ['#f5ebdc', '#d62300', '#502314'],
  'starbucks': ['#00704a', '#ffffff'], 'h&m': ['#ffffff', '#e50010'], 'clas ohlson': ['#1c3f7c', '#ffffff'], 'posten': ['#e32d22', '#ffffff'],
  'narvesen': ['#18328f', '#ffffff', '#f26522'], 'espresso house': ['#4a2a22', '#ffffff'], 'deli de luca': ['#e2661c', '#ffffff'],
  'bunnpris': ['#e2001a', '#ffffff', '#ffd400'], 'extra': ['#ffd400', '#d6001c'], 'joe & the juice': ['#1a1a1a', '#f2a7b7'],
};
const KIND = (k) => k === 'restaurant' ? ['#5c1f1f', '#f3e6c8'] : k === 'cafe' ? ['#23392c', '#f1ead8'] : k === 'bar' || k === 'pub' || k === 'nightclub' ? ['#2a1b14', '#e8c27a']
  : k === 'fast_food' ? ['#b8341f', '#ffffff'] : k === 'pharmacy' ? ['#1f7a4b', '#ffffff'] : k === 'bank' ? ['#1d2c4a', '#ffffff']
  : k === 'shop:hairdresser' || k === 'shop:beauty' ? ['#f1ece6', '#2b2b2b'] : k === 'shop:bakery' ? ['#7a4a26', '#fbe9c8']
  : k === 'shop:books' ? ['#16324f', '#f4efe2'] : k === 'shop:clothes' || k === 'shop:shoes' ? ['#141414', '#f2f2f2'] : ['#26313a', '#f2efe6'];

export function buildShopSigns(scene, map, { terrain, polys, onRoad }) {
  const shops = (map.shops || []).slice();
  // chains and food first, then everything else, nearest the centre first
  const rank = (s) => (BRANDS[(s.b || s.n).toLowerCase()] ? 0 : /restaurant|cafe|bar|pub|fast_food|bakery/.test(s.k) ? 1 : 2) * 10000 + Math.hypot(s.x + 400, s.z + 100);
  shops.sort((a, b) => rank(a) - rank(b));
  const CW = 384, CH = 48, COLS = 5, ROWS = 42, PER = COLS * ROWS;
  const atlases = [];
  const newAtlas = () => { const c = document.createElement('canvas'); c.width = CW * COLS; c.height = CH * ROWS; const a = { c, g: c.getContext('2d'), n: 0, p: [], u: [], nr: [] }; atlases.push(a); return a; };
  const placed = [], chains = [];
  const tmp = { x: 0, z: 0 };
  for (const s of shops) {
    if (placed.length >= PER * 2) break;
    // the building it is in, or the nearest one
    let best = null;
    for (const it of polys.query(s.x - 12, s.z - 12, s.x + 12, s.z + 12)) {
      if (it.tree || it.noCam || !it.kind) continue;
      const rings = it.rings || [it.pts];
      for (const p of rings) for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        const ax = p[j], az = p[j + 1], bx = p[i], bz = p[i + 1], L = Math.hypot(bx - ax, bz - az);
        if (L < 2.4) continue;
        const dx = (bx - ax) / L, dz = (bz - az) / L;
        let nx = dz, nz = -dx;
        if (PolyWorld.insideItem(it, (ax + bx) / 2 + nx * 0.2, (az + bz) / 2 + nz * 0.2)) { nx = -nx; nz = -nz; }
        const t = Math.max(1.2, Math.min(L - 1.2, (s.x - ax) * dx + (s.z - az) * dz));
        const px = ax + dx * t, pz = az + dz * t;
        // only a wall on a street, with nothing in front of it
        if (!onRoad(px + nx * 2.2, pz + nz * 2.2) && !onRoad(px + nx * 4, pz + nz * 4)) continue;
        if (polys.nearBuilding(px + nx * 1.2, pz + nz * 1.2, 0.6)) continue;
        const d = Math.hypot(s.x - px, s.z - pz) + (PolyWorld.insideItem(it, s.x, s.z) ? 0 : 4);
        if (!best || d < best.d) best = { d, px, pz, dx, dz, nx, nz, L, t };
      }
    }
    if (!best || best.d > 16) continue;
    if (placed.some(q => Math.hypot(q[0] - best.px, q[1] - best.pz) < 3.2)) continue;
    placed.push([best.px, best.pz]);
    const a = atlases.length && atlases[atlases.length - 1].n < PER ? atlases[atlases.length - 1] : newAtlas();
    const k = a.n++, cx = (k % COLS) * CW, cy = Math.floor(k / COLS) * CH, g = a.g;
    const brand = BRANDS[(s.b || s.n).toLowerCase()];
    const [bg, fg, acc] = brand || KIND(s.k.replace('shop:', 'shop:'));
    g.fillStyle = bg; g.fillRect(cx, cy, CW, CH);
    const bkey = (s.b || s.n).toLowerCase();
    if (bkey === '7-eleven') ['#f37021', '#ee2526', '#008163'].forEach((c2, i) => { g.fillStyle = c2; g.fillRect(cx, cy + CH - 15 + i * 5, CW, 5); });
    else if (acc) { g.fillStyle = acc; g.fillRect(cx, cy + CH - 7, CW, 7); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.strokeRect(cx + 1.5, cy + 1.5, CW - 3, CH - 3);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    // a chain's fascia says the chain, not the branch ("7-Eleven Torget" is just 7-ELEVEn)
    const BRAND_TEXT = { '7-eleven': '7-ELEVEn', kiwi: 'kiwi', 'rema 1000': 'REMA 1000', narvesen: 'NARVESEN', meny: 'MENY', 'h&m': 'H&M', extra: 'Extra', bunnpris: 'Bunnpris', posten: 'Posten' };
    const text = brand ? (BRAND_TEXT[bkey] || s.b || s.n) : s.n.toUpperCase();
    if (bkey === 'narvesen') {
      // the dark-blue oval, green on the left and orange on the right
      g.fillStyle = '#0f1d4a'; g.fillRect(cx, cy, CW, CH);
      const ox = cx + CW / 2, oy = cy + CH / 2, rx = CW * 0.3, ry = CH * 0.42;
      g.fillStyle = '#18328f'; g.beginPath(); g.ellipse(ox, oy, rx, ry, 0, 0, 7); g.fill();
      g.lineWidth = 4; g.strokeStyle = '#3fb24a'; g.beginPath(); g.ellipse(ox, oy, rx, ry, 0, Math.PI * 0.55, Math.PI * 1.45); g.stroke();
      g.strokeStyle = '#f26522'; g.beginPath(); g.ellipse(ox, oy, rx, ry, 0, -Math.PI * 0.45, Math.PI * 0.45); g.stroke();
    }
    g.fillStyle = fg;
    let size = 32; do { g.font = `800 ${size}px ${FONT}`; size -= 1; } while (g.measureText(text).width > (bkey === 'narvesen' ? CW * 0.5 : CW - 24) && size > 12);
    g.fillText(text, cx + CW / 2, cy + CH / 2 + 2);
    // the sign: the part of the cell the name fills, 50 cm high, over the shopfront
    // a chain gets a fascia across its shopfront (the whole cell, up to 6.4 x 0.8 m); the rest a
    // name board as long as the name
    const tw = brand ? CW : Math.min(CW, g.measureText(text).width + 28);
    const h = brand ? Math.min(0.8, (best.L - 0.5) / 8) : 0.5;
    const width = brand ? h * 8 : Math.min(best.L - 0.5, tw / CH * h);
    const gy = terrain.height(best.px + best.nx * 1.2, best.pz + best.nz * 1.2), y0 = gy + 2.82, out = 0.1;
    const ox = best.px + best.nx * out, oz = best.pz + best.nz * out, hx = best.dx * width / 2, hz = best.dz * width / 2;
    const u0 = (cx + CW / 2 - tw / 2) / a.c.width, u1 = (cx + CW / 2 + tw / 2) / a.c.width, v0 = 1 - (cy + CH) / a.c.height, v1 = 1 - cy / a.c.height;
    // the text reads left to right when you face the wall
    const L0 = [ox + hx, y0, oz + hz], R0 = [ox - hx, y0, oz - hz];
    const sx = (best.nx * best.dz - best.nz * best.dx) > 0;
    const A = sx ? L0 : R0, B = sx ? R0 : L0;
    if (brand) chains.push({ n: s.n, x: best.px, z: best.pz, nx: best.nx, nz: best.nz });
    const quad = [A, B, [B[0], y0 + h, B[2]], [A[0], y0 + h, A[2]]], uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (const i of [0, 1, 2, 0, 2, 3]) { a.p.push(...quad[i]); a.u.push(...uv[i]); a.nr.push(best.nx, 0, best.nz); }
  }
  const mats = [];
  for (const a of atlases) {
    const t = new THREE.CanvasTexture(a.c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.05, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6, side: THREE.DoubleSide });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(a.nr, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(a.u, 2));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, m); mesh.matrixAutoUpdate = false; mesh.receiveShadow = true;
    scene.add(mesh); mats.push(m);
  }
  return { count: placed.length, chains, update(lamp) { for (const m of mats) m.emissiveIntensity = 0.05 + 0.75 * lamp; } };
}
