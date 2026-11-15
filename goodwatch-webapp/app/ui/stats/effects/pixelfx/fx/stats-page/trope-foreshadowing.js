// Made for the GoodWatch stats page: "Foreshadowing": a looming shadow on the wall before anyone arrives.
import { fit, seg, clamp, lerp, ease, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope foreshadowing",
  desc: "A footlight warms along the chip's top edge and a hard black shadow of a hooded figure rises up the wall, swells, lifts a dagger, holds a beat, then shrinks back down.",
  tags: ["stats-page", "trope", "shadow", "foreshadowing", "one-shot"],
  size: [84, 48],
  origin: [10, 40],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#05070c", "#0b0f18", "#3a2a1c", "#a8662a", "#f0b060", "#fff0c8"],
    w: 63,
    h: 12,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.8 };

// the figure's shadow, feet at the bottom row: a hood with its face to the left, hunched shoulders, a cloak that
// widens as it nears the light, and an arm raised with a dagger. LOW is the arm still down, RAISED the threat.
const RAISED = [
  ".............#....",
  ".............#....",
  ".............##...",
  ".............##...",
  ".............##...",
  "............####..",
  "............###...",
  ".....###....###...",
  "....#####...##....",
  "...######..###....",
  "..#######..###....",
  ".########..##.....",
  "..#######.###.....",
  "...######.##......",
  "....#########.....",
  "..############....",
  ".##############...",
  ".##############...",
  "################..",
  "################..",
  "################..",
  "#################.",
  "#################.",
  "#################.",
  "##################",
  "##################",
  "##################",
];
const LOW = [
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  ".....###..........",
  "....#####.........",
  "...######....#....",
  "..#######....##...",
  ".########....##...",
  "..#######...####..",
  "...######...###...",
  "....#######.##....",
  "..############....",
  ".##############...",
  ".##############...",
  "################..",
  "################..",
  "################..",
  "#################.",
  "#################.",
  "#################.",
  "##################",
  "##################",
  "##################",
];
const FW = 18, FH = RAISED.length;

const ON = 0.12, RISE1 = 0.75, LIFT = 0.95, HOLD1 = 1.45, SINK1 = 1.75, OFF = 1.95;

/** Is (x, y) inside the shadow drawn with its feet centered at (cx, 0), scaled by s (height FH * s)? */
function inFigure(rows, x, y, cx, s, sx, dy = 0) {
  if (s <= 0) return false;
  const q = Math.floor((x - cx) / (s * sx) + FW / 2), r = Math.floor(FH + (y - dy) / s);
  return r >= 0 && r < FH && q >= 0 && q < FW && rows[r][q] === "#";
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), w = o.w ?? 63;
  const teasing = !!o.tease;
  const D = teasing ? tease.duration : meta.duration;
  if (t >= D) return;
  const cx = Math.round(w * 0.62);

  // the footlight's strength and the shadow's scale
  let lit, s, rows = LOW, sx = 1, dy = 0, H = 26;
  if (teasing) {
    lit = 0.5 * seg(t, 0, 0.15) * (1 - seg(t, 0.55, 0.75));
    // the full-size shadow stays sunk below the edge: only the hood's crown and the knuckles slide up past it, then back
    s = 0.9;
    const peek = 7 * ease.outCubic(seg(t, 0.1, 0.36)) * (1 - ease.inCubic(seg(t, 0.44, 0.68)));
    dy = FH * s - 6 * s - peek;
    H = 12;
  } else {
    lit = seg(t, 0, ON) * (1 - seg(t, SINK1, OFF));
    const up = ease.outCubic(seg(t, ON, RISE1));
    const down = ease.inCubic(seg(t, HOLD1, SINK1));
    const lunge = 0.1 * ease.outBack(seg(t, LIFT, LIFT + 0.12), 3) * (1 - seg(t, HOLD1 - 0.1, HOLD1));
    s = (lerp(0.18, 1, up) + lunge) * (1 - down) + 0.02 * Math.sin(t * 9) * up * (1 - down);
    if (t < ON + 0.02) s = 0;
    rows = t >= LIFT && t < HOLD1 + 0.08 ? RAISED : LOW;
    sx = 1 + 0.25 * (1 - up); // squat and wide while it is far, it grows tall as it nears
  }
  if (lit <= 0 && s <= 0) return;

  // the light it throws up the wall: three hard bands, brightest at the edge, flaring as the shadow looms
  const flick = !teasing && t > LIFT && t < LIFT + 0.05 ? 1.5 : 1;
  const half0 = 7;
  if (lit > 0)
    for (let y = -H; y < 0; y++) {
      const d = -y, half = half0 + d * 0.36;
      const band = d < 5 ? 0.22 : d < 12 ? 0.13 : d < 19 ? 0.07 : 0.03;
      for (let x = Math.floor(cx - half); x <= cx + half; x++) {
        if (inFigure(rows, x + 0.5, y + 0.5, cx, s, sx, dy)) continue;
        p.light(x, y, d < 12 ? C[4] : C[3], band * lit * flick * (Math.abs(x - cx) > half - 1 ? 0.5 : 1));
      }
    }

  // the shadow: hard-edged, nearly black, a hair of warm rim on the side the light catches
  if (s > 0)
    for (let y = -Math.ceil(FH * s) - 1; y < 0; y++)
      for (let x = Math.floor(cx - FW * s * sx); x <= cx + FW * s * sx; x++) {
        if (!inFigure(rows, x + 0.5, y + 0.5, cx, s, sx, dy)) continue;
        p.blend(x, y, C[0], 0.88);
      }

  // the footlight itself: a short warm strip on the chip's top edge with a hot middle
  if (lit > 0) {
    for (let x = cx - half0; x <= cx + half0; x++) {
      const m = Math.abs(x - cx);
      p.blend(x, 0, m < 2 || (flick > 1 && m < 5) ? (flick > 1 ? WHITE : C[5]) : m < 5 ? C[4] : C[3], lit * (m < 5 ? 1 : 0.7));
    }
    p.glow(cx, 0, 10, C[4], 0.25 * lit);
  }
}
