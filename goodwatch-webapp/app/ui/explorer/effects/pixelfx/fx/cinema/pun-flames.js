// Made for the GoodWatch explorer map: title pun.
// Flame tongues, puffs, smoke and embers adapted from Sprite Fusion's open-source fire
// (https://www.spritefusion.com/pixel-art-vfx/fire), MIT License, Copyright (c) 2026 Hugo Duprez.
import { rng, noise, fit, mix, hex, clamp, seg, ease, WHITE, SMOKE_RAMP } from "../../core/index.js";
import { poster } from "./_pun2.js";
import { preview } from "./_pun1.js";

export const meta = {
  name: "Poster flames",
  desc: "A white-hot line runs along the poster's bottom edge, then flame tongues lick up its lower edge and sides, throwing licks, embers and smoke, and burn down to a smouldering edge.",
  tags: ["cinema", "pun", "fire", "flames", "burn", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#4a1712", "#c9281f", "#ff8a2a", "#ffe26b", "#ffffff"], seed: 1, w: 40, h: 60 },
};

// when the fire is up: catches fast, roars, burns down
const CATCH = [0.04, 0.32], DOWN = [1.2, 2.0];

// --- fire toolkit (one-shot copies of the fire library's helpers) ---
const N = (tt, rate, seed = 0, off = 0) => noise(tt * rate + off, seed);
// tongue layers [width share, height share, step of the hot-first ramp]: red tip/rim, orange body, yellow, white core
const LAYERS = [[1, 1, 6], [0.78, 0.84, 4], [0.55, 0.64, 2], [0.28, 0.38, 0]];
const BACK = [[1, 1, 7], [0.74, 0.8, 5], [0.48, 0.56, 3]];

function tongue(p, t, x, y, h, w, sx, n, H, layers) {
  if (h < 1.5) return;
  for (const [lw, lh, ri] of layers) {
    const L = h * lh, c = H[ri];
    for (let r = 0; r <= L; r++) {
      const u = r / Math.max(1, L);
      const half = w * lw * Math.pow(1 - u, 0.9) * Math.min(1, (r + 1.5) / 3) + N(t, 9, n, r * 0.45) * 0.45;
      if (half < 0.3) continue;
      const cx = x + sx * u * u * lh + N(t, 5, n + 7, r * 0.22) * u * 1.2, Y = Math.round(y - r);
      for (let px = Math.round(cx - half), x1 = Math.round(cx + half); px <= x1; px++) p.px(px, Y, c);
    }
  }
}
function solid(p, x, y, r, c) {
  if (r < 0.6) return p.px(x, y, c);
  p.circle(x, y, r, c);
}
function puff(p, x, y, k, size, H) {
  const age = 1 - k, idx = Math.min(H.length - 2, Math.floor(Math.pow(age, 0.6) * (H.length - 1)));
  const r = size * (0.6 + 0.4 * Math.min(1, age * 7)) * (1 - age * 0.55);
  solid(p, x, y, r, H[Math.min(H.length - 1, idx + 2)]);
  solid(p, x - r * 0.15, y - r * 0.25, r * 0.7, H[idx]);
  if (idx <= 2 && r > 1.4) p.px(x - r * 0.25, y - r * 0.4, H[Math.max(0, idx - 1)]);
  p.glow(x, y, r * 2.4 + 2, H[idx], 0.16 * k);
}
const rampAt = (rr, u) => rr[Math.min(rr.length - 1, Math.max(0, Math.floor(u * rr.length)))];
function smoke(p, x, y, k, size, tint) {
  const age = 1 - k, r = size * (0.7 + Math.min(1, age * 2.5) * 0.5 + age * 0.5);
  const a = Math.min(1, age * 10) * Math.min(1, k * 2.2) * 0.8;
  const c = mix(tint, rampAt(SMOKE_RAMP, age), 0.4 + 0.6 * age);
  p.disc(x, y, r, c, a * 0.45);
  p.disc(x + r * 0.05, y + r * 0.08, r * 0.7, c, a * 0.6);
  if (age < 0.5) p.disc(x - r * 0.2, y - r * 0.3, r * 0.45, mix(c, WHITE, 0.15), a * 0.4 * (1 - age * 2));
}
function along(x, v, a, kd, t) {
  const e = Math.exp(-kd * t), vt = a / kd;
  return x + vt * t + ((v - vt) * (1 - e)) / kd;
}

export function draw(p, t, o) {
  preview(p, o);
  const { w, h, k } = poster(o), S = o.seed, C = fit(o.palette, 5).map(hex);
  // hot-first ramp: white, pale yellow, yellow, gold, orange, deep orange, red, dark red, ember
  const H = [C[4], mix(C[3], C[4], 0.5), C[3], mix(C[2], C[3], 0.5), C[2], mix(C[1], C[2], 0.5), C[1], mix(C[0], C[1], 0.5), C[0]];
  const hw = w / 2, bot = h / 2, sk = Math.sqrt(k);
  const up = ease.outCubic(seg(t, CATCH[0], CATCH[1])), down = 1 - ease.inQuad(seg(t, DOWN[0], DOWN[1]));
  const fire = up * down, fl = 0.8 + 0.12 * N(t, 7.3, S + 1) + 0.08 * N(t, 19, S + 2);
  const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.2);

  // the hero frame: the bottom edge goes white-hot and the heat runs up the sides
  if (t < 0.16) {
    const a = 1 - t / 0.16, run = h * 0.5 * ease.outQuad(t / 0.16);
    p.line(-hw, bot, hw, bot, WHITE);
    p.line(-hw, bot - 1, hw, bot - 1, H[2], a);
    p.line(-hw, bot, -hw, bot - run, H[2]);
    p.line(hw - 1, bot, hw - 1, bot - run, H[2]);
    p.glowLine(-hw, bot, hw, bot, 8 * k, H[2], 0.6 * a);
  }

  // the tongues: a row along the bottom edge (tallest in the middle third), shorter ones up each side
  const T = [];
  const nb = Math.max(3, Math.round(w / (6.5 * sk)));
  for (let i = 0; i < nb; i++) {
    const r = rng(S, i), u = (i + 0.5) / nb, x = -hw + u * w + r.range(-0.6, 0.6);
    const hh = h * (0.2 + 0.22 * Math.sin(Math.PI * u) + r.range(-0.03, 0.08)), ww = (2.6 + r.range(0, 1)) * sk * (1 + 0.2 * Math.sin(Math.PI * u));
    T.push({ x, y: bot + 1, h: hh, w: ww, side: 0, n: S * 31 + i * 13, late: r.range(0, 0.1) });
  }
  const ns = Math.max(2, Math.round((h * 0.45) / (8 * sk)));
  for (const s of [-1, 1]) {
    for (let i = 0; i < ns; i++) {
      const r = rng(S + 50 + s, i), v = (i + 0.4) / ns;
      T.push({ x: s * (hw - 0.5) + s * r.range(-0.5, 0.8), y: bot - v * h * 0.5, h: h * (0.2 - 0.08 * v + r.range(0, 0.05)), w: (1.9 + r.range(0, 0.6)) * sk, side: s, n: S * 37 + i * 17 + (s + 1) * 101, late: 0.05 + v * 0.18 });
    }
  }
  const height = (q, tt) => {
    const f = ease.outCubic(seg(tt, CATCH[0] + q.late, CATCH[1] + q.late)) * (1 - ease.inQuad(seg(tt, DOWN[0] - q.late * 0.5, DOWN[1])));
    const leap = Math.max(0, N(tt, 2.8, q.n + 70) - 0.5) * 1.2;
    return q.h * f * (0.85 + 0.25 * N(tt, 3.6, q.n) + leap) * (0.92 + 0.08 * fl);
  };
  const sweep = (q, tt, hh) => N(tt, 2.4, q.n + 40) * (1 + hh * 0.1) + q.side * hh * 0.35 - q.x * 0.05;
  const tip = (q, tt) => {
    const hh = height(q, tt);
    return [q.x + sweep(q, tt, hh) * 0.85, q.y - hh * 0.85, hh];
  };

  // light first so it sits under the fire: a big warm pool, a hot band along the edge, light up the poster
  if (fire > 0.01) {
    p.glow(0, bot - h * 0.15, Math.max(w, h) * 0.75, GLOW, 0.28 * fire * fl);
    p.glowLine(-hw, bot - 1, hw, bot - 1, 9 * k, H[3], 0.4 * fire * fl);
    p.glow(0, bot + 3, w * 0.7, H[4], 0.18 * fire * fl);
    for (const s of [-1, 1]) p.glowLine(s * hw, bot, s * hw, bot - h * 0.45, 6 * k, H[4], 0.22 * fire * fl);
  }

  // smoke rolling up off the tips, behind the flames
  const nSmoke = Math.round(18 * sk + w * 0.25);
  for (let i = 0; i < nSmoke; i++) {
    const r = rng(S + 300, i), q = T[r.int(0, T.length - 1)], born = r.range(0.3, 1.75), life = r.range(0.6, 0.85), age = t - born;
    if (age < 0 || age >= life) continue;
    const [x0, y0] = tip(q, born);
    const x = x0 + r.range(-4, 4) * age + q.side * 3 * age + 2 * Math.sin(age * 3 + i), y = along(y0, -r.range(16, 26) * sk, -10, 1.2, age);
    smoke(p, x, y, 1 - age / life, r.range(2, 3.4) * sk, H[8]);
  }

  // back row: dimmer tongues between the front ones
  for (let i = 0; i < nb - 1; i++) {
    const a = T[i], b = T[i + 1], q = { x: (a.x + b.x) / 2, y: bot + 1, h: (a.h + b.h) * 0.42, w: (a.w + b.w) * 0.42, side: 0, n: a.n + 500, late: a.late + 0.03 };
    tongue(p, t, q.x, q.y, height(q, t), q.w, sweep(q, t, height(q, t)), q.n, H, BACK);
  }
  // front tongues
  for (const q of T) {
    const hh = height(q, t);
    tongue(p, t, q.x, q.y, hh, q.w, sweep(q, t, hh), q.n, H, hh > 9 ? LAYERS : LAYERS.slice(0, 3));
  }
  // a bed of heat along the edge while it burns: the root of every tongue
  if (fire > 0.05) {
    for (let x = -hw; x < hw; x++) {
      const g = N(t, 8, S + 9, x * 0.5);
      p.px(x, bot, fire > 0.5 ? (g > 0 ? H[1] : H[2]) : H[4]);
      p.px(x, bot + 1, fire > 0.5 ? H[4] : H[6]);
    }
  }

  // licks torn off the tips: blobs of flame that rise and shrink
  const nLick = Math.round(T.length * 5);
  for (let i = 0; i < nLick; i++) {
    const r = rng(S + 200, i), q = T[i % T.length], born = r.range(CATCH[0] + 0.15, DOWN[0] + 0.2), life = r.range(0.16, 0.3), age = t - born;
    if (age < 0 || age >= life) continue;
    const [tx, ty, hh] = tip(q, born);
    if (hh < 3) continue;
    const kk = 1 - age / life, x = tx + r.range(-3, 3) * age + q.side * 6 * age, y = ty - 1 - r.range(14, 26) * sk * age;
    puff(p, x, y, kk, r.range(0.9, 1.6) * sk, H);
  }

  // embers carried up off the fire, wandering and cooling; big ones a little cross
  const nEmb = Math.round(16 * sk + w * 0.25);
  for (let i = 0; i < nEmb; i++) {
    const r = rng(S + 500, i), q = T[r.int(0, T.length - 1)], born = r.range(0.1, 1.5), life = r.range(0.6, 1.2), age = t - born;
    if (age < 0 || age >= life) continue;
    const kk = 1 - age / life, ph = r.range(0, 6.3);
    if (kk < 0.25 && Math.sin(age * 40 + ph) < 0) continue;
    const x = q.x + q.side * 2 + along(0, r.range(-14, 14) + q.side * 10, 0, 1.6, age) + 4 * (Math.sin(age * 2.5 + ph) - Math.sin(ph));
    const y = q.y - 2 + along(0, -r.range(28, 55) * sk, -25, 1.6, age);
    const c = kk > 0.65 ? H[1] : kk > 0.35 ? H[3] : H[5];
    if (r.chance(0.2) && kk > 0.4) {
      const rim = kk > 0.6 ? H[4] : H[6];
      p.px(x - 1, y, rim), p.px(x + 1, y, rim), p.px(x, y - 1, rim), p.px(x, y + 1, rim);
      p.glow(x, y, 7, c, 0.4 * kk);
    } else p.glow(x, y, 4, c, 0.35 * kk);
    p.px(x, y, c);
  }

  // after the fire: the edge smoulders, red and dark, and fades
  const smoulder = seg(t, DOWN[0], DOWN[1]) * (1 - seg(t, DOWN[1], 2.5));
  if (smoulder > 0.02) {
    for (let x = -hw; x < hw; x++) {
      const g = 0.5 + 0.5 * N(t, 3, S + 11, x * 0.7);
      const a = smoulder * g;
      if (a > 0.5) p.px(x, bot, H[5]);
      else if (a > 0.25) p.px(x, bot, H[7]);
      else if (a > 0.08) p.dot(x, bot, H[8], a * 3);
    }
    p.glowLine(-hw, bot, hw, bot, 5 * k, H[6], 0.3 * smoulder);
  }
}
