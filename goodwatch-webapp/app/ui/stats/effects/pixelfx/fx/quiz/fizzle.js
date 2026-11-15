// Made for the GoodWatch stats page quiz: a dud: a wrong answer's little fizzle.
import { Particles, P, Rng, fit, ease } from "../../core/index.js";

export const meta = {
  name: "Fizzle",
  desc: "A dud fuse: a weak pop, a few dull sparks that spit up, droop and die, and a small gray smoke curl that lifts and thins.",
  tags: ["ui", "fail", "miss", "smoke", "dud", "one-shot"],
  size: [56, 48],
  origin: [28, 36],
  duration: 0.95,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    sparks: ["#c8b894", "#948670", "#665e52", "#423d38"],
    smoke: ["#8c8794", "#5e5a66"],
    seed: 5,
  },
};

export function create(o) {
  const S = fit(o.sparks, 4), M = fit(o.smoke, 2), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: S, ground: () => 6 });
  // a weak spit: few sparks, slow, in a narrow cone that leans to one side
  const lean = R.range(-0.35, 0.35);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + lean + R.range(-0.75, 0.75), sp = R.range(45, 85);
    ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.22, 0.42), 0, 1, R.range(0, 0.08));
  }
  // the curl: three puffs that rise and drift, the last one a beat late
  for (let i = 0; i < 3; i++) {
    ps.spawn(P.SMOKE, R.range(-2, 2), -2 - i * 2, R.range(-8, 8) + lean * 14, -R.range(22, 32), R.range(0.6, 0.85), i === 2 ? M[1] : M[0], R.range(2.6, 3.6) - i * 0.4, 0.06 + i * 0.09);
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
    },
    drawBack(p) {
      ps.draw(p, "back");
    },
    draw(p) {
      // the pop: a small dim disc that shrinks, never white-hot
      if (t < 0.12) {
        const k = t / 0.12, r = 3.2 * (1 - ease.inQuad(k));
        p.disc(0, -1, r, S[1], 0.85 * (1 - k));
        if (k < 0.4) p.px(0, -1, S[0]);
        p.glow(0, -1, 7, S[1], 0.22 * (1 - k));
      }
      ps.draw(p, "front");
    },
  };
}
