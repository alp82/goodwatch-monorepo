// Made for the GoodWatch footer cinema: studio ident, neon marquee take, for the drive-in.
// A dark roadside sign at night: the G emblem and the letters are neon tubes that strike one by one (stutter, buzz,
// steady), PICTURES lights, marquee bulbs run round the border and chase, the glow pools on the wet ground, it
// holds (one tube buzzes), then the power goes: bulbs drop, the tubes stutter and cool off.
import { seg, clamp, rand, hex, fit, mix, luma, red, green, blue, rgb, noise2, FONTS, WHITE } from "../../core/index.js";

export const meta = {
  name: "Studio ident: neon marquee",
  desc: "A roadside sign at night: GOODWATCH neon tubes strike one by one, PICTURES lights, marquee bulbs chase round the border, glow pools on the wet ground, then the power drops.",
  tags: ["cinema-show", "screen", "ident", "logo", "neon", "marquee", "one-shot"],
  size: [288, 120],
  origin: [144, 60],
  duration: 7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { w: 288, h: 120, seed: 5, palette: ["#2e1a04", "#7a4a0a", "#c4820e", "#fbbf24", "#ffe9a0", "#fff6d6"] },
};

// layout: border box, emblem, wordmark tubes, PICTURES plaque, posts and the ground line
const BX0 = -88, BX1 = 88, BY0 = -53, BY1 = 17, GROUND = 42;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
const SKY = ["#0b0b10", "#0c0e17", "#0e121f"].map(hex);
const BOARD = hex("#13111a"), BOARD_EDGE = hex("#2a2533"), POST = hex("#1c1922"), ASPHALT = hex("#0d0d13");
const DEAD = { white: hex("#22212b"), amber: hex("#2a1f16") };
// tube colors: core, halo, outer light
const TUBE = {
  white: [hex("#ffffff"), hex("#bcc6f2"), hex("#c8d2ff"), hex("#5d6694")],
  amber: [hex("#fff2c2"), hex("#fbbf24"), hex("#ffb020"), hex("#8a560c")],
};

// a neon element: the tube's pixels, its color, when it strikes
function tubeFromGlyph(ch, x0, y0) {
  const g = FONTS.big.glyphs[ch], on = (c, r) => c >= 0 && r >= 0 && c < g.w && r < 7 && g.rows[r][c];
  const set = new Map(), put = (x, y) => set.set(y * 1024 + x, [x, y]);
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < g.w; c++) {
      if (!on(c, r)) continue;
      const x = x0 + c * 3, y = y0 + r * 3;
      put(x, y);
      if (on(c + 1, r)) put(x + 1, y), put(x + 2, y);
      if (on(c, r + 1)) put(x, y + 1), put(x, y + 2);
      // diagonals only where no straight path joins them
      if (on(c + 1, r + 1) && !on(c + 1, r) && !on(c, r + 1)) put(x + 1, y + 1), put(x + 2, y + 2);
      if (on(c - 1, r + 1) && !on(c - 1, r) && !on(c, r + 1)) put(x - 1, y + 1), put(x - 2, y + 2);
    }
  return [...set.values()];
}
// the emblem's tube: one neon line bent into the G (an open ring, a short drop and the bar), and the play triangle
// as a small amber tube inside it, pointing into the bar. Rasterized from a path so the line stays 1 px thin.
function pathPixels(pts) {
  const out = [], seen = new Set();
  for (const [x, y] of pts) {
    const X = Math.round(x), Y = Math.round(y), k = Y * 1024 + X;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push([X, Y]);
  }
  // pixel-perfect: drop the corner pixel of every L so the tube never doubles up
  for (let i = 1; i < out.length - 1; i++) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    if (Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1 && (a[0] === b[0] || a[1] === b[1])) out.splice(i--, 1);
  }
  return out;
}
function tubesFromG(cx, cy) {
  const R = 10, pts = [], A0 = -0.72, A1 = 0.62;
  for (let a = A0; a > A1 - Math.PI * 2; a -= 0.01) pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
  const ex = cx + Math.cos(A1) * R, ey = cy + Math.sin(A1) * R;
  for (let y = ey; y >= cy + 1; y -= 0.25) pts.push([ex, y]);
  for (let x = ex; x >= cx + 4; x -= 0.25) pts.push([x, cy + 1]);
  const tri = [], fill = [];
  const T = [[cx - 4, cy - 3], [cx + 2, cy + 1], [cx - 4, cy + 5]];
  for (let i = 0; i < 3; i++) {
    const [a, b] = [T[i], T[(i + 1) % 3]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4);
    for (let j = 0; j < n; j++) tri.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
  }
  // the triangle's inside: lit glass, so it reads as a solid play mark rather than a loop
  const rim = pathPixels(tri), onRim = new Set(rim.map(([x, y]) => y * 1024 + x));
  for (let y = cy - 2; y <= cy + 4; y++)
    for (let x = cx - 3; x <= cx + 1; x++)
      if (!onRim.has(y * 1024 + x) && Math.abs(y - cy - 1) < (x - cx + 4) * (4 / 6) * -1 + 4 + 0.01) fill.push([x, y]);
  return [pathPixels(pts), rim, fill];
}

