// ---------------------------------------------------------------------------
// Renderer: draws one frame from the current app state. It only *reads* the
// game (plus its own eye candy: rating pop-ups and confetti).
//
//   lobby    two seats: join (both hands up), pick a dancer, get ready
//   songs    three dance cards, the coach previews each choreography
//   dance    coach in the middle, the players' avatars copy their bodies,
//            move cards slide towards the "now" box, scores on top
//   results  stars, counts, winner
//
// Everything is drawn in a fixed 1280 x 720 logical space; one transform
// scales it to the window and the screen's pixel density. Clickable areas
// are recorded while drawing (`buttons`) so the mouse works too.
// ---------------------------------------------------------------------------
import { VIEW_W, VIEW_H, PLAYERS, AVATARS, FONT, GAME_TITLE, STUDIO, JUDGE, KEYS } from '../config.js';
import { POSES, poseDirs, blendPoses, BONES } from '../dance/poses.js';
import { Stage, hexA } from './Stage.js';
import { Particles } from './Particles.js';
import { drawAvatar, drawCoach, drawPicto } from './avatars.js';

const UI = 'system-ui, "Segoe UI", sans-serif';
const DANCE_FLOOR = 560;
const STRIP = { x: 400, y: 604, w: 480, h: 104, hitX: 455 };
const REST_DIRS = poseDirs(POSES.rest);
const DIFFICULTY = ['', 'EASY', 'MEDIUM', 'HARD'];
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** A looping little dance (menus, results): a new pose every 2 beats. */
function loopPose(list, beat) {
  const n = list.length;
  const i = Math.floor(beat / 2);
  const u = (beat / 2) % 1;
  return blendPoses(POSES[list[((i % n) + n) % n]], POSES[list[(((i + 1) % n) + n) % n]], smooth(clamp01((u - 0.4) / 0.6)));
}

