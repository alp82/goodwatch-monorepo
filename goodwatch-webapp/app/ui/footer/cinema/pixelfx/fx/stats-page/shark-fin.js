// Made for the GoodWatch stats page: The shark count gets a fin cruising along the card's bottom edge.
import { fit, rand, seg, clamp, lerp, bump, ease, burst, fly, sparkle, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Shark fin",
  desc: "A slate fin rises out of the waterline, cruises right with a gentle bob cutting a foam wake and ripples, then dips under in a small splash and rings.",
  tags: ["stats-page", "shark", "fin", "water", "one-shot"],
  size: [112, 40],
  origin: [56, 28],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0c1018", "#232c3a", "#3e4a5c", "#64748a", "#aebdd0"],
    water: ["#0a2a4a", "#1f5a8a", "#4a9ad0", "#a8dcf4", "#ffffff"],
    len: 70,
    seed: 2,
    tease: 0,
  },
};

export const tease = { duration: 1.0 };

const UP0 = 0.12, UP1 = 0.5, DIP0 = 2.05, DIP1 = 2.3, FIN_H = 12;

export function draw(p, t, o) {
  const C = fit(o.palette, 5), Wt = fit(o.water, 5), S = o.seed, L = Math.max(20, o.len);
  if (o.tease) return teaser(p, t, C, Wt);
  const x0 = -L / 2, x1 = L / 2;
  // where the fin's base center is: eases in, cruises, coasts a little into the dive
  const xAt = (tt) => lerp(x0, x1, ease.inOutSine(clamp((tt - UP0) / (DIP1 + 0.1 - UP0))));
  const hAt = (tt) => FIN_H * ease.outCubic(seg(tt, UP0, UP1)) * (1 - ease.inQuad(seg(tt, DIP0, DIP1)));
  const fx = xAt(t), h = hAt(t);
  const bob = Math.round(Math.sin(t * 5.5) * 0.7);

  // the waterline: a faint glassy line round the fin while it swims, so the cut reads
  const live = seg(t, UP0, UP0 + 0.3) * (1 - seg(t, DIP1, DIP1 + 0.4));
  if (live > 0)
    for (let x = Math.floor(fx - 18); x <= fx + 10; x++) {
      const d = Math.abs(x - fx + 3) / 16;
      if (d < 1) p.blend(x, 0, Wt[2], 0.45 * live * (1 - d * d));
    }

  // the wake: foam dropped at the fin's tail as it passes, fading through blue, with ripple dashes spreading under it
  const N = 46;
  for (let i = 0; i < N; i++) {
    const te = UP0 + 0.1 + (i / N) * (DIP0 + 0.05 - UP0 - 0.1);
    const age = t - te, life = 0.55 + rand(S, i, 1) * 0.3;
    if (age < 0 || age > life || hAt(te) < 2) continue;
    const k = age / life, ex = xAt(te) - 4 - rand(S, i, 2) * 2;
    const c = k < 0.2 ? WHITE : k < 0.45 ? Wt[3] : k < 0.75 ? Wt[2] : Wt[1];
    p.px(ex, 0, c);
    if (k < 0.35 && rand(S, i, 3) < 0.5) p.px(ex - 1, -1, Wt[3]);
    // ripples: dashes just under the line, drawn out wide as they age
    if (i % 3 === 0) {
      const r = 1 + age * 9;
      p.dot(ex - r, 1, Wt[2], 1 - k);
      p.dot(ex + r * 0.6, 1, Wt[2], 1 - k);
    }
    // a few spray beads hop off the wake
    if (i % 6 === 1 && age < 0.3) {
      const [sx, sy] = fly(ex, -1, -14 - rand(S, i, 4) * 10, -22 - rand(S, i, 5) * 14, age, 300, 0);
      if (sy < 0) p.px(sx, sy, k < 0.3 ? WHITE : Wt[3]);
    }
  }

  // the fin: a swept-back blade, lit along its curved leading edge, dark at the trailing edge, cut by the water
  if (h > 0.5) {
    const top = -Math.round(h) + bob;
    const { bl, br } = blade(p, C, Wt, fx, top, Math.max(1, -top), t);
    p.light(fx, top + 3, C[4], 0.18);
    // the water clinging at the cut
    p.px(br + 1, -1, Wt[4]);
    p.px(br + 1, 0, Wt[3]);
    p.px(br + 2, 0, WHITE);
    p.px(bl - 1, 0, Wt[3]);
  }
  // the bow wave: a little white curl ahead of the fin while it cruises
  if (live > 0.5 && h > 3) {
    const cx = fx + 6;
    p.px(cx, -1, Wt[3]);
    p.px(cx + 1, 0, WHITE);
    p.glow(cx, 0, 6, Wt[3], 0.2);
  }

  // the dive: a white kick of spray, a crown of drops, rings spreading flat along the waterline
  const sp = t - DIP1 + 0.08;
  if (sp > 0) {
    const sx = xAt(DIP1);
    if (sp < 0.06) {
      p.line(sx - 3, -1, sx + 3, -1, WHITE);
      p.glow(sx, -1, 12, Wt[3], 0.5);
    }
    burst(12, S + 5, (r) => {
      const ang = -Math.PI / 2 + r.range(-0.9, 0.9), v = r.range(40, 75), life = r.range(0.3, 0.45);
      const u = sp - r.range(0, 0.05);
      if (u < 0 || u > life) return;
      const [x, y] = fly(sx + r.range(-2, 2), -1, Math.cos(ang) * v, Math.sin(ang) * v, u, 320, 0.5);
      if (y > 0) return;
      p.px(x, y, u / life < 0.4 ? WHITE : Wt[3]);
    });
    for (let k = 0; k < 2; k++) {
      const u = sp - k * 0.12;
      if (u < 0 || u > 0.45) continue;
      const rr = 3 + u * 26, fade = 1 - u / 0.45;
      const c = fade > 0.6 ? Wt[4] : fade > 0.3 ? Wt[3] : Wt[2];
      for (let q = 0; q < 3; q++) {
        p.px(sx - rr + q, 0, c);
        p.px(sx + rr - q, 0, c);
      }
      p.dot(sx - rr * 0.7, 1, Wt[2], fade);
      p.dot(sx + rr * 0.7, 1, Wt[2], fade);
    }
    p.glow(sx, 0, 10, Wt[2], 0.25 * (1 - seg(sp, 0, 0.4)));
  }
}

