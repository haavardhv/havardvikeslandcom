# Grand Theft Cappes Vei 6

A small open-world browser game set in the rain on Cappes vei 6, in Fjellet, Bergen. You play in third person: get home from Bryggen, throw a party on the terrace, steal an e-scooter, and carry the last skillingsbolle in town home past a gang of seagulls.

It is a separate site from the main "something great is coming" page and is meant to live on its own subdomain (for example `gtcv6.havardvikesland.com`).

## What's in it

- **The real neighbourhood.** Streets, lanes, stairs and around 900 building outlines come from OpenStreetMap, and the terrain comes from Kartverket's 1 m elevation model (DTM1). The area runs from Bryggen, Mariakirken and Bergenhus along Vågen to Torget, then up past Domkirken and Kong Oscars gate to Fjellet and Fjellveien. Bryggen's listed wharf houses get their red, ochre and white colours and steep red roofs. Cappes vei, Skivebakken, Heggebakken, Brattlien and Asylplassen are where they really are, at their real heights. Buildings get their storeys from OSM, gable roofs where the outline is a simple rectangle, and wooden cladding in Fjellet or plaster in the centre. Fløibanen runs on its real track up to Fløyen, the real tree positions are used, and Ulriken, Fløyen and the islands stand behind.
- **Cappes vei 6, room by room after the walkthrough video.** The house sits on the uphill side of a terraced row, between no. 8 (the green house) and no. 4. You enter from Cappes vei on the **upper floor** through the black door, and the stairs go **down**:
  - *Upper floor (street level):* hall with the door mat and rug, a small study by the front door (desk, black chair, white bench), the steep white staircase with dark treads and a peg rack on the right, the galley kitchen with grey cabinets at the end of the hall, and the open dining and living room with two navy sofas, the pine wall and track lights. The bedroom with the pine wall opens off the living room.
  - *Lower floor (out to the terrace):* the stairs land on the grey and white block-pattern floor by the washer and dryer. The white-tiled bathroom has the shower and plant shelves. Three bedrooms on the uphill side have lightwell windows (blue cushions, white bed, desk with a black chair). A corridor leads to the glass door onto the terrace, between the bedroom with the black pillow and the study with the wardrobe and white chair.
  - *Outside:* the side passage with steps and plants runs down from the street to the raised, fenced terrace of stone slabs and weeds, which looks out over the roofs on Skivebakken.
- **Weather** follows Bergen: rain showers come and go, with short sunny breaks.
- **Måkealarm** is the wanted level, five seagull icons. Punch gulls or people and the gang dives at you. Hide indoors and the alarm drops faster.
- **Four missions on real streets:** walk home from Bryggen, borrow the landlord's things around the house, steal an e-scooter and race the real route to the bakery on Torget, then carry the last skillingsbolle home. A GPS line on the minimap shows the route (A* over the OSM street graph), and the HUD shows which street you are on. Free roam follows, with 14 lost umbrellas at real spots. Progress is saved in the browser's `localStorage`.

Controls: WASD to move, mouse to look, Shift to run, Space to jump, click or F to punch, E to get on and off scooters, Esc to pause. Phones and tablets get touch controls.

## Files

Plain static files with no build step. The only library is three.js, vendored.

| File | What it is |
| --- | --- |
| `public/index.html`, `public/style.css` | Title screen, HUD, pause menu, touch controls |
| `public/js/game.js` | Main loop, player and camera, scooters, seagull AI, pedestrians on the street graph, missions, HUD, minimap and GPS |
| `public/js/city.js` | Builds the town from the map data: terrain meshes, buildings, streets and steps, trees, water, Fløibanen; polygon collision for buildings |
| `public/js/house6.js` | Cappes vei 6, its side passage and terrace, in a local frame aligned with the real outline |
| `public/js/physics.js` | One collision interface over terrain, building polygons and the house's local box world |
| `public/js/engine.js` | Geometry batching and the box collision world used for the house |
| `public/js/actors.js`, `textures.js`, `audio.js` | Characters and props, procedural textures, synthesised sound |
| `public/data/` | The packed map: `map.json` (buildings, streets, trees, funicular, walking graph, the house's frame), `terrain.bin` (2.5 m grid, about 900 × 960 m), `coarse.bin` (60 m grid for the mountains), `ground.bin` (ground types) |
| `tools/fetch_data.py`, `tools/build_map.py` | Download OSM and Kartverket data, then pack it into `public/data/` |
| `public/vendor/three.module.min.js` | three.js r186.1, bundled and minified (MIT) |

Debug URL option: `?q=low` pins a low render resolution. Otherwise the resolution adapts to the frame rate.

### Rebuilding the map data

```bash
pip install shapely
python3 gtcv6/tools/fetch_data.py /tmp/gtcv6-raw          # needs api.openstreetmap.org and ws.geonorge.no
python3 gtcv6/tools/build_map.py /tmp/gtcv6-raw gtcv6/public/data
```

The fetch downloads about 30 MB of OSM tiles and makes roughly 2,700 small elevation requests (50 points each), so please don't run it often.

### Data and attribution

Map data © OpenStreetMap contributors, available under the Open Database License (ODbL). Elevation © Kartverket, CC BY 4.0. Both are credited on the title screen.

## Run locally

```bash
python3 -m http.server 8080 --directory gtcv6/public
```

Then open http://localhost:8080.

## Deploy (its own Cloudflare Worker, on a subdomain)

`gtcv6/wrangler.jsonc` sets up a second Worker, named `gtcv6`, that serves `gtcv6/public`. The main site's Worker and config are untouched.

1. In Cloudflare, go to **Workers & Pages → Create → Import a repository** and pick this repo.
2. Set the **root directory** to `gtcv6`. There is no build command, and the deploy command stays `npx wrangler deploy`.
3. After it deploys, open the new Worker's **Settings → Domains & Routes → Add → Custom domain** and add the subdomain, for example `gtcv6.havardvikesland.com`. Cloudflare creates the DNS record.

From then on, every push to `main` redeploys both Workers.
