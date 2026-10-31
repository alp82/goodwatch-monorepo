// Made for the GoodWatch explorer map: ambient loop.
import { cycle, fit, hex, mix, bump, WHITE, TAU } from "../../core/index.js";
import { spot, env, count, radius, step } from "./_amb2.js";

export const meta = {
  name: "Question marks",
  desc: "Over a mystery island: a couple of small question marks drift up, sway and fade, and a glint winks on one of them.",
  tags: ["cinema", "ambient", "island", "mystery", "question", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 7,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#101830", "#24407a", "#4f7fd0", "#a8c8ff", "#ffffff"], seed: 1, r: 30, density: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), big = R >= 20;
  cycle(t, meta.duration, count(2, o.density), o.seed, (g) => g.range(3, 4), (age, life, r) => {
    const [x0, y0] = spot(r, R, 0.35, 0.8), k = age / life, a = env(k, 0.18, 0.4);
    const x = x0 + Math.sin(age * 1.8 + r.range(0, TAU)) * 1.6, y = y0 - k * R * 0.3 - 3;
    const font = big || o.density >= 2 ? "big" : "mini", c = step(C, a);
    if (!c) return;
    p.text("?", x, y, c, { font, align: "center", shadow: C[0] });
    p.light(x, y + (font === "big" ? 3 : 2), C[2], 0.2 * a);
    // a wink on the hook
    const w = bump(age, life * 0.4, life * 0.4 + 0.35);
    if (w > 0) {
      const gx = Math.round(x) + (font === "big" ? 1 : 0), gy = Math.round(y);
      p.px(gx, gy, mix(C[4], WHITE, 0.5));
      if (w > 0.5) { p.px(gx - 1, gy, C[3]); p.px(gx + 1, gy, C[3]); p.px(gx, gy - 1, C[3]); p.px(gx, gy + 1, C[3]); }
      p.glow(gx, gy, 4, C[4], 0.3 * w);
    }
  });
  // faint specks of a trail
  cycle(t, meta.duration, count(3, o.density), o.seed + 3, 0.8, (age, life, r) => {
    const [x, y] = spot(r, R, 0.4, 1);
    p.dot(x, y - age * 4, C[2], env(age / life, 0.3, 0.6) * 0.8);
  });
}
