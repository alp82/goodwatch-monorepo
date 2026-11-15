// Made for the GoodWatch stats page: The "Oh, Crap!" trope chip gets a fright.
// Anchor (0, 0) is the chip's top-left corner; o.w, o.h are the chip's size in effect px.
import { fit, seg, ease, lerp, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope: Oh, Crap!",
  desc: "The chip jolts with shake marks, an amber ! springs out from behind its top edge, lands with three ticks, a blue sweat drop slides down its side, then the ! ducks away.",
  tags: ["stats-page", "trope", "surprise", "sweat", "one-shot"],
  size: [64, 40],
  origin: [10, 24],
  duration: 1.45,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    drop: ["#0c1a3a", "#1f4a8a", "#3a86d8", "#7cc0ff", "#d4ecff"],
    w: 40,
    h: 9,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.7 };

// the mark in its own units, foot at v = 0, center at u = 0: a 2 x 2 dot, a 1 px gap, a 6 row bar 4 wide tapering to 2
function inMark(u, v, sy) {
  const a = Math.abs(u);
  if (v < -3) v = -3 + (v + 3) / sy; // squash and stretch the bar only, so the dot and its gap always read
  if (v >= -2 && v < 0) return a <= 1;
  if (v >= -9 && v < -3) {
    if (v < -8) return a <= 1; // rounded top
    if (v < -5) return a <= 2;
    return a <= 1;
  }
  return false;
}

/** The mark's foot (y, rows above the chip are negative) and its squash at t, for the full effect. */
function pose(t) {
  if (t < 0.05) return { y: 10, sx: 1, sy: 1 };
  if (t < 0.17) { // springs up out of the chip, stretched
    const u = (t - 0.05) / 0.12;
    return { y: lerp(10, -7, ease.outQuad(u)), sx: 0.75, sy: 1.35 };
  }
  if (t < 0.27) { // drops onto its spot
    const u = (t - 0.17) / 0.1;
    return { y: lerp(-7, -2, ease.inQuad(u)), sx: 0.9, sy: 1.1 };
  }
  if (t < 0.35) return { y: -2, sx: 1, sy: 0.83 }; // squash on landing: the bar loses a row
  if (t < 1.1) { // a little wobble, then still
    const u = t - 0.35;
    return { y: -2 - Math.round(Math.sin(u * 16) * Math.exp(-u * 7) * 1.4), sx: 1, sy: 1 };
  }
  // ducks away: a tiny rise, then down behind the chip's edge
  const u = seg(t, 1.1, 1.32);
  return { y: u < 0.25 ? -3 : lerp(-3, 12, ease.inQuad((u - 0.25) / 0.75)), sx: 1, sy: u < 0.25 ? 1 : 1.15 };
}

/** The teaser: only the bar's tip pops above the edge, wiggles, and ducks back. */
function teasePose(t) {
  if (t < 0.06) return { y: 10, sx: 1, sy: 1 };
  if (t < 0.18) return { y: lerp(10, 4, ease.outBack(seg(t, 0.06, 0.18), 2.4)), sx: 0.9, sy: 1.15 };
  if (t < 0.44) return { y: 4 + (Math.round((t - 0.18) * 20) % 2 ? 0 : -1), sx: 1, sy: 1 };
  return { y: lerp(4, 12, ease.inQuad(seg(t, 0.44, 0.58))), sx: 1, sy: 1.1 };
}

