// Made for the GoodWatch stats page: The "Deadpan Snarker" trope chip: a speech bubble with nothing to say.
import { fit } from "../../core/index.js";

export const meta = {
  name: "Trope: Deadpan Snarker",
  desc: "A flat speech bubble pops up over the chip, three dots appear one at a time with no bounce, lie down as a flat line that smirks, then the bubble deflates to a line and blinks out.",
  tags: ["stats-page", "trope", "speech", "bubble", "one-shot"],
  size: [80, 32],
  origin: [12, 22],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#101624", "#232b3c", "#3c4558", "#7e8798", "#c4cad6", "#f2f4f8"],
    w: 58,
    h: 9,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.7 };

const BX = 3, BW = 17, BH = 8; // the bubble: left edge, width, full height; its bottom edge sits on y = -4
const OPEN = [0, 0.035, 0.07], DOTS = [0.34, 0.64, 0.94], FLAT = 1.52, SMIRK = 1.8, SHRINK = [2.0, 2.04, 2.08, 2.12];
const BLINK = [[2.12, 2.2], [2.26, 2.32]]; // the last line is on during these

/** The bubble's mask at height h (from its base up), with a tail down-left to the chip when tall enough. */
function mask(h) {
  const m = new Set(), y1 = -4, y0 = y1 - h + 1;
  for (let y = y0; y <= y1; y++)
    for (let x = BX; x < BX + BW; x++) {
      const corner = h > 2 && (x === BX || x === BX + BW - 1) && (y === y0 || y === y1);
      if (!corner) m.add(`${x},${y}`);
    }
  if (h >= 6) for (const [x, y] of [[5, -3], [6, -3], [7, -3], [4, -2], [5, -2], [4, -1]]) m.add(`${x},${y}`);
  return { m, y0, y1 };
}

/** Fill the mask, outline it crisply where a pixel has an empty neighbour. */
function bubble(p, h, C) {
  const { m, y0, y1 } = mask(h);
  for (const k of m) {
    const [x, y] = k.split(",").map(Number);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !m.has(`${x + dx},${y + dy}`));
    p.px(x, y, edge ? C[4] : C[1]);
  }
  return { y0, y1, cy: Math.round((y0 + y1) / 2) };
}

/** A 2x2 dot, flat colour, no glint: deadpan. */
function dot(p, x, y, c) {
  p.px(x, y, c);
  p.px(x + 1, y, c);
  p.px(x, y + 1, c);
  p.px(x + 1, y + 1, c);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6);
  const dx0 = BX + Math.round((BW - 10) / 2); // three 2 px dots, 2 px apart, centred

  if (o.tease) {
    // one dot just above the chip, on, off, on, gone: a cursor that thought better of it
    if (t >= tease.duration) return;
    const on = (t > 0.1 && t < 0.3) || (t > 0.42 && t < 0.56);
    if (on) dot(p, 6, -3, C[5]);
    return;
  }
  if (t >= meta.duration) return;

  // the bubble opens in three hard steps from its base (a line, half, full), no overshoot
  const opening = OPEN.filter((s) => t >= s).length;
  const shrinking = SHRINK.filter((s) => t >= s).length;
  let h = [0, 1, 4, BH][opening];
  if (shrinking) h = [BH, 5, 3, 1, 1][shrinking];
  if (h === 0) return;
  if (shrinking >= 4 && !BLINK.some(([a, b]) => t >= a && t < b)) return;
  const { cy } = bubble(p, h, C);
  if (h < BH) return;

  if (t < FLAT) {
    // the dots arrive one at a time, at full brightness on their first frame: nothing eases
    DOTS.forEach((s, i) => {
      if (t >= s) dot(p, dx0 + i * 4, cy - 1, C[5]);
    });
  } else {
    // the punchline: the dots give up and lie down as a flat line, and a beat later its end ticks up: a smirk
    const smirk = t >= SMIRK;
    for (let x = dx0; x < dx0 + 10; x++) p.px(x, smirk && x >= dx0 + 8 ? cy - 1 : cy, C[5]);
  }
}
