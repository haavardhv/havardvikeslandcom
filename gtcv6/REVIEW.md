# Review: fidelity and performance

A review of Grand Theft Cappes Vei 6, done after the move to real map data. It covers what looked wrong or fake, what cost too much to draw, and what was changed. Everything listed under "Done" is implemented in this commit.

## Measurements

All numbers come from the same four camera positions, rendered in headless Chromium. Draw calls and triangles are per frame, shadow pass included.

| View | Draw calls before | Draw calls after | Triangles before | Triangles after |
| --- | --- | --- | --- | --- |
| Cappes vei, outside no. 6 | 524 | 171 | 198 k | 318 k |
| Bryggen quay | 849 | 359 | 423 k | 344 k |
| Torget | 659 | 289 | 370 k | 342 k |
| Inside no. 6 | 474 | 148 | 222 k | 320 k |

Draw calls fell by 55–70%, and this is what matters most in WebGL: each call costs CPU time in the browser and the driver. Triangle counts stayed in the same range while the scene gained a lot of detail. That includes real windows, doors, sills, corner boards, chimneys and parapets, about 800 street lamps, parked cars, walls, fences, hedges and benches. On the Bryggen quay the count actually dropped.

## Fidelity

### Findings

1. **Wrong colour for no. 6.** The video shows the black front door in the wall of the green house, so Cappes vei 6 is green and the neighbour is grey. The game had it the other way round.
2. **Windows were wallpaper.** Every wall had the same repeating window texture. That put windows on party walls between terraced houses, underground on the uphill side of slopes, and at random heights across storeys. No building had a front door.
3. **Blocky characters.** The people were stacked boxes with a photo on one face of the head cube.
4. **Flat lighting.** There was no environment light, so wet streets and windows had nothing to reflect, and buildings sat on the ground without any contact shadow.
5. **Empty streets.** The streets had no lamps, cars, walls or fences, which are what make Bergen's lanes look like Bergen.
6. **Flat water.** Vågen was a flat-coloured plane.

### Done

- **No. 6 is green**, with a grey neighbour, as in the video.
- **Facades follow rules** (`public/js/buildings.js` and `tools/build_map.py`):
  - **Party walls:** the map builder samples five points just outside every wall edge. An edge that touches another building, or house 6 itself, gets no windows. About 2,800 of 15,000 edges are party walls.
  - **Storeys:** they are counted down from the eaves. A window is only placed where its sill is above the ground at that exact bay, so downhill sides get more storeys than uphill sides, as they do in Fjellet.
  - **Front doors:** each building gets one, on the free edge nearest a street, at the point closest to it. Garages get a garage door, and shops get a glass door. 1,682 buildings have one.
  - **Stone plinths** follow the slope, so the downhill side gets a tall foundation wall. Shopfronts sit on the ground floors of commercial buildings in the centre.
  - **Wooden houses** get white corner boards, sills under the windows, and a white fascia board along the eaves.
  - **Bryggen** gets small six-pane windows.
  - **Roofs:** gable roofs get attic windows and chimneys, and flat roofs get a parapet with a stone cap.
- **Human characters** (`public/js/actors.js`):
  - **Body:** a turned body profile runs from the hips through the waist and chest to the shoulders. Limbs are tapered, with elbows and knees, plus hands, ears, a neck, a shaped jaw and hair over the top and back of the head.
  - **Photos:** the face is projected onto the rounded head, and only the chest part of the shirt photo is used.
  - **Animation:** knees bend through the stride, and elbows swing.
- **Lighting:**
  - **Reflections:** the sky is rendered into a prefiltered environment map for image-based lighting. It refreshes when the weather changes. Wet streets, glass and the harbour now pick up the sky.
  - **Contact shadows:** the ground near walls is darkened, baked from the building outlines. Wall bases and plinths are darker towards the ground.
- **Street furniture:**
  - **From OpenStreetMap:** walls, retaining walls, fences, hedges and guard rails, plus the real bench positions.
  - **Street lamps** about every 28 m along the bigger streets.
  - **Parked cars** in the car parks mapped in OpenStreetMap and along the flatter residential streets, but not on steep slopes. You can jump on them.
- **Water:** a tiling wave normal map, animated, with sky reflections.

## Performance

### Findings

1. **Characters:** each person was about 25 separate meshes, so 15 people meant around 375 draw calls before shadows. Gulls were about 14 meshes each.
2. **Streets:** six road materials per 150 m tile, about 300 draw calls in a dense view.
3. **Rain:** 2,600 drops updated in JavaScript and uploaded to the GPU every frame.
4. **Terrain:** full 2.5 m resolution everywhere, about 290k triangles, regardless of distance.
5. **Shadow map:** re-rendered every frame, although the world is static.

