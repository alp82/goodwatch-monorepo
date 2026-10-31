// A gust of sand drifts sideways across a poster: a dune-colored haze rolls through, streaks and grains race past at
// different speeds and heights, rippling as they go, and a few spice-bright glints wink in the dust.
import { fit, burst, seg, ease, clamp, WHITE, hex } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: sand",
  desc: "A gust of sand drifts across the poster: a dune-colored haze rolls through, streaks and grains race past at different speeds, rippling, and spice-bright glints wink in the dust.",
  tags: ["cinema", "pun", "sand", "desert", "wind", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.0,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#2a1a10", "#5a3a1e", "#8e6236", "#c08a4a", "#e2b06a", "#f6d89a", "#fff2cc"], spice: ["#ff8a2a", "#ffc46a", "#ffe9a8"], seed: 1, w: 40, h: 60 },
};

const GUST = [0, 1.25];

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), S = o.spice.map(hex), { hw, hh, s } = dims(o), k = Math.max(0.6, s);
  const xl = -hw * 1.15, xr = hw * 1.15, span = xr - xl;
  const gust = seg(t, 0, 0.3) * (1 - seg(t, 1.0, 1.9));

  // the haze: soft translucent billows rolling through, lit on top
  burst(10, o.seed + 1, (r) => {
    const born = r.range(0, 0.6), speed = r.range(55, 90) * k, age = t - born, y = r.range(-hh * 0.85, hh * 0.95);
    const R = r.range(3, 5.5) * k, x = xl - R * 2 + age * speed, life = (span + R * 3) / speed;
    if (age < 0 || age > life) return;
    const u = age / life, a = Math.sin(Math.PI * u) * 0.22;
    const yy = y + Math.sin(age * 3 + born * 9) * 1.5;
    // a flat bank: three soft discs in a row, the front one lit
    for (let j = 0; j < 3; j++) p.disc(x - j * R * 1.1, yy + (j === 1 ? R * 0.15 : 0), R * (1 - j * 0.15), C[2], a * (1 - j * 0.25));
    p.disc(x - R * 0.3, yy - R * 0.35, R * 0.5, C[3], a * 0.7);
  });

  // streaks and grains: born through the gust, racing right, each riding a little ripple
  const n = Math.round(70 + 40 * s);
  burst(n, o.seed + 2, (r) => {
    const born = r.range(GUST[0], GUST[1]) * (r.next() < 0.6 ? 0.75 : 1), sp = r.range(70, 160) * k, age = t - born;
    const life = span / sp;
    if (age < 0 || age > life) return;
    const y0 = r.range(-hh * 0.95, hh * 1.05), x = xl + age * sp;
    const y = y0 + Math.sin(x * 0.12 + born * 20) * 1.5 * k + age * r.range(-4, 6);
    const u = age / life, a = Math.min(clamp(u * 8), clamp((1 - u) * 6));
    const streak = r.next() < 0.45, len = streak ? (sp / 160) * r.range(4, 9) * k : 1;
    const c = sp > 130 * k ? C[6] : sp > 100 * k ? C[5] : C[4];
    if (streak) p.line(x - len, y, x, y, (q) => (q > 0.7 ? c : C[3]), a);
    else p.dot(x, y, c, a);
    if (sp > 140 * k) p.light(x, y, C[4], 0.2 * a);
  });

  // spice: a few glints that catch the light as they drift by
  burst(Math.round(5 + 3 * s), o.seed + 3, (r) => {
    const born = r.range(0.2, 1.1), sp = r.range(30, 55) * k, age = t - born, life = r.range(0.5, 0.8);
    if (age < 0 || age > life) return;
    const x = r.range(-hw * 0.8, hw * 0.5) + age * sp, y = r.range(-hh * 0.8, hh * 0.8) - age * 6;
    const tw = Math.sin((age / life) * Math.PI), c = S[Math.floor(r.next() * S.length)];
    const arm = Math.round(tw * 2.4 * Math.max(1, k * 0.8));
    p.px(x, y, tw > 0.6 ? WHITE : c);
    for (let d = 1; d <= arm; d++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.dot(x + dx * d, y + dy * d, c, tw * (1.2 - d / (arm + 1)));
    p.glow(x, y, 5 * k, c, 0.4 * tw);
  });

  // a warm cast while the gust is thick
  if (gust > 0) p.glow(0, 0, Math.max(hw, hh) * 1.3, C[3], 0.12 * gust);
  // the first push: a line of bright sand whips across the top
  if (t < 0.3) {
    const q = ease.outQuart(t / 0.3), x = xl + span * q;
    p.line(x - 14 * k, -hh * 0.3, x, -hh * 0.3, C[6], 1 - q * 0.5);
    p.line(x - 9 * k, hh * 0.35, x, hh * 0.35, C[5], 1 - q * 0.5);
  }
}
