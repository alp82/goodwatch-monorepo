// Made for the GoodWatch stats page: The "Title Drop" trope chip: its own title drops onto it.
import { fit, seg, ease, FONTS, textWidth, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope: Title Drop",
  desc: "The letters of TITLE DROP drop one by one onto the chip's top edge, bounce and land in a row with a dust tick; the P wobbles, tips over and falls off the end.",
  tags: ["stats-page", "trope", "text", "fall", "one-shot"],
  size: [72, 40],
  origin: [16, 24],
  duration: 2.7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    dust: ["#3a3446", "#6a6278", "#a49cb2", "#dcd6e6"],
    text: "TITLE DROP",
    w: 40,
    h: 9,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.85 };

const FONT = FONTS.mini, GH = FONT.h;
const FIRST = 0.06, STAGGER = 0.07, FALL = 0.17, HIGH = 13, HOP = 0.13, HOP_H = 1.6;
const WOBBLE = 1.32, TIP0 = 1.56, TIP1 = 1.7, SLIDE = 1.86, SHINE = 2.0, FADE = 2.22, SINK = 0.14, SINK_STAGGER = 0.038;

/** Glyph boxes for the word, left to right: { g, x } with x the glyph's left column. */
function layout(text, w) {
  const out = [];
  let x = Math.round((w - textWidth(text, "mini")) / 2);
  for (const ch of text) {
    const g = FONT.glyphs[ch];
    if (!g) {
      x += FONT.space + FONT.gap;
      continue;
    }
    out.push({ g, x });
    x += g.w + FONT.gap;
  }
  return out;
}

/** Height above the rest line of a letter that started falling at s: a fall, one small hop, then still. */
function fallY(t, s) {
  const u = t - s;
  if (u < 0) return null;
  if (u < FALL) return -HIGH * (1 - (u / FALL) ** 2);
  const v = u - FALL;
  if (v < HOP) return -HOP_H * 4 * (v / HOP) * (1 - v / HOP);
  return 0;
}

/** A glyph with its top-left at (x, y), lit on top, darker at the foot; clip hides what is below the chip's top edge. */
function glyph(p, g, x, y, C, white, clip = false) {
  for (let r = 0; r < GH; r++)
    for (let c = 0; c < g.w; c++) {
      if (!g.rows[r][c] || (clip && y + r >= 0)) continue;
      const lit = r === 0 || !g.rows[r - 1][c];
      const col = white ? WHITE : lit ? C[6] : r === GH - 1 ? C[4] : C[5];
      p.px(x + c, y + r, col);
    }
}

/** A glyph turned by angle (clockwise, radians) about the pivot (px, py) given in glyph cells from its top-left. */
function glyphTurned(p, g, x, y, ang, pvx, pvy, C) {
  const ca = Math.cos(ang), sa = Math.sin(ang), wx = x + pvx, wy = y + pvy;
  const on = (gx, gy) => gx >= 0 && gy >= 0 && gx < g.w && gy < GH && g.rows[gy][gx];
  for (let Y = Math.floor(wy - 7); Y <= wy + 7; Y++)
    for (let X = Math.floor(wx - 7); X <= wx + 7; X++) {
      // inverse map each pixel back into the upright glyph so the turned letter has no holes
      const rx = X + 0.5 - wx, ry = Y + 0.5 - wy;
      const gx = Math.floor(rx * ca + ry * sa + pvx), gy = Math.floor(-rx * sa + ry * ca + pvy);
      if (!on(gx, gy)) continue;
      p.px(X, Y, gy === 0 || !on(gx, gy - 1) ? C[6] : gy === GH - 1 ? C[4] : C[5]);
    }
}