function drawMark(p, C, cx, m, flash) {
  if (m.y > 11) return;
  const W = 12, H = 18, ox = cx - 6, oy = Math.round(m.y) - 16;
  const data = new Uint8Array(W * H);
  let top = -1;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const x = ox + i + 0.5, y = oy + j + 0.5;
      if (inMark((x - cx) / m.sx, y - m.y, m.sy)) {
        data[j * W + i] = 1;
        if (top < 0) top = j;
      }
    }
  const at = (i, j) => i >= 0 && j >= 0 && i < W && j < H && data[j * W + i];
  // everything below the chip's top edge is hidden behind the chip
  const shown = (j) => oy + j < 0;
  for (let j = -1; j <= H; j++)
    for (let i = -1; i <= W; i++)
      if (shown(j) && !at(i, j) && (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1))) p.px(ox + i, oy + j, C[1]);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (!at(i, j) || !shown(j)) continue;
      let c;
      if (flash) c = WHITE;
      else if (!at(i - 1, j) || j === top) c = C[6];
      else if (!at(i + 1, j) || !at(i, j + 1)) c = C[3];
      else if (!at(i, j - 1)) c = C[6];
      else c = C[5];
      p.px(ox + i, oy + j, c);
    }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), D = fit(o.drop, 5), w = Math.max(12, o.w), h = Math.max(5, o.h);
  const cx = w - 9; // the mark stands over the chip's right end, its dot on the edge

  if (o.tease) {
    if (t >= tease.duration) return;
    drawMark(p, C, cx, teasePose(t), t > 0.12 && t < 0.15);
    return;
  }
  if (t >= meta.duration) return;

  // the jolt: the chip jumps, told by shake marks either side and a quick light on its top edge
  const jt = seg(t, 0, 0.32);
  if (jt > 0 && jt < 1) {
    const j = Math.floor(t * 30) % 2 ? 1 : 0, c = jt < 0.25 ? WHITE : jt < 0.6 ? C[5] : C[3];
    for (const [x0, dir] of [[-2, -1], [w + 1, 1]]) {
      const x = x0 + dir * j;
      for (let y = 2; y <= h - 3; y++) p.px(x, y, c);
      if (jt < 0.6) for (let y = 3; y <= h - 4; y++) p.px(x + dir * 2, y, C[3]);
    }
    // the top edge jumps: for two frames a lit copy of it shows one pixel higher
    if (t > 0.02 && t < 0.09) for (let x = 2; x < w - 2; x++) p.px(x, -1, x % 5 ? C[6] : WHITE);
  }

  const m = pose(t);
  const land = t >= 0.27 && t < 0.31;
  if (m.y < 11) {
    const up = Math.min(1, Math.max(0, (6 - m.y) / 8)); // how much of it shows above the edge
    p.glow(cx, Math.min(-2, m.y - 5), 9, C[4], (land ? 0.45 : 0.18) * up);
    drawMark(p, C, cx, m, t < 0.09 || land);
  }

  // three crisp ticks flicking out above the mark as it lands, stepping out a pixel a frame and cooling
  const tk = t - 0.28;
  if (tk >= 0 && tk < 0.27) {
    const s = Math.min(3, Math.floor(tk / 0.06)), c = s === 0 ? WHITE : s === 1 ? C[6] : s === 2 ? C[5] : C[3];
    const ty = -13; // just above the bar's top
    // left and right ticks are 2 px diagonals, the middle one 2 px straight up
    p.px(cx - 4 - s, ty + 1 - s, c); p.px(cx - 5 - s, ty - s, c);
    p.px(cx + 3 + s, ty + 1 - s, c); p.px(cx + 4 + s, ty - s, c);
    p.px(cx - 0.5, ty - 1 - s, c); p.px(cx - 0.5, ty - 2 - s, c);
    p.px(cx + 0.5, ty - 1 - s, c); p.px(cx + 0.5, ty - 2 - s, c);
  }

  // the sweat drop: beads at the chip's top-right corner, slides down its side, hangs, lets go
  const ds = t - 0.4;
  if (ds > 0 && ds < 0.88) {
    const x = w + 1;
    let y, sq = 1, a = 1;
    if (ds < 0.08) (y = -3), (sq = ease.outBack(ds / 0.08));
    else if (ds < 0.55) y = lerp(-3, h - 4, ease.inOutQuad((ds - 0.08) / 0.47));
    else if (ds < 0.7) y = h - 4 + (ds > 0.62 ? 1 : 0);
    else {
      const f = ds - 0.7;
      y = h - 3 + 160 * f * f;
      a = 1 - seg(ds, 0.76, 0.88);
    }
    const X = Math.round(x) - 1, Y = Math.round(y);
    const rows = sq < 0.7 ? ["", "", ".b.", ".c."] : ds > 0.62 && ds < 0.7 ? [".a.", ".a.", "abb", "bbc", "dcd"] : [".a.", "abb", "bbc", "dcd"];
    const col = { a: D[4], b: D[3], c: D[2], d: D[1] };
    // a faint wet streak where it slid
    if (ds > 0.1 && ds < 0.85) for (let yy = -1; yy < Math.min(Y, h - 1); yy++) p.blend(w, yy, D[2], 0.35 * (1 - seg(ds, 0.55, 0.85)));
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (col[ch]) p.dot(X + i, Y + j, col[ch], a); }));
    if (ds > 0.25 && ds < 0.33) p.px(X + 1, Y + 1, WHITE), p.light(X + 1, Y + 1, D[4], 0.5);
    p.glow(X + 1, Y + 2, 3, D[3], 0.15 * a);
  }
}
