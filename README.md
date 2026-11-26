# havardvikesland.com

A "something great is coming" landing page with a goofy 3D crew (an elephant, a rocket, a duck and a UFO) whose googly eyes follow your cursor. Hover to make them excited; click/tap to poke them.

Plain static files, no build step:

| File | What it is |
| --- | --- |
| `index.html` | Markup, meta tags, import map for Three.js (loaded from jsDelivr) |
| `styles.css` | Page styling |
| `main.js` | The 3D scene, characters, interactions and tiny Web Audio sound effects |
| `favicon.svg`, `og-image.png` | Tab icon and social share preview |

## Run locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Deploy (Cloudflare Pages, from GitHub)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick this repo.
2. Framework preset **None**, build command *empty*, build output directory `/`.
3. In the project → **Custom domains** → add `havardvikesland.com` (and `www.havardvikesland.com` if wanted).

Every push to `main` then deploys automatically; other branches get preview URLs.
