// Made for the GoodWatch explorer map: ambient loop.
import { cycle, fit, hex, TAU, WHITE, rand, rng } from "../../core/index.js";
import { env, count, radius } from "./_amb2.js";

export const meta = {
  name: "Floating lamps",
  desc: "Over an India island: small clay lamps float slowly up, each with a flickering teardrop flame and a warm glow, among a few drifting marigold petals.",
  tags: ["cinema", "ambient", "island", "india", "lamps", "diya", "festival", "loop"],
  size: [112, 104],
  origin: [56, 56],
  fps: 30,
  bg: "dark",
  duration: 8,
  loop: true,
  options: {
    palette: ["#5a1a04", "#d0520e", "#ff9a1e", "#ffd860", "#fff8d8"],
    clay: ["#200c06", "#5a2412", "#9c4a22", "#d27a40"],
    petal: ["#7a2a04", "#e0660a", "#ffa21a", "#ffd04a"],
    seed: 1, r: 30, density: 1,
  },
};

// the dish, 7 wide: h lit rim, o oil lit by the flame, m clay, d shade
const DISH = ["hhooodm", ".mmmmd.", "..ddd.."];
const DISH_BIG = ["hhooooom", "hmmmmmmd", ".mmmmdd.", "..dddd.."];

export function draw(p, t, o) {
  const F = fit(o.palette, 5).map(hex), K = fit(o.clay, 4).map(hex), P = fit(o.petal, 4).map(hex);
  const R = radius(o), D = meta.duration, big = R >= 26;
  // lamps rise slowly; one cycle is the whole loop so they move at a calm, even pace
  const n = count(4, o.density), ORDER = [0, 2, 1, 3, 5, 7, 4, 6];
  for (let i = 0; i < n; i++) {
    // evenly spaced births; lanes visited out of order so neighbours in time are apart in space
    const r = rng(o.seed, i, 31), life = r.range(5.2, 6.6), born = ((i + r.range(0, 0.3)) / n) * D;
    const age = (((t - born) % D) + D) % D;
    if (age >= life) continue;
    const k = age / life, ph = r.range(0, TAU);
    // each lamp keeps its own lane across the island, so they never bunch up
    const lane = ORDER[i % 8] % n, x0 = (((lane + r.range(0.25, 0.75)) / n) * 2 - 1) * R * 0.8, y0 = R * r.range(0.05, 0.25), rise = R * r.range(0.9, 1.15);
    const x = Math.round(x0 + Math.sin(age * 0.9 + ph) * R * 0.06), y = Math.round(y0 - rise * k + Math.sin(age * 2.1 + ph) * 0.6);
    const a = env(k, 0.15, 0.25);
    if (a <= 0.12) continue;
    const rows = big ? DISH_BIG : DISH, W = rows[0].length, X = x - (W >> 1);
    const dim = a < 0.5 ? 1 : 0;
    p.sprite(rows, { h: K[3 - dim], m: K[2 - dim], d: K[1 - dim], o: F[3 - dim] }, X, y);
    // the flame: a teardrop on the wick, flickering in height and sway
    const fl = rand(o.seed, i * 997 + Math.floor((t * 12) % (D * 12)), 3), fl2 = rand(o.seed, i * 991 + Math.floor((t * 7) % (D * 7)), 5);
    const h = Math.max(1, Math.round((big ? 5 : 4) * Math.min(1, a * 1.6) + (fl > 0.6 ? 1 : 0))), sway = fl2 > 0.8 ? 1 : fl2 < 0.15 ? -1 : 0;
    const fx = x, fb = y - 1;
    // teardrop, bottom up: a wide hot base on the wick, a yellow body, a thin tip that sways
    const rowsF = h >= 5 ? ["base", "body", "body2", "neck", "tip"] : h === 4 ? ["base", "body", "neck", "tip"] : h === 3 ? ["base", "neck", "tip"] : h === 2 ? ["base", "tip"] : ["tip"];
    rowsF.forEach((kind, j) => {
      const yy = fb - j;
      if (kind === "base") { p.px(fx, yy, WHITE); p.px(fx - 1, yy, F[3]); p.px(fx + 1, yy, F[3]); }
      else if (kind === "body") { p.px(fx, yy, F[4]); p.px(fx - 1, yy, F[2]); p.px(fx + 1, yy, F[2]); }
      else if (kind === "body2") { p.px(fx, yy, F[3]); p.px(fx - 1, yy, F[1]); p.px(fx + 1, yy, F[1]); }
      else if (kind === "neck") p.px(fx, yy, F[3]);
      else p.px(fx + sway, yy, F[2]);
    });
    const fk = (0.8 + fl * 0.2) * a;
    p.glow(fx, fb - 2, (big ? 14 : 10), F[2], 0.38 * fk);
    p.glow(fx, fb - 1, 4, F[3], 0.45 * fk);
    p.light(fx, fb - 1, F[4], 0.4 * fk);
  }
  // marigold petals, few and slow, turning over as they drift down
  cycle(t, D, count(4, o.density), o.seed + 77, (g) => g.range(3.5, 5), (age, life, r) => {
    const k = age / life, ph = r.range(0, TAU), sp = r.range(2.5, 4);
    const x = r.range(-0.9, 0.9) * R + Math.sin(age * 1.4 + ph) * R * 0.1, y = -R * r.range(0.5, 0.95) + R * 0.75 * k;
    if (Math.hypot(x, y) > R * 1.05) return;
    const a = env(k, 0.15, 0.3);
    if (a < 0.25) return;
    const turn = Math.cos(age * sp + ph), c = r.chance(0.5) ? P : [P[0], P[1], P[3], P[3]];
    const X = Math.round(x), Y = Math.round(y);
    if (Math.abs(turn) < 0.3) p.px(X, Y, c[1]);
    else if (turn > 0) { p.px(X, Y, c[2]); p.px(X + 1, Y, c[3]); p.px(X, Y + 1, c[1]); }
    else { p.px(X, Y, c[1]); p.px(X + 1, Y, c[2]); }
    p.light(X, Y, c[2], 0.12 * a);
  });
}
