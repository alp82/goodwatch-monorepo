// Made for the GoodWatch stats page: The "Downer Ending" trope chip: a little flower wilts on its edge.
import { fit, seg, clamp, ease, lerp, mix, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope: Downer Ending",
  desc: "A little daisy springs up on the chip's right end and stands bright, then its stem arches, the head droops and its colour drains to grey; two petals fall, then it fades.",
  tags: ["stats-page", "trope", "flower", "wilt", "sad", "one-shot"],
  size: [80, 36],
  origin: [12, 24],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#3a0f22", "#8a2a4c", "#d65a82", "#f08aa8", "#ffc4d4", "#fff0f4"],
    stem: ["#0e2a16", "#1f5a2c", "#3f9a4a", "#7ad06a"],
    eye: ["#6a3c08", "#e0a020", "#ffe066"],
    grey: ["#1c2130", "#343b4c", "#575f70", "#7f8796", "#a6adb8", "#c8cdd4"],
    w: 53,
    h: 9,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.9 };

const STEM = 9, UP0 = 0.04, UP1 = 0.24, BLOOM = 0.21;
const SAG0 = 0.92, SAG1 = 1.14, GIVE0 = 1.36, GIVE1 = 1.86;
const DRAIN = [1.04, 1.32, 1.62], OUT0 = 2.3, OUT1 = 2.62;
// the two petals that let go: when, and which way they drift
const FALLS = [{ t: 1.56, drift: -3 }, { t: 1.94, drift: 2 }];

// head sprites (4 wide): P petal, p petal shade, h petal highlight, Y eye, y eye shade. [rows, ox, oy] with (ox, oy)
// the cell that sits on the stem's tip direction 2 px out.
const FRONT = [[".hP.", "hYYP", "PYyp", ".Pp."], 2, 2];
const TILT = [[".hP.", "hYYP", ".PYyp", "..pp"], 2, 2];
const SIDE = [["Ph..", "PYY.", "PyY.", "pp.."], 1, 2];
const HANG = [[".yY.", "hPPp", "P.pp"], 2, 0];
const HEADS = [FRONT, TILT, SIDE, HANG];

/** How bent the stem is at t: a first sag, a small fight back up, then it gives up for good. */
function bendAt(t) {
  const sag = 0.38 * ease.inOutSine(seg(t, SAG0, SAG1));
  const fight = -0.12 * Math.sin(Math.PI * seg(t, SAG1, GIVE0));
  const give = 0.62 * ease.inOutSine(seg(t, GIVE0, GIVE1));
  const sway = Math.sin((t - UP1) * 8) * 0.05 * seg(t, UP1, UP1 + 0.15) * (1 - seg(t, SAG0 - 0.1, SAG0));
  return clamp(sag + fight + give + sway, -0.1, 1);
}

/** The stem from its base up: the lower part stays straight, the top three px arch over to the left as it bends. */
function stemPts(bx, len, bend) {
  const pts = [];
  let x = bx, y = -1, a = 0;
  for (let i = 0; i < len; i++) {
    pts.push([x, y]);
    a = -bend * 2.3 * seg(((i + 1) / len) * STEM, STEM - 4, STEM) ** 1.3;
    x += Math.sin(a);
    y -= Math.cos(a);
  }
  return { pts, tip: [x, y], a };
}

/** The colours drained towards grey: step 0 vivid, 3 grey, hard steps. */
function drained(r, G, step) {
  if (step <= 0) return r;
  const k = [0, 0.45, 0.78, 1][Math.min(3, step)];
  return r.map((c, i) => mix(c, G[Math.round((i * (G.length - 1)) / Math.max(1, r.length - 1))], k));
}

/** Everything resolved for one moment: ramps after drain and fade. */
function ramps(o, step, fade) {
  const G = fit(o.grey, 6);
  const dim = (r) => (fade <= 0 ? r : r.map((_, i) => r[Math.max(0, i - (fade < 0.5 ? 1 : 2))]));
  return {
    C: dim(drained(fit(o.palette, 6), G, step)),
    S: dim(drained(fit(o.stem, 4), G, step)),
    E: dim(drained(fit(o.eye, 3), G, step)),
  };
}

