// Made for the GoodWatch footer cinema: the pre-show "please silence your phone" slide.
// A plain pixel smartphone buzzes in two bursts, its screen glowing with a bell and notification waves rippling off
// both sides; the little mute switch flips, the bell gets its slash, the waves die out and the glow settles to a
// small moon. PLEASE SILENCE YOUR PHONE, then ENJOY THE SHOW.
import { seg, ease, clamp, rand, hex, lerp, fit, FONTS, WHITE } from "../../core/index.js";

export const meta = {
  name: "Silence your phone",
  desc: "A pixel phone buzzes, glowing, notification waves rippling off it; the mute switch flips, the bell gets a slash, the glow dies down. PLEASE SILENCE YOUR PHONE, ENJOY THE SHOW.",
  tags: ["cinema-show", "screen", "slide", "phone", "text", "one-shot"],
  size: [288, 120],
  origin: [144, 60],
  duration: 5,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { w: 288, h: 120, seed: 1, palette: ["#2e1a04", "#7a4a0a", "#c4820e", "#fbbf24", "#ffe9a0", "#fff6d6"] },
};

// two buzz bursts, the flip, the slash, the calm; the first message, the swap, the second, the fade
const BUZZ = [[0.35, 1.0], [1.25, 1.9]], FLIP = 2.1, SLASH = 2.22, CALM0 = 2.6, CALM1 = 3.3;
const TXT1 = 0.45, SWAP = 3.15, TXT2 = 3.3, OUT0 = 4.6, OUT1 = 4.95;
// the phone: 19 x 33, top-left at (PX, PY)
const PX = -10, PY = -41, PW = 19, PH = 33;
const BODY = hex("#1d1b24"), RIM = hex("#4c4858"), RIM_DK = hex("#100f15"), CREAM = hex("#f4efe2"), INK = hex("#06060a");
// screen light from dark to hot
const SCR = ["#0e1220", "#15223c", "#1f3a66", "#2f5e9c", "#5b93d4", "#a9d0ff"].map(hex);
const BELL = [
  "...#...",
  "..###..",
  ".#####.",
  ".#####.",
  ".#####.",
  "#######",
  "...#...",
];
const MOON = [
  "..##.",
  ".##..",
  "##...",
  "##...",
  "##...",
  ".##..",
  "..##.",
];

const buzzing = (t) => BUZZ.some(([a, b]) => t > a && t < b);

// text that arrives letter by letter, each with a white flash, a drop shadow under it
function reveal(p, str, y, k, c, t0, t, a) {
  const F = FONTS.big, w = textW(str) * k;
  let x = -Math.round(w / 2), i = 0;
  for (const ch of str) {
    const g = F.glyphs[ch];
    if (!g) {
      x += (F.space + F.gap) * k;
      continue;
    }
    const born = t - (t0 + i * 0.025);
    i++;
    if (born > 0) {
      const col = born < 0.06 ? WHITE : c, lift = born < 0.12 ? 1 : 0;
      for (let r = 0; r < 7; r++)
        for (let q = 0; q < g.w; q++) {
          if (!g.rows[r][q]) continue;
          p.rect(x + q * k + 1, y + r * k + 1 - lift, k, k, INK, a);
          p.rect(x + q * k, y + r * k - lift, k, k, col, a * clamp(born / 0.08));
        }
    }
    x += (g.w + F.gap) * k;
  }
}
function textW(str) {
  const F = FONTS.big;
  let w = 0;
  for (const ch of str) w += (F.glyphs[ch] ? F.glyphs[ch].w : F.space) + F.gap;
  return w - F.gap;
}

