// Made for the GoodWatch stats page: A bolt splits a divisive title's score bar at its marker, harder the
// wider the title's spread (`force`, 0..1): a taller bolt, a wider gap, more sparks and a crack that runs further along
// the bar.
import { fit, hex, seg, clamp, lerp, ease, rand, rng, fly, flyV, bolt, WHITE } from "../../core/index.js";

export const meta = {
  name: "Split bar",
  desc: "A bolt strikes a score marker, its halves jump apart and spring back, a hot crack races along the bar, sparks skid off, a glow lingers. `force` sets how hard.",
  tags: ["stats-page", "divisive", "lightning", "crack", "spark", "one-shot"],
  size: [96, 36],
  origin: [48, 22],
  duration: 1.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    panel: "#182030",
    w: 90,
    x0: -45,
    force: 1,
    tease: 0,
    seed: 3,
  },
};

export const tease = { duration: 0.6 };

const STRIKE = 0.1;
// the marker is a 4 px round dot centered on the anchor, the bar runs through its rows -1 and 0
const MARK = [[-1, -2], [0, -2], [-2, -1], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1]];

/** The crack's row at distance d on one side: runs of 3 to 5 px, stepping between the bar's two rows. */
function crackRow(S, side, d) {
  let at = 2, row = -1, k = 0;
  while (true) {
    at += 3 + Math.floor(rand(S, side + 5, k++) * 3);
    if (d < at) return row;
    row = row ? 0 : -1;
  }
}

/** A hot color stepping down the ramp as k goes 0 (white) to 1 (cool). */
const heat = (C, k) => C[clamp(Math.round(7 - k * 4.4), 3, 7)];

