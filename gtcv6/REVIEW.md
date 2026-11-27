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
