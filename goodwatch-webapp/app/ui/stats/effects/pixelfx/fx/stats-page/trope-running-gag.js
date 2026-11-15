// Made for the GoodWatch stats page: The "Running Gag" trope chip: a little runner keeps running past.
import { fit, seg, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope: Running Gag",
  desc: "A little bean runner dashes along the chip's top edge and is gone, then again, then a third time faster, trips flat on its face in a puff, gets up and zips off.",
  tags: ["stats-page", "trope", "runner", "gag", "one-shot"],
  size: [80, 32],
  origin: [16, 22],
  duration: 2.7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2a1208", "#7a3412", "#d06a24", "#f4a040", "#ffd890", "#ffffff"],
    dust: ["#3a3446", "#6a6278", "#a49cb2", "#dcd6e6"],
    eye: "#1a1020",
    w: 47,
    h: 9,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.85 };

// sprites, facing right, bottom row on y = -1: l lit, m body, b shade, e eye, f leg
const BODY = [".llm.", "lmmem", "mmmmb", ".mbb."];
// stride, pass (body up 1, knee tucked), stride, pass; each with where the swinging arm px is (or none)
const LEGS = [["f..f."], [".ff..", "..f.."], [".f..f"], ["..ff.", "..f.."]];
const ARMS = [[5, 2], null, [-1, 2], null];
const TRIP = ["..llm.", ".lmmem", "..mmmb", "f..bb.", ".f...."];
const FLAT = ["f......", ".f.....", "..llmm.", ".mmmmmb"];
const DAZE = [".llm.", "lmmbm", "mmmmb", ".mbb.", "f..f."]; // getting up, eye shut

// the passes: [start, end, x from, x to]; the third is cut short by the trip
const PASSES = [[0.06, 0.66, -5, 0], [0.78, 1.3, -5, 0], [1.4, 1.62, -5, 1]]; // last: 1 = ends where it trips
const TRIP_T = 1.62, LAND = 1.72, UP = 2.04, ZIP0 = 2.2, ZIP1 = 2.38;

function paint(p, rows, x, y, pal, flip = false) {
  const W = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, r) =>
    [...row].forEach((ch, q) => {
      if (ch !== ".") p.px(x + (flip ? W - 1 - q : q), y + r, pal[ch]);
    }),
  );
}

/** The runner mid-stride at (x, feet on y = -1), frame index from distance travelled. */
function runner(p, x, step, pal, white) {
  const legs = LEGS[step & 3], arm = ARMS[step & 3], X = Math.round(x), top = -legs.length - 4;
  const P = white ? { l: WHITE, m: WHITE, b: WHITE, e: WHITE, f: WHITE } : pal;
  paint(p, BODY, X, top, P);
  paint(p, legs, X, -legs.length, P);
  if (arm) p.px(X + arm[0], top + arm[1], white ? WHITE : pal.b);
}

/** A dust puff kicked back from a foot: a speck that rises a px and steps down the dust ramp. */
function puff(p, x, y, age, D, L = 0.24) {
  if (age < 0 || age > L) return;
  const k = age / L;
  p.px(Math.round(x - k * 2), Math.round(y - k * 1.5), k < 0.3 ? D[3] : k < 0.65 ? D[2] : D[1]);
}

