// Grand Theft Cappes Vei 6 — main loop, player, camera, seagulls, missions, HUD.
import * as THREE from '../vendor/three.module.min.js';
import { buildTextures, textTexture } from './textures.js';
import { loadMapData, buildCity, PolyWorld } from './city.js';
import { buildHouse6 } from './house6.js';
import { buildOffice, officeFrame } from './office.js';
import { Physics } from './physics.js';
import { Humanoid, Gull, makeScooter, makeItem, makeMarker, makeArrow, makePistol, PEOPLE, SCOOTER_LAMP } from './actors.js';
import { Audio, lineDur } from './audio.js';
import { stylePlaceBuildings, buildPlaces } from './places.js';
import { prepareLandmarks, buildLandmarks } from './landmarks.js';
import { buildShopSigns } from './signs.js';
import { buildTram } from './tram.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// ------------------------------------------------------------------ renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
let maxRatio = Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 1.75);
if (params.get('q') === 'low') maxRatio = 0.75;
let pixelRatio = maxRatio;
renderer.setPixelRatio(pixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.08, 3000);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 78 : 64;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

try { await document.fonts.load('800 72px "Archivo"'); } catch (e) { /* fall back to system fonts */ }

// ------------------------------------------------------------------ sky, light, weather
const skyU = {
  top: { value: new THREE.Color(0x6d7f8e) },
  horizon: { value: new THREE.Color(0xa3acb2) },
  cloud: { value: 0.8 },
  time: { value: 0 },
  sunDir: { value: new THREE.Vector3() },
  moonDir: { value: new THREE.Vector3(0, 1, 0) },
  day: { value: 1 },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(2000, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 top, horizon, sunDir, moonDir; uniform float cloud, time, day; varying vec3 vDir;
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n2(p); p*=2.03; a*=.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0., 1.);
        vec3 col = mix(horizon, top, pow(h, .55));
        float sun = pow(max(dot(d, sunDir), 0.), 40.) * (1. - cloud);
        col += vec3(1., .85, .6) * sun * .8;
        // stars and the moon at night, where the clouds let them through
        float night = 1. - day;
        float star = step(.9965, h21(floor(d.xz / (d.y + .25) * 220.))) * smoothstep(.05, .3, d.y);
        float md = dot(d, moonDir);
        float moon = smoothstep(.9992, .9995, md) + pow(max(md, 0.), 60.) * .25;
        col += (vec3(star) * .8 + vec3(.9, .93, 1.) * moon) * night * (1. - cloud * .75);
        vec2 uv = d.xz / (d.y + .12) * 1.4 + vec2(time*.012, time*.005);
        float n = fbm(uv);
        float c = smoothstep(.62 - cloud*.45, .95 - cloud*.2, n);
        vec3 cc = mix(vec3(.96,.96,.97), vec3(.52,.56,.6), cloud) * mix(.06, 1., day);
        col = mix(col, cc, c * smoothstep(0., .12, d.y) * (.55 + cloud*.4));
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
);
sky.frustumCulled = false;
sky.renderOrder = -10;
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xd2dce4, 0x4b4e44, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffeedd, 1.8);
const sunOffset = new THREE.Vector3(-55, 48, 62).normalize();
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
const SH = 34;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 220 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
scene.fog = new THREE.Fog(0xa3acb2, 30, 700);

const weather = { rain: 0.85, target: 0.85, t: 50, forced: null, sunny: false };
// the time of day: one whole day every five real minutes (`?hour=22` starts the clock at 22:00)
const DAY_LEN = 300;
const clock = { t: params.has('hour') ? ((+params.get('hour') || 0) / 24) % 1 : 10 / 24 };
const dayState = { k: 1, lamp: 0 };
const C = {
  topWet: new THREE.Color(0x66737e), horWet: new THREE.Color(0x9aa3a8),
  topDry: new THREE.Color(0x4f86c0), horDry: new THREE.Color(0xc4d3dc),
};
function updateWeather(dt) {
  weather.t -= dt;
  if (weather.forced !== null) weather.target = weather.forced;
  else if (weather.t <= 0) {
    const raining = weather.target > 0.4;
    weather.target = raining ? 0.05 + Math.random() * 0.2 : 0.55 + Math.random() * 0.45;
    weather.t = raining ? 25 + Math.random() * 30 : 60 + Math.random() * 70;
    weather.sunny = raining;
  }
  weather.rain = damp(weather.rain, weather.target, weather.forced !== null ? 1.2 : 0.25, dt);
  const r = weather.rain;
  skyU.cloud.value = 0.25 + r * 0.7;
  skyU.top.value.lerpColors(C.topDry, C.topWet, Math.min(1, r * 1.3));
  skyU.horizon.value.lerpColors(C.horDry, C.horWet, Math.min(1, r * 1.3));
  scene.fog.color.copy(skyU.horizon.value);
  scene.fog.near = lerp(80, 12, r);
  scene.fog.far = lerp(1500, 420, r);
  sun.intensity = lerp(2.9, 0.75, r);
  hemi.intensity = lerp(0.55, 0.8, r);
  hemi.color.lerpColors(new THREE.Color(0xcfe0ff), new THREE.Color(0xd4dbe0), r);
}

// image-based lighting: the sky, rendered into a prefiltered environment map
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envSky = new THREE.Mesh(sky.geometry, sky.material);
envSky.frustumCulled = false;
envScene.add(envSky);
// a dark band below the horizon, like the hills and sea around Bergen
const envGround = new THREE.Mesh(new THREE.SphereGeometry(1500, 16, 8, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48), new THREE.MeshBasicMaterial({ color: 0x2b3430, side: THREE.BackSide, fog: false }));
envScene.add(envGround);
let envRT = null, envRain = -1, envDay = -1;
function updateEnv() {
  if (Math.abs(weather.rain - envRain) < 0.06 && Math.abs(dayState.k - envDay) < 0.05 && envRT) return;
  envRain = weather.rain; envDay = dayState.k;
  const old = envRT;
  envRT = pmrem.fromScene(envScene, 0, 1, 2500);
  scene.environment = envRT.texture;
  if (old) old.dispose();
}
scene.environmentIntensity = 0.75;

// ------------------------------------------------------------------ world
const T = buildTextures();
const map = await loadMapData();
const placeBuildings = stylePlaceBuildings(map);
const landmarkBuildings = prepareLandmarks(map);
const H = map.house6;
const [OX, OZ] = H.origin, [HUX, HUZ] = H.u, [HVX, HVZ] = H.v;
// house-local (u along the street, v into the house) <-> world
const L2W = (u, v) => [OX + HUX * u + HVX * v, OZ + HUZ * u + HVZ * v];
const W2L = (x, z) => { const dx = x - OX, dz = z - OZ; return [dx * HUX + dz * HUZ, dx * HVX + dz * HVZ]; };
const L2V = (u, y, v) => { const [x, z] = L2W(u, v); return new THREE.Vector3(x, y, z); };
const cityMats = {
  stone: new THREE.MeshStandardMaterial({ color: 0xb9b4a6, roughness: 0.9 }),
  copper: new THREE.MeshStandardMaterial({ color: 0x4f7a68, roughness: 0.6 }),
};
const city = buildCity(scene, map, T, {
  ...cityMats,
  // the rendered ground is cut away over the house and its side passage, so it never shows inside
  // them; everywhere else, the street in front of the door included, it keeps its real height
  hole: { o: [OX, OZ], u: [HUX, HUZ], v: [HVX, HVZ], r: [-1.3, 8.05, 0.02, H.D + 0.05] },
  keepClear: (x, z) => { const [u, v] = W2L(x, z); return u > -4 && u < 12 && v > -4 && v < 14; },
});
// the house, its side passage and the terrace replace the ground there
city.terrain.masks.push((x, z) => { const [u, v] = W2L(x, z); return u > -1.3 && u < 8.05 && v > -0.3 && v < H.D + 3.95; });
const houseGroup = new THREE.Group();
houseGroup.position.set(OX, 0, OZ);
houseGroup.rotation.y = H.theta;
scene.add(houseGroup);
const house = buildHouse6(houseGroup, T, H);
houseGroup.updateMatrixWorld(true);
const phys = new Physics(city.terrain, city.polys);
phys.addLocal(house.world, OX, OZ, HUX, HUZ);
const world = phys;
for (const d of house.doors) d.pos = L2V(d.local.x, d.local.y, d.local.z);
const interiorLights = house.lights.slice(0, 3).map(([x, y, z]) => {
  const l = new THREE.PointLight(0xffd6a0, 5, 9, 1.6);
  l.position.copy(L2V(x, y, z));
  scene.add(l);
  return l;
});
const inHouse = p => { const [u, v] = W2L(p.x, p.z); return house.inside(u, p.y, v); };

// Myreze's office: Halfdan Kjerulfs gate 4, on the 4th floor, built inside the OSM building
const OF = officeFrame();
const OL2W = (x, z) => [OF.ox + OF.ux * x - OF.uz * z, OF.oz + OF.uz * x + OF.ux * z];
const OW2L = (x, z) => { const dx = x - OF.ox, dz = z - OF.oz; return [dx * OF.ux + dz * OF.uz, -dx * OF.uz + dz * OF.ux]; };
const OL2V = (x, y, z) => { const [wx, wz] = OL2W(x, z); return new THREE.Vector3(wx, y, wz); };
const officeBld = (() => { const [x, z] = OL2W(2, 0); return map.buildings.find(b => PolyWorld.inside(b.p, x, z)) || null; })();
// the 4th storey of the facade: its windows are the second row down from the eaves (2.9 m storeys)
const OFFICE_FLOOR = officeBld ? officeBld.t - 5.9 : 14.0;
const officeGroup = new THREE.Group();
officeGroup.position.set(OF.ox, 0, OF.oz);
officeGroup.rotation.y = OF.theta;
scene.add(officeGroup);
const office = buildOffice(officeGroup, T, OFFICE_FLOOR);
officeGroup.updateMatrixWorld(true);
phys.addLocal(office.world, OF.ox, OF.oz, OF.ux, OF.uz);
for (const d of office.doors) d.pos = OL2V(d.local.x, d.local.y, d.local.z);
const inOffice = p => { const [x, z] = OW2L(p.x, p.z); return office.inside(x, p.y, z); };
const isIndoors = p => inHouse(p) || inOffice(p);
// inside the office, the building's own outline doesn't block you or the camera; the office's walls do
city.polys.hollowAt = (x, y, z) => { const [lx, lz] = OW2L(x, z); return office.inside(lx, y, lz); };
{
  const [x, z] = OL2W(2, 0);
  for (const it of city.polys.query(x - 1, z - 1, x + 1, z + 1)) if (it.kind && PolyWorld.insideItem(it, x, z)) it.hollow = true;
}
const OFFICE_CENTRE = OL2V(...office.centre);
// the three interior lights hang wherever you are: in no. 6, or at the office
let lightsAt = 'house';
function updateInteriorLights() {
  officeGroup.visible = camera.position.distanceTo(OFFICE_CENTRE) < 70;
  const want = inOffice(player.pos) || inOffice(camera.position) ? 'office' : 'house';
  if (want === lightsAt) return;
  lightsAt = want;
  interiorLights.forEach((l, i) => {
    if (want === 'office') { l.position.copy(OL2V(...office.lights[i])); l.distance = 12; l.intensity = 7; }
    else { l.position.copy(L2V(...house.lights[i])); l.distance = 9; l.intensity = 5; }
  });
}
// the building's street door, and where you stand in front of it
const OFFICE_STREET = (() => {
  let x, z, nx, nz;
  const b = officeBld;
  if (b && b.d) {
    const n = b.p.length / 2, i = b.d[0], j = (i + 1) % n;
    const ax = b.p[i * 2], az = b.p[i * 2 + 1], bx = b.p[j * 2], bz = b.p[j * 2 + 1], L = Math.hypot(bx - ax, bz - az);
    x = ax + (bx - ax) * b.d[1]; z = az + (bz - az) * b.d[1];
    nx = (bz - az) / L; nz = -(bx - ax) / L;
    if (PolyWorld.inside(b.p, x + nx * 0.5, z + nz * 0.5)) { nx = -nx; nz = -nz; }
  } else {
    [x, z] = OL2W(2.1, 5.85); nx = -OF.uz; nz = OF.ux;
  }
  const sx = x + nx * 1.3, sz = z + nz * 1.3;
  return { doorX: x, doorZ: z, nx, nz, x: sx, z: sz, y: city.terrain.height(sx, sz), heading: Math.atan2(nx, nz) };
})();
const OFFICE_EXIT = OL2V(...office.exitDoor);
const OFFICE_ENTRY = OL2V(...office.entry);
{
  // a plate by the street door
  const S = OFFICE_STREET, tx = -S.nz, tz = S.nx;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3,
    map: textTexture(['MYREZE', '4. etasje'], { w: 256, h: 140, bg: '#16181b', fg: '#f3f2ee', font: '700 40px "Archivo", sans-serif', radius: 10, border: '#c9a23a' }) }));
  plate.position.set(S.doorX + tx * 0.95 + S.nx * 0.07, city.terrain.height(S.doorX + S.nx, S.doorZ + S.nz) + 1.5, S.doorZ + tz * 0.95 + S.nz * 0.07);
  plate.rotation.y = S.heading;
  scene.add(plate);
}
function stairsHere() {
  if (state.mode !== 'play' || player.riding || dive.on || player.knockT > 0) return null;
  const p = player.pos;
  if (inOffice(p)) return Math.hypot(p.x - OFFICE_EXIT.x, p.z - OFFICE_EXIT.z) < 1.4 ? 'down' : null;
  return Math.hypot(p.x - OFFICE_STREET.doorX, p.z - OFFICE_STREET.doorZ) < 2.2 && Math.abs(p.y - OFFICE_STREET.y) < 2 ? 'up' : null;
}
function takeStairs(dir) {
  audio.door();
  fadeThen(() => {
    const up = dir === 'up';
    const h = up ? Math.atan2(-OF.ux, -OF.uz) : OFFICE_STREET.heading;
    if (up) player.pos.set(OFFICE_ENTRY.x, OFFICE_FLOOR + 0.02, OFFICE_ENTRY.z);
    else player.pos.set(OFFICE_STREET.x, world.floorAt(OFFICE_STREET.x, OFFICE_STREET.z, OFFICE_STREET.y + 1), OFFICE_STREET.z);
    player.vel.set(0, 0, 0); player.heading = h;
    cam.yaw = h + Math.PI; cam.pitch = 0.3; cam.cur = cam.dist = up ? 2.5 : 4.4;
    toast(up ? 'Myreze, 4th floor' : 'Halfdan Kjerulfs gate', 2);
  });
}
const [AX0, AZ0, AX1, AZ1] = map.area;

// walking graph (OSM streets, lanes, steps)
const GN = map.graph.n, GE = map.graph.e;
const gAdj = Array.from({ length: GN.length / 2 }, () => []);
for (let i = 0; i < GE.length; i += 2) { gAdj[GE[i]].push(GE[i + 1]); gAdj[GE[i + 1]].push(GE[i]); }
const gx = i => GN[i * 2], gz = i => GN[i * 2 + 1];
function nearestNode(x, z, maxD = 80) {
  let best = -1, bd = maxD * maxD;
  for (let i = 0; i < gAdj.length; i++) {
    if (!gAdj[i].length) continue;
    const d = (gx(i) - x) ** 2 + (gz(i) - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
// Guangdong House, Rema 1000, Johnny's and the Trekroneren kiosk, dressed after photos
const places = buildPlaces(scene, map, placeBuildings, {
  terrain: city.terrain, onRoad: city.onRoad, polys: city.polys,
  // which way the street is from a point: towards the nearest node of the walking graph
  streetDir: (x, z) => { const i = nearestNode(x, z, 30); if (i < 0) return null; const dx = gx(i) - x, dz = gz(i) - z, d = Math.hypot(dx, dz); return d > 0.3 ? [dx / d, dz / d] : null; },
});
// the churches, Bergenhus, the station, Den blå steinen and the rest, modelled after photos
const landmarks = buildLandmarks(scene, map, landmarkBuildings, { terrain: city.terrain, polys: city.polys, onRoad: city.onRoad });
// the names of the shops, cafés and restaurants over their doors
const shopSigns = buildShopSigns(scene, map, { terrain: city.terrain, polys: city.polys, onRoad: city.onRoad });
// Bybanen: the rails, the platforms at Byparken and Kaigaten, and the tram
const tram = buildTram(scene, map.tram, { terrain: city.terrain, polys: city.polys });
function updateTram(dt) {
  if (tram.update(dt) === 'bell' && Math.hypot(player.pos.x - tram.sections[0].x, player.pos.z - tram.sections[0].z) < 120) audio.tramBell();
  // don't stand in its way
  if (state.mode !== 'play' || dive.on) return;
  const v = tram.velocity();
  for (const sec of tram.sections) {
    if (!sec.g.visible) continue;
    const dx = player.pos.x - sec.x, dz = player.pos.z - sec.z;
    const c = Math.cos(sec.h), sn = Math.sin(sec.h);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;            // across, along
    const hw = tram.W / 2 + 0.35, hl = sec.len / 2 + 0.25;
    if (Math.abs(lx) > hw || Math.abs(lz) > hl || player.pos.y - world.terrain.height(sec.x, sec.z) > 3.4) continue;
    const side = lx >= 0 ? 1 : -1, push = hw - Math.abs(lx);
    player.pos.x += c * side * push; player.pos.z -= sn * side * push;
    if (Math.abs(v) > 1.5 && player.knockT <= 0) {
      if (player.riding) { const s = player.riding; dismount(true); s.speed = 0; }
      player.vel.set(c * side * 6, 4, -sn * side * 6); player.onGround = false;
      player.knockT = 1.3; player.health = Math.max(5, player.health - 20); player.regenT = 4;
      cam.shake = 0.9; audio.crash(); toast('Hit by Bybanen!', 2);
    }
  }
}
// A* over the street graph
function route(ax, az, bx, bz) {
  const s = nearestNode(ax, az, 120), t = nearestNode(bx, bz, 120);
  if (s < 0 || t < 0) return null;
  const n = gAdj.length, g = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const heap = [[0, s]]; g[s] = 0;
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const pk = (k - 1) >> 1; if (heap[pk][0] <= heap[k][0]) break; [heap[pk], heap[k]] = [heap[k], heap[pk]]; k = pk; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  while (heap.length) {
    const [, i] = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === t) break;
    for (const j of gAdj[i]) {
      const ng = g[i] + Math.hypot(gx(i) - gx(j), gz(i) - gz(j));
      if (ng < g[j]) { g[j] = ng; prev[j] = i; push(ng + Math.hypot(gx(j) - gx(t), gz(j) - gz(t)), j); }
    }
  }
  if (prev[t] < 0 && s !== t) return null;
  const path = [];
  for (let i = t; i >= 0; i = prev[i]) { path.push([gx(i), gz(i)]); if (i === s) break; }
  path.reverse();
  path.push([bx, bz]);
  return path;
}
// the street you are on, for the HUD
const namedRoads = map.roads.filter(r => r.n);
function streetName(x, z) {
  let best = null, bd = 12 * 12;
  for (const r of namedRoads) {
    const p = r.p;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
      const d = (ax + dx * t - x) ** 2 + (az + dz * t - z) ** 2;
      if (d < bd) { bd = d; best = r.n; }
    }
  }
  return best;
}

// ------------------------------------------------------------------ rain
// Every drop is computed in the vertex shader from a random seed and the time: no per-frame CPU
// work, no buffer uploads. Drops are anchored in world space and wrap in a 50 x 30 x 50 m box around
// the camera; inside the house they are pushed out of sight.
const RAIN_N = isTouch ? 3000 : 6000;
const rainGeo = new THREE.BufferGeometry();
{
  const seed = new Float32Array(RAIN_N * 2 * 4);
  for (let i = 0; i < RAIN_N; i++) {
    const a = Math.random(), b = Math.random(), c = Math.random(), sp = Math.random();
    for (let e = 0; e < 2; e++) seed.set([a, b, c, e * 2 + sp * 0.999], (i * 2 + e) * 4);
  }
  rainGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 2 * 3), 3));
}
const rainU = { time: { value: 0 }, cam: { value: new THREE.Vector3() }, house: { value: new THREE.Vector4(OX, OZ, HUX, HUZ) }, houseTop: { value: H.FU + 6 }, office: { value: new THREE.Vector4(OF.ox, OF.oz, OF.ux, OF.uz) }, officeTop: { value: (officeBld ? officeBld.t : OFFICE_FLOOR + 6) + 1 }, color: { value: new THREE.Color(0xb8c6d2) } };
const rain = new THREE.LineSegments(rainGeo, new THREE.ShaderMaterial({
  uniforms: rainU, transparent: true, depthWrite: false, fog: false,
  vertexShader: `
    attribute vec4 seed; uniform float time; uniform vec3 cam; uniform vec4 house; uniform float houseTop; uniform vec4 office; uniform float officeTop;
    varying float vA;
    void main() {
      float end = floor(seed.w * 0.5), spd = 11.0 + fract(seed.w) * 5.0, wind = 1.8;
      float x = cam.x - 25.0 + mod(seed.x * 50.0 + wind * time - cam.x, 50.0);
      float z = cam.z - 25.0 + mod(seed.z * 50.0 - cam.z, 50.0);
      float y = cam.y - 12.0 + mod(seed.y * 30.0 - time * spd - cam.y, 30.0);
      y += end * 0.55; x -= end * wind * 0.04;
      float dx = x - house.x, dz = z - house.y;
      float u = dx * house.z + dz * house.w, v = dx * -house.w + dz * house.z;
      if (u > -0.5 && u < 8.5 && v > -0.5 && v < 8.9 && y < houseTop) y = -1e5;
      float ox = x - office.x, oz = z - office.y;
      float ou = ox * office.z + oz * office.w, ov = ox * -office.w + oz * office.z;
      if (ou > -4.6 && ou < 8.4 && ov > -11.5 && ov < 6.0 && y < officeTop) y = -1e5;
      vA = 0.42;
      gl_Position = projectionMatrix * viewMatrix * vec4(x, y, z, 1.0);
    }`,
  fragmentShader: `uniform vec3 color; varying float vA;
    void main() {
      gl_FragColor = vec4(color, vA);
      #include <colorspace_fragment>
    }`,
}));
rain.frustumCulled = false;
scene.add(rain);
function updateRain(dt) {
  const n = Math.floor(RAIN_N * clamp(weather.rain * 1.2, 0, 1));
  rainGeo.setDrawRange(0, n * 2);
  rain.visible = n > 0;
  rainU.time.value += dt;
  rainU.cam.value.copy(camera.position);
}

// ------------------------------------------------------------------ audio
const audio = new Audio();
// the scooter radio's station and song, shown at the top of the screen like a car radio
let radioT = 0;
audio.onSong = (station, title) => {
  const el = $('radio');
  el.querySelector('b').textContent = station;
  el.querySelector('span').textContent = title;
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  radioT = 4;
};

// ------------------------------------------------------------------ save
const SAVE_KEY = 'gtcv6-save-v1';
const save = { mission: 0, money: 0, umbrellas: [], done: false, radio: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* no storage */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };

const state = { mode: 'title', alarm: 0, alarmMin: 0, alarmCool: 0, alarmFlash: 0 };

// ------------------------------------------------------------------ player
const RADIUS = 0.3, HEIGHT = 1.8, STEP = 0.5;
const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: Math.PI / 2,
  onGround: false, fig: new Humanoid({ person: 'havard' }), stepAcc: 0, knockT: 0, riding: null,
  carrying: null, punchCd: 0, airT: 0, hurtT: 0, health: 100, regenT: 0,
};
scene.add(player.fig.root);
const carryHold = new THREE.Group(); // the bolle rides in the right hand
player.fig.elbows[0].add(carryHold);
carryHold.position.set(0, -0.32, 0.08);

// ------------------------------------------------------------------ camera rig
const cam = { yaw: -Math.PI / 2, pitch: 0.32, dist: 4.4, cur: 4.4, lastLook: 0, shake: 0 };
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _dir = new THREE.Vector3();
const camBox = new THREE.Vector3();
function updateCamera(dt) {
  const p = player.pos;
  const inside = isIndoors(p);
  const want = funiState.ride ? 13 : dive.on ? (dive.phase === 'free' ? 7 : 10) : lerp(player.riding ? 5.6 : inside ? 2.5 : 4.6, 3.1, gun.aimK);
  cam.dist = damp(cam.dist, want, 3, dt);
  const baseFov = camera.aspect < 0.8 ? 78 : 64;
  const fov = damp(camera.fov, (inside ? baseFov + 14 : baseFov) + (player.riding && turbo.on ? 9 : 0), 3, dt);
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // follow the scooter's heading unless the player is steering the camera
  if (player.riding && performance.now() - cam.lastLook > 900) {
    cam.yaw = cam.yaw + angDiff(cam.yaw, player.riding.heading + Math.PI) * Math.min(1, dt * 2.5);
    cam.pitch = damp(cam.pitch, 0.28, 2, dt);
  }
  const pivot = _v.set(p.x, p.y + (player.knockT > 0 ? 0.6 : 1.55), p.z);
  // over the right shoulder while the pistol is out
  if (gun.aimK > 0.01) { pivot.x += Math.cos(cam.yaw) * 0.55 * gun.aimK; pivot.z -= Math.sin(cam.yaw) * 0.55 * gun.aimK; pivot.y += 0.05 * gun.aimK; }
  _dir.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  const hit = world.raycast(pivot, _dir, cam.dist + 0.3);
  const d = Math.max(0.35, Math.min(cam.dist, hit - 0.3));
  cam.cur = d < cam.cur ? d : damp(cam.cur, d, 4, dt);
  camBox.copy(pivot).addScaledVector(_dir, cam.cur);
  // keep the camera out of walls sideways
  camBox.y -= 0.05;
  world.collide(camBox, 0.18, 0.1, 0.3);
  camBox.y += 0.05;
  const fl = world.floorAt(camBox.x, camBox.z, camBox.y, 0);
  if (camBox.y < fl + 0.25) camBox.y = fl + 0.25;
  camera.position.copy(camBox);
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 2);
    camera.position.x += (Math.random() - 0.5) * cam.shake * 0.25;
    camera.position.y += (Math.random() - 0.5) * cam.shake * 0.25;
  }
  camera.lookAt(pivot.x, pivot.y + 0.1, pivot.z);
  player.fig.root.visible = cam.cur > 0.75;
}

// ------------------------------------------------------------------ input
const keys = {};
const pressed = { jump: false, punch: false, use: false, radio: false, gun: false, trick: false };
const touch = { mx: 0, my: 0, run: false, driftHeld: false, stickId: null, lookId: null, sx: 0, sy: 0, lx: 0, ly: 0 };
let locked = false;
addEventListener('keydown', e => {
  if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
  keys[e.code] = true;
  if (state.mode === 'play' || state.mode === 'cut') {
    if (e.code === 'Space') { pressed.jump = true; e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'Enter') pressed.use = true;
    if (e.code === 'KeyF') pressed.punch = true;
    if (e.code === 'KeyR') pressed.radio = true;
    if (e.code === 'KeyG') pressed.gun = true;
    if (e.code === 'KeyT') pressed.trick = true;
    if (e.code === 'KeyY' && offer && !offer.accepted) acceptOffer();
    if (e.code === 'KeyN' && offer && !offer.accepted) declineOffer();
    if (e.code === 'KeyQ' || e.code === 'Tab') { openWheel(!wheelOpen); e.preventDefault(); }
    const dg = /^Digit([1-5])$/.exec(e.code);
    if (dg) switchTo(CHAR_IDS[+dg[1] - 1]);
  }
  if (e.code === 'KeyM') { if (state.mode === 'map') closeMap(); else if (state.mode === 'play') openMap(); }
  if (e.code === 'Escape' && state.mode === 'map') closeMap();
  else if (e.code === 'Escape' && state.mode === 'pause' && !locked) resumeGame();
  else if ((e.code === 'Escape' || e.code === 'KeyP') && state.mode === 'play') pauseGame();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseRight = false; });
