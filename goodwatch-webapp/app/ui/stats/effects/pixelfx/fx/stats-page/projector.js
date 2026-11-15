// Made for the GoodWatch stats page: A little film projector throws its light onto a page element.
// Anchor (0, 0) is the target's top-center; o.w, o.h = the target's size. The projector's lens sits at (o.dx, o.dy).
// o.sepia = 1 adds film scratches and sepia dust on the target (an old movie).
import { fit, seg, clamp, lerp, rand, ease, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Projector",
  desc: "A small film projector appears, its reels spinning; it clicks on with a lens flare and a soft cone of light reaches the target, which flickers at film rate under drifting dust.",
  tags: ["stats-page", "projector", "film", "cinema", "light", "one-shot"],
  size: [60, 62],
  origin: [38, 28],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#07090e", "#1c2230", "#364052", "#5a6880", "#98a8c0", "#dce6f2"],
    beam: ["#3a2c14", "#a8844a", "#ffe6b0", "#fff8e6", "#ffffff"],
    film: ["#24180c", "#5e4224", "#a8834f", "#e2c896"],
    w: 15,
    h: 24,
    dx: -18,
    dy: -16,
    sepia: 0,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.9 };

const ON = 0.34, OFF = 2.02; // the clicks

/** The projector, lens at (X, Y), facing right: body, lens barrel, two reels on top turned by `spin`. */
function projector(p, P, X, Y, spin, a, lens) {
  // solid when fully there, truly translucent while it fades (no dither on the sprite)
  const put = (x, y, c) => (a >= 1 ? p.px(X + x, Y + y, c) : p.blend(X + x, Y + y, c, a));
  // body: a rounded box, lit along the top, dark along the bottom, a vent of three slots on its side
  for (let y = -2; y <= 3; y++)
    for (let x = -12; x <= -3; x++) {
      const corner = (x === -12 || x === -3) && (y === -2 || y === 3);
      if (corner) continue;
      const edge = x === -12 || x === -3 || y === -2 || y === 3;
      put(x, y, edge ? (y === -2 ? P[3] : P[1]) : y === -1 ? P[3] : P[2]);
    }
  for (const x of [-10, -8, -6]) put(x, 1, P[1]);
  // lens barrel, stepping out to the glass
  for (let y = -1; y <= 1; y++) for (let x = -2; x <= -1; x++) put(x, y, y === -1 ? P[4] : P[2]);
  put(0, -1, P[3]); put(0, 1, P[1]);
  put(0, 0, lens);
  // the feet
  put(-11, 4, P[1]); put(-4, 4, P[1]);
  // the reels, on arms, front one bigger
  const reel = (cx, cy, r, ph) => {
    put(cx + 0.5 > -6 ? cx - 1 : cx + 1, cy + r, P[2]); // the arm down to the body
    for (let y = -Math.ceil(r); y <= Math.ceil(r); y++)
      for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
        const d = Math.hypot(x, y);
        if (d > r + 0.3) continue;
        put(cx + x, cy + y, d > r - 0.7 ? (x + y < 0 ? P[4] : P[2]) : P[3]);
      }
    put(cx, cy, P[5]);
    // three holes go round with the film
    for (let k = 0; k < 3; k++) {
      const g = ph + (k / 3) * TAU;
      put(cx + Math.round(Math.cos(g) * (r - 1.4)), cy + Math.round(Math.sin(g) * (r - 1.4)), P[0]);
    }
  };
  reel(-10, -6, 3, spin);
  reel(-4, -5, 2.4, spin * 1.25 + 1);
}

/** The convex hull of a few points (monotone chain), counter-clockwise; keeps the point objects. */
function convexHull(pts) {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of s) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of s.reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/** Pixels inside the convex polygon `pts` (clockwise or not), with fn(x, y) giving the blend. */
function fillHull(p, pts, fn) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  const n = pts.length;
  for (let y = Math.floor(y0); y <= y1; y++)
    for (let x = Math.floor(x0); x <= x1; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      let pos = 0, neg = 0;
      for (let i = 0; i < n; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
        const cr = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (cr > 0) pos++; else if (cr < 0) neg++;
      }
      if (pos && neg) continue;
      fn(x, y, cx, cy);
    }
}

