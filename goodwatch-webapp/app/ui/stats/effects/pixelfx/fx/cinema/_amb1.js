// Shared bits for the cinema ambient loops (amb-*): sizes, where an island's elements hover, a seamless phase.
import { TAU } from "../../core/index.js";

/** Common meta for an ambient: 112 x 104 around the island's middle at r 30. */
export const AMB = { size: [112, 104], origin: [56, 56], fps: 30, bg: "dark" };

/**
 * How many elements: base at density 1 on an island of r 30, about twice that at density 2; bigger islands get a
 * few more (by the square root of their size), small ones a few fewer.
 */
export const count = (o, base) =>
  Math.max(1, Math.round(base * (o.density >= 2 ? 2 : 1) * Math.min(1.6, Math.max(0.7, Math.sqrt((o.r ?? 30) / 30)))));

/**
 * A spot hovering over the island, from an rng: x across most of it, y over the upper half (a little below the
 * middle at most). r is the island radius.
 */
export function spot(R, r, up = 0.85, down = 0.15) {
  const x = R.range(-0.85, 0.85) * r, y = -R.range(-down, up) * r;
  return [x, y];
}

/** sin of n whole turns over the loop: seamless. */
export const wave = (t, D, n, ph = 0) => Math.sin((TAU * n * t) / D + ph);

/** When element i of n is born in a loop of D seconds: spread evenly with a little jitter, so there are no gaps. */
export const bornAt = (i, n, D, jitter) => ((i + jitter * 0.6) / n) * D;
