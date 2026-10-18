// Reading a camera skeleton and the hand-raising menu controls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BodyReader } from '../src/input/BodyReader.js';
import { MenuGestures } from '../src/input/MenuGestures.js';
import { POSES } from '../src/dance/poses.js';
import { matchPose } from '../src/dance/Matcher.js';
import { landmarksOf } from './skeleton.mjs';

test('reader: hands up, sides as seen in the mirror', () => {
  const r = new BodyReader();
  let o = r.update(landmarksOf(POSES.up));
  assert.ok(o.present && o.leftUp && o.rightUp);
  const r2 = new BodyReader();
  o = r2.update(landmarksOf(POSES.waveR)); // screen-right hand up
  assert.ok(!o.leftUp && o.rightUp);
  assert.ok(matchPose(o, POSES.waveR).score > 0.99);
});

test('reader: nobody, or shoulders hidden = not present', () => {
  const r = new BodyReader();
  assert.equal(r.update(null).present, false);
  const lm = landmarksOf(POSES.rest);
  lm[11].visibility = 0.1;
  assert.equal(r.update(lm).present, false);
});

test('menu: one hand = prev / next after a short hold, repeating', () => {
  const m = new MenuGestures();
  const fired = [];
  for (let t = 0; t < 2.5; t += 1 / 30) {
    const e = m.update(true, false, t);
    if (e) fired.push([e, t]);
  }
  assert.equal(fired[0][0], 'prev');
  assert.ok(fired[0][1] >= 0.35 && fired[0][1] < 0.4);
  assert.ok(fired.length >= 2 && fired.length <= 3);
});

test('menu: raising both hands one after the other gives ok, not prev', () => {
  const m = new MenuGestures();
  const fired = [];
  for (let t = 0; t < 3; t += 1 / 30) {
    const e = m.update(true, t > 0.2, t);
    if (e) fired.push(e);
  }
  assert.deepEqual(fired, ['ok']);
});

test('menu: lowering the hands after ok does not fire again', () => {
  const m = new MenuGestures();
  const fired = [];
  for (let t = 0; t < 1.5; t += 1 / 30) { const e = m.update(true, true, t); if (e) fired.push(e); }
  for (let t = 1.5; t < 2.5; t += 1 / 30) { const e = m.update(true, false, t); if (e) fired.push(e); } // one hand still up
  for (let t = 2.5; t < 3; t += 1 / 30) { const e = m.update(false, false, t); if (e) fired.push(e); }
  for (let t = 3; t < 3.6; t += 1 / 30) { const e = m.update(false, true, t); if (e) fired.push(e); }
  assert.deepEqual(fired, ['ok', 'next']);
});
