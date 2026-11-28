// Svarteper round the coffee table at Cappes vei 6: the five of you on the sofas, a pack of 52
// with the jack of clubs taken out, so the jack of spades has no partner. He is Svarteper.
//
// Everyone is dealt the pack and lays down their pairs (same value, same colour: the two red
// sevens make a pair, as do the two black ones). Then each in turn draws a card, face down, from
// the next player round the table, lays down any pair it makes, and passes on. Whoever runs out
// of cards is out. The one left holding Svarteper gets a smudge of soot on the nose.
//
// The 3D room is the backdrop: the hands are laid out over it, each in front of its player, at
// the screen position of a point on the table (env.players[i].spot).
import * as THREE from '../vendor/three.module.min.js';
import { pick } from './activity.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = [['♠', 'b'], ['♣', 'b'], ['♥', 'r'], ['♦', 'r']];
const isPeter = c => c.r === 'J' && c.s === '♠';
const key = c => c.r + c.col;
const order = c => RANKS.indexOf(c.r) * 4 + SUITS.findIndex(s => s[0] === c.s);

const LINES = {
  gotPeter: ['Æsj.', 'Neeei…', 'Hmm.', 'Typisk.'],
  passedPeter: ['Hehe.', 'Takk og farvel!', 'Ha det, Svarteper!'],
  out: ['Ferdig! Lykke til, folkens.', 'Jeg er ute!', 'Ha!'],
  pair: ['Par!', 'Der.', 'Ja!'],
  lost: ['Nei! Ikke korken!', 'Dette er juks.', 'Revansj!'],
};

