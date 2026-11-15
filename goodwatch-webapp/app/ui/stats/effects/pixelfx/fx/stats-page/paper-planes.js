// Made for the GoodWatch stats page: Paper planes circling the "streaming everywhere" poster row.
import { fit, seg, clamp, lerp, ease, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Paper planes",
  desc: "Three crisp paper planes swing round the poster row on a smooth orbit with fading dotted trails, banking through eight drawn headings; one loops the loop, then all fly off.",
  tags: ["stats-page", "paper-plane", "travel", "world", "one-shot"],
  size: [230, 100],
  origin: [115, 50],
  duration: 3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    // outline, fold, shade, lit, white
    palette: ["#0a101e", "#4e5a76", "#8c99b6", "#dce4f2", "#ffffff"],
    w: 189,
    h: 54,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.9 };

// eight headings, each drawn by hand: o outline, w lit top wing, s shaded wing, f fold line, W the white nose.
// E, NE, N, SE, S are drawn; W, NW, SW mirror E, NE, SE (light still from above).
const SPR = {
  E: [".oo.....", "owwoo...", ".owwwoo.", ".offffWo", ".osssoo.", "ossoo...", ".oo....."],
  SE: ["....o..", "...owo.", "..ofwwo", ".ossfwo", "..oosfo", "....oWo", ".....oo"],
  S: [".o...o.", "owoooso", "owwfsso", ".owfso.", ".owfso.", "..ofo..", "..oWo..", "...o..."],
  W: [".....oo.", "...oowwo", ".oowwwo.", "oWffffo.", ".oossso.", "...oosso", ".....oo."],
  N: ["...o...", "..oWo..", "..ofo..", ".owfso.", ".owfso.", "owwfsso", "owoooso", ".o...o."],
  NE: [".....oo", "....oWo", "..oowfo", ".owwfso", "..ofsso", "...oso.", "....o.."],
};
// SW and NW mirror SE and NE (the lit wing is still the upper one)
const HEAD = [["E"], ["SE"], ["S"], ["SE", true], ["W"], ["NE", true], ["N"], ["NE"]].map(([k, fl]) => [SPR[k], !!fl]); // by sector: 0 = east, clockwise in screen space (y down)

/** The sprite for a direction of travel (vx, vy). */
function headingOf(vx, vy) {
  const a = Math.atan2(vy, vx);
  return HEAD[((Math.round(a / (TAU / 8)) % 8) + 8) % 8];
}

function plane(p, x, y, vx, vy, pal, a = 1) {
  const [rows, flip] = headingOf(vx, vy);
  p.sprite(rows, pal, Math.round(x) - 3, Math.round(y) - 3, { flip, a });
}

// the path of plane i at time t: an orbit round the row, spiralling in at the start and out at the end
const PLANES = [
  { th0: Math.PI * 0.95, dir: 1, t0: 0.0, loop: [1.05, 1.6], out: 2.42 },
  { th0: Math.PI * -0.2, dir: 1, t0: 0.18, out: 2.2 },
  { th0: Math.PI * 0.45, dir: 1, t0: 0.36, out: 2.35 },
];
const SPEED = 1.55;

/** Where plane P is at t: on its curve, then breaking away along its last heading, speeding up. */
function posAt(P, t, a, b) {
  if (t <= P.out) return pathAt(P, t, a, b);
  const [x0, y0] = pathAt(P, P.out, a, b), [x1, y1] = pathAt(P, P.out - 0.02, a, b);
  const vx = (x0 - x1) / 0.02, vy = (y0 - y1) / 0.02, u = t - P.out, k = 1 + 2.4 * u;
  return [x0 + vx * u * k, y0 + vy * u * k];
}

function pathAt(P, t, a, b) {
  const u = Math.max(0, t - P.t0);
  // time runs slower through the loop so it reads as a stunt, not a blur
  let warp = u;
  if (P.loop) {
    const l0 = P.loop[0] - P.t0, l1 = P.loop[1] - P.t0;
    if (u > l0) warp = l0 + Math.min(u, l1) - l0 - (Math.min(u, l1) - l0) * 0.75 + Math.max(0, u - l1);
  }
  const th = P.th0 + P.dir * SPEED * warp;
  const grow = 10 * (1 - ease.outCubic(seg(t, P.t0, P.t0 + 0.45))) 
  let x = (a + grow) * Math.cos(th), y = (b + grow * 0.4) * Math.sin(th);
  if (P.loop && t > P.loop[0] && t < P.loop[1]) {
    // a loop-the-loop: a full circle up and over, riding along the orbit
    const q = seg(t, P.loop[0], P.loop[1]), ph = ease.inOutSine(q) * TAU, R = 6;
    const tx = -Math.sin(th) * P.dir, ty = Math.cos(th) * P.dir; // the orbit's forward direction (roughly)
    const fl = Math.hypot(tx, ty) || 1, fx = tx / fl, fy = ty / fl;
    // it loops in over the row's edge (an outside loop), so the stunt stays close to the posters
    const ux = -Math.cos(th), uy = -Math.sin(th);
    x += fx * R * Math.sin(ph) + ux * R * (1 - Math.cos(ph));
    y += fy * R * Math.sin(ph) + uy * R * (1 - Math.cos(ph));
  }
  return [x, y];
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5), w = Math.max(40, o.w), h = Math.max(16, o.h);
  const pal = { o: C[0], f: C[1], s: C[2], w: C[3], W: C[4] };
  const a = w / 2 + 5, b = h / 2 + 5;

  if (o.tease) {
    // one plane crosses above the row once, with a short dotted trail
    if (t >= tease.duration) return;
    const pos = (tt) => {
      const u = clamp(tt / 0.85);
      return [lerp(-a - 4, a + 4, u), -b - 2 - Math.sin(u * Math.PI) * 4];
    };
    const al = seg(t, 0, 0.08) * (1 - seg(t, 0.78, 0.86));
    trail(p, pos, t, C, al, 7, 0, 0.022);
    const [x, y] = pos(t), [x2, y2] = pos(t + 0.02);
    if (al > 0) plane(p, x, y, x2 - x, y2 - y, pal, al);
    return;
  }
  if (t >= meta.duration) return;

  for (const P of PLANES) {
    if (t < P.t0) continue;
    const pos = (tt) => posAt(P, Math.max(P.t0, tt), a, b);
    const [cx, cy] = pos(t);
    // fades as it gets more than a few px past the row's edge
    const past = Math.max(Math.abs(cx) - (a + 3), Math.abs(cy) - (b + 3), 0);
    const al = seg(t, P.t0, P.t0 + 0.1) * (1 - seg(past, 2, 9));
    if (al <= 0) continue;
    trail(p, pos, t, C, al, 7, P.t0);
    const [x, y] = [cx, cy], [x2, y2] = pos(t + 0.016);
    plane(p, x, y, x2 - x, y2 - y, pal, al);
  }
}

/** A dotted trail: dots dropped behind, cooling through the ramp. */
function trail(p, pos, t, C, al, n, t0 = 0, step = 0.045) {
  for (let j = 1; j <= n; j++) {
    const tt = t - j * step;
    if (tt < t0 + 0.02) break;
    const [x, y] = pos(tt);
    const c = j <= 2 ? C[3] : j <= 4 ? C[2] : C[1];
    p.dot(x, y, c, al * (1 - (j - 1) / (n + 1) * 0.5));
  }
}
