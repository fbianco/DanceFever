// ---------------------------------------------------------------------------
// avatars.js - every dancer on screen is drawn from bone DIRECTIONS.
//
//   directions (from the camera, a bot or the choreography)
//     -> skeletonFromDirs (poses.js): joints with fixed, cartoon proportions
//     -> drawn with thick rounded strokes and vector shapes (no image files)
//
// drawAvatar  the players' characters (unicorn, robot, cat, alien)
// drawCoach   the neon "hologram" dancer that shows the choreography
// drawPicto   the little stick figure on the move cards
// ---------------------------------------------------------------------------
import { skeletonFromDirs, poseDirs } from '../dance/poses.js';

const TAU = Math.PI * 2;
const INK = '#1b0b2e';
const RAINBOW = ['#ff4d4d', '#ff9f1c', '#ffe14d', '#4ddb6a', '#3fa9ff', '#a66bff'];

function seg(ctx, a, b, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** a limb = outline stroke, then colour stroke on top */
function limb(ctx, pts, width, color, k) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, c] of [[width + 5 * k, INK], [width, color]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
}

function disc(ctx, x, y, r, fill, outline = INK, lw = 3) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = outline;
    ctx.stroke();
  }
}

function ell(ctx, x, y, rx, ry, rot, fill, outline = INK, lw = 3) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = outline;
    ctx.stroke();
  }
}

function tri(ctx, a, b, c, fill, outline = INK, lw = 3) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = outline;
    ctx.stroke();
  }
}

/** Where to put the hip centre so the lowest foot stands on the floor. */
export function standOn(skel, floorY, k) {
  return floorY - Math.max(skel.aL.y, skel.aR.y) - 7 * k;
}

/**
 * Draw a player's avatar. `dirs` = bone directions, (x, floorY) = where its
 * feet are, k = scale, t = time (blinking, antenna...).
 */
export function drawAvatar(ctx, avatar, dirs, x, floorY, k, t = 0, { alpha = 1, bounce = 0 } = {}) {
  const s = skeletonFromDirs(dirs, k);
  const y = standOn(s, floorY, k) - bounce * k;
  ctx.save();
  ctx.globalAlpha = alpha;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, floorY + 2 * k, 48 * k, 10 * k, 0, 0, TAU);
  ctx.fill();
  ctx.translate(x, y);

  const A = avatar;
  const robot = A.kind === 'robot';
  // legs + shoes
  for (const [h, kn, an] of [[s.hL, s.kL, s.aL], [s.hR, s.kR, s.aR]]) {
    limb(ctx, [h, kn, an], 17 * k, A.shade, k);
    const dir = Math.atan2(an.y - kn.y, an.x - kn.x) - Math.PI / 2;
    ell(ctx, an.x, an.y + 4 * k, 11 * k, 7 * k, dir, robot ? '#8a96aa' : A.accent, INK, 3 * k);
  }

  // torso
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(s.sL.x, s.sL.y);
  ctx.lineTo(s.sR.x, s.sR.y);
  ctx.lineTo(s.hR.x, s.hR.y);
  ctx.lineTo(s.hL.x, s.hL.y);
  ctx.closePath();
  ctx.lineWidth = 22 * k;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 16 * k;
  ctx.strokeStyle = A.outfit;
  ctx.stroke();
  ctx.fillStyle = A.outfit;
  ctx.fill();
  emblem(ctx, A, s, k, t);

  // arms: sleeve (outfit) + forearm (skin) + hand
  for (const [sh, el, wr] of [[s.sL, s.eL, s.wL], [s.sR, s.eR, s.wR]]) {
    limb(ctx, [sh, el], 15 * k, A.outfit, k);
    limb(ctx, [el, wr], 12 * k, robot ? '#aeb8c8' : A.skin, k);
    disc(ctx, wr.x, wr.y, 8 * k, robot ? '#cfd8e6' : A.skin, INK, 3 * k);
  }

  // neck + head, tilted with the torso
  limb(ctx, [s.neck, { x: s.neck.x + s.up.x * 12 * k, y: s.neck.y + s.up.y * 12 * k }], 10 * k, robot ? '#8a96aa' : A.skin, k);
  ctx.save();
  ctx.translate(s.head.x, s.head.y);
  ctx.rotate(Math.atan2(s.up.x, -s.up.y));
  HEADS[A.kind](ctx, A, k, t);
  ctx.restore();

  ctx.restore();
  return s;
}

