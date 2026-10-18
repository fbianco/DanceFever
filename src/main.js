// ---------------------------------------------------------------------------
// main.js - wires everything together and runs the loop.
//
//   camera -> PoseTracker -> PlayerAssigner -+-> BodyReader P1 -+-> MenuGestures (menus)
//                (2 skeletons)               +-> BodyReader P2 -+-> Session (dance judge) -> Renderer
//   keyboard / mouse ------------------------------------------/        ^                    Sound
//                                                       Music clock ----/
//
// App screens: boot (click: camera + sound) -> lobby (join, pick a dancer)
// -> songs (pick a dance) -> dance -> results -> again / other song.
// The game logic runs at a fixed 60 updates per second; drawing happens once
// per frame. During a dance the clock is the MUSIC (Music.time()), not the
// frame counter, so the judge always agrees with what you hear.
// ---------------------------------------------------------------------------
import { AVATARS, KEYS, MENU, PLAYERS, VIEW_W, VIEW_H } from './config.js';
import { CHOREOS } from './dance/choreos.js';
import { Session } from './dance/Session.js';
import { Bot } from './dance/Bot.js';
import { Renderer } from './render/Renderer.js';
import { Sound } from './audio/Sound.js';
import { Music } from './audio/Music.js';
import { Keyboard } from './input/Keyboard.js';
import { PlayerAssigner } from './input/PlayerAssigner.js';
import { PoseTracker, scoreColor } from './input/PoseTracker.js';
import { BodyReader } from './input/BodyReader.js';
import { MenuGestures } from './input/MenuGestures.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const sound = new Sound();
const music = new Music(sound);
const renderer = new Renderer($('game'));
const keyboard = new Keyboard(window);
const assigner = new PlayerAssigner();
const pose = new PoseTracker($('cam'), $('cam-overlay'));

// one seat per player. mode: 'body' = camera, 'bot' = AUTO dancer (no camera / demo)
const seats = [0, 1].map((i) => ({
  joined: false, ready: false, avatar: i, mode: 'body',
  reader: new BodyReader(), menu: new MenuGestures(), bot: null,
  body: null, lm: null, joinProgress: 0, okProgress: 0,
  flash: { prev: 0, next: 0 }, missingSince: null,
}));

const app = {
  screen: 'boot',
  time: 0,
  seats,
  choreos: CHOREOS,
  songIndex: 0,
  session: null,
  songTime: 0,
  paused: false,
  pauseReason: '',
  lobbyStartIn: null,
  resultsAt: 0,
  cam: { ready: false, error: false, message: 'Camera off' },
};

const clicks = [];
let countdownShown = null;
let starsPlayed = 0;

// ---- boot: one click is needed by browsers to allow sound -------------------
$('boot-btn').addEventListener('click', () => {
  $('boot').classList.add('hidden');
  sound.init();
  sound.play('select');
  app.screen = 'lobby';
  startPose();
});

async function startPose() {
  setStatus();
  await pose.start();
  setStatus();
}

function setStatus() {
  app.cam.ready = pose.ready;
  app.cam.error = pose.status === 'error';
  app.cam.message = pose.message;
  const el = $('cam-status');
  el.textContent = pose.message;
  el.className = pose.ready ? 'ok' : pose.status === 'error' ? 'err' : '';
  $('cam-panel').classList.toggle('no-cam', pose.status === 'error');
}

$('game').addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  const a = renderer.hit(((e.clientX - r.left) / r.width) * VIEW_W, ((e.clientY - r.top) / r.height) * VIEW_H);
  if (a) clicks.push(a);
});

// ---- input: one "menu event" per seat and tick ------------------------------------
function seatEvent(i) {
  const s = seats[i];
  const k = KEYS[i];
  let ev = null;
  if (s.mode === 'body' && pose.ready) {
    const b = s.reader.out;
    ev = s.menu.update(b.present && b.leftUp, b.present && b.rightUp, app.time);
    s.okProgress = s.menu.progress;
  } else {
    s.okProgress = 0;
  }
  if (keyboard.consumeAny(k.prev)) ev = 'prev';
  if (keyboard.consumeAny(k.next)) ev = 'next';
  if (keyboard.consumeAny(k.ok)) ev = 'ok';
  return ev;
}

