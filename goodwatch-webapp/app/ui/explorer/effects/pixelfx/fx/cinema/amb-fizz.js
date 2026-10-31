// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, rand, rng, ease, lerp, WHITE } from "../../core/index.js";
import { count, radius } from "./_amb2.js";

export const meta = {
  name: "Champagne fizz",
  desc: "Over a France island: streams of tiny golden bubbles rise in wavering columns, growing as they climb and popping in a tiny sparkle at the top, in warm light.",
  tags: ["cinema", "ambient", "island", "france", "champagne", "bubbles", "loop"],
  size: [112, 104],
  origin: [56, 56],
  fps: 30,
  bg: "dark",
  duration: 6,
  loop: true,
  options: { palette: ["#3a2406", "#9a6a18", "#e0b040", "#ffe48a", "#fffbe0"], seed: 1, r: 30, density: 1 },
};

const POP = 0.1; // seconds of pop at the end of each bubble

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), D = meta.duration, S = o.seed;
  const cols = count(3, o.density), s = Math.max(0.8, Math.min(1.8, R / 30));
  for (let c = 0; c < cols; c++) {
    const Q = (k) => rand(S, 400 + c, k);
    const xc = (((c + 0.3 + Q(1) * 0.4) / cols) * 2 - 1) * R * 0.85, yb = R * (0.15 + Q(2) * 0.15), yt = -R * (0.75 + Q(3) * 0.25);
    // a little warm light where the stream starts
    p.glow(xc, yb - 2, 7 * s, C[2], 0.14);
    // a steady stream: births evenly spaced with a little jitter, so bubbles never pile up
    const m = Math.round(22 + 8 * s);
    for (let j = 0; j < m; j++) {
      const r = rng(S * 31 + c, j, 5), life = r.range(1.6, 2.2), born = ((j + r.range(0, 0.45)) / m) * D;
      const age = (((t - born) % D) + D) % D;
      if (age >= life) continue;
      const rise = life - POP, k = Math.min(1, age / rise);
      // bubbles speed up as they climb; the column wavers as a whole and each bubble wobbles
      const y = lerp(yb, yt * r.range(0.85, 1), ease.inQuad(k) * 0.6 + k * 0.4);
      const x = xc + Math.sin(y * 0.18 + t * 2.1 + c) * 1.6 * s + Math.sin(age * 9 + r.range(0, 6)) * 0.5 * k;
      const X = Math.round(x), Y = Math.round(y);
      if (age > rise) {
        // pop: a hot cross, then four dots flying out
        const q = (age - rise) / POP;
        if (q < 0.4) {
          p.px(X, Y, WHITE); p.px(X + 1, Y, C[4]); p.px(X - 1, Y, C[4]); p.px(X, Y - 1, C[4]); p.px(X, Y + 1, C[4]);
          p.glow(X, Y, 5, C[3], 0.45);
        } else {
          const d = 2 + Math.round(q * 1.5);
          p.px(X + d, Y, C[3]); p.px(X - d, Y, C[3]); p.px(X, Y - d, C[2]); p.px(X, Y + d, C[2]);
          p.light(X, Y, C[3], 0.3);
        }
        continue;
      }
      const size = k * r.range(0.85, 1.15);
      if (size < 0.25) p.blend(X, Y, C[2], 0.5 + size * 2);
      else if (size < 0.55) { p.px(X, Y, C[3]); p.light(X, Y, C[2], 0.15); }
      else if (size < 0.8 || r.chance(0.35)) {
        // 2 x 2 with a lit corner
        p.px(X, Y, C[4]); p.px(X + 1, Y, C[3]); p.px(X, Y + 1, C[3]); p.px(X + 1, Y + 1, C[2]);
        p.light(X, Y, C[3], 0.25);
      } else if (s > 1.4 && size > 0.92) {
        // big islands: a 4 x 4 bubble near the top
        p.px(X, Y - 1, C[3]); p.px(X + 1, Y - 1, C[3]); p.px(X - 1, Y, C[3]); p.px(X - 1, Y + 1, C[2]);
        p.px(X + 2, Y, C[2]); p.px(X + 2, Y + 1, C[1]); p.px(X, Y + 2, C[1]); p.px(X + 1, Y + 2, C[1]);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) p.blend(X + dx, Y + dy, C[2], 0.3);
        p.px(X, Y, WHITE);
        p.light(X, Y, C[3], 0.35);
      } else {
        // a hollow ring: lit top-left, darker bottom-right, glassy middle
        p.px(X, Y - 1, C[3]); p.px(X - 1, Y, C[3]); p.px(X + 1, Y, C[2]); p.px(X, Y + 1, C[2]);
        p.blend(X, Y, C[2], 0.35);
        p.px(X - 1, Y - 1, WHITE);
        p.light(X, Y, C[3], 0.3);
      }
    }
  }
}
