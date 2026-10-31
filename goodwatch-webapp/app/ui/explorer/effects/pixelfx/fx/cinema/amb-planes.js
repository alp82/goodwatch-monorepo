// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, mix, clamp, rng, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Paper planes",
  desc: "Over the Rest of world island: small paper planes loop around the island, banking into their turns, leaving dotted trails that fade, a glint catching a wing.",
  tags: ["cinema", "ambient", "island", "country", "world", "paper", "planes", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  // ink, paper shadow, paper, paper lit, glint
  options: { palette: ["#1a2030", "#7d889c", "#cfd6e2", "#f4f7fb", "#fffbe6"], seed: 1, r: 30, density: 1 },
};

const radius = (o) => clamp(o.r ?? 30, 10, 100);

// flight paths: u is 0..1 over the loop, seamless; each returns [x, y]
const PATHS = [
  (u, R) => [Math.cos(u * TAU) * 0.82 * R, -0.42 * R + Math.sin(u * TAU) * 0.38 * R], // a wide oval
  (u, R) => [Math.cos(u * TAU) * 0.7 * R, -0.5 * R + Math.sin(u * TAU) * 0.3 * R + Math.cos(u * TAU) * 0.14 * R], // a tilted oval
  (u, R) => [Math.sin(u * TAU) * 0.55 * R, -0.55 * R + Math.sin(u * TAU * 2) * 0.24 * R], // a figure of eight
  (u, R) => [Math.sin(u * TAU * 2) * 0.35 * R + Math.cos(u * TAU) * 0.4 * R, -0.35 * R + Math.sin(u * TAU) * 0.3 * R],
];

function plane(p, C, x, y, hx, hy, bank, s, glint) {
  // plane frame: f forward, n to the left wing; bank -1..1 tips the left wing up (+) or down (-)
  const L = 9 * s, Wd = 4.6 * s;
  const nx = hy, ny = -hx;
  const P = (f, n) => [x + hx * f + nx * n, y + hy * f + ny * n];
  const wl = Wd * (1 - Math.max(0, -bank) * 0.75), wr = Wd * (1 - Math.max(0, bank) * 0.75); // the far wing foreshortens
  const nose = P(L * 0.55, 0), tailL = P(-L * 0.45, wl), tailR = P(-L * 0.45, -wr), tailC = P(-L * 0.3, 0);
  // keel: the folded body underneath shows as a dark sliver on the side the plane leans away from
  const keel = P(-L * 0.4, -bank * 1.6 * s);
  // outline: the wings and keel grown by a pixel in ink
  const grow = (pts, d) => {
    const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
    return pts.map(([a, b]) => { const l = Math.hypot(a - cx, b - cy) || 1; return [a + ((a - cx) / l) * d, b + ((b - cy) / l) * d]; });
  };
  const leftWing = [nose, tailL, tailC], rightWing = [nose, tailC, tailR], keelTri = [nose, tailC, keel];
  p.poly(grow(leftWing, 1), C[0]);
  p.poly(grow(rightWing, 1), C[0]);
  if (Math.abs(bank) > 0.25) p.poly(grow(keelTri, 0.8), C[0]);
  // lit wing is the one tipped toward the light (up-left)
  const litL = bank > -0.2, cl = litL ? C[3] : C[1], cr = litL ? (bank > 0.3 ? C[1] : C[2]) : C[3];
  p.poly(leftWing, bank < -0.4 ? C[1] : cl);
  p.poly(rightWing, bank > 0.4 ? C[1] : cr);
  if (Math.abs(bank) > 0.25) p.poly(keelTri, C[1]);
  // the center fold
  p.line(nose[0], nose[1], tailC[0], tailC[1], C[1]);
  p.px(nose[0], nose[1], C[3]);
  if (glint > 0) {
    const [gx, gy] = P(-L * 0.05, (litL ? wl : -wr) * 0.45);
    p.px(gx, gy, glint > 0.6 ? WHITE : C[4]);
    if (glint > 0.5) { p.px(gx + 1, gy, C[4]); p.px(gx - 1, gy, C[4]); p.px(gx, gy - 1, C[4]); p.px(gx, gy + 1, C[4]); }
    p.glow(gx, gy, 5 * s, C[4], 0.4 * glint);
  }
  p.glow(x, y, 7 * s, C[2], 0.07);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), s = Math.max(0.7, Math.min(1.8, R / 30)), D = meta.duration, ph = t / D, d2 = o.density >= 2;
  const n = d2 ? 4 : R >= 45 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const path = PATHS[i % PATHS.length], off = [0, 0.5, 0.25, 0.75][i % 4] + o.seed * 0.13;
    const pos = (u) => path(((u % 1) + 1) % 1, R);
    const u = ph + off, du = 0.004;
    const [x, y] = pos(u), [x1, y1] = pos(u + du), [x0, y0] = pos(u - du);
    let hx = x1 - x0, hy = y1 - y0;
    const hl = Math.hypot(hx, hy) || 1;
    hx /= hl; hy /= hl;
    // bank from the turn: the cross product of the incoming and outgoing headings
    const ax = x - x0, ay = y - y0, bx = x1 - x, by = y1 - y;
    const turn = (ax * by - ay * bx) / ((Math.hypot(ax, ay) * Math.hypot(bx, by)) || 1);
    const bank = clamp(turn * 40, -1, 1);
    // trail: dots back along the path, every few pixels, stepping down and thinning out
    const N = 12;
    for (let j = 1; j <= N; j++) {
      const [tx, ty] = pos(u - 0.012 - j * 0.016);
      const q = j / N, c = q < 0.35 ? C[3] : q < 0.7 ? C[2] : C[1];
      if (j % 2 === 0 && q > 0.5) continue;
      p.dot(tx, ty, c, 1.1 - q * 0.9);
      if (q < 0.4) p.light(tx, ty, C[2], 0.08);
    }
    // a glint once a lap, as the wing turns to the light
    const gph = ((u * 1 + 0.15 * i) % 1 + 1) % 1, glint = clamp(1 - Math.abs(gph - 0.3) / 0.05);
    plane(p, C, x, y, hx, hy, bank, s, glint);
  }
}
