// ---------------------------------------------------------------------------
// PoseTracker: webcam -> MediaPipe Pose Landmarker -> up to 2 skeletons.
//
// The MediaPipe library (JavaScript + WebAssembly) ships inside the project
// in vendor/mediapipe, so nothing has to be installed. The neural-network
// model is loaded from models/ if present, otherwise from Google's public
// model storage. Same as Unicorn Run (two people: numPoses = 2).
// It also draws the camera "mirror" with both skeletons; while dancing each
// bone is coloured by how well it matches the coach (green = spot on).
// ---------------------------------------------------------------------------
import { PLAYERS } from '../config.js';
import { LM, BONE_LM } from '../dance/poses.js';

const LIB = new URL('../../vendor/mediapipe/vision_bundle.mjs', import.meta.url).href;
const WASM = new URL('../../vendor/mediapipe/wasm', import.meta.url).href;
const MODEL_LOCAL = new URL('../../models/pose_landmarker_lite.task', import.meta.url).href;
const MODEL_REMOTE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// lines that are not judged bones: shoulders, hips, sides of the torso
const FRAME = [[11, 12], [23, 24], [11, 23], [12, 24]];

export class PoseTracker {
  constructor(video, overlay) {
    this.video = video;
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
    this.status = 'idle';       // idle | camera | model | ready | error
    this.message = 'Camera off';
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.latest = [];
    this.fps = 0;
  }

  get ready() {
    return this.status === 'ready';
  }

  async start() {
    try {
      this.status = 'camera';
      this.message = 'Waiting for camera permission...';
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera API');
      const stream = await navigator.mediaDevices.getUserMedia({
        // a wide picture leaves room for two dancers side by side
        video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user', resizeMode: 'none' },
        audio: false,
      });
      this.video.srcObject = stream;
      await this.video.play();

      this.status = 'model';
      this.message = 'Loading body tracking...';
      const vision = await import(LIB);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
      const modelAssetPath = await pickModel();
      const options = (delegate) => ({
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 2,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      // add ?delegate=CPU to the address to skip the graphics card
      const forced = new URLSearchParams(location.search).get('delegate');
      try {
        this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, options(forced === 'CPU' ? 'CPU' : 'GPU'));
      } catch (gpuError) {
        console.warn('GPU delegate failed, using CPU', gpuError);
        this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, options('CPU'));
      }
      this.status = 'ready';
      this.message = 'Body tracking ON';
    } catch (err) {
      console.error(err);
      this.status = 'error';
      this.message = friendlyError(err);
    }
  }

  /**
   * Run the detector on the newest camera frame.
   * Returns an array of skeletons (possibly empty), or undefined if there
   * was no new camera frame since the last call.
   */
  detect(nowMs) {
    if (!this.ready || this.video.readyState < 2) return undefined;
    if (this.video.currentTime === this.lastVideoTime) return undefined;
    this.lastVideoTime = this.video.currentTime;
    const result = this.landmarker.detectForVideo(this.video, nowMs);
    if (this.lastDetectAt) this.fps = this.fps * 0.9 + (1000 / Math.max(1, nowMs - this.lastDetectAt)) * 0.1;
    this.lastDetectAt = nowMs;
    this.latest = result.landmarks ?? [];
    return this.latest;
  }

  /**
   * Draw both skeletons over the (mirrored) camera picture.
   * slots[i] = { lm, bones } - bones = per-bone match 0..1 while dancing.
   */
  drawOverlay(slots) {
    const v = this.video;
    const c = this.overlay;
    const w = v.videoWidth || 960;
    const h = v.videoHeight || 540;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = this.octx;
    g.clearRect(0, 0, w, h);

    // the middle of the room: P1 dances left of it, P2 right
    g.lineWidth = 2;
    g.setLineDash([10, 8]);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    line(g, w / 2, 0, w / 2, h);
    g.setLineDash([]);

    slots.forEach((slot, i) => {
      const lm = slot.lm;
      if (!lm) return;
      const col = PLAYERS[i].color;
      const ok = (a) => (lm[a].visibility ?? 1) >= 0.4;
      g.lineCap = 'round';
      g.lineWidth = 5;
      g.strokeStyle = col;
      for (const [a, b] of FRAME) if (ok(a) && ok(b)) line(g, lm[a].x * w, lm[a].y * h, lm[b].x * w, lm[b].y * h);
      g.lineWidth = 8;
      for (const [k, [a, b]] of Object.entries(BONE_LM)) {
        if (!ok(a) || !ok(b)) continue;
        const s = slot.bones?.[k];
        g.strokeStyle = s === undefined ? col : scoreColor(s);
        line(g, lm[a].x * w, lm[a].y * h, lm[b].x * w, lm[b].y * h);
      }
      g.fillStyle = '#ffffff';
      for (const k of [LM.NOSE, LM.L_WRIST, LM.R_WRIST, LM.L_ELBOW, LM.R_ELBOW, LM.L_KNEE, LM.R_KNEE]) {
        if (!ok(k)) continue;
        g.beginPath();
        g.arc(lm[k].x * w, lm[k].y * h, 6, 0, Math.PI * 2);
        g.fill();
      }
      // label above the head (text drawn mirrored back so it reads correctly)
      const nx = lm[LM.NOSE].x * w;
      const ny = Math.max(30, lm[LM.NOSE].y * h - 50);
      g.save();
      g.translate(nx, ny);
      g.scale(-1, 1);
      g.fillStyle = col;
      g.beginPath();
      g.roundRect(-30, -20, 60, 32, 8);
      g.fill();
      g.fillStyle = '#1b0b2e';
      g.font = 'bold 22px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(PLAYERS[i].label, 0, 4);
      g.restore();
    });
  }
}

/** 0 = red, 0.5 = yellow, 1 = green */
export function scoreColor(s) {
  const hue = Math.round(Math.max(0, Math.min(1, s)) * 130);
  return `hsl(${hue}, 95%, 58%)`;
}

function line(g, x1, y1, x2, y2) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

async function pickModel() {
  try {
    const r = await fetch(MODEL_LOCAL, { method: 'HEAD' });
    if (r.ok) return MODEL_LOCAL;
  } catch { /* not there */ }
  return MODEL_REMOTE;
}

function friendlyError(err) {
  const name = err?.name ?? '';
  if (name === 'NotAllowedError') return 'Camera blocked - allow it in the browser, then press R';
  if (name === 'NotFoundError') return 'No webcam found - AUTO dancers will play';
  if (name === 'NotReadableError') return 'Webcam busy in another app - close it, then press R';
  if (location.protocol === 'file:') return 'Start the game with start.bat (not by double-clicking index.html)';
  return 'Body tracking unavailable (' + (err?.message ?? err) + ')';
}
