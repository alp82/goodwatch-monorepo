// Made for the GoodWatch stats page: An admission ticket on the rating-source cards.
import { fit, rand, seg, clamp, lerp, ease, fly, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Admission ticket",
  desc: "A cream ticket slides up out of the card's top edge, a punch bites a hole and the chad tumbles, it wiggles, tears at the perforation and the stub flutters down.",
  tags: ["stats-page", "cinema", "ticket", "one-shot"],
  size: [80, 76],
  origin: [40, 30],
  duration: 1.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    // outline, paper back, paper shade, paper, paper lit
    palette: ["#24140c", "#b89c6c", "#d8c294", "#f2e3bf", "#fffaee"],
    // stripe: shadow, red, lit
    stripe: ["#7c1c16", "#c8362a", "#ee6448"],
    ink: "#8c6c48",
    amber: "#e8a030",
    w: 79,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.8 };

const TW = 13, TH = 23, PERF = 7, OUT_Y = -20; // ticket size, perforation row, top of the ticket when fully out
const RISE = 0.26, PUNCH = 0.42, WIG0 = 0.55, WIG1 = 0.95, TEAR = 1.0, BACK0 = 1.12, BACK1 = 1.42;
const HOLE = [[5, 2], [6, 2], [5, 3], [6, 3]];

/**
 * The ticket's cell at (i, j), or 0. part: 0 whole, 1 stub only, 2 body only. holed: the punch has bitten.
 * back: the stub seen from behind (plain, a step darker).
 */
function cellAt(i, j, part, holed, back, C, S, ink, amber) {
  if (i < 0 || i >= TW || j < 0 || j >= TH) return 0;
  const R = TW - 1;
  // the torn perforation: holes gone, the paper between them split between stub and body
  if (j === PERF) {
    if (i === 0 || i === R) return 0; // the notches
    if (part === 0) return i === 1 || i === R - 1 ? C[0] : i % 2 ? C[1] : C[2];
    if (i % 2) return 0;
    const toStub = i % 4 === 0;
    if ((part === 1) !== toStub) return 0;
    return C[0];
  }
  if (part === 1 && j > PERF) return 0;
  if (part === 2 && j < PERF) return 0;
  if ((i === 0 || i === R) && (j === 0 || j === TH - 1)) return 0; // rounded corners
  if (i === 0 || i === R || j === 0 || j === TH - 1) return C[0];
  if ((j === PERF - 1 || j === PERF + 1) && (i === 1 || i === R - 1)) return C[0]; // notch shoulders
  if (holed && j < PERF) {
    for (const [hx, hy] of HOLE) if (i === hx && j === hy) return 0;
    if ((i === 7 && (j === 2 || j === 3)) || (j === 4 && (i === 5 || i === 6))) return C[1]; // the hole's inner wall
  }
  if (back) return i === R - 1 || j === TH - 2 ? C[1] : C[2];
  const side = i === 1 ? C[4] : i === R - 1 ? C[2] : C[3];
  if (j < PERF) {
    // the stub: a thin amber line under the hole, two ink dashes
    if (j === 5 && i > 1 && i < R - 1) return amber;
    if (j === 1 && i > 2 && i < R - 2 && i % 3 !== 2) return ink;
    return j === 1 && i === 1 ? C[4] : side;
  }
  // the body: a red band, "ADMIT ONE" as ink dashes, a little star
  if (j === 9 || j === 10) return i === 1 ? S[2] : i === R - 1 ? S[0] : S[1];
  if (j === 11 && i > 0 && i < R) return S[0];
  if (j === 13 && i > 2 && i < R - 2 && i !== 6) return ink;
  if (j === 15 && i > 3 && i < R - 3) return ink;
  if ((j === 18 && i === 6) || (j === 19 && i >= 5 && i <= 7) || (j === 20 && i === 6)) return j === 19 && i === 6 ? S[1] : S[0];
  return side;
}

/**
 * Draw a piece of the ticket. Its pivot (ticket cell coords pu, pv) sits at world (wx, wy), turned by ang and
 * squeezed across by sx (a flutter; negative shows the back). clip: only draw above the card's top edge (y < 0).
 */