let mouseRight = false;      // held: drift on a scooter
canvas.addEventListener('mousedown', e => {
  if (isTouch) return;
  if (state.mode === 'play') {
    if (!locked) { requestLock(); return; }
    if (e.button === 0) pressed.punch = true;
    if (e.button === 2) mouseRight = true;
  }
});
addEventListener('mouseup', e => { if (e.button === 2) mouseRight = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (!locked || state.mode !== 'play') return;
  cam.yaw -= e.movementX * 0.0024;
  cam.pitch = clamp(cam.pitch + e.movementY * 0.002, -0.45, 1.25);
  // a mouse under pointer lock reports tiny movements all the time, even at rest: only a real
  // movement counts as looking around (and keeps the camera from swinging back behind you)
  if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) cam.lastLook = performance.now();
});
function requestLock() {
  if (isTouch) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ }
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked && state.mode === 'map') { document.exitPointerLock(); return; }   // the lock came in late: the map needs the mouse
  if (!locked && state.mode === 'play' && !wheelOpen) pauseGame();
});
// touch: left half = stick, right half = look
const stickEl = $('stick'), stickKnob = stickEl.querySelector('i');
canvas.addEventListener('touchstart', e => {
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.45 && touch.stickId === null) {
      touch.stickId = t.identifier; touch.sx = t.clientX; touch.sy = t.clientY; touch.mx = touch.my = 0;
      stickEl.style.display = 'block'; stickEl.style.left = t.clientX + 'px'; stickEl.style.top = t.clientY + 'px';
      stickKnob.style.transform = '';
    } else if (touch.lookId === null) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; }
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.stickId) {
      let dx = t.clientX - touch.sx, dy = t.clientY - touch.sy;
      const l = Math.hypot(dx, dy), m = 50;
      if (l > m) { dx *= m / l; dy *= m / l; }
      touch.mx = dx / m; touch.my = -dy / m;
      stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (t.identifier === touch.lookId) {
      cam.yaw -= (t.clientX - touch.lx) * 0.006;
      cam.pitch = clamp(cam.pitch + (t.clientY - touch.ly) * 0.005, -0.45, 1.25);
      touch.lx = t.clientX; touch.ly = t.clientY;
      cam.lastLook = performance.now();
    }
  }
  e.preventDefault();
}, { passive: false });
const endTouch = e => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.stickId) { touch.stickId = null; touch.mx = touch.my = 0; stickEl.style.display = 'none'; }
    if (t.identifier === touch.lookId) touch.lookId = null;
  }
};
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);
for (const b of document.querySelectorAll('#touch button')) {
  b.addEventListener('touchstart', e => {
    e.preventDefault();
    const k = b.dataset.k;
    if (k === 'trick') { touch.driftHeld = true; return; }      // the Drift button: hold it
    if (k === 'run') { touch.run = !touch.run; b.classList.toggle('on', touch.run); }
    else if (k === 'switch') openWheel(!wheelOpen);
    else pressed[k] = true;
  }, { passive: false });
}
{
  const db = document.querySelector('#touch [data-k="trick"]');
  for (const ev of ['touchend', 'touchcancel']) db.addEventListener(ev, () => { touch.driftHeld = false; });
}
$('pausebtn').addEventListener('click', () => pauseGame());

function moveInput() {
  let x = 0, y = 0;
  if (keys.KeyW || keys.ArrowUp) y += 1;
  if (keys.KeyS || keys.ArrowDown) y -= 1;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  x += touch.mx; y += touch.my;
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  // on a scooter: Shift (Run) boosts, the right mouse button held drifts
  return { x, y, run: keys.ShiftLeft || keys.ShiftRight || touch.run, drift: mouseRight || touch.driftHeld };
}

// ------------------------------------------------------------------ HUD
const hud = {
  money: $('money'), alarm: $('alarm'), health: $('health').firstElementChild, timer: $('timer'),
  objective: $('objective'), prompt: $('prompt'), phone: $('phone'), toast: $('toast'), banner: $('banner'),
  umbrellas: $('umbrellas'), street: $('street'), crosshair: $('crosshair'), ammo: $('ammo'), boost: $('boostbar').firstElementChild, clock: $('clock'),
};
const punchBtn = document.querySelector('#touch [data-k="punch"]'), handBtn = document.querySelector('#touch [data-k="gun"]');
const gullSvg = '<svg viewBox="0 0 32 18" aria-hidden="true"><path d="M1 6c5-3 10-2 15 4 5-6 10-7 15-4-4 0-9 3-11 8l-4 1-4-1C10 9 5 6 1 6z"/></svg>';
hud.alarm.innerHTML = gullSvg.repeat(5);
let shownMoney = save.money;
const timers = {};
function later(name, sec, fn) { timers[name] = { t: sec, fn }; }
function showPhone(from, text, sec = 6) {
  hud.phone.hidden = false;
  hud.phone.firstElementChild.textContent = from;
  hud.phone.children[1].textContent = text;
  if (hud.phone.children[2]) hud.phone.children[2].hidden = true;
  hud.phone.style.animation = 'none'; void hud.phone.offsetWidth; hud.phone.style.animation = '';
  later('phone', sec, () => { hud.phone.hidden = true; });
  audio.pickup();
}
function toast(text, sec = 2.5) {
  hud.toast.hidden = false; hud.toast.textContent = text;
  hud.toast.style.animation = 'none'; void hud.toast.offsetWidth; hud.toast.style.animation = '';
  later('toast', sec, () => { hud.toast.hidden = true; });
}
function banner(title, sub, cls = '', sec = 3.2) {
  hud.banner.hidden = false; hud.banner.className = cls;
  hud.banner.firstElementChild.textContent = title;
  hud.banner.lastElementChild.textContent = sub || '';
  hud.banner.style.animation = 'none'; void hud.banner.offsetWidth; hud.banner.style.animation = '';
  later('banner', sec, () => { hud.banner.hidden = true; });
}
function setObjective(html) { hud.objective.innerHTML = html || ''; hud.objective.dataset.k = ''; }
const hurtEl = document.createElement('div');
hurtEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;box-shadow:inset 0 0 120px 30px rgba(200,20,10,.65);opacity:0;transition:opacity .25s';
document.body.appendChild(hurtEl);
function updateHud(dt) {
  shownMoney = Math.abs(save.money - shownMoney) < 1 ? save.money : damp(shownMoney, save.money, 6, dt);
  hud.money.textContent = 'kr ' + Math.round(shownMoney).toLocaleString('nb-NO');
  { const t = clockText(); if (hud.clock.textContent !== t) hud.clock.textContent = t; }
  const svgs = hud.alarm.children;
  for (let i = 0; i < 5; i++) svgs[i].classList.toggle('on', i < state.alarm);
  hud.alarm.classList.toggle('flash', state.alarm > 0 && state.alarmFlash > 0);
  state.alarmFlash = Math.max(0, state.alarmFlash - dt);
  hud.health.style.width = player.health + '%';
  hud.umbrellas.textContent = `Lost umbrellas ${save.umbrellas.length}/${UMBRELLAS.length}`;
  if (mission && mission.timer !== null) {
    hud.timer.hidden = false;
    const t = Math.max(0, mission.timer);
    hud.timer.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    hud.timer.classList.toggle('low', t < 15);
  } else hud.timer.hidden = true;
  for (const k in timers) {
    const tm = timers[k];
    if (!tm) continue;
    tm.t -= dt;
    if (tm.t <= 0) { timers[k] = null; tm.fn(); }
  }
  hurtEl.style.opacity = player.hurtT > 0.6 ? Math.min(1, (player.hurtT - 0.6) * 2.5) : 0;
}

// ------------------------------------------------------------------ minimap
const MAP = { x0: AX0 - 60, z0: AZ0 - 60, x1: AX1 + 60, z1: AZ1 + 60, ppm: 1.5 };
const mapBase = document.createElement('canvas');
mapBase.width = (MAP.x1 - MAP.x0) * MAP.ppm; mapBase.height = (MAP.z1 - MAP.z0) * MAP.ppm;
{
  const g = mapBase.getContext('2d');
  // ground: water, green, paved, with hill shading from the terrain (at half resolution, scaled up)
  const W = Math.ceil(mapBase.width / 2), Hh = Math.ceil(mapBase.height / 2);
  const half = document.createElement('canvas'); half.width = W; half.height = Hh;
  const hg = half.getContext('2d');
  const img = hg.createImageData(W, Hh);
  const clsCol = [[78, 92, 66], [74, 104, 58], [52, 82, 46], [104, 104, 106], [34, 64, 77]];
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const x = MAP.x0 + i * 2 / MAP.ppm, z = MAP.z0 + j * 2 / MAP.ppm;
    const h = city.terrain.height(x, z);
    let c;
    if (h < 0.2) c = [34, 64, 77];
    else {
      c = clsCol[city.terrain.cls(x, z)] || clsCol[0];
      if (city.terrain.cls(x, z) === 0 && x < -230) c = clsCol[3];
      const hx = city.terrain.height(x + 2, z) - city.terrain.height(x - 2, z), hz = city.terrain.height(x, z + 2) - city.terrain.height(x, z - 2);
      const k = clamp(1 - hx * 0.05 - hz * 0.03, 0.6, 1.3);
      c = c.map(v => v * k);
    }
    const o = (j * W + i) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
  }
  hg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(half, 0, 0, mapBase.width, mapBase.height);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const tx = x => (x - MAP.x0) * MAP.ppm, tz = z => (z - MAP.z0) * MAP.ppm;
  const roadCol = { road: '#c9c6bd', sett: '#b9ad97', ped: '#c3b9a8', side: '#a6a39b', foot: '#a39d8e', steps: '#d07a5a' };
  for (const pass of ['road', 'sett', 'ped', 'side', 'foot', 'steps']) {
    for (const r of map.roads) {
      if (r.k !== pass) continue;
      g.strokeStyle = roadCol[r.k];
      g.lineWidth = Math.max(1.5, r.w * MAP.ppm * (r.k === 'steps' ? 0.8 : 1));
      if (r.k === 'steps') g.setLineDash([2, 2]); else g.setLineDash([]);
      g.beginPath();
      for (let i = 0; i < r.p.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(r.p[i]), tz(r.p[i + 1]));
      g.stroke();
    }
  }
  g.setLineDash([]);
  for (const b of map.buildings) {
    g.fillStyle = b.rc; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1;
    g.beginPath();
    for (const ring of [b.p, ...(b.h || [])]) {
      for (let i = 0; i < ring.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(ring[i]), tz(ring[i + 1]));
      g.closePath();
    }
    g.fill('evenodd'); g.stroke();
  }
  // home in raincoat yellow
  g.fillStyle = '#f2c12e'; g.strokeStyle = '#101418'; g.lineWidth = 2;
  g.beginPath();
  for (const [u, v] of [[0, 0], [8, 0], [8, 8.4], [0, 8.4]]) { const [x, z] = L2W(u, v); g.lineTo(tx(x), tz(z)); }
  g.closePath(); g.fill(); g.stroke();
  // Fløibanen
  g.strokeStyle = '#7b4fb0'; g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < map.funicular.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(map.funicular[i]), tz(map.funicular[i + 1]));
  g.stroke();
}
const mm = $('minimap'), mg = mm.getContext('2d'), northEl = $('north');
let gps = null;   // [[x,z], ...] route shown on the map
let waypoint = null, wpGps = null;   // the waypoint you set on the big map, and the route to it
const WP_COL = '#c04ad8';
const routeLen = r => { let d = 0; if (r) for (let i = 1; i < r.length; i++) d += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); return d; };
const fmtDist = d => d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d / 10) * 10 + ' m';
function diamond(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r * 1.25); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.25); g.lineTo(x - r, y); g.closePath(); }
function drawMinimap(blips) {
  const S = mm.width, c = S / 2, scale = 2.6 * (S / 360) / MAP.ppm * 1.0;
  const p = player.pos;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const rot = -Math.PI / 2 - Math.atan2(fz, fx);
  mg.save();
  mg.fillStyle = '#22404d'; mg.fillRect(0, 0, S, S);
  mg.translate(c, c); mg.rotate(rot); mg.scale(scale, scale);
  mg.drawImage(mapBase, -(p.x - MAP.x0) * MAP.ppm, -(p.z - MAP.z0) * MAP.ppm);
  for (const [r, col] of [[gps, '#f2c12e'], [wpGps, WP_COL]]) {
    if (!r || r.length < 2) continue;
    mg.strokeStyle = col; mg.lineWidth = 5 / scale * 1.4; mg.lineCap = 'round'; mg.lineJoin = 'round';
    mg.globalAlpha = 0.9;
    mg.beginPath();
    r.forEach(([x, z], i) => (i ? mg.lineTo : mg.moveTo).call(mg, (x - p.x) * MAP.ppm, (z - p.z) * MAP.ppm));
    mg.stroke();
    mg.globalAlpha = 1;
  }
  mg.restore();
  const toMap = (x, z) => {
    const dx = (x - p.x) * MAP.ppm * scale, dz = (z - p.z) * MAP.ppm * scale;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    return [c + dx * cs - dz * sn, c + dx * sn + dz * cs];
  };
  for (const b of blips) {
    let [x, y] = toMap(b.x, b.z);
    const dx = x - c, dy = y - c, l = Math.hypot(dx, dy), R = c - 14;
    if (l > R) { if (!b.edge) continue; x = c + dx / l * R; y = c + dy / l * R; }
    mg.fillStyle = b.c; mg.strokeStyle = b.label ? '#f4f1ea' : '#101418'; mg.lineWidth = 3;
    if (b.shape === 'wp') { mg.strokeStyle = '#f4f1ea'; diamond(mg, x, y, b.r || 8); } else { mg.beginPath(); mg.arc(x, y, b.r || 7, 0, 7); }
    mg.fill(); mg.stroke();
    if (b.label && l < R) {
      mg.font = '700 19px Archivo, sans-serif'; mg.textAlign = 'center';
      mg.lineWidth = 4; mg.strokeStyle = 'rgba(16,20,24,.85)'; mg.strokeText(b.label, x, y - 13);
      mg.fillStyle = '#f4f1ea'; mg.fillText(b.label, x, y - 13);
    }
  }
  mg.save(); mg.translate(c, c); mg.rotate(rot + Math.atan2(Math.cos(player.heading), Math.sin(player.heading)) + Math.PI / 2);
  mg.fillStyle = '#f2c12e'; mg.strokeStyle = '#101418'; mg.lineWidth = 3;
  mg.beginPath(); mg.moveTo(0, -13); mg.lineTo(9, 10); mg.lineTo(0, 5); mg.lineTo(-9, 10); mg.closePath(); mg.fill(); mg.stroke();
  mg.restore();
  northEl.style.left = 50 + Math.sin(rot) * 41 + '%';
  northEl.style.top = 50 - Math.cos(rot) * 41 + '%';
}

// ------------------------------------------------------------------ the big map
// M (or a click on the minimap, or Map in the pause menu) opens the whole town, north up. Drag to
// move, scroll or pinch to zoom, click to set a waypoint (click it again to take it away). The
// GPS then shows the way there in purple, next to the mission's yellow route, as in GTA. The game
// stands still while the map is open.
const bm = { cv: $('bigmapc'), cx: 0, cz: 0, zoom: 1.2, ptrs: new Map(), drag: null, pinch: null, hover: null, blips: [] };
const bmg = bm.cv.getContext('2d');
const wpMarker = makeMarker(0xc04ad8);
wpMarker.visible = false;
scene.add(wpMarker);
// one label per street name, every 160 m or so along it, for the zoomed-in map
const streetLabels = (() => {
  const out = [], seen = {};
  for (const r of namedRoads) {
    if (r.k === 'steps' || r.k === 'foot') continue;
    const p = r.p;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], l = Math.hypot(bx - ax, bz - az);
      if (l < 22) continue;
      const x = (ax + bx) / 2, z = (az + bz) / 2;
      const near = (seen[r.n] || []).some(([qx, qz]) => Math.hypot(qx - x, qz - z) < 160);
      if (near) continue;
      (seen[r.n] = seen[r.n] || []).push([x, z]);
      let a = Math.atan2(bz - az, bx - ax);
      if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
      out.push({ n: r.n, x, z, a, l, main: r.k === 'road' });
    }
  }
  return out;
})();
const bmFit = () => Math.min(innerWidth / (MAP.x1 - MAP.x0), innerHeight / (MAP.z1 - MAP.z0)) * 0.95;
const bmMax = 3.5;
function bmClamp() {
  bm.zoom = clamp(bm.zoom, bmFit(), bmMax);
  const hw = innerWidth / 2 / bm.zoom, hh = innerHeight / 2 / bm.zoom;
  const mx = (MAP.x0 + MAP.x1) / 2, mz = (MAP.z0 + MAP.z1) / 2;
  bm.cx = hw * 2 >= MAP.x1 - MAP.x0 ? mx : clamp(bm.cx, MAP.x0 + hw, MAP.x1 - hw);
  bm.cz = hh * 2 >= MAP.z1 - MAP.z0 ? mz : clamp(bm.cz, MAP.z0 + hh, MAP.z1 - hh);
}
const bmToWorld = (sx, sy) => [bm.cx + (sx - innerWidth / 2) / bm.zoom, bm.cz + (sy - innerHeight / 2) / bm.zoom];
const bmToScreen = (x, z) => [innerWidth / 2 + (x - bm.cx) * bm.zoom, innerHeight / 2 + (z - bm.cz) * bm.zoom];
let bmQueued = false;
function bmDraw() { if (!bmQueued) { bmQueued = true; requestAnimationFrame(() => { bmQueued = false; if (state.mode === 'map') drawBigMap(); }); } }
function drawBigMap() {
  const cv = bm.cv, dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, Hh = innerHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(Hh * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
  const g = bmg, z = bm.zoom;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#22404d'; g.fillRect(0, 0, W, Hh);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const [ox, oy] = bmToScreen(MAP.x0, MAP.z0);
  g.drawImage(mapBase, ox, oy, mapBase.width / MAP.ppm * z, mapBase.height / MAP.ppm * z);
  // street names when zoomed in
  if (z >= 1.5) {
    g.save();
    g.globalAlpha = clamp((z - 1.5) / 0.8, 0, 1);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (const L of streetLabels) {
      if (!L.main && z < 2.6) continue;
      const [x, y] = bmToScreen(L.x, L.z);
      if (x < -100 || y < -40 || x > W + 100 || y > Hh + 40) continue;
      g.font = `700 ${L.main ? 12 : 11}px Archivo, sans-serif`;
      if (g.measureText(L.n).width > L.l * z * 1.6) continue;
      g.setTransform(dpr, 0, 0, dpr, x * dpr, y * dpr); g.rotate(L.a);
      g.lineWidth = 3; g.strokeStyle = 'rgba(244,241,234,.85)'; g.strokeText(L.n, 0, 0);
      g.fillStyle = '#2a2f36'; g.fillText(L.n, 0, 0);
    }
    g.restore();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // routes
  for (const [r, col] of [[gps, '#f2c12e'], [wpGps, WP_COL]]) {
    if (!r || r.length < 2) continue;
    g.strokeStyle = 'rgba(16,20,24,.6)'; g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); r.forEach(([x, zz], i) => (i ? g.lineTo : g.moveTo).call(g, ...bmToScreen(x, zz))); g.stroke();
    g.strokeStyle = col; g.lineWidth = 5; g.stroke();
  }
  // blips, then their labels on top
  const labels = [];
  for (const b of bm.blips) {
    const [x, y] = bmToScreen(b.x, b.z);
    if (x < -20 || y < -20 || x > W + 20 || y > Hh + 20) continue;
    const r = Math.max(3.5, (b.r || 7) * 0.8);
    g.fillStyle = b.c; g.strokeStyle = b.label ? '#f4f1ea' : '#101418'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
    if (b.label) labels.push([b.label, x, y - r - 7]);
  }
  g.font = '700 13px Archivo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const [t, x, y] of labels) {
    g.lineWidth = 4; g.strokeStyle = 'rgba(16,20,24,.85)'; g.strokeText(t, x, y);
    g.fillStyle = '#f4f1ea'; g.fillText(t, x, y);
  }
  // the waypoint, a purple diamond on a pin
  if (waypoint) {
    const [x, y] = bmToScreen(waypoint.x, waypoint.z);
    g.strokeStyle = '#101418'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 16); g.stroke();
    g.fillStyle = WP_COL; g.strokeStyle = '#f4f1ea'; g.lineWidth = 2.5;
    diamond(g, x, y - 24, 9); g.fill(); g.stroke();
    g.fillStyle = '#101418'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
  }
  // you
  {
    const [x, y] = bmToScreen(player.pos.x, player.pos.z);
    g.save(); g.translate(x, y); g.rotate(Math.PI - player.heading);
    g.fillStyle = '#f2c12e'; g.strokeStyle = '#101418'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4.5); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  // north and a scale bar
  {
    const x = W - Math.max(16, 0) - 34, y = Math.max(16, 0) + 96;
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill();
    g.fillStyle = '#101418'; g.font = '800 13px Archivo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', x, y + 1);
    const steps = [25, 50, 100, 200, 250, 500, 1000];
    const m = steps.find(s => s * z >= 70) || 1000, w = m * z, bx = W - 22 - w, by = y + 34;
    g.strokeStyle = '#101418'; g.lineWidth = 6; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + w, by); g.stroke();
    g.strokeStyle = '#f4f1ea'; g.lineWidth = 3; g.stroke();
    g.font = '700 12px Archivo, sans-serif'; g.textBaseline = 'bottom'; g.lineWidth = 3; g.strokeStyle = 'rgba(16,20,24,.85)';
    g.strokeText(m >= 1000 ? m / 1000 + ' km' : m + ' m', bx + w / 2, by - 5); g.fillStyle = '#f4f1ea'; g.fillText(m >= 1000 ? m / 1000 + ' km' : m + ' m', bx + w / 2, by - 5);
  }
  bmInfo();
}
function bmInfo() {
  let t = '';
  if (bm.hover) t = bm.hover;
  else if (waypoint) t = `Waypoint: ${waypoint.name || 'Bergen'}` + (wpGps ? ` · ${fmtDist(routeLen(wpGps))}` : '');
  else t = isTouch ? 'Tap the map to set a waypoint' : 'Click the map to set a waypoint';
  if ($('mapinfo').textContent !== t) $('mapinfo').textContent = t;
  $('mapclear').hidden = !waypoint;
}
function wpRoute() {
  if (!waypoint) { wpGps = null; return; }
  wpGps = isIndoors(player.pos) && Math.hypot(waypoint.x - player.pos.x, waypoint.z - player.pos.z) < 15 ? null : route(player.pos.x, player.pos.z, waypoint.x, waypoint.z);
  if (wpGps) wpGps.unshift([player.pos.x, player.pos.z]);
}
function setWaypoint(x, z, name) {
  x = clamp(x, MAP.x0, MAP.x1); z = clamp(z, MAP.z0, MAP.z1);
  waypoint = { x, z, name: name || streetName(x, z) || (city.terrain.height(x, z) < 0.2 ? 'Vågen' : null) };
  wpRoute();
}
function clearWaypoint() { waypoint = null; wpGps = null; }
// what's under the pointer: a labelled blip, else the street
function bmPick(sx, sy) {
  let best = null, bd = 16;
  for (const b of bm.blips) {
    if (!b.label) continue;
    const [x, y] = bmToScreen(b.x, b.z), d = Math.hypot(x - sx, y - sy);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function bmTap(sx, sy) {
  if (waypoint) {
    const [x, y] = bmToScreen(waypoint.x, waypoint.z);
    if (Math.hypot(x - sx, y - sy) < 16 || Math.hypot(x - sx, y - 24 - sy) < 14) { clearWaypoint(); bmDraw(); return; }
  }
  const b = bmPick(sx, sy);
  if (b) setWaypoint(b.x, b.z, b.label);
  else { const [x, z] = bmToWorld(sx, sy); setWaypoint(x, z); }
  bmDraw();
}
function openMap() {
  if (state.mode !== 'play' && state.mode !== 'pause') return;
  if (state.mode === 'play') { audio.pauseRadio(true); if (audio.ctx) audio.ctx.suspend(); }
  $('pause').hidden = true;
  if (wheelOpen) { wheelOpen = false; $('switch').hidden = true; }
  state.mode = 'map';
  $('bigmap').hidden = false;
  $('maptitle').textContent = inHouse(player.pos) ? 'Cappes vei 6' : inOffice(player.pos) ? 'Myreze' : (streetName(player.pos.x, player.pos.z) || 'Bergen');
  if (!isTouch && document.pointerLockElement) document.exitPointerLock();
  bm.cx = player.pos.x; bm.cz = player.pos.z; bm.zoom = Math.max(bm.zoom, bmFit()); bm.hover = null; bm.ptrs.clear(); bm.drag = bm.pinch = null;
  bmClamp();
  drawBigMap();
}
function closeMap() {
  if (state.mode !== 'map') return;
  $('bigmap').hidden = true;
  state.mode = 'play';
  if (audio.ctx) audio.ctx.resume();
  audio.pauseRadio(false);
  for (const k in keys) keys[k] = false;
  requestLock();
  last = performance.now();
  gpsT = 0;
}
bm.cv.addEventListener('pointerdown', e => {
  bm.cv.setPointerCapture(e.pointerId);
  bm.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (bm.ptrs.size === 1) bm.drag = { x: e.clientX, y: e.clientY, cx: bm.cx, cz: bm.cz, moved: false, button: e.button };
  else if (bm.ptrs.size === 2) {
    const [[ax, ay], [bx, by]] = [...bm.ptrs.values()];
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    bm.pinch = { d: Math.hypot(ax - bx, ay - by) || 1, zoom: bm.zoom, w: bmToWorld(mx, my) };
    if (bm.drag) bm.drag.moved = true;
  }
});
bm.cv.addEventListener('pointermove', e => {
  if (!bm.ptrs.has(e.pointerId)) {
    if (e.pointerType === 'mouse') {
      const b = bmPick(e.clientX, e.clientY), [x, z] = bmToWorld(e.clientX, e.clientY);
      bm.hover = b ? b.label : streetName(x, z);
      bmInfo();
    }
    return;
  }
  bm.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (bm.pinch && bm.ptrs.size >= 2) {
    const [[ax, ay], [bx, by]] = [...bm.ptrs.values()];
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    bm.zoom = clamp(bm.pinch.zoom * Math.hypot(ax - bx, ay - by) / bm.pinch.d, bmFit(), bmMax);
    bm.cx = bm.pinch.w[0] - (mx - innerWidth / 2) / bm.zoom; bm.cz = bm.pinch.w[1] - (my - innerHeight / 2) / bm.zoom;
  } else if (bm.drag) {
    const dx = e.clientX - bm.drag.x, dy = e.clientY - bm.drag.y;
    if (Math.hypot(dx, dy) > 6) { bm.drag.moved = true; bm.cv.classList.add('drag'); }
    if (bm.drag.moved) { bm.cx = bm.drag.cx - dx / bm.zoom; bm.cz = bm.drag.cz - dy / bm.zoom; }
  }
  bmClamp(); bmDraw();
});
const bmUp = e => {
  if (!bm.ptrs.has(e.pointerId)) return;
  bm.ptrs.delete(e.pointerId);
  bm.cv.classList.remove('drag');
  if (bm.ptrs.size < 2) bm.pinch = null;
  if (bm.ptrs.size === 1) { const [[x, y]] = [...bm.ptrs.values()]; bm.drag = { x, y, cx: bm.cx, cz: bm.cz, moved: true }; return; }
  const d = bm.drag; bm.drag = null;
  if (e.type !== 'pointerup' || !d || d.moved) return;
  if (d.button === 2) { clearWaypoint(); bmDraw(); return; }
  if (d.button === 0) bmTap(e.clientX, e.clientY);
};
bm.cv.addEventListener('pointerup', bmUp);
bm.cv.addEventListener('pointercancel', bmUp);
bm.cv.addEventListener('contextmenu', e => e.preventDefault());
bm.cv.addEventListener('wheel', e => {
  e.preventDefault();
  const [wx, wz] = bmToWorld(e.clientX, e.clientY);
  bm.zoom = clamp(bm.zoom * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0018)), bmFit(), bmMax);
  bm.cx = wx - (e.clientX - innerWidth / 2) / bm.zoom; bm.cz = wz - (e.clientY - innerHeight / 2) / bm.zoom;
  bmClamp(); bmDraw();
}, { passive: false });
bm.cv.addEventListener('pointerleave', () => { if (bm.hover) { bm.hover = null; bmInfo(); } });
addEventListener('resize', () => { if (state.mode === 'map') { bmClamp(); bmDraw(); } });
$('mapclose').addEventListener('click', closeMap);
$('mapcentre').addEventListener('click', () => { bm.cx = player.pos.x; bm.cz = player.pos.z; bmClamp(); bmDraw(); });
$('mapclear').addEventListener('click', () => { clearWaypoint(); bmDraw(); });
$('mapwrap').addEventListener('click', () => { if (state.mode === 'play') openMap(); });
$('pausemap').addEventListener('click', openMap);
if (isTouch) $('maphint').textContent = 'Tap to set a waypoint · tap it again to remove · drag to move · pinch to zoom';

