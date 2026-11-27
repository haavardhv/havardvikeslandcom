// Synthesised sound: rain, footsteps, seagulls, punches, the scooter motor and
// a few jingles. The only audio files are the songs and the talk on the scooter radio.
export const STATION = 'Radio Fjellet 6';
const DJ = 'Regnar';
// the songs, in broadcast order (durations in seconds, so the station clock works before a file
// has loaded)
const SONGS = [
  { id: 'grand-theft-cappes-vei-6', title: 'Grand Theft Cappes Vei 6', dur: 167.16 },
  { id: 'cappes-vei-six', title: 'Cappes Vei Six', dur: 253.68 },
  { id: 'guangdong-house', title: 'Guangdong House', dur: 193.96 },
  { id: 'stone-and-salt', title: 'Cappes Vei Stone and Salt', dur: 203.08 },
  { id: 'cappes-vei-six-2', title: 'Cappes Vei Six (Version 2)', dur: 334.97 },
];
// The station's clips (gtcv6/RADIO.md has the scripts) and their durations, from clips.json, which
// tools/build_radio.py writes. A slot whose clip isn't there yet is left out of the broadcast.
const TALK = await fetch('/audio/radio/clips.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
const INTRO = { 'grand-theft-cappes-vei-6': 'intro_grand-theft-cappes-vei-6', 'cappes-vei-six': 'intro_cappes-vei-six',
  'guangdong-house': 'intro_guangdong-house', 'stone-and-salt': 'intro_stone-and-salt', 'cappes-vei-six-2': 'intro_cappes-vei-six-v2' };
// the rotating slots: a different clip of the kind plays in each slot, round after round
const POOL = {
  id: ['id_01', 'id_02', 'id_03', 'id_04'],
  outro: ['outro_01', 'outro_02', 'outro_03'],
  // Regnar and Sol talking between the songs
  chat: ['chat_weather', 'chat_gulls', 'chat_steep', 'chat_party'],
  ad: ['ad_maakeskrekk', 'ad_regnfrakk', 'ad_bratt', 'ad_sparksjo'],
  news: ['news_maakemelding', 'news_traffic', 'news_party'],
  // and over the music, halfway through a song
  over: ['over_umbrella', 'over_sunglasses', 'over_bolle', 'over_fortyone'],
};
// what follows each song (RADIO.md, "How it plays")
const AFTER = [['outro', 'chat'], ['chat', 'news'], ['ad', 'chat'], ['outro', 'news'], ['chat', 'ad']];
const TITLE = { news: 'Nyheter', ad: 'Reklame', chat: 'Regnar & Sol' };
// The broadcast: a station ID, Regnar's intro, the song (with the two of them talking over it
// halfway through), then the chatter after it. It runs for enough rounds of the songs that the
// rotating clips come round evenly, then starts again. It is a broadcast: it plays the same
// whatever you are doing.
const PROGRAM = [];
{
  const next = {}, talk = (id, kind) => TALK[id] && PROGRAM.push({ talk: true, title: TITLE[kind] || DJ, src: `/audio/radio/${id}.mp3`, dur: TALK[id] });
  const pick = (kind, take = id => talk(id, kind)) => {
    const ids = POOL[kind].filter(id => TALK[id]);
    if (!ids.length) return;
    const n = next[kind] || 0; next[kind] = n + 1;
    take(ids[n % ids.length]);
  };
  for (let round = 0; round < 3; round++) {
    SONGS.forEach((song, i) => {
      pick('id');
      talk(INTRO[song.id], 'intro');
      const seg = { title: song.title, src: `/audio/${song.id}.mp3`, dur: song.dur };
      // talk over the song: a little before the middle, and always clear of the end
      pick('over', id => { const dur = TALK[id]; seg.over = { src: `/audio/radio/${id}.mp3`, dur, at: Math.min(song.dur * 0.42, song.dur - dur - 20) }; });
      PROGRAM.push(seg);
      for (const kind of AFTER[i % AFTER.length]) pick(kind);
    });
  }
}
const START = [];
{ let t = 0; for (const seg of PROGRAM) { START.push(t); t += seg.dur; } }
const LOOP = PROGRAM.reduce((a, seg) => a + seg.dur, 0);
export class Audio {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.rainLevel = 0;
    this.onSong = null;      // called with (station, title) when a song starts playing to you
  }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain();
    this.master.gain.value = this.on ? 0.8 : 0;
    this.master.connect(c.destination);
    // noise buffer
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // rain bed: two filtered noise layers
    const mk = (type, f, q, g) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gn = c.createGain(); gn.gain.value = 0;
      s.connect(fl).connect(gn).connect(this.master);
      s.start(0, Math.random() * 2);
      return gn;
    };
    this.rainHi = mk('highpass', 3500, 0.3, 0);
    this.rainLo = mk('lowpass', 700, 0.5, 0);
    // scooter motor
    this.motor = c.createOscillator(); this.motor.type = 'sawtooth'; this.motor.frequency.value = 80;
    const mf = c.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 900;
    this.motorGain = c.createGain(); this.motorGain.gain.value = 0;
    this.motor.connect(mf).connect(this.motorGain).connect(this.master);
    this.motor.start();
    // tyres sliding on wet setts while the scooter drifts: a hiss with a squeal in it
    {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1900; f1.Q.value = 6;
      const f2 = c.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 2500; f2.Q.value = 0.5;
      this.skidGain = c.createGain(); this.skidGain.gain.value = 0;
      s.connect(f1).connect(this.skidGain); s.connect(f2).connect(this.skidGain);
      this.skidGain.connect(this.master);
      s.start(0, Math.random() * 2);
    }
    this.motorF = mf;
    // the scooter radio: a station that has been broadcasting since the game started, so getting
    // on a scooter tunes in mid-song (or mid-sentence), like the radio in a car. Two players take
    // turns: while one plays a segment, the other has the next one loaded, so Regnar runs
    // straight into the song.
    this.radioGain = c.createGain(); this.radioGain.gain.value = 0;
    this.radioTone = c.createBiquadFilter(); this.radioTone.type = 'highshelf'; this.radioTone.frequency.value = 6000; this.radioTone.gain.value = -4;
    this.musicGain = c.createGain();                 // ducks the music while Regnar and Sol talk over it
    this.radioTone.connect(this.musicGain).connect(this.radioGain).connect(this.master);
    this.overEl = document.createElement('audio');
    this.overEl.preload = 'none';
    c.createMediaElementSource(this.overEl).connect(this.radioGain);
    this.overEl.addEventListener('ended', () => this._duck(false));
    this.ducked = false;
    this.radioEls = [0, 1].map(() => {
      const el = document.createElement('audio');
      el.preload = 'none';
      el.addEventListener('ended', () => { if (this.radioOn && el === this.radioEl) this._advance(); });
      c.createMediaElementSource(el).connect(this.radioTone);
      return el;
    });
    this.radioEl = this.radioEls[0];
    this.blobs = new Map();          // segment src -> object URL (or the download in progress)
    this.radioT0 = performance.now() - Math.random() * LOOP * 1000;   // tune in somewhere in the broadcast
    this.radioOn = false;
    this.segIdx = -1;
  }
  // Each segment is also downloaded whole, once, and played from memory after that: a stream can
  // only be seeked if the server answers range requests, and without seeking, getting back on a
  // scooter would start the song again from the top instead of where the broadcast is.
  _blobUrl(src) { const v = this.blobs.get(src); return typeof v === 'string' ? v : null; }
  _fetchBlob(src) {
    if (this.blobs.has(src)) return;
    this.blobs.set(src, fetch(src).then(r => r.ok ? r.blob() : Promise.reject(r.status))
      .then(b => { this.blobs.set(src, URL.createObjectURL(b)); }, () => { this.blobs.set(src, null); }));   // null: stream it
  }
  _load(el, seg) {
    const blob = this._blobUrl(seg.src);
    if (el.dataset.src === seg.src && (el.dataset.blob === '1' || !blob)) return;
    el.dataset.src = seg.src;
    el.dataset.blob = blob ? '1' : '';
    el.preload = 'auto';
    el.src = blob || seg.src;
    el.load();
    if (!blob) this._fetchBlob(seg.src);
  }
  // have the segment after `i` ready in the other player
  _preloadAfter(i) {
    const other = this.radioEls[this.radioEl === this.radioEls[0] ? 1 : 0];
    this._load(other, PROGRAM[(i + 1) % PROGRAM.length]);
  }
  // play whatever the station is broadcasting right now (the clock runs while you are away)
  _tune() {
    let t = ((performance.now() - this.radioT0) / 1000) % LOOP, i = 0;
    while (i < PROGRAM.length - 1 && t >= PROGRAM[i].dur) { t -= PROGRAM[i].dur; i++; }
    const seg = PROGRAM[i], asked = performance.now();
    // if the other player already has this segment loaded, use it
    if (this.radioEl.dataset.src !== seg.src) {
      const other = this.radioEls.find(e => e.dataset.src === seg.src);
      if (other) this.radioEl = other;
    }
    const el = this.radioEl;
    this.segIdx = i;
    const go = () => {
      if (!this.radioOn || el !== this.radioEl) return;
      // where the broadcast is now, the loading time included
      const at = Math.min(t + (performance.now() - asked) / 1000, (el.duration || seg.dur) - 0.3);
      // can't seek that far into the stream yet: wait for the whole file (a moment of tuning in)
      const sk = el.seekable, canSeek = sk.length && sk.end(sk.length - 1) >= at - 0.5;
      const pending = this.blobs.get(seg.src);
      if (at > 1 && !canSeek && pending && typeof pending.then === 'function') {
        pending.then(() => { if (this.radioOn && el === this.radioEl && this.segIdx === i) this._tune(); });
        return;
      }
      try { if (Math.abs(el.currentTime - at) > 0.5) el.currentTime = at; } catch (e) { /* plays from where it is */ }
      el.play().catch(() => {});
    };
    this._load(el, seg);
    if (el.readyState >= 1) go(); else el.addEventListener('loadedmetadata', go, { once: true });
    this._preloadAfter(i);
    if (this.onSong) this.onSong(STATION, seg.title);
  }
  // the segment ended: the other player takes over with the next one, from the top
  _advance() {
    const i = (this.segIdx + 1) % PROGRAM.length, seg = PROGRAM[i];
    this.radioEl = this.radioEls[this.radioEl === this.radioEls[0] ? 1 : 0];
    const el = this.radioEl;
    this.segIdx = i;
    this._load(el, seg);
    const go = () => { if (!this.radioOn || el !== this.radioEl) return; try { el.currentTime = 0; } catch (e) { /* */ } el.play().catch(() => {}); };
    if (el.readyState >= 1) go(); else el.addEventListener('loadedmetadata', go, { once: true });
    this.radioT0 = performance.now() - START[i] * 1000;         // keep the clock with the broadcast
    this._preloadAfter(i);
    if ((!seg.talk || seg.title !== DJ) && this.onSong) this.onSong(STATION, seg.title);   // songs, the news and ads
  }
  _duck(on) {
    if (this.ducked === on) return;
    this.ducked = on;
    this.musicGain.gain.setTargetAtTime(on ? 0.26 : 1, this.ctx.currentTime, on ? 0.12 : 0.35);
  }
  // Regnar and Sol talking over the song: follow the song's own position, so tuning in halfway
  // through their chat picks it up mid-sentence, like everything else on the station
  _overTick() {
    const seg = PROGRAM[this.segIdx], el = this.radioEl, ov = this.overEl;
    const o = this.radioOn && seg && seg.over && !el.paused && el.dataset.src === seg.src ? seg.over : null;
    const rel = o ? el.currentTime - o.at : -1;
    if (o && o.src !== ov.dataset.src && rel > -8) { ov.dataset.src = o.src; ov.preload = 'auto'; ov.src = o.src; ov.load(); }
    if (o && rel >= 0 && rel < o.dur - 0.3) {
      if (ov.paused && !this._overPlayed) {
        this._overPlayed = o;
        try { if (ov.readyState >= 1) ov.currentTime = rel; } catch (e) { /* from the top */ }
        ov.play().catch(() => {});
        this._duck(true);
      }
    } else {
      if (this._overPlayed && (!o || rel < 0)) this._overPlayed = null;
      if (!ov.paused && (!o || rel < -0.5 || rel > o.dur + 1)) { ov.pause(); this._duck(false); }
    }
  }
  // turn the radio on or off; call as often as you like
  setRadio(on) {
    if (!this.ctx || !this.radioEls || on === this.radioOn) return;
    this.radioOn = on;
    const t = this.ctx.currentTime;
    clearTimeout(this._radioStop);
    if (on) {
      this._tune();
      this.radioGain.gain.cancelScheduledValues(t);
      this.radioGain.gain.setTargetAtTime(0.55, t, 0.25);
    } else {
      this.radioGain.gain.cancelScheduledValues(t);
      this.radioGain.gain.setTargetAtTime(0, t, 0.15);
      this._radioStop = setTimeout(() => {
        if (this.radioOn) return;
        for (const e of this.radioEls) e.pause();
        this.overEl.pause(); this._overPlayed = null; this._duck(false);
      }, 700);
    }
  }
  pauseRadio(paused) {
    if (!this.radioEls || !this.radioOn) return;
    if (paused) { this.radioEl.pause(); this.overEl.pause(); this._overPlayed = null; } else this.radioEl.play().catch(() => {});
  }
  setOn(on) {
    this.on = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }
  update(rain, indoors, scooterSpeed, boost = 0) {
    if (!this.ctx) return;
    if (this.overEl) this._overTick();
    const t = this.ctx.currentTime;
    const r = rain * (indoors ? 0.25 : 1);
    this.rainHi.gain.setTargetAtTime(r * 0.05, t, 0.3);
    this.rainLo.gain.setTargetAtTime(r * (indoors ? 0.25 : 0.12), t, 0.3);
    const s = scooterSpeed;
    this.motorGain.gain.setTargetAtTime(s > 0.05 ? 0.035 + Math.min(0.05, s * 0.004) : 0, t, 0.08);
    this.motor.frequency.setTargetAtTime(70 + s * 22 + boost * 60, t, 0.08);
    this.motorF.frequency.setTargetAtTime(500 + s * 90 + boost * 900, t, 0.08);
  }
  // 0..1, how hard the scooter is sliding
  skid(amount) { if (this.ctx && this.skidGain) this.skidGain.gain.setTargetAtTime(Math.min(1, amount) * 0.09, this.ctx.currentTime, 0.05); }
  // the pistol: a hard crack, a thump, and the echo off the houses across the street
  shot() {
    if (!this.ctx) return;
    this._noise(0.09, 'highpass', 1800, 0.7, 0.55);
    this._noise(0.22, 'lowpass', 900, 0.8, 0.5);
    this._tone('square', 160, 45, 0.16, 0.22);
    this._noise(0.35, 'bandpass', 700, 0.9, 0.09, 0.11);
    this._noise(0.5, 'bandpass', 500, 0.9, 0.05, 0.26);
  }
  dryFire() { if (this.ctx) this._noise(0.03, 'highpass', 3000, 1, 0.12); }
  reload() {
    if (!this.ctx) return;
    this._noise(0.05, 'bandpass', 2400, 3, 0.18, 0.05);
    this._noise(0.05, 'bandpass', 1800, 3, 0.2, 0.75);
    this._noise(0.04, 'bandpass', 3200, 4, 0.18, 0.95);
  }
  ricochet() { if (this.ctx) { this._tone('sine', 3200, 1400, 0.22, 0.04, 0.02); this._noise(0.05, 'bandpass', 2500, 2, 0.08); } }
  _noise(dur, type, f, q, gain, when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.master);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }
  _tone(type, f0, f1, dur, gain, when = 0, attack = 0.005) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  step(surface) {
    if (!this.ctx) return;
    if (surface === 'wood') this._noise(0.07, 'bandpass', 600 + Math.random() * 200, 2, 0.12);
    else if (surface === 'tile') this._noise(0.05, 'bandpass', 2200 + Math.random() * 400, 3, 0.07);
    else { this._noise(0.09, 'bandpass', 900 + Math.random() * 400, 1.2, 0.1); this._noise(0.05, 'highpass', 4000, 1, 0.04); }
  }
  jump() { if (this.ctx) this._noise(0.12, 'lowpass', 500, 1, 0.12); }
  land() { if (this.ctx) this._noise(0.14, 'lowpass', 300, 1, 0.25); }
  punch() { if (!this.ctx) return; this._noise(0.08, 'lowpass', 1200, 1, 0.3); this._tone('sine', 140, 50, 0.12, 0.3); }
  whoosh() { if (this.ctx) this._noise(0.15, 'bandpass', 1500, 0.8, 0.08); }
  gull(near = 1) {
    if (!this.ctx) return;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 1100 + Math.random() * 400;
    for (let i = 0; i < n; i++) {
      const w = i * (0.17 + Math.random() * 0.05);
      this._tone('sawtooth', base * 1.5, base * 0.85, 0.16, 0.035 * near, w, 0.02);
      this._tone('square', base * 0.75, base * 0.42, 0.16, 0.012 * near, w, 0.02);
    }
  }
  squawk() { if (!this.ctx) return; this._tone('sawtooth', 1700, 600, 0.25, 0.06, 0, 0.01); this._noise(0.1, 'bandpass', 2500, 2, 0.08); }
  hurt() { if (!this.ctx) return; this._tone('triangle', 300, 120, 0.25, 0.15); this._noise(0.12, 'lowpass', 900, 1, 0.2); }
  pickup() { if (!this.ctx) return; this._tone('sine', 880, 880, 0.12, 0.12); this._tone('sine', 1320, 1320, 0.2, 0.1, 0.08); }
  coin() { if (!this.ctx) return; this._tone('triangle', 1568, 1568, 0.08, 0.08); this._tone('triangle', 2093, 2093, 0.16, 0.08, 0.07); }
  splash() { if (!this.ctx) return; this._noise(0.6, 'lowpass', 1400, 0.7, 0.4); this._noise(0.3, 'highpass', 3000, 1, 0.1, 0.1); }
  door() { if (!this.ctx) return; this._noise(0.25, 'bandpass', 300, 3, 0.08); this._tone('sine', 90, 70, 0.15, 0.06, 0.15); }
  crash() { if (!this.ctx) return; this._noise(0.4, 'lowpass', 2000, 0.6, 0.35); this._tone('square', 120, 40, 0.3, 0.08); }
  bump() { if (!this.ctx) return; this._noise(0.06, 'lowpass', 400, 1, 0.12); }
  fail() { if (!this.ctx) return; [392, 330, 262].forEach((f, i) => this._tone('triangle', f, f * 0.97, 0.35, 0.12, i * 0.22)); }
  jingle() {
    if (!this.ctx) return;
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => { this._tone('triangle', f, f, 0.25, 0.1, i * 0.11); this._tone('sine', f / 2, f / 2, 0.3, 0.08, i * 0.11); });
  }
  // the character switch, after GTA: a whoosh and a deep thud for every step of the sky camera,
  // an airy swell while it glides across town, and a heavier landing
  _sweep(dur, f0, f1, gain, q = 1.2, when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.master);
    s.start(t, Math.random() * 1.2, dur + 0.05);
  }
  switchStep(up = true) {
    if (!this.ctx) return;
    this._sweep(0.32, up ? 350 : 2600, up ? 2600 : 350, 0.22);
    this._tone('sine', 82, 34, 0.45, 0.42, 0.06, 0.004);
    this._tone('triangle', 164, 70, 0.18, 0.08, 0.06, 0.004);
    this._noise(0.05, 'highpass', 5000, 1, 0.05, 0.06);
  }
  switchPan(dur = 1.2) {
    if (!this.ctx) return;
    this._sweep(dur + 0.3, 500, 1400, 0.09, 0.6);
    this._tone('sine', 55, 62, dur + 0.3, 0.12, 0, dur * 0.4);
  }
  switchLand() {
    if (!this.ctx) return;
    this._sweep(0.4, 2200, 300, 0.2);
    this._tone('sine', 70, 30, 0.6, 0.55, 0.12, 0.004);
    this._noise(0.12, 'lowpass', 600, 1, 0.25, 0.12);
    this._tone('triangle', 1320, 1320, 0.08, 0.04, 0.14);
  }
  start2() { if (!this.ctx) return; [440, 554, 659].forEach((f, i) => this._tone('triangle', f, f, 0.18, 0.08, i * 0.08)); }
}
