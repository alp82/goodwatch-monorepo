// Made for the GoodWatch stats page: Press camera flashes on a portrait or a poster.
// Anchor (0, 0) is the subject's center. Round subject: o.r = its radius. Box subject (a poster): o.w, o.h = its size,
// centered on the anchor (o.r is then ignored).
import { fit, seg, clamp, lerp, rand, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Flashbulb",
  desc: "Three press camera flashes go off round a portrait, staggered: a hard white starburst and a white rim on the subject's edge, then a warm afterglow that pops away.",
  tags: ["stats-page", "camera", "flash", "press", "one-shot"],
  size: [48, 44],
  origin: [24, 22],
  duration: 1.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2a1206", "#7a3410", "#d4741c", "#ffbe48", "#fff0b4", "#ffffff"],
    r: 11,
    w: 0,
    h: 0,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.5 };

// each flash: when it fires, where round the subject (radians, 0 = right, -PI/2 = up), how big its rays are
const FLASHES = [
  { t: 0.06, ang: -2.35, size: 1 },
  { t: 0.38, ang: -0.45, size: 0.8 },
  { t: 0.66, ang: 2.5, size: 0.9 },
  { t: 0.86, ang: -1.2, size: 0.35 }, // a late one from further back
];
const HERO = 0.067; // two frames at 30 fps
const AFTER = 0.34; // the afterglow

/** The subject: where a ray from its center at angle `ang` leaves it, and the outward normal there. */
function edge(o, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  if (o.w > 0 && o.h > 0) {
    // aim from a point in the upper part of the box, so the flashes crowd round the poster's top half
    const cy = -o.h * 0.2, hh = s < 0 ? o.h / 2 + cy : o.h / 2 - cy;
    const k = Math.min(o.w / 2 / Math.max(1e-6, Math.abs(c)), hh / Math.max(1e-6, Math.abs(s)));
    const x = c * k, y = cy + s * k;
    const side = Math.abs(x) >= o.w / 2 - 0.01;
    return { x, y, nx: side ? Math.sign(c) : 0, ny: side ? 0 : Math.sign(s) };
  }
  const r = Math.max(3, o.r);
  return { x: c * r, y: s * r, nx: c, ny: s };
}

/** The bright edge the flash catches: an arc on a round subject, the two nearest sides' run on a box. */
function rim(p, o, ang, span, c, a) {
  if (span <= 0) return;
  const c0 = typeof c === "number" ? c : c[0], c1 = typeof c === "number" ? c : c[1];
  if (o.w > 0 && o.h > 0) {
    // walk the box's outline (just outside it) from where the flash faces it, both ways round
    const W = Math.round(o.w), H = Math.round(o.h), x0 = -Math.round(W / 2) - 1, y0 = -Math.round(H / 2) - 1;
    const P = 2 * (W + 1) + 2 * (H + 1);
    const at = (q) => {
      q = ((q % P) + P) % P;
      if (q < W + 1) return [x0 + q, y0];
      q -= W + 1;
      if (q < H + 1) return [x0 + W + 1, y0 + q];
      q -= H + 1;
      if (q < W + 1) return [x0 + W + 1 - q, y0 + H + 1];
      return [x0, y0 + H + 1 - (q - W - 1)];
    };
    const e = edge(o, ang);
    let best = 0, bd = Infinity;
    for (let q = 0; q < P; q++) {
      const [x, y] = at(q), d = (x - e.x) ** 2 + (y - e.y) ** 2;
      if (d < bd) (bd = d), (best = q);
    }
    const L = Math.round(span * 10);
    for (let d = -L; d <= L; d++) {
      const f = Math.abs(d) / Math.max(1, L), [x, y] = at(best + d);
      p.dot(x, y, f < 0.6 ? c0 : c1, a * (f < 0.85 ? 1 : 0.5));
    }
    return;
  }
  const r = Math.max(3, o.r);
  // 1 px arc hugging the outside of the rim, where the light catches the edge
  const n = Math.ceil(r * span * 3);
  for (let i = 0; i <= n; i++) {
    const g = ang - span + (2 * span * i) / n, f = Math.abs(g - ang) / span;
    // solid in the middle, one ramp step down towards the ends: a hard-edged highlight, not a smear
    p.dot(Math.cos(g) * (r + 0.4), Math.sin(g) * (r + 0.4), f < 0.6 ? c0 : c1, a * (f < 0.85 ? 1 : 0.5));
  }
}

