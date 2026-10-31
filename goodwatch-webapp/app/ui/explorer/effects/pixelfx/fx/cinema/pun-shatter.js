// Made for the GoodWatch explorer map: title pun.
// Glass breaks over a poster: a white impact flash, a star of cracks races out from the hit with rings of cracks
// between them, then the pane bursts: faceted shards with lit edges tumble outward and fall, glinting, glass dust
// sparkling after them.
import { rng, burst, fly, seg, ease, clamp, TAU, WHITE, hex, fit, sparkle } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: shatter",
  desc: "A white impact flash, a star of cracks spreading from the hit, then glass shards with lit edges burst outward, tumble and fall with glints.",
  tags: ["cinema", "pun", "glass", "shatter", "break", "action", "one-shot"],
  size: [160, 176],
  origin: [80, 72],
  duration: 2.1,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0e1a2a", "#2a4a66", "#5a8aaa", "#9cc8e0", "#d8f0ff", "#ffffff"], seed: 1, w: 40, h: 60 },
};

const BREAK = 0.42;

/** The crack layout: rays from the hit, ring radii, and the jittered point on ray i at ring j. */
function layout(o) {
  const { hw, hh, s } = dims(o), k = clamp(s, 0.6, 3.5);
  const r0 = rng(o.seed, 1), ix = r0.range(-0.2, 0.25) * hw, iy = r0.range(-0.25, 0.05) * hh;
  const N = Math.round(7 + 1.5 * Math.sqrt(k)), reach = Math.min(hw, hh) * 1.05 + 4;
  const ang = [], len = [];
  for (let i = 0; i < N; i++) { const r = rng(o.seed, i, 2); ang.push(((i + r.range(-0.3, 0.3)) / N) * TAU); len.push(reach * r.range(0.8, 1.25)); }
  const rings = [reach * 0.28, reach * 0.58, reach * 0.95];
  const pt = (i, j) => {
    const ii = ((i % N) + N) % N, r = rng(o.seed, ii, 3 + j), rad = j < 0 ? 0 : rings[j] * r.range(0.85, 1.12);
    const a = ang[ii] + (i >= N ? TAU : 0), jit = j < 0 ? 0 : r.range(-1, 1) * 1.2;
    return [ix + Math.cos(a) * rad - Math.sin(a) * jit, iy + Math.sin(a) * rad + Math.cos(a) * jit];
  };
  return { ix, iy, N, ang, len, rings, pt, k, reach };
}