function takeClick(name) {
  const i = clicks.indexOf(name);
  if (i < 0) return false;
  clicks.splice(i, 1);
  return true;
}

// ---- screens ----------------------------------------------------------------------
function joinSeat(i) {
  const s = seats[i];
  s.joined = true;
  s.ready = false;
  s.mode = pose.ready ? 'body' : 'bot';
  s.missingSince = null;
  sound.play('join', PLAYERS[i].pan);
}

function resetSeat(s) {
  s.joined = false;
  s.ready = false;
  s.mode = 'body';
  s.bot = null;
}

function toLobby() {
  music.stop();
  app.screen = 'lobby';
  app.paused = false;
  app.lobbyStartIn = null;
}

function toSongs() {
  app.screen = 'songs';
  app.paused = false;
  app.lobbyStartIn = null;
  renderer.clearEffects();
  music.play(CHOREOS[app.songIndex], { preview: true });
}

function startDance(from = 0) {
  const choreo = CHOREOS[app.songIndex];
  const dancing = [0, 1].filter((i) => seats[i].joined);
  app.session = new Session(choreo, dancing);
  if (from > 0) app.session.skipTo(from);
  dancing.forEach((i) => { seats[i].bot = seats[i].mode === 'bot' ? new Bot(0.55 + Math.random() * 0.35, 11 + i * 7) : null; });
  app.screen = 'dance';
  app.paused = false;
  app.songTime = from;
  countdownShown = null;
  renderer.clearEffects();
  music.play(choreo, { from });
  sound.play('go');
}

function updateLobby(dt, now) {
  seats.forEach((s, i) => {
    const ev = seatEvent(i);
    if (!s.joined) {
      s.joinProgress = s.okProgress;
      if (ev || takeClick(`join${i}`)) joinSeat(i);
      return;
    }
    s.joinProgress = 0;
    const click = ['prev', 'next', 'ok', 'unready'].find((a) => takeClick(`${a}${i}`));
    const act = ev ?? click;
    if (!s.ready) {
      if (act === 'prev' || act === 'next') {
        s.avatar = (s.avatar + (act === 'next' ? 1 : AVATARS.length - 1)) % AVATARS.length;
        s.flash[act] = 0.25;
        sound.play('tick', PLAYERS[i].pan);
      } else if (act === 'ok') {
        s.ready = true;
        sound.play('ready', PLAYERS[i].pan);
      }
    } else if (act === 'prev' || act === 'next' || act === 'unready') {
      s.ready = false;
      sound.play('tick', PLAYERS[i].pan);
    }
    // a dancer who walked away for good frees the seat
    if (s.mode === 'body' && pose.ready) {
      if (!s.reader.out.present) {
        s.missingSince ??= now;
        if (now - s.missingSince > 12000) resetSeat(s);
      } else {
        s.missingSince = null;
      }
    }
  });

  const joined = seats.filter((s) => s.joined);
  if (joined.length && joined.every((s) => s.ready)) {
    app.lobbyStartIn ??= joined.length === 2 ? 2.5 : MENU.autoContinue;
    const before = Math.ceil(app.lobbyStartIn);
    app.lobbyStartIn -= dt;
    if (Math.ceil(app.lobbyStartIn) !== before && app.lobbyStartIn > 0) sound.play('count');
    if (app.lobbyStartIn <= 0) { sound.play('select'); toSongs(); }
  } else {
    app.lobbyStartIn = null;
  }
  if (keyboard.consume('Enter')) {
    if (!joined.length) joinSeat(0);
    for (const s of seats) if (s.joined) s.ready = true;
    toSongs();
  }
  if (keyboard.consume('Escape')) seats.forEach(resetSeat);
}

