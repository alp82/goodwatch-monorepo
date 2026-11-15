// Made for the GoodWatch footer cinema: shared bits for the fake trailers (trailer-*.js): a clip to the screen,
// pixel type with tracking and per-pixel color, the title-card look (stepped fade in, a light sweep), shakes,
// a light wash over the whole screen, and a car drawn by sampling a sprite so it can tilt without holes.
import { Painter, FONTS, createFrame, painterFor, clamp, hex, mix, rand, WHITE } from "../../core/index.js";

const PUT = Painter.prototype.put, ADD = Painter.prototype.add, BLEND = Painter.prototype.blendPx;

/** Run fn with every write clipped to the local box [x0, x1) x [y0, y1) (fixed on screen, even through shakes); clips nest. */
export function clip(p, x0, y0, x1, y1, fn) {
  let X0 = Math.round(p.tx + x0), X1 = Math.round(p.tx + x1), Y0 = Math.round(p.ty + y0), Y1 = Math.round(p.ty + y1);
  const prev = p.clipBox;
  if (prev) [X0, X1, Y0, Y1] = [Math.max(X0, prev[0]), Math.min(X1, prev[1]), Math.max(Y0, prev[2]), Math.min(Y1, prev[3])];
  const saved = [p.put, p.add, p.blendPx, prev, Object.hasOwn(p, "put")];
  p.put = function (sx, sy, c, a) { if (sx >= X0 && sx < X1 && sy >= Y0 && sy < Y1) PUT.call(this, sx, sy, c, a); };
  p.add = function (sx, sy, c, k) { if (sx >= X0 && sx < X1 && sy >= Y0 && sy < Y1) ADD.call(this, sx, sy, c, k); };
  p.blendPx = function (sx, sy, c, a) { if (sx >= X0 && sx < X1 && sy >= Y0 && sy < Y1) BLEND.call(this, sx, sy, c, a); };
  p.clipBox = [X0, X1, Y0, Y1];
  try { fn(); } finally {
    if (saved[4]) [p.put, p.add, p.blendPx, p.clipBox] = saved;
    else { delete p.put; delete p.add; delete p.blendPx; delete p.clipBox; }
  }
}

// the writable screen box: the frame, cut down to the clip if one is on
function box(p) {
  let x0 = p.ox, x1 = p.ox + p.w, y0 = p.oy, y1 = p.oy + p.h;
  if (p.clipBox) [x0, x1, y0, y1] = [Math.max(x0, p.clipBox[0]), Math.min(x1, p.clipBox[1]), Math.max(y0, p.clipBox[2]), Math.min(y1, p.clipBox[3])];
  return [x0, x1, y0, y1];
}

/**
 * Bake a still layer once: fn(p) draws it (local coordinates, as usual) into an offscreen frame covering the local
 * box (ox, oy, w, h). Returns the drawn pixels and light, for stamp() to put down cheaply every frame.
 */
export function bake(ox, oy, w, h, fn) {
  const f = createFrame(w, h), p = painterFor(f);
  p.place(-ox, -oy);
  fn(p);
  const xy = [], col = [], lxy = [], lcol = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (f.color[i] >>> 24) xy.push(x + ox, y + oy), col.push(f.color[i]);
      if (f.light[i] & 0xffffff) lxy.push(x + ox, y + oy), lcol.push(f.light[i]);
    }
  return { xy: Int16Array.from(xy), col: Uint32Array.from(col), lxy: Int16Array.from(lxy), lcol: Uint32Array.from(lcol) };
}

/** Put a baked layer down, shifted by (dx, dy) whole px; light adds. k scales its light. */
export function stamp(p, b, dx = 0, dy = 0, k = 1) {
  const [x0, x1, y0, y1] = box(p), X = Math.round(p.tx + dx), Y = Math.round(p.ty + dy), W = p.w, C = p.C, L = p.L;
  for (let j = 0, n = b.col.length; j < n; j++) {
    const sx = X + b.xy[j * 2], sy = Y + b.xy[j * 2 + 1];
    if (sx >= x0 && sx < x1 && sy >= y0 && sy < y1) C[(sy - p.oy) * W + sx - p.ox] = b.col[j];
  }
  if (k > 0.004) for (let j = 0, n = b.lcol.length; j < n; j++) {
    const sx = X + b.lxy[j * 2], sy = Y + b.lxy[j * 2 + 1];
    if (sx >= x0 && sx < x1 && sy >= y0 && sy < y1) addPx(L, (sy - p.oy) * W + sx - p.ox, b.lcol[j], k);
  }
}

