# Grand Theft Cappes Vei 6

A small open-world browser game set in the rain on Cappes vei 6, in Fjellet, Bergen. You play in third person as any of the five friends who live there, and switch between them like in GTA: get home from Bryggen, throw a party on the terrace, steal one of the forty e-scooters parked around town (with the radio on) and drift it round the corners, and carry the last skillingsbolle in town home past a gang of seagulls.

It is a separate site from the main "something great is coming" page and is meant to live on its own subdomain (for example `gtcv6.havardvikesland.com`).

## What's in it

- **The real neighbourhood.** Streets, lanes, stairs and around 900 building outlines come from OpenStreetMap, and the terrain comes from Kartverket's 1 m elevation model (DTM1). The area runs from Bryggen, Mariakirken and Bergenhus along Vågen to Torget and Byparken, south past Grieghallen, Lille Lungegårdsvann and the railway station to AdO arena, then up past Domkirken and Kong Oscars gate to Fjellet and Fjellveien, and on up the mountain, through the spruce forest and up the roads and paths that really go there, to Fløyen. Bryggen's listed wharf houses get their red, ochre and white colours and steep red roofs. Cappes vei, Skivebakken, Heggebakken, Brattlien and Asylplassen are where they really are, at their real heights. Buildings get their storeys from OSM, gable roofs where the outline is a simple rectangle, and wooden cladding in Fjellet or plaster in the centre. Fløibanen runs on its real track up to Fløyen station, the real tree positions are used, a forest of spruce and birch covers the mountainside above Fjellveien, and Ulriken and the islands stand behind.
- **Cappes vei 6, room by room after the walkthrough video.** The house sits on the uphill side of a terraced row, between no. 8 (the green house) and no. 4. You enter from Cappes vei on the **upper floor** through the black door, and the stairs go **down**:
  - *Upper floor (street level):* hall with the door mat and rug, a small study by the front door (desk, black chair, white bench), the galley kitchen with grey cabinets at the end of the hall, with the top of the steep white staircase (dark treads, a peg rack above) right beside its counter, and the open dining and living room with two navy sofas, the pine wall and track lights. The bedroom with the pine wall opens off the living room.
  - *Lower floor (out to the terrace):* the stairs go down from the kitchen end towards the street, along the passage wall, and turn right at the bottom on three winders into a hall with the grey and white block-pattern floor, the stacked washer and dryer, and a dresser with a mirror and flowers. On the uphill (street) side are the toilet and the white-tiled shower room with plant shelves, side by side, and at the far end the bedroom with the lightwell window and blue cushions. On the terrace side are the bedroom with the white bed, desk and black chair, and the bedroom with the black pillow, wardrobe and white chair, whose glass door opens onto the terrace.
  - *Outside:* the side passage with steps and plants runs down from the street to the raised, fenced terrace of stone slabs and weeds, which looks out over the roofs on Skivebakken.
