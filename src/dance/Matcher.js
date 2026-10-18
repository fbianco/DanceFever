// ---------------------------------------------------------------------------
// Matcher: "how close is the dancer to the target pose?"  ->  0..1
//
// For every bone we compare two unit vectors: the direction measured on the
// dancer and the direction of the target pose. Their dot product is the
// cosine of the angle between them (cos 0 = 1 = same direction):
//
//      angle = acos(u . v)
//      bone score = 1 below MATCH.perfectAngle, 0 above MATCH.zeroAngle,
//                   linear in between
//
// The pose score is the weighted mean over the bones that the camera saw
// (legs only when the move uses them). Since only directions are compared,
// it does not matter where you stand, how tall you are or how far you are
// from the camera. Pure logic: unit tested in tests/matcher.test.mjs.
// ---------------------------------------------------------------------------
import { MATCH } from '../config.js';
import { BONES, poseDirs } from './poses.js';

const WEIGHT_OF = {
  lu: 'upperArm', ru: 'upperArm', lf: 'foreArm', rf: 'foreArm',
  lt: 'thigh', rt: 'thigh', ls: 'shin', rs: 'shin', torso: 'torso',
};
const LEGS = new Set(['lt', 'ls', 'rt', 'rs']);

export function angleBetween(u, v) {
  const dot = Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y));
  return (Math.acos(dot) * 180) / Math.PI;
}

export function boneScore(angleDeg, cfg = MATCH) {
  return Math.max(0, Math.min(1, (cfg.zeroAngle - angleDeg) / (cfg.zeroAngle - cfg.perfectAngle)));
}

/**
 * body = { dirs, seen } (see dirsFromLandmarks), pose = angles from poses.js
 * (its directions are cached on the object). Returns { score, bones, used }.
 */
export function matchPose(body, pose, cfg = MATCH) {
  const target = pose._dirs ?? (pose._dirs = poseDirs(pose));
  const bones = {};
  let sum = 0;
  let wsum = 0;
  let used = 0;
  for (const k of BONES) {
    if (LEGS.has(k) && !pose.legs) continue;
    if (!body.seen[k]) continue;
    const s = boneScore(angleBetween(body.dirs[k], target[k]), cfg);
    const w = cfg.weights[WEIGHT_OF[k]];
    bones[k] = s;
    sum += s * w;
    wsum += w;
    used++;
  }
  // without at least the two upper arms there is nothing meaningful to judge
  if (!body.seen.lu || !body.seen.ru) return { score: 0, bones, used: 0 };
  return { score: wsum ? sum / wsum : 0, bones, used };
}