export class SvartePerGame {
  constructor(env) {
    this.env = env;
    const P = this.P = env.players.map((p, i) => ({ ...p, i, hand: [], out: false }));
    env.ui.open('Svarteper · Cappes vei 6');
    env.ui.el.classList.add('cards');
    const L = this.root = document.createElement('div');
    L.className = 'sp';
    for (const p of P) {
      const h = document.createElement('div');
      h.className = 'sp-hand' + (p.i === 0 ? ' sp-me' : ' sp-opp');
      h.style.setProperty('--c', p.col);
      h.innerHTML = `<div class="sp-name">${p.face ? `<img src="${p.face}" alt="">` : ''}<span>${p.i === 0 ? 'You' : p.name}</span><em></em></div><div class="sp-cards"></div>`;
      L.appendChild(h);
      p.el = h; p.cardsEl = h.querySelector('.sp-cards'); p.countEl = h.querySelector('em');
    }
    this.pile = document.createElement('div'); this.pile.className = 'sp-pile';
    L.appendChild(this.pile);
    env.ui.layer.appendChild(L);
    // the pack: 52 less the jack of clubs, shuffled and dealt round from your left
    const deck = [];
    for (const r of RANKS) for (const [s, col] of SUITS) if (!(r === 'J' && s === '♣')) deck.push({ r, s, col, id: r + s });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    deck.forEach((c, k) => P[(k + 1) % P.length].hand.push(c));
    this.q = [];
    this.busy = false;
    this.finishOrder = [];
    this.turn = 0;
    this.phase = 'deal';
    this.render();
    env.ui.hint('Dealing… everyone lays down their pairs');
    this.later(0.9, () => this.layPairsAll());
    this.pick = this.pick.bind(this);
    L.addEventListener('click', this.pick);
  }
  later(t, fn) { this.q.push({ t, fn }); }
  sortMine() { this.P[0].hand.sort((a, b) => order(a) - order(b)); }
  shuffleHand(p) { const h = p.hand; for (let i = h.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [h[i], h[j]] = [h[j], h[i]]; } }
  cardHTML(c, extra = '') {
    if (!c) return `<div class="card back${extra}"></div>`;
    return `<div class="card ${c.col === 'r' ? 'red' : ''}${isPeter(c) ? ' peter' : ''}${extra}" data-id="${c.id}"><b>${c.r}<span>${c.s}</span></b><i>${c.s}</i>${isPeter(c) ? '<small>Svarteper</small>' : ''}<b class="bot">${c.r}</b></div>`;
  }
  render() {
    for (const p of this.P) {
      if (p.i === 0) p.cardsEl.innerHTML = p.hand.map(c => this.cardHTML(c, c.fresh ? ' fresh' : '')).join('');
      else p.cardsEl.innerHTML = p.hand.map((_, k) => `<div class="card back" data-k="${k}"></div>`).join('');
      p.countEl.textContent = p.out ? 'Out' : p.hand.length ? String(p.hand.length) : '';
      p.el.classList.toggle('out', p.out);
      p.el.classList.toggle('turn', !this.over && this.turn === p.i);
      p.el.classList.toggle('from', !this.over && this.phase === 'pick' && this.from === p.i);
    }
  }
  // lay down every pair in p's hand; returns how many
  pairsOf(p) {
    const seen = new Map(), pairs = [];
    for (const c of p.hand) { const k = key(c); if (seen.has(k)) { pairs.push([seen.get(k), c]); seen.delete(k); } else seen.set(k, c); }
    return pairs;
  }
  discard(p, pair) {
    p.hand = p.hand.filter(c => !pair.includes(c));
    const el = document.createElement('div');
    el.className = 'sp-pair';
    el.style.setProperty('--r', ((Math.random() - 0.5) * 50).toFixed(0) + 'deg');
    el.innerHTML = pair.map(c => this.cardHTML(c)).join('');
    this.pile.appendChild(el);
    while (this.pile.children.length > 8) this.pile.firstElementChild.remove();
    this.env.audio.card();
  }
  layPairsAll() {
    let k = 0;
    for (const p of this.P) for (const pair of this.pairsOf(p)) { this.later(0.12 * k++, () => { this.discard(p, pair); this.render(); }); }
    this.later(0.12 * k + 0.6, () => { this.checkOut(); this.startTurn(); });
  }
  next(i) { for (let k = 1; k <= this.P.length; k++) { const j = (i + k) % this.P.length; if (!this.P[j].out) return j; } return i; }
  checkOut() {
    for (const p of this.P) if (!p.out && p.hand.length === 0) {
      p.out = true; this.finishOrder.push(p.i);
      if (p.i === 0) this.env.ui.msg('You are out!', 1.6);
      else { this.env.ui.msg(`${p.name} is out`, 1.3); if (p.fig) this.env.say(p.fig, pick(LINES.out)); }
    }
    const left = this.P.filter(p => !p.out);
    if (left.length <= 1) { this.end(left[0]); return true; }
    return false;
  }
  startTurn() {
    if (this.over) return;
    if (this.P[this.turn].out) this.turn = this.next(this.turn);
    this.from = this.next(this.turn);
    this.phase = 'pick';
    const me = this.turn === 0, fromName = this.from === 0 ? 'you' : this.P[this.from].name;
    this.env.ui.hint(me ? `Your turn: take a card from ${this.P[this.from].name}` : `${this.P[this.turn].name} takes a card from ${fromName}…`);
    this.render();
    if (!me) {
      // a moment to think; when it's your hand they take from, the card they reach for lifts first
      const k = Math.floor(Math.random() * this.P[this.from].hand.length);
      this.later(0.7 + Math.random() * 0.4, () => {
        const el = this.P[this.from].cardsEl.children[k];
        if (el) el.classList.add('lift');
        this.later(0.45, () => this.take(this.turn, this.from, k));
      });
    }
  }
  pick(e) {
    if (this.over || this.phase !== 'pick' || this.turn !== 0) return;
    const c = e.target.closest('.card');
    if (!c || !this.P[this.from].cardsEl.contains(c)) return;
    this.take(0, this.from, +c.dataset.k);
  }
  // card k of `from`'s hand goes to `to`
  take(to, from, k) {
    if (this.phase !== 'pick') return;
    this.phase = 'move';
    const A = this.P[from], B = this.P[to];
    const card = A.hand[k];
    const srcEl = A.cardsEl.children[k];
    const r0 = srcEl ? srcEl.getBoundingClientRect() : A.el.getBoundingClientRect();
    A.hand.splice(k, 1);
    // the card flies across the table
    const fly = document.createElement('div');
    fly.innerHTML = this.cardHTML(to === 0 ? card : null);
    const fe = fly.firstElementChild;
    fe.classList.add('fly');
    if (to !== 0) fe.classList.add('small');
    fe.style.left = r0.left + 'px'; fe.style.top = r0.top + 'px';
    document.body.appendChild(fe);
    const r1 = B.cardsEl.getBoundingClientRect();
    const tx = r1.left + r1.width / 2 - r0.left - r0.width / 2, ty = r1.top + r1.height / 2 - r0.top - r0.height / 2;
    fe.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${tx}px, ${ty}px) rotate(${(Math.random() - 0.5) * 30}deg)` }], { duration: 420, easing: 'cubic-bezier(.3,.7,.3,1)' });
    this.env.audio.card();
    this.render();
    this.later(0.42, () => {
      fe.remove();
      card.fresh = to === 0;
      B.hand.push(card);
      if (to === 0) this.sortMine(); else this.shuffleHand(B);
      if (from !== 0) this.shuffleHand(A);
      this.render();
      this.react(to, from, card);
      // a pair?
      const pair = B.hand.find(c => c !== card && key(c) === key(card));
      const after = () => {
        card.fresh = false;
        if (this.checkOut()) return;
        this.turn = this.next(to);
        this.startTurn();
      };
      if (pair) this.later(0.55, () => { this.discard(B, [pair, card]); this.render(); if (to === 0) this.env.ui.msg('Pair!', 0.9); this.later(0.35, after); });
      else this.later(to === 0 ? 0.6 : 0.35, after);
    });
  }
  react(to, from, card) {
    if (!isPeter(card)) return;
    const T = this.P[to], F = this.P[from];
    if (to === 0) { this.env.ui.msg('You drew Svarteper…', 1.6); if (F.fig && Math.random() < 0.7) this.env.say(F.fig, pick(LINES.passedPeter)); }
    else {
      if (T.fig && Math.random() < 0.5) this.env.say(T.fig, pick(LINES.gotPeter));
      if (from === 0) this.env.ui.msg(`${T.name} took Svarteper!`, 1.6);
      else if (F.fig && Math.random() < 0.35) this.env.say(F.fig, pick(LINES.passedPeter));
    }
  }
  end(loser) {
    this.over = true; this.phase = 'over';
    this.render();
    const me = loser && loser.i === 0;
    // show the loser's last card
    if (loser) {
      loser.el.classList.add('loser');
      if (loser.i !== 0) loser.cardsEl.innerHTML = loser.hand.map(c => this.cardHTML(c)).join('');
      if (loser.fig) this.env.say(loser.fig, pick(LINES.lost));
    }
    const first = this.finishOrder[0];
    const kr = first === 0 ? 40 : 0;
    this.env.ui.hint('');
    this.env.finish({
      win: !me, kr,
      title: me ? 'Svarteper!' : `${loser ? loser.name : 'Someone'} is Svarteper`,
      text: me ? 'You were left holding the black jack. Soot on your nose.' : (first === 0 ? 'You were out first: the pot is yours.' : `Soot on ${loser.name}’s nose.`),
      loser: loser ? loser.id : null,
    });
  }
  // keep the hands in front of their players
  place() {
    const cam = this.env.camera, w = innerWidth, h = innerHeight;
    for (const p of this.P) {
      if (p.i === 0) continue;
      const v = p.spot.clone().project(cam);
      p.el.style.left = ((v.x + 1) / 2 * w).toFixed(0) + 'px';
      p.el.style.top = ((1 - v.y) / 2 * h).toFixed(0) + 'px';
    }
    // hands that would overlap on screen are pushed apart sideways
    const opp = this.P.filter(p => p.i !== 0).map(p => ({ p, x: parseFloat(p.el.style.left), y: parseFloat(p.el.style.top), w: p.el.offsetWidth + 8, h: p.el.offsetHeight }));
    for (let it = 0; it < 4; it++) for (const a of opp) for (const b of opp) {
      if (a === b || a.x > b.x || (a.x === b.x && a.p.i > b.p.i)) continue;
      const ox = (a.w + b.w) / 2 - (b.x - a.x), oy = Math.min(a.y, b.y) - (Math.max(a.y, b.y) - Math.max(a.h, b.h));
      if (ox > 0 && oy > 0) { a.x -= ox / 2; b.x += ox / 2; }
    }
    for (const o of opp) o.p.el.style.left = Math.max(o.w / 2, Math.min(w - o.w / 2, o.x)).toFixed(0) + 'px';
    const c = this.env.centre.clone().project(cam);
    this.pile.style.left = ((c.x + 1) / 2 * w).toFixed(0) + 'px';
    this.pile.style.top = ((1 - c.y) / 2 * h).toFixed(0) + 'px';
  }
  update(dt) {
    for (const j of this.q.slice()) { j.t -= dt; if (j.t <= 0) { this.q.splice(this.q.indexOf(j), 1); j.fn(); } }
    this.env.view(dt);
    this.place();
  }
  pointer() {}
  key() {}
  dispose() { this.root.removeEventListener('click', this.pick); this.root.remove(); for (const f of document.querySelectorAll('.card.fly')) f.remove(); this.env.ui.el.classList.remove('cards'); }
}
