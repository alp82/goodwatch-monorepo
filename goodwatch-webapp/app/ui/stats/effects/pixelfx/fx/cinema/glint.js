import { seg, ease, WHITE, fit } from "../../core/index.js";
import { glint } from "./_burst.js";

export const meta = {
  name: "Hover glint",
  desc: "A small star glint pops on and shrinks away, two tiny twinkles answering it a beat later.",
  tags: ["cinema", "hover", "sparkle", "one-shot"],
  size: [40, 36],
  origin: [20, 18],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#5a4410", "#c8901c", "#ffd24a", "#fff3b8", "#ffffff"], seed: 1, s: 1 },
};

const TWINKLES = [[0, 0, 0, 4.5], [-8, 5, 0.1, 2], [7, -6, 0.16, 2.4]];

export function draw(p, t, o) {
  const C = fit(o.palette, 5), s = o.s ?? 1;
  for (const [x, y, d, arm] of TWINKLES) {
    const u = (t - d) / 0.36;
    if (u < 0 || u >= 1) continue;
    const g = u < 0.2 ? ease.outBack(u / 0.2) : 1 - ease.inQuad((u - 0.2) / 0.8);
    glint(p, x * s, y * s, arm * s * g, C[3], C[2], 0.5 * g);
    if (arm > 3 && g > 0.7) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) p.px(x * s + dx, y * s + dy, C[2]);
  }
  if (t < 0.05) p.glow(0, 0, 8 * s, C[3], 0.5);
}