function updateSongs() {
  let act = null;
  seats.forEach((s, i) => { const ev = seatEvent(i); if (ev && (s.joined || s.mode === 'body')) act = ev; });
  for (let i = 0; i < CHOREOS.length; i++) {
    if (takeClick(`song${i}`)) act = i === app.songIndex ? 'ok' : (app.songIndex = i, 'pick');
  }
  if (keyboard.consume('Enter') || keyboard.consume('Space')) act = 'ok';
  if (keyboard.consume('Escape')) { toLobby(); return; }
  if (act === 'prev' || act === 'next') {
    app.songIndex = (app.songIndex + (act === 'next' ? 1 : CHOREOS.length - 1)) % CHOREOS.length;
  }
  if (act === 'prev' || act === 'next' || act === 'pick') {
    sound.play('tick');
    music.play(CHOREOS[app.songIndex], { preview: true });
  } else if (act === 'ok') {
    if (!seats.some((s) => s.joined)) joinSeat(0);
    startDance();
  }
}

function updateDance() {
  const S = app.session;
  if (keyboard.consume('Escape')) { music.stop(); toSongs(); return; }
  if (keyboard.consume('KeyP')) {
    app.paused = !app.paused;
    if (app.paused) music.pause(); else music.resume();
  }
  if (app.paused) return;
  const t = music.time();
  app.songTime = t;
  const bodies = S.players.map((p) => {
    const s = seats[p.seat];
    s.body = s.mode === 'bot' ? s.bot.update(S, t) : s.reader.out;
    return s.body;
  });
  for (const ev of S.update(t, bodies)) {
    renderer.onJudged(ev);
    const pan = PLAYERS[ev.seat].pan;
    sound.play(ev.rating.name.toLowerCase(), pan);
    if (ev.gold && ev.rating.points > 0) sound.play('gold', pan);
  }
  // "3, 2, 1, DANCE!" beeps before the first move
  const left = (S.moves[0].t - t) / S.beat;
  const n = left > 0 && left <= 4 ? Math.ceil(left) : null;
  if (n !== countdownShown && n !== null) sound.play(n === 1 ? 'go' : 'count');
  countdownShown = n;

  if (S.finished) {
    music.stop();
    app.screen = 'results';
    app.resultsAt = app.time;
    starsPlayed = 0;
    sound.play('cheer');
    renderer.fx.burst(VIEW_W / 2, 200, 120, { speed: 600, up: 200, life: 2 });
  }
}

function updateResults() {
  const S = app.session;
  const since = app.time - app.resultsAt;
  // a "ding" for each star as it appears
  const stars = Math.max(...S.players.map((p) => S.stars(p)));
  while (starsPlayed < stars && since > 1.5 + starsPlayed * 0.3) { sound.play('star'); starsPlayed++; }

  let act = null;
  seats.forEach((s, i) => { const ev = seatEvent(i); if (ev && s.joined) act = ev; });
  if (since < 2.5) act = null; // do not skip the results by accident
  if (keyboard.consume('Enter') || takeClick('again')) act = 'ok';
  if (keyboard.consume('Escape') || takeClick('songs')) act = 'prev';
  if (act === 'ok') startDance();
  else if (act === 'prev' || act === 'next' || since > 90) toSongs();
}

function updateApp(dt, now) {
  app.time += dt;
  for (const s of seats) {
    s.flash.prev = Math.max(0, s.flash.prev - dt);
    s.flash.next = Math.max(0, s.flash.next - dt);
  }
  if (keyboard.consume('KeyM')) sound.toggleMute();
  if (keyboard.consume('KeyV')) {
    $('cam-panel').classList.toggle('collapsed');
    renderer.resize();
  }
  if (keyboard.consume('KeyR') && pose.status === 'error') startPose();

  if (app.screen === 'lobby') updateLobby(dt, now);
  else if (app.screen === 'songs') updateSongs();
  else if (app.screen === 'dance') updateDance();
  else if (app.screen === 'results') updateResults();
  keyboard.clearPressed();
  clicks.length = 0;
}

