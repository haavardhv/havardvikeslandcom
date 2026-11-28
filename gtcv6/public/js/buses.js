// Skyss buses that drive. A street graph is made from the asphalt roads in OpenStreetMap; the
// line 2 trolleybuses run the length of the overhead wires (the route keeps under them), and a
// few diesel buses run between bus stops far apart along the wide streets. Each goes from one
// end of its route to the other and back, in the right-hand lane, slowing for corners, stopping
// at the bus stops it passes, waiting behind the bus in front, and braking for you.
import * as THREE from '../vendor/three.module.min.js';

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

// ---------------------------------------------------------------------------- the street graph
function streetGraph(map) {
  const key = (x, z) => Math.round(x * 10) + ',' + Math.round(z * 10);
  const ids = new Map(), X = [], Z = [], adj = [];
  const node = (x, z) => { const k = key(x, z); let i = ids.get(k); if (i === undefined) { i = X.length; ids.set(k, i); X.push(x); Z.push(z); adj.push([]); } return i; };
  const trolleySegs = [];
  for (const r of map.trolley || []) for (let i = 0; i < r.p.length - 2; i += 2) trolleySegs.push([r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3]]);
  // is (x, z) under the wires
  const tGrid = new Map(), tk = (i, j) => i * 100003 + j;
  for (const s of trolleySegs) for (let i = Math.floor(Math.min(s[0], s[2]) / 25) - 1; i <= Math.floor(Math.max(s[0], s[2]) / 25) + 1; i++) for (let j = Math.floor(Math.min(s[1], s[3]) / 25) - 1; j <= Math.floor(Math.max(s[1], s[3]) / 25) + 1; j++) { const k = tk(i, j); if (!tGrid.has(k)) tGrid.set(k, []); tGrid.get(k).push(s); }
  const underWires = (x, z) => {
    for (const [ax, az, bx, bz] of tGrid.get(tk(Math.floor(x / 25), Math.floor(z / 25))) || []) {
      const L2 = (bx - ax) ** 2 + (bz - az) ** 2, t = L2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2)) : 0;
      if (Math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z) < 2.5) return true;
    }
    return false;
  };
  for (const r of map.roads || []) {
    if ((r.k !== 'road' && r.k !== 'sett') || r.w < 3.5) continue;
    const p = r.p;
    for (let i = 0; i < p.length - 2; i += 2) {
      const a = node(p[i], p[i + 1]), b = node(p[i + 2], p[i + 3]);
      if (a === b) continue;
      const L = Math.hypot(X[b] - X[a], Z[b] - Z[a]), wire = underWires((X[a] + X[b]) / 2, (Z[a] + Z[b]) / 2);
      adj[a].push({ to: b, L, w: r.w, wire }); adj[b].push({ to: a, L, w: r.w, wire });
    }
  }
  return { X, Z, adj, underWires };
}
function dijkstra(G, s, t, cost) {
  const n = G.X.length, d = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), pw = new Float32Array(n), done = new Uint8Array(n);
  const heap = [[0, s]]; d[s] = 0;
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  while (heap.length) {
    const [, i] = pop();
    if (done[i]) continue; done[i] = 1;
    if (i === t) break;
    for (const e of G.adj[i]) { const nd = d[i] + cost(e); if (nd < d[e.to]) { d[e.to] = nd; prev[e.to] = i; pw[e.to] = e.w; push(nd, e.to); } }
  }
  if (!isFinite(d[t])) return null;
  const pts = [];
  for (let i = t; i >= 0; i = prev[i]) pts.push([G.X[i], G.Z[i], pw[i]]);
  return pts.reverse();
}
// the largest connected part of the graph, so routes are between nodes that reach each other
function biggestPart(G) {
  const comp = new Int32Array(G.X.length).fill(-1), sizes = [];
  for (let s = 0; s < G.X.length; s++) {
    if (comp[s] >= 0 || !G.adj[s].length) continue;
    const c = sizes.length, st = [s]; comp[s] = c; let n = 0;
    while (st.length) { const i = st.pop(); n++; for (const e of G.adj[i]) if (comp[e.to] < 0) { comp[e.to] = c; st.push(e.to); } }
    sizes.push(n);
  }
  let best = 0; for (let c = 1; c < sizes.length; c++) if (sizes[c] > sizes[best]) best = c;
  return (i) => comp[i] === best;
}