// ------------------------------------------------------------------ doors
function updateDoors(dt) {
  updateInteriorLights();
  for (const d of [...house.doors, ...office.doors]) {
    if (!d.auto) continue;
    const near = d.pos.distanceTo(_v2.set(player.pos.x, player.pos.y, player.pos.z)) < 2.3;
    if (near && d.target === 0) audio.door();
    d.target = near ? 1 : 0;
    d.open = damp(d.open, d.target, 6, dt);
    d.pivot.rotation.y = d.base + d.angle * d.open;
  }
}

// ------------------------------------------------------------------ speech bubbles
const bubbleTex = new Map();
// a speech bubble; a long line wraps onto two rows at the space nearest the middle
function bubble(text) {
  if (!bubbleTex.has(text)) {
    let rows = [text];
    if (text.length > 24) {
      let cut = -1;
      for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (cut < 0 || Math.abs(i - text.length / 2) < Math.abs(cut - text.length / 2))) cut = i;
      if (cut > 0) rows = [text.slice(0, cut), text.slice(cut + 1)];
    }
    const w = Math.max(384, Math.min(1100, Math.max(...rows.map(r => r.length)) * 32 + 90)), h = rows.length > 1 ? 200 : 128;
    const t = textTexture(rows, { w, h, bg: '#f4f1ea', fg: '#101418', font: '800 54px "Archivo", sans-serif', radius: 40 });
    t.userData.size = [w / 320, h / 320];
    bubbleTex.set(text, t);
  }
  const t = bubbleTex.get(text);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false }));
  s.scale.set(t.userData.size[0], t.userData.size[1], 1);
  s.renderOrder = 10;
  return s;
}

