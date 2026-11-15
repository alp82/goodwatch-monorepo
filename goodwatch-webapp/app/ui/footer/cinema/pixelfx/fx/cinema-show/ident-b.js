// Made for the GoodWatch footer cinema: studio ident, modern take, for the multiplex.
// Black. A hairline of light opens across the frame, an anamorphic flare races along it, the line collapses into
// a point, motes of light spiral in and build the G, a light slit draws the wordmark, a bass-hit frame lands, a
// quick sweep crosses the letters, it holds and cuts to black.
import { seg, ease, clamp, rand, hex, lerp, fit, WHITE, TAU } from "../../core/index.js";
import { rowLogo, tone } from "./_ident.js";

export const meta = {
  name: "Studio ident: modern",
  desc: "A hairline of light opens, an anamorphic flare races along it, motes spiral in to build the G, a light slit draws GOODWATCH PICTURES, a bass-hit frame, a sweep, cut.",
  tags: ["cinema-show", "screen", "ident", "logo", "flare", "one-shot"],
  size: [288, 120],
  origin: [144, 60],
  duration: 6.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { w: 288, h: 120, seed: 2, palette: ["#2e1a04", "#7a4a0a", "#c4820e", "#fbbf24", "#ffe9a0", "#fff6d6"], flare: ["#0c1a3a", "#1d3f7a", "#3d78c8", "#86bfff", "#d8ecff"] },
};

const LOGO = rowLogo();
const G = LOGO.px.filter((q) => q.li === -1);
const WORD = LOGO.px.filter((q) => q.li >= 0 || q.part === "rule");
const GX = LOGO.g.x + LOGO.g.w / 2, GY = LOGO.g.y + LOGO.g.h / 2;
const INK = hex("#050508");
// the line opens, the flare races, the line collapses, motes build the G, the slit draws the word, the hit, sweep, cut
const LINE0 = 0.25, LINE1 = 0.75, FL0 = 0.7, FL1 = 1.35, COL0 = 1.3, COL1 = 1.7, M0 = 1.45, M1 = 2.45, SLIT0 = 2.45, SLIT1 = 2.85, HIT = 2.9, SW0 = 3.45, SW1 = 3.85, CUT = 6.05, GBUILD = 1.95, RAYS = 44;
// the hold's life: a slow sheen, drifting motes, the streak crossing back once
const SHEEN0 = 4.05, SHEEN1 = 5.25, RE0 = 5.15, RE1 = 5.75, MOTES = 14;

// an anamorphic streak: a hot core and a long horizontal falloff, light plus a stepped 1 px line
function streak(p, x, y, len, k, F, hw) {
  if (k <= 0.01) return;
  const x0 = Math.max(-hw, x - len), x1 = Math.min(hw - 1, x + len);
  for (let xx = Math.floor(x0); xx <= x1; xx++) {
    const f = 1 - Math.abs(xx - x) / len, ff = f * f * k;
    if (ff < 0.04) continue;
    p.dot(xx, y, ff > 0.7 ? WHITE : ff > 0.4 ? F[4] : ff > 0.2 ? F[3] : F[2], Math.min(1, ff * 3));
    p.light(xx, y, F[3], 0.5 * ff);
    p.light(xx, y - 1, F[2], 0.25 * ff);
    p.light(xx, y + 1, F[2], 0.25 * ff);
  }
  p.glow(x, y, 6 + 10 * k, F[4], 0.45 * k);
  p.glow(x, y, 3, WHITE, 0.6 * k);
}

