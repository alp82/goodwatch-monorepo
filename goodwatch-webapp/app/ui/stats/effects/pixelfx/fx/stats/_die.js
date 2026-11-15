// A six-sided die drawn as pixel art: a cube seen face-on that can spin in the picture plane (angle) and roll over
// its horizontal axis (roll, 0 to a quarter turn), so the leaving face squashes down while the next one grows in
// above it. Shared by the stats effects.
import { clamp, mix, WHITE } from "../../core/index.js";

// pip positions on a unit face, by face value: on a 14 px die they sit on whole pixels (4, 7 and 10)
const L = 4 / 14, H = 10 / 14;
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[L, L], [H, H]],
  3: [[L, L], [0.5, 0.5], [H, H]],
  4: [[L, L], [H, L], [L, H], [H, H]],
  5: [[L, L], [H, L], [0.5, 0.5], [L, H], [H, H]],
  6: [[L, L], [H, L], [L, 0.5], [H, 0.5], [L, H], [H, H]],
};

/** Signed distance to a rounded box of half sizes hx, hy and corner radius r. */
function sdBox(x, y, hx, hy, r) {
  const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Faces in roll order ending on `last`: neighbours on a real die (never the same face twice, never opposites,
 * which add up to 7). `pick` is a seeded index picker.
 */
export function faceRun(n, last, pick) {
  const out = [last];
  for (let i = 0; i < n; i++) {
    const prev = out[0], ok = [1, 2, 3, 4, 5, 6].filter((f) => f !== prev && f + prev !== 7);
    out.unshift(ok[pick(ok.length)]);
  }
  return out;
}

/**
 * Draws the die centered on (x, y). C: an 8 step ramp, dark to bright (body). pip: pip color. s: edge in px.
 * a: angle in the picture plane. roll: 0..PI/2, how far face `from` has rolled away to show face `to`.
 * sq: vertical squash (1 none). alpha: dithered fade. hot: 0..1 white flash on the body.
 */
export function drawDie(p, x, y, { s = 14, a = 0, roll = 0, from = 1, to = 2, sq = 1, alpha = 1, hot = 0 }, C, pip) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const hA = s * Math.cos(roll), hB = s * Math.sin(roll), H = (hA + hB) * sq, top = -H / 2;
  const hx = s / 2, hy = H / 2, rc = Math.min(2.2, s * 0.17);
  // light comes from the top left of the picture: into the die's own frame
  const lx = -0.7 * ca - 0.7 * sa, ly = 0.7 * sa - 0.7 * ca;
  const ext = s * 0.8 + 2;
  const faceCol = (lit) => (lit > 0.85 ? C[5] : lit > 0.55 ? C[4] : lit > 0.3 ? C[3] : C[2]);
  const litA = Math.cos(roll), litB = 0.55 + 0.45 * Math.sin(roll);
  p.shade(x - ext, y - ext, x + ext, y + ext, (px, py, out) => {
    const dx = px - x, dy = py - y;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    const d = sdBox(u, v, hx, hy, rc);
    if (d > 0.5) return;
    out.a = alpha;
    if (d > -0.5) return C[1];
    // the edge facing the light catches it, the far edge sinks into shadow
    const nx = clamp(u / hx, -1, 1), ny = clamp(v / hy, -1, 1);
    const facing = nx * lx + ny * ly;
    const body = (c) => (hot > 0 ? mix(c, WHITE, hot) : c);
    if (d > -1.5) return body(facing > 0.35 ? C[6] : facing < -0.45 ? C[3] : C[5]);
    // which face: B (coming in) above, A (leaving) below, a dark seam between them
    const vv = (v - top) / sq;
    const onB = vv < hB;
    if (hB > 0.8 && hA > 0.8 && Math.abs(vv - hB) < 0.5) return C[2];
    const fu = (u + hx) / s, fv = onB ? vv / Math.max(hB, 1e-3) : (vv - hB) / Math.max(hA, 1e-3);
    const face = onB ? to : from, h = onB ? hB : hA;
    if (h >= 2.6) {
      // square pips, 2 px on a 14 px face: crisp when the die lies flat, squashed with the face as it rolls
      const r = 1 / 14;
      for (const [qx, qy] of PIPS[face]) {
        const ex = (fu - qx) / r, ey = (fv - qy) / r;
        if (Math.max(Math.abs(ex), Math.abs(ey)) < 0.999) return hot > 0.5 ? C[4] : pip;
      }
    }
    return body(faceCol(onB ? litB : litA));
  });
}