const ELEMS = [];
{
  const [gBody, gTri, gFill] = tubesFromG(0, -37);
  ELEMS.push({ px: gBody, col: "white", on: 0.45, cx: 0, cy: -37 }, { px: gTri, fill: gFill, col: "amber", on: 0.62, cx: -2, cy: -36 });
  const word = "GOODWATCH", wx = -79, wy = -20;
  for (let i = 0; i < word.length; i++) {
    const x = wx + i * 18;
    ELEMS.push({ px: tubeFromGlyph(word[i], x, wy), col: i < 4 ? "white" : "amber", on: i < 4 ? 1.05 + i * 0.16 : 1.85 + (i - 4) * 0.14, cx: x + 6, cy: wy + 9, li: i });
  }
}
const PICS_ON = 2.65, BULB0 = 2.9, BULB1 = 3.4, FAULT = 4.7, OFF = 6.1, END = 6.85;

// border bulbs every 5 or 6 px, ordered round the box starting at the bottom middle
const BULBS = [];
{
  const pts = [];
  for (let x = 0; x < BX1; x += 6) pts.push([x, BY1]);
  for (let y = BY1; y > BY0; y -= 5) pts.push([BX1, y]);
  for (let x = BX1; x > BX0; x -= 6) pts.push([x, BY0]);
  for (let y = BY0; y < BY1; y += 5) pts.push([BX0, y]);
  for (let x = BX0; x < 0; x += 6) pts.push([x, BY1]);
  pts.forEach(([x, y], i) => BULBS.push({ x, y, i, u: Math.min(i, pts.length - i) / (pts.length / 2) }));
}

// how lit a tube is at time t: 0 dead, 1 faint, 2 buzzing, 3 steady. A real neon strike: a flash, gaps, buzz, steady.
function level(t, on, id, seed) {
  const age = t - on;
  if (age < 0) return 0;
  if (t > OFF) {
    // power down: a last stutter, then the gas cools through the dim levels
    const a = t - OFF - 0.12 - rand(seed, id, 9) * 0.1;
    if (a < 0) return rand(seed, id, Math.floor(t * 30)) < 0.5 ? 1 : 3;
    return a < 0.12 ? 2 : a < 0.3 ? 1 : 0;
  }
  if (age < 0.42) {
    const f = Math.floor(age * 30);
    if (f === 0) return 3;
    const r = rand(seed, id, f), pOn = 0.15 + (age / 0.42) * 0.75;
    return r < pOn ? (rand(seed, id, f, 1) < 0.35 ? 2 : 3) : r < pOn + 0.2 ? 1 : 0;
  }
  // the hold: the W of WATCH has a loose electrode and drops out twice
  if (id === 6 && t > FAULT && t < FAULT + 0.4) {
    const f = Math.floor((t - FAULT) * 30);
    return [1, 0, 2, 3, 3, 1, 2, 3, 3, 3, 3, 3][f] ?? 3;
  }
  return 3;
}

