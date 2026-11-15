// Made for the GoodWatch stats page: The show with the most episodes turns into an old TV for a moment.
import { fit, rand, seg, clamp, lerp, ease, bump, WHITE } from "../../core/index.js";

export const meta = {
  name: "TV static",
  desc: "The poster becomes an old CRT: dark rounded bezel, chunky gray static with a rolling bar, a channel-change roll, then it switches off to a line and a lingering dot.",
  tags: ["stats-page", "tv", "static", "crt", "one-shot"],
  size: [64, 84],
  origin: [18, 16],
  duration: 1.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#07090e", "#262c38", "#4e586a", "#8792a6", "#c6cfdc", "#ffffff"],
    glow: ["#2a4a7a", "#7ab0ec", "#d8ecff"],
    w: 27,
    h: 50,
    tease: 0,
    seed: 3,
  },
};

export const tease = { duration: 0.7 };

const ON = 0.08, JOLT = 0.78, OFF = 1.12, LINE = 1.24, DOT = 1.34, END = 1.72;

/** Chunky static: cells of cw x ch in four gray steps, re-rolled 15 times a second. */
function staticAt(S, frame, cx, cy) {
  const r = rand(S, frame, cx, cy);
  return r < 0.28 ? 1 : r < 0.6 ? 2 : r < 0.86 ? 3 : 4;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), G = fit(o.glow, 3), S = o.seed;
  const W = Math.max(12, Math.round(o.w)), H = Math.max(16, Math.round(o.h));
  const cw = W >= 24 ? 3 : 2, ch = 2;

  if (o.tease) {
    // one thin bar of static rolls down the poster, faint
    const D = tease.duration;
    if (t >= D) return;
    const u = ease.inOutSine(seg(t, 0.05, D - 0.08));
    const by = Math.round(lerp(-3, H + 1, u));
    const fr = Math.floor(t * 15);
    for (let y = by; y < by + 3; y++) {
      if (y < 1 || y >= H - 1) continue;
      const edge = y === by || y === by + 2;
      for (let x = 1; x < W - 1; x++) {
        const v = staticAt(S, fr, Math.floor(x / cw), Math.floor(y / ch));
        p.blend(x, y, C[edge ? Math.max(1, v - 1) : Math.min(5, v + 1)], edge ? 0.3 : 0.58);
      }
    }
    return;
  }
  if (t >= END) return;

  const cx = W / 2, cy = H / 2;
  // the channel change: a bright hero frame, then the vertical hold slips and the picture rolls one frame down
  // with a dark blanking bar passing through it, rows torn sideways
  const jr = seg(t, JOLT + 0.035, JOLT + 0.19);
  const jolt = jr > 0 && jr < 1;
  const hero = t >= JOLT && t < JOLT + 0.035;
  const rollY = jolt ? Math.round(ease.outQuad(jr) * H) : 0;
  const fr = Math.floor(t * 15) + (t >= JOLT ? 7 : 0);

  // how much static covers the poster: in fast, a clear moment where the poster shows through, thick again
  // before the jolt, thin after it
  let a = seg(t, 0, ON) * 0.62;
  a = lerp(a, 0.22, bump(t, 0.3, 0.62));
  if (t > JOLT) a = lerp(0.66, 0.3, seg(t, JOLT + 0.1, OFF));

  // the picture's extent: full screen, then it collapses to a line, then to a dot
  let top = 1, bot = H - 1, left = 1, right = W - 1;
  if (t >= OFF) {
    const v = ease.inCubic(seg(t, OFF, LINE));
    top = Math.round(lerp(1, cy - 0.5, v));
    bot = Math.round(lerp(H - 1, cy + 0.5, v));
    if (bot <= top) bot = top + 1;
    const hz = ease.inQuad(seg(t, LINE, DOT));
    left = Math.round(lerp(1, cx - 0.5, hz));
    right = Math.round(lerp(W - 1, cx + 0.5, hz));
    if (right <= left) right = left + 1;
  }

  // switched off: the dead glass goes dark around the shrinking picture, then clears with the bezel
  if (t >= OFF) {
    const dark = seg(t, OFF, OFF + 0.08) * (1 - seg(t, END - 0.22, END));
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) if (y < top || y >= bot || x < left || x >= right) p.blend(x, y, C[0], 0.72 * dark);
  }

  if (t < DOT) {
    const roll = seg(t, ON + 0.06, JOLT - 0.04); // the rolling bar's trip down the screen
    const barY = lerp(-6, H + 4, ease.inOutSine(roll));
    const collapsing = t >= OFF;
    const hot = collapsing ? seg(t, OFF, LINE) : 0; // the picture brightens as it squashes
    for (let y = top; y < bot; y++) {
      const ry = (((y - rollY) % H) + H) % H;
      const blank = jolt && Math.abs(ry - (H - 3)) < 2.5;
      const tear = jolt && (y + fr) % 7 === 0 ? 3 : 0;
      const bar = Math.abs(y - barY);
      for (let x = left; x < right; x++) {
        if (blank) { p.blend(x, y, C[0], 0.85); continue; }
        let v = staticAt(S, fr, Math.floor((x + tear) / cw), Math.floor((ry + 64) / ch));
        let al = a;
        if (bar < 2.5 && roll > 0 && roll < 1) { v = Math.min(5, v + (bar < 1.2 ? 2 : 1)); al = Math.max(al, bar < 1.2 ? 0.92 : 0.78); }
        if (y % 2 === 1) v = Math.max(1, v - 1); // scanlines
        if (collapsing) { v = Math.min(5, Math.round(v + hot * 3)); al = lerp(al, 1, hot); }
        if (hero) { v = y % 3 === 0 ? 5 : Math.min(5, v + 1); al = 0.92; }
        p.blend(x, y, C[v], al);
      }
    }
    if (roll > 0 && roll < 1 && barY > 1 && barY < H - 2) p.glowLine(1, barY, W - 1, barY, 3, G[1], 0.12);
    if (hero) p.glow(cx, cy, Math.max(W, H) * 0.5, G[2], 0.1);
    // the squashed picture becomes a hot white line with a halo
    if (collapsing && t >= LINE - 0.04) {
      p.line(left, cy, right - 1, cy, WHITE);
      p.glowLine(left, cy, right - 1, cy, 3, G[1], 0.45);
    }
  } else {
    // the last dot: white, lingers, cools through the glow ramp, shrinks to nothing
    const u = seg(t, DOT, END - 0.06);
    const c = u < 0.35 ? WHITE : u < 0.65 ? G[2] : u < 0.88 ? G[1] : G[0];
    const X = Math.floor(cx), Y = Math.floor(cy);
    p.px(X, Y, c);
    if (u < 0.3) { p.px(X - 1, Y, G[2]); p.px(X + 1, Y, G[2]); p.px(X, Y - 1, G[2]); p.px(X, Y + 1, G[2]); }
    p.glow(X + 0.5, Y + 0.5, lerp(6, 2, u), G[1], 0.5 * (1 - u));
  }

  // the CRT bezel: a dark 1 px rim on the poster's edge with rounded corners and a glint on the glass
  const bz = seg(t, 0, ON * 0.6) * (1 - seg(t, END - 0.14, END));
  if (bz > 0) {
    const ring = bz >= 1 ? 1 : bz;
    for (let x = 1; x < W - 1; x++) { p.blend(x, 0, C[0], ring); p.blend(x, H - 1, C[0], ring); }
    for (let y = 1; y < H - 1; y++) { p.blend(0, y, C[0], ring); p.blend(W - 1, y, C[0], ring); }
    for (const [x, y] of [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]]) p.blend(x, y, C[0], ring);
    if (t < OFF) {
      p.dot(2, 2, C[4], ring * 0.8);
      p.dot(3, 2, C[3], ring * 0.6);
      p.dot(2, 3, C[3], ring * 0.6);
    }
  }
}