export function draw(p, t, o) {
  const P = fit(o.palette, 6), B = fit(o.beam, 5), F = fit(o.film, 4), S = o.seed;
  const w = Math.max(4, o.w), h = Math.max(3, o.h), X = Math.round(o.dx), Y = Math.round(o.dy);
  const tx0 = -Math.round(w / 2), tx1 = tx0 + w, ty0 = 0, ty1 = h; // the target's box

  if (o.tease) {
    if (t >= tease.duration) return;
    // the projector shows up, its reels give a quarter turn, the lens blinks once, and it's gone
    const a = seg(t, 0, 0.12) * (1 - seg(t, 0.74, 0.9));
    const spin = ease.inOutSine(seg(t, 0.15, 0.55)) * (TAU / 4);
    const blink = t > 0.5 && t < 0.6;
    projector(p, P, X, Y, spin, a, blink ? WHITE : P[1]);
    if (blink) {
      // a peek of the beam: a short warm stub towards the target
      const ux = -X, uy = h / 2 - Y, ul = Math.hypot(ux, uy) || 1;
      for (let d = 1; d <= 4; d++) p.blend(X + 0.5 + (ux / ul) * d, Y + 0.5 + (uy / ul) * d, B[3], 0.55 - d * 0.1);
      p.glow(X, Y, 5, B[3], 0.7);
    }
    return;
  }
  if (t >= meta.duration) return;

  const a = seg(t, 0, 0.16) * (1 - seg(t, 2.36, 2.56));
  // the reels spin up before the click and wind down after it goes off
  const spin = t < ON ? t * t * 6 : t < OFF ? ON * ON * 6 + (t - ON) * 7 : ON * ON * 6 + (OFF - ON) * 7 + (1 - Math.exp(-(t - OFF) * 4)) * 1.8;
  const on = t >= ON && t < OFF;
  // film-rate flicker: a new brightness every 1/24 s
  const fr = Math.floor(t * 24), flick = 0.78 + rand(S, fr, 7) * 0.22;

  // the beam: reaches out from the lens after the click, pulls back in after it goes off
  const reach = ease.outCubic(seg(t, ON, ON + 0.2)) * (1 - ease.inCubic(seg(t, OFF, OFF + 0.2)));
  if (reach > 0) {
    const L = [X + 0.5, Y + 0.5];
    const to = (x, y) => [lerp(L[0], x, reach), lerp(L[1], y, reach)];
    const hull = convexHull([L, to(tx0, ty0), to(tx1, ty0), to(tx1, ty1), to(tx0, ty1)]);
    const li = hull.indexOf(L), e1 = hull[(li + 1) % hull.length], e2 = hull[(li + hull.length - 1) % hull.length];
    const len = Math.hypot(tx0 + w / 2 - L[0], h / 2 - L[1]);
    // a soft translucent cone, a touch denser near the lens, kept off the target itself
    fillHull(p, hull, (x, y, cx, cy) => {
      if (x >= tx0 && x < tx1 && y >= ty0 && y < ty1) return;
      const d = Math.hypot(cx - L[0], cy - L[1]) / len;
      p.blend(x, y, B[3], (0.2 - d * 0.08) * flick * reach);
    });
    // its two edges, a little brighter (blended, not dithered)
    for (const e of [e1, e2]) {
      const n = Math.ceil(Math.hypot(e[0] - L[0], e[1] - L[1]));
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        p.blend(lerp(L[0], e[0], u), lerp(L[1], e[1], u), B[3], 0.3 * (1 - u * 0.5) * reach * flick);
      }
    }
    p.glowLine(L[0], L[1], lerp(L[0], tx0 + w / 2, reach), lerp(L[1], h / 2, reach), 4, B[2], 0.14 * flick * reach);
  }
  // the light pool on the target, flickering
  if (reach > 0.95) {
    const k = flick * clamp((reach - 0.95) * 20);
    for (let y = ty0; y < ty1; y++)
      for (let x = tx0; x < tx1; x++) {
        // lit from the upper left: its top and left edges catch the beam, the far edges only a little
        const near = (y === ty0 || x === tx0) && !(x === tx0 && y === ty0), far = x === tx1 - 1 || y === ty1 - 1;
        p.blend(x, y, near ? B[4] : B[3], (near ? 0.5 : far ? 0.24 : 0.15) * k);
      }
    p.glow(0, h / 2, Math.max(w, h) * 0.75, B[2], 0.22 * k);
    if (o.sepia) {
      // an old print: a scratch or two running down it, and specks of dust, new every frame
      for (let i = 0; i < 2; i++) {
        if (rand(S, fr, i, 1) < 0.35) continue;
        const sx = tx0 + 1 + Math.floor(rand(S, fr, i, 2) * (w - 2));
        const y0 = Math.floor(rand(S, fr, i, 3) * h * 0.4), y1 = y0 + Math.ceil(h * (0.4 + rand(S, fr, i, 4) * 0.5));
        for (let y = y0; y <= Math.min(ty1 - 1, y1); y++) p.blend(sx, y, i ? F[3] : F[2], y === y0 || y === y1 ? 0.4 : 0.8);
      }
      for (let i = 0; i < 4; i++) {
        if (rand(S, fr, i, 5) < 0.4) continue;
        const sx = tx0 + Math.floor(rand(S, fr, i, 6) * w), sy = Math.floor(rand(S, fr, i, 7) * h);
        p.px(sx, sy, rand(S, fr, i, 8) < 0.5 ? F[0] : F[1]);
      }
      // a sepia wash over it
      for (let y = ty0; y < ty1; y++) for (let x = tx0; x < tx1; x++) p.blend(x, y, F[2], 0.16 * k);
    }
  }
  // dust motes drifting through the beam, lit only inside it
  if (reach > 0.6) {
    for (let i = 0; i < 6; i++) {
      const u = rand(S, i, 1), v = rand(S, i, 2);
      // a point along the beam (u) and across it (v), drifting slowly
      const bx = lerp(X, lerp(tx0, tx1, v), 0.25 + u * 0.6) + Math.sin(t * 1.3 + i) * 1.2;
      const by = lerp(Y, lerp(ty1 * 0.2, ty1 * 0.9, 1 - v), 0.25 + u * 0.6) + Math.sin(t * 0.9 + i * 2.1) * 1.8 - t * 0.8;
      const tw = rand(S, i, Math.floor(t * 8)) < 0.75;
      if (tw) p.dot(bx, by, B[4], 0.85 * reach);
    }
  }

  // the projector, on top of its own beam
  const click = t >= ON && t < ON + 0.067, offc = t >= OFF && t < OFF + 0.067;
  const lift = Math.round(2 * (1 - ease.outBack(seg(t, 0, 0.16)))) - Math.round(2 * seg(t, 2.36, 2.56));
  projector(p, P, X, Y + lift, spin, a, click || offc ? WHITE : on ? B[3] : P[1]);
  if (on) p.glow(X + 1, Y, 4, B[3], 0.5 * flick);
  // the click: a lens flare, the hero frame
  if (click) {
    const big = t < ON + 0.034 ? 1 : 0.6, R = Math.round(4 * big) + 1;
    for (let d = 1; d <= R; d++) {
      const c = d < R ? WHITE : B[3];
      p.px(X + d, Y, c); p.px(X - d, Y, c); p.px(X, Y + d, c); p.px(X, Y - d, c);
      if (d <= R / 2) { p.px(X + d, Y + d, c); p.px(X + d, Y - d, c); }
    }
    p.glow(X, Y, 9, WHITE, 0.8 * big);
  }
  if (offc) p.glow(X, Y, 5, B[3], 0.6);
}
