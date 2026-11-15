// Made for the GoodWatch stats page: "Bittersweet Ending": a small sunset on the chip's top edge.
import { fit, seg, clamp, lerp, ease, bump, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope bittersweet",
  desc: "A warm half sun sits on the chip's top edge with slow rays, then sinks behind it while the sky glow cools from amber to rose to violet and one small star comes out and twinkles.",
  tags: ["stats-page", "trope", "sunset", "star", "one-shot"],
  size: [92, 40],
  origin: [10, 30],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#3a0e1a", "#8a2a1e", "#d4561e", "#f4922a", "#ffc850", "#fff0b0"],
    sky: ["#ffa040", "#f0607a", "#8a5ad0"],
    star: ["#6a7aa8", "#c8d4f4", "#ffffff"],
    w: 71,
    h: 12,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.9 };

const R = 6;
const IN1 = 0.3, SINK0 = 0.55, SINK1 = 1.9, STAR0 = 1.6, END = 2.7;

/** The sun disc centered at (cx, cy), clipped above the chip edge (y < 0), shaded in hard steps; heat 1 yellow .. 0 red. */
function sun(p, C, cx, cy, heat, a) {
  for (let y = Math.floor(cy - R); y < Math.min(0, cy + R + 1); y++)
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / R;
      if (d > 1) continue;
      const step = d > 0.84 ? 0 : d > 0.5 ? 1 : 2; // rim, body, core
      const base = clamp(Math.round(heat * 2.4), 0, 3); // cools as it sinks
      const c = C[clamp(base + step, 1, 5)];
      p.dot(x, y, c, a);
    }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), Sk = fit(o.sky, 3), St = fit(o.star, 3), w = o.w ?? 71;
  const teasing = !!o.tease;
  const D = teasing ? tease.duration : meta.duration;
  if (t >= D) return;
  const cx = Math.round(w * 0.66) + 0.5;

  if (teasing) {
    // the sun's top rim peeks over the edge, one ray glints, and it slips back down
    const up = ease.outCubic(seg(t, 0, 0.3)) * (1 - ease.inCubic(seg(t, 0.5, 0.82)));
    const cy = R + 0.5 - up * 4;
    sun(p, C, cx, cy, 0.9, 1);
    const g = t - 0.28;
    if (g > 0 && g < 0.24) {
      const L = g < 0.08 ? 2 : g < 0.16 ? 3 : 2;
      for (let k = 0; k < L; k++) p.px(cx - 0.5, cy - R - 2 - k, k === 0 ? C[5] : C[4]);
      if (g < 0.06) p.px(cx - 0.5, cy - R - 2, WHITE);
    }
    if (up > 0.1) for (let x = Math.floor(cx - 4); x <= cx + 3; x++) p.blend(x, 0, C[4], 0.6 * up);
    return;
  }

  // the sun: rises a touch into place, holds, then sinks behind the chip's top edge, cooling as it goes
  const rise = ease.outBack(seg(t, 0, IN1), 1.6);
  const sink = ease.inOutSine(seg(t, SINK0, SINK1));
  const cy = lerp(R + 1, -2, rise) + sink * (R + 3);
  const heat = 1 - sink * 0.9;
  const shown = clamp(-(cy - R), 0, 2 * R); // how many px of it stand above the edge

  // the sky: three thin streaks of cloud lit from below, drifting slowly, their lit edge cooling amber, rose, violet
  const glow = seg(t, 0.05, IN1 + 0.1) * (1 - seg(t, SINK1 + 0.15, END - 0.25));
  const ph = seg(t, SINK0 + 0.2, SINK1 + 0.3);
  const lit = ph < 0.35 ? Sk[0] : ph < 0.7 ? Sk[1] : Sk[2];
  const top = ph < 0.5 ? C[1] : C[0];
  const STREAKS = [
    { y: -3, x0: -21, x1: -10, drift: 2 },
    { y: -7, x0: 10, x1: 21, drift: -1.5 },
    { y: -14, x0: -7, x1: 4, drift: 1.5 },
  ];
  if (glow > 0)
    STREAKS.forEach((st, i) => {
      const g = clamp(glow * 1.4 - i * 0.2);
      if (g <= 0) return;
      const mid = (st.x0 + st.x1) / 2, half = ((st.x1 - st.x0) / 2) * ease.outCubic(g);
      const dx = st.drift * t * 0.5;
      const a0 = Math.round(cx + mid + dx - half), a1 = Math.round(cx + mid + dx + half);
      for (let x = a0; x <= a1; x++) {
        const end = x === a0 || x === a1;
        p.blend(x, st.y, lit, (end ? 0.45 : 0.85) * (ph < 0.7 ? 1 : 0.7));
        if (x > a0 + 1 && x < a1 - 2) p.blend(x, st.y - 1, top, 0.7);
      }
    });

  // rays: short dashes fanned over the sun, turning slowly, shrinking as it sinks
  if (shown > 2 && t < SINK1) {
    const n = 5, len = shown > R ? 2 : 1, spin = t * 0.25;
    for (let i = 0; i < n; i++) {
      const th = Math.PI + (Math.PI * (i + 0.5)) / n + Math.sin(spin + i) * 0.06;
      const r0 = R + 2;
      for (let k = 0; k < len; k++) {
        const x = Math.round(cx - 0.5 + Math.cos(th) * (r0 + k)), y = Math.round(cy + Math.sin(th) * (r0 + k));
        if (y >= 0) continue;
        p.px(x, y, k === 0 ? C[3] : C[4]);
      }
    }
  }

  if (cy - R < 0) {
    sun(p, C, cx, cy, heat, 1);
    p.glow(cx, Math.min(-1, cy), R + 6, C[3], 0.3 * clamp(shown / R));
  }

  // where the sun meets the edge: a bright line on the chip's rim, narrowing to a last spark as it goes under
  const touch = cy + R > 0 && cy - R < 0;
  if (touch) {
    const half = Math.sqrt(Math.max(0, R * R - cy * cy));
    for (let x = Math.floor(cx - half - 2); x <= cx + half + 1; x++) {
      const e = Math.abs(x + 0.5 - cx) / (half + 2);
      p.blend(x, 0, e < 0.5 ? C[5] : C[4], e < 0.8 ? 0.9 : 0.5);
    }
  }
  // the last spark as the rim slips under: a white hero pixel and a short flare
  const last = SINK1 - 0.12;
  if (t > last && t < last + 0.12) {
    const g = (t - last) / 0.12;
    p.px(cx - 0.5, -1, g < 0.4 ? WHITE : C[5]);
    if (g < 0.6) { p.px(cx - 2.5, 0, C[4]); p.px(cx + 1.5, 0, C[4]); }
    p.light(cx, -1, C[4], 0.5 * (1 - g));
  }

  // one small star comes out above and to the left, twinkles twice, and fades
  const sg = t - STAR0;
  if (sg > 0 && t < END) {
    const L = END - STAR0, u = sg / L;
    const sx = Math.round(cx - 13), sy = -15;
    const tw = Math.sin(sg * 9) > 0.6; // two quick twinkles
    const arm = u < 0.08 ? 0 : u < 0.15 ? 2 : u > 0.85 ? 0 : tw ? 2 : 1;
    const core = u < 0.15 ? WHITE : u > 0.85 ? St[0] : St[2];
    p.px(sx, sy, core);
    for (let k = 1; k <= arm; k++) {
      const c = k === 1 ? St[1] : St[0];
      p.px(sx + k, sy, c);
      p.px(sx - k, sy, c);
      p.px(sx, sy + k, c);
      p.px(sx, sy - k, c);
    }
    p.light(sx, sy, St[1], 0.25 * (1 - u));
  }
}
