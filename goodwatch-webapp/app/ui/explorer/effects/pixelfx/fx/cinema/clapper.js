import { burst, fly, seg, ease, hex, WHITE, fit, clamp } from "../../core/index.js";
import { streak, fadeOut, INK } from "./_burst.js";

export const meta = {
  name: "Clapper snap",
  desc: "A little slate pops up with its striped stick open, the stick snaps shut with a white flash and a ring of sparks, then the slate lifts and dithers away.",
  tags: ["cinema", "open", "one-shot"],
  size: [84, 72],
  origin: [42, 40],
  duration: 0.95,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#3a2a10", "#a86a12", "#ffc23d", "#fff0b0", "#ffffff"], seed: 5, s: 1 },
};

const BODY = hex("#34303f"), BODY_HI = hex("#5a556a"), RIM = hex("#76718a"), CHALK = hex("#d8d4e4"), GREY = hex("#8a8698");
const SNAP = 0.2;

export function draw(p, t, o) {
  const C = fit(o.palette, 5), s = o.s ?? 1;
  const pop = ease.outBack(seg(t, 0, 0.1)) * (1 - 0.55 * ease.inCubic(seg(t, 0.55, 0.9))), a = fadeOut(t, 0.72, 0.9);
  const lift = -6 * s * ease.inQuad(seg(t, 0.5, 0.9));
  const shake = t > SNAP && t < SNAP + 0.08 ? (Math.floor(t * 60) % 2 ? 1 : -1) : 0;
  const W = 10 * s * pop, H = 6.5 * s * pop, cx = shake, cy = lift;
  if (W < 1) return;
  // the slate: dark body, lit top edge, chalk lines
  p.rect(cx - W, cy - H + 2, W * 2, H * 2, BODY, a);
  p.line(cx - W, cy - H + 2, cx + W - 1, cy - H + 2, BODY_HI, a);
  p.line(cx - W, cy - H + 2, cx - W, cy + H + 1, BODY_HI, a);
  p.line(cx - W, cy + H + 1, cx + W - 1, cy + H + 1, hex("#1c1a24"), a);
  p.line(cx - W + 2, cy, cx + W - 2, cy, CHALK, a * 0.85);
  p.line(cx - W + 2, cy + H * 0.6, cx + W - 3, cy + H * 0.6, GREY, a * 0.8);
  p.line(cx - 1, cy, cx - 1, cy + H + 1, GREY, a * 0.8);
  // the stick: hinged at the top left, open, then it snaps shut
  const open = t < SNAP ? -0.75 * (1 - ease.inCubic(seg(t, 0.06, SNAP))) : 0.06 * Math.sin((t - SNAP) * 60) * Math.exp(-(t - SNAP) * 25);
  const hx = cx - W, hy = cy - H + 1, L = W * 2, T = 3 * s, ca = Math.cos(open), sa = Math.sin(open);
  p.shade(hx - 2, hy - L - 2, hx + L + 2, hy + T + 2, (x, y, out) => {
    const dx = x - hx, dy = y - hy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    if (u < 0 || u > L || v > 0 || v < -T) return;
    out.a = a;
    if (v > -0.9 || v < -T + 0.9 || u < 0.9 || u > L - 0.9) return RIM;
    return Math.floor((u + v) / (2.5 * s)) % 2 ? WHITE : INK;
  });
  // the snap: hero frame, sparks thrown out from the closing edge, a light that flares and dies
  if (t >= SNAP) {
    const k = t - SNAP;
    if (k < 0.05) {
      p.rect(cx - W - 1, hy - 2, L + 2, 3, WHITE);
      p.glow(cx, hy, 18 * s, C[3], 0.6);
    }
    p.glow(cx, hy, 26 * s, C[2], 0.35 * (1 - seg(k, 0, 0.35)));
    burst(12, o.seed, (r, i) => {
      const side = i % 2 ? 1 : -1, an = side > 0 ? r.range(-1.3, 0.2) : Math.PI + r.range(-0.2, 1.3);
      const sp = r.range(90, 180) * s, life = r.range(0.18, 0.4);
      if (k > life) return;
      const x0 = cx + side * W * r.range(0.2, 1), [x, y] = fly(x0, hy, Math.cos(an) * sp, Math.sin(an) * sp, k, 260, 3.5);
      const f = 1 - k / life;
      streak(p, x, y, Math.cos(an), Math.sin(an) + k * 2, 1 + 3 * f, f > 0.5 ? WHITE : C[3], C[2]);
      p.light(x, y, C[2], 0.45 * f);
    });
    // two chalk-dust puffs off the hinge and tip
    for (const side of [-1, 1]) {
      const r2 = 1 + 4 * ease.outQuad(seg(k, 0, 0.5)), al = 0.35 * (1 - seg(k, 0.05, 0.55));
      if (al > 0) p.disc(cx + side * (W + r2 * 0.8), hy - r2 * 0.3, r2, CHALK, (d) => al * (1 - d));
    }
  }
  p.glow(cx, cy, 14 * s, C[1], 0.15 * a * clamp(pop));
}
