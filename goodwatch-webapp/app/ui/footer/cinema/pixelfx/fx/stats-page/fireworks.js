// Made for the GoodWatch stats page: Fireworks over a big number or a trivia card.
// Anchor (0, 0) is where the first shell bursts; o.r = its burst radius. The rocket launches from r + 10 below.
import { fit, seg, clamp, lerp, rand, fly, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Fireworks",
  desc: "A rocket climbs on a fading trail, a white flash, then a clean ring of gold spokes with a teal accent slows, droops and crackles; a smaller shell follows.",
  tags: ["stats-page", "fireworks", "celebration", "one-shot"],
  size: [80, 84],
  origin: [36, 38],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2a1004", "#6e2c08", "#c2620e", "#f5a623", "#ffd76a", "#fff4c8", "#ffffff"],
    accent: ["#06302e", "#0e6a64", "#22b8a8", "#7cf0e0", "#e4fffa"],
    r: 18,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.8 };

const G = 46, DRAG = 3.2; // gravity and drag on the stars: fast burst, slow droop

/** A rocket from (x, y0) climbing to (x1, y1) between t0 and t1: head, short fading tail, a slight wobble. */
function rocket(p, C, x0, y0, x1, y1, t0, t1, t, S, k) {
  const age = t - t0, L = t1 - t0;
  if (age < 0 || age >= L) return;
  // eases out: it decelerates as it reaches the top
  const at = (a) => {
    const u = clamp(a / L), e = 1 - (1 - u) * (1 - u);
    return [lerp(x0, x1, e) + Math.sin(a * 26 + k) * 0.6 * (1 - u), lerp(y0, y1, e)];
  };
  const [hx, hy] = at(age);
  // the tail: where the head was a moment ago, in hard steps down the ramp
  for (let i = 1; i <= 8; i++) {
    const [tx, ty] = at(Math.max(0, age - i * 0.02));
    const c = i <= 2 ? C[5] : i <= 4 ? C[4] : i <= 6 ? C[3] : C[2];
    p.dot(tx, ty, c, i <= 5 ? 1 : 1 - (i - 5) / 4);
  }
  p.px(hx, hy, WHITE);
  p.glow(hx, hy, 4, C[4], 0.4);
  // a spark or two drops off the trail
  for (let j = 0; j < 4; j++) {
    const b = t0 + (j + 0.5) * (L / 4), sa = t - b;
    if (sa < 0 || sa > 0.25) continue;
    const [bx, by] = at(b - t0);
    p.dot(bx + (rand(S, k, j) - 0.5) * 2, by + sa * sa * 60 + sa * 6, sa < 0.1 ? C[4] : C[2], 1 - sa / 0.25);
  }
}