- **The people of Cappes vei 6, all five playable.** Håvard, Øystein, Theodor, Jaakko and Martin live there, and you can be any of them. Press Q (or Tab) for the switch wheel, or 1–5, and the sky camera does what GTA's does: three quick steps up to 360 m with a whoosh and a thud each, a glide across town looking straight down with north at the top, and three steps down to the other one, in one continuous move. When you aren't playing them, they are out in town: Håvard on Bryggen, Øystein at Rema 1000 Marken, Theodor at Magda, Jaakko at Guangdong House and Martin by Fløibanen. Whoever you leave stays where you left them, and they talk when you come close. During a story mission they are at home getting the party ready, and they gather on the terrace for the party at the end. Their faces and shirts come from photos in `public/img/people/`.
- **Places that matter:** Magda, Trekroneren, Rema 1000 Marken, Johnny's Pizza and Guangdong House have signs over the street and labels on the minimap, at their OpenStreetMap positions. The first visit to each is worth 50 kr. Trekroneren and Johnny's restore your health, Rema 1000 helps a bit, and the gulls lose track of you at Magda. They are dressed after photos (`public/js/places.js`): Guangdong House is the red house on Marken with its red sign band (廣東樓), the yellow dining room seen through the window, two red lanterns and blue-and-white chairs out front; Rema 1000 has its white walls and red tiles, the grey shopfront, REMA 1000 lettering, the blue square signs and the opening hours; Johnny's has the dark granite ground floor round its corner, columns, the wooden door under a fanlight and a hanging sign; and Trekroneren is the little red pølse kiosk with its yellow band, lit windows full of menus and two Norwegian flags. Their signs, lanterns and windows light up at night.
- **Buildings that make sense.** The map builder cleans up OpenStreetMap before the game sees it. No two buildings overlap: duplicates such as a multipolygon and the ways it is made of are dropped, and sloppy outlines are trimmed into clean party walls. Courtyards are kept, buildings that bridge a street are lifted off the ground, and roofs on posts become canopies. Roofs (gable, hip, pyramid or flat) are built over the footprint itself, so they never hang over the street. Terraced rows get their ridge across the party walls. Windows sit storey by storey and only above the ground, there are none on party walls, every building has a front door facing its street, and there are stone plinths that follow the slope, eaves with soffits and fascia boards, shopfronts in the centre, corner boards, chimneys, attic windows and parapets.
- **Streets that fit, from OpenStreetMap.** Widths come from `width`, then `lanes`, then a typical width for the kind of street; `surface` decides between asphalt, setts, paving and gravel; `sidewalk=*` adds pavements. The height of every street is solved over the whole network, so streets agree where they meet and run smoothly along their length, and the terrain is levelled to it. The streets are painted onto that terrain from two 50 cm textures, so what you see is exactly what you walk and ride on. Only steps keep their own treads. Street lamps, parked cars, benches, walls, fences and hedges come from OpenStreetMap or are placed along the streets.
- **Skydiving from Fløyen.** At the viewpoint by Fløyen station there's a jump (the red sign, and on the minimap). E takes you 450 m up over the mountain: fall with WASD, open the parachute with Space (or a click) and fly it down, A/D to turn, W to dive, S to flare. The canopy carries the Brann logo. Land softly for 25 kr; forget to open it and that's the end of you.
- **Bybanen.** The light rail's tracks run through the streets from Byparken along Kaigaten and south through Nygård, with the platforms at Byparken, Kaigaten and Nygård (a glass shelter, a bench and the stop's name on an orange sign). A five-section Variobahn tram waits at Byparken, rings its bell and runs out along the line to the edge of the map, then comes back. Don't stand in front of it.
- **Fløibanen** runs on a timetable, its two cars passing halfway: they wait 18 seconds at each station and take 75 seconds up or down. Stand by a waiting car at Vetrlidsallmenningen or on Fløyen and press E to ride it to the other end; its windows light up at night.
- **Weather** follows Bergen: rain showers come and go, with short sunny breaks. About 30 people are out on the streets around you, and 30 gulls sit on the quays and squares or circle overhead.
- **People who talk back, in Bergensk.** The people on the street have four recorded voices: Gubben, Studenten, Fruen and Optimisten. Now and then one says something as you walk past ("Brann tar gull i år. Det sier eg hvert år."). They complain when you knock them over, shout after a scooter that goes by too fast, and cry out and hurry off when a shot goes off nearby. The voice is louder the closer they are and comes from their side, with the words in a speech bubble. The lines are in [STREET.md](STREET.md), and `tools/build_street.py` cuts new recordings into clips.
- **Day and night**, a whole day every five real minutes. The sun crosses the sky and goes down in orange behind the cloud; by night the sky is dark blue (never pitch black: the town stays readable in a blue night light), with stars and the moon where the clouds break, and the moon lights the town. At dusk the street lamps come on: a glow round each head, a pool of warm light on the street under it (painted into the terrain, so it follows the slope) and a few real lights that follow you from lamp to lamp. About half the windows light up, and every shopfront. The time is under your money.
- **At night, women work the street corners** in the centre, under the lamps around Torget, Strandkaien and Vågsallmenningen: short skirts, knee boots, bright tops, boas, long hair, red lips, hoop earrings and handbags, lit so they stand out in the dark. They watch you go by, wave and call out to you, and are gone by morning. At night the scooters' headlamps glow, and the one you ride throws a beam down the street.
- **Radio Fjellet 6.** Get on an e-scooter and the radio comes on, like a car radio in GTA. The station plays the game's theme song and four more songs on one global clock that keeps running while you are off the scooter: get off for ten seconds and the song is ten seconds further on when you get back on. Regnar the DJ introduces the songs, with station IDs, outros and the news; he and his co-host Sol talk between the songs and over the middle of each one, with the music turned down under them; and there are five ads, with their own music. Each song is downloaded whole once, so the station keeps to its clock when you get off and on again, even where the server can't seek in a stream. It is a broadcast: nothing on it reacts to what you do. The scripts are in [RADIO.md](RADIO.md), and `tools/build_radio.py` puts new recordings on air. It shows the station and song when you tune in. R turns it off and on.
- **E-scooters all over town.** Forty of them: six at landmarks (Cappes vei, Domkirkeplassen, Torget, Fjellveien, Asylplassen, Bryggen) and the rest parked along the streets, at the side of the road and never on steps. They are placed from the street graph with a fixed seed, so they are in the same places every time. Hold the **right mouse button** at speed to **drift**: the back wheel lets go, the scooter turns faster than it travels and slides, with a tyre squeal and spray off the wet street; let go after a good drift for a burst of speed and some boost. Hold **Shift** to **boost**, faster and up to 17 m/s, while the blue meter under your health lasts; it refills slowly, and faster after drifts and tricks. **Space** (or T) does a **trick**: a hop with a tailwhip, a 360 if you hold A or D, or a backflip if you hold S. Land it all the way round for 15 to 40 kr; land it halfway round and you wipe out.
- **A pistol.** G draws it and puts it away. With it out, the camera moves over your right shoulder and shows a crosshair, and click (or F) fires where the crosshair points, on foot or from a moving scooter. Twelve rounds, then an automatic reload. Shots knock people over and gulls out of the air (+10 kr), make parked scooters jump, chip walls and splash in Vågen, and every shot startles the gulls nearby. Shooting people or gulls raises the Måkealarm.
- **Måkealarm** is the wanted level, five seagull icons. Punch or shoot gulls or people and the gang comes for you: one to six of them circle, and a few at a time dive. A dive homes in from afar but commits to its line about 4.5 m out, so running or swerving makes it miss; after a hit you get a moment's grace, and your health comes back after three seconds. Hide indoors and the alarm drops faster.
- **The umbrella.** G goes round what you hold: the pistol, the umbrella, nothing. Open, the umbrella takes the gulls' dives (they bounce off it), and stand still under it for seven seconds and they give up: the Måkealarm is over. It's in the left hand, so it goes with the skillingsbolle.
- **Five missions on real streets, offered as texts.** You start in free roam. The next story mission comes as a text from one of the housemates, which you accept with Y or put off with N. Missions that start somewhere show a marker and the GPS route. The missions: walk home from Bryggen, borrow the landlord's things around the house, steal an e-scooter and race the real route to the bakery on Torget, carry the last skillingsbolle home, then get dinner from Guangdong House before it closes. Story missions are Håvard's: switch back to him to get them. A GPS line on the minimap shows the route (A* over the OSM street graph), and the HUD shows which street you are on. There are also 14 lost umbrellas at real spots. Progress is saved in the browser's `localStorage`.

