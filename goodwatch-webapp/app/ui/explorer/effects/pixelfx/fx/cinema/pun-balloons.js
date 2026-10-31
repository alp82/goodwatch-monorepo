// A bunch of little round balloons is let go from a poster: a pop of glitter, then they rise at their own pace,
// bobbing and swaying on wavy strings, catching a highlight, and thin away above it.
import { PAL, fit, rng, burst, fly, seg, ease, clamp, TAU, WHITE, hex, scale, mix } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: balloons",
  desc: "A bunch of little round balloons is let go from the poster with a pop of glitter, rising at their own pace, bobbing and swaying on wavy strings, thinning away above it.",
  tags: ["cinema", "pun", "balloons", "party", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: PAL.candy, seed: 1, w: 40, h: 60, count: 7 },
};

const STRING = hex("#c9c4d6");

export function drawBack(p, t, o) {
  preview(p, o);
}

function balloon(p, x, y, r, c, a, tilt) {
  const dk = scale(c, 0.55), lt = mix(c, WHITE, 0.45);
  p.shade(x - r - 1, y - r * 1.2 - 1, x + r + 1, y + r * 1.2 + 1, (px, py) => {
    const dx = px - x, dy = py - y, e = (dx * dx) / (r * r) + (dy * dy) / (r * r * 1.35);
    if (e > 1) return;
    // light from the top left: a lit cap, a dark rim bottom right
    const side = (dx + dy * 0.8) / r;
    const col = e > 0.72 && side > 0.15 ? dk : side < -0.55 && e > 0.25 ? lt : c;
    p.blend(px, py, col, a);
  });
  // highlight: two pixels near the top left
  p.blend(x - r * 0.4, y - r * 0.55, WHITE, a);
  if (r > 3.5) p.blend(x - r * 0.4, y - r * 0.55 + 1, lt, a);
  // the knot
  const ky = y + r * 1.16;
  p.blend(x + tilt, ky, dk, a);
  p.blend(x + tilt - 1, ky + 1, dk, a);
  p.blend(x + tilt + 1, ky + 1, dk, a);
}

export function draw(p, t, o) {
  const C = o.palette.map(hex), { hw, hh, s } = dims(o), k = Math.max(0.6, s), n = o.count ?? 7;
  // let go: glitter bursts from the middle of the bunch
  const bx = 0, by = hh * 0.25;
  if (t < 0.08) p.glow(bx, by, 12 * k, WHITE, 0.5);
  burst(14, o.seed + 3, (r) => {
    const a = r.range(0, TAU), sp = r.range(30, 70) * k, life = r.range(0.3, 0.6);
    if (t > life) return;
    const [x, y] = fly(bx, by, Math.cos(a) * sp, Math.sin(a) * sp, t, 60, 3);
    p.dot(x, y, r.next() < 0.4 ? WHITE : C[Math.floor(r.next() * C.length)], 1.3 - t / life);
  });

  for (let i = 0; i < n; i++) {
    const r = rng(o.seed, i, 13);
    const born = r.range(0, 0.18), age = t - born, life = meta.duration - born - 0.05;
    if (age < 0) continue;
    const q = age / life;
    const R = Math.max(2.5, r.range(3, 4.4) * k);
    // they start bunched, fan out a little, and rise with a slight ease in
    const fan = ((((i * 3) % n) + 0.5) / n * 2 - 1) * hw * 0.8;
    const x0 = bx + fan * 0.35 + r.range(-1, 1), y0 = by - r.range(0, hh * 0.25);
    const rise = (r.range(0.6, 1.15) * hh * 1.55) * ease.inOutSine(clamp(age / (life * 0.95)));
    const sw = Math.sin(age * r.range(2.5, 3.5) + i * 1.7) * hw * 0.08;
    const x = x0 + fan * 0.65 * ease.outCubic(clamp(age * 1.2)) + sw, y = y0 - rise;
    const a = Math.min(clamp(age / 0.08), 1 - seg(q, 0.55, 0.92));
    if (a <= 0) continue;
    const c = C[(i * 3 + Math.floor(r.next() * 2)) % C.length];
    const tilt = Math.round(Math.cos(age * 3 + i) * 0.6);
    // the string: a wavy line hanging from the knot, trailing the sway
    const L = R * 2.6, top = y + R * 1.2 + 1;
    for (let d = 0; d < L; d += 1) {
      const u = d / L;
      p.blend(x + tilt + Math.sin(age * 6 + d * 0.5 + i) * u * 1.6 - sw * u * 0.4, top + d, STRING, a * (0.9 - u * 0.5));
    }
    balloon(p, x, y, R, c, a, tilt);
    p.glow(x, y, R * 2.2, c, 0.18 * a);
  }
}