export function draw(p, t, o) {
  if (t >= meta.duration - 0.02) return;
  const C = fit(o.palette, 6), hw = (o.w ?? 288) / 2, seed = o.seed;
  const scene = seg(t, 0, 0.3) * (1 - seg(t, END - 0.2, END + 0.1));
  if (scene <= 0) return;

  // how much neon is lit right now drives the light thrown on the board and the ground
  let lit = 0;
  const lv = ELEMS.map((e, i) => {
    const l = level(t, e.on, i, seed);
    lit += l / 3 / ELEMS.length;
    return l;
  });
  const picsL = level(t, PICS_ON, 20, seed);
  const bulbsOn = t > BULB0 && t < OFF;
  lit = lit * 0.85 + (bulbsOn ? 0.15 : 0);

  // sky with a few stars, the ground, the posts and the board
  p.shade(-hw, -60, hw - 1, GROUND - 1, (x, y) => SKY[clamp(Math.floor((y + 60 + BAYER[((Math.floor(y) & 3) << 2) | (Math.floor(x) & 3)] * 10 - 5) / 34), 0, 2)]);
  for (let i = 0; i < 40; i++) {
    const sx = Math.floor((rand(seed, i, 1) - 0.5) * hw * 2), sy = Math.floor(-58 + rand(seed, i, 2) * 90);
    if (sx > BX0 - 3 && sx < BX1 + 3 && sy > BY0 - 3 && sy < BY1 + 3) continue;
    p.dot(sx, sy, rand(seed, i, 3) < 0.3 ? hex("#c8cce0") : hex("#555a78"), scene * (0.6 + 0.4 * Math.sin(t * 3 + i)));
  }
  p.rect(-hw, GROUND, hw * 2, 60 - GROUND, ASPHALT, scene);
  p.line(-hw, GROUND, hw - 1, GROUND, hex("#1d1b26"), scene);
  for (const px of [-60, 58]) {
    p.rect(px, BY1 + 1, 3, GROUND - BY1 - 1, POST, scene);
    p.line(px, BY1 + 1, px, GROUND - 1, hex("#2e2a38"), scene);
  }
  p.rect(BX0 + 2, BY0 + 2, BX1 - BX0 - 3, BY1 - BY0 - 3, BOARD, scene);
  p.line(BX0 + 2, BY0 + 2, BX1 - 2, BY0 + 2, BOARD_EDGE, scene);
  p.line(BX0 + 2, BY1 - 2, BX1 - 2, BY1 - 2, hex("#0c0b10"), scene);

  // the light the sign throws: on the board behind the tubes, and a pool on the wet ground below
  if (lit > 0) {
    p.glow(0, -20, 100, C[2], 0.1 * lit);
    p.glow(0, -20, 50, hex("#c8d2ff"), 0.05 * lit);
    p.shade(-hw, GROUND + 1, hw - 1, 59, (x, y, out) => {
      const d = (x / 120) ** 2 + ((y - GROUND - 4) / 14) ** 2;
      if (d > 1) return;
      out.l = C[3];
      out.k = 0.16 * lit * (1 - d);
    });
  }

  // the tubes: dead glass when off, then faint, buzzing or steady; a reflection shimmers on the wet ground
  ELEMS.forEach((e, i) => {
    const l = lv[i], T = TUBE[e.col];
    // a filled element (the play triangle): amber glass with a hot line through its middle
    if (e.fill) for (const [x, y] of e.fill) l === 0 ? p.dot(x, y, DEAD[e.col], scene * 0.6) : p.px(x, y, l === 3 ? (y === e.cy + 0 && x < e.cx + 3 ? T[0] : T[1]) : T[3]);
    for (const [x, y] of e.px) {
      if (l === 0) {
        p.dot(x, y, DEAD[e.col], scene);
        continue;
      }
      if (l === 3) {
        p.px(x, y, e.fill ? T[1] : T[0]);
        p.light(x, y, T[2], 0.28);
      } else p.px(x, y, l === 2 ? T[1] : T[3]);
    }
    // the halo round a lit tube: its own color, then light
    if (l >= 2) {
      for (const [x, y] of e.px)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c = p.get(x + dx, y + dy);
          if (c === T[0] || c === T[1] || c === T[3]) continue;
          p.dot(x + dx, y + dy, l === 3 && !e.fill ? T[1] : T[3], l === 3 ? 0.9 : 0.5);
        }
      p.glow(e.cx, e.cy, e.li === undefined ? 22 : 14, T[2], (l === 3 ? 0.16 : 0.07));
    }
  });

  // PICTURES: a lit plaque under the wordmark, between two short rules
  const pw = 8 * 5 + 7 * 3, pl = -Math.floor(pw / 2), pt = 5;
  const pc = picsL === 3 ? hex("#f4efe2") : picsL === 2 ? hex("#a8a294") : picsL === 1 ? hex("#4e4a42") : hex("#24222a");
  let x = pl;
  for (const ch of "PICTURES") {
    const g = FONTS.big.glyphs[ch];
    for (let r = 0; r < 7; r++) for (let c = 0; c < g.w; c++) if (g.rows[r][c]) p.dot(x + c, pt + r, pc, scene);
    x += g.w + 3;
  }
  const rc = picsL === 3 ? C[3] : picsL ? C[1] : hex("#24222a");
  p.line(-79, pt + 3, pl - 5, pt + 3, rc, scene);
  p.line(pl + pw + 4, pt + 3, 77, pt + 3, rc, scene);
  if (picsL === 3) p.glow(0, pt + 3, 34, hex("#f4efe2"), 0.08);

  // marquee bulbs: they light in a run from the bottom middle round both sides, then chase in threes
  for (const b of BULBS) {
    let on = false, hot = false;
    if (t > BULB0 && t < OFF) {
      const run = seg(t, BULB0, BULB1);
      if (b.u <= run) {
        if (t < BULB1 + 0.1) on = true, (hot = b.u > run - 0.08);
        else on = ((b.i + Math.floor((t - BULB1) * 10)) % 3) !== 0;
      }
    }
    if (on) {
      p.px(b.x, b.y, hot ? WHITE : C[5]);
      p.px(b.x - 1, b.y, C[2]);
      p.px(b.x + 1, b.y, C[2]);
      p.px(b.x, b.y - 1, C[3]);
      p.px(b.x, b.y + 1, C[1]);
      p.light(b.x, b.y, C[4], 0.45);
      p.glow(b.x, b.y, 5, C[3], 0.12);
    } else {
      p.dot(b.x, b.y, hex("#5a4426"), scene);
      p.dot(b.x - 1, b.y, hex("#2a2016"), scene);
      p.dot(b.x + 1, b.y, hex("#2a2016"), scene);
    }
  }

  reflection(p, t, hw, scene);
}