// ------------------------------------------------------------------ pedestrians
// what the housemates say when you knock into them
const LINES = ['Hei!', 'Uff!', 'Pass deg!', 'Typisk.', 'Neimen!', 'Au!', 'Hallo?!', 'Rolig!', 'Eg e fra Bergen!'];
// The people on the street have four voices, in Bergensk: Gubben (m1), Studenten (m2), Fruen (f1)
// and Optimisten (f2). STREET.md has the lines and who reads them; tools/build_street.py makes
// the clips, ped_m1_01 and so on. Each voice has lines for walking past you, for being knocked
// over, for a scooter going past too fast, and for a shot going off nearby.
const STREET_LINES = {
  m1: ['Ja, ja. Det regner. Det har det gjort siden sekstitallet.', 'Brann tar gull i år. Det sier eg hvert år.',
    'I min tid gikk vi opp disse bakkene to ganger om dagen.', 'Paraply? Nei, det e for østlendinger.', 'Hørte du buekorpset i går? Det var tider, det.',
    'Kossen går du, gutten min?!', 'Au! Ryggen min!', 'Din tufs!', 'Herregud, ka e det med ungdommen i dag?',
    'De sparkesyklene skulle vært forbudt!', 'Sakte, for pokker!',
    'Nei, nei, nei, eg e for gammel for dette!', 'Ring politiet! Nei, ring kona mi!'],
  m2: ['Skal du på byen i kveld, eller?', 'Eg sa til han: Dette e ikkje Norge, dette e Bergen.',
    'Har du sett kor mye en skillingsbolle koster nå?', 'Seks grader og pøsregn. Shortsvær.', 'En måke tok kebaben min på Torget. Hele kebaben.',
    'Ey! Ser du ikkje kor du går?', 'Seriøst, kompis?', 'Fysj, telefonen min!', 'Gidder du, eller?',
    'Ey, det e min sparkesykkel!', 'Sjukt! Gjør det igjen!',
    'Nei, nei, eg stikker!', 'Dette skal på Snapchat.'],
  f1: ['Fisketorget e bare for turister nå. Bare turister!', 'Tre cruiseskip i dag. Tre! Man kommer seg ikkje frem.',
    'Det e ikkje dårlig vær, bare dårlige klær.', 'Hun på Rema sa det skal bli sol på torsdag. Ha!', 'Svigersønnen min e fra Oslo. Men han e snill, da.',
    'Uff! Posene mine!', 'Neimen, har du sett!', 'Du burde skamme deg!', 'Kem e foreldrene dine?!',
    'På fortauet?! Nei, nå får det være nok!', 'Eg skal skrive til BT om deg!',
    'Herregud, ikkje skyt! Eg har fisk i posen!', 'Dette hadde aldri skjedd på Kalfaret!'],
  f2: ['Nei, eg står på Torgallmenningen. Kor e du?', 'Se! Det e sol på Fløyen! …Nei, nå e den borte.',
    'Eg skal løpe opp på Ulriken i morgen. Kanskje.', 'Har du prøvd reinsdyrpølsen på Trekroneren?', 'Regnjakke, paraply, gummistøvler. Klar for sommeren!',
    'Au! Hallo?!', 'Neimen, ka driver du med?!', 'Kaffen min! Den var helt ny!', 'Du må jo se deg for!',
    'Wow. Okei. Fint for deg.', 'Hjelm, kanskje?!',
    'Mamma, eg ringer deg tilbake!', 'Løp! Alle sammen, løp!'],
};
// the lines of each kind (1-based), and how much each matters: a line cuts off one of the same
// or lower priority, and waits for one of higher
const LINE_KINDS = { past: { from: 1, to: 5, prio: 0 }, scooter: { from: 10, to: 11, prio: 1 }, hit: { from: 6, to: 9, prio: 2 }, scared: { from: 12, to: 13, prio: 2 } };
const VOICES = ['m1', 'm2', 'f1', 'f2'];
// hair to go with the voice: Gubben is grey, the women wear it long
const VOICE_LOOK = {
  m1: { hair: [0x8a8a8a, 0xbdb9b2], longHair: false },
  m2: { hair: [0x3a2618, 0x1d1d1d, 0x6b4a2a], longHair: false },
  f1: { hair: [0x8a8a8a, 0x6b4a2a, 0xa8906e], longHair: true },
  f2: { hair: [0xc9a26b, 0x3a2618, 0x8a2e1e], longHair: true },
};
const lastLine = {};                 // voice and kind -> the line said last, so it isn't said twice running
const street = { quietT: 6, scaredT: 0 };   // until someone else on the street may start talking, or cry out at a shot
const _camR = new THREE.Vector3();
// a passer-by says a line of the given kind, out loud if it has been recorded
function talk(n, kind) {
  if (!n.voice) { say(n, LINES[Math.floor(Math.random() * LINES.length)]); return; }
  const K = LINE_KINDS[kind], key = n.voice + kind;
  let i = K.from + Math.floor(Math.random() * (K.to - K.from + 1));
  if (i === lastLine[key] && K.to > K.from) i = i === K.to ? K.from : i + 1;
  lastLine[key] = i;
  const id = `ped_${n.voice}_${String(i).padStart(2, '0')}`;
  // a remark in passing waits until its recording has loaded, so nobody mouths it in silence
  if (K.prio === 0 && audio.ctx && audio.on && lineDur(id) && !audio.ready(id)) return;
  // louder the closer to you, from the side of the screen they're on
  const d = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z);
  _camR.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const cx = n.pos.x - camera.position.x, cz = n.pos.z - camera.position.z;
  const pan = (cx * _camR.x + cz * _camR.z) / Math.max(1, Math.hypot(cx, cz)) * 0.7;
  audio.speak(id, clamp(1.15 - d / 26, 0, 1), pan, K.prio);
  say(n, STREET_LINES[n.voice][i - 1], lineDur(id));
}
const npcs = [];
const NPC_N = isTouch ? 14 : 30;
const jackets = [0x2c4c7a, 0x6b2d3a, 0x3f6b4a, 0x22252b, 0xb14b2e, 0x8a8f96, 0x2f5d3a, 0xd9b75a, 0x4a3f6b, 0x1d1d1d];
const umbrellaCols = [0xd23a2b, 0x2b2f36, 0xf2c12e, 0x3a6ea8, null, 0x7a2e8a, 0xe8e2d2, 0x101418, null, 0x2bb673];
function placeNpc(n, near) {
  // a street node 20-110 m from the player
  for (let k = 0; k < 40; k++) {
    const i = Math.floor(Math.random() * gAdj.length);
    if (!gAdj[i].length) continue;
    const d = Math.hypot(gx(i) - near.x, gz(i) - near.z);
    if (d < 20 || d > 110) continue;
    n.a = i; n.b = gAdj[i][Math.floor(Math.random() * gAdj[i].length)]; n.t = Math.random();
    n.pos.set(lerp(gx(n.a), gx(n.b), n.t), 0, lerp(gz(n.a), gz(n.b), n.t));
    n.pos.y = world.floorAt(n.pos.x, n.pos.z, 300);
    n.off = (Math.random() - 0.5) * 1.6;
    return true;
  }
  return false;
}
for (let k = 0; k < NPC_N; k++) {
  const voice = VOICES[k % VOICES.length], V = VOICE_LOOK[voice];
  const fig = new Humanoid({ jacket: jackets[k % jackets.length], pants: [0x2b3140, 0x3b3b3b, 0x4a3a2c][k % 3], hat: Math.random() < 0.5 ? null : [0x2c4c7a, 0x7a2e28, 0x3b3b3b][k % 3], hair: V.hair[Math.floor(k / VOICES.length) % V.hair.length], longHair: V.longHair, umbrella: umbrellaCols[k % umbrellaCols.length] });
  scene.add(fig.root);
  const n = { fig, voice, a: 0, b: 0, t: 0, pos: new THREE.Vector3(), heading: 0, downT: 0, speed: (voice === 'm1' ? 0.85 : 1.1) + Math.random() * 0.4, bubble: null, bubbleT: 0, fall: 0, off: 0, talkT: Math.random() * 20, passT: 0, panicT: 0 };
  npcs.push(n);
}
// ---- the people who live at Cappes vei 6
const HOME_SPOTS = {
  // person: [u, floor, v, local heading, pose]
  oystein: [1.55, 'FU', 6.3, -Math.PI / 2, 'idle'],      // in the kitchen
  theodor: [5.85, 'FU', 7.6, Math.PI, 'sit'],              // on the sofa
  jaakko: [6.35, 'FL', 6.4, Math.PI, 'idle'],             // downstairs, by the desk in the white bedroom (housemates push you away: keep them off the corridors and doorways)
  martin: [6.2, 'FL', 10.7, Math.PI, 'idle'],             // on the terrace
};
const HOME_LINES = {
  havard: ['Hei hei!', 'Har du sett nøklene mine?', 'Regner det fortsatt?', 'Middag på Guangdong?'],
  oystein: ['Har du sett laderen min?', 'Det regner. Igjen.', 'Middag snart?', 'Hvem tok siste bolle?'],
  theodor: ['Otters hold hands when they sleep.', 'Jeg har ikke tid, jeg spiller.', 'Kan du skru ned?', 'Rolig, rolig.'],
  jaakko: ['Moi moi!', 'Skitur i morgen?', 'Swix, ikke Madshus.', 'Guangdong House i kveld?'],
  martin: ['Fin utsikt, ikke sant?', 'Måkene ser på oss.', 'Hvem har vasket badet?', 'Kaffe?'],
};
// All five are playable, as in GTA: you are one of them, and the others are out in town (or at
// home during a story mission). `active` is who you are; the others are NPCs that stand where
// they are and talk when you come close.
const CHAR_IDS = ['havard', 'oystein', 'theodor', 'jaakko', 'martin'];
const CHAR_COL = { havard: '#3a8fd8', oystein: '#2bb673', theodor: '#e0712c', jaakko: '#b48cff', martin: '#e8484f' };
let active = CHAR_IDS.includes(save.char) ? save.char : 'havard';
const housemates = {};
for (const id of CHAR_IDS) {
  const fig = id === 'havard' ? player.fig : new Humanoid({ person: id });
  if (id !== 'havard') scene.add(fig.root);
  const hs = HOME_SPOTS[id];
  const n = { fig, id, pos: hs ? L2V(hs[0], H[hs[1]], hs[2]) : new THREE.Vector3(), heading: (hs ? hs[3] : 0) + H.theta, party: hs ? hs[4] : 'idle', downT: 0, fall: 0, placed: true, talkT: 0, mate: true, active: false };
  fig.root.position.copy(n.pos); fig.root.rotation.y = n.heading;
  // name tag
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture([PEOPLE[id].name], { w: 256, h: 64, bg: 'rgba(16,20,24,0.7)', fg: '#f2c12e', font: '800 40px "Archivo", sans-serif', radius: 30 }), depthTest: true, fog: false }));
  tag.scale.set(0.8, 0.2, 1); tag.position.y = 2.25;
  fig.root.add(tag);
  n.tag = tag;
  npcs.push(n);
  housemates[id] = n;
}
housemates.havard.active = true;
housemates.havard.tag.visible = false;
function knockNpc(n, from) {
  if (n.downT > 0) return;
  n.downT = 3;
  n.fallDir = Math.atan2(n.pos.x - from.x, n.pos.z - from.z);
  talk(n, 'hit');
  audio.bump();
}
// a speech bubble over someone's head, for as long as the line takes to say (dur, in seconds)
function say(n, text, dur = 0) {
  if (n.bubble) n.fig.root.remove(n.bubble);
  n.bubble = bubble(text);
  n.bubble.position.y = (n.mate ? 2.6 : 2.35) + (n.bubble.scale.y - 0.4) / 2;
  n.fig.root.add(n.bubble);
  n.bubbleT = Math.max(2.2, dur + 0.5);
}
// ------------------------------------------------------------------ day and night
// The sun goes round once every five minutes. By night the sky goes dark blue with stars and a
// moon in the gaps between the clouds, the moon lights the town, the windows glow, and the
// street lamps come on.
const sunDirV = new THREE.Vector3(), moonDirV = new THREE.Vector3();
const NIGHT = {
  top: new THREE.Color(0x0b1424), hor: new THREE.Color(0x1c2638), dusk: new THREE.Color(0xd9875a), duskTop: new THREE.Color(0x3d4566),
  hemi: new THREE.Color(0x6a7cab), moon: new THREE.Color(0xa9bcff), sunLow: new THREE.Color(0xffa060), sunHigh: new THREE.Color(0xffeedd),
};
const _dc = new THREE.Color();
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// street lamps: a pool of warm light on the street under every lamp (painted into the terrain, in
// city.js), a halo round every head, and a few real lights that follow you from lamp to lamp
const lampSpots = city.lamps ? city.lamps.spots : [];
const radialTex = (stops) => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const lampHalos = (() => {
  const pos = new Float32Array(lampSpots.length * 3);
  lampSpots.forEach(([x, y, z], i) => { pos[i * 3] = x; pos[i * 3 + 1] = y + 4.62; pos[i * 3 + 2] = z; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({
    size: 2.4, sizeAttenuation: true, map: radialTex([[0, 'rgba(255,240,210,1)'], [0.2, 'rgba(255,200,130,0.6)'], [1, 'rgba(255,160,80,0)']]),
    color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pts.frustumCulled = false; pts.visible = false;
  scene.add(pts);
  return pts;
})();
const LAMP_N = isTouch ? 3 : 6;
const lampLights = Array.from({ length: LAMP_N }, () => { const l = new THREE.PointLight(0xffc27a, 0, 20, 1.4); scene.add(l); return l; });
let lampPickT = 0;
const lampOrder = lampSpots.map((_, i) => i);
function updateLampLights(dt, k) {
  const f = state.mode === 'title' ? camera.position : player.pos;
  lampPickT -= dt;
  if (lampPickT <= 0 && k > 0) {
    lampPickT = 0.4;
    const d2 = i => (lampSpots[i][0] - f.x) ** 2 + (lampSpots[i][2] - f.z) ** 2;
    lampOrder.sort((a, b) => d2(a) - d2(b));
    for (let j = 0; j < LAMP_N; j++) { const sp = lampSpots[lampOrder[j]]; if (sp) lampLights[j].position.set(sp[0], sp[1] + 4.4, sp[2]); }
  }
  for (const l of lampLights) {
    const d = Math.hypot(l.position.x - f.x, l.position.z - f.z);
    l.intensity = k * 11 * clamp(1 - (d - 28) / 18, 0, 1);       // the farthest fade out before they move on
  }
}
function updateDayNight(dt) {
  if (state.mode !== 'pause') clock.t = (clock.t + dt / DAY_LEN) % 1;
  const a = (clock.t - 0.25) * Math.PI * 2;
  sunDirV.set(-Math.cos(a) * 0.8, Math.sin(a) * 0.78 + 0.06, 0.55).normalize();
  moonDirV.set(Math.cos(a) * 0.8, -Math.sin(a) * 0.6 + 0.25, -0.45).normalize();
  const el = sunDirV.y, r = weather.rain;
  const k = smooth(-0.1, 0.2, el), dusk = clamp(1 - Math.abs(el - 0.03) / 0.16, 0, 1) * (1 - r * 0.55);
  dayState.k = k;
  // the sky: the weather's colours by day, dark blue by night, warm at dusk and dawn
  _dc.copy(skyU.top.value); skyU.top.value.lerpColors(NIGHT.top, _dc, k).lerp(NIGHT.duskTop, dusk * 0.35);
  _dc.copy(skyU.horizon.value); skyU.horizon.value.lerpColors(NIGHT.hor, _dc, k).lerp(NIGHT.dusk, dusk * 0.55);
  skyU.day.value = k;
  skyU.sunDir.value.copy(sunDirV); skyU.moonDir.value.copy(moonDirV);
  scene.fog.color.copy(skyU.horizon.value);
  // the light: the sun by day, the moon by night (its direction never lower than ~10 degrees,
  // so the shadows stay sensible)
  const bySun = el > -0.04;
  sunOffset.copy(bySun ? sunDirV : moonDirV);
  if (sunOffset.y < 0.18) { sunOffset.y = 0.18; sunOffset.normalize(); }
  if (bySun) { sun.intensity *= k; sun.color.lerpColors(NIGHT.sunLow, NIGHT.sunHigh, clamp(el / 0.35, 0, 1)); }
  else { sun.intensity = 0.6 * (1 - k) * (1 - r * 0.35); sun.color.copy(NIGHT.moon); }
  // never pitch black: a blue night light everywhere, the lamps on top of it
  hemi.intensity = Math.max(hemi.intensity * lerp(0.5, 1, k), 0.42);
  hemi.color.lerp(NIGHT.hemi, 1 - k);
  scene.environmentIntensity = lerp(0.32, 0.75, k);
  renderer.toneMappingExposure = lerp(1.5, 1.08, k);
  // the lamps come on at dusk (a little earlier under heavy cloud)
  const lamp = 1 - smooth(0.2, 0.6, k * (1 - 0.3 * r));
  dayState.lamp = lamp;
  if (city.lamps) city.lamps.headMat.emissiveIntensity = lerp(0.15, 4.5, lamp);
  if (city.nightGlow) city.nightGlow.value = lamp;
  lampHalos.visible = lamp > 0.01;
  if (city.lamps) city.lamps.glow.value = lamp;
  rainU.color.value.setHex(0xb8c6d2).multiplyScalar(lerp(0.28, 1, k));
  lampHalos.material.color.setRGB(1, 0.85, 0.6).multiplyScalar(0.9 * lamp);
  updateLampLights(dt, lamp);
  places.update(dt, lamp);
  landmarks.update(dt, lamp, time);
  shopSigns.update(lamp);
}
// the scooter's headlight: one spot light, on the scooter you ride, at night
const headlight = new THREE.SpotLight(0xfff0d8, 0, 34, 0.42, 0.55, 1.1);
headlight.castShadow = false;
scene.add(headlight, headlight.target);
function updateHeadlight() {
  const s = player.riding, k = dayState.lamp;
  SCOOTER_LAMP.emissiveIntensity = lerp(1, 6, k);
  if (!s || k < 0.02 || state.mode === 'title') { headlight.intensity = 0; return; }
  const fx = Math.sin(s.heading), fz = Math.cos(s.heading);
  headlight.position.set(s.pos.x + fx * 0.6, s.pos.y + 0.98, s.pos.z + fz * 0.6);
  headlight.target.position.set(s.pos.x + fx * 9, s.pos.y - 0.4 - Math.sin(s.tilt) * 9, s.pos.z + fz * 9);
  headlight.target.updateMatrixWorld();
  headlight.intensity = 70 * k;
}
const clockText = () => { const m = Math.floor(clock.t * 24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

// ------------------------------------------------------------------ the night: women on the corners
// When the lamps are on, a few women work the street corners in the centre, under the lamps
// around Torget, Strandkaien and Vågsallmenningen. They call out as you pass and are gone by
// morning. They come and go out of sight, so nobody pops in or out in front of you.
const NIGHT_LINES = ['Hey, handsome!', 'Nice scooter, darling.', 'Looking for company tonight?', 'Cold night, sweetheart.',
  'Lost, honey?', 'Buy a girl a bolle?', 'Not in that raincoat, love.', 'Ooh, a pistol. Scary.', 'Keep walking, cutie.'];
const nightPeople = [];
{
  const looks = [
    { hair: 0x1a1210, skin: 0xe8c4a6, night: { top: 0xff2f8e, skirt: 0x111111, boots: 0xb3261e, boa: 0xff8fc8, bag: 0x111111 } },
    { hair: 0xe8cf8a, skin: 0xf0d2bb, night: { top: 0xb3261e, skirt: 0xb3261e, boots: 0x111111, boa: 0xf4f1ea, bag: 0xb3261e } },
    { hair: 0x2a1a12, skin: 0x8d5a3b, night: { top: 0xb46cff, skirt: 0xf2f0ea, boots: 0xf2f0ea, boa: 0xb46cff, bag: 0xf2f0ea } },
    { hair: 0x8a2e1e, skin: 0xe8c4a6, night: { top: 0x111111, skirt: 0xd9b13b, boots: 0x111111, boa: 0xd9407a, bag: 0xd9b13b } },
    { hair: 0x101010, skin: 0xc68e62, night: { top: 0x3fe0d0, skirt: 0x111111, boots: 0x3fe0d0, boa: 0x111111, bag: 0x111111 } },
    { hair: 0xf2e6c2, skin: 0xf0d2bb, night: { top: 0xffd400, skirt: 0xff2f8e, boots: 0xf2f0ea, boa: 0xffd400, bag: 0xff2f8e } },
  ];
  const spots = [];
  for (const sp of lampSpots) {
    const [x, , z] = sp;
    if (x < -480 || x > -240 || z < -340 || z > -110) continue;
    if (spots.some(o => Math.hypot(o[0] - x, o[2] - z) < 40)) continue;
    spots.push(sp);
    if (spots.length >= looks.length) break;
  }
  spots.forEach(([x, , z], i) => {
    // stand by the lamp, facing the street
    const ni = nearestNode(x, z, 30);
    const fx = ni >= 0 ? gx(ni) - x : 1, fz = ni >= 0 ? gz(ni) - z : 0, fl = Math.hypot(fx, fz) || 1;
    const px = x + fx / fl * 0.7, pz = z + fz / fl * 0.7;
    const fig = new Humanoid({ ...looks[i], hat: null, scale: 0.97 });
    fig.root.visible = false;
    scene.add(fig.root);
    const y = world.floorAt(px, pz, world.terrain.height(px, pz) + 2, 3);
    const pos = new THREE.Vector3(px, y > -50 ? y : world.terrain.height(px, pz), pz);
    nightPeople.push({ fig, pos, home: pos.clone(), homeHeading: Math.atan2(fx, fz), base: Math.atan2(fx, fz), heading: Math.atan2(fx, fz), shown: false, talkT: Math.random() * 4, bubble: null, bubbleT: 0, phase: Math.random() * 6, ride: null, away: false });
  });
}
// Like GTA: pull up beside one of them on a scooter at night, slow, and press E. If you have the
// money she climbs on the back. Find somewhere quiet (stopped, nobody about, away from the corners)
// and wait: it all happens off camera, so to speak, while the scooter rocks, your kroner tick away
// and your health and boost fill up. Ride off, press E, or run out of money and it's over; she gets
// off and finds her own way back to her corner.
const SERVICE = { price: 20, tick: 1.4, ticks: 8 };
const PICKUP_LINES = ['Ooh, a sparkesykkel. Classy.', 'Somewhere quiet, darling.', 'Hold it steady, love.', 'Not too fast, I\'m in heels.'];
const SERVICE_LINES = ['Mmm, Fjellet boys…', 'Mind the kickstand!', 'Oh, darling…', 'Careful, it rocks!', 'Ooh, the brakes!'];
const nightPassenger = () => nightPeople.find(w => w.ride);
function nightCandidate() {
  const s = player.riding;
  if (!s || state.mode !== 'play' || player.carrying || dayState.lamp <= 0.6 || Math.abs(s.speed) > 2.5 || s.trick || nightPassenger()) return null;
  let best = null, bd = 3.5;
  for (const w of nightPeople) {
    if (!w.shown || w.away || !w.fig.root.visible || Math.abs(player.pos.y - w.pos.y) > 2) continue;
    const d = Math.hypot(player.pos.x - w.pos.x, player.pos.z - w.pos.z);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}
function nightPrompt() {
  const w = nightPassenger();
  if (w && w.ride.serving) return isTouch ? 'Ride off to stop' : '<kbd>E</kbd> or ride off to stop';
  if (w) return w.ride.quietT > 0 ? 'Somewhere quiet… wait…' : 'Find somewhere quiet and stop';
  if (nightCandidate()) return save.money >= SERVICE.price ? `<kbd>E</kbd>Pick her up · ${SERVICE.price} kr` : 'No kroner, no company';
  return '';
}
// E on a scooter next to her: she climbs on. Returns true if E was used up here.
function tryPickup() {
  const w = nightPassenger();
  if (w && w.ride.serving) { endService(w, 'That\'s all, sweetie?'); return true; }
  const c = nightCandidate();
  if (!c) return false;
  if (save.money < SERVICE.price) { say(c, 'No kroner, no company, love.'); audio.bump(); return true; }
  if (gun.drawn) toggleGun(false);
  c.ride = { s: player.riding, quietT: 0, serving: false, tickT: 0, ticks: 0, rock: 0 };
  if (c.bubble) { c.fig.root.remove(c.bubble); c.bubble = null; }
  say(c, PICKUP_LINES[Math.floor(Math.random() * PICKUP_LINES.length)]);
  audio.pickup();
  toast('Find somewhere quiet', 2.2);
  return true;
}
// somewhere quiet: nobody walking about nearby, not under a corner lamp, not in the house
function quietHere() {
  const p = player.pos;
  if (inHouse(p)) return false;
  for (const n of npcs) if (!n.active && n.placed && n.fig.root.visible && n.pos.distanceTo(p) < 18) return false;
  for (const w of nightPeople) if (!w.ride && w.shown && Math.hypot(w.home.x - p.x, w.home.z - p.z) < 30) return false;
  return true;
}
function endService(w, line) {
  const r = w.ride;
  if (r.serving) { audio.coin(); toast(`Paid ${r.ticks * SERVICE.price} kr`, 2.2); }
  dropOff(w, line);
}
// she gets off on the left of the scooter (you get off on the right)
function dropOff(w, line) {
  const s = w.ride.s;
  w.ride = null; w.away = true;
  const sx = -Math.cos(s.heading) * 0.8, sz = Math.sin(s.heading) * 0.8;
  w.pos.set(s.pos.x + sx, s.pos.y, s.pos.z + sz);
  world.collide(w.pos, RADIUS, HEIGHT, STEP);
  const fl = world.floorAt(w.pos.x, w.pos.z, w.pos.y + 1, 2);
  if (fl > -50) w.pos.y = fl;
  w.base = w.heading = s.heading + Math.PI / 2;
  w.fig.body.rotation.x = 0;
  if (line) say(w, line);
}
function updatePassenger(w, dt) {
  const r = w.ride, s = r.s;
  if (player.riding !== s || state.mode === 'dead') { dropOff(w, r.serving ? 'Hey! You still owe me!' : 'Ow! Idiot!'); return; }
  if (s.trick) { dropOff(w, 'Are you mad?! I\'m off.'); return; }
  if (gun.drawn) { dropOff(w, 'Put that thing away!'); return; }
  if (dayState.lamp <= 0.6 && !r.serving) { dropOff(w, 'Sun\'s up. I\'m off, love.'); return; }
  const still = Math.abs(s.speed) < 0.3 && !s.trick;
  if (!r.serving) {
    r.quietT = still && quietHere() ? r.quietT + dt : 0;
    if (r.quietT > 1.5) { r.serving = true; r.tickT = 0.6; say(w, 'Here? Alright, darling.'); }
  } else {
    if (!still) { endService(w, 'In a hurry, are we?'); return; }
    r.tickT -= dt;
    if (r.tickT <= 0) {
      r.tickT = SERVICE.tick;
      if (save.money < SERVICE.price) { endService(w, 'No more kroner? Bye, love.'); return; }
      save.money -= SERVICE.price; r.ticks++; persist();
      player.health = Math.min(100, player.health + 10); player.regenT = 0;
      turbo.charge = Math.min(1, turbo.charge + 0.15);
      if (r.ticks % 3 === 1) say(w, SERVICE_LINES[Math.floor(Math.random() * SERVICE_LINES.length)]);
      emit(_v.set(s.pos.x, s.pos.y + 1.9, s.pos.z), 4, { color: 0xff5fa8, speed: 0.3, up: 0.9, spread: 0.3, life: 0.9, grav: -0.6 });
      if (r.ticks >= SERVICE.ticks) { endService(w, 'Same time tomorrow, handsome?'); return; }
    }
  }
  // rock the scooter while it's going on (after the scooter and the rider have been posed)
  r.rock = damp(r.rock, r.serving ? 1 : 0, 4, dt);
  const rk = Math.sin(time * 9) * 0.06 * r.rock;
  s.obj.rotation.z += rk; player.fig.root.rotation.z += rk;
  // she stands on the back of the deck, holding on
  const bx = -Math.sin(s.heading) * 0.36, bz = -Math.cos(s.heading) * 0.36;
  w.pos.set(s.pos.x + bx, s.pos.y, s.pos.z + bz);
  w.fig.animate(dt, 0, 'ride');
  w.fig.root.visible = true;
  w.fig.root.position.copy(w.pos).add(_v.set(0, 0.17 + Math.abs(rk) * 0.4, 0));
  w.fig.root.rotation.set(s.tilt, s.heading, s.lean + rk, 'YXZ');
  w.fig.body.rotation.z = 0;
  if (w.bubble) { w.bubbleT -= dt; if (w.bubbleT <= 0) { w.fig.root.remove(w.bubble); w.bubble = null; } }
}
function updateNightPeople(dt) {
  const night = dayState.lamp > 0.6;
  for (const w of nightPeople) {
    if (w.ride) { updatePassenger(w, dt); continue; }
    const dCam = w.pos.distanceTo(camera.position);
    // dropped off somewhere: once you're out of sight she's back on her corner
    if (w.away && dCam > 45) { w.away = false; w.pos.copy(w.home); w.base = w.heading = w.homeHeading; }
    if (night !== w.shown && dCam > 45) { w.shown = night; if (!night && w.bubble) { w.fig.root.remove(w.bubble); w.bubble = null; } }
    w.fig.root.visible = w.shown && dCam < 95;
    if (!w.fig.root.visible) continue;
    if (w.bubble) { w.bubbleT -= dt; if (w.bubbleT <= 0) { w.fig.root.remove(w.bubble); w.bubble = null; } }
    const dx = player.pos.x - w.pos.x, dz = player.pos.z - w.pos.z, d = Math.hypot(dx, dz);
    const near = state.mode === 'play' && d < 9 && Math.abs(player.pos.y - w.pos.y) < 2.5;
    // turn to watch you go by, then back to the street
    w.heading += angDiff(w.heading, near ? Math.atan2(dx, dz) : w.base) * Math.min(1, dt * 3);
    w.talkT -= dt;
    if (near && d < 5.5 && w.talkT <= 0) { say(w, NIGHT_LINES[Math.floor(Math.random() * NIGHT_LINES.length)]); w.talkT = 9 + Math.random() * 6; }
    if (near && d < 0.55 && d > 1e-4) { player.pos.x += dx / d * (0.55 - d); player.pos.z += dz / d * (0.55 - d); }
    w.phase += dt;
    w.fig.animate(dt, 0, w.bubble && w.bubbleT > 1.4 ? 'wave' : 'pose');
    w.fig.body.rotation.z = Math.sin(w.phase * 0.9) * 0.04;      // a slow sway, weight on one hip
    w.fig.root.position.copy(w.pos);
    w.fig.root.rotation.set(0, w.heading, 0);
  }
}

function updateNpcs(dt) {
  const focus = state.mode === 'title' ? camera.position : player.pos;
  street.quietT -= dt; street.scaredT -= dt;
  const pSpeed = player.riding ? Math.abs(player.riding.speed) : Math.hypot(player.vel.x, player.vel.z);
  for (const n of npcs) {
    if (n.active) continue;          // that one is you
    if (n.bubble) { n.bubbleT -= dt; if (n.bubbleT <= 0) { n.fig.root.remove(n.bubble); n.bubble = null; } }
    if (n.party) {
      n.fig.animate(dt, 0, n.party);
      n.fig.root.position.copy(n.pos);
      n.fig.root.rotation.set(0, n.heading, 0);
      if (n.mate && state.mode === 'play') {
        const dx = player.pos.x - n.pos.x, dz = player.pos.z - n.pos.z, d = Math.hypot(dx, dz);
        n.talkT -= dt;
        if (d < 2.2 && Math.abs(player.pos.y - n.pos.y) < 1.5 && n.talkT <= 0) {
          const L = HOME_LINES[n.id];
          say(n, L[Math.floor(Math.random() * L.length)]);
          n.talkT = 7;
        }
        if (d < 0.55 && d > 1e-4 && Math.abs(player.pos.y - n.pos.y) < 1.2) { player.pos.x += dx / d * (0.55 - d); player.pos.z += dz / d * (0.55 - d); }
      }
      continue;
    }
    if (!n.placed || n.pos.distanceTo(focus) > 150) { n.placed = placeNpc(n, focus); n.fig.root.visible = n.placed; if (!n.placed) continue; }
    // far away: don't draw, don't animate; mid distance: no shadow
    const dCam = n.pos.distanceTo(camera.position);
    n.fig.root.visible = dCam < 95;
    n.fig.mesh.castShadow = dCam < 35;
    if (n.downT > 0) {
      n.downT -= dt;
      n.fall = n.downT > 0.6 ? damp(n.fall, 1, 10, dt) : damp(n.fall, 0, 8, dt);
    } else {
      const ax = gx(n.a), az = gz(n.a), bx = gx(n.b), bz = gz(n.b);
      const len = Math.hypot(bx - ax, bz - az) || 0.1;
      if (n.panicT > 0) n.panicT -= dt;
      n.t += n.speed * (n.panicT > 0 ? 2.6 : 1) * dt / len;
      if (n.t >= 1) {
        const nb = gAdj[n.b].filter(j => j !== n.a);
        const next = nb.length ? nb[Math.floor(Math.random() * nb.length)] : n.a;
        n.a = n.b; n.b = next; n.t = 0;
      }
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      // walk a little to the side of the centre line
      const tx = lerp(ax, bx, Math.min(1, n.t)) - dz * n.off, tz = lerp(az, bz, Math.min(1, n.t)) + dx * n.off;
      n.heading += angDiff(n.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 5);
      n.pos.x = tx; n.pos.z = tz;
      const fl = world.floorAt(n.pos.x, n.pos.z, n.pos.y + 1.0, 1.0);
      if (fl > -1e8) n.pos.y = damp(n.pos.y, fl, 15, dt);
    }
    // bump with the player
    const dx = player.pos.x - n.pos.x, dz = player.pos.z - n.pos.z, d = Math.hypot(dx, dz);
    if (state.mode === 'play' && d < 0.6 && Math.abs(player.pos.y - n.pos.y) < 1.2 && d > 1e-4 && n.downT <= 0) {
      if (pSpeed > 5) knockNpc(n, player.pos);
      else { player.pos.x += dx / d * (0.6 - d); player.pos.z += dz / d * (0.6 - d); }
    }
    // Talk as you go by: a word to you when you walk past (now and then: one person at a time,
    // and nobody says something every time), and a shout after a scooter that went by too fast
    n.talkT -= dt; n.passT -= dt;
    if (state.mode === 'play' && n.downT <= 0 && n.fig.root.visible && Math.abs(player.pos.y - n.pos.y) < 1.5) {
      if (player.riding && pSpeed > 6 && d > 0.6 && d < 3.5 && n.passT <= 0 && street.quietT < 4 && !audio.speaking(1)) {
        talk(n, 'scooter'); n.passT = 20; street.quietT = Math.max(street.quietT, 3);
      } else if (!player.riding && d < 3 && n.talkT <= 0 && street.quietT <= 0 && !audio.speaking(0)) {
        if (Math.random() < 0.6) { talk(n, 'past'); street.quietT = 8 + Math.random() * 8; }
        n.talkT = 45 + Math.random() * 30;
      }
    }
    n.fig.animate(dt, n.downT > 0 ? 0 : n.speed * (n.panicT > 0 ? 2.6 : 1), 'walk');
    n.fig.root.position.copy(n.pos);
    n.fig.root.rotation.set(0, n.downT > 0 ? n.fallDir : n.heading, 0);
    n.fig.body.rotation.x = n.fall * 1.45;
    if (n.fall > 0.01) n.fig.body.position.y = 0.12 * n.fall;
  }
}

// ------------------------------------------------------------------ scooters
const scooters = [];
function addScooter(x, z, heading) {
  const obj = makeScooter();
  scene.add(obj);
  const s = { obj, pos: new THREE.Vector3(x, 0, z), heading, speed: 0, vy: 0, home: [x, z, heading], tilt: 0, lean: 0 };
  s.pos.y = world.floorAt(x, z, 100);
  scooters.push(s);
  return s;
}
const SC_HOME = L2W(11, -2.3);
addScooter(SC_HOME[0], SC_HOME[1], Math.atan2(HUX, HUZ));
addScooter(-183, -80, 0.3);           // Domkirkeplassen
addScooter(-425, -205, 2.5);          // Torget
addScooter(40, -265, -1.2);           // Fjellveien, by the funicular halt
addScooter(-58, 40, 0.8);             // Asylplassen
addScooter(-552, -410, 0.8);          // Bryggen
// and plenty more, parked along the streets all over town (the same spots every time): at a
// street node, a little to the side, along the street, never on steps, in the sea or in a wall
{
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const cand = [];
  for (let i = 0; i < gAdj.length; i++) if (gAdj[i].length) cand.push(i);
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const probe = new THREE.Vector3();
  let added = 0;
  for (const i of cand) {
    if (added >= 34) break;
    const j = gAdj[i][0], ex = gx(j) - gx(i), ez = gz(j) - gz(i), el = Math.hypot(ex, ez);
    if (el < 3) continue;
    const side = rnd() < 0.5 ? -1 : 1;
    const x = gx(i) - ez / el * 1.6 * side, z = gz(i) + ex / el * 1.6 * side;
    if (x < AX0 + 20 || x > AX1 - 20 || z < AZ0 + 20 || z > AZ1 - 20) continue;
    const kind = city.onRoad(x, z);
    if (!kind || kind === 'steps' || city.onSteps(x, z)) continue;
    if (city.terrain.height(x, z) < 1 || inHouse({ x, y: 30, z })) continue;
    const W = W2L(x, z); if (W[0] > -6 && W[0] < 14 && W[1] > -6 && W[1] < 16) continue;
    if (scooters.some(s => Math.hypot(s.pos.x - x, s.pos.z - z) < 38)) continue;
    const y = world.floorAt(x, z, 200, 300);
    if (!(y > -50)) continue;
    probe.set(x, y, z);
    if (world.collide(probe, 0.45, 1.5, 0.3)) continue;
    addScooter(x, z, Math.atan2(ex, ez) + (rnd() < 0.5 ? 0 : Math.PI));
    added++;
  }
}
// Tricks (right-click, or T): a hop with a tailwhip, a 360 (hold A or D) or a backflip (hold S).
// Land it all the way round for a few kroner and some boost; land halfway round and you crash.
const TRICKS = {
  tailwhip: { name: 'Tailwhip', dur: 0.45, vy: 5.8, kr: 20 },
  spin: { name: '360', dur: 0.5, vy: 5.8, kr: 15 },
  backflip: { name: 'Backflip', dur: 0.62, vy: 7.6, kr: 40 },
};
const turbo = { charge: 1, on: false };
function startTrick(s, input) {
  if (s.trick) return;
  const kind = input.y < -0.3 ? 'backflip' : Math.abs(input.x) > 0.3 ? 'spin' : 'tailwhip';
  const T = TRICKS[kind];
  const fl = world.floorAt(s.pos.x, s.pos.z, s.pos.y + 0.1, 0.5);
  if (s.pos.y <= fl + 0.06) { s.vy = T.vy; s.pos.y += 0.02; audio.jump(); }
  else if (s.vy < -2) return;                       // too late to start one: already coming down
  s.trick = { kind, t: 0, dur: T.dur, dir: input.x > 0 ? -1 : 1, air: false };
}
const _tq = new THREE.Quaternion(), _te = new THREE.Euler(), _tpv = new THREE.Vector3();
// the trick's rotation for the deck, and for the rider (who stays put through a tailwhip),
// both turning about a point 0.9 m above the deck
function trickRot(s, rider) {
  const tr = s.trick, k = Math.min(1, tr.t / tr.dur), e = k * k * (3 - 2 * k), turn = Math.PI * 2 * e;
  const yaw = tr.kind === 'spin' || (tr.kind === 'tailwhip' && !rider) ? turn * tr.dir : 0;
  const pitch = tr.kind === 'backflip' ? -turn : 0;
  return _tq.setFromEuler(_te.set(s.tilt + pitch, s.heading + yaw, s.lean, 'YXZ'));
}
function pivotOffset(q, h, out) { return out.set(0, h, 0).applyQuaternion(q).multiplyScalar(-1).add(_tpv.set(0, h, 0)); }
function poseTrick(s) {
  const q = trickRot(s, false);
  s.obj.quaternion.copy(q);
  s.obj.position.copy(s.pos).add(pivotOffset(q, 0.9, _v));
}
const scInfo = {};
function updateScooter(s, dt, input) {
  const ridden = player.riding === s;
  // parked and still: nothing to simulate until someone rides it or shoots it
  if (!ridden && s.asleep) return false;
  if (s.vdir === undefined) s.vdir = s.heading;
  // the scooter points along `heading` but travels along `vdir`: they only part in a drift
  const fwd = _v2.set(Math.sin(s.vdir), 0, Math.cos(s.vdir));
  // ground and slope
  const fl = world.floorAt(s.pos.x, s.pos.z, s.pos.y + 0.1, 0.5, scInfo);
  const onStairs = (scInfo.block && scInfo.block.stairs) || city.onSteps(s.pos.x, s.pos.z);
  const grounded = s.pos.y <= fl + 0.05;
  let slope = 0;
  if (grounded) {
    const hf = world.floorAt(s.pos.x + fwd.x * 0.6, s.pos.z + fwd.z * 0.6, s.pos.y + 0.6, 0.9);
    const hb = world.floorAt(s.pos.x - fwd.x * 0.6, s.pos.z - fwd.z * 0.6, s.pos.y + 0.6, 0.9);
    if (hf > -50 && hb > -50) slope = (hf - hb) / 1.2;
  }
  // Drift: hold Shift (Run) at speed and the back wheel lets go. The scooter turns faster than it
  // travels, so it slides sideways; let go of Shift after a good drift for a burst of speed.
  const drifting = ridden && grounded && input.drift && s.speed > 4 && !onStairs;
  // Boost: hold Shift (Run). It drains the meter and refills slowly, and faster after a drift.
  const boosting = ridden && input.run && turbo.charge > 0.01 && s.speed > -0.5;
  turbo.on = boosting;
  if (ridden) turbo.charge = clamp(turbo.charge + (boosting ? -dt / 3.2 : dt / 10), 0, 1);
  if (drifting && !s.drifting) s.driftT = 0;
  s.drifting = drifting;
  if (ridden && grounded) {
    const thr = input.y;
    if (thr > 0) s.speed += thr * (s.speed < 0 ? 12 : 5.5) * dt;
    else if (thr < 0) s.speed += thr * (s.speed > 0.5 ? 11 : 3) * dt;
    if (boosting) s.speed += 9 * dt;
    const turn = 2.3 * clamp(Math.abs(s.speed) / 3, 0.25, 1) * (s.speed < 0 ? -1 : 1) * (drifting ? 1.75 : 1);
    s.heading -= input.x * turn * dt;
    s.lean = damp(s.lean, -input.x * clamp(s.speed / 10, 0, 1) * (drifting ? 0.6 : 0.35), 6, dt);
  } else s.lean = damp(s.lean, 0, 6, dt);
  // grip: the direction of travel follows where the scooter points, slowly while drifting
  const slip = angDiff(s.vdir, s.heading);
  s.vdir += slip * Math.min(1, dt * (drifting ? 1.5 : grounded ? 14 : 2));
  if (s.speed < 0.5) s.vdir = s.heading;
  // never more than about 40 degrees sideways: past that a scooter would just fall over
  { const sl = angDiff(s.vdir, s.heading); if (Math.abs(sl) > 0.7) s.vdir = s.heading - Math.sign(sl) * 0.7; }
  s.slip = angDiff(s.vdir, s.heading);
  if (drifting) {
    s.speed *= 1 - Math.min(0.9, Math.abs(Math.sin(s.slip))) * 0.55 * dt;   // sliding scrubs speed
    if (Math.abs(s.slip) > 0.2) s.driftT += dt;
  } else if (ridden && s.driftT > 0) {
    // let go after a proper drift: a boost, bigger for longer drifts
    if (s.driftT > 0.6 && grounded) {
      const b = Math.min(4, 1.2 + s.driftT * 1.4);
      s.speed += b; s.boostT = 1.3;
      turbo.charge = Math.min(1, turbo.charge + Math.min(0.4, s.driftT * 0.15));
      audio.start2(); cam.shake = Math.max(cam.shake, 0.25);
      if (s.driftT > 1.5) { save.money += Math.round(s.driftT * 2); toast(`Drift! ${s.driftT.toFixed(1)} s  +${Math.round(s.driftT * 2)} kr`, 1.6); }
    }
    s.driftT = 0;
  }
  s.boostT = Math.max(0, (s.boostT || 0) - dt);
  if (grounded) {
    s.speed -= slope * 9.8 * 0.55 * dt;
    s.speed *= 1 - (ridden && input.y !== 0 ? 0.25 : 0.9) * dt;
    const maxS = onStairs ? 4.5 : 12.5 + (s.boostT > 0 || boosting ? 5 : 0);
    s.speed = clamp(s.speed, -3, maxS);
    if (onStairs && Math.abs(s.speed) > 1.5 && ridden) { cam.shake = Math.max(cam.shake, 0.35); if (Math.random() < dt * 8) audio.bump(); }
  }
  // move
  const dist = s.speed * dt, n = Math.max(1, Math.ceil(Math.abs(dist) / 0.1));
  let crashed = false;
  for (let i = 0; i < n; i++) {
    const px = s.pos.x, pz = s.pos.z;
    s.pos.x += fwd.x * dist / n; s.pos.z += fwd.z * dist / n;
    // walls of earth: the terrain rises too steeply
    const g1 = world.terrain.ground(s.pos.x, s.pos.z);
    if (g1 > s.pos.y + Math.abs(dist / n) * 1.2 + 0.08) {
      s.pos.x = px; s.pos.z = pz;
      if (ridden && Math.abs(s.speed) > 7.5) { crashed = true; break; }
      s.speed *= -0.2; audio.bump(); break;
    }
    const hit = world.collide(s.pos, 0.35, 1.7, 0.45);
    if (hit) {
      const into = -(hit.nx * fwd.x + hit.nz * fwd.z);
      if (ridden && Math.abs(s.speed) > 7.5 && into > 0.5) { crashed = true; break; }
      s.speed *= into > 0.5 ? -0.25 : 0.9;
      if (into > 0.5 && Math.abs(s.speed) > 1) audio.bump();
    }
  }
  // vertical
  const fl2 = world.floorAt(s.pos.x, s.pos.z, s.pos.y + 0.1, 0.5);
  const tr = s.trick;
  if (tr) { tr.t += dt; if (s.pos.y > fl2 + 0.08) tr.air = true; }
  let landed = false;
  if (s.vy <= 0 && s.pos.y <= fl2 + 0.35 && (grounded || s.pos.y <= fl2)) { s.pos.y = fl2; if (s.vy < -6 && ridden) { audio.land(); cam.shake = 0.5; } s.vy = 0; landed = true; }
  else { s.vy -= 20 * dt; s.pos.y += s.vy * dt; if (s.pos.y < fl2) { s.pos.y = fl2; s.vy = 0; landed = true; } }
  if (tr && tr.air && landed) {
    s.trick = null;
    if (tr.t / tr.dur >= 0.85) {
      const kr = TRICKS[tr.kind].kr;
      save.money += kr; turbo.charge = Math.min(1, turbo.charge + 0.25);
      audio.coin(); toast(`${TRICKS[tr.kind].name}!  +${kr} kr`, 1.6);
    } else if (ridden) crashed = true;            // landed halfway round: that's a wipeout
  }
  s.tilt = damp(s.tilt, -Math.atan(slope), 10, dt);
  s.obj.position.copy(s.pos);
  s.obj.rotation.set(s.tilt, s.heading, s.lean, 'YXZ');
  if (s.trick) poseTrick(s);
  if (!ridden) {
    if (Math.abs(s.speed) < 0.05) s.speed = 0;
    s.asleep = s.speed === 0 && s.vy === 0 && s.pos.y <= fl2 + 1e-3;
  } else s.asleep = false;
  return crashed;
}

// ------------------------------------------------------------------ seagulls
const gulls = [];
const GULL_N = isTouch ? 20 : 30;
// on the quay at Fisketorget
// on the quays at Fisketorget and Bryggen, on Torget, Domkirkeplassen and Asylplassen
const groundSpots = [[-452, -222], [-449, -230], [-455, -214], [-446, -238], [-562, -421], [-577, -436], [-541, -400],
  [-528, -381], [-511, -352], [-432, -204], [-440, -196], [-185, -82], [-176, -90], [-60, 36], [-54, 44]]
  .slice(0, isTouch ? 9 : 15).map(([x, z]) => [x, world.floorAt(x, z, 50), z]);
for (let i = 0; i < GULL_N; i++) {
  const g = new Gull();
  scene.add(g.root);
  const a = { g, pos: new THREE.Vector3(), vel: new THREE.Vector3(), state: 'circle', t: 0, c: new THREE.Vector3(), r: 20, ang: Math.random() * 6, w: 0.25, alt: 25, cd: 0 };
  if (i < groundSpots.length) {
    a.state = 'ground'; a.home = groundSpots[i];
    a.pos.set(...groundSpots[i]);
  } else newCircle(a, true);
  gulls.push(a);
}
function newCircle(a, place) {
  a.state = 'circle';
  const f = state && state.mode === 'play' ? player.pos : camera.position;
  a.c.set(f.x + (Math.random() - 0.5) * 160, 0, f.z + (Math.random() - 0.5) * 160);
  a.r = 12 + Math.random() * 25;
  a.alt = Math.max(5, city.terrain.height(a.c.x, a.c.z)) + 18 + Math.random() * 20;
  a.w = (Math.random() < 0.5 ? -1 : 1) * (4.5 + Math.random() * 2) / a.r;
  if (place) a.pos.set(a.c.x + Math.cos(a.ang) * a.r, a.alt, a.c.z + Math.sin(a.ang) * a.r);
}
let gullCallT = 4;
function updateGulls(dt) {
  const p = player.pos;
  const indoors = isIndoors(p);
  const head = _v2.set(p.x, p.y + 1.4, p.z);
  // how many attackers the alarm calls for
  const want = [0, 1, 2, 3, 4, 6][state.alarm] || 0;     // the same attack per alarm level, however big the flock
  // only a few dive at once, and none while you're still reeling from the last one
  const maxDivers = Math.ceil(state.alarm / 2);
  let divers = 0;
  for (const a of gulls) if (a.state === 'dive') divers++;
  let have = gulls.filter(a => ['orbit', 'dive', 'climb'].includes(a.state)).length;
  if (have < want) {
    const cands = gulls.filter(a => a.state === 'circle' || a.state === 'ground' || a.state === 'leave').sort((x, y) => x.pos.distanceToSquared(p) - y.pos.distanceToSquared(p));
    for (const a of cands.slice(0, want - have)) { a.state = 'orbit'; a.t = 2 + Math.random() * 2; a.ang = Math.random() * 6; }
  } else if (have > want) {
    for (const a of gulls) { if (have <= want) break; if (['orbit', 'dive', 'climb'].includes(a.state)) { newCircle(a, false); a.state = 'leave'; a.t = 3; have--; } }
  }
  gullCallT -= dt;
  if (gullCallT <= 0) {
    gullCallT = state.alarm > 0 ? 1.5 + Math.random() * 2 : 5 + Math.random() * 8;
    const near = gulls.reduce((m, a) => Math.min(m, a.pos.distanceTo(p)), 999);
    audio.gull(clamp(1.4 - near / 40, 0.15, 1));
  }
  for (const a of gulls) {
    a.t -= dt;
    let flap = 0.2, grounded = false;
    const desired = _v.set(0, 0, 0);
    switch (a.state) {
      case 'circle': {
        a.ang += a.w * dt;
        const tx = a.c.x + Math.cos(a.ang) * a.r, tz = a.c.z + Math.sin(a.ang) * a.r;
        desired.set(tx - a.pos.x, a.alt - a.pos.y, tz - a.pos.z).multiplyScalar(2);
        flap = Math.sin(a.ang * 3) > 0.7 ? 0.6 : 0.05;
        break;
      }
      case 'leave': {
        desired.set(a.c.x - a.pos.x, a.alt - a.pos.y, a.c.z - a.pos.z).normalize().multiplyScalar(8);
        flap = 0.8;
        if (a.t <= 0) a.state = 'circle';
        break;
      }
      case 'ground': {
        grounded = true;
        a.vel.set(0, 0, 0);
        const d = a.pos.distanceTo(p);
        const fast = player.riding ? Math.abs(player.riding.speed) > 2 : Math.hypot(player.vel.x, player.vel.z) > 4;
        if ((d < 3.5 && fast) || d < 1.2) { a.state = 'takeoff'; a.t = 1.2; audio.squawk(); a.vel.set(a.pos.x - p.x, 4, a.pos.z - p.z).normalize().multiplyScalar(6); }
        a.g.root.position.copy(a.pos);
        a.g.root.rotation.set(Math.max(0, Math.sin(performance.now() * 0.004 + a.ang * 9)) * 0.6, a.ang, 0, 'YXZ');
        a.g.animate(dt, 0, true);
        continue;
      }
      case 'takeoff': {
        desired.copy(a.vel).setY(5);
        flap = 1;
        if (a.t <= 0) { newCircle(a, false); a.state = 'leave'; a.t = 4; }
        break;
      }
      case 'orbit': {
        a.ang += dt * 0.9;
        const r = 7, h = indoors ? 12 : 4.5;
        const hc = inOffice(p) ? [OFFICE_CENTRE.x, OFFICE_CENTRE.z] : L2W(4, 4.2), cx = indoors ? hc[0] : p.x, cz = indoors ? hc[1] : p.z;
        desired.set(cx + Math.cos(a.ang) * r - a.pos.x, p.y + h + Math.sin(a.ang * 2) - a.pos.y, cz + Math.sin(a.ang) * r - a.pos.z).multiplyScalar(1.8);
        flap = 0.5;
        if (a.t <= 0 && !indoors && player.knockT <= 0 && player.hurtT <= 0 && divers < maxDivers && state.mode === 'play') { a.state = 'dive'; a.t = 2.4; a.lock = null; divers++; audio.squawk(); }
        break;
      }
      case 'dive': {
        // it homes in from afar, then commits to a line about 4.5 m out: move and it misses
        const sp = 8.5 + state.alarm * 0.5;
        if (!a.lock && a.pos.distanceTo(head) < 4.5) a.lock = head.clone().sub(a.pos).normalize();
        if (a.lock) desired.copy(a.lock).multiplyScalar(sp);
        else desired.copy(head).sub(a.pos).normalize().multiplyScalar(sp);
        flap = 0.15;
        if (a.pos.distanceTo(head) < 0.75 && !indoors) { hitPlayer(a); a.state = 'climb'; a.t = 1.4; }
        else if (a.lock && a.t < 1.9 && (a.pos.y < head.y - 1.2 || a.pos.distanceTo(head) > 6)) { a.state = 'climb'; a.t = 1.2; }   // missed
        else if (a.t <= 0 || indoors) { a.state = 'climb'; a.t = 1.2; }
        break;
      }
      case 'climb': {
        desired.set(a.vel.x, 6, a.vel.z).normalize().multiplyScalar(9);
        flap = 1;
        if (a.t <= 0) { a.state = 'orbit'; a.t = 2.5 + Math.random() * 3 / Math.max(1, state.alarm * 0.5); }
        break;
      }
      case 'knocked': {
        a.vel.y -= 18 * dt;
        a.pos.addScaledVector(a.vel, dt);
        const fl = world.floorAt(a.pos.x, a.pos.z, a.pos.y, 0.2);
        if (a.pos.y < fl + 0.2) { a.pos.y = fl + 0.2; a.vel.multiplyScalar(0.3); }
        a.g.root.position.copy(a.pos);
        a.g.root.rotation.x += dt * 9; a.g.root.rotation.z += dt * 5;
        a.g.animate(dt, 0.1);
        if (a.t <= 0) { a.state = 'takeoff'; a.t = 1.2; a.vel.set(Math.random() - 0.5, 1, Math.random() - 0.5).normalize().multiplyScalar(5); a.g.root.rotation.set(0, 0, 0); }
        continue;
      }
      case 'thief': {
        const b = bolleDrop;
        if (!b) { newCircle(a, false); a.state = 'leave'; a.t = 3; break; }
        desired.set(b.pos.x - a.pos.x, b.pos.y + 0.2 - a.pos.y, b.pos.z - a.pos.z);
        const d = desired.length();
        desired.normalize().multiplyScalar(Math.min(9, d * 3 + 2));
        flap = 0.7;
        if (d < 0.5) { a.state = 'carry'; a.t = 3.5 + Math.random() * 2; a.carry = b; b.item.removeFromParent(); a.g.root.add(b.item); b.item.position.set(0, -0.25, 0.1); bolleDrop = null; audio.squawk(); toast('A gull grabbed the bolle!'); a.dest = pickDropSpot(a.pos); }
        break;
      }
      case 'carry': {
        desired.set(a.dest.x - a.pos.x, a.dest.y + 8 - a.pos.y, a.dest.z - a.pos.z);
        desired.normalize().multiplyScalar(7);
        flap = 0.8;
        if (a.t <= 0 || Math.hypot(a.dest.x - a.pos.x, a.dest.z - a.pos.z) < 1) {
          dropBolleAt(a.dest, a);
          a.carry = null; newCircle(a, false); a.state = 'leave'; a.t = 3;
        }
        break;
      }
    }
    a.vel.lerp(desired, Math.min(1, dt * 3));
    a.pos.addScaledVector(a.vel, dt);
    // stay above ground
    const fl = world.floorAt(a.pos.x, a.pos.z, a.pos.y + 1, 1);
    if (a.state !== 'dive' && a.state !== 'thief' && a.pos.y < fl + 1.2) a.pos.y = fl + 1.2;
    if (a.pos.y < fl + 0.3) a.pos.y = fl + 0.3;
    a.g.root.position.copy(a.pos);
    if (a.vel.lengthSq() > 0.01) {
      _v.copy(a.pos).add(a.vel);
      a.g.root.lookAt(_v);
      a.g.root.rotateZ(clamp(-a.w * 6, -0.5, 0.5) * (a.state === 'circle' ? 1 : 0));
    }
    const d2 = a.pos.distanceToSquared(camera.position);
    a.g.root.visible = d2 < 170 * 170;
    const sh = d2 < 45 * 45;
    if (a.shadow !== sh) { a.shadow = sh; a.g.root.traverse(o => { if (o.isMesh) o.castShadow = sh; }); }
    a.g.animate(dt, flap, grounded);
  }
}
function hitPlayer(a) {
  if (state.mode !== 'play' || player.hurtT > 0.3 || funiState.ride) return;      // safe inside Fløibanen
  if (brollyBlocks(a)) return;
  const dmg = 4 + state.alarm;
  player.health = Math.max(0, player.health - dmg);
  player.hurtT = 1.2; player.regenT = 3;
  cam.shake = 0.7;
  audio.squawk(); audio.hurt();
  const away = new THREE.Vector3(player.pos.x - a.pos.x, 0, player.pos.z - a.pos.z).normalize();
  if (!player.riding) { player.vel.x += away.x * 4; player.vel.z += away.z * 4; player.vel.y = Math.max(player.vel.y, 3); player.onGround = false; }
  else player.riding.speed *= 0.8;
  if (player.carrying) dropBolle();
  if (player.health <= 0) die('TATT AV MÅKENE', 'Taken by the gulls. They took 100 kr too.');
}

// ------------------------------------------------------------------ alarm
function raiseAlarm(n = 1) {
  const before = state.alarm;
  state.alarm = clamp(state.alarm + n, 0, 5);
  state.alarmCool = 12;
  if (state.alarm > before) { state.alarmFlash = 2; if (before === 0) toast('Måkealarm! The gulls are coming for you.'); }
}
function updateAlarm(dt) {
  if (state.alarm < state.alarmMin) state.alarm = state.alarmMin;
  if (state.alarm > state.alarmMin) {
    state.alarmCool -= dt * (isIndoors(player.pos) ? 2.5 : 1);
    if (state.alarmCool <= 0) { state.alarm--; state.alarmCool = 10; if (state.alarm === 0) toast('The gulls lost interest.'); }
  }
}

// ------------------------------------------------------------------ pickups: lost umbrellas
// lost umbrellas at real spots around Fjellet, the cathedral and Torget
const snapToStreet = (x, z) => { const i = nearestNode(x, z, 40); return i >= 0 ? [gx(i), gz(i)] : [x, z]; };
const UMBRELLA_SPOTS = [
  ['Domkirkeplassen', ...snapToStreet(-178, -84)],
  ['Fløibanen, lower station', ...snapToStreet(-262, -360)],
  ['Fjellveien, by the funicular', ...snapToStreet(45, -275)],
  ['Fisketorget', -444, -226],
  ['Asylplassen', ...snapToStreet(-55, 40)],
  ['Skivebakken steps', ...snapToStreet(150, 120)],
  ['Heggebakken steps', ...snapToStreet(-49, -21)],
  ['the terrace', ...L2W(6.8, 11.6), H.FL],
  ['the shower', ...L2W(2.2, 6.1), H.FL],
  ['Brattlien steps', ...snapToStreet(42, -31)],
  ['Korskirken', ...snapToStreet(-300, -190)],
  ['Bryggestredet, among the wharf houses', ...snapToStreet(-479, -484)],
  ['Mariakirken', ...snapToStreet(-553, -660)],
  ['Bergenhus', ...snapToStreet(-640, -715)],
];
const UMBRELLAS = UMBRELLA_SPOTS;
const umbrellaObjs = UMBRELLAS.map(([name, x, z, yy], i) => {
  const y = yy !== undefined ? yy : world.floorAt(x, z, 300);
  const o = makeItem('umbrella');
  o.position.set(x, y, z);
  o.rotation.z = 0.5; o.rotation.y = i;
  o.visible = !save.umbrellas.includes(i);
  scene.add(o);
  return { o, i, base: y, name };
});
function updateUmbrellas(dt, time) {
  for (const u of umbrellaObjs) {
    if (!u.o.visible) continue;
    u.o.rotation.y += dt;
    u.o.position.y = u.base + 0.15 + Math.sin(time * 2 + u.i) * 0.08;
    const dx = u.o.position.x - player.pos.x, dz = u.o.position.z - player.pos.z, dy = u.base - player.pos.y;
    if (dx * dx + dz * dz < 0.8 && Math.abs(dy) < 1.5) {
      u.o.visible = false;
      save.umbrellas.push(u.i); save.money += 50; persist();
      audio.coin();
      const n = save.umbrellas.length;
      toast(n === UMBRELLAS.length ? `All ${n} lost umbrellas found! Bergen thanks you. +500 kr` : `Lost umbrella ${n}/${UMBRELLAS.length} (${u.name})  +50 kr`, 3);
      if (n === UMBRELLAS.length) { save.money += 500; persist(); }
    }
  }
}

// ------------------------------------------------------------------ places
const PLACE_STYLE = {
  bar: { bg: '#2a1f3d', fg: '#f4d35e', line: 'One beer at Magda. Just one. The gulls lose track of you in here.' },
  hotdog: { bg: '#b3261e', fg: '#ffffff', line: 'A pølse from Trekroneren, with everything. Health restored.' },
  shop: { bg: '#0d3a7a', fg: '#ffffff', line: 'Rema 1000 Marken: snacks for the party, and a little energy.' },
  food: { bg: '#a3121b', fg: '#f6d46b', line: 'Guangdong House. The most important place in Bergen.' },
  pizza: { bg: '#1f6a3a', fg: '#ffffff', line: 'A slice at Johnny’s. Health restored.' },
  office: { bg: '#2c6fb5', fg: '#ffffff', line: 'Myreze, Halfdan Kjerulfs gate 4. The office is up on the 4th floor.' },
};
save.places = save.places || [];
const PLACES = [...(map.places || []), { n: 'Myreze', k: 'office', x: OFFICE_STREET.x, z: OFFICE_STREET.z }].map(pl => {
  const st = PLACE_STYLE[pl.k];
  const y = world.floorAt(pl.x, pl.z, 300);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture([pl.n], { w: 640, h: 128, bg: st.bg, fg: st.fg, font: '800 64px "Archivo", sans-serif', radius: 24, border: st.fg }), fog: false }));
  sign.scale.set(5, 1, 1);
  sign.position.set(pl.x, y + 6, pl.z);
  scene.add(sign);
  return { ...pl, y, sign, st, coolT: 0 };
});
function updatePlaces(dt, time) {
  for (const pl of PLACES) {
    pl.sign.position.y = pl.y + 6 + Math.sin(time * 1.5 + pl.x) * 0.15;
    pl.coolT -= dt;
    if (state.mode !== 'play' || pl.coolT > 0) continue;
    if (Math.hypot(player.pos.x - pl.x, player.pos.z - pl.z) > 6 || Math.abs(player.pos.y - pl.y) > 4) continue;
    pl.coolT = 45;
    const first = !save.places.includes(pl.n);
    if (first) { save.places.push(pl.n); save.money += 50; persist(); }
    if (pl.k === 'hotdog' || pl.k === 'pizza') player.health = 100;
    if (pl.k === 'shop') player.health = Math.min(100, player.health + 35);
    if (pl.k === 'bar' && state.alarm > state.alarmMin) state.alarm = state.alarmMin;
    audio.coin();
    toast((first ? `Found: ${pl.n}  +50 kr · ` : '') + pl.st.line, 4);
  }
}

// ------------------------------------------------------------------ effects: sparks, dust, feathers, spray
// One Points object for every small particle in the game, plus a tracer and a muzzle flash.
const FX_N = 400;
const fx = {
  pos: new Float32Array(FX_N * 3), col: new Float32Array(FX_N * 3),
  vel: new Float32Array(FX_N * 3), life: new Float32Array(FX_N), max: new Float32Array(FX_N), grav: new Float32Array(FX_N), next: 0,
};
const fxGeo = new THREE.BufferGeometry();
fxGeo.setAttribute('position', new THREE.BufferAttribute(fx.pos, 3).setUsage(THREE.DynamicDrawUsage));
fxGeo.setAttribute('color', new THREE.BufferAttribute(fx.col, 3).setUsage(THREE.DynamicDrawUsage));
fxGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
const fxPoints = new THREE.Points(fxGeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false }));
fxPoints.frustumCulled = false;
scene.add(fxPoints);
for (let i = 0; i < FX_N; i++) fx.pos[i * 3 + 1] = -1e5;
const _fc = new THREE.Color();
function emit(p, n, { color = 0xbbbbbb, speed = 2, up = 1, spread = 1, life = 0.6, grav = 9.8, dir = null } = {}) {
  _fc.set(color);
  for (let k = 0; k < n; k++) {
    const i = fx.next; fx.next = (fx.next + 1) % FX_N;
    fx.pos[i * 3] = p.x; fx.pos[i * 3 + 1] = p.y; fx.pos[i * 3 + 2] = p.z;
    let vx = (Math.random() - 0.5) * 2 * spread, vy = Math.random() * up, vz = (Math.random() - 0.5) * 2 * spread;
    if (dir) { vx += dir.x; vy += dir.y; vz += dir.z; }
    fx.vel[i * 3] = vx * speed; fx.vel[i * 3 + 1] = vy * speed; fx.vel[i * 3 + 2] = vz * speed;
    const sh = 0.8 + Math.random() * 0.4;
    fx.col[i * 3] = _fc.r * sh; fx.col[i * 3 + 1] = _fc.g * sh; fx.col[i * 3 + 2] = _fc.b * sh;
    fx.life[i] = fx.max[i] = life * (0.6 + Math.random() * 0.8); fx.grav[i] = grav;
  }
}
const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 1).translate(0, 0, 0.5),
  new THREE.MeshBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
tracer.visible = false; tracer.frustumCulled = false;
scene.add(tracer);
const flashTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.3, 'rgba(255,190,80,0.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
muzzleFlash.visible = false; muzzleFlash.scale.setScalar(0.45);
scene.add(muzzleFlash);
let tracerT = 0, flashT = 0;
function updateFx(dt) {
  for (let i = 0; i < FX_N; i++) {
    if (fx.life[i] <= 0) continue;
    fx.life[i] -= dt;
    if (fx.life[i] <= 0) { fx.pos[i * 3 + 1] = -1e5; continue; }
    fx.vel[i * 3 + 1] -= fx.grav[i] * dt;
    fx.pos[i * 3] += fx.vel[i * 3] * dt; fx.pos[i * 3 + 1] += fx.vel[i * 3 + 1] * dt; fx.pos[i * 3 + 2] += fx.vel[i * 3 + 2] * dt;
  }
  fxGeo.attributes.position.needsUpdate = true;
  fxGeo.attributes.color.needsUpdate = true;
  tracerT -= dt; flashT -= dt;
  tracer.visible = tracerT > 0; if (tracer.visible) tracer.material.opacity = tracerT / 0.07 * 0.9;
  muzzleFlash.visible = flashT > 0;
}

// ------------------------------------------------------------------ the pistol
// G draws and holsters it. With it drawn, click (or F) fires where the crosshair points, on foot
// or from a moving scooter. Twelve rounds, then a reload. Hits knock people over and gulls out
// of the air, and every shot startles the town: the Måkealarm goes up.
const gun = { drawn: false, ammo: 12, mag: 12, reloadT: 0, cd: 0, obj: makePistol(), aimK: 0 };
gun.obj.visible = false;
player.fig.elbows[0].add(gun.obj);
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3(), _mz = new THREE.Vector3(), _tp = new THREE.Vector3(), _hp = new THREE.Vector3();
function toggleGun(on = !gun.drawn) {
  if (on && player.carrying) { toast('Put that down first', 1.5); return; }
  gun.drawn = on;
  gun.obj.visible = on;
  if (!on) player.fig.aim = null;
  audio.reload();
  if (on && !save.gunHint) { save.gunHint = true; persist(); toast(isTouch ? 'Pistol out. Shoot to fire; Gun again for the umbrella.' : 'Pistol out. Click to shoot; G again for the umbrella.', 3.5); }
}

// ------------------------------------------------------------------ the umbrella
// G goes round what you hold: the pistol, then the umbrella, then nothing. Held open, the
// umbrella takes the gulls' dives (they bounce off it), and if you stand still under it long
// enough, they give up and the Måkealarm ends. It's held in the left hand, so it goes with the bolle.
const brolly = { up: false, shelterT: 0, obj: new THREE.Group() };
{
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
  pole.position.y = 0.45;
  const can = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.3, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xc0201a, roughness: 0.45, side: THREE.DoubleSide }));
  can.position.y = 0.98; can.castShadow = true;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  tip.position.y = 1.14;
  brolly.obj.add(pole, can, tip);
  brolly.obj.position.set(0, -0.3, 0.05);
  brolly.obj.rotation.x = 1.45;      // upright over your head in the umbrella pose
}
const SHELTER_T = 7;
function setBrolly(on) {
  brolly.up = on;
  brolly.shelterT = 0;
  if (on) { player.fig.elbows[1].add(brolly.obj); player.fig.umbrella = brolly.obj; }
  else { brolly.obj.removeFromParent(); player.fig.umbrella = null; }
}
// G: pistol, umbrella, empty hands (no pistol while carrying something)
function cycleHand() {
  if (gun.drawn) { toggleGun(false); setBrolly(true); audio.door(); }
  else if (brolly.up) { setBrolly(false); audio.door(); }
  else if (player.carrying) { setBrolly(true); audio.door(); }
  else toggleGun(true);
  if (brolly.up && !save.brollyHint) { save.brollyHint = true; persist(); toast('The umbrella keeps the gulls off. Stand still under it and they give up.', 4); }
}
// a gull dives into the open umbrella: it bounces off, and you're not hurt
function brollyBlocks(a) {
  if (!brolly.up || player.knockT > 0) return false;
  audio.bump(); audio.squawk();
  cam.shake = Math.max(cam.shake, 0.25);
  emit(_v.copy(player.pos).setY(player.pos.y + 2.2), 6, { color: 0xf4f4f0, speed: 1.2, up: 1, spread: 1, life: 1, grav: 1.2 });
  a.state = 'climb'; a.t = 1.4; a.vel.set(a.pos.x - player.pos.x, 4, a.pos.z - player.pos.z).normalize().multiplyScalar(7);
  return true;
}
function updateBrolly(dt) {
  if (!brolly.up || state.mode !== 'play') { brolly.shelterT = 0; return; }
  const v = player.riding ? Math.abs(player.riding.speed) : Math.hypot(player.vel.x, player.vel.z);
  if (state.alarm > state.alarmMin && v < 1.5 && !isIndoors(player.pos)) {
    brolly.shelterT += dt;
    if (brolly.shelterT >= SHELTER_T) {
      state.alarm = state.alarmMin; state.alarmCool = 10; brolly.shelterT = 0;
      toast(state.alarm === 0 ? 'The gulls gave up. Måkealarm over.' : 'The gulls backed off.', 3);
      audio.coin();
    }
  } else brolly.shelterT = Math.max(0, brolly.shelterT - dt * 2);
}
// distance along the ray (origin o, unit direction d) to a sphere, or Infinity
function raySphere(o, d, c, r) {
  const ox = c.x - o.x, oy = c.y - o.y, oz = c.z - o.z;
  const t = ox * d.x + oy * d.y + oz * d.z;
  if (t < 0) return Infinity;
  const q = ox * ox + oy * oy + oz * oz - t * t;
  return q < r * r ? t - Math.sqrt(r * r - q) : Infinity;
}
// distance along the ray to an upright capsule (a person), or Infinity
function rayPerson(o, d, p, r = 0.38) {
  let best = Infinity;
  for (const h of [0.35, 0.8, 1.2, 1.55]) best = Math.min(best, raySphere(o, d, _tp.set(p.x, p.y + h, p.z), h > 1.5 ? 0.22 : r));
  return best;
}
function shoot() {
  if (gun.cd > 0 || gun.reloadT > 0 || player.knockT > 0) return;
  if (gun.ammo <= 0) { audio.dryFire(); gun.cd = 0.25; startReload(); return; }
  gun.ammo--; gun.cd = 0.2;
  player.fig.recoil();
  audio.shot();
  cam.shake = Math.max(cam.shake, 0.22);
  // the ray from the camera through the crosshair, starting at the player so nothing behind counts
  camera.getWorldDirection(_rd);
  _ro.copy(camera.position);
  const skip = Math.max(0, (player.pos.x - _ro.x) * _rd.x + (player.pos.y + 1.4 - _ro.y) * _rd.y + (player.pos.z - _ro.z) * _rd.z);
  _ro.addScaledVector(_rd, skip);
  const RANGE = 110;
  let tHit = world.raycast(_ro, _rd, RANGE), what = null;
  for (const a of gulls) {
    if (a.state === 'knocked' || a.pos.distanceToSquared(_ro) > RANGE * RANGE) continue;
    const t = raySphere(_ro, _rd, a.pos, a.state === 'ground' ? 0.45 : 0.75);
    if (t < tHit) { tHit = t; what = { gull: a }; }
  }
  for (const n of npcs) {
    if (n.active || n.party || !n.fig.root.visible || n.downT > 0) continue;
    const t = rayPerson(_ro, _rd, n.pos);
    if (t < tHit) { tHit = t; what = { npc: n }; }
  }
  for (const sc of scooters) {
    if (sc === player.riding) continue;
    const t = raySphere(_ro, _rd, _tp.set(sc.pos.x, sc.pos.y + 0.45, sc.pos.z), 0.5);
    if (t < tHit) { tHit = t; what = { scooter: sc }; }
  }
  const hitP = _hp.copy(_ro).addScaledVector(_rd, Math.min(tHit, RANGE));
  // tracer and flash from the muzzle
  gun.obj.userData.muzzle.getWorldPosition(_mz);
  muzzleFlash.position.copy(_mz); muzzleFlash.material.rotation = Math.random() * 6; flashT = 0.05;
  tracer.position.copy(_mz); tracer.lookAt(hitP); tracer.scale.set(1, 1, Math.max(0.1, _mz.distanceTo(hitP))); tracerT = 0.07;
  emit(_mz, 3, { color: 0xffd080, speed: 1.2, up: 0.5, life: 0.12, grav: 0 });
  // everyone nearby hears it: gulls on the ground take off, and the alarm goes up
  for (const a of gulls) if (a.state === 'ground' && a.pos.distanceTo(player.pos) < 30) { a.state = 'takeoff'; a.t = 1.2; a.vel.set(a.pos.x - player.pos.x, 4, a.pos.z - player.pos.z).normalize().multiplyScalar(6); }
  const calm = mission && mission.def.noPunchAlarm;
  // the people nearby hurry off, and the nearest one who isn't hit cries out
  let scared = null, sd = 28;
  for (const n of npcs) {
    if (n.mate || !n.voice || n.downT > 0 || !n.fig.root.visible || (what && what.npc === n)) continue;
    const d = n.pos.distanceTo(player.pos);
    if (d < 28) n.panicT = 5 + Math.random() * 3;
    if (d < sd) { sd = d; scared = n; }
  }
  if (scared && street.scaredT <= 0 && !(what && what.npc)) { talk(scared, 'scared'); street.scaredT = 5; street.quietT = Math.max(street.quietT, 6); }
  if (!what) {
    if (tHit >= RANGE) return;
    if (hitP.y < 0.4 && world.terrain.height(hitP.x, hitP.z) < -0.3) emit(hitP, 14, { color: 0xdfe9ee, speed: 2.5, up: 1.6, spread: 0.3, life: 0.6 });   // Vågen
    else { emit(hitP, 10, { color: 0xa9a49a, speed: 1.8, up: 1, spread: 0.6, life: 0.5 }); emit(hitP, 4, { color: 0xffc860, speed: 3, up: 1, spread: 1, life: 0.15, grav: 4 }); if (Math.random() < 0.3) audio.ricochet(); }
    return;
  }
  if (what.gull) {
    const a = what.gull;
    if (a.carry) { dropBolleAt(a.pos.clone().setY(world.floorAt(a.pos.x, a.pos.z, a.pos.y)), a); a.carry = null; }
    a.state = 'knocked'; a.t = 1.8;
    a.vel.set(_rd.x * 7, 2.5, _rd.z * 7);
    emit(a.pos, 16, { color: 0xf4f4f0, speed: 1.6, up: 1.2, spread: 1, life: 1.3, grav: 1.2 });   // feathers
    audio.squawk();
    save.money += 10;
    if (!calm) raiseAlarm(1);
  } else if (what.npc) {
    const n = what.npc;
    knockNpc(n, player.pos);
    n.downT = 5;
    emit(hitP, 8, { color: 0xd9d4c8, speed: 1.4, up: 1, spread: 0.7, life: 0.4 });
    audio.punch();
    raiseAlarm(2);
  } else if (what.scooter) {
    const sc = what.scooter;
    sc.asleep = false; sc.vy = 2.5; sc.speed += 1.5 * Math.sign(_rd.x * Math.sin(sc.heading) + _rd.z * Math.cos(sc.heading) || 1);
    emit(hitP, 8, { color: 0xffc860, speed: 3, up: 1, spread: 1, life: 0.15, grav: 4 });
    audio.ricochet();
  }
}
function startReload() {
  if (gun.reloadT > 0 || gun.ammo === gun.mag) return;
  gun.reloadT = 1.3;
  audio.reload();
}
function updateGun(dt) {
  gun.cd -= dt;
  if (gun.reloadT > 0) { gun.reloadT -= dt; if (gun.reloadT <= 0) gun.ammo = gun.mag; }
  if (gun.drawn && (player.carrying || state.mode !== 'play')) { if (player.carrying) toggleGun(false); }
  const aiming = gun.drawn && state.mode === 'play' && player.knockT <= 0;
  gun.aimK = damp(gun.aimK, aiming && !player.riding && !isIndoors(player.pos) ? 1 : 0, 10, dt);
  if (aiming) {
    // the arm points where the crosshair does: pitch from the camera, yaw relative to the body
    camera.getWorldDirection(_rd);
    const yaw = Math.atan2(_rd.x, _rd.z);
    player.fig.aim = { pitch: clamp(Math.asin(clamp(_rd.y, -1, 1)) + 0.06, -0.9, 1.0), yaw: angDiff(player.heading, yaw) };
  } else if (player.fig.aim) player.fig.aim = null;
}

