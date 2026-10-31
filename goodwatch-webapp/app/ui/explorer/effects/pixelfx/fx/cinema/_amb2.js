// Shared bits for the cinema ambient loops (set 2): where an element hovers around an island, and how it fades.
// Origin (0, 0) is the island's middle; R is its radius in effect pixels.

import { clamp, smooth, TAU } from "../../core/index.js";

/** A spot around the island, mostly over its upper half, within about 1.05 R of the middle. */
export function spot(r, R, near = 0.45, far = 1) {
  const up = r.chance(0.75);
  const a = up ? r.range(-Math.PI * 0.95, -Math.PI * 0.05) : r.range(-0.2, Math.PI + 0.2);
  const d = R * r.range(near, far);
  return [Math.cos(a) * d, Math.sin(a) * d * (up ? 0.85 : 0.6)];
}

/** Fade in over the first `fin` of life, out over the last `fout` (both fractions of 0..1). */
export const env = (k, fin = 0.2, fout = 0.35) => clamp(Math.min(smooth(0, fin, k), 1 - smooth(1 - fout, 1, k)));

/** Elements for a density: base at 1, about twice at 2. */
export const count = (base, density) => Math.max(1, Math.round(base * (density >= 2 ? 2 : density)));

/** Radius from the options, kept to the sizes the runtime passes. */
export const radius = (o) => clamp(o.r ?? 30, 10, 100);

/** Keep a point within 1.12 R of the middle, so a moving element never leaves the island's band. */
export function keep(x, y, R) {
  const d = Math.hypot(x, y), m = R * 1.12;
  return d > m ? [(x / d) * m, (y / d) * m] : [x, y];
}

export { TAU };

/** Fade a small shape by stepping down the ramp (no dither, so a 5 px shape keeps its silhouette). 0 = skip. */
export const step = (C, a, top = 3) => (a > 0.66 ? C[top] : a > 0.36 ? C[top - 1] : a > 0.14 ? C[Math.max(0, top - 2)] : 0);
