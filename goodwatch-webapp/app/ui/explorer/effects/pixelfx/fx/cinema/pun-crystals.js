import { Particles, Lights, P, Rng, clamp, TAU, WHITE, hex, fit, scale, flare } from "../../core/index.js";
import { poster } from "./_pun2.js";

export const meta = {
  name: "Crystal burst",
  desc: "A white crack of light, then faceted blue crystal shards burst out of the poster, tumbling and catching glints as they turn, arc over and fall away fading.",
  tags: ["cinema", "pun", "crystal", "diamond", "shards", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 1.9,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#06162a", "#0e3a66", "#1a6aa8", "#2fa0e0", "#6cd6ff", "#c4f2ff", "#ffffff"], seed: 1, w: 40, h: 60 },
};

export function create(o) {
  const { w, h, k } = poster(o), R = new Rng(o.seed), C = fit(o.palette, 7).map(hex);
  const ps = new Particles({ rng: R, sparks: ["#ffffff", "#c4f2ff", "#6cd6ff", "#2fa0e0"] }), lights = new Lights();
  const n = Math.round(clamp(11 * k, 9, 30)), shards = [], floor = h * 0.5 + h * 0.15;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + R.range(-1.5, 1.5), sp = R.range(60, 150) * Math.pow(k, 0.7);
    shards.push({ x: R.range(-0.15, 0.15) * w, y: R.range(-0.15, 0.1) * h, vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp,
      ang: R.range(0, TAU), va: R.range(-9, 9), L: R.range(3.2, 5.5) * Math.sqrt(k), W: R.range(1.6, 2.8) * Math.sqrt(k),
      end: R.range(1.2, 1.8), glint: R.range(0, TAU) });
  }
  lights.add(0, 0, 30 * k, WHITE, 0.6, 0.14);
  lights.add(0, 0, 44 * k, C[3], 0.4, 0.6);
  for (let i = 0; i < 10; i++) {
    const a = R.range(0, TAU), sp = R.range(50, 120) * Math.sqrt(k);
    ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.1, 0.22));
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
      for (const s of shards) {
        s.vx -= s.vx * 2.2 * dt;
        s.vy += (220 - s.vy * 2.2) * dt;
        s.x += s.vx * dt;
        s.y = Math.min(floor, s.y + s.vy * dt);
        s.ang += s.va * dt;
        s.va -= s.va * 0.8 * dt;
      }
    },
    draw(p) {
      if (t < 0.08) flare(p, 0, 0, 12 * k * (0.5 + t * 8), 0.5, ["#0e3a66", "#6cd6ff", "#c4f2ff", "#ffffff"]);
      lights.draw(p);
      for (const s of shards) {
        const a = clamp((s.end - t) / 0.35);
        if (a <= 0) continue;
        const ca = Math.cos(s.ang), sa = Math.sin(s.ang), r = Math.ceil(s.L) + 1;
        // a glint when the face turns to the light
        const gl = Math.cos(s.ang * 2 + s.glint) > 0.85;
        p.shade(s.x - r, s.y - r, s.x + r, s.y + r, (px, py, out) => {
          const dx = px - s.x, dy = py - s.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
          const d = Math.abs(u) / s.L + Math.abs(v) / s.W;
          if (d > 1) return;
          out.a = a;
          if (d > 0.72) return v < 0 ? C[4] : C[1];
          if (gl && Math.abs(v) < 0.6) return WHITE;
          return v < 0 ? (u < 0 ? C[5] : C[4]) : u < 0 ? C[3] : C[2];
        });
        p.light(s.x, s.y, C[4], (gl ? 0.5 : 0.18) * a);
        if (gl) p.glow(s.x, s.y, 4, C[5], 0.3 * a);
      }
      ps.draw(p);
    },
  };
}
