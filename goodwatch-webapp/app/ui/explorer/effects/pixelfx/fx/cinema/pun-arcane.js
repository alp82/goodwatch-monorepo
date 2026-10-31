import { rng, clamp, seg, ease, TAU, WHITE, hex, fit, sparkle, star } from "../../core/index.js";
import { poster } from "./_pun2.js";

export const meta = {
  name: "Spell circle",
  desc: "A magic circle draws itself over the poster, its runes ticking on and a star snapping across it, flashes white, then breaks into sparkles that spiral out and fade.",
  tags: ["cinema", "pun", "magic", "wizard", "spell", "arcane", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.0,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"], seed: 1, w: 40, h: 60 },
};

const DRAW = 0.4, FLASH = 0.5, BREAK = 0.6;

export function draw(p, t, o) {
  const { w, h, k } = poster(o), C = fit(o.palette, 8).map(hex), sk = Math.sqrt(k);
  const R = Math.min(w * 0.45, h * 0.3), spin = t * 0.8;
  const d = ease.outCubic(seg(t, 0, DRAW)), fade = 1 - seg(t, BREAK, BREAK + 0.6);
  const white = t >= FLASH && t < FLASH + 0.07;
  if (fade > 0) {
    p.glow(0, 0, R * 1.6, C[4], 0.25 * fade * d + (white ? 0.3 : 0));
    // outer and inner rings sweep round as they draw
    const a0 = -Math.PI / 2 + spin;
    p.arc(0, 0, R, 1.2, a0, a0 + TAU * d, white ? WHITE : C[5], fade);
    p.arc(0, 0, R * 0.78, 1, a0 + Math.PI, a0 + Math.PI - TAU * d, white ? WHITE : C[4], fade);
    // rune ticks between the rings
    const n = 12;
    for (let i = 0; i < n; i++) {
      const on = seg(t, 0.08 + (i / n) * 0.3, 0.12 + (i / n) * 0.3);
      if (on <= 0) continue;
      const a = a0 + (i / n) * TAU, rr = R * 0.89, ca = Math.cos(a), sa = Math.sin(a);
      const c = on < 1 ? WHITE : i % 3 === 0 ? C[6] : C[5];
      p.line(ca * (rr - 1.2), sa * (rr - 1.2), ca * (rr + 1.2), sa * (rr + 1.2), white ? WHITE : c, fade);
      if (i % 3 === 0) p.light(ca * rr, sa * rr, C[5], 0.4 * fade);
    }
    // the star snaps across
    const s = seg(t, 0.25, 0.42);
    if (s > 0) {
      const pts = star(0, 0, R * 0.78, R * 0.78, 5, -Math.PI / 2 - spin * 0.5).filter((_, i) => i % 2 === 0);
      for (let i = 0; i < 5; i++) {
        const A = pts[i], B = pts[(i + 2) % 5], u = clamp(s * 5 - i);
        if (u <= 0) continue;
        p.line(A[0], A[1], A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, white ? WHITE : C[4], fade);
      }
    }
    if (white) p.glow(0, 0, R * 1.3, WHITE, 0.45);
  }
  // sparkles spiral out from the ring after the flash
  const m = Math.round(clamp(20 * k, 16, 50));
  for (let i = 0; i < m; i++) {
    const r = rng(o.seed, i), t0 = BREAK - 0.05 + r.range(0, 0.25), life = r.range(0.6, 1.1), u = (t - t0) / life;
    if (u < 0 || u >= 1) continue;
    const a = r.range(0, TAU) + u * r.range(1.5, 2.5) * (i % 2 ? 1 : -1), rad = R * (0.85 + ease.outCubic(u) * r.range(0.45, 0.9));
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad - u * 8 * sk, al = clamp((1 - u) * 2.2);
    if (r.next() < 0.35 && u < 0.6) sparkle(p, x, y, Math.max(1, Math.round(2.5 * (1 - u) * sk)), C[6], C[4], 0.3 * al);
    else p.dot(x, y, u < 0.4 ? C[6] : C[5], al);
    p.light(x, y, C[5], 0.4 * al);
  }
}
