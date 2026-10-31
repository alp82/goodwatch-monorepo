// Made for the GoodWatch explorer map: combination calm loop (while a ready combination stays up).
import { cycle, fit, hex, mix, TAU, WHITE } from "../../core/index.js";
import { beam, bulb, bulbCount, rampOf } from "./_comb.js";

export const meta = {
  name: "Marquee calm",
  desc: "Round the open combination a marquee ring chases slowly, two searchlights sway behind it, and now and then a glint or a mote in a picked island's color drifts up.",
  tags: ["cinema", "combination", "marquee", "searchlight", "loop"],
  size: [144, 144],
  origin: [72, 80],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#3a2408", "#8a5a14", "#f0b424", "#ffe27a", "#fff8dc"], seed: 1, r: 30, colors: ["#e0607e", "#3fc1b0", "#9b7bea"] },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), r = Math.max(10, o.r), D = meta.duration, ph = t / D, R = r + 4;
  const cols = (o.colors?.length ? o.colors : ["#ffffff"]).map((c) => rampOf(c));
  // two searchlights behind, swaying slowly (whole swings a loop)
  for (let i = 0; i < 2; i++) {
    // from the ring's lower sides, leaning outwards so they never wash over the titles in the middle
    const s = i ? 1 : -1, sw = Math.sin(ph * TAU * (i ? 2 : 1) + i * 2) * 0.25;
    beam(p, s * R * 0.92, R * 0.4, -Math.PI / 2 + s * (0.55 + sw), r * 1.9, 0.14, mix(C[3], WHITE, 0.4), 1.1);
  }
  // the marquee: every third bulb lit, the pattern stepping round (a whole number of steps a loop)
  const N = bulbCount(R), step = Math.floor(ph * 48) % 3;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i / N) * TAU, x = Math.cos(a) * R - 0.5, y = Math.sin(a) * R - 0.5;
    const on = (i + step) % 3 === 0;
    p.blend(x + 0.5, y + 0.5, C[0], 0.5);
    bulb(p, x, y, on ? 0.95 : 0.3, C, false);
  }
  p.glowRing(0, 0, R, 2, C[2], 0.08);
  // glints on the ring and motes in the picked colors drifting up off it
  cycle(t, D, 5, o.seed, 0.6, (age, life, g) => {
    const a = g.range(0, TAU), x = Math.cos(a) * R, y = Math.sin(a) * R, k = Math.sin((age / life) * Math.PI);
    const arm = Math.round(1 + 2 * k);
    p.px(x, y, WHITE);
    for (let j = 1; j <= arm; j++) {
      const c = j === arm ? C[2] : C[3];
      p.px(x + j, y, c); p.px(x - j, y, c); p.px(x, y + j, c); p.px(x, y - j, c);
    }
    p.glow(x, y, 6, C[3], 0.4 * k);
  });
  cycle(t, D, 8, o.seed + 5, 2.2, (age, life, g, i) => {
    const a = g.range(-Math.PI * 0.95, -Math.PI * 0.05), u = age / life, CC = cols[i % cols.length];
    const x = Math.cos(a) * R + Math.sin(u * TAU + i) * 2, y = Math.sin(a) * R - u * r * 0.6;
    const k = Math.min(1, u * 5) * (1 - u);
    const kk = Math.min(1, k * 2.2);
    p.dot(x, y, kk > 0.5 ? CC[4] : CC[3], kk);
    p.dot(x + 1, y, CC[3], kk);
    p.dot(x, y + 1, CC[2], kk);
    p.glow(x, y, 5, CC[3], 0.4 * kk);
  });
}
