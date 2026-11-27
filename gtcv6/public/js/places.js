// The places that matter to the people at no. 6, dressed after photos: Guangdong House and
// Rema 1000 on Marken, Johnny's on Kong Oscars gate, and the Trekroneren kiosk. Each is built
// on the street side of its building from the OpenStreetMap outline, with signs and windows
// painted on canvases. What glows at night (signs, lanterns, lit windows) is listed in `glow`
// and turned up by update(lamp).
import * as THREE from '../vendor/three.module.min.js';

// Before the town is built: find each place's building and give it its real colours (or, for
// the Trekroneren kiosk, which has its own model, leave it out).
export function stylePlaceBuildings(map) {
  const found = {};
  for (const pl of map.places || []) {
    const i = map.buildings.findIndex(b => inside(b.p, pl.x, pl.z));
    if (i < 0) continue;
    const b = map.buildings[i];
    found[pl.k] = b;
    // bareBelow: the generated windows and door stay off the ground floor, where the dressing
    // below is (otherwise the two would sit a centimetre apart and flicker)
    if (pl.k === 'food') Object.assign(b, { c: '#9d3328', s: 'p', shop: 0, bareBelow: 4.3 });     // the red house on Marken
    if (pl.k === 'shop') Object.assign(b, { c: '#efede6', rc: '#a5462f', s: 'p', shop: 0, bareBelow: 4.6 });   // white, red tiles
    if (pl.k === 'pizza') Object.assign(b, { c: '#e7dec8', s: 'p', shop: 0, bareBelow: 4.6 });   // cream, Jugendstil
    if (pl.k === 'hotdog') b.skip = true;                                                        // the kiosk is built below
  }
  return found;
}

function inside(p, x, z) {
  let c = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}

// ---------------------------------------------------------------------------- canvas helpers
const tex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
const FONT = '"Archivo", "Arial Narrow", sans-serif';
function fitText(g, text, x, y, maxW, size, weight = 800) {
  let s = size;
  do { g.font = `${weight} ${s}px ${FONT}`; s -= 2; } while (g.measureText(text).width > maxW && s > 8);
  g.fillText(text, x, y);
}

// ---------------------------------------------------------------------------- the street side
// The wall of the outline nearest the place's map point that faces a street; returns a frame on
// it: origin at the point on the wall, `t` along it, `n` out into the street, and the ground.
function facade(b, x, z, terrain, onRoad) {
  const p = b.p, n = p.length / 2;
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[i * 2]; cz += p[i * 2 + 1]; }
  cx /= n; cz /= n;
  let best = null;
  for (let i = 0; i < n; i++) {
    const ax = p[i * 2], az = p[i * 2 + 1], bx = p[((i + 1) % n) * 2], bz = p[((i + 1) % n) * 2 + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 2.5) continue;
    const tx = (bx - ax) / L, tz = (bz - az) / L;
    let nx = tz, nz = -tx;
    if ((ax + bx) / 2 * nx + (az + bz) / 2 * nz - (cx * nx + cz * nz) < 0) { nx = -nx; nz = -nz; }
    const s = Math.max(0, Math.min(L, (x - ax) * tx + (z - az) * tz));
    const px = ax + tx * s, pz = az + tz * s;
    const street = onRoad(px + nx * 2.5, pz + nz * 2.5) ? 0 : 6;     // prefer walls on a street
    const d = Math.hypot(x - px, z - pz) + street;
    if (!best || d < best.d) best = { d, ax, az, tx, tz, nx, nz, L, s };
  }
  const { ax, az, tx, tz, nx, nz, L } = best;
  // keep the dressing on the wall
  const s = Math.max(Math.min(best.s, L - 3.2), 3.2 > L / 2 ? L / 2 : 3.2);
  const ox = ax + tx * s, oz = az + tz * s;
  return { ox, oz, tx, tz, nx, nz, L, s, ground: terrain.height(ox + nx * 0.8, oz + nz * 0.8), at: (u, v) => [ox + tx * u + nx * v, oz + tz * u + nz * v] };
}

