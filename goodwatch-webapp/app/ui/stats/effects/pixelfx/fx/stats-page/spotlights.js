// Made for the GoodWatch stats page: Premiere searchlights over the awards number strip .
import { fit, rand, seg, clamp, lerp, ease, smooth, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Premiere spotlights",
  desc: "Two searchlights at the strip's bottom corners flicker on, sweep soft warm cones across to cross over the middle with pools where they hit, motes glint, then dim.",
  tags: ["stats-page", "cinema", "spotlight", "premiere", "one-shot"],
  size: [440, 100],
  origin: [220, 90],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    // housing: outline, metal shadow, metal, metal lit
    palette: ["#080a10", "#262c3a", "#454e62", "#7a8498"],
    // light: deep amber, amber, warm, cream, white-hot
    beam: ["#6a3a10", "#c47a20", "#f2b850", "#fff0c4", "#ffffff"],
    w: 405,
    h: 69,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.85 };

/** Lamp intensity 0..1 over time: flicker on, burn, step down. delay shifts it for the second lamp. */
function power(t, delay) {
  const u = t - delay;
  if (u < 0.06) return 0;
  if (u < 0.1) return 1; // the strike: a white hero frame
  if (u < 0.15) return 0.15;
  if (u < 0.19) return 0.8;
  if (u < 0.23) return 0.3;
  const on = ease.outCubic(seg(u, 0.23, 0.42));
  return on * (1 - seg(t, 2.05, 2.6));
}

/** Where a lamp aims, as a fraction of the half width (-1 left .. 1 right), for the left lamp; the right mirrors. */
function aimL(t, side) {
  // starts near its own side, swings over past the middle, eases back to cross the other lamp's beam
  const a = side < 0 ? 0 : 0.07;
  const u1 = ease.inOutSine(seg(t, 0.25 + a, 1.25 + a)), u2 = ease.inOutSine(seg(t, 1.25 + a, 2.1 + a));
  const amp = side < 0 ? 0.55 : 0.48;
  return lerp(lerp(-0.6, amp, u1), 0.18, u2);
}

/** Draw one searchlight's housing at (x, y) pointing along (dx, dy), its lens lit by k. */
function lamp(p, x, y, dx, dy, k, H, B, sink = 0) {
  if (sink >= 7) return;
  const p0 = p;
  p = {
    px: (a, b, c) => { if (b + sink < 0) p0.px(a, b + sink, c); },
    rect: (a, b, w, hh, c) => { for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) if (b + j + sink < 0) p0.px(a + i, b + j + sink, c); },
    beam: (x0, y0, x1, y1, r, c) => p0.shade(Math.min(x0, x1) - r, Math.min(y0, y1) - r + sink, Math.max(x0, x1) + r, Math.max(y0, y1) + r + sink, (X, Y) => {
      if (Y >= 0) return;
      const yy = Y - sink, vx = x1 - x0, vy = y1 - y0, u = clamp(((X - x0) * vx + (yy - y0) * vy) / (vx * vx + vy * vy));
      return Math.hypot(X - x0 - vx * u, yy - y0 - vy * u) <= r / 2 ? c : undefined;
    }),
    glow: (a, b, r, c, kk) => p0.glow(a, b + sink, r, c, kk),
  };
  // a little stand
  p.rect(x - 2, y + 1, 5, 1, H[0]);
  p.px(x - 1, y, H[1]);
  p.px(x + 1, y, H[1]);
  p.px(x, y, H[2]);
  // the barrel: outline, metal, a lit top edge, pointing where it shines
  const cx = x + 0.5, cy = y - 2.5;
  const ex = cx + dx * 2.5, ey = cy + dy * 2.5, bx = cx - dx * 1.5, by = cy - dy * 1.5;
  p.beam(bx, by, ex, ey, 4.2, H[0]);
  p.beam(bx, by, ex, ey, 2.4, H[2]);
  p.px(bx - dy * 0.9, by + dx * 0.9 - 0.6, H[3]);
  // the lens: white-hot when burning, stepping down the beam ramp as it dims
  const lc = k > 0.85 ? WHITE : k > 0.6 ? B[3] : k > 0.35 ? B[2] : k > 0.12 ? B[1] : H[1];
  const lx = cx + dx * 2.6, ly = cy + dy * 2.6;
  p.px(lx, ly, lc);
  p.px(lx - dy, ly + dx, k > 0.6 ? B[3] : lc);
  p.px(lx + dy, ly - dx, k > 0.6 ? B[3] : lc);
  if (k > 0.05) {
    p.glow(lx, ly, 5, B[3], 0.5 * k);
    p.glow(lx, ly, 12, B[2], 0.18 * k);
  }
}