function addPx(L, i, c, k) {
  const d = L[i];
  const r = Math.min(255, (d & 255) + (c & 255) * k) | 0, g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k) | 0, b = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k) | 0;
  L[i] = (255 << 24) | (b << 16) | (g << 8) | r;
}

/** A light shape baked once as strengths: fn(x, y) => 0..1 over the local box. Use with shine(). */
export function lightMap(ox, oy, w, h, fn) {
  const k = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) k[y * w + x] = fn(x + ox + 0.5, y + oy + 0.5);
  return { ox, oy, w, h, k };
}

/** Add a light map in color c at strength k, its local box shifted by (dx, dy). */
export function shine(p, m, c, k, dx = 0, dy = 0) {
  if (k <= 0.004) return;
  const [x0, x1, y0, y1] = box(p), X = Math.round(p.tx + m.ox + dx), Y = Math.round(p.ty + m.oy + dy), W = p.w, L = p.L;
  const ya = Math.max(y0, Y), yb = Math.min(y1, Y + m.h), xa = Math.max(x0, X), xb = Math.min(x1, X + m.w);
  for (let sy = ya; sy < yb; sy++)
    for (let sx = xa; sx < xb; sx++) {
      const v = m.k[(sy - Y) * m.w + sx - X] * k;
      if (v > 0.004) addPx(L, (sy - p.oy) * W + sx - p.ox, c, v);
    }
}

/** Shift the origin by a shake of amp px (whole pixels), run fn, put it back. */
export function shaken(p, amp, t, seed, fn) {
  const { tx, ty } = p;
  if (amp > 0.3) {
    const i = Math.floor(t * 30);
    p.place(tx + Math.round((rand(i, seed) * 2 - 1) * amp), ty + Math.round((rand(i, seed + 7) * 2 - 1) * amp));
  }
  try { fn(); } finally { p.place(tx, ty); }
}

/** Light over the whole box (a flash that lights the frame): k may be a function of (x, y). */
export function wash(p, x0, y0, x1, y1, c, k) {
  if (typeof k === "number") {
    if (k <= 0.004) return;
    const [a0, a1, b0, b1] = box(p), xa = Math.max(a0, Math.round(p.tx + x0)), xb = Math.min(a1, Math.round(p.tx + x1)), ya = Math.max(b0, Math.round(p.ty + y0)), yb = Math.min(b1, Math.round(p.ty + y1));
    for (let sy = ya; sy < yb; sy++) for (let sx = xa; sx < xb; sx++) addPx(p.L, (sy - p.oy) * p.w + sx - p.ox, c, k);
    return;
  }
  p.shade(x0, y0, x1, y1, (x, y, out) => {
    out.l = c;
    out.k = typeof k === "function" ? k(x, y) : k;
  });
}

const glyph = (F, ch) => F.glyphs[ch] ?? F.glyphs[ch.toUpperCase()];

/** Width of a string in screen px. */
export function typeWidth(str, font = "big", scale = 1, track = 0) {
  const F = FONTS[font];
  let w = 0;
  for (const ch of str) w += (glyph(F, ch)?.w ?? F.space) + F.gap + track;
  return Math.max(0, w - F.gap - track) * scale;
}

/**
 * Pixel type. c is a color or (gx, gy, W) => color (gx, gy in font px from the text's top-left, W its width), 0 to
 * skip a pixel. o: { font, scale, track (extra font px between letters), align ("center" | "left"), a, shadow (color),
 * sx, sy (shadow offset in screen px), outline (color), dy: (gx) => extra screen px down for that column,
 * keep: (gx, gy, W) => whether to draw that pixel at all }.
 * Returns { left, top, w, h } in screen px.
 */
