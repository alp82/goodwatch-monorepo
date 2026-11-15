// The pop (a white flash, a ring snapping out, star sparks with short trails) follows Sprite Fusion's
// open-source pickup (https://www.spritefusion.com/pixel-art-vfx/pickup), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Lights, Rng, fit, clamp, ease, TAU, WHITE } from "../../core/index.js";
import { glint } from "./_lib.js";

export const meta = {
  name: "Collect burst",
  desc: "The moment of pickup: a white flash and a cross of light, a thin ring snapping out ahead of a softer one, twinkles thrown wide on curving paths that brake, hang and wink out.",
  tags: ["pickup", "collect", "burst", "sparkle", "reward", "one-shot"],
  size: [112, 108],
  origin: [56, 94],
  duration: 1.35,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1a0516", "#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"], seed: 3 },
};

const CY = -30;

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), lights = new Lights();
  lights.add(0, CY, 36, C[5], 0.85, 0.32);
  lights.add(0, CY, 14, WHITE, 0.75, 0.08);
  // twinkles thrown out on curving paths: each one's heading turns as it flies, and drag brakes it
  const stars = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * TAU + R.range(-0.2, 0.2), sp = R.range(145, 225) * (i % 3 === 0 ? 1.12 : 0.85);
    return { x: 0, y: CY, a, sp, turn: (i % 2 ? 1 : -1) * R.range(2.5, 5), life: R.range(0.75, 1.15), age: 0, size: i % 3 === 0 ? 2.6 : R.range(1.2, 2), tr: [], c: i % 4 === 0 ? WHITE : i % 2 ? C[6] : C[5], ph: R.range(0, TAU) };
  });
  const motes = Array.from({ length: 7 }, () => ({ x: R.range(-8, 8), y: CY + R.range(-4, 6), vy: -R.range(12, 30), life: R.range(0.5, 0.9), d: R.range(0.05, 0.25), w: R.range(0, TAU) }));
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const s of stars) {
        if (s.age > s.life) continue;
        s.age += dt;
        s.tr.unshift([s.x, s.y]);
        if (s.tr.length > 4) s.tr.pop();
        s.a += s.turn * dt * Math.max(0, 1 - s.age * 1.5);
        s.sp -= s.sp * 4.3 * dt;
        s.x += Math.cos(s.a) * s.sp * dt;
        s.y += Math.sin(s.a) * s.sp * dt + 6 * s.age * dt;
        // the floor turns them back up
        if (s.y > -2) (s.y = -2), (s.a = -Math.abs(s.a)), (s.sp *= 0.5);
      }
      lights.update(dt);
    },
    draw(p) {
      // the flash: a white disc and a cross of light, gone in a few frames
      if (t < 0.07) p.circle(0, CY, 5.5 * (1 - t / 0.07) + 1, WHITE);
      if (t < 0.16) {
        const k = 1 - t / 0.16, L = 26 * ease.outCubic(Math.min(1, t / 0.03 + 0.4)) * k;
        for (const [dx, dy, l] of [[1, 0, 1], [-1, 0, 1], [0, 1, 0.6], [0, -1, 0.6]])
          p.line(0, CY, dx * L * l, CY + dy * L * l, (u) => (u < 0.3 ? WHITE : u < 0.65 ? C[6] : C[5]), (u) => (u < 0.5 ? 1 : (1 - u) * 2) * (0.5 + k));
        p.glow(0, CY, 20 * k + 4, C[5], 0.6 * k);
      }
      // a thin ring snapping out fast, a softer ring following
      const u1 = t / 0.32;
      if (u1 < 1) {
        const r = 3 + 23 * ease.outExpo(u1);
        p.ring(0, CY, r, 1, u1 < 0.3 ? WHITE : C[6], 1.3 - u1 * 1.2);
        p.glowRing(0, CY, r, 4, C[5], 0.4 * (1 - u1));
      }
      const u2 = (t - 0.04) / 0.5;
      if (u2 > 0 && u2 < 1) {
        const r = 2 + 16 * ease.outCubic(u2);
        p.ring(0, CY, r, Math.max(1, 2.6 * (1 - u2)), C[5], 1 - u2);
      }
      // the twinkles, with short trails, flickering as they hang and wink out
      for (const s of stars) {
        if (s.age > s.life) continue;
        const k = 1 - s.age / s.life, tw = 0.65 + 0.35 * Math.sin(s.age * 26 + s.ph);
        s.tr.forEach(([x, y], i) => i > 0 && p.dot(x, y, i < 2 ? C[5] : C[4], (1 - i / 4) * k * 1.4));
        if (k < 0.3 && Math.sin(s.age * 40 + s.ph) < 0) continue;
        glint(p, s.x, s.y, Math.round(s.size * tw * Math.min(1, k * 2.5)), s.c, 0.45 * k);
      }
      // motes drifting up after
      for (const m of motes) {
        const a = t - m.d;
        if (a < 0 || a > m.life) continue;
        const k = 1 - a / m.life, x = m.x + Math.sin(a * 6 + m.w) * 1.5, y = m.y + m.vy * a;
        p.dot(x, y, k > 0.5 ? C[6] : C[5], k * 1.5);
        p.glow(x + 0.5, y + 0.5, 3, C[5], 0.3 * k);
      }
      lights.draw(p);
    },
  };
}
