// Made for the GoodWatch explorer map: title pun.
// A gold crown drops onto the poster's top edge, a bold diagonal shine sweeps across it, a star flares at its peak
// and gold sparkles fall over the poster. Never smaller than about 14 px wide, so it reads on tiny posters.
import { rng, clamp, seg, ease, WHITE, hex, fit, sparkle, flare, scale } from "../../core/index.js";
import { poster } from "./_pun2.js";
import { preview } from "./_pun1.js";

export const meta = {
  name: "Crown glint",
  desc: "A gold crown drops onto the poster's top edge, a bold shine band sweeps across it, a star flares at its peak and gold sparkles rain down over the poster.",
  tags: ["cinema", "pun", "crown", "king", "queen", "gold", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], jewel: "#e0304a", seed: 1, w: 40, h: 60 },
};

const FLARE = ["#4a2c08", "#f0b424", "#fff6c4", "#ffffff"];

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const { w, h, k } = poster(o), C = fit(o.palette, 8).map(hex), J = hex(o.jewel), JL = hex("#ff8a9a");
  const fade = 1 - seg(t, 1.85, 2.2);
  if (fade <= 0) return;
  // size: at least 15 px wide (odd, so the middle point sits on a pixel), half the poster on big ones
  const cw = Math.round(clamp(w * 0.5, 15, 46) / 2) * 2 + 1, half = (cw - 1) / 2;
  const bandH = Math.max(3, Math.round(cw * 0.2)), ptH = Math.max(5, Math.round(cw * 0.38)), chh = bandH + ptH;
  const drop = ease.outBack(seg(t, 0, 0.28), 2.4), lift = ease.inQuad(seg(t, 1.8, 2.2)) * 5;
  const base = Math.round(-h * 0.5 + bandH * 0.5 - (1 - drop) * 10 - lift), top = base - chh;
  const white = t < 0.06;

  // shape in crown pixels: ix -half..half, iy 0 at the bottom row
  const inside = (ix, iy) => {
    if (Math.abs(ix) > half || iy < 0 || iy >= chh) return false;
    if (iy < bandH) return true;
    // three points: tips at -half, 0, half, valleys between; side points a little shorter
    const v = (iy - bandH) / ptH, a = Math.abs(ix) / half; // 0 middle .. 1 edge
    const dist = Math.min(a, Math.abs(1 - a)) * 2; // 0 at a tip, 1 at a valley
    const tip = a > 0.5 ? 0.82 : 1;
    return v <= tip * (1 - dist) + 0.04 && v < tip;
  };
  // the shine: a 3 to 4 px diagonal band sweeping left to right, twice (big then a quick echo)
  const s1 = seg(t, 0.32, 0.72), s2 = seg(t, 1.05, 1.3);
  const sweepAt = (s) => (s > 0 && s < 1 ? -half - chh - 3 + ease.inOutQuad(s) * (cw + chh + 6) : null);
  const sw1 = sweepAt(s1), sw2 = sweepAt(s2), bw = Math.max(2, cw * 0.14);

  const L = Math.floor(-half) - 1, R = half + 1;
  for (let iy = -1; iy <= chh; iy++)
    for (let ix = L; ix <= R; ix++) {
      const x = ix, y = base - iy;
      if (!inside(ix, iy)) continue;
      const edgeT = !inside(ix, iy + 1), edgeB = !inside(ix, iy - 1), edgeL = !inside(ix - 1, iy), edgeR = !inside(ix + 1, iy);
      let c;
      if (white) c = WHITE;
      else {
        if (iy < bandH) {
          // band: lit top rim, dark bottom rim, jewels in the middle row
          const my = Math.floor(bandH / 2);
          if (edgeB) c = C[2];
          else if (edgeT) c = C[6];
          else if (iy === my && (Math.abs(ix) === 0 || Math.abs(Math.abs(ix) - Math.round(half * 0.6)) === 0)) c = ix === 0 ? J : hex("#3fa0e0");
          else c = ix < -half * 0.3 ? C[5] : ix < half * 0.4 ? C[4] : C[3];
        } else {
          c = edgeL || edgeT ? C[6] : edgeR ? C[2] : ix < -half * 0.2 ? C[5] : ix < half * 0.3 ? C[4] : C[3];
        }
        // a dark outline step at the base for weight
        if (edgeB && iy === 0) c = C[1];
        for (const sw of [sw1, sw2]) {
          if (sw === null) continue;
          const d = ix - sw + iy * 0.7; // slanted band
          if (Math.abs(d) < bw * 0.5) c = WHITE;
          else if (Math.abs(d) < bw * 0.5 + 1) c = C[6];
        }
      }
      p.dot(x, y, fade < 1 ? scale(c, 0.3 + 0.7 * fade) : c, clamp(fade / 0.3));
    }
  for (let iy = -1; iy <= chh + 1; iy++)
    for (let ix = L - 1; ix <= R + 1; ix++)
      if (!inside(ix, iy) && (inside(ix - 1, iy) || inside(ix + 1, iy) || inside(ix, iy - 1) || inside(ix, iy + 1)))
        p.blend(ix, base - iy, C[0], 0.6 * fade);
  // jewel highlight
  if (!white && fade > 0.5) p.px(0, base - Math.floor(bandH / 2) - (bandH > 3 ? 1 : 0), bandH > 3 ? JL : J);
  // balls on the three tips
  for (const j of [-1, 0, 1]) {
    const bx = j * half;
    let ty = 0;
    while (inside(bx, ty + 1)) ty++;
    const big = cw >= 19, by = base - ty - (big ? 2 : 1);
    const dim = (c) => (fade < 1 ? scale(c, 0.3 + 0.7 * fade) : c), fa = clamp(fade / 0.3);
    p.dot(bx, by, dim(white ? WHITE : j === 0 ? C[7] : C[6]), fa);
    if (big) { p.dot(bx - 1, by, dim(C[6]), fa); p.dot(bx + 1, by, dim(C[4]), fa); p.dot(bx, by - 1, dim(C[6]), fa); }
    p.light(bx, by, C[5], 0.35 * fade);
  }
  // light: a soft gold pool, brighter while the shine passes, and light riding the band
  const shine = Math.max(Math.sin(Math.PI * s1), 0.6 * Math.sin(Math.PI * s2));
  p.glow(0, base - chh * 0.5, cw * 1.3, C[4], (0.28 + 0.25 * shine) * fade);
  p.glow(0, base - chh * 0.5, cw * 0.6, C[6], (0.15 + 0.35 * (white ? 1 : 0)) * fade);
  for (const sw of [sw1, sw2]) {
    if (sw === null) continue;
    const mx = sw - chh * 0.35;
    if (Math.abs(mx) < half) p.glow(mx, base - chh * 0.5, 3 + chh * 0.4, C[7], 0.5 * fade);
  }

  // landing flare
  if (t < 0.14) flare(p, 0, base - chh * 0.5, cw * 0.8 * (0.5 + t * 5), 0.5, FLARE);
  // the star at the peak, right after the first sweep reaches it, again smaller after the echo
  const peakY = base - chh - 1;
  const g1 = seg(t, 0.58, 1.05), g2 = seg(t, 1.22, 1.55);
  if (g1 > 0 && g1 < 1) {
    const a = Math.sin(Math.PI * Math.pow(g1, 0.6));
    flare(p, 0, peakY, Math.max(3, cw * 0.45) * a, 0.6, FLARE);
    p.glow(0, peakY, 6 + cw * 0.5 * a, C[6], 0.6 * a);
  }
  if (g2 > 0 && g2 < 1) sparkle(p, 0, peakY, Math.round(Math.max(2, cw * 0.18) * Math.sin(Math.PI * g2)), C[6], C[4], 0.4);

  // gold sparkles falling over the poster, a few big twinkling crosses among dots, each lit
  const n = Math.round(clamp(14 * k, 12, 44));
  for (let i = 0; i < n; i++) {
    const r = rng(o.seed, i), t0 = 0.35 + r.range(0, 0.95), life = r.range(0.7, 1.1), u = (t - t0) / life;
    if (u < 0 || u >= 1) continue;
    const x = r.range(-0.55, 0.55) * Math.max(cw * 1.4, w * 0.9) + Math.sin(u * 5 + i) * 1.5;
    const y = base + 2 + ease.inQuad(u) * h * r.range(0.45, 0.95);
    const a = clamp((1 - u) * 2.2) * fade, big = r.next() < 0.3;
    if (big) {
      const tw = Math.sin(u * 14 + i * 1.7);
      if (tw > -0.2) sparkle(p, x, y, tw > 0.5 ? 2 : 1, C[6], C[4], 0.35 * a);
      else p.px(x, y, C[5]);
    } else {
      p.px(x, y, u < 0.4 ? C[6] : u < 0.75 ? C[5] : C[3]);
      if (u < 0.5) p.px(x, y - 1, C[3]);
    }
    p.light(x, y, C[5], 0.4 * a);
  }
}
