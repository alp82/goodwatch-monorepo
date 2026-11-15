// Made for the GoodWatch stats page: A little sun rises next to "Sunday is scoring day".
// Anchor (0, 0) sits just right of the heading's last letter, on its baseline. Nothing draws below the baseline.
import { fit, seg, clamp, lerp, rand, ease, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Sunrise",
  desc: "A small pixel sun rises from behind the heading's baseline in a warm glow, its long and short rays turning and pulsing, a white glint on its rim, then sinks back.",
  tags: ["stats-page", "sun", "sunday", "sunrise", "one-shot"],
  size: [32, 30],
  origin: [6, 24],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2a0e06", "#7a2a0c", "#d8601a", "#ffa62a", "#ffd65a", "#fff2b0", "#ffffff"],
    r: 5,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.8 };

const SX = 7; // the sun's center, px right of the anchor

/** Only what's above the baseline. */
const up = (p) => ({
  px: (x, y, c) => { if (Math.floor(y) < 0) p.px(x, y, c); },
  dot: (x, y, c, a) => { if (Math.floor(y) < 0) p.dot(x, y, c, a); },
});

/** The sun's disc at center (cx, cy): pale hot core, yellow body, orange rim lit from the top left, darker bottom right. */
function sun(q, C, cx, cy, r, hot) {
  const R = Math.ceil(r) + 1;
  for (let y = Math.floor(cy - R); y <= cy + R; y++)
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > r + 0.35) continue;
      const lit = -(dx + dy) / Math.max(1, d) ; // > 0 towards the top left
      // a hard 1 px orange rim, a yellow body, a pale crescent lit from the top left and a 2 px white hot spot
      let c;
      if (hot) c = d > r - 0.7 ? C[5] : WHITE;
      else if (d > r - 0.7) c = lit < -0.35 ? C[2] : C[3];
      else if (lit > 0.45 && d > r - 2.2) c = C[5];
      else c = C[4];
      if (!hot && Math.abs(dx + r * 0.38) < 0.6 && Math.abs(dy + r * 0.38) < 1.1 && d < r - 1) c = WHITE;
      q.px(x, y, c);
    }
}

/** n rays round the sun, alternating long and short, turned by `turn`, length scaled by `k`. */
function rays(q, C, cx, cy, r, turn, k, pulse, only) {
  const n = 8;
  for (let i = 0; i < n; i++) {
    if (only !== undefined && i !== only) continue;
    const a = turn + (i / n) * TAU, long = i % 2 === 0;
    const L = (long ? 3 + pulse : 1.6 + pulse * 0.5) * k;
    if (L < 0.6) continue;
    const r0 = r + 1.6, ca = Math.cos(a), sa = Math.sin(a);
    // one pixel per step along the ray, so diagonals stay a clean 1 px stair
    const m = Math.max(1, Math.round(L));
    for (let s = 0; s <= m; s++) {
      const d = (s / m) * L, c = s === 0 ? C[5] : s < m ? C[4] : C[3];
      q.px(Math.round(cx + ca * (r0 + d) - 0.5), Math.round(cy + sa * (r0 + d) - 0.5), c);
    }
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), S = o.seed, r = Math.max(3, o.r), q = up(p);
  if (o.tease) {
    if (t >= tease.duration) return;
    // the top of the sun peeks over the baseline with one ray, and dips back
    const g = Math.sin(Math.PI * seg(t, 0.05, 0.75));
    const cy = lerp(r + 1, r - 2.2, ease.outSine(g));
    sun(q, C, SX, cy, r, false);
    if (g > 0.55) rays(q, C, SX, cy, r, -Math.PI / 2, seg(g, 0.55, 0.9), 0, 0);
    if (g > 0.1) p.glow(SX, -1, 6, C[3], 0.35 * g);
    // the baseline catches the light under it
    for (let x = SX - 5; x <= SX + 5; x++) {
      const f = g * (1 - Math.abs(x - SX) / 6);
      if (f > 0.15) p.px(x, 0, f > 0.6 ? C[4] : f > 0.35 ? C[3] : C[2]);
    }
    return;
  }
  if (t >= meta.duration) return;
  const RISE0 = 0.06, RISE1 = 0.62, SINK0 = 1.8, SINK1 = 2.25;
  const rise = ease.outCubic(seg(t, RISE0, RISE1)), sink = ease.inCubic(seg(t, SINK0, SINK1));
  const top = -r - 2; // where the center rests: the disc clears the baseline by a pixel
  const cy = lerp(lerp(r + 1, top, rise), r + 1, sink);
  const alive = rise * (1 - sink);

  // the glow behind it, warm and soft, swelling with the rise
  p.glow(SX, cy, r * 2.6, C[3], 0.24 * alive);
  // the horizon: the baseline beside the sun lights up while the sun is low
  const low = clamp(1 - Math.abs(cy - 0) / (r + 3));
  for (let x = SX - r - 4; x <= SX + r + 4; x++) {
    const f = 1 - Math.abs(x - SX) / (r + 5);
    if (f > 0 && low * f > 0.12) p.px(x, 0, low * f > 0.55 ? C[4] : low * f > 0.3 ? C[3] : C[2]);
  }

  // rays: out once it has risen, turning slowly and pulsing, pulled in before it sinks
  const rk = seg(t, 0.42, 0.66) * (1 - seg(t, 1.62, 1.86));
  if (rk > 0) {
    const pulse = Math.round((Math.sin(t * 7) * 0.5 + 0.5) * 1);
    rays(q, C, SX, cy, r, 0.12 + t * 0.55, ease.outBack(rk), pulse);
  }
  // the disc: one white hero frame pair as it clears the baseline
  const hero = t > 0.4 && t < 0.467;
  sun(q, C, SX, cy, r, hero);
  if (hero) p.glow(SX, cy, r * 2, WHITE, 0.4);

  // a white glint on the rim, top left, that twinkles twice
  const gl = t - 0.78;
  if (gl > 0 && gl < 0.75 && sink === 0) {
    const a = -2.35, gx = SX + Math.cos(a) * (r - 0.6), gy = cy + Math.sin(a) * (r - 0.6);
    const tw = gl < 0.12 || (gl > 0.42 && gl < 0.5) ? 2 : gl < 0.22 || (gl > 0.5 && gl < 0.58) ? 1 : 0;
    q.px(gx, gy, WHITE);
    if (tw >= 1) { q.px(gx - 1, gy, WHITE); q.px(gx, gy - 1, WHITE); q.px(gx + 1, gy, C[6]); q.px(gx, gy + 1, C[6]); }
    if (tw >= 2) { q.px(gx - 2, gy, C[5]); q.px(gx, gy - 2, C[5]); }
    p.light(gx, gy, WHITE, 0.6);
  }

  // a couple of warm motes drifting up off it
  for (let i = 0; i < 3; i++) {
    const b = 0.68 + i * 0.26, age = t - b, L = 0.85;
    if (age < 0 || age > L) continue;
    const u = age / L;
    const mx = SX + (rand(S, i, 1) - 0.5) * (r * 2.4) + Math.sin(age * 5 + i) * 0.8;
    const my = top - r * 0.6 - u * 7 - rand(S, i, 2) * 2;
    q.dot(mx, my, u < 0.4 ? C[5] : C[3], 1 - seg(u, 0.5, 1));
  }
}
