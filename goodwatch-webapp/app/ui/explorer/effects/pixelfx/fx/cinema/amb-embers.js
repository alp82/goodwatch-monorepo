// Made for the GoodWatch explorer map: ambient loop.
import { fit, rand, TAU, at, seg, clamp } from "../../core/index.js";
import { AMB, count, bornAt, wave } from "./_amb1.js";

export const meta = {
  name: "Ambient embers",
  desc: "Embers lift off a warm glow pool low over the island: 2 px hot heads, the biggest burning as crosses, wander up with short cooling trails and wink out dull red.",
  tags: ["cinema", "ambient", "thrilling", "embers", "fire", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: { palette: ["#3d1012", "#701a14", "#a8301a", "#e0561e", "#ff8a2a", "#ffc46a", "#fff2c0"], seed: 1, r: 30, density: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 7), D = meta.duration, r = clamp(o.r ?? 30, 10, 100), S = o.seed, n = count(o, 14);
  const s = clamp(r / 30, 0.6, 2.2);

  // the warm pool low over the island: a wide soft one and two hot spots breathing out of step
  const br = 0.85 + 0.1 * wave(t, D, 3) + 0.05 * wave(t, D, 7, 1.3);
  p.glow(0, r * 0.16, r * 1.05, C[3], 0.24 * br);
  p.glow(-r * 0.32, r * 0.2, r * 0.45, C[4], 0.15 * (0.8 + 0.2 * wave(t, D, 4, 2.1)));
  p.glow(r * 0.3, r * 0.2, r * 0.45, C[4], 0.15 * (0.8 + 0.2 * wave(t, D, 3, 0.9)));
  p.glow(0, r * 0.22, r * 0.5, C[4], 0.14 * br);
  p.glow(r * 0.25 * wave(t, D, 1, 0.7), r * 0.22, r * 0.3, C[5], 0.12 * (0.75 + 0.25 * wave(t, D, 5, 0.4)));

  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k), life = 2 + R(1) * 1.6, born = bornAt(i, n, D, R(2));
    const age = (((t - born) % D) + D) % D;
    if (age >= life) continue;
    const kind = R(11) < 0.3 ? 2 : R(11) < 0.75 ? 1 : 0; // 2 big cross, 1 two-px head, 0 small spark
    const u = age / life, x0 = (R(3) - 0.5) * r * 1.5, y0 = r * (0.05 + R(4) * 0.25), rise = Math.min(r * (0.9 + R(5) * 0.35), y0 + Math.min(r * 1.1, 50));
    const wob = (q) => Math.sin(q * TAU * (0.8 + R(6)) + R(7) * TAU) * (1.5 + R(8) * 2.5) * s * q;
    // fast off the bed, slowing as it cools
    const pos = (q) => [x0 + wob(q) + q * (R(9) - 0.5) * 10 * s, y0 - rise * (1 - (1 - q) * (1 - q))];
    const [x, y] = pos(u), heat = 1 - Math.pow(u, 1.6);
    const fl = 0.75 + 0.25 * Math.sin(age * (24 + R(12) * 14) + i);
    const a = Math.min(1, u * 14) * (1 - seg(u, 0.8, 1));
    if (a <= 0.02) continue;
    const hx = Math.round(x), hy = Math.round(y);

    // a short cooling trail: dimmer and redder behind the head
    const tl = kind === 2 ? 5 : kind === 1 ? 4 : 3;
    for (let j = tl; j >= 1; j--) {
      const [tx, ty] = pos(Math.max(0, u - j * 0.022));
      const hh = Math.max(0, heat * 0.85 - j * 0.14);
      if (hh <= 0.02) continue;
      p.dot(tx, ty, at(C, 0.15 + hh * 0.7), a * (1 - j / (tl + 1)) * 1.1);
    }

    const core = at(C, 0.35 + heat * 0.65), mid = at(C, 0.25 + heat * 0.6);
    if (kind === 0) {
      p.dot(hx, hy, core, a);
      p.glow(x, y, 3 * s, C[4], 0.3 * heat * fl * a);
      continue;
    }
    if (kind === 2 && heat > 0.4) {
      // the biggest burn as a little cross while they're hot: white core, gold arms, longer arms on big islands
      const arm = s > 1.5 ? 2 : 1, ac = at(C, 0.3 + heat * 0.55);
      p.dot(hx, hy, C[6], a);
      for (let k = 1; k <= arm; k++) {
        const ka = a * (k === 1 ? 1 : 0.55) * fl, kc = k === 1 ? ac : at(C, 0.2 + heat * 0.4);
        p.dot(hx - k, hy, kc, ka);
        p.dot(hx + k, hy, kc, ka);
        p.dot(hx, hy - k, kc, ka);
        p.dot(hx, hy + k, kc, ka);
      }
      p.glow(x, y, (4 + 3 * heat) * s, C[4], 0.6 * heat * fl * a);
      p.light(hx, hy, C[6], 0.4 * heat * a);
      continue;
    }
    // 2 px heads: hottest pixel on top, a cooler one under it
    p.dot(hx, hy, core, a);
    p.dot(hx, hy + 1, mid, a);
    if (kind === 2) {
      p.glow(x + 0.5, y + 0.5, (3.5 + 2 * heat) * s, C[4], 0.5 * heat * fl * a);
    } else {
      p.glow(x, y + 0.5, (3 + 2 * heat) * s, C[4], 0.42 * heat * fl * a);
      p.light(hx, hy, C[5], 0.25 * heat * a);
    }
  }
}
