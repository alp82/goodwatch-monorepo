// Made for the GoodWatch explorer map: ambient loop.
import { cycle, fit, hex, mix, seg, bump, ease, WHITE } from "../../core/index.js";
import { spot, env, count, radius } from "./_amb2.js";

export const meta = {
  name: "Sci-fi glints",
  desc: "Over a future island: cyan plus blips snap on and shrink away, bracket corners lock onto one now and then, and a thin scan tick slides down a short stretch of the island.",
  tags: ["cinema", "ambient", "island", "scifi", "future", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 5,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#08303a", "#108088", "#18b4b0", "#4ce8d8", "#e8fffc"], seed: 1, r: 30, density: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), D = meta.duration;
  // blips: snap in at full size, shrink over their life
  cycle(t, D, count(4, o.density), o.seed, (g) => g.range(0.5, 0.9), (age, life, r) => {
    const [x, y] = spot(r, R), k = 1 - ease.outQuad(age / life), n = Math.ceil(k * (o.density >= 2 ? 3 : 2));
    const hot = age < 0.06;
    for (let i = 1; i <= n; i++) {
      const c = hot ? WHITE : i === n ? C[2] : C[3];
      p.px(x + i, y, c); p.px(x - i, y, c); p.px(x, y + i, c); p.px(x, y - i, c);
    }
    p.px(x, y, hot ? WHITE : C[4]);
    p.light(x, y, C[3], 0.35 * k);
    if (r.chance(0.35)) {
      // brackets close in on the blip
      const b = 2 + Math.round((1 - ease.outCubic(seg(age, 0, 0.25))) * 3) + n, a = env(age / life, 0.05, 0.5) * 0.9;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        p.dot(x + sx * b, y + sy * b, C[3], a); p.dot(x + sx * (b - 1), y + sy * b, C[2], a); p.dot(x + sx * b, y + sy * (b - 1), C[2], a);
      }
    }
  });
  // the scan tick: twice a loop a short line slides down over the upper island
  for (let s = 0; s < 2; s++) {
    const t0 = s * D * 0.5 + 0.7, u = seg(t, t0, t0 + 0.9);
    if (u <= 0 || u >= 1) continue;
    const w = R * 0.55, cx = (s ? 0.25 : -0.3) * R, y = -R * 0.85 + u * R * 0.9, a = bump(u, 0, 1);
    p.line(cx - w / 2, y, cx + w / 2, y, (v) => (Math.abs(v - 0.5) < 0.15 ? C[4] : C[3]), (v) => a * (1 - Math.abs(v - 0.5) * 1.4));
    p.dot(cx - w / 2 + ((u * 7) % 1) * w, y - 1, mix(C[4], WHITE, 0.5), a);
    p.light(cx, y, C[2], 0.18 * a);
  }
}
