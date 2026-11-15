// Shared bits for the title pun effects (set 2): poster size, scale, small shapes.
import { clamp } from "../../core/index.js";

/** The poster rect (w, h in effect px) and a size factor k (1 at the default 40 x 60). */
export function poster(o) {
  const w = o.w ?? 40, h = o.h ?? 60;
  return { w, h, k: clamp(Math.min(w / 40, h / 60), 0.6, 3.5) };
}

/** Inside a heart of half-size s centered on (0, 0), y down: <= 0 inside. */
export function heartField(x, y, s) {
  const u = x / s, v = -(y / s) * 1.12 + 0.18;
  const a = u * u + v * v - 1;
  return a * a * a - u * u * v * v * v;
}

/** Rotate (x, y) by the angle with cos c and sin s. */
export const rot = (x, y, c, s) => [x * c + y * s, -x * s + y * c];
