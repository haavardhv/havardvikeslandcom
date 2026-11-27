// Grand Theft Cappes Vei 6 — main loop, player, camera, seagulls, missions, HUD.
import * as THREE from '../vendor/three.module.min.js';
import { buildTextures, textTexture } from './textures.js';
import { loadMapData, buildCity } from './city.js';
import { buildHouse6 } from './house6.js';
import { Physics } from './physics.js';
import { Humanoid, Gull, makeScooter, makeItem, makeMarker, makeArrow, PEOPLE } from './actors.js';
import { Audio } from './audio.js';

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
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(2000, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 top, horizon, sunDir; uniform float cloud, time; varying vec3 vDir;
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
        vec2 uv = d.xz / (d.y + .12) * 1.4 + vec2(time*.012, time*.005);
        float n = fbm(uv);
        float c = smoothstep(.62 - cloud*.45, .95 - cloud*.2, n);
        vec3 cc = mix(vec3(.96,.96,.97), vec3(.52,.56,.6), cloud);
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

const weather = { rain: 0.85, target: 0.85, t: 50, forced: null };
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
let envRT = null, envRain = -1;
function updateEnv() {
  if (Math.abs(weather.rain - envRain) < 0.06 && envRT) return;
  envRain = weather.rain;
  const old = envRT;
  envRT = pmrem.fromScene(envScene, 0, 1, 2500);
  scene.environment = envRT.texture;
  if (old) old.dispose();
}
scene.environmentIntensity = 0.75;

// ------------------------------------------------------------------ world
const T = buildTextures();
const map = await loadMapData();
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
  // the rendered terrain is lowered around the house so it never shows inside it
  carve: (x, z) => { const [u, v] = W2L(x, z); return (u > -2.6 && u < 10.6 && v > -2.6 && v < 8.4) ? H.FL - 0.5 : null; },
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
for (const [x, y, z] of house.lights.slice(0, 3)) {
  const l = new THREE.PointLight(0xffd6a0, 5, 9, 1.6);
  l.position.copy(L2V(x, y, z));
  scene.add(l);
}
const inHouse = p => { const [u, v] = W2L(p.x, p.z); return house.inside(u, p.y, v); };
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
const rainU = { time: { value: 0 }, cam: { value: new THREE.Vector3() }, house: { value: new THREE.Vector4(OX, OZ, HUX, HUZ) }, houseTop: { value: H.FU + 6 }, color: { value: new THREE.Color(0xb8c6d2) } };
const rain = new THREE.LineSegments(rainGeo, new THREE.ShaderMaterial({
  uniforms: rainU, transparent: true, depthWrite: false, fog: false,
  vertexShader: `
    attribute vec4 seed; uniform float time; uniform vec3 cam; uniform vec4 house; uniform float houseTop;
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

// ------------------------------------------------------------------ save
const SAVE_KEY = 'gtcv6-save-v1';
const save = { mission: 0, money: 0, umbrellas: [], done: false };
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
  const inside = inHouse(p);
  const want = player.riding ? 5.6 : inside ? 2.5 : 4.6;
  cam.dist = damp(cam.dist, want, 3, dt);
  const baseFov = camera.aspect < 0.8 ? 78 : 64;
  const fov = damp(camera.fov, inside ? baseFov + 14 : baseFov, 3, dt);
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // follow the scooter's heading unless the player is steering the camera
  if (player.riding && performance.now() - cam.lastLook > 900) {
    cam.yaw = cam.yaw + angDiff(cam.yaw, player.riding.heading + Math.PI) * Math.min(1, dt * 2.5);
    cam.pitch = damp(cam.pitch, 0.28, 2, dt);
  }
  const pivot = _v.set(p.x, p.y + (player.knockT > 0 ? 0.6 : 1.55), p.z);
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
const pressed = { jump: false, punch: false, use: false };
const touch = { mx: 0, my: 0, run: false, stickId: null, lookId: null, sx: 0, sy: 0, lx: 0, ly: 0 };
let locked = false;
addEventListener('keydown', e => {
  if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
  keys[e.code] = true;
  if (state.mode === 'play' || state.mode === 'cut') {
    if (e.code === 'Space') { pressed.jump = true; e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'Enter') pressed.use = true;
    if (e.code === 'KeyF') pressed.punch = true;
  }
  if (e.code === 'KeyM') toggleSound();
  if (e.code === 'Escape' && state.mode === 'pause' && !locked) resumeGame();
  else if ((e.code === 'Escape' || e.code === 'KeyP') && state.mode === 'play') pauseGame();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('mousedown', e => {
  if (isTouch) return;
  if (state.mode === 'play') {
    if (!locked) { requestLock(); return; }
    if (e.button === 0) pressed.punch = true;
  }
});
addEventListener('mousemove', e => {
  if (!locked || state.mode !== 'play') return;
  cam.yaw -= e.movementX * 0.0024;
  cam.pitch = clamp(cam.pitch + e.movementY * 0.002, -0.45, 1.25);
  cam.lastLook = performance.now();
});
function requestLock() {
  if (isTouch) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ }
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && state.mode === 'play') pauseGame();
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
    if (k === 'run') { touch.run = !touch.run; b.classList.toggle('on', touch.run); }
    else pressed[k] = true;
  }, { passive: false });
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
  return { x, y, run: keys.ShiftLeft || keys.ShiftRight || touch.run };
}

// ------------------------------------------------------------------ HUD
const hud = {
  money: $('money'), alarm: $('alarm'), health: $('health').firstElementChild, timer: $('timer'),
  objective: $('objective'), prompt: $('prompt'), phone: $('phone'), toast: $('toast'), banner: $('banner'),
  umbrellas: $('umbrellas'), street: $('street'),
};
const gullSvg = '<svg viewBox="0 0 32 18" aria-hidden="true"><path d="M1 6c5-3 10-2 15 4 5-6 10-7 15-4-4 0-9 3-11 8l-4 1-4-1C10 9 5 6 1 6z"/></svg>';
hud.alarm.innerHTML = gullSvg.repeat(5);
let shownMoney = save.money;
const timers = {};
function later(name, sec, fn) { timers[name] = { t: sec, fn }; }
function showPhone(from, text, sec = 6) {
  hud.phone.hidden = false;
  hud.phone.firstElementChild.textContent = from;
  hud.phone.lastElementChild.textContent = text;
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
function setObjective(html) { hud.objective.innerHTML = html || ''; }
const hurtEl = document.createElement('div');
hurtEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;box-shadow:inset 0 0 120px 30px rgba(200,20,10,.65);opacity:0;transition:opacity .25s';
document.body.appendChild(hurtEl);
function updateHud(dt) {
  shownMoney = Math.abs(save.money - shownMoney) < 1 ? save.money : damp(shownMoney, save.money, 6, dt);
  hud.money.textContent = 'kr ' + Math.round(shownMoney).toLocaleString('nb-NO');
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
  hurtEl.style.opacity = player.hurtT > 0 ? Math.min(1, player.hurtT * 2.5) : 0;
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
    for (let i = 0; i < b.p.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(b.p[i]), tz(b.p[i + 1]));
    g.closePath(); g.fill(); g.stroke();
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
function drawMinimap(blips) {
  const S = mm.width, c = S / 2, scale = 2.6 * (S / 360) / MAP.ppm * 1.0;
  const p = player.pos;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const rot = -Math.PI / 2 - Math.atan2(fz, fx);
  mg.save();
  mg.fillStyle = '#22404d'; mg.fillRect(0, 0, S, S);
  mg.translate(c, c); mg.rotate(rot); mg.scale(scale, scale);
  mg.drawImage(mapBase, -(p.x - MAP.x0) * MAP.ppm, -(p.z - MAP.z0) * MAP.ppm);
  if (gps && gps.length > 1) {
    mg.strokeStyle = '#f2c12e'; mg.lineWidth = 5 / scale * 1.4; mg.lineCap = 'round'; mg.lineJoin = 'round';
    mg.globalAlpha = 0.9;
    mg.beginPath();
    gps.forEach(([x, z], i) => (i ? mg.lineTo : mg.moveTo).call(mg, (x - p.x) * MAP.ppm, (z - p.z) * MAP.ppm));
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
    mg.beginPath(); mg.arc(x, y, b.r || 7, 0, 7); mg.fill(); mg.stroke();
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

// ------------------------------------------------------------------ doors
function updateDoors(dt) {
  for (const d of house.doors) {
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
function bubble(text) {
  if (!bubbleTex.has(text)) {
    const w = Math.max(384, Math.min(1100, text.length * 34 + 80));
    bubbleTex.set(text, textTexture([text], { w, h: 128, bg: '#f4f1ea', fg: '#101418', font: '800 54px "Archivo", sans-serif', radius: 40 }));
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex.get(text), depthTest: false, fog: false }));
  s.scale.set(1.2, 0.4, 1);
  s.renderOrder = 10;
  return s;
}

// ------------------------------------------------------------------ pedestrians
const LINES = ['Hei!', 'Uff!', 'Pass deg!', 'Typisk.', 'Neimen!', 'Au!', 'Hallo?!', 'Rolig!', 'Æ e fra Bergen!'];
const npcs = [];
const NPC_N = isTouch ? 6 : 10;
const jackets = [0x2c4c7a, 0x6b2d3a, 0x3f6b4a, 0x22252b, 0xb14b2e, 0x8a8f96, 0x2f5d3a, 0xd9b75a, 0x4a3f6b, 0x1d1d1d];
const umbrellaCols = [0xd23a2b, 0x2b2f36, 0xf2c12e, 0x3a6ea8, null, 0x7a2e8a, 0xe8e2d2, 0x101418, null, 0x2bb673];
function placeNpc(n, near) {
  // a street node 25-90 m from the player, out of sight if possible
  for (let k = 0; k < 40; k++) {
    const i = Math.floor(Math.random() * gAdj.length);
    if (!gAdj[i].length) continue;
    const d = Math.hypot(gx(i) - near.x, gz(i) - near.z);
    if (d < 25 || d > 90) continue;
    n.a = i; n.b = gAdj[i][Math.floor(Math.random() * gAdj[i].length)]; n.t = Math.random();
    n.pos.set(lerp(gx(n.a), gx(n.b), n.t), 0, lerp(gz(n.a), gz(n.b), n.t));
    n.pos.y = world.floorAt(n.pos.x, n.pos.z, 300);
    n.off = (Math.random() - 0.5) * 1.6;
    return true;
  }
  return false;
}
for (let k = 0; k < NPC_N; k++) {
  const fig = new Humanoid({ jacket: jackets[k % jackets.length], pants: [0x2b3140, 0x3b3b3b, 0x4a3a2c][k % 3], hat: Math.random() < 0.5 ? null : [0x2c4c7a, 0x7a2e28, 0x3b3b3b][k % 3], hair: [0x3a2618, 0xc9a26b, 0x1d1d1d, 0x8a8a8a][k % 4], umbrella: umbrellaCols[k % umbrellaCols.length] });
  scene.add(fig.root);
  const n = { fig, a: 0, b: 0, t: 0, pos: new THREE.Vector3(), heading: 0, downT: 0, speed: 1.1 + Math.random() * 0.4, bubble: null, bubbleT: 0, fall: 0, off: 0 };
  npcs.push(n);
}
// ---- the people who live at Cappes vei 6
const HOME_SPOTS = {
  // person: [u, floor, v, local heading, pose]
  oystein: [1.55, 'FU', 6.3, -Math.PI / 2, 'idle'],      // in the kitchen
  theodor: [5.5, 'FU', 4.98, 0, 'sit'],                   // on the sofa
  jaakko: [5.0, 'FL', 4.1, Math.PI / 2, 'idle'],          // downstairs
  martin: [6.2, 'FL', 10.7, Math.PI, 'idle'],             // on the terrace
};
const HOME_LINES = {
  oystein: ['Har du sett laderen min?', 'Det regner. Igjen.', 'Middag snart?', 'Hvem tok siste bolle?'],
  theodor: ['Otters hold hands when they sleep.', 'Jeg har ikke tid, jeg spiller.', 'Kan du skru ned?', 'Rolig, rolig.'],
  jaakko: ['Moi moi!', 'Skitur i morgen?', 'Swix, ikke Madshus.', 'Guangdong House i kveld?'],
  martin: ['Fin utsikt, ikke sant?', 'Måkene ser på oss.', 'Hvem har vasket badet?', 'Kaffe?'],
};
const housemates = {};
for (const id of ['oystein', 'theodor', 'jaakko', 'martin']) {
  const fig = new Humanoid({ person: id });
  scene.add(fig.root);
  const [u, f, v, h, pose] = HOME_SPOTS[id];
  const n = { fig, id, pos: L2V(u, H[f], v), heading: h + H.theta, party: pose, downT: 0, fall: 0, placed: true, talkT: 0, mate: true };
  fig.root.position.copy(n.pos); fig.root.rotation.y = n.heading;
  // name tag
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture([PEOPLE[id].name], { w: 256, h: 64, bg: 'rgba(16,20,24,0.7)', fg: '#f2c12e', font: '800 40px "Archivo", sans-serif', radius: 30 }), depthTest: true, fog: false }));
  tag.scale.set(0.8, 0.2, 1); tag.position.y = 2.25;
  fig.root.add(tag);
  npcs.push(n);
  housemates[id] = n;
}
function knockNpc(n, from) {
  if (n.downT > 0) return;
  n.downT = 3;
  n.fallDir = Math.atan2(n.pos.x - from.x, n.pos.z - from.z);
  say(n, LINES[Math.floor(Math.random() * LINES.length)]);
  audio.bump();
}
function say(n, text) {
  if (n.bubble) n.fig.root.remove(n.bubble);
  n.bubble = bubble(text);
  n.bubble.position.y = n.mate ? 2.6 : 2.35;
  if (text.length > 9) n.bubble.scale.set(Math.min(3.2, text.length * 0.11), 0.4, 1);
  n.fig.root.add(n.bubble);
  n.bubbleT = 2.2;
}
function updateNpcs(dt) {
  const focus = state.mode === 'title' ? camera.position : player.pos;
  for (const n of npcs) {
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
    if (!n.placed || n.pos.distanceTo(focus) > 140) { n.placed = placeNpc(n, focus); n.fig.root.visible = n.placed; if (!n.placed) continue; }
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
      n.t += n.speed * dt / len;
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
      const speed = player.riding ? Math.abs(player.riding.speed) : Math.hypot(player.vel.x, player.vel.z);
      if (speed > 5) knockNpc(n, player.pos);
      else { player.pos.x += dx / d * (0.6 - d); player.pos.z += dz / d * (0.6 - d); }
    }
    n.fig.animate(dt, n.downT > 0 ? 0 : n.speed, 'walk');
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
const scInfo = {};
function updateScooter(s, dt, input) {
  const fwd = _v2.set(Math.sin(s.heading), 0, Math.cos(s.heading));
  const ridden = player.riding === s;
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
  if (ridden && grounded) {
    const thr = input.y;
    if (thr > 0) s.speed += thr * (s.speed < 0 ? 12 : 5.5) * dt;
    else if (thr < 0) s.speed += thr * (s.speed > 0.5 ? 11 : 3) * dt;
    const turn = 2.3 * clamp(Math.abs(s.speed) / 3, 0.25, 1) * (s.speed < 0 ? -1 : 1);
    s.heading -= input.x * turn * dt;
    s.lean = damp(s.lean, -input.x * clamp(s.speed / 10, 0, 1) * 0.35, 6, dt);
  } else s.lean = damp(s.lean, 0, 6, dt);
  if (grounded) {
    s.speed -= slope * 9.8 * 0.55 * dt;
    s.speed *= 1 - (ridden && input.y !== 0 ? 0.25 : 0.9) * dt;
    const maxS = onStairs ? 4.5 : 12.5;
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
  if (s.vy <= 0 && s.pos.y <= fl2 + 0.35 && (grounded || s.pos.y <= fl2)) { s.pos.y = fl2; if (s.vy < -6 && ridden) { audio.land(); cam.shake = 0.5; } s.vy = 0; }
  else { s.vy -= 20 * dt; s.pos.y += s.vy * dt; if (s.pos.y < fl2) { s.pos.y = fl2; s.vy = 0; } }
  s.tilt = damp(s.tilt, -Math.atan(slope), 10, dt);
  s.obj.position.copy(s.pos);
  s.obj.rotation.set(s.tilt, s.heading, s.lean, 'YXZ');
  return crashed;
}

// ------------------------------------------------------------------ seagulls
const gulls = [];
const GULL_N = 12;
// on the quay at Fisketorget
const groundSpots = [[-452, -222], [-449, -230], [-455, -214], [-446, -238], [-562, -421], [-577, -436], [-541, -400]].map(([x, z]) => [x, world.floorAt(x, z, 50), z]);
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
  const indoors = inHouse(p);
  const head = _v2.set(p.x, p.y + 1.4, p.z);
  // how many attackers the alarm calls for
  const want = state.alarm > 0 ? Math.min(GULL_N - 2, state.alarm * 2) : 0;
  let have = gulls.filter(a => ['orbit', 'dive', 'climb'].includes(a.state)).length;
  if (have < want) {
    const cands = gulls.filter(a => a.state === 'circle' || a.state === 'ground' || a.state === 'leave').sort((x, y) => x.pos.distanceToSquared(p) - y.pos.distanceToSquared(p));
    for (const a of cands.slice(0, want - have)) { a.state = 'orbit'; a.t = 1 + Math.random() * 2; a.ang = Math.random() * 6; }
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
        const hc = L2W(4, 4.2), cx = indoors ? hc[0] : p.x, cz = indoors ? hc[1] : p.z;
        desired.set(cx + Math.cos(a.ang) * r - a.pos.x, p.y + h + Math.sin(a.ang * 2) - a.pos.y, cz + Math.sin(a.ang) * r - a.pos.z).multiplyScalar(1.8);
        flap = 0.5;
        if (a.t <= 0 && !indoors && player.knockT <= 0 && state.mode === 'play') { a.state = 'dive'; a.t = 2.4; audio.squawk(); }
        break;
      }
      case 'dive': {
        const sp = 10 + state.alarm * 0.8;
        desired.copy(head).sub(a.pos).normalize().multiplyScalar(sp);
        flap = 0.15;
        if (a.pos.distanceTo(head) < 0.85 && !indoors) { hitPlayer(a); a.state = 'climb'; a.t = 1.4; }
        else if (a.t <= 0 || indoors) { a.state = 'climb'; a.t = 1.2; }
        break;
      }
      case 'climb': {
        desired.set(a.vel.x, 6, a.vel.z).normalize().multiplyScalar(9);
        flap = 1;
        if (a.t <= 0) { a.state = 'orbit'; a.t = 1.5 + Math.random() * 2.5 / Math.max(1, state.alarm * 0.6); }
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
    a.g.root.visible = a.pos.distanceToSquared(camera.position) < 170 * 170;
    a.g.animate(dt, flap, grounded);
  }
}
function hitPlayer(a) {
  if (state.mode !== 'play' || player.hurtT > 0.3) return;
  const dmg = 7 + state.alarm * 2;
  player.health = Math.max(0, player.health - dmg);
  player.hurtT = 0.6; player.regenT = 5;
  cam.shake = 0.7;
  audio.squawk(); audio.hurt();
  const away = new THREE.Vector3(player.pos.x - a.pos.x, 0, player.pos.z - a.pos.z).normalize();
  if (!player.riding) { player.vel.x += away.x * 4; player.vel.z += away.z * 4; player.vel.y = Math.max(player.vel.y, 3); player.onGround = false; }
  else player.riding.speed *= 0.6;
  if (player.carrying) dropBolle();
  if (player.health <= 0) die('TATT AV MÅKENE', 'Taken by the gulls. They took 100 kr too.');
}

// ------------------------------------------------------------------ alarm
function raiseAlarm(n = 1) {
  const before = state.alarm;
  state.alarm = clamp(state.alarm + n, 0, 5);
  state.alarmCool = 16;
  if (state.alarm > before) { state.alarmFlash = 2; if (before === 0) toast('Måkealarm! The gulls are coming for you.'); }
}
function updateAlarm(dt) {
  if (state.alarm < state.alarmMin) state.alarm = state.alarmMin;
  if (state.alarm > state.alarmMin) {
    state.alarmCool -= dt * (inHouse(player.pos) ? 2.5 : 1);
    if (state.alarmCool <= 0) { state.alarm--; state.alarmCool = 14; if (state.alarm === 0) toast('The gulls lost interest.'); }
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
};
save.places = save.places || [];
const PLACES = (map.places || []).map(pl => {
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
let lastSurfaceTag = null;
function surfaceAt() {
  const p = player.pos;
  if (inHouse(p)) {
    const [u, v] = W2L(p.x, p.z);
    if (p.y < H.FU - 1 && u < 2.6 && v > 4.6) return 'tile';
    return 'wood';
  }
  return 'stone';
}
function updatePlayer(dt) {
  const inp = state.mode === 'play' ? moveInput() : { x: 0, y: 0, run: false };
  player.punchCd -= dt;
  player.hurtT = Math.max(0, player.hurtT - dt);
  player.regenT -= dt;
  if (player.regenT <= 0 && player.health < 100) player.health = Math.min(100, player.health + 4 * dt);

  // use: get on / off scooters
  if (pressed.use && player.knockT <= 0) {
    if (player.riding) dismount();
    else {
      const s = nearestScooter(1.7);
      if (s) mount(s);
    }
  }
  if (pressed.punch) doPunch();

  if (player.riding) {
    const s = player.riding;
    const crashed = updateScooter(s, dt, inp);
    player.pos.copy(s.pos);
    player.heading = s.heading;
    player.vel.set(Math.sin(s.heading) * s.speed, s.vy, Math.cos(s.heading) * s.speed);
    if (crashed) {
      const sp = s.speed;
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
  if (mag > 0.1 && control) player.heading += angDiff(player.heading, Math.atan2(mx, mz)) * Math.min(1, dt * 12);
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
  s.speed = 0;
  player.vel.set(0, 0, 0);
  audio.start2();
  if (!s.stolen) { s.stolen = true; toast('Grand Theft Sparkesykkel'); save.money += 0; }
}
function dismount(crash = false) {
  const s = player.riding;
  if (!s) return;
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
      showPhone('Øystein', 'Hvor ER du? You have the only key and it’s pouring. Cappes vei 6, the black door. Now please.', 7);
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
        if (!m.allGot) { m.allGot = true; showPhone('Martin', 'Perfect. Bring it all down to me on the terrace: downstairs, the glass door at the end of the corridor.', 6); }
        setObjective('Carry it all to the <em>terrace</em> (downstairs, out the glass door).');
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
      showPhone('Martin', 'KRISE. No boller for the party. The bakery on Torget closes any minute. Grab a scooter. Go go go.', 8);
      m.step = 0; m.cp = 0;
      m.len = planCheckpoints();
      const s = scooters[0];
      s.pos.set(SC_HOME[0], 0, SC_HOME[1]); s.heading = Math.atan2(HUX, HUZ); s.speed = 0; s.pos.y = world.floorAt(SC_HOME[0], SC_HOME[1], 300);
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
      showPhone('Jaakko', 'Did you make it?? Get the LAST skillingsbolle. Every gull in Bergen is watching that counter.', 7);
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
    showPhone('Jaakko', 'Bolle is dessert. DINNER is Guangdong House, obviously. They close at 19:00. Go, go, go!', 8);
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
  if (next === 3) { later('next', 2.4, () => startMission(3, { spawn: false })); return; }
  later('next', 4, () => startMission(next, { spawn: false }));
}
function failMission(reason) {
  audio.fail();
  banner('Oppdrag feilet', reason, 'fail', 3.6);
  const idx = mission.idx;
  if (mission.def.cleanup) mission.def.cleanup(mission);
  mission = null;
  marker.visible = false;
  later('retry', 3.8, () => fadeThen(() => startMission(idx)));
}
function updateMission(dt) {
  if (!mission) { marker.visible = false; return; }
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
  state.mode = 'dead';
  audio.fail();
  banner(title, sub, 'fail', 3.5);
  save.money = Math.max(0, save.money - 100); persist();
  player.knockT = 99;
  later('respawn', 3, () => fadeThen(() => {
    player.health = 100; state.alarm = 0; player.knockT = 0;
    state.mode = 'play';
    if (mission) startMission(mission.idx); else respawn();
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
    // back to their usual spots
    for (const id in HOME_SPOTS) { const [u, f, v, h, pose] = HOME_SPOTS[id], n = housemates[id]; n.pos.copy(L2V(u, H[f], v)); n.heading = h + H.theta; n.party = pose; }
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
  const idx = save.mission || 0;
  if (idx >= MISSIONS.length) { placePlayer(SPAWN.home); freeRoam(); }
  else startMission(idx);
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
  $('pausetitle').textContent = mission ? mission.def.title : 'Cappes Vei 6';
  $('pausestats').textContent = `kr ${save.money.toLocaleString('nb-NO')} · umbrellas ${save.umbrellas.length}/${UMBRELLAS.length}`;
  $('restart').hidden = !mission;
  $('fact').innerHTML = '<b>Bergen fact</b>' + FACTS[factIdx++ % FACTS.length];
  if (audio.ctx) audio.ctx.suspend();
}
function resumeGame() {
  $('pause').hidden = true;
  state.mode = 'play';
  if (audio.ctx) audio.ctx.resume();
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
  fadeThen(() => startMission(0));
});

// ------------------------------------------------------------------ main loop
let last = performance.now(), time = 0, frameAvg = 16, adaptT = 0, gpsT = 0, frameNo = 0;
renderer.shadowMap.autoUpdate = false;
const funiState = { t: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  if (state.mode === 'pause') { pressed.jump = pressed.punch = pressed.use = false; renderer.render(scene, camera); return; }

  updateWeather(dt);
  skyU.time.value = time;
  sky.position.copy(camera.position);
  skyU.sunDir.value.copy(sunOffset);

  if (state.mode === 'title') {
    updateTitleCam(time);
  } else {
    if (state.mode === 'play' || state.mode === 'dead' || state.mode === 'cut') {
      if (state.mode === 'play') updatePlayer(dt);
      else if (!window.__director) player.fig.animate(dt, 0, state.mode === 'dead' ? 'down' : 'walk');
      for (const s of scooters) if (s !== player.riding) updateScooter(s, dt, { x: 0, y: 0 });
      updateDoors(dt);
      updateAlarm(dt);
      if (state.mode === 'play') updateMission(dt);
      updateUmbrellas(dt, time);
      updatePlaces(dt, time);
      if (state.mode === 'cut') updateCut(dt); else updateCamera(dt);
    }
    updateHud(dt);
    const blips = [];
    if (mission && mission.target) blips.push({ x: mission.target.x, z: mission.target.z, c: '#f2c12e', edge: true, r: 8 });
    if (mission && mission.blips) blips.push(...mission.blips);
    if (!mission || mission.def.id === 'scooter') for (const s of scooters) if (s !== player.riding) blips.push({ x: s.pos.x, z: s.pos.z, c: '#2bb673', r: 5 });
    for (const a of gulls) if (['orbit', 'dive', 'climb', 'carry'].includes(a.state)) blips.push({ x: a.pos.x, z: a.pos.z, c: a.state === 'carry' ? '#f2c12e' : '#d2301f', r: 4 });
    { const [hx, hz] = L2W(4, 4.2); blips.push({ x: hx, z: hz, c: '#f4f1ea', r: 6, edge: true }); }
    for (const pl of PLACES) blips.push({ x: pl.x, z: pl.z, c: pl.st.bg, r: 7, label: pl.n, edge: pl.k === 'food' });
    // GPS route to the current target, recomputed now and then
    gpsT -= dt;
    if (gpsT <= 0) {
      gpsT = 1.2;
      const tgt = mission && mission.target;
      gps = tgt && !inHouse(player.pos) && Math.hypot(tgt.x - player.pos.x, tgt.z - player.pos.z) > 15 ? route(player.pos.x, player.pos.z, tgt.x, tgt.z) : null;
      if (gps) gps.unshift([player.pos.x, player.pos.z]);
      const sn = inHouse(player.pos) ? 'Cappes vei 6' : streetName(player.pos.x, player.pos.z);
      if (sn !== hud.street.textContent) hud.street.textContent = sn || '';
    }
    drawMinimap(blips);
    // prompt
    let prompt = '';
    if (state.mode === 'play' && !player.riding) { const s = nearestScooter(1.7); if (s) prompt = `<kbd>${isTouch ? 'E' : 'E'}</kbd>${s.stolen ? 'Ride e-scooter' : 'Steal e-scooter'}`; }
    else if (state.mode === 'play' && player.riding && Math.abs(player.riding.speed) < 1) prompt = '<kbd>E</kbd>Get off';
    hud.prompt.hidden = !prompt;
    if (prompt && hud.prompt.innerHTML !== prompt) hud.prompt.innerHTML = prompt;
    audio.update(weather.rain, inHouse(camera.position), player.riding ? Math.abs(player.riding.speed) : 0);
  }
  pressed.jump = pressed.punch = pressed.use = false;

  updateNpcs(dt);
  updateGulls(dt);
  updateRain(dt);

  // funicular cars shuttle up and down, passing halfway
  funiState.t += dt / 70;
  const ft = (Math.sin(funiState.t * Math.PI * 2) + 1) / 2;
  city.cars.forEach((car, i) => {
    const u = clamp(i === 0 ? ft : 1 - ft, 0, 0.995);
    const p = city.funiCurve.getPointAt(u);
    const p2 = city.funiCurve.getPointAt(u + 0.005);
    car.position.copy(p);
    car.lookAt(p2.x, p.y, p2.z);
  });

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
requestAnimationFrame(frame);
$('play').disabled = false;
$('play').textContent = save.mission > 0 ? (save.mission >= MISSIONS.length ? 'Free roam' : 'Continue') : 'Play';

// debug hooks for testing
window.__gt = { scene, renderer, camera, player, cam, world, state, startMission, save, weather, scooters, gulls, mission: () => mission, startGame, raiseAlarm, ending, L2V, L2W, W2L, H, house, city, route, BAKERY, CHECKPOINTS: () => CHECKPOINTS, inHouse, housemates, PLACES, hitPlayer, dropBolle, bolle: () => ({ drop: bolleDrop, carrying: !!player.carrying }) };