export function draw(p, t, o) {
  if (t >= CUT) return;
  const C = fit(o.palette, 6), F = fit(o.flare, 5), hw = (o.w ?? 288) / 2;

  // 1. the hairline: opens from the middle, then collapses into the G's center
  const open = ease.outCubic(seg(t, LINE0, LINE1)), col = ease.inCubic(seg(t, COL0, COL1));
  if (open > 0 && col < 1) {
    const half = open * hw * (1 - col), cx = lerp(0, GX, col), cy = lerp(0, GY, col);
    for (let x = Math.max(-hw, Math.floor(cx - half)); x <= Math.min(cx + half, hw - 1); x++) {
      const f = 1 - Math.abs(x - cx) / Math.max(1, half);
      p.dot(x, cy, f > 0.75 ? F[4] : f > 0.35 ? F[3] : F[2], clamp(0.35 + f));
      p.light(x, cy, F[2], 0.18 * f);
    }
    p.glow(cx, cy, 10 + 20 * open, F[3], 0.18 * open);
  }
  // 2. the anamorphic flare racing along it, left to right, then a second smaller one back
  const fl = seg(t, FL0, FL1);
  if (fl > 0 && fl < 1) {
    const x = lerp(-hw * 0.9, hw * 0.9, ease.inOutSine(fl));
    const k = Math.sin(fl * Math.PI);
    streak(p, x, 0, 70 + 40 * k, k, F, hw);
    // lens ghosts: little rings strung along the line on the far side of the center, like a real anamorphic lens
    for (const [m, r] of [[-0.35, 3], [-0.7, 5], [-1.1, 2]]) {
      const gx = x * m;
      if (k > 0.35) p.ring(gx, 0, r, 1, k > 0.7 ? F[3] : F[2], 1);
      p.glow(gx, 0, r + 4, F[2], 0.12 * k);
    }
  }
  const fl2 = seg(t, FL1 - 0.15, COL1);
  if (fl2 > 0 && fl2 < 1) streak(p, lerp(hw * 0.7, GX, ease.inQuad(fl2)), lerp(0, GY, ease.inCubic(fl2)), 40, 0.6 * Math.sin(fl2 * Math.PI), F, hw);

  // 3. rays of light converge on the emblem's center from all round; the G builds outward from its middle
  const hitK = t >= HIT - 0.01 && t < HIT + 0.06 ? 1 : 0;
  for (let i = 0; i < RAYS; i++) {
    const arrive = lerp(M0 + 0.3, M1 - 0.15, (i + rand(o.seed, i, 1)) / RAYS);
    const start = arrive - 0.5 - rand(o.seed, i, 2) * 0.25, u = (t - start) / (arrive - start);
    if (u <= 0 || u >= 1) continue;
    const an = (i * 2.399) % TAU, R = 120 + rand(o.seed, i, 3) * 60, e = ease.inCubic(u);
    const ca = Math.cos(an) * 1.5, sa = Math.sin(an) * 0.62;
    const r = R * (1 - e), len = 5 + 44 * e * (1 - e) * 2;
    const hx = GX + ca * r, hy = GY + sa * r;
    const n = Math.max(2, Math.round(len));
    for (let k = 0; k <= n; k++) {
      const rr = r + (k / n) * len * (1 - e * 0.3), f = k / n;
      const x = GX + ca * rr, y = GY + sa * rr;
      if (x < -hw || x >= hw || y < -60 || y >= 60) break;
      p.dot(x, y, f < 0.15 ? WHITE : f < 0.4 ? F[4] : f < 0.7 ? F[3] : F[2], 1 - f * 0.6);
    }
    if (Math.abs(hx) < hw && Math.abs(hy) < 60) p.light(hx, hy, F[3], 0.35);
  }
  // a light that grows in the middle as the rays pour in
  const pour = seg(t, M0 + 0.3, M1);
  if (pour > 0) p.glow(GX, GY, 8 + 22 * pour, F[3], 0.3 * pour * (1 - seg(t, M1, HIT + 0.2)));
  const gdur = M1 - GBUILD;
  if (t > GBUILD) p.glow(GX, GY, 26, C[3], 0.14 * seg(t, GBUILD, M1) * (1 - seg(t, HIT + 0.3, HIT + 1.2) * 0.5));
  const sweep = seg(t, SW0, SW1), sx = lerp(LOGO.x0 - 24, LOGO.x1 + 24, ease.inOutSine(sweep));
  const shineAt = (q) => {
    if (!(sweep > 0 && sweep < 1)) return 0;
    const d = Math.abs(q.x - sx + (q.y - LOGO.y0) * 0.6);
    return d < 1.5 ? 2 : d < 3.5 ? 1 : 0;
  };

  // 4a. the hit's streak sits behind the lockup
  const hk = seg(t, HIT, HIT + 0.5);
  if (hk > 0 && hk < 1) {
    const fall = (1 - hk) ** 3;
    if (hitK) p.glow(0, 0, 170, C[4], 0.17);
    p.glow(0, 0, 90, C[3], 0.12 * fall);
    streak(p, 0, -1, 40 + 120 * ease.outCubic(hk), 0.8 * fall, F, hw);
  }
  // hold: a faint flare drifts slowly along under the lockup, and a warm light breathes behind it
  const hold = seg(t, HIT, HIT + 0.8) * (1 - seg(t, CUT - 0.4, CUT));
  if (hold > 0) {
    const breath = 0.5 - 0.5 * Math.cos((t - HIT) * 2.2);
    p.glow(0, 4, 80, C[2], 0.07 * hold * (0.8 + 0.2 * breath));
    p.glow(GX + 50, 0, 46, C[3], 0.045 * hold * breath);
    const dx = lerp(-60, 70, seg(t, HIT + 0.4, CUT));
    for (let x = -hw; x < hw; x++) {
      const f = 1 - Math.abs(x - dx) / 90;
      if (f > 0) p.light(x, LOGO.y1 + 5, F[2], 0.22 * f * f * hold);
    }
    // a slow, soft sheen: a wide slanted band of warm light glides across behind and over the lockup once
    const sh = seg(t, SHEEN0, SHEEN1);
    if (sh > 0 && sh < 1) {
      const bx = lerp(LOGO.x0 - 40, LOGO.x1 + 40, ease.inOutSine(sh)), k = Math.sin(sh * Math.PI);
      p.shade(LOGO.x0 - 30, LOGO.y0 - 22, LOGO.x1 + 30, LOGO.y1 + 22, (x, y, out) => {
        const d = Math.abs(x - bx + (y - GY) * 0.45), v = 1 - Math.abs(y - GY) / 34;
        if (d > 16 || v <= 0) return;
        out.l = C[4];
        out.k = (1 - d / 16) ** 2 * v * v * 0.14 * k * hold;
      });
    }
    // fine dust in the projector light: a few motes drift up and to the right, twinkling
    for (let i = 0; i < MOTES; i++) {
      const born = HIT + 0.2 + rand(o.seed, i, 21) * 0.9, age = t - born;
      if (age <= 0) continue;
      const x = -96 + rand(o.seed, i, 22) * 192 + age * (2 + rand(o.seed, i, 23) * 4);
      const y = -40 + rand(o.seed, i, 24) * 80 - age * (1.5 + rand(o.seed, i, 25) * 2.5) + Math.sin(age * 1.3 + i) * 1.5;
      if (x >= hw || y < -60) continue;
      const tw = 0.55 + 0.45 * Math.sin(age * (2 + rand(o.seed, i, 26) * 2) + i * 1.7), a = Math.min(1, age / 0.6) * hold * tw;
      const warm = rand(o.seed, i, 27) < 0.6;
      p.dot(x, y, a > 0.85 ? C[5] : warm ? C[3] : F[3], Math.min(0.9, a));
      p.light(x, y, warm ? C[3] : F[3], 0.18 * a);
    }
    // the anamorphic streak comes back once, quieter, right to left behind the lockup
    const rc = seg(t, RE0, RE1);
    if (rc > 0 && rc < 1) {
      // light only, no line: a soft blue band with a small bright head, so it reads as a lens flare passing
      const x = lerp(hw * 0.95, -hw * 0.95, ease.inOutSine(rc)), k = Math.sin(rc * Math.PI), y = LOGO.y1 + 5;
      for (let xx = Math.max(-hw, Math.floor(x - 70)); xx <= Math.min(hw - 1, x + 70); xx++) {
        const f = 1 - Math.abs(xx - x) / 70, ff = f * f * k;
        p.light(xx, y, F[3], 0.4 * ff);
        p.light(xx, y - 1, F[2], 0.15 * ff);
        p.light(xx, y + 1, F[2], 0.15 * ff);
      }
      p.glow(x, y, 7, F[4], 0.3 * k);
      p.glow(x, y, 2, WHITE, 0.35 * k);
    }
  }

  for (const q of G) {
    const age = t - (GBUILD + (Math.hypot(q.x - GX, q.y - GY) / 15) * gdur * 0.9 + rand(q.x, q.y, 5) * 0.08);
    if (age < 0) continue;
    const sh = shineAt(q);
    const c = hitK || age < 0.06 || sh === 2 ? WHITE : age < 0.15 || sh === 1 ? tone(q, 4) : tone(q, q.lvl);
    p.dot(q.x + 1, q.y + 1, INK, 1);
    p.px(q.x, q.y, c);
    if (age < 0.06) p.light(q.x, q.y, C[4], 0.4);
    if (sh) p.light(q.x, q.y, C[4], sh === 2 ? 0.5 : 0.2);
  }

  // 4. the wordmark: a vertical slit of light runs left to right and leaves the letters behind it
  const slit = seg(t, SLIT0, SLIT1);
  const slitX = lerp(LOGO.word.x - 2, LOGO.x1 + 3, ease.inOutQuad(slit));
  if (slit > 0) {
    for (const q of WORD) {
      if (q.x > slitX) continue;
      const behind = slitX - q.x, sh = shineAt(q);
      const c = hitK || behind < 2 || sh === 2 ? WHITE : behind < 6 || sh === 1 ? tone(q, 4) : tone(q, q.lvl);
      p.dot(q.x + 1, q.y + 1, INK, 1);
      p.px(q.x, q.y, c);
      if (sh) p.light(q.x, q.y, C[4], sh === 2 ? 0.5 : 0.2);
    }
    if (slit < 1) {
      for (let y = LOGO.y0 - 6; y <= LOGO.y1 + 6; y++) {
        const f = 1 - Math.abs(y - (LOGO.y0 + LOGO.y1) / 2) / 18;
        if (f <= 0) continue;
        p.dot(slitX, y, f > 0.6 ? WHITE : f > 0.3 ? F[4] : F[3], f + 0.3);
        p.light(slitX, y, F[3], 0.4 * f);
      }
      p.glow(slitX, (LOGO.y0 + LOGO.y1) / 2, 14, F[3], 0.25);
    }
  }
}
