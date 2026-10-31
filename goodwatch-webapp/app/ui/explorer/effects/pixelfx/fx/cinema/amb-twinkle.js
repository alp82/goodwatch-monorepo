// Made for the GoodWatch explorer map: ambient loop.
import { cycle, fit, hex, mix, bump, WHITE } from "../../core/index.js";
import { spot, env, count, radius } from "./_amb2.js";

export const meta = {
  name: "Island twinkle",
  desc: "The fallback over any island: a few 4-point stars swell and fade at their own times in the island's color, with dim specks blinking between them.",
  tags: ["cinema", "ambient", "island", "stars", "twinkle", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1b2a4a", "#35558a", "#6f9bd8", "#bcd8ff", "#ffffff"], seed: 1, r: 30, density: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), d2 = o.density >= 2;
  const core = mix(C[4], WHITE, 0.6), arm = mix(C[3], C[4], 0.4);
  // the stars: each swells to its arm length and back
  cycle(t, meta.duration, count(5, o.density), o.seed, (g) => g.range(1.4, 2.4), (age, life, r) => {
    const [x, y] = spot(r, R);
    const k = bump(age, 0, life), big = r.range(1.4, d2 ? 3.4 : 2.6), n = Math.round(k * big);
    p.light(x, y, C[3], 0.3 * k);
    if (n < 1) return p.dot(x, y, C[2], k * 2);
    for (let i = 1; i <= n; i++) {
      const c = i === n && n > 1 ? C[2] : arm;
      p.px(x + i, y, c); p.px(x - i, y, c); p.px(x, y + i, c); p.px(x, y - i, c);
    }
    p.px(x, y, core);
    if (n >= 2) p.glow(x, y, 3 + n * 1.5, C[3], 0.22 * k);
  });
  // specks: one pixel blinks, far dimmer
  cycle(t, meta.duration, count(5, o.density), o.seed + 7, (g) => g.range(0.5, 1), (age, life, r) => {
    const [x, y] = spot(r, R, 0.35, 1.05);
    p.dot(x, y, r.chance(0.5) ? C[3] : C[2], env(age / life, 0.3, 0.6));
  });
}