// ------------------------------------------------------------------ skydiving from Fløyen
// At the viewpoint on Fløyen there's a jump: E takes you 450 m up over the mountain, and you
// fall. Steer with WASD, open the parachute (Space or click) and fly it down: A/D turn, W dives,
// S flares. Forget to open it and that's the end of you. The canopy carries the Brann logo.
const JUMP = (() => { const x = 516, z = -166; return { x, z, y: world.floorAt(x, z, 600, 700) }; })();
const jumpSign = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(['Fallskjermhopp'], { w: 640, h: 128, bg: '#e2231a', fg: '#ffffff', font: '800 60px "Archivo", sans-serif', radius: 24, border: '#ffffff' }), fog: false }));
jumpSign.scale.set(4.5, 0.9, 1); jumpSign.position.set(JUMP.x, JUMP.y + 4.2, JUMP.z);
scene.add(jumpSign);
const chute = (() => {
  const g = new THREE.Group();
  // the canopy: a ram-air wing, 8.5 m across, curved down at the tips, with cells
  const top = new THREE.PlaneGeometry(8.5, 3.2, 24, 4); top.rotateX(-Math.PI / 2);
  const a = top.attributes.position;
  for (let i = 0; i < a.count; i++) { const x = a.getX(i), z = a.getZ(i); a.setY(i, -x * x / 13 + Math.cos(z / 1.6 * Math.PI / 2) * 0.25); }
  top.computeVertexNormals();
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 384;
  const cg = canvas.getContext('2d');
  const paint = (logo) => {
    // drawn upside down: seen from behind and above, it reads the right way round
    cg.setTransform(-1, 0, 0, -1, canvas.width, canvas.height);
    cg.fillStyle = '#e2231a'; cg.fillRect(0, 0, 1024, 384);
    cg.fillStyle = 'rgba(255,255,255,0.9)'; for (let k = 1; k < 9; k++) cg.fillRect(k * 1024 / 9 - 2, 0, 4, 384);
    cg.fillStyle = '#ffffff'; cg.fillRect(0, 0, 1024, 14); cg.fillRect(0, 370, 1024, 14);
    if (logo) cg.drawImage(logo, 512 - 330, 192 - 97, 660, 194);
    else { cg.fillStyle = '#fff'; cg.font = '900 120px "Archivo", sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText('BRANN', 512, 200); }
  };
  paint(null);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const img = new Image(); img.onload = () => { paint(img); tex.needsUpdate = true; }; img.src = '/img/brann.png';
  const topM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide });
  const canopy = new THREE.Mesh(top, topM); canopy.castShadow = true;
  const under = new THREE.Mesh(top.clone().translate(0, -0.35, 0), new THREE.MeshStandardMaterial({ color: 0xb81c14, roughness: 0.8, side: THREE.DoubleSide }));
  g.add(canopy, under);
  // the lines, from the canopy's edge down to the harness
  const lp = [];
  for (let k = 0; k <= 6; k++) {
    const x = -4.1 + k * 8.2 / 6, y = -x * x / 13 - 0.3;
    for (const z of [-1.2, 1.2]) lp.push(x, y, z, Math.sign(x) * 0.25, -4.1, 0);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x333333 })));
  g.visible = false;
  scene.add(g);
  return g;
})();
const dive = { on: false, phase: 'free', open: 0, landT: 0 };
function startSkydive() {
  fadeThen(() => {
    player.pos.set(JUMP.x - 20, JUMP.y + 450, JUMP.z + 10);
    player.vel.set(-6, 0, 2);
    player.heading = Math.atan2(-1, 0.2);          // facing the town
    player.onGround = false;
    cam.yaw = player.heading + Math.PI; cam.pitch = 0.45;
    dive.on = true; dive.phase = 'free'; dive.open = 0; dive.landT = 0;
    if (gun.drawn) toggleGun(false);
    if (brolly.up) setBrolly(false);
    toast('Space or click: open the parachute', 3);
  });
}
function endSkydive() {
  dive.on = false; chute.visible = false;
  player.fig.root.rotation.x = 0;
  audio.wind(0);
}
function updateSkydive(dt, inp) {
  const p = player.pos, v = player.vel;
  const floor = world.floorAt(p.x, p.z, p.y + 0.5, 1.0);
  const alt = p.y - Math.max(floor, -1);
  // where you're heading, from the camera, as on foot
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  if (dive.phase === 'free') {
    v.y = Math.max(-52, v.y - 9.8 * dt);
    const tx = (fx * inp.y - fz * inp.x) * 16, tz = (fz * inp.y + fx * inp.x) * 16;
    v.x = damp(v.x, tx, 1.2, dt); v.z = damp(v.z, tz, 1.2, dt);
    if (Math.hypot(v.x, v.z) > 1) player.heading += angDiff(player.heading, Math.atan2(v.x, v.z)) * Math.min(1, dt * 3);
    if (pressed.jump || pressed.punch) { dive.phase = 'chute'; audio.chute(); cam.shake = 0.6; chute.visible = true; }
    audio.wind(Math.min(1, -v.y / 45));
  } else {
    dive.open = Math.min(1, dive.open + dt * 1.6);
    // steer with A/D, or with the mouse: look where you want to go and the canopy turns that way
    const h0 = player.heading, looking = performance.now() - cam.lastLook < 700;
    if (Math.abs(inp.x) > 0.1) player.heading -= inp.x * 1.15 * dt;
    else if (looking) player.heading += clamp(angDiff(player.heading, cam.yaw + Math.PI) * 1.5 * dt, -1.15 * dt, 1.15 * dt);
    dive.turn = damp(dive.turn || 0, angDiff(h0, player.heading) / Math.max(dt, 1e-3) / 1.15, 6, dt);
    const fwd = inp.y > 0.3 ? 12.5 : inp.y < -0.3 ? 5 : 9, sink = inp.y > 0.3 ? 6.8 : inp.y < -0.3 ? 2.6 : 4.4;
    v.x = damp(v.x, Math.sin(player.heading) * fwd, 2.2, dt); v.z = damp(v.z, Math.cos(player.heading) * fwd, 2.2, dt);
    v.y = damp(v.y, -sink, 2.5 * (0.4 + dive.open), dt);
    audio.wind(0.25 + Math.abs(dive.turn || 0) * 0.1);
    // the camera swings round behind you as you turn (unless you're looking around)
    if (!looking) cam.yaw += angDiff(cam.yaw, player.heading + Math.PI) * Math.min(1, dt * 2.2);
  }
  p.addScaledVector(v, dt);
  p.x = clamp(p.x, AX0, AX1); p.z = clamp(p.z, AZ0, AZ1);
  // the figure: belly down in free fall, hanging in the harness under the canopy
  const tilt = 1.25;
  player.fig.animate(dt, 0, 'jump', false);
  player.fig.root.position.copy(p);
  const roll = dive.phase === 'free' ? 0 : -(dive.turn || 0) * 0.25;
  player.fig.root.rotation.set(dive.phase === 'free' ? tilt : 0, player.heading, roll, 'YXZ');
  if (chute.visible) {
    const k = dive.open;
    chute.position.set(p.x, p.y + 1.6 + 4.3 * (0.4 + 0.6 * k), p.z);
    chute.rotation.set(0.12, player.heading, roll * 0.8, 'YXZ');
    chute.scale.set(0.3 + 0.7 * k, 0.6 + 0.4 * k, 0.4 + 0.6 * k);
  }
  // landing: in the sea, on the ground (or a roof), gently or not
  const g2 = world.floorAt(p.x, p.z, p.y + 0.5, 1.0);
  if (p.y < 0.1 && world.terrain.height(p.x, p.z) < -0.3) { endSkydive(); splash(); return; }
  if (p.y <= g2 + 0.02) {
    p.y = g2;
    const hard = -v.y;
    endSkydive();
    player.onGround = true;
    if (hard > 22) { player.vel.set(0, 0, 0); die('SPLAT', 'You forgot to open the parachute. It had the Brann logo on it and everything.'); return; }
    if (hard > 6) { player.knockT = 1.0; player.health = Math.max(10, player.health - 15); cam.shake = 0.6; audio.land(); toast('Rough landing!', 1.5); }
    else { audio.land(); save.money += 25; toast('Nice landing!  +25 kr', 2); }
    player.vel.set(v.x * 0.3, 0, v.z * 0.3);
  }
  return alt;
}

