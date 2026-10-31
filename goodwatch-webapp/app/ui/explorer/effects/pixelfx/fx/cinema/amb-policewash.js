// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, clamp } from "../../core/index.js";
import { radius } from "./_amb2.js";

export const meta = {
  name: "Patrol wash",
  desc: "Over a crime island: a soft red glow on the left and a soft blue one on the right take turns, like patrol lights washing a night street in a film.",
  tags: ["cinema", "ambient", "island", "crime", "police", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "dark",
  // red, red core, blue, blue core
  options: { palette: ["#ff2a3a", "#ffb0b0", "#2a5cff", "#b8ccff"], seed: 1, r: 30, density: 1 },
};

/** 0..1 pulse over phase u in [a, b): soft rise, a held top, soft fall. */
function pulse(u, a, b) {
  if (u < a || u >= b) return 0;
  const v = (u - a) / (b - a);
  const s = (x) => x * x * (3 - 2 * x);
  return v < 0.3 ? s(v / 0.3) : v > 0.7 ? s((1 - v) / 0.3) : 1;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 4).map(hex), R = radius(o), u = (t / meta.duration) % 1;
  // red takes the first half, blue the second; each half gets a short second flick, like a real light bar
  const red = Math.max(pulse(u, 0, 0.32), 0.55 * pulse(u, 0.34, 0.46));
  const blue = Math.max(pulse(u, 0.5, 0.82), 0.55 * pulse(u, 0.84, 0.96));
  const off = R * 0.62, y = -R * 0.12, gr = clamp(R * 0.8, 10, 34), k = 0.42 * (o.density >= 2 ? 1.3 : 1);
  // a faint steady tint on both sides so it never goes fully dark
  p.glow(-off, y, gr, C[0], 0.06);
  p.glow(off, y, gr, C[2], 0.06);
  if (red > 0.01) {
    p.glow(-off, y, gr * 1.7, C[0], 0.4 * k * red);
    p.glow(-off, y, gr, C[0], k * red);
    p.glow(-off, y, gr * 0.3, C[1], 0.16 * red);
  }
  if (blue > 0.01) {
    p.glow(off, y, gr * 1.7, C[2], 0.4 * k * blue);
    p.glow(off, y, gr, C[2], k * blue);
    p.glow(off, y, gr * 0.3, C[3], 0.16 * blue);
  }
}
