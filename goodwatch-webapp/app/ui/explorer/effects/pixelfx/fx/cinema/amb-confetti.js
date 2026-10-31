import { fit, rand, TAU, seg, fly, WHITE, scale } from "../../core/index.js";
import { AMB, count, bornAt } from "./_amb1.js";

export const meta = {
  name: "Ambient confetti",
  desc: "A few paper bits flutter down over an island, flipping as they swing; once a loop a little pop throws a fresh handful.",
  tags: ["cinema", "ambient", "funny", "party", "confetti", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: { palette: ["#ff4a5a", "#ff9a2a", "#ffe03c", "#5ad84a", "#3cc8ff", "#7a6cff", "#f53cd1"], seed: 1, r: 30, density: 1 },
};

// one paper bit tumbling: wide face, quarter turn, tall edge, its darker back
function bit(p, x, y, c, flip, a) {
  const X = Math.round(x), Y = Math.round(y), f = Math.floor(flip) & 3, back = scale(c, 0.55);
  if (f === 0) {
    p.dot(X - 1, Y, c, a);
    p.dot(X, Y, c, a);
    p.dot(X + 1, Y, c, a);
    p.dot(X, Y + 1, back, a);
  } else if (f === 1) {
    p.dot(X, Y, c, a);
    p.dot(X + 1, Y + 1, c, a);
    p.dot(X + 1, Y, back, a);
  } else if (f === 2) {
    p.dot(X, Y - 1, c, a);
    p.dot(X, Y, c, a);
    p.dot(X, Y + 1, back, a);
  } else {
    p.dot(X, Y, back, a);
    p.dot(X + 1, Y, back, a);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), D = meta.duration, r = o.r, S = o.seed, n = count(o, 5);
  // drifting bits
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k), life = 2.6 + R(1) * 1.4, born = bornAt(i, n, D, R(2));
    const age = (((t - born) % D) + D) % D;
    if (age >= life) continue;
    const u = age / life, x0 = (R(3) - 0.5) * r * 1.6, y0 = -r * (0.9 + R(4) * 0.15);
    const x = x0 + Math.sin(u * TAU * (1 + R(5)) + R(6) * TAU) * 4, y = y0 + u * r * (0.8 + R(7) * 0.3);
    const a = Math.min(1, u * 6) * (1 - seg(u, 0.7, 1));
    bit(p, x, y, C[(i * 3 + Math.floor(R(8) * 2)) % 7], age * (6 + R(9) * 6), a);
  }
  // the pop: a glint, then a handful thrown up that stalls and drifts
  const pops = o.density >= 2 ? 2 : 1;
  for (let k = 0; k < pops; k++) {
    const T = (rand(S, 99, k) * 0.5 + k * 0.5) * D, age = (((t - T) % D) + D) % D;
    if (age > 2.6) continue;
    const px = (rand(S, 98, k) - 0.5) * r, py = -r * (0.35 + rand(S, 97, k) * 0.3);
    if (age < 0.08) {
      p.px(px, py, WHITE);
      p.px(px - 1, py, C[2]);
      p.px(px + 1, py, C[2]);
      p.px(px, py - 1, C[2]);
      p.px(px, py + 1, C[2]);
    }
    if (age < 0.22) p.ring(px, py, 2 + age * 28, 1, age < 0.1 ? WHITE : C[2], 1 - age / 0.22);
    p.glow(px, py, 8, C[2], 0.3 * Math.max(0, 1 - age / 0.3));
    const m = 6 + (o.density >= 2 ? 2 : 0);
    for (let j = 0; j < m; j++) {
      const R = (q) => rand(S, 50 + k, j, q), an = -Math.PI / 2 + (R(1) - 0.5) * 2.4, sp = 60 + R(2) * 50;
      const [x, y] = fly(px, py, Math.cos(an) * sp, Math.sin(an) * sp, age, 40, 3.2);
      const a = 1 - seg(age, 1.6 + R(3) * 0.6, 2.6);
      bit(p, x + Math.sin(age * 3 + j) * 2 * seg(age, 0.5, 1.5), y, C[j % 7], age * (8 + R(4) * 6), a);
    }
  }
}