function piece(p, wx, wy, pu, pv, ang, sx, part, holed, clip, cols, shear = 0) {
  const cs = Math.cos(ang), sn = Math.sin(ang), back = sx < 0;
  // a flutter squeezes the paper to fewer columns, always keeping both outline columns
  const Wn = Math.max(2, Math.round(TW * Math.abs(sx))), R = TH + 4;
  p.shade(wx - R, wy - R, wx + R, wy + R, (x, y) => {
    if (clip && y >= 0) return;
    const dx = x - wx, dy = y - wy;
    const v = pv - dx * sn + dy * cs;
    // a wiggle shears whole rows sideways (clean steps), more towards the top
    const along = dx * cs + dy * sn - Math.round((shear * (pv - v)) / TH);
    if (Wn === TW) return cellAt(Math.floor(pu + along), Math.floor(v), part, holed, back, ...cols);
    const c = Math.floor(along + Wn / 2);
    if (c < 0 || c >= Wn) return;
    if (Wn === 2) { // edge-on: a dark rim and one lit column of paper
      const j = Math.floor(v);
      if (j < 0 || j > PERF || (part === 1 && j === PERF)) return;
      return c === 0 || j === 0 || j === PERF ? cols[0][0] : cols[0][back ? 2 : 3];
    }
    return cellAt(Math.round((c * (TW - 1)) / (Wn - 1)), Math.floor(v), part, holed, back, ...cols);
  });
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5), S = fit(o.stripe, 3), seed = o.seed;
  const cols = [C, S, fit([o.ink], 1)[0], fit([o.amber], 1)[0]];
  const pu = TW / 2, pv = TH; // pivot: the ticket's bottom-center

  if (o.tease) {
    // the top corner peeks out of the card's edge, tilted, and slides back
    if (t >= 0.7) return;
    const up = ease.outBack(seg(t, 0, 0.26)) * (1 - ease.inQuad(seg(t, 0.46, 0.7)));
    const ang = 0.16 + Math.sin(t * 14) * 0.03 * seg(t, 0.15, 0.3);
    piece(p, -2, TH - 6 * up, pu, pv, ang, 1, 0, false, true, cols);
    return;
  }
  if (t >= meta.duration) return;

  // the ticket: rises with a small overshoot, jolts down when punched, wiggles, slides back in after the tear
  const rise = ease.outBack(seg(t, 0, RISE), 1.4);
  const jolt = t > PUNCH && t < PUNCH + 0.1 ? 1 : 0;
  const back = ease.inQuad(seg(t, BACK0, BACK1));
  const wy = TH + OUT_Y * rise * (1 - back) + jolt;
  const wigU = seg(t, WIG0, WIG1);
  let shear = Math.sin(wigU * TAU * 2.5) * 2.6 * (1 - wigU);
  if (t > PUNCH && t < PUNCH + 0.1) shear += 1.2; // the punch knocks it a little
  // the tear: a beat of strain (the stub trembles), then the stub comes free
  const torn = t >= TEAR, holed = t >= PUNCH;
  if (back < 1) piece(p, 0, wy, pu, pv, 0, 1, torn ? 2 : 0, holed, true, cols, shear);
  else if (!torn) piece(p, 0, wy, pu, pv, 0, 1, 0, holed, true, cols, shear);

  // punch: a white hero frame round the bite, a few paper flecks
  const hx = -0.5, hy = wy - TH + 3; // the hole's center in world space (near enough while it barely turns)
  if (t >= PUNCH && t < PUNCH + 0.07) {
    for (const [dx, dy] of [[-2, -1], [-2, 0], [1, -1], [1, 0], [-1, -2], [0, -2], [-1, 1], [0, 1]]) p.px(hx + dx, hy + dy, WHITE);
    for (const [dx, dy] of [[-4, -1], [3, 0], [-1, -4], [0, 3]]) p.px(hx + dx, hy + dy, C[4]);
    p.glow(hx, hy, 6, C[4], 0.35);
  }
  // the chad: a tiny cream square drops out of the hole and tumbles down past the card
  const ca = t - PUNCH - 0.02;
  if (ca > 0 && ca < 0.75) {
    const [x, y] = fly(hx, hy, 14 + rand(seed, 1) * 6, -18, ca, 260, 0.6);
    const f = Math.floor(ca * 18) % 4, a = 1 - seg(ca, 0.55, 0.75);
    const cells = f === 0 ? [[0, 0], [1, 0]] : f === 1 ? [[0, 0]] : f === 2 ? [[0, 0], [0, 1]] : [[0, 0], [1, 1]];
    for (const [dx, dy] of cells) {
      p.dot(x + dx, y + dy + 1, C[0], a); // a dark shadow edge so it reads on the yellow card
      p.dot(x + dx + 1, y + dy, C[0], a * 0.7);
    }
    for (const [dx, dy] of cells) p.dot(x + dx, y + dy, f === 3 ? C[2] : C[4], a);
  }

  if (torn) {
    const age = t - TEAR;
    // the tear: a 1-frame white line along the perforation and a few fibres springing off it
    const ty = OUT_Y + PERF; // world y of the perforation when fully out
    if (age < 0.05) {
      for (let i = 1; i < TW - 1; i++) p.px(i - TW / 2, ty, WHITE);
      p.glow(0, ty, 8, C[4], 0.3);
    }
    for (let k = 0; k < 4; k++) {
      const fa = age - k * 0.02;
      if (fa < 0 || fa > 0.3) continue;
      const [x, y] = fly(-4 + k * 3, ty, (k - 1.5) * 18, -26 - rand(seed, k, 3) * 10, fa, 300, 0.5);
      p.dot(x, y, fa < 0.12 ? WHITE : C[3], 1 - fa / 0.3);
    }
    // the stub: lifts free, then flutters down over the card, rocking and flipping over, and vanishes edge-on
    const D = meta.duration - TEAR - 0.1;
    const lift = Math.min(age * 14, 1.5);
    const sway = Math.sin(age * 6.2) * 7 * seg(age, 0.05, 0.4);
    const sx0 = 0.5 + sway, sy0 = OUT_Y + 3.5 - lift + 46 * ease.inQuad(seg(age, 0.06, D)) + 8 * seg(age, 0.06, D);
    if (age < D) {
      // rocks like a falling leaf: rows shear towards the way it swings
      const rock = Math.cos(age * 6.2) * 3 * seg(age, 0.02, 0.25);
      const flip = age < 0.12 ? 1 : Math.cos(seg(age, 0.12, D) * TAU * 1.75);
      piece(p, sx0, sy0, TW / 2, 3.5, 0, flip, 1, true, false, cols, rock);
    } else if (age < D + 0.07) {
      // the last glint as it turns edge-on
      p.px(sx0, sy0, WHITE);
      if (age < D + 0.035) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.px(sx0 + dx, sy0 + dy, C[4]);
      p.glow(sx0, sy0, 4, C[4], 0.3);
    }
  }
}
