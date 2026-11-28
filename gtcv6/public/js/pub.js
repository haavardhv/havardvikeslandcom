// Kong Oscar, the pub on the corner of Veversmauet and Tverrgaten on Marken: a ground-floor room
// built inside its OpenStreetMap building, with the bar along the back, a pool table, a dartboard
// on the end wall and a table shuffleboard by the door.
//
// As with Myreze's office, everything is written in plan coordinates, in metres: x runs along the
// Veversmauet facade (from its south-west corner towards Tverrgaten), y runs from the facade line
// into the building, and heights are above the pub's floor. The group's local frame is
// (x, height, -y), and the group sits at the plan's origin with rotation.y = theta.
//
//   back (y = 9.4)
//   +--------------------------------------------------+
//   | booth   TV           |  bottles · KONG OSCAR neon |
//   |                      |=========== bar ============|
//   |                         stools                    |
//   |   Brann           +-----+                          |
//   |                   |pool |               +--+       |
//   |                   |table|               |sh|       |
//   | dart              +-----+   (table)     |uf|       |
//   | board  oche                             |fl|       |
//   |                                         +--+       |
//   +--window------------window-------------------door--+
//   Veversmauet (y = 0)
import * as THREE from '../vendor/three.module.min.js';
import { Geo, World } from './engine.js';
import { textTexture } from './textures.js';
import { canvasTex } from './activity.js';
import { SB, shuffleSurfaceTexture } from './shuffleboard.js';

// the facade on Veversmauet, from OSM (building 4060's edge along the street)
export const PUB_PLAN = { a: [-123.0, 103.6], b: [-118.1, 112.1] };
export function pubFrame() {
  const [ax, az] = PUB_PLAN.a, [bx, bz] = PUB_PLAN.b;
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  return { ox: ax, oz: az, ux, uz, theta: Math.atan2(-uz, ux) };
}
export const PUB = {
  x0: 0.3, x1: 10.0, y0: 0.45, y1: 9.4, CH: 3.1,
  door: [8.25, 9.25],
  pool: { x: 3.6, y: 5.6 },                       // the table's centre; its length runs along y
  darts: { x: 0.3, y: 2.3 },                      // the board on the end wall, facing +x
  shuffle: { x: 7.25, y: 1.75 },                  // the middle of your end; the table runs along +y
};

