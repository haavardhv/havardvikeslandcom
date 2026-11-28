#!/usr/bin/env python3
"""Build the game map from OpenStreetMap and Kartverket elevation data.

Inputs (in a work directory, see fetch_data.py):
  t_*.json      OSM API /map.json tiles covering the area
  fine.json     terrain heights on a 2.5 m grid around the house (Kartverket DTM1)
  coarse.json   terrain heights on a 60 m grid for the surrounding mountains

Outputs (gtcv6/public/data):
  map.json      buildings, roads, areas, trees, the funicular, a walking graph
  terrain.bin   Int16 heights in centimetres, fine grid (streets levelled, see below)
  coarse.bin    Int16 heights in decimetres, coarse grid
  ground.bin    ground class per fine grid node

The world is cleaned up here, so the game can trust it:
  - Buildings: multipolygon relations are assembled into proper rings (courtyards included),
    then every footprint is resolved against the others, smallest first, so no two buildings
    ever overlap: duplicates (a relation and the ways it is made of, a block outline drawn over
    its houses) disappear and sloppy overlaps become clean party walls. Bridge buildings
    (building:min_level) are lifted off the ground, roofs on posts (building=roof) become
    canopies, and nothing is kept outside the detailed terrain.
  - Roofs: the shape is chosen here (from roof:shape, or from the kind, style and footprint),
    together with the ridge direction: across the party walls for terraced rows, along the
    long side otherwise. The game builds the roof as a height field over the footprint, so a
    roof can never stick out past its walls.
  - Streets: the terrain is levelled across every street and lane (and blended back into the
    hillside beside it), so the street surface never has the slope poking through it.

Coordinates: metres, origin at Cappes vei 6, +x east, +z south.
Map data © OpenStreetMap contributors (ODbL). Elevation © Kartverket (CC BY 4.0).
"""
import json, math, glob, sys, os, struct, hashlib, random
from shapely.geometry import Polygon, MultiPolygon, Point, LineString, box
from shapely.geometry.polygon import orient
from shapely.ops import linemerge, polygonize, unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree
from shapely.validation import make_valid

WORK = sys.argv[1]
OUT = sys.argv[2]

LAT0, LON0 = 60.3931275, 5.3333919          # Cappes vei 6 (OSM address node 3126074741)
MLAT = 111230.0
MLON = 111320.0 * math.cos(math.radians(LAT0))
X0, X1, Z0, Z1 = -1790.0, 1050.0, -1340.0, 1590.0  # playable area: Nordnes, Bergenhus and Skuteviken to Fløyen, the university and Store Lungegårdsvann

def P(n): return ((n['lon'] - LON0) * MLON, -(n['lat'] - LAT0) * MLAT)

nodes, ways, rels = {}, {}, {}
for f in glob.glob(os.path.join(WORK, 't_*.json')):
    for e in json.load(open(f))['elements']:
        {'node': nodes, 'way': ways, 'relation': rels}[e['type']][e['id']] = e
def coords(w): return [P(nodes[i]) for i in w['nodes'] if i in nodes]

# ------------------------------------------------------------------ terrain
fine = json.load(open(os.path.join(WORK, 'fine.json')))
coarse = json.load(open(os.path.join(WORK, 'coarse.json')))
FNX, FNZ, FX0, FZ0, FST = fine['nx'], fine['nz'], fine['x0'], fine['z0'], fine['step']
FH0 = [v if v is not None else -5.0 for v in fine['h']]     # the terrain as measured
FH = list(FH0)                                               # the terrain the game gets (streets levelled)
FX1, FZ1 = FX0 + (FNX - 1) * FST, FZ0 + (FNZ - 1) * FST

def sample(h, x, z):
    """Same interpolation as the game's terrain mesh (two triangles per cell)."""
    fx, fz = (x - FX0) / FST, (z - FZ0) / FST
    i0 = max(0, min(FNX - 2, int(math.floor(fx)))); j0 = max(0, min(FNZ - 2, int(math.floor(fz))))
    tx, tz = max(0.0, min(1.0, fx - i0)), max(0.0, min(1.0, fz - j0))
    a, b = h[j0 * FNX + i0], h[j0 * FNX + i0 + 1]
    c, d = h[(j0 + 1) * FNX + i0], h[(j0 + 1) * FNX + i0 + 1]
    if tx + tz <= 1: return a + (b - a) * tx + (c - a) * tz
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz)
def ground0(x, z): return sample(FH0, x, z)
def ground(x, z): return sample(FH, x, z)

# ------------------------------------------------------------------ house 6 frame
H6_ID = 579309500
hp = coords(ways[H6_ID])
# the outline is a near-rectangle: east corner, north corner (street side), west corner (back)
E_ = next(p for p in hp if p[0] > 5); N_ = min(hp, key=lambda p: p[1]); W_ = min(hp, key=lambda p: p[0])
ux, uz = E_[0] - N_[0], E_[1] - N_[1]
l = math.hypot(ux, uz); ux, uz = ux / l, uz / l
vx, vz = -uz, ux                     # into the house, away from the street
WIDE, DEEP = 8.0, 8.4
EXTRA_NW = WIDE - l                  # widen towards no. 8
ox, oz = N_[0] - ux * EXTRA_NW, N_[1] - uz * EXTRA_NW
def L2W(u, v): return (ox + ux * u + vx * v, oz + uz * u + vz * v)
FU = 25.6                            # upper (entrance) floor, level with Cappes vei
FL = FU - 2.75                       # lower floor, out to the terrace
theta = math.atan2(-uz, ux)          # three.js rotation.y for the local frame
house6 = {'origin': [round(ox, 3), round(oz, 3)], 'theta': round(theta, 5), 'u': [ux, uz], 'v': [vx, vz],
          'W': WIDE, 'D': DEEP, 'FU': FU, 'FL': FL}
# area reserved for the house, the side passage and the back terrace (local u,v)
reserved = Polygon([L2W(-1.3, -0.25), L2W(WIDE + 0.05, -0.25), L2W(WIDE + 0.05, DEEP + 3.9), L2W(-1.3, DEEP + 3.9)])
reserved_p = prep(reserved.buffer(0.5))
print('house6 frame', house6, 'osm width', round(l, 2))

# ------------------------------------------------------------------ helpers
in_area = lambda c: any(X0 - 40 < x < X1 + 40 and Z0 - 40 < z < Z1 + 40 for x, z in c)
def r1(v): return round(v, 1)
def r2(v): return round(v, 2)
def flat(c): return [r1(a) for p in c for a in p]
def h01(s): return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16) / 0xffffffff
def polys_of(g):
    """The polygons in any geometry, as a list."""
    if g is None or g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    if hasattr(g, 'geoms'): return [p for sub in g.geoms for p in polys_of(sub)]
    return []
def num(v, default=None):
    try: return float(str(v).split(';')[0].split()[0].replace(',', '.'))
    except (ValueError, IndexError): return default