/** One shell bursting at (cx, cy) at time tb with radius r. */
function shell(p, C, A, cx, cy, r, tb, t, S, k, n) {
  const age = t - tb;
  if (age < 0 || age > 1.25) return;
  // the hero frames: a white core with a 4-ray flare and a big soft flash
  if (age < 0.067) {
    const big = age < 0.034 ? 1 : 0.6, L = Math.round(r * 0.35 * big) + 1;
    for (let d = -L; d <= L; d++) {
      p.px(cx + d, cy, Math.abs(d) > L - 1 ? C[5] : WHITE);
      p.px(cx, cy + d, Math.abs(d) > L - 1 ? C[5] : WHITE);
    }
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) p.px(cx + dx, cy + dy, WHITE);
    p.glow(cx, cy, r * 0.9, C[4], 0.5 * big);
    p.glow(cx, cy, 5, WHITE, 0.8);
  }
  const v = r * DRAG * 1.08; // reaches about r before drag stalls it
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand(S, k, i, 1) * 0.25 + k;
    const vi = v * (0.9 + rand(S, k, i, 2) * 0.16);
    const life = 0.8 + rand(S, k, i, 3) * 0.25;
    if (age > life) {
      // it goes out with a crackle: one white strobe where it died, then a glitter grain falling off
      const da = age - life;
      if (da < 0.1 && i % 2 === 1) {
        const [hx, hy] = fly(cx, cy, Math.cos(a) * vi, Math.sin(a) * vi, life, G, DRAG);
        if (da < 0.034) { p.px(hx, hy, WHITE); p.light(hx, hy, C[4], 0.7); }
        else p.px(hx, hy + 1 + Math.round(da * 20), C[4]);
      }
      continue;
    }
    const u = age / life, acc = i % 4 === 1; // every fourth star is the accent color
    const R = acc ? A : null;
    const vx = Math.cos(a) * vi, vy = Math.sin(a) * vi;
    const [hx, hy] = fly(cx, cy, vx, vy, age, G, DRAG);
    // the streak: from where it was a moment ago to the head; long while fast, short as it slows
    const lag = 0.15 + 0.12 * u; // late on, the tail hangs down: the droop shows
    const [tx, ty] = fly(cx, cy, vx, vy, Math.max(0, age - lag), G, DRAG);
    // hard ramp steps as it cools
    const head = u < 0.12 ? WHITE : acc ? (u < 0.5 ? R[3] : u < 0.75 ? R[2] : R[1]) : u < 0.4 ? C[5] : u < 0.62 ? C[4] : u < 0.82 ? C[3] : C[2];
    const body = acc ? (u < 0.5 ? R[3] : R[2]) : u < 0.4 ? C[5] : u < 0.62 ? C[4] : C[3];
    const tail = acc ? (u < 0.5 ? R[2] : R[1]) : u < 0.4 ? C[3] : u < 0.7 ? C[2] : C[1];
    const fade = 1 - seg(u, 0.8, 1);
    // tail end dithers away, the front is solid; the head is one step brighter than the body
    const sx = lerp(tx, hx, 0.3), sy = lerp(ty, hy, 0.3); // leave the center open so the spokes read
    p.line(sx, sy, hx, hy, (q) => (q > 0.55 ? body : tail), fade);
    p.dot(hx, hy, head, fade);
    if (u < 0.5) p.glow(hx, hy, 3, acc ? R[2] : C[3], 0.3 * (1 - u * 2));
    // crackle: glitter flickers at the tips as they fall
    if (u > 0.5 && u < 0.92 && i % 2 === 0) {
      const fr = Math.floor(age * 30);
      if (rand(S, k, i, fr) < 0.35) {
        const gx = hx + Math.round((rand(S, k, i, fr, 1) - 0.5) * 3), gy = hy + Math.round(rand(S, k, i, fr, 2) * 2);
        p.px(gx, gy, rand(S, k, i, fr, 3) < 0.5 ? WHITE : C[5]);
        p.light(gx, gy, C[4], 0.5);
      }
    }
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), A = fit(o.accent, 5), S = o.seed, r = Math.max(8, o.r);
  if (o.tease) {
    if (t >= tease.duration) return;
    // one little rocket climbs a few px into the open space under the burst point and pops into four sparks
    const y0 = 5, y1 = -3, tb = 0.3;
    rocket(p, C, 0, y0, 0, y1, 0.02, tb, t, S, 9);
    const age = t - tb;
    if (age >= 0 && age < 0.42) {
      if (age < 0.067) {
        p.px(0, y1, WHITE); p.px(-1, y1, C[5]); p.px(1, y1, C[5]); p.px(0, y1 - 1, C[5]); p.px(0, y1 + 1, C[5]);
        p.glow(0, y1, 6, C[4], 0.6);
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU - Math.PI / 4 + (rand(S, i, 1) - 0.5) * 0.4;
        const vx = Math.cos(a) * 26, vy = Math.sin(a) * 26;
        const [x, y] = fly(0, y1, vx, vy, age, G, 4);
        const [tx, ty] = fly(0, y1, vx, vy, Math.max(0, age - 0.08), G, 4);
        const f = 1 - seg(age, 0.28, 0.42);
        p.line(tx, ty, x, y, age < 0.15 ? C[4] : C[2], f);
        p.dot(x, y, age < 0.12 ? WHITE : age < 0.25 ? C[5] : C[3], f);
      }
    }
    return;
  }
  if (t >= meta.duration) return;
  // shell one: the big one at the anchor
  const TB1 = 0.46;
  rocket(p, C, 0, r + 10, 0, 0, 0, TB1, t, S, 1);
  shell(p, C, A, 0, 0, r, TB1, t, S, 1, 14);
  // shell two: smaller, up and to the right, a beat later
  const r2 = Math.round(r * 0.6), x2 = Math.round(r * 0.75), y2 = -Math.round(r * 0.45), TB2 = 0.98;
  rocket(p, C, x2 - 2, r + 6, x2, y2, 0.52, TB2, t, S, 2);
  shell(p, C, A, x2, y2, r2, TB2, t, S, 2, 11);
}