const keyName = (code) => ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[code] ?? code.replace('Key', ''));

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ratio = 1;
    this.stage = new Stage();
    this.fx = new Particles();
    this.popups = [];
    this.buttons = [];
    this.lastTime = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const scale = Math.max(0.2, Math.min(box.width / VIEW_W, box.height / VIEW_H));
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    this.canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
    this.canvas.width = Math.floor(VIEW_W * scale * dpr);
    this.canvas.height = Math.floor(VIEW_H * scale * dpr);
    this.ratio = scale * dpr;
    this.stage.setRatio(Math.min(2, this.ratio));
  }

  /** Which button is at logical (x, y)? */
  hit(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.action;
    }
    return null;
  }

  button(x, y, w, h, action) {
    this.buttons.push({ x, y, w, h, action });
  }

  // ---- reacting to the dance ----------------------------------------------------
  onJudged(ev) {
    const x = PLAYERS[ev.seat].x;
    const r = ev.rating;
    this.popups.push({ seat: ev.seat, text: r.name === 'PERFECT' ? 'PERFECT!' : r.name, color: r.color, age: 0, gold: ev.gold && r.points > 0 });
    if (r.name === 'PERFECT') this.fx.burst(x, 300, ev.gold ? 70 : 28, { speed: 380 });
    else if (r.name === 'GOOD') this.fx.burst(x, 300, 10, { colors: [r.color, '#ffffff'], speed: 250 });
    if (ev.gold && r.points > 0) this.fx.burst(x, 260, 50, { colors: ['#ffd23f', '#fff27a', '#ffffff'], speed: 460, up: 300 });
  }

  clearEffects() {
    this.popups = [];
    this.fx.clear();
  }

  // ---- frame ------------------------------------------------------------------------
  render(app) {
    const ctx = this.ctx;
    const dt = this.lastTime === null ? 0 : Math.min(0.1, app.time - this.lastTime);
    this.lastTime = app.time;
    this.fx.update(dt);
    for (const p of this.popups) p.age += dt;
    this.popups = this.popups.filter((p) => p.age < 1.1);
    this.buttons = [];

    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.textBaseline = 'alphabetic';
    if (app.screen === 'dance') this.drawDance(app);
    else if (app.screen === 'songs') this.drawSongs(app);
    else if (app.screen === 'results') this.drawResults(app);
    else this.drawLobby(app);
    this.fx.draw(ctx);
    if (app.paused) this.drawPause(app);
  }

  // ---- text helpers -----------------------------------------------------------------
  text(s, x, y, { size = 16, color = '#fff', align = 'center', ui = false, shadow = null, alpha = 1 } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = ui ? `bold ${size}px ${UI}` : `${size}px ${FONT}`;
    ctx.textAlign = align;
    if (shadow) {
      ctx.fillStyle = shadow;
      ctx.fillText(s, x + Math.max(2, size * 0.1), y + Math.max(2, size * 0.1));
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  wrap(s, x, y, maxW, lineH, opts) {
    const ctx = this.ctx;
    ctx.font = `bold ${opts.size}px ${UI}`;
    const words = s.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        this.text(line, x, yy, { ...opts, ui: true });
        line = w;
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) this.text(line, x, yy, { ...opts, ui: true });
  }

  title(s, y, size) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(s).width;
    const g = ctx.createLinearGradient(VIEW_W / 2 - w / 2, 0, VIEW_W / 2 + w / 2, 0);
    ['#ff4fd8', '#fff27a', '#36e0ff'].forEach((c, i) => g.addColorStop(i / 2, c));
    ctx.fillStyle = '#3a0a52';
    ctx.fillText(s, VIEW_W / 2 + size * 0.1, y + size * 0.1);
    ctx.fillStyle = g;
    ctx.fillText(s, VIEW_W / 2, y);
    ctx.restore();
  }

  panel(x, y, w, h, { fill = 'rgba(16,4,34,0.78)', stroke = null, lw = 4, dash = null, r = 22 } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      if (dash) ctx.setLineDash(dash);
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    ctx.restore();
  }

  bar(x, y, w, h, f, color, back = 'rgba(255,255,255,0.15)') {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fillStyle = back;
    ctx.fill();
    if (f > 0) {
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * clamp01(f)), h, h / 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
  }

  arrow(x, y, dir, color, size = 26) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + dir * size, y);
    ctx.lineTo(x - dir * size * 0.6, y - size);
    ctx.lineTo(x - dir * size * 0.6, y + size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  star(x, y, r, fill, stroke = null) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  // ---- lobby --------------------------------------------------------------------------
  drawLobby(app) {
    const beat = app.time * (112 / 60);
    this.stage.draw(this.ctx, beat, 0.6);
    this.title(GAME_TITLE, 82, 54);
    this.text('1 or 2 dancers  ·  stand 2 to 3 metres from the camera', VIEW_W / 2, 122, { size: 20, ui: true, color: '#e8dcff' });
    app.seats.forEach((seat, i) => this.drawSeat(app, seat, i, beat));

    if (app.lobbyStartIn !== null) {
      const n = Math.ceil(app.lobbyStartIn);
      this.text('SONGS IN', VIEW_W / 2, 320, { size: 18, color: '#fff27a' });
      this.text(String(n), VIEW_W / 2, 400, { size: 60, color: '#fff27a', shadow: '#ff4fd8' });
    }
    const cam = app.cam;
    this.text(cam.message, VIEW_W / 2, 612, { size: 18, ui: true, color: cam.ready ? '#7cffb2' : cam.error ? '#ff9fd0' : '#bfefff' });
    this.text(`ENTER go  ·  ESC reset  ·  M mute  ·  V camera panel  ·  ${STUDIO}`, VIEW_W / 2, 700, { size: 15, ui: true, color: 'rgba(255,255,255,0.55)' });
  }

  drawSeat(app, seat, i, beat) {
    const P = PLAYERS[i];
    const cx = i === 0 ? 320 : 960;
    const x0 = cx - 200;
    const y0 = 148;
    this.panel(x0, y0, 400, 420, { stroke: P.color, dash: seat.joined ? null : [14, 10], fill: seat.joined ? 'rgba(16,4,34,0.82)' : 'rgba(16,4,34,0.55)' });
    this.text(`PLAYER ${i + 1}`, cx, y0 + 42, { size: 20, color: P.color });
    const ctx = this.ctx;
    const keys = KEYS[i];
    const floor = y0 + 312;

    if (!seat.joined) {
      // ghost dancer waving its arms up and down
      const u = (Math.sin(app.time * 3 + i) + 1) / 2;
      drawCoach(ctx, blendPoses(POSES.rest, POSES.up, u), cx, floor, 0.95, { main: '#6b5a8a', glow: '#b9a8d9' }, { alpha: 0.6 });
      this.text('RAISE BOTH HANDS', cx, y0 + 352, { size: 15 });
      this.text('TO JOIN', cx, y0 + 376, { size: 15 });
      if (seat.joinProgress > 0) this.bar(cx - 120, y0 + 386, 240, 12, seat.joinProgress, P.color);
      else this.text(`or press ${keyName(keys.ok[0])} · or click here`, cx, y0 + 402, { size: 15, ui: true, color: 'rgba(255,255,255,0.6)' });
      this.button(x0, y0, 400, 420, `join${i}`);
      return;
    }

    const A = AVATARS[seat.avatar];
    const pose = seat.ready ? loopPose(['vee', 'hips', 'discoR', 'discoL', 'up', 'clap'], beat) : loopPose(['rest', 'hips', 'rest', 'shrug'], beat * 0.5);
    const bounce = Math.abs(Math.sin(beat * Math.PI)) * (seat.ready ? 10 : 4);
    drawAvatar(ctx, A, poseDirs(pose), cx, floor + 4, 0.9, app.time, { bounce });
    this.text(A.name, cx, y0 + 354, { size: 24, color: A.outfit, shadow: '#000' });

    if (!seat.ready) {
      for (const [dir, label, key, act] of [[-1, 'LEFT HAND', keys.prev[0], 'prev'], [1, 'RIGHT HAND', keys.next[0], 'next']]) {
        const ax = cx + dir * 148;
        const lit = seat.flash?.[act] > 0;
        this.arrow(ax, y0 + 200, dir, lit ? '#ffffff' : P.color, lit ? 30 : 24);
        this.text(label, ax, y0 + 250, { size: 12, ui: true, color: '#e8dcff' });
        this.text(`(${keyName(key)})`, ax, y0 + 268, { size: 13, ui: true, color: 'rgba(255,255,255,0.55)' });
        this.button(ax - 40, y0 + 160, 80, 120, `${act}${i}`);
      }
      this.text('BOTH HANDS UP = READY', cx, y0 + 384, { size: 11, color: '#fff27a' });
      this.bar(cx - 120, y0 + 396, 240, 12, seat.okProgress, '#fff27a');
      this.button(cx - 120, y0 + 330, 240, 90, `ok${i}`);
    } else {
      this.text('READY!', cx, y0 + 392, { size: 20, color: '#7cffb2', shadow: '#0a3a20' });
      this.text('one hand up = change dancer', cx, y0 + 410, { size: 13, ui: true, color: 'rgba(255,255,255,0.55)' });
      this.button(x0, y0 + 60, 400, 360, `unready${i}`);
    }
    if (seat.mode === 'bot') this.text('AUTO', x0 + 360, y0 + 42, { size: 12, color: '#bfefff' });
  }

  // ---- song choice ------------------------------------------------------------------
  drawSongs(app) {
    const cur = app.choreos[app.songIndex];
    const beat = app.time * (cur.bpm / 60);
    this.stage.draw(this.ctx, beat, 0.8);
    this.title('CHOOSE A DANCE', 70, 34);
    app.choreos.forEach((c, i) => this.drawSongCard(app, c, i, i === app.songIndex));

    const okP = Math.max(0, ...app.seats.filter((s) => s.joined).map((s) => s.okProgress));
    this.text('◀ LEFT HAND', 250, 600, { size: 14, color: '#e8dcff' });
    this.text('RIGHT HAND ▶', 1030, 600, { size: 14, color: '#e8dcff' });
    this.text('BOTH HANDS UP = DANCE!', VIEW_W / 2, 600, { size: 16, color: '#fff27a' });
    this.bar(VIEW_W / 2 - 160, 614, 320, 12, okP, '#fff27a');
    this.text('keys: ← → / A D choose  ·  ENTER dance  ·  ESC back', VIEW_W / 2, 700, { size: 15, ui: true, color: 'rgba(255,255,255,0.55)' });
    // the dancers who joined, small, in the bottom corners
    app.seats.forEach((s, i) => {
      if (!s.joined) return;
      const pose = loopPose(['hips', 'vee', 'hips', 'up'], beat);
      drawAvatar(this.ctx, AVATARS[s.avatar], poseDirs(pose), i === 0 ? 56 : 1224, 708, 0.42, app.time, { bounce: Math.abs(Math.sin(beat * Math.PI)) * 6 });
    });
  }

  drawSongCard(app, c, i, selected) {
    const ctx = this.ctx;
    const cx = 250 + i * 390;
    const w = 340;
    const h = 430;
    const y0 = 118;
    ctx.save();
    if (selected) {
      const s = 1.05 + Math.sin(app.time * 4) * 0.008;
      ctx.translate(cx, y0 + h / 2);
      ctx.scale(s, s);
      ctx.translate(-cx, -(y0 + h / 2));
    } else {
      ctx.globalAlpha = 0.55;
    }
    this.panel(cx - w / 2, y0, w, h, { stroke: selected ? c.coach.main : 'rgba(255,255,255,0.25)', lw: selected ? 6 : 3, fill: 'rgba(16,4,34,0.85)' });
    this.text(c.title, cx, y0 + 46, { size: 18, color: c.coach.main, shadow: '#000' });
    this.text(DIFFICULTY[c.difficulty], cx - 40, y0 + 82, { size: 13, color: '#ffffff' });
    for (let k = 0; k < 3; k++) {
      this.star(cx + 52 + k * 26, y0 + 76, 11, k < c.difficulty ? '#fff27a' : 'rgba(255,255,255,0.2)');
    }
    // the coach previews the moves of this dance
    const beat = app.time * (c.bpm / 60);
    const names = c.moves.map((m) => m.pose);
    const pose = selected ? loopPose(names.slice(0, 16), beat) : POSES[names[0]];
    drawCoach(ctx, pose, cx, y0 + 312, 0.82, c.coach, { bounce: selected ? Math.abs(Math.sin(beat * Math.PI)) * 6 : 0 });
    const secs = Math.round(c.totalBeats * 60 / c.bpm);
    this.text(`${c.bpm} BPM · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · ${c.moves.length} moves`, cx, y0 + 350, { size: 16, ui: true, color: '#bfefff' });
    this.wrap(c.blurb, cx, y0 + 382, w - 40, 22, { size: 16, color: '#ffffff' });
    ctx.restore();
    this.button(cx - w / 2, y0, w, h, `song${i}`);
  }

  // ---- dance ---------------------------------------------------------------------------
  drawDance(app) {
    const ctx = this.ctx;
    const S = app.session;
    const t = app.songTime;
    const beat = t / S.beat;
    const playing = t > 0 && t < S.duration;
    this.stage.draw(ctx, beat, playing ? 1 : 0.4, { ball: true });

    // coach
    const mi = S.currentMove(t);
    const move = S.moves[mi];
    const goldSoon = move.gold && t > move.t - S.beat * 2.5 && t < move.close;
    const bounce = playing ? Math.abs(Math.sin(beat * Math.PI)) * 8 : 0;
    if (goldSoon) {
      const g = ctx.createRadialGradient(VIEW_W / 2, 380, 20, VIEW_W / 2, 380, 260);
      g.addColorStop(0, 'rgba(255,210,63,0.45)');
      g.addColorStop(1, 'rgba(255,210,63,0)');
      ctx.fillStyle = g;
      ctx.fillRect(VIEW_W / 2 - 260, 120, 520, 460);
    }
    drawCoach(ctx, S.coachPose(t), VIEW_W / 2, DANCE_FLOOR, 1.42, goldSoon ? { main: '#ffd23f', glow: '#fffbd0' } : S.choreo.coach, { bounce });
    if (goldSoon) this.text('GOLD MOVE!', VIEW_W / 2, 186, { size: 22, color: '#ffd23f', shadow: '#5a3a00' });

    // players
    S.players.forEach((p) => this.drawDancer(app, p, beat));
    this.drawStrip(app, S, t);
    this.drawTopHud(app, S, t);
    this.drawPopups();

    // countdown before the first move
    const first = S.moves[0].t;
    const left = (first - t) / S.beat;
    if (left > 0 && left <= 4) {
      const n = Math.ceil(left);
      const f = n - left;
      const s = 70 + f * 30;
      this.text(n === 1 ? 'DANCE!' : String(n - 1), VIEW_W / 2, 360, { size: n === 1 ? 54 : s, color: '#fff27a', shadow: '#ff4fd8', alpha: 1 - f * 0.6 });
    } else if (t < first - S.beat * 4) {
      this.text('GET READY!', VIEW_W / 2, 360, { size: 40, color: '#ffffff', shadow: '#ff4fd8' });
    }
  }

  drawDancer(app, p, beat) {
    const ctx = this.ctx;
    const seat = app.seats[p.seat];
    const P = PLAYERS[p.seat];
    const A = AVATARS[seat.avatar];
    const body = seat.body;
    let dirs = REST_DIRS;
    if (body?.present && body.dirs) {
      // bones the camera cannot see (legs out of the picture) stand normally
      dirs = {};
      for (const k of BONES) dirs[k] = body.seen[k] ? body.dirs[k] : REST_DIRS[k];
    }
    const present = !!body?.present;
    // glow under the avatar = how well you follow right now
    const g = ctx.createRadialGradient(P.x, DANCE_FLOOR, 10, P.x, DANCE_FLOOR, 120);
    const col = p.live > 0.7 ? '#7cffb2' : p.live > 0.45 ? '#fff27a' : '#ff7a9c';
    g.addColorStop(0, hexA(col, 0.25 + p.live * 0.4));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(P.x - 130, DANCE_FLOOR - 60, 260, 100);
    drawAvatar(ctx, A, dirs, P.x, DANCE_FLOOR, 1.08, app.time, { alpha: present ? 1 : 0.35 });
    if (!present) {
      this.panel(P.x - 130, 330, 260, 64, { fill: 'rgba(16,4,34,0.85)', stroke: P.color, lw: 3, r: 14 });
      this.text('STEP INTO', P.x, 357, { size: 14 });
      this.text('THE CAMERA', P.x, 382, { size: 14 });
    }
    // live match meter
    this.bar(P.x - 100, DANCE_FLOOR + 14, 200, 12, p.live, col);
  }

  drawStrip(app, S, t) {
    const ctx = this.ctx;
    const { x, y, w, h, hitX } = STRIP;
    this.panel(x, y, w, h, { fill: 'rgba(10,2,24,0.75)', stroke: 'rgba(255,255,255,0.2)', lw: 2, r: 16 });
    const pxPerSec = 92 * (S.choreo.bpm / 60);
    const size = 84;
    // the "now" box
    this.panel(hitX - size / 2 - 6, y + h / 2 - size / 2 - 6, size + 12, size + 12, { fill: 'rgba(255,255,255,0.08)', stroke: '#ffffff', lw: 4, r: 14 });
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.clip();
    const cur = S.currentMove(t);
    for (let i = Math.max(0, cur - 2); i < Math.min(S.moves.length, cur + 8); i++) {
      const m = S.moves[i];
      const cx = hitX + (m.t - t) * pxPerSec;
      if (cx < x - size || cx > x + w + size) continue;
      const done = i < S.next;
      const fade = cx < hitX ? clamp01(1 - (hitX - cx) / 120) : 1;
      ctx.globalAlpha = fade;
      const top = y + h / 2 - size / 2;
      this.panel(cx - size / 2, top, size, size, {
        fill: m.gold ? 'rgba(255,210,63,0.3)' : 'rgba(255,255,255,0.1)',
        stroke: m.gold ? '#ffd23f' : 'rgba(255,255,255,0.6)', lw: 3, r: 12,
      });
      drawPicto(ctx, m.pose, cx, top + size / 2, size - 14, m.gold ? '#ffe680' : '#ffffff', m.pose.legs ? '#7cd8ff' : 'rgba(255,255,255,0.45)');
      if (done) {
        S.players.forEach((p, k) => {
          const r = JUDGE.ratings.find((q) => q.name === p.results[i]);
          ctx.fillStyle = r?.color ?? '#fff';
          ctx.beginPath();
          ctx.arc(cx + (k - (S.players.length - 1) / 2) * 18, top + size - 8, 6, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // name of the move that is coming
    const m = S.moves[cur];
    this.text(m.pose.label, hitX, y - 10, { size: 13, color: m.gold ? '#ffd23f' : '#ffffff', shadow: '#000' });
  }

  drawTopHud(app, S, t) {
    this.text(S.choreo.title, VIEW_W / 2, 30, { size: 14, color: S.choreo.coach.main, shadow: '#000' });
    this.bar(VIEW_W / 2 - 180, 42, 360, 10, clamp01(t / S.duration), S.choreo.coach.main);
    S.players.forEach((p) => {
      const P = PLAYERS[p.seat];
      const A = AVATARS[app.seats[p.seat].avatar];
      const left = p.seat === 0;
      const x0 = left ? 20 : VIEW_W - 320;
      this.panel(x0, 14, 300, 92, { stroke: P.color, lw: 3, r: 16 });
      const ax = left ? x0 + 18 : x0 + 282;
      const align = left ? 'left' : 'right';
      this.text(`${P.label} ${A.name}${app.seats[p.seat].mode === 'bot' ? ' (AUTO)' : ''}`, ax, 42, { size: 13, color: P.color, align });
      this.text(String(p.score).padStart(6, '0'), ax, 80, { size: 26, color: '#ffffff', align, shadow: '#000' });
      if (p.combo >= 3) {
        const cx = left ? x0 + 282 : x0 + 18;
        this.text(`x${p.combo}`, cx, 70, { size: 16, color: '#fff27a', align: left ? 'right' : 'left' });
        this.text('COMBO', cx, 92, { size: 10, color: '#fff27a', align: left ? 'right' : 'left' });
      }
    });
  }

  drawPopups() {
    for (const p of this.popups) {
      const x = PLAYERS[p.seat].x;
      const u = p.age / 1.1;
      const pop = p.age < 0.12 ? 0.6 + (p.age / 0.12) * 0.6 : 1.2 - Math.min(0.2, (p.age - 0.12));
      const size = Math.round((p.text.length > 6 ? 26 : 30) * pop);
      const y = 230 - u * 40;
      this.text(p.text, x, y, { size, color: p.color, shadow: '#1b0b2e', alpha: 1 - Math.max(0, u - 0.6) / 0.4 });
      if (p.gold) this.text('GOLD!', x, y + 34, { size: 16, color: '#ffd23f', shadow: '#1b0b2e', alpha: 1 - u });
    }
  }

  // ---- results ---------------------------------------------------------------------------
  drawResults(app) {
    const ctx = this.ctx;
    const S = app.session;
    const beat = app.time * (S.choreo.bpm / 60);
    this.stage.draw(ctx, beat, 0.7);
    ctx.fillStyle = 'rgba(10,2,24,0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const since = app.time - app.resultsAt;
    this.title('WELL DANCED!', 76, 40);
    this.text(S.choreo.title, VIEW_W / 2, 112, { size: 16, color: S.choreo.coach.main });

    const ps = S.players;
    const best = Math.max(...ps.map((p) => p.score));
    const tie = ps.length === 2 && ps[0].score === ps[1].score;
    ps.forEach((p, k) => {
      const cx = ps.length === 1 ? VIEW_W / 2 : k === 0 ? 350 : 930;
      const P = PLAYERS[p.seat];
      const A = AVATARS[app.seats[p.seat].avatar];
      this.panel(cx - 240, 136, 480, 468, { stroke: P.color });
      const win = ps.length === 2 && p.score === best;
      if (ps.length === 2) {
        this.text(tie ? 'DRAW!' : win ? 'WINNER!' : 'GREAT TRY!', cx, 174, { size: 20, color: win ? '#ffd23f' : '#bfefff', shadow: '#000' });
      }
      const pose = loopPose(win || ps.length === 1 ? ['up', 'vee', 'clap', 'vee'] : ['hips', 'shrug', 'hips', 'waveR'], beat);
      drawAvatar(ctx, A, poseDirs(pose), cx, 418, 0.8, app.time, { bounce: Math.abs(Math.sin(beat * Math.PI)) * 8 });
      const shown = Math.round(p.score * clamp01(since / 1.5));
      this.text(`${P.label} ${A.name}`, cx, 450, { size: 14, color: P.color });
      this.text(String(shown).padStart(6, '0'), cx, 490, { size: 32, color: '#ffffff', shadow: '#000' });
      const stars = S.stars(p);
      for (let i = 0; i < 5; i++) {
        const on = i < stars && since > 1.5 + i * 0.3;
        this.star(cx - 120 + i * 60, 526, 22, on ? '#fff27a' : 'rgba(255,255,255,0.15)', on ? '#ff9f1c' : null);
      }
      const c = p.counts;
      this.text(`PERFECT ${c.PERFECT}  ·  GOOD ${c.GOOD}  ·  OK ${c.OK}  ·  MISS ${c.MISS}`, cx, 568, { size: 17, ui: true, color: '#e8dcff' });
      this.text(`best combo ${p.bestCombo}`, cx, 592, { size: 15, ui: true, color: 'rgba(255,255,255,0.65)' });
    });

    const okP = Math.max(0, ...app.seats.filter((s) => s.joined).map((s) => s.okProgress));
    this.panel(250, 622, 360, 64, { stroke: '#fff27a', lw: 3, r: 16 });
    this.text('DANCE AGAIN', 430, 650, { size: 16, color: '#fff27a' });
    this.text('both hands up · ENTER', 430, 674, { size: 14, ui: true, color: '#e8dcff' });
    this.bar(270, 628, 320, 6, okP, '#fff27a', 'rgba(0,0,0,0)');
    this.button(250, 622, 360, 64, 'again');
    this.panel(670, 622, 360, 64, { stroke: '#36e0ff', lw: 3, r: 16 });
    this.text('OTHER SONG', 850, 650, { size: 16, color: '#36e0ff' });
    this.text('one hand up · ESC', 850, 674, { size: 14, ui: true, color: '#e8dcff' });
    this.button(670, 622, 360, 64, 'songs');
  }

  drawPause(app) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,2,24,0.7)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.text('PAUSED', VIEW_W / 2, 330, { size: 44, color: '#fff27a', shadow: '#ff4fd8' });
    this.text(app.pauseReason || 'press P to continue  ·  ESC to stop', VIEW_W / 2, 390, { size: 20, ui: true });
  }
}

