// Made for the GoodWatch stats page: The lowest Metascore gets a tomato.
import { fit, hex, rand, seg, clamp, lerp, bump, ease, burst, fly, sparkle, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Tomato splat",
  desc: "A small tomato lobs in from the upper left and squashes onto the point: a white hit, a crown of juice and seeds, a glossy splat that drips, dries and fades.",
  tags: ["stats-page", "tomato", "splat", "critics", "boo", "one-shot"],
  size: [90, 84],
  origin: [54, 48],
  duration: 1.7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2a0606", "#5e0e0c", "#a01a12", "#d8321c", "#ff5a36", "#ff9a7a", "#ffe0d0"],
    leaf: ["#0e2a10", "#1f5a1c", "#3c8f2a", "#7cc84a"],
    seed: 3,
  },
};

const HIT = 0.36, FADE0 = 1.15, FADE1 = 1.62;
const X0 = -40, Y0 = -34;

// where the tomato is on its lob (center), before the hit
function lob(t) {
  const u = clamp(t / HIT);
  const x = lerp(X0, 0, u);
  const y = lerp(Y0, -1, u) - 16 * u * (1 - u) * 2;
  return [x, y];
}

function tomato(p, x, y, C, L, spin, sx = 1, sy = 1) {
  const r = 4.5;
  p.ellipse(x, y, r * sx + 0.6, r * sy + 0.6, C[1]);
  p.ellipse(x, y, r * sx, r * sy, (px, py) => {
    const nx = (px - x) / (r * sx), ny = (py - y) / (r * sy);
    const l = -0.6 * nx - 0.8 * ny;
    return l > 0.35 ? C[4] : l > -0.45 ? C[3] : C[2];
  });
  // glossy highlight
  p.px(x - 2 * sx, y - 2 * sy, C[6]);
  p.px(x - 1 * sx, y - 2 * sy, C[5]);
  // the leafy top: a little star of leaves that turns as it spins
  const ty = y - r * sy;
  for (let i = 0; i < 4; i++) {
    const a = spin + (i * TAU) / 4;
    const lx = Math.cos(a) * 2.2, ly = Math.sin(a) * 0.9;
    p.px(x + lx, ty + ly, ly < 0 ? L[3] : L[2]);
  }
  p.px(x, ty - 1, L[2]);
  p.px(x, ty, L[1]);
}

