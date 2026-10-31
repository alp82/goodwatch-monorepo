// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, mix, clamp, bump, rng, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Clockwork gears",
  desc: "Over the Germany island: three small brass gears mesh and turn over the upper island, teeth lit from the top left, a glint running round each rim and a faint warm light under them.",
  tags: ["cinema", "ambient", "island", "country", "germany", "gears", "clockwork", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  // outline, shadow brass, brass, lit brass, shine
  options: { palette: ["#24140a", "#6e4418", "#b8812e", "#ecc060", "#fff2c0"], seed: 1, r: 30, density: 1 },
};

const radius = (o) => clamp(o.r ?? 30, 10, 100);

// a gear with n teeth at pitch P: pitch radius n*P/TAU, teeth stick out ~0.36 P either side of it
function dims(n, P) {
  const rp = (n * P) / TAU;
  return { n, rp, ro: rp + P * 0.26, rr: rp - P * 0.26 };
}

function gear(p, C0, x, y, g, rot, s, glintAt, spokes, tone = 0) {
  const C = tone ? C0.map((c, i) => (i ? mix(c, C0[i - 1], tone) : c)) : C0;
  const { n, ro, rr } = g, hub = Math.max(1.2, rr * 0.3), lx = -0.7071, ly = -0.7071;
  const ext = ro + 1.5;
  p.shade(x - ext, y - ext, x + ext, y + ext, (px, py, out) => {
    const dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
    if (d > ro + 1.1) return;
    // tooth profile: a trapezoid tooth, flat top half a pitch wide
    const ang = Math.atan2(dy, dx), f = (((ang - rot) * n) / TAU) % 1, q = Math.abs(((f + 1) % 1) - 0.5) * 2; // 1 at tooth center, 0 in gap
    const edge = rr + (ro - rr) * clamp((q - 0.38) / 0.22);
    if (d > edge + 1) return;
    if (d > edge) { out.c = C[0]; return; } // outline
    if (d < hub) return; // hole
    if (d < hub + 1) { // inner wall of the hole: lit on the far (bottom-right) side
      const lit = (dx * lx + dy * ly) / (d || 1);
      out.c = lit < -0.2 ? C[2] : C[0];
      return;
    }
    if (spokes) { // web cut out between four spokes
      const sa = (((ang - rot) * 4) / TAU) % 1, sq = Math.abs(((sa + 1) % 1) - 0.5) * 2;
      const w0 = hub + 1.6, w1 = rr - 1.6;
      if (d > w0 && d < w1 && sq < 0.62) {
        if (d < w0 + 1 || d > w1 - 1 || sq > 0.48) { out.c = C[0]; return; }
        return;
      }
    }
    const lit = (dx * lx + dy * ly) / (d || 1);
    if (d > edge - 1.2) out.c = lit > 0.5 ? C[4] : lit > 0.1 ? C[3] : lit < -0.45 ? C[1] : C[2]; // tooth tops and rim
    else if (d > rr - 2.2 && d <= rr - 1.2) out.c = lit > 0.3 ? C[1] : C[0]; // groove inside the rim
    else if (d < hub + 2.2) out.c = lit > 0.2 ? C[3] : lit < -0.4 ? C[1] : C[2]; // raised boss round the hole
    else out.c = lit > 0.45 ? C[3] : lit < -0.3 ? C[1] : C[2];
  });
  // the glint running round the rim
  const ga = glintAt, gx = x + Math.cos(ga) * (rr + 0.3), gy = y + Math.sin(ga) * (rr + 0.3);
  const facing = (Math.cos(ga) * lx + Math.sin(ga) * ly + 1) / 2; // brightest on the lit side
  const k = 0.35 + 0.65 * facing;
  p.px(gx, gy, k > 0.6 ? mix(C[4], WHITE, 0.5) : C[4]);
  for (const dd of [-1, 1]) {
    const a2 = ga + dd * (1.4 / (rr + 0.3));
    p.px(x + Math.cos(a2) * (rr + 0.3), y + Math.sin(a2) * (rr + 0.3), k > 0.5 ? C[4] : C[3]);
  }
  p.glow(gx, gy, 3 + 3 * k * s, C[3], 0.35 * k);
  // the warm light the brass throws
  p.glow(x - ro * 0.2, y - ro * 0.2, ro * 1.7, C[2], 0.12);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), s = R / 30, D = meta.duration, ph = t / D, d2 = o.density >= 2;
  const P = 5.6 * Math.max(0.6, s);
  const A = dims(10, P), B = dims(6, P), G = dims(7, P);
  // big gear left of center, small one up-right, a third down-left; the center lines set how they mesh
  const ax = -0.12 * R, ay = -0.5 * R;
  const tb = -0.3, tg = 2.45; // directions from A to B and A to G
  const bx = ax + Math.cos(tb) * (A.rp + B.rp), by = ay + Math.sin(tb) * (A.rp + B.rp);
  const gx = ax + Math.cos(tg) * (A.rp + G.rp), gy = ay + Math.sin(tg) * (A.rp + G.rp);
  const m = 5; // teeth that pass the mesh each loop: a seamless turn for every gear
  const ra = tb + (m * TAU * ph) / A.n;
  // A has a tooth at angle tb when B has a gap at tb + PI, and they then move the same teeth
  const rb = tb + Math.PI + Math.PI / B.n - (m * TAU * ph) / B.n;
  // A's nearest tooth to the G mesh line sits e off it; G mirrors that along its pitch circle, gap facing it
  const e = tb + (Math.round(((tg - tb) * A.n) / TAU) * TAU) / A.n - tg;
  const rg0 = tg + Math.PI - (e * A.rp) / G.rp + Math.PI / G.n;
  const rg = rg0 - (m * TAU * ph) / G.n;
  const third = d2 || R >= 22;
  if (third) gear(p, C, gx, gy, G, rg, s, rg0 - TAU * ph * 2 + 2.1, false, 0.45);
  gear(p, C, bx, by, B, rb, s, TAU * ph * 3 + 1, false, 0.25);
  gear(p, C, ax, ay, A, ra, s, -TAU * ph * 2, s >= 1.4);
  // where the teeth meet: a tiny warm spark now and then
  for (let i = 0; i < (d2 ? 3 : 1); i++) {
    const k = bump((ph * (d2 ? 3 : 2) + i * 0.37) % 1, 0, 0.08);
    if (k > 0) {
      const mx = ax + Math.cos(tb) * A.rp, my = ay + Math.sin(tb) * A.rp;
      p.px(mx, my - 1, mix(C[4], WHITE, 0.4));
      p.glow(mx, my - 1, 4, C[3], 0.4 * k);
    }
  }
  // brass dust drifting up out of the works (density 2)
  if (d2) for (let i = 0; i < 6; i++) {
    const g = rng(o.seed, i, 77), u = (ph + g.next()) % 1;
    const x = ax + g.range(-1, 1) * R * 0.5 + Math.sin((u + g.next()) * TAU) * 2, y = ay + R * 0.3 - u * R * 0.6;
    const k = bump(u, 0, 1);
    if (k > 0.3) { p.px(x, y, k > 0.7 ? C[3] : C[2]); p.light(x, y, C[3], 0.15 * k); }
  }
}
