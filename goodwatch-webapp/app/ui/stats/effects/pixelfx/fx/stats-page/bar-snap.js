// Made for the GoodWatch stats page: The calm partner of split-bar: on a title members agree on, the score
// bar's two ends snap in to the marker like caliper jaws, click, a small glint winks above it, and the jaws ease back
// out and fade at the bar's ends.
import { fit, seg, clamp, lerp, ease, WHITE } from "../../core/index.js";

export const meta = {
  name: "Bar snap",
  desc: "Bracket jaws light up at a score bar's ends, slide in and snap shut on the marker with a click flash, a glint winks on the marker, the jaws ease back out and fade.",
  tags: ["stats-page", "agree", "snap", "glint", "calm", "one-shot"],
  size: [80, 24],
  origin: [40, 14],
  duration: 1.1,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    w: 30,
    x0: -15,
    seed: 3,
  },
};

// the marker is a 4 px dot on the anchor (columns -2..1, rows -2..1), the bar runs through rows -1 and 0
const IN = [0.06, 0.36]; // the jaws close
const SNAP = IN[1];
const OUT = [0.5, 0.95]; // and open again, fading

/** A bracket jaw: a 4 px upright with a lip pointing at the marker. `dir` is +1 for the left jaw (lip to the right). */
function jaw(p, x, dir, c, lip, a) {
  for (let y = -2; y <= 1; y++) p.blend(x, y, y === -2 ? lip : c, a);
  p.blend(x + dir, -2, lip, a);
  p.blend(x + dir, 1, c, a * 0.8);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8);
  if (t >= meta.duration) return;
  const L = Math.min(-3, Math.round(o.x0)), R = Math.max(2, Math.round(o.x0 + o.w) - 1); // the bar's end columns
  // where the jaws meet: just outside the marker
  const ML = -3, MR = 2;

  // the jaws' positions: in with a little acceleration, a hold on the click, then out with a soft settle
  const ui = ease.inCubic(seg(t, IN[0], IN[1]));
  const uo = ease.outCubic(seg(t, OUT[0], OUT[1]));
  const close = t < OUT[0] ? ui : 1 - uo;
  const lx = Math.round(lerp(L, ML, close)), rx = Math.round(lerp(R, MR, close));

  // brightness: they light up at the ends, flash white on the click, cool while open again, then fade out
  const lit = seg(t, 0, IN[0]);
  const fade = 1 - seg(t, 0.75, 1.05);
  const a = lit * fade;
  const age = t - SNAP;
  const flash = age >= 0 && age < 0.07;
  const body = flash ? WHITE : age >= 0 && age < 0.2 ? C[6] : t < SNAP ? C[5] : C[4];
  const lip = flash ? WHITE : t < SNAP || age < 0.25 ? C[6] : C[5];

  // the path they sweep glows faintly on the bar, warmest right behind them
  if (t < SNAP + 0.1) {
    const k = 1 - seg(t, SNAP, SNAP + 0.1);
    for (const [from, to, dir] of [[L, lx, 1], [R, rx, -1]]) {
      const len = Math.abs(to - from);
      for (let d = 1; d <= len; d++) {
        const x = to - dir * d;
        const w = (1 - d / (len + 3)) * 0.4 * k * lit;
        if (w > 0.04) for (const y of [-1, 0]) p.blend(x, y, C[3], w);
      }
    }
  }

  if (a > 0) {
    jaw(p, lx, 1, body, lip, a);
    jaw(p, rx, -1, body, lip, a);
    if (t < SNAP + 0.3) {
      p.light(lx, -0.5, C[5], 0.18 * a);
      p.light(rx, -0.5, C[5], 0.18 * a);
    }
  }

  // the click: a white flash on the marker's rim and a soft pool of light
  if (age >= 0 && age < 0.12) {
    const k = 1 - age / 0.12;
    p.glow(-0.5, -0.5, 4 + 3 * k, C[5], 0.35 * k);
    if (age < 0.05) {
      p.px(-1, -3, WHITE); p.px(0, -3, WHITE);
      p.px(-1, 2, C[6]); p.px(0, 2, C[6]);
    }
  }

  // the glint: a four-point star above the marker that grows, holds a beat and shrinks
  const g = t - (SNAP + 0.04);
  if (g >= 0 && g < 0.5) {
    const s = g < 0.08 ? g / 0.08 : g < 0.2 ? 1 : 1 - (g - 0.2) / 0.3;
    const arm = Math.round(1 + 1.4 * s);
    const gx = 3, gy = -4; // the marker's upper right, like a shine on a ball, under the title line
    const core = g < 0.12 ? WHITE : C[6];
    p.px(gx, gy, core);
    for (let d = 1; d <= arm; d++) {
      const c = d === arm ? C[4] : d === 1 ? C[6] : C[5];
      p.px(gx + d, gy, c); p.px(gx - d, gy, c);
      if (d < arm || arm === 1) { p.px(gx, gy + d, c); if (d === 1) p.px(gx, gy - d, c); } // short above: the title line is close
    }
    p.glow(gx, gy, 3 + 2 * s, C[5], 0.25 * clamp(s));
  }
}