### Done

- **Characters:**
  - **One skinned mesh per person:** a single geometry with a skeleton (rigid skinning, one bone per part) and a per-person texture atlas, so each person is one draw call (two with shadows).
  - **Distance culling:** people are hidden beyond 95 m and stop casting shadows beyond 35 m.
  - **Gulls** are merged into 5 meshes each and hidden beyond 170 m.
- **Atlas material:** walls, roofs and every street surface share one material through a texture atlas. A small shader extension tiles each cell with correct mipmapping using `textureGrad`. A 100 m tile of town is now **two draw calls**: opaque geometry, plus windows and doors.
- **Hierarchical level of detail (HLOD).** This is the practical WebGL version of what Nanite does, which is to draw detail only where it is visible on screen:
  - **Building tiles:** each 100 m tile has a near level (full window geometry) and a far level (walls with painted windows) beyond 230 m.
  - **Terrain:** split into 100 m tiles with three levels (2.5, 5 and 10 m vertex spacing, switching at 110 m and 260 m). Skirts hang from every tile edge so the seams between levels never crack.
  - **Frustum culling:** everything is chunked spatially, so the renderer skips what is off-screen tile by tile rather than drawing whole-city meshes.
- **Instancing** for trees, street lamps and parked cars: one draw call each for the whole map.
- **Rain on the GPU:** every drop's position comes from a random seed and the time in the vertex shader, so the CPU cost and buffer uploads are gone. That made it cheap to double the drop count. Inside the house the drops are discarded in the shader.
- **Shadows** re-render every other frame instead of every frame.
- **Fences** are textured panels with alpha-tested gaps (12 triangles per 3 m) instead of individual pickets, which saved about 200k triangles.
- **Minimap shading** is computed at half resolution, which cuts load time.

## What Nanite is, and what would come next

Nanite, Unreal Engine 5's geometry system, splits meshes into small clusters arranged in a hierarchy, picks a level of detail per cluster each frame, and culls clusters hidden behind others. All of it runs on the GPU and draws through a software rasteriser. WebGL 2 lacks compute shaders, mesh shaders and indirect draws, so it can't do that directly. The building-tile and terrain levels of detail above cover the same idea at the scale this map needs. Further steps, in order of payoff:

1. **Occlusion culling.** Fjellet is dense and steep, and from street level most tiles are hidden behind the first row of houses or the hillside. A cheap way to exploit that: render the terrain and nearby buildings into a low-resolution depth buffer, read it back once every few frames, and test each tile's bounding box against it. WebGL 2 occlusion queries (`ANY_SAMPLES_PASSED_CONSERVATIVE`) are another option, with a frame of latency.
2. **Impostors for the far town.** The far level could be a few textured boxes per tile (one per block) instead of every outline. That would roughly halve far-away triangles again.
3. **WebGPU.** three.js has a WebGPU renderer. With compute shaders, the culling above and true cluster-based level of detail (meshlets) become possible. That is the closest real path to Nanite in the browser, but it means moving off `onBeforeCompile` materials to node materials.
4. **Compressed textures.** KTX2/Basis atlases would use about 4× less GPU memory and upload faster.
5. **A Web Worker for the city build.** Generating buildings and streets takes about 1.2 s on a slow CPU. Doing it in a worker, or baking it into the data at build time, would make loading smoother.

## Fidelity: what would come next

- **Real facade data.** Kartverket's FKB building data (or a photo-based source) has the real number of floors and roof shapes, where OpenStreetMap has none for most buildings. Colours for individual houses would need a survey or Street View, so they are still drawn from a Bergen palette. No. 6 and its two neighbours are set by hand from the video.
- **Dormers and bay windows**, plus the outdoor stairs and stoops so typical of Fjellet. OpenStreetMap does map some of these as `highway=steps` against buildings, which could be used to place them.
- **Time of day.** A dusk setting with lit windows, street lamps on and wet reflections would show off the image-based lighting best.
- **Post-processing.** Screen-space ambient occlusion and a light bloom on lamps. Both cost GPU time on phones, so they should be optional.

## World-building overhaul

A second pass, after reports of buildings floating in the street and buildings doubled on top of each other. Each cause was found in the data or in a screenshot, then fixed at its source.

### What was wrong

