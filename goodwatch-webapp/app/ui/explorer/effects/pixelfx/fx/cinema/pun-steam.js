// Made for the GoodWatch explorer map: title pun.
// Steam off a hot dish: soft wisps curl up from a poster's top edge, twisting as they rise and thinning out, a
// warm glow along the edge below them and a golden glint or two drifting up like the smell of it.
import { rng, burst, seg, ease, clamp, TAU, WHITE, hex, fit } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: steam",
  desc: "Curls of steam rise off the poster's top edge in soft translucent wisps that twist and thin, over a warm glow, with a couple of golden aroma glints drifting up.",
  tags: ["cinema", "pun", "steam", "kitchen", "cooking", "food", "one-shot"],
  size: [128, 160],
  origin: [64, 96],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#3c3c4c", "#6c6c80", "#a4a4b8", "#d4d4e2", "#f2f2fa"],
    warm: ["#5a2a0c", "#b0601a", "#f0a040", "#ffd27a", "#fff2c8"],
    seed: 1, w: 40, h: 60,
  },
};

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5), W = o.warm.map(hex), { hw, hh, s } = dims(o), k = clamp(s, 0.6, 3.5), sk = Math.sqrt(k);
  const base = -hh, H = Math.max(22, hh * 0.95 + 10 * k);
  const env = seg(t, 0, 0.35) * (1 - seg(t, 1.9, 2.5));

  // the warm glow along the top edge, where it comes off the heat
  if (env > 0) {
    p.glowLine(-hw * 0.8, base + 1, hw * 0.8, base + 1, 8 * sk, W[2], 0.28 * env);
    p.glow(0, base + 2, hw * 1.2, W[1], 0.18 * env);
    for (let x = Math.ceil(-hw * 0.9); x < hw * 0.9; x++) {
      const sh = Math.sin(x * 0.7 + t * 9) * 0.5 + 0.5, e = 1 - Math.abs(x / (hw * 0.9));
      p.blend(x, base, sh > 0.6 ? W[3] : W[2], env * (0.3 + sh * 0.4) * Math.min(1, e * 3));
    }
  }

  // wisps: each a column rising off the edge, its head climbing then its foot lifting away; puffs scroll up it,
  // S-curls travel up it, and two fine threads twist around each other through it
  const n = Math.round(3 + 1.4 * k);
  for (let i = 0; i < n; i++) {
    const r = rng(o.seed, i);
    const x0 = ((i + r.range(0.15, 0.85)) / n - 0.5) * hw * 1.6, b = r.range(0, 0.6), life = r.range(1.4, 1.9);
    const age = t - b;
    if (age <= 0 || age > life) continue;
    const top = H * r.range(0.8, 1.05), ph = r.range(0, TAU), fr = r.range(0.12, 0.17) / sk, amp = r.range(2.5, 4) * sk;
    const lean = r.range(-0.25, 0.25), tw = r.range(0.16, 0.24) / sk;
    // head climbs fast then slows; the foot lets go of the edge in the last part of its life
    const head = top * Math.min(1, 1 - Math.pow(1 - clamp(age / (life * 0.6)), 2));
    const foot = top * ease.inQuad(seg(age, life * 0.45, life));
    const step = 0.8;
    for (let h = foot; h <= head; h += step) {
      const d = h / top, y = base - h;
      const x = x0 + Math.sin(h * fr + ph - t * 3.2) * amp * d + lean * h;
      // puffs: lumps that scroll up the column
      const lump = 0.6 + 0.4 * Math.sin(h * 0.45 / sk - t * 9 + ph);
      const ends = Math.min(1, (head - h) / (3 * sk), (h - foot) / (4 * sk) + (foot < 0.5 ? 1 : 0));
      const a = (1 - d * 0.65) * lump * clamp(ends) * env;
      if (a < 0.02) continue;
      const rad = (1.3 + 3.8 * d) * sk * (0.8 + 0.3 * lump);
      if (Math.round(h / step) % 2 === 0) p.disc(x, y, rad, (q, g) => (Math.cos(g) + Math.sin(g) < -0.5 && q > 0.45 ? C[4] : q > 0.65 ? C[2] : C[3]), (q) => a * 0.2 * (1 - q * q * 0.6));
      // the twisting threads
      const wv = Math.sin(h * tw - t * 6 + ph), off = wv * rad * 0.55;
      const c = d < 0.18 ? W[3] : C[4];
      p.blend(x + off, y, c, Math.min(0.85, a * (wv > 0 ? 0.65 : 0.3)));
      p.blend(x - off, y, d < 0.18 ? W[2] : C[3], Math.min(0.85, a * (wv < 0 ? 0.5 : 0.2)));
      if (d < 0.2) p.light(x, y, W[2], 0.1 * a);
    }
  }

  // aroma: a couple of golden glints drifting up, twinkling
  burst(Math.round(2 + k), o.seed + 9, (r) => {
    const b = r.range(0.3, 1.3), life = r.range(0.8, 1.1), age = t - b;
    if (age < 0 || age > life) return;
    const u = age / life, x = r.range(-hw * 0.6, hw * 0.6) + Math.sin(age * 5 + b * 7) * 2 * sk, y = base - 3 - u * H * 0.7;
    const tw = Math.sin(u * Math.PI) * (0.6 + 0.4 * Math.sin(age * 22));
    const arm = Math.round(tw * 2.2 * sk);
    p.px(x, y, tw > 0.55 ? WHITE : W[3]);
    for (let q = 1; q <= arm; q++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.dot(x + dx * q, y + dy * q, q === arm ? W[2] : W[3], tw);
    p.glow(x, y, 5 * sk, W[3], 0.45 * tw);
  });
}
