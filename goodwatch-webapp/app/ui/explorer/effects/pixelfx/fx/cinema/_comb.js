// Made for the GoodWatch explorer map. Shared bits for the combination effects (comb-*): the marquee bulb ring round the
// hub, searchlight beams, and a ramp from one color.
import { hex, mix, scale, WHITE, TAU } from "../../core/index.js";

/** Five steps dark to bright around one "#rrggbb", as numbers. */
export function rampOf(c) {
  const n = typeof c === "number" ? c : hex(c);
  return [scale(n, 0.28), scale(n, 0.6), n, mix(n, WHITE, 0.45), mix(n, WHITE, 0.82)];
}

/** How many bulbs sit on a ring of radius R: about one every 6 px, an even number. */
export const bulbCount = (R) => Math.max(10, Math.round((TAU * R) / 6 / 2) * 2);

/**
 * One marquee bulb at (x, y): lit k 0..1. Unlit: a dark 2x2 socket with a dim glass pixel. Lit: a 2x2 warm bulb with a
 * white hot pixel and light; a 3x3 plus when big.
 */
export function bulb(p, x, y, k, C, big = false) {
  const X = Math.round(x), Y = Math.round(y);
  if (k < 0.2) {
    p.px(X, Y, C[1]); p.px(X + 1, Y, C[0]); p.px(X, Y + 1, C[0]); p.px(X + 1, Y + 1, C[0]);
    return;
  }
  const body = k > 0.7 ? C[4] : k > 0.5 ? C[3] : C[2], rim = k > 0.7 ? C[3] : k > 0.5 ? C[2] : C[1];
  p.px(X, Y, k > 0.7 ? WHITE : body); p.px(X + 1, Y, body); p.px(X, Y + 1, body); p.px(X + 1, Y + 1, rim);
  if (big && k > 0.6) { p.px(X - 1, Y, rim); p.px(X + 2, Y + 1, rim); p.px(X + 1, Y - 1, rim); p.px(X, Y + 2, rim); }
  p.light(X + 0.5, Y + 0.5, C[3], 0.35 * k);
  if (k > 0.5) p.glow(X + 0.5, Y + 0.5, big ? 5 : 3.5, C[2], 0.16 * k);
}

/**
 * A searchlight beam from (x, y) pointing at angle ang (radians, 0 = right, -PI/2 = up), length L, half-spread sp:
 * a soft translucent cone with a brighter core line, as light.
 */
export function beam(p, x, y, ang, L, sp, c, k) {
  // Bounded steps and widths, so a big hub can't cost more than a small one
  const steps = Math.min(18, Math.max(6, Math.round(L / 3)));
  for (let i = 1; i <= steps; i++) {
    const u = i / steps, d = u * L, w = Math.min(12, 1 + d * Math.tan(sp));
    const cx = x + Math.cos(ang) * d, cy = y + Math.sin(ang) * d;
    // fades along its length, brightest a little way out
    const kk = k * (u < 0.15 ? u / 0.15 : 1) * (1 - u) ** 1.3;
    p.glow(cx, cy, w, c, 0.15 * kk);
  }
  p.glowLine(x, y, x + Math.cos(ang) * L * 0.75, y + Math.sin(ang) * L * 0.75, 1.5, c, 0.22 * k);
}
