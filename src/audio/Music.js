// ---------------------------------------------------------------------------
// Music: a tiny look-ahead sequencer that plays a dance's song (choreos.js)
// AND is the master clock of the dance.
//
// Notes are scheduled ~0.2 s ahead on the audio hardware clock, so they are
// sample-accurate even if a frame is late. The game asks `time()` = "which
// moment of the song is coming out of the speakers right now?" and judges
// the moves against that, so music, coach and scoring never drift apart.
// ---------------------------------------------------------------------------

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note -> Hz
const CHORD = { M: [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10] };
const LOOKAHEAD = 0.2;

// drum patterns: 8 eighth notes per bar. k = kick, s = snare / clap, h = hi-hat, o = open hat
const DRUMS = {
  disco: { k: [1, 0, 1, 0, 1, 0, 1, 0], s: [0, 0, 1, 0, 0, 0, 1, 0], h: [0, 0, 0, 0, 0, 0, 0, 0], o: [0, 1, 0, 1, 0, 1, 0, 1] },
  funk: { k: [1, 0, 0, 1, 0, 1, 0, 0], s: [0, 0, 1, 0, 0, 0, 1, 0], h: [1, 1, 1, 1, 1, 1, 1, 1], o: [0, 0, 0, 0, 0, 0, 0, 1] },
  pop: { k: [1, 0, 1, 0, 1, 0, 1, 0], s: [0, 0, 1, 0, 0, 0, 1, 0], h: [1, 1, 1, 1, 1, 1, 1, 1], o: [0, 0, 0, 0, 0, 0, 0, 0] },
};

/** The bar-by-bar plan of a song: which part, which chord, which melody bar. */
export function songBars(choreo) {
  const s = choreo.song;
  const bars = [];
  for (let b = 0; b < choreo.introBars; b++) bars.push({ part: 'intro', chord: s.chords[b % s.chords.length], mbar: b });
  s.parts.forEach((part) => {
    for (let b = 0; b < 4; b++) bars.push({ part, chord: s.chords[b % s.chords.length], mbar: b });
  });
  for (let b = 0; b < choreo.outroBars; b++) bars.push({ part: b === 0 ? 'end' : 'silent', chord: s.chords[0], mbar: 0 });
  return bars;
}

export class Music {
  constructor(sound) {
    this.sound = sound;
    this.timer = null;
    this.playing = false;
    this.paused = false;
    this.offset = (Number(new URLSearchParams(globalThis.location?.search ?? '').get('latency')) || 0) / 1000;
  }

  get ctx() {
    return this.sound.ctx;
  }

