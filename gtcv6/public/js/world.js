// The map: Cappes vei on the hillside of Fjellet, house no. 6 (enterable, laid
// out after the walkthrough video), the smau stairs down to Bryggen and the
// harbour, with Fløyen and Ulriken behind.
//
// Axes: +x east (uphill, towards Fløyen), +z south, y up. 1 unit = 1 metre.
import * as THREE from '../vendor/three.module.min.js';
import { Geo, World } from './engine.js';
import { rng, textTexture } from './textures.js';

export const laneY = z => -0.09 * z;

// House 6 key heights
export const H6 = { x0: 2.6, x1: 12.6, z0: -4.5, z1: 4.5, G: 0.15, U: 2.95, C: 5.6 };

export function buildWorld(scene, T) {
  const geo = new Geo();
  const world = new World(6);
  const mapRects = []; // for the minimap: {x0,z0,x1,z1,c,h}
  const R = rng(1234);

  // ---------------------------------------------------------------- materials
  const M = {};
  const std = (o, tex) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
    if (tex) m.map = tex;
    return m;
  };
  M.cobble = std({ color: 0xd8d8d8, roughness: 0.42 }, T.cobble);
  M.stone = std({ color: 0xd0d0d0, roughness: 0.95 }, T.stone);
  M.grass = std({ color: 0xffffff, roughness: 1 }, T.grass);
  M.slab = std({ color: 0xffffff, roughness: 0.7 }, T.slab);
  M.deck = std({ color: 0xffffff, roughness: 0.7 }, T.deck);
  M.asphalt = std({ color: 0xffffff, roughness: 0.5 }, T.asphalt);
  M.trim = std({ color: 0xf3f2ee, roughness: 0.6 });
  M.glass = std({ color: 0x23323c, roughness: 0.08, metalness: 0.6 });
  M.glassLit = std({ color: 0x5a4a30, emissive: 0xffc77a, emissiveIntensity: 0.9, roughness: 0.3 });
  M.glassClear = new THREE.MeshStandardMaterial({ color: 0xbfd6e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false });
  M.glassClear.userData.noCast = true;
  M.roof = std({ color: 0x4a4d52, roughness: 0.6 }, T.roof);
  M.roofRed = std({ color: 0x9a4a35, roughness: 0.6 }, T.roof);
  M.roofBlack = std({ color: 0x2c2e31, roughness: 0.55 }, T.roof);
  M.door = std({ color: 0x1d2024, roughness: 0.5 });
  M.metal = std({ color: 0x2a2c2e, roughness: 0.4, metalness: 0.7 });
  M.steel = std({ color: 0xaab0b5, roughness: 0.25, metalness: 0.8 });
  M.white = std({ color: 0xf0efeb, roughness: 0.9 });
  M.paint = std({ color: 0xecebe6, roughness: 0.95 });
  M.floor = std({ color: 0xffffff, roughness: 0.6 }, T.floor);
  M.pine = std({ color: 0xffffff, roughness: 0.7 }, T.pine);
  M.tileW = std({ color: 0xffffff, roughness: 0.3 }, T.tileWhite);
  M.tileD = std({ color: 0xffffff, roughness: 0.35 }, T.tileDark);
  M.checker = std({ color: 0xffffff, roughness: 0.5 }, T.checker);
  M.navy = std({ color: 0x1d2333, roughness: 1 });
  M.lightWood = std({ color: 0xd8b98e, roughness: 0.6 });
  M.black = std({ color: 0x18191b, roughness: 0.6 });
  M.cabinet = std({ color: 0xc9ccce, roughness: 0.5 });
  M.rug = std({ color: 0xc4b9a6, roughness: 1 });
  M.rugDark = std({ color: 0x4b4f55, roughness: 1 });
  M.bed = std({ color: 0xf2f1ec, roughness: 1 });
  M.spread = std({ color: 0x8ea5aa, roughness: 1 });
  M.cushion = std({ color: 0x3c5d8a, roughness: 1 });
  M.red = std({ color: 0xc0201a, roughness: 0.4 });
  M.plant = std({ color: 0x3f7a3a, roughness: 0.9 });
  M.pot = std({ color: 0xa65c3a, roughness: 0.9 });
  M.lamp = std({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 2.2 });
  M.lamp.userData.noCast = true;
  M.fence = std({ color: 0x7d7a73, roughness: 0.9 });
  M.wood = std({ color: 0x6b4c33, roughness: 0.8 });
  M.bark = std({ color: 0x4a3a2c, roughness: 1 });
  M.leaf = std({ color: 0x4f7037, roughness: 1 });
  M.yellow = std({ color: 0xe8b923, roughness: 0.5 });
  M.mail = std({ color: 0x1a1d22, roughness: 0.4, metalness: 0.4 });
  const sidingCache = new Map();
  const siding = (hex, tex = T.siding) => {
    const k = hex + (tex === T.siding ? 's' : 'v');
    if (!sidingCache.has(k)) sidingCache.set(k, std({ color: hex, roughness: 0.8 }, tex));
    return sidingCache.get(k);
  };
  M.grey6 = siding(0x8e979d); // Cappes vei 6, grey-blue cladding
  M.green = siding(0x9ab775);

  // ------------------------------------------------------------- helpers
  const ground = (x0, x1, z0, z1, h00, h10, h11, h01, bottom, top, side, opt = {}) => {
    geo.prism(top, x0, x1, z0, z1, h00, h10, h11, h01, bottom, side, opt.skip || '');
    world.add({ x0, x1, z0, z1, bottom, h00, h10, h11, h01, stairs: !!opt.stairs, tag: opt.tag });
    if (opt.map) mapRects.push({ x0, z0, x1, z1, c: opt.map, h: Math.max(h00, h10, h11, h01) });
  };
  // Flat solid box, rendered and collidable
  const solid = (mat, x0, y0, z0, x1, y1, z1, opt = {}) => {
    if (mat) geo.box(mat, x0, y0, z0, x1, y1, z1, opt.skip || '');
    const b = world.add({ x0, x1, z0, z1, bottom: Math.min(y0, y1), top: Math.max(y0, y1), walk: opt.walk !== false, cam: opt.cam !== false, tag: opt.tag });
    if (opt.map) mapRects.push({ x0, z0, x1, z1, c: opt.map, h: Math.max(y0, y1) });
    return b;
  };
  const deco = (mat, x0, y0, z0, x1, y1, z1, skip) => geo.box(mat, x0, y0, z0, x1, y1, z1, skip || '');
  const invisible = (x0, y0, z0, x1, y1, z1) => world.add({ x0, x1, z0, z1, bottom: y0, top: y1, walk: false, cam: false });

  // ------------------------------------------------------------ terrain
  const L = laneY;
  // Cappes vei itself: cobbles, sloping down to the south
  ground(-2.4, 2.6, -50, 34, L(-50), L(-50), L(34), L(34), -25, M.cobble, M.stone, { map: '#6e6c69', tag: 'lane' });
  // corner where the lane turns west, and the street down to the harbour
  ground(-6, 2.6, 34, 39.5, L(34), L(34), L(34), L(34), -25, M.cobble, M.stone, { map: '#6e6c69', tag: 'lane' });
  ground(-58, -6, 34, 39.5, -12, L(34), L(34), -12, -25, M.cobble, M.stone, { map: '#6e6c69', tag: 'lane' });

  // East of the lane, lane-level plots
  ground(2.6, 12.6, -62, -6.4, L(-62) + 0.12, L(-62) + 0.12, L(-6.4) + 0.12, L(-6.4) + 0.12, -25, M.grass, M.stone, { map: '#55624a' });
  // the narrow passage north of no. 6 (bins, plants, mailbox)
  ground(2.6, 12.6, -6.4, -4.5, 0.35, 0.35, 0.35, 0.35, -25, M.cobble, M.stone, { map: '#6e6c69' });
  ground(2.6, 12.6, 4.5, 34, L(4.5) + 0.12, L(4.5) + 0.12, L(34) + 0.12, L(34) + 0.12, -25, M.grass, M.stone, { map: '#55624a' });
  ground(2.6, 12.6, 39.5, 62, L(34) + 0.12, L(34) + 0.12, L(34) + 0.12, L(34) + 0.12, -25, M.grass, M.stone, { map: '#55624a' });
  ground(2.6, 12.6, 34, 39.5, L(34) + 0.12, L(34) + 0.12, L(34) + 0.12, L(34) + 0.12, -25, M.cobble, M.stone, { map: '#6e6c69' });
  // Row 1 behind (the back yard of no. 6 sits here, level with the upper floor)
  ground(12.6, 21, -62, -6.4, L(-62) + 2.7, L(-62) + 2.7, L(-6.4) + 2.7, L(-6.4) + 2.7, -25, M.grass, M.stone, { map: '#55624a' });
  ground(12.6, 21, -6.4, 8.5, H6.U, H6.U, H6.U, H6.U, -25, M.slab, M.stone, { map: '#8b8b84', tag: 'yard' });
  ground(12.6, 21, 8.5, 62, L(8.5) + 2.7, L(8.5) + 2.7, L(62) + 2.7, L(62) + 2.7, -25, M.grass, M.stone, { map: '#55624a' });
  ground(21, 32, -62, 62, L(-62) + 6.5, L(-62) + 6.5, L(62) + 6.5, L(62) + 6.5, -25, M.grass, M.stone, { map: '#55624a' });
  ground(32, 44, -62, 62, L(-62) + 11, L(-62) + 11, L(62) + 11, L(62) + 11, -25, M.grass, M.stone, { map: '#4d5c42' });

  // West of the lane, lane-level plots, split by the smau stairs at z -21..-19
  ground(-12, -2.4, -50, -21, L(-50), L(-50), L(-21), L(-21), -25, M.grass, M.stone, { map: '#55624a' });
  ground(-12, -2.4, -19, 34, L(-19), L(-19), L(34), L(34), -25, M.grass, M.stone, { map: '#55624a' });
  // Terraces stepping down to Bryggen
  const cols = [[-23, -12, -2.5], [-34, -23, -5.5], [-45, -34, -8.5], [-56, -45, -11]];
  for (const [a, b, h] of cols) {
    ground(a, b, -62, -21, h, h, h, h, -25, M.grass, M.stone, { map: '#55624a' });
    ground(a, b, -19, 34, h, h, h, h, -25, M.grass, M.stone, { map: '#55624a' });
  }
  // The smau: long stone stairs from Cappes vei down to Bryggen
  {
    const xa = -58, xb = -2.4, ya = -12, yb = L(-20);
    const n = 70, run = (xb - xa) / n, rise = (yb - ya) / n;
    for (let i = 0; i < n; i++) {
      const x0 = xa + i * run, top = ya + (i + 1) * rise;
      geo.box(M.stone, x0, -25, -21, x0 + run, top, -19, 'ny');
    }
    world.add({ x0: xa, x1: xb, z0: -21, z1: -19, bottom: -25, h00: ya + rise * 0.5, h10: yb + rise * 0.5, h11: yb + rise * 0.5, h01: ya + rise * 0.5, stairs: true, tag: 'smau' });
    mapRects.push({ x0: xa, z0: -21, x1: xb, z1: -19, c: '#7b7871', h: yb });
    // iron hand rail
    for (let i = 0; i <= 14; i++) {
      const x = xa + (xb - xa) * i / 14, y = ya + (yb - ya) * i / 14;
      deco(M.metal, x - 0.03, y, -19.15, x + 0.03, y + 0.95, -19.09);
    }
    const len = Math.hypot(xb - xa, yb - ya), ang = Math.atan2(yb - ya, xb - xa);
    geo.obox(M.metal, (xa + xb) / 2, (ya + yb) / 2 + 0.95, -19.12, len, 0.05, 0.05, 0, 0, ang);
  }

  // South of the harbour street
  for (const [a, b, h] of [[-56, -41, -12.5], [-41, -26, -9.5], [-26, -11, -7], [-11, -2.4, -4.5]]) {
    ground(a, b, 39.5, 62, h, h, h, h, -25, M.grass, M.stone, { map: '#55624a' });
  }
  ground(-2.4, 2.6, 39.5, 62, -4.5, -4.5, -4.5, -4.5, -25, M.grass, M.stone, { map: '#55624a' });

  // Viewpoint at the top of the lane
  ground(-12, 12.6, -62, -50, L(-50), L(-50), L(-50), L(-50), -25, M.slab, M.stone, { map: '#8b8b84', tag: 'view' });
  // railing on its west edge
  for (let z = -61.5; z <= -50.5; z += 1) deco(M.metal, -11.95, L(-50), z - 0.03, -11.89, L(-50) + 1.0, z + 0.03);
  deco(M.metal, -11.96, L(-50) + 0.95, -61.6, -11.88, L(-50) + 1.02, -50.4);
  invisible(-12.2, L(-50), -62, -11.9, L(-50) + 2, -50);
  // bench
  deco(M.wood, -10.6, L(-50) + 0.42, -57, -10.1, L(-50) + 0.48, -54);
  deco(M.wood, -10.15, L(-50) + 0.48, -57, -10.05, L(-50) + 0.95, -54);
  deco(M.metal, -10.6, L(-50), -56.8, -10.1, L(-50) + 0.42, -56.6);
  deco(M.metal, -10.6, L(-50), -54.4, -10.1, L(-50) + 0.42, -54.2);

  // Harbour front: Bryggen wharf
  ground(-84, -74, -45, 62, -12, -12, -12, -12, -25, M.deck, M.wood, { map: '#6d6153', tag: 'wharf' });
  ground(-74, -56, -45, 62, -12, -12, -12, -12, -25, M.cobble, M.stone, { map: '#6e6c69', tag: 'wharf' });
  for (let z = -44; z <= 61; z += 4) {
    deco(M.black, -83.7, -12, z - 0.18, -83.35, -11.45, z + 0.18);
  }

  // Bounds
  invisible(-90, -30, -63, 46, 40, -62);
  invisible(-90, -30, 62, 46, 40, 63);
  invisible(44, -30, -63, 46, 40, 63);
  invisible(-90, -30, -48, -56, 40, -45);

  // ------------------------------------------------------------ windows
  const winOut = (face, a, b, y, w, h, lit, frameMat = M.trim) => {
    // face: 'nx' | 'px' | 'nz' | 'pz' with the wall plane at coordinate b; a = centre along the wall
    const t = 0.07, f = 0.08, s = face[0] === 'n' ? -1 : 1;
    const glassMat = lit ? M.glassLit : M.glass;
    if (face[1] === 'x') {
      const xw = b, xo = xw + s * t;
      deco(frameMat, Math.min(xw, xo), y - h / 2 - f, a - w / 2 - f, Math.max(xw, xo), y + h / 2 + f, a + w / 2 + f);
      const xg = xw + s * (t + 0.005);
      deco(glassMat, Math.min(xw, xg), y - h / 2, a - w / 2, Math.max(xw, xg), y + h / 2, a + w / 2);
      const xm = xw + s * (t + 0.03);
      deco(frameMat, Math.min(xw, xm), y - h / 2, a - 0.03, Math.max(xw, xm), y + h / 2, a + 0.03);
      deco(frameMat, Math.min(xw, xm), y + h * 0.15 - 0.03, a - w / 2, Math.max(xw, xm), y + h * 0.15 + 0.03, a + w / 2);
      deco(frameMat, Math.min(xw, xw + s * 0.16), y - h / 2 - f - 0.05, a - w / 2 - f - 0.04, Math.max(xw, xw + s * 0.16), y - h / 2 - f, a + w / 2 + f + 0.04);
    } else {
      const zw = b, zo = zw + s * t;
      deco(frameMat, a - w / 2 - f, y - h / 2 - f, Math.min(zw, zo), a + w / 2 + f, y + h / 2 + f, Math.max(zw, zo));
      const zg = zw + s * (t + 0.005);
      deco(glassMat, a - w / 2, y - h / 2, Math.min(zw, zg), a + w / 2, y + h / 2, Math.max(zw, zg));
      const zm = zw + s * (t + 0.03);
      deco(frameMat, a - 0.03, y - h / 2, Math.min(zw, zm), a + 0.03, y + h / 2, Math.max(zw, zm));
      deco(frameMat, a - w / 2, y + h * 0.15 - 0.03, Math.min(zw, zm), a + w / 2, y + h * 0.15 + 0.03, Math.max(zw, zm));
      deco(frameMat, a - w / 2 - f - 0.04, y - h / 2 - f - 0.05, Math.min(zw, zw + s * 0.16), a + w / 2 + f + 0.04, y - h / 2 - f, Math.max(zw, zw + s * 0.16));
    }
  };

  // ------------------------------------------------------------ roofs
  const gableRoof = (x0, x1, z0, z1, eave, ridgeAlong, pitch, roofMat, wallMat, over = 0.35) => {
    if (ridgeAlong === 'z') {
      const xm = (x0 + x1) / 2, half = (x1 - x0) / 2, rise = half * Math.tan(pitch), ridge = eave + rise;
      const slope = Math.hypot(half + over, (half + over) * Math.tan(pitch));
      const lenZ = z1 - z0 + over * 2;
      geo.obox(roofMat, xm - (half + over) / 2, eave + rise - (half + over) * Math.tan(pitch) / 2 + 0.08, (z0 + z1) / 2, slope, 0.16, lenZ, 0, 0, pitch);
      geo.obox(roofMat, xm + (half + over) / 2, eave + rise - (half + over) * Math.tan(pitch) / 2 + 0.08, (z0 + z1) / 2, slope, 0.16, lenZ, 0, 0, -pitch);
      for (const z of [z0, z1]) geo.tri(wallMat, [x0, eave, z], [x1, eave, z], [xm, ridge, z], [[x0, eave], [x1, eave], [xm, ridge]], [0, 0, z === z0 ? -1 : 1]);
      return ridge;
    } else {
      const zm = (z0 + z1) / 2, half = (z1 - z0) / 2, rise = half * Math.tan(pitch), ridge = eave + rise;
      const slope = Math.hypot(half + over, (half + over) * Math.tan(pitch));
      const lenX = x1 - x0 + over * 2;
      geo.obox(roofMat, (x0 + x1) / 2, eave + rise - (half + over) * Math.tan(pitch) / 2 + 0.08, zm - (half + over) / 2, lenX, 0.16, slope, -pitch, 0, 0);
      geo.obox(roofMat, (x0 + x1) / 2, eave + rise - (half + over) * Math.tan(pitch) / 2 + 0.08, zm + (half + over) / 2, lenX, 0.16, slope, pitch, 0, 0);
      for (const x of [x0, x1]) geo.tri(wallMat, [x, eave, z0], [x, eave, z1], [x, ridge, zm], [[z0, eave], [z1, eave], [zm, ridge]], [x === x0 ? -1 : 1, 0, 0]);
      return ridge;
    }
  };

  // ------------------------------------------------------------ generic houses
  const palette = [0xeeede6, 0xeeede6, 0xf1efe7, 0xe9e2cf, 0xdedfd6, 0xe8dcae, 0xc9d6dc, 0xeeede6, 0xd8cfc2];
  const house = (x0, x1, z0, z1, base, opt = {}) => {
    const floors = opt.floors || 2;
    const H = floors * 2.7 + 0.3;
    const mat = opt.mat || siding(palette[Math.floor(R() * palette.length)]);
    const bottom = opt.bottom ?? base - 3;
    // stone plinth below the cladding
    deco(M.stone, x0 + 0.02, bottom, z0 + 0.02, x1 - 0.02, base + 0.2, z1 - 0.02);
    deco(mat, x0, base + 0.2, z0, x1, base + H, z1);
    world.add({ x0, x1, z0, z1, bottom, top: base + H, walk: true, cam: true, tag: 'house' });
    // corner boards
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) deco(M.trim, cx - 0.07, base + 0.2, cz - 0.07, cx + 0.07, base + H, cz + 0.07);
    const ridgeAlong = opt.ridge || (x1 - x0 < z1 - z0 ? 'z' : 'x');
    const roofMat = opt.roofMat || (R() < 0.2 ? M.roofRed : (R() < 0.5 ? M.roof : M.roofBlack));
    const ridge = gableRoof(x0, x1, z0, z1, base + H, ridgeAlong, opt.pitch || 0.62, roofMat, mat);
    mapRects.push({ x0, z0, x1, z1, c: roofMat === M.roofRed ? '#8a4a3a' : '#4c4f55', h: ridge, house: true });
    // chimney
    if (R() < 0.6) {
      const cx = ridgeAlong === 'z' ? (x0 + x1) / 2 + 0.4 : x0 + (x1 - x0) * (0.25 + R() * 0.5);
      const cz = ridgeAlong === 'z' ? z0 + (z1 - z0) * (0.25 + R() * 0.5) : (z0 + z1) / 2 + 0.4;
      deco(M.stone, cx - 0.3, base + H, cz - 0.3, cx + 0.3, ridge + 0.9, cz + 0.3);
      deco(M.metal, cx - 0.36, ridge + 0.9, cz - 0.36, cx + 0.36, ridge + 0.98, cz + 0.36);
    }
    // windows on each facade
    const faces = opt.faces || ['nx', 'px', 'nz', 'pz'];
    for (const f of faces) {
      const along = f[1] === 'x' ? [z0, z1] : [x0, x1];
      const plane = f === 'nx' ? x0 : f === 'px' ? x1 : f === 'nz' ? z0 : z1;
      const len = along[1] - along[0];
      const n = Math.max(1, Math.floor((len - 0.8) / 2.1));
      for (let fl = 0; fl < floors; fl++) {
        for (let i = 0; i < n; i++) {
          const a = along[0] + len * (i + 0.5) / n;
          if (f === opt.door && fl === 0 && i === Math.floor(n / 2)) continue;
          winOut(f, a, plane, base + 0.2 + fl * 2.7 + 1.55, 0.85, 1.25, R() < 0.25);
        }
      }
    }
    if (opt.door) {
      const f = opt.door;
      const along = f[1] === 'x' ? [z0, z1] : [x0, x1];
      const len = along[1] - along[0];
      const n = Math.max(1, Math.floor((len - 0.8) / 2.1));
      const a = along[0] + len * (Math.floor(n / 2) + 0.5) / n;
      const plane = f === 'nx' ? x0 : f === 'px' ? x1 : f === 'nz' ? z0 : z1;
      const s = f[0] === 'n' ? -1 : 1;
      const doorMat = opt.doorMat || [M.door, siding(0x3b5a78), siding(0x7a2e28), siding(0x2f4a35)][Math.floor(R() * 4)];
      if (f[1] === 'x') {
        deco(M.trim, Math.min(plane, plane + s * 0.06), base + 0.2, a - 0.6, Math.max(plane, plane + s * 0.06), base + 2.45, a + 0.6);
        deco(doorMat, Math.min(plane, plane + s * 0.09), base + 0.2, a - 0.48, Math.max(plane, plane + s * 0.09), base + 2.3, a + 0.48);
      } else {
        deco(M.trim, a - 0.6, base + 0.2, Math.min(plane, plane + s * 0.06), a + 0.6, base + 2.45, Math.max(plane, plane + s * 0.06));
        deco(doorMat, a - 0.48, base + 0.2, Math.min(plane, plane + s * 0.09), a + 0.48, base + 2.3, Math.max(plane, plane + s * 0.09));
      }
    }
    return { ridge, top: base + H };
  };

  // Houses along Cappes vei, east side (facing the lane, door on the west)
  const eastRow = [[-61, -51.5], [-50, -41.5], [-41, -32.5], [-32, -23], [-22.5, -15]];
  for (const [a, b] of eastRow) house(2.6, 10.5 + R() * 2, a, b, L(a) + 0.12, { door: 'nx', floors: 2 });
  // the green neighbour right next to no. 6
  house(2.6, 11.4, -14, -6.6, L(-14) + 0.12, { door: 'nx', mat: M.green, floors: 2, roofMat: M.roofBlack });
  for (const [a, b] of [[5.4, 13.5], [14, 22.5], [23, 33.5], [40, 48], [48.5, 57]]) house(2.6, 10 + R() * 2.4, a, b, (a < 34 ? L(a) : L(34)) + 0.12, { door: 'nx', floors: a > 20 ? 3 : 2 });

  // West side, facing the lane (door on the east)
  const westRow = [[-50, -42], [-41.5, -33], [-32.5, -22], [-18, -9], [-8.5, 0.5], [1, 9], [9.5, 18], [18.5, 25.5], [26, 31.5]];
  for (const [a, b] of westRow) {
    const zt = a;
    const base = a < -50 ? L(-50) : L(zt);
    house(-11.5 + R() * 1.5, -2.4, a, b, base, { door: 'px', floors: R() < 0.3 ? 3 : 2 });
  }
  // Terrace houses on the hillside, facing west over the harbour
  for (const [a, b, h] of cols) {
    let z = -60 + R() * 3;
    while (z < 32) {
      const len = 6 + R() * 4;
      if (z + len > 33) break;
      if (!(z + len > -21.5 && z < -18.5)) {
        house(a + 1 + R() * 1.5, b - 1 - R() * 1.5, z, z + len, h, { floors: R() < 0.4 ? 3 : 2, door: 'nx' });
      }
      z += len + 1.2 + R() * 2.5;
    }
  }
  // Row 2 and 3 above
  for (const [a, b, off] of [[22, 31, 6.5], [33, 43, 11]]) {
    let z = -61 + R() * 2;
    while (z < 58) {
      const len = 7 + R() * 4;
      if (z + len > 61) break;
      house(a, b, z, z + len, L(z + len) + off, { floors: 2, door: 'nx', bottom: L(z + len) + off - 6 });
      z += len + 1.5 + R() * 3;
    }
  }
  // Row 1 behind the lane-side houses (not behind no. 6, whose yard is there)
  for (const [z0, z1] of [[-60, -50], [-48, -39], [-36, -27], [-24, -14], [11, 19], [21, 30], [36, 45], [48, 58]]) {
    house(13.2, 20.4, z0, z1, L(z1) + 2.7, { floors: 2, door: 'nx', bottom: L(z1) - 3 });
  }
  // South of the harbour street
  for (const [a, b, h] of [[-55, -42, -12.5], [-40, -27, -9.5], [-25, -12, -7], [-10.5, 1.5, -4.5]]) {
    house(a, b, 41, 48, h, { floors: 2, door: 'nz' });
    house(a + 1, b - 1, 51, 60, h, { floors: 2, door: 'nz' });
  }

  // ------------------------------------------------------------ Bryggen
  const bryggenCols = [0x96321f, 0xc98f2e, 0xe8e2d2, 0xd9b75a, 0x6e4a30, 0x96321f, 0xe8e2d2, 0xb0452a, 0xc98f2e, 0xe8e2d2];
  const bryggen = [];
  {
    let z = -30;
    let i = 0;
    while (z < 29) {
      const w = 5 + R() * 1.4;
      const mat = siding(bryggenCols[i % bryggenCols.length], T.vboard);
      const x0 = -74, x1 = -60, base = -12;
      const H = 8.6;
      deco(M.stone, x0, base - 1, z, x1, base + 0.25, z + w);
      deco(mat, x0, base + 0.25, z, x1, base + H, z + w);
      world.add({ x0, x1, z0: z, z1: z + w, bottom: base - 1, top: base + H, walk: true, tag: 'house' });
      const ridge = gableRoof(x0, x1, z, z + w, base + H, 'x', 0.95, M.roofRed, mat, 0.25);
      mapRects.push({ x0, z0: z, x1, z1: z + w, c: '#8a4a3a', h: ridge, house: true });
      // hoist beam at the gable top
      deco(M.wood, x0 - 0.9, base + H + 1.2, z + w / 2 - 0.12, x0 + 0.2, base + H + 1.45, z + w / 2 + 0.12);
      // gable windows, three storeys
      for (let fl = 0; fl < 3; fl++) for (let k = 0; k < 2; k++)
        winOut('nx', z + w * (k + 1) / 3, x0, base + 1.6 + fl * 2.6 + (fl === 0 ? 0.3 : 0), 0.7, 1.05, R() < 0.3);
      winOut('nx', z + w / 2, x0, base + H + 1.1, 0.6, 0.8, false);
      bryggen.push({ z0: z, z1: z + w });
      z += w + (i === 5 ? 2.2 : 0.15);
      i++;
    }
  }
  // the bakery: last building, with an awning and a sign
  const bake = bryggen[bryggen.length - 1];
  const bakeZ = (bake.z0 + bake.z1) / 2;
  geo.obox(siding(0x7a2e28), -75.1, -9.25, bakeZ, 2.2, 0.08, bake.z1 - bake.z0 - 0.4, 0, 0, -0.35);
  deco(M.door, -74.08, -12, bakeZ - 0.6, -74.0, -9.8, bakeZ + 0.6);
  const signTex = textTexture(['BAKERI'], { w: 512, h: 128, bg: '#f4ead2', fg: '#6a2a1f', font: '800 78px "Archivo", sans-serif', border: '#6a2a1f' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 }));
  sign.position.set(-74.12, -8.55, bakeZ); sign.rotation.y = -Math.PI / 2;
  scene.add(sign);

  // ------------------------------------------------------------ Cappes vei 6
  const doors = [];
  const lights = [];
  buildHouse6();

  function wallRun(axis, c0, c1, a0, a1, y0, y1, openings, mat) {
    // axis 'x': runs along x from a0..a1, occupies z in [c0,c1]; axis 'z': runs along z, occupies x in [c0,c1]
    const cuts = new Set([a0, a1]);
    for (const o of openings) { cuts.add(o.a0); cuts.add(o.a1); }
    const pts = [...cuts].filter(v => v >= a0 && v <= a1).sort((p, q) => p - q);
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i], e = pts[i + 1];
      if (e - s < 1e-4) continue;
      const o = openings.find(o => o.a0 <= s + 1e-4 && o.a1 >= e - 1e-4);
      const parts = o ? [[y0, o.y0], [o.y1, y1]] : [[y0, y1]];
      for (const [ya, yb] of parts) {
        if (yb - ya < 1e-3) continue;
        if (axis === 'x') deco(mat, s, ya, c0, e, yb, c1);
        else deco(mat, c0, ya, s, c1, yb, e);
      }
    }
  }
  function wallCollide(axis, c0, c1, a0, a1, y0, y1, openings) {
    // solid except doors
    const doorsO = openings.filter(o => o.door).sort((p, q) => p.a0 - q.a0);
    let s = a0;
    const add = (p, q, ya, yb) => {
      if (q - p < 1e-4) return;
      if (axis === 'x') world.add({ x0: p, x1: q, z0: c0, z1: c1, bottom: ya, top: yb, walk: false });
      else world.add({ x0: c0, x1: c1, z0: p, z1: q, bottom: ya, top: yb, walk: false });
    };
    for (const d of doorsO) {
      add(s, d.a0, y0, y1);
      add(d.a0, d.a1, d.y1, y1);
      s = d.a1;
    }
    add(s, a1, y0, y1);
  }
  // A full wall: outer and inner material layers, plus window frames and glass
  function wall(axis, c0, c1, a0, a1, y0, y1, openings, matA, matB) {
    const mid = (c0 + c1) / 2;
    if (matB) { wallRun(axis, c0, mid, a0, a1, y0, y1, openings, matA); wallRun(axis, mid, c1, a0, a1, y0, y1, openings, matB); }
    else wallRun(axis, c0, c1, a0, a1, y0, y1, openings, matA);
    wallCollide(axis, c0, c1, a0, a1, y0, y1, openings);
    for (const o of openings) {
      if (o.door) continue;
      const f = 0.07, t = c1 - c0;
      const A = (p, q) => axis === 'x' ? [p, q] : [q, p];
      // frame on both faces and mullions
      for (const [cc0, cc1] of [[c0 - 0.03, c0 + 0.02], [c1 - 0.02, c1 + 0.03]]) {
        const box = (a, b, ya, yb) => { const [x0, z0] = A(a, cc0), [x1, z1] = A(b, cc1); deco(M.trim, x0, ya, z0, x1, yb, z1); };
        box(o.a0 - f, o.a1 + f, o.y0 - f, o.y0);
        box(o.a0 - f, o.a1 + f, o.y1, o.y1 + f);
        box(o.a0 - f, o.a0, o.y0, o.y1);
        box(o.a1, o.a1 + f, o.y0, o.y1);
      }
      const am = (o.a0 + o.a1) / 2;
      { const [x0, z0] = A(am - 0.03, mid - 0.04), [x1, z1] = A(am + 0.03, mid + 0.04); deco(M.trim, x0, o.y0, z0, x1, o.y1, z1); }
      { const yh = o.y0 + (o.y1 - o.y0) * 0.68; const [x0, z0] = A(o.a0, mid - 0.04), [x1, z1] = A(o.a1, mid + 0.04); deco(M.trim, x0, yh - 0.03, z0, x1, yh + 0.03, z1); }
      { const [x0, z0] = A(o.a0, mid - 0.005), [x1, z1] = A(o.a1, mid + 0.005); deco(M.glassClear, x0, o.y0, z0, x1, o.y1, z1); }
      // inner sill
      { const [x0, z0] = A(o.a0 - 0.05, c0 - 0.12), [x1, z1] = A(o.a1 + 0.05, c1 + 0.12); deco(M.trim, x0, o.y0 - 0.04, z0, x1, o.y0, z1); }
      void t;
    }
  }
  function door(x, y, z, w, h, axis, hingeSide, mat, auto, openAngle = 1.6, staticOpen = false) {
    // A door leaf hinged at one edge. axis: the wall direction ('x' or 'z').
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), mat);
    leaf.castShadow = true; leaf.receiveShadow = true;
    leaf.position.set(w / 2 * hingeSide, h / 2, 0);
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.rotation.y = axis === 'x' ? 0 : -Math.PI / 2;
    pivot.add(leaf);
    // handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.12), M.steel);
    handle.position.set((w / 2 - 0.12) * hingeSide, 1.0 - h / 2, 0);
    leaf.add(handle);
    scene.add(pivot);
    const d = { pivot, open: staticOpen ? 1 : 0, target: staticOpen ? 1 : 0, auto, angle: openAngle * -hingeSide, pos: new THREE.Vector3(x + (axis === 'x' ? w / 2 * hingeSide : 0), y, z + (axis === 'z' ? w / 2 * hingeSide : 0)) };
    pivot.rotation.y += d.angle * d.open;
    d.base = pivot.rotation.y - d.angle * d.open;
    doors.push(d);
    return d;
  }

  function buildHouse6() {
    const { x0, x1, z0, z1, G, U, C } = H6;
    const out = M.grey6, inn = M.paint;
    const top = C + 0.15;
    // Foundation / ground floor slab
    solid(M.stone, x0, -3, z0, x1, G - 0.05, z1, { map: '#4c4f55' });
    deco(M.floor, x0 + 0.2, G - 0.05, z0 + 0.2, x1 - 0.2, G, z1 - 0.2, 'ny');
    world.add({ x0: x0 + 0.2, x1: x1 - 0.2, z0: z0 + 0.2, z1: z1 - 0.2, bottom: G - 0.05, top: G, solid: false });
    // stone plinth around the outside
    deco(M.stone, x0 - 0.06, -1.5, z0 - 0.06, x0 + 0.2, G + 0.12, z1 + 0.06);

    const gw = (o) => o; // helper for readability
    const Y0 = G, Y1 = U - 0.2, Y2 = U, Y3 = C;
    // ---- exterior walls (outer grey cladding, inner white)
    // front (lane side), x in [2.6,2.8]
    wall('z', x0, x0 + 0.2, z0, z1, -0.5, top, [
      gw({ a0: -3.6, a1: -2.4, y0: 1.0, y1: 2.3 }),
      { a0: -1.3, a1: -0.4, y0: G, y1: 2.3, door: true },
      { a0: 1.6, a1: 3.0, y0: 1.0, y1: 2.3 },
      { a0: -3.6, a1: -2.4, y0: 3.75, y1: 5.05 },
      { a0: -1.2, a1: -0.4, y0: 3.75, y1: 5.05 },
      { a0: 1.6, a1: 3.0, y0: 3.75, y1: 5.05 },
    ], out, inn);
    // back (yard side), x in [12.4,12.6]
    wall('z', x1 - 0.2, x1, z0, z1, -0.5, top, [
      { a0: -3.4, a1: -2.6, y0: 4.2, y1: 5.0 },
      { a0: -1.25, a1: -0.35, y0: U, y1: 5.1, door: true },
      { a0: 1.8, a1: 3.0, y0: 3.8, y1: 5.05 },
    ], inn, out);
    deco(M.pine, x1 - 0.22, G, -1.6, x1 - 0.2, Y1, z1 - 0.2);
    // north (passage side), z in [-4.5,-4.3]
    wall('x', z0, z0 + 0.2, x0 + 0.2, x1 - 0.2, -0.5, top, [
      { a0: 3.6, a1: 4.8, y0: 1.0, y1: 2.3 },
      { a0: 10.2, a1: 11.6, y0: 1.2, y1: 2.3 },
      { a0: 3.6, a1: 4.8, y0: 3.75, y1: 5.05 },
      { a0: 11.0, a1: 11.8, y0: 4.3, y1: 5.1 },
    ], out, inn);
    // south, z in [4.3,4.5]
    wall('x', z1 - 0.2, z1, x0 + 0.2, x1 - 0.2, -0.5, top, [
      { a0: 3.8, a1: 5.2, y0: 1.0, y1: 2.3 },
      { a0: 7.2, a1: 8.4, y0: 1.0, y1: 2.3 },
      { a0: 10.2, a1: 11.4, y0: 1.0, y1: 2.3 },
      { a0: 3.8, a1: 5.0, y0: 3.75, y1: 5.05 },
      { a0: 7.4, a1: 8.6, y0: 3.75, y1: 5.05 },
      { a0: 10.6, a1: 11.6, y0: 3.75, y1: 5.05 },
    ], inn, out);
    wallRun('x', z1 - 0.22, z1 - 0.2, x0 + 0.2, 6.4, G, Y1, [{ a0: 3.8, a1: 5.2, y0: 1.0, y1: 2.3 }], M.pine);
    wallRun('x', z1 - 0.22, z1 - 0.2, 6.5, x1 - 0.2, G, Y1, [{ a0: 7.2, a1: 8.4, y0: 1.0, y1: 2.3 }, { a0: 10.2, a1: 11.4, y0: 1.0, y1: 2.3 }], M.pine);
    // corner boards
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) deco(M.trim, cx - 0.08, -0.5, cz - 0.08, cx + 0.08, top, cz + 0.08);

    // ---- upper floor slab (ceiling of ground floor), with the stair hole x 6.3..9.1, z -2.9..-1.7
    const slab = (ax0, ax1, az0, az1, mat) => {
      deco(inn, ax0, Y1, az0, ax1, Y2 - 0.04, az1);
      deco(mat, ax0, Y2 - 0.04, az0, ax1, Y2, az1, 'ny');
      world.add({ x0: ax0, x1: ax1, z0: az0, z1: az1, bottom: Y1, top: Y2 });
    };
    const ix0 = x0 + 0.2, ix1 = x1 - 0.2, iz0 = z0 + 0.2, iz1 = z1 - 0.2;
    slab(ix0, 6.3, iz0, iz1, M.floor);
    slab(6.3, 9.1, iz0, -2.9, M.floor);
    slab(6.3, 9.1, -1.7, iz1, M.floor);
    slab(9.1, ix1, iz0, iz1, M.floor);
    // checker vinyl on the upstairs landing/corridor, dark tiles in the bathroom
    deco(M.checker, 9.1, Y2, -2.9, 10.35, Y2 + 0.005, -1.6);
    deco(M.checker, ix0, Y2, -1.65, ix1, Y2 + 0.005, 0.15);
    deco(M.checker, 9.3, Y2, -4.3, 10.35, Y2 + 0.005, -2.9);
    deco(M.tileD, 10.35, Y2, -4.3, ix1, Y2 + 0.005, -1.65);
    // ceiling of the upper floor
    deco(inn, ix0, Y3, iz0, ix1, Y3 + 0.15, iz1);
    world.add({ x0: ix0, x1: ix1, z0: iz0, z1: iz1, bottom: Y3, top: Y3 + 0.15, walk: false });

    // ---- ground floor interior walls
    const iw = (axis, c0, c1, a0, a1, ya, yb, ops, mA = inn, mB) => wall(axis, c0, c1, a0, a1, ya, yb, ops, mA, mB);
    // wall A: corridor north side z -1.7..-1.6, both floors
    iw('x', -1.7, -1.6, ix0, 9.4, Y0, Y1, [{ a0: 4.4, a1: 5.2, y0: Y0, y1: 2.25, door: true }, { a0: 5.7, a1: 6.3, y0: Y0, y1: 2.5, door: true }]);
    iw('x', -1.7, -1.6, ix0, 9.3, Y2, Y3, [{ a0: 4.4, a1: 5.2, y0: Y2, y1: Y2 + 2.1, door: true }]);
    iw('x', -1.7, -1.6, 10.3, ix1, Y2, Y3, [], M.tileW, inn);
    // wall B: corridor south side z 0.1..0.2
    iw('x', 0.1, 0.2, ix0, 6.5, Y0, Y1, [{ a0: 5.3, a1: 6.1, y0: Y0, y1: 2.25, door: true }]);
    iw('x', 0.1, 0.2, ix0, ix1, Y2, Y3, [{ a0: 5.3, a1: 6.1, y0: Y2, y1: Y2 + 2.1, door: true }, { a0: 8.3, a1: 9.1, y0: Y2, y1: Y2 + 2.1, door: true }, { a0: 9.7, a1: 10.5, y0: Y2, y1: Y2 + 2.1, door: true }]);
    // wall C: study east wall (ground), x 5.6..5.7
    iw('z', 5.6, 5.7, iz0, -1.7, Y0, Y1, []);
    // stair north wall z -3.0..-2.9 (ground: x 5.7..9.4 closes the cupboard; upper: x 6.3..9.3)
    iw('x', -3.0, -2.9, 5.7, 9.4, Y0, Y1, []);
    iw('x', -3.0, -2.9, 6.3, 9.3, Y2, Y3, []);
    // wall D: between stair/cupboard and kitchen (ground)
    iw('z', 9.3, 9.4, iz0, -1.7, Y0, Y1, []);
    // wall E: bedroom 1 / living (ground) — pine on the bedroom side
    iw('z', 6.4, 6.5, 0.2, iz1, Y0, Y1, [], M.pine, inn);
    // upper: stairwell west end, alcove/laundry divider, bathroom west wall, bedroom dividers
    iw('z', 6.2, 6.3, -2.9, -1.7, Y2, Y3, []);
    iw('z', 9.3, 9.4, iz0, -3.0, Y2, Y3, []);
    iw('z', 10.3, 10.4, iz0, -1.7, Y2, Y3, [{ a0: -2.75, a1: -1.95, y0: Y2, y1: Y2 + 2.1, door: true }], inn, M.tileW);
    iw('z', 6.4, 6.5, 0.2, iz1, Y2, Y3, []);
    iw('z', 9.4, 9.5, 0.2, iz1, Y2, Y3, []);
    // bathroom tiles on the outer walls
    deco(M.tileW, 10.4, Y2, iz0, ix1, Y3, iz0 + 0.02);
    deco(M.tileW, ix1 - 0.02, Y2, iz0, ix1, Y3, -1.7);

    // ---- stairs: 14 steep white steps with dark treads, from x 6.3 up to 9.1
    {
      const n = 14, run = (9.1 - 6.3) / n, rise = (U - G) / n;
      for (let i = 0; i < n; i++) {
        const sx = 6.3 + i * run, sy = G + (i + 1) * rise;
        deco(M.white, sx, G, -2.9, sx + run, sy - 0.03, -1.7);
        deco(M.black, sx - 0.02, sy - 0.03, -2.9, sx + run, sy, -1.7);
      }
      world.add({ x0: 6.3, x1: 9.1, z0: -2.9, z1: -1.7, bottom: G, h00: G + rise * 0.5, h10: U + 0.05, h11: U + 0.05, h01: G + rise * 0.5, solid: false, stairs: true });
    }

    // ---- doors: front and back open as you approach; inner doors stand open
    door(x0 + 0.1, G, -1.3, 0.9, 2.15, 'z', 1, M.door, true, -1.6);
    door(x1 - 0.1, U, -1.25, 0.9, 2.15, 'z', 1, siding(0xf3f2ee), true);
    const innerDoor = siding(0xf3f2ee);
    door(4.4, G, -1.65, 0.8, 2.1, 'x', 1, innerDoor, false, -1.5, true);
    door(5.3, G, 0.15, 0.8, 2.1, 'x', 1, innerDoor, false, 1.5, true);
    door(4.4, U, -1.65, 0.8, 2.05, 'x', 1, innerDoor, false, -1.5, true);
    door(5.3, U, 0.15, 0.8, 2.05, 'x', 1, innerDoor, false, 1.5, true);
    door(8.3, U, 0.15, 0.8, 2.05, 'x', 1, innerDoor, false, 1.5, true);
    door(9.7, U, 0.15, 0.8, 2.05, 'x', 1, innerDoor, false, 1.5, true);
    door(10.35, U, -2.75, 0.8, 2.05, 'z', 1, innerDoor, false, -1.5, true);

    // ---- roof (ridge along the lane), chimney and skylights
    const ridge = gableRoof(x0, x1, z0, z1, top, 'z', 0.5, M.roofBlack, out, 0.4);
    deco(M.stone, 9.2, top, 1.6, 9.9, ridge + 1.0, 2.3);
    deco(M.metal, 9.12, ridge + 1.0, 1.52, 9.98, ridge + 1.1, 2.38);
    mapRects.push({ x0, z0, x1, z1, c: '#e3b341', h: ridge, house: true, home: true });
    // gutters
    deco(M.metal, x0 - 0.45, top - 0.05, z0 - 0.4, x0 - 0.3, top + 0.08, z1 + 0.4);
    deco(M.metal, x1 + 0.3, top - 0.05, z0 - 0.4, x1 + 0.45, top + 0.08, z1 + 0.4);

    // ---- outside: front stoop, house number, mailbox, key box, lamp, bins and plants in the passage
    solid(M.stone, x0 - 0.7, -1, -1.55, x0, G, -0.15);
    const numTex = textTexture(['6'], { w: 128, h: 128, bg: '#1b1e22', fg: '#f3f2ee', font: '700 92px "Archivo", sans-serif', radius: 14 });
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshStandardMaterial({ map: numTex, roughness: 0.5 }));
    num.position.set(x0 - 0.02, 2.65, -0.85); num.rotation.y = -Math.PI / 2; scene.add(num);
    const plate = textTexture(['CAPPES VEI'], { w: 512, h: 96, bg: '#1d3f6e', fg: '#ffffff', font: '700 58px "Archivo", sans-serif', radius: 8, border: '#ffffff' });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.26), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.5 }));
    pl.position.set(x0 - 0.02, 3.2, -3.0); pl.rotation.y = -Math.PI / 2; scene.add(pl);
    deco(M.mail, x0 - 0.22, 1.05, -2.0, x0, 1.45, -1.62);
    deco(M.yellow, x0 - 0.06, 1.25, -0.25, x0, 1.4, -0.12);
    deco(M.metal, x0 - 0.25, 2.4, -1.6, x0, 2.5, -1.55);
    deco(M.lamp, x0 - 0.3, 2.3, -1.66, x0 - 0.18, 2.42, -1.5);
    // passage furniture
    for (const [bx, bz, c] of [[5.0, -6.0, 0x2f5d3a], [5.8, -6.0, 0x3a3d42], [6.6, -6.0, 0x2c4c7a]]) {
      const m = siding(c);
      solid(m, bx - 0.35, 0.35, bz - 0.35, bx + 0.35, 1.45, bz + 0.3, { walk: true });
      deco(m, bx - 0.38, 1.45, bz - 0.4, bx + 0.38, 1.52, bz + 0.33);
    }
    for (const [px, pz, s] of [[3.3, -4.9, 0.5], [8.0, -4.85, 0.4], [9.3, -6.0, 0.6], [11.5, -6.0, 0.7]]) {
      deco(M.pot, px - s * 0.4, 0.35, pz - s * 0.4, px + s * 0.4, 0.35 + s * 0.7, pz + s * 0.4);
      geo.geom(M.plant, new THREE.IcosahedronGeometry(s * 0.6, 0), new THREE.Matrix4().makeTranslation(px, 0.35 + s * 1.2, pz));
    }
    // fence round the yard
    const fence = (ax0, az0, ax1, az1) => {
      const y = H6.U;
      if (ax0 === ax1) { for (let z = az0; z < az1; z += 0.15) deco(M.fence, ax0 - 0.05, y, z, ax0 + 0.05, y + 1.4, z + 0.11); }
      else { for (let x = ax0; x < ax1; x += 0.15) deco(M.fence, x, y, az0 - 0.05, x + 0.11, y + 1.4, az0 + 0.05); }
      world.add({ x0: Math.min(ax0, ax1) - 0.05, x1: Math.max(ax0, ax1) + 0.05, z0: Math.min(az0, az1) - 0.05, z1: Math.max(az0, az1) + 0.05, bottom: y, top: y + 1.4, walk: false });
    };
    fence(20.9, -6.4, 20.9, 8.5);
    fence(12.6, 8.4, 20.9, 8.4);
    fence(15.5, -6.35, 20.9, -6.35);
    // terrace furniture: small table and two chairs, a few weeds
    deco(M.lightWood, 15.0, U + 0.7, 1.0, 15.9, U + 0.75, 1.9);
    deco(M.metal, 15.4, U, 1.4, 15.5, U + 0.7, 1.5);
    for (const cz of [0.6, 2.3]) { deco(M.white, 15.15, U + 0.45, cz - 0.2, 15.75, U + 0.5, cz + 0.2); deco(M.white, 15.15, U + 0.5, cz + (cz < 1 ? -0.2 : 0.15), 15.75, U + 0.95, cz + (cz < 1 ? -0.15 : 0.2)); }

    // ---- ground floor furniture (after the video)
    const g = G;
    const blockF = (mat, ax0, ay0, az0, ax1, ay1, az1) => solid(mat, ax0, ay0, az0, ax1, ay1, az1, { cam: false });
    // kitchen: grey cabinets along the north wall, wood worktop, stove, sink, fridge, upper cabinets
    blockF(M.cabinet, 9.45, g, iz0, ix1, g + 0.86, -3.7);
    deco(M.lightWood, 9.42, g + 0.86, iz0, ix1, g + 0.9, -3.66);
    deco(M.black, 9.6, g + 0.9, -4.2, 10.15, g + 0.91, -3.75);
    deco(M.steel, 10.7, g + 0.9, -4.15, 11.2, g + 0.92, -3.8);
    deco(M.steel, 10.9, g + 0.92, -4.25, 10.95, g + 1.2, -4.2);
    for (let x = 9.5; x < 12.4; x += 0.6) deco(M.metal, x + 0.25, g + 0.72, -3.69, x + 0.35, g + 0.74, -3.67);
    deco(M.cabinet, 9.45, g + 1.6, iz0, 10.1, g + 2.35, -3.95);
    deco(M.cabinet, 11.7, g + 1.6, iz0, ix1, g + 2.35, -3.95);
    blockF(M.white, 11.7, g, -3.6, ix1, g + 2.0, -2.9);
    deco(M.lightWood, 11.0, g + 0.9, -4.25, 11.35, g + 0.92, -3.9); // chopping board
    // dining table with white chairs
    blockF(M.lightWood, 9.9, g + 0.72, -1.15, 11.7, g + 0.76, -0.15);
    for (const [lx, lz] of [[9.95, -1.1], [11.6, -1.1], [9.95, -0.25], [11.6, -0.25]]) deco(M.lightWood, lx, g, lz, lx + 0.05, g + 0.72, lz + 0.05);
    for (const [cx, cz, side] of [[10.3, -1.45, -1], [11.2, -1.45, -1], [10.3, 0.15, 1], [11.2, 0.15, 1]]) {
      deco(M.white, cx - 0.22, g + 0.44, cz - 0.2, cx + 0.22, g + 0.48, cz + 0.2);
      deco(M.white, cx - 0.22, g + 0.48, cz + side * 0.17, cx + 0.22, g + 0.95, cz + side * 0.2);
      for (const [dx, dz] of [[-0.2, -0.18], [0.18, -0.18], [-0.2, 0.16], [0.18, 0.16]]) deco(M.white, cx + dx, g, cz + dz, cx + dx + 0.03, g + 0.44, cz + dz + 0.03);
    }
    // living room: rug, two navy sofas, coffee table, white shelf, picture on the pine wall
    deco(M.rug, 8.4, g, 0.8, 11.3, g + 0.012, 3.4);
    const sofa = (ax0, az0, ax1, az1, backSide) => {
      blockF(M.navy, ax0, g + 0.1, az0, ax1, g + 0.45, az1);
      const b = 0.22;
      if (backSide === 'px') deco(M.navy, ax1 - b, g + 0.45, az0, ax1, g + 0.85, az1);
      if (backSide === 'pz') deco(M.navy, ax0, g + 0.45, az1 - b, ax1, g + 0.85, az1);
      deco(M.navy, ax0, g + 0.45, az0, ax0 + (backSide === 'pz' ? 0.18 : ax1 - ax0), g + 0.65, backSide === 'pz' ? az1 : az0 + 0.18);
      deco(M.navy, backSide === 'pz' ? ax1 - 0.18 : ax0, g + 0.45, backSide === 'pz' ? az0 : az1 - 0.18, ax1, g + 0.65, az1);
      for (const [cx, cz] of backSide === 'pz' ? [[ax0 + 0.5, az1 - 0.35], [ax1 - 0.6, az1 - 0.35]] : [[ax1 - 0.35, az0 + 0.6], [ax1 - 0.35, az1 - 0.6]])
        geo.obox(cx < 9 ? M.cushion : siding(0xd9b2b0), cx, g + 0.62, cz, 0.42, 0.34, 0.14, 0.2, backSide === 'pz' ? 0 : Math.PI / 2, 0);
    };
    sofa(8.2, 3.45, 10.4, 4.25, 'pz');
    sofa(11.45, 0.9, 12.35, 3.2, 'px');
    blockF(M.lightWood, 9.6, g + 0.38, 1.6, 10.8, g + 0.43, 2.6);
    for (const [lx, lz] of [[9.65, 1.65], [10.7, 1.65], [9.65, 2.5], [10.7, 2.5]]) deco(M.lightWood, lx, g, lz, lx + 0.06, g + 0.38, lz + 0.06);
    // white open shelf
    for (let k = 0; k < 5; k++) deco(M.white, 6.5, g + 0.05 + k * 0.42, 0.7, 6.9, g + 0.08 + k * 0.42, 1.9);
    for (const sz of [0.7, 1.87]) for (const sx of [6.5, 6.87]) deco(M.white, sx, g, sz, sx + 0.03, g + 1.8, sz + 0.03);
    world.add({ x0: 6.5, x1: 6.9, z0: 0.7, z1: 1.9, bottom: g, top: g + 1.8, cam: false });
    deco(M.pot, 6.6, g + 1.73, 1.0, 6.8, g + 1.9, 1.2);
    geo.geom(M.plant, new THREE.IcosahedronGeometry(0.18, 0), new THREE.Matrix4().makeTranslation(6.7, g + 2.02, 1.1));
    deco(siding(0xd28ca0), 6.55, g + 0.5, 1.4, 6.85, g + 0.75, 1.7);
    deco(M.black, ix1 - 0.03, g + 1.3, 1.6, ix1, g + 1.9, 2.5);
    deco(siding(0xe6dccb), ix1 - 0.035, g + 1.35, 1.65, ix1 - 0.01, g + 1.85, 2.45);
    // track lights
    deco(M.black, 8.6, Y1 - 0.04, 1.9, 11.0, Y1, 1.96);
    for (const tx of [8.9, 9.7, 10.5]) deco(M.lamp, tx - 0.05, Y1 - 0.2, 1.88, tx + 0.05, Y1 - 0.04, 1.98);
    // corridor rug, fire extinguishers, ceiling lamp
    deco(M.rugDark, 3.3, g, -1.35, 6.2, g + 0.012, -0.15);
    deco(M.rug, 7.0, g, -1.35, 8.8, g + 0.012, -0.15);
    for (const ex of [8.95, 9.15]) {
      geo.geom(M.red, new THREE.CylinderGeometry(0.08, 0.08, 0.5, 10), new THREE.Matrix4().makeTranslation(ex, g + 0.25, -1.45));
    }
    deco(M.lamp, 4.3, Y1 - 0.06, -0.9, 4.7, Y1, -0.5);
    deco(M.lamp, 10.6, Y1 - 0.06, -2.8, 11.0, Y1, -2.4);
    // study (ground): desk under the window with a black chair, low white bench
    blockF(M.lightWood, 2.82, g + 0.72, -3.75, 3.4, g + 0.76, -2.25);
    for (const lz of [-3.7, -2.32]) for (const lx of [2.85, 3.33]) deco(M.lightWood, lx, g, lz, lx + 0.04, g + 0.72, lz + 0.04);
    deco(M.black, 3.55, g + 0.44, -3.2, 3.95, g + 0.48, -2.8);
    deco(M.black, 3.92, g + 0.48, -3.2, 3.96, g + 0.9, -2.8);
    for (const [dx, dz] of [[3.57, -3.18], [3.9, -3.18], [3.57, -2.85], [3.9, -2.85]]) deco(M.black, dx, g, dz, dx + 0.03, g + 0.44, dz + 0.03);
    blockF(M.white, 4.2, g, iz0, 5.55, g + 0.42, -3.85);
    // bedroom 1: bed against the pine wall, desk and chair at the window
    blockF(M.bed, 4.4, g, 3.25, 6.38, g + 0.52, iz1);
    deco(M.white, 6.3, g + 0.52, 3.3, 6.38, g + 0.9, 4.25);
    geo.obox(M.bed, 6.05, g + 0.62, 3.75, 0.35, 0.16, 0.7, 0, 0, 0);
    blockF(M.lightWood, 2.82, g + 0.72, 1.6, 3.4, g + 0.76, 3.0);
    for (const lz of [1.65, 2.92]) for (const lx of [2.85, 3.33]) deco(M.lightWood, lx, g, lz, lx + 0.04, g + 0.72, lz + 0.04);
    deco(M.black, 3.55, g + 0.44, 2.1, 3.95, g + 0.48, 2.5);
    deco(M.black, 3.92, g + 0.48, 2.1, 3.96, g + 0.9, 2.5);
    deco(M.lamp, 4.4, Y1 - 0.06, 1.8, 4.8, Y1, 2.2);

    // ---- upper floor furniture
    const u = U;
    // washer / dryer stack in the nook
    blockF(M.white, 9.45, u, iz0, 10.15, u + 1.75, -3.65);
    for (const wy of [u + 0.42, u + 1.3]) geo.geom(M.black, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 18), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(9.8, wy, -3.64)));
    // bathroom: toilet, sink, shower curtain, shelf
    blockF(M.white, 11.85, u, -2.45, 12.35, u + 0.42, -1.95);
    deco(M.white, 12.2, u + 0.42, -2.45, 12.38, u + 0.85, -1.95);
    blockF(M.white, 11.0, u + 0.7, iz0, 11.6, u + 0.88, -3.85);
    deco(M.steel, 11.27, u + 0.88, -4.27, 11.33, u + 1.05, -4.18);
    deco(M.steel, 11.0, u + 1.1, iz0, 11.6, u + 1.75, iz0 + 0.02);
    deco(M.white, 10.4, u + 2.0, -3.35, 11.05, u + 2.02, -3.33);
    geo.obox(M.white, 10.9, u + 1.0, -3.6, 0.04, 1.95, 0.55, 0, 0.35, 0);
    deco(M.steel, 10.45, u + 1.9, -4.27, 10.55, u + 2.0, -4.15);
    for (let k = 0; k < 3; k++) deco(M.white, 11.75, u + 1.0 + k * 0.4, -3.4, 12.38, u + 1.03 + k * 0.4, -3.0);
    deco(M.lamp, 11.1, Y3 - 0.05, -3.2, 11.5, Y3, -2.8);
    // bedroom 2: bed with a black pillow and a reading lamp
    blockF(M.bed, ix0 + 0.02, u, -4.28, 4.8, u + 0.5, -3.3);
    geo.obox(M.black, 3.15, u + 0.6, -3.8, 0.35, 0.16, 0.55, 0, 0, 0);
    deco(M.metal, 5.0, u, -4.25, 5.05, u + 1.4, -4.2);
    deco(M.lamp, 4.9, u + 1.35, -4.2, 5.1, u + 1.45, -4.05);
    blockF(M.white, 6.35, u, iz0, 9.25, u + 2.0, -3.75);
    deco(M.lamp, 4.0, Y3 - 0.06, -3.2, 4.4, Y3, -2.8);
    // study 2: desk, white chair, flowers, white wardrobe
    blockF(M.lightWood, 2.82, u + 0.72, 1.6, 3.45, u + 0.76, 3.0);
    for (const lz of [1.65, 2.92]) for (const lx of [2.85, 3.38]) deco(M.lightWood, lx, u, lz, lx + 0.04, u + 0.72, lz + 0.04);
    deco(M.white, 3.6, u + 0.44, 2.1, 4.0, u + 0.48, 2.5);
    deco(M.white, 3.97, u + 0.48, 2.1, 4.01, u + 0.92, 2.5);
    blockF(M.white, 5.6, u, 2.9, 6.38, u + 2.1, iz1);
    deco(M.metal, 5.58, u + 1.0, 3.4, 5.6, u + 1.4, 3.43);
    deco(M.metal, 5.58, u + 1.0, 3.7, 5.6, u + 1.4, 3.73);
    // bedroom 3: double bed, blue-grey spread
    blockF(M.bed, 6.55, u, 2.8, 8.75, u + 0.48, iz1);
    deco(M.spread, 6.55, u + 0.48, 2.8, 8.4, u + 0.56, iz1);
    deco(M.white, 8.68, u + 0.48, 2.85, 8.76, u + 1.0, 4.25);
    deco(M.lamp, 7.6, Y3 - 0.06, 1.8, 8.0, Y3, 2.2);
    // bedroom 4: bed and a desk
    blockF(M.bed, 10.3, u, 3.3, ix1 - 0.02, u + 0.5, iz1);
    geo.obox(M.bed, 12.0, u + 0.6, 3.75, 0.35, 0.16, 0.7, 0, 0, 0);
    blockF(M.lightWood, 9.55, u + 0.72, 0.3, 10.15, u + 0.76, 1.5);
    deco(M.lamp, 10.8, Y3 - 0.06, 1.6, 11.2, Y3, 2.0);
    // upstairs corridor lamp
    deco(M.lamp, 6.8, Y3 - 0.06, -0.9, 7.2, Y3, -0.5);

    lights.push([9.6, 2.35, 1.4], [5.0, 2.35, -0.8], [7.5, 5.25, -0.8], [4.6, 5.25, 2.2], [11.0, 5.25, -2.8]);
  }

  // ------------------------------------------------------------ street props
  // lamps on the lane, wall-mounted, black
  for (let z = -46; z < 34; z += 13) {
    const y = L(z) + 3.6;
    deco(M.metal, -2.4, y - 1.2, z - 0.05, -2.3, y, z + 0.05);
    deco(M.metal, -2.4, y - 0.05, z - 0.05, -1.7, y + 0.02, z + 0.05);
    deco(M.metal, -1.85, y - 0.35, z - 0.18, -1.55, y - 0.05, z + 0.18);
    deco(M.lamp, -1.82, y - 0.42, z - 0.12, -1.58, y - 0.35, z + 0.12);
  }
  // birches on the terraces and viewpoint
  const tree = (x, y, z, s) => {
    geo.geom(M.bark, new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 3 * s, 6), new THREE.Matrix4().makeTranslation(x, y + 1.5 * s, z));
    geo.geom(M.leaf, new THREE.IcosahedronGeometry(1.5 * s, 0), new THREE.Matrix4().makeTranslation(x, y + 3.6 * s, z));
    geo.geom(M.leaf, new THREE.IcosahedronGeometry(1.1 * s, 0), new THREE.Matrix4().makeTranslation(x + 0.6 * s, y + 4.5 * s, z - 0.3 * s));
    world.add({ x0: x - 0.25 * s, x1: x + 0.25 * s, z0: z - 0.25 * s, z1: z + 0.25 * s, bottom: y, top: y + 3 * s, walk: false, cam: false });
  };
  const tinfo = {};
  for (const [x, z] of [[-7, -60.5], [-3, -61], [18, -3], [19.6, 6.5], [-20, -30], [-31, 0], [-40, 24], [-52, -10], [-20, 20], [-48, -40], [-30, -55], [-17, 5], [-28, -40], [-39, -2], [-50, 15], [27, -30], [26, 20], [38, 0], [38, -40], [16, 30]]) {
    const w = world.floorAt(x, z, 100, 0.45, tinfo);
    if (w > -20 && tinfo.block && tinfo.block.tag !== 'house') tree(x, w, z, 0.8 + R() * 0.5);
  }

  // ------------------------------------------------------------ boats in Vågen
  const boat = (x, z, len, color, rot) => {
    const m = siding(color);
    const mtx = new THREE.Matrix4().makeRotationY(rot).premultiply(new THREE.Matrix4().makeTranslation(x, -12.9, z));
    const hull = new THREE.BoxGeometry(len, 1.0, len * 0.33);
    geo.geom(m, hull, mtx);
    const cab = new THREE.BoxGeometry(len * 0.3, 1.0, len * 0.22);
    geo.geom(M.white, cab, new THREE.Matrix4().makeTranslation(-len * 0.1, 0.9, 0).premultiply(mtx));
    geo.geom(M.metal, new THREE.CylinderGeometry(0.06, 0.06, len * 0.5, 5), new THREE.Matrix4().makeTranslation(len * 0.15, len * 0.25, 0).premultiply(mtx));
  };
  boat(-88, 10, 9, 0x2c4c7a, 0.04);
  boat(-88.5, 26, 7, 0xeeede6, -0.03);
  boat(-89, -12, 11, 0x9a3324, 0.02);
  boat(-120, 40, 18, 0xeeede6, 0.6);

  // ------------------------------------------------------------ build static meshes
  const meshes = geo.build(scene);

  // ------------------------------------------------------------ water
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1c3440, roughness: 0.12, metalness: 0.4 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-84 - 800, -12.9, 0);
  water.receiveShadow = true;
  scene.add(water);
  mapRects.unshift({ x0: -400, z0: -400, x1: -84, z1: 400, c: '#22404d', h: -13 });

  // ------------------------------------------------------------ mountains (Fløyen, Ulriken, Askøy)
  const mountains = buildMountains(scene);
  // Fløibanen: the funicular up Fløyen, two cars passing in the middle
  const funi = buildFunicular(scene, mountains.height);

  return { world, meshes, doors, lights, mapRects, M, mountains, funi, bakeZ, bryggen };
}

