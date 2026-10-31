import { rng, clamp, seg, ease, TAU, WHITE, hex, fit, scale } from "../../core/index.js";
import { poster } from "./_pun2.js";

export const meta = {
  name: "Ooze drip",
  desc: "Glowing slime spills over the poster's top edge, swells into hanging drips that stretch, pinch off and fall, and splat on the bottom edge; then the slime drains away.",
  tags: ["cinema", "pun", "slime", "ooze", "zombie", "toxic", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0d1a0c", "#173a14", "#265e18", "#3f8a1e", "#6cb82a", "#a8e04a", "#e0ff8a"], seed: 1, w: 40, h: 60 },
};

const DRAIN = 1.6, END = 2.25;

export function draw(p, t, o) {
  const { w, h, k } = poster(o), C = fit(o.palette, 7).map(hex);
  const top = -h / 2, bot = h / 2, sk = Math.sqrt(k);
  const coat = ease.outCubic(seg(t, 0, 0.25)) * (1 - ease.inCubic(seg(t, DRAIN, END)));
  if (coat <= 0) return;
  // the coat along the top edge: a wavy band, lit on top
  const th = (2 + 1.5 * sk) * coat;
  for (let x = Math.floor(-w / 2); x < w / 2; x++) {
    const wav = Math.sin(x * 0.45 + 1.3) * 0.8 + Math.sin(x * 0.17) * 0.9;
    const sc = Math.pow(Math.max(0, Math.cos(x * 0.55 + Math.sin(x * 0.21) * 2)), 6) * 2.5 * sk;
    const d = th + (wav + sc) * coat;
    if (d < 0.6) continue;
    for (let y = 0; y < d; y++) p.px(x, top - 1 + y, y < 1 ? C[5] : y > d - 1.2 ? C[2] : C[4]);
    if (x % 3 === 0) p.px(x, top - 1, C[6]);
  }
  p.glowLine(-w / 2, top + 1, w / 2, top + 1, 6 * sk, C[4], 0.3 * coat);
  // the drips
  const n = Math.round(clamp(5 * Math.sqrt(w / 40), 4, 12));
  for (let i = 0; i < n; i++) {
    const r = rng(o.seed, i), x = ((i + r.range(0.2, 0.8)) / n - 0.5) * w;
    const t0 = r.range(0.1, 0.5), grow = r.range(0.35, 0.6), len = r.range(4, 9) * sk, bead = r.range(1.7, 2.6) * sk;
    const u = seg(t, t0, t0 + grow), drop = t0 + grow;
    // the hanging strand, thinner at the bottom, a bead at its end
    const L = len * ease.inQuad(u) * coat * (t < drop ? 1 : clamp(1 - (t - drop) * 3, 0.35, 1));
    if (L > 0.5) {
      for (let y = 0; y < L; y++) {
        const wid = Math.max(0, 1.2 * sk * (1 - y / L) + 0.4);
        for (let dx = -Math.floor(wid); dx <= Math.floor(wid); dx++) p.px(x + dx, top + th + y, dx < 0 ? C[5] : C[3]);
      }
      if (t < drop) {
        p.circle(x, top + th + L, bead * u, C[4]);
        p.px(x - bead * 0.4, top + th + L - bead * 0.4, WHITE);
      }
    }
    // the falling drop and its splat
    if (t >= drop) {
      const ft = t - drop, y0 = top + th + len, g = 300 * (h / 60), y = y0 + 0.5 * g * ft * ft, land = Math.sqrt((2 * (bot - y0)) / g);
      if (ft < land) {
        const v = g * ft, st = Math.min(5 * sk, 1 + v * 0.02);
        p.line(x, y - st, x, y, C[3]);
        p.circle(x, y, bead * 0.8, C[4]);
        p.px(x, y - 1, C[6]);
        p.light(x, y, C[4], 0.4);
      } else {
        const st = ft - land, sa = clamp(1 - st / 0.5);
        if (sa > 0) {
          // a flat blob and four flicks
          p.ellipse(x, bot, 1.5 * sk + st * 6, 0.9, C[3], sa);
          for (let j = 0; j < 4; j++) {
            const dir = j < 2 ? -1 : 1, sp = (j % 2 ? 22 : 14) * sk, fx = x + dir * sp * st, fy = bot - (j % 2 ? 26 : 16) * sk * st + 120 * st * st;
            if (fy <= bot) p.dot(fx, fy, C[5], sa);
          }
          p.glow(x, bot, 5 * sk, C[4], 0.4 * sa);
        }
      }
    }
  }
}
