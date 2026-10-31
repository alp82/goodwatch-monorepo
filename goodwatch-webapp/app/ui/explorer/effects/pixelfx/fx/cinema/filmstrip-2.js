// Made for the GoodWatch explorer map: burst.
import { Particles, Lights, P, Rng, fit, flare, sparkle, seg, ease, clamp, TAU, WHITE, hex, mix, scale } from "../../core/index.js";

export const meta = {
  name: "Marquee burst",
  desc: "A combination rises: a flash, a gold marquee ring draws round the point, its bulbs blink on in a chase, flash together and burst into sparks and glints.",
  tags: ["cinema", "combine", "celebration", "one-shot"],
  size: [196, 192],
  origin: [98, 94],
  duration: 1.45,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#3a2408", "#7a4e14", "#c8862a", "#ffcf6a", "#fff6dc"], seed: 11, s: 1 },
};

const N = 16, RAD = 36, POP = 0.76;
const SOCKET = hex("#1c1622");

export function create(o) {
  const C = fit(o.palette, 5), s = o.s ?? 1, R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [WHITE, C[4], C[3], C[2]] });
  const lights = new Lights();
  lights.add(0, 0, 50 * s, C[3], 0.6, 0.45);
  lights.add(0, 0, 18 * s, WHITE, 0.8, 0.08);
  const bulbs = [];
  for (let i = 0; i < N; i++) {
    const an = -Math.PI / 2 + (i / N) * TAU;
    bulbs.push({ an, x: Math.cos(an) * RAD * s, y: Math.sin(an) * RAD * s, on: 0.08 + (i / N) * 0.3, ph: R.range(0, TAU) });
  }
  let t = 0, popped = false;
  return {
    update(dt) {
      t += dt;
      if (!popped && t >= POP) {
        popped = true;
        lights.add(0, 0, 80 * s, C[3], 0.7, 0.5);
        lights.add(0, 0, 40 * s, WHITE, 0.6, 0.1);
        for (const b of bulbs) {
          lights.add(b.x, b.y, 12 * s, C[4], 0.6, 0.25);
          for (let k = 0; k < 4; k++) {
            const an = b.an + R.range(-0.5, 0.5), sp = R.range(100, 200) * s;
            ps.spawn(P.SPARK, b.x, b.y, Math.cos(an) * sp, Math.sin(an) * sp - 30, R.range(0.18, 0.36), C[3]);
          }
          const an = b.an + R.range(-0.2, 0.2), sp = R.range(60, 120) * s;
          ps.spawn(P.MOTE, b.x, b.y, Math.cos(an) * sp, Math.sin(an) * sp, R.range(0.3, 0.5), C[4], 1);
          if (R.chance(0.45)) ps.spawn(P.STAR, b.x + Math.cos(b.an) * 10 * s, b.y + Math.sin(b.an) * 10 * s, Math.cos(b.an) * 12, Math.sin(b.an) * 12 + 6, R.range(0.4, 0.65), C[4], R.range(1.5, 3), R.range(0.05, 0.2));
          ps.spawn(P.EMBER, b.x, b.y, Math.cos(b.an) * R.range(30, 70) * s, Math.sin(b.an) * R.range(30, 70) * s, R.range(0.35, 0.55), C[3], 1);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // the rise: a flash and a small flare at the point
      if (t < 0.06) {
        p.circle(0, 0, 6 * s * (1 - t / 0.12), WHITE);
        p.glow(0, 0, 30 * s, C[4], 0.7);
      }
      if (t < 0.16) flare(p, 0, 0, 16 * s * (1 - t / 0.16), 0.6, [C[1], C[2], C[3]]);
      // the marquee: a gold double ring drawn on round the bulbs, gone when they burst
      const draw = ease.outCubic(seg(t, 0.02, 0.4)), fa = t < POP ? 1 : clamp(1 - (t - POP) / 0.12);
      if (draw > 0 && fa > 0) {
        const span = draw * TAU;
        for (const [rr, c] of [[RAD + 5, C[2]], [RAD - 5, C[1]]]) {
          for (let a = 0; a < span; a += 0.7 / (rr * s)) {
            const an = -Math.PI / 2 + a, lit = -(Math.cos(an) + Math.sin(an)) / 1.414;
            p.dot(Math.cos(an) * rr * s, Math.sin(an) * rr * s, lit > 0.3 ? C[3] : c, fa);
          }
        }
        if (draw < 1) {
          const an = -Math.PI / 2 + span;
          sparkle(p, Math.cos(an) * (RAD + 5) * s, Math.sin(an) * (RAD + 5) * s, 2, C[4], C[3], 0.5);
        }
        p.glowRing(0, 0, RAD * s, 7 * s, C[2], 0.12 * fa * draw);
      }
      // the bulbs: a socket, then a lit glass bulb; a chase after they're all on, all flash white before bursting
      for (let i = 0; i < N; i++) {
        const b = bulbs[i];
        if (t < b.on - 0.06 || t > POP + 0.12) continue;
        const pre = t >= POP - 0.12, burst = t >= POP;
        const chase = t > 0.42 && !pre ? ((Math.floor(t * 16) + i) % 3 === 0 ? 0.2 : 1) : 1;
        const on = t >= b.on, rr = (burst ? 4.2 * (1 - (t - POP) / 0.12) : 3) * s;
        p.circle(b.x, b.y, 3.8 * s, SOCKET, fa);
        p.px(b.x - 1 * s, b.y + 3 * s, C[1]);
        if (!on) continue;
        const k = chase * (t - b.on < 0.05 ? 1.4 : 1);
        const hot = pre || t - b.on < 0.05;
        p.circle(b.x, b.y, rr, (d, an) => {
          if (hot) return d < 0.6 ? WHITE : C[4];
          const top = Math.sin(an) < -0.3 || Math.cos(an) < -0.5;
          if (k <= 0.5) return top ? C[2] : C[1];
          return d < 0.4 && top ? WHITE : top ? C[4] : d > 0.75 ? C[2] : C[3];
        });
        if (k > 0.5) p.glow(b.x, b.y, (hot ? 12 : 9) * s, C[3], (hot ? 0.65 : 0.45) * Math.min(1, k));
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
