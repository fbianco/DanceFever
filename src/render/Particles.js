// Particles: confetti and sparkles. Pool of plain objects, updated by the renderer.
import { NEON } from '../config.js';

export class Particles {
  constructor(max = 400) {
    this.list = [];
    this.max = max;
  }

  burst(x, y, n, { colors = NEON, speed = 320, up = 200, life = 1.2, size = 7, gravity = 600 } = {}) {
    for (let i = 0; i < n && this.list.length < this.max; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.list.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up,
        life, age: 0, size: size * (0.6 + Math.random() * 0.8),
        color: colors[(Math.random() * colors.length) | 0],
        spin: Math.random() * 10, gravity,
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += dt * 8;
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      const w = p.size * Math.abs(Math.cos(p.spin));
      ctx.fillRect(p.x - w / 2, p.y - p.size / 2, w + 1, p.size);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list = [];
  }
}
