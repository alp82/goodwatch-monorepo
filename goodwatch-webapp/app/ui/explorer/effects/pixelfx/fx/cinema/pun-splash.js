// Made for the GoodWatch explorer map: title pun.
// A water crown bursts up along a poster's lower edge: tines throw droplets that arc and fall back, rings run out on
// the water, foam settles. With fin: true a big dark fin first cuts across the water line with a white wake and
// spray, dives at the middle, and the splash erupts where it went down.
import { PAL, fit, burst, fly, seg, ease, clamp, TAU, WHITE, hex, scale, rng } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: splash",
  desc: "A water crown bursts up along the poster's lower edge, droplets arc and fall, rings spread, foam settles; with fin, a big dark fin cuts in with a wake first and dives.",
  tags: ["cinema", "pun", "water", "splash", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: PAL.water, seed: 1, w: 40, h: 60, fin: false },
};

const FIN = hex("#26364a"), FIN_MID = hex("#46607c"), FIN_DK = hex("#04060a"), FIN_LIT = hex("#b4d0e8"), FIN_BACK = hex("#4f7396");

export function drawBack(p, t, o) {
  preview(p, o);
}

// with fin: the fin cuts in for FT seconds, dives, and the splash erupts where it went down
const FT = 0.85;

export function draw(p, t, o) {
  if (o.fin) {
    drawFin(p, t, o);
    if (t >= FT - 0.02) drawSplash(p, Math.max(0, t - FT + 0.02), o);
  } else drawSplash(p, t, o);
}

function drawSplash(p, t, o) {
  const C = fit(o.palette, 8), { hw, hh, s } = dims(o), base = hh - 1, D = meta.duration;
  const span = hw * 1.15, H = Math.max(8, hh * 0.85);

  // the crown: tines rise fast from the middle outward, hang, then slump back into the water
  const rise = ease.outQuart(seg(t, 0, 0.22)), fall = ease.inQuad(seg(t, 0.3, 0.95));
  const n = Math.ceil(span * 2);
  const crest = (i) => {
    const u = i / span, r = rng(o.seed, Math.round(i / 3), 3), tine = r.next() < 0.35 ? 1.25 + r.next() * 0.3 : 1;
    const m = (i / 3) % 1, peak = 1 - Math.abs(m - 0.5) * 0.5 * (tine - 1) * 4;
    return (0.3 + 0.7 * Math.pow(Math.abs(u), 1.4)) * (1 + (tine - 1) * peak) * (0.85 + rng(o.seed, i, 4).next() * 0.1);
  };
  let prev = null;
  for (let i = -span; i <= span; i++) {
    const x = i, delay = Math.abs(i / span) * 0.06;
    const up = ease.outQuart(seg(t, delay, 0.22 + delay)) * (1 - fall);
    const top = Math.round(base - H * crest(i) * up);
    if (base - top < 1) { prev = null; continue; }
    // a lip of light, a glassy sheet under it (truly translucent), a second rim lower down: the far wall
    p.px(x, top, up > 0.75 && fall < 0.3 ? WHITE : C[6]);
    if (prev !== null && Math.abs(prev - top) > 1) for (let y = Math.min(prev, top) + 1; y < Math.max(prev, top); y++) p.px(x, y, C[6]);
    prev = top;
    p.px(x, top + 1, C[5]);
    for (let y = top + 2; y < base; y++) {
      const v = (y - top) / (base - top);
      p.blend(x, y, v < 0.3 ? C[4] : C[3], (0.75 - v * 0.45) * (1 - fall * 0.5));
    }
    const far = Math.round(top + (base - top) * 0.45);
    if (Math.abs(i) < span * 0.8 && far < base - 1) p.dot(x, far, C[5], 0.7);
    p.light(x, top, C[5], 0.18 * up);
  }
  // a white hero line where the water was hit
  if (t < 0.07) {
    p.line(-span, base, span, base, WHITE);
    p.glowLine(-span * 0.6, base, span * 0.6, base, 8 * s, C[6], 0.6);
  }
  p.glowLine(-span, base - H * 0.3, span, base - H * 0.3, H * 0.6, C[4], 0.22 * rise * (1 - fall));

  // droplets thrown off the tines, falling back to the water line
  burst(Math.round(18 + 6 * s), o.seed + 7, (r) => {
    const u = r.range(-1, 1), x0 = u * span, d = r.range(0.06, 0.22);
    const vx = u * r.range(20, 60) * s + r.range(-10, 10), vy = -r.range(70, 150) * Math.sqrt(s);
    const age = t - d;
    if (age <= 0) return;
    const y0 = base - H * (0.35 + 0.65 * Math.abs(u)) * 0.8;
    const [x, y] = fly(x0, y0, vx, vy, age, 380 * Math.sqrt(s), 0.8);
    if (y > base || y < -hh * 1.75) return;
    const [x1, y1] = fly(x0, y0, vx, vy, Math.max(0, age - 0.025), 380 * Math.sqrt(s), 0.8);
    const big = r.next() < 0.35;
    p.line(x1, y1, x, y, C[5]);
    p.px(x, y, big ? WHITE : C[6]);
    if (big) p.px(x + 1, y, C[5]);
    p.light(x, y, C[5], 0.3);
  });

  // rings on the water: flat ellipses opening out
  for (let k = 0; k < 2; k++) {
    const a = seg(t, 0.1 + k * 0.35, 1.5 + k * 0.4);
    if (a <= 0 || a >= 1) continue;
    const rx = span * (0.35 + 0.75 * ease.outCubic(a)), ry = Math.max(1.2, rx * 0.12);
    for (let j = 0, m = Math.ceil(rx * 4); j < m; j++) {
      const g = (j / m) * TAU, x = Math.cos(g) * rx, y = base + Math.sin(g) * ry;
      if (Math.abs(x) > hw * 1.7) continue;
      p.dot(x, y, Math.sin(g) > 0 ? C[6] : C[4], (1 - a) * 1.1);
    }
  }
  // foam lying on the line, breaking up
  const foam = 1 - seg(t, 0.2, 1.9);
  if (foam > 0)
    for (let x = -span; x <= span; x++) {
      const r = rng(o.seed, x | 0, 11);
      p.dot(x, base + (r.next() < 0.3 ? 1 : 0), r.next() < 0.3 ? C[6] : C[5], foam * (0.5 + r.next() * 0.6));
    }
}

