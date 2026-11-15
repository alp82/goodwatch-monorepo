// Made for the GoodWatch footer cinema: the projector's beam, from the lens (the origin) to the screen rectangle. A
// volumetric cone of light: brightest and tightest at the lens, spreading and thinning toward the screen, with rays
// that shift with the picture (stepped at 24 fps), slow haze drifting through it, dust motes that light up only
// where they cross the light, crisp rims along its two outer edges and a little spill around the screen's edge.
// Live options: on (0..1), lum (how bright the picture is), tint (its average color), haze (0..1 smoke).
import { clamp, fit, mix, rand, cycle, scale, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Cinema beam",
  desc: "A projector beam from the lens to a screen: a dusty volumetric cone with flickering rays, drifting haze, motes caught in the light, lit rims and spill.",
  tags: ["cinema", "light", "beam", "loop"],
  size: [320, 200],
  origin: [296, 190],
  duration: 4,
  loop: true,
  fps: 24,
  bg: "dark",
  options: {
    palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    seed: 2, on: 1, lum: 0.6, tint: 0xffe8c0, haze: 0.5, dust: 1,
    sx0: -276, sy0: -176, sx1: -54, sy1: -56,
  },
};

const D = meta.duration;
const BINS = 48;
const rays = new Float32Array(BINS);

// the cone is the convex hull of the lens and the screen's corners; its two outer edges are the lens-to-corner rays
// with the widest angle between them
function hull(o) {
  const cs = [[o.sx0, o.sy0], [o.sx1, o.sy0], [o.sx0, o.sy1], [o.sx1, o.sy1]];
  const cx = (o.sx0 + o.sx1) / 2, cy = (o.sy0 + o.sy1) / 2, ca = Math.atan2(cy, cx);
  let lo = 0, hi = 0, a0 = cs[0], a1 = cs[0];
  for (const c of cs) {
    let d = Math.atan2(c[1], c[0]) - ca;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (d < lo) { lo = d; a0 = c; }
    if (d > hi) { hi = d; a1 = c; }
  }
  return { ca, lo, hi, a0, a1, cx, cy };
}

