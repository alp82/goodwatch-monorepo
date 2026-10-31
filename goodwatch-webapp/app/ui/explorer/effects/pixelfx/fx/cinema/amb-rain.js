import { fit, rand, seg } from "../../core/index.js";
import { AMB, count, bornAt } from "./_amb1.js";

export const meta = {
  name: "Ambient rain",
  desc: "A small local shower over an island: thin slanting streaks fall from a faint cloud and tick into tiny splashes along its middle.",
  tags: ["cinema", "ambient", "sad", "rain", "loop"],
  ...AMB,
  duration: 4,
  loop: true,
  options: { palette: ["#0c1424", "#1c2c48", "#34507a", "#5c80b0", "#9cbce0", "#dceaff"], seed: 1, r: 30, density: 1 },
};

const FALL = 0.55;

export function draw(p, t, o) {
  const C = fit(o.palette, 6), D = meta.duration, r = o.r, S = o.seed, n = count(o, 26);
  const top = -r * 0.95, cr = Math.min(8, Math.max(3, r * 0.16)), w = Math.min(r * 0.7, cr * 3.6), floor = (x) => -r * 0.02 + Math.abs(x) * 0.12;
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k), born = bornAt(i, n, D, R(1)), age = (((t - born) % D) + D) % D;
    if (age > FALL + 0.2) continue;
    const xs = (R(2) - 0.5) * 2 * w, life = FALL * (0.85 + R(3) * 0.3), len = 4 + Math.round(R(4) * 2);
    const ground = floor(xs);
    if (age < life) {
      const u = age / life, y = top + (ground - top) * u, x = xs + (u - 0.5) * 4;
      // a solid head and a see-through tail, no dither
      p.px(x, y, C[4]);
      for (let q = 1; q < len; q++) p.blend(x - q * 0.25, y - q, C[3], 0.75 - q * 0.15);
    } else {
      // the splash: two ticks out to the sides, then a dot
      const s = (age - life) / 0.2, X = Math.round(xs + 2), Y = Math.round(ground);
      if (s < 0.5) {
        p.px(X - 1, Y - 1, C[4]);
        p.px(X + 1, Y - 1, C[4]);
        p.light(X, Y, C[4], 0.25);
      } else p.dot(X, Y, C[3], 1 - s);
    }
  }
  // a small lumpy cloud the shower falls from: dark belly, lit crowns, drifting a little
  const sway = Math.sin((t / D) * Math.PI * 2) * 1.5;
  const LUMPS = [[-0.95, 0.35, 0.6], [-0.62, 0, 0.85], [-0.3, -0.35, 1], [0, -0.1, 1.1], [0.3, -0.45, 0.95], [0.6, -0.05, 0.85], [0.92, 0.3, 0.6]];
  for (const [lx, ly, lr] of LUMPS) p.disc(lx * w + sway, top + ly * cr, cr * lr, C[1], 0.5);
  for (const [lx, ly, lr] of LUMPS) p.disc(lx * w + sway - 0.5, top + ly * cr - cr * 0.4, cr * lr * 0.55, C[2], 0.3);
}
