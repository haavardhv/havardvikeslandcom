# havardvikesland.com

A "something great is coming" page: one raymarched scene (an eclipse on the horizon, a long-legged elephant walking across a wet salt flat, a rocket waiting in the distance) lit by a light that follows the cursor. There are no instructions on the page: what reacts, and how, is left to be discovered.

Plain static files, no build step and no libraries:

| File | What it is |
| --- | --- |
| `public/index.html` | Markup and meta tags |
| `public/styles.css` | Type, layout, film grain |
| `public/main.js` | WebGL2 setup, the fragment shader (signed distance fields, soft shadows, height fog, analytic glows), interaction and synthesized sound |
| `public/favicon.svg`, `public/og-image.png` | Tab icon and social share preview |

Add `?scale=1` to the URL to pin the render resolution (it otherwise adapts to the GPU).

## Run locally

```bash
python3 -m http.server 8080 --directory public
```

Then open http://localhost:8080.

## Deploy (Cloudflare Workers, from GitHub)

The repo is connected to the `havardvikeslandcom` Worker in Cloudflare. `wrangler.jsonc` tells it to serve the static files in `public/`, so there is no build step: every push to `main` deploys automatically.

Custom domains (`havardvikesland.com`, `www.havardvikesland.com`) are attached under the Worker's **Settings → Domains & Routes**.
