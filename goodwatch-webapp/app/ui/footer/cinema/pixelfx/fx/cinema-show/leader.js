// Made for the GoodWatch footer cinema: a film countdown leader before the show (a generic one, our own styling).
// Warm gray film: crosshair lines, two rings, a big number; each second a clock hand sweeps round and shades what
// it passes. Dust, hairs, scratches, gate weave and a flicker. The 2 holds a beat, one white frame, then black.
import { clamp, rand, fit, TAU } from "../../core/index.js";

export const meta = {
  name: "Countdown leader",
  desc: "A warm gray film leader counts 5, 4, 3, 2 with a sweeping clock hand, crosshair and two rings, dust, scratches and flicker; the 2 holds, one white frame, black.",
  tags: ["cinema-show", "screen", "leader", "countdown", "film", "one-shot"],
  size: [288, 120],
  origin: [144, 60],
  duration: 4.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { w: 288, h: 120, seed: 3, palette: ["#14120f", "#2e2a23", "#4f4a3f", "#7a7363", "#a39b88", "#c9c1ac", "#ece5d2"] },
};

// the count starts after a 2-frame cut in; the 2 holds once its sweep is done, then the flash frame and black
const T0 = 0.07, STEP = 1, HOLD = 4.27, FLASH = 4.3, BLACK = 4.34;
const R1 = 46, R2 = 38;
// the numerals as strokes (lines and arcs, y down), rasterized once into core and rim pixels
const ARC = (cx, cy, r, a0, a1) => {
  const n = Math.ceil(Math.abs(a1 - a0) * r * 2) + 1;
  return Array.from({ length: n }, (_, i) => [cx + Math.cos(a0 + ((a1 - a0) * i) / (n - 1)) * r, cy + Math.sin(a0 + ((a1 - a0) * i) / (n - 1)) * r]);
};
const LINE = (x0, y0, x1, y1) => {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
  return Array.from({ length: n }, (_, i) => [x0 + ((x1 - x0) * i) / (n - 1), y0 + ((y1 - y0) * i) / (n - 1)]);
};
const STROKES = {
  2: () => {
    const a = ARC(0, -8, 8.5, Math.PI, TAU + 0.55), [ex, ey] = a[a.length - 1];
    return [...a, ...LINE(ex, ey, -9, 16), ...LINE(-9, 16, 10, 16)];
  },
  3: () => [...ARC(0, -8.5, 8, Math.PI + 0.45, TAU + Math.PI / 2), ...ARC(0, 7.5, 9, -Math.PI / 2, Math.PI - 0.45)],
  4: () => [...LINE(5, -17, -10, 7), ...LINE(-10, 7, 11, 7), ...LINE(5, -17, 5, 17)],
  5: () => [...LINE(9, -16, -6, -16), ...LINE(-6, -16, -7, -1.5), ...ARC(0, 6.5, 10, -2.35, 2.55)],
};
const DIGITS = new Map();
function digit(n) {
  if (DIGITS.has(n)) return DIGITS.get(n);
  const pts = STROKES[n](), out = [];
  for (let y = -22; y <= 22; y++)
    for (let x = -16; x <= 16; x++) {
      let d = 1e9;
      for (const [px, py] of pts) d = Math.min(d, (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2);
      if (d < 2.6 * 2.6) out.push([x, y, false]);
      else if (d < 3.9 * 3.9) out.push([x, y, true]);
    }
  DIGITS.set(n, out);
  return out;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);

export function draw(p, t, o) {
  if (t < T0 || t >= BLACK) return;
  const C = fit(o.palette, 7), hw = (o.w ?? 288) / 2, seed = o.seed;
  const frame = Math.floor(t * 30);
  if (t >= FLASH) {
    p.rect(-hw, -60, hw * 2, 120, C[6]);
    p.glow(0, 0, 58, C[6], 0.4);
    return;
  }
  const k = Math.min(3, Math.floor((t - T0) / STEP)), num = 5 - k;
  const u = num === 2 ? clamp((t - T0 - 3 * STEP) / (HOLD - 0.25 - T0 - 3 * STEP)) : (t - T0 - k * STEP) / STEP;
  const sweepA = u * TAU;
  // flicker: the whole frame drops a step now and then; gate weave nudges it a pixel
  const fl = rand(seed, frame, 1) < 0.18 ? -1 : 0;
  const wy = rand(seed, frame, 2) < 0.2 ? 1 : 0, wx = rand(seed, frame, 3) < 0.08 ? 1 : 0;
  const L = (i) => C[clamp(i + fl, 0, 6)];

  p.shade(-hw, -60, hw - 1, 59, (x, y) => {
    const X = x - wx, Y = y - wy, r = Math.hypot(X, Y), b = BAYER[((Math.floor(y) & 3) << 2) | (Math.floor(x) & 3)];
    // the sweep: shaded behind the hand, light ahead of it
    let a = Math.atan2(X, -Y);
    if (a < 0) a += TAU;
    let lv = a < sweepA ? 3 : 5;
    // the projector's hot middle and its dark corners, in hard dithered steps
    const v = (X / (hw * 1.05)) ** 2 + (Y / 66) ** 2;
    if (v > 0.55 + b * 0.25) lv--;
    if (v > 0.95 + b * 0.3) lv--;
    if (r < 16 + b * 6) lv++;
    // rings, crosshair, the hand
    if (Math.abs(r - R1) < 0.75 || Math.abs(r - R1 - 2) < 0.5 || Math.abs(r - R2) < 0.6) return L(0);
    if (Math.abs(X + 0.5) < 0.6 || Math.abs(Y + 0.5) < 0.6) return L(1);
    if (u > 0 && u < 1 && r < R1 + 30) {
      const hx = Math.sin(sweepA), hy = -Math.cos(sweepA), along = X * hx + Y * hy;
      if (along > 0 && Math.abs(X * hy - Y * hx) < 0.7) return L(1);
    }
    return L(lv);
  });

  // the number: thick dark strokes with a light rim so it sits off the gray
  const m = digit(num);
  for (const [x, y, rim] of m) p.px(x + wx, y + wy, rim ? L(6) : L(0));
  // a frame-line at the top and bottom, as on real leader
  p.line(-hw, -57 + wy, hw - 1, -57 + wy, L(1));
  p.line(-hw, 56 + wy, hw - 1, 56 + wy, L(1));
  // the lamp's light on the screen, breathing with the flicker
  p.glow(0, 0, 110, C[6], fl ? 0.05 : 0.09);

  // scratches: a couple of long vertical lines that wander and last a few frames
  for (let i = 0; i < 2; i++) {
    const life = Math.floor(frame / 7) + i * 13;
    if (rand(seed, life, 4) < 0.4) continue;
    const sx = Math.round((rand(seed, life, 5) - 0.5) * hw * 1.6 + Math.sin(t * 9 + i) * 2);
    const y0 = -60 + Math.floor(rand(seed, life, 6) * 40), y1 = y0 + 40 + Math.floor(rand(seed, life, 7) * 80);
    p.line(sx, y0, sx, Math.min(59, y1), rand(seed, life, 8) < 0.5 ? L(6) : L(1), (yy) => 0.6 + 0.4 * Math.sin(yy * 20));
  }
  // dust: specks every frame, a hair now and then
  const n = 3 + Math.floor(rand(seed, frame, 9) * 5);
  for (let i = 0; i < n; i++) {
    const x = Math.floor((rand(seed, frame, i, 10) - 0.5) * (hw * 2 - 4)), y = Math.round((rand(seed, frame, i, 11) - 0.5) * 116);
    const big = rand(seed, frame, i, 12), c = rand(seed, frame, i, 13) < 0.75 ? L(0) : L(6);
    p.px(x, y, c);
    if (big > 0.6) p.px(x + 1, y, c);
    if (big > 0.85) (p.px(x, y + 1, c), p.px(x + 1, y + 1, c));
  }
  if (rand(seed, frame, 14) < 0.22) {
    const x = (rand(seed, frame, 15) - 0.5) * hw * 1.8, y = (rand(seed, frame, 16) - 0.5) * 100, an = rand(seed, frame, 17) * TAU;
    const pts = [];
    for (let j = 0; j <= 8; j++) pts.push([x + Math.cos(an + j * 0.25) * j * 1.3, y + Math.sin(an + j * 0.25) * j * 1.3]);
    p.polyline(pts, L(0));
  }
}
