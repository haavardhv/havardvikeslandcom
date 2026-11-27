// Installed in the page: a 30-second trailer, shot by shot.
(() => {
  const g = __gt, V = g.camera.position.constructor;
  const H = g.H, FU = H.FU, FL = H.FL;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const v = (x, y, z) => new V(x, y, z);
  const lerpV = (a, b, t) => new V(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
  const floor = (x, z) => g.world.floorAt(x, z, 300);
  // overlay for captions
  document.getElementById('hud').hidden = true;
  const st = document.createElement('style');
  st.textContent = `
    #ad { position: fixed; inset: 0; pointer-events: none; font-family: "Archivo", sans-serif; z-index: 50; }
    #ad .bars::before, #ad .bars::after { content: ""; position: absolute; left: 0; right: 0; height: 9%; background: #000; }
    #ad .bars::before { top: 0 } #ad .bars::after { bottom: 0 }
    #ad .cap { position: absolute; left: 6%; bottom: 16%; color: #f2c12e; font-weight: 900; font-variation-settings: "wdth" 62;
      font-size: 64px; line-height: .92; text-transform: uppercase; text-shadow: 0 3px 0 #000, 0 0 30px rgba(0,0,0,.6); letter-spacing: .01em; }
    #ad .cap small { display: block; font-size: 24px; font-weight: 600; font-variation-settings: "wdth" 100; color: #f4f1ea; text-transform: none; margin-top: 10px; letter-spacing: 0; }
    #ad .title { position: absolute; inset: 9% 0 11% 0; display: grid; place-content: center; text-align: center; color: #f2c12e; }
    #ad .title .k { font-weight: 800; font-size: 34px; letter-spacing: .45em; font-variation-settings: "wdth" 125; color: #f4f1ea; text-shadow: 0 2px 10px #000; }
    #ad .title .t { font-weight: 900; font-size: 128px; line-height: .86; font-variation-settings: "wdth" 62; text-shadow: 0 6px 0 #7a5a07, 0 12px 50px rgba(0,0,0,.7); }
    #ad .title .u { margin-top: 18px; font-weight: 700; font-size: 24px; color: #f4f1ea; letter-spacing: .12em; text-shadow: 0 2px 10px #000; }
    #ad .fade { position: absolute; inset: 0; background: #000; }
  `;
  document.head.appendChild(st);
  const ad = document.createElement('div'); ad.id = 'ad';
  ad.innerHTML = `<div class="bars"></div><div class="cap"></div><div class="title"><div class="k">Grand Theft</div><div class="t">Cappes<br>Vei 6</div><div class="u">Spill gratis i nettleseren · havardvikesland.com</div></div><div class="fade"></div>`;
  document.body.appendChild(ad);
  const cap = ad.querySelector('.cap'), title = ad.querySelector('.title'), fade = ad.querySelector('.fade');

  // captions: [start, end, html]
  const CAPS = [
    [0.6, 2.9, 'Bergen.<small>It rains 200 days a year.</small>'],
    [3.4, 5.9, 'Bryggen.'],
    [6.5, 9.2, 'Fjellet.<small>Cappes vei 6. The green one.</small>'],
    [9.9, 12.3, 'The gulls<br>run this town.'],
    [12.9, 15.7, 'Grand Theft<br>Sparkesykkel.'],
    [16.3, 18.8, 'Øystein. Theodor.<br>Martin. Jaakko.'],
    [19.3, 21.3, 'Guangdong House<small>closes at 19:00.</small>'],
    [21.9, 24.6, 'Velkommen hjem.'],
  ];

  g.state.mode = 'cut'; g.state.cut = null;
  g.state.alarm = 0; g.state.alarmMin = 0;
  g.camera.fov = 52; g.camera.updateProjectionMatrix();
  const P = g.player, fig = P.fig;
  fig.root.visible = true;
  const mates = g.housemates;
  const sc = g.scooters[1];
  let t = 0;
  const shot = [];
  const SHOT = (t0, t1, fn) => shot.push([t0, t1, fn]);

  // 1. Aerial over Vågen towards Bryggen and Fløyen
  SHOT(0, 3.1, k => {
    g.weather.forced = 0.5;
    const pos = lerpV(v(-700, 48, -300), v(-650, 30, -365), ease(k));
    g.camera.position.copy(pos); g.camera.lookAt(lerpV(v(-520, 6, -440), v(-540, 8, -480), ease(k)));
  });
  // 2. Along the wharf houses of Bryggen
  SHOT(3.1, 6.2, k => {
    g.weather.forced = 0.75;
    const pos = lerpV(v(-596, 5.5, -400), v(-632, 5.5, -446), k);
    g.camera.position.copy(pos); g.camera.lookAt(lerpV(v(-512, 7, -462), v(-548, 7, -508), k));
  });
  // 3. Håvard walking up Cappes vei to the green house
  SHOT(6.2, 9.6, k => {
    const u = lerp(-16, -4, k);
    const p = g.L2V(u, 0, -2.6); p.y = floor(p.x, p.z);
    P.pos.copy(p); P.heading = H.theta + Math.PI / 2;
    fig.root.position.copy(p); fig.root.rotation.set(0, P.heading, 0); fig.root.visible = true;
    fig.animate(1 / 30, 3.4, 'walk');
    const c = g.L2V(u - 5.5, 0, -4.6); c.y = p.y + 2.3;
    g.camera.position.copy(c); g.camera.lookAt(g.L2V(u + 4, p.y + 1.2, -1.2));
  });
  // 4. The gulls dive
  let gullsSet = 0;
  SHOT(9.6, 12.6, k => {
    const p = g.L2V(-3, 0, -2.6); p.y = floor(p.x, p.z);
    P.pos.copy(p); P.heading = H.theta + Math.PI * 1.25;
    fig.root.position.copy(p); fig.root.rotation.set(0, P.heading, 0);
    fig.animate(1 / 30, 0, k > 0.45 && k < 0.6 ? 'wave' : 'walk');
    if (k > 0.5 && fig.punchT <= 0 && !g.__punched) { fig.punch(); g.__punched = true; }
    g.state.alarm = 3; g.state.alarmMin = 3;
    const wave = k < 0.3 ? 0 : k < 0.62 ? 1 : 2;
    if (gullsSet !== wave + 1) {
      gullsSet = wave + 1;
      g.gulls.slice(2 + wave * 4, 6 + wave * 4).forEach((a, i) => {
        const c0 = g.L2V(0.5 + i * 0.6, 0, -5.4 + (i % 2) * 0.8);
        a.pos.set(c0.x, p.y + 3.2 + i * 0.7, c0.z);
        a.vel.set(0, 0, 0); a.state = 'dive'; a.t = 3 + i * 0.4;
      });
    }
    const c = g.L2V(1.5, 0, -6.2); c.y = p.y + 0.9;
    g.camera.position.copy(c); g.camera.lookAt(p.x, p.y + 2.6 + k * 0.6, p.z);
  });
  // 5. The scooter chase down Kong Oscars gate
  SHOT(12.6, 16.0, k => {
    g.state.alarm = 0; g.state.alarmMin = 0;
    const a = v(-178, 0, -66), b = v(-226, 0, -151);
    const p = lerpV(a, b, k); p.y = floor(p.x, p.z);
    const fx = (b.x - a.x), fz = (b.z - a.z), l = Math.hypot(fx, fz), dx = fx / l, dz = fz / l;
    const hd = Math.atan2(dx, dz);
    sc.pos.copy(p); sc.heading = hd; sc.speed = 0;
    sc.obj.position.copy(p); sc.obj.rotation.set(0, hd, -0.12, 'YXZ');
    fig.root.position.set(p.x, p.y + 0.17, p.z); fig.root.rotation.set(0, hd, -0.12, 'YXZ');
    fig.animate(1 / 30, 0, 'ride');
    const side = 1.6 - k * 2.6;
    g.camera.position.set(p.x - dx * 3.0 + dz * side, p.y + 1.6, p.z - dz * 3.0 - dx * side);
    g.camera.lookAt(p.x + dx * 2.5, p.y + 1.2, p.z + dz * 2.5);
  });
  // 6. The housemates in the living room
  let livingSet = false;
  SHOT(16.0, 19.0, k => {
    if (!livingSet) {
      livingSet = true;
      const place = (id, u, vv, h, pose) => { const n = mates[id]; n.pos.copy(g.L2V(u, FU, vv)); n.heading = H.theta + h; n.party = pose; };
      place('theodor', 5.5, 4.98, 0, 'sit');
      place('oystein', 4.4, 6.9, Math.PI * 0.75, 'idle');
      place('martin', 6.4, 7.3, -Math.PI * 0.85, 'wave');
      place('jaakko', 3.6, 5.6, Math.PI * 0.55, 'idle');
      fig.root.rotation.set(0, 0, 0);
    }
    const p = g.L2V(2.4, FU, 6.4);
    P.pos.copy(p); P.heading = H.theta + Math.PI / 2;
    fig.root.position.copy(p); fig.root.rotation.set(0, P.heading, 0);
    fig.animate(1 / 30, 0, 'walk');
    g.camera.position.copy(g.L2V(lerp(1.2, 1.6, k), FU + 1.75, lerp(4.4, 4.8, k)));
    g.camera.lookAt(g.L2V(5.8, FU + 1.0, 7.0));
  });
  // 7. Guangdong House
  SHOT(19.0, 21.6, k => {
    const gd = g.PLACES.find(q => q.k === 'food');
    const s = gd.sign.position;
    g.camera.position.set(s.x + lerp(8.5, 5.4, ease(k)), s.y - lerp(2.5, 2.0, k), s.z + lerp(4.95, 3.2, ease(k)));
    g.camera.lookAt(s.x, s.y - 0.6, s.z);
  });
  // 8. The terrace: everyone home, the rain stops, the camera rises over Fjellet
  let terraceSet = false;
  SHOT(21.6, 30.0, k => {
    g.weather.forced = 0;
    if (!terraceSet) {
      terraceSet = true;
      const spots = { oystein: [1.4, 10.0, 2.4, 'wave'], theodor: [4.6, 9.4, -2.6, 'idle'], jaakko: [6.6, 11.2, -2.4, 'wave'], martin: [5.2, 11.7, Math.PI, 'idle'] };
      for (const id in spots) { const [u, vv, h, pose] = spots[id]; const n = mates[id]; n.pos.copy(g.L2V(u, FL, vv)); n.heading = h + H.theta; n.party = pose; }
    }
    const p = g.L2V(3.3, FL, 10.3);
    P.pos.copy(p); P.heading = H.theta + 0.3;
    fig.root.position.copy(p); fig.root.rotation.set(0, P.heading, 0);
    fig.animate(1 / 30, 0, 'wave');
    const kk = ease(Math.max(0, Math.min(1, (k - 0.2) / 0.62)));
    const hold = Math.min(k / 0.2, 1);
    const c = g.L2V(lerp(7.5, 2, kk) - hold * 0.5, FL + lerp(1.7, 36, kk), lerp(12.0, 34, kk * kk));
    g.camera.position.copy(c);
    g.camera.lookAt(lerpV(g.L2V(3.2, FL + 1.3, 9.9), v(-470, 0, -250), kk * kk));
  });

  window.__director = (dt) => {
    t += 1 / 30;
    if (g.camera.fov !== 52) { g.camera.fov = 52; g.camera.updateProjectionMatrix(); }
    for (const [t0, t1, fn] of shot) if (t >= t0 && t < t1) { fn((t - t0) / (t1 - t0)); break; }
    // captions
    const c = CAPS.find(([a, b]) => t >= a && t < b);
    if (c) {
      if (cap.innerHTML !== c[2]) cap.innerHTML = c[2];
      const a = Math.min(1, (t - c[0]) / 0.25, (c[1] - t) / 0.25);
      cap.style.opacity = a; cap.style.transform = `translateY(${(1 - a) * 12}px)`;
    } else cap.style.opacity = 0;
    // title card from 25 s
    const ta = Math.max(0, Math.min(1, (t - 25.2) / 0.6));
    title.style.opacity = ta;
    title.style.transform = `scale(${1.08 - 0.08 * ta})`;
    // dips to black between some shots, and fade in/out
    const cuts = [3.1, 6.2, 9.6, 12.6, 16.0, 19.0, 21.6];
    let f = Math.max(0, 1 - t / 0.5, (t - 29.4) / 0.6);
    for (const cT of cuts) f = Math.max(f, 1 - Math.abs(t - cT) / 0.12);
    fade.style.opacity = Math.min(1, f);
    // the title card sits over a darkened sky
    if (t > 25) fade.style.opacity = Math.max(+fade.style.opacity, 0.25 * ta);
  };
})();
