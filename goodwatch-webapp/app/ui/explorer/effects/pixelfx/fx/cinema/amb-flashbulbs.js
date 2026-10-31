// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, rand, seg, ease, WHITE } from "../../core/index.js";
import { AMB, count } from "./_amb1.js";

export const meta = {
  name: "Press flashbulbs",
  desc: "Politics island: press camera flashes pop like a scrum, each a white star flare with a blue-white burst and a fading afterglow, irregular, sometimes two at once.",
  tags: ["cinema", "ambient", "island", "politics", "camera", "flash", "press", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: { palette: ["#0c1640", "#2a54c0", "#6f9cff", "#c6dcff", "#ffffff"], seed: 1, r: 30, density: 1 },
};

const LIFE = 1.1;

// one flash: a hero frame, a star flare that snaps back, a ring of light, then a small afterglow that cools
function flash(p, age, x, y, s, C) {
  if (age < 0.07) {
    // hero frame: a wide white star and a big pool
    const L = 5 * s;
    for (let d = 1; d <= L; d++) {
      const c = d < L * 0.5 ? WHITE : C[3];
      p.px(x + d, y, c); p.px(x - d, y, c); p.px(x, y + d, c); p.px(x, y - d, c);
    }
    for (let d = 1; d <= L * 0.45; d++) {
      const c = d < 2 ? WHITE : C[3];
      p.px(x + d, y + d, c); p.px(x - d, y - d, c); p.px(x + d, y - d, c); p.px(x - d, y + d, c);
    }
    p.rect(x - 1, y - 1, 3, 3, WHITE);
    // the lens streak, wide and flat
    for (let d = L + 1; d <= L * 2.6; d++) { const a = 1 - (d - L) / (L * 1.6); p.blend(x + d, y, C[3], a); p.blend(x - d, y, C[3], a); }
    p.glow(x, y, 16 * s, C[3], 0.65);
    p.glow(x, y, 6 * s, WHITE, 0.5);
    return;
  }
  const k = seg(age, 0.07, LIFE), q = ease.outCubic(seg(age, 0.07, 0.5));
  // the star snaps back fast
  const L = 5 * s * (1 - q);
  if (L >= 1) {
    for (let d = 1; d <= L; d++) {
      const c = d < L * 0.45 ? C[4] : d < L * 0.8 ? C[3] : C[2];
      p.px(x + d, y, c); p.px(x - d, y, c); p.px(x, y + d, c); p.px(x, y - d, c);
    }
    if (L > 2) { p.px(x + 1, y + 1, C[3]); p.px(x - 1, y - 1, C[3]); p.px(x + 1, y - 1, C[3]); p.px(x - 1, y + 1, C[3]); }
  }
  // the lens streak shrinks to the core
  const sl = 13 * s * (1 - ease.outQuart(seg(age, 0.07, 0.4)));
  for (let d = Math.max(2, L + 1); d <= sl; d++) { const a = (1 - d / (sl + 1)) * 0.9; p.blend(x + d, y, C[3], a); p.blend(x - d, y, C[3], a); }
  if (sl > 2) p.glowLine(x - sl, y, x + sl, y, 2, C[2], 0.18);
  // a quick ring of blue-white light spreading out
  if (age < 0.34) {
    const q2 = ease.outQuart(seg(age, 0.07, 0.34)), rr = 2 + 8 * s * q2, a = 1 - q2;
    p.disc(x, y, rr, C[3], 0.22 * a);
    p.glowRing(x, y, rr, 1.5, C[3], 0.35 * a);
    const n = Math.max(8, Math.round(rr * 2.2));
    for (let i = 0; i < n; i++) {
      const an = (i / n) * Math.PI * 2;
      p.dot(x + Math.cos(an) * rr, y + Math.sin(an) * rr, a > 0.5 ? C[3] : C[2], a * 0.9);
    }
  }
  // afterglow: the core cools from white through pale blue and goes
  const core = k < 0.3 ? WHITE : k < 0.55 ? C[3] : k < 0.8 ? C[2] : C[1];
  p.px(x, y, core);
  if (k < 0.7) {
    const e = k < 0.35 ? C[3] : C[2];
    p.px(x + 1, y, e); p.px(x - 1, y, e); p.px(x, y - 1, e); p.px(x, y + 1, e);
    if (k < 0.4) { p.px(x + 1, y + 1, C[1]); p.px(x - 1, y - 1, C[1]); p.px(x + 1, y - 1, C[1]); p.px(x - 1, y + 1, C[1]); }
  }
  p.glow(x, y, 12 * s, C[2], 0.45 * (1 - k) * (1 - k));
  p.light(x, y, C[3], 0.5 * (1 - k));
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), D = meta.duration, r = o.r ?? 30, S = o.seed;
  const s = Math.max(0.8, Math.min(1.8, r / 30)), n = count(o, 5);
  // far back in the scrum: little pops, a cross for a frame or two, then a dying dot
  const m = count(o, 7);
  for (let i = 0; i < m; i++) {
    const R = (k) => rand(S, 50 + i, k), age = (((t - R(1) * D) % D) + D) % D;
    if (age >= 0.2) continue;
    const x = Math.round((R(2) - 0.5) * r * 1.7), y = Math.round(-r * (0.05 + R(3) * 0.8));
    if (age < 0.07) {
      p.px(x, y, WHITE); p.px(x + 1, y, C[3]); p.px(x - 1, y, C[3]); p.px(x, y + 1, C[3]); p.px(x, y - 1, C[3]);
      p.glow(x, y, 6, C[3], 0.4);
    } else p.px(x, y, age < 0.13 ? C[3] : C[2]);
  }
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k);
    // irregular: bunched toward random moments, not evenly spaced
    const born = ((i + R(1) * 0.9) / n) * D;
    const pair = R(2) < 0.3;
    for (let j = 0; j < (pair ? 2 : 1); j++) {
      const age = (((t - born - j * 0.09) % D) + D) % D;
      if (age >= LIFE) continue;
      const a = R(3 + j * 4) * Math.PI * 2, d = r * (0.25 + R(4 + j * 4) * 0.75);
      const x = Math.round(Math.cos(a) * d), y = Math.round(-Math.abs(Math.sin(a)) * d * 0.85 + r * 0.12);
      flash(p, age, x, y, s * (0.75 + R(5 + j * 4) * 0.4), C);
    }
  }
}
