# Grand Theft Cappes Vei 6

A small open-world browser game set in the rain on Cappes vei 6, in Fjellet, Bergen. You play in third person as any of the five friends who live there, and switch between them like in GTA: get home from Bryggen, throw a party on the terrace, steal an e-scooter (with the radio on), and carry the last skillingsbolle in town home past a gang of seagulls.

It is a separate site from the main "something great is coming" page and is meant to live on its own subdomain (for example `gtcv6.havardvikesland.com`).

## What's in it

- **The real neighbourhood.** Streets, lanes, stairs and around 900 building outlines come from OpenStreetMap, and the terrain comes from Kartverket's 1 m elevation model (DTM1). The area runs from Bryggen, Mariakirken and Bergenhus along Vågen to Torget, then up past Domkirken and Kong Oscars gate to Fjellet and Fjellveien. Bryggen's listed wharf houses get their red, ochre and white colours and steep red roofs. Cappes vei, Skivebakken, Heggebakken, Brattlien and Asylplassen are where they really are, at their real heights. Buildings get their storeys from OSM, gable roofs where the outline is a simple rectangle, and wooden cladding in Fjellet or plaster in the centre. Fløibanen runs on its real track up to Fløyen, the real tree positions are used, and Ulriken, Fløyen and the islands stand behind.
- **Cappes vei 6, room by room after the walkthrough video.** The house sits on the uphill side of a terraced row, between no. 8 (the green house) and no. 4. You enter from Cappes vei on the **upper floor** through the black door, and the stairs go **down**:
  - *Upper floor (street level):* hall with the door mat and rug, a small study by the front door (desk, black chair, white bench), the galley kitchen with grey cabinets at the end of the hall, with the top of the steep white staircase (dark treads, a peg rack above) right beside its counter, and the open dining and living room with two navy sofas, the pine wall and track lights. The bedroom with the pine wall opens off the living room.
  - *Lower floor (out to the terrace):* the stairs go down from the kitchen end towards the street, along the passage wall, and turn right at the bottom on three winders into a hall with the grey and white block-pattern floor, the stacked washer and dryer, and a dresser with a mirror and flowers. On the uphill (street) side are the toilet and the white-tiled shower room with plant shelves, side by side, and at the far end the bedroom with the lightwell window and blue cushions. On the terrace side are the bedroom with the white bed, desk and black chair, and the bedroom with the black pillow, wardrobe and white chair, whose glass door opens onto the terrace.
  - *Outside:* the side passage with steps and plants runs down from the street to the raised, fenced terrace of stone slabs and weeds, which looks out over the roofs on Skivebakken.
- **The people of Cappes vei 6, all five playable.** Håvard, Øystein, Theodor, Jaakko and Martin live there, and you can be any of them. Press Q (or Tab) for the switch wheel, or 1–5, and the camera flies up over the town and down to the other one, as in GTA. When you aren't playing them, they are out in town: Håvard on Bryggen, Øystein at Rema 1000 Marken, Theodor at Magda, Jaakko at Guangdong House and Martin by Fløibanen. Whoever you leave stays where you left them, and they talk when you come close. During a story mission they are at home getting the party ready, and they gather on the terrace for the party at the end. Their faces and shirts come from photos in `public/img/people/`.
- **Places that matter:** Magda, Trekroneren, Rema 1000 Marken, Johnny's Pizza and Guangdong House have signs over the street and labels on the minimap, at their OpenStreetMap positions. The first visit to each is worth 50 kr. Trekroneren and Johnny's restore your health, Rema 1000 helps a bit, and the gulls lose track of you at Magda.
- **Buildings that make sense.** The map builder cleans up OpenStreetMap before the game sees it. No two buildings overlap: duplicates such as a multipolygon and the ways it is made of are dropped, and sloppy outlines are trimmed into clean party walls. Courtyards are kept, buildings that bridge a street are lifted off the ground, and roofs on posts become canopies. Roofs (gable, hip, pyramid or flat) are built over the footprint itself, so they never hang over the street. Terraced rows get their ridge across the party walls. Windows sit storey by storey and only above the ground, there are none on party walls, every building has a front door facing its street, and there are stone plinths that follow the slope, eaves with soffits and fascia boards, shopfronts in the centre, corner boards, chimneys, attic windows and parapets.
- **Streets that fit, from OpenStreetMap.** Widths come from `width`, then `lanes`, then a typical width for the kind of street; `surface` decides between asphalt, setts, paving and gravel; `sidewalk=*` adds pavements. The height of every street is solved over the whole network, so streets agree where they meet and run smoothly along their length, and the terrain is levelled to it. The streets are painted onto that terrain from two 50 cm textures, so what you see is exactly what you walk and ride on. Only steps keep their own treads. Street lamps, parked cars, benches, walls, fences and hedges come from OpenStreetMap or are placed along the streets.
- **Weather** follows Bergen: rain showers come and go, with short sunny breaks. About 30 people are out on the streets around you, and 30 gulls sit on the quays and squares or circle overhead.
- **Radio Fjellet 6.** Get on an e-scooter and the radio comes on, like a car radio in GTA. The station plays the game's theme song and four more songs on its own clock, so you tune in mid-song, and it shows the station and song when you do. R turns it off and on.
- **Måkealarm** is the wanted level, five seagull icons. Punch gulls or people and the gang dives at you. Hide indoors and the alarm drops faster.
- **Five missions on real streets, offered as texts.** You start in free roam. The next story mission comes as a text from one of the housemates, which you accept with Y or put off with N. Missions that start somewhere show a marker and the GPS route. The missions: walk home from Bryggen, borrow the landlord's things around the house, steal an e-scooter and race the real route to the bakery on Torget, carry the last skillingsbolle home, then get dinner from Guangdong House before it closes. Story missions are Håvard's: switch back to him to get them. A GPS line on the minimap shows the route (A* over the OSM street graph), and the HUD shows which street you are on. There are also 14 lost umbrellas at real spots. Progress is saved in the browser's `localStorage`.

