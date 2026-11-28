// Pool at Kong Oscar: eight-ball on the pub's 7 ft table against one of the regulars.
//
// The balls are discs on the table's plane (x along the table, z across it, metres, centred on
// the table) with rolling friction, ball-to-ball collisions and cushions with pocket mouths;
// they are drawn as spheres that roll. Pub rules, simplified: the first ball potted after the
// break gives you your group (solids or stripes); pot one of yours and you go again; a foul
// (the white in a pocket, hitting nothing, or hitting the wrong group first) passes the turn,
// and the white comes back to the head spot. Pot the black once your group is cleared to win;
// pot it early, or with the white, and you lose.
import * as THREE from '../vendor/three.module.min.js';
import { clamp, damp, gauss, pick, pingPong, pointerOnPlane, lookFrom, collideDiscs, rollMesh, canvasTex, blobShadow } from './activity.js';

const L = 1.98, W = 0.99, R = 0.0286;
const HX = L / 2, HZ = W / 2;
const CORNER = 0.058, MIDDLE = 0.05;          // pocket capture radius
const POCKETS = [[-HX - 0.012, -HZ - 0.012, CORNER], [0, -HZ - 0.028, MIDDLE], [HX + 0.012, -HZ - 0.012, CORNER],
  [-HX - 0.012, HZ + 0.012, CORNER], [0, HZ + 0.028, MIDDLE], [HX + 0.012, HZ + 0.012, CORNER]];
// the cushions' noses, segment by segment between the pocket mouths (the ends are the jaws)
const CM = 0.072, MM = 0.058;
const RAILS = [
  [-HX + CM, -HZ, -MM, -HZ], [MM, -HZ, HX - CM, -HZ],
  [-HX + CM, HZ, -MM, HZ], [MM, HZ, HX - CM, HZ],
  [-HX, -HZ + CM, -HX, HZ - CM], [HX, -HZ + CM, HX, HZ - CM],
];
const COLS = ['#f4f1e6', '#f2c12e', '#1f4fb4', '#c8232c', '#5b2a86', '#e8731c', '#16784a', '#7a1f1f', '#111111'];
const colOf = n => COLS[n > 8 ? n - 8 : n];
const groupOf = n => n === 0 ? 'cue' : n === 8 ? 'eight' : n < 8 ? 'solid' : 'stripe';
const GROUP_NAME = { solid: 'Solids', stripe: 'Stripes' };

function ballTexture(n) {
  return canvasTex(256, 128, (g, w, h) => {
    const c = colOf(n);
    g.fillStyle = n > 8 ? '#f4f1e6' : c; g.fillRect(0, 0, w, h);
    if (n > 8) { g.fillStyle = c; g.fillRect(0, h * 0.27, w, h * 0.46); }
    if (n > 0) {
      for (const cx of [w * 0.25, w * 0.75]) {
        g.fillStyle = '#f4f1e6'; g.beginPath(); g.ellipse(cx, h / 2, 17, 21, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111'; g.font = '800 26px "Archivo", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), cx, h / 2 + 1);
      }
    } else {
      g.fillStyle = '#c8232c'; for (const cx of [w * 0.25, w * 0.75]) { g.beginPath(); g.arc(cx, h / 2, 4, 0, 7); g.fill(); }
    }
  });
}

const LINES = {
  oppGood: ['Den satt!', 'Sånn gjør vi det på Marken.', 'Lett.', 'Hehe. Øl nummer fire, og fortsatt treffsikker.'],
  oppMiss: ['Faen.', 'Bordet heller.', 'Det var køen sin feil.', 'Uff.'],
  youGood: ['Pent!', 'Ok, ok. Du kan spille.', 'Flaks.'],
  youFoul: ['Feil! Min tur.', 'Hvit i hullet, kompis.'],
  oppWin: ['Bedre lykke neste gang. Du spanderer.', 'Kong Oscar har en ny konge. Det er meg.'],
  oppLose: ['Grattis. Revansj neste uke.', 'Jaja. Du var heldig med den svarte.'],
};

