// Shared pieces for the games you can play around town (Svarteper at home, pool, darts and
// shuffleboard at Kong Oscar, boccia outside Danckert Krohns Hus): the overlay with the score,
// the hint line and the power meter, a pointer that lands on a table, and a few small helpers.
//
// Each game is a class built with an `env` from game.js and driven by it while you play:
//   update(dt)                    every frame; it also places the camera
//   pointer(kind, ndc, ev)        'down' | 'move' | 'up', ndc = normalised device coordinates
//   key(code, down)               keys other than Esc (Esc always leaves)
//   dispose()                     clean up meshes and DOM
// and calls env.finish({ win, text, kr }) when the game is over.
import * as THREE from '../vendor/three.module.min.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export function gauss() { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
export const pick = a => a[Math.floor(Math.random() * a.length)];
// a power meter that rises and falls while you hold: 0..1..0 over one period
export const pingPong = (t, period) => { const k = (t / period) % 2; return k < 1 ? k : 2 - k; };

// ---------------------------------------------------------------- the overlay
export class ActUI {
  constructor() {
    const el = document.createElement('div');
    el.id = 'act'; el.hidden = true;
    el.innerHTML = `
      <div class="act-top"><b class="act-title"></b><div class="act-score"></div></div>
      <div class="act-msg" hidden></div>
      <div class="act-layer"></div>
      <div class="act-bottom"><div class="act-meter" hidden><i></i></div><p class="act-hint"></p></div>
      <button type="button" class="act-leave">Leave <kbd>Esc</kbd></button>`;
    document.body.appendChild(el);
    this.el = el;
    this.title = el.querySelector('.act-title');
    this.score = el.querySelector('.act-score');
    this.msgEl = el.querySelector('.act-msg');
    this.layer = el.querySelector('.act-layer');
    this.hintEl = el.querySelector('.act-hint');
    this.meterEl = el.querySelector('.act-meter');
    this.leave = el.querySelector('.act-leave');
    this.msgT = 0;
  }
  open(title) { this.clearResult(); this.el.hidden = false; this.title.textContent = title; this.layer.innerHTML = ''; this.hint(''); this.meter(null); this.msgEl.hidden = true; this.score.innerHTML = ''; this.el.className = ''; }
  close() { this.clearResult(); this.el.hidden = true; this.layer.innerHTML = ''; }
  // sides: [{ name, score, col, sub }], turn: index of the side to play
  setScore(sides, turn = -1) {
    const html = sides.map((s, i) => `<div class="act-side${i === turn ? ' on' : ''}" style="--c:${s.col || '#f2c12e'}"><span>${s.name}</span><b>${s.score}</b>${s.sub ? `<em>${s.sub}</em>` : ''}</div>`).join('');
    if (this.score.innerHTML !== html) this.score.innerHTML = html;
  }
  msg(text, sec = 1.8) { this.msgEl.innerHTML = text; this.msgEl.hidden = false; this.msgT = sec; this.msgEl.style.animation = 'none'; void this.msgEl.offsetWidth; this.msgEl.style.animation = ''; }
  hint(html) { if (this.hintEl.innerHTML !== html) this.hintEl.innerHTML = html; }
  meter(p) {
    this.meterEl.hidden = p === null;
    if (p !== null) this.meterEl.firstElementChild.style.width = (clamp(p, 0, 1) * 100).toFixed(1) + '%';
  }
  update(dt) { if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msgEl.hidden = true; } }
  // the end of a game: who won, the money, and play again or leave
  result({ title, text, kr = 0, win }, onAgain, onLeave) {
    this.clearResult();
    const r = document.createElement('div');
    r.className = 'act-result' + (win ? ' win' : ' lose');
    r.innerHTML = `<b>${title}</b><p>${text || ''}</p>${kr ? `<em>+${kr} kr</em>` : ''}<div><button type="button" data-a="again">Play again</button><button type="button" data-a="leave" class="ghost">Leave</button></div>`;
    r.querySelector('[data-a="again"]').addEventListener('click', onAgain);
    r.querySelector('[data-a="leave"]').addEventListener('click', onLeave);
    this.el.appendChild(r);
    this.resultEl = r;
  }
  clearResult() { if (this.resultEl) { this.resultEl.remove(); this.resultEl = null; } }
}

// ---------------------------------------------------------------- pointer on a table
// The point where the pointer's ray meets the horizontal plane at world height y, in the local
// frame of `group` (which is only turned about the vertical axis).
const _rc = new THREE.Raycaster(), _pl = new THREE.Plane(), _hit = new THREE.Vector3(), _n2 = new THREE.Vector2();
export function pointerOnPlane(camera, ndc, y, group, out = new THREE.Vector3()) {
  _rc.setFromCamera(_n2.set(ndc.x, ndc.y), camera);
  _pl.set(new THREE.Vector3(0, 1, 0), -y);
  if (!_rc.ray.intersectPlane(_pl, _hit)) return null;
  return group.worldToLocal(out.copy(_hit));
}
// the point where the pointer's ray meets a vertical plane (a wall) given in world space
export function pointerOnWall(camera, ndc, point, normal, out = new THREE.Vector3()) {
  _rc.setFromCamera(_n2.set(ndc.x, ndc.y), camera);
  _pl.setFromNormalAndCoplanarPoint(normal, point);
  return _rc.ray.intersectPlane(_pl, out);
}
// put the camera at local point `from` looking at local point `at`, both in `group`'s frame
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
export function lookFrom(camera, group, from, at) {
  camera.position.copy(group.localToWorld(_a.copy(from)));
  camera.lookAt(group.localToWorld(_b.copy(at)));
}

// ---------------------------------------------------------------- 2D circles on a table
// Elastic collision between two discs a and b ({ x, z, vx, vz, r, m }), restitution e.
// Returns the closing speed, or 0 if they don't touch.
export function collideDiscs(a, b, e) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), R = a.r + b.r;
  if (d >= R || d < 1e-9) return 0;
  const nx = dx / d, nz = dz / d;
  const ma = a.m || 1, mb = b.m || 1;
  // separate, in proportion to the other's mass
  const ov = R - d;
  a.x -= nx * ov * mb / (ma + mb); a.z -= nz * ov * mb / (ma + mb);
  b.x += nx * ov * ma / (ma + mb); b.z += nz * ov * ma / (ma + mb);
  const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  if (rel <= 0) return 0;
  const j = (1 + e) * rel / (1 / ma + 1 / mb);
  a.vx -= j / ma * nx; a.vz -= j / ma * nz;
  b.vx += j / mb * nx; b.vz += j / mb * nz;
  return rel;
}
// Roll a ball mesh by the distance it moved (dx, dz) over the table, radius r
const _ax = new THREE.Vector3(), _q = new THREE.Quaternion();
export function rollMesh(mesh, dx, dz, r) {
  const d = Math.hypot(dx, dz);
  if (d < 1e-7) return;
  _ax.set(dz / d, 0, -dx / d);
  _q.setFromAxisAngle(_ax, d / r);
  mesh.quaternion.premultiply(_q);
}
// a canvas texture
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
// a soft round shadow under balls and pucks
let _shadowTex = null;
export function blobShadow(size) {
  if (!_shadowTex) _shadowTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: _shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}
