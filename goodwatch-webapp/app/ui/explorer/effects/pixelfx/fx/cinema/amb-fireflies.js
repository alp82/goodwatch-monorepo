import { fit, rand, TAU, loopNoise } from "../../core/index.js";
import { AMB, count, wave, bornAt } from "./_amb1.js";

export const meta = {
  name: "Ambient fireflies",
  desc: "A few warm fireflies wander over an island, each glowing up on its own rhythm, trailing light, then going dark.",
  tags: ["cinema", "ambient", "cozy", "fireflies", "glow", "loop"],
  ...AMB,
  duration: 8,
  loop: true,
  options: { palette: ["#2a1a08", "#6a4a12", "#c08a1e", "#ffc84a", "#fff0a8", "#ffffff"], seed: 1, r: 30, density: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6), D = meta.duration, r = o.r, S = o.seed, n = count(o, 5);
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k);
    const cx = (R(1) - 0.5) * r * 1.8, cy = -r * (0.05 + R(2) * 0.7);
    const ax = r * (0.12 + R(3) * 0.15), ay = r * (0.06 + R(4) * 0.1), n1 = 1 + Math.floor(R(5) * 2), n2 = 1 + Math.floor(R(6) * 2);
    const pos = (tt) => [
      cx + ax * wave(tt, D, n1, R(7) * TAU) + 3 * loopNoise(tt / D, 1.2, i * 3 + S),
      cy + ay * wave(tt, D, n2, R(8) * TAU) + 2 * loopNoise(tt / D, 1.2, i * 3 + S + 1),
    ];
    const per = D / (2 + Math.floor(R(9) * 3)), v = (((t / per + R(10)) % 1) + 1) % 1;
    const g = v < 0.08 ? v / 0.08 : v < 0.18 ? 1 : v < 0.5 ? 1 - (v - 0.18) / 0.32 : 0;
    const [x, y] = pos(t);
    if (g <= 0.02) {
      p.dot(x, y, C[1], 0.6);
      continue;
    }
    if (g > 0.4)
      for (let j = 1; j <= 3; j++) {
        const [tx, ty] = pos(t - j * 0.07);
        p.dot(tx, ty, C[2], (g - 0.3) * (1 - j / 4) * 1.4);
      }
    p.px(x, y, g > 0.7 ? C[5] : g > 0.35 ? C[4] : C[3]);
    if (g > 0.6) p.dot(x, y + 1, C[2], 0.8);
    p.glow(x, y, 5 + 4 * g, C[3], 0.32 * g);
    if (g > 0.8) p.glow(x, y, 2.5, C[4], 0.3);
  }
}
