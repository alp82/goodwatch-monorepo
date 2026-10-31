// Made for the GoodWatch explorer map: title pun.
// Jet flyby: two small swept-wing jets streak diagonally up across the poster with afterburners lit, white
// contrails from their wingtips puff out, widen and drift into translucent cloud, a vapour-cone ring pops around
// the lead jet, the sun glints off each canopy.
import { Rng, clamp, seg, ease, WHITE, hex, fit, mix, sparkle, noise } from "../../core/index.js";
import { poster } from "./_pun2.js";
import { preview } from "./_pun1.js";

export const meta = {
  name: "Pun: jet flyby",
  desc: "Two small jets streak diagonally up across the poster; white contrails puff out, widen and drift into translucent cloud; a sonic-boom ring and canopy glints.",
  tags: ["cinema", "pun", "jets", "aviation", "contrail", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.5,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1c2232", "#3a4458", "#6c788f", "#a9b4c8", "#dde4f0", "#ffffff"],
    trail: ["#5b6d8c", "#a8b8d4", "#e6eefc"],
    seed: 1, w: 40, h: 60,
  },
};

const CANOPY = hex("#2a6ea8"), CANOPY_HI = hex("#9fe0ff"), BURN = ["#ff7a2a", "#ffc23d", "#fff3a6"].map(hex);
const FLY = [0.1, 0.78], LAG = 0.09, LIFE = 1.45;

