// ---------------------------------------------------------------------------
// Dance Fever - global constants
// Every "magic number" of the game lives here so it can be tuned in one place.
// ---------------------------------------------------------------------------

// Logical resolution. The canvas is scaled to the window, but all drawing
// works in these fixed units.
export const VIEW_W = 1280;
export const VIEW_H = 720;

// The two seats. Player 1 dances on the LEFT of the camera mirror, player 2
// on the RIGHT, and their avatars stand on the same sides of the stage.
export const PLAYERS = [
  { label: 'P1', color: '#ff4fd8', light: '#ffc2f2', x: 230, pan: -0.6 },
  { label: 'P2', color: '#36e0ff', light: '#b8f4ff', x: 1050, pan: 0.6 },
];

// Selectable dancers. Colours: outfit, outfit shade, skin / head, accent.
export const AVATARS = [
  { id: 'uni', name: 'UNI', kind: 'unicorn', outfit: '#ff5fa8', shade: '#c8327c', skin: '#ffffff', accent: '#ffd23f' },
  { id: 'bolt', name: 'BOLT', kind: 'robot', outfit: '#3f8cff', shade: '#2554b8', skin: '#cfd8e6', accent: '#7cfcff' },
  { id: 'mimi', name: 'MIMI', kind: 'cat', outfit: '#a66bff', shade: '#6e3ccc', skin: '#ffa94d', accent: '#fff27a' },
  { id: 'zap', name: 'ZAP', kind: 'alien', outfit: '#ffd23f', shade: '#d39b00', skin: '#7cff6b', accent: '#ff4fd8' },
];

// Canonical body proportions (logical pixels at scale 1). Avatars and the
// coach are drawn from bone DIRECTIONS only, with these fixed lengths, so a
// small child and a tall adult produce the same-sized dancer.
export const BODY = {
  torso: 70, shoulderHalf: 26, hipHalf: 17, neck: 16, head: 30,
  upperArm: 44, foreArm: 40, thigh: 52, shin: 50,
};

// Pose matching. A bone pointing within `perfectAngle` of the target scores 1,
// beyond `zeroAngle` it scores 0, linear in between.
export const MATCH = {
  perfectAngle: 20,
  zeroAngle: 70,
  weights: { upperArm: 1, foreArm: 0.8, thigh: 0.5, shin: 0.4, torso: 0.6 },
  smoothing: 0.55,        // weight of the newest camera sample
  minVisibility: 0.5,
};

// Judging one move: the best match inside a time window around the beat.
// Players see the move and then copy it, so the window reaches further late.
export const JUDGE = {
  early: 0.2,             // s before the beat
  late: 0.5,              // s after the beat
  ratings: [
    { name: 'PERFECT', min: 0.85, points: 1000, color: '#fff27a' },
    { name: 'GOOD', min: 0.7, points: 650, color: '#7cffb2' },
    { name: 'OK', min: 0.5, points: 300, color: '#7cd8ff' },
    { name: 'MISS', min: -1, points: 0, color: '#ff7a9c' },
  ],
  goldFactor: 2,          // gold moves count double
  comboStep: 0.05,        // +5% points per move in the combo...
  comboMax: 10,           // ...up to +50%
  stars: [0.2, 0.4, 0.6, 0.75, 0.88], // fraction of the maximum score per star
};

// Body control in the menus (no calibration needed).
export const MENU = {
  oneHandHold: 0.35,      // s with one hand up = previous / next
  repeatEvery: 0.9,       // s between repeats while the hand stays up
  bothHandsHold: 1.0,     // s with both hands up = join / OK
  autoContinue: 4,        // s before the lobby moves on by itself once everyone is ready
};

// Keyboard: one block of keys per player (menus only - dancing needs the camera).
export const KEYS = [
  { prev: ['KeyA'], next: ['KeyD'], ok: ['KeyW', 'KeyS'] },
  { prev: ['ArrowLeft'], next: ['ArrowRight'], ok: ['ArrowUp', 'ArrowDown'] },
];

export const FONT = '"Press Start 2P", "Courier New", monospace';
export const GAME_TITLE = 'DANCE FEVER';
export const STUDIO = "Bianco's Labs";

export const NEON = ['#ff4fd8', '#a66bff', '#36e0ff', '#7cffb2', '#fff27a', '#ff9f1c'];
