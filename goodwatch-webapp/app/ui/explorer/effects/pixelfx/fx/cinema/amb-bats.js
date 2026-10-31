import { fit, rand, TAU } from "../../core/index.js";
import { AMB, count, wave } from "./_amb1.js";

export const meta = {
  name: "Ambient bats",
  desc: "A few tiny bats flap along lazy figure-eights over an island, wings snapping through four frames, eyes glinting red.",
  tags: ["cinema", "ambient", "scary", "bats", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: { palette: ["#07050c", "#3a2a56", "#5a4484", "#8c74c0", "#c8b4f0"], eye: "#ff4a4a", seed: 1, r: 30, density: 1 },
};

// four flap frames, 11 wide, the body's middle at column 5, the head at the row marked by "e"
const UP = ["x.........x", "xm.......mx", ".xm.b.b.mx.", "..mmebemm..", "....bbb....", ".....b....."];
const MID = ["....b.b....", "xxmmebemmxx", ".x.mbbbm.x.", ".....b....."];
const DOWN = ["....b.b....", "..mmebemm..", ".xm.bbb.mx.", "xm...b...mx", "x.........x"];
const FRAMES = [UP, MID, DOWN, MID], HEAD = [3, 1, 1, 1];

export function draw(p, t, o) {
  const C = fit(o.palette, 5), D = meta.duration, r = o.r, n = Math.min(count(o, 3), Math.max(1, Math.floor(r / 7))), S = o.seed;
  const eye = fit([o.eye], 1)[0], pal = { x: C[3], m: C[1], b: C[2], e: eye };
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(S, i, k);
    const cx = ((i + 0.5) / n - 0.5) * r * 1.6 + (R(1) - 0.5) * r * 0.2, cy = -r * (0.25 + (i % 2) * 0.32 + R(2) * 0.15), ax = r * (0.18 + R(3) * 0.12), ay = r * (0.12 + R(4) * 0.1);
    const k = 1, ph = R(6) * TAU, dir = R(7) < 0.5 ? 1 : -1;
    const x = cx + ax * wave(t, D, k * dir, ph), y = cy + ay * wave(t, D, 2 * k * dir, ph * 2) + wave(t, D, 15, ph);
    // flap: 15 or 18 beats a loop, four frames each
    const beats = 15 + 3 * Math.floor(R(8) * 2), f = Math.floor(((t / D) * beats * 4 + R(9) * 4) % 4);
    const X = Math.round(x), Y = Math.round(y), rows = FRAMES[f];
    p.sprite(rows, pal, X - 5, Y - HEAD[f]);
    p.light(X - 1, Y, eye, 0.3);
    p.light(X + 1, Y, eye, 0.3);
    p.glow(x, y, 6, C[4], 0.14);
  }
}
