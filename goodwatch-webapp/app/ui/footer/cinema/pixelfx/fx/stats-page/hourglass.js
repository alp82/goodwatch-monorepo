// Made for the GoodWatch stats page: An hourglass flips and its sand runs, for the catalog's runtime.
import { fit, hex, seg, clamp, ease, lerp, rand, sparkle, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Hourglass",
  desc: "A small hourglass pops in with a glint, flips with a hop and a little overshoot, sand runs in a thin grainy stream onto a growing heap, grains spill from the base, then it fades.",
  tags: ["stats-page", "time", "hourglass", "sand", "one-shot"],
  size: [40, 48],
  origin: [20, 24],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2a1606", "#5a3410", "#93591c", "#c98a32", "#f0c060", "#fff0c0"],
    sand: ["#6a4210", "#b07a24", "#e2b04a", "#ffe08a", "#fff6d0"],
    glass: ["#2b3a52", "#7f9cc4", "#d8ecff"],
    seed: 1,
    tease: 0,
  },
};

export const tease = { duration: 0.8 };

const FLIP0 = 0.3, FLIP1 = 0.62, RUN0 = 0.68, RUN1 = 1.85, OUT0 = 2.04;

/** Glass half-width at row y (bulbs from y = -6 to 5, the neck at y = -0.5). */
const half = (y) => {
  const d = Math.abs(y + 0.5) / 5.5;
  return 0.6 + 3.3 * Math.pow(clamp(d), 0.65) - (d > 0.9 ? (d - 0.9) * 9 : 0);
};

function nest(p, x, y, ang, fn) {
  const { tx, ty, fx, cs, sn } = p;
  p.place(p.toX(x, y), p.toY(x, y), fx < 0, Math.atan2(sn, cs) + ang * fx);
  fn();
  p.tx = tx; p.ty = ty; p.fx = fx; p.cs = cs; p.sn = sn;
}

/** The hourglass in its own frame: caps, posts, glass, and the sand given as two fill functions. */
function body(p, C, Sd, G, white, a, sandTop, sandBot) {
  const dot = (x, y, c) => p.dot(x, y, white ? WHITE : c, a);
  // sand first, inside the glass
  for (let y = -6; y <= 5; y++) {
    const w = Math.floor(half(y));
    for (let x = -w; x <= w; x++) {
      const s = y < 0 ? sandTop(x, y) : sandBot(x, y);
      if (s) dot(x, y, s);
    }
  }
  // the glass: a lit left rim, a dim right one, a faint fill
  for (let y = -6; y <= 5; y++) {
    const w = Math.floor(half(y)) + 1;
    dot(-w, y, G[2]);
    dot(w, y, G[1]);
    if (!white) for (let x = -w + 1; x < w; x++) p.blend(x, y, G[0], 0.18 * a);
  }
  p.dot(-2, -4, white ? WHITE : G[2], a); // a gleam on the upper bulb
  // caps: two rows each, lit along the top
  for (let x = -5; x <= 5; x++) {
    const end = Math.abs(x) === 5;
    dot(x, -8, end ? C[2] : C[4]); dot(x, -7, end ? C[1] : C[2]);
    dot(x, 6, end ? C[2] : C[3]); dot(x, 7, end ? C[0] : C[1]);
  }
  dot(-4, -8, C[5]);
  // little turned feet under the bottom cap and knobs on the top one
  dot(-4, 8, C[1]); dot(4, 8, C[0]); dot(-4, -9, C[2]); dot(4, -9, C[1]);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6).map(hex), Sd = fit(o.sand, 5).map(hex), G = fit(o.glass, 3).map(hex), S = o.seed;
  if (o.tease) return teaser(p, t, C, Sd, G);
  if (t >= meta.duration) return;
  const g = seg(t, FLIP0, FLIP1);
  const ang = Math.PI * ease.outBack(g, 1.1);
  const hop = -3.5 * Math.sin(Math.PI * g);
  const a = 1 - seg(t, OUT0, meta.duration - 0.03);
  const white = t < 0.04;
  const f = seg(t, RUN0, RUN1); // how much has run through

  // warm pool of light, brighter while the sand runs
  p.glow(0, hop, 14, C[3], (0.12 + 0.14 * (f > 0 && f < 1 ? 1 : 0)) * a * seg(t, 0, 0.1));

  if (t < FLIP1) {
    // before and during the flip all the sand lies in the (local) bottom bulb, rigid
    const full = (x, y) => (y < 1 ? 0 : y === 1 ? Sd[3] : (x * 7 + y * 3) % 5 === 0 ? Sd[1] : Sd[2]);
    nest(p, 0, hop, ang, () => body(p, C, Sd, G, white, a, () => 0, full));
  } else {
    // after the flip: in screen space, the top bulb drains and the bottom heap grows
    running(p, C, Sd, G, a, f, t);
  }

  // the glint as it pops in, on the top cap's corner
  const gl = 1 - Math.abs(t - 0.17) / 0.11;
  if (gl > 0) sparkle(p, 5, -10, 3 * gl, Sd[4], WHITE, 0.25 * gl);

  // the landing thump after the flip: two soft puffs of sandy dust at the base
  const d = seg(t, FLIP1 - 0.02, FLIP1 + 0.45);
  if (d > 0 && d < 1) {
    for (const s of [-1, 1]) {
      p.disc(s * (5 + d * 6), 7 - d * 2, 1.2 + d * 2.4, (q) => (q < 0.5 ? Sd[3] : Sd[2]), (q) => 0.45 * (1 - d) * (1 - q * q));
      p.dot(s * (7 + d * 9), 7 - Math.sin(d * Math.PI) * 3, Sd[3], 1 - d);
    }
  }

  // grains spilling out of the base while it runs, hopping out and falling away
  for (let i = 0; i < 7; i++) {
    const born = RUN0 + 0.1 + i * 0.16 + rand(S, i, 1) * 0.08, age = t - born, L = 0.4;
    if (age < 0 || age > L) continue;
    const s = rand(S, i, 2) < 0.5 ? -1 : 1, vx = s * (10 + rand(S, i, 3) * 14), vy = -18 - rand(S, i, 4) * 14;
    const x = s * 6 + vx * age, y = 7 + vy * age + 160 * age * age;
    p.dot(x, y, i % 2 ? Sd[3] : Sd[4], (1 - age / L) * a);
  }
}