export function draw(p, t, o) {
  const on = clamp(o.on ?? 1);
  if (on <= 0.005) return;
  const C = fit(o.palette, 8);
  const lum = clamp(o.lum ?? 0.6), haze = clamp(o.haze ?? 0.5);
  const warm = mix(C[6], o.tint ?? C[6], 0.55);
  const step = Math.floor(t * 24) % Math.round(D * 24), seed = o.seed ?? 2;
  // the lamp's flicker: a steady hum with an occasional dip, stepped at 24 fps
  const fl = 0.9 + 0.1 * rand(seed, step) - (rand(seed, step, 5) < 0.06 ? 0.18 : 0);
  const K = on * fl * (0.55 + 0.6 * lum);
  const H = hull(o), span = H.hi - H.lo;
  // rays: the picture's light is uneven across the beam; a few broad bands that change every frame and a slow drift
  for (let i = 0; i < BINS; i++) {
    const u = i / (BINS - 1);
    const slow = 0.5 + 0.5 * Math.sin(u * 7.1 + (t / D) * TAU) * Math.sin(u * 3.3 - (t / D) * TAU * 2);
    rays[i] = 0.72 + 0.2 * slow + 0.16 * (rand(seed, step, i >> 2) - 0.5);
  }
  const x0 = Math.min(0, o.sx0) - 1, x1 = Math.max(0, o.sx1) + 1, y0 = Math.min(0, o.sy0) - 1, y1 = Math.max(0, o.sy1) + 1;
  const len = Math.hypot(H.cx, H.cy);
  // the rims: the outer edges as unit normals, so a pixel's distance to each edge is one dot product
  const n0 = norm(H.a0), n1 = norm(H.a1);
  const ph = (t / D) * TAU;
  p.shade(x0, y0, x1, y1, (x, y, out) => {
    // the screen itself is the picture: no beam light over it
    if (x >= o.sx0 && x <= o.sx1 && y >= o.sy0 && y <= o.sy1) return;
    const r2 = x * x + y * y;
    if (r2 < 2) return;
    let d = Math.atan2(y, x) - H.ca;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (d < H.lo || d > H.hi) return;
    // past the screen plane (behind it, seen from the lens) the light stops: the ray must reach the screen beyond
    const s = rayToRect(x, y, o);
    if (s < 1) return;
    const u = (d - H.lo) / span; // 0..1 across the cone
    const along = Math.sqrt(r2) / len; // 0 at the lens, about 1 at the screen
    // across: brighter in the middle, soft toward the rims; along: dense at the lens, thinning as it spreads
    const across = 1 - Math.pow(Math.abs(u * 2 - 1), 2.2) * 0.55;
    const thin = 0.34 / (0.34 + along * 1.25);
    // haze: slow smoke rolling through the light (two cheap drifting fields)
    const hz = 1 - haze * 0.42 * (0.5 + 0.5 * Math.sin(x * 0.045 + y * 0.03 + ph) * Math.sin(y * 0.06 - x * 0.02 - ph * 2));
    let k = K * across * thin * hz * rays[Math.min(BINS - 1, (u * BINS) | 0)] * 0.85;
    // lit rims along the two outer edges (1 px)
    const e0 = Math.abs(x * n0[0] + y * n0[1]), e1 = Math.abs(x * n1[0] + y * n1[1]);
    if (e0 < 0.75 || e1 < 0.75) k += K * 0.09 * (0.4 + 0.6 * (1 - along));
    // hard ramp steps: quantize the light so the cone reads as pixel-art bands, not mush
    k = Math.round(k * 28) / 28;
    if (k <= 0) return;
    out.l = along < 0.12 ? C[7] : warm;
    out.k = k;
  });
  // spill: light that misses the screen by a pixel or two catches the wall right around it
  const sw = o.sx1 - o.sx0, sh = o.sy1 - o.sy0;
  for (let i = 1; i <= 3; i++) {
    const k = K * 0.07 / i;
    p.glowLine(o.sx0 - i, o.sy0 - i, o.sx1 + i, o.sy0 - i, 0.8, warm, k);
    p.glowLine(o.sx0 - i, o.sy1 + i, o.sx1 + i, o.sy1 + i, 0.8, warm, k);
    p.glowLine(o.sx0 - i, o.sy0 - i, o.sx0 - i, o.sy1 + i, 0.8, warm, k);
    p.glowLine(o.sx1 + i, o.sy0 - i, o.sx1 + i, o.sy1 + i, 0.8, warm, k);
  }
  // dust motes: they drift slowly in the air and show only inside the light, brightest near the lens
  if ((o.dust ?? 1) > 0) {
    const n = Math.round(clamp(Math.hypot(sw, sh) / 6, 14, 60) * (o.dust ?? 1));
    cycle(t, D, n, seed + 7, (g) => g.range(2.2, 4), (age, life, r) => {
      const v = r.range(0.08, 0.95), w = r.range(-0.95, 0.95);
      const ang = H.ca + (H.lo + (w * 0.5 + 0.5) * span) * 0.92;
      const dist = len * v;
      const x = Math.cos(ang) * dist + age * r.range(-2.4, 2.4) + Math.sin(age * r.range(1, 2.5)) * 1.2;
      const y = Math.sin(ang) * dist - age * r.range(0.6, 2.6);
      // only inside the light: not on the picture, not past the screen, not outside the cone
      if (x >= o.sx0 - 1 && x <= o.sx1 + 1 && y >= o.sy0 - 1 && y <= o.sy1 + 1) return;
      if (rayToRect(x, y, o) < 1) return;
      const fade = Math.sin(Math.PI * (age / life));
      const near = 1 - v * 0.55;
      const a = clamp(fade * on * near * 1.25);
      if (a < 0.05) return;
      const big = r.chance(0.12) && v < 0.5;
      p.dot(x, y, r.chance(0.35) ? WHITE : C[6], a);
      if (big) p.dot(x + 1, y, C[5], a * 0.7);
      p.light(x, y, warm, 0.35 * a);
    });
  }
  // the lens: a hot point and a tight glow where the light leaves
  p.glow(0, 0, 7, C[6], 0.55 * on * fl);
  p.glow(0, 0, 3, WHITE, 0.6 * on * fl);
  p.px(0, 0, WHITE);
  p.light(0, 0, scale(warm, 1), 0.4 * on);
}

function norm([x, y]) {
  const l = Math.hypot(x, y) || 1;
  return [-y / l, x / l];
}

// how far along the ray from the lens through (x, y), as a multiple of (x, y), it enters the screen rectangle;
// < 1 means the pixel is beyond the screen plane (or the ray misses), so it gets no light
function rayToRect(x, y, o) {
  let s0 = -Infinity, s1 = Infinity;
  if (Math.abs(x) < 1e-6) { if (0 < o.sx0 || 0 > o.sx1) return -1; }
  else { const a = o.sx0 / x, b = o.sx1 / x; s0 = Math.max(s0, Math.min(a, b)); s1 = Math.min(s1, Math.max(a, b)); }
  if (Math.abs(y) < 1e-6) { if (0 < o.sy0 || 0 > o.sy1) return -1; }
  else { const a = o.sy0 / y, b = o.sy1 / y; s0 = Math.max(s0, Math.min(a, b)); s1 = Math.min(s1, Math.max(a, b)); }
  return s0 > s1 ? -1 : s0;
}
