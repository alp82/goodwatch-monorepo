// Made for the GoodWatch stats page: A crescent moon rises over the tiny 9 and 10 bars of the IMDb score chart.
import { fit, seg, clamp, lerp, ease, WHITE } from "../../core/index.js";

export const meta = {
  name: "Moonrise",
  desc: "A crisp outlined crescent moon rises from the chart's last bars, stars wink on one by one as small crosses, the moon glows, then glow, stars and moon step out clean.",
  tags: ["stats-page", "moon", "night", "stars", "chart", "one-shot"],
  size: [48, 44],
  origin: [6, 8],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0a1028", "#26355e", "#5a6e9e", "#9fb2d8", "#dce6fa", "#ffffff"],
    glow: ["#1c2c5a", "#5070b0", "#a8c0f0"],
    w: 35,
    h: 30,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.8 };

const RISE0 = 0.06, RISE1 = 1.0, GLOW0 = 0.9, GLOW1 = 1.4, OUT0 = 1.86, MOON0 = 2.12, END = 2.52;
const R = 5;
// stars: x, y as a share of the area, when they wink on, peak arm length, when they wink off
const STARS = [
  [0.14, 0.2, 0.72, 2, 1.98],
  [0.36, 0.46, 0.9, 1, 2.06],
  [0.08, 0.62, 1.06, 1, 2.0],
  [0.92, 0.58, 1.2, 1, 2.12],
  [0.95, 0.14, 1.34, 2, 2.2],
];

/** One star: a pixel that flares to a cross (arm 1 or 2) when it winks on, then breathes as a dot or a tiny plus. */
function star(p, C, G, x, y, age, arm, offAge) {
  if (age < 0) return;
  const X = Math.round(x), Y = Math.round(y);
  if (offAge >= 0) {
    // winking off: a last small plus, then a dim dot, then nothing
    if (offAge < 0.05) { p.px(X, Y, C[4]); p.px(X - 1, Y, C[2]); p.px(X + 1, Y, C[2]); p.px(X, Y - 1, C[2]); p.px(X, Y + 1, C[2]); }
    else if (offAge < 0.12) p.px(X, Y, C[3]);
    else if (offAge < 0.18) p.px(X, Y, C[2]);
    return;
  }
  let a;
  if (age < 0.04) a = 0;
  else if (age < 0.1) a = arm;
  else if (age < 0.16) a = Math.max(1, arm - 1);
  else a = Math.sin(age * 9 + x) > 0.75 ? 1 : 0; // a gentle twinkle after
  p.px(X, Y, age < 0.16 && a ? WHITE : age < 0.04 ? C[3] : C[4]);
  for (let k = 1; k <= a; k++) {
    const c = k === a && a > 1 ? C[2] : C[3];
    p.px(X - k, Y, c); p.px(X + k, Y, c); p.px(X, Y - k, c); p.px(X, Y + k, c);
  }
  if (age < 0.16) p.glow(X + 0.5, Y + 0.5, 4, G[2], 0.3);
}

/** The crescent at (mx, my): an outer disc with a cut, 1 px dark outline, cool-white lit limb, a terminator step. */
function moon(p, C, mx, my, step) {
  const s = (i) => C[clamp(i - step, 0, 5)];
  const cx2 = mx + 2.4, cy2 = my - 1.6, r2 = 4.3;
  const inOuter = (x, y) => (x - mx) ** 2 + (y - my) ** 2 <= R * R;
  const inMoon = (x, y) => inOuter(x, y) && (x - cx2) ** 2 + (y - cy2) ** 2 > r2 * r2;
  for (let y = Math.floor(my - R) - 1; y <= Math.ceil(my + R) + 1; y++)
    for (let x = Math.floor(mx - R) - 1; x <= Math.ceil(mx + R) + 1; x++) {
      const X = x + 0.5, Y = y + 0.5;
      if (inMoon(X, Y)) {
        const limb = R - Math.hypot(X - mx, Y - my); // distance in from the lit outer edge
        const cut = Math.hypot(X - cx2, Y - cy2) - r2; // distance out from the shadow edge
        let c = limb < 1 ? s(5) : limb < 2 ? s(4) : s(3);
        if (cut < 1 && limb >= 1) c = s(2);
        p.px(x, y, c);
      } else if (inMoon(X + 1, Y) || inMoon(X - 1, Y) || inMoon(X, Y + 1) || inMoon(X, Y - 1)) {
        if (step < 4) p.px(x, y, C[0]);
      }
    }
  // a little crater on the broad part
  if (step < 3) p.px(Math.round(mx - 3), Math.round(my + 1), s(2));
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), G = fit(o.glow, 3);
  const W = Math.max(16, o.w ?? 35), H = Math.max(16, o.h ?? 30);

  if (o.tease) {
    const D = tease.duration;
    if (t >= D) return;
    // one star twinkles over the bars: a dot, a cross at its peak, a dot, gone
    const x = Math.round(W * 0.42), y = Math.round(H * 0.45), u = t / D;
    if (u < 0.12 || u > 0.92) return;
    const arm = u < 0.22 ? 0 : u < 0.34 ? 1 : u < 0.5 ? 2 : u < 0.64 ? 1 : 0;
    const c0 = u < 0.22 || u > 0.82 ? C[2] : u > 0.64 ? C[3] : arm === 2 ? WHITE : C[4];
    p.px(x, y, c0);
    for (let k = 1; k <= arm; k++) {
      const c = arm === 2 && k === 2 ? C[2] : C[3];
      p.px(x - k, y, c); p.px(x + k, y, c); p.px(x, y - k, c); p.px(x, y + k, c);
    }
    if (arm) p.glow(x + 0.5, y + 0.5, 4, G[2], arm === 2 ? 0.35 : 0.18);
    return;
  }
  if (t >= END) return;

  // the moon rises from the bars to the top of the area, easing out with a tiny settle
  const rise = ease.outBack(seg(t, RISE0, RISE1), 0.6);
  const mx = Math.round(W * 0.62), my = Math.round(lerp(H - 3, R + 1, rise));
  const step = t < MOON0 ? 0 : Math.min(5, 1 + Math.floor(seg(t, MOON0, END - 0.04) * 5));

  // the glow: swells once the moon is up, fades before anything else goes
  const gk = seg(t, GLOW0, GLOW1) * (1 - seg(t, OUT0, OUT0 + 0.24));
  if (gk > 0) {
    p.glow(mx - 1, my, 12, G[1], 0.26 * gk);
    p.glow(mx - 2, my, 6, G[2], 0.2 * gk);
  }
  // rising: a white hero frame as it leaves the bars, a faint trail of light under it
  if (t >= RISE0 && t < RISE1) {
    if (t < RISE0 + 0.04) {
      p.px(mx, H - 2, WHITE); p.px(mx - 1, H - 2, C[4]); p.px(mx + 1, H - 2, C[4]);
      p.glow(mx, H - 2, 6, G[2], 0.5);
    }
  }
  if (t >= RISE0 + 0.04 && step < 5) moon(p, C, mx, my, step);

  STARS.forEach(([sx, sy, on, arm, off]) => {
    star(p, C, G, sx * W, sy * H, t - on, arm, t >= off ? t - off : -1);
  });
}