function emblem(ctx, A, s, k, t) {
  const cx = (s.sL.x + s.sR.x + s.hL.x + s.hR.x) / 4;
  const cy = (s.sL.y + s.sR.y + s.hL.y + s.hR.y) / 4 - 6 * k;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(s.up.x, -s.up.y));
  const r = 9 * k;
  if (A.kind === 'unicorn') {
    ctx.fillStyle = A.accent;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.6, -r * 1.3, 0, -r * 0.4);
    ctx.bezierCurveTo(r * 0.6, -r * 1.3, r * 1.6, -r * 0.2, 0, r * 0.9);
    ctx.fill();
  } else if (A.kind === 'robot') {
    ctx.fillStyle = '#1d2a4a';
    ctx.fillRect(-r * 1.4, -r, r * 2.8, r * 2);
    ['#ff4d4d', '#ffe14d', '#4ddb6a'].forEach((c, i) => {
      ctx.fillStyle = Math.floor(t * 4 + i) % 3 === 0 ? '#ffffff' : c;
      ctx.beginPath();
      ctx.arc((i - 1) * r * 0.9, 0, r * 0.32, 0, TAU);
      ctx.fill();
    });
  } else if (A.kind === 'cat') {
    ctx.fillStyle = A.accent;
    disc(ctx, 0, r * 0.3, r * 0.6, A.accent, null);
    for (const a of [-0.8, -0.27, 0.27, 0.8]) disc(ctx, Math.sin(a) * r * 1.0, r * 0.3 - Math.cos(a) * r * 1.0, r * 0.3, A.accent, null);
  } else {
    ctx.fillStyle = A.accent;
    ctx.beginPath();
    ctx.moveTo(r * 0.3, -r * 1.2);
    ctx.lineTo(-r * 0.7, r * 0.15);
    ctx.lineTo(0, r * 0.15);
    ctx.lineTo(-r * 0.3, r * 1.2);
    ctx.lineTo(r * 0.7, -r * 0.15);
    ctx.lineTo(0, -r * 0.15);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function eyes(ctx, k, t, dx = 9, dy = 0, r = 4.5) {
  const blink = (t % 3.7) < 0.12;
  for (const sx of [-1, 1]) {
    if (blink) {
      seg(ctx, { x: sx * dx * k - r * k, y: dy * k }, { x: sx * dx * k + r * k, y: dy * k }, 2.5 * k, INK);
    } else {
      ell(ctx, sx * dx * k, dy * k, r * k, r * 1.25 * k, 0, INK, null);
      disc(ctx, sx * dx * k + 1.4 * k, dy * k - 1.8 * k, 1.5 * k, '#ffffff', null);
    }
  }
}

function smile(ctx, k, y = 9, w = 6) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5 * k;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, y * k - w * k * 0.6, w * k, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
}

