// Made for the GoodWatch explorer map: ambient loop.
import { cycle, fit, hex, mix, ease, WHITE, TAU } from "../../core/index.js";
import { spot, env, count, radius, step } from "./_amb2.js";

export const meta = {
  name: "Thought bubbles",
  desc: "Over a mind or kids island: round bubbles rise and wobble with a glint on top, then pop into a ring of pixels.",
  tags: ["cinema", "ambient", "island", "bubbles", "mind", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0e1a33", "#2a4f8a", "#5ea0e0", "#b8e4ff", "#ffffff"], seed: 1, r: 30, density: 1 },
};

// hand-drawn rings: h lit rim (top left), r rim, d shadow rim (bottom right), w the glint
const RINGS = [
  [".hh.", "hw.r", "h..d", ".rd."],
  [".hhr.", "hw..r", "h...d", "r...d", ".rdd."],
  ["..hhr..", ".h...r.", "h.w...r", "h.....d", "r.....d", ".r...d.", "..ddd.."],
  ["..hhhr..", ".h....r.", "h.w....r", "h......d", "h......d", "r......d", ".r....d.", "..dddd.."],
];
const POP = 0.24;

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), d2 = o.density >= 2;
  const glint = mix(C[4], WHITE, 0.5);
  cycle(t, meta.duration, count(4, o.density), o.seed, (g) => g.range(2, 3), (age, life, r) => {
    const [x0, y0] = spot(r, R, 0.3, 0.75), rise = R * r.range(0.3, 0.45), size = r.int(0, d2 ? 3 : 2);
    const ph = r.range(0, TAU), grow = life - POP, k = Math.min(age, grow) / grow;
    const x = Math.round(x0 + Math.sin(age * 2.6 + ph) * 1.8), y = Math.round(y0 - rise * ease.outSine(k));
    const rows = RINGS[size], n = rows.length, h = n / 2;
    if (age < grow) {
      // starts one size smaller, swells as it rises
      const a = env(k, 0.15, 0.01), rr = RINGS[Math.max(0, size - (k < 0.2 ? 1 : 0))], c = step(C, a);
      if (!c) return;
      const m = rr.length / 2;
      p.sprite(rr, { h: C[3], r: c === C[3] ? C[2] : c, d: C[1], w: glint }, x - m, y - m);
      p.light(x, y, C[2], 0.14 * a);
    } else {
      // pop: a ring of dots flies out and fades
      const u = (age - grow) / POP, rr = h + 0.5 + ease.outQuad(u) * 3;
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU + ph;
        p.dot(x + Math.cos(an) * rr, y + Math.sin(an) * rr, i % 2 ? C[4] : C[3], 1 - u);
      }
      if (u < 0.3) p.light(x, y, C[4], 0.3);
    }
  });
}