export function draw(p, t, o) {
  if (t >= meta.duration - 0.02) return;
  const C = fit(o.palette, 6), seed = o.seed;
  const fade = seg(t, 0, 0.25) * (1 - seg(t, OUT0, OUT1));
  if (fade <= 0) return;
  const frame = Math.floor(t * 30);

  // the screen's light: up while it rings, a flare on each buzz, calming down after the mute to a dim glow
  const ring = buzzing(t), calm = ease.inOutSine(seg(t, CALM0, CALM1));
  const scrLv = t < CALM0 ? (ring ? 4 : 3) : Math.round(lerp(3, 1, calm));
  const lit = (t < CALM0 ? (ring ? 1 : 0.7) : lerp(0.7, 0.12, calm)) * seg(t, 0.15, 0.4) * fade;
  const jx = ring ? (frame % 2 ? 1 : -1) * (rand(seed, frame) < 0.8 ? 1 : 0) : 0;
  const x0 = PX + jx;

  // light thrown off the phone onto the dark
  p.glow(0, PY + PH / 2, 46, SCR[4], 0.14 * lit);
  p.glow(0, PY + PH / 2, 20, SCR[5], 0.12 * lit);

  // notification waves: arcs that ripple off both sides while it rings
  if (t < SLASH + 0.45) {
    for (let side = -1; side <= 1; side += 2)
      for (let k = 0; k < 3; k++) {
        const ph = ((t * 1.6 + k / 3) % 1), r = 6 + ph * 18, a = (1 - ph) * (ring ? 1 : 0.4) * (1 - seg(t, SLASH, SLASH + 0.45));
        if (a < 0.08) continue;
        const cx = side < 0 ? x0 + 3 : x0 + PW - 3, cy = PY + PH / 2;
        const a0 = side > 0 ? -0.75 : Math.PI - 0.75;
        const c = a > 0.66 ? C[4] : a > 0.4 ? C[3] : a > 0.2 ? C[2] : C[1];
        p.arc(cx, cy, r + 9, 1.2, a0, a0 + 1.5, c, fade);
        p.glowRing(cx, cy, r + 8.5, 2, C[3], 0.06 * a * fade);
      }
  }
  // buzz ticks at the corners
  if (ring && frame % 4 < 2)
    for (const [dx, dy, ex, ey] of [[-3, 3, -5, 2], [-3, PH - 4, -5, PH - 3], [PW + 2, 3, PW + 4, 2], [PW + 2, PH - 4, PW + 4, PH - 3]])
      p.line(x0 + dx, PY + dy, x0 + ex, PY + ey, C[3], fade);

  // the phone: body with a lit rim, a dark right side, the screen, speaker slot and the side switch
  p.rect(x0 + 1, PY, PW - 2, PH, BODY, fade);
  p.rect(x0, PY + 1, PW, PH - 2, BODY, fade);
  p.line(x0 + 1, PY, x0 + PW - 2, PY, RIM, fade);
  p.line(x0, PY + 1, x0, PY + PH - 2, RIM, fade);
  p.line(x0 + PW - 1, PY + 1, x0 + PW - 1, PY + PH - 2, RIM_DK, fade);
  p.line(x0 + 1, PY + PH - 1, x0 + PW - 2, PY + PH - 1, RIM_DK, fade);
  p.line(x0 + 6, PY + 2, x0 + 10, PY + 2, RIM_DK, fade);
  // the screen: a stepped glow, brightest at its middle
  const sx0 = x0 + 2, sy0 = PY + 4, sw = PW - 4, sh = PH - 8;
  p.shade(sx0, sy0, sx0 + sw - 1, sy0 + sh - 1, (x, y) => {
    const d = Math.hypot((x - (sx0 + sw / 2)) / sw, (y - (sy0 + sh / 2)) / sh);
    return SCR[clamp(scrLv - (d > 0.45 ? 2 : d > 0.3 ? 1 : 0), 0, 5)];
  });
  if (scrLv >= 1) p.glow(sx0 + sw / 2, sy0 + sh / 2, 10, SCR[4], 0.1 * lit);
  // what's on the screen: the bell (swinging while it rings), its slash, then a little moon
  const bx = sx0 + 4, by = sy0 + 9;
  if (t < CALM0 + 0.3) {
    const swing = ring ? (frame % 4 < 2 ? 1 : 0) : 0;
    const ba = t < CALM0 ? 1 : 1 - seg(t, CALM0, CALM0 + 0.3);
    p.sprite(BELL, { "#": WHITE }, bx + swing - (ring ? 0 : 0), by, { a: ba * fade });
    p.dot(bx + 3, by + 8, WHITE, ba * fade);
    const sl = seg(t, SLASH, SLASH + 0.12);
    if (sl > 0) {
      // the slash draws corner to corner across the bell, amber with a dark edge so it reads on white
      const n = Math.round(sl * 12);
      for (let i = 0; i <= n; i++) {
        p.dot(bx - 2 + i * 0.9, by - 2 + i, SCR[0], ba * fade);
        p.dot(bx - 1 + i * 0.9, by - 2 + i, C[3], ba * fade);
        p.dot(bx + i * 0.9, by - 2 + i, C[4], ba * fade);
        p.dot(bx + 1 + i * 0.9, by - 2 + i, SCR[0], ba * fade);
      }
      if (sl < 1) p.glow(bx - 1 + n * 0.9, by - 2 + n, 6, C[4], 0.4);
    }
  } else {
    const ma = seg(t, CALM0 + 0.3, CALM0 + 0.6) * fade;
    p.sprite(MOON, { "#": C[4] }, bx + 2, by, { a: ma });
    p.glow(bx + 2, by + 3, 5, C[3], 0.12 * ma);
  }
  // the mute switch on the left edge: up, then it clicks down and shows amber
  const flipped = t >= FLIP;
  const swy = PY + 6 + (flipped ? 2 : 0);
  p.rect(x0 - 1, PY + 5, 1, 6, RIM_DK, fade);
  p.rect(x0 - 2, swy, 2, 2, flipped ? C[3] : RIM, fade);
  if (flipped) p.light(x0 - 2, swy, C[3], 0.4 * fade);
  const click = seg(t, FLIP, FLIP + 0.25);
  if (click > 0 && click < 1) {
    const g = 1 - click, n = Math.round(1 + 3 * g);
    for (let d = 2; d <= n + 1; d++) {
      p.px(x0 - 2 - d, swy, C[4]);
      p.px(x0 - 2 - d * 0.7, swy - d * 0.7, C[3]);
      p.px(x0 - 2 - d * 0.7, swy + 1 + d * 0.7, C[3]);
    }
    p.glow(x0 - 3, swy + 1, 8, C[4], 0.4 * g);
  }

  // the words
  const a1 = 1 - seg(t, SWAP - 0.1, SWAP + 0.05);
  if (a1 > 0) {
    reveal(p, "PLEASE SILENCE", 2, 2, CREAM, TXT1, t, a1 * fade);
    reveal(p, "YOUR PHONE", 21, 2, CREAM, TXT1 + 0.4, t, a1 * fade);
  }
  if (t > TXT2) {
    reveal(p, "ENJOY THE SHOW", 11, 2, C[3], TXT2, t, fade);
    p.glow(0, 18, 70, C[2], 0.1 * seg(t, TXT2, TXT2 + 0.5) * fade);
    const g = seg(t, TXT2 + 0.7, TXT2 + 1.1);
    if (g > 0 && g < 1) {
      const k = Math.sin(g * Math.PI), n = Math.round(4 * k), gx = 76, gy = 10;
      for (let d = 1; d <= n; d++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(gx + dx * d, gy + dy * d, d === n ? C[3] : C[5]);
      p.px(gx, gy, WHITE);
      p.glow(gx, gy, 10, C[4], 0.35 * k);
    }
  }
}
