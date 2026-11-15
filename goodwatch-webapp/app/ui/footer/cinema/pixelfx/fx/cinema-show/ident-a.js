// Made for the GoodWatch footer cinema: studio ident, golden age take, for the classic movie palace.
// Night over the city: three searchlights sweep up from below the frame and cross, settle into a fan behind the
// center, a warm glow builds, the G emblem builds out of the light, the letters rise, a shine crosses, glints, fade.
import { seg, ease, clamp, rand, hex, lerp, fit, WHITE } from "../../core/index.js";
import { stackLogo, tone } from "./_ident.js";

export const meta = {
  name: "Studio ident: golden age",
  desc: "Night sky: three searchlights sweep and cross, settle in a fan, a warm glow builds, GOODWATCH PICTURES builds out of the light, a shine crosses, glints, then it fades.",
  tags: ["cinema-show", "screen", "ident", "logo", "searchlight", "one-shot"],
  size: [288, 120],
  origin: [144, 60],
  duration: 7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { w: 288, h: 120, seed: 4, palette: ["#2e1a04", "#7a4a0a", "#c4820e", "#fbbf24", "#ffe9a0", "#fff6d6"] },
};

const LOGO = stackLogo();
const INK = hex("#06060b");
// the night, top to bottom in hard steps, and a warm city haze along the bottom
const SKY = ["#0b0b10", "#0b0d18", "#0d1221", "#10172b", "#151d35"].map(hex);
const HAZE = ["#1c1a2a", "#2a2130", "#3a2a2c"].map(hex);
// a beam's light from faint to hot, cool white with a little warmth
const BEAM = ["#1a2034", "#273049", "#3c4662", "#5d6884", "#8c95ab", "#c8ccd6"].map(hex);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
const LAMPS = [[-86, 64], [0, 66], [86, 64]];
// fade in, sweep, settle into the fan, logo builds, shine, glints, fade out
const IN1 = 0.3, SETTLE0 = 1.75, SETTLE1 = 2.55, LOCK = 2.55, G0 = 2.62, LET0 = 3.15, PICS0 = 3.85, SHINE0 = 4.5, SHINE1 = 5.1, OUT0 = 6.2, OUT1 = 6.85;
// the fan the beams settle into: the outer two cross with the middle one right behind the emblem's center
const FAN = [0.81, 0, -0.81];

function beamAngle(i, t) {
  // sweeping: each lamp swings on its own rhythm, they cross over the middle a couple of times
  const sw = [0.55 * Math.sin(t * 1.9 + 0.4) + 0.15, 0.42 * Math.sin(t * 1.4 + 2.6), -0.55 * Math.sin(t * 1.7 + 1.1) - 0.15][i];
  // once settled they keep breathing a little, so the hold never freezes
  const sway = 0.025 * Math.sin(t * 1.3 + i * 2.1) * seg(t, SETTLE1, SETTLE1 + 0.8);
  return lerp(sw, FAN[i], ease.inOutCubic(seg(t, SETTLE0, SETTLE1))) + sway;
}

