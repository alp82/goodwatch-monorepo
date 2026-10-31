// Made for the GoodWatch explorer map: ambient loop.
import { fit, rand, TAU, clamp, smooth } from "../../core/index.js";
import { AMB, count, bornAt } from "./_amb1.js";

export const meta = {
  name: "Ambient snow",
  desc: "Snow in three depths over an island: fine dim far flakes, soft rounded middle ones, and a few big near puffs and six-arm crystals swaying past with a faint streak.",
  tags: ["cinema", "ambient", "family", "snow", "winter", "loop"],
  ...AMB,
  duration: 8,
  loop: true,
  options: { palette: ["#1a2440", "#3a5078", "#7a94bc", "#bcd0ec", "#eef6ff", "#ffffff"], seed: 1, r: 30, density: 1 },
};

// three depth layers: share of flakes, fall time (s), sway px, brightness top index
const LAYERS = [
  { n: 7, life: [5.2, 6.6], sway: 1.5, top: 3 }, // far: fine, dim, slow
  { n: 6, life: [3.6, 4.6], sway: 3, top: 4 }, // middle: soft rounded 2x2 / 3x3
  { n: 4, life: [2.5, 3.2], sway: 5, top: 5 }, // near: big, bright, fast
];

/** A rounded flake: s = 1 (1 px), 2 (2x2 lit top-left), 3 (3x3 soft disc), 4 (4x4 soft disc). */
function puff(p, X, Y, s, C, top, a) {
  const hi = C[top], md = C[top - 1], lo = C[top - 2];
  if (s === 1) return p.blend(X, Y, hi, a);
  if (s === 2) {
    p.blend(X, Y, hi, a); p.blend(X + 1, Y, md, a); p.blend(X, Y + 1, md, a); p.blend(X + 1, Y + 1, lo, a * 0.8);
    return;
  }
  const o = s === 3 ? -1 : -1.5;
  for (let j = 0; j < s; j++)
    for (let i = 0; i < s; i++) {
      const edgeX = i === 0 || i === s - 1, edgeY = j === 0 || j === s - 1;
      const corner = edgeX && edgeY;
      // lit from the top-left: the core and its upper-left neighbours hot, rim one step down, corners soft
      const c = corner ? lo : edgeX || edgeY ? (i + j < s - 1 ? hi : md) : C[Math.min(5, top + 1)];
      p.blend(X + o + i + 0.5, Y + o + j + 0.5, c, corner ? a * 0.7 : a);
    }
}

// six-arm crystal pixels, vertical axis: [dx, dy, ring] (ring 1 near the core, 2 arms, 3 long tips)
const SMALL = [[0, -1, 1], [0, 1, 1], [-1, 0, 1], [1, 0, 1], [0, -2, 2], [0, 2, 2], [-2, -1, 2], [2, -1, 2], [-2, 1, 2], [2, 1, 2]];
const BIG = [...SMALL, [0, -3, 3], [0, 3, 3], [-3, -2, 3], [3, -2, 3], [-3, 2, 3], [3, 2, 3]];

/** A small six-arm crystal: hot core, arms one step down, tips fading. */
function crystal(p, X, Y, C, a, big) {
  p.blend(X, Y, C[5], a);
  for (const [dx, dy, k] of big ? BIG : SMALL) p.blend(X + dx, Y + dy, k === 1 ? C[4] : k === 2 ? C[3] : C[2], k === 3 ? a * 0.75 : a);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), D = meta.duration, r = o.r ?? 30, S = o.seed;
  const big = r >= 50; // bigger islands: bigger near flakes
  for (let L = 0; L < 3; L++) {
    const Ly = LAYERS[L], n = count(o, Ly.n);
    for (let i = 0; i < n; i++) {
      const R = (k) => rand(S, L, i, k);
      const life = Ly.life[0] + R(1) * (Ly.life[1] - Ly.life[0]), born = bornAt(i, n, D, R(2));
      const age = (((t - born) % D) + D) % D;
      if (age >= life) continue;
      const u = age / life;
      const x0 = (R(3) - 0.5) * r * 1.95, y0 = -r * (1.0 + R(4) * 0.08), fall = r * (1.15 + R(5) * 0.2);
      const sw = Ly.sway * (0.7 + R(8) * 0.6) * (big ? 1.4 : 1);
      const ph = u * TAU * (0.6 + R(6) * 0.5) + R(7) * TAU;
      const x = x0 + Math.sin(ph) * sw + u * r * 0.08, y = y0 + fall * u;
      // in at the top, melt out low over the island
      const a = clamp(Math.min(smooth(0, 0.12, u), 1 - smooth(0.78, 1, u)));
      if (a <= 0.02) continue;
      const X = Math.round(x), Y = Math.round(y);
      if (L === 0) {
        puff(p, X, Y, big && R(9) < 0.4 ? 2 : 1, C, 3, a * (0.75 + R(10) * 0.25));
      } else if (L === 1) {
        const s = R(9) < 0.55 ? 2 : 3;
        puff(p, X, Y, big ? s + 1 : s, C, 4, a);
        p.light(X, Y, C[2], 0.08 * a);
      } else {
        // near: a faint motion streak above (they fall fastest), then the flake
        const vy = fall / life, dx = Math.cos(ph) * sw * 0.15;
        if (R(11) < 0.67) {
          const sl = Math.min(4, Math.round(vy / 10)) + (big ? 1 : 0);
          for (let k = 1; k <= sl; k++) p.blend(X - dx * k, Y - 1 - k, C[3], a * 0.4 * (1 - k / (sl + 1)));
        }
        if (R(12) < 0.5) crystal(p, X, Y, C, a, big || r >= 40);
        else puff(p, X, Y, big || R(13) < 0.4 ? 4 : 3, C, 4, a);
        p.disc(X + 0.5, Y + 0.5, big ? 3.5 : 2.6, C[3], 0.1 * a);
        p.glow(X + 0.5, Y + 0.5, big ? 7 : 5, C[3], 0.16 * a);
      }
    }
  }
}