export function draw(p, t, o) {
  const C = fit(o.palette, 8), S = o.seed, PANEL = hex(o.panel);
  const teasing = !!o.tease;
  const D = teasing ? tease.duration : meta.duration;
  if (t >= D) return;
  const L = o.x0, R = o.x0 + o.w; // the bar's ends, sparks stay on it
  const F = clamp(o.force ?? 1);
  const TOP = -Math.round(8 + 6 * F); // the bolt starts higher on a harder hit
  const PUSH = F > 0.7 ? 3 : F > 0.35 ? 2 : 1; // how far the marker's halves fly apart

  if (teasing) {
    // a tiny spark flickers on the marker's top edge: on, off, on brighter, a hop, gone
    const on = (a, b) => t >= a && t < b;
    if (on(0.06, 0.12) || on(0.2, 0.3) || on(0.38, 0.42)) {
      const big = on(0.2, 0.3);
      p.px(1, -3, WHITE);
      p.px(2, -3, big ? C[6] : C[5]);
      p.px(0, -3, C[5]);
      if (big) { p.px(1, -4, C[6]); p.px(1, -2, C[5]); }
      p.glow(1, -2, big ? 5 : 3, C[5], big ? 0.35 : 0.2);
    }
    // a single bead hops off to the right and dies
    const h = t - 0.27;
    if (h > 0 && h < 0.22) {
      const [x, y] = fly(2, -3, 22, -26, h, 260, 0);
      p.px(x, Math.min(y, -2), h < 0.1 ? C[6] : C[4]);
    }
    return;
  }

  // a pre-flicker at the top of the bolt's path
  if (t > STRIKE - 0.05 && t < STRIKE - 0.02) {
    p.px(-2, TOP, C[6]);
    p.glow(-2, TOP, 3, C[5], 0.3);
  }

  // the bolt: white hero frames, then one thinner re-flicker, then gone
  const age = t - STRIKE;
  if (age >= 0 && age < 0.2) {
    const k = age < 0.067 ? 0 : age < 0.1 ? 1 : age > 0.13 && age < 0.165 ? 2 : -1;
    if (k >= 0) {
      const path = bolt(rng(S, 11), -2, TOP, 0, -3, { jag: 0.34, depth: 3 }).map(([x, y]) => [Math.round(x), Math.round(y)]);
      const core = k === 0 ? WHITE : k === 1 ? C[6] : C[5];
      p.polyline(path, core);
      p.glowLine(-2, TOP, 0, -3, 4, C[5], k === 0 ? 0.35 : 0.18);
    }
  }

  // the marker struck: white, then it cracks and its halves nudge apart and spring back while cooling
  if (age >= 0 && age < 0.75) {
    // out fast, back in a step at a time
    const n = age < 0.05 ? 0 : age < 0.1 ? 1 : age < 0.2 ? PUSH : age < 0.26 ? Math.max(1, PUSH - 1) : age < 0.3 && PUSH > 2 ? 1 : 0;
    const cool = seg(age, 0.03, 0.6), a = 1 - seg(age, 0.45, 0.75);
    // cover the real marker while the halves are apart, so the gap reads as a split
    if (n > 0) for (const [mx, my] of MARK) p.px(mx, my, PANEL);
    for (const [mx, my] of MARK) {
      const left = mx < 0, x = mx + (left ? -n : n);
      const c = age < 0.05 ? WHITE : heat(C, cool);
      if (a >= 1) p.px(x, my, c);
      else p.blend(x, my, c, a);
    }
    // the bar glows hot either side of the split, pushed out with the halves
    for (const side of [-1, 1]) {
      const reach = 2 + Math.round((3 + 3 * F) * (1 - cool));
      for (let d = 1; d <= reach; d++) {
        const x = side < 0 ? -2 - n - d : 1 + n + d;
        if (x < L || x >= R) continue;
        const kk = clamp(cool + d / (reach + 2));
        for (const y of [-1, 0]) p.blend(x, y, heat(C, kk), a * (1 - d / (reach + 1)));
      }
    }
    // after it springs back a hairline crack stays a moment in the marker, then heals
    if (n === 0 && age > 0.26 && age < 0.3 + 0.15 * F) {
      p.px(-1, -2, PANEL); p.px(0, -1, PANEL); p.px(-1, 0, PANEL); p.px(0, 1, PANEL);
    }
  }
  // the crack: a hot zigzag races out along the bar both ways, as far as the hit was hard, then cools and closes
  // from its tips back in
  if (age >= 0.03 && age < 0.65) {
    const half = Math.max(0, Math.min(-L - 3, R - 2)); // room on the shorter side
    const reach = Math.round(half * (0.35 + 0.6 * F));
    const run = reach * ease.outQuart(seg(age, 0.03, 0.2)); // how far it has run
    const heal = reach * seg(age, 0.3, 0.65); // closed from the tips back in
    for (const side of [-1, 1]) {
      for (let d = 2; d <= run; d++) {
        if (reach - d < heal) continue;
        const x = side < 0 ? -1 - d : d;
        if (x < L || x >= R) continue;
        const y = crackRow(S, side, d);
        const hot = 1 - d / (run + 1), k = clamp(seg(age, 0.05, 0.45) + (1 - hot) * 0.5);
        const a = 1 - seg(age, 0.4, 0.65);
        p.blend(x, y, heat(C, k), a * (0.55 + 0.45 * hot));
        if (d >= run - 1 && age < 0.2) p.px(x, y, WHITE); // the running tip
      }
    }
  }

  // the white flash at the strike point
  if (age >= 0 && age < 0.067) {
    p.glow(0, -1, 6 + 4 * F, C[6], 0.45 + 0.2 * F);
    p.px(-3, -1, WHITE); p.px(2, -1, WHITE);
  }

  // sparks spit left and right, skidding along the bar's top edge
  const N = Math.round(4 + 8 * F);
  for (let i = 0; i < N; i++) {
    const born = STRIKE + 0.01 + rand(S, i, 1) * 0.06, sa = t - born, life = 0.25 + rand(S, i, 2) * 0.25;
    if (sa < 0 || sa > life) continue;
    const side = i % 2 ? 1 : -1, vx = side * (0.6 + 0.4 * F) * (60 + rand(S, i, 3) * 70), vy = -(8 + rand(S, i, 4) * 26);
    const sx = side < 0 ? -3 : 2;
    let [x, y] = fly(sx, -2, vx, vy, sa, 700, 3.5);
    let [ux, uy] = flyV(vx, vy, sa, 700, 3.5);
    if (y > -2) { y = -2; uy = 0; } // on the bar: skid
    if (x < L || x >= R) continue;
    const u = sa / life, sp = Math.hypot(ux, uy) || 1;
    const head = u < 0.3 ? WHITE : u < 0.65 ? C[6] : C[4];
    p.px(x, y, head);
    if (sp > 25) p.px(x - (ux / sp) * 1.2, y - (uy / sp) * 1.2, u < 0.5 ? C[5] : C[3]);
    p.light(x, y, C[5], 0.12 * (1 - u));
  }

  // the afterglow: a faint warm pool at the marker and two embers on the bar that wink out
  const ag = 1 - seg(age, 0.1, 1.05);
  if (age > 0 && ag > 0) {
    p.glow(-0.5, -0.5, 7, C[4], 0.22 * ag);
    const e = 1 - seg(age, 0.6, 1.0);
    if (e > 0 && age > 0.4) {
      if (-6 >= L) p.blend(-6, -1, C[4], 0.8 * e);
      if (5 < R) p.blend(5, 0, C[3], 0.7 * e);
    }
  }
}