| Problem | Cause | Before | After |
| --- | --- | --- | --- |
| Copies of buildings in the water, in streets and on top of other buildings, anywhere more than 230 m away | The far level of each 100 m building tile was moved to the tile's frame with `position.set`, but the mesh does not update its own matrix (`matrixAutoUpdate = false`). So every far tile was drawn shifted by its tile's centre, for example a block by Korskirken appeared on the water off Bryggen. | Every tile beyond 230 m | Fixed: the matrix is updated after the move |
| Roofs and gables hanging in the air over the street | Gable roofs were built on the footprint's minimum bounding rectangle, not on the footprint. `roof:shape=gabled` forced a gable on any shape. | 873 roofs stuck out past their walls, about 12,700 m² of roof with nothing under it | 0: the roof is a height field over the footprint itself |
| Floating fascia boards and gable triangles seen from the street | Roofs were single-sided, so from below only the trim was drawn | | The roof has thickness, a soffit under the eaves and a fascia along the edge |
| Doubled buildings | Multipolygon relations were drawn on top of the ways they are made of (Scandic Torget, Torgegaarden and Saltødegaarden three times, Thon Hotel Bristol, the university buildings). Sloppy outlines overlapped. | 20 overlapping pairs, 6 complete duplicates | 2 slivers under 2 m² (coordinate rounding) |
| Blocks standing in the street | Buildings that bridge a street (`building:min_level`, `min_height`) were drawn from the ground up | 2 | Lifted to their real height, with an underside |
| A church tower alone in a field | The tower was placed at the west-most corner plus 4.5 m, which is often outside the church | Partly outside for 4 of 6 churches | Placed at one end of the nave, only where it fits inside |
| Buildings standing in the water at the edge of the map | Buildings up to 40 m outside the detailed terrain sat on the 60 m mountain grid | 168 | 0: footprints are clipped to the detailed terrain |
| Streets running under houses | OpenStreetMap gives a centre line and a typical width. A 5 m residential street is often 3.5 m between real walls. | 146 buildings overlapped a street ribbon by more than 4 m² | Each side of a street stops 15 cm short of the nearest wall, checked every 2 m along it |
| Grass and slopes poking through streets | Ribbons were draped on the 2.5 m terrain grid across a side slope | | The terrain is levelled across every street, and blended back into the hillside over the next 2.5 m |
| Buildings floating at a distance | The far terrain levels (5 m and 10 m grids) can sit a metre or two below a building's base | | Building walls start 4 m below the lowest ground under them |

### How the world is built now

- **Footprints** (`tools/build_map.py`):
  - **Relations:** multipolygon relations are assembled from their member ways into proper rings, courtyards included.
  - **Overlaps:** every footprint is resolved against the others, smallest first. A footprint keeps only what no earlier one covers. If that is less than half of it, it was a duplicate, and it hands any tags the survivor lacks (levels, height, name, roof shape) to the survivor.
  - **What else is kept:** roofs on posts (`building=roof`) become canopies, and nothing is kept outside the detailed terrain.
- **Heights:** the ground is sampled every metre along every wall and on a 2.5 m grid inside the footprint. The eave is always at least one storey above the highest ground, so uphill sides are never buried.
- **Roofs** are chosen in the map builder and stored as a shape plus a frame (centre, ridge direction, half length and half width):
  - **Shape:** from `roof:shape` when OpenStreetMap has it, otherwise from the style, kind and how rectangular the footprint is.
  - **Terraced rows:** the party walls become the gable ends, so the ridge runs along the row.
  - **Geometry** (`public/js/buildings.js`): the footprint is triangulated and split into pieces along the lines where two roof planes meet. Every wall is split at the same lines and rises to exactly the roof line above it, so gables are always closed and nothing overhangs except the eaves.
  - **Eaves:** free edges get a 35 cm eave with a soffit and a fascia board. Edges against a neighbour stay flush.
- **Streets:**
  - **Terrain:** each street gets a height profile along its centre line, smoothed a little. Terrain nodes within half the width plus 2.5 m take that height, and the next 2.5 m blend back into the hillside. A node is left alone when that would mean a cut steeper than about 60 %. That happens where it belongs to another street at another level, such as the legs of Fjellveien's hairpins. House 6 and the sea are not touched, and Cappes vei in front of the door moved by less than 10 cm.
  - **Ribbons:** the game pulls each side of a ribbon in to the nearest wall, and street lamps keep 60 cm off walls.