// heads are drawn around (0, 0) = centre of the face, "up" = -y
const HEADS = {
  unicorn(ctx, A, k, t) {
    // rainbow mane behind the head
    RAINBOW.forEach((c, i) => {
      const a = -2.4 + i * 0.42;
      disc(ctx, Math.cos(a) * 24 * k - 4 * k, Math.sin(a) * 24 * k - 4 * k, 10 * k, c, INK, 2.5 * k);
    });
    // horn
    tri(ctx, [-6 * k, -22 * k], [6 * k, -22 * k], [0, -52 * k], A.accent, INK, 3 * k);
    ctx.strokeStyle = 'rgba(160,100,0,0.7)';
    ctx.lineWidth = 2 * k;
    for (const yy of [-30, -38, -45]) seg(ctx, { x: -4 * k, y: (yy + 2) * k }, { x: 4 * k, y: (yy - 2) * k }, 2 * k, 'rgba(160,100,0,0.7)');
    // ears
    tri(ctx, [-20 * k, -12 * k], [-10 * k, -20 * k], [-20 * k, -32 * k], A.skin, INK, 3 * k);
    tri(ctx, [20 * k, -12 * k], [10 * k, -20 * k], [20 * k, -32 * k], A.skin, INK, 3 * k);
    ell(ctx, 0, 0, 24 * k, 26 * k, 0, A.skin, INK, 3 * k);
    ell(ctx, 0, 13 * k, 14 * k, 9 * k, 0, '#ffd6ea', null);
    disc(ctx, -5 * k, 13 * k, 1.8 * k, '#c8327c', null);
    disc(ctx, 5 * k, 13 * k, 1.8 * k, '#c8327c', null);
    eyes(ctx, k, t, 10, -3);
    disc(ctx, -17 * k, 5 * k, 4 * k, 'rgba(255,95,168,0.5)', null);
    disc(ctx, 17 * k, 5 * k, 4 * k, 'rgba(255,95,168,0.5)', null);
  },
  robot(ctx, A, k, t) {
    seg(ctx, { x: 0, y: -22 * k }, { x: 0, y: -40 * k }, 3 * k, INK);
    disc(ctx, 0, -42 * k, 5 * k, Math.floor(t * 3) % 2 ? '#ff4d4d' : A.accent, INK, 2.5 * k);
    disc(ctx, -25 * k, 0, 6 * k, '#8a96aa', INK, 2.5 * k);
    disc(ctx, 25 * k, 0, 6 * k, '#8a96aa', INK, 2.5 * k);
    ctx.beginPath();
    ctx.roundRect(-23 * k, -23 * k, 46 * k, 44 * k, 9 * k);
    ctx.fillStyle = A.skin;
    ctx.fill();
    ctx.lineWidth = 3 * k;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-17 * k, -11 * k, 34 * k, 15 * k, 5 * k);
    ctx.fillStyle = '#16213b';
    ctx.fill();
    const glow = Math.floor(t * 2) % 5 === 0 ? 0.4 : 1;
    ctx.fillStyle = A.accent;
    ctx.globalAlpha *= glow;
    ctx.fillRect(-12 * k, -6 * k, 8 * k, 5 * k);
    ctx.fillRect(4 * k, -6 * k, 8 * k, 5 * k);
    ctx.globalAlpha /= glow;
    ctx.fillStyle = INK;
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * 5 * k - 1.5 * k, 10 * k, 3 * k, 5 * k);
  },
  cat(ctx, A, k, t) {
    tri(ctx, [-23 * k, -6 * k], [-6 * k, -21 * k], [-22 * k, -36 * k], A.skin, INK, 3 * k);
    tri(ctx, [23 * k, -6 * k], [6 * k, -21 * k], [22 * k, -36 * k], A.skin, INK, 3 * k);
    tri(ctx, [-19 * k, -11 * k], [-10 * k, -19 * k], [-19 * k, -29 * k], '#ffb3c8', null);
    tri(ctx, [19 * k, -11 * k], [10 * k, -19 * k], [19 * k, -29 * k], '#ffb3c8', null);
    ell(ctx, 0, 0, 25 * k, 23 * k, 0, A.skin, INK, 3 * k);
    // stripes
    for (const xx of [-6, 0, 6]) seg(ctx, { x: xx * k, y: -22 * k }, { x: xx * k * 0.8, y: -15 * k }, 3 * k, '#d9782a');
    // eyes: green with slit pupils
    const blink = (t % 4.1) < 0.12;
    for (const sx of [-1, 1]) {
      if (blink) seg(ctx, { x: (sx * 10 - 5) * k, y: -2 * k }, { x: (sx * 10 + 5) * k, y: -2 * k }, 2.5 * k, INK);
      else {
        ell(ctx, sx * 10 * k, -2 * k, 6 * k, 7 * k, 0, '#7cff6b', INK, 2 * k);
        ell(ctx, sx * 10 * k, -2 * k, 1.8 * k, 5.5 * k, 0, INK, null);
      }
    }
    tri(ctx, [-3 * k, 6 * k], [3 * k, 6 * k], [0, 9 * k], '#ff6b9a', null);
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(-3 * k, 10 * k, 3 * k, 0, Math.PI);
    ctx.arc(3 * k, 10 * k, 3 * k, 0, Math.PI);
    ctx.stroke();
    for (const sx of [-1, 1]) {
      for (const dy of [-2, 3]) seg(ctx, { x: sx * 12 * k, y: (8 + dy * 0.3) * k }, { x: sx * 30 * k, y: (6 + dy) * k }, 1.5 * k, INK);
    }
  },
  alien(ctx, A, k, t) {
    for (const sx of [-1, 1]) {
      const wob = Math.sin(t * 5 + sx) * 3 * k;
      ctx.strokeStyle = '#3fae35';
      ctx.lineWidth = 4 * k;
      ctx.beginPath();
      ctx.moveTo(sx * 9 * k, -22 * k);
      ctx.quadraticCurveTo(sx * 14 * k, -36 * k, sx * 20 * k + wob, -44 * k);
      ctx.stroke();
      disc(ctx, sx * 20 * k + wob, -44 * k, 5 * k, A.accent, INK, 2.5 * k);
    }
    ctx.beginPath();
    ctx.moveTo(0, 24 * k);
    ctx.bezierCurveTo(-18 * k, 22 * k, -30 * k, 0, -27 * k, -10 * k);
    ctx.bezierCurveTo(-24 * k, -28 * k, 24 * k, -28 * k, 27 * k, -10 * k);
    ctx.bezierCurveTo(30 * k, 0, 18 * k, 22 * k, 0, 24 * k);
    ctx.fillStyle = A.skin;
    ctx.fill();
    ctx.lineWidth = 3 * k;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const blink = (t % 3.3) < 0.1;
    for (const sx of [-1, 1]) {
      if (blink) seg(ctx, { x: sx * 6 * k, y: 0 }, { x: sx * 18 * k, y: -4 * k }, 3 * k, INK);
      else {
        ell(ctx, sx * 12 * k, -2 * k, 9 * k, 6 * k, sx * 0.5, INK, null);
        disc(ctx, sx * 12 * k + 2 * k, -4 * k, 2 * k, '#ffffff', null);
      }
    }
    smile(ctx, k, 15, 4);
  },
};

