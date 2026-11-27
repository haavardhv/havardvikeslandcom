// Myreze's office: Halfdan Kjerulfs gate 4, 4th floor, after the Blender model of the interior
// (MZBergen v13) and the architect's plan in it.
//
// Everything here is written in the plan coordinates of that model, in metres: x runs along
// Halfdan Kjerulfs gate (west to east, as you face the building from the street), y runs from the
// street facade (y = -5.1, its outer face) back into the building, and heights are above the
// office floor. The module turns them into the group's local frame (x, height, -y), so the group
// sits at the plan's origin with rotation.y set from the facade, exactly like house 6.
//
//   back (y = 11.4)
//   +---------+--------------------------------------+
//   | server  |  lounge: sofa      DJ   | green-screen|
//   | room  D |                    booth|   studio    |
//   +--D------+--- TV wall ---+  +--D--+-------------+
//   |                         |  |kitchen|  light    |
//   |  meeting corner,        |  |       |  well     |
//   |  pool table             +--+---+---+--+--------+
//   |                         |wardrobe|hall| WCs    |
//   |                         +-     --+    +--------+
//   |   open office: 8 desks, Myreze logo   entrance  D <- stairs
//   |                                  +--glass--D-----+
//   |                                  | glass office  |
//   +----------------------------------+--+ bay +-----+
//   street side (Halfdan Kjerulfs gate)
import * as THREE from '../vendor/three.module.min.js';
import { Geo, World } from './engine.js';
import { textTexture } from './textures.js';

// The plan's frame on the map: (0, 0) of the plan and the direction of +x, from the street facade
// of the building at Halfdan Kjerulfs gate 4 (OSM), with the office's light well over the
// courtyard notch behind the east wing.
// The plan sits 0.75 m behind the facade line, so that the bay window (which reaches y = -5.8)
// stays inside the building's outer wall: from outside the building looks as it did, and from
// inside you look out past the back of that wall, which is never drawn.
export const OFFICE_PLAN = { facadeA: [-204.8, -4.8], facadeB: [-182.6, 10.6], along: 11.3, depth: 5.85 };
export function officeFrame() {
  const [ax, az] = OFFICE_PLAN.facadeA, [bx, bz] = OFFICE_PLAN.facadeB;
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  const ix = uz, iz = -ux;                       // into the building, away from the street
  const ox = ax + ux * OFFICE_PLAN.along + ix * OFFICE_PLAN.depth, oz = az + uz * OFFICE_PLAN.along + iz * OFFICE_PLAN.depth;
  return { ox, oz, ux, uz, theta: Math.atan2(-uz, ux) };
}

