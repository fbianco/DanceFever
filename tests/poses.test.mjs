// Pose geometry and matching: angles, mirror images, camera -> directions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSES, limbDir, limbAngle, mirrorPose, dirsFromLandmarks, poseDirs, BONES } from '../src/dance/poses.js';
import { matchPose, angleBetween } from '../src/dance/Matcher.js';
import { CHOREOS } from '../src/dance/choreos.js';
import { landmarksOf } from './skeleton.mjs';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const perfectBody = (p) => ({ dirs: poseDirs(p), seen: Object.fromEntries(BONES.map((k) => [k, true])) });

test('limb angles: 0 down, 90 outwards, 180 up, on both sides', () => {
  assert.ok(near(limbDir(0, -1).y, 1));
  assert.ok(near(limbDir(90, -1).x, -1));   // screen-left arm points left
  assert.ok(near(limbDir(90, 1).x, 1));     // screen-right arm points right
  assert.ok(near(limbDir(180, 1).y, -1));   // up (y points down)
  for (const a of [-170, -90, -30, 0, 45, 120, 179]) {
    for (const s of [-1, 1]) assert.ok(near(limbAngle(limbDir(a, s), s), a, 1e-9));
  }
});

test('a pose and its mirror image are mirror images', () => {
  const a = poseDirs(POSES.discoR);
  const b = poseDirs(mirrorPose(POSES.discoR));
  assert.ok(near(a.ru.x, -b.lu.x) && near(a.ru.y, b.lu.y));
  assert.ok(near(a.torso.x, -b.torso.x));
});

test('camera landmarks of a pose give back the same directions', () => {
  for (const [name, p] of Object.entries(POSES)) {
    const { dirs, seen } = dirsFromLandmarks(landmarksOf(p), 0.5625);
    const target = poseDirs(p);
    for (const k of BONES) {
      assert.ok(seen[k]);
      assert.ok(angleBetween(dirs[k], target[k]) < 0.01, `${name}.${k}`);
    }
  }
});

test('the score does not depend on where you stand or how big you look', () => {
  const p = POSES.dabR;
  for (const opt of [{ cx: 0.3, size: 0.0015 }, { cx: 0.7, cy: 0.5, size: 0.0025 }]) {
    const body = dirsFromLandmarks(landmarksOf(p, opt), 0.5625);
    assert.ok(matchPose(body, p).score > 0.999);
  }
});

test('the right pose scores 1, the wrong arm scores less, arms down scores 0', () => {
  assert.ok(near(matchPose(perfectBody(POSES.vee), POSES.vee).score, 1));
  const oneArm = perfectBody(POSES.vee);
  oneArm.dirs.ru = limbDir(90, 1);  // right arm 45 degrees off
  const s = matchPose(oneArm, POSES.vee).score;
  assert.ok(s > 0.6 && s < 0.95, String(s));
  assert.ok(matchPose(perfectBody(POSES.rest), POSES.up).score < 0.25);
});

test('legs only count for moves that use them; unseen bones are skipped', () => {
  const body = perfectBody(POSES.vee);
  body.dirs.lt = limbDir(80, -1);
  assert.ok(near(matchPose(body, POSES.vee).score, 1));
  assert.ok(matchPose(body, POSES.star).score < 1);
  const hidden = perfectBody(POSES.star);
  hidden.dirs.lt = limbDir(80, -1);
  hidden.seen.lt = false;
  assert.ok(near(matchPose(hidden, POSES.star).score, 1));
  const noArms = perfectBody(POSES.tee);
  noArms.seen.lu = false;
  assert.equal(matchPose(noArms, POSES.tee).score, 0);
});

test('holding the previous move never earns a PERFECT on the next one', () => {
  for (const c of CHOREOS) {
    for (let i = 1; i < c.moves.length; i++) {
      const a = c.moves[i - 1].pose;
      const b = c.moves[i].pose;
      if (a === b) continue;
      const s = matchPose(perfectBody(POSES[a]), POSES[b]).score;
      assert.ok(s < 0.85, `${c.id}: ${a} -> ${b} = ${s.toFixed(2)}`);
    }
  }
});