export function create(o) {
  const { w, h, k } = poster(o), hw = w / 2, hh = h / 2, sk = Math.sqrt(k), R = new Rng(o.seed);
  const C = fit(o.palette, 6), T = fit(o.trail, 3);
  const kp = Math.pow(k, 0.7), L = clamp(6 * kp, 5, 13), span = L * 0.8;
  // straight diagonal: bottom-left to top-right, past the poster's corners
  const ax = -hw - 10 * sk, ay = hh * 0.7, bx = hw + 10 * sk, by = -hh - 6 * sk;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const jets = [
    { off: 0, side: 0, glint: 0.36, ph: R.range(0, 9) },
    { off: LAG, side: clamp(9 * sk, 6, 18), glint: 0.5, ph: R.range(0, 9), back: -L * 1.2 },
  ];
  // progress along the path: quick in, steady across
  const prog = (tt) => {
    const u = seg(tt, FLY[0], FLY[1]);
    return 0.65 * u + 0.35 * ease.inQuad(u);
  };
  const posAt = (j, tt) => {
    const u = prog(tt - j.off), s = (j.back ?? 0);
    return [ax + dx * u + nx * j.side + ux * s, ay + dy * u + ny * j.side + uy * s, u];
  };
  const boomT = 0.33;
  let t = 0;

  function jet(p, x, y) {
    const r = L + 2;
    p.shade(x - r, y - r, x + r, y + r, (px, py) => {
      const ex = px - x, ey = py - y, u = ex * ux + ey * uy, v = ex * nx + ey * ny, av = Math.abs(v);
      if (u < -L || u > L) return;
      // the fuselage: a long thin body with a pointed nose
      const fw = u > L * 0.4 ? 0.85 * (L - u) / (L * 0.6) + 0.15 : 0.85;
      // swept wings mid-body, small tailplanes at the back
      const wingIn = u > -L * 0.5 && u < L * 0.3 && av <= Math.min(L * 0.8, (L * 0.3 - u) * 1.05);
      const tailIn = u < -L * 0.68 && av <= Math.min(L * 0.3, (-L * 0.68 - u) * 1.4 + 0.4);
      const body = av <= fw;
      if (!body && !wingIn && !tailIn) return;
      const lit = v < 0; // the upper-left side catches the sun
      if (body) {
        if (u > L * 0.25 && u < L * 0.6 && av < 0.6) return u > L * 0.45 ? CANOPY_HI : CANOPY;
        return lit ? C[5] : C[3];
      }
      const trail = wingIn ? u < -L * 0.5 + 1.1 : u < -L + 1;
      if (trail) return C[1];
      return lit ? C[4] : C[2];
    });
    p.glow(x, y, L * 1.2, C[4], 0.06);
  }

  return {
    update(dt) {
      t += dt;
    },
    drawBack(p) {
      preview(p, o);
      // the contrails: sampled along each jet's past path, older samples wider, fainter and drifting
      const step = 1 / 150;
      for (const j of jets) {
        const t0 = FLY[0] + j.off, t1 = Math.min(t, FLY[1] + j.off);
        for (let tau = t0; tau <= t1; tau += step) {
          const age = t - tau;
          if (age > LIFE || age < 0.025) continue;
          const [x, y] = posAt(j, tau), g = age / LIFE;
          const drift = age * 4 * sk, wob = noise(tau * 30 + j.ph) - 0.5;
          const tx = x - ux * L * 0.55, ty = y - uy * L * 0.55;
          if (age < 0.18) {
            // two crisp wingtip lines that soon swell
            for (const s of [-1, 1]) {
              const wx = tx + nx * s * span * (1 - age * 2), wy = ty + ny * s * span * (1 - age * 2);
              p.blend(wx, wy, T[2], 0.9 - age * 2);
            }
          } else {
            const lump = 0.7 + 0.35 * noise(tau * 70 + j.ph * 7) + 0.25 * noise(tau * 19 + j.ph);
            const r = (0.8 + Math.pow(age, 0.7) * 3.6 * lump) * kp, cx = tx + nx * wob * 3 * sk * g, cy = ty + ny * wob * 3 * sk * g - drift;
            const a = 0.42 * Math.pow(1 - g, 1.4) * (0.7 + 0.5 * lump);
            p.disc(cx, cy, r, mix(T[2], T[1], g * 1.3), a * 0.55);
            if (g < 0.6) p.disc(cx - r * 0.25, cy - r * 0.3, r * 0.55, T[2], a * 0.45);
          }
        }
      }
    },
    draw(p) {
      for (const j of jets) {
        const tt = t - j.off;
        if (tt < FLY[0] || tt > FLY[1] + 0.02) continue;
        const [x, y] = posAt(j, t);
        // afterburner: a short flickering flame behind the tail
        const fl = 1.5 + Math.abs(Math.sin(t * 70 + j.ph)) * 1.5 * sk;
        for (let d = 0; d <= fl; d += 0.5) p.px(x - ux * (L + d), y - uy * (L + d), BURN[d < 1 ? 2 : d < fl * 0.6 ? 1 : 0]);
        p.glow(x - ux * L, y - uy * L, 4 + 2 * sk, BURN[1], 0.45);
        jet(p, x, y);
        // sun glint on the canopy
        const gk = 1 - Math.abs(tt - j.glint) / 0.09;
        if (gk > 0) sparkle(p, x + ux * L * 0.4, y + uy * L * 0.4 - 1, (2 + 2.5 * sk) * gk, WHITE, CANOPY_HI, 0.5 * gk);
      }
      // the vapour cone / boom ring around the lead jet, squashed along the flight line
      const bu = seg(t, boomT, boomT + 0.26);
      if (bu > 0 && bu < 1) {
        const [jx, jy] = posAt(jets[0], t), x = jx - ux * L * 0.2, y = jy - uy * L * 0.2;
        const r = L * (0.7 + ease.outQuart(bu) * 1.3), a = 1 - bu, rr = r + 2;
        p.shade(x - rr, y - rr, x + rr, y + rr, (px, py, out) => {
          const ex = px - x, ey = py - y, u = ex * ux + ey * uy, v = ex * nx + ey * ny;
          const d = Math.hypot(u * 3, v);
          if (Math.abs(d - r) > 0.7) return;
          out.a = a > 0.4 ? 1 : a * 2.5;
          out.k = 0.35 * a;
          return bu < 0.2 ? WHITE : v < 0 ? T[2] : T[1];
        });
        p.glowRing?.(x, y, r, 2, T[2], 0.25 * a);
        if (bu < 0.12) p.glow(x, y, L * 3, WHITE, 0.4);
      }
    },
  };
}
