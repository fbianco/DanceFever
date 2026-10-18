// ---------------------------------------------------------------------------
// Session: one dance from the first beat to the final pose.
//
// Inputs every game tick: the song time (seconds, from the music clock) and,
// per player, the body seen by the camera ({ present, dirs, seen } or null).
//
//   move i is "on" at time T_i (a beat of the song).
//   window i = [T_i - early, T_i + late], cut short so it never overlaps the
//              next move's window.
//   while the window is open we keep the BEST match of each player;
//   when it closes the move gets a rating -> points, combo, an event.
//
// It also answers "what is the coach doing right now?" (coachPose), which is
// the same choreography seen as a smooth animation.
// Pure logic: unit tested in tests/session.test.mjs.
// ---------------------------------------------------------------------------
import { JUDGE, MATCH } from '../config.js';
import { POSES, blendPoses } from './poses.js';
import { matchPose } from './Matcher.js';

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function rate(score, judge = JUDGE) {
  return judge.ratings.find((r) => score >= r.min);
}

export class Session {
  /** choreo: see choreos.js. seats: array of player indices dancing (e.g. [0] or [0, 1]). */
  constructor(choreo, seats, judge = JUDGE, match = MATCH) {
    this.choreo = choreo;
    this.judge = judge;
    this.match = match;
    this.beat = 60 / choreo.bpm;
    this.moves = choreo.moves.map((m) => ({ ...m, t: m.beat * this.beat, pose: POSES[m.pose] }));
    this.moves.forEach((m, i) => {
      const next = this.moves[i + 1];
      m.open = m.t - judge.early;
      m.close = next ? Math.max(m.t + 0.15, Math.min(m.t + judge.late, next.t - judge.early)) : m.t + judge.late;
    });
    this.duration = choreo.totalBeats * this.beat;
    this.players = seats.map((seat) => ({
      seat, score: 0, combo: 0, bestCombo: 0,
      counts: Object.fromEntries(judge.ratings.map((r) => [r.name, 0])),
      best: new Map(),         // move index -> best score so far in its window
      live: 0,                 // match against the coach right now (for the meter)
      liveBones: {},
      results: [],             // per move: rating name
    }));
    this.next = 0;             // first move not judged yet
    this.events = [];
    this.maxScore = this.computeMaxScore();
    this.time = 0;
  }

  points(rating, gold, combo) {
    const bonus = 1 + Math.min(combo, this.judge.comboMax) * this.judge.comboStep;
    return Math.round(rating.points * (gold ? this.judge.goldFactor : 1) * bonus);
  }

  computeMaxScore(first = 0) {
    const top = this.judge.ratings[0];
    let sum = 0;
    this.moves.slice(first).forEach((m, i) => { sum += this.points(top, m.gold, i); });
    return sum;
  }

  /** Start in the middle of the song: moves that already began are not judged. */
  skipTo(t) {
    const i = this.moves.findIndex((m) => m.open >= t);
    this.next = i < 0 ? this.moves.length : i;
    this.maxScore = Math.max(1, this.computeMaxScore(this.next));
    this.players.forEach((p) => { for (let k = 0; k < this.next; k++) p.results.push(null); });
  }

  get finished() {
    return this.time >= this.duration;
  }

  /** Index of the move the coach is currently heading to or holding. */
  currentMove(t = this.time) {
    let i = 0;
    while (i < this.moves.length - 1 && this.moves[i + 1].t - this.beat * 0.5 <= t) i++;
    return i;
  }

  /**
   * The coach holds each pose for a little while after its beat, then glides
   * into the next one, arriving exactly on the next beat.
   */
  coachPose(t = this.time) {
    const ms = this.moves;
    const rest = POSES.rest;
    if (!ms.length) return rest;
    if (t <= ms[0].t) {
      const u = clamp01(1 - (ms[0].t - t) / this.beat);
      return blendPoses(rest, ms[0].pose, smooth(u));
    }
    for (let i = 0; i < ms.length - 1; i++) {
      if (t < ms[i + 1].t) {
        const span = ms[i + 1].t - ms[i].t;
        const u = (t - ms[i].t) / span;
        const hold = span > this.beat * 1.5 ? 0.45 : 0.25;
        return blendPoses(ms[i].pose, ms[i + 1].pose, smooth(clamp01((u - hold) / (1 - hold))));
      }
    }
    const last = ms[ms.length - 1];
    const u = clamp01((t - last.t - this.beat) / this.beat);
    return blendPoses(last.pose, POSES.up, smooth(u)); // final "ta-da"
  }

  /** bodies[k] = body of this.players[k] (or null). Returns new events. */
  update(t, bodies) {
    this.time = t;
    this.events = [];
    const ms = this.moves;

    // live meter: how well does each player follow the move that is on now
    const cur = ms[this.currentMove(t)];
    this.players.forEach((p, k) => {
      const b = bodies[k];
      const m = b?.present ? matchPose(b, cur.pose, this.match) : { score: 0, bones: {} };
      p.live += (m.score - p.live) * 0.25;
      p.liveBones = m.bones;
    });

    // collect the best match inside each open window
    for (let i = this.next; i < ms.length && ms[i].open <= t; i++) {
      if (t > ms[i].close) continue;
      this.players.forEach((p, k) => {
        const b = bodies[k];
        if (!b?.present) return;
        const s = matchPose(b, ms[i].pose, this.match).score;
        if (s > (p.best.get(i) ?? -1)) p.best.set(i, s);
      });
    }

    // close finished windows -> ratings
    while (this.next < ms.length && t > ms[this.next].close) {
      const i = this.next;
      const m = ms[i];
      this.players.forEach((p) => {
        const s = p.best.get(i) ?? 0;
        p.best.delete(i);
        const r = rate(s, this.judge);
        const hit = r.points > 0;
        const pts = hit ? this.points(r, m.gold, p.combo) : 0;
        p.combo = hit ? p.combo + 1 : 0;
        p.bestCombo = Math.max(p.bestCombo, p.combo);
        p.score += pts;
        p.counts[r.name]++;
        p.results.push(r.name);
        this.events.push({ seat: p.seat, move: i, rating: r, points: pts, gold: m.gold, combo: p.combo, score: s });
      });
      this.next++;
    }
    return this.events;
  }

  stars(p) {
    const f = p.score / this.maxScore;
    return this.judge.stars.filter((s) => f >= s).length;
  }
}
