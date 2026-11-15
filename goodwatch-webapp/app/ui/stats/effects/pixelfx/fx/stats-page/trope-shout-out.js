// Made for the GoodWatch stats page: The "Shout-Out" trope chip gets a megaphone that blares.
import { fit, seg, clamp, lerp, ease, bump, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope shout-out",
  desc: "An amber megaphone pops up behind the chip's top-right corner and blares three times, kicking back as sound rings pulse from its bell, a note and a star flick off, then it ducks.",
  tags: ["stats-page", "trope", "megaphone", "shout", "one-shot"],
  size: [84, 48],
  origin: [6, 34],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#221004", "#5a2e08", "#a65c10", "#e69a22", "#ffd25a", "#fff2c8"],
    w: 61,
    h: 15,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.8 };

const ANG = -0.3; // the megaphone points up and to the right
const UC = 6.5; // the pivot sits this far along the axis
const BELL = 13.4;
const BLASTS = [0.34, 0.72, 1.1];

/** The megaphone's part at (u, v) in its own frame (u along the axis to the bell, v across, + is down): 0 = empty. */
function part(u, v) {
  const a = Math.abs(v);
  // the bell seen a little from the front: a cream oval rim round a dark mouth
  const ru = (u - 12) / 1.6, rv = v / 5.7;
  if (ru * ru + rv * rv <= 1) {
    const iu = (u - 12.4) / 0.9, iv = v / 4.1;
    return iu * iu + iv * iv <= 1 ? 8 : v < -3 ? 7 : 6;
  }
  if (u >= 0.6 && u < 2.6 && a <= 1.5) return a > 0.8 && u < 1.4 ? 3 : 1; // mouthpiece
  if (u >= 2.6 && u < 12) {
    const e = 1.4 + 4.2 * Math.pow((u - 2.6) / 9.4, 1.5); // a horn that flares toward the bell
    if (a <= e) return v < -e + 1.3 ? 5 : v > e - 1.3 ? 3 : 2; // cone: lit top rim, body, shaded belly
  }
  if (u >= 4.8 && u < 6.6 && v > 1 && v <= 5.6) return 4; // handle
  return 0;
}

/** Draws the megaphone with its pivot at (px, py), clipped above y = clipY (it rises from behind the chip). */
function megaphone(p, C, px, py, kick, flash, clipY, a) {
  const ca = Math.cos(ANG), sa = Math.sin(ANG);
  const x0 = Math.floor(px - 10), x1 = Math.ceil(px + 10), y0 = Math.floor(py - 10), y1 = Math.ceil(py + 10);
  const W = x1 - x0 + 1, H = y1 - y0 + 1, grid = new Uint8Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const dx = x0 + i + 0.5 - px, dy = y0 + j + 0.5 - py;
      const u = dx * ca + dy * sa + UC + kick, v = -dx * sa + dy * ca;
      if (y0 + j < clipY) grid[j * W + i] = part(u, v);
    }
  const at = (i, j) => (i >= 0 && j >= 0 && i < W && j < H ? grid[j * W + i] : 0);
  for (let j = -1; j <= H; j++)
    for (let i = -1; i <= W; i++) {
      const k = at(i, j), y = y0 + j;
      if (y >= clipY) continue;
      if (!k) {
        if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) p.dot(x0 + i, y, C[0], a);
        continue;
      }
      const c = flash && (k === 6 || k === 7) ? WHITE : k === 1 ? C[2] : k === 2 ? C[3] : k === 3 ? C[2] : k === 4 ? C[1] : k === 5 ? C[4] : k === 6 ? C[4] : k === 7 ? C[5] : C[1];
      p.dot(x0 + i, y, c, a);
    }
}

/** A clean 1 px band of a sound ring round (cx, cy) facing ANG, radius r, opening +/- span; drawn per pixel so it never doubles up. */
function arc(p, cx, cy, r, span, c, a = 1) {
  const R = Math.ceil(r + 1);
  for (let y = Math.floor(cy - R); y <= cy + R; y++)
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (Math.abs(d - r) > 0.5) continue;
      let th = Math.atan2(dy, dx) - ANG;
      if (Math.abs(th) > span) continue;
      p.dot(x, y, c, a);
    }
}

const NOTE = ["..o.", "..oo", "..o.", "ooo.", "oo.."];