// ---------------------------------------------------------------------------
function buildMountains(scene) {
  const R = rng(77);
  const peaks = [
    // Fløyen ridge to the east, Rundemanen behind, Ulriken south-east, Sandviksfjellet north
    [260, -60, 220, 210], [330, -200, 260, 240], [380, 120, 300, 200], [420, 360, 340, 230],
    [200, -320, 230, 190], [80, -420, 180, 160], [520, -20, 360, 220],
    // islands across the water (Askøy), low
    [-520, -160, 130, 260], [-560, 220, 110, 280], [-300, -460, 80, 200],
    // Nordnes peninsula, low and long
    [-210, 220, 28, 90],
  ];
  const height = (x, z) => {
    let h = -40;
    for (const [px, pz, ph, r] of peaks) {
      const d2 = ((x - px) ** 2 + (z - pz) ** 2) / (r * r);
      h = Math.max(h, ph * Math.exp(-d2 * 1.6) - 40 + ph * 0.05);
    }
    // noise
    const n = Math.sin(x * 0.031 + z * 0.017) * Math.cos(z * 0.027 - x * 0.012) * 14 + Math.sin(x * 0.11 + z * 0.07) * 4;
    h += n * Math.min(1, Math.max(0, (h + 20) / 60));
    // hills around the town (not over the water)
    if (x > -84) {
      const e = Math.max(0, x - 30);
      h = Math.max(h, 6 + e * 0.55 + (e / 300) ** 2 * 120 - z * 0.09 + Math.sin(z * 0.05 + x * 0.03) * 3, 4 + (x + 84) * 0.1 - z * 0.09 + Math.max(0, -z - 63) * 0.25 + Math.max(0, z - 63) * 0.05);
    }
    // keep the town and harbour clear
    if (x > -90 && x < 44.5 && z > -62.5 && z < 62.5) h = Math.min(h, -30);
    return h;
  };
  const size = 1800, seg = 240;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = height(x, z);
    pos.setY(i, h);
    // colour by height: forest, heath, rock, a dusting of November snow on top
    const t = R() * 0.08;
    if (h > 175) c.setRGB(0.86 + t, 0.88 + t, 0.9 + t);
    else if (h > 130) c.setRGB(0.42 + t, 0.42 + t, 0.4 + t);
    else if (h > 60) c.setRGB(0.27 + t, 0.33 + t, 0.22);
    else if (h > -12) c.setRGB(0.16 + t * 0.5, 0.27 + t, 0.15);
    else c.setRGB(0.18, 0.2, 0.2);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = false;
  scene.add(mesh);

  // conifers on the lower slopes
  const treeGeo = new THREE.ConeGeometry(3.2, 11, 5);
  treeGeo.translate(0, 5.5, 0);
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x23361f, roughness: 1, flatShading: true });
  const count = 2600;
  const inst = new THREE.InstancedMesh(treeGeo, treeMat, count);
  const m4 = new THREE.Matrix4();
  let k = 0, tries = 0;
  while (k < count && tries < 40000) {
    tries++;
    const x = -700 + R() * 1400, z = -700 + R() * 1400;
    const h = height(x, z);
    if (h < -8 || h > 120) continue;
    if (x > -100 && x < 60 && z > -80 && z < 80) continue;
    const s = 0.7 + R() * 0.8;
    m4.compose(new THREE.Vector3(x, h - 1, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), new THREE.Vector3(s, s * (0.8 + R() * 0.5), s));
    inst.setMatrixAt(k++, m4);
  }
  inst.count = k;
  scene.add(inst);

  // Ulriken's TV mast
  const mastH = height(380, 120);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3.0, 60, 8), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 }));
  mast.position.set(380, mastH + 30, 120);
  scene.add(mast);
  const mastTop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 25, 6), new THREE.MeshStandardMaterial({ color: 0xb52a1d, emissive: 0x5a0f08 }));
  mastTop.position.set(380, mastH + 72, 120);
  scene.add(mastTop);

  // Fløien Folkerestaurant at the top of the funicular
  const top = new THREE.Vector3(250, height(250, -60), -60);
  const rest = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 10), new THREE.MeshStandardMaterial({ color: 0xeeede6, roughness: 0.8 }));
  rest.position.set(top.x + 6, top.y + 3, top.z);
  scene.add(rest);
  const restRoof = new THREE.Mesh(new THREE.BoxGeometry(19, 1, 11), new THREE.MeshStandardMaterial({ color: 0x3a2d28 }));
  restRoof.position.set(top.x + 6, top.y + 7, top.z);
  scene.add(restRoof);

  return { mesh, height, top };
}

function buildFunicular(scene, height) {
  const a = new THREE.Vector3(56, 0, -48), b = new THREE.Vector3(244, 0, -60);
  const pts = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t + Math.sin(t * Math.PI) * 14;
    const h = Math.max(height(x, z), i === 0 ? 2 : -100) + 1.2;
    pts.push(new THREE.Vector3(x, h, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.9, 4, false), new THREE.MeshStandardMaterial({ color: 0x5c5850, roughness: 0.9 }));
  scene.add(tube);
  const cars = [];
  for (const col of [0x2f6db5, 0xc4312a]) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 3), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }));
    body.position.y = 2;
    const win = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 3.05), new THREE.MeshStandardMaterial({ color: 0x1b2730, roughness: 0.1, metalness: 0.5 }));
    win.position.y = 2.6;
    car.add(body, win);
    scene.add(car);
    cars.push(car);
  }
  return { curve, cars };
}
