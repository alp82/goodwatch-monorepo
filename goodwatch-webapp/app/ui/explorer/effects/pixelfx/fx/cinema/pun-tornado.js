// A small twister spins up over a poster: a gust ring kicks off at its foot, a funnel of streaks winds up from a thin
// tip to a wide mouth, swaying, with grit whirling round it; then it lifts off and flings everything outward.
import { fit, rng, burst, seg, ease, clamp, TAU, WHITE } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: tornado",
  desc: "A gust ring kicks off and a twister winds up over the poster from a thin tip to a wide mouth, swaying, grit whirling round it, then lifts off and flings it all outward.",
  tags: ["cinema", "pun", "tornado", "storm", "wind", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#14161e", "#262b38", "#3c4456", "#5a6478", "#8290a6", "#b4c0d2", "#e6eef8"], debris: ["#3a2a1c", "#6a4e30", "#9a7a50"], seed: 1, w: 40, h: 60 },
};

const LIFT = 1.35;

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), Dc = fit(o.debris, 3), { hw, hh, s } = dims(o), k = Math.max(0.6, s);
  const grow = ease.outCubic(seg(t, 0.05, 0.45)), lift = ease.inQuad(seg(t, LIFT, 2.1));
  const yb = hh * 0.5 - lift * hh * 0.9, yt = -hh * 1.35 - lift * hh * 0.25;
  const rb = 1.5 * k, rt = hw * 0.85;
  const sway = (u) => Math.sin(t * 3.2 - u * 2.2) * hw * 0.18 * u + Math.sin(t * 1.7) * hw * 0.08;
  const at = (u) => yb + (yt - yb) * u;
  const rad = (u) => (rb + (rt - rb) * Math.pow(u, 1.5)) * (1 + lift * 0.9);
  const fade = 1 - seg(t, LIFT + 0.2, 2.1);

  // the gust ring where it touches down
  const g = seg(t, 0.05, 0.6);
  if (g > 0 && g < 1) {
    const rx = hw * (0.2 + g * 0.9), ry = rx * 0.2, a = (1 - g) * 0.9;
    for (let j = 0, m = Math.ceil(rx * 5); j < m; j++) {
      const an = (j / m) * TAU;
      p.dot(Math.cos(an) * rx, hh * 0.5 + Math.sin(an) * ry, Math.sin(an) > 0 ? C[5] : C[3], a);
    }
  }
  // dust churned up at its foot
  if (fade > 0)
    burst(6, o.seed + 2, (r) => {
      const ph = (t * r.range(0.6, 1.1) + r.next()) % 1, x = Math.cos(r.range(0, TAU) + t * 4) * hw * 0.4 * ph;
      p.disc(x + sway(0), hh * 0.5 - ph * hh * 0.25, (2 + ph * 4) * k, C[3], 0.3 * (1 - ph) * grow * fade);
    });

  // the funnel: streaks orbiting at their own heights, bright on the near side, dim behind
  const n = Math.round(40 + 12 * s);
  for (let i = 0; i < n; i++) {
    const r = rng(o.seed, i, 5), u = Math.pow(r.next(), 0.8);
    if (u > grow) continue;
    const R = rad(u), y = at(u), cx = sway(u), w = r.range(9, 14) * (1.3 - u * 0.5);
    const a0 = r.range(0, TAU) + t * w, len = r.range(0.5, 1.1);
    const al = fade * clamp((grow - u) * 6) * (u > 0.92 ? 0.7 : 1);
    const m = Math.max(4, Math.ceil(len * R * 1.2));
    for (let j = 0; j < m; j++) {
      const q = j / (m - 1), an = a0 - q * len, sn = Math.sin(an), front = sn > 0;
      const x = cx + Math.cos(an) * R, yy = y + sn * R * 0.22;
      const c = front ? (q < 0.15 ? (u < 0.5 ? C[6] : C[5]) : q < 0.5 ? C[5] : C[4]) : q < 0.5 ? C[3] : C[2];
      if (front && q < 0.45 && al > 0.9) p.px(x, yy, c);
      else p.dot(x, yy, c, al * (front ? 1 : 0.55) * (1.1 - q * 0.7));
    }
  }
  // the body: a thin translucent veil filling the funnel, so it reads as one shape
  if (grow > 0 && fade > 0)
    for (let y = Math.floor(at(grow)); y <= at(0); y++) {
      const u = (y - yb) / (yt - yb), R = rad(u), cx = sway(u);
      for (let x = Math.ceil(cx - R); x <= cx + R; x++) {
        const e = Math.abs(x - cx) / R;
        p.blend(x, y, e > 0.8 ? C[4] : C[3], (0.12 + e * e * 0.22) * fade * (1 - seg(u, 0.75, 1)));
      }
    }
  // the cloud it hangs from: soft puffs churning round the mouth
  if (grow > 0.6 && fade > 0)
    burst(7, o.seed + 4, (r) => {
      const an = r.range(0, TAU) + t * r.range(2, 4), R = rad(1) * r.range(0.5, 1.1);
      p.disc(sway(1) + Math.cos(an) * R, at(1) + Math.sin(an) * R * 0.25 - 1, r.range(3, 5.5) * k, r.next() < 0.5 ? C[3] : C[2], 0.4 * fade * seg(grow, 0.6, 1));
    });
  // the core: a soft column of light down the middle
  if (grow > 0 && fade > 0) {
    for (let u = 0; u < grow; u += 0.08) p.glow(sway(u), at(u), rad(u) * 0.9 + 2, C[4], 0.08 * fade);
    p.glowLine(sway(0), at(0), sway(grow), at(grow), 5 * k, C[5], 0.18 * fade);
  }

  // grit whirling round the lower half, flung out when it lifts
  burst(Math.round(10 + 4 * s), o.seed + 7, (r) => {
    const u = r.range(0.05, 0.6), born = r.range(0.15, 0.5), age = t - born;
    if (age < 0 || u > grow) return;
    const an = r.range(0, TAU) + age * r.range(8, 12), R = rad(u) * 1.15;
    let x = sway(u) + Math.cos(an) * R, y = at(u) + Math.sin(an) * R * 0.22 - age * 4;
    const fl = t - LIFT;
    if (fl > 0) {
      const dir = Math.cos(an) >= 0 ? 1 : -1;
      x += dir * fl * r.range(40, 70) * k;
      y += fl * fl * 80 - fl * 20;
    }
    const a = 1 - seg(t, 1.8, 2.15);
    if (a <= 0 || y > hh * 1.2) return;
    const c = Dc[Math.floor(r.next() * 3)];
    p.dot(x, y, c, a);
    if (r.next() < 0.4) p.dot(x + 1, y, Dc[2], a);
  });

  // a white-hot flicker at the tip the moment it touches down
  if (t > 0.05 && t < 0.12) p.glow(sway(0), at(0), 8 * k, WHITE, 0.4);
}
