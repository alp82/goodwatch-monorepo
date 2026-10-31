// Made for the GoodWatch explorer map: ambient loop.
import { cycle, fit, hex, mix, WHITE, TAU } from "../../core/index.js";
import { spot, env, count, radius, step } from "./_amb2.js";

export const meta = {
  name: "Quirky squiggles",
  desc: "Over a quirky island: little curls spin and zigzags hop on the spot, squashing flat on each landing, popping in and out at their own times.",
  tags: ["cinema", "ambient", "island", "quirky", "doodle", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#2a1030", "#7a2c80", "#e058a8", "#ffb0d8", "#fff4fa"], seed: 1, r: 30, density: 1 },
};

const ZIG = ["#...#..", ".#.#.#.", "..#...#"];
const ZIG_SQUASH = [".#.#.#.", "#.#.#.#"];

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), d2 = o.density >= 2;
  cycle(t, meta.duration, count(3, o.density), o.seed, (g) => g.range(1.8, 2.6), (age, life, r, i) => {
    const curl = i % 3 !== 1, [x0, y0] = spot(r, R, 0.4, 0.85), a = env(age / life, 0.12, 0.25), ph = r.range(0, TAU);
    const hopf = r.range(4, 5.5), dir = r.sign(), c = step(C, a, 3);
    if (!c) return;
    const hop = Math.abs(Math.sin(age * hopf + ph)), x = Math.round(x0), y = Math.round(y0 - hop * (d2 ? 5 : 4));
    if (curl) {
      // a round curl, one and a half turns out from the middle, spinning; its outer end is the bright tip
      const rad = d2 || R > 40 ? 5 : 4, turn = age * 4 * dir;
      let lx = 1e9, ly = 1e9;
      for (let i = 0; i <= 28; i++) {
        const u = i / 28, an = u * TAU * 1.5 * dir + turn, px = Math.round(x + Math.cos(an) * u * rad), py = Math.round(y + Math.sin(an) * u * rad);
        if (px === lx && py === ly) continue;
        lx = px; ly = py;
        p.px(px, py, u > 0.85 ? mix(C[4], WHITE, 0.2) : c);
      }
    } else {
      // a zigzag that squashes flat as it lands
      const rows = hop < 0.18 ? ZIG_SQUASH : ZIG;
      p.sprite(rows, {}, x - 3, y - (rows.length >> 1), { tint: c });
      if (hop < 0.18) { p.dot(x - 5, y + 1, C[2], 0.7); p.dot(x + 5, y + 1, C[2], 0.7); }
    }
    p.light(x, y, C[2], 0.16 * a);
  });
  // the odd sparkle pip between them
  cycle(t, meta.duration, count(3, o.density), o.seed + 4, 0.4, (age, life, r) => {
    const [x, y] = spot(r, R, 0.3, 1);
    p.dot(x, y, mix(C[4], WHITE, 0.3), env(age / life, 0.1, 0.6));
  });
}
