import { rng, clamp, seg, ease, TAU, WHITE, hex, fit, sparkle } from "../../core/index.js";
import { poster } from "./_pun2.js";

export const meta = {
  name: "Night falls",
  desc: "A crescent moon rises at the poster's top corner with a cool halo, stars wink on one after another round the poster, then the night fades away.",
  tags: ["cinema", "pun", "night", "moon", "stars", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#141830", "#3a4470", "#8a94c0", "#e8e0c8", "#fff8e0", "#ffffff"], seed: 1, w: 40, h: 60 },
};

export function draw(p, t, o) {
  const { w, h, k } = poster(o), C = fit(o.palette, 6).map(hex), sk = Math.sqrt(k);
  const fade = 1 - seg(t, 1.9, 2.35);
  if (fade <= 0) return;
  const set = ease.inCubic(seg(t, 1.6, 2.2));
  // the moon rises from behind the top-right corner
  const mr = clamp(w * 0.16, 4, 16), rise = ease.outCubic(seg(t, 0, 0.6));
  const mx = w * 0.5 - mr * 0.4, my = -h * 0.5 + mr * 0.6 - rise * mr * 1.6 + set * mr * 1.6;
  const ma = seg(t, 0, 0.12) * (1 - set);
  p.glow(mx, my, mr * 4, C[2], 0.32 * ma * rise);
  const r2 = mr * mr, off = mr * 0.55;
  p.shade(mx - mr - 1, my - mr - 1, mx + mr + 1, my + mr + 1, (x, y, out) => {
    const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy;
    if (d2 > r2) return;
    const ex = dx - off, ey = dy + off * 0.45;
    if (ex * ex + ey * ey < r2 * 0.88) return;
    out.a = ma;
    const d = Math.sqrt(d2) / mr;
    if (d > 0.86) return dx < 0 ? C[3] : C[2];
    return dx < -mr * 0.35 && dy < 0 ? WHITE : C[4];
  });
  // a white flash at the moon when it peaks
  if (t > 0.55 && t < 0.7) p.glow(mx, my, mr * 2, WHITE, 0.4 * (1 - (t - 0.55) / 0.15));
  // stars around and over the poster wink on in turn
  const n = Math.round(clamp(12 * k, 10, 30));
  for (let i = 0; i < n; i++) {
    const r = rng(o.seed, i), side = r.next();
    let x, y;
    if (side < 0.45) (x = r.range(-0.55, 0.45) * w), (y = -h * 0.5 - r.range(1, 0.3 * h));
    else if (side < 0.75) (x = -w * 0.5 - r.range(1, 0.12 * w + 3)), (y = r.range(-0.5, 0.4) * h);
    else (x = w * 0.5 + r.range(1, 0.12 * w + 3)), (y = r.range(-0.2, 0.45) * h);
    const on = 0.2 + (i / n) * 0.9 + r.range(0, 0.15), u = t - on;
    if (u < 0) continue;
    const tw = 0.6 + 0.4 * Math.sin(u * r.range(7, 12) + i);
    const pop = u < 0.12 ? 1 + (1 - u / 0.12) : 1;
    const a = Math.min(1, u * 8) * fade;
    const arm = Math.round((r.next() < 0.35 ? 2.4 : 1.2) * pop * tw * sk);
    if (arm >= 1 && a > 0.5) sparkle(p, x, y, arm, C[3], C[2], 0.3 * a);
    else p.dot(x, y, C[4], a);
    p.light(x, y, C[3], 0.3 * a * tw);
  }
}
