// Made for the GoodWatch stats page: "Chekhov's Gun": a prop on the wall glints early and fires later.
import { fit, seg, clamp, lerp, ease, rand, WHITE } from "../../core/index.js";

export const meta = {
  name: "Trope Chekhov's gun",
  desc: "A small revolver drops onto a nail above the chip, a glint runs down its barrel and winks at the muzzle, a still beat, then it fires: a white flash, a BANG and a puff of smoke.",
  tags: ["stats-page", "trope", "gun", "glint", "one-shot"],
  size: [80, 48],
  origin: [10, 36],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0a0c12", "#343c50", "#626c82", "#98a4ba", "#d4dcea", "#ffffff"],
    wood: ["#3a1c0c", "#6a3a1a", "#9a5a2a"],
    flash: ["#7a2a08", "#d4600e", "#ffb020", "#ffe680", "#fffbe0"],
    smoke: ["#3a4256", "#6a7286", "#a4acbc"],
    w: 61,
    h: 12,
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.8 };

// the revolver, facing right: d m l h steel (dark to light), c the cylinder's dark flutes, w W wood grip, t trigger
const GUN = [
  "..dd............",
  "..mhhhhhhhhhhhhl",
  "..mllmmmmmmmmmmd",
  "..mcmcmddddd....",
  ".Wmmmdd.........",
  ".WWw.t.d........",
  "WWw...dd........",
  "WWw.............",
  "ww..............",
];
const GW = 16, GH = GUN.length;
const FLASH1 = ["..y.o..", "y.Wy.o.", ".WWWWyo", "y.Wy.o.", "..y.o.."];
const FLASH2 = [".o..", "yyor", ".o.."];
const MUZZLE = [16, 2]; // just past the barrel's end
const NAIL = [6, 5]; // the nail goes through the trigger guard

const DROP = 0.18, GLINT0 = 0.3, GLINT1 = 0.6, FIRE = 1.18, OUT0 = 2.1, OUT1 = 2.42;

