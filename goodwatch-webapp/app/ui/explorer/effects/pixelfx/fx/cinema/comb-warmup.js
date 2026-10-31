// Made for the GoodWatch explorer map: combination warm-up (loop at the hub while it rises).
import { clamp, cycle, fit, hex, mix, rand, TAU, WHITE } from "../../core/index.js";
import { bulb, bulbCount, rampOf } from "./_comb.js";

export const meta = {
  name: "Combination warm-up",
  desc: "Marquee bulbs light one by one round the hub as it charges, motes in the picked islands' colors pour inward, and a flickering projector glow builds at its heart.",
  tags: ["cinema", "combination", "marquee", "charge", "loop"],
  size: [112, 112],
  origin: [56, 56],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "dark",
  // r: the hub's radius (effect px); charge 0..1 how far it has risen; colors: the picked islands' colors
  options: { palette: ["#3a2408", "#8a5a14", "#f0b424", "#ffe27a", "#fff8dc"], seed: 1, r: 30, charge: 0.6, colors: ["#e0607e", "#3fc1b0", "#9b7bea"] },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), r = Math.max(10, o.r), q = clamp(o.charge ?? 0.5), D = meta.duration;
  const ph = t / D, R = r + 4, N = bulbCount(R);
  const cols = (o.colors?.length ? o.colors : ["#ffffff"]).map((c) => rampOf(c));
  // projector heart: a glow that builds and flickers faster as it nears full
  const fl = 0.75 + 0.25 * Math.sin(ph * TAU * (4 + Math.round(q * 6))) * Math.sin(ph * TAU * 3 + 1);
  p.glow(0, 0, r * (0.5 + 0.5 * q), C[2], (0.08 + 0.3 * q * q) * fl);
  p.glow(0, 0, r * 0.25 + 2, C[4], 0.25 * q * q * fl);
  // energy gathering: rings of light contract from the marquee to the heart, more and faster as it charges
  const nRing = q > 0.3 ? 2 : 1;
  for (let i = 0; i < nRing; i++) {
    const u = (ph * nRing + i / nRing) % 1, rr = R * (1 - u) ** 1.5, k = (0.3 + 0.7 * q) * Math.min(1, u * 5) * (1 - u);
    if (rr < 2) continue;
    p.glowRing(0, 0, rr, 2.5, C[3], 0.22 * k);
    const n = Math.max(12, Math.round(rr * 1.6));
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + i;
      if ((j + Math.floor(ph * 30)) % 3 === 0) p.dot(Math.cos(a) * rr, Math.sin(a) * rr, C[3], k);
    }
  }
  // motes pouring in from beyond the ring, more as it charges
  const nMote = Math.round(6 + 20 * q);
  cycle(t, D, nMote, o.seed, 0.9, (age, life, g, i) => {
    const a = g.range(0, TAU), d0 = R + 6 + g.range(0, r * 0.5), u = age / life, dir = g.chance(0.5) ? 0.9 : -0.9;
    const d = d0 * (1 - u * u * 0.92), sw = a + u * dir;
    const x = Math.cos(sw) * d, y = Math.sin(sw) * d, CC = cols[i % cols.length];
    const tail = 3;
    for (let k = tail; k >= 0; k--) {
      const uu = Math.max(0, u - k * 0.05), dd = d0 * (1 - uu * uu * 0.92), aa = a + uu * dir;
      p.dot(Math.cos(aa) * dd, Math.sin(aa) * dd, k === 0 ? CC[4] : k === 1 ? CC[3] : CC[2], Math.min(1, u * 6) * (1 - k * 0.2));
    }
    p.dot(x + 1, y, CC[3], Math.min(1, u * 6));
    p.dot(x, y + 1, CC[3], Math.min(1, u * 6));
    p.glow(x, y, 4, CC[3], 0.35);
  });
  // the marquee: bulbs light clockwise from the top as it charges; a brighter pulse chases round the lit ones
  const lit = q * N, chase = Math.floor(ph * N * 2) % N;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i / N) * TAU, x = Math.cos(a) * R - 0.5, y = Math.sin(a) * R - 0.5;
    let k = 0;
    if (i < Math.floor(lit)) k = (chase - i + N) % N < 3 ? 1 : 0.6;
    else if (i === Math.floor(lit)) k = rand(o.seed, Math.floor(t * 15), i) < 0.5 ? 0.9 : 0.1; // the next one flickers on
    p.blend(x + 0.5, y + 0.5, C[0], 0.6);
    bulb(p, x, y, k, C, false);
  }
  // a thin rim of light joining the bulbs
  p.glowRing(0, 0, R, 2, mix(C[2], WHITE, 0.2), 0.05 + 0.12 * q);
}
