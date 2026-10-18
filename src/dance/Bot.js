// ---------------------------------------------------------------------------
// Bot: an AUTO dancer that copies the coach a little late and a little
// sloppily. Used by the ?demo mode, when there is no camera, and by tests.
// It produces the same { present, dirs, seen } body as the camera does.
//
// Its mistakes drift slowly (each bone sways on its own sine wave) like a
// real person's, instead of jittering randomly from frame to frame.
// ---------------------------------------------------------------------------
import { BONES, poseDirs } from './poses.js';

export class Bot {
  /** skill 0..1: 1 = almost perfect, 0 = clumsy. */
  constructor(skill = 0.8, seed = 1) {
    this.skill = skill;
    this.seed = seed;
    this.sway = BONES.map(() => ({ f: 0.6 + this.rand() * 1.2, ph: this.rand() * 6.28 }));
    this.out = { present: true, dirs: null, seen: Object.fromEntries(BONES.map((k) => [k, true])), leftUp: false, rightUp: false };
  }

  rand() {
    // small deterministic generator, so tests are repeatable
    this.seed = (this.seed * 16807 + 1) % 2147483647;
    return this.seed / 2147483647;
  }

  update(session, t) {
    const lag = 0.12 + (1 - this.skill) * 0.2;
    const d = poseDirs(session.coachPose(t - lag));
    const wobble = 6 + (1 - this.skill) * 70;
    BONES.forEach((k, i) => {
      const s = this.sway[i];
      const a = wobble * Math.sin(t * s.f + s.ph) * (Math.PI / 180);
      const { x, y } = d[k];
      d[k] = { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
    });
    this.out.dirs = d;
    return this.out;
  }
}
