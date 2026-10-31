// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, seg, ease, lerp, WHITE } from "../../core/index.js";
import { AMB } from "./_amb1.js";

export const meta = {
  name: "Next episode",
  desc: "Over a binge island: little glowing screens switch on one after another, each filling its progress bar; when it ends, a spark hops to the next and it plays on.",
  tags: ["cinema", "ambient", "island", "binge", "tv", "episodes", "autoplay", "loop"],
  ...AMB,
  duration: 6,
  loop: true,
  options: {
    palette: ["#081020", "#1d3760", "#3a78bc", "#8cd0ff", "#e8f8ff"],
    bar: ["#5a0c1a", "#ff4658", "#ffd2d6"],
    seed: 1, r: 30, density: 1,
  },
};

const ON = 0.14, END = 0.86, HOP = 0.97; // fractions of an episode's slot

function places(n, r) {
  if (n === 4) return [[-0.62, -0.25], [-0.22, -0.68], [0.22, -0.68], [0.62, -0.25]].map(([x, y]) => [x * r, y * r]);
  return [[-0.56, -0.28], [0, -0.66], [0.56, -0.28]].map(([x, y]) => [x * r, y * r]);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), B = fit(o.bar, 3).map(hex), D = meta.duration, r = o.r ?? 30;
  const s = Math.max(0.8, Math.min(1.7, r / 30)), n = o.density >= 2 ? 4 : 3, slot = D / n, P = places(n, r);
  const w = Math.round(15 * s) | 1, h = Math.round(11 * s);
  // shifted by half an episode so the loop wraps in the middle of a play, not on a switch-on
  const T = (t + slot * 0.5) % D, cur = Math.floor(T / slot) % n, k = (T % slot) / slot;
  for (let i = 0; i < n; i++) {
    const [cx, cy] = P[i], x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2), x1 = x0 + w - 1, y1 = y0 + h - 1;
    // how lit: the playing one is on, the one before cools off after the hand-over
    const prev = (cur + n - 1) % n;
    let lit = 0;
    if (i === cur) lit = k < ON ? 0 : k < END ? 1 : 1 - seg(k, END, 1) * 0.55;
    else if (i === prev) lit = 0.45 * (1 - seg(k, 0, 0.35));
    // the set: a dark bezel, lit at the top edge when on
    for (let x = x0 + 1; x < x1; x++) { p.blend(x, y0, lit > 0.5 ? C[2] : C[1], 0.9); p.blend(x, y1, C[1], 0.9); }
    for (let y = y0 + 1; y < y1; y++) { p.blend(x0, y, C[1], 0.9); p.blend(x1, y, C[1], 0.9); }
    // screen
    const sx0 = x0 + 1, sy0 = y0 + 1, sx1 = x1 - 1, sy1 = y1 - 3;
    if (i === cur && k < ON) {
      // switching on: a bright line opens to the full screen
      const q = ease.outQuart(seg(k, 0, ON)), mid = (sy0 + sy1) / 2, half = Math.max(0, (sy1 - sy0) / 2 * q);
      for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) {
        if (Math.abs(y - mid) <= half) p.px(x, y, Math.abs(y - mid) < 1 ? WHITE : C[3]);
        else p.blend(x, y, C[0], 0.85);
      }
      p.glow(cx, cy, 10 * s, C[3], 0.5 * q);
    } else {
      for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) {
        if (lit <= 0.02) { p.blend(x, y, C[0], 0.8); continue; }
        // a tiny cool picture, its own per episode: a sky that lightens to the top, hills, a moon
        const v = (y - sy0) / Math.max(1, sy1 - sy0), hill = sy1 - Math.round((1.2 + Math.sin(x * 0.8 + i * 2.1) * 0.9 + Math.sin(x * 0.37 + i) * 0.8) * s);
        let c = v < 0.3 ? C[3] : v < 0.65 ? C[2] : C[2];
        if (y >= hill) c = y === hill ? C[2] : C[1];
        if (lit < 0.6) c = y >= hill ? C[0] : C[1];
        p.blend(x, y, c, 0.6 + lit * 0.4);
      }
      if (lit > 0.6) {
        const mx = sx0 + 2 + ((i * 5) % Math.max(1, sx1 - sx0 - 4)), my = sy0 + 1;
        p.px(mx, my, C[4]); p.light(mx, my, C[4], 0.3);
      }
      // a glint in the top-left corner of the glass
      if (lit > 0.6) { p.px(sx0, sy0, C[4]); p.px(sx0 + 1, sy0, C[3]); }
      // a play mark right after it starts
      if (i === cur && k > ON && k < ON + 0.14) {
        const pxm = Math.round(cx) - 1, pym = Math.round((sy0 + sy1) / 2);
        p.px(pxm, pym - 1, WHITE); p.px(pxm, pym, WHITE); p.px(pxm, pym + 1, WHITE); p.px(pxm + 1, pym, WHITE);
        if (s > 1.2) { p.px(pxm, pym - 2, WHITE); p.px(pxm, pym + 2, WHITE); p.px(pxm + 1, pym - 1, WHITE); p.px(pxm + 1, pym + 1, WHITE); p.px(pxm + 2, pym, WHITE); }
      }
    }
    // the progress bar in the bezel's chin
    const by = y1 - 1, bx0 = x0 + 2, bx1 = x1 - 2;
    for (let x = x0 + 1; x < x1; x++) p.blend(x, by, C[0], 0.9);
    p.blend(x0 + 1, by + 0, C[1], 0.9); p.blend(x1 - 1, by, C[1], 0.9);
    let fill = -1;
    if (i === cur) fill = k < ON ? -1 : seg(k, ON, END);
    else if (i === prev && k < 0.35) fill = 1;
    if (fill >= 0) {
      const xe = Math.round(lerp(bx0, bx1, fill));
      for (let x = bx0; x <= bx1; x++) p.px(x, by, x <= xe ? (i === cur ? B[1] : B[0]) : C[1]);
      if (i === cur && k < END) { p.px(xe, by, B[2]); p.light(xe, by, B[1], 0.5); }
    } else for (let x = bx0; x <= bx1; x++) p.blend(x, by, C[1], 0.7);
    // cool screen light on the island under it
    if (lit > 0) {
      p.glow(cx, cy, 13 * s, C[2], 0.3 * lit);
      p.glow(cx, y1 + 4 * s, 9 * s, C[3], 0.12 * lit);
    }
  }
  // autoplay hand-over: a spark hops from the finished bar to the next screen
  if (k > END) {
    const [ax, ay] = P[cur], [bx, by] = P[(cur + 1) % n], q = ease.inOutCubic(seg(k, END, HOP + 0.03));
    const x = lerp(ax + w / 2 - 2, bx, q), y = lerp(ay + h / 2 - 1, by, q) - Math.sin(q * Math.PI) * 9 * s;
    if (q < 1) {
      const q0 = ease.inOutCubic(seg(k - 0.04, END, HOP + 0.03));
      const tx = lerp(ax + w / 2 - 2, bx, q0), ty = lerp(ay + h / 2 - 1, by, q0) - Math.sin(q0 * Math.PI) * 9 * s;
      p.line(tx, ty, x, y, B[1], (u) => 0.35 + u * 0.65);
      p.px(x, y, B[2]);
      p.glow(x, y, 5, B[1], 0.45);
    }
  }
}
