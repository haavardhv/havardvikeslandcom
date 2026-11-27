const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [from, to, every, W, Hh, dir] = [+process.argv[2] || 0, +process.argv[3] || 900, +process.argv[4] || 1, +process.argv[5] || 1280, +process.argv[6] || 720, process.argv[7] || 'frames'];
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: W, height: Hh } });
  page.on('pageerror', e => console.log('pageerror: ' + e.message));
  await page.addInitScript(() => {
    let vt = 0; const q = [];
    performance.now = () => vt;
    window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
    window.__step = ms => { vt += ms; const list = q.splice(0); for (const cb of list) cb(vt); };
  });
  await page.goto('http://localhost:8765/?q=hi');
  await page.waitForFunction(() => window.__gt, null, { timeout: 120000 });
  await page.evaluate(() => { document.getElementById('title').hidden = true; __gt.weather.forced = 0.85; __gt.weather.rain = 0.85; });
  for (let i = 0; i < 20; i++) await page.evaluate(() => __step(1000 / 30));
  await page.evaluate(fs.readFileSync(__dirname + '/director.js', 'utf8'));
  const t0 = Date.now();
  for (let f = 0; f < to; f++) {
    if (f === 0 && from > 10) await page.setViewportSize({ width: 160, height: 90 });
    if (f === from - 4 && from > 10) await page.setViewportSize({ width: W, height: Hh });
    await page.evaluate(() => __step(1000 / 30));
    if (f >= from && (f - from) % every === 0) await page.screenshot({ path: `${__dirname}/${dir}/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
    if (f % 60 === 0) console.log('frame', f, ((Date.now() - t0) / (f + 1)).toFixed(0), 'ms/frame');
  }
  await browser.close();
})();
