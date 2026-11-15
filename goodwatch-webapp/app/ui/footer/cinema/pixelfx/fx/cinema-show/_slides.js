// Made for the GoodWatch footer cinema: shared bits for the intermission, snack bar, trivia and film gate slides:
// a cell buffer with a 1 px outline (cartoon figures that read on a busy ground), marquee bulbs, a small glint,
// lit popcorn pieces and warm slide colors. Uses only the trimmed core.
import { WHITE, hex, mix, clamp } from "../../core/index.js";

/** Warm retro colors shared by the slides. */
export const WARM = {
  ink: hex("#140a08"), black: hex("#0b0b10"),
  maroon0: hex("#12060a"), maroon1: hex("#1e0a10"), maroon2: hex("#2e1018"), maroon3: hex("#48182a"),
  gold0: hex("#3a2208"), gold1: hex("#6e4410"), gold2: hex("#a86c14"), gold3: hex("#e0a224"), gold4: hex("#fbbf24"),
  gold5: hex("#ffe27a"), gold6: hex("#fff6d0"),
  red0: hex("#5a1018"), red1: hex("#a01c2c"), red2: hex("#d42c3c"), red3: hex("#ff5a5a"),
  cream0: hex("#b89a78"), cream1: hex("#e8d4b4"), cream2: hex("#fff2dc"),
  teal0: hex("#0e2a2c"), teal1: hex("#1a4c4c"), teal2: hex("#2e8078"), teal3: hex("#5cc0b0"),
  orange: hex("#f07818"), steam: hex("#f2eef8"),
};

/** A cell grid with a 1 px outline, for small cartoon figures. Cells hold color numbers; 0 is empty. */
export class Cells {
  constructor(x0, y0, w, h) {
    this.x0 = x0; this.y0 = y0; this.w = w; this.h = h;
    this.c = new Uint32Array(w * h);
  }
  clear() { this.c.fill(0); return this; }
  set(x, y, c) {
    const ix = Math.floor(x) - this.x0, iy = Math.floor(y) - this.y0;
    if (c && ix >= 0 && iy >= 0 && ix < this.w && iy < this.h) this.c[iy * this.w + ix] = c;
  }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }
  /** Rows of characters, pal maps a character to a color; (x, y) is the top left. flip mirrors. */
  rows(rows, pal, x, y, flip = false) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r], W = row.length;
      for (let q = 0; q < W; q++) {
        const ch = row[q];
        if (ch !== "." && ch !== " " && pal[ch]) this.set(x + (flip ? W - 1 - q : q), y + r, pal[ch]);
      }
    }
  }
  outline(c) {
    const { w, h } = this, src = this.c.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (src[i]) continue;
        if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w])) this.c[i] = c;
      }
  }
  draw(p, a = 1) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.c[y * this.w + x];
        if (c) p.dot(this.x0 + x, this.y0 + y, c, a);
      }
  }
}

/** A small four-arm glint with a white core and a soft light. */
export function glint(p, x, y, arm, c, tip, a = 0.5) {
  const n = Math.round(arm), X = Math.floor(x), Y = Math.floor(y);
  if (n < 1) { p.px(X, Y, c); p.glow(X + 0.5, Y + 0.5, 3, c, a * 0.6); return; }
  for (let d = 1; d <= n; d++) {
    const cc = d > n * 0.55 ? tip : c;
    p.px(X + d, Y, cc); p.px(X - d, Y, cc); p.px(X, Y + d, cc); p.px(X, Y - d, cc);
  }
  if (n >= 3) { p.px(X + 1, Y + 1, tip); p.px(X - 1, Y - 1, tip); p.px(X + 1, Y - 1, tip); p.px(X - 1, Y + 1, tip); }
  p.px(X, Y, WHITE);
  p.glow(X + 0.5, Y + 0.5, 3 + n * 2, c, a);
}

/**
 * One marquee bulb at whole pixel (x, y): lit 0..1 (1 white-hot with a warm ring and light, about 0.5 cooling,
 * 0 a dark socket). a fades the whole bulb (house fade).
 */
export function bulb(p, x, y, lit, a = 1, hot = false) {
  x = Math.round(x); y = Math.round(y);
  if (a <= 0) return;
  if (lit > 0.7) {
    p.dot(x, y, WHITE, a);
    const ring = hot ? WARM.gold6 : WARM.gold5;
    p.dot(x - 1, y, ring, a); p.dot(x + 1, y, ring, a); p.dot(x, y - 1, ring, a); p.dot(x, y + 1, ring, a);
    p.glow(x + 0.5, y + 0.5, hot ? 6 : 4.5, WARM.gold4, (hot ? 0.5 : 0.36) * a * lit);
    p.light(x, y, WARM.gold5, 0.5 * a);
  } else if (lit > 0.25) {
    p.dot(x, y, WARM.gold4, a);
    p.dot(x - 1, y, WARM.gold2, a); p.dot(x + 1, y, WARM.gold2, a); p.dot(x, y - 1, WARM.gold2, a); p.dot(x, y + 1, WARM.gold2, a);
    p.glow(x + 0.5, y + 0.5, 3, WARM.gold3, 0.22 * a * lit);
  } else {
    p.dot(x, y, WARM.gold1, a);
    const r = mix(WARM.gold0, WARM.maroon2, 0.3);
    p.dot(x - 1, y, r, a); p.dot(x + 1, y, r, a); p.dot(x, y - 1, r, a); p.dot(x, y + 1, r, a);
  }
}

