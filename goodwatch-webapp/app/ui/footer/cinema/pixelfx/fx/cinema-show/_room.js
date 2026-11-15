// Made for the GoodWatch footer cinema: shared bits for the room pieces around the cinema screen: stepped light
// from the screen and the house lights, fast fills clipped to the viewport, the audience rows seen from behind.
// Everything is a pure function of (t, o). Lighting is stepped (hard ramp steps), never a smooth gradient.
import { clamp, mix, hex, rand, TAU, WHITE } from "../../core/index.js";

/** Quantize v (0..1) to n hard steps. */
export const q = (v, n) => Math.round(clamp(v) * n) / n;

/** The viewport box, defaulting to the brief's canvas. */
export const vp = (o) => ({ l: o.vl ?? -180, t: o.vt ?? -100, r: o.vr ?? 180, b: o.vb ?? 160 });

/**
 * Light the screen throws on the room: color c (the picture's average color, lifted toward white), k (0.15..1,
 * stepped with the picture's brightness).
 */
export function shine(o) {
  const lum = q(o.lum ?? 0.6, 4), tint = o.tint ?? hex("#c8c0b0");
  return { c: mix(tint, WHITE, 0.3), lum, k: 0.15 + 0.85 * lum, tint };
}

/** How much the house lights are up, stepped (1 = full house lights, 0 = dark). */
export const house = (o) => q(1 - (o.dim ?? 1), 4);

/** base lit by the screen by amount a (0..1, before the screen's own strength), in hard steps. */
export const lit = (base, S, a, n = 5) => mix(base, S.c, q(a * S.k, n));

/**
 * The painter, clipped to the viewport: pixels, blends and light outside o.vl..o.vr, o.vt..o.vb are dropped.
 * (Unrotated placements only; a rotated painter is returned as is.)
 */
export function clipped(p, o) {
  if (p.sn !== 0) return p;
  const V = vp(o), a = p.tx + V.l * p.fx, b = p.tx + V.r * p.fx;
  const x0 = Math.round(Math.min(a, b)), x1 = Math.round(Math.max(a, b)), y0 = Math.round(p.ty + V.t), y1 = Math.round(p.ty + V.b);
  const q = Object.create(p), ok = (sx, sy) => sx >= x0 && sx < x1 && sy >= y0 && sy < y1;
  q.put = (sx, sy, c, al) => ok(sx, sy) && p.put(sx, sy, c, al);
  q.add = (sx, sy, c, k) => ok(sx, sy) && p.add(sx, sy, c, k);
  q.blendPx = (sx, sy, c, al) => ok(sx, sy) && p.blendPx(sx, sy, c, al);
  return q;
}

const direct = (p) => p.sn === 0 && p.fx === 1 && p.fade >= 1;

/** A solid rectangle [x0, x1) x [y0, y1), clipped to the viewport, written straight into the frame. */
export function fill(p, o, x0, y0, x1, y1, c) {
  const V = vp(o);
  x0 = Math.max(Math.floor(x0), V.l); x1 = Math.min(Math.ceil(x1), V.r);
  y0 = Math.max(Math.floor(y0), V.t); y1 = Math.min(Math.ceil(y1), V.b);
  if (x1 <= x0 || y1 <= y0) return;
  if (!direct(p)) return p.rect(x0, y0, x1 - x0, y1 - y0, c);
  const W = p.w, H = p.h, C = p.C;
  const sx0 = Math.max(0, Math.floor(p.tx) + x0 - p.ox), sx1 = Math.min(W, Math.floor(p.tx) + x1 - p.ox);
  const sy0 = Math.max(0, Math.floor(p.ty) + y0 - p.oy), sy1 = Math.min(H, Math.floor(p.ty) + y1 - p.oy);
  for (let y = sy0; y < sy1; y++) C.fill(c, y * W + sx0, y * W + sx1);
}

/**
 * A fast shader over the integer pixels [x0, x1) x [y0, y1) (clipped to the viewport): fn(x, y) returns a color,
 * or 0 to leave the pixel alone. x, y are the pixel's integer local coordinates.
 */
