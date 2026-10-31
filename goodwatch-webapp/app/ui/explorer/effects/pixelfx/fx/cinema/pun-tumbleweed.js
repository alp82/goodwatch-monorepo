// Made for the GoodWatch explorer map: title pun.
// A tumbleweed bounces along a poster's bottom edge from left to right: a tangled ball of thin twigs rolling as it
// goes, a dust puff on every landing, heat haze shimmering over the edge and sand grains drifting in its wake.
import { rng, burst, fly, seg, ease, clamp, lerp, TAU, hex, fit } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: tumbleweed",
  desc: "A tumbleweed of tangled twigs bounces and rolls along the poster's bottom edge, kicking up dust on each landing, with heat haze shimmering and sand drifting behind it.",
  tags: ["cinema", "pun", "western", "desert", "tumbleweed", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#24140a", "#432612", "#6a4120", "#946234", "#bf8a4c", "#e2b874", "#f8e2aa"],
    dust: ["#33281c", "#5a4a34", "#8a7454", "#b89f78", "#dcc8a2"],
    seed: 1, w: 40, h: 60,
  },
};

const T0 = 0.0, T1 = 2.05, HAZE = "#ffcf7a";

export function drawBack(p, t, o) {
  preview(p, o);
}

/** The ball's path: x, height above the floor, angle and the landings so far. */
function path(o, t) {
  const { hw, s } = dims(o), k = clamp(s, 0.6, 3.5), R = Math.max(4, 7 * k);
  const x0 = -hw - R * 2.2, x1 = hw + R * 2.2;
  // hops: seeded lengths in time, heights falling off then a last big one
  const r = rng(o.seed, 77), n = 4, ds = [], hs = [];
  let sum = 0;
  for (let i = 0; i < n; i++) { const d = r.range(0.8, 1.25); ds.push(d); sum += d; hs.push(R * r.range(1.4, 2.4) * (i === 0 ? 1.3 : 1)); }
  const lands = [];
  let acc = T0;
  for (let i = 0; i < n; i++) { ds[i] = (ds[i] / sum) * (T1 - T0); acc += ds[i]; lands.push(acc); }
  const u = clamp((t - T0) / (T1 - T0));
  const x = lerp(x0, x1, u);
  let hgt = 0, prev = T0;
  for (let i = 0; i < n; i++) {
    if (t < lands[i]) { const f = (t - prev) / ds[i]; hgt = hs[i] * 4 * f * (1 - f); break; }
    prev = lands[i];
  }
  // the first hop starts in mid-air, coming down
  const ang = ((x - x0) / R) * 0.9;
  return { x, hgt, ang, R, k, lands, x0, x1, at: (tt) => lerp(x0, x1, clamp((tt - T0) / (T1 - T0))) };
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), Dc = fit(o.dust, 5), { hw, hh } = dims(o), G = hh;
  const P = path(o, t), { R, k } = P, sk = Math.sqrt(k);
  const fade = 1 - seg(t, 2.1, 2.7);

  // heat haze: wavy warm threads shimmering just above the bottom edge
  const hz = seg(t, 0, 0.3) * fade, HZ = hex(HAZE);
  if (hz > 0) {
    const rows = Math.max(3, Math.round(4 * sk));
    for (let j = 0; j < rows; j++) {
      const y0 = G - 2 - j * Math.max(2, 2.6 * sk);
      for (let x = Math.floor(-hw * 1.1); x < hw * 1.1; x++) {
        const w = Math.sin(x * 0.35 + t * 14 + j * 1.9) + Math.sin(x * 0.13 - t * 6 + j);
        if (w < 0.6) continue;
        const y = y0 + Math.sin(x * 0.5 + t * 18 + j * 2.3) * 0.8;
        p.blend(x, y, HZ, (w - 0.6) * 0.18 * hz * (1 - j / (rows + 1)));
      }
    }
    p.glowLine(-hw, G - 3, hw, G - 3, 7 * sk, C[4], 0.12 * hz);
  }

  // sand grains drifting behind it: thrown off the ball as it rolls, drifting back and settling
  const ng = Math.round(28 + 22 * k);
  burst(ng, o.seed + 3, (r) => {
    const b = r.range(T0 + 0.05, T1 - 0.25), age = t - b, life = r.range(0.5, 0.9);
    if (age < 0 || age > life) return;
    const bx = P.at(b), a = r.range(0, TAU);
    const [x, y] = fly(bx + Math.cos(a) * R * 0.7, G - R * r.range(0.2, 1.3), r.range(-28, 6) * sk, r.range(-14, 2) * sk, age, 40, 2.2);
    if (y > G) return;
    const u = age / life, c = r.next() < 0.3 ? C[6] : r.next() < 0.6 ? C[5] : Dc[3];
    p.dot(x, y, c, (1 - u) * 1.1);
    if (r.next() < 0.2) p.light(x, y, C[4], 0.2 * (1 - u));
  });

  // dust puffs at each landing: soft billows rolling out both ways, a few bits kicked up
  for (let i = 0; i < P.lands.length; i++) {
    const tl = P.lands[i], age = t - tl;
    if (age < 0 || age > 0.85 || i === P.lands.length - 1) continue;
    const lx = P.at(tl), u = age / 0.85, sp = ease.outCubic(u);
    burst(6, o.seed * 31 + i, (r, j) => {
      const dir = j % 2 ? 1 : -1, rr = (R * r.range(0.3, 0.55)) * (0.6 + sp * 0.8);
      const x = lx + dir * sp * R * r.range(0.5, 1.8), y = G - rr * 0.5 - sp * R * r.range(0.1, 0.5);
      const a = (1 - u) * (1 - u * 0.5) * 0.5;
      p.disc(x, y, rr, (d, g) => (Math.sin(g) < -0.2 && d > 0.45 ? Dc[4] : Dc[3]), (d) => a * (1 - d * d * 0.8));
    });
    burst(5, o.seed * 17 + i, (r) => {
      const [x, y] = fly(lx + r.range(-R, R) * 0.5, G - 1, r.range(-40, 50) * sk, -r.range(40, 90) * sk, age, 420, 0.5);
      if (y < G) p.dot(x, y, r.next() < 0.5 ? Dc[4] : C[5], 1 - u);
    });
    if (age < 0.08) p.line(lx - R, G - 0.5, lx + R, G - 0.5, Dc[4]);
    p.glow(lx, G - 1, R * 1.6, C[4], 0.22 * (1 - u));
  }

  if (t > T1 + 0.05) return;
  const cx = P.x, cy = G - R - P.hgt;

  // its shadow on the edge, shrinking as it leaves the floor
  const sh = clamp(1 - P.hgt / (R * 2.5));
  p.ellipse(cx, G, R * (0.4 + 0.5 * sh), 0.9, C[0], 0.55 * sh);

  // the ball: a translucent dark body, tangled loops of twig, twig ends poking out, lit from the upper left
  p.disc(cx, cy, R * 0.85, C[0], 0.3);
  const strands = Math.round(6 + 2.5 * k);
  for (let i = 0; i < strands; i++) {
    const r = rng(o.seed, i, 5);
    const rx = R * r.range(0.4, 0.95), ry = R * r.range(0.2, 0.7), phi = r.range(0, TAU) + P.ang;
    const ox = r.range(-0.35, 0.35) * R, oy = r.range(-0.35, 0.35) * R, cp = Math.cos(phi), sp = Math.sin(phi);
    const m = Math.ceil((rx + ry) * 3.4), g0 = r.range(0, TAU), span = r.range(0.6, 1) * TAU;
    for (let j = 0; j <= m; j++) {
      const g = g0 + (j / m) * span, ex = Math.cos(g) * rx, ey = Math.sin(g) * ry;
      const lx = ox + ex * cp - ey * sp, ly = oy + ex * sp + ey * cp, x = cx + lx, y = cy + ly;
      // depth: one side of each loop is the far side, darker
      const near = Math.sin(g) > 0, lit = (-lx - ly) / (R * 1.4);
      if (Math.hypot(lx, ly) > R * 1.05) continue;
      if (!near) { p.dot(x, y, lit > 0.2 ? C[3] : C[2], 0.75); continue; }
      p.px(x, y, i % 3 === 2 ? (lit > 0.3 ? C[3] : C[2]) : lit > 0.6 ? C[6] : lit > 0.2 ? C[5] : lit > -0.3 ? C[4] : C[3]);
    }
  }
  // a few long twigs crossing the tangle
  for (let i = 0; i < 2 + Math.round(k); i++) {
    const r = rng(o.seed, i, 13), a = r.range(0, TAU) + P.ang, b = a + r.range(2.2, 3.6), d0 = R * r.range(0.75, 0.95), d1 = R * r.range(0.7, 0.95);
    p.line(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0, cx + Math.cos(b) * d1, cy + Math.sin(b) * d1, (u) => (u < 0.5 ? C[4] : C[3]));
  }
  // twig ends: short spokes out past the rim
  const tw = Math.round(9 + 4 * k);
  for (let i = 0; i < tw; i++) {
    const r = rng(o.seed, i, 9), a = r.range(0, TAU) + P.ang, L = R * r.range(0.15, 0.45), b = R * r.range(0.8, 0.98);
    const ax = Math.cos(a), ay = Math.sin(a), bend = r.range(-0.5, 0.5);
    const lit = -ax - ay;
    p.line(cx + ax * b, cy + ay * b, cx + Math.cos(a + bend) * (b + L), cy + Math.sin(a + bend) * (b + L), lit > 0.4 ? C[5] : C[3]);
  }
  p.glow(cx - R * 0.3, cy - R * 0.4, R * 1.8, C[4], 0.14);
}
