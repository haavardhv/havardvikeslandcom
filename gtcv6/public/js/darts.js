// Darts at Kong Oscar: 301 against one of the regulars, three darts a turn, finish on exactly
// nothing (straight out: no double needed), and go under and the turn is bust.
//
// The board hangs on the wall with the bull at 1.73 m and the oche 2.37 m out, as in the rules.
// The group's frame has its origin on the floor under the board, +y up and +z out into the room.
// You see the board from the oche; your aim sways a little, so you time the throw.
import * as THREE from '../vendor/three.module.min.js';
import { clamp, damp, gauss, pick, pointerOnWall, canvasTex } from './activity.js';

const BULL_Y = 1.73, OCHE = 2.37, RB = 0.225;
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const R_BULL = 0.00635, R_OUTER = 0.0159, R_T0 = 0.099, R_T1 = 0.107, R_D0 = 0.162, R_D1 = 0.170;
const START = 301;

export function scoreAt(x, y) {
  const r = Math.hypot(x, y);
  if (r < R_BULL) return { pts: 50, label: 'Bull' };
  if (r < R_OUTER) return { pts: 25, label: '25' };
  if (r > R_D1) return { pts: 0, label: 'Miss' };
  const deg = Math.atan2(y, x) * 180 / Math.PI;
  const i = Math.floor((((90 - deg + 9) % 360) + 360) % 360 / 18);
  const n = ORDER[i];
  if (r >= R_T0 && r <= R_T1) return { pts: n * 3, label: 'T' + n };
  if (r >= R_D0) return { pts: n * 2, label: 'D' + n };
  return { pts: n, label: String(n) };
}
function aimPoint(n, mult) {
  if (n === 25) return [0, 0];
  const i = ORDER.indexOf(n), a = (90 - i * 18) * Math.PI / 180;
  const r = mult === 3 ? (R_T0 + R_T1) / 2 : mult === 2 ? (R_D0 + R_D1) / 2 : 0.135;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
function boardTexture() {
  return canvasTex(1024, 1024, (g, w) => {
    const c = w / 2, k = c / RB;
    g.clearRect(0, 0, w, w);
    g.fillStyle = '#121212'; g.beginPath(); g.arc(c, c, RB * k, 0, 7); g.fill();
    const ring = (r0, r1, colA, colB) => {
      for (let i = 0; i < 20; i++) {
        const a0 = (-90 - 9 + i * 18) * Math.PI / 180, a1 = a0 + 18 * Math.PI / 180;
        g.fillStyle = i % 2 ? colB : colA;
        g.beginPath(); g.arc(c, c, r1 * k, a0, a1); g.arc(c, c, r0 * k, a1, a0, true); g.closePath(); g.fill();
      }
    };
    ring(R_OUTER, R_D1, '#1a1a1a', '#efe3c4');
    ring(R_D0, R_D1, '#c8232c', '#16784a');
    ring(R_T0, R_T1, '#c8232c', '#16784a');
    g.fillStyle = '#16784a'; g.beginPath(); g.arc(c, c, R_OUTER * k, 0, 7); g.fill();
    g.fillStyle = '#c8232c'; g.beginPath(); g.arc(c, c, R_BULL * k, 0, 7); g.fill();
    // the wire
    g.strokeStyle = 'rgba(205,210,215,0.85)'; g.lineWidth = 2;
    for (const r of [R_BULL, R_OUTER, R_T0, R_T1, R_D0, R_D1]) { g.beginPath(); g.arc(c, c, r * k, 0, 7); g.stroke(); }
    for (let i = 0; i < 20; i++) {
      const a = (-90 - 9 + i * 18) * Math.PI / 180;
      g.beginPath(); g.moveTo(c + Math.cos(a) * R_OUTER * k, c + Math.sin(a) * R_OUTER * k); g.lineTo(c + Math.cos(a) * R_D1 * k, c + Math.sin(a) * R_D1 * k); g.stroke();
    }
    // the numbers
    g.fillStyle = '#f4f1ea'; g.font = '700 46px "Archivo", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ORDER.forEach((n, i) => { const a = (-90 + i * 18) * Math.PI / 180, r = 0.197 * k; g.fillText(String(n), c + Math.cos(a) * r, c + Math.sin(a) * r); });
  });
}
function makeDart(col) {
  const d = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.3, metalness: 0.9 });
  const tung = new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 0.35, metalness: 0.85 });
  const fl = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, side: THREE.DoubleSide });
  const add = (geo, m, z) => { const x = new THREE.Mesh(geo, m); x.rotation.x = Math.PI / 2; x.position.z = z; d.add(x); return x; };
  add(new THREE.CylinderGeometry(0.0006, 0.0012, 0.03, 6), steel, 0.015);
  add(new THREE.CylinderGeometry(0.0034, 0.003, 0.045, 10), tung, 0.052);
  add(new THREE.CylinderGeometry(0.0016, 0.0016, 0.04, 6), steel, 0.094);
  for (const r of [0, Math.PI / 2]) {
    // each flight is a plane through the dart's axis
    const h = new THREE.Group(); h.rotation.z = r;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.026), fl);
    f.position.z = 0.118; f.rotation.y = Math.PI / 2;
    h.add(f); d.add(h);
  }
  return d;
}

