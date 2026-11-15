// Made for the GoodWatch footer cinema: a tiny perspective toolkit for the big close-up projectors: a camera that
// puts a model's lens at the effect's origin, planes drawn per pixel by casting rays (so vents, slits, blocks and
// reels sit exactly in perspective), flat-shaded prisms and boxes, and stepped light from the screen and a room fill.
// Model space: x right, y up, z forward along the lens axis; the lens's front glass is the model's (0, 0, 0).
import { clamp, hex, mix, scale, red, green, blue, rgb, FONTS } from "../../core/index.js";

/** The projectors' metal: dark grays with a cool edge (the footer projector's METAL, one step longer). */
export const METAL = ["#08080c", "#0e0e14", "#1c1c25", "#2c2c38", "#434354", "#626277", "#8a8aa0", "#b4b4c8"].map(hex);
/** Polished brass and lamp-warm amber. */
export const BRASS = ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4"].map(hex);
/** Aluminium for reels and trims. */
export const ALU = ["#14141c", "#262632", "#3e3e4e", "#5c5c70", "#8484a0", "#b0b0c8", "#dcdcec"].map(hex);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function rot(v, k, a) {
  // Rodrigues: v turned by a about the unit axis k
  const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}
export { dot, cross, norm, sub };

/**
 * A camera. The eye sits at camera (0, 0, 0) looking down +Z (X right, Y down). The model's lens is at camera
 * point L, the model is pitched (lens up), yawed (lens right) and rolled, and F is the focal length in px.
 * lights: [{ d: camera-space direction towards the light, k }]; the screen light comes from `screen`.
 */
export function view({ F, L, pitch = 0, yaw = 0, roll = 0, fill = [-0.4, -1, -0.5], screen = [0, -0.55, 1], clip = null, off = null }) {
  let ax = [1, 0, 0], ay = [0, -1, 0], az = [0, 0, 1];
  const turn = (k, a) => { ax = rot(ax, k, a); ay = rot(ay, k, a); az = rot(az, k, a); };
  turn([1, 0, 0], pitch);
  turn([0, 1, 0], yaw);
  turn([0, 0, 1], roll);
  // off: keep another view's screen offset, for a part placed and turned on its own (a remote on a table)
  const ox = off ? off[0] : (F * L[0]) / L[2], oy = off ? off[1] : (F * L[1]) / L[2];
  const V = {
    F, L, ax, ay, az, ox, oy, fill: norm(fill), screen: norm(screen),
    /** is a local point inside the canvas (clip: [x0, y0, x1, y1], local px)? */
    clip,
    in: clip ? (x, y) => x >= clip[0] && y >= clip[1] && x <= clip[2] && y <= clip[3] : () => true,
    /** camera-space point of a model point */
    cam: (x, y, z) => [L[0] + x * ax[0] + y * ay[0] + z * az[0], L[1] + x * ax[1] + y * ay[1] + z * az[1], L[2] + x * ax[2] + y * ay[2] + z * az[2]],
    /** camera-space direction of a model direction */
    dir: (x, y, z) => [x * ax[0] + y * ay[0] + z * az[0], x * ax[1] + y * ay[1] + z * az[1], x * ax[2] + y * ay[2] + z * az[2]],
  };
  /** the effect-local pixel of a model point, plus its depth */
  V.P = (x, y, z) => { const c = V.cam(x, y, z); return [(F * c[0]) / c[2] - ox, (F * c[1]) / c[2] - oy, c[2]]; };
  /** the camera-space point a camera ray through local pixel (sx, sy) hits on the plane through O with normal N */
  V.hit = (sx, sy, O, N) => {
    const d = [(sx + ox) / F, (sy + oy) / F, 1], den = dot(N, d);
    if (Math.abs(den) < 1e-9) return null;
    const t = dot(N, O) / den;
    return t > 0 ? [d[0] * t, d[1] * t, d[2] * t] : null;
  };
  /** how much the fill and the screen light a model-space normal: { f: 0..1, s: 0..1, n: camera normal } */
  V.lit = (n) => {
    const c = norm(V.dir(n[0], n[1], n[2]));
    return { f: Math.max(0, dot(c, V.fill)), s: Math.max(0, dot(c, V.screen)), n: c };
  };
  /** does a model-space face (point q, outward normal n) face the eye? */
  V.faces = (q, n) => dot(V.dir(n[0], n[1], n[2]), V.cam(q[0], q[1], q[2])) < 0;
  /** a view for a part whose own origin sits at model point q, turned by yaw about the vertical */
  V.part = (q, dyaw = 0, dpitch = 0) => view({ F, L: V.cam(q[0], q[1], q[2]), pitch: pitch + dpitch, yaw: yaw + dyaw, roll, fill, screen, clip, off: [ox, oy] });
  return V;
}