export function type(p, str, x, y, c, o = {}) {
  const font = o.font ?? "big", F = FONTS[font], k = o.scale ?? 1, tr = o.track ?? 0, a = o.a ?? 1;
  const W = typeWidth(str, font, 1, tr), left = Math.round(o.align === "left" ? x : x - (W * k) / 2), top = Math.round(y);
  const pass = (fn) => {
    let cx = 0;
    for (const ch of str) {
      const g = glyph(F, ch);
      if (!g) { cx += F.space + F.gap + tr; continue; }
      for (let r = 0; r < F.h; r++) for (let q = 0; q < g.w; q++) if (g.rows[r][q] && (!o.keep || o.keep(cx + q, r, W))) fn(cx + q, r);
      cx += g.w + F.gap + tr;
    }
  };
  const at = (gx, gy) => [left + gx * k, top + gy * k + (o.dy ? Math.round(o.dy(gx)) : 0)];
  if (o.outline) pass((gx, gy) => { const [X, Y] = at(gx, gy); p.rect(X - 1, Y - 1, k + 2, k + 2, o.outline, a); });
  if (o.shadow) pass((gx, gy) => { const [X, Y] = at(gx, gy); p.rect(X + (o.sx ?? 1), Y + (o.sy ?? 1), k, k, o.shadow, a); });
  pass((gx, gy) => {
    const col = typeof c === "function" ? c(gx, gy, W) : c;
    if (!col) return;
    const [X, Y] = at(gx, gy);
    p.rect(X, Y, k, k, col, a);
  });
  return { left, top, w: W * k, h: F.h * k };
}

/** A hard three-step fade from black: 0, 1/3, 2/3, 1 over `len` seconds from u = 0. */
export const steps = (u, len = 0.18) => (u < 0 ? 0 : u >= len ? 1 : Math.ceil((u / len) * 3) / 3);

const INK = hex("#0b0b10");

/**
 * A trailer title card: lines of type that step up out of black, a light sweep that crosses them once (a white
 * band with a glint and a horizontal streak of light), a faint pool of light behind. u is time since the card cut
 * in. lines: [{ s, y, c, font, scale, track }]. o: { sweep (start time), sweepLen, glow (color) }.
 */
export function card(p, u, lines, o = {}) {
  const lv = steps(u - 0.04, o.fade ?? 0.24), s0 = o.sweep ?? 0.35, sl = o.sweepLen ?? 0.7;
  if (lv <= 0) return;
  const glowC = hex(o.glow ?? "#fbbf24");
  for (const L of lines) {
    const font = L.font ?? "big", k = L.scale ?? 1, tr = L.track ?? 1, W = typeWidth(L.s, font, k, tr), base = hex(L.c ?? WHITE);
    const col = mix(INK, base, lv), sw = clamp((u - s0 - (L.delay ?? 0)) / sl);
    const bx = -W / 2 - 8 + (W + 16) * sw;
    type(p, L.s, 0, L.y, (gx, gy) => {
      if (sw <= 0 || sw >= 1) return col;
      const d = Math.abs(-W / 2 + gx * k - gy * k * 0.6 - bx + 3);
      return d < 1.5 ? WHITE : d < 4 ? mix(base, WHITE, 0.55) : col;
    }, { font, scale: k, track: tr });
    const h = FONTS[font].h * k;
    p.glowLine(-W / 2, L.y + h / 2, W / 2, L.y + h / 2, 10 + h, glowC, 0.07 * lv);
    if (sw > 0 && sw < 1) {
      const e = Math.sin(Math.PI * sw);
      p.glowLine(bx - 24, L.y + h / 2, bx + 24, L.y + h / 2, 2, WHITE, 0.2 * e);
      p.glow(bx, L.y + h / 2, 10 + h, WHITE, 0.4 * e);
    }
  }
}

/**
 * A sprite sampled through a rotation, so it can tilt without holes: rows of characters, pal maps them to colors.
 * (x, y) is where the sprite's pivot (px, py inside the sprite) lands; ang rotates it (radians, clockwise on screen).
 * o: { tint: (c, sx, sy) => color, a, sc (whole-number scale) }.
 */
