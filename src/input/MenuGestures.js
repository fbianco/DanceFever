// ---------------------------------------------------------------------------
// MenuGestures: choosing things with your hands, no mouse needed.
//
//   screen-left hand up  (hold MENU.oneHandHold)    -> "prev"  (repeats)
//   screen-right hand up                            -> "next"  (repeats)
//   both hands up        (hold MENU.bothHandsHold)  -> "ok"    (once)
//
// While raising both hands one of them is always up first, so a single hand
// only counts after a short hold, and after "ok" nothing fires again until
// both hands have come down.
// Pure logic: tested in tests/body.test.mjs.
// ---------------------------------------------------------------------------
import { MENU } from '../config.js';

export class MenuGestures {
  constructor(cfg = MENU) {
    this.cfg = cfg;
    this.reset();
  }

  reset() {
    this.side = null;          // 'prev' | 'next' | 'both' | null
    this.since = 0;
    this.lastFire = 0;
    this.locked = false;       // after "ok": wait until the hands are down
    this.progress = 0;         // 0..1 of the both-hands hold (for the UI)
  }

  /** Returns 'prev' | 'next' | 'ok' | null. t in seconds. */
  update(leftUp, rightUp, t) {
    const now = leftUp && rightUp ? 'both' : leftUp ? 'prev' : rightUp ? 'next' : null;
    if (!now) this.locked = false;
    if (now !== this.side) {
      this.side = now;
      this.since = t;
      this.lastFire = -Infinity;
    }
    this.progress = 0;
    if (!now || this.locked) return null;
    const held = t - this.since;
    if (now === 'both') {
      this.progress = Math.min(1, held / this.cfg.bothHandsHold);
      if (held >= this.cfg.bothHandsHold) {
        this.locked = true;
        this.progress = 0;
        return 'ok';
      }
      return null;
    }
    if (held >= this.cfg.oneHandHold && t - this.lastFire >= this.cfg.repeatEvery) {
      this.lastFire = t;
      return now;
    }
    return null;
  }
}
