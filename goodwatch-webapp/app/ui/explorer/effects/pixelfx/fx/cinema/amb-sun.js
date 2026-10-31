// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, mix, clamp, bump, rng, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "High sun",
  desc: "Over the Spain island: a warm sun high over the island, its stepped rays slowly turning and pulsing, heat motes rising through an amber pool of light.",
  tags: ["cinema", "ambient", "island", "country", "spain", "sun", "heat", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 8,
  loop: true,
  fps: 30,
  bg: "dark",
  // deep red-orange rim, orange, amber, sun yellow, hot white
  options: { palette: ["#6a1606", "#d0420e", "#f39222", "#ffd84a", "#fff6cc"], seed: 1, r: 30, density: 1 },
};

const radius = (o) => clamp(o.r ?? 30, 10, 100);

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), s = Math.max(0.6, R / 30), D = meta.duration, ph = t / D, d2 = o.density >= 2;
  const sx = 0.08 * R, sy = -0.62 * R, rd = 4.6 * s;
  // light: the amber pool on the island, the warm halo round the sun
  p.glow(sx * 0.5, -0.1 * R, R * 0.95, C[2], 0.16);
  p.glow(sx, sy, rd * 4, C[2], 0.2);
  p.glow(sx, sy, rd * 2.2, C[3], 0.18);
  // rays: 12, alternating long and short, turning by two rays a loop, the two sets breathing out of step
  const N = 12, rot = (ph * 2 * TAU) / N, r0 = rd + 2.2 * s;
  const bodyR = rd + 0.6;
  p.shade(sx - rd * 3.4, sy - rd * 3.4, sx + rd * 3.4, sy + rd * 3.4, (x, y, out) => {
    const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy);
    if (d <= bodyR || d > rd * 3.4) return;
    const a = Math.atan2(dy, dx) - rot, f = ((a * N) / TAU) % 1, ff = (f + 1) % 1;
    const idx = Math.floor(((((a * N) / TAU) % N) + N + 0.5) % N), long = idx % 2 === 0;
    const offPx = Math.min(ff, 1 - ff) * (TAU / N) * d; // distance from the ray's axis
    const pulse = Math.sin(ph * TAU * 4 + (long ? 0 : Math.PI));
    const L = (long ? 6.5 : 3.6) * s + pulse * (long ? 1.4 : 0.9) * s;
    const u = (d - r0) / L;
    if (u < 0 || u > 1) return;
    if (offPx > (long ? 1.4 : 1.0) * s * (1 - u) ** 0.8 + 0.4) return;
    // stepped: hot near the sun, cooling in hard bands toward the tip
    out.c = u < 0.34 ? C[3] : u < 0.7 ? C[2] : C[1];
    out.k = 0.1; out.l = C[2];
  });
  // the sun: hard bands, hot white top-left, deep rim bottom-right
  p.shade(sx - bodyR - 1, sy - bodyR - 1, sx + bodyR + 1, sy + bodyR + 1, (x, y, out) => {
    const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy);
    if (d > bodyR + 0.9) return;
    if (d > bodyR) { out.c = C[1]; return; } // rim
    const lit = (-dx - dy) / (Math.SQRT2 * bodyR); // -1..1, top-left high
    const v = d / bodyR - lit * 0.35;
    out.c = v < 0.2 ? WHITE : v < 0.5 ? C[4] : v < 0.85 ? C[3] : C[2];
    out.k = 0.08; out.l = C[3];
  });
  // a shimmer that runs round the rim once a loop
  const ga = -ph * TAU * 2 - 2.4, gx = sx + Math.cos(ga) * bodyR, gy = sy + Math.sin(ga) * bodyR;
  p.px(gx, gy, C[4]);
  p.glow(gx, gy, 3 * s, C[3], 0.25);
  // heat motes: rising off the island, wobbling, cooling as they climb
  const n = Math.round((d2 ? 18 : 12) * Math.min(1.5, Math.sqrt(s)));
  for (let i = 0; i < n; i++) {
    const g = rng(o.seed, i, 31), speed = g.int(1, 2), u = (ph * speed + g.next()) % 1;
    const x0 = (((i + g.next() * 0.8) / n) * 2 - 1) * 0.8 * R, y = R * 0.15 - u * R * (0.7 + g.next() * 0.25);
    const x = x0 + Math.sin(u * TAU * 2 + g.next() * TAU) * 1.5 * s;
    if (Math.hypot(x - sx, y - sy) < bodyR + 2) continue;
    const k = bump(u, 0, 1);
    if (k < 0.2) continue;
    const c = u < 0.35 ? C[4] : u < 0.7 ? C[3] : C[2], big = g.next() < 0.35;
    p.px(x, y, c);
    if (big && k > 0.6) p.px(x, y - 1, u < 0.5 ? C[3] : C[2]);
    p.light(x, y, C[3], 0.2 * k);
  }
}
