#!/usr/bin/env python3
"""Build the game map from OpenStreetMap and Kartverket elevation data.

Inputs (in a work directory, see fetch_data.sh):
  t_*.json      OSM API /map.json tiles covering the area
  fine.json     terrain heights on a 2.5 m grid around the house (Kartverket DTM1)
  coarse.json   terrain heights on a 60 m grid for the surrounding mountains

Outputs (gtcv6/public/data):
  map.json      buildings, roads, areas, trees, the funicular, a walking graph
  terrain.bin   Int16 heights in centimetres, fine grid
  coarse.bin    Int16 heights in decimetres, coarse grid

Coordinates: metres, origin at Cappes vei 6, +x east, +z south.
Map data © OpenStreetMap contributors (ODbL). Elevation © Kartverket (CC BY 4.0).
"""
import json, math, glob, sys, os, struct, hashlib
from shapely.geometry import Polygon, Point, LineString, box
from shapely.affinity import rotate
from shapely.prepared import prep

WORK = sys.argv[1]
OUT = sys.argv[2]

LAT0, LON0 = 60.3931275, 5.3333919          # Cappes vei 6 (OSM address node 3126074741)
MLAT = 111230.0
MLON = 111320.0 * math.cos(math.radians(LAT0))
X0, X1, Z0, Z1 = -690.0, 190.0, -750.0, 240.0   # playable area: Bryggen and Bergenhus to Fjellet and Marken

def P(n): return ((n['lon'] - LON0) * MLON, -(n['lat'] - LAT0) * MLAT)

nodes, ways, rels = {}, {}, {}
for f in glob.glob(os.path.join(WORK, 't_*.json')):
    for e in json.load(open(f))['elements']:
        {'node': nodes, 'way': ways, 'relation': rels}[e['type']][e['id']] = e
def coords(w): return [P(nodes[i]) for i in w['nodes'] if i in nodes]

# ------------------------------------------------------------------ terrain
fine = json.load(open(os.path.join(WORK, 'fine.json')))
coarse = json.load(open(os.path.join(WORK, 'coarse.json')))
def grid_sampler(g):
    nx, nz, x0, z0, st, h = g['nx'], g['nz'], g['x0'], g['z0'], g['step'], g['h']
    def f(x, z):
        fx = min(max((x - x0) / st, 0), nx - 1.001); fz = min(max((z - z0) / st, 0), nz - 1.001)
        i, j = int(fx), int(fz); tx, tz = fx - i, fz - j
        def H(a, b):
            v = h[b * nx + a]
            return v if v is not None else 0.0
        return (H(i, j) * (1 - tx) + H(i + 1, j) * tx) * (1 - tz) + (H(i, j + 1) * (1 - tx) + H(i + 1, j + 1) * tx) * tz
    return f
ground = grid_sampler(fine)

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
def flat(c): return [r1(a) for p in c for a in p]
def h01(s): return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16) / 0xffffffff

# ------------------------------------------------------------------ buildings
def building_polys():
    for w in ways.values():
        t = w.get('tags', {})
        if 'building' in t and t.get('building') not in ('roof',) and t.get('location') != 'underground':
            c = coords(w)
            if len(c) >= 4 and in_area(c): yield w['id'], t, Polygon(c)
    for r in rels.values():
        t = r.get('tags', {})
        if 'building' in t and t.get('type') == 'multipolygon':
            for m in r['members']:
                if m['type'] == 'way' and m['role'] == 'outer' and m['ref'] in ways:
                    c = coords(ways[m['ref']])
                    if len(c) >= 4 and c[0] == c[-1] and in_area(c): yield r['id'] * 10 + 1, t, Polygon(c)

