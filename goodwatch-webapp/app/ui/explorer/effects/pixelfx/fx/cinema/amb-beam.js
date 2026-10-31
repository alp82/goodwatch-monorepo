// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, mix, clamp, rng, hash, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Projector beam",
  desc: "Over the Italy island: an old projector at the edge throws a soft cone of light that sweeps slowly across it, flickering like film, dust sparkling in the beam.",
  tags: ["cinema", "ambient", "island", "country", "italy", "projector", "beam", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 8,
  loop: true,
  fps: 30,
  bg: "dark",
  // housing dark, housing, warm beam, beam bright, lamp white
  options: { palette: ["#1a1418", "#7a6a64", "#f0c47a", "#fff0c8", "#fffdf4"], seed: 1, r: 30, density: 1 },
};

const radius = (o) => clamp(o.r ?? 30, 10, 100);

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), s = Math.max(0.6, R / 30), D = meta.duration, ph = t / D, d2 = o.density >= 2;
  // the projector sits on the left shoulder of the island
  const lx = -0.92 * R, ly = -0.28 * R;
  // sweep: from aiming up-right to aiming level-right and back, eased at the ends
  const sw = 0.5 - 0.5 * Math.cos(ph * TAU);
  const aim = -0.48 + sw * 0.5, half = 0.26, L = R * 1.95;
  // flicker: a stepped film flutter, 12 steps a second, seamless (whole steps per loop)
  const step = Math.floor(t * 12) % (D * 12), fl = 0.86 + 0.14 * ((hash(step, 5) % 1000) / 1000);
  const blink = (hash(step, 9) % 1000) / 1000 < 0.04 ? 0.6 : 1;
  const k = fl * blink;
  const ca = Math.cos(aim), sa = Math.sin(aim);
  const inBeam = (x, y) => { // 0 outside, 1 on the axis, with u the distance along it
    const dx = x - lx, dy = y - ly, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    if (u < 2 || u > L) return [0, u, 0];
    const w = 1.2 + u * Math.tan(half), q = Math.abs(v) / w;
    if (q > 1) return [0, u, q];
    if (Math.hypot(x, y) > R * 1.12) return [0, u, q];
    return [1 - q, u, q];
  };
  // the cone: very soft fill, brighter edges, fading with distance; light carries the warmth
  for (let y = Math.floor(-R * 1.15); y <= Math.ceil(R * 0.6); y++)
    for (let x = Math.floor(lx - 2); x <= Math.ceil(R * 1.15); x++) {
      const [b, u, q] = inBeam(x + 0.5, y + 0.5);
      if (b <= 0) continue;
      const fall = clamp(1 - u / L) ** 0.7, end = clamp((R * 1.12 - Math.hypot(x + 0.5, y + 0.5)) / 5); // fade at the rim
      let c, a;
      if (q > 0.88) { c = u < L * 0.35 ? C[4] : C[3]; a = 0.55 * fall + 0.12; } // the cone's crisp edges
      else if (q < 0.3) { c = C[3]; a = 0.3 * fall + 0.05; } // a brighter core band
      else { c = C[2]; a = 0.17 * fall + 0.03; }
      p.blend(x + 0.5, y + 0.5, c, a * k * end);
      p.light(x + 0.5, y + 0.5, C[2], 0.11 * fall * k * end * (1.3 - q));
    }
  p.glowLine(lx, ly, lx + ca * L * 0.7, ly + sa * L * 0.7, 5 * s, C[2], 0.08 * k);
  // dust: motes drift slowly; the beam picks them out, the brightest get a little star
  const n = Math.round((d2 ? 40 : 26) * Math.min(1.6, s));
  for (let i = 0; i < n; i++) {
    const g = rng(o.seed, i, 3), sp = g.int(1, 2);
    const u = (ph * sp * (g.next() < 0.5 ? 1 : -1) + g.next() + 1) % 1;
    const x = (g.range(-0.9, 0.9) * R) + Math.sin(u * TAU) * 3 * s, y = -g.range(0.05, 1.0) * R + (u - 0.5) * 6 * s;
    const [b, uu] = inBeam(x, y);
    if (b <= 0) continue;
    const fall = clamp(1 - uu / L), m = b * fall * k;
    if (m < 0.08) continue;
    const tw = Math.sin(ph * TAU * (3 + (i % 4)) + g.next() * TAU);
    const c = m > 0.45 ? (tw > 0.6 ? C[4] : C[3]) : m > 0.2 ? C[3] : C[2];
    p.px(x, y, c);
    p.light(x, y, C[3], 0.3 * m);
    if (tw > 0.9 && m > 0.35) {
      p.px(x + 1, y, C[3]); p.px(x - 1, y, C[3]); p.px(x, y + 1, C[3]); p.px(x, y - 1, C[3]);
      p.glow(x, y, 4 * s, C[3], 0.35 * m);
    }
  }
  // the projector: a small dark body with two reels, the lens hot white
  const bx = lx - 4 * s, by = ly - 1.5 * s, bw = 6 * s, bh = 3.5 * s;
  p.rect(bx, by, bw, bh, C[0]);
  p.rect(bx, by, bw, 1, C[1]);
  p.rect(bx, by, 1, bh, C[1]);
  for (const [rx, sp] of [[bx + 1.2 * s, 1], [bx + bw - 1.2 * s, 1.5]]) {
    const rr = Math.max(1.6, 2 * s), ry = by - rr - 0.2;
    p.ring(rx, ry, rr + 0.5, 1, C[1]);
    const a = -ph * TAU * 4 * sp;
    for (let j = 0; j < 3; j++) p.px(rx + Math.cos(a + (j * TAU) / 3) * rr * 0.55, ry + Math.sin(a + (j * TAU) / 3) * rr * 0.55, C[1]);
  }
  p.px(lx, ly, C[4]);
  p.px(lx, ly - 1, C[3]);
  p.px(lx, ly + 1, C[3]);
  p.glow(lx, ly, 6 * s, C[3], 0.55 * k);
  p.glow(lx, ly, 2.5, WHITE, 0.4 * k);
}
