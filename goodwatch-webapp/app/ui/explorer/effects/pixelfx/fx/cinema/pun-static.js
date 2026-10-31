// Made for the GoodWatch explorer map: title pun.
// TV static: the poster fills with blocky, uneven snow, a bright band rolls down it and rows tear sideways; then the
// picture collapses like an old tube switching off: to a white line, the line to a dot, the dot to a cold glow.
import { clamp, seg, ease, hash, noise2, WHITE, hex, fit, mix } from "../../core/index.js";
import { poster } from "./_pun2.js";
import { preview } from "./_pun1.js";

export const meta = {
  name: "Pun: TV static",
  desc: "Blocky TV snow fills the poster, a bright band rolling down and rows tearing sideways, then it collapses to a white line and a dot like a tube switching off, in a cold glow.",
  tags: ["cinema", "pun", "static", "tv", "horror", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0a0d16", "#1c2333", "#3c4558", "#6f7a92", "#aab6cc", "#e4ecff"], glowColor: "#8fb4ff", seed: 1, w: 40, h: 60 },
};

const ON = 0.07, OFF = 1.25, LINE = 1.5, DOT = 1.68, END = 2.1;
const h01 = (...n) => (hash(...n) >>> 0) / 4294967296;

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const { w, h, k } = poster(o), hw = w / 2, hh = h / 2, sk = Math.sqrt(k), C = fit(o.palette, 6), GL = hex(o.glowColor);
  const seed = o.seed | 0, f = Math.floor(t * 20);
  if (t >= END) return;
  // the cold glow of the tube, strongest while the picture collapses
  const gk = t < OFF ? 0.12 + 0.25 * (1 - seg(t, 0, 0.25)) : 0.12 + 0.3 * seg(t, OFF, LINE);
  if (t < LINE) p.glow(0, 0, Math.max(w, h) * 0.62, GL, gk);

  if (t < LINE) {
    // vertical collapse: the picture squashes to a line, brightening as it goes
    const u = seg(t, OFF, LINE), sy = 1 - ease.inQuad(u), half = Math.max(0.5, hh * sy), bright = u * 0.9;
    const band = -hh - 6 + ((t * 0.9 + h01(seed, 7) * 0.5) % 1) * (h + 12);
    const fin = seg(t, 0, ON), flash = 1 - seg(t, ON * 0.4, ON * 2.5);
    p.shade(-hw, -half, hw - 0.01, half - 0.01, (x, y, out) => {
      const Y = y / Math.max(0.05, sy); // sample the full picture through the squash
      const row = Math.floor(Y + hh);
      // tearing: a few rows per frame slide sideways and burn bright
      const tr = h01(row >> 1, f, seed, 3), tear = tr < 0.07;
      const X = x + (tear ? (h01(row, f, seed) - 0.5) * w * 0.6 : 0);
      const bx = h01(row >> 2, f >> 1, seed, 5) < 0.4 ? 2 : 1; // some rows are coarser
      const cell = h01(Math.floor((X + hw) / bx), row, f, seed);
      const blob = noise2((X + hw) * 0.16, (Y + hh) * 0.11 + f * 0.9, seed + 11);
      const db = Math.abs(Y - band);
      let v = cell * 0.75 + blob * 0.32 - 0.04 + (db < 4 ? 0.5 * (1 - db / 4) : 0) - (row & 1 ? 0.08 : 0) + (tear ? 0.25 : 0) + bright + flash * 0.8;
      v = clamp(v);
      out.a = 0.92 * (fin < 1 ? (cell < fin ? 1 : 0) : 1);
      if (out.a <= 0) return;
      const c = v > 0.9 ? WHITE : v > 0.76 ? C[5] : v > 0.6 ? C[4] : v > 0.42 ? C[3] : v > 0.25 ? C[2] : C[1];
      if (v > 0.86 || db < 2) (out.l = GL), (out.k = db < 2 ? 0.3 : 0.18);
      return u > 0.75 && Math.abs(y) < 1 ? WHITE : c;
    });
    if (u > 0.6) p.glowLine(-hw, 0, hw, 0, 3 * sk, GL, 0.4 * seg(u, 0.6, 1));
    return;
  }
  if (t < DOT) {
    // the line pulls in from both ends to a point
    const u = ease.inCubic(seg(t, LINE, DOT)), lx = Math.max(0.5, hw * (1 - u));
    p.line(-lx, 0, lx, 0, (q) => (Math.abs(q - 0.5) < 0.38 ? WHITE : C[5]));
    if (lx > 4) p.line(-lx * 0.7, -1, lx * 0.7, -1, C[3]), p.line(-lx * 0.7, 1, lx * 0.7, 1, C[3]);
    p.glowLine(-lx, 0, lx, 0, 3 * sk, GL, 0.5);
    p.glow(0, 0, 6 * sk, WHITE, 0.4 * u);
    return;
  }
  // the dot: hot, then fading to nothing in a dimming blue halo
  const u = seg(t, DOT, END), r = (1 - u) * 1.6 * sk;
  if (u < 0.88) p.px(0, 0, u < 0.55 ? WHITE : C[5]);
  const arm = Math.round((1 - u * 1.6) * 2.5 * sk);
  for (let d = 1; d <= arm; d++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(dx * d, dy * d, d === 1 ? C[5] : C[4]);
  void r;
  p.glow(0, 0, (5 + 6 * u) * sk, GL, 0.55 * (1 - u) * (1 - u));
  p.glow(0, 0, 3 * sk, WHITE, 0.5 * (1 - u));
}
