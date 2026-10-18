// ---------------------------------------------------------------------------
// BodyReader: one player's 33 camera landmarks  ->  a "body" for the game.
//
//   1. smooth the landmarks a little (exponential moving average), because
//      the network's guesses jitter by a few pixels from frame to frame;
//   2. turn them into bone DIRECTIONS in the mirrored picture
//      (poses.js dirsFromLandmarks) - that is all the dance judge needs;
//   3. note which hand is raised above the head (menu control).
//
// Output: { present, dirs, seen, leftUp, rightUp, points }
// Pure logic: tested in tests/body.test.mjs with synthetic skeletons.
// ---------------------------------------------------------------------------
import { MATCH } from '../config.js';
import { LM, dirsFromLandmarks } from '../dance/poses.js';

const USED = Object.values(LM);

export class BodyReader {
  constructor(cfg = MATCH) {
    this.cfg = cfg;
    this.smooth = null;
    this.out = { present: false, dirs: null, seen: null, leftUp: false, rightUp: false, points: null };
  }

  update(landmarks, aspect = 0.5625) {
    const o = this.out;
    const vis = (i) => landmarks?.[i]?.visibility ?? 1;
    if (!landmarks || vis(LM.L_SHOULDER) < this.cfg.minVisibility || vis(LM.R_SHOULDER) < this.cfg.minVisibility) {
      this.smooth = null;
      o.present = false;
      o.leftUp = o.rightUp = false;
      o.points = null;
      return o;
    }
    const a = this.cfg.smoothing;
    const prev = this.smooth;
    const s = new Array(33);
    for (const i of USED) {
      const p = landmarks[i];
      const q = prev?.[i];
      s[i] = q
        ? { x: q.x + (p.x - q.x) * a, y: q.y + (p.y - q.y) * a, visibility: vis(i) }
        : { x: p.x, y: p.y, visibility: vis(i) };
    }
    this.smooth = s;
    const { dirs, seen } = dirsFromLandmarks(s, aspect, this.cfg.minVisibility);
    o.present = true;
    o.dirs = dirs;
    o.seen = seen;
    o.points = s;
    // a hand is "up" when the wrist is above the nose. MediaPipe's left hand
    // is on the screen-left of the mirror picture.
    const up = (w) => s[w].visibility > 0.3 && s[w].y < s[LM.NOSE].y;
    o.leftUp = up(LM.L_WRIST);
    o.rightUp = up(LM.R_WRIST);
    return o;
  }
}