// ------------------------------------------------------------------ punch
function doPunch() {
  if (player.punchCd > 0 || player.knockT > 0 || player.riding) return;
  player.punchCd = 0.42;
  player.fig.punch();
  audio.whoosh();
  const p = player.pos, f = _v2.set(Math.sin(player.heading), 0, Math.cos(player.heading));
  const chest = _v.set(p.x, p.y + 1.2, p.z);
  let hitAny = false;
  for (const a of gulls) {
    if (a.state === 'knocked') continue;
    const d = a.pos.distanceTo(chest);
    const dot = ((a.pos.x - p.x) * f.x + (a.pos.z - p.z) * f.z) / Math.max(0.01, Math.hypot(a.pos.x - p.x, a.pos.z - p.z));
    const reach = a.state === 'ground' ? 1.6 : 2.0;
    if (d < reach && (dot > 0.2 || d < 1.0)) {
      if (a.carry) { dropBolleAt(a.pos.clone().setY(world.floorAt(a.pos.x, a.pos.z, a.pos.y)), a); a.carry = null; }
      a.state = 'knocked'; a.t = 1.1;
      a.vel.set(f.x * 6, 3, f.z * 6);
      hitAny = true;
      save.money += 5;
      if (!mission || !mission.def.noPunchAlarm) raiseAlarm(1);
    }
  }
  for (const n of npcs) {
    if (n.party) continue;
    const dx = n.pos.x - p.x, dz = n.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d < 1.3 && (dx * f.x + dz * f.z) / Math.max(d, 0.01) > 0.3 && Math.abs(n.pos.y - p.y) < 1) { knockNpc(n, p); hitAny = true; raiseAlarm(1); }
  }
  if (hitAny) { audio.punch(); cam.shake = 0.3; }
}

// ------------------------------------------------------------------ player update
const pInfo = {};
let skyAlt = 0;
let lastSurfaceTag = null;
function surfaceAt() {
  const p = player.pos;
  if (inHouse(p)) {
    const [u, v] = W2L(p.x, p.z);
    if (p.y < H.FU - 1 && u < 5.0 && v < 5.6) return 'tile';     // the two bathrooms and the tiled hall downstairs
    return 'wood';
  }
  if (inOffice(p)) return 'wood';
  return 'stone';
}
function updatePlayer(dt) {
  const inp = state.mode === 'play' ? moveInput() : { x: 0, y: 0, run: false };
  player.punchCd -= dt;
  player.hurtT = Math.max(0, player.hurtT - dt);
  player.regenT -= dt;
  if (player.regenT <= 0 && player.health < 100) player.health = Math.min(100, player.health + 6 * dt);

  // Fløibanen: get on a waiting car
  if (funiState.ride) { pressed.use = pressed.jump = pressed.punch = false; player.fig.animate(dt, 0, 'idle'); return; }
  if (pressed.use && player.knockT <= 0 && !player.carrying && funiCarHere() >= 0) {
    pressed.use = false;
    funiState.ride = { car: funiCarHere(), moved: false };
    if (gun.drawn) toggleGun(false);
    audio.door();
    toast(funiState.u[funiState.ride.car] < 0.5 ? 'Fløibanen: up to Fløyen' : 'Fløibanen: down to town', 2.5);
  }
  // use: the stairs at Halfdan Kjerulfs gate 4, get on / off scooters, or jump from Fløyen
  if (pressed.use && stairsHere()) { pressed.use = false; takeStairs(stairsHere()); }
  if (pressed.use && player.knockT <= 0 && !player.riding && !player.carrying && Math.hypot(player.pos.x - JUMP.x, player.pos.z - JUMP.z) < 3.5 && Math.abs(player.pos.y - JUMP.y) < 3) { pressed.use = false; startSkydive(); }
  if (pressed.use && player.knockT <= 0 && player.riding && tryPickup()) pressed.use = false;
  if (pressed.use && player.knockT <= 0) {
    if (player.riding) dismount();
    else {
      const s = nearestScooter(1.7);
      if (s) mount(s);
    }
  }
  if (dive.on) { skyAlt = updateSkydive(dt, inp); pressed.jump = pressed.punch = pressed.use = false; return; }
  if (pressed.gun) cycleHand();
  if (pressed.punch) { if (gun.drawn) shoot(); else doPunch(); }

  if (player.riding) {
    const s = player.riding;
    if (pressed.trick || pressed.jump) startTrick(s, inp);      // Space (or T) on a scooter: a trick
    const crashed = updateScooter(s, dt, inp);
    player.pos.copy(s.pos);
    player.heading = s.heading;
    player.vel.set(Math.sin(s.heading) * s.speed, s.vy, Math.cos(s.heading) * s.speed);
    if (crashed) {
      const sp = s.speed;
      s.trick = null;
      dismount(true);
      player.vel.set(Math.sin(s.heading) * sp * 0.6, 4, Math.cos(s.heading) * sp * 0.6);
      s.speed = 0;
      player.knockT = 1.4; player.onGround = false;
      audio.crash(); cam.shake = 1;
      player.health = Math.max(5, player.health - 10); player.regenT = 4;
      toast('Wipeout!');
      if (player.carrying) dropBolle();
    }
    player.fig.animate(dt, 0, 'ride');
    player.fig.root.position.copy(player.pos).add(_v.set(0, 0.17, 0));
    player.fig.root.rotation.set(s.tilt, s.heading, s.lean, 'YXZ');
    if (s.trick) {
      const q = trickRot(s, true);
      player.fig.root.quaternion.copy(q);
      player.fig.root.position.copy(player.pos).add(pivotOffset(q, 0.9, _v)).add(_v2.set(0, 0.17, 0).applyQuaternion(q));
    }
    pressed.jump = false;
    return;
  }

  const p = player.pos, v = player.vel;
  // movement intent relative to the camera
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  // right vector = (-fz, fx), so move = forward*y + right*x
  const mx = fx * inp.y - fz * inp.x, mz = fz * inp.y + fx * inp.x;
  const mag = Math.hypot(mx, mz);
  const control = player.knockT <= 0;
  const speedT = control ? (inp.run ? 6.4 : 3.3) * Math.min(1, mag) : 0;
  const accel = player.onGround ? 16 : 4;
  const tvx = mag > 0.01 ? mx / mag * speedT : 0, tvz = mag > 0.01 ? mz / mag * speedT : 0;
  if (player.onGround || mag > 0.01) {
    v.x = damp(v.x, tvx, accel * (player.knockT > 0 ? 0.3 : 1), dt);
    v.z = damp(v.z, tvz, accel * (player.knockT > 0 ? 0.3 : 1), dt);
  }
  if (gun.aimK > 0.5 && control) player.heading += angDiff(player.heading, cam.yaw + Math.PI) * Math.min(1, dt * 15);   // face where you aim
  else if (mag > 0.1 && control) player.heading += angDiff(player.heading, Math.atan2(mx, mz)) * Math.min(1, dt * 12);
  if (pressed.jump && player.onGround && control) { v.y = 6.4; player.onGround = false; audio.jump(); }
  pressed.jump = false;
  v.y -= 19 * dt;
  if (v.y < -30) v.y = -30;

  // horizontal, in small substeps
  const hd = Math.hypot(v.x, v.z) * dt, n = Math.max(1, Math.ceil(hd / 0.1));
  for (let i = 0; i < n; i++) {
    const px = p.x, pz = p.z, sx = v.x * dt / n, sz = v.z * dt / n;
    p.x += sx; p.z += sz;
    // the terrain is a heightfield: anything steeper than ~50 degrees is a wall
    const climb = Math.hypot(sx, sz) * 1.2 + 0.06;
    if (world.terrain.ground(p.x, p.z) > p.y + climb) {
      // slide along: try each axis on its own
      p.x = px + sx; p.z = pz;
      if (world.terrain.ground(p.x, p.z) > p.y + climb) { p.x = px; p.z = pz + sz; if (world.terrain.ground(p.x, p.z) > p.y + climb) p.z = pz; }
    }
    world.collide(p, RADIUS, HEIGHT, player.onGround ? STEP : 0.25);
  }
  p.x = clamp(p.x, AX0, AX1); p.z = clamp(p.z, AZ0, AZ1);
  // vertical
  const wasGround = player.onGround;
  p.y += v.y * dt;
  const fl = world.floorAt(p.x, p.z, p.y, STEP, pInfo);
  if (v.y <= 0 && p.y <= fl) {
    if (!wasGround && v.y < -9) { audio.land(); cam.shake = Math.min(1, -v.y / 25); }
    p.y = fl; v.y = 0; player.onGround = true;
  } else if (wasGround && v.y <= 0 && p.y - fl < 0.55 && fl > -1e9) {
    p.y = fl; v.y = 0; player.onGround = true;
  } else player.onGround = false;
  const ceil = world.ceilingAt(p.x, p.z, p.y, HEIGHT);
  if (p.y + HEIGHT > ceil && v.y > 0) { v.y = 0; p.y = ceil - HEIGHT; }
  if (player.knockT > 0) player.knockT -= dt;

  // footsteps
  const hs = Math.hypot(v.x, v.z);
  if (player.onGround && hs > 0.5) {
    player.stepAcc += hs * dt;
    if (player.stepAcc > (hs > 5 ? 1.05 : 0.75)) { player.stepAcc = 0; audio.step(surfaceAt()); }
  }
  lastSurfaceTag = pInfo.block && pInfo.block.tag;

  // fell into Vågen
  if (p.y < 0.1 && world.terrain.height(p.x, p.z) < -0.3) { splash(); return; }
  if (p.y < -30) respawn();

  player.fig.animate(dt, player.knockT > 0 ? 0 : hs, player.knockT > 0.3 ? 'down' : 'walk', player.onGround || player.knockT > 0);
  player.fig.root.position.copy(p);
  player.fig.root.rotation.set(0, player.heading, 0);
}
function nearestScooter(r) {
  let best = null, bd = r;
  for (const s of scooters) { const d = s.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = s; } }
  return best;
}
function mount(s) {
  player.riding = s;
  s.speed = 0; s.driftT = 0; s.drifting = false; s.asleep = false; s.vdir = s.heading; s.trick = null;
  player.vel.set(0, 0, 0);
  audio.start2();
  if (!s.stolen) { s.stolen = true; toast('Grand Theft Sparkesykkel'); save.money += 0; }
}
function dismount(crash = false) {
  const s = player.riding;
  if (!s) return;
  { const w = nightPassenger(); if (w) { if (w.ride.serving && !crash) endService(w, 'Leaving already, sweetie?'); else dropOff(w, crash ? 'Ow! Idiot!' : 'Fine, I\'ll walk.'); } }
  player.riding = null;
  const side = _v.set(Math.cos(s.heading), 0, -Math.sin(s.heading)).multiplyScalar(0.7);
  player.pos.copy(s.pos).add(crash ? _v.set(0, 0.3, 0) : side);
  world.collide(player.pos, RADIUS, HEIGHT, STEP);
  player.vel.set(0, 0, 0);
  if (!crash) s.speed = 0;
  player.fig.root.rotation.set(0, player.heading, 0);
}

// ------------------------------------------------------------------ bolle (mission 4)
let bolleDrop = null;
const bolleItem = makeItem('bolle');
bolleItem.scale.setScalar(1.6);
const bolleMarker = makeArrow(0xf2c12e);
scene.add(bolleMarker);
bolleMarker.visible = false;
function giveBolle() {
  player.carrying = bolleItem;
  bolleItem.removeFromParent();
  carryHold.add(bolleItem);
  bolleItem.position.set(0, 0, 0);
  bolleDrop = null;
}
function dropBolle() {
  if (!player.carrying) return;
  player.carrying = null;
  const pos = player.pos.clone();
  pos.y = world.floorAt(pos.x, pos.z, pos.y + 0.3);
  dropBolleAt(pos, null);
  bolleDrop.cool = 1.0;
  toast('You dropped the bolle! Grab it before a gull does.');
  // the nearest attacking gull goes for it
  const g = gulls.filter(a => ['orbit', 'climb', 'dive'].includes(a.state)).sort((x, y) => x.pos.distanceTo(pos) - y.pos.distanceTo(pos))[0];
  if (g) later('thief', 0.5, () => { if (bolleDrop && g.state !== 'knocked') g.state = 'thief'; });
}
function dropBolleAt(pos, gull) {
  void gull;
  bolleItem.removeFromParent();
  scene.add(bolleItem);
  const y = world.floorAt(pos.x, pos.z, pos.y + 0.5);
  bolleItem.position.set(pos.x, (y > -50 ? y : pos.y) + 0.02, pos.z);
  bolleDrop = { pos: bolleItem.position.clone(), item: bolleItem };
}
function pickDropSpot(from) {
  // a street spot 12-25 m away
  for (let k = 0; k < 40; k++) {
    const i = Math.floor(Math.random() * gAdj.length);
    if (!gAdj[i].length) continue;
    const d = Math.hypot(gx(i) - from.x, gz(i) - from.z);
    if (d < 12 || d > 25) continue;
    return new THREE.Vector3(gx(i), world.floorAt(gx(i), gz(i), 300), gz(i));
  }
  const i = nearestNode(from.x, from.z, 200);
  return new THREE.Vector3(gx(i), world.floorAt(gx(i), gz(i), 300), gz(i));
}

// ------------------------------------------------------------------ missions
const marker = makeMarker();
scene.add(marker);
marker.visible = false;
const itemArrows = [];
let mission = null;
// The bakery: the corner house on Torget facing the fish market
const BAKERY = (() => {
  const target = [-412, -222];
  let best = null, bd = Infinity;
  for (const it of city.polys.items) {
    if (it.tree) continue;
    const cx = (it.x0 + it.x1) / 2, cz = (it.z0 + it.z1) / 2;
    const d = Math.hypot(cx - target[0], cz - target[1]);
    if (d < bd && it.x1 - it.x0 > 6) { bd = d; best = it; }
  }
  const np = { x: 0, z: 0 };
  let nearest = Infinity, ex = 0, ez = 0;
  const p = best.pts;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const ax = p[j], az = p[j + 1], bx = p[i], bz = p[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((target[0] - ax) * dx + (target[1] - az) * dz) / l2, 0.2, 0.8);
    const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(qx - target[0], qz - target[1]);
    if (d < nearest) { nearest = d; np.x = qx; np.z = qz; ex = dx; ez = dz; }
  }
  const l = Math.hypot(ex, ez) || 1;
  let nx = ez / l, nz = -ex / l;
  if ((target[0] - np.x) * nx + (target[1] - np.z) * nz < 0) { nx = -nx; nz = -nz; }
  const door = new THREE.Vector3(np.x + nx * 1.2, 0, np.z + nz * 1.2);
  door.y = world.floorAt(door.x, door.z, 200);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ map: textTexture(['BAKERI'], { w: 512, h: 128, bg: '#f4ead2', fg: '#6a2a1f', font: '800 78px "Archivo", sans-serif', border: '#6a2a1f' }), roughness: 0.6 }));
  sign.position.set(np.x + nx * 0.08, door.y + 3.3, np.z + nz * 0.08);
  sign.rotation.y = Math.atan2(nx, nz);
  scene.add(sign);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.6), new THREE.MeshStandardMaterial({ color: 0x7a2e28, roughness: 0.8 }));
  awning.position.set(np.x + nx * 0.8, door.y + 2.7, np.z + nz * 0.8);
  awning.rotation.set(0, Math.atan2(nx, nz), 0);
  awning.rotateX(0.3);
  scene.add(awning);
  return { door, heading: Math.atan2(nx, nz) };
})();
// Fisketorget: a few market stalls on the quay
for (const [x, z, c] of [[-449, -219, 0xd23a2b], [-445, -228, 0xf4f1ea], [-452, -233, 0x2c4c7a], [-441, -214, 0xf4f1ea]]) {
  const y = world.floorAt(x, z, 50);
  const g = new THREE.Group();
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.0, 4), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
  roof.position.y = 2.7; roof.rotation.y = Math.PI / 4;
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.2), new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.5, metalness: 0.4 }));
  table.position.y = 0.45;
  g.add(roof, table);
  for (const [px, pz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 5), new THREE.MeshStandardMaterial({ color: 0x333333 })); pole.position.set(px, 1.15, pz); g.add(pole); }
  g.position.set(x, y, z); g.rotation.y = 0.35;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  world.polys.add(Float32Array.from([x - 1.3, z - 0.6, x + 1.3, z - 0.6, x + 1.3, z + 0.6, x - 1.3, z + 0.6]), y - 1, y + 0.9, {});
}