- **Shorelines:** a coarse terrain vertex that would drop below the sea while there is land in its cell takes the land's height, so quays don't sink at a distance.
- **Collision** understands courtyards, so you can walk into one.
- **Under buildings,** terrain nodes just inside a wall are capped at the highest ground outside it. Otherwise the 2.5 m triangulation shows the step between a raised plot and the street as a row of grassy teeth along the wall.
- **Street ribbons** get a vertex every 1.5 m along and about every 1.8 m across, so they follow the terrain mesh instead of spanning it with two edges.

### Cost

Measured the same way as above (headless Chromium, one frame, the same camera positions):

| View | Draw calls before | Draw calls after | Triangles before | Triangles after |
| --- | --- | --- | --- | --- |
| Cappes vei | 164 | 161 | 318 k | 341 k |
| Bryggen | 399 | 439 | 376 k | 558 k |
| Torget | 110 | 102 | 327 k | 369 k |

Roofs, soffits, canopies and streets still go into each tile's shared meshes, so the count of draw calls is about the same. The extra triangles come from the finer street ribbons, the roof pieces and eaves, and, in the Bryggen view, from distant tiles that are now drawn where they belong. Before, they were shifted off to one side, often out of view. The map builder takes about 6 s, and `map.json` shrank from 809 KB to 783 KB.

## Inside Cappes vei 6: getting around

The same method, applied to the house. Its collision blocks were dumped and flood-filled at the player's size: 0.3 m radius, 1.8 m tall, 0.5 m step. Then a scripted walk drove the real player, with key presses and the game's own physics, along a 45-waypoint route. The route goes from the street through every doorway on both floors, down the stairs and out to the terrace.

| | Before | After |
| --- | --- | --- |
| Rooms you could not get into | Upper bedroom, lower bedrooms 3 and 4 | None |
| Scripted walk, waypoints where the player got stuck | 8 of 45 | 0 of 45 |

### What was in the way

- **Furniture in front of doors, under low lintels.** The second sofa stood right in front of the upper bedroom door. A bed or sofa is low enough to step onto, but standing on it your head (1.8 m) hits a 2.05 m lintel, so the room could not be entered at all. Bedroom 4's bed started right inside its door. Bedroom 3's door opened onto a 20 cm gap between the wardrobe and the bed. The lower study's 2.1 m wardrobe covered half its door.
- **A housemate in the corridor.** Housemates push the player out to 0.55 m. Jaakko stood in the middle of the 1 m lower corridor, so nobody could get past him to bedroom 3 or the study.
- **Narrow doorways.** Interior doors were 0.8 m wide for a player 0.6 m across.
- **No floor in the doorways of the outer walls.** The 30 cm wall thickness under the front and terrace doors had no floor. At walking speed you skipped over it, but slowly you could drop through.
- **Door leaves in the corridors.** Open doors stood out into the passages.

### What changed (`public/js/house6.js`, `HOME_SPOTS` in `public/js/game.js`)

- **Doors:**
  - Interior doorways are 0.95–1 m wide with 2.2 m lintels.
  - Every open door stands into its own room against the hinge side.
  - The front and terrace doors have stone thresholds you can stand on.
- **Furniture:** each door now has a clear path into its room, and the rooms are the same as in the video.
  - **Living room:** the second sofa moved under the terrace windows, making an L with the sofa on the pine wall. Theodor sits on it.
  - **Bedroom 3:** the bed moved to the street wall and the wardrobe out of the doorway.
  - **Bedroom 4:** its door moved to the corridor junction, clear of the bed.
  - **Lower study:** the wardrobe moved further in.
  - **Dresser:** the dresser at the end of the corridor is slimmer.
- **Jaakko** stands by his desk in bedroom 2, away from the corridor and the doorway.

### The lower floor, redrawn

The lower floor was wrong: it had four bedrooms, a study and one bathroom. It is now built after the walkthrough video (1:10–2:30) and Håvard's sketch of the floor plan.

- **Stairs and hall:** the stairs come down along the passage wall into a hall with the grey and white block-pattern floor, the stacked washer and dryer, and a dresser with a mirror and flowers between the two bathroom doors.
- **Street side** (buried, so lit by a lightwell):
  - the toilet (sink and toilet side by side);
  - the shower room (shower with a curtain, wall-hung toilet, sink, shelves with plants);
  - at the far end, the bedroom with the lightwell window and the blue cushions.
- **Terrace side:**
  - the bedroom with the white bed, desk, black chair and wardrobe, with its window at garden level;
  - the bedroom with the black pillow, wardrobe, desk and white chair. Its glass door is the way out to the terrace.