export function draw(p, t, o) {
  const C = fit(o.palette, 6), w = o.w ?? 61;
  const teasing = !!o.tease;
  const D = teasing ? tease.duration : meta.duration;
  if (t >= D) return;
  const ca = Math.cos(ANG), sa = Math.sin(ANG);
  const restX = w - 11, restY = -7;

  // how far it has risen (0 hidden behind the chip, 1 at rest), and the kick of each blast
  let rise, kick = 0, flash = false;
  if (teasing) rise = 0.55 * ease.outBack(seg(t, 0, 0.18)) * (1 - ease.inQuad(seg(t, 0.5, 0.72)));
  else rise = ease.outBack(seg(t, 0, 0.2), 2.2) * (1 - ease.inBack(seg(t, 1.66, 1.92), 1.4));
  if (!teasing)
    for (const b of BLASTS) {
      const g = t - b;
      if (g >= 0 && g < 0.2) kick = Math.max(kick, g < 0.05 ? 1.6 : 1.6 * (1 - ease.outQuad((g - 0.05) / 0.15)));
      if (g >= 0 && g < 0.05) flash = true;
    }
  const px = restX, py = restY + (1 - rise) * 13;
  if (rise > 0.02) megaphone(p, C, px - ca * kick * 0.6, py - sa * kick * 0.6, 0, flash, 0, 1);

  // the bell's mouth in world space
  const bx = px + ca * (BELL - UC), by = py + sa * (BELL - UC);

  if (teasing) {
    // one faint ring slips out of the peeking bell
    const g = t - 0.22;
    if (g > 0 && g < 0.34) {
      const u = g / 0.34, r = 3 + 3 * ease.outQuad(u);
      const cx = px + ca * (12 - UC), cy = py + sa * (12 - UC);
      arc(p, cx, cy, r, 0.75, u < 0.3 ? C[5] : u < 0.65 ? C[4] : C[3]);
    }
    return;
  }

  // sound arcs: each blast throws three nested rings out of the bell one after another, white at birth, each pushing
  // out a little as it cools down the ramp and goes
  const cx = px + ca * (12 - UC), cy = py + sa * (12 - UC);
  BLASTS.forEach((b, bi) => {
    for (let k = 0; k < 3; k++) {
      const g = t - b - k * 0.045, L = 0.36 - k * 0.03;
      if (g < 0 || g > L) continue;
      const u = g / L, r = 3 + k * 3 + 1.2 * ease.outQuad(u);
      const c = u < 0.16 ? WHITE : u < 0.42 ? C[5] : u < 0.72 ? C[4] : C[3];
      arc(p, cx, cy, r, 0.8 + k * 0.08, c);
    }
    const g = t - b;
    if (g >= 0 && g < 0.06) p.glow(bx + ca * 2, by + sa * 2, 8, C[4], 0.3);
  });

  // a note flicks up off the second blast and a star off the third; both cool down the ramp and wink out, no dither
  {
    const g = t - BLASTS[1] - 0.05, L = 0.7;
    if (g > 0 && g < L) {
      const u = g / L;
      const nx = Math.round(bx - 4 + Math.sin(u * 7) * 1.2 - u * 2), ny = Math.round(by - 7 - ease.outCubic(u) * 8);
      const c = u < 0.12 ? WHITE : u < 0.6 ? C[5] : u < 0.85 ? C[4] : C[3];
      const on = (r, q) => r >= 0 && r < 5 && q >= 0 && q < 4 && NOTE[r][q] === "o";
      for (let r = -1; r <= 5; r++)
        for (let q = -1; q <= 4; q++)
          if (!on(r, q) && (on(r - 1, q) || on(r + 1, q) || on(r, q - 1) || on(r, q + 1))) p.px(nx + q, ny + r, C[0]);
      p.sprite(NOTE, { o: "#ffffff" }, nx, ny, { tint: c });
    }
  }
  {
    const g = t - BLASTS[2] - 0.08, L = 0.5;
    if (g > 0 && g < L) {
      const u = g / L, sx = Math.round(bx + 3), sy = Math.round(by - 9 - u * 3);
      const arm = u < 0.15 ? 1 : u < 0.55 ? 2 : u < 0.8 ? 1 : 0;
      const c = u < 0.25 ? WHITE : C[5];
      p.px(sx, sy, WHITE);
      for (let k = 1; k <= arm; k++) {
        p.px(sx + k, sy, k === 2 ? C[4] : c);
        p.px(sx - k, sy, k === 2 ? C[4] : c);
        p.px(sx, sy + k, k === 2 ? C[4] : c);
        p.px(sx, sy - k, k === 2 ? C[4] : c);
      }
      p.light(sx, sy, C[4], 0.25 * (1 - u));
    }
  }
}