# ------------------------------------------------------------------ roads (parsed first: the terrain is levelled under them)
# Widths, surfaces and sidewalks come from OpenStreetMap where it has them: `width`, then `lanes`,
# then a typical width for the kind of street (Fjellet's lanes are narrow); `surface` decides
# between asphalt, setts, paving and gravel; `sidewalk=*` adds paved strips beside a road.
WIDTH_KEYS = {'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'pedestrian', 'footway', 'steps', 'path'}
CAR = {'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}
WIDTH = {'trunk': 10, 'primary': 9, 'secondary': 8, 'tertiary': 7, 'unclassified': 5.5, 'residential': 5, 'living_street': 4.5,
         'service': 3.5, 'pedestrian': 5, 'footway': 2.0, 'path': 1.6, 'steps': 1.8, 'cycleway': 2.5, 'track': 3, 'corridor': 2,
         'trunk_link': 6, 'primary_link': 6, 'secondary_link': 6, 'tertiary_link': 5}
SURF = {'asphalt': 'R', 'sett': 'G', 'cobblestone': 'G', 'unhewn_cobblestone': 'G', 'paving_stones': 'B', 'concrete:plates': 'B',
        'concrete': 'B', 'slate': 'B', 'stone': 'B', 'wood': 'B', 'metal': 'B', 'paved': 'R', 'ground': 'A', 'gravel': 'A',
        'fine_gravel': 'A', 'compacted': 'A', 'dirt': 'A', 'grass': 'A', 'unpaved': 'A', 'earth': 'A', 'pebblestone': 'A'}
SIDEWALK_W = 1.8
def road_width(t, hw):
    w = num(t.get('width'))
    if w: return max(1.0, min(w, 16.0))
    lanes = num(t.get('lanes'))
    if lanes and hw in CAR: return max(3.0, min(lanes * 3.1 + 0.4, 16.0))
    if hw == 'footway' and t.get('footway') == 'sidewalk': return SIDEWALK_W
    if hw == 'footway' and t.get('footway') == 'crossing': return 2.5
    if hw in ('residential', 'unclassified') and t.get('oneway') == 'yes': return 4.0
    return WIDTH[hw]
def road_surface(t, hw):
    s = SURF.get(t.get('surface', ''))
    if s: return s
    if hw in ('path', 'track'): return 'A'
    if hw in ('footway', 'pedestrian', 'cycleway', 'steps'): return 'B'
    return 'R'
def sidewalks(t):
    sw = t.get('sidewalk:both') or t.get('sidewalk') or ''
    left, right = sw in ('both', 'yes', 'left'), sw in ('both', 'yes', 'right')
    return left or t.get('sidewalk:left') == 'yes', right or t.get('sidewalk:right') == 'yes'
roads, road_geo = [], []
graph_nodes, graph_edges = {}, set()
for w in ways.values():
    t = w.get('tags', {})
    hw = t.get('highway')
    if hw not in WIDTH or t.get('tunnel') in ('yes', 'building_passage') or t.get('area') == 'yes' or t.get('indoor') == 'yes': continue
    if hw == 'corridor': continue
    ids = [i for i in w['nodes'] if i in nodes]
    c = [P(nodes[i]) for i in ids]
    if len(c) < 2 or not in_area(c): continue
    wdt = road_width(t, hw)
    surf = road_surface(t, hw)
    k = ('steps' if hw == 'steps' else 'side' if hw == 'footway' and t.get('footway') == 'sidewalk'
         else 'foot' if surf == 'A' or hw in ('path', 'track') else 'ped' if hw in ('pedestrian', 'footway', 'cycleway')
         else 'sett' if surf == 'G' else 'road')
    sl, sr = sidewalks(t) if hw in CAR else (False, False)
    r = {'p': flat(c), 'w': round(wdt, 1), 'k': k}
    if sl or sr: r['sw'] = [int(sl), int(sr)]
    if t.get('name'): r['n'] = t['name']
    bridge = t.get('bridge') not in (None, 'no')
    if bridge: r['br'] = 1
    roads.append(r)
    road_geo.append({'ids': ids, 'c': c, 'w': wdt, 'k': k, 'surf': surf, 'bridge': bridge, 'hw': hw, 'sl': sl, 'sr': sr, 'oneway': t.get('oneway') in ('yes', '-1') or t.get('junction') == 'roundabout'})
    # walking graph (everything but trunk roads without sidewalks still counts: it is a game)
    for a, b2 in zip(ids, ids[1:]):
        graph_nodes[a] = P(nodes[a]); graph_nodes[b2] = P(nodes[b2])
        graph_edges.add((min(a, b2), max(a, b2)))
print('roads', len(roads), 'with sidewalks', sum(1 for r in roads if 'sw' in r))
gids = {nid: i for i, nid in enumerate(graph_nodes)}
graph = {'n': flat(graph_nodes.values()), 'e': [x for a, b2 in graph_edges for x in (gids[a], gids[b2])]}

# ------------------------------------------------------------------ street profiles, solved over the whole network
# Every street is sampled every metre. Streets that meet share the same OSM node, so they share
# one height there. The heights are smoothed along the streets (strongly for roads, lightly for
# steps), pulled towards the measured ground: the 1 m elevation model has noise next to walls
# and cars that would otherwise become kerbs and cliffs in the middle of a street.
import numpy as np
LAMBDA = {'road': 0.03, 'sett': 0.03, 'ped': 0.06, 'side': 0.06, 'foot': 0.1, 'steps': 0.4}
var_of_node, xs, zs, lam = {}, [], [], []
edges, segs = [], []      # segs: (var a, var b, road index)
def newvar(x, z, l):
    xs.append(x); zs.append(z); lam.append(l); return len(xs) - 1
for ri, rg in enumerate(road_geo):
    l = 0.0 if rg['bridge'] else LAMBDA[rg['k']]
    prev = None
    for nid, (x, z) in zip(rg['ids'], rg['c']):
        if nid in var_of_node:
            v = var_of_node[nid]; lam[v] = max(lam[v], l)
        else:
            v = var_of_node[nid] = newvar(x, z, l)
        if prev is not None and prev != v:
            px, pz = xs[prev], zs[prev]
            n = max(1, int(math.ceil(math.hypot(x - px, z - pz) / 1.0)))
            last = prev
            for k in range(1, n):
                u = newvar(px + (x - px) * k / n, pz + (z - pz) * k / n, l)
                edges.append((last, u)); segs.append((last, u, ri)); last = u
            edges.append((last, v)); segs.append((last, v, ri))
        prev = v
NV = len(xs)
d0 = np.array([ground0(x, z) for x, z in zip(xs, zs)])
lw = np.array(lam)
lw[d0 < 0.3] = 0.0                      # over the sea the elevation model says nothing useful
E = np.array(edges, dtype=np.int64)
deg = np.bincount(E[:, 0], minlength=NV) + np.bincount(E[:, 1], minlength=NV)
hprof = d0.copy()
for _ in range(500):
    acc = np.zeros(NV)
    np.add.at(acc, E[:, 0], hprof[E[:, 1]]); np.add.at(acc, E[:, 1], hprof[E[:, 0]])
    den = deg + lw
    hprof = np.where(den > 0, (acc + lw * d0) / np.maximum(den, 1e-9), hprof)
print('street profile points', NV, 'mean change', round(float(np.mean(np.abs(hprof - d0))), 2), 'm')

# ------------------------------------------------------------------ level the terrain to the street profiles
# Grid nodes within half the street's width (sidewalks included) plus 1.5 m take the height of
# the street at the nearest point of its centre line, and the next 3 m blend back into the
# hillside. A node on a street's surface belongs to that street, and where surfaces overlap the
# bigger kind wins (a road over the steps or the footway beside it, which may be at another
# level); off the surfaces the nearest street wins. At junctions they already agree.
FULL, BLEND = 1.5, 3.0
RANK = {'road': 0, 'sett': 0, 'ped': 1, 'side': 2, 'foot': 2, 'steps': 3}
near = {}            # node -> {road: (sc, height, d)}, the closest point of each street to the node
keep_p = prep(reserved.buffer(1.0))
for va, vb, ri in segs:
    rg = road_geo[ri]
    if rg['bridge']: continue
    hw = rg['w'] / 2 + (SIDEWALK_W if (rg['sl'] or rg['sr']) else 0)
    ax, az, bx, bz = xs[va], zs[va], xs[vb], zs[vb]
    ha, hb = hprof[va], hprof[vb]
    dx, dz = bx - ax, bz - az
    L2 = dx * dx + dz * dz or 1e-9
    R = hw + FULL + BLEND
    i0, i1 = max(0, int((min(ax, bx) - R - FX0) / FST)), min(FNX - 1, int((max(ax, bx) + R - FX0) / FST) + 1)
    j0, j1 = max(0, int((min(az, bz) - R - FZ0) / FST)), min(FNZ - 1, int((max(az, bz) + R - FZ0) / FST) + 1)
    for j in range(j0, j1 + 1):
        gz = FZ0 + j * FST
        for i in range(i0, i1 + 1):
            gx = FX0 + i * FST
            t = min(1.0, max(0.0, ((gx - ax) * dx + (gz - az) * dz) / L2))
            d = math.hypot(gx - ax - dx * t, gz - az - dz * t)
            if d > R: continue
            n = j * FNX + i
            m = near.setdefault(n, {})
            sc = d - hw
            if ri not in m or sc < m[ri][0]: m[ri] = (sc, ha + (hb - ha) * t, d)
# The terrain is drawn as two triangles per 2.5 m cell, so a lane narrower than a cell can have a
# corner of the triangle under it up on the embankment beside it. Every triangle that the street
# surface passes over (sampled along its centre line and edges every 50 cm) is levelled.
force = {}
def tri_nodes(x, z):
    fx, fz = (x - FX0) / FST, (z - FZ0) / FST
    i0 = max(0, min(FNX - 2, int(math.floor(fx)))); j0 = max(0, min(FNZ - 2, int(math.floor(fz))))
    a, b, c, d = j0 * FNX + i0, j0 * FNX + i0 + 1, (j0 + 1) * FNX + i0, (j0 + 1) * FNX + i0 + 1
    return (a, b, c) if (fx - i0) + (fz - j0) <= 1 else (d, c, b)
for va, vb, ri in segs:
    rg = road_geo[ri]
    if rg['bridge']: continue
    hw = rg['w'] / 2
    ax, az, bx, bz = xs[va], zs[va], xs[vb], zs[vb]
    L = math.hypot(bx - ax, bz - az) or 1e-9
    ux, uz = (bx - ax) / L, (bz - az) / L
    for k in range(int(L / 0.5) + 1):
        t = min(1.0, k * 0.5 / L)
        cx, cz = ax + (bx - ax) * t, az + (bz - az) * t
        for o in ((-hw, -hw / 2, 0.0, hw / 2, hw) if rg['k'] == 'steps' or hw < 1.6 else (-0.6 * hw, -0.3 * hw, 0.0, 0.3 * hw, 0.6 * hw)):
            for n in tri_nodes(cx - uz * o, cz + ux * o): force.setdefault(n, set()).add(ri)
levelled = 0
for n, m in near.items():
    if FH0[n] < 0.5: continue
    x, z = FX0 + (n % FNX) * FST, FZ0 + (n // FNX) * FST
    if keep_p.contains(Point(x, z)): continue
    # on one or more street surfaces (with the full band): the biggest kind there, and where
    # several of that kind overlap (a junction, two lanes side by side), a blend of their heights
    fn = force.get(n, ())
    on = [(RANK[road_geo[ri]['k']], ri, (min(v[0], FULL), v[1], v[2]) if ri in fn else v) for ri, v in m.items() if v[0] <= FULL or ri in fn]
    if on:
        top = min(r for r, _, _ in on)
        ws = [((FULL + 0.5 - v[0]) ** 2, v[1]) for r, _, v in on if r == top]
        FH[n] = sum(w * h for w, h in ws) / sum(w for w, _ in ws)
    else:
        ri, (sc, h, d) = min(m.items(), key=lambda kv: kv[1][0])
        diff = h - FH0[n]
        # beside the street: a cut into a 60 % slope at most. Far more than that is another
        # street at another level (the legs of a hairpin, a lane above a retaining wall), so
        # the node keeps its height; a little more is clamped.
        allowed = 0.6 + 0.6 * d
        if abs(diff) > 2 * allowed: continue
        diff = max(-allowed, min(allowed, diff))
        tt = 1 - (sc - FULL) / BLEND
        FH[n] = FH0[n] + diff * tt * tt * (3 - 2 * tt)
    if abs(FH[n] - FH0[n]) > 0.05: levelled += 1
print('terrain nodes levelled under streets', levelled)

# ------------------------------------------------------------------ building footprints
# Everything is clipped to the detailed terrain: outside it the ground is a 60 m grid and
# buildings would float or sink.
FINE_BOX = box(FX0 + 3, FZ0 + 3, FX1 - 3, FZ1 - 3)

def ring_polys(lines):
    ls = [LineString(c) for c in lines if len(c) >= 2]
    if not ls: return None
    return unary_union(list(polygonize(linemerge(ls))))

cands = []      # {id, t, g (Polygon, holes allowed)}
canopy_src = []
def add_cand(cid, t, g):
    if not g.is_valid: g = make_valid(g)
    for p in polys_of(g):
        p = p.simplify(0.15, preserve_topology=True)
        if not p.is_valid: p = make_valid(p)
        for q in polys_of(p):
            if q.area < 5: continue
            if not FINE_BOX.contains(q.centroid): continue
            q = q.intersection(FINE_BOX)
            if q.intersects(reserved): q = q.difference(reserved)
            for r in polys_of(q):
                if r.area >= 5: cands.append({'id': cid, 't': dict(t), 'g': r})

SKIP_KINDS = {'no', 'construction', 'demolished', 'ruins', 'collapsed', 'proposed'}
for w in ways.values():
    t = w.get('tags', {})
    if 'building' not in t or t.get('building') in SKIP_KINDS or t.get('location') == 'underground': continue
    c = coords(w)
    if len(c) < 4 or c[0] != c[-1] or not in_area(c): continue
    if w['id'] == H6_ID: continue
    if t.get('building') == 'roof': canopy_src.append((w['id'], t, Polygon(c))); continue
    add_cand(w['id'], t, Polygon(c))
for r in rels.values():
    t = r.get('tags', {})
    if 'building' not in t or t.get('type') != 'multipolygon' or t.get('building') in SKIP_KINDS: continue
    outer = [coords(ways[m['ref']]) for m in r['members'] if m['type'] == 'way' and m['role'] in ('outer', '') and m['ref'] in ways]
    inner = [coords(ways[m['ref']]) for m in r['members'] if m['type'] == 'way' and m['role'] == 'inner' and m['ref'] in ways]
    if not outer or not any(in_area(c) for c in outer): continue
    og = ring_polys(outer)
    if og is None or og.is_empty: continue
    ig = ring_polys(inner)
    g = og.difference(ig) if ig is not None and not ig.is_empty else og
    if t.get('building') == 'roof':
        for p in polys_of(g): canopy_src.append((r['id'], t, p))
        continue
    add_cand(-r['id'], t, g)
print('building footprints from OSM', len(cands))

def info(t):
    return sum(k in t for k in ('building:levels', 'height', 'name', 'roof:shape', 'building:material')) + (t.get('building') != 'yes')
# Smallest first: detailed houses win over a block outline drawn around them, and an exact
# duplicate loses to the copy with the better tags. Each footprint keeps only what no
# earlier one already covers; if that is less than half of it, it was a duplicate.
order = sorted(range(len(cands)), key=lambda i: (round(cands[i]['g'].area), -info(cands[i]['t'])))
ctree = STRtree([c['g'] for c in cands])
kept = {}
dropped = 0
DONATE = ('building:levels', 'height', 'name', 'roof:shape', 'building:material', 'roof:levels', 'building:min_level', 'min_height', 'heritage')
for i in order:
    c = cands[i]
    g0 = g = c['g']
    over = []
    for j in ctree.query(g0):
        j = int(j)
        if j in kept and kept[j].intersects(g):
            a = kept[j].intersection(g0).area
            if a > 0.02:
                g = g.difference(kept[j]); over.append((a, j))
    if over:
        # remove the slivers a difference leaves behind
        g = g.buffer(-0.15, join_style=2).buffer(0.15, join_style=2).intersection(g)
        g = unary_union([p for p in polys_of(g) if p.area > 6])
    if g.is_empty or g.area < 0.5 * g0.area:
        dropped += 1
        if over:
            a, j = max(over)
            kt = cands[j]['t']
            for k in DONATE:
                if k in c['t'] and k not in kt: kt[k] = c['t'][k]
            if kt.get('building') == 'yes' and c['t'].get('building') not in (None, 'yes'): kt['building'] = c['t']['building']
        continue
    kept[i] = g
print('duplicates and overlaps removed', dropped)

# The ground under a building is hidden, but the terrain triangles between a node just inside a
# wall and the street in front of it are not: a node under the building that is higher than
# all the ground around it shows as a row of grassy teeth along the wall. Such nodes are capped
# at the highest outside ground next to them.
inside_p = prep(unary_union(list(kept.values())).buffer(-0.3))
inside = bytearray(FNX * FNZ)
for j in range(FNZ):
    for i in range(FNX):
        if inside_p.contains(Point(FX0 + i * FST, FZ0 + j * FST)): inside[j * FNX + i] = 1
capped = 0
src = list(FH)
for j in range(1, FNZ - 1):
    for i in range(1, FNX - 1):
        n = j * FNX + i
        if not inside[n]: continue
        out = [src[(j + dj) * FNX + i + di] for dj in (-1, 0, 1) for di in (-1, 0, 1) if not inside[(j + dj) * FNX + i + di]]
        if out and src[n] > max(out) + 0.05:
            FH[n] = max(out); capped += 1
print('terrain nodes under buildings capped', capped)


# ------------------------------------------------------------------ building attributes
# Colours after photos of the town: wooden houses mostly white, with cream, yellow, pale green,
# grey-blue and the odd red one between; plastered blocks in the centre white, cream, ochre,
# salmon and grey; Bryggen red and oxblood with white and ochre.
WOOD = ['#f3f1ea', '#f3f1ea', '#efede6', '#f6f4ee', '#e9e4d3', '#efe3b5', '#e4d28e', '#cfdccf', '#c9d6de', '#dcdcd6', '#e8d9c3', '#f3f1ea', '#b9473a', '#efede6']
PLASTER = ['#efebe2', '#e8dfc9', '#e6d29a', '#dcc9a8', '#e7c9b5', '#d3d6d3', '#c7ccd0', '#efe6cf', '#d8b58a', '#bfb7a8', '#f2efe8']
BRICK = ['#8a4a37', '#7b3f30', '#94533c']
BRYGGEN = ['#b23a2b', '#8c2c24', '#b23a2b', '#a5352e', '#efece3', '#c24e37', '#97302a', '#d6a03f', '#efece3', '#e6cf86']
ROOF_DARK, ROOF_RED, ROOF_BLACK, ROOF_FLAT, ROOF_COPPER = '#41444a', '#a7553a', '#2d2f33', '#5d5f62', '#5f8a76'
default_levels = {'house': 2, 'detached': 2, 'semidetached_house': 2, 'terrace': 3, 'apartments': 3, 'residential': 3, 'garage': 1, 'garages': 1,
                  'shed': 1, 'carport': 1, 'cabin': 1, 'barn': 2, 'retail': 4, 'commercial': 4, 'office': 5, 'hotel': 5, 'civic': 3, 'public': 3,
                  'government': 4, 'school': 3, 'university': 3, 'kindergarten': 1, 'church': 4, 'cathedral': 6, 'religious': 3,
                  'warehouse': 2, 'service': 1, 'train_station': 2, 'transportation': 1, 'kiosk': 1, 'parking': 4, 'fire_station': 2}
LOW_KINDS = {'garage', 'garages', 'carport', 'shed', 'service', 'kiosk'}
BIG_KINDS = {'retail', 'commercial', 'office', 'hotel', 'warehouse', 'parking', 'industrial', 'sports_centre', 'train_station', 'transportation', 'fire_station'}

def ground_stats(poly):
    per = []
    for ring in [poly.exterior] + list(poly.interiors):
        cs = list(ring.coords)
        for (ax, az), (bx, bz) in zip(cs, cs[1:]):
            L = math.hypot(bx - ax, bz - az); n = max(1, int(L))
            for k in range(n): per.append(ground(ax + (bx - ax) * k / n, az + (bz - az) * k / n))
    inner = []
    minx, minz, maxx, maxz = poly.bounds
    pp = prep(poly)
    x = minx + 1.25
    while x < maxx:
        z = minz + 1.25
        while z < maxz:
            if pp.contains(Point(x, z)): inner.append(ground(x, z))
            z += 2.5
        x += 2.5
    return min(per), max(per), min(per + inner)

buildings = []
for i, g in sorted(kept.items()):
    c = cands[i]
    for part_no, poly in enumerate(polys_of(g)):
        if poly.area < 6: continue
        poly = orient(poly, sign=-1.0)      # outer ring clockwise in (x,z), holes the other way
        t = c['t']; bid = c['id'] * 10 + part_no
        kind = t.get('building', 'yes')
        gmin, gmax, gall = ground_stats(poly)
        levels = num(t.get('building:levels'))
        if levels is None: levels = default_levels.get(kind, 3 if poly.area > 90 else 2)
        levels = max(1.0, min(levels, 20.0))
        roof_levels = num(t.get('roof:levels'), 0) or 0
        eave = (gmin + gmax) / 2 + levels * 2.9 + 0.4 + 0.5 * roof_levels
        if 'height' in t and num(t['height']):
            eave = gmin + num(t['height']) * 0.8
        eave = max(eave, gmax + 2.7)             # the uphill side always keeps a storey
        min_level = num(t.get('building:min_level'), 0) or 0
        min_height = num(t.get('min_height'), 0) or 0
        elevated = min_level > 0 or min_height > 0
        base = gall - 4.0                        # deep enough to cover the coarse terrain levels far away
        if elevated:
            base = (gmin + gmax) / 2 + (min_height if min_height > 0 else min_level * 2.9)
            nlev = levels - min_level if levels > min_level else max(1.0, levels)
            eave = max(base + nlev * 2.9, base + 2.6)
        cx, cz = poly.centroid.coords[0]
        hv = h01(bid)
        centre = (cx < -230 and cz > -900) or kind in ('retail', 'commercial', 'office', 'hotel', 'civic', 'public', 'school', 'university', 'government')
        mat = t.get('building:material', '')
        if mat == 'brick' or (centre and hv < 0.12): col = BRICK[int(hv * 97) % 3]
        elif mat in ('wood', 'timber_framing') : col = WOOD[int(hv * 97) % len(WOOD)]
        elif centre or mat in ('plaster', 'concrete', 'stone') or levels >= 5: col = PLASTER[int(hv * 97) % len(PLASTER)]   # blocks of five storeys and more are plastered
        else: col = WOOD[int(hv * 97) % len(WOOD)]
        roof = ROOF_RED if hv > 0.62 else (ROOF_BLACK if hv > 0.4 else ROOF_DARK)
        name = t.get('name', '')
        # the old wooden wharf houses of Bryggen (listed buildings between Torget and Mariakirken)
        bryggen = bool(t.get('heritage')) and -620 < cx < -420 and -620 < cz < -280 and kind not in ('church', 'civic')
        if bryggen:
            col = BRYGGEN[int(hv * 97) % len(BRYGGEN)]
            roof = ROOF_RED if hv > 0.35 else '#6b3a2a'
        church = kind in ('cathedral', 'church') or 'kirke' in name.lower()
        if church: col, roof = '#b9b4a6', ROOF_COPPER
        style = 'y' if bryggen else ('b' if col in BRICK else ('p' if col in PLASTER or church else 'w'))
        b = {'p': flat(list(poly.exterior.coords)[:-1]), 'b': r1(base), 't': r1(eave), 'c': col, 'rc': roof, 's': style}
        holes = [flat(list(h.coords)[:-1]) for h in poly.interiors if Polygon(h).area > 4]
        if holes: b['h'] = holes
        if kind in ('retail', 'commercial', 'hotel') or (centre and t.get('shop')): b['shop'] = 1
        if kind in LOW_KINDS or kind == 'warehouse': b['plain'] = 1
        if name: b['n'] = name
        if church: b['k'] = 'church'
        if bryggen: b['k'] = 'bryggen'
        if kind == 'kiosk': b['k'] = 'kiosk'; b['bc'] = t.get('building:colour', '')
        if elevated: b['el'] = 1
        b['_poly'] = poly; b['_kind'] = kind; b['_t'] = t; b['_hv'] = hv; b['_levels'] = levels; b['_centre'] = centre
        buildings.append((bid, b))

# neighbours of no. 6 coloured as in the video: the green house on the passage side
for bid, b in buildings:
    if bid // 10 == 579309502: b['c'] = '#8e979d'; b['rc'] = ROOF_BLACK
    if bid // 10 == 579309499: b['c'] = '#e8e3d3'
print('buildings', len(buildings), 'with courtyards', sum(1 for _, b in buildings if 'h' in b), 'elevated', sum(1 for _, b in buildings if 'el' in b))

# ------------------------------------------------------------------ facades: party walls and front doors
# An edge that another building touches (the terraced rows of Fjellet, the blocks in the centre) gets
# no windows. Five samples along each edge, 0.45 m outside it; a bit is set where the outside is free.
others = [b['_poly'] for _, b in buildings] + [reserved]
tree = STRtree(others)
def blocked(pt, self_i):
    for j in tree.query(pt):
        j = int(j)
        if j != self_i and others[j].contains(pt) and not (j < len(buildings) and 'el' in buildings[j][1]): return True
    return False
road_lines = [LineString(rg['c']) for rg in road_geo if rg['hw'] in WIDTH_KEYS]
road_tree = STRtree(road_lines)
def edge_masks(ring_pts, poly, bi, b, want_door):
    masks, best = [], None
    for i in range(len(ring_pts)):
        ax, az = ring_pts[i]; bx, bz = ring_pts[(i + 1) % len(ring_pts)]
        L = math.hypot(bx - ax, bz - az)
        if L < 0.05: masks.append(0); continue
        nx, nz = (bz - az) / L, -(bx - ax) / L
        mx, mz = (ax + bx) / 2, (az + bz) / 2
        if poly.contains(Point(mx + nx * 0.05, mz + nz * 0.05)): nx, nz = -nx, -nz
        m = 0
        for k in range(5):
            tt = (k + 0.5) / 5
            q = Point(ax + (bx - ax) * tt + nx * 0.45, az + (bz - az) * tt + nz * 0.45)
            if not blocked(q, bi): m |= 1 << k
        masks.append(m)
        # front door: the free edge closest to a street
        if want_door and L >= 2.4 and (m & 0b01110) == 0b01110:
            probe = Point(mx + nx * 1.5, mz + nz * 1.5)
            near = road_tree.query_nearest(probe)
            if len(near):
                line = road_lines[int(near[0])]
                d = line.distance(probe)
                if d < 30 and (best is None or d < best[0]):
                    rp = line.interpolate(line.project(probe))
                    tt = ((rp.x - ax) * (bx - ax) + (rp.y - az) * (bz - az)) / (L * L)
                    best = (d, i, min(0.75, max(0.25, tt)))
    return masks, best
for bi, (bid, b) in enumerate(buildings):
    poly = b['_poly']
    want_door = b['_kind'] not in ('shed', 'roof', 'carport', 'kiosk') and 'el' not in b
    masks, best = edge_masks(list(poly.exterior.coords)[:-1], poly, bi, b, want_door)
    b['e'] = masks
    if best: b['d'] = [best[1], round(best[2], 3)]
    if 'h' in b:
        b['he'] = [edge_masks(list(h.coords)[:-1], poly, bi, b, False)[0] for h in poly.interiors if Polygon(h).area > 4]

# ------------------------------------------------------------------ roofs
# The game draws a roof as a height field over the footprint, in a frame (centre, ridge
# direction u, half length along u, half width across it). Gable: the height falls off across
# the ridge. Hip: it also falls off towards the ends. Pyramid: towards the centre from all sides.
ROOF_TAG = {'flat': 'f', 'many': 'f', 'skillion': 'f', 'gabled': 'g', 'gambrel': 'g', 'half-hipped': 'g', 'saltbox': 'g',
            'hipped': 'h', 'mansard': 'h', 'dome': 'h', 'round': 'h', 'onion': 'p', 'pyramidal': 'p', 'cone': 'p'}
nroof = {}
for bi, (bid, b) in enumerate(buildings):
    poly, kind, t, hv = b['_poly'], b['_kind'], b['_t'], b['_hv']
    rect = poly.minimum_rotated_rectangle
    rc = list(rect.exterior.coords)[:-1]
    if len(rc) < 4 or rect.area < 1: continue
    s1, s2 = math.dist(rc[0], rc[1]), math.dist(rc[1], rc[2])
    if s1 >= s2: ax_, az_ = rc[1][0] - rc[0][0], rc[1][1] - rc[0][1]
    else: ax_, az_ = rc[2][0] - rc[1][0], rc[2][1] - rc[1][1]
    la = math.hypot(ax_, az_); ux_, uz_ = ax_ / la, az_ / la
    hl, hw = max(s1, s2) / 2, min(s1, s2) / 2
    cx, cz = rect.centroid.coords[0]
    fill = poly.area / rect.area
    tag = ROOF_TAG.get(t.get('roof:shape', ''), None)
    style = b['s']
    if 'h' in b or 'el' in b: shape = 'f'
    elif tag:
        shape = tag
        if shape != 'f' and fill < 0.8: shape = 'h' if fill >= 0.6 else 'f'
    elif b.get('k') in ('bryggen', 'church'): shape = 'g' if fill >= 0.7 else 'f'
    elif kind in ('garage', 'garages', 'carport') or b['_levels'] > 6: shape = 'f'
    elif style == 'w': shape = 'g' if fill >= 0.8 and hw <= 8 and kind not in BIG_KINDS else ('h' if fill >= 0.8 and hw <= 11 else 'f')
    else: shape = ('h' if hv < 0.55 else 'g') if fill >= 0.82 and hw <= 9 and b['_levels'] <= 6 and kind not in BIG_KINDS else 'f'
    if shape == 'f': nroof['f'] = nroof.get('f', 0) + 1; continue
    # terraced rows: the party walls are the gable ends, so the ridge runs across them
    party_u = party_v = 0.0
    pts = list(poly.exterior.coords)[:-1]
    for i, m in enumerate(b['e']):
        if bin(m).count('1') > 1: continue
        (ax, az), (bx, bz) = pts[i], pts[(i + 1) % len(pts)]
        L = math.hypot(bx - ax, bz - az)
        if L < 0.5: continue
        cu = abs(((bx - ax) * ux_ + (bz - az) * uz_) / L)
        if cu > 0.8: party_u += L
        elif cu < 0.6: party_v += L
    if party_u > max(2.0, party_v) and shape == 'g':
        ux_, uz_ = -uz_, ux_
        hl, hw = hw, hl
    pitch = {'y': 0.95, 'w': 0.66}.get(style, 0.5)
    if b.get('k') == 'church': pitch = 0.8
    if shape != 'g': pitch = min(pitch, 0.5)
    if tag and fill < 0.8: pitch = 0.35
    cap = 8.0 if b.get('k') in ('bryggen', 'church') else (5.5 if shape == 'g' else 4.0)
    rise = min(cap, hw * math.tan(pitch))
    if rise < 0.8: continue
    b['r'] = shape
    b['rf'] = [r2(cx), r2(cz), round(ux_, 4), round(uz_, 4), r2(hl), r2(hw)]
    b['rh'] = r2(rise)
    nroof[shape] = nroof.get(shape, 0) + 1
print('roofs', nroof)

# ------------------------------------------------------------------ canopies (building=roof: a roof on posts)
canopies = []
kept_union = unary_union([b['_poly'] for _, b in buildings])
for cid, t, g in canopy_src:
    if not g.is_valid: g = make_valid(g)
    for p in polys_of(g):
        if not FINE_BOX.contains(p.centroid) or p.intersects(reserved): continue
        p = p.intersection(FINE_BOX).difference(kept_union)
        for q in polys_of(p):
            q = q.simplify(0.2)
            if q.area < 6 or not q.is_valid or q.geom_type != 'Polygon': continue
            q = Polygon(q.exterior)
            gmin, gmax, _ = ground_stats(q)
            canopies.append({'p': flat(list(orient(q, -1.0).exterior.coords)[:-1]), 'y': r1(gmax + 3.2), 'g': r1(gmin)})
print('canopies', len(canopies))
for _, b in buildings:
    for k in [k for k in b if k.startswith('_')]: del b[k]

# ------------------------------------------------------------------ walls, fences, hedges; benches; lamps; parking
barriers = []
for w in ways.values():
    t = w.get('tags', {})
    k = t.get('barrier')
    if k not in ('wall', 'retaining_wall', 'fence', 'hedge', 'guard_rail'): continue
    c = coords(w)
    if len(c) < 2 or not in_area(c): continue
    if any(reserved_p.contains(Point(x, z)) for x, z in c): continue
    barriers.append({'k': k, 'p': flat(c)})
benches, lamps = [], []
for n in nodes.values():
    t = n.get('tags', {})
    x, z = P(n)
    if not (X0 < x < X1 and Z0 < z < Z1): continue
    if t.get('amenity') == 'bench': benches += [r1(x), r1(z)]
    if t.get('highway') == 'street_lamp': lamps += [r1(x), r1(z)]
parking = []
for w in ways.values():
    t = w.get('tags', {})
    if t.get('amenity') == 'parking' and t.get('parking') not in ('underground', 'multi-storey') and 'building' not in t:
        c = coords(w)
        if len(c) >= 4 and c[0] == c[-1] and in_area(c) and Polygon(c).area > 60: parking.append(flat(c[:-1]))
print('barriers', len(barriers), 'benches', len(benches) // 2, 'lamps', len(lamps) // 2, 'parking', len(parking))

# ------------------------------------------------------------------ areas (ground colour)
areas = []
GREEN = {('landuse', 'grass'), ('leisure', 'park'), ('leisure', 'garden'), ('natural', 'wood'), ('natural', 'scrub'), ('landuse', 'cemetery'),
         ('landuse', 'flowerbed'), ('leisure', 'playground'), ('landuse', 'forest'), ('natural', 'grassland'), ('landuse', 'meadow')}
PAVED = {('amenity', 'parking'), ('place', 'square'), ('highway', 'pedestrian'), ('leisure', 'pitch'), ('amenity', 'marketplace')}
def area_kind(t):
    for k, v in t.items():
        if (k, v) in GREEN: return 'wood' if v in ('wood', 'forest') else 'green'
        if (k, v) in PAVED: return 'paved'
        if k == 'natural' and v == 'water': return 'water'
    return None
area_polys = []
for w in ways.values():
    t = w.get('tags', {}); k = area_kind(t)
    c = coords(w)
    if k and len(c) >= 4 and c[0] == c[-1] and in_area(c):
        if k == 'paved' and t.get('highway') == 'pedestrian' and t.get('area') != 'yes': continue
        area_polys.append((k, Polygon(c).buffer(0)))
for r in rels.values():
    t = r.get('tags', {}); k = area_kind(t)
    if k and t.get('type') == 'multipolygon':
        # outer rings are often made of several open ways (Lille Lungegårdsvann is three): join them
        lines = [coords(ways[m['ref']]) for m in r['members'] if m['type'] == 'way' and m['role'] == 'outer' and m['ref'] in ways]
        g = ring_polys(lines)
        for pg in (polys_of(g) if g is not None else []):
            if in_area(list(pg.exterior.coords)): area_polys.append((k, pg.buffer(0)))
print('areas', len(area_polys))

# ------------------------------------------------------------------ the street surfaces, painted onto the terrain
# The streets are not separate strips laid over the ground: the terrain under them is levelled
# (above), and these two textures tell the terrain where to show asphalt (red), setts (green),
# paving (blue) and gravel (paths.png), at 50 cm, with soft edges. Streets are cut where a
# building stands, and higher kinds win where they overlap (a road over its crossing).
from PIL import Image, ImageDraw
# 75 cm to the pixel keeps the textures under 4096 px, the limit on many phones
MRES, MSS = 0.75, 3
MW, MH = int(round((FX1 - FX0) / MRES)), int(round((FZ1 - FZ0) / MRES))
chan = {'R': [], 'G': [], 'B': [], 'A': []}
for rg in road_geo:
    line = LineString(rg['c'])
    chan[rg['surf']].append(line.buffer(rg['w'] / 2, cap_style=1, join_style=1, quad_segs=4))
    for side, on in ((1, rg['sl']), (-1, rg['sr'])):
        if not on: continue
        try: off = line.offset_curve(side * (rg['w'] / 2 + SIDEWALK_W / 2), quad_segs=4, join_style=1)
        except Exception: continue
        if not off.is_empty: chan['B'].append(off.buffer(SIDEWALK_W / 2, cap_style=2, quad_segs=2))
for w in ways.values():
    t = w.get('tags', {})
    c = coords(w)
    if len(c) < 4 or c[0] != c[-1] or not in_area(c): continue
    if t.get('amenity') == 'parking' and t.get('parking') not in ('underground', 'multi-storey') and 'building' not in t: chan['R'].append(Polygon(c).buffer(0))
    elif t.get('place') == 'square' or t.get('amenity') == 'marketplace' or (t.get('highway') == 'pedestrian' and t.get('area') == 'yes'): chan['B'].append(Polygon(c).buffer(0))
masks = {k: unary_union(v) if v else Polygon() for k, v in chan.items()}
masks['G'] = masks['G'].difference(masks['R'])
masks['B'] = masks['B'].difference(unary_union([masks['R'], masks['G']]))
masks['A'] = masks['A'].difference(unary_union([masks['R'], masks['G'], masks['B']]))
blocked_by = unary_union([kept_union, reserved])
def raster(geom):
    im = Image.new('L', (MW * MSS, MH * MSS), 0)
    dr = ImageDraw.Draw(im)
    px = lambda cs: [((x - FX0) / MRES * MSS, (z - FZ0) / MRES * MSS) for x, z in cs]
    for poly in polys_of(geom.difference(blocked_by)):
        dr.polygon(px(poly.exterior.coords), fill=255)
        for hole in poly.interiors: dr.polygon(px(hole.coords), fill=0)
    return im.reduce(MSS)
Image.merge('RGB', [raster(masks['R']), raster(masks['G']), raster(masks['B'])]).save(os.path.join(OUT, 'roads.png'), optimize=True)
raster(masks['A']).save(os.path.join(OUT, 'paths.png'), optimize=True)
print('street surfaces', {k: round(v.area) for k, v in masks.items()}, 'm2 ->', os.path.getsize(os.path.join(OUT, 'roads.png')) // 1024, '+', os.path.getsize(os.path.join(OUT, 'paths.png')) // 1024, 'KB')

# ------------------------------------------------------------------ kerbs, road markings, zebra crossings
# Norwegian roads: a yellow centre line (dashed) between the two directions, white edge lines on
# the bigger roads, white zebra stripes at the marked crossings, and a granite kerb where the
# asphalt meets a paved pavement. Exported as lines; the game drapes them on the terrain.
def lines_of(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'LineString': return [g]
    if hasattr(g, 'geoms'): return [l for sub in g.geoms for l in lines_of(sub)]
    return []
kerbs = []
side_zone = masks['B'].buffer(0.8)
for ln in lines_of(masks['R'].boundary.intersection(side_zone).difference(blocked_by.buffer(0.4))):
    ln = ln.simplify(0.15)
    if ln.length > 2.0: kerbs.append(flat(list(ln.coords)))
MAJOR = {'trunk', 'primary', 'secondary', 'tertiary', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}
marks = []          # {'p': centre line, 'k': 'c' yellow centre dashes | 'e' white edge line}
for rg in road_geo:
    if rg['surf'] != 'R' or rg['hw'] not in CAR: continue
    if not rg['oneway'] and ((rg['hw'] in MAJOR and rg['w'] >= 5.5) or (rg['hw'] in ('unclassified', 'residential') and rg['w'] >= 6.5)):
        line = LineString(rg['c']).difference(blocked_by)
        for ln in lines_of(line):
            if ln.length > 4: marks.append({'p': flat(list(ln.coords)), 'k': 'c'})
    if rg['hw'] in MAJOR and rg['w'] >= 7:
        for side in (1, -1):
            try: off = LineString(rg['c']).offset_curve(side * (rg['w'] / 2 - 0.35), quad_segs=2, join_style=2)
            except Exception: continue
            for ln in lines_of(off.difference(blocked_by)):
                if ln.length > 4: marks.append({'p': flat(list(ln.coords)), 'k': 'e'})
crossings = []
car_lines = [(LineString(rg['c']), rg['w']) for rg in road_geo if rg['hw'] in CAR and rg['surf'] in ('R', 'G')]
car_tree = STRtree([l for l, _ in car_lines])
for n in nodes.values():
    t = n.get('tags', {})
    if t.get('highway') != 'crossing' or t.get('crossing') in ('unmarked', 'no', 'informal'): continue
    x, z = P(n)
    if not (X0 < x < X1 and Z0 < z < Z1): continue
    pt = Point(x, z)
    best = None
    for j in car_tree.query(pt.buffer(1.0)):
        l, w = car_lines[int(j)]
        d = l.distance(pt)
        if d < 1.0 and (best is None or d < best[0]): best = (d, l, w)
    if not best: continue
    _, l, w = best
    s0 = l.project(pt); a = l.interpolate(max(0, s0 - 1)); b = l.interpolate(min(l.length, s0 + 1))
    dx, dz = b.x - a.x, b.y - a.y; L = math.hypot(dx, dz) or 1
    crossings += [r1(x), r1(z), r2(dx / L), r2(dz / L), r1(w)]
print('kerbs', len(kerbs), round(sum(LineString(list(zip(k[0::2], k[1::2]))).length for k in kerbs)), 'm; markings', len(marks), '; crossings', len(crossings) // 5)

# ------------------------------------------------------------------ trees
trees = []
bprep = prep(kept_union.buffer(1.0))
for n in nodes.values():
    if n.get('tags', {}).get('natural') == 'tree':
        x, z = P(n)
        if X0 < x < X1 and Z0 < z < Z1 and not reserved_p.contains(Point(x, z)) and not bprep.contains(Point(x, z)): trees += [r1(x), r1(z)]
random.seed(7)
for k, poly in area_polys:
    if k != 'wood': continue
    minx, minz, maxx, maxz = poly.bounds
    pp = prep(poly)
    for _ in range(int(poly.area / 45)):
        x, z = random.uniform(minx, maxx), random.uniform(minz, maxz)
        if X0 < x < X1 and Z0 < z < Z1 and pp.contains(Point(x, z)) and not bprep.contains(Point(x, z)): trees += [r1(x), r1(z)]
print('trees', len(trees) // 2)

# ------------------------------------------------------------------ funicular
funi = []
tunnel_pairs = set()            # the stretches that run in a tunnel (under Skansen, under Fjellveien)
for w in ways.values():
    if w.get('tags', {}).get('railway') == 'funicular':
        ids = [nid for nid in w['nodes'] if nid in nodes]
        funi.append(ids)
        if w['tags'].get('tunnel') == 'yes':
            for a, b2 in zip(ids, ids[1:]): tunnel_pairs.add((min(a, b2), max(a, b2)))
# stitch the ways into one line from the lower station upwards
segs = [s for s in funi if len(s) > 1]
line = max(segs, key=len)
used = {id(line)}
changed = True
while changed:
    changed = False
    for s in segs:
        if id(s) in used: continue
        if s[0] == line[-1]: line = line + s[1:]
        elif s[-1] == line[0]: line = s[:-1] + line
        elif s[-1] == line[-1]: line = line + s[::-1][1:]
        elif s[0] == line[0]: line = s[::-1][:-1] + line
        else: continue
        used.add(id(s)); changed = True
if P(nodes[line[0]])[0] > P(nodes[line[-1]])[0]: line = line[::-1]    # start at the lower station (west)
fl = [P(nodes[i]) for i in line]
funicular = flat(fl)
funi_tunnel = [int((min(a, b2), max(a, b2)) in tunnel_pairs) for a, b2 in zip(line, line[1:])]     # per segment
print('funicular tunnel segments', sum(funi_tunnel), 'of', len(funi_tunnel))
print('funicular points', len(fl), 'from', [r1(v) for v in fl[0]], 'to', [r1(v) for v in fl[-1]])

# ------------------------------------------------------------------ Bybanen: the tracks, the platforms and the train's route
# Every light rail track in the area, the platforms along them, and one route for the train:
# from the end of the track at Byparken, the straightest way on through the junctions.
tram_ways = [w for w in ways.values() if w.get('tags', {}).get('railway') in ('light_rail', 'tram') and in_area(coords(w))
             and w.get('tags', {}).get('tunnel') not in ('yes',)]
tracks = [flat(coords(w)) for w in tram_ways if len(coords(w)) >= 2]
n_light = len(tracks)           # Bybanen's tracks come first; the railway's are added after
# the railway into Bergen station gets rails too (drawn, not driven)
for w in ways.values():
    t = w.get('tags', {})
    if t.get('railway') == 'rail' and t.get('tunnel') not in ('yes',) and in_area(coords(w)) and len(coords(w)) >= 2: tracks.append(flat(coords(w)))
tadj = {}
for w in tram_ways:
    ids = [i for i in w['nodes'] if i in nodes]
    for a, b2 in zip(ids, ids[1:]):
        tadj.setdefault(a, set()).add(b2); tadj.setdefault(b2, set()).add(a)
tram_route = []
platforms = []
if tadj:
    track_lines = [LineString(coords(w)) for w in tram_ways if len(coords(w)) >= 2]
    tl_union = unary_union(track_lines)
    for w in ways.values():
        t = w.get('tags', {})
        if not (t.get('railway') == 'platform' or (t.get('public_transport') == 'platform' and (t.get('tram') == 'yes' or t.get('light_rail') == 'yes'))): continue
        c = coords(w)
        if len(c) < 2 or not in_area(c): continue
        if len(c) >= 4 and c[0] == c[-1]: pg = Polygon(c).buffer(0)
        else:
            # a platform mapped as a line along its edge: a 3 m strip, kept clear of the tram's envelope
            pg = LineString(c).buffer(2.2, cap_style=2).difference(tl_union.buffer(1.5))
            parts = polys_of(pg)
            if not parts: continue
            pg = max(parts, key=lambda p: p.area).simplify(0.1)
        if pg.is_empty or pg.geom_type != 'Polygon' or pg.distance(tl_union) > 6 or pg.area < 8: continue
        platforms.append({'p': flat(list(pg.exterior.coords)[:-1]), 'n': t.get('name', '')})
    # start: the dead end nearest Byparken's platform
    byp = next((Polygon([(pp[k], pp[k + 1]) for k in range(0, len(pp), 2)]) for pp in (pl['p'] for pl in platforms)), None)
    ends = [n for n, a in tadj.items() if len(a) == 1]
    ref = byp.centroid if byp is not None else Point(-431, 125)
    start = min(ends, key=lambda n: Point(P(nodes[n])).distance(ref))
    route, prev, cur, seen = [start], None, start, {start}
    while True:
        nxt = [n for n in tadj[cur] if n not in seen]
        if not nxt: break
        if prev is None: cur2 = nxt[0]
        else:
            px, pz = P(nodes[prev]); cx, cz = P(nodes[cur])
            def turn(n):
                nx, nz = P(nodes[n]); a1 = math.atan2(cz - pz, cx - px); a2 = math.atan2(nz - cz, nx - cx)
                return abs((a2 - a1 + math.pi) % (2 * math.pi) - math.pi)
            cur2 = min(nxt, key=turn)
        prev, cur = cur, cur2; seen.add(cur); route.append(cur)
    tram_route = flat([P(nodes[n]) for n in route])
# landmarks for the minimap
LANDMARKS = ['Grieghallen', 'AdO arena', 'Bergen stasjon', 'Bystasjonen', 'Lille Lungegårdsvann', 'Fløyen']
landmarks = []
for name in LANDMARKS:
    best = None
    for w in ways.values():
        if w.get('tags', {}).get('name', '').lower() == name.lower():
            c = coords(w)
            if len(c) >= 3 and (best is None or len(c) > len(best)): best = c
    if best is None:
        n = next((n for n in nodes.values() if n.get('tags', {}).get('name', '').lower() == name.lower()), None)
        if n: best = [P(n)]
    if best:
        x = sum(p[0] for p in best) / len(best); z = sum(p[1] for p in best) / len(best)
        if X0 < x < X1 and Z0 < z < Z1: landmarks.append({'n': name, 'x': r1(x), 'z': r1(z)})
print('landmarks', [l['n'] for l in landmarks])
print('tram tracks', len(tracks), 'platforms', [p['n'] for p in platforms], 'route points', len(tram_route) // 2)

# ------------------------------------------------------------------ terrain arrays
def write_grid(g, h, path, scale):
    out = bytearray()
    for v in h:
        if v is None: v = -5.0
        out += struct.pack('<h', max(-32768, min(32767, int(round(v * scale)))))
    open(path, 'wb').write(out)
# the game lowers the terrain mesh around house 6 itself when it renders it
# Statues, sculptures and fountains (Ole Bull, Grieg, Christian Michelsen, Holberg, the
# fountain in Lille Lungegårdsvann, Den blå steinen): the game models the ones it knows by name.
art = []
for n in nodes.values():
    t = n.get('tags', {})
    if not (t.get('tourism') in ('artwork', 'aquarium') or t.get('amenity') == 'fountain' or t.get('historic') in ('memorial', 'monument') and t.get('memorial') in ('statue', 'obelisk', 'stone')
            or (t.get('tourism') == 'attraction' and 'Lehmkuhl' in t.get('name', ''))): continue
    x, z = P(n)
    if not (X0 < x < X1 and Z0 < z < Z1): continue
    art.append({'n': t.get('name', ''), 'k': t.get('artwork_type') or (t.get('tourism') if t.get('tourism') != 'artwork' else '') or t.get('amenity') or t.get('memorial') or '', 'x': r1(x), 'z': r1(z)})
for w in ways.values():
    t = w.get('tags', {})
    if t.get('tourism') != 'aquarium': continue
    c = coords(w)
    if len(c) < 3 or not in_area(c): continue
    art.append({'n': t.get('name', ''), 'k': 'aquarium', 'x': r1(sum(x for x, _ in c) / len(c)), 'z': r1(sum(z for _, z in c) / len(c))})
print('artworks and fountains', len(art))

# Shops, cafés, restaurants, pubs and the like, with their names: the game puts each name on a
# sign over the street front of the building it is in.
SHOPLIKE = {'restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'pharmacy', 'bank', 'ice_cream', 'nightclub', 'cinema', 'theatre', 'post_office'}
shops = []
for n in nodes.values():
    t = n.get('tags', {})
    nm = t.get('name')
    if not nm: continue
    kind = ('shop:' + t['shop']) if t.get('shop') and t['shop'] != 'vacant' else t.get('amenity') if t.get('amenity') in SHOPLIKE else None
    if not kind: continue
    x, z = P(n)
    if not (X0 < x < X1 and Z0 < z < Z1): continue
    shops.append({'n': nm[:28], 'k': kind, 'b': t.get('brand', ''), 'x': r1(x), 'z': r1(z)})
print('named shops', len(shops))

# Bus stops (with or without a shelter) and the city-bike stations
stops, bikes = [], []
for n in nodes.values():
    t = n.get('tags', {})
    x, z = P(n)
    if not (X0 < x < X1 and Z0 < z < Z1): continue
    if t.get('highway') == 'bus_stop' or (t.get('public_transport') == 'platform' and t.get('bus') == 'yes'):
        stops.append({'n': t.get('name', '')[:30], 'x': r1(x), 'z': r1(z), 'sh': 1 if t.get('shelter') == 'yes' else 0})
    elif t.get('amenity') == 'bicycle_rental':
        bikes.append({'x': r1(x), 'z': r1(z), 'c': int(num(t.get('capacity'), 10) or 10)})
print('bus stops', len(stops), 'bike stations', len(bikes))

# The trolleybus's overhead line (line 2): the streets OSM tags trolley_wire=yes, with their width
# and whether they are one-way (one pair of wires) or not (a pair each way)
trolley = []
for w in ways.values():
    t = w.get('tags', {})
    if t.get('trolley_wire') != 'yes' or t.get('highway') not in WIDTH: continue
    c = coords(w)
    if len(c) < 2 or not in_area(c): continue
    trolley.append({'p': flat(c), 'w': round(road_width(t, t['highway']), 1), 'o': 1 if t.get('oneway') in ('yes', '-1') else 0})
print('trolley wire ways', len(trolley))

# Outdoor swimming pools (Nordnes sjøbad): turquoise water a little under the ground round them
pools = []
for w in ways.values():
    t = w.get('tags', {})
    if t.get('leisure') != 'swimming_pool' or t.get('indoor') == 'yes' or t.get('covered') == 'yes' or 'building' in t: continue
    c = coords(w)
    if len(c) < 4 or c[0] != c[-1] or not in_area(c) or Polygon(c).area < 20: continue
    pools.append(flat(c[:-1]))
print('outdoor pools', len(pools))

# Piers and pontoons (man_made=pier): the floating ones in the marinas on Vågen and Store
# Lungegårdsvann get boats moored along them in the game. Lines are walkways of their width,
# areas are drawn as they are.
piers = []
for w in ways.values():
    t = w.get('tags', {})
    if t.get('man_made') != 'pier': continue
    c = coords(w)
    if len(c) < 2 or not in_area(c): continue
    area = c[0] == c[-1] and len(c) >= 4 and t.get('area') == 'yes'
    try: wd = float(t.get('width', '0').split()[0])
    except ValueError: wd = 0
    piers.append({'p': flat(c[:-1] if area else c), 'a': 1 if area else 0, 'f': 1 if t.get('floating') == 'yes' else 0, 'w': round(wd or (2.4 if t.get('floating') == 'yes' else 3.0), 1)})
print('piers', len(piers), 'floating', sum(p['f'] for p in piers))

# Quays: OpenStreetMap's coastline (land on the left of each way) is where the harbour's quay
# walls stand. The 2.5 m terrain grid would draw the shore as a sawtooth, so the ground on the
# water side of the line is dug out under the sea; the game stands a stone wall on the line.
coast = []
for w in ways.values():
    if w.get('tags', {}).get('natural') != 'coastline': continue
    c = coords(w)
    if len(c) < 2 or not in_area(c): continue
    coast.append(flat(c))
    for (ax, az), (bx, bz) in zip(c, c[1:]):
        L = math.hypot(bx - ax, bz - az)
        if L < 0.01: continue
        dx, dz = (bx - ax) / L, (bz - az) / L
        i0, i1 = max(0, int((min(ax, bx) - 4 - FX0) / FST)), min(FNX - 1, int((max(ax, bx) + 4 - FX0) / FST) + 1)
        j0, j1 = max(0, int((min(az, bz) - 4 - FZ0) / FST)), min(FNZ - 1, int((max(az, bz) + 4 - FZ0) / FST) + 1)
        for j in range(j0, j1 + 1):
            for i in range(i0, i1 + 1):
                px, pz = FX0 + i * FST - ax, FZ0 + j * FST - az
                t = px * dx + pz * dz
                if t < -0.5 or t > L + 0.5: continue
                side = dx * pz - dz * px                      # > 0: right of the line, the water
                n = j * FNX + i
                if 0 < side < 3.2 and FH[n] < 4.0: FH[n] = min(FH[n], -2.0)
print('coastline', len(coast), 'ways')

# Lakes: every mapped water area gets its own water level, taken from the elevation model's
# surface over it (Lille Lungegårdsvann is 0.1-0.6 m up, Skomakerdiket on Fløyen 300 m), and a
# basin dug under it, so the game can lay a water surface there and a stone edge round it.
waters = []
for k, poly in area_polys:
    if k != 'water' or poly.area < 40: continue
    inner_g = poly.buffer(-2.0)
    hs = []
    minx, minz, maxx, maxz = poly.bounds
    pin = prep(inner_g if not inner_g.is_empty else poly)
    for j in range(max(0, int((minz - FZ0) / FST)), min(FNZ, int((maxz - FZ0) / FST) + 2)):
        for i in range(max(0, int((minx - FX0) / FST)), min(FNX, int((maxx - FX0) / FST) + 2)):
            if pin.contains(Point(FX0 + i * FST, FZ0 + j * FST)) and FH0[j * FNX + i] > -4.9: hs.append(FH0[j * FNX + i])
    if not hs: continue
    hs.sort()
    level = max(0.15, hs[len(hs) // 2])
    inner, outer_p = prep(poly.buffer(-1.5)), prep(poly)
    for j in range(max(0, int((minz - FZ0) / FST)), min(FNZ, int((maxz - FZ0) / FST) + 2)):
        for i in range(max(0, int((minx - FX0) / FST)), min(FNX, int((maxx - FX0) / FST) + 2)):
            pt = Point(FX0 + i * FST, FZ0 + j * FST)
            if inner.contains(pt): FH[j * FNX + i] = min(FH[j * FNX + i], level - 1.6)
            elif outer_p.contains(pt): FH[j * FNX + i] = min(FH[j * FNX + i], level - 0.35)
    waters.append({'p': flat(list(poly.exterior.coords)[:-1]), 'h': [flat(list(r.coords)[:-1]) for r in poly.interiors], 'y': r2(level), 'a': round(poly.area)})
print('lakes', len(waters), [(w['y'], w['a']) for w in waters])
write_grid(fine, FH, os.path.join(OUT, 'terrain.bin'), 100)
write_grid(coarse, coarse['h'], os.path.join(OUT, 'coarse.bin'), 10)

# ground classes on the fine grid: 0 urban default, 1 green, 2 wood, 3 paved, 4 water
cls = bytearray(FNX * FNZ)
order_k = {'green': 1, 'wood': 2, 'paved': 3, 'water': 4}
for k, poly in sorted(area_polys, key=lambda a: -a[1].area):
    minx, minz, maxx, maxz = poly.bounds
    pp = prep(poly)
    for j in range(max(0, int((minz - FZ0) / FST)), min(FNZ, int((maxz - FZ0) / FST) + 2)):
        for i in range(max(0, int((minx - FX0) / FST)), min(FNX, int((maxx - FX0) / FST) + 2)):
            if pp.contains(Point(FX0 + i * FST, FZ0 + j * FST)): cls[j * FNX + i] = order_k[k]
open(os.path.join(OUT, 'ground.bin'), 'wb').write(bytes(cls))

# ------------------------------------------------------------------ places that matter to the people who live at no. 6
PLACES = [  # (label, OSM name, kind)
    ('Magda', 'Magda', 'bar'),
    ('Trekroneren', '3-kroneren', 'hotdog'),
    ('Rema 1000 Marken', 'Rema 1000 Marken', 'shop'),
    ('Guangdong House', 'Guangdong House', 'food'),
    ("Johnny's Pizza", "Johnny's pizza", 'pizza'),
]
places = []
for label, osm, kind in PLACES:
    n = next((n for n in nodes.values() if n.get('tags', {}).get('name') == osm), None)
    if not n: print('MISSING place', label); continue
    x, z = P(n)
    places.append({'n': label, 'k': kind, 'x': r1(x), 'z': r1(z), 'g': r1(ground(x, z))})
print('places', [p['n'] for p in places])

out = {
    'attribution': 'Map data © OpenStreetMap contributors (ODbL). Elevation © Kartverket (CC BY 4.0).',
    'origin': {'lat': LAT0, 'lon': LON0},
    'area': [X0, Z0, X1, Z1],
    'terrain': {'x0': FX0, 'z0': FZ0, 'step': FST, 'nx': FNX, 'nz': FNZ, 'scale': 0.01},
    'coarse': {'x0': coarse['x0'], 'z0': coarse['z0'], 'step': coarse['step'], 'nx': coarse['nx'], 'nz': coarse['nz'], 'scale': 0.1},
    'house6': house6,
    'buildings': [b for _, b in buildings],
    'canopies': canopies,
    'roads': roads,
    'trees': trees,
    'funicular': funicular,
    'funiTunnel': funi_tunnel,
    'tram': {'tracks': tracks, 'nLight': n_light, 'platforms': platforms, 'route': tram_route},
    'landmarks': landmarks,
    'graph': graph,
    'places': places,
    'barriers': barriers,
    'benches': benches,
    'lamps': lamps,
    'parking': parking,
    'waters': waters,
    'kerbs': kerbs, 'marks': marks, 'crossings': crossings, 'coast': coast, 'art': art, 'shops': shops, 'stops': stops, 'bikes': bikes, 'trolley': trolley, 'pools': pools, 'piers': piers,
    'roadmask': {'x0': FX0, 'z0': FZ0, 'res': MRES, 'w': MW, 'h': MH},
}
json.dump(out, open(os.path.join(OUT, 'map.json'), 'w'), separators=(',', ':'))
print('wrote', os.path.getsize(os.path.join(OUT, 'map.json')) // 1024, 'KB')