const LINES = {
  oppHigh: ['Hundreåtti!', 'Sånn, ja.', 'Pent.'],
  oppLow: ['Ææh.', 'Pilene er skeive.', 'Det er lyset her inne.'],
  youHigh: ['Oi! Du har spilt før.', 'Pent kastet.'],
  youBust: ['Bust! Haha.', 'For mye, kompis.'],
  oppWin: ['Og der sitter den. Neste runde er din.', 'Tre-null-én, ferdig.'],
  oppLose: ['Grattis. Jeg tar revansj.', 'Ok, du vant. Ikke si det til noen.'],
};

export class DartsGame {
  constructor(env) {
    this.env = env;
    const g = this.g = new THREE.Group(); env.group.add(g);
    // the board in its black surround, on a dark cabinet back
    const board = new THREE.Mesh(new THREE.CircleGeometry(RB, 72), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.85, transparent: true }));
    board.position.set(0, BULL_Y, 0.035);
    g.add(board);
    this.boardMesh = board;
    // the aim
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.0075, 0.0105, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }));
    this.reticle.renderOrder = 5;
    g.add(this.reticle);
    this.darts = [];
    this.sides = [{ name: env.me.name, left: START, col: '#f2c12e', throws: [] }, { name: env.opp.name, left: START, col: '#e0712c', throws: [] }];
    this.turn = 0; this.dart = 0; this.turnStart = START;
    this.phase = 'aim';         // aim | fly | wait | ai | over
    this.t = 0; this.aim = new THREE.Vector2(0, 0.1); this.ptr = new THREE.Vector2(0, 0.1);
    this.fly = null;
    env.ui.open('Darts · Kong Oscar · 301');
    env.ui.hint(env.touch ? 'Drag to aim · let go to throw · your hand sways, so time it' : 'Aim with the mouse · click to throw · your hand sways, so time it');
    env.me.fig.root.visible = false;            // the camera is at your eyes
    const W = (x, z) => env.group.localToWorld(new THREE.Vector3(x, 0, z));
    env.opp.fig.root.position.copy(W(0.95, OCHE - 0.2));
    env.opp.fig.root.rotation.set(0, Math.atan2(...(() => { const v = W(0, 0).sub(env.opp.fig.root.position); return [v.x, v.z]; })()), 0);
    this.fovWas = env.camera.fov;
    this.score();
    env.ui.msg('301 · your darts first', 1.6);
  }
  score() {
    const s = this.sides;
    this.env.ui.setScore(s.map(x => ({ name: x.name, score: x.left, col: x.col, sub: x.throws.join(' · ') || '&nbsp;' })), this.phase === 'over' ? -1 : this.turn);
  }
  boardPoint(ndc) {
    const grp = this.env.group;
    const c = grp.localToWorld(new THREE.Vector3(0, BULL_Y, 0.035));
    const n = grp.localToWorld(new THREE.Vector3(0, BULL_Y, 1.035)).sub(c).normalize();
    const p = pointerOnWall(this.env.camera, ndc, c, n);
    if (!p) return null;
    const l = grp.worldToLocal(p);
    return new THREE.Vector2(l.x, l.y - BULL_Y);
  }
  pointer(kind, ndc) {
    if (this.turn !== 0 || this.phase !== 'aim') return;
    const p = this.boardPoint(ndc);
    if (p) { this.ptr.copy(p); if (this.env.touch) this.ptr.y += 0.04; this.ptr.x = clamp(this.ptr.x, -0.3, 0.3); this.ptr.y = clamp(this.ptr.y, -0.3, 0.3); }
    if (kind === 'up') this.throwAt(this.aim.x + gauss() * 0.005, this.aim.y + gauss() * 0.005);
  }
  key(code, down) { if (code === 'Space' && down && this.turn === 0 && this.phase === 'aim') this.throwAt(this.aim.x + gauss() * 0.005, this.aim.y + gauss() * 0.005); }
  throwAt(x, y) {
    const d = makeDart(this.turn === 0 ? 0xf2c12e : 0xe0712c);
    this.g.add(d);
    const tilt = [gauss() * 0.08, gauss() * 0.08];
    this.fly = { d, t: 0, from: new THREE.Vector3(this.turn === 0 ? 0.16 : 0.75, 1.5, OCHE - 0.35), to: new THREE.Vector3(x, BULL_Y + y, 0.035), x, y, tilt };
    this.darts.push(d);
    this.phase = 'fly';
    this.env.audio.whoosh();
  }
  land() {
    const { x, y } = this.fly;
    this.fly = null;
    const s = this.sides[this.turn], sc = Math.hypot(x, y) > RB ? { pts: 0, label: 'Off the board' } : scoreAt(x, y);
    this.env.audio.dartHit(Math.hypot(x, y) > RB);
    this.dart++;
    s.throws.push(sc.label === 'Off the board' ? '–' : sc.label);
    let ended = false;
    if (sc.pts > s.left) {
      s.left = this.turnStart; s.throws.push('Bust');
      this.env.ui.msg(`${sc.label} · Bust!`, 1.6);
      if (this.turn === 0) this.env.say(this.env.opp.fig, pick(LINES.youBust));
      ended = true;
    } else {
      s.left -= sc.pts;
      this.env.ui.msg(!sc.pts ? sc.label : sc.label === String(sc.pts) ? `<em>${sc.pts}</em>` : `${sc.label} · <em>${sc.pts}</em>`, 1.1);
      if (s.left === 0) {
        this.phase = 'over'; this.score();
        const win = this.turn === 0;
        this.env.say(this.env.opp.fig, pick(win ? LINES.oppLose : LINES.oppWin));
        this.env.finish({ win, text: win ? `Checked out on ${sc.label}.` : `${this.sides[1].name} checked out on ${sc.label}.`, kr: win ? 75 : 0, title: win ? 'You win' : `${this.sides[1].name} wins` });
        return;
      }
    }
    if (this.dart >= 3) ended = true;
    if (ended) {
      const tot = this.turnStart - s.left;
      if (this.turn === 1 && Math.random() < 0.5) this.env.say(this.env.opp.fig, pick(tot >= 60 ? LINES.oppHigh : LINES.oppLow));
      if (this.turn === 0 && tot >= 60 && Math.random() < 0.6) this.env.say(this.env.opp.fig, pick(LINES.youHigh));
      this.phase = 'wait'; this.t = 0;
    } else this.phase = this.turn === 0 ? 'aim' : 'ai';
    this.score();
  }
  nextTurn() {
    for (const d of this.darts) d.removeFromParent();
    this.darts = [];
    this.turn = 1 - this.turn; this.dart = 0;
    const s = this.sides[this.turn]; s.throws = []; this.turnStart = s.left;
    this.phase = this.turn === 0 ? 'aim' : 'ai'; this.t = 0;
    this.env.ui.hint(this.turn === 0 ? (this.env.touch ? 'Drag to aim · let go to throw' : 'Aim with the mouse · click to throw') : `${this.sides[1].name} is throwing…`);
    this.score();
  }
  // the regular's target for the next dart
  aiTarget() {
    const rem = this.sides[1].left;
    if (rem > 60) return aimPoint(20, 3);
    if (rem === 50) return [0, 0];
    if (rem <= 20) return aimPoint(rem, 1);
    if (rem <= 40 && rem % 2 === 0) return aimPoint(rem / 2, 2);
    if (rem % 3 === 0) return aimPoint(rem / 3, 3);
    return rem - 20 <= 20 ? aimPoint(rem - 20, 1) : aimPoint(20, 1);
  }
  update(dt) {
    const env = this.env;
    this.t += dt;
    const cam = env.camera;
    const fov = cam.aspect < 1 ? 34 : 19;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const eye = env.group.localToWorld(new THREE.Vector3(0.05, 1.63, OCHE + 0.15));
    cam.position.copy(eye);
    cam.lookAt(env.group.localToWorld(new THREE.Vector3(0, BULL_Y - 0.01, 0)));
    // the sway of your hand
    const T = this.t;
    const sx = Math.sin(T * 1.7) * 0.011 + Math.sin(T * 0.83 + 1) * 0.007, sy = Math.cos(T * 1.31) * 0.009 + Math.sin(T * 2.3 + 2) * 0.005;
    this.aim.set(this.ptr.x + sx, this.ptr.y + sy);
    this.reticle.visible = this.turn === 0 && this.phase === 'aim';
    this.reticle.position.set(this.aim.x, BULL_Y + this.aim.y, 0.05);
    if (this.phase === 'fly') {
      const f = this.fly;
      f.t = Math.min(1, f.t + dt / 0.26);
      const p = new THREE.Vector3().lerpVectors(f.from, f.to, f.t);
      p.y += Math.sin(f.t * Math.PI) * 0.09;
      f.d.position.copy(p);
      f.d.rotation.set(f.tilt[0] - (1 - f.t) * 0.25, f.tilt[1], f.t * 4);
      if (f.t >= 1) this.land();
    } else if (this.phase === 'ai' && this.t > 0.9) {
      this.t = 0;
      const [ax, ay] = this.aiTarget();
      this.throwAt(ax + gauss() * 0.024, ay + gauss() * 0.024);
    } else if (this.phase === 'wait' && this.t > 1.3) this.nextTurn();
    env.opp.fig.animate(dt, 0, 'idle');
  }
  dispose() {
    this.g.removeFromParent();
    this.env.me.fig.root.visible = true;
  }
}