The sketch gives the arrangement, and the sizes come from the house's outline and the video. The same checks were run on the new floor:

- **Flood fill:** every room is reachable from the street.
- **Scripted walk:** all 45 waypoints reached, through the street door, every doorway on both floors, down the stairs, through the black-pillow bedroom and out onto the terrace.
- **Doors:** open doors stand against the nearer wall, so no leaf stands across a doorway's line of sight.
- **Mission text:** the texts that send you to the terrace now say to go through the black-pillow bedroom.

### The stairs, the right way round

The stairs went down the wrong way. They now start at the kitchen end of the upstairs hall, beside the counter, as in the video (about 0:59 and 1:10). They go down along the passage wall towards the street, then turn right on three winder treads into the downstairs hall, by the two bathroom doors (about 1:17).

- **Upstairs:** the fridge moved from the top of the stairs to the far end of the kitchen run. The old stairwell by the front door became hall floor.
- **Stairwell opening:** it reaches 35 cm past the bottom of the straight flight, so your head clears the floor edge above the last treads.
- **Banister and entry:** the banister stops 1 m short of the top, so you step onto the stairs from the end of the hall.
- **Downstairs:** the toilet is shallower, and a closet sits in the corner beside the stair foot.
- **Checks:** the flood fill reaches the whole house. The scripted walk reaches every waypoint down the new stairs and through every room (46 of 46), and every waypoint back up from the terrace to the upstairs hall (12 of 12).

## Streets you can walk and ride on

The streets had kerbs and cliffs in them, and stray strips of road sticking out over the grass. The streets were separate strips laid over the terrain, and they could never quite follow it.

Measured along every street's centre line every 50 cm, on the terrain the game uses:

| | Before | After |
| --- | --- | --- |
| Drivable streets (19 km): sudden jumps of more than 20 cm within 50 cm | 224 | 82 |
| Drivable streets: sharp bumps | 637 | 450 |
| Drivable streets: sideways tilt over 12 % | 7.2 % | 6.3 % |
| Footways and paths (28 km): jumps | 718 | 620 |

What made the difference, in the order it was found:

- **Steps beside a road took part of the road.** Each terrain node took the height of the street whose centre line was nearest. A flight of steps beside a road at another level could therefore claim nodes inside the road (Bispengsgaten had a 7 m cliff in it). Now a node on a road's surface belongs to the road, and where several streets of the same kind overlap (at junctions, or two lanes side by side), their heights are blended, so they meet with a ramp instead of a step.
- **Lanes narrower than a terrain cell.** The terrain is a 2.5 m grid drawn as two triangles per cell. A 2.5 m lane against an embankment had one corner of the triangle under it up on the embankment. Every triangle a street passes over is now levelled.
- **Profiles over the whole network.** Every street is sampled every metre. Streets share one height where they meet, and are smoothed along their length towards the measured ground (strongly for roads, lightly for steps). This removed less than expected (the measured ground was already good along the streets), but it makes junctions agree.
- **Widths and surfaces from OpenStreetMap:** `width`, `lanes`, `surface` (on 1,333 of 1,710 ways) and `sidewalk=*`.
- **Painted, not draped.** The streets are part of the terrain, painted on from two 50 cm textures that the map builder rasterises with soft edges and buildings cut out. Only steps keep geometry, for the direction of their treads.

The remaining jumps are mostly at one junction where three steep streets meet at different levels (Bernhard Meyers vei, Øvre Korskirkeallmenningen and Bispengsgaten), and where OpenStreetMap's steps meet a road across a retaining wall.

## City pass: flickering walls, bad geometry, and a town you can recognise

Every finding below came from screenshots of the real game in headless Chromium, taken at fixed viewpoints before and after.

### Z-fighting and bad geometry

