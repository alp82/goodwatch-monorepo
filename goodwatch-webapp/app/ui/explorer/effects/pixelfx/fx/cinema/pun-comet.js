// Made for the GoodWatch explorer map: title pun.
// Comet: a bright head streaks diagonally down across the poster trailing a long tapered tail that sheds sparkles,
// splits into two smaller trails near the end, leaves with a flash at the poster's corner, and its dust settles.
import { Particles, Lights, P, Rng, clamp, seg, ease, TAU, WHITE, hex, fit, flare, sparkle } from "../../core/index.js";
import { poster } from "./_pun2.js";
import { preview } from "./_pun1.js";

export const meta = {
  name: "Pun: comet",
  desc: "A bright comet streaks diagonally down across the poster with a long tapered sparkling tail, splits into two smaller trails near the end, leaves in a flash and its dust settles.",
  tags: ["cinema", "pun", "comet", "space", "impact", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.5,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0c1640", "#1d3d8c", "#3a7ad6", "#7cc4ff", "#c8ecff", "#ffffff"], warm: "#ffd38a", seed: 1, w: 40, h: 60 },
};

const RUN = [0.04, 0.62], DRAIN = 0.88;

export function create(o) {
  const { w, h, k } = poster(o), hw = w / 2, hh = h / 2, sk = Math.sqrt(k), R = new Rng(o.seed);
  const C = fit(o.palette, 6), WARM = hex(o.warm);
  const ps = new Particles({ rng: R, sparks: ["#ffffff", "#c8ecff", "#7cc4ff", "#3a7ad6"] }), lights = new Lights();
  const x0 = hw * 1.2, y0 = -hh * 1.15, x1 = -hw * 0.95, y1 = hh * 0.95;
  const S = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / S, uy = (y1 - y0) / S, nx = -uy, ny = ux;
  const W = clamp(3 * sk, 2.2, 7), L = S * 0.62, sS = S * 0.5, spread = 0.16;
  const at = (s) => [x0 + ux * s, y0 + uy * s];
  const headS = (t) => S * (0.65 * seg(t, RUN[0], RUN[1]) + 0.35 * ease.inQuad(seg(t, RUN[0], RUN[1])));
  let t = 0, flashed = false, acc = 0;
  return {
    update(dt) {
      t += dt;
      const sH = headS(t);
      if (t > RUN[0] && t < RUN[1]) {
        acc += dt;
        while (acc > 1 / 60) {
          acc -= 1 / 60;
          const [hx, hy] = at(sH), side = R.range(-1, 1);
          const kind = R.chance(0.18) ? P.STAR : P.FLAKE;
          ps.spawn(kind, hx + nx * side * W, hy + ny * side * W, -ux * R.range(10, 40) + nx * side * 20, -uy * R.range(10, 40) + ny * side * 20 + 6,
            R.range(0.5, 1.3), R.chance(0.25) ? WARM : C[R.int(3, 4)], kind === P.STAR ? R.range(0.6, 1.8) : R.range(1, 1.6));
        }
      }
      if (!flashed && t >= RUN[1]) {
        flashed = true;
        lights.add(x1, y1, 30 * sk, C[4], 0.6, 0.4);
        lights.add(x1, y1, 14 * sk, WHITE, 0.6, 0.12);
        for (let i = 0; i < Math.round(16 * sk); i++) {
          const a = R.range(0, TAU), sp = R.range(40, 100) * sk;
          ps.spawn(P.SPARK, x1, y1, Math.cos(a) * sp + ux * 30, Math.sin(a) * sp * 0.7 - 30, R.range(0.15, 0.4));
        }
        for (let i = 0; i < Math.round(12 * sk); i++) {
          const a = R.range(0, TAU), sp = R.range(10, 40) * sk;
          ps.spawn(P.STAR, x1, y1, Math.cos(a) * sp, Math.sin(a) * sp - 10, R.range(0.8, 1.6), i % 3 ? C[4] : WARM, R.range(0.6, 2), R.range(0, 0.3));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      preview(p, o);
    },
    draw(p) {
      lights.draw(p);
      if (t > RUN[0] && t < DRAIN) {
        const sH = headS(t), drain = seg(t, RUN[1], DRAIN), sT = Math.max(0, sH - L) + (S - Math.max(0, sH - L)) * ease.inQuad(drain);
        const split = sH > sS;
        // one tail (or two branches past the split point), tapered, hot near the head
        const tail = (sa, sb, off, wk) => {
          for (let s = sb; s >= sa; s -= 0.5) {
            const f = (sH - s) / L, d = split && s > sS ? (s - sS) : 0, o2 = off * d * spread;
            const [cx, cy] = at(s), px = cx + nx * o2, py = cy + ny * o2;
            const wd = W * wk * Math.pow(Math.max(0, 1 - f), 0.9) * (1 - drain * 0.7);
            const fl = 0.75 + 0.25 * Math.sin(s * 1.7 - t * 30);
            for (let q = -wd; q <= wd; q += 0.5) {
              const a = Math.abs(q) / Math.max(0.5, wd);
              const c = f < 0.15 && a < 0.45 ? WHITE : f < 0.35 && a < 0.6 ? C[4] : f < 0.65 && a < 0.75 ? C[3] : C[2];
              p.dot(px + nx * q, py + ny * q, c, Math.min(1, (1 - f) * 1.8) * fl * (1 - a * 0.4) * (1 - drain * 0.8));
            }
            if (f < 0.8 && wd > 0.6) {
              p.dot(px + nx * (wd + 1), py + ny * (wd + 1), C[1], 0.6 * (1 - f));
              p.dot(px - nx * (wd + 1), py - ny * (wd + 1), C[1], 0.6 * (1 - f));
            }
            if (f < 0.97) p.dot(px, py, f < 0.5 ? C[4] : C[3], 1.2 - f);
            if (((s * 2) | 0) % 4 === 0) p.light(px, py, C[3], 0.3 * (1 - f) * (0.4 + wk * 0.6));
          }
        };
        // a soft luminous body along the whole tail
        {
          const [ax, ay] = at(sT), [bx, by] = at(sH), g = 1 - drain;
          p.glowLine(ax, ay, bx, by, 4 * sk, C[2], 0.22 * g);
          p.glowLine(ax + (bx - ax) * 0.5, ay + (by - ay) * 0.5, bx, by, 2 * sk, C[4], 0.25 * g);
        }
        if (!split) tail(sT, sH, 0, 1);
        else {
          tail(sT, sS, 0, 1);
          tail(Math.max(sT, sS), sH, 1, 0.7);
          tail(Math.max(sT, sS), sH, -1, 0.6);
        }
        // the heads
        const heads = split ? [[1, 0.75], [-1, 0.6]] : [[0, 1]];
        if (t < RUN[1])
          for (const [off, hk] of heads) {
            const d = split ? sH - sS : 0, o2 = off * d * spread, [cx, cy] = at(sH), hx = cx + nx * o2, hy = cy + ny * o2, r = W * hk;
            p.circle(hx, hy, r + 0.8, C[3]);
            p.circle(hx - 0.3, hy - 0.3, r * 0.75, C[4]);
            p.circle(hx - 0.3, hy - 0.3, Math.max(0.6, r * 0.4), WHITE);
            p.glow(hx, hy, 8 * sk * hk + 4, C[4], 0.55);
            p.glow(hx, hy, 3 * sk, WHITE, 0.5);
          }
      }
      // the exit flash
      const fu = seg(t, RUN[1], RUN[1] + 0.35);
      if (fu > 0 && fu < 1) {
        if (fu < 0.2) flare(p, x1, y1, 14 * sk * (1 - fu), 0.5, ["#0c1640", "#3a7ad6", "#c8ecff", "#ffffff"]);
        const r = 2 + ease.outQuart(fu) * 12 * sk;
        p.ring(x1, y1, r, 1, fu < 0.3 ? WHITE : C[3], 1 - fu);
        p.glowRing(x1, y1, r, 3, C[3], 0.3 * (1 - fu));
      }
      ps.draw(p);
      if (t < 0.12 && t > RUN[0]) sparkle(p, x0, y0, 3 + 2 * sk, C[4], C[3], 0.5);
    },
  };
}
