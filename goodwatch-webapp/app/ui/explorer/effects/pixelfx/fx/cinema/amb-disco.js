// Made for the GoodWatch explorer map: ambient loop.
import { cycle, fit, hex, mix, bump, rng, wrap, WHITE } from "../../core/index.js";
import { spot, count, radius } from "./_amb2.js";

export const meta = {
  name: "Era sparkles",
  desc: "Over a decade island: mirror-ball flecks drift across the upper island, brightest in a slow passing band, and a few sharp glints flash in the era's colors.",
  tags: ["cinema", "ambient", "island", "disco", "decade", "sparkle", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#2a0a30", "#6a1e6e", "#d050b0", "#ffb0e0", "#fff4fb"], seed: 1, r: 30, density: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), D = meta.duration, d2 = o.density >= 2;
  const ph = t / D, band = wrap(ph * 2, 1);
  // the flecks: little squares on rows of the upper island, all drifting right together (one lap a loop)
  const n = Math.round((d2 ? 30 : 20) * Math.min(1.5, Math.max(0.75, R / 30)));
  for (let i = 0; i < n; i++) {
    const g = rng(o.seed, i, 41);
    const row = g.int(0, 3), u = wrap(g.next() + ph, 1);
    const an = -Math.PI * (0.1 + 0.8 * u), d = R * (0.6 + row * 0.13);
    const x = -Math.cos(an) * d, y = Math.sin(an) * d * 0.8;
    // ends of the arc fade, the passing band lights them up, each fleck winks on its own
    const edge = bump(u, 0, 1), lit = bump(wrap(u - band + 0.5, 1), 0.3, 0.7);
    const wink = 0.5 + 0.5 * Math.sin((ph * (3 + (i % 3)) + g.next()) * Math.PI * 2);
    const k = edge * (0.25 + 0.75 * lit) * (0.5 + 0.5 * wink);
    if (k < 0.18) continue;
    const c = k > 0.7 ? C[4] : k > 0.4 ? C[3] : C[2];
    p.px(x, y, c);
    if (d2 && k > 0.6) p.px(x + 1, y, C[2]);
    if (k > 0.55) p.light(x, y, C[3], 0.16 * k);
  }
  // the glints: sharp 4-point stars with a diagonal kiss
  cycle(t, D, count(3, o.density), o.seed + 5, (g) => g.range(0.5, 0.8), (age, life, r) => {
    const [x, y] = spot(r, R, 0.4, 1), k = bump(age, 0, life), arm = Math.round(k * (d2 ? 4 : 3));
    const core = mix(C[4], WHITE, 0.6);
    for (let i = 1; i <= arm; i++) {
      const c = i === arm ? C[2] : C[3];
      p.px(x + i, y, c); p.px(x - i, y, c); p.px(x, y + i, c); p.px(x, y - i, c);
    }
    if (arm >= 2) { p.px(x + 1, y + 1, C[2]); p.px(x - 1, y - 1, C[2]); p.px(x + 1, y - 1, C[2]); p.px(x - 1, y + 1, C[2]); }
    p.px(x, y, core);
    p.glow(x, y, 3 + arm * 1.5, C[3], 0.28 * k);
  });
}
