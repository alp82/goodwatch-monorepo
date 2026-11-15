// Made for the GoodWatch stats page: A small golden shine on the trophy next to an award count.
import { fit, seg, clamp, lerp, ease, rand, fly, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trophy shine",
  desc: "A white four-ray star flashes on a small trophy, a glint sweeps across it, a few gold motes pop up and fall twinkling, and a soft gold glow fades, all tight round the icon.",
  tags: ["stats-page", "award", "trophy", "glint", "gold", "one-shot"],
  size: [32, 32],
  origin: [16, 18],
  duration: 1.1,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#3a2206", "#7a4a0c", "#c08018", "#f0b830", "#ffe27a", "#fff8d8"],
    seed: 2,
    tease: 0,
  },
};

export const tease = { duration: 0.6 };

/** A diagonal glint band crossing the icon (about 5 px across), u from 0 to 1. */
function glint(p, C, u, k) {
  const d = lerp(-6, 6, ease.inOutSine(u)); // position of the band along x + y
  for (let y = -3; y <= 2; y++)
    for (let x = -3; x <= 2; x++) {
      const r = Math.hypot(x + 0.5, y + 0.5);
      if (r > 3) continue;
      const off = Math.abs(x + y + 1 - d);
      if (off < 0.6) p.blend(x, y, WHITE, 0.8 * k);
      else if (off < 1.6) p.blend(x, y, C[4], 0.35 * k);
    }
  p.light(d / 2 - 0.5, d / 2 - 0.5, C[4], 0.18 * k);
}

/** A four-ray star: white core, rays of `arm` px stepping down to gold at the tips. */
function star(p, C, x, y, arm, hot) {
  const n = Math.round(arm);
  if (n < 1) return p.px(x, y, hot ? WHITE : C[4]);
  for (let d = 1; d <= n; d++) {
    const c = hot ? (d < n ? WHITE : C[4]) : d === 1 ? C[5] : d < n ? C[4] : C[3];
    p.px(x + d, y, c); p.px(x - d, y, c); p.px(x, y + d, c); p.px(x, y - d, c);
  }
  if (n >= 3) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) p.dot(x + dx, y + dy, C[4], 0.5);
  p.px(x, y, WHITE);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), S = o.seed;
  const teasing = !!o.tease;
  const D = teasing ? tease.duration : meta.duration;
  if (t >= D) return;

  if (teasing) {
    // one glint runs across the cup and winks at its rim
    const g = seg(t, 0.06, 0.4);
    if (g > 0 && g < 1) glint(p, C, g, Math.sin(Math.PI * g));
    const w = seg(t, 0.36, 0.56);
    if (w > 0 && w < 1) star(p, C, 1, -2, w < 0.4 ? 2 : 1, false);
    return;
  }

  // the hero frame: a white star on the cup, then it shrinks back to a gold wink
  const sx = 0, sy = -1;
  if (t < 0.3) {
    const k = seg(t, 0, 0.3);
    star(p, C, sx, sy, t < 0.067 ? 5 : lerp(4, 0, ease.inQuad(k)), t < 0.067);
  }
  // a small warm glow, tight, flaring at the star and easing off
  const gk = t < 0.08 ? 0.5 : 0.32 * (1 - ease.outQuad(seg(t, 0.08, 0.9)));
  if (gk > 0.01) {
    p.glow(0, -1, 7, C[3], gk);
    p.glow(0, -1, 3, C[4], gk * 0.6);
  }
  // the glint sweeps across after the star
  const g = seg(t, 0.2, 0.5);
  if (g > 0 && g < 1) glint(p, C, g, Math.sin(Math.PI * g));

  // gold motes: pop up out of the cup, arc and fall, twinkling into little crosses at the top
  const N = 5;
  for (let i = 0; i < N; i++) {
    const born = 0.04 + i * 0.035 + rand(S, i, 1) * 0.03, age = t - born;
    const life = 0.5 + rand(S, i, 2) * 0.2;
    if (age < 0 || age > life) continue;
    const side = i % 2 ? 1 : -1, vx = side * (8 + rand(S, i, 3) * 14) * (i === 4 ? 0.3 : 1);
    const vy = -(42 + rand(S, i, 4) * 22);
    const [x, y] = fly(sx + side, sy - 1, vx, vy, age, 300, 2.2);
    if (y > 4) continue; // they wink out just below the icon, never trail down the page
    const u = age / life;
    const tw = Math.floor((age + rand(S, i, 5)) * 14) % 3 === 0; // a twinkle every few frames
    const c = u < 0.15 ? WHITE : u < 0.6 ? C[4] : C[3];
    if (u > 0.85 && tw) continue; // flickers out at the end of its fall
    p.px(x, y, c);
    if (tw && u > 0.2 && u < 0.7) {
      p.px(x + 1, y, C[3]); p.px(x - 1, y, C[3]); p.px(x, y + 1, C[3]); p.px(x, y - 1, C[3]);
    }
    p.light(x, y, C[3], 0.14 * (1 - u));
  }

  // a last wink on the cup's rim as it settles
  const w = seg(t, 0.6, 0.84);
  if (w > 0 && w < 1) {
    star(p, C, 2, -2, w < 0.35 ? 2 : 1, false);
    p.glow(2, -2, 4, C[4], 0.25 * (1 - w));
  }
}
