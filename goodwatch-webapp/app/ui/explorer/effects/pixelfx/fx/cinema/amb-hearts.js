import { fit, rand, TAU, WHITE, seg } from "../../core/index.js";
import { AMB, count, bornAt } from "./_amb1.js";

export const meta = {
  name: "Ambient hearts",
  desc: "Little hearts pop up over an island one by one, float up swaying, beat once and fade away.",
  tags: ["cinema", "ambient", "romantic", "love", "hearts", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: { palette: ["#3a0a1c", "#7a1236", "#c4204e", "#ff4a78", "#ff9ab8", "#ffe0ea"], seed: 1, r: 30, density: 1 },
};

const BIG = ["oo.oo", "ohooo", "ooood", ".ood.", "..d.."];
const SMALL = ["o.o", "ooo", ".d."];

export function draw(p, t, o) {
  const C = fit(o.palette, 6), D = meta.duration, r = o.r, S = o.seed, n = count(o, 4);
  const pal = { o: C[3], h: C[5], d: C[2] }, dim = { o: C[2], h: C[3], d: C[1] };
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k), life = 2.2 + R(1) * 1, born = bornAt(i, n, D, R(2));
    const age = (((t - born) % D) + D) % D;
    if (age >= life) continue;
    const u = age / life, x0 = (R(3) - 0.5) * r * 1.5, y0 = -r * (0.1 + R(4) * 0.45);
    const x = x0 + Math.sin(u * TAU * (0.8 + R(5) * 0.6) + R(6) * TAU) * 3, y = y0 - u * r * 0.45;
    const big = o.density >= 2 ? R(7) < 0.6 : R(7) < 0.4;
    if (age < 0.06) {
      p.px(x, y, WHITE);
      p.glow(x, y, 5, C[4], 0.3);
      continue;
    }
    // fade like pixel art: big, then small and dim, then a last dot
    const stage = u < 0.6 ? 0 : u < 0.85 ? 1 : 2, a = Math.min(1, u * 8);
    if (stage === 2) {
      p.dot(x, y, C[2], 1 - seg(u, 0.85, 1) * 0.8);
      continue;
    }
    const rows = big && stage === 0 ? BIG : SMALL, w = rows[0].length;
    const beat = u > 0.3 && u < 0.36;
    p.sprite(rows, stage ? dim : pal, Math.round(x - w / 2), Math.round(y - w / 2), { a });
    p.glow(x, y, beat ? 7 : 5, C[3], (beat ? 0.3 : 0.16) * (stage ? 0.5 : 1));
  }
}
