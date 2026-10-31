// Made for the GoodWatch explorer map: burst.
import { Particles, Lights, P, Rng, fit, seg, ease, clamp, TAU, WHITE, hex, mix, scale } from "../../core/index.js";

export const meta = {
  name: "Curtain swish",
  desc: "Put back, take two: a curtain-like swish of soft lit dust sweeps sideways across the point on a curved stroke, its edge catching the light, and sparkles settle out of it.",
  tags: ["cinema", "unpick", "one-shot"],
  size: [160, 100],
  origin: [80, 56],
  duration: 1.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#4a4858", "#6e6c80", "#9896a8", "#c4c2d2", "#ecebf4"], glints: ["#ffd24a", "#fff3c8"], seed: 5, s: 1 },
};

const SWEEP = 0.32; // the stroke draws across in this long

export function create(o) {
  const C = fit(o.palette, 5), G = fit(o.glints, 2), s = o.s ?? 1, R = new Rng(o.seed), dir = R.sign();
  const ps = new Particles({ rng: R });
  const lights = new Lights();
  // the stroke: a shallow arc from one side to the other, dipping through the point
  const X0 = -40 * s, X1 = 40 * s, along = (u) => [dir * (X0 + (X1 - X0) * u), -10 * s * Math.sin(Math.PI * u) * 1.0 + 8 * s * (u - 0.5) * (u - 0.5) * 4 - 2 * s];
  // puffs laid down along the stroke as it passes, carried on in the sweep's direction
  const puffs = [];
  for (let i = 0; i < 34; i++) {
    const u = i / 33 + R.range(-0.02, 0.02), [x, y] = along(clamp(u));
    puffs.push({ u, x: x + R.range(-2, 2) * s, y: y + R.range(-3, 4) * s, vx: dir * R.range(40, 85) * s, vy: R.range(-14, 4) * s, r0: R.range(3, 4.5) * s, r1: R.range(7.5, 11.5) * s,
      t0: SWEEP * ease.inOutSine(clamp(u)), life: R.range(0.7, 0.95) });
  }
  // sparkles shaken out of the dust: they drift down and twinkle out
  for (let i = 0; i < 12; i++) {
    const u = R.range(0.1, 1), [x, y] = along(u);
    ps.spawn(P.STAR, x, y + R.range(-4, 4) * s, dir * R.range(15, 45) * s, R.range(8, 26) * s, R.range(0.5, 0.75), R.chance(0.5) ? G[0] : G[1], R.chance(0.45) ? R.range(2, 3) : 0.8, SWEEP * u + R.range(0.05, 0.3));
  }
  for (let i = 0; i < 14; i++) {
    const u = R.range(0, 1), [x, y] = along(u);
    ps.spawn(P.FLAKE, x, y, dir * R.range(20, 60) * s, R.range(-20, 0) * s, R.range(0.6, 1.0), R.pick([C[3], C[4]]), R.chance(0.3) ? 1.5 : 1, SWEEP * u);
  }
  let t = 0, lit = false;
  return {
    update(dt) {
      t += dt;
      if (!lit) (lit = true), lights.add(0, 0, 40 * s, C[4], 0.3, 0.6);
      ps.update(dt);
      lights.update(dt);
      for (const q of puffs) {
        if (t < q.t0) continue;
        q.vx -= q.vx * 2.6 * dt;
        q.vy -= q.vy * 2.6 * dt + 5 * s * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
    },
    draw(p) {
      if (t < 0.08) {
        const [x, y] = along(0);
        p.circle(x, y, 3 * s * (1 - t / 0.08) + 0.5, WHITE);
        p.glow(x, y, 16 * s, C[4], 0.5);
      }
      // the dust body, soft and lit on top, thinning slowly
      for (const q of puffs) {
        const age = t - q.t0;
        if (age < 0 || age > q.life) continue;
        const u = age / q.life, r = q.r0 + (q.r1 - q.r0) * ease.outCubic(u), a = Math.min(1, age / 0.06) * Math.pow(1 - u, 1.3) * 0.55;
        p.disc(q.x, q.y, r, (d, ang) => (Math.sin(ang) > 0.35 || d > 0.85 ? C[1] : C[2]), (d) => a * (1 - d * d * 0.7));
        p.disc(q.x - dir * r * 0.2, q.y - r * 0.32, r * 0.58, u < 0.3 ? C[4] : C[3], (d) => a * 0.8 * (1 - d * 0.5));
      }
      // the swish: three curved strokes, the lead one bright, drawn on then wiped off from the tail
      const head = ease.outCubic(seg(t, 0, SWEEP * 1.1)), tail = ease.inOutSine(seg(t, 0.1, 0.62));
      for (let k = 0; k < 3; k++) {
        const off = (k - 1) * 4 * s, hk = head * (1 - k * 0.06), tk = Math.min(hk, tail * (1 + k * 0.08));
        if (hk - tk < 0.01) continue;
        for (let u = tk; u <= hk; u += 0.006) {
          const [x, y] = along(u), w = (u - tk) / Math.max(0.01, hk - tk);
          const c = k === 1 ? (w > 0.85 ? WHITE : w > 0.4 ? C[4] : C[3]) : w > 0.6 ? C[3] : C[2];
          const yy = y + off * (1 - Math.abs(u - 0.5)), al = (k === 1 ? 1 : 0.75) * (0.3 + 0.7 * w);
          p.dot(x, yy, c, al);
          if (k === 1 && w > 0.3) p.dot(x, yy + 1, w > 0.7 ? C[4] : C[3], al * 0.9);
        }
        if (k === 1 && head < 1) {
          const [x, y] = along(hk);
          p.glow(x, y, 9 * s, C[4], 0.45);
        }
      }
      if (t < SWEEP) {
        const [x, y] = along(head);
        p.glowLine(along(Math.max(0, head - 0.25))[0], along(Math.max(0, head - 0.25))[1], x, y, 6 * s, C[3], 0.2);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
