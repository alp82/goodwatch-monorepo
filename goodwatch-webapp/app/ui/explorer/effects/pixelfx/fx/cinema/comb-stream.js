// Made for the GoodWatch explorer map: combination stream.
import { clamp, ease, fract, rand, seg, TAU, WHITE, hex, fit } from "../../core/index.js";
import { rampOf } from "./_comb.js";

export const meta = {
  name: "Combination stream",
  desc: "A film strip in a picked island's color runs from the island to the hub, rippling, sprockets and frames scrolling in, light motes riding it.",
  tags: ["cinema", "combination", "stream", "film", "loop"],
  size: [200, 120],
  origin: [24, 76],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "dark",
  // dx, dy: from the island's middle to the hub's (effect px); r0, r1: island and hub radius; rise 0..1 how far it reaches
  options: { palette: ["#3a2a08", "#7a5a12", "#e2cf55", "#f2e6a0", "#fffbe8"], seed: 1, dx: 150, dy: -30, r0: 14, r1: 20, rise: 1 },
};

const SCROLL = 45; // px a loop: whole sprocket (5) and frame (9) periods, so it loops clean

export function draw(p, t, o) {
  const C = o.palette.length === 5 ? o.palette.map(hex) : fit(o.palette, 5).map(hex);
  const rise = clamp(o.rise ?? 1), D = meta.duration, ph = t / D;
  const dx = o.dx, dy = o.dy, L = Math.hypot(dx, dy);
  if (L < 8 || rise <= 0) return;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  // from the island's rim to the hub's rim, bowed a little to one side
  const a0 = Math.min(o.r0 * 0.75, L * 0.3), a1 = Math.min(o.r1 * 0.85, L * 0.3);
  const sx = ux * a0, sy = uy * a0, ex = dx - ux * a1, ey = dy - uy * a1;
  const side = rand(o.seed, 7) < 0.5 ? -1 : 1, bend = side * Math.min(30, L * 0.16);
  const cx = (sx + ex) / 2 + nx * bend, cy = (sy + ey) / 2 + ny * bend;
  const at = (u) => {
    const v = 1 - u;
    return [v * v * sx + 2 * v * u * cx + u * u * ex, v * v * sy + 2 * v * u * cy + u * u * ey];
  };
  const tan = (u) => {
    const tx = 2 * (1 - u) * (cx - sx) + 2 * u * (ex - cx), ty = 2 * (1 - u) * (cy - sy) + 2 * u * (ey - cy);
    const d = Math.hypot(tx, ty) || 1;
    return [tx / d, ty / d];
  };
  const len = Math.hypot(ex - sx, ey - sy) + Math.abs(bend) * 0.6;
  const reach = ease.outCubic(rise), head = reach * len;
  const scroll = ph * SCROLL;
  const half = 4;
  // the strip, sampled every half pixel along and across so diagonals have no holes
  const n = Math.ceil(head / 0.5);
  for (let i = 0; i <= n; i++) {
    const s = i * 0.5, u = s / len;
    const [px, py] = at(u), [tx, ty] = tan(u);
    // a ripple running down the strip towards the hub: one whole wave a loop
    const wv = Math.sin(s * 0.09 - ph * TAU) * 2.2 * Math.min(1, s / 14, (head - s) / 10 + 0.2);
    const qx = px - ty * wv, qy = py + tx * wv;
    // fade in at the island, a hot head while it reaches
    const aIn = Math.min(1, s / 10), aHead = rise < 1 ? Math.min(1, (head - s) / 6) : 1;
    const a = aIn * aHead;
    const m = ((s - scroll) % 45 + 45) % 45, f = Math.floor((s - scroll) / 9), mf = ((s - scroll) % 9 + 9) % 9;
    for (let j = -half; j <= half; j += 0.5) {
      const J = Math.round(Math.abs(j));
      let c;
      // film: rails, bright sprocket holes, lit frames with dark gaps between them
      if (J === 4) c = tx * j < 0 ? C[2] : C[0];
      else if (J === 3) c = m % 5 < 2 ? C[4] : C[0];
      else if (mf < 2) c = C[0];
      else c = J < 2 && rand(o.seed, f, 9) < 0.55 && mf > 3 && mf < 8 ? C[3] : J === 2 ? C[1] : C[2];
      p.dot(qx + -ty * j, qy + tx * j, c, a);
    }
    if (i % 12 === 0) p.glow(qx, qy, 9, C[2], 0.05 * a);
  }
  // the head: a spark while it reaches, a soft splash where it meets the hub
  if (rise < 1 && head > 2) {
    const [hx, hy] = at(head / len);
    p.px(hx, hy, WHITE); p.px(hx + 1, hy, C[4]); p.px(hx - 1, hy, C[4]); p.px(hx, hy + 1, C[4]); p.px(hx, hy - 1, C[4]);
    p.glow(hx, hy, 9, C[3], 0.5);
  } else {
    const pul = 0.5 + 0.5 * Math.sin(ph * TAU * 2);
    p.glow(ex, ey, 10, C[3], 0.18 + 0.12 * pul);
  }
  // motes riding the strip towards the hub and spiralling round it
  const nm = Math.max(4, Math.round(len / 18));
  for (let i = 0; i < nm; i++) {
    const sp = 1 + (rand(o.seed, i, 3) < 0.4 ? 1 : 0);
    const q = fract(ph * sp + i / nm + rand(o.seed, i, 4) * 0.3);
    const s = q * len;
    if (s > head) continue;
    const spin = (q * 3 + rand(o.seed, i, 5)) * TAU, off = Math.sin(spin) * 5.5, front = Math.cos(spin) > 0;
    const ae = Math.min(1, q * 8, (1 - q) * 12);
    for (let k = 4; k >= 0; k--) {
      const ss = Math.max(0, s - k * 1.6), uu = ss / len, [mx, my] = at(uu), [tx, ty] = tan(uu);
      const oo = Math.sin(spin - k * 0.25) * 5.5;
      const c = k === 0 ? (front ? WHITE : C[4]) : k < 3 ? C[3] : C[2];
      const X = mx - ty * oo, Y = my + tx * oo;
      p.dot(X, Y, c, ae * (k === 0 ? 1 : 0.85 - k * 0.12));
      if (k === 0 && front) { p.dot(X + 1, Y, C[4], ae); p.dot(X, Y + 1, C[4], ae); p.dot(X - 1, Y, C[3], ae); p.dot(X, Y - 1, C[3], ae); }
    }
    const [mx, my] = at(s / len), [tx, ty] = tan(s / len);
    p.light(mx - ty * off, my + tx * off, C[3], 0.5 * ae);
    p.glow(mx - ty * off, my + tx * off, front ? 6 : 4, C[3], (front ? 0.4 : 0.2) * ae);
  }
}
