// ---------------------------------------------------------------------------
// poses.js - the geometry of a dance pose.
//
// A pose is described by the DIRECTION of nine bones, never by positions:
//
//   lu / ru  upper arm (shoulder -> elbow)     lt / rt  thigh (hip -> knee)
//   lf / rf  forearm   (elbow -> wrist)        ls / rs  shin  (knee -> ankle)
//   torso    hip centre -> shoulder centre
//
// "l" and "r" mean the SCREEN-left and screen-right side of the mirror
// picture (the coach and your reflection share them), not anatomical sides.
//
// Limb angles are in degrees, measured from "hanging straight down":
//     0 = down,  90 = straight out to the side,  180 = straight up,
//   -90 = across the body (towards the other side).
// So a pose and its mirror image use the same numbers on swapped sides.
// The torso angle is a lean: 0 = upright, + = towards screen-right.
//
// Directions are unit vectors in screen coordinates (x right, y DOWN).
// Pure logic: unit tested in tests/poses.test.mjs.
// ---------------------------------------------------------------------------
import { BODY } from '../config.js';

const RAD = Math.PI / 180;

export const LIMBS = ['lu', 'lf', 'ru', 'rf', 'lt', 'ls', 'rt', 'rs'];
export const BONES = [...LIMBS, 'torso'];
// side of each limb: -1 = screen-left, +1 = screen-right
const SIDE = { lu: -1, lf: -1, lt: -1, ls: -1, ru: 1, rf: 1, rt: 1, rs: 1 };

/** Limb angle (degrees) on side s -> unit vector. */
export function limbDir(deg, s) {
  return { x: s * Math.sin(deg * RAD), y: Math.cos(deg * RAD) };
}

/** Unit vector -> limb angle (degrees, -180..180) on side s. */
export function limbAngle(v, s) {
  return Math.atan2(s * v.x, v.y) / RAD;
}

export function torsoDir(deg) {
  return { x: Math.sin(deg * RAD), y: -Math.cos(deg * RAD) };
}

export function torsoAngle(v) {
  return Math.atan2(v.x, -v.y) / RAD;
}

/** Bone name -> unit direction, for a pose given as angles. */
export function poseDirs(pose) {
  const d = {};
  for (const k of LIMBS) d[k] = limbDir(pose[k], SIDE[k]);
  d.torso = torsoDir(pose.torso);
  return d;
}

// ---- building poses -----------------------------------------------------------
const STANCE = { lt: 6, ls: 3, rt: 6, rs: 3 };

/**
 * arms = [lu, lf, ru, rf]; legs = [lt, ls, rt, rs] or null when the move
 * does not care about the legs (they are then neither judged nor moved).
 */
function P(label, arms, { legs = null, torso = 0 } = {}) {
  const [lu, lf, ru, rf] = arms;
  const l = legs ?? [STANCE.lt, STANCE.ls, STANCE.rt, STANCE.rs];
  return { label, lu, lf, ru, rf, lt: l[0], ls: l[1], rt: l[2], rs: l[3], torso, legs: !!legs };
}

/** The same move seen in a mirror: swap sides, flip the lean. */
export function mirrorPose(p, label = p.label) {
  return {
    label, lu: p.ru, lf: p.rf, ru: p.lu, rf: p.lf,
    lt: p.rt, ls: p.rs, rt: p.lt, rs: p.ls, torso: -p.torso, legs: p.legs,
  };
}

// The move library. Labels are shown on the move cards (kids read them).
const BASE = {
  rest: P('READY', [8, 4, 8, 4]),
  up: P('HANDS UP', [162, 172, 162, 172]),
  vee: P('V', [135, 135, 135, 135]),
  tee: P('PLANE', [90, 90, 90, 90]),
  flex: P('MUSCLES', [92, 178, 92, 178]),
  hips: P('HANDS ON HIPS', [40, -60, 40, -60]),
  clap: P('CLAP HIGH', [155, -125, 155, -125]),
  head: P('HANDS ON HEAD', [135, -120, 135, -120]),
  robot: P('ROBOT', [90, 0, 90, 0]),
  cross: P('CROSS', [25, -100, 25, -100]),
  shrug: P('SHRUG', [18, 95, 18, 95]),
  star: P('STAR', [135, 135, 135, 135], { legs: [26, 26, 26, 26] }),
  discoR: P('DISCO', [40, -60, 148, 152], { torso: 6 }),
  diagR: P('DISCO DOWN', [40, -60, -40, -45], { torso: -6 }),
  zigR: P('ZIG ZAG', [90, 0, 90, 180]),
  reachR: P('REACH', [8, 4, 176, 178], { torso: 6 }),
  pointR: P('POINT', [40, -60, 95, 95], { torso: 10 }),
  waveR: P('HELLO', [8, 4, 100, 172]),
  dabR: P('DAB', [-130, -125, 125, 125], { torso: 8 }),
  windR: P('WIND', [-140, -140, 130, 130], { torso: 14 }),
  // the arms of the leg moves differ left / right too: legs weigh less than
  // arms, so the two sides must not look alike from the waist up
  kickR: P('KICK', [150, 155, 90, 90], { legs: [4, 2, 42, 42], torso: -8 }),
  // knee lifted to the SIDE: a knee lifted forwards points at the camera and
  // looks almost the same as a straight leg in a flat picture
  kneeR: P('FLAMINGO', [40, -60, 150, 160], { legs: [4, 2, 75, 5], torso: -8 }),
};