| Problem | Cause | Fix |
| --- | --- | --- |
| Windows flickering through shopfronts | On shop buildings the lowest row of windows was drawn on top of the shopfront in the same plane | The ground floor of a shop is its shopfront: no window there, a sign band above it |
| Windows, doors and corner boards flickering on distant walls | Decals 2–7 cm off the wall, a 0.08 m near plane and a 24-bit depth buffer | The decal material draws with a polygon offset; the near plane is 14 cm outdoors (8 cm indoors) |
| Flicker on Rema 1000, Johnny's and Guangdong House | The dressings sat 1 cm from the generated windows and door casings, Johnny's granite exactly on the casing | Those buildings get no generated windows or door on the ground floor (`bareBelow`) |
| City hall tower flickering at its base | The tower was drawn in the plane of the OSM building under it | The whole building is modelled |
| Churches as six-storey blocks of arched windows, with flat roofs | Churches got storeys like houses, and no roof when OSM had no roof shape | One tier of tall lancets, nave-height walls, a steep gable along the nave |
| Slope houses with ten rows of windows down their downhill side | Windows went all the way down to the street | Below about one storey under the middle of the ground, the wall is a stone foundation |
| Blotchy plaster | Dark circles in the plaster texture | Fine grain and soft rain streaks |
| Lille Lungegårdsvann was grass | The lake is a multipolygon of three open ways that the builder skipped, and its surface is above the sea plane | Rings are joined; every lake gets its own level and a dug basin |
| A sawtooth shore along the harbour | The 2.5 m terrain grid | The ground is dug out on the water side of OSM's coastline and a stone quay wall stands on it |
| A hang when the page loaded | The dash walker for road markings could stall on a floating-point remainder | Fixed |

### What was added

- **The map** reaches Skuteviken and Bergenhus: the fine grid is now 1760 × 2310 m (was 1460 × 1720), 4,519 buildings (was 2,800). The old area's heights were reused; only the new ground was fetched.
- **Landmarks after photographs** (Wikipedia/Wikimedia Commons; `public/js/landmarks.js`): Bryggen, Domkirken, Korskirken, Mariakirken, Johanneskirken, Håkonshallen, Rosenkrantztårnet, Bergen stasjon, Rådhuset, Mathallen and the fish market, Den blå steinen, Bergens Tidende's neon sign, Musikkpaviljongen, Sjømannsmonumentet, the statues and the lake fountain. Each is built on its OSM outline, so it sits where it really is.
- **Bryggen**: the ridges now run back from the quay, so every house shows its gable to the harbour, as in every photo of it. Before, the builder's rule for terraced rows had put the ridges along the row.
- **Streets**: yellow centre lines, white edge lines, 417 zebra crossings, 42 km of granite kerbs, quay walls with bollards and fenders, nicer parked cars, and 420 real shop names on signs.
- **Colours** after photos: white-dominated wooden houses with cream, yellow, pale green and grey-blue ones, plastered blocks in white, cream, ochre, salmon and grey, and more clay-tile roofs.

### Cost

Road paint goes into each tile's decal batch and kerbs into its wall batch, so neither adds draw calls. The shop signs are two draw calls for the whole town. Each landmark is a handful of draw calls and is culled with its own bounding sphere. Measured in the same headless Chromium (software rendering), the game is ready to play after 6.3 s, up from 4.0 s, mostly for the bigger map.

### The map grows again: all of Store Lungegårdsvann and the university

The fine grid is now 2180 × 2950 m (x −1120…1060, z −1350…1600), with 5,579 buildings. The old area's measured heights were kept and only the new ground (379,000 points) was fetched. With the bigger area the street-surface textures moved from 50 cm to 75 cm to the pixel, so they stay under 4096 px (2907 × 3933), the largest texture many phones accept; at 50 cm the last extension had already gone over it (3520 × 4620). The big map's canvas is capped at 4096 px for the same reason. Ready to play after 7.9 s in the same headless test (6.3 s before this extension).

### And on to Nordnes

The west edge moved from x −1120 to −1800, out to the tip of Nordnes (Nordnesparken, the Aquarium, Nordnes sjøbad, Fredriksberg): 2860 × 2950 m and 6,668 buildings. The street textures are 3813 × 3933 px, still under 4096. Ready to play after 7.5 s in the same headless test.

### Fløibanen's stations

- **Lower station.** OpenStreetMap's track begins 40 m up the hill from the station, where the tunnel under Skansen starts, so the game had you board in the open ground between Vetrlidsallmenningen's hairpins. The line is now carried back through the tunnel into the small station building on the corner. You get on and off at its street door, under a FLØIBANEN sign, and the waiting car stands in the tunnel behind it instead of sticking out into the street.
- **Fløyen.** A hard-coded box "restaurant" with a cone roof stood 14 m from the top station, through the real buildings and without collision, and you stepped out between their walls. It is gone. The OSM outline round the end of the track is replaced by the upper station, the restaurant and the terrace (see the README). You step out onto the platform beside the terrace, and no trees grow through any of it.
- **Lettering.** Lettering painted on landmark walls read mirrored. The decal's horizontal axis ran to the left of someone facing the wall; it now runs to their right.