/** Cone intensity (0..1) at (x, y) for a beam from (x0, y0) along (dx, dy), length L, spread sp. */
function coneAt(x, y, x0, y0, dx, dy, L, sp, top = -1e9, open = false, half = 1e9) {
  if (y < top || Math.abs(x) > half) return 0;
  const rx = x - x0, ry = y - y0, s = rx * dx + ry * dy;
  if (s < 1 || (!open && s > L)) return 0;
  const d = Math.abs(rx * dy - ry * dx), hw = 1.2 + s * sp, e = d / hw;
  if (e >= 1) return 0;
  const edge = 1 - e * e, core = Math.max(0, 1 - e * 2.2);
  const far = (1 - 0.6 * smooth(L * 0.35, L, s)) * (open ? 1 - smooth(L, L * 1.3, s) : 1 - smooth(L - 8, L, s));
  return (0.55 * edge + 0.45 * core) * far * smooth(0, 8, s);
}

export function draw(p, t, o) {
  const H = fit(o.palette, 4), B = fit(o.beam, 5), S = o.seed;
  const w = Math.max(40, o.w), h = Math.max(20, o.h);
  const top = -h + 3, ly = -3;
  const lamps = [
    { x: -w / 2 + 5, side: -1 },
    { x: w / 2 - 6, side: 1 },
  ];
  const span = w / 2 - 8;

  if (o.tease) {
    if (t >= 0.8) return;
    // one lamp sputters on with a short stub of a cone pointing up, then clicks off
    const k = t < 0.08 ? 0 : t < 0.12 ? 1 : t < 0.2 ? 0.1 : t < 0.26 ? 0.75 : t < 0.55 ? 0.7 : t < 0.62 ? 0.3 : t < 0.68 ? 0.1 : 0;
    const L0 = lamps[0], ang = -1.05, dx = Math.cos(ang), dy = Math.sin(ang);
    const x0 = L0.x + 0.5 + dx * 3, y0 = ly - 2.5 + dy * 3;
    if (k > 0.05) cone(p, x0, y0, dx, dy, Math.min(h * 0.45, 22) * Math.min(1, k + 0.3), 0.16, k, B, 0.5, top, w);
    lamp(p, L0.x, ly, dx, dy, k, H, B, 7 * (1 - ease.outBack(seg(t, 0, 0.08))) + 7 * ease.inQuad(seg(t, 0.68, 0.79)));
    return;
  }
  if (t >= meta.duration) return;

  const beams = lamps.map((L, i) => {
    const k = power(t, i * 0.1);
    const ax = L.side < 0 ? aimL(t, -1) * span : -aimL(t, 1) * span;
    const x0 = L.x + 0.5, y0 = ly - 2.5;
    const dxr = ax - x0, dyr = top - y0, len = Math.hypot(dxr, dyr);
    const dx = dxr / len, dy = dyr / len;
    const grow = ease.outCubic(seg(t, 0.1 + i * 0.1, 0.45 + i * 0.1));
    // the cone is as wide at the top edge as suits the strip: narrower on a phone's small strip
    const sp = clamp(Math.min(w, h * 3) * 0.07, 6, 16) / len;
    return { L, k, dx, dy, x0: x0 + dx * 3, y0: y0 + dy * 3, len: (len - 3) * grow, ax, grow, sp };
  });
  for (const b of beams) if (b.k > 0.02) cone(p, b.x0, b.y0, b.dx, b.dy, b.len, b.sp, b.k, B, b.grow, top, w);

  // motes drifting in the air, only seen where a beam catches them
  for (let i = 0; i < 30; i++) {
    const mx = (rand(S, i, 1) - 0.5) * (w - 20) + Math.sin(t * 0.9 + i) * 3;
    const my = -6 - rand(S, i, 2) * (h - 12) - t * (1.5 + rand(S, i, 3) * 2);
    let lit = 0;
    for (const b of beams) if (b.k > 0.02) lit += coneAt(mx, my, b.x0, b.y0, b.dx, b.dy, b.len, b.sp, top, b.grow >= 1, w / 2 - 1) * b.k;
    const tw = 0.6 + 0.4 * Math.sin(t * 9 + i * 2.1);
    lit *= tw;
    if (lit > 0.5) p.px(mx, my, WHITE);
    else if (lit > 0.22) p.px(mx, my, B[3]);
    else if (lit > 0.1) p.blend(mx, my, B[3], 0.6);
  }

  // the lamps rise out of the strip's bottom edge as they warm, and sink back once dark
  const sink = 7 * (1 - ease.outBack(seg(t, 0, 0.12))) + 7 * ease.inQuad(seg(t, 2.55, 2.72));
  for (const b of beams) lamp(p, b.L.x, ly, b.dx, b.dy, b.k, H, B, sink);
}