// The wet ground mirrors the sign: each ground row reads a band of the sign upside down and squashed (the row just
// under the horizon sees the sign's bottom edge, the last row its top), blurs it sideways into a soft smear, and
// ripples it: rows slide side to side and a drifting noise breaks the smear into streaks. Dim, stepped, no letters.
const REF_ROWS = 59 - GROUND, SQUASH = 3.7, SRC = new Float32Array(400 * 4), ROW = new Float32Array(400 * 4);
function reflection(p, t, hw, scene) {
  const W = Math.round(hw * 2), X0 = -Math.round(hw);
  for (let j = 1; j <= REF_ROWS; j++) {
    const f = j / REF_ROWS, sy = BY1 - 1 - (j - 1) * SQUASH;
    const shift = Math.sin(t * 2.1 + j * 0.9) * (0.6 + f * 2) + Math.sin(t * 3.4 + j * 2.3) * 0.7;
    // average a band of source rows: colour weighted by how far above the dark board it is
    for (let i = 0; i < W; i++) {
      let r = 0, g = 0, b = 0, w = 0;
      for (let k = -2; k <= 2; k++) {
        const c = p.get(X0 + i + shift, sy + k);
        if (!c) continue;
        const v = Math.max(0, luma(c) - 0.14);
        r += red(c) * v; g += green(c) * v; b += blue(c) * v; w += v;
      }
      SRC[i * 4] = r; SRC[i * 4 + 1] = g; SRC[i * 4 + 2] = b; SRC[i * 4 + 3] = w;
    }
    // a sideways box blur, wider further down, so strokes melt into one smear per bright patch
    const rad = 2 + Math.round(f * 2);
    for (let i = 0; i < W; i++) {
      let r = 0, g = 0, b = 0, w = 0;
      for (let k = -rad; k <= rad; k++) {
        const q = i + k;
        if (q < 0 || q >= W) continue;
        r += SRC[q * 4]; g += SRC[q * 4 + 1]; b += SRC[q * 4 + 2]; w += SRC[q * 4 + 3];
      }
      ROW[i * 4] = r; ROW[i * 4 + 1] = g; ROW[i * 4 + 2] = b; ROW[i * 4 + 3] = w / (5 * (rad * 2 + 1));
    }
    const y = GROUND + j, dir = j % 2 ? 1 : -1;
    for (let i = 0; i < W; i++) {
      const w = ROW[i * 4 + 3];
      if (w < 0.01) continue;
      // ripples: streaks that break up and slide, more broken further from the sign
      const n = noise2((X0 + i) * 0.065 + dir * t * 0.6 + j * 5.3, j * 0.45 + t * 0.6, 17);
      const v = w * 2.4 * (1 - f * 0.55) * clamp(0.5 + n * 1.8 - f * 0.35);
      if (v < 0.08) continue;
      const tw = ROW[i * 4 + 3] * 5 * (rad * 2 + 1), c = rgb(ROW[i * 4] / tw, ROW[i * 4 + 1] / tw, ROW[i * 4 + 2] / tw);
      const lvl = v > 0.6 ? 0.62 : v > 0.36 ? 0.4 : v > 0.18 ? 0.24 : 0.12;
      p.dot(X0 + i, y, mix(ASPHALT, c, lvl), scene);
      p.light(X0 + i, y, c, 0.1 * Math.min(1, v));
    }
  }
}
