// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, rand, clamp, TAU } from "../../core/index.js";
import { count, radius } from "./_amb2.js";

export const meta = {
  name: "Old film grain",
  desc: "Over an old-film or history island: scratches flicker down the picture, dust specks and hairs pop for a frame or two, a sepia light flickers and a cue mark flashes.",
  tags: ["cinema", "ambient", "island", "film", "vintage", "history", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1c1408", "#4a3618", "#8c6c3c", "#d0b080", "#f4e6c4"], seed: 1, r: 30, density: 1 },
};

const FPS = 24; // film flickers at its own rate: a new "frame" of dirt every 1/24 s

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), D = meta.duration, S = o.seed, d2 = o.density >= 2;
  const NF = Math.round(D * FPS), f = Math.floor(t * FPS) % NF, q = (k, n = f) => rand(S, n, k);
  const top = -Math.min(R * 1.05, 50), bot = Math.min(R * 0.45, 44), H = bot - top, W = Math.min(R * 0.95, 54);

  // the projector light: a soft sepia pool that flickers frame to frame
  const fl = 0.75 + 0.25 * q(1) + (q(2) < 0.06 ? 0.35 : 0);
  const cy = (top + bot) / 2;
  p.glow(-W * 0.35, cy, R * 0.7, C[2], 0.17 * fl);
  p.glow(W * 0.35, cy, R * 0.7, C[2], 0.17 * fl);
  p.glow(0, cy, R * 0.6, C[3], 0.12 * fl);

  // scratches: long vertical lines that come and go, jittering a pixel sideways, sometimes broken
  const ns = R < 24 ? count(2, o.density) : count(3, o.density);
  for (let i = 0; i < ns; i++) {
    const per = (1.2 + rand(S, i, 31) * 1.3) * FPS, ph = rand(S, i, 32) * NF;
    const runs = Math.max(1, Math.round(NF / per)), L = NF / runs, k = (f + ph) % L, run = Math.floor((f + ph) / L) % runs;
    const on = Math.round(L * (0.3 + 0.35 * rand(S, i, 33, run)));
    if (k >= on) continue;
    const fr = Math.floor(k);
    if (rand(S, i, 34, run, fr) < 0.18) continue; // flickers out for a frame
    const x0 = (rand(S, i, 35, run) - 0.5) * 2 * W * 0.85, x = Math.round(x0 + (rand(S, i, 36, run, fr) < 0.35 ? (rand(S, i, 37, run, fr) < 0.5 ? -1 : 1) : 0));
    const y0 = top + H * rand(S, i, 38, run) * 0.25, y1 = bot - H * rand(S, i, 39, run) * 0.3;
    const bright = rand(S, i, 40, run) < 0.7, gap = rand(S, i, 41, run, fr);
    const g0 = y0 + (y1 - y0) * gap, gl = gap < 0.6 ? 2 + Math.round(gap * 6) : 0;
    const fade = Math.min(1, k / 1.5 + 0.4) * Math.min(1, (on - k) / 2 + 0.3);
    for (let y = Math.round(y0); y <= y1; y++) {
      if (y >= g0 && y < g0 + gl) continue;
      const u = (y - y0) / (y1 - y0), end = u < 0.1 || u > 0.9;
      const lv = (end ? 1 : bright ? 3 : 2) + (fade > 0.7 ? 1 : 0) - 1;
      p.px(x, y, C[clamp(lv, 1, 4)]);
      if (bright && !end && fade > 0.7 && (y & 3) !== 0) p.dot(x + 1, y, C[1], 0.5);
    }
    p.glowLine(x, y0, x, y1, 2.5, C[3], 0.22 * fade);
  }

  // dust specks: irregular blobs for a frame or two
  const nd = d2 ? 9 : 5;
  for (let j = 0; j < nd; j++) {
    const fb = f - (f % 2), life = q(50 + j, fb) < 0.5 ? 2 : 1;
    if (life === 1 && f !== fb) continue;
    if (q(51 + j * 3, fb) < 0.35) continue;
    const x = Math.round((q(52 + j * 5, fb) - 0.5) * 2 * W), y = Math.round(top + q(53 + j * 7, fb) * H);
    const big = q(54 + j * 11, fb), c = big < 0.75 ? C[4] : C[3];
    p.px(x, y, c);
    if (big > 0.35) p.px(x + 1, y, C[3]);
    if (big > 0.55) p.px(x, y + 1, C[3]);
    if (big > 0.8) { p.px(x + 1, y + 1, C[4]); p.px(x - 1, y + 1, C[2]); p.px(x + 1, y - 1, C[2]); }
    p.glow(x + 0.5, y + 0.5, 2.5, C[3], 0.18);
  }

  // hairs: a curly line that sits for a few frames
  const nh = d2 ? 3 : 2;
  for (let j = 0; j < nh; j++) {
    const blk = Math.floor(f / 6), bf = blk * 6;
    if (rand(S, 70 + j, blk) > 0.28) continue;
    const kf = f - bf, len = Math.round((8 + Math.floor(rand(S, 71 + j, blk) * 7)) * clamp(R / 30, 0.7, 1.6));
    if (kf >= 2 + Math.floor(rand(S, 72 + j, blk) * 4)) continue;
    const x0 = (rand(S, 73 + j, blk) - 0.5) * 1.6 * W, y0 = top + rand(S, 74 + j, blk) * H * 0.8;
    const ang = rand(S, 75 + j, blk) * TAU, cv = 0.05 + rand(S, 76 + j, blk) * 0.12, sg = rand(S, 77 + j, blk) < 0.5 ? -1 : 1;
    let x = x0, y = y0, a = ang;
    for (let s = 0; s < len; s++) {
      p.px(Math.round(x), Math.round(y), s === 0 || s === len - 1 ? C[3] : C[4]);
      a += cv * sg * (s > len * 0.7 ? 3 : 1);
      x += Math.cos(a); y += Math.sin(a) * 0.9;
    }
    p.glow(x0, y0, len * 0.6, C[3], 0.1);
  }

  // a frame-line slip: once a loop, the gate edge flashes across the picture for three frames
  const fs = Math.floor(rand(S, 90) * (NF - 4)), ks = f - fs;
  if (ks >= 0 && ks < 3) {
    const y = Math.round(top + H * (0.15 + ks * 0.3)), a = ks === 0 ? 1 : ks === 1 ? 0.75 : 0.45;
    const hw = Math.round(W * (ks === 2 ? 0.75 : 1));
    for (let x = -hw; x <= hw; x++) {
      const e = Math.abs(x) / hw, end = e > 0.85;
      p.px(x, y, end ? C[2] : ks === 0 ? C[4] : C[3]);
      if (!end && ks < 2) p.px(x, y + 1, C[2]);
    }
    p.glowLine(-W, y, W, y, 4, C[4], 0.35 * a);
  }

  // a cue mark: a small ring top right, flashing for four frames, once a loop
  const fc = (fs + Math.floor(NF / 2)) % (NF - 5), kc = f - fc;
  if (kc >= 0 && kc < 4 && kc !== 2) {
    const cx = Math.round(W * 0.7), cy = Math.round(top + H * 0.12), rr = clamp(Math.round(R / 10), 2, 4);
    p.ring(cx, cy, rr, 1, C[4]);
    p.dot(cx, cy, C[3], 0.7);
    p.glow(cx, cy, rr * 2.5, C[4], 0.3);
  }
}
