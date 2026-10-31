// The flutter (swing that slows at its ends, tilt that follows it, a paper flip) borrows the recipe from
// ui/confetti, itself adapted from Sprite Fusion's falling leaves (MIT, Copyright (c) 2026 Hugo Duprez).
import { Particles, Lights, P, Rng, flare, clamp, TAU, WHITE, hex, scale, ease } from "../../core/index.js";
import { poster } from "./_pun2.js";

export const meta = {
  name: "Card burst",
  desc: "A deck bursts out of the poster: playing cards fan out with a white pop, flip over to show red and black pips, stall, then flutter down and fade.",
  tags: ["cinema", "pun", "cards", "joker", "casino", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#3a0a18", "#8a1426", "#d42a3a", "#f4ece0", "#ffffff"], ink: "#16121c", seed: 1, w: 40, h: 60 },
};

// 3 x 3 pips: heart, diamond, club, spade
const PIPS = [
  ["1.1", "111", ".1."],
  [".1.", "111", ".1."],
  [".1.", "111", "1.1"],
  [".1.", "111", "1.1"],
];

export function create(o) {
  const { w, h, k } = poster(o), R = new Rng(o.seed), C = o.palette.map(hex), INK = hex(o.ink);
  const RED = C[2], BACK = C[1], BACK2 = C[0], FACE = C[3];
  const ps = new Particles({ rng: R, sparks: ["#ffffff", "#fff3a6", "#ffc23d", "#ff8a2a"] }), lights = new Lights();
  const n = Math.round(clamp(7 + 4 * k, 8, 20)), cards = [];
  const cw = clamp(3.4 * Math.sqrt(k), 3, 6.5), ch = cw * 1.45, floor = h * 0.5 + h * 0.2;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + R.range(-1.25, 1.25), sp = R.range(90, 170) * Math.pow(k, 0.75);
    cards.push({ x: R.range(-w * 0.2, w * 0.2), y: R.range(-h * 0.15, h * 0.1), vx: Math.cos(a) * sp * clamp(w / 40, 0.55, 1), vy: Math.sin(a) * sp,
      ang: R.range(0, TAU), spin: R.range(-5, 5), flip: R.range(0, TAU), fs: R.range(6, 14), ph: R.range(0, TAU),
      amp: R.range(3, 7) * Math.sqrt(k), fw: R.range(2.2, 3.6), x0: 0, mode: 0, fall: R.range(22, 34) * Math.sqrt(k),
      suit: i % 4, delay: R.range(0, 0.08), fade: R.range(1.6, 2.15) });
  }
  lights.add(0, 0, 26 * k, WHITE, 0.55, 0.14);
  lights.add(0, 0, 40 * k, C[2], 0.35, 0.5);
  for (let i = 0; i < 14; i++) {
    const a = R.range(0, TAU), sp = R.range(60, 140) * Math.sqrt(k);
    ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp * 0.8, R.range(0.1, 0.22));
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
      for (const c of cards) {
        if (t < c.delay) continue;
        c.flip += c.fs * dt;
        if (c.mode === 0) {
          c.vx -= c.vx * 4 * dt;
          c.vy -= c.vy * 4 * dt - 160 * dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.ang += c.spin * dt;
          if (Math.hypot(c.vx, c.vy) < 45 || t > 0.6) (c.mode = 1), (c.x0 = c.x - Math.sin(c.ph) * c.amp), (c.fs *= 0.5);
        } else {
          c.ph += c.fw * dt;
          c.x0 += c.vx * dt;
          c.vx -= c.vx * 2 * dt;
          c.x = c.x0 + Math.sin(c.ph) * c.amp;
          c.y = Math.min(floor, c.y + c.fall * (0.4 + 0.9 * Math.abs(Math.cos(c.ph))) * dt);
          c.ang = Math.cos(c.ph) * 0.35;
        }
      }
    },
    draw(p) {
      if (t < 0.07) {
        flare(p, 0, 0, 10 * k * (0.6 + t * 6), 0.5, ["#3a0a18", "#d42a3a", "#ffd0c0", "#ffffff"]);
        p.glow(0, 0, 16 * k, WHITE, 0.5);
      }
      lights.draw(p);
      for (const c of cards) {
        if (t < c.delay) continue;
        const a = clamp((c.fade - t) / 0.3) * clamp((t - c.delay) / 0.04);
        if (a <= 0) continue;
        const cf = Math.cos(c.flip), face = cf > 0, sx = Math.max(0.35, Math.abs(cf)), hw = cw * sx, hh = ch;
        const ca = Math.cos(c.ang), sa = Math.sin(c.ang), r = Math.ceil(Math.hypot(cw, ch)) + 1;
        const pip = PIPS[c.suit], pc = c.suit < 2 ? RED : INK;
        p.shade(c.x - r, c.y - r, c.x + r, c.y + r, (px, py, out) => {
          const dx = px - c.x, dy = py - c.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
          if (Math.abs(u) > hw || Math.abs(v) > hh) return;
          out.a = a;
          const edge = Math.abs(u) > hw - 0.9 || Math.abs(v) > hh - 0.9;
          if (!face) return edge ? (u < 0 && v < 0 ? FACE : scale(FACE, 0.6)) : Math.abs(u) > hw - 1.9 || Math.abs(v) > hh - 1.9 ? BACK : (Math.floor(u + v + 40) % 3 === 0 ? RED : BACK2);
          if (edge) return u < 0 && v < 0 ? WHITE : scale(FACE, 0.72);
          if (sx > 0.55) {
            const gx = Math.floor(u / sx + 1.5), gy = Math.floor(v + 1.5);
            if (gx >= 0 && gx < 3 && gy >= 0 && gy < 3 && pip[gy][gx] === "1") return pc;
            if (hh > 4.5 && Math.floor(u + hw) === 1 && Math.floor(v + hh) === 1) return pc;
          }
          return u < -hw * 0.3 && v < -hh * 0.4 ? WHITE : FACE;
        });
        if (face && Math.abs(cf) > 0.92) p.light(c.x, c.y, WHITE, 0.25 * a);
      }
      ps.draw(p);
    },
  };
}
