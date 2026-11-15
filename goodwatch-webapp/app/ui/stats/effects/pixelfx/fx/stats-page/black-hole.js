// Made for the GoodWatch stats page: "Interstellar": a small black hole opens above the word.
import { fit, hex, rand, seg, clamp, lerp, ease, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Black hole",
  desc: "A tiny black hole opens above the word: black core in a lensed halo, a thin hot disk across it, stars swim and fall in stretched, then a white flash and one ring.",
  tags: ["stats-page", "space", "black-hole", "interstellar", "one-shot"],
  size: [72, 40],
  origin: [36, 30],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2a0e06", "#7a300c", "#d0661a", "#ffb04a", "#ffe8b8", "#ffffff"],
    motes: ["#2a3a7a", "#7aa0f0", "#d8e6ff"],
    w: 53,
    tease: 0,
    seed: 2,
  },
};

export const tease = { duration: 0.8 };

const K = hex("#030306");
const CY = -9, RX = 10, CORE = 3;
const OPEN = 0.3, SHUT0 = 1.5, SHUT1 = 1.66, PULSE = 0.45;

/** A falling star: from (x0, y0) it curves in, bending round the hole, and stretches as it speeds up. */
function fall(m, u) {
  const e = ease.inCubic(u);
  const a = m.a0 + m.bend * e, r = lerp(m.r0, CORE + 0.6, e);
  return [Math.cos(a) * r, CY + Math.sin(a) * r * 0.45];
}

