// Boccia in the courtyard of Danckert Krohns Hus, against the seniors from the centre.
//
// The court is a level bed of fine gravel inside low timber boards, 11 m by 2.6 m, built on the
// sloping courtyard. You throw from the open end. The rules are the old bocce ones the seniors
// play: one side throws the little white ball (the pallino) somewhere between 6 and 10.5 m, then
// the first boccia ball; after that, whichever side is further from the pallino throws next,
// until it gets closer or runs out of balls. When all eight are thrown, the side with the closest
// ball scores one for each of theirs closer than the other side's best. First to 5.
//
// The court's frame: origin on the court's surface at the middle of the throwing end, +x down the
// court, z across it. `buildCourt` makes the court and its collision blocks in that frame.
import * as THREE from '../vendor/three.module.min.js';
import { World } from './engine.js';
import { clamp, damp, gauss, pick, pingPong, pointerOnPlane, lookFrom, collideDiscs, rollMesh, canvasTex, blobShadow } from './activity.js';

export const BC = { L: 11, W: 2.6, board: 0.14 };
const { L, W } = BC;
const RB = 0.054, RJ = 0.02, DECEL = 1.05, TARGET = 5;

export function buildCourt(group, base, Y) {
  // base: how far the ground drops below the court surface at its lowest; Y: the surface's height
  // in the world (the collision blocks are in world heights, the meshes in the group's frame)
  const world = new World(4);
  const gravelTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#b9ab92'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const s = Math.random(); g.fillStyle = `rgba(${s < 0.5 ? '80,70,58' : '238,230,214'},${0.12 + Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5); }
  });
  gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping;
  gravelTex.repeat.set(L / 1.6, W / 1.6);
  const gravel = new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 1 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x6e5236, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4d3a28, roughness: 0.9 });
  const add = (mat, x0, y0, z0, x1, y1, z1, walk = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    world.add({ x0, x1, z0, z1, bottom: Y + y0, top: Y + y1, walk, cam: false });
    return m;
  };
  const t = 0.09, B = BC.board;
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(L, W), gravel);
  bed.rotation.x = -Math.PI / 2; bed.position.set(L / 2, 0, 0); bed.receiveShadow = true;
  group.add(bed);
  world.add({ x0: 0, x1: L, z0: -W / 2, z1: W / 2, bottom: Y - base - 0.5, top: Y, cam: false });
  // the boards, standing on a timber skirt down to the ground
  add(timber, -t, -base - 0.3, -W / 2 - t, L + t, B, -W / 2);
  add(timber, -t, -base - 0.3, W / 2, L + t, B, W / 2 + t);
  add(timber, L, -base - 0.3, -W / 2, L + t, B, W / 2);
  add(timber, -t, -base - 0.3, -W / 2, 0, 0.06, W / 2);
  // a step up at your end, and a bench along the side for whoever's waiting
  add(dark, -0.55, -base - 0.3, -0.8, -t, -0.0, 0.8);
  {
    const bx = 2.2, bz = W / 2 + 0.75;
    add(dark, bx - 0.9, -base - 0.3, bz - 0.2, bx + 0.9, 0.42, bz + 0.2);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.05), timber);
    back.position.set(bx, 0.7, bz + 0.2); back.castShadow = true; group.add(back);
  }
  // a little sign on the end board
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.26), new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTex(512, 132, (g, w, h) => {
    g.fillStyle = '#1e4d2b'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 14); g.fill();
    g.strokeStyle = '#f2e6c8'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#f2e6c8'; g.font = '800 52px "Archivo", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('BOCCIA', w / 2, h * 0.38); g.font = '600 26px "Archivo", sans-serif'; g.fillText('Danckert Krohns Hus', w / 2, h * 0.75);
  }) }));
  sign.position.set(L + t + 0.005, 0.45, 0); sign.rotation.y = Math.PI / 2;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6 + base, 0.06), dark);
  post.position.set(L + t + 0.04, 0.3 - base / 2, 0);
  group.add(sign, post);
  return { world, bench: [2.2, 0, W / 2 + 0.72] };
}

