// Cappes vei 6, room by room after the walkthrough video.
//
// Built in a local frame: x runs along the street from the side passage (x=0,
// north-west) to the attached neighbour, no. 4 (x=8); z runs from the street
// facade (z=0, north-east, Cappes vei) back to the terrace (z=8.4, south-west).
// The house sits in the hillside, so you come in from Cappes vei on the upper
// floor and the stairs go down to the lower floor, which opens onto the terrace.
import * as THREE from '../vendor/three.module.min.js';
import { Geo, World } from './engine.js';
import { textTexture } from './textures.js';

export function buildHouse6(group, T, H) {
  const geo = new Geo();
  const world = new World(4);
  const W = H.W, D = H.D, FU = H.FU, FL = H.FL;
  const C1 = FU - 0.2;            // lower ceiling
  const C2 = FU + 2.55;           // upper ceiling
  const TOP = C2 + 0.15;          // eaves
  const t = 0.3;                  // outer walls
  // Interior doorways are 0.95-1 m wide with 2.2 m lintels: the player is 0.6 m across and
  // 1.8 m tall, and must be able to step onto a bed or a sofa next to a door without hitting
  // the lintel. Furniture keeps the path from each door into its room clear.
  const DH = 2.2;
  const ix0 = t, ix1 = W - t, iz0 = t, iz1 = D - t;

  const std = (o, tex) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o }); if (tex) m.map = tex; return m; };
  const M = {
    out: std({ color: 0x96b373, roughness: 0.8 }, T.siding),     // Cappes vei 6 is green
    paint: std({ color: 0xecebe6, roughness: 0.95, emissive: 0x2a2926 }),
    trim: std({ color: 0xf3f2ee, roughness: 0.6 }),
    stone: std({ color: 0xd0d0d0, roughness: 0.95 }, T.stone),
    floor: std({ color: 0xffffff, roughness: 0.6 }, T.floor),
    pine: std({ color: 0xffffff, roughness: 0.7 }, T.pine),
    tileW: std({ color: 0xffffff, roughness: 0.3 }, T.tileWhite),
    tileD: std({ color: 0xffffff, roughness: 0.35 }, T.tileDark),
    checker: std({ color: 0xffffff, roughness: 0.5 }, T.checker),
    slab: std({ color: 0xffffff, roughness: 0.7 }, T.slab),
    roof: std({ color: 0x34373b, roughness: 0.55 }, T.roof),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd6e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }),
    lightwell: std({ color: 0xdfe8d8, emissive: 0xb9cfa8, emissiveIntensity: 0.55, roughness: 0.3 }),
    white: std({ color: 0xf0efeb, roughness: 0.9 }),
    navy: std({ color: 0x1d2333, roughness: 1 }),
    lightWood: std({ color: 0xd8b98e, roughness: 0.6 }),
    black: std({ color: 0x18191b, roughness: 0.6 }),
    cabinet: std({ color: 0xc9ccce, roughness: 0.5 }),
    steel: std({ color: 0xaab0b5, roughness: 0.25, metalness: 0.8 }),
    metal: std({ color: 0x2a2c2e, roughness: 0.4, metalness: 0.7 }),
    rug: std({ color: 0xc4b9a6, roughness: 1 }),
    rugGrey: std({ color: 0xa9aaa6, roughness: 1 }),
    mat: std({ color: 0x2f3134, roughness: 1 }),
    bed: std({ color: 0xf2f1ec, roughness: 1 }),
    spread: std({ color: 0x8ea5aa, roughness: 1 }),
    cushion: std({ color: 0x3c5d8a, roughness: 1 }),
    pink: std({ color: 0xd9b2b0, roughness: 1 }),
    red: std({ color: 0xc0201a, roughness: 0.4 }),
    plant: std({ color: 0x3f7a3a, roughness: 0.9 }),
    pot: std({ color: 0x3f6fb5, roughness: 0.6 }),
    lamp: std({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 2.2 }),
    fence: std({ color: 0x8a7a63, roughness: 0.9 }),
    door: std({ color: 0x1d2024, roughness: 0.5 }),
    gold: std({ color: 0xc9a23a, roughness: 0.3, metalness: 0.8 }),
    mail: std({ color: 0x1a1d22, roughness: 0.4, metalness: 0.4 }),
    bins: std({ color: 0x7d8288, roughness: 0.7 }),
    binLid: std({ color: 0x3c8f4a, roughness: 0.6 }),
    green: std({ color: 0x4f6b35, roughness: 1 }, T.grass),
  };
  M.glass.userData.noCast = true;
  M.lamp.userData.noCast = true;

  const deco = (m, x0, y0, z0, x1, y1, z1, skip) => geo.box(m, x0, y0, z0, x1, y1, z1, skip || '');
  const solid = (m, x0, y0, z0, x1, y1, z1, o = {}) => {
    if (m) geo.box(m, x0, y0, z0, x1, y1, z1, o.skip || '');
    return world.add({ x0, x1, z0, z1, bottom: Math.min(y0, y1), top: Math.max(y0, y1), walk: o.walk !== false, cam: o.cam !== false, solid: o.solid !== false, stairs: o.stairs, tag: o.tag });
  };
  const furn = (m, x0, y0, z0, x1, y1, z1) => solid(m, x0, y0, z0, x1, y1, z1, { cam: false });

  // ---- walls with openings (same approach as before: split into strips)
  function wallRun(axis, c0, c1, a0, a1, y0, y1, openings, mat) {
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
        if (axis === 'x') deco(mat, s, ya, c0, e, yb, c1); else deco(mat, c0, ya, s, c1, yb, e);
      }
    }
  }
  function wallCollide(axis, c0, c1, a0, a1, y0, y1, openings) {
    const ds = openings.filter(o => o.door).sort((p, q) => p.a0 - q.a0);
    let s = a0;
    const add = (p, q, ya, yb) => {
      if (q - p < 1e-4) return;
      if (axis === 'x') world.add({ x0: p, x1: q, z0: c0, z1: c1, bottom: ya, top: yb, walk: false });
      else world.add({ x0: c0, x1: c1, z0: p, z1: q, bottom: ya, top: yb, walk: false });
    };
    for (const d of ds) { add(s, d.a0, y0, y1); add(d.a0, d.a1, d.y1, y1); s = d.a1; }
    add(s, a1, y0, y1);
  }
  function wall(axis, c0, c1, a0, a1, y0, y1, openings, matA, matB) {
    const mid = (c0 + c1) / 2;
    if (matB) { wallRun(axis, c0, mid, a0, a1, y0, y1, openings, matA); wallRun(axis, mid, c1, a0, a1, y0, y1, openings, matB); }
    else wallRun(axis, c0, c1, a0, a1, y0, y1, openings, matA);
    wallCollide(axis, c0, c1, a0, a1, y0, y1, openings);
    for (const o of openings) {
      if (o.door) continue;
      const f = 0.07;
      const A = (p, q) => axis === 'x' ? [p, q] : [q, p];
      for (const [cc0, cc1] of [[c0 - 0.03, c0 + 0.02], [c1 - 0.02, c1 + 0.03]]) {
        const bx = (a, b, ya, yb) => { const [x0, z0] = A(a, cc0), [x1, z1] = A(b, cc1); deco(M.trim, x0, ya, z0, x1, yb, z1); };
        bx(o.a0 - f, o.a1 + f, o.y0 - f, o.y0); bx(o.a0 - f, o.a1 + f, o.y1, o.y1 + f);
        bx(o.a0 - f, o.a0, o.y0, o.y1); bx(o.a1, o.a1 + f, o.y0, o.y1);
      }
      const am = (o.a0 + o.a1) / 2;
      { const [x0, z0] = A(am - 0.03, mid - 0.04), [x1, z1] = A(am + 0.03, mid + 0.04); deco(M.trim, x0, o.y0, z0, x1, o.y1, z1); }
      { const yh = o.y0 + (o.y1 - o.y0) * 0.68; const [x0, z0] = A(o.a0, mid - 0.04), [x1, z1] = A(o.a1, mid + 0.04); deco(M.trim, x0, yh - 0.03, z0, x1, yh + 0.03, z1); }
      { const [x0, z0] = A(o.a0, mid - 0.005), [x1, z1] = A(o.a1, mid + 0.005); deco(M.glass, x0, o.y0, z0, x1, o.y1, z1); }
      { const [x0, z0] = A(o.a0 - 0.05, c0 - 0.12), [x1, z1] = A(o.a1 + 0.05, c1 + 0.12); deco(M.trim, x0, o.y0 - 0.04, z0, x1, o.y0, z1); }
    }
  }
  const doors = [];
  // A door leaf hinged at (x, z), running along the axis for w metres when closed. A negative w
  // puts the hinge at the other end, so an open door can stand against the nearer wall.
  function door(x, y, z, w, h, axis, mat, auto, openAngle, staticOpen = false, glass = false) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(w), h, 0.05), mat);
    leaf.castShadow = true; leaf.receiveShadow = true;
    leaf.position.set(w / 2, h / 2, 0);
    if (glass) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(w) - 0.24, h - 0.5, 0.06), M.glass);
      pane.position.set(0, 0.1, 0);
      leaf.add(pane);
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.12), M.steel);
    handle.position.set(w / 2 - Math.sign(w) * 0.12, 1.0 - h / 2, 0);
    leaf.add(handle);
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.rotation.y = axis === 'x' ? 0 : -Math.PI / 2;
    pivot.add(leaf);
    group.add(pivot);
    const d = { pivot, open: staticOpen ? 1 : 0, target: staticOpen ? 1 : 0, auto, angle: -openAngle,
      local: new THREE.Vector3(x + (axis === 'x' ? w / 2 : 0), y, z + (axis === 'z' ? w / 2 : 0)) };
    d.base = pivot.rotation.y;
    pivot.rotation.y = d.base + d.angle * d.open;
    doors.push(d);
    return d;
  }

  // =================================================================== shell
  // foundation and lower floor
  solid(M.stone, 0, FL - 3, 0, W, FL - 0.06, D);
  deco(M.floor, ix0, FL - 0.06, iz0, ix1, FL, iz1, 'ny');
  world.add({ x0: ix0, x1: ix1, z0: iz0, z1: iz1, bottom: FL - 0.06, top: FL, solid: false });
  // grey and white block pattern in the hall at the foot of the stairs, dark tiles in the two bathrooms
  deco(M.checker, 1.35, FL, 2.6, 3.9, FL + 0.004, 5.6);
  deco(M.checker, ix0, FL, 4.6, 1.35, FL + 0.004, 5.6);
  deco(M.checker, 3.9, FL, 2.6, 5.0, FL + 0.004, 4.4);
  deco(M.tileD, 1.35, FL, iz0, 5.0, FL + 0.004, 2.5);

  // outer walls: grey cladding outside, white inside
  const UW = (a0, a1) => ({ a0, a1, y0: FU + 0.95, y1: FU + 2.25 });
  const LW = (a0, a1) => ({ a0, a1, y0: FL + 1.0, y1: FL + 2.25 });
  // street side (NE), z 0..0.3
  wall('x', 0, t, 0, W, FL - 3, TOP, [
    { a0: 1.45, a1: 2.45, y0: FU, y1: FU + 2.15, door: true },
    UW(3.2, 4.3), UW(5.9, 7.0),
  ], M.out, M.paint);
  // terrace side (SW), z 8.1..8.4
  wall('x', D - t, D, 0, W, FL - 3, TOP, [
    UW(0.8, 1.9), UW(3.0, 4.0), UW(5.0, 5.9), UW(6.5, 7.4),
    { a0: 2.9, a1: 3.8, y0: FL, y1: FL + 2.15, door: true },
    LW(5.95, 6.85),                                  // the white bedroom's window, at garden level
  ], M.paint, M.out);
  // passage side (NW), x 0..0.3, and the side against no. 4 (SE), x 7.7..8
  wall('z', 0, t, t, D - t, FL - 3, TOP, [], M.out, M.paint);
  wall('z', W - t, W, t, D - t, FL - 3, TOP, [], M.paint, M.out);
  for (const [cx, cz] of [[0, 0], [W, 0], [0, D], [W, D]]) deco(M.trim, cx - 0.08, FL - 0.4, cz - 0.08, cx + 0.08, TOP, cz + 0.08);
  // stone plinth showing on the terrace side
  deco(M.stone, -0.04, FL - 3, D - 0.04, W + 0.04, FL + 0.05, D + 0.06);

  // the lightwell window of the bedroom with the blue cushions (the street side is buried here)
  for (const [a0, a1] of [[6.1, 7.3]]) {
    deco(M.trim, a0 - 0.07, FL + 1.43, iz0 - 0.01, a1 + 0.07, FL + 2.32, iz0 + 0.03);
    deco(M.lightwell, a0, FL + 1.5, iz0 + 0.03, a1, FL + 2.25, iz0 + 0.04);
    deco(M.trim, a0 - 0.1, FL + 1.43, iz0, a1 + 0.1, FL + 1.47, iz0 + 0.16);
  }

  // =================================================================== upper floor slab (stair hole x 0.3..1.25, z 1.3..4.6)
  const slab = (ax0, ax1, az0, az1, mat) => {
    deco(M.paint, ax0, C1, az0, ax1, FU - 0.04, az1);
    deco(mat, ax0, FU - 0.04, az0, ax1, FU, az1, 'ny');
    world.add({ x0: ax0, x1: ax1, z0: az0, z1: az1, bottom: C1, top: FU });
  };
  slab(ix0, 1.25, iz0, 1.3, M.floor);
  slab(ix0, 1.25, 4.6, iz1, M.floor);
  slab(1.25, ix1, iz0, iz1, M.floor);
  deco(M.mat, 1.5, FU, 0.35, 2.4, FU + 0.012, 1.2);           // door mat
  deco(M.rug, 1.55, FU, 2.6, 2.45, FU + 0.012, 4.3);          // corridor rug
  // upper ceiling
  deco(M.paint, ix0, C2, iz0, ix1, TOP, iz1);
  world.add({ x0: ix0, x1: ix1, z0: iz0, z1: iz1, bottom: C2, top: TOP, walk: false });

  // =================================================================== stairs: steep, white, dark treads
  {
    const n = 14, z0 = 1.3, z1 = 4.6, run = (z1 - z0) / n, rise = (FU - FL) / n;
    for (let i = 0; i < n; i++) {
      const sz = z0 + i * run, top = FU - (i + 1) * rise;
      deco(M.white, ix0, FL, sz, 1.25, top - 0.03, sz + run);
      deco(M.black, ix0, top - 0.03, sz - 0.02, 1.25, top, sz + run);
    }
    world.add({ x0: ix0, x1: 1.25, z0, z1, bottom: FL, h00: FU + 0.02, h10: FU + 0.02, h01: FL + rise * 0.5, h11: FL + rise * 0.5, solid: false, stairs: true });
    // banister on the corridor side (upper floor) and the stair's side wall (lower floor)
    solid(M.white, 1.25, FL, z0, 1.35, FU + 0.95, z1, { walk: false });
    deco(M.lightWood, 1.22, FU + 0.95, z0, 1.38, FU + 1.0, z1);
    // peg rack on the stair wall, as in the video
    deco(M.lightWood, 0.3, FU + 1.5, 2.0, 0.34, FU + 1.6, 3.6);
    for (let k = 0; k < 6; k++) geo.obox(M.lightWood, 0.38, FU + 1.6, 2.15 + k * 0.28, 0.16, 0.03, 0.03, 0, 0, -0.4);
  }

  // =================================================================== upper floor partitions
  const P = (axis, c0, c1, a0, a1, ops = [], mA = M.paint, mB) => wall(axis, c0, c1, a0, a1, FU, C2, ops, mA, mB);
  const dU = (a0, a1) => ({ a0, a1, y0: FU, y1: FU + DH, door: true });
  P('z', 2.55, 2.65, iz0, 3.2, [dU(1.75, 2.75)]);                // corridor | study
  P('x', 3.1, 3.2, 2.65, 4.9, []);                                // study back wall
  P('z', 4.9, 5.0, iz0, 4.5, []);                                 // study | bedroom
  P('x', 4.4, 4.5, 5.0, ix1, [dU(5.15, 6.15)], M.paint, M.paint);  // bedroom | living
  // pine: the living room's and the bedroom's wall against no. 4
  deco(M.pine, ix1 - 0.02, FU, iz0, ix1, C2, iz1);
  // fire extinguishers where the corridor meets the kitchen
  for (const ez of [4.45, 4.62]) geo.geom(M.red, new THREE.CylinderGeometry(0.08, 0.08, 0.5, 10), new THREE.Matrix4().makeTranslation(2.45, FU + 0.25, ez));

  // =================================================================== lower floor partitions
  // After the walkthrough video and Håvard's sketch. The stairs come down along the passage wall
  // into the hall. On the street side: the toilet and the shower room side by side, and at the far
  // end the bedroom with the lightwell (blue cushions). On the terrace side: the bedroom with the
  // black pillow, which has the glass door out to the terrace, and the bedroom with the white bed.
  //
  //   street side (z = 0, buried)
  //   +---------+--------+--------------+---------------+
  //   | closet  | toilet | shower room  | bedroom with  |
  //   +---------+---D----+-----D--------+ the lightwell |
  //   | stairs  | hall           vestibule D (blue)     |
  //   |   down  |                     +------D----------+
  //   +---------+--D---------------+  | bedroom with    |
  //   | bedroom with the black pillow | the white bed   |
  //   +----------[glass door]---------+-----------------+
  //   terrace side (z = 8.4)      x = 0 is the side passage, x = 8 is no. 4
  const Q = (axis, c0, c1, a0, a1, ops = [], mA = M.paint, mB) => wall(axis, c0, c1, a0, a1, FL, C1, ops, mA, mB);
  const dL = (a0, a1) => ({ a0, a1, y0: FL, y1: FL + DH, door: true });
  Q('z', 1.25, 1.35, iz0, 1.3, [], M.paint, M.tileW);                            // closet under the top of the stairs | toilet
  Q('x', 2.5, 2.6, 1.35, 5.0, [dL(1.9, 2.8), dL(3.9, 4.8)], M.tileW, M.paint);  // toilet, shower room | hall
  Q('z', 3.0, 3.1, iz0, 2.5, [], M.tileW, M.tileW);                              // toilet | shower room
  Q('z', 5.0, 5.1, iz0, 4.4, [dL(3.35, 4.3)]);                                   // shower room, hall | blue bedroom
  Q('x', 4.4, 4.5, 3.9, ix1, [dL(4.05, 4.95)]);                                  // hall, blue bedroom | white bedroom
  Q('z', 3.9, 4.0, 4.5, iz1, []);                                                // hall, black-pillow bedroom | white bedroom
  Q('x', 5.6, 5.7, ix0, 3.9, [dL(1.8, 2.75)]);                                   // hall | black-pillow bedroom
  // tiles on the outer wall and the stair wall in the two bathrooms
  deco(M.tileW, 1.35, FL, iz0, 5.0, C1, iz0 + 0.02);
  deco(M.tileW, 1.35, FL, 1.3, 1.37, C1, 2.5);

  // =================================================================== doors
  door(1.45, FU, 0.15, 1.0, 2.15, 'x', M.door, true, 1.5);                  // front door, opens in
  door(2.9, FL, D - 0.15, 0.9, 2.15, 'x', M.trim, true, 1.5, false, true);  // glass door to the terrace
  const innerDoor = M.trim;
  // inner doors stand open into their rooms, against the hinge side, out of the corridors
  door(2.6, FU, 1.75, 1.0, 2.15, 'z', innerDoor, false, -1.52, true);   // upper study
  door(5.15, FU, 4.45, 1.0, 2.15, 'x', innerDoor, false, -1.52, true);  // upper bedroom
  door(2.8, FL, 2.55, -0.9, 2.15, 'x', innerDoor, false, 1.52, true);   // toilet
  door(4.8, FL, 2.55, -0.9, 2.15, 'x', innerDoor, false, 1.52, true);   // shower room
  door(5.05, FL, 4.3, -0.95, 2.15, 'z', innerDoor, false, 1.52, true);  // blue bedroom
  door(4.05, FL, 4.45, 0.9, 2.15, 'x', innerDoor, false, 1.52, true);   // white bedroom
  door(1.8, FL, 5.65, 0.95, 2.15, 'x', innerDoor, false, 1.52, true);   // black-pillow bedroom
  // thresholds: floor across the thickness of the outer walls under the two outside doors
  deco(M.stone, 1.45, FU - 0.3, 0, 2.45, FU, t);
  world.add({ x0: 1.45, x1: 2.45, z0: -0.05, z1: t + 0.05, bottom: FU - 0.3, top: FU, solid: false });
  deco(M.stone, 2.9, FL - 0.3, D - t, 3.8, FL, D);
  world.add({ x0: 2.9, x1: 3.8, z0: D - t - 0.05, z1: D + 0.05, bottom: FL - 0.3, top: FL, solid: false });

  // =================================================================== roof: ridge along the street
  {
    const over = 0.4, half = D / 2, pitch = 0.6, rise = half * Math.tan(pitch), ridge = TOP + rise;
    const slope = Math.hypot(half + over, (half + over) * Math.tan(pitch));
    const yc = TOP + rise - (half + over) * Math.tan(pitch) / 2 + 0.08;
    geo.obox(M.roof, W / 2, yc, half - (half + over) / 2, W + over * 2, 0.16, slope, -pitch, 0, 0);
    geo.obox(M.roof, W / 2, yc, half + (half + over) / 2, W + over * 2, 0.16, slope, pitch, 0, 0);
    for (const x of [0, W]) geo.tri(M.out, [x, TOP, 0], [x, TOP, D], [x, ridge, half], [[0, TOP], [D, TOP], [half, ridge]], [x === 0 ? -1 : 1, 0, 0]);
    deco(M.stone, 5.6, TOP, 3.0, 6.3, ridge + 1.0, 3.7);
    deco(M.metal, 5.52, ridge + 1.0, 2.92, 6.38, ridge + 1.1, 3.78);
    // gutters
    deco(M.metal, -0.4, TOP - 0.05, -0.45, W + 0.4, TOP + 0.08, -0.3);
    deco(M.metal, -0.4, TOP - 0.05, D + 0.3, W + 0.4, TOP + 0.08, D + 0.45);
    world.add({ x0: 0, x1: W, z0: 0, z1: D, bottom: TOP, top: ridge, walk: false });
  }

  // =================================================================== outside: stoop, door details, the side passage
  solid(M.stone, 1.3, FU - 1.2, -0.75, 2.6, FU - 0.27, -0.35);
  solid(M.stone, 1.3, FU - 1.2, -0.35, 2.6, FU, 0);
  const numTex = textTexture(['6'], { w: 128, h: 128, bg: '#1b1e22', fg: '#f3f2ee', font: '700 92px "Archivo", sans-serif', radius: 14 });
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: numTex, roughness: 0.5 }));
  num.position.set(2.75, FU + 2.35, -0.02); num.rotation.y = Math.PI; group.add(num);
  const plate = textTexture(['CAPPES VEI'], { w: 512, h: 96, bg: '#1d3f6e', fg: '#ffffff', font: '700 58px "Archivo", sans-serif', radius: 8, border: '#ffffff' });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.24), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.5 }));
  pl.position.set(5.0, FU + 2.6, -0.02); pl.rotation.y = Math.PI; group.add(pl);
  deco(M.mail, 0.9, FU + 1.0, -0.22, 1.3, FU + 1.4, 0);          // black mailbox
  deco(M.gold, 2.5, FU + 1.15, -0.06, 2.6, FU + 1.35, 0);        // key safe
  deco(M.lamp, 2.62, FU + 2.2, -0.2, 2.78, FU + 2.36, -0.05);

  // the narrow passage down the side of the house, x -1.25..0, from the street to the terrace
  const PW = -1.25, streetY = FU - 0.25;
  solid(M.stone, PW, FL - 3, -0.3, 0, streetY, 1.8, { tag: 'passage' });
  {
    const n = 12, z0 = 1.8, z1 = D, run = (z1 - z0) / n, rise = (streetY - FL) / n;
    for (let i = 0; i < n; i++) {
      const sz = z0 + i * run, top = streetY - (i + 1) * rise;
      deco(M.stone, PW, FL - 3, sz, 0, top, sz + run, 'ny');
    }
    world.add({ x0: PW, x1: 0, z0, z1, bottom: FL - 3, h00: streetY + 0.02, h10: streetY + 0.02, h01: FL + rise * 0.5, h11: FL + rise * 0.5, stairs: true, tag: 'passage' });
    // hand rail on the house wall
    const len = Math.hypot(z1 - z0, streetY - FL), ang = Math.atan2(streetY - FL, z1 - z0);
    geo.obox(M.metal, -0.08, (streetY + FL) / 2 + 0.95, (z0 + z1) / 2, 0.05, 0.05, len, ang, 0, 0);
    for (let k = 0; k <= 4; k++) { const z = z0 + (z1 - z0) * k / 4, y = streetY - (streetY - FL) * k / 4; deco(M.metal, -0.1, y, z - 0.02, -0.06, y + 0.95, z + 0.02); }
  }
  // bins at the street end, plants and a drainpipe down the passage
  // wheelie bins against the facade, on the street (they stand on the cobbles)
  for (const bx of [5.2, 5.9]) {
    const by = FU - 0.85;
    solid(M.bins, bx, by - 1, -0.72, bx + 0.6, by + 1.05, -0.08, {});
    deco(M.binLid, bx - 0.03, by + 1.05, -0.75, bx + 0.63, by + 1.12, -0.05);
  }
  for (const [pz, s] of [[1.3, 0.45], [3.5, 0.5], [6.0, 0.55]]) {
    const y = world.floorAt(-0.95, pz, 40) + 0.0;
    deco(M.pot, -1.2, y, pz - s * 0.4, -1.2 + s * 0.6, y + s * 0.55, pz + s * 0.4);
    geo.geom(M.plant, new THREE.IcosahedronGeometry(s * 0.55, 0), new THREE.Matrix4().makeTranslation(-0.95, y + s * 1.0, pz));
  }
  deco(M.metal, -0.08, FL, 7.9, 0, TOP, 8.0);

  // =================================================================== the terrace: raised over the gardens below, fenced
  const TZ0 = D, TZ1 = D + 3.9;
  solid(M.slab, PW, FL - 6, TZ0, W, FL, TZ1, { tag: 'terrace', skip: '' });
  {
    // the retaining wall shows stone below the slabs
    deco(M.stone, PW - 0.02, FL - 6, TZ1 - 0.02, W + 0.02, FL - 0.05, TZ1 + 0.02);
    deco(M.stone, W - 0.02, FL - 6, TZ0, W + 0.02, FL - 0.05, TZ1);
    deco(M.stone, PW - 0.02, FL - 6, TZ0, PW + 0.02, FL - 0.05, TZ1);
    const fence = (ax0, az0, ax1, az1) => {
      if (ax0 === ax1) { for (let z = az0; z < az1; z += 0.15) deco(M.fence, ax0 - 0.05, FL, z, ax0 + 0.05, FL + 1.25, z + 0.11); }
      else { for (let x = ax0; x < ax1; x += 0.15) deco(M.fence, x, FL, az0 - 0.05, x + 0.11, FL + 1.25, az0 + 0.05); }
      world.add({ x0: Math.min(ax0, ax1) - 0.05, x1: Math.max(ax0, ax1) + 0.05, z0: Math.min(az0, az1) - 0.05, z1: Math.max(az0, az1) + 0.05, bottom: FL, top: FL + 1.25, walk: false });
    };
    fence(PW, TZ1 - 0.05, W, TZ1 - 0.05);
    fence(W - 0.05, TZ0, W - 0.05, TZ1);
    fence(PW + 0.05, TZ0 + 1.2, PW + 0.05, TZ1);
    // a wooden hatch among the slabs, weeds, a small table
    deco(M.fence, 2.0, FL, 10.0, 3.1, FL + 0.03, 11.1);
    for (let k = 0; k < 40; k++) {
      const x = PW + 0.3 + ((k * 37) % 89) / 89 * (W - PW - 0.6), z = TZ0 + 0.3 + ((k * 53) % 97) / 97 * 3.3;
      geo.obox(M.plant, x, FL + 0.05, z, 0.05, 0.12 + (k % 3) * 0.05, 0.12, 0, k, 0.3);
    }
    deco(M.lightWood, 5.6, FL + 0.7, 10.0, 6.4, FL + 0.74, 10.8);
    deco(M.metal, 5.97, FL, 10.37, 6.03, FL + 0.7, 10.43);
  }

  // =================================================================== furniture: upper floor
  const u = FU, l = FL;
  // study: desk under the street window, black chair, white bench
  furn(M.lightWood, 3.1, u + 0.72, iz0 + 0.02, 4.4, u + 0.76, 0.9);
  for (const lx of [3.13, 4.33]) for (const lz of [0.35, 0.83]) deco(M.lightWood, lx, u, lz, lx + 0.04, u + 0.72, lz + 0.04);
  const chair = (cx, cz, m, face) => {
    deco(m, cx - 0.21, u0(cz) + 0.44, cz - 0.2, cx + 0.21, u0(cz) + 0.48, cz + 0.2);
    deco(m, cx - 0.21, u0(cz) + 0.48, cz + face * 0.17, cx + 0.21, u0(cz) + 0.92, cz + face * 0.2);
    for (const [dx, dz] of [[-0.19, -0.18], [0.17, -0.18], [-0.19, 0.16], [0.17, 0.16]]) deco(m, cx + dx, u0(cz), cz + dz, cx + dx + 0.03, u0(cz) + 0.44, cz + dz + 0.03);
  };
  let chairY = u;
  const u0 = () => chairY;
  chair(3.75, 1.3, M.black, 1);
  furn(M.white, 4.45, u, 1.4, 4.88, u + 0.45, 2.9);
  deco(M.lamp, 3.6, C2 - 0.05, 1.5, 4.0, C2, 1.9);
  // bedroom: bed against the pine wall, desk under the window, black chair, flowers
  furn(M.bed, 6.75, u, 2.3, ix1 - 0.02, u + 0.5, 4.38);
  geo.obox(M.bed, 7.2, u + 0.6, 4.05, 0.7, 0.16, 0.35, 0, 0, 0);
  furn(M.lightWood, 5.6, u + 0.72, iz0 + 0.02, 6.7, u + 0.76, 0.85);
  for (const lx of [5.63, 6.63]) for (const lz of [0.35, 0.78]) deco(M.lightWood, lx, u, lz, lx + 0.04, u + 0.72, lz + 0.04);
  chair(6.15, 1.25, M.black, 1);
  deco(M.lamp, 6.2, C2 - 0.05, 2.2, 6.6, C2, 2.6);
  // kitchen: fridge, grey cabinets along the passage wall, worktop, stove, sink, upper cabinets
  furn(M.white, ix0, u, 4.7, 0.95, u + 2.0, 5.35);
  furn(M.cabinet, ix0, u, 5.35, 0.92, u + 0.86, iz1);
  deco(M.lightWood, ix0, u + 0.86, 5.35, 0.96, u + 0.9, iz1);
  deco(M.black, 0.38, u + 0.9, 5.6, 0.85, u + 0.91, 6.15);
  deco(M.steel, 0.4, u + 0.9, 6.9, 0.8, u + 0.92, 7.4);
  deco(M.steel, 0.32, u + 0.92, 7.12, 0.37, u + 1.2, 7.18);
  for (let z = 5.4; z < 8.0; z += 0.6) deco(M.metal, 0.92, u + 0.72, z + 0.25, 0.94, u + 0.74, z + 0.35);
  deco(M.cabinet, ix0, u + 1.6, 5.35, 0.65, u + 2.35, 7.6);
  deco(M.lamp, 0.62, u + 1.56, 5.4, 0.66, u + 1.6, 7.5);
  deco(M.lamp, 1.2, C2 - 0.05, 6.2, 1.6, C2, 6.6);
  // dining table by the window, white chairs
  furn(M.lightWood, 3.0, u + 0.72, 5.9, 4.0, u + 0.76, 7.7);
  for (const [lx, lz] of [[3.03, 5.93], [3.93, 5.93], [3.03, 7.63], [3.93, 7.63]]) deco(M.lightWood, lx, u, lz, lx + 0.04, u + 0.72, lz + 0.04);
  for (const [cx, cz] of [[2.75, 6.4], [2.75, 7.2]]) {
    deco(M.white, cx - 0.2, u + 0.44, cz - 0.2, cx + 0.2, u + 0.48, cz + 0.2);
    deco(M.white, cx - 0.22, u + 0.48, cz - 0.2, cx - 0.18, u + 0.92, cz + 0.2);
  }
  for (const [cx, cz] of [[4.25, 6.4], [4.25, 7.2]]) {
    deco(M.white, cx - 0.2, u + 0.44, cz - 0.2, cx + 0.2, u + 0.48, cz + 0.2);
    deco(M.white, cx + 0.18, u + 0.48, cz - 0.2, cx + 0.22, u + 0.92, cz + 0.2);
  }
  // living room: rug, two navy sofas, coffee table, white open shelf, track lights, hoops on the pine wall
  deco(M.rugGrey, 4.8, u, 5.4, 7.3, u + 0.012, 7.6);
  furn(M.navy, 6.85, u + 0.1, 5.0, ix1 - 0.05, u + 0.45, 7.5);
  deco(M.navy, ix1 - 0.27, u + 0.45, 5.0, ix1 - 0.05, u + 0.85, 7.5);
  deco(M.navy, 6.85, u + 0.45, 5.0, ix1 - 0.05, u + 0.65, 5.18);
  deco(M.navy, 6.85, u + 0.45, 7.32, ix1 - 0.05, u + 0.65, 7.5);
  geo.obox(M.pink, 7.2, u + 0.62, 5.6, 0.14, 0.34, 0.42, 0, 0, -0.25);
  geo.obox(M.cushion, 7.2, u + 0.62, 6.9, 0.14, 0.34, 0.42, 0, 0, -0.25);
  // the second sofa makes an L with the first, under the terrace windows (the bedroom door stays clear)
  furn(M.navy, 4.95, u + 0.1, 7.45, 6.8, u + 0.45, iz1 - 0.05);
  deco(M.navy, 4.95, u + 0.45, iz1 - 0.27, 6.8, u + 0.85, iz1 - 0.05);
  geo.obox(M.cushion, 5.4, u + 0.62, 7.85, 0.42, 0.34, 0.14, 0.25, 0, 0);
  furn(M.lightWood, 5.3, u + 0.38, 5.9, 6.3, u + 0.43, 6.8);
  for (const [lx, lz] of [[5.33, 5.93], [6.23, 5.93], [5.33, 6.73], [6.23, 6.73]]) deco(M.lightWood, lx, u, lz, lx + 0.05, u + 0.38, lz + 0.05);
  for (let k = 0; k < 5; k++) deco(M.white, 2.75, u + 0.05 + k * 0.42, 3.3, 3.15, u + 0.08 + k * 0.42, 4.35);
  for (const sz of [3.3, 4.32]) for (const sx of [2.75, 3.12]) deco(M.white, sx, u, sz, sx + 0.03, u + 1.8, sz + 0.03);
  world.add({ x0: 2.75, x1: 3.15, z0: 3.3, z1: 4.35, bottom: u, top: u + 1.8, cam: false });
  deco(M.pink, 2.8, u + 0.5, 3.6, 3.1, u + 0.72, 3.95);
  deco(M.black, 4.9, C2 - 0.04, 6.2, 7.2, C2, 6.26);
  for (const tx of [5.2, 6.0, 6.8]) deco(M.lamp, tx - 0.05, C2 - 0.2, 6.18, tx + 0.05, C2 - 0.04, 6.28);
  for (let k = 0; k < 3; k++) geo.geom(M.lightWood, new THREE.TorusGeometry(0.16, 0.012, 4, 16), new THREE.Matrix4().makeRotationY(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(ix1 - 0.03, u + 1.4 + k * 0.38, 6.25)));
  deco(M.lamp, 2.0, C2 - 0.05, 1.3, 2.4, C2, 1.7);
  deco(M.lamp, 2.0, C2 - 0.05, 3.6, 2.4, C2, 4.0);

  // =================================================================== furniture: lower floor
  chairY = l;
  // toilet: a small sink with a mirror, and the toilet beside it
  furn(M.white, 1.45, l + 0.75, iz0, 1.95, l + 0.9, 0.75);
  deco(M.steel, 1.67, l + 0.9, 0.36, 1.73, l + 1.05, 0.42);
  deco(M.steel, 1.47, l + 1.1, iz0 + 0.02, 1.93, l + 1.75, iz0 + 0.04);
  furn(M.white, 2.35, l, iz0, 2.85, l + 0.42, 0.95);
  deco(M.white, 2.38, l + 0.42, iz0, 2.82, l + 0.85, 0.5);
  deco(M.lamp, 2.0, C1 - 0.05, 1.2, 2.4, C1, 1.6);
  // shower room: shower with a curtain in the corner, wall-hung toilet, sink, shelves with plants
  deco(M.white, 3.1, l + 2.0, 1.29, 4.05, l + 2.02, 1.31);
  geo.obox(M.white, 3.6, l + 1.02, 1.3, 0.9, 1.95, 0.03, 0, 0.06, 0);
  deco(M.steel, 3.45, l + 1.85, iz0 + 0.02, 3.55, l + 1.95, 0.42);
  furn(M.white, 4.4, l + 0.35, iz0, 4.95, l + 0.45, 0.85);
  deco(M.white, 4.45, l + 0.45, iz0, 4.9, l + 0.95, 0.42);
  furn(M.white, 3.12, l + 0.72, 1.55, 3.6, l + 0.88, 2.15);
  deco(M.steel, 3.12, l + 0.88, 1.82, 3.2, l + 1.05, 1.88);
  for (let k = 0; k < 3; k++) deco(M.white, 4.35, l + 1.2 + k * 0.4, iz0, 4.98, l + 1.23 + k * 0.4, 0.55);
  for (let k = 0; k < 2; k++) geo.geom(M.plant, new THREE.IcosahedronGeometry(0.14, 0), new THREE.Matrix4().makeTranslation(4.6 + k * 0.15, l + 1.36 + k * 0.4, 0.42));
  deco(M.lamp, 4.0, C1 - 0.05, 1.5, 4.4, C1, 1.9);
  // bedroom with the lightwell: double bed with a blue-grey spread and blue cushions
  furn(M.bed, 5.9, l, iz0 + 0.05, 7.6, l + 0.48, 2.4);
  deco(M.spread, 5.9, l + 0.48, 0.75, 7.6, l + 0.56, 2.4);
  geo.obox(M.cushion, 6.45, l + 0.68, 0.55, 0.42, 0.34, 0.14, -0.3, 0, 0);
  geo.obox(M.cushion, 7.05, l + 0.68, 0.55, 0.42, 0.34, 0.14, -0.3, 0, 0);
  deco(M.lamp, 6.2, C1 - 0.05, 2.6, 6.6, C1, 3.0);
  // bedroom with the white bed: desk with a black chair under the window, wardrobe beside it
  furn(M.bed, 4.05, l, 6.0, 5.0, l + 0.5, iz1 - 0.02);
  furn(M.lightWood, 5.8, l + 0.72, 7.45, 6.95, l + 0.76, iz1 - 0.02);
  for (const lx of [5.83, 6.88]) for (const lz of [7.48, 8.0]) deco(M.lightWood, lx, l, lz, lx + 0.04, l + 0.72, lz + 0.04);
  chair(6.35, 7.05, M.black, -1);
  furn(M.white, 7.05, l, 7.4, ix1 - 0.02, l + 2.0, iz1 - 0.02);
  deco(M.black, 4.6, C1 - 0.04, 6.2, 6.6, C1, 6.26);
  for (const tx of [5.0, 5.8]) deco(M.lamp, tx - 0.05, C1 - 0.18, 6.18, tx + 0.05, C1 - 0.04, 6.28);
  // bedroom with the black pillow: bed under the window wall, reading lamp, wardrobe by the door,
  // desk with a white chair, and the glass door out to the terrace at the foot of the bed
  furn(M.bed, 0.35, l, 7.15, 2.35, l + 0.5, iz1 - 0.02);
  geo.obox(M.black, 0.7, l + 0.6, 7.6, 0.35, 0.16, 0.55, 0, 0, 0);
  geo.geom(M.white, new THREE.TorusGeometry(0.45, 0.015, 4, 16, Math.PI), new THREE.Matrix4().makeRotationY(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0.4, l + 1.2, 6.8)));
  furn(M.white, 0.35, l, 5.75, 0.95, l + 2.1, 6.95);
  furn(M.lightWood, 2.95, l + 0.72, 5.72, 3.85, l + 0.76, 6.3);
  for (const lx of [2.98, 3.78]) for (const lz of [5.75, 6.23]) deco(M.lightWood, lx, l, lz, lx + 0.04, l + 0.72, lz + 0.04);
  chair(3.4, 6.7, M.white, 1);
  deco(M.lamp, 1.8, C1 - 0.05, 6.7, 2.2, C1, 7.1);
  // hall: the washer and dryer stacked in the corner, and the dresser with a mirror and flowers
  // between the two bathroom doors
  furn(M.white, 3.25, l, 4.95, 3.85, l + 1.75, 5.55);
  for (const wy of [l + 0.42, l + 1.3]) geo.geom(M.black, new THREE.CylinderGeometry(0.19, 0.19, 0.02, 18), new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(3.24, wy, 5.25)));
  furn(M.white, 2.95, l, 2.62, 3.75, l + 0.9, 3.05);
  deco(M.steel, 3.05, l + 1.1, 2.6, 3.65, l + 1.95, 2.62);
  deco(M.glass, 3.3, l + 0.9, 2.8, 3.4, l + 1.12, 2.9);
  for (let k = 0; k < 6; k++) geo.geom(k % 2 ? M.pink : M.cushion, new THREE.SphereGeometry(0.05, 6, 4), new THREE.Matrix4().makeTranslation(3.35 + Math.cos(k) * 0.07, l + 1.18 + (k % 3) * 0.04, 2.85 + Math.sin(k) * 0.07));
  deco(M.lamp, 2.4, C1 - 0.05, 3.8, 2.8, C1, 4.2);
  deco(M.lamp, 4.25, C1 - 0.05, 3.3, 4.65, C1, 3.7);

  // =================================================================== build
  const meshes = geo.build(group);
  return {
    world, doors, meshes,
    lights: [[2.0, FU + 2.3, 2.5], [5.8, FU + 2.3, 6.2], [2.6, FL + 2.2, 4.0], [2.2, FL + 2.2, 6.9]],
    // pickups for the "inside job" (local coordinates)
    items: [
      { kind: 'laptop', p: [0.62, u + 0.9, 6.5], name: 'laptop' },
      { kind: 'candle', p: [5.8, u + 0.43, 6.35], name: 'candle & flowers' },
      { kind: 'router', p: [3.8, u + 0.76, 0.6], name: 'wi-fi router' },
      { kind: 'cushion', p: [6.75, l + 0.56, 1.3], name: 'blue cushions' },
      { kind: 'plant', p: [4.65, l + 1.23, 0.42], name: 'bathroom plant' },
      { kind: 'book', p: [3.4, l + 0.76, 6.0], name: 'coffee-table book' },
    ],
    door: [1.95, FU, -0.5],            // outside the front door
    terrace: [3.3, FL, 10.3],
    bathroom: [4.0, FL, 1.9],
    inside: (x, y, z) => x > 0 && x < W && z > 0 && z < D && y < TOP + 0.1 && y > FL - 1,
  };
}
