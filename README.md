# havardvikesland.com

A "something great is coming" page: one raymarched scene (an eclipse alone in the sky, a long-legged elephant pacing a wet salt flat, a procession of floating slabs, a rocket waiting on the far horizon) lit by a light that follows the cursor. There are no instructions on the page: what reacts, and how, is left to be discovered.

Plain static files, no build step and no libraries:

| File | What it is |
| --- | --- |
| `public/index.html` | Markup and meta tags |
| `public/styles.css` | Type, layout, film grain |
| `public/main.js` | WebGL2 setup, the fragment shader (signed distance fields, soft shadows, height fog, analytic glows), interaction and synthesized sound |
| `public/favicon.svg`, `public/og-image.png` | Tab icon and social share preview |

The water is a wave simulation on the GPU (a height grid stepped with the wave equation, ping-ponging two float textures). Dragging draws a stick through it; taps, footsteps and falling slabs drop into it. The floating slabs are small rigid bodies simulated in JavaScript: the light gathers them into a swirling clump, they push each other apart, tumble, and drift home.

Debug URL options: `?scale=1` pins the render resolution (it otherwise adapts to the GPU); `?substeps=N` runs the simulation N times per frame, for testing on slow machines; `?post=0` disables temporal upsampling to show raw frames.

## The game (separate site)

`gtcv6/` holds **Grand Theft Cappes Vei 6**, a small 3D browser game set on Cappes vei 6 in Fjellet. It is its own Cloudflare Worker with its own `wrangler.jsonc` and is meant for a subdomain. It does not touch this page. See [`gtcv6/README.md`](gtcv6/README.md).

## Run locally

```bash
python3 -m http.server 8080 --directory public
```

Then open http://localhost:8080.

## Deploy (Cloudflare Workers, from GitHub)

The repo is connected to the `havardvikeslandcom` Worker in Cloudflare. `wrangler.jsonc` tells it to serve the static files in `public/`, so there is no build step: every push to `main` deploys automatically.

Custom domains (`havardvikesland.com`, `www.havardvikesland.com`) are attached under the Worker's **Settings → Domains & Routes**.