export function rows(p, o, x0, y0, x1, y1, fn) {
  const V = vp(o);
  x0 = Math.max(Math.floor(x0), V.l); x1 = Math.min(Math.ceil(x1), V.r);
  y0 = Math.max(Math.floor(y0), V.t); y1 = Math.min(Math.ceil(y1), V.b);
  if (x1 <= x0 || y1 <= y0) return;
  if (!direct(p)) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = fn(x, y); if (c) p.px(x, y, c); }
    return;
  }
  const W = p.w, H = p.h, C = p.C, bx = Math.floor(p.tx) - p.ox, by = Math.floor(p.ty) - p.oy;
  for (let y = y0; y < y1; y++) {
    const sy = by + y;
    if (sy < 0 || sy >= H) continue;
    const row = sy * W;
    for (let x = x0; x < x1; x++) {
      const sx = bx + x;
      if (sx < 0 || sx >= W) continue;
      const c = fn(x, y);
      if (c) C[row + sx] = c;
    }
  }
}

/** A color from a hex string, parsed once. */
const CACHE = new Map();
export const col = (h) => { let c = CACHE.get(h); if (c === undefined) CACHE.set(h, (c = hex(h))); return c; };

// add light c * k to the frame pixel at local integer (x, y), already known to be inside the viewport
function addAt(p, x, y, r, g, b) {
  const sx = Math.floor(p.tx) + x - p.ox, sy = Math.floor(p.ty) + y - p.oy;
  if (sx < 0 || sy < 0 || sx >= p.w || sy >= p.h) return;
  const i = sy * p.w + sx, d = p.L[i];
  const nr = Math.min(255, (d & 255) + r) | 0, ng = Math.min(255, ((d >>> 8) & 255) + g) | 0, nb = Math.min(255, ((d >>> 16) & 255) + b) | 0;
  p.L[i] = (255 << 24) | (nb << 16) | (ng << 8) | nr;
}

/** Light k of color c along the row y from x0 to x1 (exclusive), clipped to the viewport. */
export function lightRow(p, o, x0, x1, y, c, k) {
  const V = vp(o);
  y = Math.floor(y);
  if (y < V.t || y >= V.b) return;
  x0 = Math.max(V.l, Math.floor(x0)); x1 = Math.min(V.r, Math.ceil(x1));
  k *= p.fade * p.lightK;
  if (x1 <= x0 || k <= 0.004) return;
  if (!direct(p)) { for (let x = x0; x < x1; x++) p.light(x, y, c, k / (p.fade * p.lightK)); return; }
  const r = (c & 255) * k, g = ((c >>> 8) & 255) * k, b = ((c >>> 16) & 255) * k;
  for (let x = x0; x < x1; x++) addAt(p, x, y, r, g, b);
}

/** A stepped pool of light: an ellipse in bands, k[i] for band i from the center out (zero bands are skipped). */
export function pool(p, o, x, y, rx, ry, c, ks) {
  const V = vp(o), n = ks.length;
  let z = 0;
  while (z < n && !(ks[z] > 0.004)) z++;
  if (z === n) return;
  const f = p.fade * p.lightK, R = c & 255, G = (c >>> 8) & 255, B = (c >>> 16) & 255;
  const cr = ks.map((k) => R * k * f), cg = ks.map((k) => G * k * f), cb = ks.map((k) => B * k * f);
  const r0 = z / n, fast = direct(p);
  const y0 = Math.max(V.t, Math.floor(y - ry)), y1 = Math.min(V.b, Math.ceil(y + ry));
  for (let yy = y0; yy < y1; yy++) {
    const dy = (yy + 0.5 - y) / ry, dy2 = dy * dy;
    if (dy2 >= 1) continue;
    const span = Math.sqrt(1 - dy2) * rx, inner = dy2 < r0 * r0 ? Math.sqrt(r0 * r0 - dy2) * rx : -1;
    const xa = Math.max(V.l, Math.floor(x - span)), xb = Math.min(V.r, Math.ceil(x + span));
    for (let xx = xa; xx < xb; xx++) {
      const ddx = xx + 0.5 - x;
      if (inner > 1 && ddx < 0 && -ddx < inner - 1) { xx = Math.max(xx, Math.floor(x + inner - 2)); continue; }
      const dx = ddx / rx, d = dx * dx + dy2;
      if (d >= 1) continue;
      const i = Math.min(n - 1, Math.floor(Math.sqrt(d) * n));
      if (!(ks[i] > 0.004)) continue;
      if (fast) addAt(p, xx, yy, cr[i], cg[i], cb[i]);
      else p.light(xx, yy, c, ks[i]);
    }
  }
}

