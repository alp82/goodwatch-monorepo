// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, rand, seg, ease, WHITE } from "../../core/index.js";
import { AMB, count } from "./_amb1.js";

export const meta = {
  name: "Little fireworks",
  desc: "Over a United States island: small fireworks climb on a fizzing trail and burst into red, white and blue sparks that droop, fall and fade; some end in a crackle of glitter.",
  tags: ["cinema", "ambient", "island", "usa", "fireworks", "celebration", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: {
    palette: ["#0e1a4a", "#2346b8", "#4f86ff", "#a8c8ff", "#ffffff"],
    red: ["#4a0a14", "#b0182c", "#ff3a4a", "#ffb0a8", "#ffffff"],
    white: ["#3a3c4a", "#8a8ea8", "#d8dcf0", "#f4f6ff", "#ffffff"],
    seed: 1, r: 30, density: 1,
  },
};

const RISE = 0.55, LIFE = 2.3, DRAG = 3.4, G = 30;

export function draw(p, t, o) {
  const D = meta.duration, r = o.r ?? 30, S = o.seed, s = Math.max(0.8, Math.min(1.8, r / 30));
  const ramps = [fit(o.red, 5).map(hex), fit(o.white, 5).map(hex), fit(o.palette, 5).map(hex)];
  const n = count(o, 3);
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k), born = ((i + R(1) * 0.5) / n) * D, age = (((t - born) % D) + D) % D;
    if (age >= LIFE) continue;
    const C = ramps[i % 3], C2 = ramps[(i + 1 + Math.floor(R(9) * 2)) % 3];
    const bx = (R(2) - 0.5) * r * 1.3, by = -r * (0.55 + R(3) * 0.4), x0 = bx + (R(4) - 0.5) * r * 0.25, y0 = r * 0.05;
    if (age < RISE) {
      // the climb: a hot head, a fizzing trail that drifts and cools
      const q = ease.outQuad(age / RISE), hx = x0 + (bx - x0) * q, hy = y0 + (by - y0) * q;
      for (let j = 1; j < 7; j++) {
        const u = Math.max(0, q - j * 0.035), tx = x0 + (bx - x0) * u + Math.sin((age * 40 + j) * 1.7) * 0.4 * j * 0.3, ty = y0 + (by - y0) * u + j * 0.3;
        if ((j + Math.floor(age * 30)) % 3 === 2 && j > 2) continue;
        p.px(tx, ty, j < 2 ? C[3] : j < 4 ? C[2] : C[1]);
      }
      p.px(hx, hy, WHITE);
      p.light(hx, hy, C[3], 0.5);
      continue;
    }
    const a = age - RISE, k = a / (LIFE - RISE);
    // the burst: a white hero frame, a flash of light
    if (a < 0.05) {
      p.rect(bx - 1, by - 1, 3, 3, WHITE);
      p.px(bx - 2, by, C[3]); p.px(bx + 2, by, C[3]); p.px(bx, by - 2, C[3]); p.px(bx, by + 2, C[3]);
      p.glow(bx, by, 18 * s, C[2], 0.55);
    }
    p.glow(bx, by, 16 * s, C[2], 0.35 * Math.pow(1 - k, 3));
    // sparks: drag out, then droop and fall; a trail behind each head
    const m = Math.round(16 + s * 6), sp = (40 + R(5) * 14) * s;
    const pos = (u, j) => {
      const an = (j / m) * Math.PI * 2 + R(6) * 3, v = sp * (j % 4 === 3 ? 0.45 + rand(S, i * 50 + j, 1) * 0.2 : 0.8 + rand(S, i * 50 + j, 1) * 0.3);
      const e = (1 - Math.exp(-DRAG * u)) / DRAG;
      return [bx + Math.cos(an) * v * e, by + Math.sin(an) * v * e + G * u * u * 0.5 * s];
    };
    for (let j = 0; j < m; j++) {
      const life = 0.75 + rand(S, i * 50 + j, 2) * 0.35;
      if (k > life) continue;
      const kk = k / life, cc = j % 3 === 0 ? C2 : C;
      const [hx, hy] = pos(a, j);
      const head = kk < 0.25 ? WHITE : kk < 0.55 ? cc[3] : kk < 0.8 ? cc[2] : cc[1];
      // a truly translucent trail along the spark's own path, longest while it is fast
      const tl = 0.22, steps = 7;
      for (let q = 1; q <= steps; q++) {
        const u = a - (q / steps) * tl;
        if (u < 0) break;
        const [tx, ty] = pos(u, j);
        p.blend(tx, ty, q < 3 && kk < 0.4 ? cc[3] : cc[2], (1 - q / (steps + 1)) * 0.85 * (1 - kk * 0.7));
      }
      // late sparks flicker as they die
      if (kk < 0.7 || (Math.floor(age * 30) + j) % 3 !== 0) p.px(hx, hy, head);
      if (kk < 0.7) p.light(hx, hy, cc[2], 0.4 * (1 - kk));
    }
    // glitter crackle after some bursts
    if (R(7) < 0.6 && k > 0.45) {
      const g = 10 + Math.round(s * 4);
      for (let j = 0; j < g; j++) {
        const R2 = (q) => rand(S, i * 90 + j, q), tj = 0.45 + R2(1) * 0.4;
        const ag = k - tj;
        if (ag < 0 || ag > 0.07) continue;
        const an = R2(2) * Math.PI * 2, d = sp * 0.3 * (0.4 + R2(3) * 0.6);
        const gx = bx + Math.cos(an) * d, gy = by + Math.sin(an) * d + G * a * a * 0.25 * s;
        p.px(gx, gy, WHITE);
        if (ag < 0.035) { p.px(gx + 1, gy, ramps[1][3]); p.px(gx - 1, gy, ramps[1][3]); p.px(gx, gy - 1, ramps[1][2]); p.px(gx, gy + 1, ramps[1][2]); }
        p.light(gx, gy, ramps[1][3], 0.5);
      }
    }
  }
}
