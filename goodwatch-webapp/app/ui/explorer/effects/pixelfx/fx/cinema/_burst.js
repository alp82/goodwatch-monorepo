// Shared bits for the cinema interaction bursts (GoodWatch map). Small, cheap, pure.
import { clamp, hex, WHITE } from "../../core/index.js";

/** A speed streak: a bright head and a dimmer tail pointing back along the motion. */
export function streak(p, x, y, vx, vy, len, head, tail, a = 1) {
  const s = Math.hypot(vx, vy) || 1, ux = vx / s, uy = vy / s;
  p.line(x - ux * len, y - uy * len, x, y, (u) => (u > 0.55 ? head : tail), a);
}

/** Alpha that is 1 until t0 and dithers out to 0 at t1. */
export const fadeOut = (t, t0, t1) => clamp(1 - (t - t0) / (t1 - t0));

/** A small four-point glint with a light. */
export function glint(p, x, y, arm, c, tip, k = 0.4) {
  const n = Math.round(arm);
  if (n < 1) return p.px(x, y, c);
  p.px(x, y, WHITE);
  for (let d = 1; d <= n; d++) {
    const cc = d > n * 0.55 ? tip : c;
    p.px(x + d, y, cc); p.px(x - d, y, cc); p.px(x, y + d, cc); p.px(x, y - d, cc);
  }
  p.light(x, y, c, k);
  if (n > 2) p.glow(x, y, n + 2, c, k * 0.5);
}

export const INK = hex("#121019");