/**
 * The coach: a glowing neon dancer. Faceless on purpose - you watch the
 * moves, not the character.
 */
export function drawCoach(ctx, pose, x, floorY, k, colors, { bounce = 0, alpha = 1 } = {}) {
  const s = skeletonFromDirs(poseDirs(pose), k);
  const y = standOn(s, floorY, k) - bounce * k;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, floorY + 2 * k, 52 * k, 11 * k, 0, 0, TAU);
  ctx.fill();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const bones = [
    [s.hL, s.kL, s.aL], [s.hR, s.kR, s.aR],
    [s.sL, s.eL, s.wL], [s.sR, s.eR, s.wR],
  ];
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(s.sL.x, s.sL.y);
    ctx.lineTo(s.sR.x, s.sR.y);
    ctx.lineTo(s.hR.x, s.hR.y);
    ctx.lineTo(s.hL.x, s.hL.y);
    ctx.closePath();
  };
  const headR = 22 * k;
  const neckTop = { x: s.neck.x + s.up.x * 12 * k, y: s.neck.y + s.up.y * 12 * k };
  // three passes: wide soft glow, colour, bright core
  const passes = [[34, colors.main, 0.25], [20, colors.main, 1], [6, colors.glow, 0.9]];
  for (const [w, c, a] of passes) {
    ctx.globalAlpha = alpha * a;
    ctx.strokeStyle = c;
    ctx.lineWidth = w * k;
    for (const pts of bones) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    seg(ctx, s.neck, neckTop, w * k, c);
    torso();
    ctx.stroke();
    if (w === 20) {
      ctx.fillStyle = c;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(s.head.x, s.head.y, headR + (w - 20) * 0.5 * k, 0, TAU);
    if (w === 6) ctx.stroke();
    else ctx.fill();
  }
  ctx.globalAlpha = alpha;
  for (const p of [s.wL, s.wR]) disc(ctx, p.x, p.y, 9 * k, colors.glow, null);
  ctx.restore();
  return s;
}

/** Stick figure for the move cards, centred in a box of height h. */
export function drawPicto(ctx, pose, cx, cy, h, color, legsColor = color) {
  const k = h / 300;
  const s = skeletonFromDirs(poseDirs(pose), k);
  const minY = Math.min(s.head.y - 22 * k, s.wL.y, s.wR.y, s.eL.y, s.eR.y);
  const maxY = Math.max(s.aL.y, s.aR.y);
  const ox = cx;
  const oy = cy - (minY + maxY) / 2;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const w = 13 * k;
  for (const [a, b, c] of [[s.hL, s.kL, s.aL], [s.hR, s.kR, s.aR]]) {
    ctx.strokeStyle = legsColor;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(s.sL.x, s.sL.y);
  ctx.lineTo(s.sR.x, s.sR.y);
  ctx.lineTo(s.hR.x, s.hR.y);
  ctx.lineTo(s.hL.x, s.hL.y);
  ctx.closePath();
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.fill();
  for (const [a, b, c] of [[s.sL, s.eL, s.wL], [s.sR, s.eR, s.wR]]) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(s.head.x, s.head.y, 20 * k, 0, TAU);
  ctx.fill();
  ctx.restore();
}
