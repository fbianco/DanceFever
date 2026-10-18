// ---------------------------------------------------------------------------
// Sound: every effect is synthesised live with the Web Audio API
// (oscillators + noise), like the sound chip of an 8-bit computer.
// No audio files needed. Music.js plays the songs through the same context.
// Effects take a stereo pan: player 1's sounds come from the left speaker,
// player 2's from the right.
// ---------------------------------------------------------------------------

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.7;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.32;
      this.music.connect(this.master);
      this.pans = new Map();
      for (const p of [-0.6, 0, 0.6]) {
        const node = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
        if (node.pan) node.pan.value = p;
        node.connect(this.sfx);
        this.pans.set(p, node);
      }
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      console.warn('No Web Audio', e);
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }

  bus(pan) {
    return this.pans.get(pan) ?? this.pans.get(0);
  }

  /** A note. `at` = absolute context time (default: now + delay). */
  tone(freq, dur, { type = 'square', vol = 0.25, slide = 0, delay = 0, at, out, attack = 0.008 } = {}) {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out ?? this.bus(0));
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.3, freq = 1800, delay = 0, at, out, sweep = 0, type = 'bandpass', q = 1 } = {}) {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq + sweep, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out ?? this.bus(0));
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  play(name, pan = 0) {
    if (!this.ctx) return;
    const out = this.bus(pan);
    const arp = (notes, gap, opt = {}) => notes.forEach((f, i) => this.tone(f, opt.dur ?? 0.1, { delay: i * gap, vol: 0.15, out, ...opt }));
    switch (name) {
      case 'perfect':
        arp([1047, 1319, 1568, 2093], 0.04, { type: 'triangle', dur: 0.12, vol: 0.16 });
        this.noise(0.25, { freq: 7000, vol: 0.08, out });
        break;
      case 'good': arp([880, 1175, 1397], 0.045, { type: 'triangle', dur: 0.1, vol: 0.13 }); break;
      case 'ok': arp([660, 880], 0.05, { type: 'triangle', dur: 0.09, vol: 0.1 }); break;
      case 'miss': this.tone(220, 0.18, { type: 'sine', vol: 0.12, slide: -80, out }); break;
      case 'gold':
        arp([1047, 1319, 1568, 2093, 2637, 3136], 0.035, { type: 'square', dur: 0.12, vol: 0.09 });
        this.noise(0.6, { freq: 6000, sweep: 3000, vol: 0.12, out });
        break;
      case 'tick': this.tone(990, 0.05, { type: 'square', vol: 0.08, out }); break;
      case 'select': arp([523, 784, 1047], 0.06, { dur: 0.12 }); break;
      case 'join': arp([523, 784], 0.1, { dur: 0.14 }); break;
      case 'ready': arp([659, 880, 1319], 0.08, { type: 'triangle', dur: 0.14 }); break;
      case 'count': this.tone(880, 0.12, { vol: 0.16 }); break;
      case 'go': arp([1047, 1568], 0.08, { dur: 0.3, vol: 0.16 }); break;
      case 'star': this.tone(1568 + Math.random() * 400, 0.2, { type: 'triangle', vol: 0.15, out }); break;
      case 'cheer':
        for (let i = 0; i < 6; i++) this.noise(1.4, { freq: 1200 + i * 300, vol: 0.06, delay: i * 0.05, q: 0.6 });
        arp([523, 659, 784, 1047, 1319], 0.1, { dur: 0.25, vol: 0.14 });
        break;
      default: break;
    }
  }
}