/** Light along a 1 px line in steps: a cheap hard-edged beam of light on a wall. */
export function lightLine(p, x0, y0, x1, y1, c, k) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) p.light(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, k);
}

/**
 * Audience rows from the front (o.vb) back toward the screen, far first: [{ y, s, i }] where y is the top of the
 * row's seat backs and s its scale (perspective toward the eye line yh, capped).
 */
export function rowLayout(o, top, { base = 13, yh = 20, ref = 120, smin = 0.42, smax = 1.7, lead = 8 } = {}) {
  const V = vp(o), sAt = (y) => clamp((y - yh) / (ref - yh), smin, smax), out = [];
  let y = V.b - lead * sAt(V.b), i = 0;
  while (y > top && i < 40) {
    const s = sAt(y);
    out.push({ y: Math.round(y), s, i: i++ });
    y -= base * s;
  }
  return out.reverse();
}

// head shapes in head-local units (1 = one px at scale 1), centered on the skull
const HEADS = [
  (x, y) => x * x / 10.2 + y * y / 14 < 1, // short hair
  (x, y) => x * x / 10.2 + y * y / 14 < 1 || (x * x + (y + 4.6) * (y + 4.6)) < 3.2, // bun
  (x, y) => x * x / 10.2 + y * y / 14 < 1 || (x > 1 && x < 4.6 && y > -1 && y < 5 && (x - 3) * (x - 3) / 2.6 + (y - 2) * (y - 2) / 9 < 1), // ponytail
  (x, y) => x * x / 21 + (y + 0.6) * (y + 0.6) / 20 < 1, // big hair
  (x, y) => x * x / 10.2 + y * y / 14 < 1 || (y > -1.6 && y < -0.4 && x > -6 && x < 6) || (y < -0.4 && y > -6 && x * x / 9 + (y + 2.6) * (y + 2.6) / 9 < 1), // brimmed hat
];

/**
 * A person seen from behind: head (kind 0..4) and shoulders down to the seat line yb, at (x, y = skull center).
 * Silhouette color c; the rim facing the screen (up, and in toward x = 0) in rim colors top / side.
 * lean tilts the head toward a neighbour (px at the crown).
 */
export function person(p, o, x, y, s, kind, c, top, side, yb, lean = 0) {
  // rasterized once per shape (memoized: a pure function of kind, scale, lean, facing and seat line)
  x = Math.round(x); y = Math.round(y);
  const toward = x > 2 ? -1 : x < -2 ? 1 : 0, yo = Math.round(yb - y);
  const key = `${kind}|${s.toFixed(3)}|${lean}|${toward}|${yo}`;
  let M = PEOPLE.get(key);
  if (!M) {
    if (PEOPLE.size > 400) PEOPLE.clear();
    M = personMask(kind, s, lean, toward, yo);
    PEOPLE.set(key, M);
  }
  const PALP = [0, c, top, side], X0 = x - M.ox, Y0 = y - M.oy;
  rows(p, o, X0, Y0, X0 + M.w, Y0 + M.h, (px, py) => PALP[M.codes[(py - Y0) * M.w + (px - X0)]]);
}

const PEOPLE = new Map();
function personMask(kind, s, lean, toward, yb) {
  const H = HEADS[kind % HEADS.length], shW = 6.4 * s, neckY = 3.4 * s;
  const inside = (px, py) => {
    // shoulders: a rounded trapezoid from the neck down
    if (py >= neckY + s) {
      const u = (py - neckY - s) / (3 * s), w = shW * Math.min(1, 0.55 + u * 0.6);
      if (Math.abs(px) < w && py <= yb) return true;
    }
    if (py >= 2 * s && py < neckY + 2 * s && Math.abs(px - lean * 0.3) < 1.6 * s) return true;
    const ly = py / s, lx = (px - lean * clamp(-ly / 4, -0.5, 1)) / s;
    return H(lx, ly);
  };
  const ox = Math.ceil(7 * s + Math.abs(lean)), oy = Math.ceil(7 * s), w = ox * 2, h = oy + yb + 1;
  const codes = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const cx = i - ox + 0.5, cy = j - oy + 0.5;
    let c = 0;
    if (inside(cx, cy)) c = cy < neckY && !inside(cx, cy - 1) ? 2 : toward && cy < 0 && !inside(cx + toward, cy) ? 3 : 1;
    codes[j * w + i] = c;
  }
  return { codes, w, h, ox, oy };
}

