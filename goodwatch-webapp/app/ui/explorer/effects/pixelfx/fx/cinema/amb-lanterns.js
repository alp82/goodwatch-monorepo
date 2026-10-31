// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, mix, clamp, rng, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Mosaic lanterns",
  desc: "Over the Türkiye island: a few mosaic lanterns of teal, red and gold glass swing gently on short chains, each with a hot core, twinkling panes and a colored glow pool.",
  tags: ["cinema", "ambient", "island", "country", "turkiye", "lanterns", "mosaic", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  // metal dark, metal, gold, hot core; glass ramps as their own options
  options: {
    palette: ["#2a1608", "#8a5a1c", "#f0c050", "#fff4d0"],
    teal: ["#0c4a4a", "#1ea7a0", "#7ff0e0"],
    red: ["#5a0c18", "#d8283c", "#ff9a90"],
    gold: ["#5a3a08", "#e8a020", "#ffe27a"],
    seed: 1, r: 30, density: 1,
  },
};

const radius = (o) => clamp(o.r ?? 30, 10, 100);

// lantern profile in its own frame (u across, v down from the cap's top): half-width of the glass at v
function lantern(p, M, G, x0, y0, ang, s, t, seed, li) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const bw = 4.6 * s, bh = 11 * s, capH = Math.max(2, 2 * s), top = capH, bot = top + bh;
  const hw = (v) => { // a bulb: narrow neck, round belly, pointed bottom
    if (v < top || v > bot) return -1;
    const q = (v - top) / bh;
    return q < 0.62 ? bw * Math.sin((0.25 + (q / 0.62) * 0.75) * Math.PI / 2) ** 0.7 : bw * (1 - (q - 0.62) / 0.38) ** 0.9;
  };
  const ext = bot + 4 * s;
  // bounding box of the rotated lantern
  p.shade(x0 - ext, y0 - 1, x0 + ext, y0 + ext, (x, y, out) => {
    const dx = x - x0, dy = y - y0, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    // cap: a little domed lid, lit top-left
    if (v >= 0 && v < capH) {
      const w = 1 + (v / capH) * (bw * 0.55);
      if (Math.abs(u) > w + 0.5) return;
      out.c = Math.abs(u) > w - 0.5 ? M[0] : u < 0 ? M[2] : M[1];
      return;
    }
    // finial under the bulb
    if (v >= bot && v < bot + 3 * s) {
      if (Math.abs(u) > 0.6) return;
      out.c = v < bot + 1.5 * s ? M[1] : M[2];
      return;
    }
    const w = hw(v);
    if (w < 0 || Math.abs(u) > w + 0.7) return;
    if (Math.abs(u) > w - 0.3) { out.c = u < 0 ? M[1] : M[0]; return; } // the metal frame round the glass
    // panes: three bands of glass with metal rings between, columns of teal / red / gold in each
    const q = (v - top) / bh, band = q < 0.3 ? 0 : q < 0.66 ? 1 : 2;
    const ring = Math.abs(q - 0.3) * bh < 0.5 || Math.abs(q - 0.66) * bh < 0.5;
    if (ring) { out.c = u < 0 ? M[2] : M[1]; return; }
    const cw = 2.6 * Math.max(0.8, s), col = Math.floor(u / cw + (band === 1 ? 0.5 : 0));
    if (s >= 1.3 && Math.abs(u / cw + (band === 1 ? 0.5 : 0) - Math.round(u / cw + (band === 1 ? 0.5 : 0))) * cw < 0.45) { out.c = M[1]; return; }
    const i1 = band, i2 = col;
    const kind = (((band * 2 + col) % 3) + 3) % 3, ramp = G[kind];
    // the hot core: panes near the middle glow brighter
    const cy = top + bh * 0.48, dd = Math.hypot(u / bw, (v - cy) / (bh * 0.5));
    const tw = Math.sin(t * TAU * (1 + (((i1 * 7 + i2 * 13 + li) % 3 + 3) % 3)) / 6 + i1 * 1.7 + i2 * 2.3 + seed);
    const lit = 1.15 - dd + (tw > 0.85 ? 0.45 : 0) + (u < 0 ? 0.1 : -0.15);
    out.c = dd < 0.14 ? M[3] : dd < 0.3 ? mix(ramp[2], M[3], 0.45) : lit > 0.72 ? ramp[2] : lit > 0.3 ? ramp[1] : ramp[0];
    if (lit > 0.75) { out.k = 0.12; out.l = ramp[1]; }
  });
  const cx = x0 - sa * (top + bh * 0.48), cy = y0 + ca * (top + bh * 0.48);
  return [cx, cy];
}

export function draw(p, t, o) {
  const M = fit(o.palette, 4).map(hex), R = radius(o), s = Math.max(0.75, R / 30), D = meta.duration, ph = t / D, d2 = o.density >= 2;
  const G = [fit(o.teal, 3).map(hex), fit(o.red, 3).map(hex), fit(o.gold, 3).map(hex)];
  const n = d2 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const g = rng(o.seed, i, 7);
    const fx = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const px = fx * (n > 3 ? 0.78 : 0.62) * R, py = -R * (1.0 - 0.12 * Math.abs(fx)) + g.range(-1.5, 1.5) * s;
    const chain = (3 + g.range(0, 4) + (i % 2) * 2) * s;
    const ang = (0.12 + g.next() * 0.08) * Math.sin(ph * TAU * (i % 2 ? 2 : 3) + g.next() * TAU);
    // the chain: alternating light and dark links from the hook down to the cap
    const ex = px - Math.sin(ang) * chain, ey = py + Math.cos(ang) * chain;
    for (let d = 0; d <= chain; d += 1) {
      const q = d / chain;
      p.px(px + (ex - px) * q, py + (ey - py) * q, Math.round(d) % 2 ? M[2] : M[1]);
    }
    p.px(px, py - 1, M[1]); // the hook
    const [cx, cy] = lantern(p, M, G, ex, ey, ang, s * (0.9 + g.next() * 0.2), t, o.seed + i, i);
    const tint = G[i % 3][1];
    // light: a colored pool, a hot core, a faint warm wash where it hangs over the island
    p.glow(cx, cy, 14 * s, tint, 0.28);
    p.glow(cx, cy, 4 * s, M[3], 0.35 + 0.08 * Math.sin(ph * TAU * 3 + i));
    p.glow(cx, cy + 9 * s, 9 * s, tint, 0.08);
  }
}
