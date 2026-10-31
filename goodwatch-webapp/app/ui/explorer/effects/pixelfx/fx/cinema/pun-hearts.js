import { rng, clamp, seg, ease, TAU, WHITE, hex, fit, scale } from "../../core/index.js";
import { poster, heartField } from "./_pun2.js";

export const meta = {
  name: "Heart float",
  desc: "Hearts pop up all over the poster with a springy squash, then float up swaying and wink out; a soft pink flush breathes behind them.",
  tags: ["cinema", "pun", "love", "heart", "romance", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#3a0a22", "#8a1a44", "#e0386a", "#ff7aa0", "#ffc8d8", "#ffffff"], seed: 1, w: 40, h: 60 },
};

function heart(p, x, y, s, C, a) {
  const r = s + 1;
  p.shade(x - r, y - r, x + r, y + r, (px, py, out) => {
    const dx = px - x, dy = py - y, f = heartField(dx, dy, s);
    if (f > 0) return;
    out.a = a;
    const edge = heartField(dx * 1.22, dy * 1.22, s) > 0;
    if (edge) return dy > 0 ? C[1] : C[2];
    if (dx < -s * 0.15 && dy < -s * 0.25 && dx > -s * 0.7) return dy < -s * 0.45 ? WHITE : C[4];
    return dx + dy > s * 0.4 ? C[2] : C[3];
  });
}

export function draw(p, t, o) {
  const { w, h, k } = poster(o), C = fit(o.palette, 6).map(hex);
  const n = Math.round(clamp(9 * k, 8, 24));
  const fl = seg(t, 0, 0.15) * (1 - seg(t, 0.4, 1.8));
  if (fl > 0) p.glow(0, 0, Math.max(w, h) * 0.6, C[3], 0.22 * fl);
  for (let i = 0; i < n; i++) {
    const r = rng(o.seed, i);
    const x0 = ((i + r.range(0.1, 0.9)) / n - 0.5) * 0.9 * w, y0 = r.range(-0.3, 0.4) * h, born = r.range(0, 0.55), life = r.range(1.2, 1.65);
    const age = t - born;
    if (age < 0 || age >= life) continue;
    const u = age / life, s0 = r.range(2.2, 3.8) * Math.sqrt(k);
    const pop = ease.outBack(seg(age, 0, 0.22), 3), s = s0 * pop * (1 - 0.35 * u);
    if (s < 1.2) continue;
    const ph = r.range(0, TAU);
    const x = x0 + Math.sin(ph + age * 3) * 2.5 * Math.sqrt(k), y = y0 - age * r.range(12, 22) * Math.sqrt(k);
    const a = clamp((1 - u) * 3);
    heart(p, x, y, s, C, a);
    p.glow(x, y, s * 2.4, C[3], 0.25 * a);
    if (age < 0.08) p.glow(x, y, s * 2, WHITE, 0.5);
  }
}
