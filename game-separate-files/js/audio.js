'use strict';
// All sound is synthesised at runtime. The tunes here are original compositions.
const Sfx = {
  ac: null, master: null, musicBus: null, muted: false,
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = new AC();
      this.master = this.ac.createGain(); this.master.gain.value = .55; this.master.connect(this.ac.destination);
      this.musicBus = this.ac.createGain(); this.musicBus.gain.value = .5; this.musicBus.connect(this.master);
      const rate = this.ac.sampleRate; this.noiseBuf = this.ac.createBuffer(1, rate, rate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < rate; i++) d[i] = Math.random() * 2 - 1;
      Music.start();
    } catch (e) { this.ac = null; }
  },
  tone(f, dur, type = 'square', vol = .15, slide = 0, delay = 0, bus) {
    if (!this.ac) return;
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), v = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(v); v.connect(bus || this.master); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol = .2, freq = 1200, type = 'lowpass', delay = 0, bus) {
    if (!this.ac) return;
    const t = this.ac.currentTime + delay, s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), v = this.ac.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq;
    v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(v); v.connect(bus || this.master); s.start(t, Math.random() * .8); s.stop(t + dur + .02);
  },
  play(n) {
    if (!this.ac || this.muted) return;
    const T = (...a) => this.tone(...a), N = (...a) => this.noise(...a);
    switch (n) {
      case 'move': T(520, .04, 'square', .05); break;
      case 'ok': T(660, .06, 'square', .08); T(990, .09, 'square', .07, 0, .05); break;
      case 'back': T(440, .08, 'square', .07, -160); break;
      case 'denied': T(170, .15, 'sawtooth', .1); break;
      case 'blip': T(rand(420, 480), .025, 'triangle', .05); break;
      case 'hit': N(.12, .32, 2400); T(170, .1, 'square', .12, -90); break;
      case 'perfect': N(.14, .35, 3600); T(880, .1, 'square', .13); T(1320, .17, 'triangle', .14, 0, .05); break;
      case 'block': T(300, .09, 'square', .16, 200); N(.07, .2, 5000, 'highpass'); break;
      case 'hurt': N(.2, .35, 900); T(120, .2, 'sawtooth', .13, -60); break;
      case 'swing': N(.1, .12, 4500, 'bandpass'); break;
      case 'surge': T(220, .5, 'sawtooth', .1, 660); N(.45, .13, 3000, 'bandpass'); break;
      case 'heal': [523, 659, 784, 1047].forEach((f, i) => T(f, .25, 'sine', .1, 0, i * .07)); break;
      case 'seal': T(1400, .08, 'square', .11); N(.15, .25, 6000, 'highpass'); T(700, .2, 'triangle', .13, 500, .05); break;
      case 'stun': [900, 650, 900, 650].forEach((f, i) => T(f, .08, 'square', .09, 0, i * .06)); break;
      case 'charge': T(90, .7, 'sawtooth', .13, 220); break;
      case 'win': [523, 659, 784, 659, 784, 1047].forEach((f, i) => T(f, .2, 'triangle', .13, 0, i * .11)); break;
      case 'thunder': N(1.5, .4, 260); N(.25, .25, 1800, 'lowpass', .02); break;
      case 'oath': [131, 196, 262, 392, 523, 784].forEach((f, i) => T(f, 1.8, 'sawtooth', .07, 0, i * .22)); N(2.4, .15, 2400, 'bandpass'); break;
      case 'chest': [392, 523, 659, 784].forEach((f, i) => T(f, .18, 'square', .08, 0, i * .08)); break;
      case 'stairs': N(.2, .15, 900); T(200, .2, 'triangle', .1, 200); break;
      case 'step': N(.03, .025, 800); break;
      case 'bigfx': N(1, .4, 700); T(70, 1, 'sawtooth', .18, 220); break;
    }
  }
};