WOOD = ['#efede6', '#efede6', '#f2efe6', '#e7e3d6', '#dcdcd4', '#e9ddb1', '#c8d6dd', '#d9cfc0', '#b9c6c9', '#e8e2cf']
PLASTER = ['#e8e1d2', '#d9cdb5', '#cdbf9f', '#e2d6bd', '#bfb7a8', '#d8c3a5', '#a9a49b', '#e9e4d8']
BRICK = ['#8a4a37', '#7b3f30', '#94533c']
BRYGGEN = ['#96321f', '#c98f2e', '#e8e2d2', '#d9b75a', '#6e4a30', '#b0452a', '#a33a24', '#e3cf9a']
ROOF_DARK, ROOF_RED, ROOF_BLACK, ROOF_FLAT, ROOF_COPPER = '#41444a', '#8d3f2d', '#2d2f33', '#5d5f62', '#5f8a76'
default_levels = {'house': 2, 'detached': 2, 'semidetached_house': 2, 'apartments': 3, 'garage': 1, 'garages': 1, 'shed': 1, 'carport': 1,
                  'retail': 4, 'commercial': 4, 'office': 5, 'hotel': 5, 'civic': 3, 'public': 3, 'school': 3, 'university': 3,
                  'church': 4, 'cathedral': 6, 'religious': 3, 'warehouse': 2, 'service': 1, 'train_station': 2, 'kiosk': 1}
buildings = []
for bid, t, poly in building_polys():
    if bid == H6_ID: continue
    if not poly.is_valid: poly = poly.buffer(0)
    if poly.geom_type != 'Polygon': poly = max(poly.geoms, key=lambda g: g.area) if hasattr(poly, 'geoms') else poly
    if poly.intersects(reserved):
        poly = poly.difference(reserved)
        if poly.is_empty: continue
        if poly.geom_type != 'Polygon': poly = max(poly.geoms, key=lambda g: g.area)
    poly = poly.simplify(0.15)
    if poly.area < 5: continue
    c = list(poly.exterior.coords)[:-1]
    if Polygon(c).exterior.is_ccw: c = c[::-1]           # clockwise in (x,z) so walls face outwards consistently
    kind = t.get('building', 'yes')
    gs = [ground(x, z) for x, z in c] + [ground(*poly.centroid.coords[0])]
    gmin, gmax = min(gs), max(gs)
    try: levels = float(t.get('building:levels', '').split(';')[0])
    except ValueError: levels = default_levels.get(kind, 3 if poly.area > 90 else 2)
    if t.get('roof:levels'):
        try: levels += 0.5 * float(t['roof:levels'])
        except ValueError: pass
    eave = (gmin + gmax) / 2 + levels * 2.9 + 0.4
    if 'height' in t:
        try: eave = gmin + float(t['height'].split()[0]) * 0.8
        except ValueError: pass
    rect = poly.minimum_rotated_rectangle
    rc = list(rect.exterior.coords)[:-1]
    s1, s2 = math.dist(rc[0], rc[1]), math.dist(rc[1], rc[2])
    short = min(s1, s2)
    gabled = poly.area / rect.area > 0.8 and short < 15 and levels <= 5 and kind not in ('garage', 'garages', 'carport', 'retail', 'commercial', 'warehouse')
    if t.get('roof:shape') == 'flat': gabled = False
    if t.get('roof:shape') in ('gabled', 'hipped', 'half-hipped', 'gambrel'): gabled = short < 20
    cx, cz = poly.centroid.coords[0]
    hv = h01(bid)
    centre = cx < -230 or kind in ('retail', 'commercial', 'office', 'hotel', 'civic', 'public', 'school', 'university')
    mat = t.get('building:material', '')
    if mat == 'brick' or (centre and hv < 0.12): col = BRICK[int(hv * 97) % 3]
    elif centre: col = PLASTER[int(hv * 97) % len(PLASTER)]
    else: col = WOOD[int(hv * 97) % len(WOOD)]
    roof = ROOF_RED if hv > 0.8 else (ROOF_BLACK if hv > 0.55 else ROOF_DARK)
    name = t.get('name', '')
    # the old wooden wharf houses of Bryggen (listed buildings between Torget and Mariakirken)
    bryggen = t.get('heritage') and -620 < cx < -420 and -620 < cz < -280 and kind not in ('church', 'civic')
    if bryggen:
        col = BRYGGEN[int(hv * 97) % len(BRYGGEN)]
        roof = ROOF_RED if hv > 0.35 else '#6b3a2a'
        if short < 16 and poly.area / rect.area > 0.7: gabled = True
    if kind in ('cathedral', 'church') or 'kirke' in name.lower():
        col, roof = '#b9b4a6', ROOF_COPPER
    if not gabled: roof = ROOF_FLAT if centre or kind in ('garage', 'garages') else roof
    b = {'p': flat(c), 'b': r1(gmin - 1.5), 't': r1(eave), 'c': col, 'rc': roof}
    if gabled: b['g'] = flat(rc)
    if name: b['n'] = name
    if kind in ('cathedral', 'church'): b['k'] = 'church'
    if bryggen: b['k'] = 'bryggen'
    buildings.append((bid, b))