// ---- camera panel (DOM) -------------------------------------------------------
const rows = [0, 1].map((i) => {
  const row = document.querySelector(`.prow[data-p="${i}"]`);
  return { meter: row.querySelector('.meter'), mode: row.querySelector('.pmode') };
});

function updatePanel() {
  const S = app.screen === 'dance' || app.screen === 'results' ? app.session : null;
  seats.forEach((s, i) => {
    const p = S?.players.find((q) => q.seat === i);
    const live = p ? p.live : 0;
    rows[i].meter.style.setProperty('--fill', `${Math.round(live * 100)}%`);
    rows[i].meter.style.setProperty('--col', scoreColor(live));
    const seen = s.reader.out.present;
    rows[i].mode.textContent = !s.joined ? (seen ? 'seen - raise both hands to join' : '-')
      : s.mode === 'bot' ? `${AVATARS[s.avatar].name} - AUTO dancer`
        : `${AVATARS[s.avatar].name} - ${seen ? 'dancing' : 'not seen'}`;
  });
  if (pose.ready) {
    const n = seats.filter((s) => s.reader.out.present).length;
    $('cam-status').textContent = `Tracking ${n} dancer${n === 1 ? '' : 's'} (${Math.round(pose.fps)} fps)`;
    app.cam.message = `Camera: ${n} dancer${n === 1 ? '' : 's'} seen`;
  }
  pose.drawOverlay(seats.map((s, i) => ({
    lm: s.lm,
    bones: app.screen === 'dance' ? S?.players.find((q) => q.seat === i)?.liveBones : undefined,
  })));
}

// ---- the loop -------------------------------------------------------------------
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame); // first, so one bad frame cannot stop the game
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // 1. read the bodies (at most once per new camera frame)
  const poses = pose.detect(now);
  if (poses !== undefined) {
    const v = $('cam');
    const aspect = v.videoWidth ? v.videoHeight / v.videoWidth : 0.5625;
    const assigned = assigner.assign(poses, now);
    seats.forEach((s, i) => {
      s.lm = assigned[i];
      s.reader.update(assigned[i], aspect);
    });
  }

  // 2. fixed-step logic
  acc += dt;
  while (acc >= STEP) {
    updateApp(STEP, now);
    acc -= STEP;
  }

  // 3. draw
  updatePanel();
  if (app.screen !== 'boot') renderer.render(app);
  else renderer.render({ ...app, screen: 'lobby' });
}

// Debug addresses:
//   ?demo                two AUTO dancers (no camera); &song=0..2  &from=seconds  &solo
//   ?lobby / ?songs      skip the start card
if (params.has('demo')) {
  $('boot').classList.add('hidden');
  const solo = params.has('solo');
  seats.forEach((s, i) => {
    if (solo && i === 1) return;
    s.joined = true; s.ready = true; s.mode = 'bot';
    s.avatar = Number(params.get(`a${i + 1}`) ?? (i === 0 ? 0 : 1)) % AVATARS.length;
  });
  app.songIndex = Number(params.get('song') ?? 0) % CHOREOS.length;
  startDance(Number(params.get('from') ?? 0));
} else if (params.has('lobby') || params.has('songs')) {
  $('boot').classList.add('hidden');
  app.screen = 'lobby';
  if (params.has('songs')) {
    seats.forEach((s, i) => { s.joined = true; s.ready = true; s.mode = 'bot'; s.avatar = i + 2; });
    toSongs();
  }
}

let started = false;
const go = () => {
  if (started) return;
  started = true;
  requestAnimationFrame(frame);
};
document.fonts?.load('16px "Press Start 2P"').finally(go);
setTimeout(go, 1500);

// handy for debugging in the browser console
window.danceFever = { app, seats, pose, sound, music, renderer };