// ---------------------------------------------------------------------------- building blocks
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
function mesh(geo, m, cast = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; return o; }
// a group sitting in a facade frame: x along the wall, y up from the ground, z out of the wall
function frameGroup(F) {
  const g = new THREE.Group();
  g.position.set(F.ox, F.ground, F.oz);
  g.rotation.y = Math.atan2(F.nx, F.nz);
  return g;
}
// a flat panel on the wall (in a frame group): centre x, bottom y, width, height, out
function panel(g, m, x, y, w, h, z = 0.06) {
  const o = mesh(new THREE.PlaneGeometry(w, h), m, false);
  o.position.set(x, y + h / 2, z);
  g.add(o);
  return o;
}
function boxIn(g, m, x, y, z, w, h, d) {
  const o = mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y + h / 2, z);
  g.add(o);
  return o;
}

// ---------------------------------------------------------------------------- the places
export function buildPlaces(scene, map, buildings, { terrain, onRoad, polys, streetDir }) {
  const glow = [];   // [material, day intensity, night intensity]
  const lit = (m, day, night) => { glow.push([m, day, night]); return m; };
  const byKind = {}, frames = {};
  for (const pl of map.places || []) byKind[pl.k] = pl;

  // ------------------------------------------------ Guangdong House, Marken
  if (byKind.food && buildings.food) {
    const pl = byKind.food, F = frames.food = facade(buildings.food, pl.x, pl.z, terrain, onRoad), g = frameGroup(F);
    // white pilasters and the base of the shopfront
    const white = std({ color: 0xf1efe8, roughness: 0.8 });
    for (const x of [-3.35, 3.35]) boxIn(g, white, x, 0, 0.12, 0.45, 3.6, 0.24);
    boxIn(g, white, 0, 3.45, 0.14, 7.2, 0.3, 0.3);                                     // cornice over the shop
    // the sign: GUANGDONG HOUSE 廣東樓, white and gold on red
    const signT = tex(1024, 96, (c, w, h) => {
      c.fillStyle = '#c3121f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f6d46b'; c.fillRect(0, 4, w, 3); c.fillRect(0, h - 7, w, 3);
      c.fillStyle = '#ffffff'; c.textBaseline = 'middle'; c.textAlign = 'left';
      fitText(c, 'GUANGDONG HOUSE', 40, h / 2 + 2, 620, 60);
      c.fillStyle = '#f6d46b'; c.textAlign = 'right';
      c.font = `700 58px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`; c.fillText('廣東樓', w - 40, h / 2 + 3);
    });
    panel(g, lit(std({ map: signT, emissive: 0xffffff, emissiveMap: signT, roughness: 0.5 }), 0.15, 1.1), 0, 2.85, 6.2, 0.58, 0.18);
    // the window: a red frame round the glass, the yellow dining room behind it
    const roomT = tex(512, 256, (c, w, h) => {
      // yellow walls in perspective, the grey tile floor, the fan painting, tables and blue chairs
      c.fillStyle = '#e9d23a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f4ef9a'; c.beginPath(); c.moveTo(150, 40); c.lineTo(362, 40); c.lineTo(362, 175); c.lineTo(150, 175); c.fill();
      c.fillStyle = '#d3bf2c'; c.beginPath(); c.moveTo(0, 0); c.lineTo(150, 40); c.lineTo(150, 175); c.lineTo(0, 256); c.fill();
      c.beginPath(); c.moveTo(w, 0); c.lineTo(362, 40); c.lineTo(362, 175); c.lineTo(w, 256); c.fill();
      c.fillStyle = '#f2f2ee'; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(362, 40); c.lineTo(150, 40); c.fill();
      c.fillStyle = '#6c6c6a'; c.beginPath(); c.moveTo(150, 175); c.lineTo(362, 175); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      c.fillStyle = '#ffffff'; c.fillRect(236, 56, 40, 6);                                                      // ceiling light
      c.fillStyle = '#ffffff'; c.fillRect(214, 80, 84, 48); c.fillStyle = '#7d8f6a'; c.beginPath(); c.arc(256, 128, 34, Math.PI, 0); c.fill();   // the fan painting
      c.fillStyle = '#c0392b'; c.fillRect(380, 60, 22, 70); c.fillRect(110, 60, 22, 70);                          // scrolls
      c.fillStyle = '#fff3c4'; for (const x of [178, 334]) { c.beginPath(); c.arc(x, 92, 9, 0, 7); c.fill(); }    // wall lamps
      for (const [x, y, s] of [[120, 205, 1.4], [392, 205, 1.4], [205, 168, 0.8], [310, 168, 0.8]]) {
        c.fillStyle = '#9a5b2e'; c.fillRect(x - 46 * s, y - 8 * s, 92 * s, 10 * s);                               // table
        c.fillStyle = '#1f2a55'; c.fillRect(x - 40 * s, y - 2 * s, 18 * s, 30 * s); c.fillRect(x + 22 * s, y - 2 * s, 18 * s, 30 * s);   // chairs
        c.fillStyle = '#3a63b8'; c.fillRect(x - 40 * s, y + 8 * s, 18 * s, 6 * s); c.fillRect(x + 22 * s, y + 8 * s, 18 * s, 6 * s);
      }
    });
    const room = lit(std({ map: roomT, emissive: 0xffffff, emissiveMap: roomT, roughness: 0.15, metalness: 0.1 }), 0.35, 1.0);
    panel(g, room, 0.25, 0.55, 4.6, 2.1, 0.07);
    const red = std({ color: 0xc3121f, roughness: 0.5 });
    boxIn(g, red, 0.25, 0.42, 0.12, 4.9, 0.16, 0.1); boxIn(g, red, 0.25, 2.62, 0.12, 4.9, 0.12, 0.1);
    for (const x of [-2.2, 2.7]) boxIn(g, red, x, 0.42, 0.12, 0.14, 2.3, 0.1);
    boxIn(g, white, 0.25, 0, 0.14, 5.0, 0.42, 0.28);                                    // the sill wall
    // two red lanterns in the window, with gold caps and tassels
    const lanternM = lit(std({ color: 0xd8141e, emissive: 0xff3020, roughness: 0.4 }), 0.05, 1.6), gold = std({ color: 0xd9b13b, metalness: 0.7, roughness: 0.3 });
    for (const x of [-1.0, 1.6]) {
      const l = mesh(new THREE.SphereGeometry(0.26, 14, 10), lanternM); l.scale.set(1, 0.82, 1); l.position.set(x, 2.05, 0.32); g.add(l);
      for (const dy of [0.22, -0.22]) { const cap = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), gold); cap.position.set(x, 2.05 + dy, 0.32); g.add(cap); }
      const cord = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 4), gold); cord.position.set(x, 2.46, 0.32); g.add(cord);
      const tassel = mesh(new THREE.ConeGeometry(0.04, 0.22, 6), lanternM); tassel.position.set(x, 1.7, 0.32); tassel.rotation.x = Math.PI; g.add(tassel);
    }
    // the street sign on the corner, and a table with blue-and-white chairs out front
    const plateT = tex(256, 64, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#222'; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = '#222'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, '58  Marken', w / 2, h / 2 + 2, 220, 40, 700); });
    panel(g, std({ map: plateT }), 3.35, 3.9, 0.9, 0.24, 0.26);
    const tableM = std({ color: 0x9aa0a6, metalness: 0.6, roughness: 0.4 }), stripe = tex(64, 64, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f2f2f2' : '#2f5fae'; c.fillRect(0, i * 8, 64, 8); } });
    const chairM = std({ map: stripe, roughness: 0.6 });
    for (const [x, z] of [[-3.0, 1.3], [-1.6, 1.5]]) {
      const top = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 16), tableM); top.position.set(x, 0.74, z); g.add(top);
      const leg = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.74, 6), tableM); leg.position.set(x, 0.37, z); g.add(leg);
      for (const a of [0.4, 2.6]) {
        const ch = new THREE.Group();
        const seat = mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), chairM); seat.position.y = 0.45;
        const back = mesh(new THREE.BoxGeometry(0.42, 0.45, 0.05), chairM); back.position.set(0, 0.7, -0.2); back.rotation.x = -0.12;
        ch.add(seat, back);
        ch.position.set(x + Math.sin(a) * 0.55, 0, z + Math.cos(a) * 0.55); ch.rotation.y = a + Math.PI;
        g.add(ch);
      }
    }
    scene.add(g);
  }

  // ------------------------------------------------ Rema 1000, Marken
  if (byKind.shop && buildings.shop) {
    const pl = byKind.shop, F = frames.shop = facade(buildings.shop, pl.x, pl.z, terrain, onRoad), g = frameGroup(F);
    // the grey-green ground floor with its shopfront
    const greyT = tex(512, 128, (c, w, h) => {
      c.fillStyle = '#c9ccc4'; c.fillRect(0, 0, w, h);
      // glass doors and windows, and posters in the windows
      c.fillStyle = '#2b3138'; c.fillRect(40, 18, 150, 104); c.fillRect(230, 18, 100, 104); c.fillRect(370, 18, 110, 104);
      c.fillStyle = '#e8eef2'; c.fillRect(250, 30, 60, 80);
      c.fillStyle = '#d8402f'; c.fillRect(380, 30, 40, 56); c.fillStyle = '#f2d23a'; c.fillRect(430, 30, 40, 56);
      c.fillStyle = '#6a7279'; c.fillRect(113, 18, 4, 104);
    });
    // along the whole wall, repeated
    greyT.wrapS = THREE.RepeatWrapping; greyT.repeat.set(Math.max(1, Math.round(F.L / 8.6)), 1);
    panel(g, lit(std({ map: greyT, emissive: 0xffffff, emissiveMap: greyT, roughness: 0.6 }), 0.0, 0.25), F.L / 2 - F.s, 0, F.L - 0.1, 3.0, 0.08);
    // REMA 1000 on the white wall above, red letters lined in navy
    const letters = tex(1024, 160, (c, w, h) => {
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 128px ${FONT}`;
      c.lineWidth = 14; c.strokeStyle = '#1b2f86'; c.lineJoin = 'round'; c.strokeText('REMA 1000', w / 2, h / 2 + 6);
      c.fillStyle = '#e1251b'; c.fillText('REMA 1000', w / 2, h / 2 + 6);
    });
    const lettersM = lit(std({ map: letters, transparent: true, emissive: 0xffffff, emissiveMap: letters, roughness: 0.5 }), 0.1, 1.2);
    panel(g, lettersM, -0.6, 3.6, 5.2, 0.8, 0.09);
    // the blue square signs: on the wall and sticking out over the pavement, and the hours
    const sq = tex(256, 256, (c, w, h) => {
      c.fillStyle = '#1f3fa6'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e1251b'; c.lineWidth = 14; c.strokeRect(10, 10, w - 20, h - 20);
      c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'REMA', w / 2, 100, 200, 84, 900); fitText(c, '1000', w / 2, 175, 200, 84, 900);
    });
    const sqM = lit(std({ map: sq, emissive: 0xffffff, emissiveMap: sq }), 0.1, 1.1);
    const blueM = std({ color: 0x1f3fa6 });
    const blade = mesh(new THREE.BoxGeometry(0.12, 1.0, 1.0), [sqM, sqM, blueM, blueM, blueM, blueM]);   // sticks out over the pavement
    blade.position.set(3.6, 3.5, 0.62); g.add(blade);
    const hoursT = tex(256, 160, (c, w, h) => { c.fillStyle = '#1f3fa6'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, '7-23', w / 2, 70, 220, 96, 900); fitText(c, 'lørdag 8-21', w / 2, 132, 220, 30, 700); });
    panel(g, lit(std({ map: hoursT, emissive: 0xffffff, emissiveMap: hoursT }), 0.1, 0.9), 2.6, 3.3, 0.85, 0.55, 0.1);
    // a blue bin and a picnic table outside
    const bin = mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.95, 12), std({ color: 0x1f4fb6, roughness: 0.4 })); bin.position.set(-1.9, 0.48, 0.55); g.add(bin);
    const wood = std({ color: 0x9b6a3c, roughness: 0.9 });
    const pt = new THREE.Group();
    boxIn(pt, wood, 0, 0.72, 0, 1.8, 0.06, 0.75);
    for (const z of [-0.6, 0.6]) boxIn(pt, wood, 0, 0.42, z, 1.8, 0.05, 0.28);
    for (const x of [-0.7, 0.7]) { const a = mesh(new THREE.BoxGeometry(0.07, 0.85, 0.07), wood); a.position.set(x, 0.4, 0); a.rotation.x = 0.0; pt.add(a); boxIn(pt, wood, x, 0.12, 0, 0.07, 0.06, 1.5); }
    pt.position.set(-3.6, 0, 1.9); g.add(pt);
    scene.add(g);
  }

  // ------------------------------------------------ Johnny's, Kong Oscars gate
  if (byKind.pizza && buildings.pizza) {
    const pl = byKind.pizza, F = frames.pizza = facade(buildings.pizza, pl.x, pl.z, terrain, onRoad), g = frameGroup(F);
    // the dark granite ground floor, in big blocks
    const granite = tex(512, 256, (c, w, h) => {
      c.fillStyle = '#56514c'; c.fillRect(0, 0, w, h);
      const R = (k) => (Math.sin(k * 12.9898) * 43758.5453) % 1;
      for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
        const v = 0.85 + Math.abs(R(row * 7 + col)) * 0.25;
        c.fillStyle = `rgb(${86 * v | 0},${81 * v | 0},${76 * v | 0})`;
        c.fillRect(col * 86 + (row % 2) * 43 - 43 + 3, row * 64 + 3, 80, 58);
      }
      for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.08)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    });
    granite.wrapS = THREE.RepeatWrapping;
    // the granite ground floor wraps round the corner: every street-facing wall near the door
    const B = buildings.pizza, p = B.p, n = p.length / 2;
    let cx = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += p[i * 2]; cz += p[i * 2 + 1]; }
    cx /= n; cz /= n;
    const stoneM = (L) => { const t = granite.clone(); t.needsUpdate = true; t.repeat.set(Math.max(0.3, L / 4), 1); return std({ map: t, roughness: 0.85 }); };
    const mould = std({ color: 0x4c4843, roughness: 0.8 });
    const winTall = [];
    for (let i = 0; i < n; i++) {
      const ax = p[i * 2], az = p[i * 2 + 1], bx = p[((i + 1) % n) * 2], bz = p[((i + 1) % n) * 2 + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.3) continue;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if (Math.hypot(mx - pl.x, mz - pl.z) > 22) continue;
      let nx = (bz - az) / L, nz = -(bx - ax) / L;
      if (mx * nx + mz * nz - (cx * nx + cz * nz) < 0) { nx = -nx; nz = -nz; }
      if (![2.5, 4.5, 7].some(d => onRoad(mx + nx * d, mz + nz * d))) continue;   // a party wall or a yard
      const gy = terrain.height(mx + nx * 0.8, mz + nz * 0.8);
      const eg = new THREE.Group();
      eg.position.set(mx, gy, mz); eg.rotation.y = Math.atan2(nx, nz);
      panel(eg, stoneM(L), 0, -0.4, L + 0.06, 4.7, 0.07);
      boxIn(eg, mould, 0, 4.25, 0.2, L + 0.1, 0.18, 0.32);
      if (L > 2.4 && Math.hypot(mx - pl.x, mz - pl.z) > 2.5) winTall.push([eg, L]);
      scene.add(eg);
    }
    // columns either side of the door
    const col = std({ color: 0x5b5651, roughness: 0.7 });
    for (const x of [-1.35, 1.35]) { const c = mesh(new THREE.CylinderGeometry(0.2, 0.22, 3.9, 14), col); c.position.set(x, 1.95, 0.3); g.add(c); }
    // the wooden double door under a fanlight
    const doorT = tex(256, 512, (c, w, h) => {
      c.fillStyle = '#2a1d14'; c.fillRect(0, 0, w, h);
      // fanlight
      c.fillStyle = '#3d3a33'; c.beginPath(); c.arc(w / 2, 150, 118, Math.PI, 0); c.fill();
      c.strokeStyle = '#a7743d'; c.lineWidth = 6; for (let k = 0; k <= 8; k++) { const a = Math.PI + k * Math.PI / 8; c.beginPath(); c.moveTo(w / 2, 150); c.lineTo(w / 2 + Math.cos(a) * 118, 150 + Math.sin(a) * 118); c.stroke(); }
      c.beginPath(); c.arc(w / 2, 150, 118, Math.PI, 0); c.stroke();
      // the doors: warm wood, panels and glass
      c.fillStyle = '#a7743d'; c.fillRect(12, 160, w - 24, h - 170);
      c.fillStyle = '#6e4724'; c.fillRect(w / 2 - 3, 160, 6, h - 170);
      for (const x of [30, w / 2 + 18]) { c.fillStyle = '#26303a'; c.fillRect(x, 190, 90, 150); c.fillStyle = '#8a5a2f'; c.fillRect(x, 360, 90, 120); }
      c.fillStyle = '#e8eef2'; c.fillRect(46, 230, 40, 30); c.fillStyle = '#5fa36a'; c.beginPath(); c.arc(w / 2 + 62, 250, 16, 0, 7); c.fill();
    });
    panel(g, lit(std({ map: doorT, emissive: 0xffffff, emissiveMap: doorT }), 0.0, 0.18), 0, 0, 2.2, 3.6, 0.12);
    // shop windows with wooden frames, warm inside
    const winT = tex(256, 256, (c, w, h) => {
      c.fillStyle = '#8a5a2f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3a2b22'; c.fillRect(14, 14, w - 28, h - 28);
      c.fillStyle = '#d99a4e'; c.fillRect(30, 140, w - 60, 90);
      c.fillStyle = '#6b4a2a'; for (const x of [60, 150]) c.fillRect(x, 150, 50, 70);
      c.fillStyle = '#8a5a2f'; c.fillRect(14, 70, w - 28, 8); c.fillRect(w / 2 - 4, 14, 8, 60);
    });
    const winM = lit(std({ map: winT, emissive: 0xffffff, emissiveMap: winT, roughness: 0.2 }), 0.05, 0.8);
    for (const [eg, L] of winTall) for (let k = 0, m = Math.floor(L / 2.6); k < m; k++) panel(eg, winM, -L / 2 + (k + 0.5) * L / m, 0.5, Math.min(1.9, L / m - 0.5), 2.8, 0.1);
    // the hanging sign
    const signT = tex(256, 256, (c, w, h) => {
      c.fillStyle = '#c98a2e'; c.beginPath(); c.arc(w / 2, h / 2, 120, 0, 7); c.fill();
      c.fillStyle = '#2b1a10'; c.beginPath(); c.arc(w / 2, h / 2, 104, 0, 7); c.fill();
      c.fillStyle = '#f2c14e'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `italic 900 58px ${FONT}`; c.fillText('Johnny’s', w / 2, h / 2 - 12);
      c.font = `700 30px ${FONT}`; c.fillText('PIZZA', w / 2, h / 2 + 38);
    });
    const disc = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 24), [std({ color: 0xc98a2e }), lit(std({ map: signT, emissive: 0xffffff, emissiveMap: signT }), 0.1, 1.0), lit(std({ map: signT, emissive: 0xffffff, emissiveMap: signT }), 0.1, 1.0)]);
    disc.rotation.z = Math.PI / 2; disc.position.set(1.9, 3.45, 0.85); g.add(disc);
    const bracket = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), std({ color: 0x222222, metalness: 0.6 })); bracket.position.set(1.9, 3.95, 0.5); g.add(bracket);
    scene.add(g);
  }

  // ------------------------------------------------ Trekroneren: the red pølse kiosk
  if (byKind.hotdog) {
    const pl = byKind.hotdog, b = buildings.hotdog;
    // the kiosk stands where its OSM building was, facing the street
    let cx = pl.x, cz = pl.z, fx = 0, fz = 1;
    if (b) {
      const F = facade(b, pl.x, pl.z, terrain, onRoad);
      const p = b.p, n = p.length / 2; cx = 0; cz = 0;
      for (let i = 0; i < n; i++) { cx += p[i * 2]; cz += p[i * 2 + 1]; }
      cx /= n; cz /= n; fx = F.nx; fz = F.nz;
    }
    if (streetDir) { const d = streetDir(cx, cz); if (d) { fx = d[0]; fz = d[1]; } }
    const gy = terrain.height(cx, cz);
    const g = new THREE.Group();
    g.position.set(cx, gy, cz); g.rotation.y = Math.atan2(fx, fz);
    const W = 4.2, D = 2.6, Hh = 2.55;
    const planks = tex(256, 256, (c, w, h) => { c.fillStyle = '#b3261e'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, y + 2, w, 3); } });
    planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(2, 2);
    const redM = std({ map: planks, roughness: 0.75 });
    boxIn(g, redM, 0, 0, 0, W, Hh, D);
    // the roof, sloping to the back, with a deep red fascia
    const roof = mesh(new THREE.BoxGeometry(W + 0.5, 0.14, D + 0.5), std({ color: 0x7e1a14, roughness: 0.8 }));
    roof.position.set(0, Hh + 0.2, 0); roof.rotation.x = 0.1; g.add(roof);
    boxIn(g, std({ color: 0x9b1f18 }), 0, Hh - 0.05, D / 2 + 0.12, W + 0.4, 0.42, 0.12);
    // the yellow band with the black 3-KRONEREN plate, and the lit windows full of menus
    const bandT = tex(1024, 96, (c, w, h) => {
      c.fillStyle = '#f2cf2e'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1a1a1a'; c.fillRect(w / 2 - 170, 10, 340, h - 20);
      c.fillStyle = '#f2cf2e'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, '3-KRONEREN', w / 2, h / 2 + 2, 300, 50, 900);
      c.fillStyle = '#b3261e'; for (let x = 30; x < w - 30; x += 70) if (Math.abs(x - w / 2) > 190) c.fillRect(x, h / 2 - 3, 36, 6);
    });
    panel(g, lit(std({ map: bandT, emissive: 0xffffff, emissiveMap: bandT }), 0.25, 1.2), 0, Hh - 0.62, W - 0.3, 0.42, D / 2 + 0.02);
    const windowT = tex(512, 192, (c, w, h) => {
      c.fillStyle = '#ffe39a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2f0ea'; c.fillRect(170, 40, 170, 140);                              // the tiled back wall
      c.strokeStyle = '#d9d4c4'; c.lineWidth = 2; for (let x = 170; x < 340; x += 20) { c.beginPath(); c.moveTo(x, 40); c.lineTo(x, 180); c.stroke(); } for (let y = 40; y < 180; y += 20) { c.beginPath(); c.moveTo(170, y); c.lineTo(340, y); c.stroke(); }
      c.fillStyle = '#f2cf2e'; for (let x = 10; x < w; x += 52) c.fillRect(x, 8, 44, 26);    // menu cards along the top
      c.fillStyle = '#b3261e'; for (let x = 10; x < w; x += 52) c.fillRect(x + 6, 14, 32, 4);
      c.fillStyle = '#e0a63a'; c.fillRect(20, 60, 120, 110); c.fillRect(372, 60, 120, 110);  // shelves of drinks and buns
      c.fillStyle = '#b3261e'; for (let y = 72; y < 170; y += 24) { c.fillRect(28, y, 104, 6); c.fillRect(380, y, 104, 6); }
      c.strokeStyle = '#9b1f18'; c.lineWidth = 8; for (const x of [150, 362]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    });
    panel(g, lit(std({ map: windowT, emissive: 0xffffff, emissiveMap: windowT, roughness: 0.2 }), 0.35, 1.3), 0, 0.95, W - 0.5, 1.05, D / 2 + 0.02);
    // counters on either side, and the condiment boxes
    for (const x of [-W / 2 - 0.25, W / 2 + 0.25]) { boxIn(g, redM, x, 0, D / 2 - 0.4, 0.5, 0.95, 0.6); boxIn(g, std({ color: 0xf2f0ea }), x, 0.95, D / 2 - 0.4, 0.55, 0.06, 0.65); }
    // Norwegian flags on poles leaning out from the front corners
    const flagT = tex(220, 160, (c, w, h) => {
      c.fillStyle = '#ba0c2f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff'; c.fillRect(60, 0, 40, h); c.fillRect(0, 60, w, 40);
      c.fillStyle = '#00205b'; c.fillRect(70, 0, 20, h); c.fillRect(0, 70, w, 20);
    });
    const flagM = std({ map: flagT, side: THREE.DoubleSide, roughness: 0.9 }), poleM = std({ color: 0xe8e6e0, metalness: 0.3 });
    const flags = [];
    for (const s of [-1, 1]) {
      const fg = new THREE.Group();
      const pole = mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.0, 6), poleM); pole.position.y = 1.0; fg.add(pole);
      const flag = mesh(new THREE.PlaneGeometry(0.9, 0.65, 6, 1), flagM); flag.position.set(-s * 0.47, 1.6, 0); flag.scale.x = s; fg.add(flag);
      fg.position.set(s * (W / 2 - 0.1), Hh + 0.1, D / 2 + 0.1); fg.rotation.z = -s * 0.45;
      g.add(fg);
      flags.push(flag);
    }
    // the yellow A-board out front
    const boardT = tex(128, 192, (c, w, h) => { c.fillStyle = '#f2cf2e'; c.fillRect(0, 0, w, h); c.fillStyle = '#b3261e'; c.textAlign = 'center'; fitText(c, 'PØLSER', w / 2, 50, 110, 30, 900); c.fillStyle = '#1a1a1a'; fitText(c, 'Bergens', w / 2, 100, 110, 22, 700); fitText(c, 'beste', w / 2, 128, 110, 22, 700); fitText(c, 'siden 1977', w / 2, 160, 110, 18, 700); });
    const boardM = std({ map: boardT });
    for (const s of [-1, 1]) { const bd = mesh(new THREE.PlaneGeometry(0.6, 0.95), boardM); bd.position.set(-W / 2 - 1.2, 0.5, D / 2 + 0.9 + s * 0.12); bd.rotation.set(s * -0.22, s > 0 ? 0 : Math.PI, 0); g.add(bd); }
    scene.add(g);
    g.updateMatrixWorld(true);
    // walls you bump into
    if (polys) {
      const c = Math.cos(g.rotation.y), sn = Math.sin(g.rotation.y), pts = [];
      for (const [u, v] of [[-W / 2 - 0.5, -D / 2], [W / 2 + 0.5, -D / 2], [W / 2 + 0.5, D / 2 + 0.1], [-W / 2 - 0.5, D / 2 + 0.1]]) pts.push(cx + u * c + v * sn, cz - u * sn + v * c);
      polys.add(Float32Array.from(pts), gy - 0.5, gy + Hh + 0.3, { kind: 'flat' });
    }
    // the flags flutter
    glow.flags = flags;
  }

  let t = 0;
  return {
    frames,
    update(dt, lamp) {
      t += dt;
      for (const [m, day, night] of glow) m.emissiveIntensity = day + (night - day) * lamp;
      if (glow.flags) glow.flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 2.3 + i * 1.7) * 0.25; });
    },
  };
}
