// Made for the GoodWatch explorer map: ambient loop.
import { cycle, fit, hex, TAU } from "../../core/index.js";
import { spot, env, count, radius, step } from "./_amb2.js";

export const meta = {
  name: "Music notes",
  desc: "Over a music island: little eighth notes and beamed pairs bob up on a swing, catch a glint on the head and fade as they rise.",
  tags: ["cinema", "ambient", "island", "music", "notes", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#2a1440", "#6b2c8c", "#c058d8", "#f0a8ff", "#ffffff"], seed: 1, r: 30, density: 1 },
};

const EIGHTH = ["..#..", "..##.", "..#.#", "..#..", "###..", "###..", ".#..."];
const PAIR = ["..#####", "..#...#", "..#...#", "..#...#", "###.###", "###.###", ".#...#."];
const HEAD = { EIGHTH: [[0, 4]], PAIR: [[0, 4], [4, 4]] };

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o);
  cycle(t, meta.duration, count(3, o.density), o.seed, (g) => g.range(2.2, 3.2), (age, life, r) => {
    const [x0, y0] = spot(r, R, 0.35, 0.8), k = age / life, pair = r.chance(0.35);
    const rise = R * r.range(0.25, 0.4) * k, sw = Math.sin(age * r.range(2.4, 3.2) + r.range(0, TAU)) * 2.2;
    const x = Math.round(x0 + sw - 3), y = Math.round(y0 - rise - 4), a = env(k, 0.15, 0.45);
    const rows = pair ? PAIR : EIGHTH;
    const c = step(C, a);
    if (!c) return;
    // a dark rim behind, so it reads over a bright island
    p.sprite(rows, {}, x + 1, y + 1, { tint: C[0] });
    p.sprite(rows, {}, x, y, { tint: c });
    for (const [hx, hy] of HEAD[pair ? "PAIR" : "EIGHTH"]) {
      if (a > 0.5) p.px(x + hx, y + hy, C[4]);
      p.light(x + hx + 1, y + hy + 1, C[3], 0.25 * a);
    }
  });
}