/** A seat back seen from behind: a rounded-top block, rim lit along its top. */
export function seatBack(p, o, x, y, w, h, c, rim, r = 2) {
  rows(p, o, x, y, x + w, y + h, (px, py) => {
    const dx = Math.min(px - x, x + w - 1 - px), dy = py - y;
    if (dx < r && dy < r && (r - dx - 0.5) ** 2 + (r - dy - 0.5) ** 2 > r * r) return 0;
    if (dy === 0 || (dx < r && dy < r && (r - dx + 0.5) ** 2 + (r - dy + 0.5) ** 2 > r * r)) return rim;
    return c;
  });
}

/** Deterministic pick for seat (row, col) with seed: 0..1. */
export const pick = (seed, i, j, k = 0) => rand(seed, i * 131 + 7, j * 17 + 3, k);

const HEAD = col("#030102");

/**
 * The audience from behind: rows of seat backs (seat0 dark .. seat1 lit upholstery) from o.vb back to y = top,
 * heads in about `density` of the seats. Rows near the screen catch its light; the house toward us falls dark, so
 * heads read as black shapes against the seat backs of the row behind. light (0..1) scales the screen's reach.
 * aisle: { x, w } in front-row px, converging with the rows; seats skip it and amber step lights mark it.
 */
export function crowd(p, t, o, S, H, { top, light = 1, seat0, seat1, density = 0.5, base = 15, pitch: P = 15, seatH = 11, yh = 10, ref = 120, smin = 0.62, smax = 1.8, aisle = null, steps = null, period = 6 }) {
  const R = rowLayout(o, top, { base, yh, ref, smin, smax, lead: 6 });
  const V = vp(o), seed = o.seed ?? 1;
  for (const row of R) {
    const s = row.s, pitch = Math.round(P * s), w = pitch - 1, h = Math.round(seatH * s), y = row.y;
    const reach = clamp(1.15 - (y - top) / 90, 0.1, 1) * light;
    const seat = mix(seat0, seat1, q(0.12 + 0.5 * reach * S.k + 0.35 * H, 4));
    const rimSeat = lit(seat, S, 0.45 * reach, 3), rimTop = lit(HEAD, S, 0.85 * reach), rimSide = lit(HEAD, S, 0.4 * reach);
    const off = row.i % 2 ? pitch / 2 : 0;
    const ax = aisle ? aisle.x * s : 0, aw = aisle ? (aisle.w * s) / 2 : 0;
    const n0 = Math.floor((V.l - off) / pitch) - 1, n1 = Math.ceil((V.r - off) / pitch) + 1;
    for (let n = n0; n <= n1; n++) {
      const x = Math.round(off + n * pitch);
      if (aisle && x + w > ax - aw && x < ax + aw) continue;
      const r = pick(seed, row.i, n);
      if (r < density) {
        const kind = Math.floor(pick(seed, row.i, n, 1) * 5);
        // someone shifts in their seat now and then
        const lean = pick(seed, row.i, n, 2) < 0.2 ? Math.round(Math.sin(TAU * (t / period + r)) * 1.5 * s) : 0;
        person(p, o, x + w / 2, y - 7 * s, s * 1.05, kind, HEAD, rimTop, rimSide, y + 2, lean);
      }
      seatBack(p, o, x, y, w, h + 8, seat, rimSeat, Math.max(1, Math.round(2 * s)));
    }
    if (aisle) {
      // the aisle floor between the seat blocks, a step edge and its little amber light
      fill(p, o, ax - aw, y, ax + aw, y + h + 8, mix(seat0, HEAD, 0.5));
      fill(p, o, ax - aw, y + h - 1, ax + aw, y + h, lit(seat0, S, 0.2 * reach, 3));
      if (steps) for (const sx of [ax - aw + 1, ax + aw - 2]) {
        p.px(sx, y + h - 2, steps[1]);
        if (s > 1.2) p.px(sx + 1, y + h - 2, steps[0]);
        p.light(sx, y + h - 1, steps[0], 0.25);
        p.light(sx, y + h - 3, steps[0], 0.12);
      }
    }
  }
}