const NOTE = (st, base = 220) => base * Math.pow(2, st / 12);
// Each pattern row: step length in beats, then melody / bass arrays in semitones; null = rest.
const TUNES = {
  title: { bpm: 66, wave: 'triangle', pad: true, base: 220, mel: [12, null, 7, 10, null, 15, 14, null, 10, null, 7, 5, 7, null, null, null, 12, null, 15, 17, null, 19, 17, 15, 14, null, 10, null, 12, null, null, null], bass: [-12, -12, -16, -16, -9, -9, -14, -14], chord: [[0, 7, 12], [-4, 3, 8], [-9, -2, 3], [-5, 2, 7]] },
  field: { bpm: 88, wave: 'triangle', pad: true, base: 247, mel: [0, 3, 7, null, 10, 7, 3, null, 5, 7, 8, null, 7, 5, 3, null, 0, 3, 7, 12, 10, null, 7, null, 5, 3, 2, null, 0, null, null, null], bass: [-12, -19, -15, -17, -12, -19, -17, -12], chord: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-5, -2, 2]] },
  town: { bpm: 96, wave: 'square', pad: true, vol: .035, base: 262, mel: [7, 9, 12, null, 9, 7, 4, null, 5, 7, 9, 7, 5, 4, 2, null, 4, 7, 9, 12, 14, 12, 9, 7, 9, null, 7, 4, 2, null, 0, null], bass: [-12, -5, -7, -5, -12, -5, -10, -5], chord: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]] },
  deep: { bpm: 62, wave: 'sine', pad: true, base: 196, mel: [0, null, null, 3, null, 2, null, null, -2, null, null, 0, null, 7, null, null, 8, null, 7, null, 3, null, 2, null, 0, null, null, null, -5, null, null, null], bass: [-12, -12, -14, -14, -16, -16, -19, -19], chord: [[0, 3, 10], [-2, 2, 7], [-4, 0, 8], [-7, 0, 5]] },
  vault: { bpm: 58, wave: 'triangle', pad: true, base: 330, mel: [0, null, 6, null, 7, null, null, 3, null, 1, null, null, 0, null, null, null, 6, null, 7, null, 10, null, 9, null, 6, null, 3, null, 1, null, null, null], bass: [-24, -24, -18, -18, -17, -17, -23, -23], chord: [[0, 6, 11], [-1, 3, 10], [1, 6, 8], [-3, 3, 9]] },
  shadesmar: { bpm: 52, wave: 'sine', pad: true, base: 392, mel: [12, 7, 3, null, 2, 7, 10, null, 14, null, 10, 7, 8, null, null, null, 15, 12, 8, null, 7, 3, 2, null, 0, null, 3, null, 2, null, null, null], bass: [-24, -24, -20, -20, -17, -17, -19, -19], chord: [[0, 7, 15], [-4, 8, 15], [-7, 5, 12], [-5, 7, 14]] },
  battle: { bpm: 148, wave: 'square', vol: .04, base: 220, drums: true, mel: [0, null, 3, 5, 7, null, 5, 3, 7, 8, 7, 5, 3, null, 2, null, 0, null, 3, 7, 10, null, 8, 7, 5, 7, 8, 10, 12, null, 10, null], bass: [-12, -12, -12, -12, -16, -16, -14, -14, -12, -12, -12, -12, -9, -9, -14, -14], chord: null },
  boss: { bpm: 164, wave: 'sawtooth', vol: .035, base: 196, drums: true, mel: [0, 1, 0, null, 7, 6, 7, null, 10, null, 8, 7, 6, null, 7, null, 12, 10, 8, 7, 8, 7, 6, 3, 1, null, 3, null, 0, null, null, null], bass: [-12, -12, -11, -11, -12, -12, -5, -5, -12, -12, -11, -11, -9, -9, -7, -7], chord: null },
  oath: { bpm: 72, wave: 'triangle', pad: true, base: 262, mel: [0, 4, 7, 12, null, 11, 7, null, 9, null, 12, 14, 16, null, null, null, 17, 16, 14, 12, null, 14, null, 11, 12, null, null, null, null, null, null, null], bass: [-12, -12, -7, -7, -15, -15, -8, -8], chord: [[0, 4, 7], [-5, 2, 7], [-3, 0, 4], [-8, -1, 4]] },
  none: null
};
const Music = {
  cur: 'none', step: 0, next: 0, timer: null,
  play(name) { if (this.cur === name) return; this.cur = name; this.step = 0; if (Sfx.ac) this.next = Sfx.ac.currentTime + .1; },
  start() {
    if (this.timer) return;
    this.next = Sfx.ac.currentTime + .1;
    this.timer = setInterval(() => this.tick(), 70);
  },
  tick() {
    const ac = Sfx.ac, tu = TUNES[this.cur];
    if (!ac || !tu || Sfx.muted) { if (ac) this.next = ac.currentTime + .1; return; }
    const stepDur = 60 / tu.bpm / 2, bus = Sfx.musicBus;
    if (this.next < ac.currentTime - .4) this.next = ac.currentTime + .05;
    while (this.next < ac.currentTime + .25) {
      const d = Math.max(0, this.next - ac.currentTime), s = this.step, m = tu.mel[s % tu.mel.length];
      if (m !== null) Sfx.tone(NOTE(m, tu.base), stepDur * (tu.pad ? 2.2 : 1.1), tu.wave, tu.vol || .06, 0, d, bus);
      const barLen = tu.pad ? 4 : 2;
      if (s % barLen === 0) {
        const b = tu.bass[Math.floor(s / barLen) % tu.bass.length];
        Sfx.tone(NOTE(b, tu.base), stepDur * barLen * .95, 'triangle', .13, 0, d, bus);
      }
      if (tu.chord && s % 8 === 0) {
        const ch = tu.chord[Math.floor(s / 8) % tu.chord.length];
        for (const n of ch) Sfx.tone(NOTE(n, tu.base / 2), stepDur * 8.2, 'sine', .035, 0, d, bus);
      }
      if (tu.drums) {
        if (s % 4 === 0) Sfx.tone(100, .1, 'sine', .22, -60, d, bus);
        if (s % 4 === 2) Sfx.noise(.08, .1, 3000, 'highpass', d, bus);
        if (s % 2 === 1) Sfx.noise(.03, .035, 8000, 'highpass', d, bus);
      }
      this.next += stepDur; this.step++;
    }
  }
};
