import { rng, clamp, seg, ease, TAU, WHITE, hex, fit, band, flare, sparkle } from "../../core/index.js";
import { poster } from "./_pun2.js";

export const meta = {
  name: "Star vortex",
  desc: "Stars streak in on a tightening spiral round a black point over the poster, a hot ring flares round it, then it all collapses to a white point and a few stars twinkle out.",
  tags: ["cinema", "pun", "space", "black hole", "interstellar", "gravity", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0a0820", "#1f1850", "#3a3290", "#6a5cd0", "#a898f0", "#e0d8ff", "#ffffff"],
    ring: ["#2a0e08", "#7a2a10", "#d0601a", "#ffa040", "#ffe0a0", "#ffffff"],
    seed: 1, w: 40, h: 60,
  },
};

const COLLAPSE = 1.3, END = 1.45;

export function draw(p, t, o) {
  const { w, h, k } = poster(o), C = fit(o.palette, 7), RG = o.ring;
  const R0 = clamp(Math.min(w, h) * 0.15, 3.5, 24), sy = 0.38;
  // the shrink at the end pulls everything into the middle
  const col = 1 - ease.inCubic(seg(t, COLLAPSE, END)), live = t < END;
  const tilt = -0.35, ct = Math.cos(tilt), st = Math.sin(tilt);
  const n = Math.round(clamp(34 * k, 30, 90));
  if (live) {
    // the dark heart grows in
    const rh = R0 * ease.outBack(seg(t, 0.0, 0.25)) * col;
    // glow first (behind), then the ring's far half, the hole, the near half
    const ringK = clamp(seg(t, 0.35, 0.7) * 1.4) * (1 - seg(t, 1.1, END) * 0.5);
    p.glow(0, 0, R0 * 5 * col + 2, hex(RG[3]), 0.22 * ringK + 0.08);
    if (ringK > 0) {
      const rr = R0 * 1.9 * col;
      // far half of the ring behind the hole
      band(p, 0, 0, rr, sy, Math.max(1, rr * 0.28), ringK * 0.8, RG, (g) => Math.sin(g) < 0, t > 0.7 && t < 0.8);
    }
    if (rh > 0.6) {
      p.circle(0, 0, rh + 1, hex(t < 0.3 ? C[3] : RG[3]));
      p.circle(0, 0, rh, hex("#020104"));
    }
    if (ringK > 0) {
      const rr = R0 * 1.9 * col;
      band(p, 0, 0, rr, sy, Math.max(1, rr * 0.28), ringK, RG, (g) => Math.sin(g) >= 0, t > 0.7 && t < 0.8);
      p.glowRing(0, 0, rr, rr * 0.5, hex(RG[3]), 0.25 * ringK);
    }
    // stars on a spiral: each starts far out and winds in, faster as it nears the hole
    for (let i = 0; i < n; i++) {
      const r = rng(o.seed, i), d0 = r.range(0.45, 0.85) * Math.hypot(w, h) * 0.5, a0 = r.range(0, TAU), t0 = r.range(0, 0.45), dur = r.range(0.6, 1.0);
      const u = seg(t, t0, t0 + dur);
      if (t < t0 || u >= 1) continue;
      const tail = 4;
      let px = 0, py = 0;
      for (let j = 0; j <= tail; j++) {
        const uu = Math.max(0, u - j * 0.022), rad = Math.max(R0 * 0.9, d0 * (1 - ease.inQuad(uu)) * col), ang = a0 + 2.6 * uu + 1.2 / (rad / d0 + 0.15);
        const lx = Math.cos(ang) * rad, ly = Math.sin(ang) * rad * (0.55 + 0.45 * (rad / d0));
        const x = lx * ct - ly * st, y = lx * st + ly * ct;
        if (j > 0) p.line(px, py, x, y, j === 1 ? hex(C[5]) : hex(C[3]), (1 - j / (tail + 1)) * clamp(u * 5));
        else {
          p.px(x, y, u > 0.7 ? hex(RG[4]) : WHITE);
          p.light(x, y, hex(C[4]), 0.4);
        }
        px = x; py = y;
      }
    }
  }
  // the collapse: a white point and a cross flare
  const f = seg(t, COLLAPSE + 0.05, END + 0.35);
  if (t > COLLAPSE + 0.05 && f < 1) {
    flare(p, 0, 0, (R0 * 2.2 + 4) * (1 - ease.outQuad(f)), 0.5, RG);
    p.glow(0, 0, R0 * 4 * (1 - f) + 1, WHITE, 0.5 * (1 - f));
  }
  // the afterglow: a few stars twinkle where the swirl was
  for (let i = 0; i < Math.round(6 * Math.sqrt(k)); i++) {
    const r = rng(o.seed, i, 7), t0 = END + r.range(0, 0.35), life = r.range(0.25, 0.4), u = (t - t0) / life;
    if (u < 0 || u >= 1) continue;
    const a = r.range(0, TAU), d = r.range(0.4, 1) * R0 * 3;
    sparkle(p, Math.cos(a) * d, Math.sin(a) * d * 0.7, Math.round(2.5 * Math.sin(Math.PI * u)), hex(C[4]), hex(C[3]), 0.35);
  }
}
