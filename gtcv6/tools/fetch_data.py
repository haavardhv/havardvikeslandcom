#!/usr/bin/env python3
"""Download the raw data build_map.py needs into a work directory.

  python3 fetch_data.py WORKDIR

OSM: api.openstreetmap.org /map.json tiles (please don't run this often).
Elevation: Kartverket's height API (ws.geonorge.no/hoydedata), 50 points per request.
"""
import json, math, os, sys, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

WORK = sys.argv[1]
os.makedirs(WORK, exist_ok=True)
LAT0, LON0 = 60.3931275, 5.3333919
MLAT = 111230.0
MLON = 111320.0 * math.cos(math.radians(LAT0))
UA = {'User-Agent': 'gtcv6-map-builder/1.0'}

def get(url, tries=6):
    for a in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
        except Exception:
            time.sleep(2 + a * 4)
    raise RuntimeError('failed: ' + url)

# OSM tiles
i = 0
for lat in (60.3870, 60.3905, 60.3940, 60.3975):
    for lon in (5.3150, 5.3210, 5.3270, 5.3335, 5.3400):
        i += 1
        f = os.path.join(WORK, f't_{i}.json')
        if not os.path.exists(f):
            bbox = f'{lon},{lat},{lon + 0.0065:.4f},{lat + 0.0035:.4f}'
            open(f, 'wb').write(get('https://api.openstreetmap.org/api/0.6/map.json?bbox=' + bbox))
            time.sleep(1)

def ll(x, z): return (LON0 + x / MLON, LAT0 - z / MLAT)

def grid(name, x0, x1, z0, z1, step):
    nx = int(round((x1 - x0) / step)) + 1; nz = int(round((z1 - z0) / step)) + 1
    pts = [(x0 + i * step, z0 + j * step) for j in range(nz) for i in range(nx)]
    chunks = [pts[k:k + 50] for k in range(0, len(pts), 50)]
    cache = os.path.join(WORK, name + '_cache'); os.makedirs(cache, exist_ok=True)
    def work(k):
        f = os.path.join(cache, f'{k}.json')
        if os.path.exists(f): return
        c = [[round(a, 7) for a in ll(x, z)] for x, z in chunks[k]]
        url = 'https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=4258&punkter=' + urllib.parse.quote(json.dumps(c, separators=(',', ':')))
        d = json.loads(get(url))
        json.dump([p.get('z') for p in d['punkter']], open(f, 'w'))
    with ThreadPoolExecutor(4) as ex: list(ex.map(work, range(len(chunks))))
    zs = []
    for k in range(len(chunks)): zs += json.load(open(os.path.join(cache, f'{k}.json')))
    json.dump({'x0': x0, 'z0': z0, 'step': step, 'nx': nx, 'nz': nz, 'h': zs}, open(os.path.join(WORK, name + '.json'), 'w'))

grid('coarse', -3000, 4000, -3000, 3000, 60)
grid('fine', -700, 200, -760, 250, 2.5)