# neighbours of no. 6 coloured as in the video: the green house on the passage side
for bid, b in buildings:
    if bid == 579309502: b['c'] = '#9ab775'; b['rc'] = ROOF_BLACK
    if bid == 579309499: b['c'] = '#e8e3d3'
print('buildings', len(buildings))

# ------------------------------------------------------------------ roads
WIDTH = {'trunk': 9, 'primary': 8.5, 'secondary': 7.5, 'tertiary': 7, 'unclassified': 5, 'residential': 5, 'living_street': 4.5,
         'service': 3.5, 'pedestrian': 5, 'footway': 2.2, 'path': 1.6, 'steps': 2, 'cycleway': 2.5, 'track': 3, 'corridor': 2,
         'trunk_link': 6, 'primary_link': 6, 'secondary_link': 6, 'tertiary_link': 5}
roads = []
graph_nodes, graph_edges = {}, set()
for w in ways.values():
    t = w.get('tags', {})
    hw = t.get('highway')
    if hw not in WIDTH or t.get('tunnel') in ('yes', 'building_passage') or t.get('area') == 'yes' or t.get('indoor') == 'yes': continue
    if hw == 'corridor': continue
    ids = [i for i in w['nodes'] if i in nodes]
    c = [P(nodes[i]) for i in ids]
    if len(c) < 2 or not in_area(c): continue
    surf = t.get('surface', '')
    k = 'steps' if hw == 'steps' else ('foot' if hw in ('footway', 'path', 'cycleway', 'track') else
         ('ped' if hw == 'pedestrian' else ('sett' if surf in ('sett', 'cobblestone', 'paving_stones', 'unhewn_cobblestone') else 'road')))
    if hw == 'footway' and t.get('footway') == 'sidewalk': k = 'side'
    wdt = WIDTH[hw]
    try: wdt = float(t.get('width', wdt))
    except ValueError: pass
    r = {'p': flat(c), 'w': round(wdt, 1), 'k': k}
    if t.get('name'): r['n'] = t['name']
    if t.get('bridge') == 'yes': r['br'] = 1
    roads.append(r)
    # walking graph (everything but trunk roads without sidewalks still counts: it is a game)
    for a, b2 in zip(ids, ids[1:]):
        graph_nodes[a] = P(nodes[a]); graph_nodes[b2] = P(nodes[b2])
        graph_edges.add((min(a, b2), max(a, b2)))
print('roads', len(roads))
gids = {nid: i for i, nid in enumerate(graph_nodes)}
graph = {'n': flat(graph_nodes.values()), 'e': [x for a, b2 in graph_edges for x in (gids[a], gids[b2])]}

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
        for m in r['members']:
            if m['type'] == 'way' and m['role'] == 'outer' and m['ref'] in ways:
                c = coords(ways[m['ref']])
                if len(c) >= 4 and c[0] == c[-1] and in_area(c): area_polys.append((k, Polygon(c).buffer(0)))
