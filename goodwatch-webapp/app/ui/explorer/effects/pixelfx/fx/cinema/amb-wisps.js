import { fit, rand, TAU, mix } from "../../core/index.js";
import { AMB, count, wave } from "./_amb1.js";

export const meta = {
  name: "Ambient shadow wisps",
  desc: "Shadow wisps rise off an island and curl as they go: a violet-black head with a pale rim trailing a thinning tail.",
  tags: ["cinema", "ambient", "dark", "shadow", "wisp", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: { palette: ["#050308", "#140c22", "#2a1a46", "#48307a", "#7a5cb8", "#cbb8ff"], seed: 1, r: 30, density: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6), D = meta.duration, r = o.r, S = o.seed, n = count(o, 3);
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k), life = 2.8 + R(1) * 1, born = ((i + R(2) * 0.5) / n) * D;
    const age = (((t - born) % D) + D) % D;
    if (age >= life) continue;
    const x0 = (R(3) - 0.5) * r * 1.4, y0 = -r * (0.0 + R(4) * 0.2), rise = r * (0.65 + R(5) * 0.3);
    const curl = (R(6) < 0.5 ? -1 : 1) * (3 + r * (0.1 + R(7) * 0.08)), sp = 1.1 + R(8) * 0.6;
    const pos = (a) => {
      const u = Math.max(0, a) / life;
      return [x0 + Math.sin(u * sp * TAU) * curl * Math.min(1, u * 2), y0 - rise * (1 - (1 - u) * (1 - u))];
    };
    const u = age / life, fade = Math.min(1, u * 5) * Math.min(1, (1 - u) * 2.5);
    // the tail: soft dark puffs thinning back along the path, a pale lit edge on top
    for (let j = 9; j >= 1; j--) {
      const [tx, ty] = pos(age - j * 0.12), q = 1 - j / 10;
      p.disc(tx, ty, 0.8 + 1.4 * q, j > 5 ? C[2] : C[3], 0.55 * q * fade);
      if (j % 3 === 0) p.dot(tx, ty - 1, C[4], 0.6 * q * fade);
    }
    const [x, y] = pos(age), X = Math.round(x), Y = Math.round(y);
    p.disc(x, y, 2.4, C[2], 0.8 * fade);
    p.dot(X, Y, C[1], fade);
    p.dot(X, Y - 2, C[5], fade);
    p.dot(X - 1, Y - 2, C[4], fade * 0.9);
    p.dot(X + 1, Y - 2, C[4], fade * 0.9);
    p.dot(X - 2, Y - 1, C[4], fade * 0.7);
    p.dot(X + 2, Y - 1, C[4], fade * 0.7);
    p.glow(x, y, 7, C[4], 0.2 * fade);
  }
}
