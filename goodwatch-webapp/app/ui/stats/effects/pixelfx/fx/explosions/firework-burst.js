// The flare, the twinkling crosses and the glitter are adapted from Sprite Fusion's open-source sparkle
// (https://www.spritefusion.com/pixel-art-vfx/sparkle), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, sparkle, ease, TAU, WHITE, hex, mix } from "../../core/index.js";

export const meta = {
  name: "Firework burst",
  desc: "A shell climbs, slows and bursts into a sphere of coloured trailing stars round a gold core; they droop, crackle into white pops and fade, leaving glitter.",
  tags: ["firework", "celebration", "sparkle", "sky", "burst", "one-shot"],
  size: [240, 248],
  origin: [120, 100],
  duration: 3.6,
  loop: false,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"],
    core: ["#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    seed: 9,
  },
};

const RISE = 0.42, Y0 = 72, DRAG = 2.6, G = 88, TRAIL = 0.34, TURN = 0.22;

export function create(o) {
  const C = fit(o.palette, 7), K = fit(o.core, 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [K[6], K[5], K[4], K[3]] }), lights = new Lights();
  const stars = [], pops = [];
  let t = 0, burst = false;

  // a shell of stars thrown over a sphere: seen side-on, the ones flying at us or away look slower
  // the outer stars burn gold for a beat, then turn to their color
  const shell = (n, speed, ramp, life, first) => {
    for (let i = 0; i < n; i++) {
      const z = R.range(-1, 1), a = R.range(0, TAU), s = Math.sqrt(1 - z * z), v = speed * R.range(0.93, 1.05);
      stars.push({ x: 0, y: 0, vx: Math.cos(a) * s * v, vy: Math.sin(a) * s * v, life: R.range(life[0], life[1]), age: 0, ramp, first, big: R.chance(0.2), pts: [], acc: R.next(), seed: R.range(0, 100) });
    }
  };

  return {
    update(dt) {
      t += dt;
      // the shell climbs, slowing, shedding a fizz of gold sparks
      if (t < RISE) {
        const y = Y0 * (1 - ease.outCubic(t / RISE));
        if (R.chance(50 * dt)) ps.spawn(P.SPARK, R.range(-0.5, 0.5), y + 2, R.range(-25, 25), R.range(20, 70), R.range(0.15, 0.35));
        if (R.chance(14 * dt)) ps.spawn(P.VAPOUR, R.range(-1, 1), y + 3, R.range(-3, 3), R.range(5, 15), R.range(0.5, 0.8), hex("#4a4458"), R.range(1.5, 2.5));
      }
      if (!burst && t >= RISE) {
        burst = true;
        lights.add(0, 0, 110, C[4], 0.6, 1.5);
        lights.add(0, 0, 30, WHITE, 0.5, 0.07);
        shell(66, 236, C, [1.35, 1.9], K);
        shell(26, 120, K, [1.0, 1.4], K);
        // the burst charge's smoke, drifting where the shell broke
        for (let i = 0; i < 7; i++) {
          const a = R.range(0, TAU), d = R.range(0, 8);
          ps.spawn(P.VAPOUR, Math.cos(a) * d, Math.sin(a) * d, Math.cos(a) * R.range(10, 30), Math.sin(a) * R.range(10, 30), R.range(2.2, 3), hex("#4a4458"), R.range(6, 11));
        }
        for (let i = 0; i < 24; i++) {
          const a = R.range(0, TAU), sp = R.range(40, 140);
          ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.15, 0.35));
        }
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.age += dt;
        const k = s.age / s.life;
        if (k >= 1) {
          // the star crackles out in a few white pops
          for (let j = 0; j < 2 + (s.big ? 1 : 0); j++) pops.push({ x: s.x + R.range(-3, 3), y: s.y + R.range(-3, 3), t0: t + R.range(0, 0.18), life: R.range(0.06, 0.12), c: R.chance(0.6) ? WHITE : s.ramp[5] });
          stars.splice(i, 1);
          continue;
        }
        s.vx -= s.vx * DRAG * dt;
        s.vy -= s.vy * DRAG * dt - G * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.pts.push(s.x, s.y, t);
        while (s.pts.length > 3 && t - s.pts[2] > TRAIL) s.pts.splice(0, 3);
        // glitter shed along the way: specks that hang, twinkle and fall
        for (s.acc += dt * (k < 0.25 ? 4 : 11); s.acc > 1; s.acc--) ps.spawn(P.STAR, s.x, s.y, s.vx * 0.15 + R.range(-6, 6), s.vy * 0.15 + R.range(0, 10), R.range(0.35, 0.8), R.chance(0.5) ? K[5] : WHITE, R.chance(0.15) ? R.range(1, 1.6) : 0.5);
      }
      for (let i = pops.length - 1; i >= 0; i--) if (t > pops[i].t0 + pops[i].life) pops.splice(i, 1);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      ps.draw(p, "back");
    },
    draw(p) {
      if (t < RISE) {
        // the shell: a hot dot with a short tail
        const u = t / RISE, y = Y0 * (1 - ease.outCubic(u));
        p.line(0, y, 0, y + 3 + 6 * (1 - u), (q) => (q < 0.3 ? K[5] : K[3]));
        p.px(0, y, WHITE);
        p.glow(0, y, 7, K[4], 0.5);
      }
      for (const s of stars) {
        const k = s.age / s.life, P2 = s.pts, n = P2.length / 3;
        // the trail: a 1 px line from the head back along where it has been, cooling and dithering out; the part
        // laid while the star burned gold stays gold
        for (let j = n - 1; j > 0; j--) {
          const u = (t - P2[j * 3 + 2]) / TRAIL;
          if (u >= 1) break;
          const ramp = s.age - (t - P2[j * 3 + 2]) < TURN ? s.first : s.ramp;
          const c = u < 0.3 ? ramp[5] : u < 0.6 ? ramp[4] : ramp[3];
          p.line(P2[j * 3], P2[j * 3 + 1], P2[j * 3 - 3], P2[j * 3 - 2], c, Math.pow(1 - u, 0.8) * (1.3 - k * 0.6));
        }
        // the head: white-hot, then its color; late on it flickers before it crackles out
        if (k > 0.72 && Math.sin(t * 60 + s.seed) < -0.2) continue;
        // white only on the burst frame; the glow comes in as the stars spread, so the heart never blooms into a blob
        const ramp = s.age < TURN ? s.first : s.ramp, head = s.age < 0.04 ? WHITE : k < 0.55 ? ramp[s.age < TURN ? 5 : 6] : ramp[5];
        p.px(s.x, s.y, head);
        if (s.big && k < 0.6 && s.age > 0.06) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(s.x + dx, s.y + dy, ramp[5]);
        p.glow(s.x, s.y, s.big ? 7 : 5, ramp[4], (s.big ? 0.7 : 0.5) * (1 - k * 0.6) * Math.min(1, s.age / 0.2));
      }
      for (const q of pops) {
        const u = (t - q.t0) / q.life;
        if (u < 0 || u > 1) continue;
        sparkle(p, q.x, q.y, 2.6 * Math.sin(Math.PI * u), q.c, mix(q.c, C[3], 0.5), 0.5);
      }
      // the burst: a flare and a white heart, the sky lit up behind it
      const b = t - RISE;
      if (b >= 0 && b < 0.28) {
        const u = b / 0.28, L = 32 * Math.pow(1 - u, 1.3);
        flareRays(p, 0, 0, L, u * 0.6, C, K);
        if (b < 0.07) p.circle(0, 0, 2.6 - b * 20, WHITE);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// an 8-ray flare: long rays on the axes with a white core and tinted ends, short gold diagonals, turning slowly
function flareRays(p, x, y, L, ang, C, K) {
  if (L < 1) return;
  for (let i = 0; i < 8; i++) {
    const diag = i % 2 === 1, an = ang + (i * TAU) / 8, len = diag ? L * 0.42 : L, ca = Math.cos(an), sa = Math.sin(an);
    for (let d = 0; d <= len; d += 0.5) {
      const u = d / len;
      p.dot(x + ca * d, y + sa * d, diag ? (u < 0.5 ? K[5] : K[4]) : u < 0.3 ? WHITE : u < 0.65 ? C[5] : C[4], u < 0.7 ? 1 : 1 - (u - 0.7) / 0.35);
    }
  }
  p.glow(x, y, 4 + L * 1.2, C[4], 0.3);
  p.glow(x, y, 2 + L * 0.3, WHITE, 0.25);
}