Controls: WASD to move, mouse to look, Shift to run, Space to jump, click or F to punch, E to get on and off scooters, R for the radio, Q or 1–5 to switch character, Y/N to answer a mission text, Esc to pause. Phones and tablets get touch controls.

## Files

Plain static files with no build step. The only library is three.js, vendored.

| File | What it is |
| --- | --- |
| `public/index.html`, `public/style.css` | Title screen, HUD, pause menu, touch controls |
| `public/js/game.js` | Main loop, player and camera, character switching, scooters and the radio, seagull AI, pedestrians on the street graph, mission offers and missions, HUD, minimap and GPS |
| `public/js/buildings.js` | Facades, roofs (height fields over the footprint), courtyards, canopies, the shared texture atlas, and the 100 m level-of-detail tiles for buildings and streets |
| `public/js/city.js` | Builds the town from the map data: terrain meshes (with the streets painted on), buildings, steps, trees, water, Fløibanen; polygon collision for buildings |
| `public/js/house6.js` | Cappes vei 6, its side passage and terrace, in a local frame aligned with the real outline |
| `public/js/physics.js` | One collision interface over terrain, building polygons and the house's local box world |
| `public/js/engine.js` | Geometry batching and the box collision world used for the house |
| `public/js/actors.js`, `textures.js`, `audio.js` | People (one skinned mesh and texture atlas each), seagulls, scooters and pickups; procedural textures; synthesised sound and the scooter radio |
| `public/audio/` | The radio's five songs (MP3, 128 kbps), loaded only when first tuned in |
| `public/img/people/` | Face and shirt textures for Håvard, Øystein, Theodor, Martin and Jaakko |
| `public/data/` | The packed map: `map.json` (buildings, streets, trees, funicular, walking graph, the house's frame), `terrain.bin` (2.5 m grid, about 900 × 1010 m, streets levelled), `coarse.bin` (60 m grid for the mountains), `ground.bin` (ground types), `roads.png` and `paths.png` (the street surfaces at 50 cm) |
| `tools/fetch_data.py`, `tools/build_map.py` | Download OSM and Kartverket data, then clean it up (overlaps, duplicates, roof shapes, streets levelled into the terrain) and pack it into `public/data/` |
| `public/vendor/three.module.min.js` | three.js r186.1, bundled and minified (MIT) |

See [`REVIEW.md`](REVIEW.md) for the fidelity and performance review: what was measured, what was changed (one-draw-call skinned characters, atlas materials, tiled level of detail for buildings and terrain, GPU rain), and what would come next.

Debug URL option: `?q=low` pins a low render resolution. Otherwise the resolution adapts to the frame rate.

### Rebuilding the map data

```bash
pip install shapely numpy pillow
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