function ballMat(col) {
  const tex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 5;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, h * (0.2 + i * 0.2)); g.bezierCurveTo(w * 0.3, h * (0.1 + i * 0.2), w * 0.6, h * (0.35 + i * 0.2), w, h * (0.2 + i * 0.2)); g.stroke(); }
  });
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.05 });
}

const LINES = {
  oppGood: ['Sånn gjør man det.', 'Der ligger den, ja.', 'Femti år med boccia, gutten min.'],
  oppKnock: ['Unnskyld! Hehe.', 'Bort med den.'],
  youGood: ['Pent kastet, gutten min!', 'Nei, men se på den!', 'Den unge mannen kan dette.'],
  youBad: ['Litt lenger neste gang.', 'Det er gruset. Det er alltid gruset.'],
  arne: ['Kom igjen, Gunvor!', 'Det her blir spennende.', 'Kaffen er klar etterpå.', 'I mitt år kastet vi lenger.'],
  oppWin: ['Takk for spillet! Kom igjen på torsdag.', 'Vi spiller hver torsdag. Du må øve.'],
  oppLose: ['Nei, nå er jeg imponert.', 'Du har talent. Kom på torsdag!'],
};

export class BocciaGame {
  constructor(env) {
    this.env = env;
    this.g = new THREE.Group(); env.group.add(this.g);
    this.mats = [ballMat('#b3261e'), ballMat('#1f6a3a')];
    this.jackMat = new THREE.MeshStandardMaterial({ color: 0xf6e04a, roughness: 0.3, emissive: 0x3a3000 });
    this.ballGeo = new THREE.SphereGeometry(RB, 24, 16);
    this.jackGeo = new THREE.SphereGeometry(RJ, 16, 12);
    this.balls = [];
    this.jack = null;
    this.aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
    this.g.add(this.aimLine);
    this.sides = [{ name: env.me.name, score: 0, col: '#d2301f', left: 4 }, { name: env.opp.name, score: 0, col: '#2bb673', left: 4 }];
    this.starter = 0; this.endNo = 0;
    this.aim = 0; this.power = 0; this.chargeT = 0;
    this.cam = { x: -1.9, lx: 6.5, h: 2.35, z: 0.3 };
    this.keys = {};
    env.ui.open('Boccia · Danckert Krohns Hus · first to 5');
    const Wd = (x, z) => env.group.localToWorld(new THREE.Vector3(x, 0, z));
    env.me.fig.root.position.copy(Wd(-0.3, -0.55)); this.face(env.me.fig, 6, -0.3);
    env.opp.fig.root.position.copy(Wd(-1.0, -1.45)); this.face(env.opp.fig, 5, 0);
    if (env.extra) { env.extra.fig.root.position.copy(Wd(2.2, W / 2 + 0.72)); this.face(env.extra.fig, 2.2, 0); }
    this.newEnd();
  }
  face(fig, x, z) { const v = this.env.group.localToWorld(new THREE.Vector3(x, 0, z)).sub(fig.root.position); fig.root.rotation.set(0, Math.atan2(v.x, v.z), 0); }
  newEnd() {
    for (const b of this.balls) { b.mesh.removeFromParent(); b.sh.removeFromParent(); }
    if (this.jack) { this.jack.mesh.removeFromParent(); this.jack.sh.removeFromParent(); }
    this.balls = []; this.jack = null;
    this.sides.forEach(s => { s.left = 4; });
    this.endNo++;
    this.turn = this.starter;
    this.env.ui.msg(`End ${this.endNo}`, 1.2);
    this.beginTurn();
  }
  score() {
    this.env.ui.setScore(this.sides.map(s => ({ name: s.name, score: s.score, col: s.col, sub: '●'.repeat(s.left) + '○'.repeat(4 - s.left) })), this.phase === 'over' ? -1 : this.turn);
  }
  get jackPhase() { return !this.jack; }
  beginTurn() {
    this.phase = this.turn === 0 ? 'aim' : 'ai';
    this.t = 0;
    const what = this.jackPhase ? 'the pallino' : 'a ball';
    if (this.turn === 0) this.env.ui.hint((this.env.touch ? 'Touch to aim · hold, then let go to throw ' : 'Aim with the mouse · hold the button and let go to throw ') + what + (this.jackPhase ? ' (6 to 10.5 m)' : ''));
    else { this.env.ui.hint(`${this.sides[1].name} throws ${what}…`); this.ai = this.plan(); }
    this.score();
  }
  pointer(kind, ndc) {
    if (this.turn !== 0 || (this.phase !== 'aim' && this.phase !== 'charge')) return;
    const p = pointerOnPlane(this.env.camera, ndc, this.env.group.getWorldPosition(new THREE.Vector3()).y, this.env.group);
    if (p && p.x > 0.8) this.aim = clamp(Math.atan2(p.z, p.x - 0.2), -0.3, 0.3);
    if (kind === 'down' && this.phase === 'aim') { this.phase = 'charge'; this.chargeT = 0; }
    if (kind === 'up' && this.phase === 'charge') this.release();
  }
  key(code, down) {
    this.keys[code] = down;
    if (this.turn !== 0) return;
    if (code === 'Space' && down && this.phase === 'aim') { this.phase = 'charge'; this.chargeT = 0; }
    if (code === 'Space' && !down && this.phase === 'charge') this.release();
  }
  release() {
    const D = this.jackPhase ? 3 + this.power * 9 : 1 + this.power * 11.5;
    this.throwBall(this.aim, D);
  }
  // a lob that lands a third of the way and rolls the rest; D is where it would stop on its own
  throwBall(ang, D) {
    const jack = this.jackPhase, who = this.turn, r = jack ? RJ : RB;
    const mesh = new THREE.Mesh(jack ? this.jackGeo : this.ballGeo, jack ? this.jackMat : this.mats[who]);
    mesh.castShadow = true;
    const sh = blobShadow(r * 3.4);
    this.g.add(mesh, sh);
    const land = Math.max(0.7, D * 0.33), vRoll = Math.sqrt(2 * DECEL * Math.max(0.05, D - land));
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const b = { x: 0.2, z: 0, vx: 0, vz: 0, r, m: jack ? 0.08 : 0.92, who, jack, mesh, sh, air: { t: 0, dur: land / (vRoll * 1.1), x0: 0.2, z0: 0, x1: 0.2 + dx * land, z1: dz * land, peak: 0.35 + land * 0.12, vx: dx * vRoll, vz: dz * vRoll } };
    if (jack) this.jack = b; else { this.balls.push(b); this.sides[who].left--; }
    this.cur = b;
    (who === 0 ? this.env.me : this.env.opp).fig.punch();
    this.phase = 'roll'; this.t = 0;
    this.env.ui.meter(null); this.env.ui.hint('');
    this.power = 0;
    this.env.audio.whoosh();
    this.score();
  }
  all() { return this.jack ? [this.jack, ...this.balls] : this.balls; }
  step(h) {
    const A = this.all();
    for (const b of A) {
      if (b.air) continue;
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0) { const ns = Math.max(0, sp - DECEL * (b.jack ? 1.3 : 1) * h); b.vx *= ns / sp; b.vz *= ns / sp; if (ns < 0.01) b.vx = b.vz = 0; }
      const ox = b.x, oz = b.z;
      b.x += b.vx * h; b.z += b.vz * h;
      // the boards
      if (b.z < -W / 2 + b.r) { b.z = -W / 2 + b.r; if (b.vz < 0) b.vz = -b.vz * 0.4; }
      if (b.z > W / 2 - b.r) { b.z = W / 2 - b.r; if (b.vz > 0) b.vz = -b.vz * 0.4; }
      if (b.x > L - b.r) { b.x = L - b.r; if (b.vx > 0) { this.env.audio.bump(); b.vx = -b.vx * 0.35; } }
      if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx = -b.vx * 0.35; }
      rollMesh(b.mesh, b.x - ox, b.z - oz, b.r);
    }
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      if (A[i].air || A[j].air) continue;
      const v = collideDiscs(A[i], A[j], 0.8);
      if (v > 0.05) this.env.audio.bocciaClack(v);
    }
  }
  moving() { return this.all().some(b => b.air || b.vx || b.vz); }
  dist(b) { return Math.hypot(b.x - this.jack.x, b.z - this.jack.z); }
  best(who) { let d = Infinity; for (const b of this.balls) if (b.who === who) d = Math.min(d, this.dist(b)); return d; }
  settle() {
    const c = this.cur;
    if (c.jack) {
      if (c.x < 6 || c.x > 10.5) {
        c.x = 8; c.z = 0; c.vx = c.vz = 0;
        this.env.ui.msg('Out of range · Arne puts the pallino on the mark', 2);
        if (this.env.extra) this.env.say(this.env.extra.fig, 'Jeg legger den på åtte meter, jeg.');
      } else this.env.ui.msg(`The pallino lies at ${c.x.toFixed(1).replace('.', ',')} m`, 1.4);
      this.phase = 'pause'; this.t = 0;              // the same side throws the first ball
      return;
    }
    const d = this.dist(c);
    const mine = this.best(c.who), theirs = this.best(1 - c.who);
    const lead = mine < theirs ? c.who : 1 - c.who;
    this.env.ui.msg(`${d < 1 ? Math.round(d * 100) + ' cm' : d.toFixed(2).replace('.', ',') + ' m'} from the pallino · ${lead === 0 ? 'you are closest' : this.sides[1].name + ' is closest'}`, 1.8);
    if (c.who === 0 && d < 0.2 && Math.random() < 0.6) this.env.say(this.env.opp.fig, pick(LINES.youGood));
    else if (c.who === 0 && d > 1.5 && Math.random() < 0.4) this.env.say(this.env.opp.fig, pick(LINES.youBad));
    else if (c.who === 1 && this.ai && this.ai.knock && Math.random() < 0.6) this.env.say(this.env.opp.fig, pick(LINES.oppKnock));
    else if (c.who === 1 && d < 0.2 && Math.random() < 0.6) this.env.say(this.env.opp.fig, pick(LINES.oppGood));
    else if (this.env.extra && Math.random() < 0.15) this.env.say(this.env.extra.fig, pick(LINES.arne));
    const left = this.sides.map(s => s.left);
    if (left[0] + left[1] === 0) { this.phase = 'tally'; this.t = 0; return; }
    // the side that isn't closest throws, if it has anything left
    let next = 1 - lead;
    if (!left[next]) next = lead;
    this.turn = next;
    this.phase = 'pause'; this.t = 0;
  }
  tally() {
    const d0 = this.best(0), d1 = this.best(1), w = d0 < d1 ? 0 : 1, other = Math.min(d0, d1) === d0 ? d1 : d0;
    const pts = this.balls.filter(b => b.who === w && this.dist(b) < other).length;
    this.sides[w].score += pts;
    this.starter = w;
    this.env.ui.msg(`${w === 0 ? 'You score' : this.sides[1].name + ' scores'} <em>${pts}</em>`, 2.4);
    this.env.audio[w === 0 ? 'coin' : 'bump']();
    this.score();
    const win = this.sides.findIndex(s => s.score >= TARGET);
    if (win >= 0) {
      this.phase = 'over'; this.score();
      this.env.say(this.env.opp.fig, pick(win === 0 ? LINES.oppLose : LINES.oppWin));
      this.env.finish({ win: win === 0, text: `${this.sides[0].score}–${this.sides[1].score}`, kr: win === 0 ? 50 : 0, title: win === 0 ? 'You win' : `${this.sides[1].name} wins` });
      return;
    }
    this.phase = 'next'; this.t = 0;
  }
  plan() {
    if (this.jackPhase) return { ang: gauss() * 0.05, D: 7.5 + Math.random() * 2 };
    const j = this.jack, x0 = 0.2;
    const yours = this.balls.filter(b => b.who === 0).sort((a, b) => this.dist(a) - this.dist(b))[0];
    const ang = t => Math.atan2(t.z, t.x - x0);
    // knock your best ball away when it sits close and hers are far
    if (yours && this.dist(yours) < 0.25 && this.best(1) > this.dist(yours) && this.sides[1].left >= 1 && Math.random() < 0.38) {
      const D = Math.hypot(yours.x - x0, yours.z) + 1.4;
      return { ang: ang(yours) + gauss() * 0.01, D: D * (1 + gauss() * 0.03), knock: true };
    }
    const D = Math.hypot(j.x - x0, j.z) - 0.08;
    return { ang: ang(j) + gauss() * 0.012, D: D * (1 + gauss() * 0.045) };
  }
  update(dt) {
    const env = this.env;
    this.t += dt;
    if (this.phase === 'aim' && this.turn === 0) {
      if (this.keys.KeyA || this.keys.ArrowLeft) this.aim = clamp(this.aim - dt * 0.15, -0.3, 0.3);
      if (this.keys.KeyD || this.keys.ArrowRight) this.aim = clamp(this.aim + dt * 0.15, -0.3, 0.3);
    }
    if (this.phase === 'charge') { this.chargeT += dt; this.power = pingPong(this.chargeT, 2.0); env.ui.meter(this.power); }
    if (this.phase === 'ai') {
      this.aim = damp(this.aim, this.ai.ang, 3, dt);
      if (this.t > 1.6) this.throwBall(this.ai.ang, this.ai.D);
    }
    if (this.phase === 'roll') {
      for (const b of this.all()) {
        const a = b.air;
        if (!a) continue;
        a.t += dt;
        const k = Math.min(1, a.t / a.dur);
        b.x = a.x0 + (a.x1 - a.x0) * k; b.z = a.z0 + (a.z1 - a.z0) * k;
        b.y = Math.sin(k * Math.PI) * a.peak;
        if (k >= 1) { b.air = null; b.y = 0; b.vx = a.vx; b.vz = a.vz; env.audio.land(); }
      }
      const n = 8, h = dt / n;
      for (let i = 0; i < n; i++) this.step(h);
      if (!this.moving() && this.t > 0.4) this.settle();
    }
    if (this.phase === 'pause' && this.t > 1.2) this.beginTurn();
    if (this.phase === 'tally' && this.t > 1.0) this.tally();
    if (this.phase === 'next' && this.t > 2.6) this.newEnd();
    for (const b of this.all()) {
      b.mesh.position.set(b.x, b.r + (b.y || 0), b.z);
      b.sh.position.set(b.x + 0.02, 0.004, b.z + 0.02);
    }
    const waiting = this.turn === 0 && (this.phase === 'aim' || this.phase === 'charge');
    this.aimLine.visible = waiting;
    if (waiting) {
      const a = this.aimLine.geometry.attributes.position, l = 3.2;
      a.setXYZ(0, 0.4, 0.02, Math.tan(this.aim) * 0.2); a.setXYZ(1, 0.2 + Math.cos(this.aim) * l, 0.02, Math.sin(this.aim) * l);
      a.needsUpdate = true; this.aimLine.geometry.computeBoundingSphere();
    }
    // the camera: behind the throw, then along with the ball, and over the pallino to count up
    const c = this.cam;
    let tx = -1.9, tlx = 6.5, th = 2.35, tz = 0.3;
    const roller = this.phase === 'roll' ? this.cur : null;
    if (roller && !roller.air) { tx = clamp(roller.x - 3.2, -1.8, L - 4); tlx = roller.x + 1.5; }
    if (this.jack && (this.phase === 'tally' || this.phase === 'next' || (this.phase === 'pause' && this.t > 0.2))) { tx = this.jack.x - 2.1; tlx = this.jack.x; th = 1.8; tz = 0.5; }
    c.x = damp(c.x, tx, 2.5, dt); c.lx = damp(c.lx, tlx, 2.5, dt); c.h = damp(c.h, th, 2.5, dt); c.z = damp(c.z, tz, 2.5, dt);
    const cam = env.camera, fov = cam.aspect < 1 ? 70 : 52;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    lookFrom(cam, env.group, new THREE.Vector3(c.x, c.h, c.z), new THREE.Vector3(c.lx, 0, 0));
    env.me.fig.animate(dt, 0, 'idle'); env.opp.fig.animate(dt, 0, 'idle');
    if (env.extra) env.extra.fig.animate(dt, 0, 'sit');
  }
  dispose() { this.g.removeFromParent(); }
}
