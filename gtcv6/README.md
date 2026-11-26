# Grand Theft Cappes Vei 6

A small open-world browser game set in the rain on Cappes vei 6, in Fjellet, Bergen. You play in third person: get home from Bryggen, throw a party on the terrace, steal an e-scooter, and carry the last skillingsbolle in town home past a gang of seagulls.

It is a separate site from the main "something great is coming" page and is meant to live on its own subdomain (for example `gtcv6.havardvikesland.com`).

## What's in it

- **Cappes vei 6** is fully enterable and laid out after the walkthrough video. The ground floor has the hall, a small study, a bedroom with a pine wall, an open kitchen and living room with navy sofas and a pine accent wall, and steep white stairs with dark treads. Upstairs are the grey and white block-pattern landing, a stacked washer and dryer, a white-tiled bathroom and three more rooms. A back door opens onto the stone-slab terrace.
- **The neighbourhood** is a steep cobbled lane of white and grey wooden houses with a green neighbour and a narrow passage with bins and plants. Long smau stairs run down to Bryggen. Gabled wharf houses line Vågen, and the last one is a bakery. Fløyen (with Fløibanen running) and Ulriken stand behind, with a first dusting of November snow.
- **Weather** follows Bergen: rain showers come and go, with short sunny breaks.
- **Måkealarm** is the wanted level, five seagull icons. Punch gulls or people and the gang dives at you. Hide indoors and the alarm drops faster.
- **Four missions**, then free roam with 10 lost umbrellas to find. Progress, money and found umbrellas are saved in the browser's `localStorage`.

Controls: WASD to move, mouse to look, Shift to run, Space to jump, click or F to punch, E to get on and off scooters, Esc to pause. Phones and tablets get touch controls: a left-thumb stick, drag on the right side to look, and buttons.

## Files

Plain static files with no build step. The only library is three.js, vendored.

| File | What it is |
| --- | --- |
| `public/index.html`, `public/style.css` | Title screen, HUD, pause menu, touch controls |
| `public/js/game.js` | Main loop, player and camera, scooters, seagull AI, missions, HUD and minimap |
| `public/js/world.js` | The map: terrain blocks, house 6 room by room, neighbouring houses, Bryggen, mountains, Fløibanen |
| `public/js/engine.js` | Geometry batching (one mesh per material) and the block-based collision world |
| `public/js/actors.js` | People, seagulls, the e-scooter, pickups and markers, built from primitives |
| `public/js/textures.js` | Procedural canvas textures (cobbles, cladding, pine, tiles, slate) |
| `public/js/audio.js` | Synthesised sound: rain, footsteps, gulls, scooter, jingles |
| `public/vendor/three.module.min.js` | three.js r186.1, bundled and minified (MIT) |

Debug URL option: `?q=low` pins a low render resolution. Otherwise the resolution adapts to the frame rate.

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