// A route: a polyline with its lengths, and the lane to keep to on each segment
function makeRoute(pts) {
  // drop points closer than 1 m, then round the corners a little
  const q = [pts[0]];
  for (const p of pts) if (Math.hypot(p[0] - q[q.length - 1][0], p[1] - q[q.length - 1][1]) > 1) q.push(p);
  const s = [0];
  for (let i = 1; i < q.length; i++) s.push(s[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]));
  const len = s[s.length - 1];
  // the speed allowed at each point: slow for corners
  const vmax = q.map((p, i) => {
    if (i === 0 || i === q.length - 1) return 3;
    const ax = p[0] - q[i - 1][0], az = p[1] - q[i - 1][1], bx = q[i + 1][0] - p[0], bz = q[i + 1][1] - p[1];
    const a = Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz) || 1))));
    return Math.max(2.5, 10 - a * 11);
  });
  let seg = 0;
  const at = (d, o) => {
    d = Math.max(0, Math.min(len, d));
    if (s[seg] > d || s[seg + 1] < d) { seg = 0; let lo = 0, hi = q.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m] <= d) lo = m; else hi = m - 1; } seg = lo; }
    const i = seg, L = s[i + 1] - s[i] || 1, t = (d - s[i]) / L;
    o.x = q[i][0] + (q[i + 1][0] - q[i][0]) * t; o.z = q[i][1] + (q[i + 1][1] - q[i][1]) * t;
    o.dx = (q[i + 1][0] - q[i][0]) / L; o.dz = (q[i + 1][1] - q[i][1]) / L; o.w = q[i + 1][2] || q[i][2] || 7;
    return o;
  };
  // the speed limit ahead of d (looking a braking distance ahead)
  const limit = (d, dir) => {
    let v = 10;
    for (let i = 1; i < q.length - 1; i++) { const ahead = (s[i] - d) * dir; if (ahead < 0 || ahead > 40) continue; v = Math.min(v, Math.sqrt(vmax[i] ** 2 + 2 * 1.2 * ahead)); }
    return v;
  };
  return { q, s, len, at, limit };
}