// the splat's outline: a disc with lumpy lobes, the same every frame
function splatShape(seed) {
  const lobes = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand(seed, i, 1) * 0.6;
    lobes.push({ a, d: 4.5 + rand(seed, i, 2) * 3, r: 1.2 + rand(seed, i, 3) * 1.4 });
  }
  return lobes;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), L = fit(o.leaf, 4), S = o.seed;

  if (t < HIT) {
    // the lob: a faint trail of past positions, the tomato spinning
    for (let k = 3; k >= 1; k--) {
      const [tx, ty] = lob(t - k * 0.03);
      if (t - k * 0.03 > 0) p.dot(tx, ty, C[2], 0.5 - k * 0.12);
    }
    const [x, y] = lob(t);
    // stretched a touch along its flight just before it lands
    const st = 1 + 0.25 * seg(t, HIT - 0.1, HIT);
    tomato(p, x, y, C, L, t * 14, 1 / st, st);
    p.glow(x, y, 8, C[3], 0.12);
    return;
  }

  const tt = t - HIT;
  const fade = 1 - seg(t, FADE0, FADE1);

  // the hit: a white frame, then a squash flash
  if (tt < 0.05) {
    p.ellipse(0, -1, 7, 5, WHITE);
    p.glow(0, -1, 18, C[5], 0.8);
  } else if (tt < 0.1) {
    p.ellipse(0, -1, 7, 4, C[5]);
    p.ellipse(0, -1, 5, 3, C[6]);
  }
  p.glow(0, 0, 22, C[3], 0.35 * (1 - seg(tt, 0, 0.5)));

  // the splat: grows in with an overshoot, lobes around it, a darker rim, a glossy streak
  const dry = 1 - fade;
  const g = ease.outBack(seg(tt, 0.03, 0.16)) * (1 - 0.35 * dry);
  if (tt > 0.03 && fade > 0) {
    const lobes = splatShape(S);
    // it dries rather than dissolves: shrinks and darkens, and only the last few frames thin out
    const a = clamp(fade / 0.3);
    if (dry > 0.4) { C[4] = C[3]; C[3] = C[2]; }
    if (dry > 0.75) { C[3] = C[2]; C[2] = C[1]; C[5] = C[3]; C[6] = C[3]; }
    // spikes: thin radial streaks ending in beads, the classic splat
    for (let i = 0; i < 6; i++) {
      const sa = (i / 6) * TAU + 0.4 + rand(S, i, 21) * 0.5, L2 = (9 + rand(S, i, 22) * 5) * g;
      const ca = Math.cos(sa), sn = Math.sin(sa);
      const ex = ca * L2, ey = sn * L2 * 0.8, bx = ca * 3, by = sn * 2.4;
      p.tri(bx - sn * 1.6, by + ca * 1.6, bx + sn * 1.6, by - ca * 1.6, ex, ey, sn < -0.2 ? C[4] : C[3], a);
      p.circle(ex + ca, ey + sn, 1 + rand(S, i, 23) * 0.7, C[3], a);
    }
    for (const lb of lobes) {
      const lx = Math.cos(lb.a) * lb.d * g, ly = Math.sin(lb.a) * lb.d * g * 0.8;
      p.circle(lx, ly + 0.5, lb.r * g + 0.6, C[1], a);
    }
    p.ellipse(0, 0.5, 5.6 * g, 4.4 * g, C[1], a);
    for (const lb of lobes) {
      const lx = Math.cos(lb.a) * lb.d * g, ly = Math.sin(lb.a) * lb.d * g * 0.8;
      p.circle(lx, ly, lb.r * g, lb.a > 0.3 && lb.a < 2.8 ? C[2] : C[3], a);
    }
    p.ellipse(0, 0, 5 * g, 3.8 * g, (px, py) => (-0.5 * px - 0.8 * py > 1.8 ? C[4] : C[3]), a);
    // pulp: a few darker seeds in the middle
    for (let i = 0; i < 2; i++) {
      const sx = (rand(S, i, 11) - 0.5) * 6 * g, sy = (rand(S, i, 12) - 0.5) * 4 * g;
      p.dot(sx, sy, hex("#ffd27a"), a);
    }
    // glossy highlight, sliding a touch as the juice runs
    if (g > 0.7) {
      p.line(-3, -2, -1, -3, C[5], a);
      p.dot(-2, -3, C[6], a);
      p.dot(2, 1, C[4], a);
    }
    // two drips run down from the lower edge
    for (let i = 0; i < 2; i++) {
      const dx = i ? 2.5 : -1.5 + rand(S, 31) * 0.5, start = 0.18 + i * 0.12;
      const len = 9 * ease.outCubic(seg(tt, start, start + 0.85)) * (i ? 0.7 : 1);
      if (len < 0.5) continue;
      const top = 3.5;
      p.line(dx, top, dx, top + len, C[2], a);
      p.line(dx + 1, top, dx + 1, top + len * 0.6, C[3], a);
      // a bead at the tip with a pin of light
      p.circle(dx + 0.5, top + len + 0.5, 1.2, C[3], a);
      p.dot(dx, top + len, C[5], a);
    }
  }

  // the crown: juice drops flung out, stretched with speed, falling and fading
  burst(20, S, (r, i) => {
    const ang = -Math.PI / 2 + r.range(-1.7, 1.7);
    const sp = r.range(50, 120), life = r.range(0.35, 0.7), delay = r.range(0, 0.04);
    const u = tt - delay;
    if (u < 0 || u > life) return;
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp * 0.85;
    const [x, y] = fly(0, -1, vx, vy, u, 260, 3);
    const [x2, y2] = fly(0, -1, vx, vy, Math.max(0, u - 0.025), 260, 3);
    const k = 1 - u / life;
    const c = k > 0.6 ? C[4] : k > 0.3 ? C[3] : C[2];
    p.line(x2, y2, x, y, c);
    if (i % 3 === 0 && k > 0.4) p.px(x + 1, y, c);
    if (k > 0.5) p.dot(x, y, C[5]);
  });
  // seeds: pale little flecks that tumble out lower and slower
  burst(6, S + 7, (r) => {
    const ang = r.range(-Math.PI, 0), sp = r.range(30, 60), life = r.range(0.4, 0.65);
    if (tt > life) return;
    const [x, y] = fly(0, 0, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.6, tt, 220, 2);
    p.dot(x, y, hex("#ffe6a0"), 1 - tt / life);
  });
  // the leafy top pops off and tumbles away up and left
  if (tt < 0.75) {
    const [x, y] = fly(0, -5, -38, -70, tt, 240, 1);
    const a = tt * 18;
    const k = 1 - seg(tt, 0.5, 0.75);
    for (let i = 0; i < 4; i++) {
      const b = a + (i * TAU) / 4;
      p.dot(x + Math.cos(b) * 1.6, y + Math.sin(b) * 1.6, i % 2 ? L[3] : L[2], k);
    }
    p.dot(x, y, L[1], k);
  }
  // a short glint on the splat once it settles
  if (tt > 0.3 && tt < 0.55) sparkle(p, -3, -3, 3 * bump(tt, 0.3, 0.55), WHITE, C[5], 0.5);
}