export function draw(p, t, o) {
  if (t >= meta.duration - 0.02) return;
  const C = fit(o.palette, 6), W = o.w ?? 288, hw = W / 2;
  const lum = seg(t, 0, IN1) * (1 - seg(t, OUT0 + 0.15, OUT1));
  if (lum <= 0) return;
  const skyStep = Math.round(lum * 4);
  const beamK = seg(t, 0.15, 0.7) * (1 - seg(t, OUT0, OUT1 - 0.1));
  const beams = LAMPS.map(([bx, by], i) => {
    const a = beamAngle(i, t);
    return { bx, by, dx: Math.sin(a), dy: -Math.cos(a), k: i === 1 ? 0.85 : 1 };
  });
  const glow = ease.outQuad(seg(t, 1.6, 3.0)) * (1 - seg(t, OUT0, OUT1));

  // sky and beams in one pass: beam strength is summed, then stepped onto the beam ramp
  p.shade(-hw, -60, hw - 1, 59, (x, y) => {
    // bands of night, their edges broken up with an ordered dither so they read as a gradient, not stripes
    const bay = BAYER[((Math.floor(y) & 3) << 2) | (Math.floor(x) & 3)];
    const row = clamp(Math.floor((y + 60 + bay * 8 - 4) / 24), 0, 4);
    let c = SKY[Math.min(row, skyStep)];
    if (y > 44 && lum > 0.5) c = HAZE[Math.min(2, Math.floor((y - 44) / 6))];
    let I = 0;
    for (const b of beams) {
      const vx = x - b.bx, vy = y - b.by, along = vx * b.dx + vy * b.dy;
      if (along < 0) continue;
      const perp = Math.abs(vx * b.dy - vy * b.dx), wdt = 1.2 + along * 0.055;
      if (perp > wdt) continue;
      const f = 1 - perp / wdt;
      I += b.k * (0.35 + 0.65 * f * f) * (1 - along / 260);
    }
    I *= beamK;
    if (I > 0.12) c = BEAM[Math.min(5, Math.floor(I * 4.2))];
    return c;
  });

  // stars, twinkling, hidden by the beams' light
  for (let i = 0; i < 60; i++) {
    const sx = Math.floor((rand(o.seed, i, 1) - 0.5) * W), sy = Math.floor(-58 + rand(o.seed, i, 2) ** 1.4 * 84);
    const tw = 0.5 + 0.5 * Math.sin(t * (2 + rand(o.seed, i, 3) * 3) + i);
    if (!SKY.includes(p.get(sx, sy))) continue;
    const bright = rand(o.seed, i, 4) < 0.25;
    p.dot(sx, sy, bright && tw > 0.6 ? hex("#e6e8f8") : tw > 0.5 ? hex("#8a90b0") : hex("#4a5070"), lum);
    if (bright) p.light(sx, sy, hex("#9aa4ff"), 0.15 * tw * lum);
  }
  // the lamps' light where the beams leave the frame's bottom edge, and soft light down each beam
  for (const b of beams) {
    p.glow(b.bx + b.dx * 8, 58, 14, hex("#fff1d0"), 0.22 * beamK);
    p.glowLine(b.bx, b.by, b.bx + b.dx * 120, b.by + b.dy * 120, 7, hex("#c9d2ff"), 0.05 * beamK);
  }
  // the warm pool behind the emblem
  p.glow(0, -6, 92, C[2], 0.2 * glow);
  p.glow(0, -12, 48, C[3], 0.2 * glow * seg(t, G0, G0 + 0.8));
  // the moment the beams lock: a star flares where all three cross, and the emblem grows out of it
  const lk = seg(t, LOCK - 0.05, LOCK + 0.45);
  if (lk > 0 && lk < 1) {
    const g = lk < 0.2 ? ease.outBack(lk / 0.2) : 1 - ease.inQuad((lk - 0.2) / 0.8);
    p.glow(0, -18, 10 + 26 * g, C[4], 0.5 * g);
    const n = Math.round(9 * g);
    for (let d = 1; d <= n; d++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(dx * d, -18 + dy * d, d > n * 0.6 ? C[3] : C[5]);
    p.px(0, -18, WHITE);
  }

  // the logo: shadow first, then each pixel. The G builds out of the light from its middle; letters rise in turn.
  const out = seg(t, OUT0, OUT1), dim = Math.floor(out * 4.5);
  const sweep = seg(t, SHINE0, SHINE1);
  const shineX = lerp(LOGO.x0 - 30, LOGO.x1 + 30, ease.inOutSine(sweep));
  for (let pass = 0; pass < 2; pass++)
    for (const q of LOGO.px) {
      let born, lift = 0;
      if (q.li < 0 && q.part !== "rule") {
        // the emblem: pixels light up from its center outwards, flashing white as they arrive
        const d = Math.hypot(q.x, q.y + 18) / 22;
        born = t - (G0 + d * 0.45 + rand(q.x, q.y, 7) * 0.12);
      } else if (q.part === "good" || q.part === "watch") {
        born = t - (LET0 + q.li * 0.075);
        lift = born < 0.3 ? Math.round(5 * (1 - ease.outBack(clamp(born / 0.3)))) : 0;
      } else if (q.part === "pics") born = t - (PICS0 + (q.li - 9) * 0.04);
      else born = t - (PICS0 + 0.15 + Math.abs(q.x) / 53 * 0.35);
      if (born <= 0) continue;
      const y = q.y + lift, a = clamp(born / 0.12);
      if (pass === 0) {
        const ka = a * (1 - out);
        if (q.top) p.dot(q.x, y - 1, INK, ka * 0.7);
        if (q.left) p.dot(q.x - 1, y, INK, ka * 0.7);
        if (q.right) p.dot(q.x + 1, y, INK, ka);
        if (q.bot) p.dot(q.x, y + 1, INK, ka), p.dot(q.x + 1, y + 1, INK, ka);
        continue;
      }
      let c;
      if (born < 0.07) c = WHITE;
      else if (born < 0.16) c = tone(q, 4);
      else c = tone(q, q.lvl - dim);
      // the shine: a slanted band, white at its heart
      const sd = q.x - shineX - (q.y - LOGO.y0) * 0.45;
      let shine = 0;
      if (sweep > 0 && sweep < 1 && !dim) {
        if (Math.abs(sd) < 1.6) (c = WHITE), (shine = 0.7);
        else if (Math.abs(sd) < 4) (c = tone(q, 4)), (shine = 0.3);
      }
      p.dot(q.x, y, c, a * (dim >= 4 ? 0.5 : 1));
      if (shine) p.light(q.x, y, C[4], shine);
      if (born < 0.07) p.light(q.x, y, C[4], 0.3);
    }
  if (sweep > 0 && sweep < 1) p.glow(shineX + 10, -2, 18, C[4], 0.12 * Math.sin(sweep * Math.PI));

  // glints on the emblem and the letters' corners during the hold
  const GL = [[-11, -30, 5.0, 4], [44, 4, 5.25, 3], [12, -6, 5.45, 3], [-50, 17, 5.7, 3]];
  for (const [gx, gy, t0, arm] of GL) {
    const u = (t - t0) / 0.42;
    if (u <= 0 || u >= 1) continue;
    const g = u < 0.25 ? ease.outBack(u / 0.25) : 1 - ease.inQuad((u - 0.25) / 0.75);
    const n = Math.round(arm * g);
    for (let d = 1; d <= n; d++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(gx + dx * d, gy + dy * d, d === n ? C[3] : C[5]);
    if (n >= 3) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) p.px(gx + dx, gy + dy, C[4]);
    p.px(gx, gy, WHITE);
    p.glow(gx, gy, 6 + n * 2, C[4], 0.35 * g);
  }
}
