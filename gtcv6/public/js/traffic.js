// Traffic: Skyss buses and cars. A street graph is made from the roads in OpenStreetMap, with
// their one-way streets and the streets closed to cars (tools/build_map.py exports them). The
// line 6 trolleybuses (Lyngbø - Birkelundstoppen, Bergen's one trolleybus line, called line 2
// until 2021) run the length of the overhead wires (the route keeps under them), and a few diesel
// buses run between bus stops far apart along the wide streets. Each bus goes out one way and
// back by the streets it may take, stopping at the bus stops it passes. Cars drive around
// wherever you are, choosing a way at each junction. The traffic lights are OSM's, grouped into
// junctions that let one direction go and then the other. Everything keeps to the right-hand
// lane (leaving room for the parked cars), slows for corners, stops on red, waits behind what is
// in front, and brakes for you. At night the headlights are on.
import * as THREE from '../vendor/three.module.min.js';
import { carGeometry } from './city.js';

function tex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

// ---------------------------------------------------------------------------- the street graph
// Each street segment is an edge each way; `car` and `bus` say who may drive it that way.
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
    const p = r.p, o = r.o || 0, cars = !r.nc, buses = !r.nc || !!r.bus;
    for (let i = 0; i < p.length - 2; i += 2) {
      const a = node(p[i], p[i + 1]), b = node(p[i + 2], p[i + 3]);
      if (a === b) continue;
      const L = Math.hypot(X[b] - X[a], Z[b] - Z[a]), wire = underWires((X[a] + X[b]) / 2, (Z[a] + Z[b]) / 2);
      const base = { L, w: r.w, wire, k: r.k, sv: !!r.sv, ow: !!o };
      adj[a].push({ ...base, to: b, car: cars && o !== -1, bus: buses && (o !== -1 || !!r.ob) });
      adj[b].push({ ...base, to: a, car: cars && o !== 1, bus: buses && (o !== 1 || !!r.ob) });
    }
  }
  return { X, Z, adj, underWires, ids, key };
}
// the cheapest way from s to t; cost(e) is Infinity where it may not go. Each point is
// [x, z, width, one-way, node] of the street it was reached by.
function dijkstra(G, s, t, cost) {
  const n = G.X.length, d = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), pe = new Array(n), done = new Uint8Array(n);
  const heap = [[0, s]]; d[s] = 0;
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  while (heap.length) {
    const [, i] = pop();
    if (done[i]) continue; done[i] = 1;
    if (i === t) break;
    for (const e of G.adj[i]) { const c = cost(e); if (!isFinite(c)) continue; const nd = d[i] + c; if (nd < d[e.to]) { d[e.to] = nd; prev[e.to] = i; pe[e.to] = e; push(nd, e.to); } }
  }
  if (!isFinite(d[t])) return null;
  const pts = [];
  for (let i = t; i >= 0; i = prev[i]) pts.push([G.X[i], G.Z[i], pe[i] ? pe[i].w : 0, pe[i] ? pe[i].ow : false, i]);
  pts.reverse();
  if (pts.length > 1) { pts[0][2] = pts[1][2]; pts[0][3] = pts[1][3]; }
  return pts;
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

// How far right of the middle of a street of width w to drive, for a vehicle of half-width hw:
// on streets up to 9 m wide there are cars parked along the right-hand kerb (city.js), so keep
// clear of them; on a narrow one-way street that means a little left of the middle
function laneFor(w, hw, oneway) {
  if (w > 9) return Math.min(1.8, w / 4);
  const clear = w / 2 - 2.1 - hw - 0.1;
  return oneway ? Math.max(-(w / 2 - hw - 0.2), Math.min(0, clear)) : Math.max(0, Math.min(w / 4, clear));
}

