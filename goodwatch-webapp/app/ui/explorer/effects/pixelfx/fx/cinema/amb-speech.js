// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, rand, seg, ease, WHITE } from "../../core/index.js";
import { AMB, count } from "./_amb1.js";

export const meta = {
  name: "Speech bubbles",
  desc: "Over a talky island: little speech bubbles pop up left, then right, like a conversation; their dots type in turn, then they bob and fade.",
  tags: ["cinema", "ambient", "island", "talky", "dialogue", "speech", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: { palette: ["#1e130b", "#5e4024", "#b8875a", "#f0d6ae", "#fff6e6"], seed: 1, r: 30, density: 1 },
};

const LIFE = 2.5, POP = 0.14, TYPE_END = 1.95, BOB = 2.1;
// bubble sizes at r 30: [w, h]
const SIZES = [[11, 7], [14, 8], [17, 9]];

// a rounded bubble with its tail on one bottom side; ink colors: line, fill, highlight
function bubble(P, x0, y0, w, h, side, line, fill, hi, a) {
  // solid while it lives, truly translucent while it fades (no dither speckle on a 1 px outline)
  const p = a >= 1 ? P : { dot: (x, y, c) => P.blend(x, y, c, a), blend: (x, y, c, b) => P.blend(x, y, c, b) };
  const x1 = x0 + w - 1, y1 = y0 + h - 1;
  // fill, slightly see-through so the island tints it
  for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) p.blend(x, y, fill, 0.86 * a);
  // outline with clipped corners
  for (let x = x0 + 1; x < x1; x++) { p.dot(x, y0, line, a); p.dot(x, y1, line, a); }
  for (let y = y0 + 1; y < y1; y++) { p.dot(x0, y, line, a); p.dot(x1, y, line, a); }
  // a lit top-left edge
  for (let x = x0 + 2; x < x0 + Math.min(6, w - 3); x++) p.dot(x, y0, hi, a);
  p.dot(x0, y0 + 2, hi, a);
  // the tail, toward the middle of the island
  const tx = side < 0 ? x1 - 3 : x0 + 3, d = side < 0 ? 1 : -1;
  p.blend(tx, y1, fill, 0.86 * a); p.blend(tx + d, y1, fill, 0.86 * a);
  p.dot(tx - d, y1 + 1, line, a); p.blend(tx, y1 + 1, fill, 0.86 * a); p.dot(tx + d, y1 + 1, line, a);
  p.dot(tx + d, y1 + 2, line, a); p.dot(tx + 2 * d, y1 + 3, line, a);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), D = meta.duration, r = o.r ?? 30, S = o.seed;
  const s = Math.max(0.8, Math.min(1.7, r / 30)), n = o.density >= 2 ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k), born = ((i + R(1) * 0.25) / n) * D, age = (((t - born) % D) + D) % D;
    if (age >= LIFE) continue;
    const side = i % 2 === 0 ? -1 : 1;
    const [bw, bh] = SIZES[Math.floor(R(2) * 3)];
    let w = Math.round(bw * s), h = Math.round(bh * s);
    const cx = side * r * (0.3 + R(3) * 0.25), cy = -r * (0.35 + R(4) * 0.4);
    // pop: grows past its size and settles
    let y = cy, a = 1;
    if (age < POP) {
      const k = age / POP, g = k < 0.6 ? 0.5 + k * 0.95 : 1.07 - (k - 0.6) * 0.18;
      w = Math.max(5, Math.round(w * g)); h = Math.max(4, Math.round(h * g));
    }
    if (age > TYPE_END && age < BOB) y -= 1;
    if (age > BOB) { const k = seg(age, BOB, LIFE); y -= ease.inQuad(k) * 3; a = 1 - k; }
    const x0 = Math.round(cx - w / 2), y0 = Math.round(y - h / 2);
    const line = a > 0.6 ? C[3] : C[2], fill = C[0];
    bubble(p, x0, y0, w, h, side, line, fill, a > 0.6 ? C[4] : C[3], a);
    p.glow(cx, y, w * 0.8, C[2], 0.2 * a);
    // dots typing in turn
    if (age > POP * 0.8 && w >= 7) {
      const big = h >= 9, gap = big ? 3 : 2, dx = Math.round(cx) - gap, dy = Math.round(y) - (big ? 1 : 0);
      const on = age < TYPE_END ? Math.floor((age - POP) / 0.17) % 4 : -1;
      for (let j = 0; j < 3; j++) {
        const hot = j === on, x = dx + j * gap, yy = dy - (hot ? 1 : 0);
        const c = age >= TYPE_END ? C[4] : hot ? WHITE : C[2];
        if (big) { p.blend(x, yy, c, a); p.blend(x + 1, yy, c, a); p.blend(x, yy + 1, c, a); p.blend(x + 1, yy + 1, c, a); } else p.blend(x, yy, c, a);
        if (hot) p.light(x, yy, C[3], 0.35);
      }
    }
  }
}