/** Truly translucent polygon fill (p.poly dithers its alpha). */
function glass(p, pts, c, a) {
  if (a <= 0.01) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  p.each(x0, y0, x1, y1, (x, y, sx, sy) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) p.blendPx(sx, sy, c, a);
  });
}

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), L = layout(o), { ix, iy, N, k, reach } = L, sk = Math.sqrt(k);

  // the impact: a white hero flash and a burst of light
  if (t < 0.1) {
    const f = 1 - t / 0.1;
    p.circle(ix, iy, (2 + 3 * sk) * f + 1, WHITE);
    p.glow(ix, iy, reach * 1.1, C[4], 0.9 * f);
    sparkle(p, ix, iy, Math.round((6 + 4 * sk) * f), C[4], C[3], 0.6);
  }
  if (t < BREAK + 0.05) p.glow(ix, iy, reach * 0.9, C[3], 0.25 * (1 - t / (BREAK + 0.05)));

  // the crack star, before it breaks: rays race out jaggedly, then rings join them
  if (t < BREAK) {
    const grow = ease.outExpo(seg(t, 0.0, 0.22));
    for (let i = 0; i < N; i++) {
      const pts = [[ix, iy]];
      for (let j = 0; j < 3; j++) pts.push(L.pt(i, j));
      const a = L.ang[i], r = rng(o.seed, i, 9);
      pts.push([ix + Math.cos(a) * L.len[i] + r.range(-2, 2), iy + Math.sin(a) * L.len[i] + r.range(-2, 2)]);
      // walk the polyline up to the current length
      let left = L.len[i] * grow;
      for (let q = 1; q < pts.length && left > 0; q++) {
        const [x0, y0] = pts[q - 1], [x1, y1] = pts[q], d = Math.hypot(x1 - x0, y1 - y0), u = Math.min(1, left / d);
        const ex = x0 + (x1 - x0) * u, ey = y0 + (y1 - y0) * u;
        const lit = -Math.cos(a) - Math.sin(a) > 0;
        p.line(x0 + 0.6, y0 + 0.6, ex + 0.6, ey + 0.6, C[1], 0.8);
        p.line(x0, y0, ex, ey, q === 1 ? WHITE : lit ? C[5] : C[4]);
        if (u < 1) p.light(ex, ey, C[4], 0.5);
        left -= d;
      }
    }
    // rings of cracks between the rays
    for (let j = 0; j < 2; j++) {
      const g = seg(t, 0.1 + j * 0.07, 0.22 + j * 0.07);
      if (g <= 0) continue;
      for (let i = 0; i < N; i++) {
        if (rng(o.seed, i, 20 + j).next() < 0.2) continue;
        const [x0, y0] = L.pt(i, j), [x1, y1] = L.pt(i + 1, j);
        p.line(x0, y0, x0 + (x1 - x0) * g, y0 + (y1 - y0) * g, C[4]);
      }
    }
    // a strain shimmer just before it gives
    const pre = seg(t, BREAK - 0.08, BREAK);
    if (pre > 0) p.glow(ix, iy, reach * 0.6, C[4], 0.35 * pre);
    return;
  }

  // the burst: every cell between two rays and two rings is a shard that flies, tumbles, falls
  const age = t - BREAK;
  if (age < 0.08) {
    const f = 1 - age / 0.08;
    p.glow(ix, iy, reach * 1.1, C[4], 0.6 * f);
    p.circle(ix, iy, 3 * sk * f + 1, WHITE);
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < 3; j++) {
      const r = rng(o.seed, i, 40 + j);
      const poly = j === 0 ? [[ix, iy], L.pt(i, 0), L.pt(i + 1, 0)] : [L.pt(i, j - 1), L.pt(i, j), L.pt(i + 1, j), L.pt(i + 1, j - 1)];
      let cx = 0, cy = 0;
      for (const [x, y] of poly) { cx += x; cy += y; }
      cx /= poly.length; cy /= poly.length;
      const dx = cx - ix, dy = cy - iy, d = Math.hypot(dx, dy) || 1;
      const delay = (d / reach) * 0.06, a = age - delay;
      if (a < 0) {
        glass(p, poly, C[3], 0.18);
        for (let q = 0; q < poly.length; q++) p.line(poly[q][0], poly[q][1], poly[(q + 1) % poly.length][0], poly[(q + 1) % poly.length][1], C[4]);
        continue;
      }
      const life = r.range(0.9, 1.4);
      if (a > life) continue;
      const sp = (r.range(50, 120) * (1.2 - (j * 0.15))) * sk;
      const [x, y] = fly(cx, cy, (dx / d) * sp + r.range(-15, 15), (dy / d) * sp - r.range(30, 80) * sk, a, 300 * sk, 2.2);
      const spin = r.range(-9, 9) * (j === 0 ? 1.5 : 1) * ease.outCubic(clamp(a * 3)) * a + 0;
      const flip = Math.cos(a * r.range(5, 11) + r.range(0, TAU));
      const cs = Math.cos(spin), sn = Math.sin(spin), shrink = 1 - seg(a, life * 0.6, life) * 0.6;
      const pts = poly.map(([px, py]) => {
        const lx = (px - cx) * shrink, ly = (py - cy) * shrink;
        const rx = (lx * cs - ly * sn) * (0.35 + 0.65 * Math.abs(flip)), ry = lx * sn + ly * cs;
        return [x + rx, y + ry];
      });
      const { hh } = dims(o), fade = (1 - seg(a, life * 0.7, life)) * (1 - seg(y, hh + 2, hh + 10 + 8 * sk));
      if (fade <= 0) continue;
      // body: thin translucent glass, a pale face when it turns to the light
      glass(p, pts, flip > 0.5 ? C[4] : C[3], (0.22 + 0.3 * Math.max(0, flip)) * fade);
      // edges: lit on the upper-left, dark below; a facet line through it
      for (let q = 0; q < pts.length; q++) {
        const [x0, y0] = pts[q], [x1, y1] = pts[(q + 1) % pts.length];
        const nx = y1 - y0, ny = -(x1 - x0), lit = -(nx + ny) > 0;
        p.line(x0, y0, x1, y1, lit ? (flip > 0.7 ? WHITE : C[4]) : C[1], fade);
      }
      if (pts.length > 3) p.line(pts[0][0], pts[0][1], pts[2][0], pts[2][1], C[3], 0.5 * fade);
      // a glint when a face flashes towards us
      if (flip > 0.93 && fade > 0.3) sparkle(p, x, y, Math.round(2 + 1.5 * sk), C[4], C[3], 0.45 * fade);
      p.light(x, y, C[3], 0.1 * fade);
    }
  }

  // glass dust: fine glittering bits thrown out and drifting down
  burst(Math.round(20 + 14 * k), o.seed + 5, (r) => {
    const a = r.range(0, TAU), sp = r.range(30, 140) * sk, life = r.range(0.6, 1.3), q = age - r.range(0, 0.1);
    if (q < 0 || q > life) return;
    const [x, y] = fly(ix, iy, Math.cos(a) * sp, Math.sin(a) * sp - 30 * sk, q, 300 * sk, 2.5);
    if (y > dims(o).hh + 10) return;
    const tw = Math.sin(q * r.range(18, 30) + r.range(0, TAU)) > 0.3;
    p.dot(x, y, tw ? WHITE : C[3], 1 - q / life);
    if (tw) p.light(x, y, C[4], 0.3 * (1 - q / life));
  });
}