function gunAt(r, q) {
  return r >= 0 && r < GH && q >= 0 && q < GW && GUN[r][q] !== "." ? GUN[r][q] : null;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), Wd = fit(o.wood, 3), F = fit(o.flash, 5), Sm = fit(o.smoke, 3), w = o.w ?? 61;
  const teasing = !!o.tease;
  const D = teasing ? tease.duration : meta.duration;
  if (t >= D) return;
  const gx0 = Math.round(w / 2 - 11), gy0 = -13; // the gun's top-left at rest
  const PAL = { d: C[1], m: C[2], l: C[3], h: C[4], c: C[1], W: Wd[2], w: Wd[1], t: C[2] };

  if (teasing) {
    // only the outline fades in, a single glint runs the barrel, and it fades away again
    // solid line art in hard steps (dim, brighter, dim), never dithered
    const lc = t < 0.08 || t > 0.66 ? C[1] : C[2];
    if (t < 0.74)
      for (let r = -1; r <= GH; r++)
        for (let q = -1; q <= GW; q++)
          if (!gunAt(r, q) && (gunAt(r - 1, q) || gunAt(r + 1, q) || gunAt(r, q - 1) || gunAt(r, q + 1))) p.px(gx0 + q, gy0 + r, lc);
    const g = seg(t, 0.18, 0.48);
    if (g > 0 && g < 1) {
      const x = gx0 + 4 + Math.round(ease.inOutSine(g) * 11);
      p.px(x, gy0, WHITE);
      p.px(x - 1, gy0, C[4]);
      p.px(x + 1, gy0, C[3]);
      p.light(x, gy0, C[4], 0.3);
    }
    const s = t - 0.48;
    if (s > 0 && s < 0.16) {
      const mx = gx0 + MUZZLE[0], my = gy0, arm = s < 0.08 ? 2 : 1;
      for (let k = 1; k <= arm; k++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(mx + dx * k, my + dy * k, k === 2 ? C[3] : C[4]);
      p.px(mx, my, WHITE);
    }
    return;
  }

  // where the gun is: dropped onto the nail with a little bounce, still, a tremble just before, kicked back by the shot
  let gx = gx0, gy = gy0;
  gy += Math.round(-4 * (1 - ease.outBack(seg(t, 0, DROP), 2.4)));
  if (t > FIRE - 0.1 && t < FIRE) gx += Math.round(t * 60) % 2 ? 0 : 1;
  const k = t - FIRE;
  if (k >= 0 && k < 0.4) {
    const kick = k < 0.04 ? 1 : Math.exp(-(k - 0.04) * 9) * Math.cos((k - 0.04) * 18);
    gx -= Math.round(2.4 * kick);
    gy -= Math.round(1.4 * Math.max(0, kick));
  }
  const a = seg(t, 0, 0.1);
  // it leaves in hard ramp steps: steel dims a step, then only a dim outline is left, then nothing
  const out = t < OUT0 ? 0 : t < OUT0 + (OUT1 - OUT0) * 0.4 ? 1 : t < OUT1 ? 2 : 3;

  // the nail: a tiny lit head the gun hangs from
  const nx = gx0 + NAIL[0], ny = gy0 + NAIL[1];

  // the gun: dark outline, steel and wood, a white hero frame when it fires
  const hot = k >= 0 && k < 0.05;
  const DIM = { d: C[0], m: C[1], l: C[2], h: C[3], c: C[0], W: Wd[1], w: Wd[0], t: C[1] };
  if (out < 3)
    for (let r = -1; r <= GH; r++)
      for (let q = -1; q <= GW; q++) {
        const ch = gunAt(r, q);
        if (ch) {
          if (out < 2) p.dot(gx + q, gy + r, hot && ch !== "w" && ch !== "W" ? (r <= 2 ? WHITE : C[4]) : (out ? DIM : PAL)[ch], a);
        } else if (gunAt(r - 1, q) || gunAt(r + 1, q) || gunAt(r, q - 1) || gunAt(r, q + 1))
          p.dot(gx + q, gy + r, out === 2 ? C[1] : C[0], a);
      }
  if (out < 2) {
    p.dot(nx, ny, C[4], a);
    p.dot(nx, ny + 1, C[0], a);
  }

  // the glint: a white bead runs the barrel's lit top, then winks at the muzzle
  const g = seg(t, GLINT0, GLINT1);
  if (g > 0 && g < 1) {
    const x = gx + 3 + Math.round(ease.inOutSine(g) * 12);
    p.px(x, gy + 1, WHITE);
    p.px(x - 1, gy + 1, C[4]);
    if (x + 1 < gx + GW) p.px(x + 1, gy + 1, C[4]);
    p.light(x, gy + 1, C[4], 0.35);
  }
  const s = t - GLINT1;
  if (s > 0 && s < 0.2) {
    const mx = gx + MUZZLE[0] - 1, my = gy + 1, arm = s < 0.05 ? 1 : s < 0.13 ? 3 : 1;
    for (let q = 1; q <= arm; q++)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(mx + dx * q, my + dy * q, q === 1 ? C[5] : q === 2 ? C[4] : C[3]);
    p.px(mx, my, WHITE);
    p.light(mx, my, C[4], 0.5);
  }

  // the shot
  if (k >= 0) {
    const mx = gx0 + MUZZLE[0], my = gy0 + MUZZLE[1];
    // muzzle flash: a white-hot spiked burst for the hero frames, then a small amber one
    if (k < 0.12) {
      const rows = k < 0.05 ? FLASH1 : FLASH2;
      p.sprite(rows, { W: "#ffffff", y: F[3], o: F[2], r: F[1] }, mx, my - (rows.length >> 1));
      p.glow(mx + 2, my, k < 0.05 ? 14 : 9, F[3], k < 0.05 ? 0.6 : 0.35);
    }
    // the light of it on the chip below
    if (k < 0.18) p.glow(mx, 0, 16, F[2], 0.3 * (1 - k / 0.18));

    // smoke: soft puffs leave the muzzle, swell, rise and drift right, thinning out
    for (let i = 0; i < 3; i++) {
      const b = 0.04 + i * 0.06, age = k - b, L = 0.95 + rand(o.seed, i, 1) * 0.3;
      if (age < 0 || age > L) continue;
      const u = age / L, e = ease.outCubic(u);
      const x = mx + 2 + e * (3 + i * 3.5), y = my - 1 - e * (7 + i * 1) + Math.sin(u * 5 + i) * 0.6;
      const r = 1.4 + e * (1.6 + i * 0.5), al = (u < 0.15 ? 0.8 : 0.65) * (1 - ease.inQuad(u));
      p.disc(x, y, r, (d) => (d < 0.45 && u < 0.4 ? Sm[2] : Sm[1]), al);
      if (u < 0.5) p.blend(Math.round(x - r * 0.4), Math.round(y - r * 0.5), Sm[2], al * 0.8);
    }

    // BANG: pops out up and to the right, white for two frames, then amber with a dark outline; letters wink off one by one
    const bt = k - 0.02;
    if (bt > 0) {
      const word = "BANG", L = word.length;
      const bx = gx0 + 6, by = gy0 - 10;
      const lift = Math.round(lerp(4, 0, ease.outBack(seg(bt, 0, 0.16), 2.6)) - seg(bt, 0.5, 1.0) * 2);
      const shake = bt < 0.18 ? (Math.round(bt * 50) % 2 ? 1 : -1) : 0;
      const [tw] = p.measure(word, { font: "big" });
      let x = Math.round(bx - tw / 2) + shake;
      for (let i = 0; i < L; i++) {
        const ch = word[i], [cw] = p.measure(ch, { font: "big" });
        const gone = bt > 0.72 + i * 0.05;
        const pop = bt > 0.68 + i * 0.05 && !gone;
        const born = bt > i * 0.025;
        if (born && !gone) {
          const yy = by + lift - (pop ? 1 : 0) + (i % 2 ? 1 : 0) * (bt < 0.3 ? 1 : 0);
          const c = bt < 0.06 || pop ? WHITE : (gx2, gy2) => (gy2 <= 1 ? F[4] : gy2 <= 4 ? F[3] : F[2]);
          p.text(ch, x, yy, c, { font: "big", outline: C[0] });
        }
        x += cw + 1;
      }
    }
  }
}
