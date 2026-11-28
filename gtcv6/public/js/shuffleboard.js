// Table shuffleboard at Kong Oscar, as in every Norwegian pub: a 12 ft table of polished wood,
// four weights each, slid one at a time from your end to the scoring zones at the far end.
// 1, 2 or 3 points by zone, 4 for a hanger over the edge; a weight that doesn't pass the foul
// line is taken off, and one that goes over the end or the side falls in the gutter. After all
// eight, whoever is furthest down scores each of theirs that lies beyond the other's best.
// First to 15.
//
// The table's frame: origin on the floor under the middle of your end, +x down the table, z
// across it, heights above the floor.
import * as THREE from '../vendor/three.module.min.js';
import { clamp, damp, gauss, pick, pingPong, pointerOnPlane, lookFrom, collideDiscs, canvasTex, blobShadow } from './activity.js';

export const SB = { L: 3.66, W: 0.51, H: 0.78, R: 0.029, FOUL: 1.0, Z2: 0.45, Z3: 0.15 };
const { L, W, H, R } = SB;
const X0 = 0.14, DECEL = 0.42, TARGET = 15;

// the playing surface, with the lines and numbers painted on (u along the table)
export function shuffleSurfaceTexture() {
  return canvasTex(2048, 288, (g, w, h) => {
    const k = w / L;
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#c08a4f'); gr.addColorStop(0.5, '#d9a466'); gr.addColorStop(1, '#c08a4f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // maple strips
    for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? 'rgba(90,50,20,0.06)' : 'rgba(255,240,210,0.05)'; g.fillRect(0, i * h / 9, w, h / 9); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(80,45,15,${0.03 + Math.random() * 0.04})`; g.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 200, 1); }
    g.strokeStyle = '#2b2b2b'; g.lineWidth = 5;
    const line = x => { g.beginPath(); g.moveTo(x * k, 0); g.lineTo(x * k, h); g.stroke(); };
    for (const d of [SB.FOUL, SB.Z2, SB.Z3]) line(L - d);
    line(SB.FOUL);                                      // the foul line at your end
    g.fillStyle = '#2b2b2b'; g.font = '800 120px "Archivo", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    // numbers read from your end: their tops point down the table
    const num = (n, x) => { g.save(); g.translate(x * k, h / 2); g.rotate(Math.PI / 2); g.fillText(String(n), 0, 6); g.restore(); };
    num(1, L - (SB.FOUL + SB.Z2) / 2); num(2, L - (SB.Z2 + SB.Z3) / 2); num(3, L - SB.Z3 / 2);
    g.font = '800 54px "Archivo", sans-serif';
    g.save(); g.translate((SB.FOUL + 0.35) * k, h / 2); g.rotate(Math.PI / 2); g.fillText('KONG OSCAR', 0, 0); g.restore();
  });
}
const zonePts = x => x + R > L ? 4 : x >= L - SB.Z3 ? 3 : x >= L - SB.Z2 ? 2 : x >= L - SB.FOUL ? 1 : 0;

const LINES = {
  oppGood: ['Treer!', 'Se der, ja.', 'Den satt som støpt.'],
  oppKnock: ['Ut med deg!', 'Beklager. Ikke egentlig.'],
  oppMiss: ['For hardt.', 'Neimen.', 'Bordet er vokset for mye.'],
  youGood: ['Hm. Ikke verst.', 'Den var fin.'],
  oppWin: ['Femten. Takk for spillet.', 'Ny runde? Du spanderer.'],
  oppLose: ['Du er god på dette. Mistenkelig god.', 'Grattis, grattis.'],
};

export class ShuffleGame {
  constructor(env) {
    this.env = env;
    this.g = new THREE.Group(); env.group.add(this.g);
    this.pucks = [];
    const side = new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.25, metalness: 0.9 });
    this.mats = [0xc8232c, 0x1f4fb4].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.2 }));
    this.geo = new THREE.CylinderGeometry(R, R, 0.024, 28);
    this.side = side;
    // the aim line
    this.aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    this.g.add(this.aimLine);
    this.sides = [{ name: env.me.name, score: 0, col: '#d2301f', left: 4 }, { name: env.opp.name, score: 0, col: '#3a6ea8', left: 4 }];
    this.round = 0; this.starter = 0;
    this.lateral = 0; this.angle = 0; this.pressZ = 0; this.power = 0; this.chargeT = 0;
    this.cam = { x: -0.8, look: 2.2, h: 1.5 };
    this.keys = {};
    this.ptrZ = 0;
    env.ui.open('Shuffleboard · Kong Oscar · first to 15');
    this.newRound();
    const Wd = (x, z) => env.group.localToWorld(new THREE.Vector3(x, 0, z));
    env.opp.fig.root.position.copy(Wd(-0.3, 0.75));
    env.opp.fig.root.rotation.set(0, env.opp.fig.root.rotation.y, 0);
    this.face(env.opp.fig, 1.2, 0);
    env.me.fig.root.position.copy(Wd(-0.45, -0.05));
    this.face(env.me.fig, 1.5, 0);
  }
  face(fig, x, z) { const v = this.env.group.localToWorld(new THREE.Vector3(x, 0, z)).sub(fig.root.position); fig.root.rotation.set(0, Math.atan2(v.x, v.z), 0); }
  newRound() {
    for (const p of this.pucks) p.mesh.removeFromParent();
    this.pucks = [];
    this.sides.forEach(s => { s.left = 4; });
    this.turn = this.starter; this.round++;
    this.thrown = 0;
    this.beginTurn();
    this.env.ui.msg(`Round ${this.round}`, 1.2);
  }
  score() {
    this.env.ui.setScore(this.sides.map(s => ({ name: s.name, score: s.score, col: s.col, sub: '●'.repeat(s.left) + '○'.repeat(4 - s.left) })), this.phase === 'over' ? -1 : this.turn);
  }
  beginTurn() {
    this.phase = this.turn === 0 ? 'aim' : 'ai';
    this.t = 0; this.angle = 0;
    if (this.turn === 0) this.env.ui.hint(this.env.touch ? 'Touch where to slide from · hold, drag sideways to angle, let go to throw' : 'Move the mouse to place the weight · hold and let go to throw (drag sideways to angle) · <kbd>A</kbd><kbd>D</kbd> move');
    else { this.env.ui.hint(`${this.sides[1].name} is throwing…`); this.ai = this.plan(); this.lateral = 0; }
    this.score();
  }
  pointer(kind, ndc) {
    if (this.turn !== 0) return;
    const p = pointerOnPlane(this.env.camera, ndc, this.env.group.getWorldPosition(new THREE.Vector3()).y + H, this.env.group);
    if (!p) return;
    this.ptrZ = p.z;
    if (this.phase === 'aim' && (kind === 'move' || kind === 'down')) this.lateral = clamp(p.z, -W / 2 + R + 0.01, W / 2 - R - 0.01);
    if (kind === 'down' && this.phase === 'aim') { this.phase = 'charge'; this.chargeT = 0; this.pressZ = p.z; }
    if (this.phase === 'charge') this.angle = clamp((p.z - this.pressZ) * 0.3, -0.06, 0.06);
    if (kind === 'up' && this.phase === 'charge') this.release(this.power);
  }
  key(code, down) {
    this.keys[code] = down;
    if (this.turn !== 0) return;
    if (code === 'Space' && down && this.phase === 'aim') { this.phase = 'charge'; this.chargeT = 0; this.pressZ = this.ptrZ; }
    if (code === 'Space' && !down && this.phase === 'charge') this.release(this.power);
  }
  release(p) { this.slide(this.lateral, this.angle, 0.95 + p * 1.25); }
  slide(z, ang, v) {
    const who = this.turn;
    const mesh = new THREE.Mesh(this.geo, [this.side, this.mats[who], this.side]);
    mesh.castShadow = true;
    this.g.add(mesh);
    const pk = { x: X0, z, vx: Math.cos(ang) * v, vz: Math.sin(ang) * v, r: R, m: 1, who, mesh, fall: 0, off: false, dead: false };
    this.pucks.push(pk);
    this.sides[who].left--;
    this.cur = pk;
    this.phase = 'slide'; this.t = 0;
    this.env.ui.meter(null); this.env.ui.hint('');
    this.power = 0;
    this.env.audio.puckSlide(v / 2.2);
    this.score();
  }
  plan() {
    const live = this.pucks.filter(p => !p.off && !p.dead);
    const lead = live.reduce((a, p) => (!a || p.x > a.x) ? p : a, null);
    // knock the leader off if it is yours and sitting pretty
    if (lead && lead.who === 0 && zonePts(lead.x) >= 2 && Math.random() < 0.4) {
      return { z: clamp(lead.z + gauss() * 0.012, -W / 2 + R, W / 2 - R), ang: 0, v: Math.sqrt(2 * DECEL * (lead.x - X0 + 0.9)) * (1 + gauss() * 0.02), knock: true };
    }
    const tx = L - 0.1 - Math.random() * 0.2;
    let z = gauss() * 0.08;
    // don't slide into your own weights
    for (const p of live) if (p.who === 1 && Math.abs(p.z - z) < 2.2 * R) z = clamp(p.z + (p.z > 0 ? -1 : 1) * 3 * R, -W / 2 + R, W / 2 - R);
    return { z, ang: gauss() * 0.005, v: Math.sqrt(2 * DECEL * (tx - X0)) * (1 + gauss() * 0.04) };
  }
  step(h) {
    for (const p of this.pucks) {
      if (p.off || p.dead) continue;
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > 0) { const ns = Math.max(0, sp - DECEL * h); p.vx *= ns / sp; p.vz *= ns / sp; if (ns < 0.003) p.vx = p.vz = 0; }
      p.x += p.vx * h; p.z += p.vz * h;
    }
    for (let i = 0; i < this.pucks.length; i++) for (let j = i + 1; j < this.pucks.length; j++) {
      const a = this.pucks[i], b = this.pucks[j];
      if (a.off || b.off || a.dead || b.dead) continue;
      const v = collideDiscs(a, b, 0.85);
      if (v > 0) this.env.audio.puckClack(v);
    }
    for (const p of this.pucks) {
      if (p.off || p.dead) continue;
      if (p.x > L || Math.abs(p.z) > W / 2) { p.off = true; p.fall = 0; this.env.audio.bump(); }
    }
  }
  moving() { return this.pucks.some(p => !p.off && !p.dead && (p.vx || p.vz)); }
  settle() {
    // weights short of the far foul line come off
    for (const p of this.pucks) if (!p.off && !p.dead && p.x < L - SB.FOUL) p.dead = true;
    const c = this.cur;
    if (this.turn === 1) {
      if (this.ai && this.ai.knock && Math.random() < 0.6) this.env.say(this.env.opp.fig, pick(LINES.oppKnock));
      else if (!c.off && !c.dead && zonePts(c.x) >= 3) this.env.say(this.env.opp.fig, pick(LINES.oppGood));
      else if ((c.off || c.dead) && Math.random() < 0.5) this.env.say(this.env.opp.fig, pick(LINES.oppMiss));
    } else if (!c.off && !c.dead && zonePts(c.x) >= 3 && Math.random() < 0.5) this.env.say(this.env.opp.fig, pick(LINES.youGood));
    const pts = c.off ? 0 : c.dead ? -1 : zonePts(c.x);
    this.env.ui.msg(c.off ? 'In the gutter' : c.dead ? 'Short · off it comes' : pts === 4 ? 'Hanger! <em>4</em>' : `<em>${pts}</em>`, 1.1);
    this.thrown++;
    if (this.thrown >= 8) { this.phase = 'tally'; this.t = 0; return; }
    this.turn = 1 - this.turn;
    if (this.sides[this.turn].left === 0) this.turn = 1 - this.turn;
    this.phase = 'pause'; this.t = 0;
  }
  tally() {
    const live = this.pucks.filter(p => !p.off && !p.dead);
    let text = 'Nobody scores';
    if (live.length) {
      const lead = live.reduce((a, p) => p.x > a.x ? p : a);
      const w = lead.who, best = Math.max(-1, ...live.filter(p => p.who !== w).map(p => p.x));
      const pts = live.filter(p => p.who === w && p.x > best).reduce((s, p) => s + zonePts(p.x), 0);
      if (pts > 0) {
        this.sides[w].score += pts;
        text = `${w === 0 ? 'You score' : this.sides[1].name + ' scores'} <em>${pts}</em>`;
        this.starter = 1 - w;          // the other side throws first next round
        this.env.audio[w === 0 ? 'coin' : 'bump']();
      }
    }
    this.env.ui.msg(text, 2.2);
    this.score();
    const win = this.sides.findIndex(s => s.score >= TARGET);
    if (win >= 0) {
      this.phase = 'over'; this.score();
      this.env.say(this.env.opp.fig, pick(win === 0 ? LINES.oppLose : LINES.oppWin));
      this.env.finish({ win: win === 0, text: `${this.sides[0].score}–${this.sides[1].score}`, kr: win === 0 ? 75 : 0, title: win === 0 ? 'You win' : `${this.sides[1].name} wins` });
      return;
    }
    this.phase = 'next'; this.t = 0;
  }
  update(dt) {
    const env = this.env;
    this.t += dt;
    if (this.phase === 'aim' && this.turn === 0) {
      if (this.keys.KeyA || this.keys.ArrowLeft) this.lateral = clamp(this.lateral - dt * 0.25, -W / 2 + R + 0.01, W / 2 - R - 0.01);
      if (this.keys.KeyD || this.keys.ArrowRight) this.lateral = clamp(this.lateral + dt * 0.25, -W / 2 + R + 0.01, W / 2 - R - 0.01);
    }
    if (this.phase === 'charge') { this.chargeT += dt; this.power = pingPong(this.chargeT, 2.0); env.ui.meter(this.power); }
    if (this.phase === 'ai') {
      this.lateral = damp(this.lateral, this.ai.z, 4, dt);
      if (this.t > 1.3) this.slide(this.ai.z, this.ai.ang, this.ai.v);
    }
    if (this.phase === 'slide') {
      const n = 6, h = dt / n;
      for (let i = 0; i < n; i++) this.step(h);
      if (!this.moving() && this.t > 0.3) this.settle();
    }
    if (this.phase === 'pause' && this.t > 1.0) this.beginTurn();
    if (this.phase === 'tally' && this.t > 0.9) this.tally();
    if (this.phase === 'next' && this.t > 2.4) this.newRound();
    // the weights, and the one waiting to be thrown
    for (const p of this.pucks) {
      if (p.off) { p.fall = Math.min(1, p.fall + dt * 3); if (p.fall >= 1) p.mesh.visible = false; }
      if (p.dead) p.mesh.visible = false;
      p.mesh.position.set(p.x, H + 0.012 - p.fall * 0.12, p.z);
    }
    const waiting = (this.phase === 'aim' || this.phase === 'charge' || this.phase === 'ai');
    if (!this.ghost) {
      this.ghost = new THREE.Mesh(this.geo, [this.side, this.mats[0], this.side]);
      this.g.add(this.ghost);
    }
    this.ghost.visible = waiting;
    this.ghost.material[1] = this.mats[this.turn];
    this.ghost.position.set(X0 - this.power * 0.05, H + 0.012, this.lateral);
    this.aimLine.visible = waiting && this.turn === 0;
    if (this.aimLine.visible) {
      const a = this.aimLine.geometry.attributes.position;
      a.setXYZ(0, X0 + R, H + 0.003, this.lateral);
      a.setXYZ(1, X0 + 1.4, H + 0.003, this.lateral + Math.tan(this.angle) * 1.4);
      a.needsUpdate = true; this.aimLine.geometry.computeBoundingSphere();
    }
    // the camera: behind your end, following the weight down the table, and over the far end to
    // count up at the end of a round
    const c = this.cam;
    let tx = -0.75, tl = 2.1, th = 1.45;
    if (this.phase === 'slide' && this.cur) { tx = clamp(this.cur.x - 1.5, -0.75, L - 2.0); tl = Math.max(2.1, this.cur.x + 1.0); }
    if (this.phase === 'tally' || this.phase === 'next' || (this.phase === 'pause' && this.cur && this.cur.x > 1.5)) { tx = L - 1.55; tl = L - 0.35; th = 1.55; }
    c.x = damp(c.x, tx, 3, dt); c.look = damp(c.look, tl, 3, dt); c.h = damp(c.h, th, 3, dt);
    const cam = env.camera, fov = cam.aspect < 1 ? 62 : 46;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    lookFrom(cam, env.group, new THREE.Vector3(c.x, c.h, 0.0001), new THREE.Vector3(c.look, H, 0));
    env.me.fig.animate(dt, 0, 'idle'); env.opp.fig.animate(dt, 0, 'idle');
  }
  dispose() { this.g.removeFromParent(); }
}