/** Bulb positions clockwise from the top left corner of the rectangle (x0, y0)..(x1, y1), about gap apart. */
export function bulbRing(x0, y0, x1, y1, gap) {
  const w = x1 - x0, h = y1 - y0, nx = Math.max(2, Math.round(w / gap)), ny = Math.max(2, Math.round(h / gap)), out = [];
  for (let i = 0; i < nx; i++) out.push([Math.round(x0 + (w * i) / nx), y0]);
  for (let i = 0; i < ny; i++) out.push([x1, Math.round(y0 + (h * i) / ny)]);
  for (let i = 0; i < nx; i++) out.push([Math.round(x1 - (w * i) / nx), y1]);
  for (let i = 0; i < ny; i++) out.push([x0, Math.round(y1 - (h * i) / ny)]);
  return out;
}

/** Popcorn colors: puffy white tops, cream middles, butter shadows. */
export const CORN = {
  hi: hex("#ffffff"), top: hex("#fff8e6"), mid: hex("#fbe9c0"), cream: hex("#f0d090"), shadow: hex("#d8a848"),
  rim: hex("#8a5a1c"), butter: hex("#f0b424"), deep: hex("#b07818"),
};

/** A popped piece: lumps [[angle, dist, radius]] around (x, y) at size r, rotated rot, lit from the top left. */
export function piece(p, x, y, r, rot, lumps, butter, a = 1) {
  const L = lumps.map(([an, d, rr]) => [x + Math.cos(an + rot) * d * r, y + Math.sin(an + rot) * d * r, rr * r]);
  const bt = L[butter % L.length];
  const ext = r * 2.1 + 1;
  p.shade(x - ext, y - ext, x + ext, y + ext, (px, py, out) => {
    let f = 9, nx = 0, ny = 0;
    for (const [lx, ly, lr] of L) {
      const dx = px - lx, dy = py - ly, d = Math.hypot(dx, dy) - lr;
      if (d < f) (f = d), (nx = dx), (ny = dy);
    }
    if (f > 0.45) return;
    const n = Math.hypot(nx, ny) || 1, lit = -(nx + ny) / n / 1.414;
    out.a = a;
    if (f > -0.55) return lit > 0.3 ? CORN.top : lit > -0.45 ? CORN.mid : CORN.rim;
    const bd = Math.hypot(px - bt[0], py - bt[1]);
    if (bd < bt[2] * 0.75 && lit < 0.6) return lit > -0.2 ? CORN.butter : CORN.deep;
    if (lit > 0.55 && f < -0.9) return CORN.hi;
    return lit > -0.25 ? CORN.mid : lit > -0.7 ? CORN.cream : CORN.shadow;
  });
}

/** Random lumps for a piece from an Rng. */
export function lumpsOf(R) {
  const n = R.int(3, 5), lumps = [];
  for (let j = 0; j < n; j++) lumps.push([(j / n) * Math.PI * 2 + R.range(-0.4, 0.4), j === 0 ? 0 : R.range(0.55, 0.85), R.range(0.6, 0.85)]);
  return { lumps, butter: R.int(1, n - 1) };
}

/** A stepped fade for whole-scene fades: hard steps instead of a smooth ramp. */
export const steps = (u, n = 4) => clamp(Math.ceil(clamp(u) * n) / n);

const baked = new Map();
/** A grid of w x h values computed once by fn(x, y) (pixel centers, local) and kept for the next frames. */
export function bake(key, x0, y0, w, h, fn, Type = Uint32Array) {
  let g = baked.get(key);
  if (!g) {
    g = new Type(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g[j * w + i] = fn(x0 + i + 0.5, y0 + j + 0.5) || 0;
    baked.set(key, g);
  }
  return g;
}
/** Draw a baked color grid with its top-left at local (x0, y0), unrotated and unmirrored (screen scenes). */
export function blit(p, g, x0, y0, w, h) {
  const sx = Math.floor(p.tx) + x0, sy = Math.floor(p.ty) + y0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = g[j * w + i];
    if (c) p.put(sx + i, sy + j, c, 1);
  }
}
