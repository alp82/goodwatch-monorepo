// Made for the GoodWatch explorer map: ambient loop.
// The banknote drawing follows pun-cash.js: foreshortened as it flips, a thin lit edge between faces, a pale medallion.
import { cycle, fit, hex, mix, bump, clamp, rng, WHITE, TAU } from "../../core/index.js";
import { spot, env, count, radius, step } from "./_amb2.js";

export const meta = {
  name: "Coins and banknotes",
  desc: "Over a money island: green banknotes flutter down, flipping edge-on, while little gold coins float up turning, and a glint pings off a coin.",
  tags: ["cinema", "ambient", "island", "money", "coins", "cash", "banknotes", "gold", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#3a2206", "#86520c", "#e0a020", "#ffe066", "#fff8d8"],
    notes: ["#0c2416", "#1b4a2b", "#2f7a43", "#5fb25e", "#a8e08a", "#e6f8d2"],
    seed: 1, r: 30, density: 1,
  },
};

// d rim, m face, h lit face, w shine; four turns from face to edge, small and big
const SMALL = [
  [".dd.", "dhmd", "dmmd", ".dd."],
  [".d.", "dhd", "dmd", ".d."],
  ["dd", "hd", "md", "dd"],
  ["h", "m", "d", "d"],
];
const BIG = [
  [".ddd.", "dhhmd", "dhmmd", "dmmmd", ".ddd."],
  [".dd.", "dhmd", "dhmd", "dmmd", ".dd."],
  [".d.", "dhd", "dmd", "dmd", ".d."],
  ["h", "m", "m", "d", "d"],
];

/** A banknote at (x, y), half-width W, half-height H, tilted ang, flipping (flip radians), at alpha a. */
function note(p, x, y, W, H, ang, flip, G, a) {
  const cf = Math.cos(flip), front = cf > 0, sy = Math.abs(cf), ca = Math.cos(ang), sa = Math.sin(ang);
  if (sy < 0.28) {
    // edge-on: a thin lit line
    p.line(x - ca * W, y - sa * W, x + ca * W, y + sa * W, (u) => (u < 0.5 ? G[5] : G[3]), a);
    return;
  }
  const hv = H * sy, r = Math.ceil(W) + 1;
  p.shade(x - r, y - r, x + r, y + r, (px, py, out) => {
    const dx = px - x, dy = py - y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    if (Math.abs(u) > W || Math.abs(v) > hv) return;
    out.a = a;
    const lit = (v < 0) === front;
    if (Math.abs(u) > W - 1 || Math.abs(v) > hv - 1) return lit && u < 0 ? G[4] : G[1];
    if (!front) return Math.abs(u) < hv * 0.8 ? G[2] : G[3];
    const m = Math.hypot(u, v / Math.max(0.5, sy)), mr = Math.max(1.2, H * 0.62);
    if (sy > 0.55 && m < mr) return m < mr * 0.5 ? G[1] : G[5];
    if (W > 4.5 && Math.abs(Math.abs(u) - (W - 2.5)) < 0.5 && Math.abs(v) < hv - 1.5) return G[2];
    return Math.abs(v + (front ? hv : -hv)) < 1.6 ? G[4] : G[3];
  });
  if (front && sy > 0.93) p.light(x - ca * W * 0.5, y - sa * W * 0.5, G[5], 0.3 * a);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), d2 = o.density >= 2;
  const G = fit(o.notes ?? meta.options.notes, 6).map(hex), bw = clamp(R * 0.17, 4.5, 9);
  // banknotes: start above the island and flutter down across it, swinging like falling leaves
  // evenly spaced births (cycle's random ones bunched the notes up), each with its own seeded look
  const nN = count(4, o.density), D = meta.duration;
  for (let i = 0; i < nN; i++) {
    const r = rng((o.seed ?? 1) + 31, i, 7), born = ((i + r.range(-0.15, 0.15)) / nN) * D, life = r.range(3.2, 4);
    let age = (((t - born) % D) + D) % D;
    for (; age < life; age += D) drawNote(age, life, rng((o.seed ?? 1) + 31, i, 8));
  }
  function drawNote(age, life, r) {
    const k = age / life, a = env(k, 0.15, 0.3);
    if (a <= 0.05) return;
    const x0 = r.range(-R * 0.8, R * 0.8), ph = r.range(0, TAU), fw = r.range(1.8, 2.6), amp = r.range(0.12, 0.2) * R;
    const sw = age * fw + ph, x = x0 + Math.sin(sw) * amp;
    const y = -R * 0.95 + k * R * 1.5 + Math.abs(Math.cos(sw)) * 1.5;
    const big = r.range(0.85, 1.15);
    note(p, x, y, bw * big, bw * 0.52 * big, Math.cos(sw) * 0.3, age * r.range(3.5, 5.5) + ph, G, a);
  }
  cycle(t, meta.duration, count(4, o.density), o.seed, (g) => g.range(2.4, 3.4), (age, life, r) => {
    const [x0, y0] = spot(r, R, 0.35, 0.85), k = age / life, a = env(k, 0.15, 0.35);
    const spin = r.range(3.5, 5.5), ph = r.range(0, TAU), big = d2 || R >= 24 || r.chance(0.35);
    const x = Math.round(x0 + Math.sin(age * 1.3 + ph) * 2.5), y = Math.round(y0 - k * R * 0.28);
    const turn = Math.abs(Math.cos(age * spin + ph)), f = turn > 0.85 ? 0 : turn > 0.55 ? 1 : turn > 0.25 ? 2 : 3;
    const rows = (big ? BIG : SMALL)[f], w = rows[0].length, h = rows.length;
    const face = step(C, a, 3);
    if (!face) return;
    p.sprite(rows, { d: C[1], m: face === C[3] ? C[2] : C[1], h: face }, x - (w >> 1), y - (h >> 1));
    p.light(x, y, C[3], 0.14 * a);
    // a glint as it faces us, once in its life
    const gk = bump(age, life * 0.45, life * 0.45 + 0.3);
    if (gk > 0 && f === 0 && r.chance(0.7)) {
      const gx = x - (w >> 1) + 1, gy = y - (h >> 1) + 1;
      p.px(gx, gy, mix(C[4], WHITE, 0.6));
      if (gk > 0.5) { p.px(gx + 1, gy, C[4]); p.px(gx - 1, gy, C[3]); p.px(gx, gy - 1, C[4]); p.px(gx, gy + 1, C[3]); }
      p.glow(gx, gy, 4, C[3], 0.3 * gk);
    }
  });
}
