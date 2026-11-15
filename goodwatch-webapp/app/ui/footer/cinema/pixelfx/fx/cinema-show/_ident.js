// Made for the GoodWatch footer cinema: the GOODWATCH PICTURES lockup as a list of pixels, shared by the three studio
// idents (ident-a, ident-b, ident-c). Each ident paints the same pixels its own way through a per-pixel callback, so
// the wordmark, its bevel and its proportions stay identical across takes. Brand: G emblem white with an amber play
// triangle, "GOOD" white, "WATCH" amber (#fbbf24), "PICTURES" smaller below between two thin rules.
import { FONTS, hex } from "../../core/index.js";
import { G24, G32 } from "./_brand.js";

// five-step bevel ramps, dark to bright: 1 bottom edge, 2 right edge, 3 body, 4 top edge
export const RAMPS = {
  white: ["#1c1c26", "#5c5c6c", "#9d9daf", "#e2e2ea", "#ffffff"].map(hex),
  amber: ["#2e1a04", "#7a4a0a", "#c4820e", "#fbbf24", "#ffe9a0"].map(hex),
  soft: ["#1a1814", "#4e4a42", "#8c867a", "#cfc8b8", "#f4efe2"].map(hex),
};
const RAMP_OF = { g: "white", tri: "amber", good: "white", watch: "amber", pics: "soft", rule: "amber" };

// a word rasterized from the big font at scale k with extra tracking between letters: [{ x, y, li }]
function word(str, x0, y0, k, track, part, li0, out) {
  const F = FONTS.big;
  let x = x0, li = li0;
  for (const ch of str) {
    const g = F.glyphs[ch];
    if (!g) {
      x += (F.space + F.gap) * k + track;
      continue;
    }
    for (let r = 0; r < F.h; r++)
      for (let c = 0; c < g.w; c++)
        if (g.rows[r][c]) for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) out.push({ x: x + c * k + xx, y: y0 + r * k + yy, part, li, gx: c, gy: r });
    x += (g.w + F.gap) * k + track;
    li++;
  }
  return x - F.gap * k - track;
}

// the G grid, its play triangle split out by a flood fill from the triangle's middle
function emblem(grid, x0, y0, seedX, seedY, out) {
  const H = grid.length, W = grid[0].length, tri = new Set(), stack = [[seedX, seedY]];
  while (stack.length) {
    const [x, y] = stack.pop(), key = y * W + x;
    if (x < 0 || y < 0 || x >= W || y >= H || tri.has(key) || grid[y][x] === ".") continue;
    tri.add(key);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = grid[y][x];
      if (ch === ".") continue;
      out.push({ x: x0 + x, y: y0 + y, part: tri.has(y * W + x) ? "tri" : "g", li: -1, half: ch === "+" });
    }
}

function finish(px, extra) {
  const occ = new Set(px.map((q) => q.y * 4096 + q.x));
  const has = (x, y) => occ.has(y * 4096 + x);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of px) {
    q.top = !has(q.x, q.y - 1);
    q.bot = !has(q.x, q.y + 1);
    q.left = !has(q.x - 1, q.y);
    q.right = !has(q.x + 1, q.y);
    q.ramp = RAMPS[RAMP_OF[q.part]];
    q.lvl = q.top ? 4 : q.bot ? 1 : q.right ? 2 : 3;
    if (q.half) q.lvl = Math.min(q.lvl, 2);
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
  }
  for (const q of px) q.u = (q.x - x0) / (x1 - x0);
  return { px, has, x0, x1, y0, y1, ...extra };
}

/** Stacked lockup: G32 on top, GOODWATCH at scale 2, PICTURES tracked between rules. Spans about x -53..53, y -34..30. */
export function stackLogo() {
  const px = [];
  emblem(G32, -15, -34, 15, 16, px);
  const wl = -53, wt = 4;
  const goodEnd = word("GOOD", wl, wt, 2, 0, "good", 0, px);
  word("WATCH", goodEnd + 2, wt, 2, 0, "watch", 4, px);
  const pw = 8 * 5 + 7 * 3, pl = -Math.floor(pw / 2), pt = 23;
  word("PICTURES", pl, pt, 1, 2, "pics", 9, px);
  // the rules either side of PICTURES
  for (let x = wl; x <= pl - 5; x++) px.push({ x, y: pt + 3, part: "rule", li: -2 });
  for (let x = pl + pw + 4; x <= wl + 105; x++) px.push({ x, y: pt + 3, part: "rule", li: -2 });
  return finish(px, { g: { x: -15, y: -34, w: 30, h: 32 }, word: { x: wl, y: wt, w: 106, h: 14 }, pics: { x: pl, y: pt, w: pw, h: 7 } });
}

/** Side-by-side lockup: G24 at the left, GOODWATCH and PICTURES stacked to its right. Spans about x -68..66, y -12..11. */
export function rowLogo() {
  const px = [];
  const gx = -68, gy = -12;
  emblem(G24, gx, gy, 11, 12, px);
  const wl = gx + 29, wt = gy;
  const goodEnd = word("GOOD", wl, wt, 2, 0, "good", 0, px);
  word("WATCH", goodEnd + 2, wt, 2, 0, "watch", 4, px);
  const pw = 8 * 5 + 7 * 4, pt = gy + 17, pl = wl + 106 - pw;
  word("PICTURES", pl, pt, 1, 3, "pics", 9, px);
  for (let x = wl; x <= pl - 5; x++) px.push({ x, y: pt + 3, part: "rule", li: -2 });
  return finish(px, { g: { x: gx, y: gy, w: 23, h: 24 }, word: { x: wl, y: wt, w: 106, h: 14 }, pics: { x: pl, y: pt, w: pw, h: 7 } });
}

/** A lockup's color at bevel level lvl (clamped to the ramp): lower levels for stepped fades. */
export const tone = (q, lvl) => q.ramp[lvl < 0 ? 0 : lvl > 4 ? 4 : lvl];

/** Any word in the big font as pixels with edge flags, centered on x = 0 with its top at y0: { px, w, h }. */
export function wordPixels(str, y0, k = 1, track = 0) {
  const px = [];
  const probe = [];
  const w = word(str, 0, 0, k, track, "w", 0, probe);
  word(str, -Math.round(w / 2), y0, k, track, "w", 0, px);
  const occ = new Set(px.map((q) => q.y * 4096 + q.x + 2048));
  const has = (x, y) => occ.has(y * 4096 + x + 2048);
  for (const q of px) {
    q.top = !has(q.x, q.y - 1);
    q.bot = !has(q.x, q.y + 1);
    q.left = !has(q.x - 1, q.y);
    q.right = !has(q.x + 1, q.y);
    q.row = q.y - y0;
  }
  return { px, has, w, h: 7 * k, x0: -Math.round(w / 2) };
}
