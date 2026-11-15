// Made for the GoodWatch stats page: A little storm cloud over the lowest-rated episode's poster.
import { fit, rand, seg, clamp, lerp, ease, WHITE } from "../../core/index.js";

export const meta = {
  name: "Storm cloud",
  desc: "A small outlined cartoon cloud puffs in over the poster's top edge, rains short streaks that splash on its bottom edge, flickers once with lightning, then drifts off and thins.",
  tags: ["stats-page", "weather", "rain", "cloud", "storm", "one-shot"],
  size: [56, 76],
  origin: [14, 14],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0e121a", "#2a3240", "#4a5466", "#76829a", "#b0bccc", "#e6ecf4"],
    rain: ["#24508e", "#4e8ad4", "#9ccaf8", "#ffffff"],
    bolt: ["#f0b020", "#ffe680", "#ffffff"],
    w: 27,
    h: 50,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.9 };

const IN = 0.24, RAIN0 = 0.32, RAIN1 = 1.5, BOLT = 0.98, DRIFT = 1.62, END = 2.34;
// lobes in a 16 px cloud: x, y from the cloud's center line, radius
const LOBES = [[-5.6, 0.2, 2.9], [-0.4, -1.4, 3.9], [5, -0.2, 3.1], [8.2, 1.4, 1.6], [-8.6, 1.4, 1.5]];

/**
 * The cloud at (cx, cy), lobe scale k, squash sx/sy, alpha a. flash > 0 lights it white from inside.
 * Built as a mask: flat bottom, 1 px dark outline, lit top rim, two body steps, a dark underside.
 */
function cloud(p, C, cx, cy, k, sx, sy, a, flash, lobes = LOBES) {
  if (k <= 0.05 || a <= 0) return;
  const inside = (x, y) => {
    const ly = (y - cy) / sy;
    if (ly > 3.2 * k) return false; // flat bottom
    for (const [lx, lyy, r] of lobes) {
      const dx = (x - cx) / sx - lx * k, dy = ly - lyy * k, rr = r * k;
      if (dx * dx + dy * dy <= rr * rr) return true;
    }
    return false;
  };
  const x0 = Math.floor(cx - 10 * k * sx) - 1, x1 = Math.ceil(cx + 10 * k * sx) + 1;
  const y0 = Math.floor(cy - 6 * k * sy) - 1, y1 = Math.ceil(cy + 3 * k * sy) + 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const X = x + 0.5, Y = y + 0.5;
      if (inside(X, Y)) {
        let c;
        const curl = lobes.length > 3 && [0, 2].some((j) => {
          const [lx, lyy, r] = lobes[j], dx = X / 1 - cx - lx * k * sx, dy = (Y - cy) / sy - lyy * k, d = Math.hypot(dx / sx, dy);
          return d > r * k - 1 && d <= r * k && dy < -0.8 && (j === 0 ? dx > 0 : dx < 0);
        });
        if (!inside(X, Y - 1)) c = C[5];
        else if (!inside(X, Y - 2)) c = C[4];
        else if (!inside(X, Y + 1)) c = C[1];
        else if (!inside(X, Y + 2) || !inside(X + 1, Y + 1)) c = C[2];
        else c = C[3];
        if (curl && c !== C[5]) c = C[2];
        if (flash) c = flash > 1 ? WHITE : !inside(X, Y + 1) ? C[3] : C[5];
        p.blend(x, y, c, a);
      } else if (inside(X + 1, Y) || inside(X - 1, Y) || inside(X, Y + 1) || inside(X, Y - 1)) p.blend(x, y, C[0], a);
    }
}

/** A splash crown on the bottom edge: a white tick, then two beads hopping out, then gone. */
function splash(p, R, x, y, age) {
  if (age < 0 || age > 0.2) return;
  if (age < 0.05) { p.px(x, y - 1, WHITE); p.px(x - 1, y - 1, R[2]); p.px(x + 1, y - 1, R[2]); }
  else if (age < 0.12) { p.px(x - 1, y - 2, R[2]); p.px(x + 1, y - 2, R[2]); p.px(x, y - 1, R[1]); }
  else { p.dot(x - 2, y - 2, R[1], 0.9); p.dot(x + 2, y - 2, R[1], 0.9); }
}

