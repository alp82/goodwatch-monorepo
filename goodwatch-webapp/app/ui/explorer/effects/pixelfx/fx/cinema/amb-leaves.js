// Made for the GoodWatch explorer map: ambient loop.
import { cycle, fit, hex, TAU, WHITE } from "../../core/index.js";
import { env, count, radius } from "./_amb2.js";

export const meta = {
  name: "Autumn leaves",
  desc: "Over a Canada island: red, orange and amber leaves tumble down on the breeze, flipping narrow as they turn edge-on, now and then catching the light.",
  tags: ["cinema", "ambient", "island", "canada", "autumn", "leaves", "loop"],
  ...{ size: [112, 104], origin: [56, 56], fps: 30, bg: "dark" },
  duration: 7,
  loop: true,
  options: {
    palette: ["#3a0c0a", "#8e1c14", "#d23a1e", "#ff7a3a", "#ffd0a0"],
    orange: ["#3e1806", "#9a4210", "#e8761c", "#ffb04a", "#ffe2b0"],
    amber: ["#3a2606", "#8a5a0e", "#d8961c", "#ffd050", "#fff2c0"],
    seed: 1, r: 30, density: 1,
  },
};

// leaf turns, drawn on the diagonal (tip top-left, stem bottom-right): face, three-quarter, edge-on, back.
// h lit edge, m body, d shade, v vein, s stem
const SMALL = [
  ["hh..", "hmh.", "hmvd", ".dds"],
  ["hh..", ".mvd", "..ds"],
  ["h..", ".m.", "..s"],
  ["mm..", "mdm.", "mdvd", ".dds"],
];
const BIG = [
  ["hh....", "hmmh..", ".mmmh.", "hmvmmd", ".mmvd.", "..d.ds"],
  [".hh...", "hmmvh.", ".mmvdd", "....ds"],
  ["h...", ".m..", "..d.", "...s"],
  ["mm....", "mddm..", ".dddm.", "mdvddd", ".ddvd.", "..d.ds"],
];
const HUGE = [
  ["hh......", "hmmh....", "hmmmmh..", ".hmmmmh.", "hmmvmmmd", ".hmmvmd.", "..mmdvd.", "...d..ds"],
  ["hhh.....", "hmmmmh..", ".hmmvmmd", "hmmmmvdd", "..d...ds"],
  ["h.....", ".h....", "..m...", "...m..", "....d.", ".....s"],
  ["mm......", "mddm....", "mddddm..", ".mddddm.", "mddvdddd", ".mddvdd.", "..dddvd.", "...d..ds"],
];

export function draw(p, t, o) {
  const R = radius(o), D = meta.duration;
  const ramps = [fit(o.palette, 5).map(hex), fit(o.orange, 5).map(hex), fit(o.amber, 5).map(hex)];
  const big = R >= 45;
  cycle(t, D, count(6, o.density), o.seed, (g) => g.range(3.6, 5), (age, life, r) => {
    const k = age / life, ph = r.range(0, TAU), sw = r.range(1.5, 2.3), spin = r.range(2.2, 3.4) * r.sign();
    const C = ramps[Math.floor(r.next() * 3)], size = r.next();
    const x0 = r.range(-0.95, 0.5) * R, y0 = -R * r.range(0.7, 1.0), fall = R * r.range(0.95, 1.3);
    // a pendulum swing with a breeze to the right; it drops faster at the bottom of each swing
    const swing = Math.sin(age * sw + ph);
    const x = x0 + swing * R * 0.16 + k * R * 0.35, y = y0 + fall * k + Math.abs(Math.cos(age * sw + ph)) * -1.5;
    if (Math.hypot(x, y) > R * 1.08) return;
    const a = env(k, 0.1, 0.25);
    if (a <= 0.15) return;
    // turn: face -> three-quarter -> edge -> back -> ...
    const turn = Math.cos(age * spin + ph), f = Math.abs(turn) < 0.25 ? 2 : turn > 0.65 ? 0 : turn > 0 ? 1 : turn < -0.65 ? 3 : 1;
    const rows = (big && size > 0.45 ? HUGE : R >= 24 || size > 0.5 ? BIG : SMALL)[f];
    // fading: step down the ramp instead of dithering, so the silhouette holds
    const lo = a > 0.55 ? 0 : 1, pal = { h: C[3 - lo], m: C[2 - lo], d: C[1 - lo], v: C[1 - lo], s: C[1 - lo] };
    if (f === 3) Object.assign(pal, { m: C[2 - lo], d: C[1 - lo], v: C[3 - lo], h: C[2 - lo] });
    const W = rows[0].length, H = rows.length, X = Math.round(x - W / 2), Y = Math.round(y - H / 2);
    // upside down for half the swing, mirrored for the other direction
    p.sprite(rows, pal, X, Y, { flip: swing < 0, flipY: Math.sin(age * spin * 0.5 + ph) < 0 });
    // catching the light: a glint when it turns face-up
    if (f === 0 && turn > 0.93 && a > 0.6) {
      p.px(X + 1, Y + 1, C[4]);
      p.light(X + 1, Y + 1, C[4], 0.5);
      p.glow(x, y, 6, C[3], 0.2);
    }
    p.light(x, y, C[2], 0.12 * a);
  });
}