print('areas', len(area_polys))

# ------------------------------------------------------------------ trees
trees = []
for n in nodes.values():
    if n.get('tags', {}).get('natural') == 'tree':
        x, z = P(n)
        if X0 < x < X1 and Z0 < z < Z1 and not reserved_p.contains(Point(x, z)): trees += [r1(x), r1(z)]
import random
random.seed(7)
for k, poly in area_polys:
    if k != 'wood': continue
    minx, minz, maxx, maxz = poly.bounds
    pp = prep(poly)
    for _ in range(int(poly.area / 45)):
        x, z = random.uniform(minx, maxx), random.uniform(minz, maxz)
        if X0 < x < X1 and Z0 < z < Z1 and pp.contains(Point(x, z)): trees += [r1(x), r1(z)]
print('trees', len(trees) // 2)

# ------------------------------------------------------------------ funicular
funi = []
for w in ways.values():
    if w.get('tags', {}).get('railway') == 'funicular':
        funi.append([nid for nid in w['nodes'] if nid in nodes])
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
fl = [P(nodes[i]) for i in line]
if fl[0][0] > fl[-1][0]: fl = fl[::-1]    # start at the lower station (west)
funicular = flat(fl)
print('funicular points', len(fl), 'from', [r1(v) for v in fl[0]], 'to', [r1(v) for v in fl[-1]])

# ------------------------------------------------------------------ terrain arrays
def write_grid(g, path, scale, carve=None, classes=None):
    nx, nz, x0, z0, st = g['nx'], g['nz'], g['x0'], g['z0'], g['step']
    out = bytearray()
    for j in range(nz):
        for i in range(nx):
            v = g['h'][j * nx + i]
            if v is None: v = -5.0
            if carve:
                x, z = x0 + i * st, z0 + j * st
                if carve(x, z): v = min(v, FL - 6)
            out += struct.pack('<h', max(-32768, min(32767, int(round(v * scale)))))
    open(path, 'wb').write(out)
# real heights; the game lowers the terrain mesh around house 6 itself when it renders it
write_grid(fine, os.path.join(OUT, 'terrain.bin'), 100)
write_grid(coarse, os.path.join(OUT, 'coarse.bin'), 10)

# ground classes on the fine grid: 0 urban default, 1 green, 2 wood, 3 paved, 4 water
nx, nz, gx0, gz0, st = fine['nx'], fine['nz'], fine['x0'], fine['z0'], fine['step']
cls = bytearray(nx * nz)
order = {'green': 1, 'wood': 2, 'paved': 3, 'water': 4}
for k, poly in sorted(area_polys, key=lambda a: -a[1].area):
    minx, minz, maxx, maxz = poly.bounds
    pp = prep(poly)
    for j in range(max(0, int((minz - gz0) / st)), min(nz, int((maxz - gz0) / st) + 2)):
        for i in range(max(0, int((minx - gx0) / st)), min(nx, int((maxx - gx0) / st) + 2)):
            if pp.contains(Point(gx0 + i * st, gz0 + j * st)): cls[j * nx + i] = order[k]
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
    'terrain': {'x0': fine['x0'], 'z0': fine['z0'], 'step': fine['step'], 'nx': fine['nx'], 'nz': fine['nz'], 'scale': 0.01},
    'coarse': {'x0': coarse['x0'], 'z0': coarse['z0'], 'step': coarse['step'], 'nx': coarse['nx'], 'nz': coarse['nz'], 'scale': 0.1},
    'house6': house6,
    'buildings': [b for _, b in buildings],
    'roads': roads,
    'trees': trees,
    'funicular': funicular,
    'graph': graph,
    'places': places,
}
json.dump(out, open(os.path.join(OUT, 'map.json'), 'w'), separators=(',', ':'))
print('wrote', os.path.getsize(os.path.join(OUT, 'map.json')) // 1024, 'KB')