/** A dust tick: two specks kicked out sideways from a landing foot, stepping down the dust ramp. */
function dust(p, xl, xr, y, age, D, big = 1) {
  const L = 0.22 * big;
  if (age < 0 || age > L) return;
  const k = age / L, d = Math.round(1 + k * 2 * big);
  const c = k < 0.3 ? D[3] : k < 0.65 ? D[2] : D[1];
  p.px(xl - d, y, c);
  p.px(xr + d, y, c);
  if (big > 1 && k < 0.6) {
    p.px(xl - d + 1, y - 1, D[2]);
    p.px(xr + d - 1, y - 1, D[2]);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), D = fit(o.dust, 4), w = Math.max(12, o.w ?? 40);
  const top = -GH; // letters stand on the row just above the chip's top edge (y = 0)

  if (o.tease) {
    // one T drops onto the left of the chip, hops, sits for a beat, then drops into the chip like the word does
    const T = FONT.glyphs.T, x = layout(String(o.text).toUpperCase(), w)[0]?.x ?? 1;
    const y = fallY(t, 0.08);
    if (y === null || t >= tease.duration) return;
    const land = t - 0.08 - FALL, sink = t - 0.66;
    const sy = sink > 0 ? 1 + Math.round(GH * ease.inQuad(seg(sink, 0, SINK))) : 0;
    if (sink > 0 && sink < 0.08) p.px(x - 1, -1, D[3]);
    if (sy <= GH) glyph(p, T, x, top + Math.round(y) + sy, C, land >= 0 && land < 0.04, sy > 0);
    dust(p, x, x + 2, -1, land, D);
    return;
  }

  if (t >= meta.duration) return;
  const L = layout(String(o.text).toUpperCase(), w), n = L.length;
  const sweep = seg(t, SHINE, SHINE + 0.18);

  L.forEach((b, i) => {
    const s = FIRST + i * STAGGER, y = fallY(t, s);
    if (y === null) return;
    const land = t - s - FALL;
    dust(p, b.x, b.x + b.g.w - 1, -1, land, D);
    const last = i === n - 1;

    // the last letter: a wobble, a slow tip over its right foot, a thud, then it slides off the end and drops
    if (last && t >= WOBBLE) {
      if (t < TIP0) {
        // rocks on its right foot twice, the second time further, then goes over
        const step = Math.floor((t - WOBBLE) / 0.05);
        const ang = [0.28, 0.1, 0, 0, 0.36, 0.14, 0, 0.12][step] ?? 0.12;
        glyphTurned(p, b.g, b.x, top, ang, b.g.w, GH, C);
        return;
      }
      if (t < TIP1) {
        glyphTurned(p, b.g, b.x, top, 0.12 + (Math.PI / 2 - 0.12) * ease.inQuad(seg(t, TIP0, TIP1)), b.g.w, GH, C);
        return;
      }
      const thud = t - TIP1;
      dust(p, b.x + b.g.w + 1, b.x + b.g.w + GH - 1, -1, thud, D, 2);
      if (t < SLIDE) {
        // lying on its back: a white frame and a 1 px rebound on the thud
        glyphTurned(p, b.g, b.x, top + (thud < 0.05 ? -1 : 0), Math.PI / 2, b.g.w, GH, thud < 0.04 ? C.map(() => WHITE) : C);
        return;
      }
      // slides right off the chip's end and drops, still lying down, gone below the edge
      const v = t - SLIDE, sx = v * 26 + 0.5 * 120 * v * v;
      const over = Math.max(0, b.x + b.g.w + sx - (w - 1));
      const dy = over > 2 ? 0.5 * 520 * Math.max(0, v - 0.08) ** 2 : 0;
      const ang = Math.PI / 2 + Math.min(1.2, dy * 0.12);
      if (top + dy > (o.h ?? 9) - 2) return; // gone once it has dropped past the chip's bottom
      glyphTurned(p, b.g, b.x + sx, top + dy, ang, b.g.w, GH, C);
      return;
    }

    // the rest: fall, a white frame as each lands, then sit in the row
    const yy = top + Math.round(y);
    let Cl = C;
    // a shine runs across the row
    const here = i / Math.max(1, n - 2);
    if (sweep > 0 && sweep < 1 && Math.abs(here - sweep) < 0.12) Cl = C.map((c, k) => (k >= 4 ? C[Math.min(7, k + 2)] : c));
    // then the word drops into the chip, left to right, as if through a slot in its top edge
    const sink = t - (FADE + i * SINK_STAGGER);
    const sy = sink > 0 ? Math.round(GH * ease.inQuad(seg(sink, 0, SINK))) + (sink > 0 ? 1 : 0) : 0;
    if (sy > GH) return;
    if (sink > 0 && sink < 0.08) p.px(b.x - 1, -1, D[3]); // a speck kicked off the slot's lip
    glyph(p, b.g, b.x, yy + sy, Cl, land >= 0 && land < 0.04, sy > 0);
  });
}