export function buildPub(group, T, FO) {
  const geo = new Geo();
  const world = new World(4);
  const { CH } = PUB, C = FO + CH;
  const std = (o, tex) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o }); if (tex) m.map = tex; return m; };
  const M = {
    wall: std({ color: 0x6b2a24, roughness: 0.95, emissive: 0x1c0907 }),       // oxblood
    panel: std({ color: 0x3b2618, roughness: 0.6, emissive: 0x0c0704 }),        // dark wood wainscot
    cream: std({ color: 0xd8ccb0, roughness: 0.95, emissive: 0x2a251b }),
    out: std({ color: 0xe2d8c0, roughness: 0.9 }),
    ceiling: std({ color: 0x2a211b, roughness: 1, emissive: 0x0b0806 }),
    floor: std({ color: 0x8a6a4c, roughness: 0.55 }, T.floor),
    wood: std({ color: 0x5a3a24, roughness: 0.5 }),
    woodDark: std({ color: 0x2b1b12, roughness: 0.5 }),
    brass: std({ color: 0xc9a23a, roughness: 0.3, metalness: 0.85 }),
    steel: std({ color: 0xaab0b5, roughness: 0.25, metalness: 0.85 }),
    black: std({ color: 0x141414, roughness: 0.5 }),
    felt: std({ color: 0x1f5e8c, roughness: 1 }),
    rail: std({ color: 0x1d5480, roughness: 0.95 }),
    leather: std({ color: 0x4a1f1a, roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd6e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false }),
    lamp: std({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 2.0 }),
    shade: std({ color: 0x1d3d2a, roughness: 0.5, metalness: 0.3 }),
    bottles: [0x2f6b3a, 0x7a4a1a, 0xd9d2c0, 0x3a5a8a, 0x8a2a2a, 0xc9a23a].map(c => std({ color: c, roughness: 0.15, metalness: 0.1, emissive: c, emissiveIntensity: 0.12 })),
    stool: std({ color: 0x1a1a1a, roughness: 0.6 }),
    beer: std({ color: 0xd49a2a, roughness: 0.2, emissive: 0x4a2a06 }),
    foam: std({ color: 0xf4efe0, roughness: 0.9 }),
    cork: std({ color: 0x9c7c56, roughness: 1 }),
  };
  M.glass.userData.noCast = true; M.lamp.userData.noCast = true;
  const B = (m, x0, y0, x1, y1, h0, h1, skip) => geo.box(m, Math.min(x0, x1), FO + h0, -Math.max(y0, y1), Math.max(x0, x1), FO + h1, -Math.min(y0, y1), skip || '');
  const block = (x0, y0, x1, y1, h0, h1, o = {}) => world.add({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: -Math.max(y0, y1), z1: -Math.min(y0, y1), bottom: FO + h0, top: FO + h1, walk: o.walk !== false, cam: o.cam !== false, solid: o.solid !== false });
  const solid = (m, x0, y0, x1, y1, h0, h1, o = {}) => { if (m) B(m, x0, y0, x1, y1, h0, h1); return block(x0, y0, x1, y1, h0, h1, o); };
  const furn = (m, x0, y0, x1, y1, h0, h1) => solid(m, x0, y0, x1, y1, h0, h1, { cam: false });
  const at = (x, y, h) => new THREE.Matrix4().makeTranslation(x, FO + h, -y);
  const cyl = (m, x, y, h0, h1, r0, r1 = r0, seg = 14) => geo.geom(m, new THREE.CylinderGeometry(r1, r0, h1 - h0, seg), at(x, y, (h0 + h1) / 2));

  // ---- walls along x ('x', thickness in y) or along y ('y', thickness in x), with openings
  // { a0, a1, y0, y1, door }. The inner face gets the oxblood wall over a wood wainscot.
  function wall(axis, c0, c1, a0, a1, ops, inner, outer = M.out) {
    const cuts = new Set([a0, a1]);
    for (const o of ops) { cuts.add(o.a0); cuts.add(o.a1); }
    const pts = [...cuts].sort((p, q) => p - q), mid = (c0 + c1) / 2;
    const innerHi = inner === 'hi';
    const piece = (s, e, h0, h1) => {
      if (e - s < 1e-4 || h1 - h0 < 1e-3) return;
      const box = (m, p, q, hh0, hh1) => axis === 'x' ? B(m, s, p, e, q, hh0, hh1) : B(m, p, s, q, e, hh0, hh1);
      const [ip, iq] = innerHi ? [mid, c1] : [c0, mid], [op, oq] = innerHi ? [c0, mid] : [mid, c1];
      box(outer, op, oq, h0, h1);
      const wh = 1.05;
      if (h0 < wh) box(M.panel, ip, iq, h0, Math.min(h1, wh));
      if (h1 > wh) box(M.wall, ip, iq, Math.max(h0, wh), h1);
    };
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i], e = pts[i + 1], o = ops.find(o => o.a0 <= s + 1e-4 && o.a1 >= e - 1e-4);
      if (o) { piece(s, e, 0, o.y0); piece(s, e, o.y1, CH); } else piece(s, e, 0, CH);
    }
    const add = (p, q, h0, h1) => { if (q - p > 1e-4) { if (axis === 'x') block(p, c0, q, c1, h0, h1, { walk: false }); else block(c0, p, c1, q, h0, h1, { walk: false }); } };
    let s = a0;
    for (const d of ops.filter(o => o.door).sort((p, q) => p.a0 - q.a0)) { add(s, d.a0, 0, CH); add(d.a0, d.a1, d.y1, CH); s = d.a1; }
    add(s, a1, 0, CH);
    // window frames and glass
    for (const o of ops) {
      if (o.door) continue;
      const bx = (m, a, b, p, q, h0, h1) => axis === 'x' ? B(m, a, p, b, q, h0, h1) : B(m, p, a, q, b, h0, h1);
      const f = 0.06;
      bx(M.woodDark, o.a0 - f, o.a1 + f, mid - 0.05, mid + 0.05, o.y0 - f, o.y0);
      bx(M.woodDark, o.a0 - f, o.a1 + f, mid - 0.05, mid + 0.05, o.y1, o.y1 + f);
      bx(M.woodDark, o.a0 - f, o.a0, mid - 0.05, mid + 0.05, o.y0, o.y1);
      bx(M.woodDark, o.a1, o.a1 + f, mid - 0.05, mid + 0.05, o.y0, o.y1);
      for (let a = o.a0 + 0.7; a < o.a1 - 0.3; a += 0.7) bx(M.woodDark, a - 0.025, a + 0.025, mid - 0.04, mid + 0.04, o.y0, o.y1);
      bx(M.woodDark, o.a0, o.a1, mid - 0.04, mid + 0.04, o.y1 - 0.5, o.y1 - 0.45);
      bx(M.glass, o.a0, o.a1, mid - 0.005, mid + 0.005, o.y0, o.y1);
      const sill = innerHi ? [c1, c1 + 0.2] : [c0 - 0.2, c0];
      bx(M.wood, o.a0 - 0.06, o.a1 + 0.06, sill[0], sill[1], o.y0 - 0.05, o.y0);
    }
  }
  const win = (a0, a1) => ({ a0, a1, y0: 0.85, y1: 2.55 });
  const P = PUB;

  // =================================================================== shell
  B(M.floor, P.x0, P.y0, P.x1, P.y1, -0.4, 0, 'ny'); block(P.x0, P.y0, P.x1, P.y1, -0.4, 0);
  B(M.ceiling, P.x0 - 0.2, P.y0 - 0.3, P.x1 + 0.2, P.y1 + 0.2, CH, CH + 0.3, 'py'); block(P.x0, P.y0, P.x1, P.y1, CH, CH + 0.3, { walk: false });
  for (let x = P.x0 + 1.2; x < P.x1; x += 2.1) B(M.woodDark, x - 0.1, P.y0, x + 0.1, P.y1, CH - 0.22, CH);      // beams
  wall('x', 0.2, P.y0, P.x0 - 0.2, P.x1 + 0.2, [win(1.0, 3.0), win(3.8, 6.6), { a0: P.door[0], a1: P.door[1], y0: 0, y1: 2.3, door: true }], 'hi');
  wall('x', P.y1, P.y1 + 0.2, P.x0 - 0.2, P.x1 + 0.2, [], 'lo');
  wall('y', P.x0 - 0.2, P.x0, P.y0, P.y1, [], 'hi');
  wall('y', P.x1, P.x1 + 0.2, P.y0, P.y1, [], 'lo');
  // the door, from inside: dark wood with a glass panel, and a doormat
  B(M.woodDark, P.door[0], 0.24, P.door[1], 0.32, 0, 2.3);
  block(P.door[0], 0.2, P.door[1], 0.45, 0, 2.3, { walk: false });        // it stays shut: E takes you out
  B(M.glass, P.door[0] + 0.15, 0.2, P.door[1] - 0.15, 0.36, 1.1, 2.1);
  B(M.brass, P.door[0] + 0.12, 0.33, P.door[0] + 0.16, 0.37, 0.95, 1.15);
  B(M.black, P.door[0] + 0.05, 0.5, P.door[1] - 0.05, 1.4, 0, 0.012);
  {
    const t = textTexture(['UT · EXIT'], { w: 256, h: 80, bg: '#1d6b3a', fg: '#ffffff', font: '800 44px "Archivo", sans-serif', radius: 8 });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshBasicMaterial({ map: t }));
    s.position.set((P.door[0] + P.door[1]) / 2, FO + 2.5, -P.y0 - 0.01); s.rotation.y = Math.PI; group.add(s);
  }

  // =================================================================== the bar
  const bx0 = 4.6, bx1 = P.x1, by0 = 7.5, by1 = 8.15;
  furn(M.wood, bx0, by0, bx1, by1, 0, 1.02);
  B(M.woodDark, bx0 - 0.05, by0 - 0.06, bx1, by1 + 0.02, 1.02, 1.1);
  B(M.brass, bx0, by0 - 0.12, bx1, by0 - 0.09, 0.18, 0.22);                       // the foot rail
  for (let x = bx0 + 0.3; x < bx1; x += 0.6) B(M.woodDark, x - 0.02, by0 - 0.01, x + 0.02, by0, 0.05, 0.98);
  // taps
  for (let k = 0; k < 5; k++) {
    const x = 6.4 + k * 0.28;
    cyl(M.brass, x, by0 + 0.35, 1.1, 1.42, 0.022);
    B(M.black, x - 0.015, by0 + 0.26, x + 0.015, by0 + 0.33, 1.4, 1.56);
  }
  B(M.brass, 6.25, by0 + 0.3, 7.7, by0 + 0.4, 1.38, 1.44);
  // back bar: shelves of bottles against the back wall, a mirror behind them, and the neon sign
  furn(M.woodDark, bx0 + 0.3, 8.95, bx1, P.y1, 0, 0.95);
  for (const h of [1.35, 1.75]) B(M.wood, bx0 + 0.3, 9.05, bx1, P.y1, h, h + 0.04);
  B(std({ color: 0x8a9aa0, roughness: 0.08, metalness: 0.9 }), bx0 + 0.4, P.y1 - 0.01, bx1 - 0.1, P.y1, 1.0, 2.15);
  for (let k = 0; k < 40; k++) {
    const x = bx0 + 0.45 + k * 0.125 + (k % 3) * 0.01, h = k < 20 ? 0.99 : 1.39;
    const xx = k < 20 ? x : x - 20 * 0.125 + 0.06, bh = 0.22 + (k * 37 % 7) * 0.02;
    if (xx > bx1 - 0.1) continue;
    cyl(M.bottles[k % 6], xx, 9.2, h, h + bh, 0.034, 0.03, 8);
    cyl(M.bottles[k % 6], xx, 9.2, h + bh, h + bh + 0.08, 0.012, 0.012, 6);
  }
  {
    const neon = canvasTex(1024, 220, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = '900 130px "Archivo", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#ff3b3b'; g.shadowBlur = 30; g.fillStyle = '#ffd6d0';
      g.fillText('KONG OSCAR', w / 2, h / 2 + 4);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.52), new THREE.MeshBasicMaterial({ map: neon, transparent: true, depthWrite: false, fog: false }));
    m.position.set(7.4, FO + 2.55, -(P.y1 - 0.03)); group.add(m);
  }
  // bar stools
  for (let x = 5.0; x < bx1 - 0.3; x += 0.75) {
    cyl(M.stool, x, by0 - 0.45, 0, 0.72, 0.03);
    cyl(M.leather, x, by0 - 0.45, 0.72, 0.8, 0.19);
    geo.geom(M.steel, new THREE.TorusGeometry(0.16, 0.01, 4, 16), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(at(x, by0 - 0.45, 0.28)));
    world.add({ x0: x - 0.19, x1: x + 0.19, z0: -(by0 - 0.26), z1: -(by0 - 0.64), bottom: FO, top: FO + 0.8, cam: false });
  }
  // a pint on the bar
  for (const [x, y] of [[5.3, 7.72], [8.9, 7.8]]) { cyl(M.beer, x, y, 1.1, 1.26, 0.035, 0.04, 10); cyl(M.foam, x, y, 1.26, 1.29, 0.04, 0.04, 10); }

  // =================================================================== the pool table
  {
    const { x, y } = P.pool, lx = 0.99 / 2 + 0.16, ly = 1.98 / 2 + 0.16;
    furn(M.wood, x - lx, y - ly, x + lx, y + ly, 0.62, 0.76);
    B(M.felt, x - 0.99 / 2 - 0.05, y - 1.98 / 2 - 0.05, x + 0.99 / 2 + 0.05, y + 1.98 / 2 + 0.05, 0.76, 0.8);
    // the cushions, in blue cloth, and the wooden rails round them; the pockets are black
    const hw = 0.99 / 2, hl = 1.98 / 2, cw = 0.05;
    for (const s of [-1, 1]) {
      for (const [a, b] of [[-hl + 0.07, -0.058], [0.058, hl - 0.07]]) B(M.rail, x + s * hw, y + a, x + s * (hw + cw), y + b, 0.8, 0.84);
      B(M.rail, x - hw + 0.07, y + s * hl, x + hw - 0.07, y + s * (hl + cw), 0.8, 0.84);
      B(M.wood, x + s * (hw + cw), y - ly, x + s * lx, y + ly, 0.76, 0.85);
      B(M.wood, x - lx, y + s * (hl + cw), x + lx, y + s * ly, 0.76, 0.85);
    }
    for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0]]) {
      cyl(M.black, x + px * (hw + 0.012), y + py * (hl + 0.012), 0.7, 0.846, 0.058, 0.058, 14);
    }
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(M.woodDark, x + sx * (lx - 0.18) - 0.09, y + sy * (ly - 0.25) - 0.09, x + sx * (lx - 0.18) + 0.09, y + sy * (ly - 0.25) + 0.09, 0, 0.62);
    // the long lamp over it
    B(M.shade, x - 0.17, y - 0.85, x + 0.17, y + 0.85, 1.85, 1.95);
    B(M.lamp, x - 0.14, y - 0.82, x + 0.14, y + 0.82, 1.84, 1.85);
    for (const s of [-0.6, 0.6]) B(M.steel, x - 0.005, y + s - 0.005, x + 0.005, y + s + 0.005, 1.95, CH);
    // the cue rack on the end wall
    B(M.wood, P.x0, 6.3, P.x0 + 0.05, 7.3, 1.0, 1.08); B(M.wood, P.x0, 6.3, P.x0 + 0.05, 7.3, 1.55, 1.6);
    for (let k = 0; k < 6; k++) geo.geom(k % 2 ? M.wood : M.woodDark, new THREE.CylinderGeometry(0.006, 0.013, 1.45, 6), at(P.x0 + 0.07, 6.42 + k * 0.17, 0.75).multiply(new THREE.Matrix4().makeRotationX(0.03)));
  }

  // =================================================================== the dartboard
  {
    const { x, y } = P.darts;
    // the cabinet, open, and a cork surround
    B(M.woodDark, x, y - 0.42, x + 0.07, y + 0.42, 1.28, 2.18);
    B(M.cork, x + 0.07, y - 0.36, x + 0.09, y + 0.36, 1.37, 2.09);
    for (const s of [-1, 1]) B(M.woodDark, x, y + s * 0.42 - (s > 0 ? 0 : 0.42), x + 0.04, y + s * 0.42 + (s > 0 ? 0.42 : 0), 1.28, 2.18);
    // a spot lamp over it
    B(M.black, x + 0.0, y - 0.05, x + 0.55, y + 0.05, 2.45, 2.5);
    cyl(M.shade, x + 0.55, y, 2.3, 2.48, 0.09, 0.05, 12);
    cyl(M.lamp, x + 0.55, y, 2.29, 2.3, 0.085, 0.085, 12);
    // the oche, a brass strip in the floor, and the chalk scoreboard
    B(M.brass, x + 2.37 - 0.02, y - 0.45, x + 2.37 + 0.02, y + 0.45, 0, 0.012);
    B(M.black, x, y + 0.6, x + 0.03, y + 1.25, 1.3, 2.0);
    B(M.woodDark, x, y + 0.57, x + 0.04, y + 1.28, 1.27, 1.3);
  }

  // =================================================================== the shuffleboard table
  {
    const { x, y } = P.shuffle, L = SB.L, W = SB.W, H = SB.H;
    const surfMat = new THREE.MeshStandardMaterial({ map: shuffleSurfaceTexture(), roughness: 0.32, metalness: 0.05 });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(L, W), surfMat);
    top.rotation.x = -Math.PI / 2; top.rotation.z = Math.PI / 2;            // u runs along plan +y
    top.position.set(x, FO + H, -(y + L / 2)); top.receiveShadow = true;
    group.add(top);
    const gw = 0.09, ew = 0.04;
    B(M.woodDark, x - W / 2 - gw - ew, y - 0.05, x + W / 2 + gw + ew, y + L + 0.05, 0.62, H - 0.07);
    B(M.wood, x - W / 2, y, x + W / 2, y + L, H - 0.07, H - 0.002);
    for (const s of [-1, 1]) {
      B(M.black, x + s * W / 2 + (s > 0 ? 0 : -gw), y, x + s * W / 2 + (s > 0 ? gw : 0), y + L, H - 0.07, H - 0.06);   // the gutters
      B(M.woodDark, x + s * (W / 2 + gw) + (s > 0 ? 0 : -ew), y - 0.05, x + s * (W / 2 + gw) + (s > 0 ? ew : 0), y + L + 0.05, H - 0.07, H + 0.04);
    }
    B(M.black, x - W / 2 - gw, y + L, x + W / 2 + gw, y + L + 0.18, 0.62, H - 0.07);     // the trough at the far end
    B(M.woodDark, x - W / 2 - gw - ew, y + L + 0.18, x + W / 2 + gw + ew, y + L + 0.22, 0.62, H + 0.04);
    block(x - W / 2 - gw - ew, y - 0.05, x + W / 2 + gw + ew, y + L + 0.22, 0, H + 0.04, { cam: false });
    for (const ly of [y + 0.3, y + L / 2, y + L - 0.15]) for (const s of [-1, 1]) B(M.woodDark, x + s * 0.3 - 0.05, ly - 0.05, x + s * 0.3 + 0.05, ly + 0.05, 0, 0.62);
    // a lamp over the far end, and the scoreboard on the wall beside it
    B(M.shade, x - 0.2, y + L - 0.8, x + 0.2, y + L - 0.2, 1.95, 2.05); B(M.lamp, x - 0.17, y + L - 0.77, x + 0.17, y + L - 0.23, 1.94, 1.95);
    B(M.steel, x - 0.005, y + L - 0.505, x + 0.005, y + L - 0.495, 2.05, CH);
  }

  // =================================================================== tables, the booth, the walls
  const roundTable = (x, y) => {
    cyl(M.woodDark, x, y, 0, 0.72, 0.04);
    cyl(M.wood, x, y, 0.72, 0.76, 0.36, 0.36, 18);
    cyl(M.black, x, y, 0, 0.03, 0.22, 0.22, 12);
    world.add({ x0: x - 0.36, x1: x + 0.36, z0: -y - 0.36, z1: -y + 0.36, bottom: FO, top: FO + 0.76, cam: false });
    for (const a of [0.4, 3.3]) {
      const sx = x + Math.cos(a) * 0.62, sy = y + Math.sin(a) * 0.62;
      cyl(M.stool, sx, sy, 0, 0.45, 0.025); cyl(M.leather, sx, sy, 0.45, 0.5, 0.17);
    }
    cyl(M.beer, x + 0.1, y - 0.05, 0.76, 0.92, 0.035, 0.04, 10); cyl(M.foam, x + 0.1, y - 0.05, 0.92, 0.95, 0.04, 0.04, 10);
  };
  roundTable(5.55, 2.2); roundTable(5.6, 4.6);
  // the booth in the back corner: leather benches round a table
  furn(M.leather, P.x0, 7.4, 2.4, 7.85, 0, 0.45); B(M.leather, P.x0, 7.4, 2.4, 7.55, 0.45, 1.1);
  furn(M.leather, P.x0, 8.95, 2.4, P.y1, 0, 0.45); B(M.leather, P.x0, 9.25, 2.4, P.y1, 0.45, 1.1);
  furn(M.woodDark, P.x0 + 0.1, 8.0, 2.2, 8.8, 0.72, 0.76); B(M.woodDark, 1.2, 8.3, 1.3, 8.5, 0, 0.72);
  // the TV over the booth, with Brann on
  {
    const tv = canvasTex(512, 288, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f7a3a'); gr.addColorStop(1, '#3f9a48'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.strokeRect(20, 30, w - 40, h - 50); g.beginPath(); g.moveTo(w / 2, 30); g.lineTo(w / 2, h - 20); g.stroke();
      g.beginPath(); g.arc(w / 2, h / 2 + 5, 36, 0, 7); g.stroke();
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#e2231a' : '#f4f4f4'; g.beginPath(); g.arc(80 + Math.random() * 350, 70 + Math.random() * 170, 5, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(16, 8, 190, 30); g.fillStyle = '#fff'; g.font = '700 20px "Archivo", sans-serif'; g.fillText('BRANN  2 – 0  RBK', 26, 30);
    });
    B(M.black, 0.7, P.y1 - 0.08, 2.0, P.y1, 1.65, 2.4);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.68), new THREE.MeshBasicMaterial({ map: tv }));
    s.position.set(1.35, FO + 2.025, -(P.y1 - 0.085)); group.add(s);
  }
  // Brann on the end wall: the club crest, and a scarf
  {
    const crestMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.05 });
    new THREE.TextureLoader().load('img/brann.png', t => { t.colorSpace = THREE.SRGBColorSpace; crestMat.map = t; crestMat.needsUpdate = true; });
    const crest = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), crestMat);
    crest.position.set(P.x0 + 0.012, FO + 2.0, -4.9); crest.rotation.y = Math.PI / 2; group.add(crest);
    const scarf = canvasTex(512, 64, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#e2231a' : '#f4f4f4'; g.fillRect(i * w / 16, 0, w / 16, h); } g.fillStyle = '#111'; g.font = '800 36px "Archivo", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BRANN · BERGEN', w / 2, h / 2 + 2); });
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.2), new THREE.MeshStandardMaterial({ map: scarf, roughness: 1 }));
    sc.position.set(P.x0 + 0.015, FO + 2.6, -4.9); sc.rotation.y = Math.PI / 2; group.add(sc);
  }
  // pictures on the walls
  for (const [x, y, w, h] of [[2.0, P.y1 - 0.015, 0.6, 0.8], [3.2, P.y1 - 0.015, 0.5, 0.65]]) {
    B(M.brass, x - w / 2 - 0.03, y - 0.005, x + w / 2 + 0.03, y + 0.005, 1.75 - 0.03, 1.75 + h + 0.03);
    B(M.cream, x - w / 2, y - 0.012, x + w / 2, y - 0.004, 1.75, 1.75 + h);
  }
  // lamps along the ceiling
  for (const [x, y] of [[2.0, 1.6], [7.3, 6.5], [9.0, 4.0], [2.0, 8.4]]) {
    B(M.black, x - 0.005, y - 0.005, x + 0.005, y + 0.005, 2.35, CH);
    cyl(M.shade, x, y, 2.2, 2.38, 0.2, 0.06, 14); cyl(M.lamp, x, y, 2.19, 2.2, 0.18, 0.18, 14);
  }

  const meshes = geo.build(group);
  const LP = (x, y, h) => [x, FO + h, -y];
  return {
    world, meshes, FO,
    lights: [LP(3.6, 5.6, 1.7), LP(7.3, 7.0, 2.4), LP(3.6, 1.9, 2.4)],
    entry: LP(8.75, 1.7, 0), exitDoor: LP(8.75, 0.8, 0),
    centre: LP(5, 5, 1.5),
    // where the regulars stand, and the bartender
    regulars: { pool: LP(2.25, 7.1, 0), darts: LP(1.4, 3.6, 0), shuffle: LP(6.35, 1.3, 0), bar: LP(7.6, 8.6, 0) },
    // the games' frames (plan): origin, and the plan direction of their +x
    frames: {
      pool: { x: P.pool.x, y: P.pool.y, h: 0, dir: [0, 1], surf: 0.8 },
      darts: { x: P.darts.x + 0.09 - 0.03, y: P.darts.y, h: 0, dir: [0, 1] },
      shuffle: { x: P.shuffle.x, y: P.shuffle.y, h: 0, dir: [0, 1] },
    },
    inside: (x, y, z) => x > P.x0 && x < P.x1 && -z > P.y0 && -z < P.y1 && y > FO - 0.5 && y < C + 0.2,
  };
}