function star(p, M, m, u) {
  if (u <= 0 || u >= 1) return;
  const [x, y] = fall(m, u);
  const n = 1 + Math.round(ease.inQuad(u) * 6);
  for (let k = n; k >= 1; k--) {
    const [tx, ty] = fall(m, Math.max(0, u - k * 0.02));
    p.dot(tx, ty, k > n / 2 ? M[0] : M[1], 0.9);
  }
  p.px(x, y, u > 0.88 ? WHITE : M[2]);
  p.light(x, y, M[1], 0.3);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), M = fit(o.motes, 3), S = o.seed;
  const span = clamp((o.w ?? 53) / 2, 12, 24);

  if (o.tease) {
    const D = tease.duration;
    if (t >= D) return;
    star(p, M, { r0: span * 0.8, a0: 3.4, bend: 3.2 }, seg(t, 0.02, 0.62));
    if (t > 0.5 && t < 0.72) {
      const w = seg(t, 0.6, 0.72);
      p.px(0, CY, w < 0.5 ? WHITE : M[1]);
      if (w > 0 && w < 0.5) { p.px(-1, CY, M[1]); p.px(1, CY, M[1]); p.px(0, CY - 1, M[1]); p.px(0, CY + 1, M[1]); }
      p.glow(0.5, CY + 0.5, 4, M[1], 0.3 * (1 - w));
    }
    return;
  }
  if (t >= meta.duration) return;

  const open = ease.outBack(seg(t, 0.04, OPEN));
  const shut = ease.inCubic(seg(t, SHUT0, SHUT1));
  const s = open * (1 - shut);
  const cr = CORE * Math.min(1, open * 1.15) * (1 - shut), rx = RX * s;
  const spin = t * 6;

  // lensed background stars: they swim outward round the hole while it's open, twinkling
  for (let i = 0; i < 3; i++) {
    const a = -0.4 - (i / 3) * 2.4 - rand(S, i, 7) * 0.5, r0 = 8 + rand(S, i, 8) * 4;
    const r = r0 + 2.5 * s + Math.sin(t * 7 + i * 2) * 0.8 * s;
    const x = Math.cos(a) * r, y = CY + Math.sin(a) * r * 0.6;
    if (y > -2 || s < 0.15) continue;
    // at full pull each one smears into a tiny arc round the hole, the lensing look
    const tw = Math.sin(t * 11 + i * 3.1), arc = s > 0.85 ? 1 : 0;
    const tx = -Math.sin(a), ty = Math.cos(a) * 0.6;
    p.px(x, y, tw > 0.5 ? M[2] : M[1]);
    if (arc) { p.px(x + tx * 1.4, y + ty * 1.4, M[0]); p.px(x - tx * 1.4, y - ty * 1.4, M[0]); }
  }

  // the core and its lensed halo: a thin ring hugging the core, bright over the top, dimmer beneath
  if (cr > 0.6) {
    const hr = cr + 1.4;
    const N = Math.ceil(hr * 9);
    for (let i = 0; i < N; i++) {
      const g = (i / N) * TAU, x = Math.cos(g) * hr, y = CY + Math.sin(g) * (hr - 0.3);
      const top = -Math.sin(g);
      const clump = Math.max(0, Math.cos(g - spin)) ** 8;
      p.px(x, y, C[clamp(Math.round(2 + top * 1.6 + clump * 1.5), 1, 5)]);
    }
    p.circle(0, CY, cr, K);
    p.glowRing(0, CY, hr + 1.2, 1.4, C[2], 0.3 * s);
  } else if (t > 0.04 && t < SHUT0) p.px(0, CY, K);

  // the disk, edge on, across the front of the core: white-hot near the core and on the left (turning towards us)
  if (rx >= 1) {
    for (let x = -Math.round(rx); x <= Math.round(rx); x++) {
      const d = Math.abs(x) / rx;
      const doppler = x < 0 ? 0.15 : -0.15;
      const clump = Math.max(0, Math.cos(x * 0.9 + spin * (x < 0 ? 1 : -1))) ** 6 * 0.2;
      const h = clamp(1 - d * 0.9 + doppler + clump);
      p.px(x, CY, C[clamp(Math.round(h * 5), 1, 5)]);
      // a thinner, dimmer sheet a row under it on the near side, so the disk has a tilt
      if (d < 0.75) p.px(x, CY + 1, C[clamp(Math.round(h * 3), 1, 3)]);
    }
    // light off the disk's two arms, kept off the core so it stays black
    p.glowLine(-rx, CY, -cr - 1.5, CY, 2.5, C[3], 0.3 * s);
    p.glowLine(cr + 1.5, CY, rx, CY, 2.5, C[3], 0.22 * s);
  }

  if (t < 0.1) {
    p.px(0, CY, WHITE);
    p.glow(0.5, CY + 0.5, 6, C[4], 0.5);
  }

  // stars fall in from over the word, bending round the hole and stretching
  for (let i = 0; i < 4; i++) {
    const born = 0.24 + i * 0.24 + rand(S, i, 1) * 0.06, life = 0.7 + rand(S, i, 2) * 0.2;
    if (born + life > SHUT0 + 0.05) continue;
    const m = { r0: span * (0.65 + rand(S, i, 3) * 0.35), a0: rand(S, i, 4) * TAU, bend: (rand(S, i, 5) < 0.5 ? -1 : 1) * (2.2 + rand(S, i, 6)) };
    const u = (t - born) / life;
    star(p, M, m, u);
    if (u >= 1 && u < 1.12) {
      const [x, y] = fall(m, 1);
      p.px(x, y, WHITE);
      p.light(x, y, C[4], 0.6);
    }
  }

  const f = t - SHUT1;
  if (f >= 0) {
    if (f < 0.07) {
      p.px(0, CY, WHITE);
      for (let k = 1; k <= 3; k++) {
        const c = k === 1 ? WHITE : k === 2 ? C[4] : C[3];
        p.px(-k, CY, c); p.px(k, CY, c); p.px(0, CY - k, c);
        if (k < 3) p.px(0, CY + k, c);
      }
      p.glow(0.5, CY + 0.5, 10, C[4], 0.7);
    } else if (f < 0.14) {
      p.px(0, CY, WHITE);
      p.px(-1, CY, C[4]); p.px(1, CY, C[4]);
    }
    const u = f / PULSE;
    if (u < 1) {
      const R = 2 + ease.outCubic(u) * 10;
      const c = u < 0.2 ? WHITE : u < 0.45 ? C[4] : u < 0.75 ? C[3] : C[2];
      const N = Math.ceil(R * 6);
      for (let i = 0; i < N; i++) {
        const g = (i / N) * TAU, x = Math.cos(g) * R, y = CY + Math.sin(g) * R * 0.42;
        if (y > -1.5) continue;
        p.dot(x, y, c, 1 - seg(u, 0.7, 1));
      }
      p.glowRing(0, CY, R, 1.5, C[3], 0.1 * (1 - u));
    }
  }
}