export const POSES = { ...BASE };
// every "...R" move also exists as "...L" (its mirror image)
for (const [k, p] of Object.entries(BASE)) {
  if (k.endsWith('R')) POSES[k.slice(0, -1) + 'L'] = mirrorPose(p);
}

// ---- interpolation (the coach moving between poses) ---------------------------
function lerpAngle(a, b, t) {
  let d = ((b - a + 540) % 360) - 180; // shortest way round
  return a + d * t;
}

export function blendPoses(a, b, t) {
  const out = { label: t < 0.5 ? a.label : b.label, legs: t < 0.5 ? a.legs : b.legs };
  for (const k of BONES) out[k] = lerpAngle(a[k], b[k], t);
  return out;
}

// ---- forward kinematics: directions -> joint positions -------------------------
/**
 * Build a skeleton from bone directions (unit vectors) with the canonical
 * body proportions. The hip centre is at (0, 0), y points down.
 * Returns named joints in logical pixels (multiply by `scale`).
 */
export function skeletonFromDirs(d, scale = 1) {
  const L = BODY;
  const k = scale;
  const t = d.torso;
  const n = { x: -t.y, y: t.x };           // perpendicular to the torso (towards screen-right)
  const hip = { x: 0, y: 0 };
  const neck = { x: t.x * L.torso * k, y: t.y * L.torso * k };
  const add = (p, v, len) => ({ x: p.x + v.x * len * k, y: p.y + v.y * len * k });
  const sL = add(neck, n, -L.shoulderHalf);
  const sR = add(neck, n, L.shoulderHalf);
  const hL = add(hip, n, -L.hipHalf);
  const hR = add(hip, n, L.hipHalf);
  const eL = add(sL, d.lu, L.upperArm);
  const eR = add(sR, d.ru, L.upperArm);
  const wL = add(eL, d.lf, L.foreArm);
  const wR = add(eR, d.rf, L.foreArm);
  const kL = add(hL, d.lt, L.thigh);
  const kR = add(hR, d.rt, L.thigh);
  const aL = add(kL, d.ls, L.shin);
  const aR = add(kR, d.rs, L.shin);
  const head = add(neck, t, L.neck + L.head * 0.8);
  return { hip, neck, head, sL, sR, hL, hR, eL, eR, wL, wR, kL, kR, aL, aR, up: t, side: n };
}

export function skeletonFromPose(pose, scale = 1) {
  return skeletonFromDirs(poseDirs(pose), scale);
}

// ---- camera landmarks -> bone directions ---------------------------------------
// MediaPipe pose landmark indices. MediaPipe's "left" is the person's own
// left, which appears on the SCREEN-left of a mirrored camera picture.
export const LM = {
  NOSE: 0, L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16, L_HIP: 23, R_HIP: 24, L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
};

// bone -> [from, to] landmark
export const BONE_LM = {
  lu: [LM.L_SHOULDER, LM.L_ELBOW], lf: [LM.L_ELBOW, LM.L_WRIST],
  ru: [LM.R_SHOULDER, LM.R_ELBOW], rf: [LM.R_ELBOW, LM.R_WRIST],
  lt: [LM.L_HIP, LM.L_KNEE], ls: [LM.L_KNEE, LM.L_ANKLE],
  rt: [LM.R_HIP, LM.R_KNEE], rs: [LM.R_KNEE, LM.R_ANKLE],
};

/**
 * Landmarks (x, y in 0..1 of the raw, un-mirrored camera image) -> unit
 * bone directions in mirrored screen space, plus whether each bone was
 * seen clearly enough to be judged. `aspect` = image height / width, so
 * that x and y use the same physical unit.
 */
export function dirsFromLandmarks(lm, aspect = 0.5625, minVis = 0.5) {
  const P = (i) => ({ x: 1 - lm[i].x, y: lm[i].y * aspect, v: lm[i].visibility ?? 1 });
  const dirs = {};
  const seen = {};
  const unit = (a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  };
  for (const [k, [i, j]] of Object.entries(BONE_LM)) {
    const a = P(i);
    const b = P(j);
    dirs[k] = unit(a, b);
    seen[k] = a.v >= minVis && b.v >= minVis;
  }
  const mid = (i, j) => { const a = P(i); const b = P(j); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) }; };
  const hips = mid(LM.L_HIP, LM.R_HIP);
  const sh = mid(LM.L_SHOULDER, LM.R_SHOULDER);
  dirs.torso = unit(hips, sh);
  seen.torso = hips.v >= minVis && sh.v >= minVis;
  return { dirs, seen };
}
