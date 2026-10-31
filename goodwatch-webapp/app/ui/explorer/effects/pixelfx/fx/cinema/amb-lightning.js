import { fit, rand, rng, bolt, forks, seg } from "../../core/index.js";
import { AMB, count } from "./_amb1.js";

export const meta = {
  name: "Ambient lightning",
  desc: "Mostly quiet over an island; once or twice a loop a tiny forked bolt flickers down from above, flashes twice and leaves an afterglow.",
  tags: ["cinema", "ambient", "tense", "lightning", "storm", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: { palette: ["#0a0f2e", "#2550d0", "#3f8cff", "#7cc8ff", "#c8f0ff", "#ffffff"], seed: 1, r: 30, density: 1 },
};

const LIFE = 0.42;

export function draw(p, t, o) {
  const C = fit(o.palette, 6), D = meta.duration, r = o.r, S = o.seed, n = o.density >= 2 ? 2 : 1;
  // between strikes: static crackle, tiny zigzags that flick on for a frame or two
  const m = count(o, 6);
  for (let i = 0; i < m; i++) {
    const R = (k) => rand(S, 60 + i, k), born = ((i + R(1) * 0.6) / m) * D, age = (((t - born) % D) + D) % D;
    if (age > 0.12) continue;
    const x = (R(2) - 0.5) * r * 1.5, y = -r * (0.1 + R(3) * 0.75), dir = R(4) < 0.5 ? -1 : 1;
    const pts = [[x, y], [x + dir * 1.5, y + 1], [x + dir * 0.5, y + 2.2], [x + dir * 2.2, y + 3.4]];
    p.polyline(pts, age < 0.05 ? C[4] : C[3]);
    p.light(x + dir, y + 1.5, C[3], 0.3);
  }
  for (let i = 0; i < n; i++) {
    const T = ((i + rand(S, i, 1) * 0.6) / n) * D, age = (((t - T) % D) + D) % D;
    if (age >= LIFE) continue;
    const g = rng(S, i, 7), x0 = (rand(S, i, 2) - 0.5) * r * 1.1, y0 = -r * 1.05, x1 = x0 + (rand(S, i, 3) - 0.5) * r * 0.6, y1 = -r * (0.05 + rand(S, i, 4) * 0.15);
    const path = bolt(g, x0, y0, x1, y1, { jag: 0.3, depth: 4 }), br = forks(g, path, { count: 2, len: r * 0.4 });
    // flicker: on, off, on brighter and thicker, then a cooling afterglow
    const on = age < 0.05 || (age > 0.09 && age < 0.17);
    if (on) {
      const hot = age > 0.09;
      if (hot) p.polyline(path.map(([x, y]) => [x + 1, y]), C[2]);
      p.polyline(path, hot ? C[5] : C[4]);
      for (const b of br) p.polyline(b, hot ? C[4] : C[3]);
      for (let j = 0; j < path.length; j += 2) p.light(path[j][0], path[j][1], C[3], 0.3);
      p.glow(x0, y0, Math.min(14, r * 0.45), C[3], hot ? 0.35 : 0.22);
      p.glow(x1, y1, 6, C[4], 0.35);
    } else if (age > 0.17) {
      const k = 1 - seg(age, 0.17, LIFE);
      // the channel cools from the ground up
      p.polyline(path.slice(0, Math.max(2, Math.ceil(path.length * k))), k > 0.5 ? C[2] : C[1]);
      p.glow(x0, y0, Math.min(10, r * 0.35), C[2], 0.15 * k);
    }
  }
}