/** A soft translucent cone with a pool where it meets the top of the strip. */
function cone(p, x0, y0, dx, dy, L, sp, k, B, grow, top, w) {
  if (L < 2) return;
  const open = grow >= 1 || grow < 0;
  // the cone's two edges, and where each meets the top edge (its footprint there)
  const ea = Math.atan(sp), foot = [-ea, ea].map((r) => {
    const ex = dx * Math.cos(r) - dy * Math.sin(r), ey = dx * Math.sin(r) + dy * Math.cos(r);
    return x0 + ex * ((top - y0) / Math.min(-0.08, ey));
  });
  const Lb = open ? L * 1.6 : L;
  const x1 = x0 + dx * Lb, y1 = y0 + dy * Lb, hw = 1.2 + Lb * sp + 2;
  const minX = Math.min(x0, x1) - hw, maxX = Math.max(x0, x1) + hw;
  const minY = Math.min(y0, y1) - hw, maxY = Math.max(y0, y1) + hw;
  for (let y = Math.floor(minY); y <= maxY; y++)
    for (let x = Math.floor(minX); x <= maxX; x++) {
      const c = coneAt(x + 0.5, y + 0.5, x0, y0, dx, dy, L, sp, top, open, w / 2 - 1) * k;
      if (c <= 0.02) continue;
      p.blend(x, y, c > 0.55 ? B[4] : B[3], c * 0.28);
      p.light(x, y, B[2], c * 0.2);
    }
  // the pool: a soft lit ellipse where the beam lands on the strip's top edge
  if (open) {
    // where the beam meets the top edge: a lit strip along the edge and light washing a little way down from it
    const hx = x0 + dx * ((top - y0) / dy), cap = 3.2 * (1.2 + L * sp);
    const fa = Math.max(Math.min(...foot), hx - cap, -w / 2 + 1), fb = Math.min(Math.max(...foot), hx + cap, w / 2 - 1);
    const pr = (fb - fa) / 2, cx = (fa + fb) / 2;
    for (let i = Math.floor(-pr); i <= pr; i++) {
      const e = Math.abs(i) / pr, f = (1 - e * e) * k;
      p.blend(cx + i, top, e < 0.5 ? B[4] : B[3], 0.55 * f);
      p.blend(cx + i, top + 1, B[3], 0.3 * f);
      p.blend(cx + i, top + 2, B[3], 0.14 * f);
    }
    p.glow(cx, top + 2, pr * 0.8, B[2], 0.2 * k);
  }
}
