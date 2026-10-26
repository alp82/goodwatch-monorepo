/** Bulb centres around the poster frame, clockwise from the top-left corner, outside the frame by `margin`. */
import type { PosterRect } from './popcorn-path';
export function marqueeBulbs(poster: PosterRect, spacing = 15, margin = 9) {
  const x0 = poster.x - margin, y0 = poster.y - margin, w = poster.width + 2 * margin, h = poster.height + 2 * margin;
  const perimeter = 2 * (w + h);
  const count = Math.max(16, Math.round(perimeter / spacing));
  return Array.from({ length: count }, (_, k) => {
    let d = (k / count) * perimeter;
    if (d < w) return { x: x0 + d, y: y0 };
    if ((d -= w) < h) return { x: x0 + w, y: y0 + d };
    if ((d -= h) < w) return { x: x0 + w - d, y: y0 + h };
    d -= w;
    return { x: x0, y: y0 + h - d };
  });
}
/** Chase peak for bulb k of n inside the loop's 0..1 range, kept away from the ends so input ranges stay ordered. */
export function chaseRange(k: number, n: number) {
  const p = 0.05 + ((k + 0.5) / n) * 0.9;
  return { inputRange: [0, p - 0.04, p, Math.min(0.999, p + 0.06), 1], outputRange: [0.35, 0.35, 1, 0.35, 0.35] };
}
