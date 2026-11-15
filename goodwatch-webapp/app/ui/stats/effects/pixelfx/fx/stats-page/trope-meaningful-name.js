// Made for the GoodWatch stats page: The "Meaningful Name" trope chip shows what's behind its name tag.
// Anchor (0, 0) is the chip's top-left corner; o.w, o.h are the chip's size in effect px.
import { fit, seg, ease, lerp, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope: Meaningful Name",
  desc: "A little name tag on a string pops up from behind the chip, flips over to show a gold star on its blue back with a sparkle, swings, flips back and ducks away.",
  tags: ["stats-page", "trope", "name", "tag", "one-shot"],
  size: [80, 36],
  origin: [10, 26],
  duration: 2.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1c1a22", "#6a6658", "#b8b09c", "#e8e2d0", "#fbf8ee"],
    band: ["#123a6a", "#2a6ab8", "#5aa0e8"],
    star: ["#6a4a10", "#c89a28", "#f4d860", "#fff6c4"],
    w: 59,
    h: 9,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.8 };

// the tag in its own units: the hole is at (0, 0), near its pointed foot; the card runs up from there, 7 px wide
function inTag(u, v) {
  const a = Math.abs(u);
  if (v < -9.5 || v > 1.5) return false;
  if (v < -2) return a <= 3.5 && !(v < -8.5 && a > 2.5); // the card, its top corners clipped
  return a <= 3.5 - (v + 2) * 1.15; // the foot tapers to a point under the hole
}

// a 5 x 5 star on the back, centered on (0, -5.5) in tag units: 1 hot center, 2 body, 3 tips
const STAR = ["..3..", ".323.", "32123", ".222.", ".3.3."];

/** Where the tag stands at t: pivot y (the hole, rows above the chip are negative), tilt (rad), flip angle (0 front, PI back). */
function pose(t) {
  let py, tilt = 0, flip = 0;
  if (t < 0.24) py = lerp(12, -3, ease.outBack(seg(t, 0.04, 0.24), 1.8));
  else if (t < 1.9) py = -3;
  else py = lerp(-3, 13, ease.inBack(seg(t, 1.9, 2.15), 1.4));
  // a springy settle after the pop, a swing after the flip, a nod as it flips back
  if (t > 0.18 && t < 0.6) tilt = 0.22 * Math.sin((t - 0.18) * 18) * Math.exp(-(t - 0.18) * 7);
  if (t > 0.82 && t < 1.55) tilt = 0.32 * Math.sin((t - 0.82) * 11) * Math.exp(-(t - 0.82) * 3.2);
  flip = Math.PI * ease.inOutCubic(seg(t, 0.56, 0.82)) * (1 - ease.inOutCubic(seg(t, 1.52, 1.76)));
  return { py, tilt, flip };
}