const intoHouse = Math.atan2(HVX, HVZ);           // facing from the street into the house
const SPAWN = {
  torget: [-430, 0, -207, Math.PI / 2],
  bryggen: [-546, 0, -413, 0.8],
  home: [...(([x, z]) => [x, H.FU + 0.5, z])(L2W(1.95, -1.6)), intoHouse],
  lane: [...(([x, z]) => [x, H.FU + 0.5, z])(L2W(9.5, -2.3)), Math.atan2(HUX, HUZ)],
  bakery: [BAKERY.door.x, BAKERY.door.y, BAKERY.door.z, BAKERY.heading + Math.PI],
};
const DOOR = L2V(1.95, H.FU, -0.7);
const TERRACE = L2V(...house.terrace.slice(0, 1), house.terrace[1], house.terrace[2]);
const ITEMS = house.items.map(it => ({ ...it, p: (([u, y, v]) => { const w = L2V(u, y, v); return [w.x, w.y, w.z]; })(it.p) }));
const itemObjs = ITEMS.map(it => {
  const o = makeItem(it.kind);
  o.position.set(...it.p);
  o.visible = false;
  scene.add(o);
  const arrow = makeArrow();
  arrow.visible = false;
  scene.add(arrow);
  return { ...it, o, arrow, got: false };
});
let CHECKPOINTS = [];
function planCheckpoints() {
  const r = route(SC_HOME[0], SC_HOME[1], BAKERY.door.x, BAKERY.door.z) || [[BAKERY.door.x, BAKERY.door.z]];
  const cps = [];
  let acc = 0;
  for (let i = 1; i < r.length; i++) {
    acc += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    if (acc > 70 || i === r.length - 1) { cps.push(r[i]); acc = 0; }
  }
  const len = r.reduce((a, p, i) => i ? a + Math.hypot(p[0] - r[i - 1][0], p[1] - r[i - 1][1]) : 0, 0);
  CHECKPOINTS = cps;
  return len;
}

const MISSIONS = [
  {
    id: 'home', title: 'Hjem, vått hjem', sub: 'Home, wet home', spawn: 'bryggen', reward: 100,
    start(m) {
      m.step = 0;
    },
    update(m) {
      setObjective('Get home from Bryggen to <em>Cappes vei 6</em>. Follow the yellow route: past Torget, up by the cathedral, Heggebakken and Skivebakken.');
      m.target = DOOR;
      if (player.pos.distanceTo(DOOR) < 1.4 || inHouse(player.pos)) return 'done';
    },
  },
  {
    id: 'inside', title: 'Innbrudd', sub: 'Inside job', spawn: 'home', reward: 300, timer: 150,
    start(m) {
      showPhone('Theodor', 'Party on the terrace tonight! The landlord keeps “his” nice things all over the house. Borrow them. All six. He’s back in 2½ minutes.', 9);
      for (const it of itemObjs) { it.got = false; it.o.visible = true; it.o.position.set(...it.p); }
      m.step = 0;
    },
    update(m, dt) {
      const left = itemObjs.filter(i => !i.got);
      for (const it of left) {
        const dx = it.o.position.x - player.pos.x, dz = it.o.position.z - player.pos.z, dy = it.o.position.y - player.pos.y;
        if (dx * dx + dz * dz < 1.25 && dy > -0.4 && dy < 2.0) {
          it.got = true; it.o.visible = false; it.arrow.visible = false;
          audio.pickup();
          toast(`Got the ${it.name} (${6 - left.length + 1}/6)`);
        }
      }
      for (const it of itemObjs) {
        it.arrow.visible = !it.got;
        it.arrow.position.set(it.o.position.x, it.o.position.y + 0.65 + Math.sin(performance.now() * 0.005) * 0.08, it.o.position.z);
        it.o.rotation.y += dt * 0.6;
      }
      const remaining = itemObjs.filter(i => !i.got);
      if (remaining.length) {
        setObjective(`Borrow the landlord’s things: <em>${6 - remaining.length}/6</em> &nbsp;·&nbsp; next: ${remaining.map(i => i.name).slice(0, 3).join(', ')}${remaining.length > 3 ? '…' : ''}`);
        let best = null, bd = 1e9;
        for (const it of remaining) { const d = it.o.position.distanceTo(player.pos); if (d < bd) { bd = d; best = it; } }
        m.target = null;
        m.blips = remaining.map(i => ({ x: i.o.position.x, z: i.o.position.z, c: '#f2c12e', r: 5, edge: false }));
        void best;
      } else {
        if (!m.allGot) { m.allGot = true; showPhone('Martin', 'Perfect. Bring it all down to me on the terrace: downstairs, through the bedroom with the black pillow and out the glass door.', 6); }
        setObjective('Carry it all to the <em>terrace</em> (downstairs, out the glass door in the black-pillow bedroom).');
        m.target = TERRACE;
        m.blips = null;
        if (player.pos.distanceTo(TERRACE) < 2.2) return 'done';
      }
      if (m.timer <= 0) return 'fail:The landlord got home first. Act natural.';
    },
    cleanup() { for (const it of itemObjs) { it.o.visible = false; it.arrow.visible = false; } },
  },
  {
    id: 'scooter', title: 'Grand Theft Sparkesykkel', sub: 'The bakery on Torget is about to close', spawn: 'lane', reward: 500,
    noPunchAlarm: true,
    start(m) {
      showPhone('Martin', 'There’s an e-scooter just along the street. Grab it and go go go!', 6);
      m.step = 0; m.cp = 0;
      m.len = planCheckpoints();
      const s = scooters[0];
      s.pos.set(SC_HOME[0], 0, SC_HOME[1]); s.heading = s.vdir = Math.atan2(HUX, HUZ); s.speed = 0; s.vy = 0; s.asleep = false; s.pos.y = world.floorAt(SC_HOME[0], SC_HOME[1], 300);
    },
    update(m) {
      if (m.step === 0) {
        setObjective('Steal an <em>e-scooter</em>: there’s one just along Cappes vei. Press <em>E</em> next to it.');
        const s = nearestScooter(1000);
        m.target = s ? s.pos : null;
        if (player.riding) { m.step = 1; m.timer = Math.round(m.len / 6.5 + 25); state.alarmMin = 2; raiseAlarm(2); toast('Gulls incoming. Keep riding!'); }
        return;
      }
      const cp = CHECKPOINTS[m.cp];
      const y = world.floorAt(cp[0], cp[1], 100);
      m.target = _cpv.set(cp[0], y, cp[1]);
      setObjective(`Ride down to the bakery on <em>Torget</em> through the checkpoints (${m.cp + 1}/${CHECKPOINTS.length}).`);
      if (Math.hypot(player.pos.x - cp[0], player.pos.z - cp[1]) < 4.5) {
        m.cp++; audio.coin();
        if (m.cp >= CHECKPOINTS.length) return 'done';
      }
      if (m.timer !== null && m.timer <= 0) return 'fail:The bakery closed. The party is ruined (it isn’t, try again).';
    },
  },
  {
    id: 'bolle', title: 'Bollejakt', sub: 'The last skillingsbolle in Bergen', spawn: 'bakery', reward: 1000,
    noPunchAlarm: true,
    start(m) {
      m.step = 0;
      state.alarmMin = 0;
    },
    update(m, dt) {
      const door = _cpv.copy(BAKERY.door);
      if (m.step === 0) {
        setObjective('Get the last <em>skillingsbolle</em> from the bakery.');
        m.target = door;
        if (Math.hypot(player.pos.x - door.x, player.pos.z - door.z) < 1.8) {
          m.step = 1; giveBolle(); audio.pickup();
          banner('Bolle secured', 'Now get it home. They have seen it.', '', 2.5);
          state.alarmMin = 3; raiseAlarm(3);
        }
        return;
      }
      if (player.carrying) {
        setObjective('Carry the bolle home to the <em>terrace of Cappes vei 6</em> (in the front door, down the stairs). Punch gulls that get close.');
        m.target = TERRACE;
        bolleMarker.visible = false;
        if (player.pos.distanceTo(TERRACE) < 2.4) return 'done';
      } else if (bolleDrop) {
        setObjective('You dropped the <em>bolle</em>! Grab it!');
        m.target = bolleDrop.pos;
        bolleMarker.visible = true;
        bolleMarker.position.set(bolleDrop.pos.x, bolleDrop.pos.y + 0.8 + Math.sin(performance.now() * 0.006) * 0.1, bolleDrop.pos.z);
        bolleDrop.cool = (bolleDrop.cool || 0) - dt;
        if (bolleDrop.cool <= 0 && Math.hypot(player.pos.x - bolleDrop.pos.x, player.pos.z - bolleDrop.pos.z) < 0.9 && Math.abs(player.pos.y - bolleDrop.pos.y) < 1.5) { giveBolle(); audio.pickup(); toast('Got it back!'); }
      } else {
        const thief = gulls.find(a => a.state === 'carry');
        setObjective('A gull has the bolle! <em>Chase it</em>, it will drop it soon. (Or punch it.)');
        m.target = thief ? thief.pos : null;
        bolleMarker.visible = false;
      }
    },
    cleanup() { bolleMarker.visible = false; if (player.carrying) { player.carrying = null; } bolleItem.removeFromParent(); bolleDrop = null; },
  },
];
const _cpv = new THREE.Vector3();
const GUANGDONG = PLACES.find(p => p.k === 'food');
const takeaway = new THREE.Group();
{
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.18), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 }));
  bag.position.y = 0.16;
  const logo = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.12, 0.19), new THREE.MeshStandardMaterial({ color: 0xa3121b, roughness: 0.8 }));
  logo.position.y = 0.2;
  takeaway.add(bag, logo);
}
MISSIONS.push({
  id: 'guangdong', title: 'Guangdong House', sub: 'Dinner before they close at 19:00', spawn: 'lane', reward: 750,
  start(m) {
    m.step = 0;
    state.alarmMin = 0;
    const r = GUANGDONG ? route(player.pos.x, player.pos.z, GUANGDONG.x, GUANGDONG.z) : null;
    let len = 0; if (r) for (let i = 1; i < r.length; i++) len += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    m.timer = Math.round(len / 5.2 + 35);
  },
  update(m) {
    if (!GUANGDONG) return 'done';
    if (m.step === 0) {
      setObjective('Get the takeaway from <em>Guangdong House</em> before they close.');
      m.target = _cpv.set(GUANGDONG.x, GUANGDONG.y, GUANGDONG.z);
      if (Math.hypot(player.pos.x - GUANGDONG.x, player.pos.z - GUANGDONG.z) < 4.5 && Math.abs(player.pos.y - GUANGDONG.y) < 4) {
        m.step = 1; audio.pickup();
        carryHold.add(takeaway); takeaway.position.set(0, -0.05, 0);
        banner('Middag!', 'Now home to the terrace. Don’t let it get cold.', '', 2.5);
        m.timer = Math.round(m.timer + 60);
        state.alarmMin = 2; raiseAlarm(2);
      }
      if (m.timer <= 0) return 'fail:Guangdong House closed. Brødskive for dinner.';
      return;
    }
    setObjective('Bring the takeaway home to the <em>terrace</em> before it gets cold.');
    m.target = TERRACE;
    if (player.pos.distanceTo(TERRACE) < 2.4) return 'done';
    if (m.timer <= 0) return 'fail:The food got cold. Everyone is disappointed in you (it’s fine).';
  },
  cleanup() { takeaway.removeFromParent(); },
});

// GTA-style offers: the next story mission comes as a text from one of the housemates, which
// you accept (Y) or put off (N). Some start where you meet them: a marker and the GPS show the
// way, and walking into the marker starts the mission (also if you put it off).
const OFFERS = {
  home: { giver: 'Øystein', text: 'Hvor ER du? You have the only key and it’s pouring. Can you come home to Cappes vei 6?', at: null },
  inside: { giver: 'Theodor', text: 'Party on the terrace tonight! Meet me at our front door, I have a plan for the landlord’s nice things.', at: () => DOOR, where: 'at the front door of Cappes vei 6' },
  scooter: { giver: 'Martin', text: 'KRISE. No boller for the party, and the bakery on Torget closes any minute. Meet me out on Cappes vei?', at: () => L2V(9.5, H.FU, -2.3), where: 'on Cappes vei, by no. 6' },
  bolle: { giver: 'Jaakko', text: 'Did you make it?? Get the LAST skillingsbolle. Every gull in Bergen is watching that counter.', at: null },
  guangdong: { giver: 'Jaakko', text: 'Bolle is dessert. DINNER is Guangdong House, obviously. They close at 19:00. Up for it?', at: null },
};
let offer = null;          // { idx, accepted }
const offerEl = document.createElement('div');
offerEl.className = 'offer';
offerEl.innerHTML = '<button type="button" data-a="yes"><kbd>Y</kbd> Accept</button><button type="button" data-a="no"><kbd>N</kbd> Later</button>';
hud.phone.appendChild(offerEl);
offerEl.hidden = true;
offerEl.addEventListener('click', e => { const a = e.target.closest('button'); if (a) (a.dataset.a === 'yes' ? acceptOffer : declineOffer)(); });
function makeOffer() {
  const idx = save.mission;
  if (mission || idx >= MISSIONS.length || (offer && offer.accepted)) return;
  // story missions are Håvard's: the call waits until you are him again
  if (active !== 'havard' || state.mode !== 'play') { later('offer', 8, makeOffer); return; }
  const o = OFFERS[MISSIONS[idx].id];
  offer = { idx, accepted: false };
  showPhone(o.giver, o.text, 25);
  offerEl.hidden = false;
  later('phone', 25, () => { hud.phone.hidden = true; offerEl.hidden = true; if (offer && !offer.accepted) declineOffer(true); });
}
function acceptOffer() {
  if (!offer || offer.accepted) return;
  hud.phone.hidden = true; offerEl.hidden = true;
  const idx = offer.idx, o = OFFERS[MISSIONS[idx].id];
  if (!o.at) { offer = null; startMission(idx, { spawn: false }); return; }
  offer.accepted = true;
  audio.start2();
  toast(`On my way, ${o.giver}!`, 2);
}
function declineOffer(silent = false) {
  if (!offer) return;
  hud.phone.hidden = true; offerEl.hidden = true;
  offer = null;
  if (!silent) toast('Maybe later.', 1.5);
  later('offer', 60, makeOffer);
}
// where the next story mission starts, if it starts somewhere (and you are Håvard)
function startPoint() {
  if (mission || active !== 'havard' || save.mission >= MISSIONS.length) return null;
  const o = OFFERS[MISSIONS[save.mission].id];
  return o.at ? o.at() : null;
}

function startMission(i, { spawn = true, quiet = false } = {}) {
  if (mission && mission.def.cleanup) mission.def.cleanup(mission);
  const def = MISSIONS[i];
  if (!def) { mission = null; freeRoam(); return; }
  save.mission = i; persist();
  mission = { def, idx: i, timer: def.timer ?? null, target: null, blips: null, step: 0 };
  state.alarmMin = 0; state.alarm = 0;
  if (spawn) placePlayer(SPAWN[def.spawn]);
  if (!quiet) banner(def.title, def.sub, '', 3.4);
  audio.start2();
  def.start(mission);
  matesT = 0;
}
function freeRoam() {
  mission = null;
  state.alarmMin = 0;
  setObjective(save.umbrellas.length < UMBRELLAS.length ? `Free roam. Find all <em>${UMBRELLAS.length} lost umbrellas</em> hidden around Fjellet and Bryggen.` : 'Free roam. Fjellet is yours.');
}
function completeMission() {
  const def = mission.def;
  if (def.cleanup) def.cleanup(mission);
  save.money += def.reward;
  audio.jingle();
  banner('Oppdrag fullført', `Mission complete  ·  +${def.reward} kr`, 'pass', 3.6);
  const next = mission.idx + 1;
  state.alarmMin = 0;
  mission = null;
  setObjective('');
  marker.visible = false;
  save.mission = next; persist();
  if (next === MISSIONS.length) { later('ending', 2.5, ending); return; }
  later('offer', next === 3 ? 2.5 : 8, makeOffer);
}
function failMission(reason) {
  audio.fail();
  banner('Oppdrag feilet', reason, 'fail', 3.6);
  const idx = mission.idx;
  if (mission.def.cleanup) mission.def.cleanup(mission);
  mission = null;
  marker.visible = false;
  void idx;
  later('offer', 6, makeOffer);      // you get asked again
}
function updateMission(dt) {
  if (!mission) {
    const sp = startPoint();
    if (!sp) { marker.visible = false; if (offer === null && hud.objective.dataset.k === 'meet') { freeRoam(); } return; }
    marker.visible = true;
    marker.position.copy(sp);
    if (offer && offer.accepted) {
      const o = OFFERS[MISSIONS[save.mission].id];
      if (hud.objective.dataset.k !== 'meet') { setObjective(`Meet <em>${o.giver}</em> ${o.where}.`); hud.objective.dataset.k = 'meet'; }
    }
    if (Math.hypot(player.pos.x - sp.x, player.pos.z - sp.z) < 2.2 && Math.abs(player.pos.y - sp.y) < 2.5 && !player.riding) {
      offer = null; hud.phone.hidden = true; offerEl.hidden = true;
      startMission(save.mission, { spawn: false });
    }
    return;
  }
  if (mission.timer !== null) mission.timer -= dt;
  const r = mission.def.update(mission, dt);
  if (r === 'done') { completeMission(); return; }
  if (typeof r === 'string' && r.startsWith('fail:')) { failMission(r.slice(5)); return; }
  if (mission && mission.target) {
    marker.visible = true;
    marker.position.copy(mission.target);
    const t = performance.now() * 0.003;
    marker.userData.ring.scale.setScalar(1 + Math.sin(t) * 0.08);
    marker.userData.beam.material.opacity = 0.16 + Math.sin(t * 1.3) * 0.05;
  } else marker.visible = false;
}

// ------------------------------------------------------------------ the five of you, around town
// Where each of you hangs out when you are not them: on the street outside their place.
const OUT_SPOTS = (() => {
  const near = (k, fb) => {
    const pl = PLACES.find(p => p.k === k);
    if (!pl) return fb;
    const i = nearestNode(pl.x, pl.z, 60);
    const x = i >= 0 ? gx(i) : pl.x, z = i >= 0 ? gz(i) : pl.z;
    return [x, world.floorAt(x, z, 300), z, Math.atan2(pl.x - x, pl.z - z)];
  };
  const b = SPAWN.bryggen;
  return {
    havard: [b[0], world.floorAt(b[0], b[2], 300), b[2], b[3]],      // on Bryggen
    oystein: near('shop', SPAWN.torget),                               // Rema 1000 Marken
    theodor: near('bar', SPAWN.torget),                                // Magda
    jaakko: near('food', SPAWN.torget),                                // Guangdong House
    martin: (() => {                                                   // by Fløibanen's lower station, off Torget
      const fx = map.funicular[0], fz = map.funicular[1], i = nearestNode(fx, fz, 60);
      const x = i >= 0 ? gx(i) : fx, z = i >= 0 ? gz(i) : fz;
      return [x, world.floorAt(x, z, 300), z, Math.atan2(fx - x, fz - z)];
    })(),
  };
})();
// During a story mission the others are at home (the party is being prepared); otherwise they are
// out in town, or where you left them. They only move when neither spot is near you.
let matesT = 0;
function updateMates(dt) {
  matesT -= dt;
  if (matesT > 0) return;
  matesT = 1;
  for (const id of CHAR_IDS) {
    const n = housemates[id];
    if (n.active) continue;
    let want;
    if (mission && HOME_SPOTS[id]) { const [u, f, v, h, pose] = HOME_SPOTS[id]; want = [...L2V(u, H[f], v).toArray(), h + H.theta, pose]; n.left = false; }
    else if (n.left) continue;
    else { const o = OUT_SPOTS[id]; want = [o[0], o[1], o[2], o[3], 'idle']; }
    if (Math.hypot(n.pos.x - want[0], n.pos.z - want[2]) < 0.5 && Math.abs(n.pos.y - want[1]) < 0.5) continue;
    const far = (x, z) => Math.hypot(x - player.pos.x, z - player.pos.z) > 45;
    if (state.mode === 'title' || (far(n.pos.x, n.pos.z) && far(want[0], want[2]))) {
      n.pos.set(want[0], want[1], want[2]); n.heading = want[3]; n.party = want[4];
    }
  }
}
for (const id of CHAR_IDS) { const n = housemates[id]; const o = OUT_SPOTS[id]; if (id !== 'havard') { n.pos.set(o[0], o[1], o[2]); n.heading = o[3]; n.party = 'idle'; } }

// switching, with GTA's sky camera: up out of the street, across town, down to the other one
let wheelOpen = false, sw = null;
const wheelEl = $('wheel');
for (const [k, id] of CHAR_IDS.entries()) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.id = id;
  b.style.setProperty('--c', CHAR_COL[id]);
  b.innerHTML = `<img src="/img/people/${id}-face.jpg" alt=""><b>${PEOPLE[id].name}</b><span></span><kbd>${k + 1}</kbd>`;
  b.addEventListener('click', () => switchTo(id));
  wheelEl.appendChild(b);
}
function openWheel(on) {
  if (on && state.mode !== 'play') return;
  wheelOpen = on;
  $('switch').hidden = !on;
  if (on) {
    for (const b of wheelEl.children) {
      const n = housemates[b.dataset.id];
      b.classList.toggle('me', n.active);
      b.querySelector('span').textContent = n.active ? 'You' : inHouse(n.pos) ? 'Cappes vei 6' : inOffice(n.pos) ? 'Myreze' : (streetName(n.pos.x, n.pos.z) || 'Bergen');
    }
    if (!isTouch && document.pointerLockElement) document.exitPointerLock();
  } else if (state.mode === 'play') requestLock();
}
function switchTo(id) {
  openWheel(false);
  if (id === active) return;
  const why = state.mode !== 'play' ? 'Not now' : mission ? 'Finish the mission first' : player.riding ? 'Get off the scooter first' : player.carrying ? 'Put that down first' : null;
  if (why) { toast(why, 1.6); return; }
  state.mode = 'switch';
  sw = planSwitch(id);
  canvas.style.filter = 'saturate(0.45) contrast(1.12) brightness(1.02)';
}
// The sky camera, after GTA: three quick steps up into the sky, a glide across town, three steps
// down. One continuous path of keyframes, each a position and an orientation, so the view never
// jumps: the first step turns the camera to look straight down with north at the top of the
// screen, it keeps exactly that view all the way across, and the last step turns it into the new
// character's view.
const _qDown = (() => { const c = new THREE.PerspectiveCamera(); c.up.set(0, 0, -1); c.lookAt(0, -1, 0); return c.quaternion.clone(); })();
function planSwitch(id) {
  const F = player.pos.clone(), B = housemates[id].pos.clone();
  const HS = [40, 130, 360];                       // the steps up, metres above the ground
  const segs = [];
  let p = camera.position.clone(), q = camera.quaternion.clone();
  // position and turn can ease differently: a step snaps up, but the view turns smoothly
  const add = (dur, p1, q1, kind, ease, qease = ease) => { segs.push({ dur, p0: p.clone(), q0: q.clone(), p1: p1.clone(), q1: q1.clone(), kind, ease, qease }); p = p1.clone(); q = q1.clone(); };
  const at = (v, h) => new THREE.Vector3(v.x, v.y + h, v.z);
  const outCubic = k => 1 - (1 - k) ** 3, smooth = k => k * k * (3 - 2 * k), inOut = k => k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
  HS.forEach((h, k) => {
    add(k === 0 ? 0.4 : 0.24, at(F, h), _qDown, 'up', outCubic, inOut);
    add(k === 2 ? 0.34 : 0.26, at(F, h * 1.06), _qDown, 'hold', smooth);          // keeps drifting, never freezes
  });
  const dist = Math.hypot(B.x - F.x, B.z - F.z);
  add(Math.min(2.0, Math.max(0.9, 0.7 + dist / 700)), at(B, HS[2] * 1.06), _qDown, 'pan', smooth);
  for (const k of [1, 0]) {
    add(0.24, at(B, HS[k] * 1.06), _qDown, 'down', outCubic);
    add(0.26, at(B, HS[k]), _qDown, 'hold', smooth);
  }
  // the new character's own camera, as updateCamera will place it
  const yaw = housemates[id].heading + Math.PI, pitch = 0.3;
  const pivot = at(B, 1.55);
  const end = pivot.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(4.4));
  const tc = new THREE.PerspectiveCamera(); tc.position.copy(end); tc.lookAt(pivot.x, pivot.y + 0.1, pivot.z);
  add(0.5, end, tc.quaternion, 'land', inOut);
  return { id, segs, i: 0, t: 0, swapped: false, started: -1 };
}
const flashEl = document.createElement('div');
flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:#fff;opacity:0;transition:opacity .28s ease-out';
document.body.appendChild(flashEl);
function flash() { flashEl.style.transition = 'none'; flashEl.style.opacity = '0.28'; void flashEl.offsetWidth; flashEl.style.transition = 'opacity .28s ease-out'; flashEl.style.opacity = '0'; }
// make `id` the one you play, at their position
function swapTo(id) {
  const old = housemates[active], nw = housemates[id];
  old.active = false; old.tag.visible = true; old.left = true;
  old.pos.copy(player.pos); old.heading = player.heading; old.party = 'idle'; old.fall = 0; old.downT = 0;
  old.fig.body.rotation.x = 0;
  nw.active = true; nw.tag.visible = false; nw.left = false;
  if (nw.bubble) { nw.fig.root.remove(nw.bubble); nw.bubble = null; }
  player.fig = nw.fig;
  nw.fig.elbows[0].add(carryHold);
  nw.fig.elbows[0].add(gun.obj);
  old.fig.aim = null;
  old.fig.umbrella = null;
  if (brolly.up) { nw.fig.elbows[1].add(brolly.obj); nw.fig.umbrella = brolly.obj; }
  player.pos.copy(nw.pos); player.vel.set(0, 0, 0); player.heading = nw.heading;
  player.knockT = 0; player.health = 100;
  cam.yaw = nw.heading + Math.PI; cam.pitch = 0.3; cam.cur = cam.dist = 4.4;
  active = id; save.char = id; persist();
}
function updateSwitch(dt) {
  sw.t += dt;
  let seg = sw.segs[sw.i];
  while (seg && sw.t >= seg.dur) { sw.t -= seg.dur; sw.i++; seg = sw.segs[sw.i]; }
  if (!seg) {
    camera.position.copy(sw.segs[sw.segs.length - 1].p1);
    camera.quaternion.copy(sw.segs[sw.segs.length - 1].q1);
    state.mode = 'play'; sw = null;
    canvas.style.filter = '';
    toast(PEOPLE[active].name, 1.4);
    if (!isTouch) requestLock();
    return;
  }
  if (sw.started !== sw.i) {             // a new segment: its sound, and the swap at the top
    sw.started = sw.i;
    if (seg.kind === 'up' || seg.kind === 'down') { audio.switchStep(seg.kind === 'up'); flash(); }
    if (seg.kind === 'pan') { audio.switchPan(seg.dur); if (!sw.swapped) { sw.swapped = true; swapTo(sw.id); } }
    if (seg.kind === 'land') { audio.switchLand(); flash(); }
  }
  const k = Math.min(1, sw.t / seg.dur);
  camera.position.lerpVectors(seg.p0, seg.p1, seg.ease(k));
  camera.quaternion.slerpQuaternions(seg.q0, seg.q1, seg.qease(k));
  const alt = Math.max(0, camera.position.y - player.pos.y);
  sw.high = alt > 25;
  // the weather sets the fog for street level every frame; up here it would be a grey veil
  scene.fog.near += alt; scene.fog.far += alt * 1.6;
}