/** A poof where the runner vanishes: four specks flying out, gone in a quarter second. */
function poof(p, x, y, age, D) {
  if (age < 0 || age > 0.26) return;
  const k = age / 0.26, r = 1 + k * 3;
  const c = k < 0.25 ? D[3] : k < 0.6 ? D[2] : D[1];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0.6, -0.8], [-0.6, -0.8], [0, -1]]) p.px(Math.round(x + dx * r), Math.round(y + dy * r), c);
  if (k < 0.15) p.px(Math.round(x), Math.round(y), WHITE);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), D = fit(o.dust, 4), w = Math.max(16, o.w ?? 47);
  const pal = { l: C[4], m: C[3], b: C[2], e: fit([o.eye], 1)[0], f: C[1] };

  if (o.tease) {
    // the head peeks up over the chip's right end, glances along it, blinks, and ducks back down (it hides behind the chip)
    if (t >= tease.duration) return;
    const rise = Math.min(seg(t, 0.08, 0.2), 1 - seg(t, 0.62, 0.72));
    const show = Math.round(rise * 3); // just the top of the head and its eye
    if (show <= 0) return;
    const x = w - 7, blink = t > 0.42 && t < 0.48;
    const rows = BODY.map((r, j) => (j === 1 ? (blink ? "lmmmm" : t > 0.3 ? "lemmm" : "lmmem") : r));
    // only the rows above the chip's top edge show, as if it hides behind the chip
    paint(p, rows.slice(0, show), x, -show, pal);
    return;
  }
  if (t >= meta.duration) return;

  // the passes: constant speed along the edge, dust kicked back on each footfall
  const tripX = Math.round(w * 0.45);
  const passes = PASSES.map(([t0, t1, x0, frac]) => [t0, t1, x0, frac ? tripX : w + 2]);
  passes.forEach(([t0, t1, x0, x1], i) => {
    const fast = i === 2, stride = fast ? 4 : 3, v = (x1 - x0) / (t1 - t0);
    for (let fx = x0 + 3; fx <= x1 - 2; fx += stride * 4) puff(p, fx, -1, t - (t0 + (fx - x0) / v), D, fast ? 0.16 : 0.2);
    if (t < t0 || t >= t1) return;
    const x = x0 + v * (t - t0);
    // a white frame as it pops in at the left
    runner(p, x, Math.floor((x - x0) / stride), pal, t - t0 < 0.035);
    // speed lines behind the fast one
    if (fast) {
      p.px(Math.round(x) - 2, -4, D[2]);
      p.px(Math.round(x) - 3, -4, D[1]);
      p.px(Math.round(x) - 2, -6, D[1]);
    }
  });
  // vanishing off the right end, both full passes
  for (const [, t1] of PASSES.slice(0, 2)) poof(p, w + 3, -3, t - t1, D);

  // the trip: pitches forward, lands flat in a puff, lies a beat, gets up dazed, shakes, zips off
  const tx = tripX;
  if (t >= TRIP_T && t < LAND) paint(p, TRIP, Math.round(tx + 1), -5, pal);
  else if (t >= LAND && t < UP) {
    const bounce = t - LAND < 0.05 ? -1 : 0;
    paint(p, FLAT, Math.round(tx + 1), -4 + bounce, pal);
    // three little stars of daze circling over it
    if (t > LAND + 0.1) {
      const a = (t - LAND) * 9;
      for (let k = 0; k < 2; k++) {
        const ang = a + k * Math.PI;
        p.px(Math.round(tx + 5 + Math.cos(ang) * 3), Math.round(-7 + Math.sin(ang) * 1), k ? C[4] : C[5]);
      }
    }
  } else if (t >= UP && t < ZIP0) {
    const shake = Math.round(Math.sin((t - UP) * 60)) * (t - UP < 0.1 ? 1 : 0);
    paint(p, DAZE, Math.round(tx + 2 + shake), -5, pal);
  } else if (t >= ZIP0 && t < ZIP1) {
    // zips off: a stretched dash and lines
    const u = seg(t, ZIP0, ZIP1), x = tx + 2 + (w + 3 - tx - 2) * u * u;
    if (x < w + 2) {
      runner(p, x, Math.floor(x / 2), pal, false);
      for (let k = 2; k < 2 + Math.round(u * 6); k++) p.px(Math.round(x) - k, -4, k < 4 ? D[2] : D[1]);
    }
  }
  // the faceplant's dust cloud
  const pa = t - LAND;
  if (pa >= 0 && pa < 0.32) {
    const k = pa / 0.32, c = k < 0.3 ? D[3] : k < 0.65 ? D[2] : D[1];
    for (let j = 0; j < 4; j++) {
      const dx = (j < 2 ? -1 : 1) * (1 + k * (3 + j)), dy = -k * (j % 2 ? 2 : 1);
      p.px(Math.round(tx + 4 + dx), Math.round(-1 + dy), c);
    }
  }
  poof(p, w + 3, -3, t - ZIP1, D);
}