function drawTag(p, P, Bd, St, px, m, hot) {
  const R = 12, W = R * 2 + 1, X0 = px - R, Y0 = Math.round(m.py) - R - 6;
  const sx = Math.cos(m.flip), back = sx < 0, k = Math.max(Math.abs(sx), 0.14);
  // rasterise: for each pixel, back into tag units. The swing is a shear about the hole, whole pixels per row, so
  // every row stays a clean copy of itself (no rotation mush on the star); then undo the flip's squeeze
  const cell = new Int8Array(W * (R * 2 + 1)).fill(-1), U = new Float32Array(cell.length), V = new Float32Array(cell.length);
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const dx = X0 + i + 0.5 - (px + 0.5), dy = Y0 + j + 0.5 - (m.py + 0.5);
      const v = dy, u = (dx - Math.round(-m.tilt * dy)) / k;
      if (Y0 + j >= 0 || !inTag(u, v)) continue;
      cell[j * W + i] = 1;
      U[j * W + i] = back ? -u : u;
      V[j * W + i] = v;
    }
  const at = (i, j) => i >= 0 && j >= 0 && i < W && j < W && cell[j * W + i] > 0;
  // dark outline so the card reads over the page and the chip
  for (let j = -1; j <= W; j++)
    for (let i = -1; i <= W; i++)
      if (Y0 + j < 0 && !at(i, j) && (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1))) p.px(X0 + i, Y0 + j, P[0]);
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      if (!at(i, j)) continue;
      const u = U[j * W + i], v = V[j * W + i];
      let c;
      if (hot) c = WHITE;
      else if (Math.abs(sx) < 0.3) c = P[2]; // edge-on: a thin sliver of card
      else if (Math.abs(u) < 0.6 && Math.abs(v) < 0.6) c = P[1]; // the hole
      else if (!back && v < -7.5) c = !at(i - 1, j) ? Bd[2] : Bd[1]; // the colored band across the top
      else if (!back && (Math.round(v + 0.5) === -5 && u > -2.6 && u < 1.6)) c = P[1]; // a written name
      else if (!back && (Math.round(v + 0.5) === -3 && u > -2.6 && u < -0.4)) c = P[2];
      else if (back) c = !at(i - 1, j) || !at(i, j - 1) ? Bd[2] : !at(i + 1, j) || !at(i, j + 1) ? Bd[0] : Bd[1]; // a blue back
      else c = !at(i - 1, j) || !at(i, j - 1) ? P[4] : !at(i + 1, j) || !at(i, j + 1) ? P[2] : P[3];
      // the star on the back
      if (back && !hot && Math.abs(sx) >= 0.3) {
        const si = Math.round(u + 2), sj = Math.round(v + 5.5 + 2);
        const ch = STAR[sj]?.[si];
        if (ch === "1") c = St[3];
        else if (ch === "2") c = St[2];
        else if (ch === "3") c = St[2];
      }
      p.px(X0 + i, Y0 + j, c);
    }
}

export function draw(p, t, o) {
  const P = fit(o.palette, 5), Bd = fit(o.band, 3), St = fit(o.star, 4);
  const w = Math.max(14, o.w), px = Math.round(w * 0.72);

  if (o.tease) {
    if (t >= tease.duration) return;
    // the tag's top corner flutters up over the edge and drops back
    const py = t < 0.5 ? lerp(12, 5, ease.outBack(seg(t, 0.04, 0.2), 2)) : lerp(5, 13, ease.inQuad(seg(t, 0.5, 0.66)));
    const tilt = 0.3 * Math.sin(t * 30) * (1 - seg(t, 0.3, 0.55));
    drawTag(p, P, Bd, St, px, { py, tilt, flip: 0 }, false);
    return;
  }
  if (t >= meta.duration) return;

  const m = pose(t);
  // the string: tied at the chip's top edge, up to the hole
  if (m.py < 0) {
    for (let y = -1; y > m.py; y--) p.px(px, y, P[2]);
    p.px(px - 1, -1, P[1]);
    p.px(px + 1, -1, P[1]);
  }
  const flipped = t >= 0.82 && t < 0.88; // the white hero frame as the back lands face up
  drawTag(p, P, Bd, St, px, m, flipped);

  // the reveal: a sparkle off the star and two small twinkles round the card
  const sp = t - 0.82;
  if (sp > 0 && sp < 0.6) {
    const cx = px + Math.round(m.tilt * 5.5), cy = m.py - 5.5;
    if (sp < 0.3) {
      const r = 3 + Math.round(sp * 16), c = sp < 0.1 ? WHITE : sp < 0.2 ? St[3] : St[2];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        p.px(cx + dx * r, cy + dy * r, c);
        if (sp < 0.18) p.px(cx + dx * (r - 1), cy + dy * (r - 1), St[2]);
      }
      p.glow(cx, cy, 7, St[2], 0.35 * (1 - sp / 0.3));
    }
    for (const [dx, dy, t0] of [[-6, -9, 0.12], [5, -11, 0.3]]) {
      const u = (sp - t0) / 0.22;
      if (u < 0 || u > 1) continue;
      const x = px + dx, y = m.py + dy, c = u < 0.5 ? St[3] : St[1];
      p.px(x, y, u < 0.25 ? WHITE : c);
      if (u > 0.15 && u < 0.7) { p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y - 1, c); p.px(x, y + 1, c); }
      p.light(x, y, St[2], 0.3 * (1 - u));
    }
  }
}
