# havardvikesland.com

A "something great is coming" landing page with a goofy 3D crew (an elephant, a rocket, a duck and a UFO) whose googly eyes follow your cursor. Hover to make them excited; click/tap to poke them.

Plain static files, no build step:

| File | What it is |
| --- | --- |
| `public/index.html` | Markup, meta tags, import map for Three.js (loaded from jsDelivr) |
| `public/styles.css` | Page styling |
| `public/main.js` | The 3D scene, characters, interactions and tiny Web Audio sound effects |
| `public/favicon.svg`, `public/og-image.png` | Tab icon and social share preview |

## Run locally

```bash
python3 -m http.server 8080 --directory public
```

Then open http://localhost:8080.

## Deploy (Cloudflare Workers, from GitHub)

The repo is connected to the `havardvikeslandcom` Worker in Cloudflare. `wrangler.jsonc` tells it to serve the static files in `public/`, so there is no build step: every push to `main` deploys automatically.

Custom domains (`havardvikesland.com`, `www.havardvikesland.com`) are attached under the Worker's **Settings → Domains & Routes**.