// ---------------------------------------------------------------------------- the buses
export function buildBuses(scene, map, { terrain }) {
  const ground = (x, z) => terrain.height(x, z);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  // Skyss livery, after photos: white sides, an orange roof line and front, a black window band
  const hex = '#e4532a';
  const sideT = tex(512, 128, (g, w, h) => {
    g.fillStyle = '#eeeff0'; g.fillRect(0, 0, w, h);
    g.fillStyle = hex; g.fillRect(0, 0, w, h * 0.12);
    g.fillStyle = '#121518'; g.fillRect(0, h * 0.16, w, h * 0.42);
    g.fillStyle = 'rgba(160,180,195,0.18)'; g.fillRect(0, h * 0.16, w, h * 0.12);
    g.fillStyle = '#2f3438'; for (const x of [w * 0.1, w * 0.55]) g.fillRect(x, h * 0.14, w * 0.09, h * 0.8);
    g.fillStyle = '#16191c'; for (const x of [w * 0.3, w * 0.82]) { g.beginPath(); g.arc(x, h, h * 0.2, Math.PI, 0); g.fill(); }
    g.fillStyle = hex; g.font = '700 16px Archivo, sans-serif'; g.fillText('skyss', w * 0.66, h * 0.8);
  });
  const frontT = (line, dest) => tex(256, 256, (g, w, h) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    g.fillStyle = '#101315'; g.fillRect(14, 10, w - 28, 140);
    g.fillStyle = '#ffd200'; g.font = '700 24px Archivo, sans-serif'; g.textAlign = 'center'; g.fillText(`${line}  ${dest}`, w / 2, 40);
    g.fillStyle = '#fff3d8'; for (const x of [40, w - 40]) { g.beginPath(); g.arc(x, 200, 9, 0, 7); g.fill(); }
    g.fillStyle = '#ffffff'; g.font = '700 20px Archivo, sans-serif'; g.fillText('skyss', w / 2, 230);
  });
  const rearT = tex(128, 128, (g, w, h) => { g.fillStyle = hex; g.fillRect(0, 0, w, h); g.fillStyle = '#121518'; g.fillRect(10, 8, w - 20, 50); g.fillStyle = '#ff2a1a'; for (const x of [16, w - 16]) g.fillRect(x - 6, 80, 12, 22); g.fillStyle = '#eeeff0'; g.fillRect(0, 108, w, 20); });
  const sideM = std({ map: sideT }), rearM = std({ map: rearT, emissive: 0xffffff, emissiveMap: rearT, emissiveIntensity: 0.05 }), orangeM = std({ color: 0xe4532a }), darkM = std({ color: 0x1b1e21 });
  const glow = [[rearM, 0.05, 0.5]];
  const W = 2.55;
  // a section: a box with the livery, its front (or rear) at the ends
  const section = (len, frontM, back) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, 2.85, len), [sideM, sideM, orangeM, darkM, frontM || darkM, back ? rearM : darkM]);
    body.position.y = 0.35 + 1.42; body.castShadow = true; g.add(body);
    for (const z of [len / 2 - 2.2, -len / 2 + 2.6]) for (const x of [-1, 1]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), darkM); wh.rotation.z = Math.PI / 2; wh.position.set(x * (W / 2 - 0.12), 0.5, z); g.add(wh);
    }
    g.rotation.order = 'YXZ';
    scene.add(g);
    return g;
  };
  const G = streetGraph(map), main = biggestPart(G);
  const nearestNode = (x, z, maxD = 40) => { let b = -1, bd = maxD; for (let i = 0; i < G.X.length; i++) { if (!G.adj[i].length || !main(i)) continue; const d = Math.hypot(G.X[i] - x, G.Z[i] - z); if (d < bd) { bd = d; b = i; } } return b; };
  const buses = [];
  const add = (route, opts) => {
    if (!route || route.len < 150) return;
    const fm = std({ map: frontT(opts.line, opts.dest), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.1 });
    fm.emissiveMap = fm.map; glow.push([fm, 0.1, 0.8]);
    const secs = opts.artic
      ? [{ g: section(11, fm, false), len: 11, off: 0 }, { g: section(7, null, true), len: 7, off: -9.9 }]
      : [{ g: section(12, fm, true), len: 12, off: 0 }];
    if (opts.artic) { const j = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.7, 1.2), darkM); scene.add(j); secs.joint = j; }
    if (opts.trolley) {
      const poles = new THREE.Group();
      for (const w of [-0.3, 0.3]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6.4, 5), darkM); pole.position.set(w, 3.2 + 1.3, -2.1); pole.rotation.x = -1.15; poles.add(pole); }
      secs[0].g.add(poles);
    }
    // the stops along the way: where a stop is within 14 m of the route
    const stops = [], tmp = {};
    for (const st of map.stops || []) {
      let bd = 14, bs = -1;
      for (let i = 0; i < route.q.length - 1; i++) {
        const [ax, az] = route.q[i], [bx, bz] = route.q[i + 1], L2 = (bx - ax) ** 2 + (bz - az) ** 2;
        const t = L2 ? Math.max(0, Math.min(1, ((st.x - ax) * (bx - ax) + (st.z - az) * (bz - az)) / L2)) : 0, d = Math.hypot(ax + (bx - ax) * t - st.x, az + (bz - az) * t - st.z);
        if (d < bd) { bd = d; bs = route.s[i] + t * Math.sqrt(L2); }
      }
      if (bs > 20 && bs < route.len - 20 && !stops.some(s => Math.abs(s.s - bs) < 40)) stops.push({ s: bs, n: st.n });
    }
    stops.sort((a, b) => a.s - b.s);
    const b = { route, secs, stops, d: opts.start * route.len, dir: opts.start > 0.5 ? -1 : 1, v: 0, wait: 2, lastStop: null, opts, x: 0, z: 0, h: 0, tmp };
    buses.push(b);
  };

  const [AX0, AZ0, AX1, AZ1] = map.area || [-1e9, -1e9, 1e9, 1e9];
  const inside = (x, z, m = 0) => x > AX0 + m && x < AX1 - m && z > AZ0 + m && z < AZ1 - m;
  // line 2: from one end of the wires to the other, keeping under them
  {
    // the points of the wires inside the map that reach the rest of the streets
    const cand = [];
    for (const r of map.trolley || []) for (let i = 0; i < r.p.length; i += 8) if (inside(r.p[i], r.p[i + 1], 40)) cand.push([r.p[i], r.p[i + 1]]);
    const nodes = cand.map(c => nearestNode(c[0], c[1], 15)).filter(i => i >= 0);
    let A = null, B = null, bd = 0;
    for (const a of nodes) for (const c of nodes) { const d = Math.hypot(G.X[a] - G.X[c], G.Z[a] - G.Z[c]); if (d > bd) { bd = d; A = a; B = c; } }
    if (A !== null) {
      const pts = dijkstra(G, A, B, (e) => e.L * (e.wire ? 0.25 : e.w < 6 ? 12 : 3) * (inside(G.X[e.to], G.Z[e.to]) ? 1 : 50));
      if (pts) {
        const r = makeRoute(pts);
        { let u = 0, t = {}; for (let d = 0; d < r.len; d += 10) { r.at(d, t); if (G.underWires(t.x, t.z)) u += 10; } r.wireFrac = u / r.len; }
        add(r, { line: 2, dest: 'Sentrum', artic: true, trolley: true, start: 0.15 });
        add(r, { line: 2, dest: 'Sentrum', artic: true, trolley: true, start: 0.7 });
      }
    }
  }
  // diesel buses between stops far apart, along the wide streets
  {
    const R = rnd(11), stops = (map.stops || []).map(s => [s, nearestNode(s.x, s.z, 20)]).filter(([, i]) => i >= 0);
    const LINES = [[3, 'Sentrum'], [6, 'Lønborglien'], [5, 'Sentrum'], [12, 'Bystasjonen']];
    let tries = 0;
    for (const [line, dest] of LINES) {
      while (tries++ < 60) {
        const [a, ia] = stops[Math.floor(R() * stops.length)], [c, ic] = stops[Math.floor(R() * stops.length)];
        const d = Math.hypot(a.x - c.x, a.z - c.z);
        if (d < 700 || d > 1800) continue;
        const pts = dijkstra(G, ia, ic, (e) => e.L * (e.w >= 8 ? 1 : e.w >= 6.5 ? 1.8 : e.w >= 5 ? 4 : 20) * (inside(G.X[e.to], G.Z[e.to]) ? 1 : 50));
        if (!pts) continue;
        const r = makeRoute(pts);
        if (r.len > d * 1.8) continue;               // not a long way round
        add(r, { line, dest, artic: false, trolley: false, start: R() });
        break;
      }
    }
  }

  // ------------------------------------------------ moving them
  const place = (b) => {
    const r = b.route, t = b.tmp;
    for (const sec of b.secs) {
      const d = b.d + sec.off * b.dir;
      r.at(d, t);
      const fx = t.dx * b.dir, fz = t.dz * b.dir;        // heading of travel
      const lane = Math.min(1.5, t.w / 4);              // keep right, clear of the parked cars
      const x = t.x - fz * lane, z = t.z + fx * lane;   // right of (fx, fz) is (-fz, fx)
      const y0 = ground(x + fx * sec.len / 2, z + fz * sec.len / 2), y1 = ground(x - fx * sec.len / 2, z - fz * sec.len / 2);
      sec.x = x; sec.z = z; sec.h = Math.atan2(fx, fz);
      sec.g.position.set(x, (y0 + y1) / 2 + 0.02, z);
      sec.g.rotation.set(Math.atan2(y1 - y0, sec.len), sec.h, 0);
    }
    if (b.secs.joint) {
      // the bellows between the sections, 5.8 m behind the front section's centre
      const a = b.secs[0], c = b.secs[1], jx = a.x - Math.sin(a.h) * 5.8, jz = a.z - Math.cos(a.h) * 5.8;
      let dh = c.h - a.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      b.secs.joint.position.set(jx, ground(jx, jz) + 1.75, jz); b.secs.joint.rotation.y = a.h + dh / 2;
    }
    b.x = b.secs[0].x; b.z = b.secs[0].z; b.h = b.secs[0].h;
  };
  for (const b of buses) place(b);
  return {
    buses, count: buses.length, W,
    // player: {x, z} to brake for
    update(dt, player) {
      for (const b of buses) {
        if (b.wait > 0) { b.wait -= dt; b.v = 0; place(b); continue; }
        const r = b.route;
        // the end of the line: wait, then go back
        const toEnd = b.dir > 0 ? r.len - b.d : b.d;
        if (toEnd < 0.5) { b.dir = -b.dir; b.wait = 14; b.lastStop = null; continue; }
        let vt = Math.min(r.limit(b.d, b.dir), Math.sqrt(2 * 1.2 * toEnd) + 0.3);
        // the next stop ahead
        for (const st of b.stops) {
          const ahead = (st.s - b.d) * b.dir;
          if (ahead < -1 || st === b.lastStop) continue;
          if (ahead < 0.6) { b.lastStop = st; b.wait = 7; b.v = 0; vt = 0; break; }
          if (ahead < 60) vt = Math.min(vt, Math.sqrt(2 * 1.2 * ahead) + 0.2);
        }
        // the bus in front, and you
        const fx = Math.sin(b.h), fz = Math.cos(b.h);
        const blockers = buses.filter(o => o !== b).map(o => [o.secs[o.secs.length - 1].x, o.secs[o.secs.length - 1].z, o.h]);
        if (player) blockers.push([player.x, player.z, null]);
        for (const [ox, oz, oh] of blockers) {
          const dx = ox - b.x, dz = oz - b.z, along = dx * fx + dz * fz, across = Math.abs(-dx * fz + dz * fx);
          if (along < 0 || along > 30 || across > 2.2) continue;
          if (oh !== null && Math.cos(oh - b.h) < 0.3) continue;
          const room = along - (oh === null ? 7.5 : 14);
          vt = Math.min(vt, room <= 0 ? 0 : Math.sqrt(2 * 2.5 * room));
        }
        b.v = vt < b.v ? Math.max(vt, b.v - 3.5 * dt) : Math.min(vt, b.v + 1.0 * dt);
        b.d += b.v * b.dir * dt;
        place(b);
      }
    },
    glow(lamp) { for (const [m, d, n] of glow) m.emissiveIntensity = d + (n - d) * lamp; },
  };
}