// ------------------------------------------------------------------ death, water, respawn
function placePlayer(sp) {
  const [x, y, z, h] = sp;
  player.pos.set(x, world.floorAt(x, z, (y || 0) + 200, 0.5), z);
  player.vel.set(0, 0, 0);
  player.heading = h;
  cam.yaw = h + Math.PI; cam.pitch = 0.3; cam.cur = cam.dist = 4.4;
  player.knockT = 0; player.fig.body.rotation.x = 0;
  if (player.riding) player.riding = null;
}
function fadeThen(fn) {
  const f = $('fade');
  f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 150); }, 650);
}
function respawn() {
  placePlayer(mission ? SPAWN[mission.def.spawn] : SPAWN.home);
}
function splash() {
  audio.splash();
  if (player.carrying) { player.carrying = null; bolleItem.removeFromParent(); }
  toast('Vågen is 8 °C in November. Not today.', 3);
  fadeThen(() => {
    placePlayer(SPAWN.torget);
    if (mission && mission.def.id === 'bolle' && mission.step === 1 && !player.carrying && !bolleDrop) { giveBolle(); }
  });
  player.vel.set(0, 0, 0);
}
function die(title, sub) {
  if (dive.on) endSkydive();
  state.mode = 'dead';
  audio.fail();
  banner(title, sub, 'fail', 3.5);
  save.money = Math.max(0, save.money - 100); persist();
  player.knockT = 99;
  later('respawn', 3, () => fadeThen(() => {
    player.health = 100; state.alarm = 0; player.knockT = 0;
    state.mode = 'play';
    if (mission) failMission('Knocked out. You come round at home.');
    respawn();
  }));
}

// ------------------------------------------------------------------ ending
const party = [];
function ending() {
  state.mode = 'cut';
  state.alarm = 0; state.alarmMin = 0;
  weather.forced = 0;
  // everyone out on the terrace
  const spots = { oystein: [1.4, 10.0, 2.4, 'wave'], theodor: [4.6, 9.4, -2.6, 'idle'], jaakko: [6.6, 11.2, -2.4, 'wave'], martin: [5.2, 11.7, Math.PI, 'idle'] };
  for (const id in spots) {
    const [u, v, h, anim] = spots[id], n = housemates[id];
    n.pos.copy(L2V(u, H.FL, v)); n.heading = h + H.theta; n.party = anim;
    party.push(n);
  }
  say(housemates.oystein, 'Bolle!!');
  say(housemates.jaakko, 'Guangdong!!');
  hud.phone.hidden = true;
  setObjective('');
  const t0 = performance.now();
  state.cut = { t0, dur: 11000 };
  later('end1', 1.2, () => banner('Velkommen hjem', 'Cappes vei 6 · Fjellet · Bergen', 'pass', 6));
  later('end2', 7.5, () => banner('Takk for at du spilte', 'Free roam unlocked: find the lost umbrellas', '', 4));
  later('end3', 11, () => {
    state.mode = 'play'; state.cut = null; weather.forced = null; save.done = true; persist(); freeRoam(); if (!locked) requestLock();
    // back to their usual spots (out of sight)
    for (const id of CHAR_IDS) { const n = housemates[id]; if (!n.active) { n.party = 'idle'; n.left = false; } }
    matesT = 0;
  });
}
function updateCut(dt) {
  if (!state.cut) return;
  const k = clamp((performance.now() - state.cut.t0) / state.cut.dur, 0, 1);
  const e = k * k * (3 - 2 * k);
  // rise from the terrace and look out over the rooftops to Vågen
  const a = L2V(8.5, H.FL + 2.4, 13.8), b = L2V(2, H.FL + 34, 30);
  camera.position.lerpVectors(a, b, e);
  const la = L2V(3.5, H.FL + 1.2, 9.5), lb = new THREE.Vector3(-470, 0, -250);
  camera.lookAt(_v.lerpVectors(la, lb, e));
  player.fig.root.visible = true;
  void dt;
}

// ------------------------------------------------------------------ title camera
function updateTitleCam(time) {
  // drift along Cappes vei, looking at no. 6
  const a = time * 0.1;
  camera.position.copy(L2V(-9 + Math.sin(a) * 1.5, H.FU + 3.2 + Math.sin(a * 0.7) * 0.4, -5.5));
  camera.lookAt(L2V(3.5, H.FU + 2.2, 0.5));
}

// ------------------------------------------------------------------ flow
function startGame() {
  $('title').hidden = true;
  $('hud').hidden = false;
  if (isTouch) $('touch').hidden = false;
  audio.start();
  state.mode = 'play';
  // you start in free roam, wherever your character is in town; the next mission comes as a text
  placePlayer(housemates[active].left ? [housemates[active].pos.x, housemates[active].pos.y, housemates[active].pos.z, housemates[active].heading] : OUT_SPOTS[active]);
  freeRoam();
  matesT = 0;
  if ((save.mission || 0) < MISSIONS.length) later('offer', 5, makeOffer);
  requestLock();
  later('help', 14, () => { $('help').style.opacity = 0; });
}
const FACTS = [
  'Bergen gets well over two metres of rain in a normal year, which makes it one of the wettest cities in Europe.',
  'Fløibanen, the funicular up Fløyen, has been running since 1918.',
  'The wharf houses of Bryggen are on UNESCO’s World Heritage List.',
  'Ulriken, at 643 metres, is the highest of the seven mountains around Bergen.',
  'Fjellet is the old neighbourhood on the slope just above Bryggen, all steep lanes and white wooden houses.',
  'The skillingsbolle is Bergen’s own cinnamon bun. The gulls know this.',
  'Bergen’s gulls really do snatch food out of people’s hands. Hold on to your bolle.',
];
let factIdx = Math.floor(Math.random() * FACTS.length);
function pauseGame() {
  if (state.mode !== 'play') return;
  state.mode = 'pause';
  $('pause').hidden = false;
  $('pausetitle').textContent = mission ? mission.def.title : PEOPLE[active].name;
  $('pausestats').textContent = `kr ${save.money.toLocaleString('nb-NO')} · umbrellas ${save.umbrellas.length}/${UMBRELLAS.length}`;
  $('restart').hidden = !mission;
  $('fact').innerHTML = '<b>Bergen fact</b>' + FACTS[factIdx++ % FACTS.length];
  audio.pauseRadio(true);
  if (audio.ctx) audio.ctx.suspend();
}
function resumeGame() {
  $('pause').hidden = true;
  state.mode = 'play';
  if (audio.ctx) audio.ctx.resume();
  audio.pauseRadio(false);
  requestLock();
  last = performance.now();
}
function toggleSound() {
  audio.setOn(!audio.on);
  $('soundbtn').textContent = 'Sound: ' + (audio.on ? 'on' : 'off');
}
$('play').addEventListener('click', startGame);
$('resume').addEventListener('click', resumeGame);
$('restart').addEventListener('click', () => { if (!mission) return; const i = mission.idx; resumeGame(); fadeThen(() => startMission(i)); });
$('soundbtn').addEventListener('click', toggleSound);
$('reset').addEventListener('click', () => {
  if (!confirm('Start over from the first mission? Money and umbrellas reset.')) return;
  Object.assign(save, { mission: 0, money: 0, umbrellas: [], done: false }); persist();
  for (const u of umbrellaObjs) u.o.visible = true;
  shownMoney = 0;
  resumeGame();
  fadeThen(() => {
    if (mission) { if (mission.def.cleanup) mission.def.cleanup(mission); mission = null; }
    offer = null; hud.phone.hidden = true; offerEl.hidden = true;
    if (active !== 'havard') swapTo('havard');
    const sp = OUT_SPOTS.havard; placePlayer(sp);
    freeRoam(); matesT = 0;
    later('offer', 5, makeOffer);
  });
});

// ------------------------------------------------------------------ main loop
let last = performance.now(), time = 0, frameAvg = 16, adaptT = 0, gpsT = 0, frameNo = 0;
renderer.shadowMap.autoUpdate = false;
// Fløibanen: two cars on a timetable, passing halfway. Each waits at its station, then runs
// to the other end. Stand by a waiting car and press E to ride; you get off at the other end.
const FUNI_WAIT = 18, FUNI_RUN = 75;
const funiState = { t: 0, ride: null, u: [0, 1] };
const funiWin = city.cars.map(car => car.children[1] && car.children[1].material);
// the platform beside each end of the line, where you get on and off
const funiStop = [0, 1].map(u => {
  const c = city.funiCurve, p = c.getPointAt(u), q = c.getPointAt(u ? u - 0.01 : 0.01);
  const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
  for (const side of [1, -1]) for (const d of [3.5, 5, 7]) {
    const x = p.x - dz / l * d * side + (u ? -dx / l * 3 : dx / l * 3), z = p.z + dx / l * d * side + (u ? -dz / l * 3 : dz / l * 3);
    const y = world.floorAt(x, z, p.y + 3, 5);
    if (y > -50 && Math.abs(y - (p.y - 0.8)) < 3) return new THREE.Vector3(x, y, z);
  }
  return new THREE.Vector3(p.x + 3, world.floorAt(p.x + 3, p.z, p.y + 3, 6), p.z);
});
function updateFuni(dt) {
  const f = funiState, cyc = 2 * (FUNI_WAIT + FUNI_RUN);
  f.t = (f.t + dt) % cyc;
  // car 0: waits at the bottom, runs up, waits at the top, runs down; car 1 the other way round
  const t = f.t, ease = x => x * x * (3 - 2 * x);
  const u0 = t < FUNI_WAIT ? 0 : t < FUNI_WAIT + FUNI_RUN ? ease((t - FUNI_WAIT) / FUNI_RUN) : t < 2 * FUNI_WAIT + FUNI_RUN ? 1 : 1 - ease((t - 2 * FUNI_WAIT - FUNI_RUN) / FUNI_RUN);
  f.u = [u0, 1 - u0];
  f.waiting = t < FUNI_WAIT || (t >= FUNI_WAIT + FUNI_RUN && t < 2 * FUNI_WAIT + FUNI_RUN);
  city.cars.forEach((car, i) => {
    const u = clamp(f.u[i], 0, 0.995);
    const p = city.funiCurve.getPointAt(u), p2 = city.funiCurve.getPointAt(u + 0.005);
    car.position.copy(p);
    car.lookAt(p2.x, p.y, p2.z);
    if (funiWin[i]) { funiWin[i].emissive.setHex(0xffd9a0); funiWin[i].emissiveIntensity = dayState.lamp * 1.4; }
  });
  // riding: you're in the car; at the other end you step out onto the platform
  const r = f.ride;
  if (r) {
    const car = city.cars[r.car];
    player.pos.copy(car.position); player.vel.set(0, 0, 0);
    player.fig.root.visible = false;
    if (!f.waiting) r.moved = true;
    if (r.moved && f.waiting) {
      const end = f.u[r.car] > 0.5 ? 1 : 0;
      f.ride = null;
      player.pos.copy(funiStop[end]); player.onGround = true;
      player.fig.root.visible = true;
      toast(end ? 'Fløyen, 320 moh. Mind the gulls.' : 'Vetrlidsallmenningen. Torget is just down the street.', 3);
      audio.door();
    }
  }
}
// the car waiting at the station you're standing at, if any
function funiCarHere() {
  const f = funiState;
  if (!f.waiting || f.ride || player.riding || dive.on) return -1;
  for (let i = 0; i < 2; i++) {
    const end = f.u[i] > 0.5 ? 1 : 0;
    if (player.pos.distanceTo(funiStop[end]) < 6 || player.pos.distanceTo(city.cars[i].position) < 7) return i;
  }
  return -1;
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  time += dt;
  if (state.mode === 'map') { pressed.jump = pressed.punch = pressed.use = pressed.radio = pressed.gun = pressed.trick = false; audio.skid(0); return; }
  if (state.mode === 'pause') { pressed.jump = pressed.punch = pressed.use = pressed.radio = pressed.gun = pressed.trick = false; audio.skid(0); renderer.render(scene, camera); return; }

  updateWeather(dt);
  skyU.time.value = time;
  sky.position.copy(camera.position);
  updateDayNight(dt);
  // high up in a skydive the town below shows through the weather, as from the sky camera
  if (dive.on && skyAlt > 20) { scene.fog.near += skyAlt; scene.fog.far += skyAlt * 1.8; }

  if (state.mode === 'title') {
    updateTitleCam(time);
  } else {
    if (state.mode === 'play' || state.mode === 'dead' || state.mode === 'cut' || state.mode === 'switch') {
      if (state.mode === 'play') { updateGun(dt); updatePlayer(dt); updateBrolly(dt); }
      else if (!window.__director) player.fig.animate(dt, 0, state.mode === 'dead' ? 'down' : state.mode === 'switch' ? 'idle' : 'walk');
      for (const s of scooters) if (s !== player.riding) updateScooter(s, dt, { x: 0, y: 0 });
      updateHeadlight();
      updateTram(dt);
      updateDoors(dt);
      updateAlarm(dt);
      if (state.mode === 'play') updateMission(dt);
      updateUmbrellas(dt, time);
      updatePlaces(dt, time);
      if (state.mode === 'cut') updateCut(dt); else if (state.mode === 'switch') updateSwitch(dt); else updateCamera(dt);
    }
    updateHud(dt);
    const blips = [];
    if (mission && mission.target) blips.push({ x: mission.target.x, z: mission.target.z, c: '#f2c12e', edge: true, r: 8 });
    { const sp = startPoint(); if (sp) blips.push({ x: sp.x, z: sp.z, c: '#f2c12e', edge: true, r: 8, label: OFFERS[MISSIONS[save.mission].id].giver }); }
    // the others, in their colours (not while they are all at home)
    for (const id of CHAR_IDS) { const n = housemates[id]; if (n.active || inHouse(n.pos)) continue; blips.push({ x: n.pos.x, z: n.pos.z, c: CHAR_COL[id], r: 6, label: PEOPLE[id].name, edge: true }); }
    if (mission && mission.blips) blips.push(...mission.blips);
    if (!mission || mission.def.id === 'scooter') for (const s of scooters) if (s !== player.riding) blips.push({ x: s.pos.x, z: s.pos.z, c: '#2bb673', r: 5 });
    for (const a of gulls) if (['orbit', 'dive', 'climb', 'carry'].includes(a.state)) blips.push({ x: a.pos.x, z: a.pos.z, c: a.state === 'carry' ? '#f2c12e' : '#d2301f', r: 4 });
    { const [hx, hz] = L2W(4, 4.2); blips.push({ x: hx, z: hz, c: '#f4f1ea', r: 6, edge: true, home: true }); }
    for (const pl of PLACES) blips.push({ x: pl.x, z: pl.z, c: pl.st.bg, r: 7, label: pl.n, edge: pl.k === 'food' });
    blips.push({ x: JUMP.x, z: JUMP.z, c: '#e2231a', r: 6, label: 'Skydive' });
    blips.push({ x: funiStop[0].x, z: funiStop[0].z, c: '#2f6db5', r: 5, label: 'Fløibanen' });
    for (const lm of map.landmarks || []) if (lm.n !== 'Fløyen') blips.push({ x: lm.x, z: lm.z, c: '#cfd6dc', r: 4, label: lm.n });
    for (const lm of landmarks.spots) blips.push({ x: lm.x, z: lm.z, c: '#cfd6dc', r: 4, label: lm.n });
    for (const sec of tram.sections) if (sec.g.visible) blips.push({ x: sec.x, z: sec.z, c: '#f07c1a', r: 4 });
    bm.blips = blips.map(b => b.home ? { ...b, label: 'Cappes vei 6' } : b);
    // the waypoint: reached when you get there
    if (waypoint) {
      const d = Math.hypot(waypoint.x - player.pos.x, waypoint.z - player.pos.z);
      if (d < 10 && state.mode === 'play') { toast(`You have arrived${waypoint.name ? ': ' + waypoint.name : ''}`, 2.2); clearWaypoint(); }
      else blips.push({ x: waypoint.x, z: waypoint.z, c: WP_COL, r: 8, edge: true, shape: 'wp' });
    }
    wpMarker.visible = !!waypoint && state.mode !== 'switch';
    if (waypoint) {
      wpMarker.position.set(waypoint.x, city.terrain.height(waypoint.x, waypoint.z), waypoint.z);
      wpMarker.userData.beam.material.opacity = 0.18 + Math.sin(time * 1.3) * 0.05;
    }
    // GPS route to the current target, recomputed now and then
    gpsT -= dt;
    if (gpsT <= 0) {
      gpsT = 1.2;
      const tgt = (mission && mission.target) || startPoint();
      gps = tgt && !isIndoors(player.pos) && Math.hypot(tgt.x - player.pos.x, tgt.z - player.pos.z) > 15 ? route(player.pos.x, player.pos.z, tgt.x, tgt.z) : null;
      if (gps) gps.unshift([player.pos.x, player.pos.z]);
      wpRoute();
      const wt = waypoint ? (wpGps ? fmtDist(routeLen(wpGps)) : fmtDist(Math.hypot(waypoint.x - player.pos.x, waypoint.z - player.pos.z))) + (waypoint.name ? ' · ' + waypoint.name : '') : '';
      $('wpinfo').hidden = !wt; if ($('wpinfo').textContent !== wt) $('wpinfo').textContent = wt;
      const sn = inHouse(player.pos) ? 'Cappes vei 6' : inOffice(player.pos) ? 'Myreze · Halfdan Kjerulfs gate 4' : streetName(player.pos.x, player.pos.z);
      if (sn !== hud.street.textContent) hud.street.textContent = sn || '';
    }
    drawMinimap(blips);
    // prompt
    let prompt = nightPrompt();
    if (prompt) { /* the night's business comes first */ }
    else if (state.mode === 'play' && !player.riding) { const s = nearestScooter(1.7); if (s) prompt = `<kbd>${isTouch ? 'E' : 'E'}</kbd>${s.stolen ? 'Ride e-scooter' : 'Steal e-scooter'}`; }
    else if (state.mode === 'play' && player.riding && Math.abs(player.riding.speed) < 1) prompt = '<kbd>E</kbd>Get off';
    else if (state.mode === 'play' && player.riding && player.riding.speed > 4 && !save.rideHint) prompt = isTouch ? '<kbd>Jump</kbd>trick <kbd>Run</kbd>boost <kbd>Drift</kbd>hold to drift' : '<kbd>Space</kbd>trick <kbd>Shift</kbd>boost <kbd>Right mouse</kbd>hold to drift';
    if (player.riding && (player.riding.driftT > 1 || player.riding.trick) && !save.rideHint) { save.rideHint = true; persist(); }
    if (state.mode === 'play' && !prompt && funiCarHere() >= 0) prompt = `<kbd>E</kbd>Ride Fløibanen ${funiState.u[funiCarHere()] < 0.5 ? 'up to Fløyen' : 'down to town'}`;
    if (state.mode === 'play' && funiState.ride) prompt = funiState.waiting && !funiState.ride.moved ? 'Fløibanen: leaving shortly…' : 'Fløibanen';
    if (state.mode === 'play' && !player.riding && !dive.on && !prompt && Math.hypot(player.pos.x - JUMP.x, player.pos.z - JUMP.z) < 3.5 && Math.abs(player.pos.y - JUMP.y) < 3) prompt = '<kbd>E</kbd>Skydive from 450 m';
    if (!prompt && stairsHere()) prompt = stairsHere() === 'up' ? '<kbd>E</kbd>Take the stairs up to Myreze, 4th floor' : '<kbd>E</kbd>Take the stairs down to Halfdan Kjerulfs gate';
    if (dive.on && state.mode === 'play') prompt = `Altitude ${Math.max(0, Math.round(skyAlt))} m · ` + (dive.phase === 'free' ? (isTouch ? '<kbd>Jump</kbd>open the parachute' : '<kbd>Space</kbd>open the parachute') : 'A/D steer · W dive · S flare');
    if (!prompt && brolly.shelterT > 0.3) prompt = `Sheltering under the umbrella… ${Math.ceil(SHELTER_T - brolly.shelterT)}`;
    hud.prompt.hidden = !prompt;
    if (prompt && hud.prompt.innerHTML !== prompt) hud.prompt.innerHTML = prompt;
    audio.update(weather.rain, isIndoors(camera.position), player.riding ? Math.abs(player.riding.speed) : 0, player.riding && turbo.on ? 1 : 0);
    if (player.riding && turbo.on && state.mode === 'play') {
      const r = player.riding;
      emit(_v.set(r.pos.x - Math.sin(r.heading) * 0.5, r.pos.y + 0.12, r.pos.z - Math.cos(r.heading) * 0.5), 2,
        { color: 0x9fd8ff, speed: 1.2, up: 0.6, spread: 0.4, life: 0.25, grav: 2, dir: _v2.set(-Math.sin(r.heading), 0.2, -Math.cos(r.heading)) });
    }
    hud.boost.parentElement.hidden = !player.riding || state.mode !== 'play';
    hud.boost.style.width = (turbo.charge * 100).toFixed(1) + '%';
    hud.boost.parentElement.classList.toggle('on', turbo.on);
    {
      const r = player.riding, slide = r && r.drifting && state.mode === 'play' ? Math.min(1, Math.abs(Math.sin(r.slip)) * 2.2) : 0;
      audio.skid(slide);
      // spray off the back wheel on the wet street
      if (slide > 0.2) emit(_v.set(r.pos.x - Math.sin(r.heading) * 0.45, r.pos.y + 0.08, r.pos.z - Math.cos(r.heading) * 0.45), Math.ceil(slide * 3),
        { color: 0xcfd8dc, speed: 1.6, up: 1.2, spread: 0.6, life: 0.45, dir: _v2.set(-Math.sin(r.vdir) * 0.6, 0.3, -Math.cos(r.vdir) * 0.6) });
    }
    hud.crosshair.hidden = !(gun.drawn && state.mode === 'play');
    hud.ammo.hidden = !(gun.drawn || brolly.up) || state.mode !== 'play';
    if (gun.drawn || brolly.up) { const t = brolly.up ? 'Umbrella' : gun.reloadT > 0 ? 'Reloading…' : `${gun.ammo} / ${gun.mag}`; if (hud.ammo.textContent !== t) hud.ammo.textContent = t; }
    if (punchBtn) { const t = gun.drawn ? 'Shoot' : 'Punch'; if (punchBtn.textContent !== t) punchBtn.textContent = t; }
    if (handBtn) { const t = gun.drawn ? 'Brolly' : brolly.up ? 'Hands' : 'Gun'; if (handBtn.textContent !== t) handBtn.textContent = t; }
    // the radio plays while you ride; R turns it off and on
    if (pressed.radio && player.riding && state.mode === 'play') {
      save.radio = !save.radio; persist();
      if (!save.radio) { toast('Radio off', 1.2); $('radio').hidden = true; }
    }
    audio.setRadio(state.mode === 'play' && !!player.riding && save.radio !== false);
    if (radioT > 0) { radioT -= dt; if (radioT <= 0 || !player.riding) { $('radio').hidden = true; radioT = 0; } }
  }
  pressed.jump = pressed.punch = pressed.use = pressed.radio = pressed.gun = pressed.trick = false;
  updateFx(dt);

  updateMates(dt);
  updateNpcs(dt);
  updateNightPeople(dt);
  updateGulls(dt);
  updateRain(dt);
  if (sw && sw.high) rain.visible = false;      // no rain streaks across the sky camera
  if (camera.position.y < world.terrain.height(camera.position.x, camera.position.z) - 0.5) rain.visible = false;   // underground: in Fløibanen's tunnels

  updateFuni(dt);

  // the sun's shadow box follows the player
  const focus = state.mode === 'title' ? L2V(3, H.FU, 0) : (state.mode === 'cut' ? L2V(3, H.FL, 6) : player.pos);
  sun.position.copy(focus).addScaledVector(sunOffset, 100);
  sun.target.position.copy(focus);

  // a scripted camera and actors (used to record the trailer)
  if (window.__director) window.__director(dt, time);
  // the sun's shadow map is re-rendered every other frame (the world is static; only people move)
  frameNo++;
  renderer.shadowMap.needsUpdate = frameNo % 2 === 0 || frameNo < 4;
  if (frameNo % 120 === 1) updateEnv();
  // a near plane of 8 cm is only needed indoors, where the camera works close to the walls; out in
  // town 14 cm (the camera keeps 18 cm off walls) gives the depth buffer nearly twice the precision far away
  {
    const near = isIndoors(camera.position) || isIndoors(player.pos) ? 0.08 : 0.14;
    if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
  }
  city.water.material.normalMap.offset.set(time * 0.004, time * 0.0025);
  renderer.render(scene, camera);

  // adaptive resolution
  frameAvg = lerp(frameAvg, dt * 1000, 0.05);
  adaptT += dt;
  if (adaptT > 2 && !params.get('q')) {
    adaptT = 0;
    if (frameAvg > 24 && pixelRatio > 0.6) { pixelRatio = Math.max(0.6, pixelRatio - 0.2); renderer.setPixelRatio(pixelRatio); resize(); }
    else if (frameAvg < 14 && pixelRatio < maxRatio) { pixelRatio = Math.min(maxRatio, pixelRatio + 0.1); renderer.setPixelRatio(pixelRatio); resize(); }
  }
}
placePlayer(SPAWN.home);
if (active !== 'havard') { const id = active; active = 'havard'; swapTo(id); }
requestAnimationFrame(frame);
$('play').disabled = false;
$('play').textContent = save.mission > 0 ? (save.mission >= MISSIONS.length ? 'Free roam' : 'Continue') : 'Play';

// debug hooks for testing
window.__gt = { landmarks, shopSigns, openMap, closeMap, setWaypoint, clearWaypoint, waypoint: () => waypoint, wpGps: () => wpGps, bm, gameTime: () => time, nightPassenger, tryPickup, quietHere, places, street, tram, dive, funiState, funiStop, funiCarHere, startSkydive, JUMP, gun, shoot, toggleGun, brolly, cycleHand, npcs, turbo, clock, dayState, nightPeople, lampLights, audio, switchTo, swapTo, mates: () => housemates, active: () => active, OUT_SPOTS, offer: () => offer, acceptOffer, declineOffer, makeOffer, scene, renderer, camera, player, cam, world, state, startMission, save, weather, scooters, gulls, mission: () => mission, startGame, raiseAlarm, ending, L2V, L2W, W2L, H, house, city, route, BAKERY, CHECKPOINTS: () => CHECKPOINTS, inHouse, housemates, PLACES, hitPlayer, dropBolle, bolle: () => ({ drop: bolleDrop, carrying: !!player.carrying }) };