/** The fin's blade from its tip (row `top`) down to the water, its profile spread over `span` rows. */
function blade(p, C, Wt, fx, top, span, t) {
  const tipX = fx - 3, bl = fx - 5.5, br = fx + 5, base = 0;
  for (let y = top; y < base; y++) {
    const u = (y - top) / span; // 0 at the tip, 1 at the base of the blade (the water when it is all up)
    const xr = tipX + (br - tipX) * Math.sqrt(u);
    const xl = lerp(tipX, bl, u) + 1.6 * Math.sin(Math.PI * u) * (1 - u * 0.4);
    const a = Math.round(Math.min(xl, xr)), b = Math.round(xr);
    for (let x = a; x <= b; x++) {
      const c = x === b ? C[4] : x === b - 1 ? C[3] : x === a || (x === a + 1 && u > 0.5) ? C[1] : C[2];
      p.px(x, y, c);
      // its broken reflection just under the line
      if (y === -1 || (y === -3 && x % 3 !== 0)) p.blend(x, -y, Wt[1], y === -1 ? 0.45 : 0.25);
    }
  }
  // a sheen running down the leading edge
  const sy = top + ((t * 7) % Math.max(1, -top));
  p.px(tipX + (br - tipX) * Math.sqrt((sy - top) / span), sy, WHITE);
  return { tipX, bl, br };
}

/** The teaser: only the fin's tip breaks the surface in the middle, rises a few px with a little foam, dips, one ring. */
function teaser(p, t, C, Wt) {
  if (t >= tease.duration) return;
  const h = 4 * ease.outCubic(seg(t, 0.1, 0.36)) * (1 - ease.inQuad(seg(t, 0.56, 0.7)));
  const live = seg(t, 0.06, 0.2) * (1 - seg(t, 0.62, 0.8));
  // a faint glassy waterline where it cuts
  if (live > 0) for (let x = -7; x <= 5; x++) p.blend(x, 0, Wt[2], 0.4 * live * (1 - Math.abs(x + 1) / 7));
  if (h > 0.5) {
    const top = -Math.round(h), span = FIN_H;
    blade(p, C, Wt, 0, top, span, t);
    p.light(0, top + 2, C[4], 0.14);
    // foam clinging either side of the cut, brighter on the leading edge
    const uc = -top / span, xr = Math.round(-3 + 8 * Math.sqrt(uc)), xl = Math.round(lerp(-3, -5.5, uc) + 1.6 * Math.sin(Math.PI * uc) * (1 - uc * 0.4));
    p.px(xr + 1, 0, WHITE);
    p.px(xr + 1, -1, Wt[3]);
    p.px(xl - 1, 0, Wt[3]);
  }
  // two beads kicked up as the tip breaks through
  for (let i = 0; i < 2; i++) {
    const age = t - 0.12 - i * 0.04;
    if (age < 0 || age > 0.3) continue;
    const [x, y] = fly(i ? 2 : -3, -1, i ? 14 : -10, -26 - i * 6, age, 300, 0);
    if (y < 0) p.px(x, y, age < 0.12 ? WHITE : Wt[3]);
  }
  // one small ring as it dips back under
  const u = t - 0.68;
  if (u > 0 && u < 0.3) {
    const rr = 2 + u * 22, fade = 1 - u / 0.3;
    const c = fade > 0.6 ? Wt[4] : fade > 0.3 ? Wt[3] : Wt[2];
    for (let q = 0; q < 2; q++) {
      p.px(-1 - rr + q, 0, c);
      p.px(-1 + rr - q, 0, c);
    }
    p.dot(-1 - rr * 0.7, 1, Wt[2], fade);
    p.dot(-1 + rr * 0.7, 1, Wt[2], fade);
    if (u < 0.05) p.px(-1, -1, WHITE);
    p.glow(-1, 0, 6, Wt[2], 0.2 * fade);
  }
}
