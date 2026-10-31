// Made for the GoodWatch explorer map: title pun.
// A swamp burps under a poster: murky green bubbles well up along its bottom edge, swell and pop with little splats,
// mud drips off the edge, low marsh haze drifts by, and a few fireflies blink up out of it.
import { rng, burst, fly, seg, ease, clamp, TAU, WHITE, hex, fit } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: swamp",
  desc: "Murky green bubbles well up along the poster's bottom, swell and pop with little splats, mud drips off the edge, marsh haze drifts and a few fireflies blink up.",
  tags: ["cinema", "pun", "swamp", "bog", "ogre", "one-shot"],
  size: [128, 128],
  origin: [64, 56],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0c140a", "#1c2a12", "#2e4418", "#4a6420", "#6e8a2c", "#a2b84a", "#d8e88a"],
    mud: ["#140f08", "#2a2010", "#46381c", "#64522a"],
    fly: ["#8a7a10", "#ffe040", "#fffcd0"],
    seed: 1, w: 40, h: 60,
  },
};

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), M = o.mud.map(hex), F = o.fly.map(hex), { hw, hh, s } = dims(o);
  const k = clamp(s, 0.6, 3.5), sk = Math.sqrt(k), G = hh - 1;
  const env = ease.outCubic(seg(t, 0, 0.3)) * (1 - seg(t, 2.0, 2.7));

  // the murk: a band of bog along the bottom edge, its surface a lit wavy line
  if (env > 0) {
    const depth = (3 + 3 * sk) * env;
    for (let x = Math.floor(-hw); x < hw; x++) {
      const e = Math.min(1, (hw - Math.abs(x + 0.5)) / (4 * sk));
      const wv = Math.sin(x * 0.4 + t * 3) * 0.6 + Math.sin(x * 0.17 - t * 2) * 0.5;
      const top = G - depth * e + wv * env;
      for (let y = Math.ceil(top); y <= G + 1; y++) p.blend(x, y, y < top + 1.5 ? C[3] : y > G - 0.5 ? M[1] : C[2], 0.7 * env);
      p.px(x, Math.round(top), (x * 7 + Math.round(t * 10)) % 9 === 0 ? C[5] : C[3]);
    }
    p.glowLine(-hw, G - depth, hw, G - depth, 6 * sk, C[4], 0.22 * env);
    // marsh haze drifting over it
    burst(Math.round(3 + 2 * k), o.seed + 5, (r) => {
      const x = r.range(-hw, hw) + (t - 1) * r.range(-8, 8) * sk, y = G - depth - r.range(1, 5) * sk, R = r.range(3, 6) * sk;
      p.disc(x, y, R, (q, g) => (Math.sin(g) < -0.3 && q > 0.5 ? C[4] : C[3]), (q) => 0.13 * env * (1 - q * q));
    });
  }

  // bubbles: well up, swell, wobble, pop
  const n = Math.round(4 + 3.5 * k);
  burst(n, o.seed + 1, (r) => {
    const x = r.range(-hw * 0.9, hw * 0.9), b = r.range(0.05, 1.3), grow = r.range(0.35, 0.7), Rm = r.range(2.2, 4.6) * Math.pow(k, 0.8);
    const lift = r.next() < 0.3 ? r.range(4, 9) * sk : 0, age = t - b;
    if (age < 0) return;
    if (age < grow) {
      const u = age / grow, R = Rm * ease.outCubic(u);
      const wob = 1 + Math.sin(age * 30) * 0.08 * u;
      const cy = G - 1 - R * 0.6 - lift * u * u, rx = R * wob, ry = R / wob;
      // translucent skin, a dark lower rim, a lit upper rim, a bright highlight
      p.ellipse(x, cy, rx, ry, C[2], 0.55);
      for (let j = 0, m = Math.ceil(TAU * R * 1.6); j < m; j++) {
        const g = (j / m) * TAU, ex = x + Math.cos(g) * rx, ey = cy + Math.sin(g) * ry;
        const up = -Math.sin(g) - Math.cos(g) * 0.4;
        p.px(ex, ey, up > 0.7 ? C[5] : up > 0 ? C[4] : up > -0.6 ? C[3] : C[2]);
      }
      if (R > 1.6) { p.px(x - rx * 0.45, cy - ry * 0.45, C[6]); if (R > 3) p.px(x - rx * 0.45 + 1, cy - ry * 0.55, C[6]); }
      p.light(x, cy, C[4], 0.12 * u);
      return;
    }
    // the pop: a white ring flash, a splat of droplets, a little ring on the murk
    const pa = age - grow, cy = G - 1 - Rm * 0.6 - lift;
    if (pa < 0.07) {
      p.ring(x, cy, Rm + 1 + pa * 30, 1, C[6]);
      p.glow(x, cy, Rm * 4, C[5], 0.5 * (1 - pa / 0.07));
    }
    if (pa < 0.6) {
      burst(3 + Math.round(Rm * 0.6), r.int(0, 1e6), (q) => {
        const a = -Math.PI / 2 + q.range(-1.3, 1.3), sp = q.range(40, 85) * sk;
        const [dx, dy] = fly(x, cy, Math.cos(a) * sp, Math.sin(a) * sp, pa, 380 * sk);
        if (dy > G + 0.5) return;
        const [px0, py0] = fly(x, cy, Math.cos(a) * sp, Math.sin(a) * sp, Math.max(0, pa - 0.02), 380 * sk);
        const mud = q.next() < 0.5;
        p.line(px0, py0, dx, dy, mud ? M[3] : C[3], 1 - pa / 0.6);
        p.px(dx, dy, mud ? M[3] : C[5]);
      });
      const ra = seg(pa, 0, 0.5);
      if (ra < 1) {
        const rx = Rm + ra * 7 * sk, c = ra < 0.5 ? C[5] : C[4];
        for (const sgn of [-1, 1]) { p.px(x + sgn * rx, G - 2, c); p.px(x + sgn * (rx - 1), G - 2, c); }
      }
    }
  });

  // mud drips off the bottom edge: hang, stretch, let go
  burst(Math.max(1, Math.round(1 + k * 0.7)), o.seed + 3, (r) => {
    const x = r.range(-hw * 0.7, hw * 0.7), b = r.range(0.2, 0.7), hang = r.range(0.6, 0.9), age = t - b;
    if (age < 0) return;
    const L = (5 + 6 * sk) * ease.inQuad(clamp(age / hang)), bead = 1.4 * sk + 0.6;
    if (age < hang) {
      for (let y = 0; y < L; y++) {
        const wd = Math.max(0, (1 - y / (L + 1)) * 1.8 * sk + 0.3);
        for (let dx = -Math.floor(wd); dx <= Math.floor(wd); dx++) p.px(x + dx, G + 1 + y, dx < 0 ? M[3] : M[2]);
      }
      p.circle(x, G + 1 + L, bead, M[2]);
      p.px(x - bead * 0.4, G + 1 + L - bead * 0.3, C[5]);
      return;
    }
    const ft = age - hang, y = G + 1 + L + 0.5 * 300 * sk * ft * ft, a = 1 - seg(ft, 0.2, 0.45);
    if (a > 0) { p.line(x, y - 2 * sk, x, y, M[2], a); p.circle(x, y, bead * 0.8, M[2], a); p.dot(x, y - 1, C[5], a); }
    // what's left on the edge shrinks back
    const back = 1 - seg(ft, 0, 0.3);
    if (back > 0) for (let yy = 0; yy < L * 0.5 * back; yy++) p.px(x, G + 1 + yy, M[2]);
  });

  // fireflies: rise out of the murk, wander, blink
  burst(Math.round(3 + k), o.seed + 7, (r) => {
    const b = r.range(0.4, 1.2), life = r.range(1.1, 1.5), age = t - b;
    if (age < 0 || age > life) return;
    const u = age / life, x = r.range(-hw * 0.8, hw * 0.8) + Math.sin(age * r.range(2, 4) + b * 5) * 4 * sk;
    const y = G - 3 - u * hh * r.range(0.5, 0.9) + Math.sin(age * 6 + b) * 1.5;
    const blink = Math.max(0, Math.sin(age * r.range(5, 8) + r.range(0, TAU))) * Math.sin(Math.PI * u);
    p.px(x, y, blink > 0.5 ? F[2] : F[0]);
    if (blink > 0.3) { p.px(x + 1, y, F[1]); p.px(x - 1, y, F[1]); p.px(x, y - 1, F[1]); p.px(x, y + 1, F[1]); }
    p.glow(x, y, (5 + 4 * blink) * sk, F[1], 0.7 * blink);
  });
}
