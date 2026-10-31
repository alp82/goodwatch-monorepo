import { Particles, Lights, P, PF, Rng, clamp, seg, ease, TAU, WHITE, hex, fit, flare } from "../../core/index.js";
import { poster } from "./_pun2.js";

export const meta = {
  name: "Poster blast",
  desc: "A white flash over the poster, a fireball that balloons and rolls up into smoke, a shock ring racing out and hot sparks flung wide; the smoke thins and clears.",
  tags: ["cinema", "pun", "explosion", "war", "bomb", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#4a1712", "#c9281f", "#ff8a2a", "#ffe26b", "#fff3a6", "#ffffff"], seed: 1, w: 40, h: 60 },
};

export function create(o) {
  const { w, h, k } = poster(o), R = new Rng(o.seed), C = fit(o.palette, 6).map(hex), sk = Math.sqrt(k);
  const ps = new Particles({ rng: R, sparks: ["#ffffff", "#fff3a6", "#ffc23d", "#ff8a2a"] }), lights = new Lights();
  const cy = h * 0.05;
  lights.add(0, cy, 40 * sk, WHITE, 0.6, 0.12);
  lights.add(0, cy, 60 * sk, C[2], 0.45, 0.9);
  // the fireball: a cluster of flame puffs pushed out and up, some leaving smoke
  for (let i = 0; i < Math.round(30 * k); i++) {
    const a = R.range(0, TAU), sp = R.range(25, 85) * sk;
    ps.spawn(P.FIRE, R.range(-3, 3) * sk, cy + R.range(-3, 3) * sk, Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 22 * k, R.range(0.45, 0.9), 0, R.range(3.5, 6.5) * sk, R.range(0, 0.1), R.next() < 0.45 ? PF.SMOKES : 0);
  }
  for (let i = 0; i < Math.round(26 * sk); i++) {
    const a = R.range(0, TAU), sp = R.range(90, 190) * sk;
    ps.spawn(P.SPARK, 0, cy, Math.cos(a) * sp * 0.7, Math.sin(a) * sp * 0.6 - 30, R.range(0.15, 0.35));
  }
  for (let i = 0; i < Math.round(8 * sk); i++) {
    const a = R.range(0, TAU), sp = R.range(30, 60) * sk;
    ps.spawn(P.EMBER, R.range(-6, 6) * sk, cy, Math.cos(a) * sp, -R.range(20, 50), R.range(0.6, 1.1), C[2], 1, R.range(0.1, 0.4));
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      if (t < 0.06) {
        p.circle(0, cy, 9 * sk, WHITE);
        flare(p, 0, cy, 20 * sk, 0.5, ["#4a1712", "#ff8a2a", "#fff3a6", "#ffffff"]);
      }
      // the shock ring
      const u = seg(t, 0.02, 0.4);
      if (u > 0 && u < 1) {
        const r = 4 + ease.outQuart(u) * Math.min(w * 0.58, 36 * sk);
        p.ring(0, cy, r, 1.5, u < 0.3 ? WHITE : C[4], 1 - u);
        p.glowRing(0, cy, r, 3, C[3], 0.35 * (1 - u));
      }
      lights.draw(p);
      ps.draw(p);
    },
  };
}