/** A falling streak, 2 px long, head bright: speeds up, then holds its pace. */
const dropY = (y0, age) => y0 + 70 * age + 140 * Math.min(age, 0.45) * Math.min(age, 0.45) + 126 * Math.max(0, age - 0.45);
/** How long a drop from y0 takes to reach y1. */
function hitAge(y0, y1) {
  let th = 0;
  while (dropY(y0, th) < y1 && th < 2) th += 0.005;
  return th;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), R = fit(o.rain, 4), B = fit(o.bolt, 3), S = o.seed;
  const W = Math.max(12, Math.round(o.w)), H = Math.max(16, Math.round(o.h));
  const k = clamp(W / 27, 0.75, 1); // phone posters get a slightly smaller cloud

  if (o.tease) {
    const D = tease.duration;
    if (t >= D) return;
    // a wisp rises over the top-right corner, peeks, lets one drop go and sinks back
    const up = ease.outBack(seg(t, 0, 0.2)) * (1 - ease.inQuad(seg(t, 0.55, 0.8)));
    const wx = W - 4, wy = 2 - up * 3.5;
    const wisp = [[-1.6, 0.2, 2.2], [1.6, -0.6, 2.8]];
    if (up > 0.05) cloud(p, C, wx, wy, k, 1, 1, clamp(up * 1.6), 0, wisp);
    const age = t - 0.24;
    if (age > 0) {
      const y = dropY(wy + 2, age);
      if (y < H - 1) { p.px(wx, y, R[2]); p.px(wx, y - 1, R[0]); }
      else splash(p, R, wx, H, age - hitAge(wy + 2, H - 1));
    }
    return;
  }
  if (t >= END) return;

  // where the cloud sits: centered over the top edge, a slow bob, then drifting off to the right
  const drift = ease.inQuad(seg(t, DRIFT, END));
  const cx = W / 2 + drift * 9, cy = -1.5 + Math.round(Math.sin(t * 3.2) * 0.6) - drift * 1.5;
  // the puff-in: grows from a small blob with an overshoot, squashing wide then tall, then settles
  const g = seg(t, 0, IN);
  const grow = ease.outBack(g);
  const wob = Math.sin(seg(t, IN * 0.6, IN + 0.36) * Math.PI * 2.5) * (1 - seg(t, IN * 0.6, IN + 0.36)) * 0.16;
  const sx = 1 + wob, sy = 1 - wob;
  const kk = k * lerp(0.35, 1, grow) * (1 - drift * 0.35);
  const a = t < 0.03 ? 0.6 : 1 - ease.inQuad(seg(t, DRIFT + 0.25, END));
  const flash = t >= BOLT && t < BOLT + 0.034 ? 2 : t >= BOLT + 0.07 && t < BOLT + 0.1 ? 1 : 0;

  // rain: short streaks from the cloud's underside, falling the poster's height, splashing on its bottom edge
  const N = 24;
  for (let i = 0; i < N; i++) {
    const born = RAIN0 + (i / N) * (RAIN1 - RAIN0) + rand(S, i, 1) * 0.05;
    const age = t - born;
    if (age < 0) continue;
    const span = 5.5 * k;
    const x = Math.round(W / 2 + (rand(S, i, 2) * 2 - 1) * span + seg(born, DRIFT, END) * 9);
    const y0 = cy + 2;
    const y = dropY(y0, age);
    if (y < H - 1) {
      p.px(x, y, R[2]);
      p.px(x, y - 1, R[1]);
      if (age > 0.3) p.px(x, y - 2, R[0]); // a longer streak once it's falling fast
    } else {
      splash(p, R, x, H, age - hitAge(y0, H - 1));
    }
  }

  // the lightning flicker: a tiny zigzag under the cloud for two frames, the cloud lit white
  if (t >= BOLT && t < BOLT + 0.1) {
    const bx = Math.round(cx - 1), by = Math.round(cy + 3);
    const pts = [[0, 0], [-2, 3], [1, 4], [-1, 8]];
    const c = t < BOLT + 0.034 ? WHITE : B[1];
    for (let j = 0; j < pts.length - 1; j++) p.line(bx + pts[j][0], by + pts[j][1], bx + pts[j + 1][0], by + pts[j + 1][1], c);
    p.glow(bx, by + 4, 9, B[1], t < BOLT + 0.034 ? 0.45 : 0.2);
  }

  cloud(p, C, cx, cy, kk, sx, sy, a, flash);
  if (t < 0.05) p.glow(cx, cy, 6, C[4], 0.3);
}
