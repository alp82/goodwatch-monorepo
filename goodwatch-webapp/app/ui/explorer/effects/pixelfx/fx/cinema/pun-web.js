import { rng, clamp, seg, ease, TAU, WHITE, hex, fit, sparkle } from "../../core/index.js";
import { poster } from "./_pun2.js";

export const meta = {
  name: "Corner web",
  desc: "Silk strands shoot out from the poster's top corner, the spiral threads zip in between them sagging a little, a glint runs along the web, then it fades away.",
  tags: ["cinema", "pun", "web", "spider", "silk", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.0,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#2a3040", "#6a7690", "#b8c4d8", "#e8f0ff", "#ffffff"], seed: 1, w: 40, h: 60, corner: 1 },
};

export function draw(p, t, o) {
  const { w, h, k } = poster(o), C = fit(o.palette, 5).map(hex), sk = Math.sqrt(k);
  const sx = o.corner < 0 ? -1 : 1, ox = sx * w * 0.5, oy = -h * 0.5;
  const fade = 1 - seg(t, 1.3, 1.95);
  if (fade <= 0) return;
  const L = Math.min(w, h) * 0.85, n = 7;
  // the radial strands, from just outside the corner into the poster
  const rays = [];
  for (let i = 0; i < n; i++) {
    const r = rng(o.seed, i), a = -0.22 + (Math.PI / 2 + 0.44) * (i / (n - 1)) + r.range(-0.06, 0.06);
    const len = L * r.range(0.8, 1.05) * ease.outQuart(seg(t, i * 0.025, 0.2 + i * 0.025));
    rays.push([Math.cos(a) * len, Math.sin(a) * len, len]);
  }
  const P = (x, y) => [ox - sx * x, oy + y];
  // a flash at the corner when it fires
  if (t < 0.1) p.glow(ox, oy, 10 * sk, WHITE, 0.5 * (1 - t / 0.1));
  for (const [x, y] of rays) {
    const [ax, ay] = P(0, 0), [bx, by] = P(x, y);
    p.line(ax, ay, bx, by, C[2], fade);
  }
  // the spiral threads: chords between neighbouring rays at a few radii, each sagging toward the corner
  const rings = 4;
  for (let j = 1; j <= rings; j++) {
    const f = (j + 0.4) / (rings + 1), on = seg(t, 0.2 + j * 0.05, 0.32 + j * 0.05);
    if (on <= 0) continue;
    for (let i = 0; i < n - 1; i++) {
      const A = rays[i], B = rays[i + 1];
      if (A[2] < L * f || B[2] < L * f) continue;
      const ax = A[0] / A[2] * L * f, ay = A[1] / A[2] * L * f, bx = B[0] / B[2] * L * f, by = B[1] / B[2] * L * f;
      const mx = (ax + bx) / 2 * 0.9, my = (ay + by) / 2 * 0.9, u = on;
      const [p0x, p0y] = P(ax, ay), [pmx, pmy] = P(mx, my), [p1x, p1y] = P(ax + (bx - ax) * u, ay + (by - ay) * u);
      const c = j % 2 ? C[2] : C[1];
      if (u < 1) p.line(p0x, p0y, p1x, p1y, C[4], fade);
      else {
        p.line(p0x, p0y, pmx, pmy, c, fade * 0.9);
        const [qx, qy] = P(bx, by);
        p.line(pmx, pmy, qx, qy, c, fade * 0.9);
      }
    }
  }
  // the glint runs out along one strand
  const g = seg(t, 0.55, 0.95);
  if (g > 0 && g < 1) {
    const R0 = rays[2], [gx, gy] = P(R0[0] * g, R0[1] * g);
    sparkle(p, gx, gy, Math.max(1, Math.round(3 * sk * Math.sin(Math.PI * g))), C[3], C[2], 0.45);
  }
  p.glow(ox - sx * L * 0.3, oy + L * 0.3, L * 0.7, C[2], 0.12 * fade);
}