// A route round a loop of points: its lengths, the street at each point, and the speed it may
// take the corners at
function makeRoute(pts) {
  const q = [pts[0]];
  for (const p of pts) if (Math.hypot(p[0] - q[q.length - 1][0], p[1] - q[q.length - 1][1]) > 1) q.push(p);
  const s = [0];
  for (let i = 1; i < q.length; i++) s.push(s[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]));
  const len = s[s.length - 1];
  const vmax = q.map((p, i) => {
    if (i === 0 || i === q.length - 1) return 3;
    const ax = p[0] - q[i - 1][0], az = p[1] - q[i - 1][1], bx = q[i + 1][0] - p[0], bz = q[i + 1][1] - p[1];
    const a = Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz) || 1))));
    return Math.max(2.5, 10 - a * 11);
  });
  let seg = 0;
  const at = (d, o) => {
    d = ((d % len) + len) % len;
    if (s[seg] > d || s[seg + 1] < d) { let lo = 0, hi = q.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m] <= d) lo = m; else hi = m - 1; } seg = lo; }
    const i = seg, L = s[i + 1] - s[i] || 1, t = (d - s[i]) / L;
    o.x = q[i][0] + (q[i + 1][0] - q[i][0]) * t; o.z = q[i][1] + (q[i + 1][1] - q[i][1]) * t;
    o.dx = (q[i + 1][0] - q[i][0]) / L; o.dz = (q[i + 1][1] - q[i][1]) / L; o.w = q[i + 1][2] || q[i][2] || 7; o.ow = q[i + 1][3];
    return o;
  };
  // the speed limit ahead of d (looking a braking distance ahead)
  const limit = (d) => {
    let v = 10;
    for (let i = 1; i < q.length - 1; i++) { let ahead = s[i] - d; if (ahead < 0) ahead += len; if (ahead > 40) continue; v = Math.min(v, Math.sqrt(vmax[i] ** 2 + 2 * 1.2 * ahead)); }
    return v;
  };
  return { q, s, len, at, limit };
}