export function buildOffice(group, T, FO) {
  const geo = new Geo();
  const world = new World(4);
  const CH = 3.0, C = FO + CH;
  const std = (o, tex) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o }); if (tex) m.map = tex; return m; };
  const M = {
    // the walls glow a little, like house 6: the building around the office keeps the sun out
    white: std({ color: 0xeceadf, roughness: 0.95, emissive: 0x2c2b27 }),
    dark: std({ color: 0x3a3b3d, roughness: 0.9, emissive: 0x0d0d0e }),
    beige: std({ color: 0xcabfaf, roughness: 0.95, emissive: 0x29261f }),
    out: std({ color: 0xcdbf9f, roughness: 0.9 }),                       // the building's plaster
    stair: std({ color: 0xd9d5cb, roughness: 0.9 }),
    ceiling: std({ color: 0xf0eee1, roughness: 1, emissive: 0x2e2d29 }),
    carpet: std({ color: 0x6b6058, roughness: 1, emissive: 0x0b0908 }),
    wood: std({ color: 0xb59a80, roughness: 0.6 }, T.floor),
    tile: std({ color: 0xffffff, roughness: 0.35 }, T.tileWhite),
    trim: std({ color: 0xf3f2ee, roughness: 0.6 }),
    frame: std({ color: 0x151515, roughness: 0.4, metalness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd6e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false }),
    desk: std({ color: 0x292929, roughness: 0.5 }),
    deskWood: std({ color: 0x4b362d, roughness: 0.55 }),
    screen: std({ color: 0x1a1a1a, roughness: 0.3 }),
    display: std({ color: 0x0b0f14, roughness: 0.2, emissive: 0x3b6e9c, emissiveIntensity: 0.55 }),
    divider: std({ color: 0xd7d8d6, roughness: 0.9 }),
    chair: std({ color: 0x2a2a2a, roughness: 0.7 }),
    leather: std({ color: 0x4a3226, roughness: 0.55 }),
    sofa: std({ color: 0x8f9193, roughness: 1 }),
    pillow: std({ color: 0xe9e7e2, roughness: 1 }),
    kitchen: std({ color: 0x574c41, roughness: 0.6 }),
    worktop: std({ color: 0x585858, roughness: 0.35 }),
    steel: std({ color: 0xaab0b5, roughness: 0.25, metalness: 0.8 }),
    black: std({ color: 0x111111, roughness: 0.4 }),
    felt: std({ color: 0x1f5f3a, roughness: 1 }),
    green: std({ color: 0x14b414, roughness: 0.9, emissive: 0x064806 }),
    porcelain: std({ color: 0xf4f4f2, roughness: 0.25 }),
    mirror: std({ color: 0xcfd8dc, roughness: 0.05, metalness: 0.9 }),
    curtain: std({ color: 0x898279, roughness: 1 }),
    panel: std({ color: 0xd7c2a5, roughness: 1 }),
    plant: std({ color: 0x3f7a3a, roughness: 0.9 }),
    pot: std({ color: 0xe9e6df, roughness: 0.6 }),
    lamp: std({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 2.2 }),
    led: std({ color: 0x0a0a0a, emissive: 0x39d353, emissiveIntensity: 1.6 }),
    ledBlue: std({ color: 0x0a0a0a, emissive: 0x3b82f6, emissiveIntensity: 1.6 }),
    coat: [0x2b2d31, 0x5a4a3a, 0x1f3550, 0x7a2b2b, 0x6b6b6b].map(c => std({ color: c, roughness: 1 })),
  };
  M.glass.userData.noCast = true;
  M.lamp.userData.noCast = true;

  // ---- plan -> local: x stays, y becomes -z, heights are above the floor
  const B = (m, x0, y0, x1, y1, h0, h1, skip) => geo.box(m, Math.min(x0, x1), FO + h0, -Math.max(y0, y1), Math.max(x0, x1), FO + h1, -Math.min(y0, y1), skip || '');
  const block = (x0, y0, x1, y1, h0, h1, o = {}) => world.add({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: -Math.max(y0, y1), z1: -Math.min(y0, y1), bottom: FO + h0, top: FO + h1, walk: o.walk !== false, cam: o.cam !== false, solid: o.solid !== false, tag: o.tag });
  const solid = (m, x0, y0, x1, y1, h0, h1, o = {}) => { if (m) B(m, x0, y0, x1, y1, h0, h1); return block(x0, y0, x1, y1, h0, h1, o); };
  const furn = (m, x0, y0, x1, y1, h0, h1) => solid(m, x0, y0, x1, y1, h0, h1, { cam: false });
  const at = (x, y, h) => new THREE.Matrix4().makeTranslation(x, FO + h, -y);

  // ---- walls with openings. 'x' walls run along x (the wall's thickness is y c0..c1);
  // 'y' walls run along y (thickness x c0..c1). Openings: { a0, a1, y0, y1, door, glass }.
  // mA faces the low side of the thickness (c0), mB the high side.
  function wall(axis, c0, c1, a0, a1, ops, mA, mB = mA) {
    const cuts = new Set([a0, a1]);
    for (const o of ops) { cuts.add(o.a0); cuts.add(o.a1); }
    const pts = [...cuts].filter(v => v >= a0 && v <= a1).sort((p, q) => p - q);
    const mid = (c0 + c1) / 2;
    const piece = (s, e, h0, h1) => {
      if (e - s < 1e-4 || h1 - h0 < 1e-3) return;
      if (axis === 'x') { B(mA, s, c0, e, mid, h0, h1); B(mB, s, mid, e, c1, h0, h1); }
      else { B(mA, c0, s, mid, e, h0, h1); B(mB, mid, s, c1, e, h0, h1); }
    };
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i], e = pts[i + 1];
      const o = ops.find(o => o.a0 <= s + 1e-4 && o.a1 >= e - 1e-4);
      if (o) { piece(s, e, 0, o.y0); piece(s, e, o.y1, CH); } else piece(s, e, 0, CH);
    }
    // collision: solid except under door lintels
    const add = (p, q, h0, h1) => {
      if (q - p < 1e-4) return;
      if (axis === 'x') block(p, c0, q, c1, h0, h1, { walk: false });
      else block(c0, p, c1, q, h0, h1, { walk: false });
    };
    let s = a0;
    for (const d of ops.filter(o => o.door).sort((p, q) => p.a0 - q.a0)) { add(s, d.a0, 0, CH); add(d.a0, d.a1, d.y1, CH); s = d.a1; }
    add(s, a1, 0, CH);
    // window frames: black, slim, with a glazing bar, glass and a white sill inside
    const A = (a, c) => axis === 'x' ? [a, c] : [c, a];
    const bx = (m, a, b, ca, cb, h0, h1) => { const [x0, y0] = A(a, ca), [x1, y1] = A(b, cb); B(m, x0, y0, x1, y1, h0, h1); };
    for (const o of ops) {
      if (o.door) continue;
      const f = 0.05;
      bx(M.frame, o.a0 - f, o.a1 + f, mid - 0.04, mid + 0.04, o.y0 - f, o.y0);
      bx(M.frame, o.a0 - f, o.a1 + f, mid - 0.04, mid + 0.04, o.y1, o.y1 + f);
      bx(M.frame, o.a0 - f, o.a0, mid - 0.04, mid + 0.04, o.y0, o.y1);
      bx(M.frame, o.a1, o.a1 + f, mid - 0.04, mid + 0.04, o.y0, o.y1);
      const hm = o.y0 + (o.y1 - o.y0) * 0.7;
      bx(M.frame, o.a0, o.a1, mid - 0.03, mid + 0.03, hm - 0.025, hm + 0.025);
      if (o.a1 - o.a0 > 0.8) { const am = (o.a0 + o.a1) / 2; bx(M.frame, am - 0.025, am + 0.025, mid - 0.03, mid + 0.03, o.y0, o.y1); }
      bx(M.glass, o.a0, o.a1, mid - 0.005, mid + 0.005, o.y0, o.y1);
      const sill = o.inside === 'hi' ? [c1, c1 + 0.12] : [c0 - 0.12, c0];
      bx(M.trim, o.a0 - 0.05, o.a1 + 0.05, sill[0], sill[1], o.y0 - 0.04, o.y0);
    }
  }
  const win = (a0, a1, y0 = 0.45, y1 = 2.36, inside = 'hi') => ({ a0, a1, y0, y1, inside });
  const opening = (a0, a1, y1 = 2.2) => ({ a0, a1, y0: 0, y1, door: true });

  // ---- glass partitions with black frames
  function glassWall(axis, c0, c1, a0, a1, h1 = 2.3, doorAt = null) {
    const mid = (c0 + c1) / 2;
    const A = (a, c) => axis === 'x' ? [a, c] : [c, a];
    const bx = (m, a, b, ca, cb, h0, hh) => { const [x0, y0] = A(a, ca), [x1, y1] = A(b, cb); B(m, x0, y0, x1, y1, h0, hh); };
    bx(M.glass, a0, a1, mid - 0.01, mid + 0.01, 0, h1);
    bx(M.frame, a0, a1, c0, c1, 0, 0.04);
    bx(M.frame, a0, a1, c0, c1, h1, h1 + 0.05);
    for (let a = a0; a <= a1 + 1e-6; a += Math.max(0.3, (a1 - a0) / Math.max(1, Math.round((a1 - a0) / 1.1)))) bx(M.frame, Math.min(a, a1 - 0.03), Math.min(a + 0.03, a1), c0, c1, 0, h1);
    if (h1 < CH) bx(M.white, a0, a1, c0, c1, h1 + 0.05, CH);
    const add = (p, q) => { if (q - p > 1e-4) { if (axis === 'x') block(p, c0, q, c1, 0, CH, { walk: false }); else block(c0, p, c1, q, 0, CH, { walk: false }); } };
    if (doorAt) { add(a0, doorAt[0]); add(doorAt[1], a1); } else add(a0, a1);
  }

  // =================================================================== floor and ceiling
  // floor: carpet, the glass office in oak, the toilets tiled; the light well stays open
  const floorZones = [[-4.12, -4.71, 3.96, 2.18], [3.96, -1.7, 7.95, 0.37], [3.96, 0.37, 5.09, 2.18], [-4.12, 2.18, 3.85, 5.75], [-4.12, 5.75, 6.6, 11.0]];
  for (const [x0, y0, x1, y1] of floorZones) { B(M.carpet, x0, y0, x1, y1, -0.3, 0, 'ny'); block(x0, y0, x1, y1, -0.3, 0); }
  B(M.wood, 3.96, -5.4, 7.95, -1.7, -0.3, 0, 'ny'); block(3.96, -5.4, 7.95, -1.7, -0.3, 0);
  B(M.tile, 5.09, 0.37, 6.97, 2.18, -0.3, 0, 'ny'); block(5.09, 0.37, 6.97, 2.18, -0.3, 0);
  const ceilZones = [[-4.52, -5.8, 8.35, 2.18], [-4.52, 2.18, 3.85, 5.75], [-4.52, 5.75, 7.0, 11.4]];
  for (const [x0, y0, x1, y1] of ceilZones) { B(M.ceiling, x0, y0, x1, y1, CH, CH + 0.3, 'py'); block(x0, y0, x1, y1, CH, CH + 0.3, { walk: false }); }

  // =================================================================== outer walls
  // street facade, with three tall windows into the open office
  wall('x', -5.1, -4.71, -3.93, 3.9, [win(-2.51, -1.33), win(-0.52, 0.66), win(1.06, 2.24)], M.out, M.white);
  // the bay window (a karnapp) in front of the glass office
  wall('x', -5.8, -5.4, 4.3, 6.72, [win(4.92, 6.1)], M.out, M.beige);
  wall('y', 3.9, 4.3, -5.8, -4.71, [win(-5.3, -4.85, 0.45, 2.36, 'hi')], M.out, M.beige);
  wall('y', 6.72, 7.12, -5.8, -4.71, [win(-5.3, -4.85, 0.45, 2.36, 'lo')], M.beige, M.out);
  wall('x', -5.1, -4.71, 7.12, 8.35, [], M.out, M.beige);
  // east: against the stairwell, with the door you come in by
  wall('y', 7.95, 8.35, -5.1, 0.37, [], M.beige, M.stair);
  // west: the neighbours (dark on the office side, like the model)
  wall('y', -3.93, -3.53, -5.1, 5.63, [], M.stair, M.dark);
  // the toilets' outer wall, and the light well round the courtyard
  wall('y', 6.97, 7.37, 0.21, 2.5, [], M.white, M.out);
  wall('x', 2.18, 2.5, 3.85, 7.37, [win(4.15, 4.95, 0.45, 2.36, 'lo'), win(5.31, 6.11, 1.2, 2.36, 'lo')], M.white, M.out);
  wall('y', 3.85, 4.15, 2.5, 6.45, [win(2.85, 4.0, 0.45, 2.36, 'lo')], M.white, M.out);
  wall('x', 5.45, 5.75, 4.15, 6.6, [win(4.71, 5.91, 0.45, 2.36, 'hi')], M.out, M.white);
  wall('y', 6.6, 7.0, 5.45, 11.4, [win(6.75, 7.95, 0.45, 2.36, 'lo')], M.white, M.out);
  // back of the lounge and the server room
  wall('x', 11.0, 11.4, -2.5, 7.0, [win(-1.08, 0.12, 0.45, 2.36, 'lo')], M.white, M.out);
  wall('y', -4.52, -4.12, 5.63, 10.4, [], M.stair, M.white);
  wall('x', 10.0, 10.4, -4.52, -2.5, [win(-3.99, -2.9, 0.45, 2.36, 'lo')], M.white, M.out);

  // =================================================================== partitions
  // glass office: glass towards the desks (with the door) and towards the entrance
  B(M.beige, 3.84, -4.71, 3.96, -4.1, 0, CH); block(3.84, -4.71, 3.96, -4.1, 0, CH, { walk: false });
  glassWall('y', 3.84, 3.96, -4.1, -1.7, 2.3);
  glassWall('x', -1.8, -1.7, 3.96, 6.77, 2.3, [4.95, 5.85]);
  wall('x', -1.8, -1.7, 6.77, 7.95, [], M.beige, M.white);
  // the toilets: two cubicles, doors from the little hall by the kitchen
  wall('x', 0.21, 0.37, 4.98, 6.97, [], M.white, M.white);
  wall('y', 4.98, 5.09, 0.37, 2.18, [opening(0.62, 1.22), opening(1.52, 2.12)], M.white, M.white);
  wall('x', 1.33, 1.46, 5.09, 6.97, [], M.white, M.white);
  // wardrobe niche (dark), its back wall shared with the kitchen
  wall('x', 1.86, 2.1, -0.17, 2.64, [], M.dark, M.white);
  wall('y', -0.17, -0.05, 0.47, 1.86, [], M.dark, M.dark);
  solid(M.dark, -0.17, 0.21, 0.34, 0.47, 0, CH, { walk: false });
  solid(M.white, 2.32, 0.21, 3.39, 0.47, 0, CH, { walk: false });
  solid(M.dark, 2.42, 1.48, 2.64, 1.86, 0, CH, { walk: false });
  // meeting corner | kitchen, and the kitchen's back wall
  wall('y', -0.17, 0.35, 2.1, 5.55, [], M.dark, M.white);
  wall('x', 4.63, 4.95, 0.35, 2.6, [], M.white, M.white);
  solid(M.white, 0.35, 4.95, 1.25, 5.55, 0, CH, { walk: false });     // the slim column that was a plank wall
  // the TV wall between the meeting corner and the lounge, a TV on each side
  wall('x', 5.55, 5.8, -1.2, 1.25, [], M.white, M.white);
  solid(M.white, 1.12, 5.8, 1.37, 6.63, 0, CH, { walk: false });
  // the DJ booth: a glass door from the kitchen passage
  wall('y', 2.6, 2.8, 4.63, 6.45, [opening(4.87, 5.66)], M.white, M.white);
  glassWall('x', 6.4, 6.5, 2.8, 3.85, 2.3);
  // the server room, with a soundproof door
  wall('x', 5.63, 6.03, -4.52, -2.3, [opening(-3.41, -2.61)], M.white, M.white);
  wall('y', -2.5, -2.3, 6.03, 11.0, [], M.white, M.white);

  // =================================================================== doors
  const doors = [];
  function door(x, y, w, axis, mat, auto, openAngle, glass = false, h = 2.15) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(w), h, 0.05), mat);
    leaf.castShadow = true; leaf.receiveShadow = true;
    leaf.position.set(w / 2, h / 2, 0);
    if (glass) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(w) - 0.1, h - 0.1, 0.06), M.glass);
      leaf.add(pane);
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.08), M.steel);
    handle.position.set(w / 2 - Math.sign(w) * 0.08, 1.05 - h / 2, 0);
    leaf.add(handle);
    const pivot = new THREE.Group();
    pivot.position.set(x, FO, -y);
    pivot.rotation.y = axis === 'x' ? 0 : Math.PI / 2;
    pivot.add(leaf);
    group.add(pivot);
    const d = { pivot, open: auto ? 0 : 1, target: auto ? 0 : 1, auto, angle: openAngle,
      local: new THREE.Vector3(x + (axis === 'x' ? w / 2 : 0), FO, -(y + (axis === 'y' ? w / 2 : 0))) };
    d.base = pivot.rotation.y;
    pivot.rotation.y = d.base + d.angle * d.open;
    doors.push(d);
    return d;
  }
  const glassLeaf = std({ color: 0x151515, roughness: 0.4, metalness: 0.4 });
  door(4.95, -1.75, 0.9, 'x', glassLeaf, true, -1.5, true);            // glass office, from the entrance hall
  door(2.7, 4.87, 0.79, 'y', glassLeaf, true, 1.5, true);              // DJ booth
  door(-3.41, 5.83, 0.8, 'x', M.dark, true, -1.5);                     // server room
  door(5.03, 0.62, 0.6, 'y', M.white, false, 1.45);                    // toilets, standing open
  door(5.03, 1.52, 0.6, 'y', M.white, false, 1.45);
  // the door to the stairwell, and a sign beside it
  B(M.dark, 7.92, -1.3, 7.95, -0.26, 0, 2.2);
  B(M.frame, 7.91, -1.34, 7.95, -1.3, 0, 2.24); B(M.frame, 7.91, -0.26, 7.95, -0.22, 0, 2.24); B(M.frame, 7.91, -1.34, 7.95, -0.22, 2.2, 2.24);
  B(M.steel, 7.87, -0.46, 7.92, -0.38, 0.98, 1.06);
  {
    const t = textTexture(['TRAPP · STAIRS ↓'], { w: 512, h: 96, bg: '#1b1e22', fg: '#f3f2ee', font: '700 46px "Archivo", sans-serif', radius: 10 });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.14), new THREE.MeshBasicMaterial({ map: t }));
    s.position.set(7.92, FO + 2.35, 0.78); s.rotation.y = -Math.PI / 2; group.add(s);
  }

  // =================================================================== the Myreze logo, lit, on the dark wall
  const logoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaTest: 0.05, fog: false });
  new THREE.TextureLoader().load('img/myreze-logo.png', t => { t.colorSpace = THREE.SRGBColorSpace; logoMat.map = t; logoMat.needsUpdate = true; });
  {
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.74, 1.1), logoMat);
    logo.position.set(-3.5, FO + 1.68, 2.11); logo.rotation.y = Math.PI / 2; group.add(logo);
    const glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.1), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    halo.position.set(-3.515, FO + 1.68, 2.11); halo.rotation.y = Math.PI / 2; group.add(halo);
  }

  // =================================================================== the open office: eight desks in two rows
  const monitor = (cx, cy, face) => {
    // face: +1 the screen looks towards +y, -1 towards -y
    B(M.screen, cx - 0.04, cy - 0.04, cx + 0.04, cy + 0.04, 0.74, 0.9);
    B(M.screen, cx - 0.28, cy - 0.02, cx + 0.28, cy + 0.02, 0.9, 1.24);
    B(M.display, cx - 0.26, cy + face * 0.021, cx + 0.26, cy + face * 0.025, 0.92, 1.22);
  };
  const officeChair = (cx, cy, face) => {
    // face: the way the sitter looks (+1 towards +y)
    geo.geom(M.chair, new THREE.CylinderGeometry(0.28, 0.28, 0.04, 5), at(cx, cy, 0.06));
    B(M.chair, cx - 0.03, cy - 0.03, cx + 0.03, cy + 0.03, 0.06, 0.45);
    B(M.chair, cx - 0.24, cy - 0.23, cx + 0.24, cy + 0.23, 0.45, 0.53);
    B(M.chair, cx - 0.22, cy - face * 0.26, cx + 0.22, cy - face * 0.2, 0.55, 1.05);
    for (const s of [-1, 1]) B(M.chair, cx + s * 0.25, cy - 0.15, cx + s * 0.22, cy + 0.12, 0.53, 0.72);
    world.add({ x0: cx - 0.25, x1: cx + 0.25, z0: -cy - 0.25, z1: -cy + 0.25, bottom: FO, top: FO + 0.53, cam: false });
  };
  const cols = [-2.3, -0.77, 1.11, 2.64];
  for (const cx of cols) {
    for (const [y0, y1, face] of [[-3.55, -2.8, 1], [-2.8, -2.05, -1]]) {
      furn(M.desk, cx - 0.75, y0, cx + 0.75, y1, 0.72, 0.75);
      for (const lx of [cx - 0.72, cx + 0.69]) B(M.desk, lx, y0 + 0.05, lx + 0.03, y1 - 0.05, 0, 0.72);
      // screens face the sitter: row by the windows sits on the window side
      const cyM = face > 0 ? y1 - 0.25 : y0 + 0.25;
      monitor(cx - 0.3, cyM, -face); monitor(cx + 0.3, cyM, -face);
      B(M.black, cx - 0.22, (y0 + y1) / 2 - 0.08 * face - 0.08, cx + 0.22, (y0 + y1) / 2 - 0.08 * face + 0.08, 0.75, 0.765);
      officeChair(cx, face > 0 ? y0 - 0.45 : y1 + 0.45, face > 0 ? 1 : -1);
    }
  }
  // the divider screens between the rows
  B(M.divider, cols[0] - 0.75, -2.82, cols[3] + 0.75, -2.78, 0.75, 1.3);
  // a 4 m linear lamp over the desks, and the sound panel above it
  const linear = (x0, x1, y, h = 2.6) => {
    B(M.black, x0, y - 0.025, x1, y + 0.025, h, h + 0.06);
    B(M.lamp, x0 + 0.02, y - 0.02, x1 - 0.02, y + 0.02, h - 0.005, h);
    for (const x of [x0 + 0.3, x1 - 0.3]) B(M.steel, x - 0.003, y - 0.003, x + 0.003, y + 0.003, h + 0.06, CH);
  };
  linear(-2.1, 1.9, -3.2); linear(-2.1, 1.9, -2.4);
  B(M.panel, -1.96, -4.13, 1.8, -1.1, CH - 0.04, CH);
  // curtains beside the street windows
  for (const x of [-2.75, -1.33, -0.76, 0.66, 0.82, 2.24]) B(M.curtain, x, -4.66, x + 0.24, -4.55, 0.05, CH - 0.05);
  // plants in the corners
  const plant = (x, y, s = 1) => {
    geo.geom(M.pot, new THREE.CylinderGeometry(0.2 * s, 0.16 * s, 0.4 * s, 10), at(x, y, 0.2 * s));
    for (let k = 0; k < 5; k++) geo.geom(M.plant, new THREE.IcosahedronGeometry(0.26 * s, 0), at(x + Math.cos(k * 1.3) * 0.12 * s, y + Math.sin(k * 1.3) * 0.12 * s, (0.55 + k * 0.17) * s));
    world.add({ x0: x - 0.22 * s, x1: x + 0.22 * s, z0: -y - 0.22 * s, z1: -y + 0.22 * s, bottom: FO, top: FO + 0.4 * s, cam: false });
  };
  plant(-3.2, -4.35); plant(3.5, -4.35, 1.1); plant(-3.2, 0.0, 0.9);

  // =================================================================== glass office in the bay
  furn(M.deskWood, 6.18, -4.1, 7.02, -2.09, 0.7, 0.74);
  B(M.deskWood, 6.2, -4.08, 6.24, -2.11, 0, 0.7); B(M.deskWood, 6.96, -4.08, 7.0, -2.11, 0, 0.7);
  B(M.screen, 6.36, -3.2, 6.4, -3.14, 0.74, 0.9); B(M.screen, 6.34, -3.45, 6.38, -2.89, 0.9, 1.19); B(M.display, 6.38, -3.43, 6.39, -2.91, 0.92, 1.17);
  B(M.black, 6.6, -3.35, 6.77, -3.02, 0.74, 0.75);
  {
    // the chair behind the desk, facing the screen (-x)
    const cx = 7.42, cy = -3.25;
    geo.geom(M.chair, new THREE.CylinderGeometry(0.28, 0.28, 0.04, 5), at(cx, cy, 0.06));
    B(M.chair, cx - 0.03, cy - 0.03, cx + 0.03, cy + 0.03, 0.06, 0.45);
    B(M.leather, cx - 0.24, cy - 0.24, cx + 0.24, cy + 0.24, 0.45, 0.55);
    B(M.leather, cx + 0.2, cy - 0.23, cx + 0.27, cy + 0.23, 0.55, 1.1);
    world.add({ x0: cx - 0.25, x1: cx + 0.25, z0: -cy - 0.25, z1: -cy + 0.25, bottom: FO, top: FO + 0.55, cam: false });
  }
  furn(M.deskWood, 6.92, -4.7, 7.82, -4.46, 1.13, 1.17);              // shelf
  for (let k = 0; k < 7; k++) B(M.coat[k % 5], 6.98 + k * 0.1, -4.66, 7.05 + k * 0.1, -4.5, 1.17, 1.4 + (k % 3) * 0.05);
  // the brown leather sofa against the glass, white cushions
  furn(M.leather, 4.0, -4.05, 4.9, -2.3, 0.1, 0.45);
  B(M.leather, 4.0, -4.05, 4.22, -2.3, 0.45, 0.8);
  B(M.leather, 4.0, -4.05, 4.9, -3.85, 0.45, 0.62); B(M.leather, 4.0, -2.5, 4.9, -2.3, 0.45, 0.62);
  for (const [y, r] of [[-3.6, 0.3], [-2.6, -0.3], [-3.1, 0.1]]) geo.obox(M.pillow, 4.35, FO + 0.62, -y, 0.14, 0.32, 0.4, 0, 0, r);
  // two ring lamps
  for (const y of [-2.79, -3.64]) {
    geo.geom(M.black, new THREE.TorusGeometry(0.38, 0.03, 6, 28), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(at(5.5, y, 2.6)));
    for (const a of [0, 2.1, 4.2]) B(M.steel, 5.5 + Math.cos(a) * 0.38 - 0.003, y + Math.sin(a) * 0.38 - 0.003, 5.5 + Math.cos(a) * 0.38 + 0.003, y + Math.sin(a) * 0.38 + 0.003, 2.6, CH);
  }
  plant(7.5, -1.95, 0.8);

  // =================================================================== entrance hall
  linear(3.6, 7.6, -0.8);
  // umbrella stand and a bench by the door
  geo.geom(M.black, new THREE.CylinderGeometry(0.13, 0.13, 0.55, 10), at(7.65, 0.05, 0.275));
  for (let k = 0; k < 3; k++) geo.obox(M.coat[k], 7.65 + (k - 1) * 0.05, FO + 0.75, -0.05, 0.03, 0.5, 0.03, 0, 0, (k - 1) * 0.15);
  furn(M.deskWood, 6.0, -1.65, 7.3, -1.3, 0.42, 0.46);

  // =================================================================== the toilets
  for (const [y0, y1] of [[0.37, 1.33], [1.46, 2.18]]) {
    const cy = (y0 + y1) / 2;
    furn(M.porcelain, 6.45, cy - 0.18, 6.95, cy + 0.18, 0, 0.42);
    B(M.porcelain, 6.75, cy - 0.2, 6.95, cy + 0.2, 0.42, 0.85);
    B(M.lamp, 5.8, cy - 0.15, 6.1, cy + 0.15, CH - 0.03, CH);
  }
  furn(M.porcelain, 5.18, 0.38, 5.67, 0.62, 0.78, 0.9);
  B(M.steel, 5.4, 0.42, 5.45, 0.47, 0.9, 1.05);
  B(M.mirror, 5.13, 0.375, 5.7, 0.385, 1.0, 1.8);

  // =================================================================== wardrobe
  B(M.steel, 0.69, 1.77, 2.2, 1.8, 1.9, 1.93);
  B(M.steel, 0.06, 0.8, 0.09, 1.47, 1.9, 1.93);
  for (let k = 0; k < 6; k++) B(M.coat[k % 5], 0.8 + k * 0.23, 1.55, 0.95 + k * 0.23, 1.82, 1.0, 1.85);
  for (let k = 0; k < 2; k++) B(M.coat[(k + 2) % 5], -0.04, 0.85 + k * 0.32, 0.22, 1.0 + k * 0.32, 1.05, 1.85);
  world.add({ x0: 0.75, x1: 2.25, z0: -1.84, z1: -1.55, bottom: FO + 1.0, top: FO + 1.9, walk: false, cam: false });
  B(M.lamp, 1.0, 0.9, 1.5, 1.2, CH - 0.03, CH);

  // =================================================================== kitchen
  // base units along the wardrobe wall and the meeting-corner wall, tall units with the oven and fridge
  furn(M.kitchen, 0.35, 2.1, 2.4, 2.7, 0, 0.84);
  furn(M.kitchen, 0.35, 2.7, 0.98, 3.33, 0, 0.84);
  B(M.worktop, 0.35, 2.1, 2.42, 2.72, 0.84, 0.88); B(M.worktop, 0.35, 2.72, 1.0, 3.35, 0.84, 0.88);
  furn(M.kitchen, 0.35, 3.33, 1.03, 4.6, 0, 2.76);
  B(M.black, 1.03, 3.4, 1.04, 3.93, 0.8, 1.45);                       // oven
  B(M.steel, 1.03, 3.45, 1.05, 3.9, 1.38, 1.4);
  B(M.black, 1.61, 2.1, 2.25, 2.65, 0.88, 0.9);                       // hob
  B(M.steel, 0.9, 2.17, 1.52, 2.66, 0.875, 0.885);                    // sink
  B(M.steel, 1.18, 2.15, 1.24, 2.22, 0.88, 1.15);
  B(M.kitchen, 0.35, 2.1, 0.98, 3.35, 2.06, 2.76);                    // upper cabinets
  B(M.kitchen, 0.98, 2.1, 2.42, 2.45, 2.06, 2.76);
  B(M.lamp, 0.99, 2.45, 2.4, 2.48, 2.03, 2.06);
  // the coffee machine (plumbed in, as the notes ask)
  B(M.black, 2.0, 2.15, 2.35, 2.5, 0.88, 1.35);
  B(M.steel, 2.12, 2.48, 2.24, 2.52, 1.05, 1.15);
  B(M.lamp, 1.8, 3.3, 2.3, 3.7, CH - 0.03, CH);

  // =================================================================== meeting corner: the pool table
  furn(M.kitchen, -2.24, 2.23, -0.94, 4.39, 0.62, 0.81);
  B(M.felt, -2.14, 2.33, -1.04, 4.29, 0.81, 0.815);
  for (const [lx, ly] of [[-2.2, 2.27], [-1.04, 2.27], [-2.2, 4.29], [-1.04, 4.29]]) B(M.kitchen, lx, ly, lx + 0.06, ly + 0.06, 0, 0.62);
  for (const [cx, cy, r] of [[-0.86, 3.23, -1], [-0.89, 2.56, -1], [-0.82, 3.93, -1], [-2.29, 2.67, 1], [-2.24, 3.33, 1], [-2.24, 4.01, 1], [-1.53, 4.55, 0], [-1.65, 2.04, 0]]) {
    const back = r === 0 ? (cy > 3 ? [-0.22, cy + 0.2, 0.22, cy + 0.24] : [-0.22, cy - 0.24, 0.22, cy - 0.2]) : (r > 0 ? [cx - 0.24 - cx, cy - 0.22, cx - 0.2 - cx, cy + 0.22] : [cx + 0.2 - cx, cy - 0.22, cx + 0.24 - cx, cy + 0.22]);
    B(M.chair, cx - 0.21, cy - 0.21, cx + 0.21, cy + 0.21, 0.44, 0.48);
    for (const [dx, dy] of [[-0.19, -0.19], [0.16, -0.19], [-0.19, 0.16], [0.16, 0.16]]) B(M.chair, cx + dx, cy + dy, cx + dx + 0.03, cy + dy + 0.03, 0, 0.44);
    B(M.chair, cx + back[0], back[1], cx + back[2], back[3], 0.48, 0.88);
  }
  for (const y of [1.97, 3.86]) {
    geo.geom(M.black, new THREE.TorusGeometry(0.38, 0.03, 6, 28), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(at(-1.59, y, 2.55)));
    B(M.lamp, -1.69, y - 0.1, -1.49, y + 0.1, 2.5, 2.53);
    B(M.steel, -1.6, y - 0.003, -1.58, y + 0.003, 2.55, CH);
  }
  // the two TVs on the TV wall
  const tv = (x0, x1, yFace, out) => {
    const y0 = out > 0 ? yFace : yFace - 0.06, y1 = out > 0 ? yFace + 0.06 : yFace;
    B(M.black, x0, y0, x1, y1, 0.85, 1.85);
    B(M.display, x0 + 0.03, out > 0 ? y1 : y0 - 0.002, x1 - 0.03, out > 0 ? y1 + 0.002 : y0, 0.88, 1.82);
  };
  tv(-1.15, 0.6, 5.55, -1);
  tv(-1.15, 0.6, 5.8, 1);

  // =================================================================== server room
  furn(M.black, -3.1, 9.18, -2.52, 9.97, 0, 1.77);
  for (let k = 0; k < 10; k++) B(k % 3 ? M.led : M.ledBlue, -2.9 + (k % 4) * 0.08, 9.175, -2.87 + (k % 4) * 0.08, 9.18, 0.3 + k * 0.14, 0.33 + k * 0.14);
  furn(M.black, -4.1, 8.95, -3.4, 9.88, 0, 0.91);
  B(M.screen, -4.09, 9.07, -3.49, 9.72, 0.91, 1.43);
  for (const h of [0.37, 0.74, 1.11, 1.49, 1.86]) furn(M.white, -4.12, 6.03, -3.76, 8.44, h, h + 0.03);
  for (let k = 0; k < 9; k++) B(M.coat[k % 5], -4.08, 6.15 + k * 0.25, -3.8, 6.32 + k * 0.25, 0.4 + (k % 5) * 0.373, 0.6 + (k % 5) * 0.373);
  B(M.lamp, -3.5, 7.8, -3.1, 8.2, CH - 0.03, CH);

  // =================================================================== lounge: the big grey sofa, the DJ booth
  furn(M.sofa, -1.79, 10.2, 1.82, 10.98, 0, 0.42); B(M.sofa, -1.79, 10.7, 1.82, 10.98, 0.42, 0.8);
  furn(M.sofa, -1.79, 7.65, -0.99, 10.2, 0, 0.42); B(M.sofa, -1.79, 7.65, -1.51, 10.2, 0.42, 0.8);
  furn(M.sofa, 1.02, 8.9, 1.82, 10.2, 0, 0.42);
  for (const [x, y, r] of [[-1.2, 10.55, 0.3], [-0.2, 10.55, -0.2], [0.9, 10.55, 0.2], [-1.4, 8.4, 0.1], [-1.4, 9.4, -0.2]]) geo.obox(M.pillow, x, FO + 0.6, -y, 0.42, 0.34, 0.14, 0, r, 0);
  furn(M.deskWood, -0.5, 8.3, 0.5, 9.3, 0.35, 0.4);                  // coffee table
  B(M.black, -0.45, 8.35, -0.4, 9.25, 0, 0.35); B(M.black, 0.4, 8.35, 0.45, 9.25, 0, 0.35);
  // DJ booth: a black table with two decks and a mixer, looking out over the lounge
  furn(M.black, 1.25, 6.44, 2.97, 7.03, 0, 0.93);
  B(M.screen, 1.46, 6.53, 1.8, 6.95, 0.93, 0.99); B(M.screen, 1.9, 6.53, 2.22, 6.95, 0.93, 0.99); B(M.screen, 2.3, 6.53, 2.64, 6.95, 0.93, 0.99);
  for (const x of [1.63, 2.47]) geo.geom(M.steel, new THREE.CylinderGeometry(0.12, 0.12, 0.01, 16), at(x, 6.74, 0.995));
  B(M.display, 1.72, 6.85, 1.97, 6.99, 0.99, 1.12);
  linear(-2.0, 2.0, 9.0);
  plant(0.75, 6.2, 0.9); plant(6.2, 6.1, 0.9);

  // =================================================================== the green-screen studio
  B(M.green, 4.4, 10.94, 6.55, 10.99, 0, 2.3);
  B(M.green, 6.55, 8.69, 6.59, 10.99, 0, 2.3);
  B(M.green, 4.4, 8.69, 6.59, 10.99, 0, 0.006);
  const softbox = (x, y, rot) => {
    for (const a of [0, 2.1, 4.2]) geo.obox(M.black, x + Math.cos(a) * 0.18, FO + 0.5, -(y + Math.sin(a) * 0.18), 0.02, 1.05, 0.02, 0, -a, 0.33);
    B(M.black, x - 0.015, y - 0.015, x + 0.015, y + 0.015, 0.5, 1.85);
    geo.obox(M.lamp, x, FO + 1.95, -y, 0.9, 0.62, 0.04, 0.0, rot, 0);
    geo.obox(M.black, x - Math.sin(rot) * 0.05, FO + 1.95, -y - Math.cos(rot) * 0.05, 0.96, 0.68, 0.06, 0.0, rot, 0);
    world.add({ x0: x - 0.25, x1: x + 0.25, z0: -y - 0.25, z1: -y + 0.25, bottom: FO, top: FO + 1.85, walk: false, cam: false });
  };
  softbox(3.79, 10.37, 1.25); softbox(5.93, 8.17, -2.88);      // both lit towards the green screen
  {
    // the camera on its tripod, pointed at the green screen
    const x = 5.31, y = 6.87;
    for (const a of [0.5, 2.6, 4.7]) geo.obox(M.black, x + Math.cos(a) * 0.15, FO + 0.45, -(y + Math.sin(a) * 0.15), 0.02, 0.95, 0.02, 0, -a, 0.3);
    B(M.black, x - 0.1, y - 0.07, x + 0.1, y + 0.12, 0.95, 1.1);
    geo.geom(M.black, new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(at(x, y + 0.17, 1.03)));
    world.add({ x0: x - 0.2, x1: x + 0.2, z0: -y - 0.2, z1: -y + 0.2, bottom: FO, top: FO + 1.1, walk: false, cam: false });
  }
  linear(4.6, 6.3, 7.9);

  // =================================================================== build
  const meshes = geo.build(group);
  const P = (x, y, h) => [x, FO + h, -y];             // plan -> local, for game.js
  return {
    world, doors, meshes, FO,
    // where the three interior lights hang while you are here (local)
    lights: [P(-0.2, -2.8, 2.5), P(-1.2, 3.2, 2.5), P(1.5, 8.6, 2.5)],
    // inside, by the stairwell door, looking into the office
    entry: P(7.35, -0.78, 0), entryHeading: -Math.PI / 2,
    exitDoor: P(7.75, -0.78, 0),
    centre: P(1.5, 2.5, 1.5),
    inside: (x, y, z) => x > -4.12 && x < 8.0 && z > -11.0 && z < 5.45 && y > FO - 0.5 && y < C + 0.2,
  };
}
