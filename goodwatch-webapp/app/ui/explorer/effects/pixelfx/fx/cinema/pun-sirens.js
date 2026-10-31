// Made for the GoodWatch explorer map: title pun.
// Police lights over a poster: a red lamp at the top-left corner and a blue one at the top-right strobe in turn,
// double flash each, their beams sweeping across the poster, the whole poster washed in colored light, glints
// catching on its edges.
import { rng, seg, clamp, TAU, WHITE, hex, sparkle } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: sirens",
  desc: "Red and blue police lights strobe in turn from the poster's top corners: beams sweep across it, the poster is washed in each color, glints flash on its edges.",
  tags: ["cinema", "pun", "police", "cop", "siren", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    red: ["#3a0610", "#8a0f22", "#e0243a", "#ff6a6a", "#ffd6d6"],
    blue: ["#061038", "#0f2a8a", "#2a5cff", "#6aa0ff", "#d6e6ff"],
    seed: 1, w: 40, h: 60,
  },
};

const PER = 0.4, END = 1.95;

/** Strobe level for one color: two quick flashes in its half of each period. */
function strobe(t, half) {
  if (t > END) return 0;
  const q = ((t % PER) + PER) % PER - half * (PER / 2);
  if (q < 0 || q >= PER / 2) return 0;
  const f = (x) => (x < 0 || x > 0.075 ? 0 : x < 0.015 ? 1 : 1 - (x - 0.015) / 0.06);
  return Math.max(f(q), f(q - 0.09) * 0.85);
}

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const { hw, hh, s } = dims(o), k = clamp(s, 0.6, 3.5), sk = Math.sqrt(k);
  const env = seg(t, 0, 0.06) * (1 - seg(t, END, 2.3));
  if (env <= 0) return;
  const lamps = [
    { x: -hw + 1, y: -hh - 1, R: o.red.map(hex), f: strobe(t, 0), th: Math.PI * 0.27 + Math.sin(t * 5.5) * 0.55, dir: 1, g: 1.35 },
    { x: hw - 2, y: -hh - 1, R: o.blue.map(hex), f: strobe(t, 1), th: Math.PI * 0.73 - Math.sin(t * 5.5 + 1.2) * 0.55, dir: -1, g: 1 },
  ];
  const L = Math.hypot(hw * 2, hh * 2) * 1.05, cone = 0.26;

  for (const m of lamps) {
    const R = m.R, f = m.f * env, on = 0.45 + f * 0.55, g = m.g;
    // the wash: the poster tinted in the lamp's color while it flashes, brighter near its corner
    if (f > 0.05) {
      p.each(-hw, -hh, hw - 1, hh - 1, (x, y, sx, sy) => {
        const d = Math.hypot(x - m.x, y - m.y) / L;
        p.blendPx(sx, sy, R[2], f * 0.26 * g * (1 - d * 0.6));
      });
      p.glow(m.x, m.y, Math.max(hw, hh) * 1.25 + 8, R[2], 0.55 * f * g);
      p.glow(0, 0, Math.max(hw, hh) * 1.4, R[2], 0.25 * f * g);
      // the poster's edges catch it
      if (f > 0.45) {
        const ex = m.x < 0 ? -hw : hw - 1;
        p.line(-hw, -hh, hw - 1, -hh, (u) => (Math.abs(u - (m.x < 0 ? 0 : 1)) < 0.35 ? R[4] : R[3]));
        p.line(ex, -hh, ex, hh - 1, (u) => (u < 0.3 ? R[4] : R[3]), clamp(1.4 - (f > 0.8 ? 0 : 0.5)));
      }
    }
    // the beam: a sweeping cone of light from the corner, hot core line, fading with distance
    const ca = Math.cos(m.th), sa = Math.sin(m.th), ex = m.x + ca * L, ey = m.y + sa * L;
    p.each(Math.min(m.x, ex) - L * 0.3, m.y - 2, Math.max(m.x, ex) + L * 0.3, Math.max(m.y, ey) + 2, (x, y, sx, sy) => {
      const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy);
      if (d < 2 || d > L) return;
      const along = dx * ca + dy * sa;
      if (along <= 0) return;
      const off = Math.abs(dx * sa - dy * ca) / d;
      if (off > cone) return;
      const w = 1 - off / cone, fall = 1 - d / L;
      const a = w * w * fall * on * env;
      if (a < 0.02) return;
      p.blendPx(sx, sy, off < cone * 0.18 ? R[4] : off < cone * 0.5 ? R[3] : R[2], Math.min(0.85, a * (0.55 + f * 0.4)));
      p.add(sx, sy, R[2], a * 0.4 * g);
    });
    // the lamp: a dome with a lit lens, white-hot when it flashes
    const lr = Math.max(2, 2.6 * sk);
    p.circle(m.x, m.y, lr + 0.6, R[0]);
    p.circle(m.x, m.y, lr, f > 0.3 ? R[3] : R[1]);
    p.px(m.x - lr * 0.35, m.y - lr * 0.35, f > 0.3 ? WHITE : R[3]);
    if (f > 0.5) p.circle(m.x, m.y, lr * 0.5, WHITE);
    p.glow(m.x, m.y, lr * 4, R[3], 0.35 * on * env);
    if (f > 0.85) sparkle(p, m.x, m.y, Math.round(4 * sk), R[3], R[2], 0.5);
  }

  // glints: on each strobe a few points on the poster's edge flash white in the color
  for (let i = 0; i < 12; i++) {
    const tf = 0.03 + i * (PER / 2), age = t - tf;
    if (age < 0 || age > 0.16 || tf > END) continue;
    const r = rng(o.seed, i), side = r.int ? r.int(0, 3) : Math.floor(r.next() * 4), u = r.range(-0.9, 0.9);
    const x = side < 2 ? u * hw : side === 2 ? -hw : hw - 1, y = side < 2 ? (side ? hh - 1 : -hh) : u * hh;
    const R = (i % 2 ? lamps[1] : lamps[0]).R, a = 1 - age / 0.16;
    sparkle(p, x, y, Math.max(1, Math.round((2 + 2 * sk) * a)), R[3], R[2], 0.45 * a);
  }
}
