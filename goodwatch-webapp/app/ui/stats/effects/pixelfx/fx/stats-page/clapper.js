// Made for the GoodWatch stats page: A clapperboard snaps once on the Trailers tile.
import { fit, seg, clamp, lerp, ease, WHITE } from "../../core/index.js";

export const meta = {
  name: "Clapperboard snap",
  desc: "A small striped clapperboard pops in, its stick lifts with a wind-up and snaps shut on a white frame with three clack lines and a bounce, holds a beat, then drops out of view.",
  tags: ["stats-page", "cinema", "clapper", "slate", "one-shot"],
  size: [40, 40],
  origin: [20, 20],
  duration: 1.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    // outline, gray stripe, slate shadow, slate, slate lit, chalk, white stripe
    palette: ["#07090e", "#3c4659", "#2a3140", "#3a4456", "#4e5a70", "#98a4b8", "#e8edf5"],
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 1.0 };

const W = 14, HX = -7, HY = -4; // body width; the hinge at the body's top-left corner

/** The clapper's cell at (i, j) in its own frame (stick opened by `a` radians), or 0. */
function cellAt(lx, ly, a, C) {
  // the hinged stick first, so it covers the body's top edge where they overlap
  // continuous coordinates along (u) and across (v) the stick, so it rasterizes cleanly at any angle
  const dx = lx - HX, dy = ly - HY, cs = Math.cos(a), sn = Math.sin(a);
  const u = dx * cs - dy * sn, v = dx * sn + dy * cs;
  if (u >= 0 && u < W && v >= -3 && v < 1) {
    if (u < 1 || u >= W - 1 || v < -2 || v >= 0) return C[0];
    return Math.floor((u + v + 2) / 2) % 2 ? C[6] : C[1];
  }
  const i = Math.floor(lx), j = Math.floor(ly);
  if (i < HX || i >= HX + W || j < HY || j > 5) return 0;
  if (i === HX || i === HX + W - 1 || j === HY || j === -1 || j === 5) return C[0];
  if (j <= -2) return Math.floor((i - HX - (j + 3) + 1) / 2) % 2 ? C[1] : C[6]; // the fixed bar, stripes slanted the other way
  // the slate: lit top row and left column, a shadow column on the right, two chalk lines
  if (j === 1 && i !== -1 && i > HX + 1 && i < HX + W - 3) return C[5];
  if (j === 3 && i > HX + 1 && i < HX + W - 6) return C[4];
  if (i === HX + W - 2 || j === 4) return C[2];
  if (j === 0 || i === HX + 1) return C[4];
  return C[3];
}

/** Rasterize the clapper at (cx, cy), scaled by s about its center, stick open by `a`. */
function clapper(p, C, cx, cy, s, a, white, alpha) {
  const R = Math.ceil(12 * s) + 2;
  for (let Y = Math.floor(cy) - R; Y <= cy + R; Y++)
    for (let X = Math.floor(cx) - R; X <= cx + R; X++) {
      const lx = (X + 0.5 - cx) / s, ly = (Y + 0.5 - cy) / s + 1; // +1: the sprite is centered a row low
      const c = cellAt(lx, ly, a, C);
      if (!c) continue;
      const out = white ? (c === C[0] ? C[0] : c === C[6] || c === C[1] ? WHITE : C[5]) : c;
      if (alpha >= 1) p.px(X, Y, out);
      else p.blend(X, Y, out, alpha);
    }
}

/** Short clack lines fanning out from the stick's tip. */
function clack(p, C, x, y, u, n) {
  const angs = n === 1 ? [-0.6] : [-1.25, -0.6, 0.05], s0 = n === 1 ? 1.5 : 2.5;
  for (const an of angs) {
    const r0 = s0 + u * 2, r1 = r0 + (u < 0.5 ? 2.5 : 1.5);
    const c = u < 0.4 ? WHITE : C[5];
    p.line(Math.round(x + Math.cos(an) * r0), Math.round(y + Math.sin(an) * r0), Math.round(x + Math.cos(an) * r1), Math.round(y + Math.sin(an) * r1), c);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7);
  const teasing = !!o.tease;
  const D = teasing ? tease.duration : meta.duration;
  if (t >= D) return;

  // the pop in: springs up from small, overshoots, settles (shared by both modes)
  const s = lerp(0.6, 1, ease.outBack(seg(t, 0, 0.16), 2.2));
  const tipX = HX + W - 0.5, tipY = HY - 1; // where the stick meets the body on the right

  if (teasing) {
    // stick lifts a couple of px and drops back on one tick, then the clapper slides down out of view
    const lift = 0.15 * ease.outCubic(seg(t, 0.22, 0.42)) * (1 - ease.inQuad(seg(t, 0.46, 0.52)));
    const drop = ease.inQuad(seg(t, 0.74, D));
    const alpha = 1 - drop;
    const bounce = t > 0.52 && t < 0.6 ? 1 : 0;
    clapper(p, C, 0, drop * 6 + bounce, s, lift, false, alpha);
    const k = seg(t, 0.52, 0.68);
    if (k > 0 && k < 1) clack(p, C, tipX + 1, tipY - 1 + bounce, k, 1);
    if (t > 0.52 && t < 0.58) p.glow(tipX, tipY, 5, C[6], 0.25);
    return;
  }

  // the stick: lifts with a wind-up (a slow rise, a short hesitation, a last hitch higher), then snaps down
  const SNAP = 0.56;
  const open = t < SNAP - 0.06
    ? 0.5 * ease.outCubic(seg(t, 0.16, 0.36)) + 0.12 * ease.inOutSine(seg(t, 0.4, SNAP - 0.06))
    : 0.62 * (1 - ease.inQuad(seg(t, SNAP - 0.06, SNAP)));
  // the clack: a white hero frame, a tiny squash down and spring back
  const white = t >= SNAP && t < SNAP + 0.06;
  const bounce = t < SNAP ? 0 : t < SNAP + 0.07 ? 1 : t < SNAP + 0.14 ? -1 : 0;
  const crouch = t > 0.4 && t < SNAP ? 1 : 0; // the board sinks a pixel while the stick hangs at the top
  // the exit: a little hop, then it falls away and thins out (true translucency, no dither)
  const hop = -1.5 * Math.sin(Math.PI * seg(t, 1.0, 1.12));
  const fall = 10 * ease.inQuad(seg(t, 1.1, D - 0.02));
  const alpha = 1 - ease.inQuad(seg(t, 1.12, D - 0.03));
  clapper(p, C, 0, crouch + bounce + hop + fall, s, open, white, alpha);

  const k = seg(t, SNAP, SNAP + 0.2);
  if (k > 0 && k < 1) clack(p, C, tipX + 1, tipY - 1 + bounce, k, 3);
  if (t >= SNAP && t < SNAP + 0.16) {
    const f = 1 - seg(t, SNAP, SNAP + 0.16);
    p.glow(tipX, tipY + 2, 9, C[6], 0.35 * f);
    p.glow(0, 1, 10, C[5], 0.12 * f);
  }
  // a hint of light on the stick while it is up, so the lift reads
  if (open > 0.3 && !white) p.light(tipX - 2, tipY - 5 * open * 2, C[5], 0.12);
}
