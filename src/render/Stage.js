// ---------------------------------------------------------------------------
// Stage: the disco behind the dancers - wall, mirror ball, sweeping
// spotlights, equaliser and a glowing LED floor that flashes on the beat.
//
// The static wall is painted once into an offscreen canvas; everything that
// moves is a handful of cheap shapes per frame. `beat` = song time in beats
// (fractional), so the lights follow the music.
// ---------------------------------------------------------------------------
import { VIEW_W, VIEW_H, NEON } from '../config.js';

const TAU = Math.PI * 2;
export const FLOOR_Y = 470;          // where the floor meets the wall
const VANISH = { x: VIEW_W / 2, y: 120 };
// colour i of the palette; works for negative i (the song clock starts slightly below 0)
const neon = (i) => NEON[((i % NEON.length) + NEON.length) % NEON.length];

export class Stage {
  constructor() {
    this.wall = null;
    this.ratio = 1;
  }

  setRatio(r) {
    if (r === this.ratio && this.wall) return;
    this.ratio = r;
    this.wall = this.paintWall(r);
  }

  paintWall(r) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(VIEW_W * r);
    c.height = Math.ceil(FLOOR_Y * r);
    const g = c.getContext('2d');
    g.scale(r, r);
    const bg = g.createLinearGradient(0, 0, 0, FLOOR_Y);
    bg.addColorStop(0, '#0d0420');
    bg.addColorStop(0.7, '#2a0d4a');
    bg.addColorStop(1, '#3b1260');
    g.fillStyle = bg;
    g.fillRect(0, 0, VIEW_W, FLOOR_Y);
    // neon arches
    [[NEON[0], 420], [NEON[2], 470], [NEON[1], 520]].forEach(([col, w], i) => {
      g.strokeStyle = col;
      g.globalAlpha = 0.18;
      g.lineWidth = 16;
      arch(g, VIEW_W / 2, FLOOR_Y, w + i * 60, 360 - i * 10);
      g.globalAlpha = 0.7;
      g.lineWidth = 3;
      arch(g, VIEW_W / 2, FLOOR_Y, w + i * 60, 360 - i * 10);
    });
    g.globalAlpha = 1;
    // little stars
    for (let i = 0; i < 70; i++) {
      const x = (i * 263.7) % VIEW_W;
      const y = (i * 97.3) % (FLOOR_Y - 60);
      g.fillStyle = `rgba(255,255,255,${0.15 + (i % 5) * 0.08})`;
      g.fillRect(x, y, 2, 2);
    }
    return c;
  }

  draw(ctx, beat, energy = 1, { ball = false } = {}) {
    const frac = ((beat % 1) + 1) % 1;
    const pulse = Math.exp(-frac * 5) * energy;
    const n = Math.floor(beat);
    ctx.drawImage(this.wall, 0, 0, VIEW_W, FLOOR_Y);

    // equaliser on the wall
    ctx.save();
    for (let i = 0; i < 24; i++) {
      const h = (0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + beat * 1.3)) * (0.4 + 0.6 * pulse)) * 90;
      const x = 120 + i * 43;
      if (x > 470 && x < 810) continue; // the coach stands here
      ctx.fillStyle = neon(i);
      ctx.globalAlpha = 0.28;
      for (let y = 0; y < h; y += 9) ctx.fillRect(x, FLOOR_Y - 12 - y, 30, 6);
    }
    ctx.restore();

    this.drawFloor(ctx, n, pulse);
    this.drawBeams(ctx, beat, pulse);
    if (ball) this.drawBall(ctx, beat, pulse);
  }

  drawFloor(ctx, n, pulse) {
    const cols = 12;
    const rows = 6;
    const yAt = (j) => FLOOR_Y + (VIEW_H - FLOOR_Y) * ((j / rows) ** 1.5);
    const xAt = (i, y) => {
      // lines converge towards the vanishing point
      const f = (y - VANISH.y) / (VIEW_H - VANISH.y);
      return VANISH.x + ((i / cols) * 2 - 1) * VIEW_W * 1.25 * f;
    };
    ctx.fillStyle = '#12051f';
    ctx.fillRect(0, FLOOR_Y, VIEW_W, VIEW_H - FLOOR_Y);
    for (let j = 0; j < rows; j++) {
      const y0 = yAt(j);
      const y1 = yAt(j + 1);
      for (let i = 0; i < cols; i++) {
        const on = (((i + j + n) % 3) + 3) % 3 === 0;
        const col = neon(i * 2 + j + Math.floor(n / 2));
        ctx.globalAlpha = on ? 0.3 + 0.5 * pulse : 0.12;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(xAt(i, y0) + 2, y0 + 2);
        ctx.lineTo(xAt(i + 1, y0) - 2, y0 + 2);
        ctx.lineTo(xAt(i + 1, y1) - 2, y1 - 2);
        ctx.lineTo(xAt(i, y1) + 2, y1 - 2);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    const edge = ctx.createLinearGradient(0, FLOOR_Y - 4, 0, FLOOR_Y + 30);
    edge.addColorStop(0, 'rgba(255,79,216,0.9)');
    edge.addColorStop(1, 'rgba(255,79,216,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, FLOOR_Y - 2, VIEW_W, 32);
  }

  drawBeams(ctx, beat, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sources = [80, 380, 900, 1200];
    sources.forEach((sx, i) => {
      const ang = Math.PI / 2 + Math.sin(beat * 0.35 + i * 1.9) * 0.55;
      const len = 780;
      const spread = 0.13;
      const col = neon(i * 2 + Math.floor(beat / 4));
      const g = ctx.createLinearGradient(sx, 0, sx + Math.cos(ang) * len, Math.sin(ang) * len);
      g.addColorStop(0, hexA(col, 0.32 + pulse * 0.2));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx, -10);
      ctx.lineTo(sx + Math.cos(ang - spread) * len, Math.sin(ang - spread) * len);
      ctx.lineTo(sx + Math.cos(ang + spread) * len, Math.sin(ang + spread) * len);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  drawBall(ctx, beat, pulse) {
    const x = VIEW_W / 2;
    const y = 112;
    const r = 34;
    ctx.save();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 58); // hangs below the song title
    ctx.lineTo(x, y - r);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = '#9aa3b5';
    ctx.fill();
    ctx.clip();
    // spinning mirror tiles
    const spin = beat * 0.25;
    for (let row = -4; row <= 4; row++) {
      const yy = y + row * 8;
      const w = Math.sqrt(Math.max(0, r * r - (row * 8) ** 2));
      for (let c = 0; c < 12; c++) {
        const a = (c / 12) * TAU + spin;
        const xx = x + Math.sin(a) * w;
        if (Math.cos(a) < 0) continue;
        const lit = (((c + row + Math.floor(beat * 2)) % 5) + 5) % 5 === 0;
        ctx.fillStyle = lit ? '#ffffff' : `rgba(${180 + (c * 7) % 60},${190 + (row * 11) % 50},230,1)`;
        ctx.fillRect(xx - 3, yy - 3, 6 * Math.cos(a) + 1, 6);
      }
    }
    ctx.restore();
    // sparkles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + beat * 0.5;
      const sx = x + Math.cos(a) * (r + 14 + (i % 2) * 20);
      const sy = y + Math.sin(a) * (r * 0.6 + 10);
      const s = 3 + 5 * pulse * ((i + Math.floor(beat)) % 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - s, sy - 1, s * 2, 2);
      ctx.fillRect(sx - 1, sy - s, 2, s * 2);
    }
    ctx.restore();
  }
}

function arch(g, cx, baseY, w, h) {
  g.beginPath();
  g.moveTo(cx - w / 2, baseY);
  g.lineTo(cx - w / 2, baseY - h + w / 2);
  g.arc(cx, baseY - h + w / 2, w / 2, Math.PI, 0);
  g.lineTo(cx + w / 2, baseY);
  g.stroke();
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