/** One flash at age `age` (0 = it fires). */
function flash(p, o, C, f, age, small) {
  if (age < 0 || age > AFTER) return;
  const e = edge(o, f.ang);
  // the bulb sits just outside the subject
  const out = small ? 1 : 2.5;
  const X = Math.round(e.x + e.nx * out), Y = Math.round(e.y + e.ny * out);
  const big = small ? 0.5 : f.size;
  if (age < HERO) {
    // the hero frame: hard white star, 4 long rays and 4 short diagonals, the subject lit white for a beat
    const L = Math.round(3 + big * 3), D = Math.round(1 + big * 2);
    const second = age > HERO / 2; // the second frame is already a touch shorter
    const l = second ? L - 1 : L, dd = second ? D - 1 : D;
    for (let d = 1; d <= l; d++) {
      const c = d > l - 1 ? C[4] : WHITE;
      p.px(X + d, Y, c); p.px(X - d, Y, c); p.px(X, Y + d, c); p.px(X, Y - d, c);
    }
    for (let d = 1; d <= dd; d++) {
      p.px(X + d, Y + d, WHITE); p.px(X - d, Y + d, WHITE); p.px(X + d, Y - d, WHITE); p.px(X - d, Y - d, WHITE);
    }
    p.px(X, Y, WHITE);
    if (!small) {
      p.px(X + 1, Y, WHITE); p.px(X - 1, Y, WHITE); p.px(X, Y + 1, WHITE); p.px(X, Y - 1, WHITE);
    }
    rim(p, o, f.ang, small ? 0.3 : 1.05, [WHITE, C[4]], 1);
    if (!small) {
      // the burst of light washes over the subject
      const k = (second ? 0.18 : 0.34) * big;
      if (o.w > 0) p.glow(e.x * 0.4, e.y * 0.4, Math.max(o.w, o.h) * 0.6, WHITE, k);
      else p.glow(e.x * 0.4, e.y * 0.4, o.r * 1.5, WHITE, k);
    }
    p.glow(X, Y, small ? 5 : 9, WHITE, small ? 0.5 : 0.9);
    return;
  }
  // the afterglow: the star cools down the ramp in hard steps, shrinks, and pops into a little ring
  const u = seg(age, HERO, AFTER);
  const step = u < 0.22 ? 4 : u < 0.45 ? 3 : u < 0.7 ? 2 : 1;
  const c = C[step];
  if (u < 0.45) {
    const arm = small ? 1 : u < 0.22 ? 2 : 1;
    p.px(X, Y, u < 0.22 ? WHITE : C[4]);
    for (let d = 1; d <= arm; d++) {
      p.px(X + d, Y, c); p.px(X - d, Y, c); p.px(X, Y + d, c); p.px(X, Y - d, c);
    }
    rim(p, o, f.ang, (small ? 0.2 : 0.8) * (1 - u * 1.6), u < 0.22 ? [C[4], C[3]] : [C[3], C[2]], 1);
  } else if (u < 0.7) {
    p.px(X, Y, c);
    // the pop: four beads fly off and go out
    const rr = 1 + (u - 0.45) * 10;
    if (!small) for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + TAU / 8;
      p.px(X + Math.round(Math.cos(a) * rr), Y + Math.round(Math.sin(a) * rr), C[3]);
    }
  } else if (!small) {
    const rr = 3.5 + (u - 0.7) * 6;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + TAU / 8;
      p.dot(X + Math.round(Math.cos(a) * rr), Y + Math.round(Math.sin(a) * rr), C[2], 1 - seg(u, 0.85, 1));
    }
  }
  p.glow(X, Y, small ? 4 : lerp(7, 3, u), C[3], (small ? 0.3 : 0.55) * (1 - u));
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), S = o.seed;
  if (o.tease) {
    if (t >= tease.duration) return;
    // one tiny glint on the rim, upper left
    flash(p, o, C, { t: 0.12, ang: -2.2, size: 0.4 }, t - 0.12, true);
    return;
  }
  if (t >= meta.duration) return;
  FLASHES.forEach((f, i) => {
    // a seed nudges where each photographer stands
    const g = { ...f, ang: f.ang + (rand(S, i, 1) - 0.5) * 0.5 };
    flash(p, o, C, g, t - f.t, f.size < 0.5);
  });
}