  /**
   * Play `choreo`'s song from `from` seconds. With `preview`, loop the first
   * chorus quietly (song menu).
   */
  play(choreo, { from = 0, preview = false } = {}) {
    this.stop();
    this.choreo = choreo;
    this.preview = preview;
    this.bars = songBars(choreo);
    this.stepDur = 60 / choreo.bpm / 2;
    this.totalSteps = this.bars.length * 8;
    if (preview) {
      const first = this.bars.findIndex((b) => b.part === 'chorus');
      this.loop = [Math.max(0, first), 4];
    } else {
      this.loop = null;
    }
    this.step = Math.max(0, Math.ceil(from / this.stepDur));
    this.playing = true;
    this.paused = false;
    if (this.sound.music) this.sound.music.gain.value = preview ? 0.18 : 0.32;
    if (!this.ctx) {
      this.perfStart = performance.now() / 1000 - from;
      return;
    }
    this.startTime = this.ctx.currentTime + 0.12 - from;
    this.nextTime = this.startTime + this.step * this.stepDur;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.paused) this.ctx?.resume(); // pause() suspended the whole audio context
    this.playing = false;
    this.paused = false;
    clearInterval(this.timer);
    this.timer = null;
  }

  pause() {
    if (!this.playing || this.paused) return;
    this.pausedAt = this.time();
    this.paused = true;
    this.ctx?.suspend();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.ctx) this.ctx.resume();
    else this.perfStart = performance.now() / 1000 - this.pausedAt;
  }

  /** Song time (s) of the sound reaching the speakers right now. */
  time() {
    if (!this.playing) return 0;
    if (this.paused) return this.pausedAt;
    if (!this.ctx) return performance.now() / 1000 - this.perfStart - this.offset;
    const ts = this.ctx.getOutputTimestamp?.();
    let now;
    if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
      now = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    } else {
      now = this.ctx.currentTime - (this.ctx.baseLatency || 0) - (this.ctx.outputLatency || 0);
    }
    return now - this.startTime - this.offset;
  }

  schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.playing || this.paused) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (!this.loop && this.step >= this.totalSteps) { clearInterval(this.timer); return; }
      this.playStep(this.step, this.nextTime);
      this.step++;
      this.nextTime += this.stepDur;
    }
  }

  playStep(step, at) {
    const S = this.sound;
    const out = S.music;
    const song = this.choreo.song;
    let barIdx = Math.floor(step / 8);
    if (this.loop) barIdx = this.loop[0] + (barIdx % this.loop[1]);
    const bar = this.bars[barIdx];
    const i = step % 8;
    const d = this.stepDur;
    const [root, quality] = bar.chord;

    if (bar.part === 'silent') return;
    if (bar.part === 'end') {
      if (i === 0) {
        this.kick(at);
        S.noise(2.2, { at, freq: 6000, vol: 0.25, type: 'highpass', out });
        S.tone(NOTE(root - 24), 2.4, { at, type: 'triangle', vol: 0.55, out });
        for (const n of CHORD[quality]) S.tone(NOTE(root + n), 2.6, { at, type: 'sawtooth', vol: 0.05, attack: 0.02, out });
        S.tone(NOTE(root + 12 + CHORD[quality][2]), 2.0, { at, type: song.lead, vol: 0.09, out });
      }
      return;
    }

    // drums
    const P = DRUMS[song.drums];
    if (P.k[i]) this.kick(at);
    if (P.s[i] && (bar.part !== 'intro' || barIdx > 0)) this.snare(at, song.drums);
    if (P.h[i]) S.noise(0.04, { at, freq: 8000, vol: 0.07, type: 'highpass', out });
    if (P.o[i]) S.noise(0.16, { at, freq: 7500, vol: 0.09, type: 'highpass', out });
    if (bar.part === 'chorus' && i === 0 && bar.mbar === 0) S.noise(1.2, { at, freq: 5000, vol: 0.14, type: 'highpass', out });

    // bass
    const b = song.bass[i];
    if (b !== null && b !== undefined) {
      S.tone(NOTE(root - 24 + b), d * 0.85, { at, type: 'triangle', vol: 0.5, out });
      S.tone(NOTE(root - 12 + b), d * 0.6, { at, type: 'square', vol: 0.035, out });
    }
    if (bar.part === 'intro') return;

    // chord stabs on the off-beats
    if (i % 2 === 1) {
      const v = bar.part === 'chorus' ? 0.045 : 0.03;
      for (const n of CHORD[quality]) S.tone(NOTE(root + n), d * 0.7, { at, type: 'sawtooth', vol: v, out });
    }

    // melody
    const mel = song.melody[bar.part];
    const n = mel?.[bar.mbar * 8 + i];
    if (n) {
      const nextRest = !mel[bar.mbar * 8 + i + 1];
      const len = d * (nextRest ? 1.7 : 0.9);
      const v = bar.part === 'chorus' ? 0.11 : 0.08;
      S.tone(NOTE(n), len, { at, type: song.lead, vol: v, out });
      S.tone(NOTE(n + 12), len * 0.8, { at, type: 'triangle', vol: v * 0.35, out });
    }
  }

  kick(at) {
    this.sound.tone(150, 0.16, { at, type: 'sine', vol: 0.9, slide: -105, out: this.sound.music, attack: 0.002 });
  }

  snare(at, style) {
    const S = this.sound;
    const out = S.music;
    if (style === 'funk') {
      S.noise(0.14, { at, freq: 2200, vol: 0.4, out });
      S.tone(190, 0.08, { at, type: 'triangle', vol: 0.3, out });
    } else {
      // hand clap: three quick noise bursts
      for (let r = 0; r < 3; r++) S.noise(r === 2 ? 0.14 : 0.02, { at: at + r * 0.011, freq: 1500, vol: 0.38, q: 1.2, out });
    }
  }
}
