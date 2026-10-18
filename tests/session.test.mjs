// Whole dances, simulated at 60 updates per second.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHOREOS } from '../src/dance/choreos.js';
import { POSES, poseDirs, BONES } from '../src/dance/poses.js';
import { Session } from '../src/dance/Session.js';
import { Bot } from '../src/dance/Bot.js';
import { songBars } from '../src/audio/Music.js';

function run(choreo, bodiesAt) {
  const s = new Session(choreo, [0, 1]);
  const events = [];
  for (let t = -0.5; t <= s.duration + 0.1; t += 1 / 60) events.push(...s.update(t, bodiesAt(s, t)));
  return { s, events };
}

const still = (p) => ({ present: true, dirs: poseDirs(p), seen: Object.fromEntries(BONES.map((k) => [k, true])) });

test('every move is judged exactly once per player', () => {
  for (const c of CHOREOS) {
    const { s, events } = run(c, () => [null, null]);
    assert.equal(events.length, c.moves.length * 2);
    for (const p of s.players) {
      assert.equal(p.counts.MISS, c.moves.length);
      assert.equal(p.score, 0);
      assert.equal(s.stars(p), 0);
    }
  }
});

test('a good dancer beats a sloppy one, and copying the coach exactly is (almost) perfect', () => {
  for (const c of CHOREOS) {
    const good = new Bot(1, 3);
    const bad = new Bot(0.15, 5);
    const { s } = run(c, (sess, t) => [good.update(sess, t), bad.update(sess, t)]);
    const [g, b] = s.players;
    assert.ok(g.score > b.score, `${c.id}: ${g.score} vs ${b.score}`);
    assert.ok(g.counts.PERFECT + g.counts.GOOD >= c.moves.length * 0.9, `${c.id}: ${JSON.stringify(g.counts)}`);
    assert.ok(s.stars(g) >= 4, `${c.id} stars ${s.stars(g)}`);
    assert.ok(g.score <= s.maxScore);
  }
});

test('standing still with arms down scores badly', () => {
  for (const c of CHOREOS) {
    const { s } = run(c, () => [still(POSES.rest), null]);
    assert.ok(s.stars(s.players[0]) <= 1, `${c.id}: ${s.players[0].score} / ${s.maxScore}`);
  }
});

test('combo grows with hits and resets on a miss', () => {
  const c = CHOREOS[0];
  const s = new Session(c, [0]);
  const m0 = s.moves[0];
  const m1 = s.moves[1];
  s.update(m0.t, [still(m0.pose)]);
  let ev = s.update(m0.close + 0.01, [null]);
  assert.equal(ev[0].rating.name, 'PERFECT');
  assert.equal(ev[0].combo, 1);
  ev = s.update(m1.close + 0.01, [null]);
  assert.equal(ev[0].rating.name, 'MISS');
  assert.equal(s.players[0].combo, 0);
  assert.equal(s.players[0].bestCombo, 1);
});

test('judging windows never overlap, and the music is as long as the dance', () => {
  for (const c of CHOREOS) {
    const s = new Session(c, [0]);
    for (let i = 1; i < s.moves.length; i++) assert.ok(s.moves[i - 1].close <= s.moves[i].open + 1e-9, `${c.id} move ${i}`);
    assert.equal(songBars(c).length * 4, c.totalBeats);
    assert.equal(c.song.parts.length, c.form.length);
    for (const m of c.moves) assert.ok(POSES[m.pose], `${c.id}: unknown pose ${m.pose}`);
  }
});

test('the coach reaches each pose exactly on its beat', () => {
  const c = CHOREOS[1];
  const s = new Session(c, [0]);
  for (const m of s.moves) {
    const p = s.coachPose(m.t);
    for (const k of BONES) assert.ok(Math.abs(p[k] - m.pose[k]) < 1e-6 || Math.abs(Math.abs(p[k] - m.pose[k]) - 360) < 1e-6);
  }
});
