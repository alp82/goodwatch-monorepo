import { fit, rand, TAU, mix, seg } from "../../core/index.js";
import { AMB, count, wave, bornAt } from "./_amb1.js";

export const meta = {
  name: "Ambient arcane motes",
  desc: "Violet and teal sparkles circle an island on a tilted orbit, twinkling as they pass; now and then a tiny rune glints and fades.",
  tags: ["cinema", "ambient", "magical", "fantasy", "arcane", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: { palette: ["#140a26", "#3a1870", "#6b2cc0", "#a058f0", "#d8a8ff", "#ffffff"], teal: "#5ce8e0", seed: 1, r: 30, density: 1 },
};

const RUNES = [
  ["o.o", ".o.", "o.o"],
  [".o.", "ooo", ".o."],
  ["oo.", ".o.", ".oo"],
  ["o..", "ooo", "..o"],
];

export function draw(p, t, o) {
  const C = fit(o.palette, 6), D = meta.duration, r = o.r, S = o.seed, n = count(o, 4), teal = fit([o.teal], 1)[0];
  const cy = -r * 0.45, rx = r * 0.85, ry = r * 0.22;
  // the orbit itself, a faint dotted ellipse turning slowly
  const dots = Math.max(10, Math.round(r * 0.6));
  for (let j = 0; j < dots; j++) {
    const b = (j / dots) * TAU + (TAU * t) / D / 2;
    p.blend(Math.cos(b) * rx * 0.9, cy + Math.sin(b) * ry, C[3], Math.sin(b) > 0 ? 0.35 : 0.15);
  }
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k), dir = 1, k = 1, ph = (i / n) * TAU + R(1) * 0.6;
    const a = (TAU * k * dir * t) / D + ph, x = Math.cos(a) * rx * (0.8 + R(2) * 0.25), y = cy + Math.sin(a) * ry + wave(t, D, 3, R(3) * TAU) * 2;
    const front = Math.sin(a) > 0, tw = 0.5 + 0.5 * wave(t, D, 5 + Math.floor(R(4) * 4), R(5) * TAU);
    const c = i % 2 ? teal : C[4], X = Math.round(x), Y = Math.round(y);
    if (!front) {
      p.dot(X, Y, mix(c, C[1], 0.5), 0.7);
      continue;
    }
    p.px(X, Y, tw > 0.7 ? C[5] : c);
    if (tw > 0.55) {
      p.px(X - 1, Y, c);
      p.px(X + 1, Y, c);
      p.px(X, Y - 1, c);
      p.px(X, Y + 1, c);
    }
    if (tw > 0.85) {
      p.dot(X - 2, Y, C[3], 0.8);
      p.dot(X + 2, Y, C[3], 0.8);
      p.dot(X, Y - 2, C[3], 0.8);
      p.dot(X, Y + 2, C[3], 0.8);
    }
    // a short arc trail behind it
    for (let j = 1; j <= 3; j++) {
      const b = a - j * 0.12;
      p.blend(Math.cos(b) * rx * (0.8 + R(2) * 0.25), cy + Math.sin(b) * ry, c, 0.75 - j * 0.2);
    }
    p.glow(x, y, 5, c, 0.2 + 0.12 * tw);
  }
  // runes: appear, glint, fade
  const m = o.density >= 2 ? 3 : 2;
  for (let i = 0; i < m; i++) {
    const R = (k) => rand(S, 40 + i, k), born = bornAt(i, m, D, R(1)), age = (((t - born) % D) + D) % D, life = 1.4;
    if (age >= life) continue;
    const u = age / life, a = u < 0.08 ? 0.5 : u > 0.85 ? 0.45 : 1;
    const x = (R(2) - 0.5) * r * 1.3, y = -r * (0.25 + R(3) * 0.55) - u * 3;
    const rows = RUNES[Math.floor(R(4) * RUNES.length)], c = i % 2 ? teal : C[4];
    // in white-hot, hold in colour, cool to a dark step: fades by colour, not by dither
    const col = u < 0.18 ? C[5] : u < 0.6 ? c : u < 0.85 ? C[3] : C[2];
    for (let ry2 = 0; ry2 < 3; ry2++)
      for (let rx2 = 0; rx2 < 3; rx2++) if (rows[ry2][rx2] === "o") p.blend(Math.round(x) - 1 + rx2, Math.round(y) - 1 + ry2, col, a);
    p.glow(x, y, 5, c, 0.2 * a);
  }
}
