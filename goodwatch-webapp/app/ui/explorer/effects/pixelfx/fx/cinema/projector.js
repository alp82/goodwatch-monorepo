import { burst, seg, ease, hex, WHITE, fit, rand, clamp } from "../../core/index.js";
import { fadeOut } from "./_burst.js";

export const meta = {
  name: "Projector flicker",
  desc: "A projector beam switches on from above, flickers like film running through a gate, dust drifts in it, and a pool of light settles and fades.",
  tags: ["cinema", "land", "one-shot"],
  size: [88, 80],
  origin: [44, 60],
  duration: 1.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#2a2010", "#7a6438", "#d8c08a", "#fff2cc", "#ffffff"], seed: 2, s: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5), s = o.s ?? 1;
  const on = ease.outExpo(seg(t, 0, 0.08)), off = fadeOut(t, 0.75, 1.3);
  // film gate flicker: 24 steps a second, a frame now and then going dim
  const step = Math.floor(t * 24), fl = 0.72 + 0.28 * rand(o.seed, step) - (rand(o.seed, step, 3) < 0.12 ? 0.3 : 0);
  const k = on * off * fl;
  if (k <= 0.01) return;
  const sx = -16 * s, sy = -46 * s, rx = 13 * s, ry = 3.5 * s;
  // the beam: light only, a cone from the lens to the pool, brighter in its middle and near the lens
  const x0 = Math.min(sx, -rx) - 1, x1 = Math.max(sx, rx) + 1;
  p.shade(x0, sy, x1, ry, (x, y, out) => {
    const v = (y - sy) / (0 - sy);
    if (v < 0 || v > 1.05) return;
    const cx = sx + (0 - sx) * v, hw = 0.8 + rx * v;
    const d = Math.abs(x - cx) / hw;
    if (d > 1) return;
    out.l = C[3];
    out.k = 0.24 * k * (1 - d * d) * (1.1 - 0.5 * v);
  });
  // the lens: a hot point
  p.px(sx, sy, WHITE);
  p.glow(sx, sy, 5 * s, C[3], 0.6 * k);
  // the pool where it lands
  const prx = rx * ease.outBack(seg(t, 0, 0.18));
  p.shade(-prx - 1, -ry - 1, prx + 1, ry + 1, (x, y, out) => {
    const d = Math.hypot(x / prx, y / ry);
    if (d > 1) return;
    out.l = d > 0.82 ? C[4] : C[3];
    out.k = k * (d > 0.82 ? 0.55 : 0.4 * (1 - d * 0.5));
  });
  p.glow(0, 0, rx * 1.4, C[3], 0.25 * k);
  // the hero frame
  if (t < 0.05) p.ellipse(0, 0, rx, ry, WHITE);
  // dust caught in the beam
  burst(9, o.seed, (r) => {
    const v = r.range(0.15, 0.95), off2 = r.range(-0.7, 0.7);
    const drift = (t * r.range(-6, 6)) * s, rise = -t * r.range(2, 7) * s;
    const cx = sx + (0 - sx) * v, hw = rx * v;
    const x = cx + off2 * hw + drift, y = sy + (0 - sy) * v + rise;
    const tw = 0.5 + 0.5 * Math.sin(t * r.range(8, 16) + r.range(0, 6));
    p.dot(x, y, C[4], clamp(k * tw * 1.2));
  });
}
