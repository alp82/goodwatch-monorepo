// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, mix, clamp, rng, ease, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Comic pops",
  desc: "Over the Belgium island: little comic-book impact bursts pop up in yellow, red and cyan, inked jagged stars with a ! or halftone dots, squashing, stretching and fading.",
  tags: ["cinema", "ambient", "island", "country", "belgium", "comics", "pop", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  // ink, then the three fills (each shadow, fill, light) as their own options
  options: {
    palette: ["#140a24", "#fff8e8"],
    yellow: ["#e08a00", "#ffd21f", "#fff6a8"],
    red: ["#9a1020", "#ff3b30", "#ffb0a0"],
    cyan: ["#0a6e8a", "#22d3ee", "#c8f8ff"],
    seed: 1, r: 30, density: 1,
  },
};

const radius = (o) => clamp(o.r ?? 30, 10, 100);
const BANG = ["##", "##", "##", "##", "..", "##"];
const BANG1 = ["#", "#", "#", ".", "#"];

/** Every element i of n, evenly spaced over the loop, alive for `life` s: fn(age, i). Seamless. */
function each(t, D, n, life, fn) {
  for (let i = 0; i < n; i++) {
    let age = (((t - (i * D) / n) % D) + D) % D;
    for (; age < life; age += D) fn(age, i);
  }
}

function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function draw(p, t, o) {
  const [INK, RIM] = fit(o.palette, 2), R = radius(o), s = Math.max(0.8, R / 30), D = meta.duration, d2 = o.density >= 2;
  const FILLS = [fit(o.yellow, 3).map(hex), fit(o.red, 3).map(hex), fit(o.cyan, 3).map(hex)];
  const n = d2 ? 5 : R >= 45 ? 4 : 3, life = 1.9;
  each(t, D, n, life, (age, i) => {
    const g = rng(o.seed, i, 21);
    // where: spread across the upper island, each pop in its own slot so they don't stack
    const slot = (i * 0.618 + g.next() * 0.12) % 1, an = -Math.PI * (0.15 + 0.7 * slot);
    const d = R * g.range(0.45, 0.8), x = Math.round(Math.cos(an) * d), y = Math.round(Math.sin(an) * d * 0.85);
    const F = FILLS[(i + o.seed) % 3], size = (8 + g.next() * 1.5) * s, spikes = g.int(7, 8), rot = g.next() * TAU;
    const k = age / life;
    // pop: stretch tall, squash wide, overshoot, settle; then shrink away at the end
    let sx, sy;
    if (age < 0.07) { const q = age / 0.07; sx = 0.35 + 0.35 * q; sy = 0.6 + 0.75 * q; }
    else if (age < 0.16) { const q = (age - 0.07) / 0.09; sx = 0.7 + 0.65 * q; sy = 1.35 - 0.55 * q; }
    else if (age < 0.32) { const q = ease.outQuad((age - 0.16) / 0.16); sx = 1.35 - 0.35 * q; sy = 0.8 + 0.2 * q; }
    else { sx = 1; sy = 1; }
    const out = clamp((k - 0.72) / 0.28), shrink = 1 - ease.inQuad(out);
    sx *= shrink; sy *= shrink;
    if (shrink < 0.1) return;
    const wob = 1 + 0.04 * Math.sin(age * 18);
    const star = [];
    for (let j = 0; j < spikes * 2; j++) {
      const q = rng(o.seed, i, 400 + j), a = rot + (j * Math.PI) / spikes;
      const rr = (j % 2 ? 0.6 + q.next() * 0.06 : 0.98 + q.next() * 0.16) * size * wob;
      star.push([Math.cos(a) * rr * sx, Math.sin(a) * rr * sy]);
    }
    const ext = Math.ceil(size * 1.3 * Math.max(sx, sy)) + 3;
    const hot = age < 0.05; // a white hero frame on the pop
    const halftone = g.next() < 0.5;
    // a mask of the star on whole pixels, then grown by one (ink) and two (paper rim)
    const W = ext * 2 + 1, cx0 = Math.round(x), cy0 = Math.round(y), m = new Uint8Array(W * W);
    for (let j = 0; j < W; j++) for (let i2 = 0; i2 < W; i2++) m[j * W + i2] = inPoly(star, i2 - ext + 0.5 + cx0 - x, j - ext + 0.5 + cy0 - y) ? 1 : 0;
    const at = (i2, j) => (i2 < 0 || j < 0 || i2 >= W || j >= W ? 0 : m[j * W + i2]);
    // grow the mask: 1 = ink (within 1.5 px of the star), 2 = paper rim (within 2.3 px)
    const ring = new Uint8Array(W * W);
    for (let j = 0; j < W; j++) for (let i2 = 0; i2 < W; i2++) {
      if (!m[j * W + i2]) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const d2 = dx * dx + dy * dy, xx = i2 + dx, yy = j + dy;
        if (d2 > 5.3 || xx < 0 || yy < 0 || xx >= W || yy >= W) continue;
        const v = d2 <= 2.25 ? 1 : 2, k2 = yy * W + xx;
        if (!ring[k2] || ring[k2] > v) ring[k2] = v;
      }
    }
    for (let j = 0; j < W; j++) for (let i2 = 0; i2 < W; i2++) {
      const px = cx0 - ext + i2, py = cy0 - ext + j;
      if (!at(i2, j)) {
        const v = ring[j * W + i2];
        if (v === 1) p.px(px, py, INK);
        else if (v === 2) p.px(px, py, RIM);
        continue;
      }
      let c;
      if (hot) c = WHITE;
      else {
        // lit from the top left, a darker crescent at the bottom right
        const shadow = !at(i2 + 1, j + 1) || !at(i2 + 1, j);
        c = shadow ? F[0] : !at(i2 - 1, j - 1) || !at(i2, j - 1) ? F[2] : F[1];
        // halftone: a dot grid, denser toward the bottom right
        if (halftone && !shadow) {
          const dd = (i2 - ext + j - ext) / (size * 1.4);
          if (((px + py) & 1) === 0 && (px & 1) === 0 && dd > -0.35) c = F[0];
          else if (dd > 0.35 && ((px + py) & 1) === 0) c = F[0];
        }
      }
      p.px(px, py, c);
      p.light(px, py, F[1], 0.06);
    }
    // the !: inked, centered
    if (!halftone && !hot && shrink > 0.5) {
      const rows = s >= 1 ? BANG : BANG1, w = rows[0].length, h = rows.length;
      const by = Math.round(y - h / 2), bx = Math.round(x - w / 2);
      p.sprite(rows, { "#": INK }, bx, by);
    }
    // speed lines that fly off on the pop
    if (age < 0.3) {
      const q = age / 0.3;
      for (let j = 0; j < 4; j++) {
        const a = rot + 0.4 + (j * TAU) / 4 + g.next() * 0.3;
        const r0 = size * (1.2 + q * 1.1), r1 = r0 + 2.5 * s * (1 - q);
        p.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, j % 2 ? F[2] : WHITE);
      }
    }
    const fl = clamp(1 - age / 0.35);
    p.glow(x, y, size * 2.2, F[1], 0.12 + 0.3 * fl);
    if (hot) p.glow(x, y, size * 2.5, WHITE, 0.4);
  });
}
