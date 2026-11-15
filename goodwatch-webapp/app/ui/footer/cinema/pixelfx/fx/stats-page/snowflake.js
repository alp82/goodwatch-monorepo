// Made for the GoodWatch stats page: A few crisp snowflakes, the teaser for the Christmas trivia card.
import { fit, seg, clamp, smooth, rand, TAU } from "../../core/index.js";

export const meta = {
  name: "Snowflakes",
  desc: "Three or four crisp eight-arm snowflakes, cool white with a hot core, drift down with a gentle sway and a faint streak, then melt out, in the look of the ambient snow.",
  tags: ["stats-page", "snow", "winter", "christmas", "one-shot"],
  size: [96, 44],
  origin: [48, 8],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1a2440", "#3a5078", "#7a94bc", "#bcd0ec", "#eef6ff", "#ffffff"], w: 60, seed: 1, tease: 0 },
};

export const tease = { duration: 1.0 };

// eight-arm flakes with gaps between the arms, so they read as crystals and not as blobs:
// [dx, dy, ring] (1 next to the core, 2 the arms, 3 the tips)
const SMALL = [[0, -1, 1], [0, 1, 1], [-1, 0, 1], [1, 0, 1], [0, -2, 2], [0, 2, 2], [-2, 0, 2], [2, 0, 2], [-2, -2, 2], [2, -2, 2], [-2, 2, 2], [2, 2, 2]];
const BIG = [[0, -1, 1], [0, 1, 1], [-1, 0, 1], [1, 0, 1], [0, -2, 2], [0, 2, 2], [-2, 0, 2], [2, 0, 2], [-2, -2, 2], [2, -2, 2], [-2, 2, 2], [2, 2, 2],
  [0, -3, 3], [0, 3, 3], [-3, 0, 3], [3, 0, 3], [-3, -3, 3], [3, -3, 3], [-3, 3, 3], [3, 3, 3]];

/** A flake: s = 3 big crystal, 2 small crystal, 1 a tiny plus, 0 one pixel. */
function flake(p, X, Y, s, C, a, glint) {
  if (s === 0) return p.blend(X, Y, C[4], a);
  p.blend(X, Y, C[5], a);
  if (s === 1) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) p.blend(X + dx, Y + dy, C[3], a * 0.8);
    return;
  }
  for (const [dx, dy, k] of s === 3 ? BIG : SMALL) {
    const diag = dx !== 0 && dy !== 0;
    const c = k === 1 ? C[4] : k === 2 ? (diag && !glint ? C[3] : C[4]) : glint ? C[3] : C[2];
    p.blend(X + dx, Y + dy, c, k === 3 ? a * 0.8 : a);
  }
}

/** One falling flake at age u (0..1) of its life: in at the top, sway, a soft halo, melt out low. */
function drop(p, C, x0, y0, fall, sway, ph, u, size, melt, S, i) {
  const x = x0 + Math.sin(ph + u * TAU * 0.8) * sway + u * 2, y = y0 + fall * u;
  const a = clamp(Math.min(smooth(0, 0.14, u), 1 - smooth(0.78, 1, u)));
  if (a <= 0.02) return;
  const X = Math.round(x), Y = Math.round(y);
  // melting: it loses its tips, then its arms, as it fades
  const s = melt ? (u < 0.62 ? size : u < 0.78 ? size - 1 : u < 0.9 ? 1 : 0) : size;
  const glint = Math.floor(u * 20 + rand(S, i, 9) * 20) % 7 === 0;
  // a faint streak above, then the flake, a translucent halo and a little cold light
  for (let k = 1; k <= 2; k++) p.blend(X - Math.cos(ph + u * TAU * 0.8) * 0.4 * k, Y - 1 - k - (s === 3 ? 1 : 0), C[3], a * 0.35 * (1 - k / 3));
  flake(p, X, Y, s, C, a, glint);
  p.disc(X + 0.5, Y + 0.5, s === 3 ? 3.5 : 2.6, C[3], 0.06 * a);
  p.glow(X + 0.5, Y + 0.5, s === 3 ? 7 : 5, C[3], 0.12 * a);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), S = o.seed, w = Math.max(20, o.w ?? 60);
  const teasing = !!o.tease;
  const D = teasing ? tease.duration : meta.duration;
  if (t >= D) return;

  if (teasing) {
    // one big flake drifts down about 12 px, swaying, and melts out
    drop(p, C, 0, 0, 12, 1.6, 0.4, seg(t, 0, D - 0.02), 3, true, S, 0);
    return;
  }

  // four flakes spread across the width, staggered, big and small, each with its own sway
  const FL = [
    { at: 0.0, x: -0.32, size: 3, life: 1.7 },
    { at: 0.22, x: 0.18, size: 2, life: 1.5 },
    { at: 0.42, x: 0.42, size: 3, life: 1.6 },
    { at: 0.6, x: -0.06, size: 2, life: 1.5 },
  ];
  FL.forEach((f, i) => {
    const age = t - f.at;
    if (age < 0 || age >= f.life) return;
    const u = age / f.life;
    const fall = 20 + rand(S, i, 1) * 6, sway = 1.6 + rand(S, i, 2) * 1.6, ph = rand(S, i, 3) * TAU;
    drop(p, C, f.x * w + (rand(S, i, 4) - 0.5) * 4, -2 - rand(S, i, 5) * 3, fall, sway, ph, u, f.size, true, S, i);
  });
}