export class PoolGame {
  constructor(env) {
    this.env = env;
    const { group, surf } = env;
    this.g = new THREE.Group(); group.add(this.g);
    this.surf = surf;
    // balls
    this.balls = [];
    const geo = new THREE.SphereGeometry(R, 28, 18);
    for (let n = 0; n <= 15; n++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ballTexture(n), roughness: 0.18, metalness: 0.0 }));
      mesh.castShadow = true;
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const sh = blobShadow(R * 3.2);
      this.g.add(mesh, sh);
      this.balls.push({ n, x: 0, z: 0, vx: 0, vz: 0, r: R, m: 1, on: true, mesh, sh, sink: 0, pocket: null });
    }
    this.rack();
    // the cue
    this.cue = new THREE.Group();
    {
      const wood = new THREE.MeshStandardMaterial({ color: 0xc89c62, roughness: 0.5 });
      const butt = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.45 });
      const tip = new THREE.MeshStandardMaterial({ color: 0x3a6ea8, roughness: 0.8 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0105, 0.95, 10), wood);
      shaft.rotation.z = Math.PI / 2; shaft.position.x = -0.49;
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.015, 0.5, 10), butt);
      back.rotation.z = Math.PI / 2; back.position.x = -1.21;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.012, 10), tip);
      t.rotation.z = Math.PI / 2; t.position.x = -0.006;
      for (const m of [shaft, back]) m.castShadow = true;
      this.cue.add(shaft, back, t);
      this.cue.rotation.order = 'YZX';
      this.g.add(this.cue);
    }
    // the guide: a line to the first contact, a ghost ball, and the object ball's way on
    const lm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
    this.guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lm);
    this.guide2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lm.clone());
    this.guide2.material.opacity = 0.35;
    this.ghost = new THREE.Mesh(new THREE.RingGeometry(R * 0.86, R, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    this.ghost.rotation.x = -Math.PI / 2;
    this.g.add(this.guide, this.guide2, this.ghost);

    this.sides = [{ name: env.me.name, group: null, col: '#f2c12e' }, { name: env.opp.name, group: null, col: '#e0712c' }];
    this.turn = 0;
    this.phase = 'aim';           // aim | charge | roll | ai | over
    this.aim = 0;                 // direction of the shot, radians in the table's plane (x, z)
    this.power = 0; this.chargeT = 0;
    this.broken = false;
    this.shot = null;
    this.t = 0;
    this.keys = {};
    this.camK = 0;
    env.ui.open('Pool · Kong Oscar');
    this.place();
    this.hintAim();
    this.score();
    env.ui.msg('Your break', 1.6);
  }
  rack() {
    const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    // a legal-looking rack: the eight in the middle, one of each group in the back corners
    const sh = order.filter(n => n !== 8 && n !== 1 && n !== 15).sort(() => Math.random() - 0.5);
    const slots = [];
    const fx = HX / 2, dx = R * Math.sqrt(3) + 0.0004;
    for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) slots.push([fx + row * dx, (k - row / 2) * (2 * R + 0.0006)]);
    const nums = new Array(15);
    nums[0] = 1; nums[4] = 8; nums[10] = 15; nums[14] = 2;
    const rest = sh.filter(n => n !== 2);
    for (let i = 0; i < 15; i++) if (nums[i] === undefined) nums[i] = rest.pop();
    for (let i = 0; i < 15; i++) { const b = this.balls[nums[i]]; b.x = slots[i][0]; b.z = slots[i][1]; }
    const c = this.balls[0]; c.x = -HX / 2; c.z = 0;
    for (const b of this.balls) { b.vx = b.vz = 0; b.on = true; b.sink = 0; b.mesh.visible = true; }
  }
  // where the figures stand: you behind the white, the regular at the other end watching
  place() {
    const { me, opp, group } = this.env;
    const W2 = (x, z) => group.localToWorld(new THREE.Vector3(x, 0, z));
    const shooter = this.turn === 0 ? me : opp, other = this.turn === 0 ? opp : me;
    const c = this.balls[0], dx = Math.cos(this.aim), dz = Math.sin(this.aim);
    // behind the white, outside the rail
    let sx = c.x - dx * 1.0, sz = c.z - dz * 1.0;
    sx = clamp(sx, -HX - 0.45, HX + 0.45); sz = clamp(sz, -HZ - 0.45, HZ + 0.45);
    if (Math.abs(sx) < HX + 0.3 && Math.abs(sz) < HZ + 0.3) { if (HX + 0.3 - Math.abs(sx) < HZ + 0.3 - Math.abs(sz)) sx = Math.sign(sx || 1) * (HX + 0.35); else sz = Math.sign(sz || 1) * (HZ + 0.35); }
    shooter.fig.root.position.copy(W2(sx, sz));
    // on the camera's side of the table they would stand in the way: step out of the picture
    shooter.fig.root.visible = sz < HZ + 0.1 || this.env.camera.aspect < 1;
    other.fig.root.visible = true;
    const toBall = group.localToWorld(new THREE.Vector3(c.x, 0, c.z)).sub(shooter.fig.root.position);
    shooter.fig.root.rotation.set(0, Math.atan2(toBall.x, toBall.z), 0);
    const ox = sx > 0 ? -HX - 0.7 : HX + 0.7, oz = sz > 0 ? -HZ - 0.55 : HZ + 0.55;
    other.fig.root.position.copy(W2(ox, oz));
    const toT = group.localToWorld(new THREE.Vector3(0, 0, 0)).sub(other.fig.root.position);
    other.fig.root.rotation.set(0, Math.atan2(toT.x, toT.z), 0);
  }
  score() {
    const s = this.sides, left = g => g ? this.balls.filter(b => b.on && groupOf(b.n) === g).length : null;
    const sub = i => { const g = s[i].group; if (!g) return 'Open table'; const n = left(g); return n ? `${GROUP_NAME[g]} · ${n} left` : 'On the black'; };
    this.env.ui.setScore([{ name: s[0].name, score: '', col: s[0].col, sub: sub(0) }, { name: s[1].name, score: '', col: s[1].col, sub: sub(1) }], this.phase === 'over' ? -1 : this.turn);
  }
  hintAim() {
    this.env.ui.hint(this.env.touch ? 'Drag to aim · hold, then let go to shoot' : 'Move the mouse to aim · hold the button and let go to shoot · <kbd>A</kbd><kbd>D</kbd> fine aim');
  }
  // ------------------------------------------------------------ input
  pointer(kind, ndc) {
    if (this.turn !== 0 || (this.phase !== 'aim' && this.phase !== 'charge')) return;
    const p = pointerOnPlane(this.env.camera, ndc, this.env.group.getWorldPosition(new THREE.Vector3()).y + this.surf, this.env.group);
    if (p && (kind === 'move' || kind === 'down') && (this.phase === 'aim' || this.env.touch)) {
      const c = this.balls[0];
      if (Math.hypot(p.x - c.x, p.z - c.z) > 0.03) this.aim = Math.atan2(p.z - c.z, p.x - c.x);
    }
    if (kind === 'down' && this.phase === 'aim') { this.phase = 'charge'; this.chargeT = 0; }
    if (kind === 'up' && this.phase === 'charge') this.strike(0.35 + this.power * 5.4);
  }
  key(code, down) {
    this.keys[code] = down;
    if (this.turn !== 0) return;
    if (code === 'Space' && down && this.phase === 'aim') { this.phase = 'charge'; this.chargeT = 0; }
    if (code === 'Space' && !down && this.phase === 'charge') this.strike(0.35 + this.power * 5.4);
  }
  strike(speed) {
    const c = this.balls[0];
    c.vx = Math.cos(this.aim) * speed; c.vz = Math.sin(this.aim) * speed;
    this.phase = 'roll';
    this.shot = { potted: [], first: null, scratch: false, t: 0, cueBack: 0.03 + this.power * 0.25 };
    this.env.audio.cueHit(speed / 5);
    this.env.ui.meter(null); this.env.ui.hint('');
    this.power = 0;
  }
  // ------------------------------------------------------------ physics
  step(h) {
    const B = this.balls;
    for (const b of B) {
      if (!b.on || b.pocket) continue;
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0) {
        const ns = Math.max(0, sp - (0.12 + 0.2 * sp) * h);
        b.vx *= ns / sp; b.vz *= ns / sp;
        if (ns < 0.004) b.vx = b.vz = 0;
      }
      const ox = b.x, oz = b.z;
      b.x += b.vx * h; b.z += b.vz * h;
      rollMesh(b.mesh, b.x - ox, b.z - oz, R);
    }
    // balls on balls
    for (let i = 0; i < B.length; i++) {
      const a = B[i]; if (!a.on || a.pocket) continue;
      for (let j = i + 1; j < B.length; j++) {
        const b = B[j]; if (!b.on || b.pocket) continue;
        const v = collideDiscs(a, b, 0.95);
        if (v > 0) {
          if (this.shot && !this.shot.first && (a.n === 0 || b.n === 0)) this.shot.first = a.n === 0 ? b.n : a.n;
          this.env.audio.ballClick(v);
        }
      }
    }
    // cushions and jaws
    for (const b of B) {
      if (!b.on || b.pocket) continue;
      for (const [ax, az, bx, bz] of RAILS) {
        const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
        const t = clamp(((b.x - ax) * ex + (b.z - az) * ez) / l2, 0, 1);
        const px = ax + ex * t, pz = az + ez * t, dx = b.x - px, dz = b.z - pz, d = Math.hypot(dx, dz);
        if (d < R && d > 1e-9) {
          const nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz;
          b.x = px + nx * R; b.z = pz + nz * R;
          if (vn < 0) { b.vx -= 1.72 * vn * nx; b.vz -= 1.72 * vn * nz; b.vx *= 0.97; b.vz *= 0.97; this.env.audio.cushion(-vn); }
        }
      }
      // pockets
      for (const P of POCKETS) {
        if (Math.hypot(b.x - P[0], b.z - P[1]) < P[2]) { this.pot(b, P); break; }
      }
      // never off the table
      if (!b.pocket && (Math.abs(b.x) > HX + 0.02 || Math.abs(b.z) > HZ + 0.02)) {
        let best = POCKETS[0], bd = Infinity;
        for (const P of POCKETS) { const d = Math.hypot(b.x - P[0], b.z - P[1]); if (d < bd) { bd = d; best = P; } }
        this.pot(b, best);
      }
    }
  }
  pot(b, P) {
    b.pocket = P; b.sink = 0;
    this.env.audio.pocket();
    if (this.shot) { if (b.n === 0) this.shot.scratch = true; else this.shot.potted.push(b.n); }
  }
  moving() { return this.balls.some(b => b.on && !b.pocket && (b.vx || b.vz)) || this.balls.some(b => b.pocket && b.sink < 1); }
  // ------------------------------------------------------------ rules
  endShot() {
    const sh = this.shot, me = this.sides[this.turn], other = this.sides[1 - this.turn];
    this.shot = null;
    // were you on the black before this shot (your group all down)?
    const onBlack = !!me.group && !this.balls.some(b => b.on && groupOf(b.n) === me.group);
    const legalFirst = n => n !== null && (!me.group ? n !== 8 : onBlack ? n === 8 : groupOf(n) === me.group);
    for (const n of sh.potted) this.balls[n].on = false;
    if (sh.scratch) this.balls[0].on = false;
    const who = this.turn === 0 ? 'You' : this.sides[1].name;
    // the black
    if (sh.potted.includes(8)) {
      const win = onBlack && !sh.scratch && legalFirst(sh.first);
      this.gameOver(win ? this.turn : 1 - this.turn, win ? `${who} potted the black.` : sh.scratch ? 'The black went down with the white.' : 'The black went down too early.');
      return;
    }
    const foul = sh.scratch || !legalFirst(sh.first);
    if (!me.group && !foul) {
      const firstGroup = sh.potted.map(groupOf).find(g => g === 'solid' || g === 'stripe');
      if (firstGroup && this.broken) {
        me.group = firstGroup; other.group = firstGroup === 'solid' ? 'stripe' : 'solid';
        this.env.ui.msg(`${who === 'You' ? 'You are' : who + ' is'} on ${GROUP_NAME[firstGroup].toLowerCase()}`, 2);
      }
    }
    const wasBreak = !this.broken;
    this.broken = true;
    const mine = sh.potted.some(n => me.group ? groupOf(n) === me.group : n !== 8);
    if (sh.scratch) this.respot();
    let again = !foul && mine;
    if (wasBreak && !foul && sh.potted.length) again = true;
    if (foul) {
      this.env.ui.msg(sh.scratch ? 'Foul · the white is down' : sh.first === null ? 'Foul · nothing hit' : 'Foul · wrong ball first', 2);
      this.env.audio.foul();
      if (this.turn === 0) this.env.say(this.env.opp.fig, pick(LINES.youFoul));
    } else if (again) {
      if (this.turn === 1) { if (Math.random() < 0.4) this.env.say(this.env.opp.fig, pick(LINES.oppGood)); }
      else if (Math.random() < 0.3) this.env.say(this.env.opp.fig, pick(LINES.youGood));
    } else if (this.turn === 1 && Math.random() < 0.5) this.env.say(this.env.opp.fig, pick(LINES.oppMiss));
    if (!again) this.turn = 1 - this.turn;
    this.beginTurn();
  }
  respot() {
    const c = this.balls[0];
    c.on = true; c.pocket = null; c.sink = 0; c.vx = c.vz = 0; c.mesh.visible = true;
    c.x = -HX / 2; c.z = 0;
    for (let k = 0; k < 40 && this.balls.some(b => b.n && b.on && Math.hypot(b.x - c.x, b.z - c.z) < 2.1 * R); k++) c.z += (k % 2 ? 1 : -1) * k * R;
  }
  beginTurn() {
    this.phase = this.turn === 0 ? 'aim' : 'ai';
    this.t = 0;
    this.score();
    if (this.turn === 0) { this.hintAim(); this.env.ui.msg('Your shot', 1.2); }
    else { this.env.ui.hint(`${this.sides[1].name} is lining up a shot…`); this.ai = this.plan(); }
    this.place();
  }
  gameOver(winner, why) {
    this.phase = 'over';
    this.score();
    const win = winner === 0;
    this.env.say(this.env.opp.fig, pick(win ? LINES.oppLose : LINES.oppWin));
    this.env.ui.hint('');
    this.env.finish({ win, text: why, kr: win ? 100 : 0, title: win ? 'You win' : `${this.sides[1].name} wins` });
  }
  // ------------------------------------------------------------ the regular's shot
  plan() {
    const me = this.sides[1], c = this.balls[0];
    const on = this.balls.filter(b => b.on && b.n);
    if (!this.broken) return { aim: Math.atan2(0 - c.z, HX / 2 - c.x) + gauss() * 0.01, speed: 5.0 + Math.random() * 0.6 };
    const cleared = me.group && !on.some(b => groupOf(b.n) === me.group);
    const legal = on.filter(b => me.group ? (cleared ? b.n === 8 : groupOf(b.n) === me.group) : b.n !== 8);
    const clear = (ax, az, bx, bz, skip) => {
      const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1e-9;
      for (const o of on) {
        if (skip.includes(o)) continue;
        const t = clamp(((o.x - ax) * ex + (o.z - az) * ez) / l2, 0, 1);
        if (Math.hypot(ax + ex * t - o.x, az + ez * t - o.z) < 2 * R + 0.004) return false;
      }
      return true;
    };
    let best = null;
    for (const b of legal) {
      for (const P of POCKETS) {
        // aim a little inside the pocket's mouth
        const px = P[0] * 0.985, pz = P[1] * 0.97;
        const d2 = Math.hypot(px - b.x, pz - b.z), ux = (px - b.x) / d2, uz = (pz - b.z) / d2;
        const gx = b.x - ux * 2 * R, gz = b.z - uz * 2 * R;
        const d1 = Math.hypot(gx - c.x, gz - c.z), vx = (gx - c.x) / d1, vz = (gz - c.z) / d1;
        const cut = vx * ux + vz * uz;
        if (cut < 0.3) continue;
        // middle pockets only take balls coming at them fairly straight
        if (P[2] === MIDDLE && Math.abs(uz) < 0.55) continue;
        if (!clear(c.x, c.z, gx, gz, [b]) || !clear(b.x, b.z, px, pz, [b])) continue;
        const score = cut * cut / (0.4 + d1 + d2 * 1.6);
        if (!best || score > best.score) best = { score, aim: Math.atan2(vz, vx), speed: clamp(1.0 + (d1 + d2 * 1.4) * 1.2 / Math.max(0.5, cut), 1.0, 4.2) };
      }
    }
    if (best) return { aim: best.aim + gauss() * 0.011, speed: best.speed * (1 + gauss() * 0.06) };
    // nothing on: hit the nearest legal ball full and hope
    let tgt = legal[0] || on[0], bd = Infinity;
    for (const b of legal) { const d = Math.hypot(b.x - c.x, b.z - c.z); if (d < bd) { bd = d; tgt = b; } }
    return { aim: Math.atan2(tgt.z - c.z, tgt.x - c.x) + gauss() * 0.02, speed: 2.2 };
  }
  // ------------------------------------------------------------ the guide line
  updateGuide() {
    const c = this.balls[0], dx = Math.cos(this.aim), dz = Math.sin(this.aim), y = this.surf + 0.002;
    // the first ball the white would touch
    let tHit = Infinity, hitB = null;
    for (const b of this.balls) {
      if (!b.on || !b.n || b.pocket) continue;
      const fx = b.x - c.x, fz = b.z - c.z, tc = fx * dx + fz * dz;
      if (tc <= 0) continue;
      const d2 = fx * fx + fz * fz - tc * tc, rr = 4 * R * R;
      if (d2 > rr) continue;
      const t = tc - Math.sqrt(rr - d2);
      if (t < tHit) { tHit = t; hitB = b; }
    }
    // or the cushion
    let tWall = Infinity;
    if (dx > 1e-6) tWall = Math.min(tWall, (HX - R - c.x) / dx); if (dx < -1e-6) tWall = Math.min(tWall, (-HX + R - c.x) / dx);
    if (dz > 1e-6) tWall = Math.min(tWall, (HZ - R - c.z) / dz); if (dz < -1e-6) tWall = Math.min(tWall, (-HZ + R - c.z) / dz);
    const t = Math.min(tHit, tWall), ex = c.x + dx * t, ez = c.z + dz * t;
    const set = (line, a, b) => { const p = line.geometry.attributes.position; p.setXYZ(0, a[0], y, a[1]); p.setXYZ(1, b[0], y, b[1]); p.needsUpdate = true; line.geometry.computeBoundingSphere(); };
    set(this.guide, [c.x + dx * R, c.z + dz * R], [ex, ez]);
    this.ghost.position.set(ex, y, ez);
    this.guide2.visible = !!hitB && tHit <= tWall;
    if (this.guide2.visible) {
      const nx = hitB.x - ex, nz = hitB.z - ez, l = Math.hypot(nx, nz) || 1;
      set(this.guide2, [hitB.x, hitB.z], [hitB.x + nx / l * 0.28, hitB.z + nz / l * 0.28]);
    }
  }
  // ------------------------------------------------------------ frame
  update(dt) {
    const env = this.env;
    this.t += dt;
    if (this.turn === 0 && this.phase === 'aim') {
      if (this.keys.KeyA || this.keys.ArrowLeft) this.aim -= dt * 0.35;
      if (this.keys.KeyD || this.keys.ArrowRight) this.aim += dt * 0.35;
    }
    if (this.phase === 'charge') {
      this.chargeT += dt;
      this.power = pingPong(this.chargeT, 1.3);
      env.ui.meter(this.power);
    }
    if (this.phase === 'ai') {
      // the regular chalks up, turns the cue round to the shot and pulls back
      const a = this.ai;
      if (this.t < 1.4) this.aim += Math.atan2(Math.sin(a.aim - this.aim), Math.cos(a.aim - this.aim)) * Math.min(1, dt * 3);
      else this.aim = a.aim;
      this.power = this.t > 1.5 ? Math.min(a.speed / 5.4, (this.t - 1.5) * 0.9) : 0;
      if (this.t > 1.5 + Math.min(a.speed / 5.4, 1) / 0.9 + 0.15) this.strike(a.speed);
    }
    if (this.phase === 'roll') {
      this.shot.t += dt;
      const maxV = Math.max(...this.balls.map(b => Math.hypot(b.vx, b.vz)));
      const n = clamp(Math.ceil(maxV * dt / (R * 0.4)), 1, 40), h = dt / n;
      for (let i = 0; i < n; i++) this.step(h);
      if (!this.moving() || this.shot.t > 25) { for (const b of this.balls) b.vx = b.vz = 0; this.endShot(); }
    }
    // balls into the pockets
    for (const b of this.balls) {
      if (b.pocket) {
        b.sink = Math.min(1, b.sink + dt * 3);
        b.x = damp(b.x, b.pocket[0], 14, dt); b.z = damp(b.z, b.pocket[1], 14, dt);
        if (b.sink >= 0.55) { b.mesh.visible = false; b.sh.visible = false; }
      }
      b.mesh.position.set(b.x, this.surf + R - b.sink * 0.09, b.z);
      b.sh.position.set(b.x + 0.006, this.surf + 0.001, b.z + 0.008);
      b.sh.visible = b.mesh.visible && !b.pocket;
    }
    // the cue and the guide
    const showCue = (this.phase === 'aim' || this.phase === 'charge' || this.phase === 'ai') && this.balls[0].on;
    this.cue.visible = showCue;
    this.guide.visible = this.ghost.visible = showCue && this.turn === 0;
    if (!this.guide.visible) this.guide2.visible = false;
    if (showCue) {
      const c = this.balls[0], back = R + 0.012 + this.power * 0.22;
      this.cue.position.set(c.x - Math.cos(this.aim) * back, this.surf + R + 0.004, c.z - Math.sin(this.aim) * back);
      this.cue.rotation.set(0, -this.aim, -0.09);
      if (this.turn === 0) this.updateGuide();
    }
    // the figures
    env.me.fig.animate(dt, 0, 'idle'); env.opp.fig.animate(dt, 0, 'idle');
    // camera: over the table from the long side, a little to the shooter's side
    this.camK = damp(this.camK, this.turn === 0 ? 0 : 1, 2, dt);
    const portrait = env.camera.aspect < 1;
    if (portrait) lookFrom(env.camera, env.group, new THREE.Vector3(-1.75, this.surf + 2.55, 0.0001), new THREE.Vector3(-0.15, this.surf, 0));
    else lookFrom(env.camera, env.group, new THREE.Vector3(0, this.surf + 1.02, 1.42), new THREE.Vector3(0, this.surf - 0.12, 0.02));
  }
  dispose() { this.g.removeFromParent(); this.env.me.fig.root.visible = this.env.opp.fig.root.visible = true; }
}