function flower(p, t, o, bend, R, white, lost) {
  const w = Math.max(16, o.w ?? 53), bx = w - 7;
  const grow = ease.outCubic(seg(t, UP0, UP1));
  const len = Math.max(1, Math.round(STEM * grow));
  const { pts, tip, a } = stemPts(bx, len, bend);
  const { C, S, E } = R;
  // stem, then a leaf two px up that flops as the flower wilts
  let prev = null;
  for (const [x, y] of pts) {
    const X = Math.round(x), Y = Math.round(y);
    if (prev && Math.abs(prev[0] - X) > 1) p.px((prev[0] + X) >> 1, Y, S[1]);
    p.px(X, Y, white ? WHITE : S[2]);
    prev = [X, Y];
  }
  if (len >= 4) {
    const fl = bend > 0.55 ? 1 : 0;
    p.px(bx + 1, -3, fl ? S[2] : S[3]);
    p.px(bx + 2, -4 + fl * 2, fl ? S[1] : S[2]);
  }
  if (grow < 0.75) return null;
  // the head: front on while upright, turning to face down as the stem arches over
  const turn = -a;
  const [rows, ox, oy] = HEADS[turn < 0.55 ? 0 : turn < 1.25 ? 1 : turn < 1.9 ? 2 : 3];
  const hx = Math.round(tip[0] + Math.sin(a) * 1.5) - ox, hy = Math.round(tip[1] - Math.cos(a) * 1.5) - oy;
  const pal = { P: C[3], p: C[2], h: C[4], Y: E[2], y: E[1] };
  rows.forEach((row, r) =>
    [...row].forEach((ch, q) => {
      if (ch === "." || (lost >= 1 && ch === "h") || (lost >= 2 && ch === "p" && q === row.lastIndexOf("p"))) return;
      p.px(hx + q, hy + r, white ? WHITE : pal[ch]);
    }),
  );
  return [hx + ox, hy + oy];
}

/** A falling petal: a 2 px chip rocking side to side, landing on the chip's edge, lying there, then gone. */
function petal(p, t, f, x0, y0, C, end) {
  const age = t - f.t, FALL = 0.62;
  if (age < 0 || t >= end) return;
  const u = clamp(age / FALL);
  const rock = Math.sin(age * 12);
  const x = x0 + f.drift * ease.outSine(u) + rock * 1.2 * (1 - u), y = lerp(y0, -1, u * u * 0.5 + u * 0.5);
  const X = Math.round(x), Y = Math.round(y);
  if (u >= 1) {
    // lying flat, cooling a step after a beat
    const c = t > end - 0.3 ? C[1] : C[2];
    p.px(X, -1, c);
    p.px(X + 1, -1, t > end - 0.3 ? C[0] : C[3]);
    return;
  }
  p.px(X, Y, C[3]);
  if (rock > 0) p.px(X + 1, Y, C[4]);
  else p.px(X, Y - 1, C[2]);
}

export function draw(p, t, o) {
  if (o.tease) {
    if (t >= tease.duration) return;
    // springs up, nods once (a small droop and back), then sinks back into the edge
    const nod = 0.4 * Math.sin(Math.PI * seg(t, 0.3, 0.6));
    const sinkT = seg(t, 0.66, 0.86);
    if (sinkT >= 1) return;
    const tt = sinkT > 0 ? UP1 * (1 - ease.inQuad(sinkT)) : t;
    flower(p, tt, o, nod, ramps(o, 0, 0), t > BLOOM && t < BLOOM + 0.05, 0);
    return;
  }
  if (t >= meta.duration) return;
  const bend = bendAt(t), step = DRAIN.filter((d) => t >= d).length, fade = seg(t, OUT0, OUT1);
  const lost = FALLS.filter((f) => t >= f.t).length;
  if (fade < 1) flower(p, t, o, bend, ramps(o, step, fade), t > BLOOM && t < BLOOM + 0.05, lost);
  // the bloom: a tiny white glint at the head's top right while it's bright
  const w = Math.max(16, o.w ?? 53), C = fit(o.palette, 6), G = fit(o.grey, 6);
  const gl = t - BLOOM - 0.06;
  if (gl > 0 && gl < 0.24) {
    const { tip } = stemPts(w - 7, STEM, bendAt(t));
    const gx = Math.round(tip[0]) + 3, gy = Math.round(tip[1]) - 4, big = gl < 0.12;
    p.px(gx, gy, WHITE);
    if (big) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(gx + dx, gy + dy, C[4]);
  }
  // the fallen petals: the first still a little pink, the second already grey
  FALLS.forEach((f, i) => {
    const { tip, a } = stemPts(w - 7, STEM, bendAt(f.t));
    const x0 = Math.round(tip[0] + Math.sin(a) * 2) - 1 + i * 2, y0 = Math.round(tip[1] - Math.cos(a) * 2) + 1;
    petal(p, t, f, x0, y0, drained(C, G, i === 0 ? 1 : 3), OUT1 + 0.12);
  });
}
