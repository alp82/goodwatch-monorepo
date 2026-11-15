// Made for the GoodWatch stats page: The "Book Ends" trope chip gets clamped between two bookends.
// Anchor (0, 0) is the chip's top-left corner; o.w, o.h are the chip's size in effect px.
import { fit, seg, ease, lerp, rand, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope: Book Ends",
  desc: "Two wooden L bookends with brass knobs slide in from both sides, clamp the chip with a thunk and a puff of dust on the shelf, hold, then slide back out.",
  tags: ["stats-page", "trope", "bookends", "books", "one-shot"],
  size: [64, 28],
  origin: [12, 14],
  duration: 1.85,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e0f06", "#4a2810", "#7a4620", "#a86a34", "#d89a5a"],
    brass: ["#3a2808", "#7a5a18", "#c8a038", "#f4dc80", "#ffffff"],
    dust: ["#5a5048", "#8a8070", "#c0b8a8"],
    w: 40,
    h: 9,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.75 };

const IN0 = 0.05, HIT = 0.32, OUT0 = 1.3, OUT1 = 1.72, START = 5;

/** One bookend, standing on the shelf line y = h with its inner face at x = edge; dir -1 left one, +1 right one. */
function bookend(p, W, B, edge, h, dir, a, squash, glint) {
  const put = (x, y, c) => (a >= 1 ? p.px(x, y, c) : p.blend(x, y, c, a));
  const top = -3 + squash;
  // the upright: 3 px thick, lit on its outer face and top, shaded on the face towards the books
  for (let y = top; y < h; y++)
    for (let k = 0; k < 3; k++) {
      const x = edge + dir * (1 + k); // k 0 touches the books, k 2 is the outer face
      const c = y === top ? (k === 1 ? W[4] : W[3]) : k === 2 ? W[3] : k === 1 ? W[2] : W[1];
      put(x, y, c);
    }
  // a little carved groove across the upright
  put(edge + dir * 2, top + 4, W[1]);
  put(edge + dir * 3, top + 4, W[2]);
  // the foot: a plate on the shelf line running in under the books, and a dark lip under it
  for (let i = -2; i <= 5; i++) put(edge - dir * i, h, i < 0 ? W[2] : W[3]);
  put(edge + dir * 3, h, W[1]);
  // the brass knob on top: a 3 x 2 ball with a lit cap and a glint
  const kx = edge + dir * 2, ky = top - 2;
  put(kx, ky, glint ? WHITE : B[3]);
  put(kx - dir, ky + 1, B[2]);
  put(kx, ky + 1, B[2]);
  put(kx + dir, ky + 1, B[1]);
  put(kx + dir, ky, B[2]);
  put(kx - dir, ky, B[3]);
  if (glint) p.light(kx, ky, B[3], 0.6);
}

export function draw(p, t, o) {
  const W = fit(o.palette, 5), B = fit(o.brass, 5), Du = fit(o.dust, 3), S = o.seed;
  const w = Math.max(10, o.w), h = Math.max(5, o.h);

  if (o.tease) {
    if (t >= tease.duration) return;
    // only the right one: it creeps in to the chip's edge, thinks better of it, and slides back
    const s = t < 0.3 ? lerp(START, 1, ease.outCubic(seg(t, 0, 0.3))) : t < 0.42 ? 1 : lerp(1, START, ease.inCubic(seg(t, 0.42, 0.7)));
    const a = seg(t, 0, 0.08) * (1 - seg(t, 0.62, 0.7));
    if (a > 0) bookend(p, W, B, w - 1 + Math.round(s), h, 1, a, 0, t > 0.3 && t < 0.36);
    return;
  }
  if (t >= meta.duration) return;

  // how far out each one stands: accelerating in to the clamp, a hold, then easing back out
  let s;
  if (t < HIT) s = lerp(START, 0, ease.inQuad(seg(t, IN0, HIT)));
  else if (t < OUT0) s = 0;
  else s = lerp(0, START, ease.inOutCubic(seg(t, OUT0, OUT1)));
  const a = seg(t, IN0, IN0 + 0.07) * (1 - seg(t, OUT1 - 0.08, OUT1));
  const squash = t >= HIT && t < HIT + 0.05 ? 1 : 0;
  const glint = t > 0.86 && t < 0.96;
  if (a > 0) {
    bookend(p, W, B, -Math.round(s), h, -1, a, squash, glint);
    bookend(p, W, B, w - 1 + Math.round(s), h, 1, a, squash, t > 0.9 && t < 1.0);
  }

  // the thunk: the chip's ends flash where they're struck, and dust puffs out along the shelf from both feet
  const d = t - HIT;
  if (d >= 0 && d < 1 / 30) {
    for (let y = 1; y < h - 1; y++) { p.px(0, y, y === 1 || y === h - 2 ? W[4] : WHITE); p.px(w - 1, y, y === 1 || y === h - 2 ? W[4] : WHITE); }
    p.light(0, h / 2, W[4], 0.5);
    p.light(w - 1, h / 2, W[4], 0.5);
  }
  if (d >= 0 && d < 0.5) {
    for (const [x0, dir] of [[-4, -1], [w + 3, 1]]) {
      // a low soft puff right at the foot: a light core that swells outward along the shelf, lifts a pixel and thins
      const u0 = d / 0.36;
      if (u0 < 1) {
        const al = 0.9 * (1 - ease.inQuad(u0)), c0 = u0 < 0.3 ? Du[2] : Du[1], c1 = u0 < 0.3 ? Du[1] : Du[0];
        const lift = u0 > 0.45 ? 1 : 0, r = 1 + Math.round(u0 * 2);
        for (let i = 0; i <= r; i++) p.blend(x0 + dir * i, h - lift, i < r ? c0 : c1, al * (i < r ? 1 : 0.7));
        for (let i = 1; i < r; i++) p.blend(x0 + dir * i, h - 1 - lift, c1, al * 0.75);
      }
      // and a few motes kicked out along the shelf
      for (let i = 0; i < 3; i++) {
        const life = 0.3 + rand(S, i, dir, 1) * 0.18, u = (d - 0.02) / life;
        if (u < 0 || u >= 1) continue;
        const x = x0 + dir * (2 + (3 + rand(S, i, dir, 2) * 3) * ease.outCubic(u));
        const y = h - u * (1 + rand(S, i, dir, 3) * 2.5);
        p.blend(x, y, u < 0.3 ? Du[2] : u < 0.65 ? Du[1] : Du[0], 0.85 * (1 - u));
      }
    }
  }
}
