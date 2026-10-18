// Synthetic MediaPipe skeletons shared by the tests.
import { skeletonFromPose, LM } from '../src/dance/poses.js';

// pose(): a person standing facing the camera (same helper as Unicorn Run,
// used by the player-assignment tests).
// cx = shoulder centre x, shY = shoulder y (0..1 of the image), sw = shoulder width.
export function pose({ cx = 0.5, shY = 0.4, sw = 0.2, handsUp = false } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: cx, y: shY, visibility: 0.99 }));
  lm[0] = { x: cx, y: shY - 0.15, visibility: 0.99 };                 // nose
  lm[11] = { x: cx + sw / 2, y: shY, visibility: 0.99 };              // left shoulder (image right)
  lm[12] = { x: cx - sw / 2, y: shY, visibility: 0.99 };
  const wristY = handsUp ? shY - 0.3 : shY + 0.3;
  lm[15] = { x: cx + sw * 0.7, y: wristY, visibility: 0.95 };
  lm[16] = { x: cx - sw * 0.7, y: wristY, visibility: 0.95 };
  lm[23] = { x: cx + sw * 0.35, y: shY + 0.3, visibility: 0.9 };
  lm[24] = { x: cx - sw * 0.35, y: shY + 0.3, visibility: 0.9 };
  return lm;
}

/**
 * 33 landmarks of a person doing a dance pose, as MediaPipe would report
 * them: raw (un-mirrored) image coordinates 0..1. size = image widths per
 * logical body pixel, so 0.002 ~ a person 0.5 image widths tall.
 */
export function landmarksOf(p, { cx = 0.5, cy = 0.6, size = 0.002, aspect = 0.5625 } = {}) {
  const s = skeletonFromPose(p, 1);
  const put = (j) => ({ x: 1 - (cx + j.x * size), y: (cy + j.y * size) / aspect, visibility: 0.95 });
  const lm = Array.from({ length: 33 }, () => put(s.neck));
  lm[LM.NOSE] = put(s.head);
  lm[LM.L_SHOULDER] = put(s.sL); lm[LM.R_SHOULDER] = put(s.sR);
  lm[LM.L_ELBOW] = put(s.eL); lm[LM.R_ELBOW] = put(s.eR);
  lm[LM.L_WRIST] = put(s.wL); lm[LM.R_WRIST] = put(s.wR);
  lm[LM.L_HIP] = put(s.hL); lm[LM.R_HIP] = put(s.hR);
  lm[LM.L_KNEE] = put(s.kL); lm[LM.R_KNEE] = put(s.kR);
  lm[LM.L_ANKLE] = put(s.aL); lm[LM.R_ANKLE] = put(s.aR);
  return lm;
}
