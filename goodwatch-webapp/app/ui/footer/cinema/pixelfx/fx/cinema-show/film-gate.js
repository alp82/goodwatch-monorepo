// Made for the GoodWatch footer cinema: an old-film overlay for the vintage cinemas, drawn over any screen scene:
// sparse grain, dust, an occasional hair flicking through the gate, a thin wandering scratch, a faint flicker of
// light at the edges and a subtle stepped vignette in the corners. Kept quiet so text under it stays readable.
import { clamp, hex, rand, noise } from "../../core/index.js";

export const meta = {
  name: "Film gate",
  desc: "An old-film overlay: sparse grain specks, dust, a hair that flicks through the gate, a thin wandering scratch, a faint flicker of light at the edges and a soft corner vignette.",
  tags: ["cinema", "screen", "overlay", "loop"],
  size: [288, 120],
  origin: [144, 60],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "dark",
  // soft: true draws the vignette and specks truly translucent; false dithers them (opaque pixels only)
  options: { seed: 5, w: 288, h: 120, amount: 1, soft: true },
};

const D = meta.duration, FPS = 24, NF = D * FPS; // dirt changes at film rate: 72 film frames a loop
const DARK = hex("#050404"), LIGHT = hex("#f4ead4"), WARMLIGHT = hex("#ffe8b8");

export function draw(p, t, o) {
  const W = (o.w ?? 288) / 2, HH = (o.h ?? 120) / 2, S = o.seed ?? 5, A = clamp(o.amount ?? 1, 0, 2), soft = o.soft !== false;
  t = ((t % D) + D) % D;
  const f = Math.floor(t * FPS) % NF, q = (...k) => rand(S, f, ...k);
  const mark = soft ? (x, y, c, a) => p.blend(x, y, c, a) : (x, y, c, a) => p.dot(x, y, c, a);

  // vignette: the corners step down in three hard rings
  p.each(-W, -HH, W - 1, HH - 1, (x, y, sx, sy) => {
    const ax = Math.abs(x) / W, ay = Math.abs(y) / HH;
    if (ax < 0.5 || ay < 0.4) return;
    const e = Math.pow(ax ** 4 + ay ** 4, 0.25); // a rounded rectangle: only the corners reach past 1
    const a = e > 1.15 ? 0.32 : e > 1.1 ? 0.2 : e > 1.05 ? 0.1 : 0;
    if (a > 0) soft ? p.blendPx(sx, sy, DARK, a * A) : p.put(sx, sy, DARK, a * A);
  });

  // a faint flicker of light at the left and right edges of the gate, new every film frame
  const fl = (0.5 + 0.5 * q(1)) * (q(2) < 0.08 ? 1.8 : 1) * A;
  p.glowLine(-W, -HH + 8, -W, HH - 8, 18, WARMLIGHT, 0.035 * fl);
  p.glowLine(W - 1, -HH + 8, W - 1, HH - 8, 18, WARMLIGHT, 0.03 * fl);

  // grain: a few single specks each film frame, mostly dark, some bright
  const ng = Math.round((6 + q(3) * 5) * A);
  for (let i = 0; i < ng; i++) {
    const x = Math.floor((q(10, i) - 0.5) * 2 * W), y = Math.floor((q(11, i) - 0.5) * 2 * HH);
    mark(x, y, q(12, i) < 0.65 ? DARK : LIGHT, 0.35 + q(13, i) * 0.3);
  }

  // dust: irregular blobs that sit for one or two film frames
  const fb = f - (f % 2);
  for (let j = 0; j < 3; j++) {
    const r = (...k) => rand(S, fb, 50 + j, ...k);
    if (r(0) > 0.32 * A) continue;
    if (r(1) < 0.5 && f !== fb) continue; // a one-frame mote
    const x = Math.floor((r(2) - 0.5) * 1.9 * W), y = Math.floor((r(3) - 0.5) * 1.8 * HH), big = r(4);
    const c = r(5) < 0.75 ? DARK : LIGHT, a = 0.55 + r(6) * 0.25;
    mark(x, y, c, a);
    if (big > 0.3) mark(x + 1, y, c, a * 0.8);
    if (big > 0.55) mark(x, y + 1, c, a * 0.8);
    if (big > 0.8) { mark(x + 1, y + 1, c, a * 0.7); mark(x - 1, y + 1, c, a * 0.4); }
  }

  // a hair: once a loop it lies in the gate for six frames, flicks across on the last two and is gone
  for (let h = 0; h < 2; h++) {
    const f0 = Math.floor(rand(S, 70, h) * (NF - 8)), k = f - f0;
    if (k < 0 || k >= (h ? 4 : 6)) continue;
    const side = rand(S, 71, h) < 0.5 ? -1 : 1;
    const x0 = side * W * (0.55 + rand(S, 72, h) * 0.3) + (k >= 4 ? side * (k - 3) * 6 : 0) + (k === 2 ? 1 : 0);
    const y0 = (rand(S, 73, h) - 0.5) * HH * 1.2 + (k >= 4 ? (k - 3) * 3 : 0);
    let a = rand(S, 74, h) * 6.28 + (k >= 4 ? (k - 3) * 0.5 : 0), x = x0, y = y0;
    const len = (h ? 9 : 15) + Math.floor(rand(S, 75, h) * 6), cv = (0.035 + rand(S, 76, h) * 0.06) * (rand(S, 77, h) < 0.5 ? -1 : 1);
    for (let s = 0; s < len; s++) {
      mark(Math.round(x), Math.round(y), DARK, s === 0 || s === len - 1 ? 0.45 : 0.75);
      a += cv * (s > len * 0.65 ? 2.6 : 1);
      x += Math.cos(a); y += Math.sin(a) * 0.9;
    }
  }

  // a scratch: a thin bright line that wanders sideways for half a second once a loop, dropping out here and there
  const s0 = Math.floor(rand(S, 90) * NF), sk = (f - s0 + NF) % NF, SL = 13;
  if (sk < SL && rand(S, 91, sk) > 0.15) {
    const x = Math.round(-W * 0.6 + rand(S, 92) * W * 1.2 + noise(sk * 0.35, S) * 4 - 2);
    const y0 = -HH + Math.floor(rand(S, 93) * 20), y1 = HH - Math.floor(rand(S, 94) * 24), gap = rand(S, 95, sk);
    const g0 = y0 + (y1 - y0) * gap, gl = gap < 0.7 ? 3 + Math.floor(gap * 8) : 0, a = (sk < 2 || sk > SL - 3 ? 0.25 : 0.4) * A;
    for (let y = y0; y <= y1; y++) {
      if (y >= g0 && y < g0 + gl) continue;
      mark(x, y, LIGHT, (y - y0 < 3 || y1 - y < 3) ? a * 0.5 : a);
    }
  }
}