/** A ramp color for light level v (0..1), in hard steps. */
export const tone = (R, v) => R[clamp(Math.floor(v * R.length), 0, R.length - 1)];

/** Add screen light to a color: tint at lum, stepped to quarters so it stays pixel-hard. */
export function screenLit(c, s, lum, tint) {
  const k = Math.floor(clamp(s * lum * 1.15) * 4) / 4;
  if (k <= 0) return c;
  return brighten(c, tint, k);
}
function brighten(c, tint, k) {
  // light adds: base + tint * k * 0.55, clipped
  const r = Math.min(255, red(c) + red(tint) * k * 0.5), g = Math.min(255, green(c) + green(tint) * k * 0.5), b = Math.min(255, blue(c) + blue(tint) * k * 0.5);
  return rgb(r, g, b);
}

/**
 * A rectangle [u0, u1] x [v0, v1] of the plane through model point o spanned by model vectors e1, e2 (orthogonal),
 * drawn per pixel: fn(u, v, out) returns a color (or sets out.*). Culled when its normal (e1 x e2, or -that when
 * `back`) faces away, unless `two`. Returns false when culled.
 */
export function plane(p, V, o, e1, e2, u0, u1, v0, v1, fn, { back = false, two = false } = {}) {
  let n = cross(e1, e2);
  if (back) n = [-n[0], -n[1], -n[2]];
  const q = [o[0] + e1[0] * u0 + e2[0] * v0, o[1] + e1[1] * u0 + e2[1] * v0, o[2] + e1[2] * u0 + e2[2] * v0];
  if (!two && !V.faces(q, n)) return false;
  const O = V.cam(o[0], o[1], o[2]), E1 = V.dir(e1[0], e1[1], e1[2]), E2 = V.dir(e2[0], e2[1], e2[2]), N = cross(E1, E2);
  const l1 = dot(E1, E1), l2 = dot(E2, E2);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) {
    const s = V.P(o[0] + e1[0] * u + e2[0] * v, o[1] + e1[1] * u + e2[1] * v, o[2] + e1[2] * u + e2[2] * v);
    bx0 = Math.min(bx0, s[0]); bx1 = Math.max(bx1, s[0]); by0 = Math.min(by0, s[1]); by1 = Math.max(by1, s[1]);
  }
  if (V.clip) { bx0 = Math.max(bx0, V.clip[0]); by0 = Math.max(by0, V.clip[1]); bx1 = Math.min(bx1, V.clip[2]); by1 = Math.min(by1, V.clip[3]); }
  if (bx0 > bx1 || by0 > by1) return true;
  p.shade(Math.floor(bx0) - 0.5, Math.floor(by0) - 0.5, Math.ceil(bx1) + 0.5, Math.ceil(by1) + 0.5, (x, y, out) => {
    if (!V.in(x, y)) return;
    const H = V.hit(x, y, O, N);
    if (!H) return;
    const r = sub(H, O), u = dot(r, E1) / l1, v = dot(r, E2) / l2;
    if (u < u0 || u > u1 || v < v0 || v > v1) return;
    return fn(u, v, out);
  });
  return true;
}

/** A filled polygon of model points, flat color c (or c(x, y)). */
export function poly3(p, V, pts, c, a = 1) {
  p.poly(pts.map((q) => V.P(q[0], q[1], q[2])), (x, y) => (V.in(x, y) ? (typeof c === "function" ? c(x, y) : c) : 0), a);
}
/** A 1 px line between model points. */
export function line3(p, V, a, b, c, al = 1) {
  const A = V.P(a[0], a[1], a[2]), B = V.P(b[0], b[1], b[2]);
  p.line(A[0], A[1], B[0], B[1], (u) => (V.in(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u) ? c : 0), al);
}
/** One pixel at a model point. */
export function px3(p, V, q, c) { const s = V.P(q[0], q[1], q[2]); if (V.in(s[0], s[1])) p.px(s[0], s[1], c); return s; }

/** The clip box of an effect's canvas in local px, from its meta: pass as view({ ...CAM, clip }). */
export const canvasClip = (meta) => [-meta.origin[0], -meta.origin[1], meta.size[0] - meta.origin[0] - 0.01, meta.size[1] - meta.origin[1] - 0.01];

/**
 * A box from (x0, y0, z0) to (x1, y1, z1), faces culled. color(face, lit) returns a color, or a function
 * (u, v, out) for a per-pixel face (u, v in model units across the face, from its min corner).
 * face is one of "top" "bottom" "left" "right" "front" "back".
 */
