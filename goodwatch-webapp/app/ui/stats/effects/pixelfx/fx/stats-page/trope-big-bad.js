// Made for the GoodWatch stats page: The "Big Bad" trope chip has a hooded figure looming behind it.
// Anchor (0, 0) is the chip's top-left corner; o.w, o.h are the chip's size in effect px.
import { fit, seg, ease, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope: Big Bad",
  desc: "A hooded figure rimmed in red surges up behind the chip and hangs there breathing, red eyes kindle in the hood's dark, blink, and it sinks slowly away.",
  tags: ["stats-page", "trope", "villain", "silhouette", "one-shot"],
  size: [56, 32],
  origin: [10, 24],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#05070c", "#2a0810", "#6a1018", "#b01c22", "#ff3a2c", "#ffb08a", "#ffffff"],
    w: 36,
    h: 9,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.9 };

// x body, o the hood's dark opening (part of the shape, never rimmed); eyes on row 6
const HOOD = [
  ".........xx.........",
  ".......xxxxxx.......",
  "......xxxxxxxx......",
  ".....xxxxxxxxxx.....",
  ".....xxxooooxxx.....",
  "....xxxooooooxxx....",
  "....xxxooooooxxx....",
  "....xxxxooooxxxx....",
  "...xxxxxxooxxxxxx...",
  "..xxxxxxxxxxxxxxxx..",
  ".xxxxxxxxxxxxxxxxxx.",
  "xxxxxxxxxxxxxxxxxxxx",
  "xxxxxxxxxxxxxxxxxxxx",
];
const HW = HOOD[0].length, HH = HOOD.length, EYE_ROW = 6, EYES = [[7, 8], [12, 11]];
const at = (i, j) => (i >= 0 && j >= 0 && i < HW && j < HH ? HOOD[j][i] : ".");
const inside = (i, j) => at(i, j) !== ".";

function eyes(p, C, X, Y, k, hot) {
  if (k <= 0) return;
  for (const [outer, inner] of EYES) {
    p.px(X + inner, Y, hot ? WHITE : k < 0.6 ? C[3] : C[5]);
    p.px(X + outer, Y, hot ? WHITE : k < 0.6 ? C[2] : C[4]);
    p.light(X + inner, Y, C[4], 0.45 * k);
  }
  p.glow(X + HW / 2, Y, 6, C[3], (hot ? 0.45 : 0.2) * k);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), w = Math.max(HW, o.w);
  const X = Math.round(w / 2 - HW / 2);

  if (o.tease) {
    if (t >= tease.duration) return;
    const k = t < 0.1 ? t / 0.1 : t < 0.38 ? 1 : t < 0.45 ? 0 : t < 0.7 ? 1 : 1 - seg(t, 0.7, 0.82);
    eyes(p, C, X, -2, k, false);
    return;
  }
  if (t >= meta.duration) return;

  // surges up fast and overshoots, hangs breathing, sinks slowly
  const up = ease.outBack(seg(t, 0.05, 0.4), 1.4) * (1 - ease.inOutSine(seg(t, 1.9, 2.55)));
  const breathe = t > 0.5 && t < 1.9 ? Math.round(Math.sin((t - 0.5) * 4.5) * 0.6) : 0;
  const rise = HH * up + breathe;
  if (rise < 0.5) return;
  const Y = -Math.round(rise), shown = (j) => Y + j < 0;
  const live = seg(t, 0.05, 0.5) * (1 - seg(t, 1.9, 2.4));

  // red light spilling along the chip's top edge from behind it
  for (let x = X - 2; x < X + HW + 2; x++) {
    const d = Math.abs(x - X - HW / 2 + 0.5) / (HW / 2 + 2);
    p.blend(x, -1, C[3], 0.5 * live * (1 - d * d));
  }
  p.glow(X + HW / 2, -1, 14, C[2], 0.22 * live);

  // eyes kindle in the dark of the hood, blink, and fade before it goes
  const k = t < 0.55 ? 0 : t < 0.8 ? seg(t, 0.55, 0.8) : t < 1.45 ? 1 : t < 1.52 ? 0 : t < 1.85 ? 1 : 1 - seg(t, 1.85, 2.05);

  for (let j = -1; j <= HH; j++)
    for (let i = -1; i <= HW; i++) {
      if (!shown(j)) continue;
      if (!inside(i, j)) {
        // a 1 px halo of dim red just outside the contour
        if (inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1)) p.blend(X + i, Y + j, C[2], 0.35 * live);
        continue;
      }
      const ch = at(i, j);
      if (ch === "o") { p.px(X + i, Y + j, C[0]); continue; }
      // rim light from behind: the outer contour red, brighter on top; the hood's inner edge catches the eyes' light
      const out = at(i - 1, j) === "." || at(i + 1, j) === "." || at(i, j - 1) === ".";
      const intoHood = at(i - 1, j) === "o" || at(i + 1, j) === "o" || at(i, j + 1) === "o";
      const c = out ? (at(i, j - 1) === "." ? C[3] : C[2]) : intoHood ? (k > 0.6 && j >= EYE_ROW - 1 && j <= EYE_ROW + 1 ? C[2] : C[1]) : C[0];
      p.px(X + i, Y + j, c);
    }

  if (shown(EYE_ROW)) eyes(p, C, X, Y + EYE_ROW, k, t >= 0.8 && t < 0.86);
}