// ---------------------------------------------------------------------------- the traffic
export function buildTraffic(scene, map, { terrain, polys, cars: NC = 36 }) {
  const ground = (x, z) => terrain.height(x, z);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const G = streetGraph(map), main = biggestPart(G);
  const [AX0, AZ0, AX1, AZ1] = map.area || [-1e9, -1e9, 1e9, 1e9];
  const inside = (x, z, m = 0) => x > AX0 + m && x < AX1 - m && z > AZ0 + m && z < AZ1 - m;
  const nearestNode = (x, z, maxD = 40) => { let b = -1, bd = maxD; for (let i = 0; i < G.X.length; i++) { if (!G.adj[i].length || !main(i)) continue; const d = Math.hypot(G.X[i] - x, G.Z[i] - z); if (d < bd) { bd = d; b = i; } } return b; };

  // ------------------------------------------------ traffic lights
  // OSM's signal nodes, grouped into junctions (within 30 m of each other). Each approach into
  // a junction is in one of two groups, by its direction; the groups take turns: 20 s green,
  // 3 s amber, 2 s all red. A lone pair on a straight street (a pedestrian crossing) stops the
  // traffic while the other group, the people crossing, has its turn.
  const junctions = [], controls = new Map();
  {
    const pts = [];
    for (const [x, z] of map.signals || []) { const i = G.ids.get(G.key(x, z)); if (i !== undefined && G.adj[i].some(e => e.car || e.bus)) pts.push(i); }
    for (const i of pts) {
      let J = junctions.find(j => Math.hypot(j.cx - G.X[i], j.cz - G.Z[i]) < 30);
      if (!J) { J = { nodes: [], cx: 0, cz: 0, appr: [] }; junctions.push(J); }
      J.nodes.push(i);
      J.cx = J.nodes.reduce((a, k) => a + G.X[k], 0) / J.nodes.length; J.cz = J.nodes.reduce((a, k) => a + G.Z[k], 0) / J.nodes.length;
    }
    const R = rnd(23);
    for (const J of junctions) {
      const set = new Set(J.nodes);
      for (const p of J.nodes) {
        const atC = Math.hypot(G.X[p] - J.cx, G.Z[p] - J.cz) < 5;
        for (const out of G.adj[p]) {
          const u = out.to, inc = G.adj[u].find(f => f.to === p);
          if (!inc || !(inc.car || inc.bus) || set.has(u)) continue;
          const dx = (G.X[p] - G.X[u]) / inc.L, dz = (G.Z[p] - G.Z[u]) / inc.L;
          // only the way into the junction
          if (!atC && dx * (J.cx - G.X[p]) + dz * (J.cz - G.Z[p]) < 0) continue;
          J.appr.push({ from: u, to: p, dx, dz, w: inc.w, atC, stop: atC ? Math.min(7, inc.L * 0.7) : 1.5, J });
        }
      }
      if (!J.appr.length) continue;
      const ax = J.appr[0].dx, az = J.appr[0].dz;
      for (const a of J.appr) { a.group = Math.abs(a.dx * ax + a.dz * az) > 0.7 ? 0 : 1; controls.set(a.from + ',' + a.to, a); }
      J.offset = R() * 50;
    }
  }
  let clockT = 0;
  // 'g', 'a' or 'r' for a group at a junction
  const lightOf = (J, group) => {
    const ph = (clockT + J.offset) % 50;
    if (group === 0) return ph < 20 ? 'g' : ph < 23 ? 'a' : 'r';
    return ph >= 25 && ph < 45 ? 'g' : ph >= 45 && ph < 48 ? 'a' : 'r';
  };
  // the poles and lamp heads, one for each way into a junction, on the right-hand kerb and facing
  // the traffic coming; the lit lamps are instances shown or hidden as the lights change
  const lamps = [];
  {
    const appr = junctions.flatMap(J => J.appr);
    const n = Math.max(1, appr.length);
    const poleM = std({ color: 0x3a3e42, metalness: 0.4, roughness: 0.5 }), headM = std({ color: 0x17191b, roughness: 0.5 });
    const poleG = new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6); poleG.translate(0, 1.8, 0);
    const headG = new THREE.BoxGeometry(0.34, 1.05, 0.26); headG.translate(0, 3.05, 0);
    const poles = new THREE.InstancedMesh(poleG, poleM, n), heads = new THREE.InstancedMesh(headG, headM, n);
    const disc = new THREE.CircleGeometry(0.11, 12);
    const lit = ['#ff2a1a', '#ffb000', '#2bff7a'].map(c => { const m = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2), toneMapped: false }), n); m.frustumCulled = false; scene.add(m); return m; });
    const m4 = new THREE.Matrix4();
    appr.forEach((a, k) => {
      const back = a.atC ? a.stop + 1 : 1, rx = -a.dz, rz = a.dx, side = a.w / 2 + 0.6;
      const x = G.X[a.to] - a.dx * back + rx * side, z = G.Z[a.to] - a.dz * back + rz * side, y = ground(x, z), face = Math.atan2(-a.dx, -a.dz);
      m4.makeRotationY(face).setPosition(x, y, z); poles.setMatrixAt(k, m4); heads.setMatrixAt(k, m4);
      polys && polys.add(Float32Array.from([x - 0.1, z - 0.1, x + 0.1, z - 0.1, x + 0.1, z + 0.1, x - 0.1, z + 0.1]), y - 1, y + 3.6, { tree: true, noCam: true });
      const mats = [3.38, 3.05, 2.72].map(h => new THREE.Matrix4().makeRotationY(face).setPosition(x - a.dx * 0.135, y + h, z - a.dz * 0.135));
      lamps.push({ a, k, mats, state: null });
      for (const m of lit) m.setMatrixAt(k, new THREE.Matrix4().makeScale(0, 0, 0));
    });
    poles.castShadow = heads.castShadow = true;
    scene.add(poles, heads);
    lamps.lit = lit;
  }
  const hideM = new THREE.Matrix4().makeScale(0, 0, 0);
  const updateLights = () => {
    let changed = false;
    for (const L of lamps) {
      const st = lightOf(L.a.J, L.a.group);
      if (st === L.state) continue;
      L.state = st; changed = true;
      const on = st === 'r' ? 0 : st === 'a' ? 1 : 2;
      for (let c = 0; c < 3; c++) lamps.lit[c].setMatrixAt(L.k, c === on ? L.mats[c] : hideM);
    }
    if (changed) for (const m of lamps.lit) m.instanceMatrix.needsUpdate = true;
  };
  updateLights();
  // the speed allowed for something whose front is `left` metres short of a controlled node
  const forLight = (ctrl, left, v, vt) => {
    if (!ctrl) return vt;
    const st = lightOf(ctrl.J, ctrl.group);
    if (st === 'g') return vt;
    const gap = left - ctrl.stop;
    if (gap < -0.5) return vt;                                 // already over the line
    if (st === 'a' && gap < v * v / (2 * 4)) return vt;       // too close to stop for amber
    return Math.min(vt, gap <= 0 ? 0 : Math.sqrt(2 * 3 * gap));
  };

  // ------------------------------------------------ headlights
  // the lamps lit (white at the front, red at the back) and a pool of light on the street ahead,
  // for the cars and the buses; both only show when the street lamps are on
  const poolT = tex(64, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,240,210,0.0)'); gr.addColorStop(0.08, 'rgba(255,240,210,0.9)'); gr.addColorStop(0.5, 'rgba(255,235,200,0.35)'); gr.addColorStop(1, 'rgba(255,235,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const sx = g.createLinearGradient(0, 0, w, 0); sx.addColorStop(0, 'rgba(0,0,0,0)'); sx.addColorStop(0.3, 'rgba(0,0,0,1)'); sx.addColorStop(0.7, 'rgba(0,0,0,1)'); sx.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sx; g.fillRect(0, 0, w, h);
  });
  const poolM = new THREE.MeshBasicMaterial({ map: poolT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const poolG = (wd, len) => { const g = new THREE.PlaneGeometry(wd, len); g.rotateX(-Math.PI / 2); g.translate(0, 0.1, -len / 2); return g; };

  // ------------------------------------------------ buses
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
    g.fillStyle = '#ffd200'; g.font = '700 24px Archivo, sans-serif'; g.textAlign = 'center';
    let size = 24; while (g.measureText(`${line}  ${dest}`).width > w - 40 && size > 12) { size--; g.font = `700 ${size}px Archivo, sans-serif`; }
    g.fillText(`${line}  ${dest}`, w / 2, 40);
    g.fillStyle = '#fff3d8'; for (const x of [40, w - 40]) { g.beginPath(); g.arc(x, 200, 11, 0, 7); g.fill(); }
    g.fillStyle = '#ffffff'; g.font = '700 20px Archivo, sans-serif'; g.fillText('skyss', w / 2, 230);
  });
  const rearT = tex(128, 128, (g, w, h) => { g.fillStyle = hex; g.fillRect(0, 0, w, h); g.fillStyle = '#121518'; g.fillRect(10, 8, w - 20, 50); g.fillStyle = '#ff2a1a'; for (const x of [16, w - 16]) g.fillRect(x - 6, 80, 12, 22); g.fillStyle = '#eeeff0'; g.fillRect(0, 108, w, 20); });
  const sideM = std({ map: sideT }), rearM = std({ map: rearT, emissive: 0xffffff, emissiveMap: rearT, emissiveIntensity: 0.05 }), orangeM = std({ color: 0xe4532a }), darkM = std({ color: 0x1b1e21 });
  const glow = [[rearM, 0.05, 0.5]];
  const W = 2.55;
  // a section: a box with the livery, its front (or rear) at the ends; the front is +z
  const section = (len, frontM, back) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, 2.85, len), [sideM, sideM, orangeM, darkM, frontM || darkM, back ? rearM : darkM]);
    body.position.y = 0.35 + 1.42; body.castShadow = true; g.add(body); g.userData.body = body;
    for (const z of [len / 2 - 2.2, -len / 2 + 2.6]) for (const x of [-1, 1]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), darkM); wh.rotation.z = Math.PI / 2; wh.position.set(x * (W / 2 - 0.12), 0.5, z); g.add(wh);
    }
    if (frontM) { const pool = new THREE.Mesh(poolG(4, 13), poolM); pool.rotation.y = Math.PI; pool.position.z = len / 2; g.add(pool); }
    g.rotation.order = 'YXZ';
    scene.add(g);
    return g;
  };
  const buses = [];
  // a bus on a loop: out from A to B by `out`, back to A by `back`
  const add = (out, back, opts) => {
    if (!out || !back) return;
    const route = makeRoute([...out, ...back.slice(1)]);
    if (route.len < 300) return;
    route.mid = route.s[route.q.findIndex(p => p[4] === out[out.length - 1][4])] || route.len / 2;
    // the traffic lights on the way: where the route goes from one node to the next through one
    route.ctrl = [];
    { const all = [...out, ...back.slice(1)]; let d = 0; for (let i = 1; i < all.length; i++) { d += Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1]); const c = controls.get(all[i - 1][4] + ',' + all[i][4]); if (c) route.ctrl.push({ s: d, c }); } }
    // the destination on the front: B on the way out, A on the way back
    const fronts = opts.dests.map(d => { const m = std({ map: frontT(opts.line, d), emissive: 0xffffff, emissiveIntensity: 0.1 }); m.emissiveMap = m.map; glow.push([m, 0.1, 0.8]); return m; });
    const d0 = opts.start * route.len, fm = fronts[d0 < route.mid ? 0 : 1];
    const secs = opts.artic
      ? [{ g: section(11, fm, false), len: 11, off: 0 }, { g: section(7, null, true), len: 7, off: -9.9 }]
      : [{ g: section(12, fm, true), len: 12, off: 0 }];
    if (opts.artic) { const j = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.7, 1.2), darkM); scene.add(j); secs.joint = j; }
    if (opts.trolley) {
      const poles = new THREE.Group();
      for (const w of [-0.3, 0.3]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6.4, 5), darkM); pole.position.set(w, 3.2 + 1.3, -2.1); pole.rotation.x = -1.15; poles.add(pole); }
      secs[0].g.add(poles);
    }
    // the stops along the way, on the way out and on the way back: where a stop is within 14 m
    const stops = [], tmp = {};
    for (const st of map.stops || []) for (const [lo, hi] of [[0, route.mid], [route.mid, route.len]]) {
      let bd = 14, bs = -1;
      for (let i = 0; i < route.q.length - 1; i++) {
        if (route.s[i + 1] < lo || route.s[i] > hi) continue;
        const [ax, az] = route.q[i], [bx, bz] = route.q[i + 1], L2 = (bx - ax) ** 2 + (bz - az) ** 2;
        const t = L2 ? Math.max(0, Math.min(1, ((st.x - ax) * (bx - ax) + (st.z - az) * (bz - az)) / L2)) : 0, d = Math.hypot(ax + (bx - ax) * t - st.x, az + (bz - az) * t - st.z);
        if (d < bd) { bd = d; bs = route.s[i] + t * Math.sqrt(L2); }
      }
      if (bs > lo + 20 && bs < hi - 20 && !stops.some(s => Math.abs(s.s - bs) < 40)) stops.push({ s: bs, n: st.n });
    }
    stops.sort((a, b) => a.s - b.s);
    buses.push({ route, secs, stops, fronts, d: d0, v: 0, wait: 2, lastStop: null, opts, x: 0, z: 0, h: 0, tmp, len: 12, W, on: true });
  };
  const busCost = (wide) => (e) => !e.bus ? Infinity : e.L * wide(e) * (e.sv ? 6 : 1) * (inside(G.X[e.to], G.Z[e.to]) ? 1 : 50);
  // line 6: from one end of the wires to the other and back, keeping under them
  {
    const cand = [];
    for (const r of map.trolley || []) for (let i = 0; i < r.p.length; i += 8) if (inside(r.p[i], r.p[i + 1], 40)) cand.push([r.p[i], r.p[i + 1]]);
    const nodes = cand.map(c => nearestNode(c[0], c[1], 15)).filter(i => i >= 0);
    let A = null, B = null, bd = 0;
    for (const a of nodes) for (const c of nodes) { const d = Math.hypot(G.X[a] - G.X[c], G.Z[a] - G.Z[c]); if (d > bd) { bd = d; A = a; B = c; } }
    if (A !== null) {
      const cost = busCost((e) => (e.wire ? 0.25 : e.w < 6 ? 12 : 3));
      const out = dijkstra(G, A, B, cost), back = dijkstra(G, B, A, cost);
      // west to Lyngbø on Laksevåg, south-east to Birkelundstoppen
      const dests = G.X[B] < G.X[A] ? ['Lyngbø', 'Birkelundstoppen'] : ['Birkelundstoppen', 'Lyngbø'];
      add(out, back, { line: 6, dests, artic: true, trolley: true, start: 0.15 });
      add(out, back, { line: 6, dests, artic: true, trolley: true, start: 0.65 });
    }
  }
  // diesel buses between stops far apart, along the wide streets
  {
    const R = rnd(11), stops = (map.stops || []).filter(s => (s.n || '').length > 3).map(s => [s, nearestNode(s.x, s.z, 20)]).filter(([, i]) => i >= 0);
    const plain = (n) => n.replace(/\s*\([A-Z0-9]{1,2}\)$/, '').replace(/\s+[A-Z]$/, '');     // no platform letters
    const LINES = [3, 4, 5, 12];            // not 1 and 2 (Bybanen) or 6 (the trolleybus)
    const cost = busCost((e) => (e.w >= 8 ? 1 : e.w >= 6.5 ? 1.8 : e.w >= 5 ? 4 : 20));
    let tries = 0;
    for (const line of LINES) {
      while (tries++ < 80) {
        const [a, ia] = stops[Math.floor(R() * stops.length)], [c, ic] = stops[Math.floor(R() * stops.length)];
        const d = Math.hypot(a.x - c.x, a.z - c.z);
        if (d < 700 || d > 1800 || plain(a.n) === plain(c.n)) continue;
        const out = dijkstra(G, ia, ic, cost), back = out && dijkstra(G, ic, ia, cost);
        if (!out || !back) continue;
        const L = (p) => p.reduce((s, q, i) => s + (i ? Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
        if (L(out) > d * 1.8 || L(back) > d * 2.2) continue;             // not a long way round
        add(out, back, { line, dests: [plain(c.n), plain(a.n)], artic: false, trolley: false, start: R() });
        break;
      }
    }
  }
  const place = (b) => {
    const r = b.route, t = b.tmp;
    for (const sec of b.secs) {
      r.at(b.d + sec.off, t);
      const fx = t.dx, fz = t.dz, lane = laneFor(t.w, W / 2, t.ow);
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

  // ------------------------------------------------ cars
  const carNodes = [];
  for (let i = 0; i < G.X.length; i++) if (main(i) && inside(G.X[i], G.Z[i], 30) && G.adj[i].some(e => e.car && !e.sv)) carNodes.push(i);
  const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 });
  const carMesh = new THREE.InstancedMesh(carGeometry(), carMat, Math.max(1, NC));
  // the lamps, lit: a pair at each end, on top of the car's own lamp strips
  const lampG = (() => {
    const pos = [], col = [];
    for (const [z, c] of [[-2.19, [1, 0.96, 0.85]], [2.18, [1, 0.08, 0.04]]]) for (const x of [-0.58, 0.58]) {
      const g = new THREE.BoxGeometry(0.34, 0.13, 0.03).toNonIndexed(); g.translate(x, 0.74, z);
      pos.push(...g.attributes.position.array); for (let k = 0; k < g.attributes.position.count; k++) col.push(...c);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
  })();
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const carLamps = new THREE.InstancedMesh(lampG, lampMat, Math.max(1, NC)), carPools = new THREE.InstancedMesh(poolG(3.4, 11), poolM, Math.max(1, NC));
  carPools.position.z = 0;
  for (const m of [carMesh, carLamps, carPools]) { m.frustumCulled = false; scene.add(m); }
  carMesh.castShadow = true; carMesh.receiveShadow = true;
  const COLS = [0xe8e8e8, 0x1d1f22, 0x8c9196, 0x2c4c7a, 0x7a2e28, 0xc9c9c4, 0x3f5d48, 0x30343a, 0xd8d4c8, 0x9a2a22];
  const Rc = rnd(5), colr = new THREE.Color();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  const setM = (i, m) => { carMesh.setMatrixAt(i, m); carLamps.setMatrixAt(i, m); carPools.setMatrixAt(i, m); };
  for (let i = 0; i < NC; i++) setM(i, hide);
  // the way on at a junction: one the car may take, not back the way it came, not off the map;
  // wide streets and going straight on are likelier, service roads and car parks unlikely
  const pickNext = (from, at) => {
    const dx0 = G.X[at] - G.X[from], dz0 = G.Z[at] - G.Z[from], l0 = Math.hypot(dx0, dz0) || 1;
    const opts = G.adj[at].filter(e => e.car && e.to !== from && inside(G.X[e.to], G.Z[e.to], 20));
    if (!opts.length) return G.adj[at].find(e => e.to === from) || null;          // a dead end: turn round
    let tot = 0;
    const wts = opts.map(e => { const c = ((G.X[e.to] - G.X[at]) * dx0 + (G.Z[e.to] - G.Z[at]) * dz0) / (e.L * l0); const wgt = e.w * (0.4 + Math.max(0, c) * 2) * (e.sv ? 0.12 : 1); tot += wgt; return wgt; });
    let r = Rc() * tot;
    for (let i = 0; i < opts.length; i++) { r -= wts[i]; if (r <= 0) return opts[i]; }
    return opts[opts.length - 1];
  };
  const cars = [];
  for (let i = 0; i < NC; i++) cars.push({ i, a: -1, e: null, next: null, t: 0, v: 0, x: 1e9, z: 1e9, h: 0, ox: 0, oz: 0, stuck: 0, ghost: 0, len: 4.3, W: 1.8, on: false });
  const spawn = (c, cx, cz, near) => {
    for (let k = 0; k < 40; k++) {
      const a = carNodes[Math.floor(Rc() * carNodes.length)], d = Math.hypot(G.X[a] - cx, G.Z[a] - cz);
      if (d < (near ? 0 : 90) || d > 260) continue;
      const es = G.adj[a].filter(e => e.car && !e.sv); if (!es.length) continue;
      const e = es[Math.floor(Rc() * es.length)];
      if (cars.some(o => o.on && Math.hypot(o.x - G.X[a], o.z - G.Z[a]) < 12)) continue;     // not on top of another car
      Object.assign(c, { a, e, t: 0, v: 5, next: pickNext(a, e.to), stuck: 0, ghost: 0, on: true });
      const dx = (G.X[e.to] - G.X[a]) / e.L, dz = (G.Z[e.to] - G.Z[a]) / e.L, lane = laneFor(e.w, c.W / 2, e.ow);
      c.h = Math.atan2(dx, dz); c.ox = -dz * lane; c.oz = dx * lane; c.x = G.X[a] + c.ox; c.z = G.Z[a] + c.oz;
      carMesh.setColorAt(c.i, colr.set(COLS[Math.floor(Rc() * COLS.length)]));
      if (carMesh.instanceColor) carMesh.instanceColor.needsUpdate = true;
      return true;
    }
    c.on = false; return false;
  };
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(0, 0, 0, 'YXZ'), p4 = new THREE.Vector3(), s4 = new THREE.Vector3(1, 1, 1);
  const placeCar = (c, dt) => {
    const e = c.e, ax = G.X[c.a], az = G.Z[c.a], dx = (G.X[e.to] - ax) / e.L, dz = (G.Z[e.to] - az) / e.L;
    const lane = laneFor(e.w, c.W / 2, e.ow), k = Math.min(1, dt * 5);
    // the lane offset and the heading follow the street smoothly round the corners
    c.ox += (-dz * lane - c.ox) * k; c.oz += (dx * lane - c.oz) * k;
    let dh = Math.atan2(dx, dz) - c.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.h += dh * Math.min(1, dt * 7);
    c.x = ax + dx * c.t + c.ox; c.z = az + dz * c.t + c.oz;
    const fx = Math.sin(c.h), fz = Math.cos(c.h), yf = ground(c.x + fx * 1.6, c.z + fz * 1.6), yb = ground(c.x - fx * 1.6, c.z - fz * 1.6);
    e4.set(Math.atan2(yf - yb, 3.2), c.h + Math.PI, 0);              // the bonnet is at the model's -z
    m4.compose(p4.set(c.x, (yf + yb) / 2, c.z), q4.setFromEuler(e4), s4);
    setM(c.i, m4);
  };
  // what is in the way of something at (x, z) heading (fx, fz): returns the speed it may go
  const room = (self, x, z, fx, fz, hl, hw, others, player, vt) => {
    for (const o of others) {
      if (o === self || !o.on) continue;
      const dx = o.x - x, dz = o.z - z;
      if (Math.abs(dx) > 40 || Math.abs(dz) > 40) continue;
      const along = dx * fx + dz * fz, across = Math.abs(-dx * fz + dz * fx), c = Math.cos(o.h - Math.atan2(fx, fz));
      if (along <= 0 || along > 30) continue;
      if (c > 0.3) { if (across > hw + 1.0) continue; }                       // the one in front, going the same way
      else if (c > -0.5) { if (along > 10 || across > hw + 0.8) continue; }   // crossing right in front
      else continue;                                                          // oncoming: it passes
      const gap = along - hl - o.len / 2 - 1.5;
      vt = Math.min(vt, gap <= 0 ? 0 : Math.sqrt(2 * 3 * gap));
    }
    if (player) {
      const dx = player.x - x, dz = player.z - z, along = dx * fx + dz * fz, across = Math.abs(-dx * fz + dz * fx);
      if (along > 0 && along < 25 && across < hw + 1.2) { const gap = along - hl - 2.5; vt = Math.min(vt, gap <= 0 ? 0 : Math.sqrt(2 * 3.5 * gap)); }
    }
    return vt;
  };
  // the bus sections and cars, as things that are in the way and that you can be hit by
  const bodies = () => {
    const out = [];
    for (const b of buses) for (const sec of b.secs) out.push({ x: sec.x, z: sec.z, h: sec.h, len: sec.len, W, v: b.v, on: true, bus: b });
    for (const c of cars) if (c.on) out.push(c);
    return out;
  };

  return {
    buses, cars, junctions, count: buses.length, W, bodies, lightOf,
    // player: {x, z} to brake for, or null; centre: where the cars are kept around
    update(dt, player, centre) {
      clockT += dt;
      updateLights();
      const all = bodies();
      for (const b of buses) {
        if (b.wait > 0) { b.wait -= dt; b.v = 0; place(b); continue; }
        const r = b.route, hl = b.secs[0].len / 2;
        // the ends of the line: wait, then set off the other way with the other destination up
        const end = b.d < r.mid - 0.01 ? r.mid : r.len, toEnd = end - b.d;
        if (toEnd < 0.5) {
          b.wait = 14; b.lastStop = null;
          if (end === r.len) b.d -= r.len;
          b.secs[0].g.userData.body.material[4] = b.fronts[b.d < r.mid - 0.01 ? 0 : 1];
          continue;
        }
        let vt = Math.min(r.limit(b.d), Math.sqrt(2 * 1.2 * toEnd) + 0.3);
        for (const st of b.stops) {
          const ahead = st.s - b.d;
          if (ahead < -1 || st === b.lastStop) continue;
          if (ahead < 0.6) { b.lastStop = st; b.wait = 7; b.v = 0; vt = 0; break; }
          if (ahead < 60) vt = Math.min(vt, Math.sqrt(2 * 1.2 * ahead) + 0.2);
        }
        for (const c of r.ctrl) { const ahead = c.s - b.d - hl; if (ahead > -2 && ahead < 70) vt = forLight(c.c, ahead, b.v, vt); }
        vt = room(null, b.x, b.z, Math.sin(b.h), Math.cos(b.h), hl, W / 2, all.filter(o => o.bus !== b), player, vt);
        b.v = vt < b.v ? Math.max(vt, b.v - 3.5 * dt) : Math.min(vt, b.v + 1.0 * dt);
        b.d += b.v * dt;
        place(b);
      }
      for (const c of cars) {
        if (centre && (!c.on || Math.hypot(c.x - centre.x, c.z - centre.z) > 330)) { if (!spawn(c, centre.x, centre.z, !c.e)) { setM(c.i, hide); continue; } }
        if (!c.on) continue;
        const e = c.e, left = e.L - c.t, hl = c.len / 2;
        const lim = e.w >= 8 ? 11 : e.w >= 5.5 ? 8.5 : 6;
        // slow for the corner at the end of this stretch
        let vturn = lim;
        if (c.next) {
          const ex = (G.X[e.to] - G.X[c.a]) / e.L, ez = (G.Z[e.to] - G.Z[c.a]) / e.L, nx = (G.X[c.next.to] - G.X[e.to]) / c.next.L, nz = (G.Z[c.next.to] - G.Z[e.to]) / c.next.L;
          vturn = Math.max(c.next.to === c.a ? 1.5 : 2.5, lim - Math.acos(Math.max(-1, Math.min(1, ex * nx + ez * nz))) * 7);
        }
        let vt = Math.min(lim, Math.sqrt(vturn * vturn + 2 * 1.8 * left));
        // the lights at the end of this stretch, or of the next
        vt = forLight(controls.get(c.a + ',' + e.to), left - hl, c.v, vt);
        if (c.next) vt = forLight(controls.get(e.to + ',' + c.next.to), left + c.next.L - hl, c.v, vt);
        if (c.ghost > 0) c.ghost -= dt;
        else vt = room(c, c.x, c.z, Math.sin(c.h), Math.cos(c.h), hl, c.W / 2, all, player, vt);
        // stuck nose to nose at a junction for a while (not at a red light): squeeze past
        c.stuck = c.v < 0.2 && vt < 0.2 ? c.stuck + dt : 0;
        if (c.stuck > 6 && !(player && Math.hypot(player.x - c.x, player.z - c.z) < 8)) {
          const red = [controls.get(c.a + ',' + e.to), c.next && controls.get(e.to + ',' + c.next.to)].some(k => k && lightOf(k.J, k.group) !== 'g');
          if (!red) { c.ghost = 3; c.stuck = 0; }
        }
        c.v = vt < c.v ? Math.max(vt, c.v - 5 * dt) : Math.min(vt, c.v + 2.2 * dt);
        c.t += c.v * dt;
        while (c.e && c.t >= c.e.L) {
          c.t -= c.e.L;
          const from = c.a; c.a = c.e.to; c.e = c.next || pickNext(from, c.a);
          if (!c.e) { c.on = false; break; }
          c.next = pickNext(c.a, c.e.to);
        }
        if (!c.on) { setM(c.i, hide); continue; }
        placeCar(c, dt);
      }
      carMesh.instanceMatrix.needsUpdate = carLamps.instanceMatrix.needsUpdate = carPools.instanceMatrix.needsUpdate = true;
    },
    glow(lamp) {
      for (const [m, d, n] of glow) m.emissiveIntensity = d + (n - d) * lamp;
      lampMat.color.setScalar(0.35 + 1.4 * lamp);
      poolM.opacity = 0.95 * lamp;
      carPools.visible = lamp > 0.03;
    },
  };
}