export function box(p, V, x0, y0, z0, x1, y1, z1, color) {
  const F = [
    ["top", [x0, y1, z0], [1, 0, 0], [0, 0, 1], x1 - x0, z1 - z0, [0, 1, 0], true],
    ["bottom", [x0, y0, z0], [1, 0, 0], [0, 0, 1], x1 - x0, z1 - z0, [0, -1, 0], false],
    ["left", [x0, y0, z0], [0, 0, 1], [0, 1, 0], z1 - z0, y1 - y0, [-1, 0, 0], true],
    ["right", [x1, y0, z0], [0, 0, 1], [0, 1, 0], z1 - z0, y1 - y0, [1, 0, 0], false],
    ["back", [x0, y0, z0], [1, 0, 0], [0, 1, 0], x1 - x0, y1 - y0, [0, 0, -1], false],
    ["front", [x0, y0, z1], [1, 0, 0], [0, 1, 0], x1 - x0, y1 - y0, [0, 0, 1], true],
  ];
  const drawn = [];
  for (const [name, o, e1, e2, w, h, n, flipN] of F) {
    if (!V.faces([o[0] + (e1[0] * w + e2[0] * h) / 2, o[1] + (e1[1] * w + e2[1] * h) / 2, o[2] + (e1[2] * w + e2[2] * h) / 2], n)) continue;
    const c = color(name, V.lit(n));
    if (!c) continue;
    drawn.push(name);
    const fn = typeof c === "function" ? c : () => c;
    plane(p, V, o, e1, e2, 0, w, 0, h, fn, { two: true, back: flipN });
  }
  return drawn;
}

/**
 * A prism (cylinder) along a model axis: from point c0, unit axis a, length len, radius r0 at the start and r1 at
 * the end, n facets. side(lit, i, nrm) gives a facet's color; cap(lit) the end caps (null skips one).
 * start: the angle of facet 0 about the axis, to keep facets steady.
 */
export function prism(p, V, c0, a, len, r0, r1, n, side, capEnd, capStart, start = 0) {
  a = norm(a);
  const ref = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e = norm(cross(a, ref)), f = cross(a, e);
  const c1 = [c0[0] + a[0] * len, c0[1] + a[1] * len, c0[2] + a[2] * len];
  const ring = (c, r) => Array.from({ length: n }, (_, i) => {
    const th = start + (i / n) * Math.PI * 2, cs = Math.cos(th) * r, sn = Math.sin(th) * r;
    return [c[0] + e[0] * cs + f[0] * sn, c[1] + e[1] * cs + f[1] * sn, c[2] + e[2] * cs + f[2] * sn];
  });
  const A = ring(c0, r0), B = ring(c1, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, th = start + ((i + 0.5) / n) * Math.PI * 2;
    // outward normal, tilted by the taper
    const rad = [e[0] * Math.cos(th) + f[0] * Math.sin(th), e[1] * Math.cos(th) + f[1] * Math.sin(th), e[2] * Math.cos(th) + f[2] * Math.sin(th)];
    const tk = (r0 - r1) / len, nrm = norm([rad[0] + a[0] * tk, rad[1] + a[1] * tk, rad[2] + a[2] * tk]);
    const mid = [(A[i][0] + B[j][0]) / 2, (A[i][1] + B[j][1]) / 2, (A[i][2] + B[j][2]) / 2];
    if (!V.faces(mid, nrm)) continue;
    const c = side(V.lit(nrm), i, nrm);
    if (c) poly3(p, V, [A[i], A[j], B[j], B[i]], c);
  }
  if (capEnd && V.faces(c1, a)) { const c = capEnd(V.lit(a)); if (c) poly3(p, V, B, c); }
  const na = [-a[0], -a[1], -a[2]];
  if (capStart && V.faces(c0, na)) { const c = capStart(V.lit(na)); if (c) poly3(p, V, A, c); }
  return { A, B, e, f, c1 };
}

/** The local-space direction the lens points on screen, in degrees above the horizontal (180 = left). */
export function lensAngle(V) {
  const a = V.P(0, 0, 0), b = V.P(0, 0, 40);
  return (Math.atan2(-(b[1] - a[1]), b[0] - a[0]) * 180) / Math.PI;
}

export { mix, scale };

/** A text string as a mask in font pixels: { w, h, at(x, y) } (true where inked), for painting signs on planes. */
export function textMask(str, font = "mini") {
  const F = FONTS[font], cells = [];
  let x = 0;
  for (const ch of String(str)) {
    const g = F.glyphs[ch] ?? F.glyphs[ch.toUpperCase()];
    if (!g) { x += F.space + F.gap; continue; }
    for (let r = 0; r < F.h; r++) for (let c = 0; c < g.w; c++) if (g.rows[r][c]) cells.push((x + c) + "," + r);
    x += g.w + F.gap;
  }
  const set = new Set(cells), w = Math.max(0, x - F.gap);
  return { w, h: F.h, at: (px, py) => set.has(Math.floor(px) + "," + Math.floor(py)) };
}