// A dark fin, about a third of the poster wide, rises out of the water at the poster's lower left, cuts right with a
// white bow wave, a spreading wake and spray off its leading edge, then dives at the middle.
function drawFin(p, t, o) {
  const C = fit(o.palette, 8), { w, hw, hh, s } = dims(o), base = hh - 1;
  const fw = Math.max(11, Math.round(w * 0.44)), fh = Math.max(12, Math.round(fw * 1.15));
  const x0 = -hw - fw * 0.3, x1 = Math.round(fw * 0.5);
  const go = (tt) => x0 + (x1 - x0) * ease.inOutSine(clamp(tt / (FT - 0.08)));
  const fx = go(t);
  // rise out of the water, then dive fast at the end
  const emerge = ease.outCubic(seg(t, 0, 0.22)), dive = ease.inCubic(seg(t, FT - 0.25, FT));
  const sink = (1 - emerge) * fh + dive * (fh + 1);
  const wl = clamp(seg(t, 0, 0.12)) * (1 - seg(t, FT - 0.05, FT + 0.1));

  // the water line across the poster: a broken lit ripple, so the fin has something to cut through
  if (wl > 0)
    for (let x = Math.floor(-hw * 1.15); x <= hw * 1.15; x++) {
      const r = rng(o.seed, x + 200, 21), m = Math.sin(x * 0.7 + t * 9 + r.next() * 2);
      if (m > 0.2) p.dot(x, base + (m > 0.85 ? -1 : 0), m > 0.75 ? C[6] : C[4], wl * 0.9);
    }
  if (t >= FT + 0.02) return;

  // wake: two arms spreading back from the fin, white near it, thinning out behind
  const len = Math.min(fx - x0 + 2, hw * 1.4) * (1 - dive * 0.6);
  for (let d = 0; d < len; d++) {
    const k = 1 - d / len, bx = fx - fw * 0.9 - d;
    const ya = base - 1 - Math.floor(d * 0.1), yb = base + 1 + Math.floor(d * 0.14);
    p.dot(bx, ya, k > 0.7 ? WHITE : k > 0.4 ? C[6] : C[5], Math.min(1, k * 1.4));
    p.dot(bx, yb, k > 0.6 ? C[6] : C[5], k * 1.1);
    if (k > 0.5 && rng(o.seed, Math.floor(bx - t * 40), 23).next() < 0.5) p.dot(bx, base, C[6], k);
  }
  p.glowLine(fx - fw - len * 0.6, base, fx, base, 4, C[5], 0.3 * emerge);

  // the fin itself, clipped at the water line
  const tip = fx - fw * 0.78;
  const top = base - fh + sink;
  if (base - top > 0.5) {
    p.shade(fx - fw - 1, Math.floor(top) - 1, fx + 1, base, (x, y, out) => {
      const v = (base - y + sink) / fh; // 0 at the fin's root, 1 at its tip
      if (v < 0 || v > 1 || y > base - 0.5) return;
      const front = fx - (fx - tip) * Math.pow(v, 1.7);
      const back = fx - fw + (fw - (fx - tip)) * (1 - (1 - v) * (1 - v)) + 0.9 * fw * 0.25 * Math.sin(Math.PI * v) * 0.6;
      if (x < back || x > front) return;
      const dF = front - x, dB = x - back;
      if (dF < 1.1) return v > 0.75 ? WHITE : FIN_LIT;
      if (dF < 2.2 && v > 0.15) return FIN_MID;
      if (dB < 1.1) return v > 0.3 ? FIN_BACK : FIN_DK;
      return dF < 3.5 && v > 0.4 ? FIN_MID : FIN;
    });
    // a faint dark reflection under the line
    for (let y = 1; y <= 2; y++) for (let x = Math.round(fx - fw * 0.85); x <= fx; x++) p.blend(x, base + y, FIN_DK, 0.4 - y * 0.1);
    // the tip catches the light
    if (top < base - 2) p.light(tip, top + 1, C[6], 0.35);
  }

  // bow wave: a white curl pushed up in front of the fin, foam at its root
  const bow = emerge * (1 - dive);
  if (bow > 0.05) {
    const hgt = Math.max(1, Math.round(2 + s * 1.5) * bow);
    for (let i = 0; i < hgt; i++) { p.px(fx + 1 + (i > 1 ? 1 : 0), base - i, i === hgt - 1 ? WHITE : C[6]); }
    p.px(fx + 2, base, WHITE); p.px(fx + 3, base, C[6]); p.px(fx + 2, base - 1, C[6]);
    for (let x = Math.round(fx - fw); x <= fx; x++) if (rng(o.seed, Math.floor(x - t * 30), 25).next() < 0.6) p.px(x, base, WHITE);
    p.light(fx + 2, base - 1, C[6], 0.6 * bow);
    p.glow(fx + 3, base - 1, 5, C[5], 0.35 * bow);
    p.glow(fx - fw * 0.5, base + 1, fw * 0.7, C[4], 0.15 * bow);
  }

  // spray flicked up and back off the leading edge
  burst(Math.round(9 + 4 * s), o.seed + 31, (r) => {
    const b = r.range(0.1, FT - 0.1), age = t - b;
    if (age <= 0) return;
    const sx = go(b) + 2, vx = r.range(-25, 15) * Math.sqrt(s), vy = -r.range(40, 80) * Math.sqrt(s);
    if (age > 0.6) return;
    const [x, y] = fly(sx, base - 1, vx, vy, age, 380, 0.5);
    if (y > base) return;
    const [xp, yp] = fly(sx, base - 1, vx, vy, Math.max(0, age - 0.03), 380, 0.5);
    p.line(xp, yp, x, y, C[5]);
    p.px(x, y, r.next() < 0.4 ? WHITE : C[6]);
    p.light(x, y, C[5], 0.25);
  });
}