/** The upright hourglass with `f` (0..1) of its sand run through: the top drains, a thread runs, the heap grows. */
function running(p, C, Sd, G, a, f, t, white = false) {
  const level = lerp(-6, 0, f); // the top surface, sinking
  const top = (x, y) => {
    if (f >= 1) return 0;
    const crater = (1 - Math.abs(x) / 4) * 1.6 * Math.min(1, f * 4);
    if (y < level + crater) return 0;
    return y < level + crater + 1 ? Sd[3] : (x * 7 + y * 3) % 5 === 0 ? Sd[1] : Sd[2];
  };
  const h = 0.6 + 4.6 * f; // heap peak height above the bottom
  const bot = (x, y) => {
    const surf = 5.6 - h + Math.abs(x) * 0.9;
    if (f <= 0 || y < surf) return 0;
    return y < surf + 1 ? Sd[3] : (x * 5 + y) % 4 === 0 ? Sd[1] : Sd[2];
  };
  body(p, C, Sd, G, white, a, top, bot);
  // the stream: a 1 px thread with grains running down it
  if (f > 0 && f < 1 && !white) {
    const y1 = Math.floor(5.6 - h);
    for (let y = 0; y <= y1; y++) {
      const bright = (y - Math.floor(t * 40)) % 3 === 0;
      p.dot(0, y, bright ? Sd[4] : Sd[3], a);
    }
    p.light(0, y1, Sd[3], 0.35 * a);
    // a grain bouncing off the heap now and then
    const k = (t * 5) % 1, s = Math.floor(t * 5) % 2 ? 1 : -1;
    if (k < 0.6) p.dot(s * (1 + k * 2.5), y1 - Math.sin(k / 0.6 * Math.PI) * 1.5, Sd[4], a);
  }
}

/** The teaser: the hourglass pops in upright on a white frame, a few grains run, it winks and goes. */
function teaser(p, t, C, Sd, G) {
  const D = tease.duration;
  if (t >= D) return;
  const a = 1 - ease.inQuad(seg(t, 0.56, D - 0.03));
  const f = 0.14 * seg(t, 0.14, 0.6);
  p.glow(0, 0, 12, C[3], 0.14 * a * seg(t, 0, 0.1));
  // it thins out with true translucency rather than the full effect's dither, so the short teaser ends clean
  const q = Object.create(p);
  q.dot = (x, y, c, k = 1) => p.blend(x, y, c, k);
  running(q, C, Sd, G, a, f, t, t < 0.04);
  const gl = 1 - Math.abs(t - 0.4) / 0.1;
  if (gl > 0) sparkle(p, 5, -10, 2 * gl, Sd[4], WHITE, 0.2 * gl);
}
