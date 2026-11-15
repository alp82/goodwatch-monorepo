// Made for the GoodWatch stats page: Friday the 13th: a cold lightning bolt cracks down beside the answer.
import { fit, seg, clamp, Rng, bolt, forks, WHITE } from "../../core/index.js";

export const meta = {
  name: "Night bolt",
  desc: "A cold forked bolt cracks down in one white frame, flickers twice and cools through blue steps to a dim afterimage; a pale glow pools where it struck and sparks spit off.",
  tags: ["stats-page", "lightning", "night", "one-shot"],
  size: [56, 72],
  origin: [28, 64],
  duration: 1.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0a1020", "#1c2c50", "#3c5a9a", "#7aa0e0", "#c8dcff", "#ffffff"],
    h: 56,
    seed: 4,
    tease: 0,
  },
};

export const tease = { duration: 0.5 };

// the strike's brightness over time: a white crack, a dip, two flickers, then a slow cool-down
const FLASH = [[0, 0.05, 5], [0.05, 0.1, 3], [0.1, 0.14, 5], [0.14, 0.2, 2], [0.2, 0.24, 4]];
function level(t) {
  for (const [a, b, k] of FLASH) if (t >= a && t < b) return k;
  return t < 0.75 ? 3 - Math.floor(seg(t, 0.24, 0.75) * 3) : 0;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), H = Math.max(20, o.h);
  if (o.tease) {
    // a far-off flicker: a short faint fork high up, twice
    if (t >= tease.duration) return;
    const on = (t < 0.06) || (t > 0.16 && t < 0.2);
    if (!on) return;
    const r = new Rng(o.seed + 9);
    const path = bolt(r, 2, -H, -4, -H + 12, { jag: 0.3, depth: 3 });
    p.polyline(path, C[3]);
    p.glow(0, -H + 6, 8, C[3], 0.25);
    return;
  }
  if (t >= meta.duration) return;
  const r = new Rng(o.seed);
  const path = bolt(r, 5, -H, 0, 0, { jag: 0.3, depth: 4 });
  const kids = forks(r, path.slice(2, -3), { count: 2, len: 11, jag: 0.3, spread: 0.8 });
  const k = level(t);
  if (k > 0) {
    // the sky lights up for the white frames
    if (k === 5) p.glow(0, -H / 2, H * 0.7, C[3], 0.35);
    const core = k >= 5 ? WHITE : C[k];
    const edge = C[clamp(k - 2, 1, 5)];
    // a darker edge first so the bolt keeps its shape over the page, then the core
    if (k >= 4) for (const [x, y] of path) { p.px(x - 1, y, edge); p.px(x + 1, y, edge); }
    p.polyline(path, core);
    if (k >= 3) for (const f of kids) p.polyline(f, k >= 4 ? C[4] : C[3]);
    if (k >= 4) for (let i = 0; i < path.length; i += 6) p.light(path[i][0], path[i][1], C[4], 0.25);
    // where it struck
    p.glow(0, -1, 10, C[3], 0.08 * k);
    if (k >= 4) { p.px(-1, 0, WHITE); p.px(1, 0, WHITE); p.px(0, -1, WHITE); }
  }
  // sparks spit off the strike point
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45, sp = 30 + (i % 3) * 12, life = 0.35 + (i % 2) * 0.12;
    const u = t - 0.02;
    if (u < 0 || u > life) continue;
    const x = Math.cos(a) * sp * u, y = Math.sin(a) * sp * u + 120 * u * u;
    if (y > 1) continue;
    p.px(x, y, u / life < 0.4 ? WHITE : C[3]);
  }
}
