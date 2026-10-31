import { fit, rand, TAU, seg, mix } from "../../core/index.js";
import { AMB, count, bornAt } from "./_amb1.js";

export const meta = {
  name: "Ambient neon",
  desc: "Neon squiggles and rings bloom over an island, their colour running round the rainbow as they drift and fade.",
  tags: ["cinema", "ambient", "trippy", "stylized", "neon", "rainbow", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: { palette: ["#ff3a6a", "#ff9a2a", "#ffe03c", "#4ae860", "#3cc8ff", "#8a5cff", "#f53cd1"], seed: 1, r: 30, density: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 7), D = meta.duration, r = o.r, S = o.seed, n = count(o, 4);
  const hue = (h) => {
    const x = ((h % 1) + 1) % 1 * 7, i = Math.floor(x);
    return mix(C[i % 7], C[(i + 1) % 7], x - i);
  };
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k), life = 2 + R(1) * 1, born = bornAt(i, n, D, R(2)), age = (((t - born) % D) + D) % D;
    if (age >= life) continue;
    const u = age / life, x = (R(3) - 0.5) * r * 1.7, y = -r * (0.15 + R(4) * 0.6) - u * 4;
    const h0 = t / D + R(5);
    if (i % 2 === 0) {
      // a squiggle that draws itself on, then wipes off from its tail; colour runs along it
      const L = 7 + R(6) * 5, amp = 1.5 + R(7), s0 = L * seg(u, 0.5, 1), s1 = L * Math.min(1, u * 4);
      for (let q = Math.ceil(s0 * 2) / 2; q <= s1; q += 0.5) {
        const v = q / L, sx = x - L / 2 + q, sy = y + Math.sin(v * TAU * 1.5 + age * 4) * amp;
        p.px(sx, sy, hue(h0 + v * 0.5));
      }
      const mid = (s0 + s1) / 2 / L;
      p.glow(x - L / 2 + mid * L, y, 7, hue(h0 + mid * 0.5), 0.28 * (1 - seg(u, 0.6, 1)));
    } else {
      // a ring that opens, then breaks into dashes and dots as it fades
      const rr = 1.5 + Math.sqrt(u) * 5, c = hue(h0), dots = Math.round(rr * 6);
      const keep = u < 0.55 ? 1 : u < 0.8 ? 2 : 4;
      for (let j = 0; j < dots; j++) {
        if (j % keep) continue;
        const b = (j / dots) * TAU;
        p.px(x + Math.cos(b) * rr, y + Math.sin(b) * rr, hue(h0 + j / dots));
      }
      p.glowRing(x, y, rr, 2.5, c, 0.25 * (1 - seg(u, 0.5, 1)));
    }
  }
}