export function tilted(p, rows, pal, x, y, px, py, ang, o = {}) {
  const H = rows.length, W = rows[0].length, ca = Math.cos(ang), sa = Math.sin(ang), k = o.sc ?? 1;
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const [cx, cy] of [[-px, -py], [W - px, -py], [-px, H - py], [W - px, H - py]]) {
    const X = x + (cx * ca - cy * sa) * k, Y = y + (cx * sa + cy * ca) * k;
    bx0 = Math.min(bx0, X); bx1 = Math.max(bx1, X); by0 = Math.min(by0, Y); by1 = Math.max(by1, Y);
  }
  p.shade(bx0 - 1, by0 - 1, bx1 + 1, by1 + 1, (X, Y, out) => {
    const dx = (X - x) / k, dy = (Y - y) / k, sx = Math.floor(dx * ca + dy * sa + px), sy = Math.floor(-dx * sa + dy * ca + py);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
    const ch = rows[sy][sx];
    if (ch === "." || ch === " ") return;
    let c = pal[ch];
    if (!c) return;
    if (o.tint) c = o.tint(c, sx, sy);
    out.c = c;
    out.a = o.a ?? 1;
  });
}

/** Bake a picture into a color grid (local box ox, oy, w, h) that drawGrid can rotate. */
export function bakeGrid(ox, oy, w, h, fn) {
  const f = createFrame(w, h), p = painterFor(f);
  p.place(-ox, -oy);
  fn(p);
  return { ox, oy, w, h, c: f.color, l: f.light };
}

/**
 * Draw a baked grid with its local (0, 0) at (x, y), turned by ang (clockwise on screen), sampled so it has no
 * holes. o: { keep: (gx, gy) => bool (only those grid pixels), tint: (c, gx, gy) => color, light (strength of its baked light) }.
 */
export function drawGrid(p, g, x, y, ang = 0, o = {}) {
  if (!ang && !o.keep && !o.tint && (o.light ?? 1) === 1) {
    // upright: copy it straight in, whole pixels
    const [x0, x1, y0, y1] = box(p), X = Math.round(p.tx + x + g.ox), Y = Math.round(p.ty + y + g.oy);
    for (let gy = 0; gy < g.h; gy++) {
      const sy = Y + gy;
      if (sy < y0 || sy >= y1) continue;
      for (let gx = 0; gx < g.w; gx++) {
        const sx = X + gx, i = gy * g.w + gx;
        if (sx < x0 || sx >= x1) continue;
        if (g.c[i] >>> 24) p.C[(sy - p.oy) * p.w + sx - p.ox] = g.c[i];
        if (g.l[i] & 0xffffff) addPx(p.L, (sy - p.oy) * p.w + sx - p.ox, g.l[i], 1);
      }
    }
    return;
  }
  const ca = Math.cos(ang), sa = Math.sin(ang);
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const [cx, cy] of [[g.ox, g.oy], [g.ox + g.w, g.oy], [g.ox, g.oy + g.h], [g.ox + g.w, g.oy + g.h]]) {
    const X = x + cx * ca - cy * sa, Y = y + cx * sa + cy * ca;
    bx0 = Math.min(bx0, X); bx1 = Math.max(bx1, X); by0 = Math.min(by0, Y); by1 = Math.max(by1, Y);
  }
  const lk = o.light ?? 1;
  p.shade(bx0 - 1, by0 - 1, bx1 + 1, by1 + 1, (X, Y, out) => {
    const dx = X - x, dy = Y - y, gx = Math.floor(dx * ca + dy * sa - g.ox), gy = Math.floor(-dx * sa + dy * ca - g.oy);
    if (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h) return;
    if (o.keep && !o.keep(gx + g.ox, gy + g.oy)) return;
    const i = gy * g.w + gx, c = g.c[i];
    if (c >>> 24) out.c = o.tint ? o.tint(c, gx + g.ox, gy + g.oy) : c;
    const l = g.l[i] & 0xffffff;
    if (l && lk > 0) (out.l = l | 0xff000000), (out.k = lk);
  });
}
