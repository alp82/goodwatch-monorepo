// Made for the GoodWatch stats page: A snoring "Zzz" for the longest movie.
import { fit, hex, seg, clamp, ease, lerp, rand, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Zzz",
  desc: "A snore bubble swells and pops, then three outlined Z letters, small to big, float up and to the right one after another, swaying, growing and fading.",
  tags: ["stats-page", "sleep", "snore", "zzz", "one-shot"],
  size: [48, 56],
  origin: [10, 46],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e1a33", "#3d3566", "#6c62a6", "#a59ad8", "#d6d0f4", "#ffffff"],
    seed: 1,
    tease: 0,
  },
};

export const tease = { duration: 0.9 };

// each Z: born, life, size it starts and ends at (px tall), how far it climbs and drifts right
// they climb a diagonal stair, each one up and to the right of the last, so all three read at once
const ZS = [
  { born: 0.34, life: 1.8, s0: 3, s1: 5, bx: 5, by: -7, up: 9, right: 3 },
  { born: 0.68, life: 1.6, s0: 4, s1: 7, bx: 12, by: -15, up: 10, right: 4 },
  { born: 1.02, life: 1.48, s0: 5, s1: 9, bx: 21, by: -24, up: 11, right: 5 },
];

/** The pixels of a Z of size n (n x n): top bar, a diagonal down to the left, bottom bar. */
function zCells(n) {
  const out = [];
  for (let x = 0; x < n; x++) out.push([x, 0, 0], [x, n - 1, 2]);
  for (let y = 1; y < n - 1; y++) {
    const x = Math.round((n - 1) * (1 - y / (n - 1)));
    out.push([x, y, 1]);
    if (n >= 7) out.push([x - 1 >= 0 ? x - 1 : x, y, 1]); // a thicker stroke on the big one
  }
  return out;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6).map(hex), S = o.seed;
  if (o.tease) return teaser(p, t, C);
  if (t >= meta.duration) return;

  // the snore bubble: swells with two breaths, then pops into a ring of beads
  const POP = 0.4;
  if (t < POP) {
    const g = seg(t, 0, POP), r = 0.8 + ease.outCubic(g) * 2.6 + Math.sin(g * TAU * 2) * 0.25;
    const bx = 3, by = -3 - g * 2;
    p.disc(bx, by, r + 0.4, C[3], (d) => (d > 0.7 ? 0.0 : 0.16));
    p.ring(bx, by, r, 1, C[3]);
    p.px(bx - r * 0.5, by - r * 0.5, C[5]);
    p.light(bx, by, C[3], 0.2);
  } else if (t < POP + 0.24) {
    const g = seg(t, POP, POP + 0.24), r = 3.4 + g * 4;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.3;
      p.dot(3 + Math.cos(a) * r, -5 + Math.sin(a) * r, i % 2 ? C[4] : C[3], 1 - g);
    }
    if (g < 0.2) { p.px(3, -5, WHITE); p.light(3, -5, C[4], 0.6); }
  }

  // the Zs
  ZS.forEach((z, i) => {
    const age = t - z.born;
    if (age < 0 || age > z.life) return;
    const u = age / z.life;
    const n = Math.round(lerp(z.s0, z.s1, ease.outCubic(seg(u, 0, 0.7))));
    const pop = age < 0.1 ? 1 : 0; // a white hero frame as each one appears
    const sway = Math.sin(age * 4.2 + i * 1.3) * 1.6 * seg(u, 0, 0.3);
    const spring = ease.outBack(seg(age, 0, 0.16)); // it springs out of the sleeper's corner to its step
    const x = Math.round(lerp(2, z.bx, spring) + z.right * u + sway - n / 2);
    const y = Math.round(lerp(-3, z.by, spring) - z.up * ease.outSine(u) - n / 2);
    const fade = seg(u, 0.55, 0.95);
    // fill cools through the ramp as it fades, then dithers out
    const fill = pop ? WHITE : C[clamp(Math.round(4 - fade * 2.2), 1, 5)];
    const lit = pop ? WHITE : C[clamp(Math.round(5 - fade * 2.4), 1, 5)];
    const edge = C[clamp(Math.round(1.6 - fade), 0, 5)];
    const a = 1 - seg(u, 0.9, 1);
    const cells = zCells(n);
    // dark outline first, so the letter keeps its shape over a busy page
    for (const [cx, cy] of cells)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.dot(x + cx + dx, y + cy + dy, edge, a);
    for (const [cx, cy, part] of cells) p.dot(x + cx, y + cy, part === 0 ? lit : fill, a);
    p.glow(x + n / 2, y + n / 2, n + 3, C[3], 0.22 * a * (1 - fade * 0.5) + pop * 0.3);
    // a stray twinkle off the biggest one
    if (i === 2 && u > 0.3 && u < 0.36) p.px(x + n + 1, y - 1, C[5]);
  });

  // a couple of tiny dream motes drifting up between them
  for (let i = 0; i < 4; i++) {
    const b = 0.5 + i * 0.35, age = t - b, L = 0.9;
    if (age < 0 || age > L) continue;
    const u = age / L;
    p.dot(4 + rand(S, i, 1) * 10 + u * 5, -6 - u * 16 - rand(S, i, 2) * 6, C[4], 1 - u);
  }
}

/** The teaser: one small z springs out of the sleeper's corner, floats up a few px and fades. */
function teaser(p, t, C) {
  const age = t - 0.06, life = tease.duration - 0.08;
  if (age < 0 || age >= life) return;
  const u = age / life, n = age < 0.15 ? 4 : 5;
  const pop = age < 0.067 ? 1 : 0;
  const spring = ease.outBack(seg(age, 0, 0.18));
  const sway = Math.sin(age * 5) * 0.8 * seg(u, 0.1, 0.4);
  const x = Math.round(lerp(2, 5, spring) + sway - n / 2);
  const y = Math.round(lerp(-3, -8, spring) - 4 * ease.outSine(u) - n / 2);
  const fade = seg(u, 0.45, 0.9);
  const fill = pop ? WHITE : C[clamp(Math.round(4 - fade * 2.2), 1, 5)];
  const lit = pop ? WHITE : C[clamp(Math.round(5 - fade * 2.4), 1, 5)];
  const edge = C[clamp(Math.round(1.6 - fade), 0, 5)];
  const a = 1 - ease.inQuad(seg(u, 0.6, 1)); // it thins out (true translucency, no dither)
  const cells = zCells(n);
  for (const [cx, cy] of cells)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.blend(x + cx + dx, y + cy + dy, edge, a);
  for (const [cx, cy, part] of cells) p.blend(x + cx, y + cy, part === 0 ? lit : fill, a);
  p.glow(x + n / 2, y + n / 2, n + 3, C[3], 0.2 * a * (1 - fade * 0.5) + pop * 0.25);
}
