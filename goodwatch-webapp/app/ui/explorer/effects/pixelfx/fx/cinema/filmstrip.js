// Made for the GoodWatch explorer map: burst.
import { Particles, Lights, P, Rng, fit, flare, sparkle, seg, ease, clamp, TAU, WHITE, hex, mix, scale } from "../../core/index.js";

export const meta = {
  name: "Film strip unspool",
  desc: "A white flash, a wide film strip with sprocket holes and tiny lit frames unspools on a spiral around the point, sparks and glints fly, then it whips away along its curve.",
  tags: ["cinema", "combine", "celebration", "one-shot"],
  size: [212, 180],
  origin: [106, 90],
  duration: 1.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#3a2408", "#7a4e14", "#c8862a", "#ffcf6a", "#fff6dc"], sky: ["#2a3a6a", "#5a7ac8", "#a8c8ff"], seed: 7, s: 1 },
};

const HOLE = hex("#140f1a");

export function create(o) {
  const C = fit(o.palette, 5), K = fit(o.sky, 3), s = o.s ?? 1, R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [WHITE, C[4], C[3], C[2]] });
  const lights = new Lights();
  lights.add(0, 0, 70 * s, C[3], 0.6, 0.6);
  lights.add(0, 0, 24 * s, WHITE, 0.9, 0.1);
  for (let i = 0; i < 34; i++) {
    const an = R.range(0, TAU), sp = R.range(130, 270) * s;
    ps.spawn(P.SPARK, 0, 0, Math.cos(an) * sp, Math.sin(an) * sp - 40, R.range(0.22, 0.5), C[3], 1, R.range(0, 0.05));
  }
  for (let i = 0; i < 9; i++) {
    const an = R.range(0, TAU), d = R.range(22, 55) * s;
    ps.spawn(P.STAR, Math.cos(an) * d, Math.sin(an) * d * 0.86, 0, R.range(-4, 4), R.range(0.45, 0.8), C[4], R.chance(0.5) ? R.range(2, 3.5) : 0.8, R.range(0.15, 0.9));
  }
  // per-frame picture: a sun that moves frame to frame, a horizon that tilts a little
  const pics = [];
  for (let i = 0; i < 60; i++) pics.push({ sx: ((i * 0.37) % 1) * 0.8 + 0.1, hz: R.range(-0.4, 0.4), warm: R.chance(0.35) });

  const b = 5.2 * s, r0 = 6 * s, Lmax = 270 * s, W = 4.5 * s, F = 9 * s;
  // the spiral by arc length: precomputed points (x, y, nx, ny, lit)
  const pts = [];
  {
    let th = 0, u = 0;
    const step = 0.5;
    while (u < Lmax + 640 * s) {
      const r = r0 + b * th;
      pts.push([th, r]);
      th += step / Math.hypot(b, r);
      u += step;
    }
  }
  let t = 0, hx = 0, hy = 0, acc = 0;
  return {
    update(dt) {
      t += dt;
      // the strip sheds sparks where it leaves: the point on the spiral at the fade radius, while it slides through it
      const whip = ease.inCubic(seg(t, 0.9, 1.4));
      if (whip > 0.02 && t < 1.28) {
        const ang = Math.atan2(hy / 0.86, hx);
        for (acc += dt * 90; acc > 1; acc--) {
          const sp = R.range(110, 190) * s, k = R.range(0.6, 1.1);
          ps.spawn(P.MOTE, hx, hy, (-Math.sin(ang) * k + Math.cos(ang) * 0.5) * sp, (Math.cos(ang) * k + Math.sin(ang) * 0.5) * sp * 0.86, R.range(0.18, 0.32), R.chance(0.4) ? C[4] : C[3], 1);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      if (t < 0.06) {
        p.circle(0, 0, 8 * s * (1 - t / 0.12), WHITE);
        p.glow(0, 0, 40 * s, C[4], 0.8);
      }
      if (t < 0.2) flare(p, 0, 0, 26 * s * (1 - t / 0.2), 0.6, [C[1], C[2], C[3]]);
      const ru = seg(t, 0, 0.35);
      if (ru < 1) {
        p.ring(0, 0, (6 + 50 * ease.outQuart(ru)) * s, Math.max(1, 3 * (1 - ru)) * s, (v) => (v > 0.5 ? C[4] : C[3]), 1 - ru);
        p.glowRing(0, 0, (6 + 50 * ease.outQuart(ru)) * s, 6 * s, C[3], 0.3 * (1 - ru));
      }
      p.glow(0, 0, 60 * s, C[2], 0.25 * (1 - seg(t, 0, 1.2)));

      // the strip occupies [u0, u1] of the spiral; it unspools, holds, then slides out along the curve and away
      const grow = ease.outQuart(seg(t, 0.02, 0.75)), whip = ease.inCubic(seg(t, 0.9, 1.4));
      const shift = whip * 620 * s, u1 = Lmax * grow + shift, u0 = shift;
      const spin = t * 1.6 + whip * 2.4, rFade = 54 * s;
      const i0 = Math.floor(u0 / 0.5), i1 = Math.min(pts.length - 1, Math.floor(u1 / 0.5));
      let tipX = 0, tipY = 0;
      for (let i = i0; i <= i1; i++) {
        const [th, r] = pts[i], u = i * 0.5, ang = th + spin;
        const x = Math.cos(ang) * r, y = Math.sin(ang) * r * 0.86;
        const a = clamp((rFade + 16 * s - r) / (16 * s)) * clamp((u - u0) / (6 * s) + 0.15);
        if (a <= 0) continue;
        if (i === i1) (tipX = x), (tipY = y);
        if (a > 0.6) (hx = x), (hy = y);
        const nx = Math.cos(ang), ny = Math.sin(ang) * 0.86, nn = Math.hypot(nx, ny);
        const ux = nx / nn, uy = ny / nn, lit = -(ux + uy) / 1.414; // outward normal facing the top left
        const fi = Math.floor(u / F), fu = (u % F) / F, pic = pics[fi % pics.length];
        const hole = (u % (3 * s)) < 1.6 * s;
        for (let d = -W; d <= W; d += 0.5) {
          const ad = Math.abs(d);
          let c;
          const H = W - 2.4 * s; // the picture area inside the sprocket rows
          if (ad > W - 0.75) c = d > 0 ? (lit > -0.2 ? C[4] : C[3]) : lit > 0.2 ? C[3] : C[1];
          else if (ad > H) c = hole && ad > H + 0.5 ? HOLE : ad <= H + 0.5 ? C[1] : lit > 0.1 ? C[3] : C[2];
          else if (fu < 0.13) c = C[0];
          else {
            // a tiny picture: sky above a horizon, ground below, a sun that moves frame to frame
            const v = d / H, hz = pic.hz + (fu - 0.5) * 0.3;
            const sun = Math.abs(fu - pic.sx) < 0.14 && v > -0.85 && v < -0.2;
            c = sun ? (pic.warm ? C[4] : WHITE) : v < hz ? (v < -0.5 ? K[1] : K[2]) : v < hz + 0.35 ? C[2] : C[1];
            if (pic.warm && !sun && v < hz) c = v < -0.5 ? C[2] : C[3];
          }
          p.dot(x + ux * d, y + uy * d, c, a);
        }
        if ((i & 15) === 0 && lit > 0) p.light(x, y, C[3], 0.3 * a);
      }
      // a glint where the strip leaves, while it whips through
      if (whip > 0.02 && t < 1.38) sparkle(p, hx, hy, 2 + 3 * Math.sin(Math.PI * seg(t, 0.9, 1.38)), C[4], C[3], 0.6);
      // a glint riding the head of the strip while it unspools
      if (t > 0.04 && t < 0.8) {
        sparkle(p, tipX, tipY, 3 * (1 - seg(t, 0.5, 0.8)) + 1, C[4], C[3], 0.5);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