Controls: WASD to move, mouse to look, Shift to run, Space to jump, click or F to punch (or shoot), G for the pistol or the umbrella, E to get on and off scooters, and on a scooter Space (or T) for a trick, Shift to boost and the right mouse button held to drift, R for the radio, Q or 1–5 to switch character, Y/N to answer a mission text, Esc to pause. Phones and tablets get touch controls (on a scooter, Jump does a trick, hold Drift to drift, Run toggles the boost).

## Files

Plain static files with no build step. The only library is three.js, vendored.

| File | What it is |
| --- | --- |
| `public/index.html`, `public/style.css` | Title screen, HUD, pause menu, touch controls |
| `public/js/game.js` | Main loop, player and camera, character switching, scooters (drifting) and the radio, the pistol and particle effects, seagull AI, pedestrians on the street graph, mission offers and missions, HUD, minimap and GPS |
| `public/js/buildings.js` | Facades, roofs (height fields over the footprint), courtyards, canopies, the shared texture atlas, and the 100 m level-of-detail tiles for buildings and streets |
| `public/js/city.js` | Builds the town from the map data: terrain meshes (with the streets painted on), buildings, steps, trees, water, Fløibanen; polygon collision for buildings |
| `public/js/house6.js` | Cappes vei 6, its side passage and terrace, in a local frame aligned with the real outline |
| `public/js/physics.js` | One collision interface over terrain, building polygons and the house's local box world |
| `public/js/engine.js` | Geometry batching and the box collision world used for the house |
| `public/js/places.js` | Guangdong House, Rema 1000, Johnny's and the Trekroneren kiosk, dressed after photos |
| `public/js/tram.js` | Bybanen: the rails, the platforms and the tram with its timetable |
| `public/js/actors.js`, `textures.js`, `audio.js` | People (one skinned mesh and texture atlas each, with an aiming pose), seagulls, scooters, the pistol and pickups; procedural textures; synthesised sound and the scooter radio |
| `public/audio/` | The radio's five songs (MP3, 128 kbps) and, in `radio/`, its talk (96 kbps mono) with `clips.json`, the list of clips on air and their durations; the audio loads only when first tuned in. `street/` has the people's lines (96 kbps mono, one clip per line, with their own `clips.json`), which load in the background after the start |
| `public/img/brann.png` | The Brann logo, for the parachute |
| `public/img/people/` | Face and shirt textures for Håvard, Øystein, Theodor, Martin and Jaakko |
| `public/data/` | The packed map: `map.json` (buildings, streets, trees, funicular, walking graph, the house's frame), `terrain.bin` (2.5 m grid, about 1460 × 1720 m, streets levelled), `coarse.bin` (60 m grid for the mountains), `ground.bin` (ground types), `roads.png` and `paths.png` (the street surfaces at 50 cm) |
| `tools/fetch_data.py`, `tools/build_map.py` | Download OSM and Kartverket data, then clean it up (overlaps, duplicates, roof shapes, streets levelled into the terrain) and pack it into `public/data/` |
| `tools/build_radio.py` | Puts recorded talk on the radio: joins the conversations' lines, levels everything to −16 LUFS, writes MP3 and `clips.json` (see RADIO.md) |
| `tools/build_street.py` | Cuts the recorded takes of the people's lines into one clip per line, levelled and trimmed (see STREET.md) |
| `public/vendor/three.module.min.js` | three.js r186.1, bundled and minified (MIT) |

See [`REVIEW.md`](REVIEW.md) for the fidelity and performance review: what was measured, what was changed (one-draw-call skinned characters, atlas materials, tiled level of detail for buildings and terrain, GPU rain), and what would come next.

Debug URL options: `?q=low` pins a low render resolution (otherwise the resolution adapts to the frame rate); `?hour=22` starts the clock at 22:00.

### Rebuilding the map data

```bash
pip install shapely numpy pillow
python3 gtcv6/tools/fetch_data.py /tmp/gtcv6-raw          # needs api.openstreetmap.org and ws.geonorge.no
python3 gtcv6/tools/build_map.py /tmp/gtcv6-raw gtcv6/public/data
```

The fetch downloads about 45 MB of OSM tiles and makes roughly 8,100 small elevation requests (50 points each, around an hour), so please don't run it often.

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
