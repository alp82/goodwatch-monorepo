// Made for the GoodWatch footer cinema: the after-credits stinger's engine: a rapid-fire trivia montage. A DID YOU
// KNOW? cold open, then six facts cut hard one after another (each a big number that slams in on rolling digits with
// a white hit frame, a shake, speed lines and sparks, a label, a typed wink and a small flourish from the stats page's
// own effects), each cut a different pixel transition, and a finale: THANKS FOR WATCHING drops in letter by letter,
// a slot reel spins to 408 YEARS under fireworks, the G emblem pops, and the picture irises closed on it.
// Every fact gets its own full-screen world. Facts come in as options (the player passes real numbers); the defaults
// are a real snapshot.
import { FONTS, seg, ease, clamp, lerp, rand, hex, mix, TAU, WHITE } from "../../core/index.js";
import { WARM, glint } from "./_slides.js";
import { G16, drawG } from "./_brand.js";
import * as trivia from "./trivia.js";
import * as shark from "../stats-page/shark-fin.js";
import * as zombie from "../stats-page/zombie-hand.js";
import * as snow from "../stats-page/snowflake.js";
import * as bolt from "../stats-page/night-bolt.js";
import * as hourglass from "../stats-page/hourglass.js";
import * as fireworks from "../stats-page/fireworks.js";

/** The facts: a number, a label, a wink, a world (its colors and flourish). */
export const FACTS = [
  { n: "777", label: "SHARK MOVIES", sub: "THE WATER WAS NEVER SAFE", world: "sea" },
  { n: "1,054", label: "ZOMBIE MOVIES", sub: "AND THEY KEEP COMING BACK", world: "grave" },
  { n: "4,663", label: "CHRISTMAS MOVIES", sub: "MOST OF THEM ARE THE SAME ONE", world: "snow" },
  { n: "676", label: "HORROR MOVIES", sub: "RELEASED ON A FRIDAY THE 13TH", world: "storm" },
  { n: "16 HOURS", label: "THE LONGEST MOVIE", sub: "LIVE AID. BRING SNACKS.", world: "clock" },
  { n: "1874", label: "THE OLDEST TITLE", sub: "PASSAGE OF VENUS", world: "sepia" },
];
export const FINALE = { thanks: ["THANKS FOR", "WATCHING"], n: "408", unit: "YEARS", sub: "EVERY TITLE HERE, BACK TO BACK" };

/** Seconds: the cold open, each fact, the finale (its own effect, played straight after). */
export const INTRO = 1.0, BEAT = 1.8, FIN = 5.6;
export const durationFor = (n) => INTRO + n * BEAT;
/** When fact i starts (factAt(n) is the end, closed to black). */
export const factAt = (i) => INTRO + i * BEAT;

const INK = hex("#08050a"), BLACK = hex("#0b0b10");
const F = FONTS.big;

// ---- type: per-glyph layout and a clipped glyph painter, so digits can roll inside a reel window
function glyphW(ch) {
  return ch === " " ? F.space : (F.glyphs[ch]?.w ?? 0);
}
function layout(str, s) {
  const out = [];
  let x = 0;
  for (const ch of str) {
    out.push({ ch, x, w: glyphW(ch) * s });
    x += (glyphW(ch) + F.gap) * s;
  }
  return { list: out, w: Math.max(0, x - F.gap * s) };
}
/** One glyph, top-left (x, y), scale s, color c(gy) per row; clip rows to [y0, y1). pass: "ink" | "shadow" | "face". */
function glyph(p, ch, x, y, s, c, pass, y0 = -1e9, y1 = 1e9, sh = INK) {
  const g = F.glyphs[ch];
  if (!g) return;
  for (let gy = 0; gy < F.h; gy++)
    for (let gx = 0; gx < g.w; gx++) {
      if (!g.rows[gy][gx]) continue;
      let X = x + gx * s, Y = y + gy * s, W = s, Hh = s;
      if (pass === "ink") (X -= 1), (Y -= 1), (W += 2), (Hh += 2);
      else if (pass === "shadow") (X += Math.max(1, s >> 1)), (Y += Math.max(1, s >> 1));
      const top = Math.max(Y, y0), bot = Math.min(Y + Hh, y1);
      if (bot <= top) continue;
      p.rect(X, top, W, bot - top, pass === "ink" ? INK : pass === "shadow" ? sh : c(gy));
    }
}
/** A string centered at cx, top y: ink outline, a colored drop shadow, a stepped face. */
function words(p, str, cx, y, s, c, sh, n = Infinity) {
  const L = layout(str, s), x0 = Math.round(cx - L.w / 2);
  const shown = L.list.slice(0, n);
  for (const pass of ["ink", "shadow", "face"])
    for (const g of shown) glyph(p, g.ch, x0 + g.x, Math.round(y), s, c, pass, -1e9, 1e9, sh);
  return { x0, w: L.w };
}
/** A face ramp: a bright top row, then three steps down. */
const face = (a, b, c, d) => (gy) => (gy === 0 ? a : gy < 3 ? b : gy < 5 ? c : d);

// ---- the worlds: colors for the ground, the rays behind the number, the number, its label and its wink
const W = {
  sea: { bg: ["#06101e", "#0a1a30", "#0e2340"], ray: "#102a4a", num: ["#ffffff", "#d8f4ff", "#8fd8ff", "#4aa8e0"], sh: "#0a3a66", label: "#8fd8ff", sub: "#c6e4f4", glow: "#4aa8e0" },
  grave: { bg: ["#070e08", "#0c160e", "#122014"], ray: "#16281a", num: ["#f4ffd8", "#d4f09a", "#a8d066", "#6e9a3c"], sh: "#24401c", label: "#b8e07a", sub: "#d8e8c0", glow: "#7eb048" },
  snow: { bg: ["#080c20", "#0c1430", "#121c40"], ray: "#16224c", num: ["#ffffff", "#eef6ff", "#bcd0ec", "#7a94bc"], sh: "#283c74", label: "#ff6a6a", sub: "#dce8fa", glow: "#bcd0ec" },
  storm: { bg: ["#0c0610", "#140a1a", "#1c0e24"], ray: "#22102c", num: ["#ffffff", "#ffd0d4", "#ff6a74", "#c42838"], sh: "#3a0a18", label: "#d0b8ff", sub: "#e8dcf4", glow: "#ff5a64" },
  clock: { bg: ["#140c04", "#1e1206", "#2a1a08"], ray: "#34200a", num: ["#fff6d0", "#ffe27a", "#fbbf24", "#e0a224"], sh: "#5a3008", label: "#ffd27a", sub: "#f4e4c4", glow: "#fbbf24" },
  sepia: { bg: ["#120e08", "#1c160e", "#262014"], ray: "#2e2618", num: ["#fff4dc", "#f0dcb0", "#d0b480", "#a08454"], sh: "#3e2e18", label: "#e8cc96", sub: "#ece0c8", glow: "#e0c088" },
};
for (const w of Object.values(W)) for (const k of Object.keys(w)) w[k] = Array.isArray(w[k]) ? w[k].map(hex) : hex(w[k]);

/** The ground of a world: three stepped bands toward the middle, slowly turning rays behind the number. */
function ground(p, w, hw, t, lt, k = 1, region = null, flash = 0) {
  const cy = -14, spin = t * 0.22, n = 14;
  const [x0, y0, x1, y1] = region ?? [-hw, -60, hw - 1, 59];
  p.shade(x0, y0, x1, y1, (x, y) => {
    const dx = x, dy = (y - cy) * 1.5, d = Math.hypot(dx, dy);
    const band = d < 70 ? 2 : d < 120 ? 1 : 0;
    let c = w.bg[band];
    if (d > 16) {
      const a = Math.atan2(dy, dx) + spin, s = (((a / TAU) * n) % 1 + 1) % 1;
      if (s < 0.5 && band > 0) c = mix(c, w.ray, k * (band === 2 ? 1 : 0.55));
    }
    return flash ? mix(c, FLASH, flash * (band === 2 ? 0.5 : 0.35)) : c;
  });
}
const FLASH = hex("#6a5aa8");

// ---- cuts: a cover that closes over the old picture and opens on the new, a different one at every cut
const KINDS = ["blinds", "wipe", "dissolve", "flash", "roll", "iris"];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** u: how covered, 0..1; region [x0, y0, x1, y1]; c the cover's color. */
function cover(p, kind, u, region, c, edge) {
  if (u <= 0) return;
  const [x0, y0, x1, y1] = region, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, wd = x1 - x0, ht = y1 - y0;
  if (kind === "flash") {
    // a hard white frame at the cut, a frame of warm afterglow either side
    p.rect(x0, y0, wd, ht, u > 0.66 ? WHITE : u > 0.33 ? WARM.gold6 : BLACK);
    if (u > 0.5) p.glow(cx, cy, 60, WARM.gold5, 0.35 * u);
    return;
  }
  p.shade(x0, y0, x1, y1, (x, y) => {
    const ix = x - x0, iy = y - y0;
    switch (kind) {
      case "blinds": {
        // eight slats closing from their tops, a lit lip on each
        const h = ht / 8, f = (iy % h) / h;
        if (f < u) return f > u - 0.12 && u < 1 ? edge : c;
        return;
      }
      case "wipe": {
        // a diagonal sweep left to right with a hot leading edge
        const e = ix + iy * 0.45 - u * (wd + ht * 0.45 + 6);
        if (e < -3) return c;
        if (e < 0 && u < 1) return edge;
        return;
      }
      case "dissolve": {
        // chunky 3 px pixels flip in a Bayer order
        const b = BAYER[((Math.floor(iy / 3) & 3) << 2) | (Math.floor(ix / 3) & 3)] / 16;
        if (b < u * 1.02) return c;
        return;
      }
      case "roll": {
        // the frame slips: a black band rolls down with a gray frame line at its foot
        const e = u * (ht + 4);
        if (iy < e - 2) return c;
        if (iy < e && u < 1) return edge;
        return;
      }
      case "iris":
      default: {
        const r = (1 - u) * Math.hypot(wd, ht) * 0.55;
        const d = Math.hypot(x - cx, (y - cy) * 1.1);
        if (d > r + 1.2) return c;
        if (d > r && u < 1) return edge;
        return;
      }
    }
  });
}

// ---- a fact's number: rolling digits locking left to right, a slam two sizes down, a white hit frame
const HIT = 0.07;
function slam(lt, s) {
  return lt < 0.035 ? s + 2 : lt < HIT ? s + 1 : s;
}
function number(p, str, cy, s, w, lt, seed) {
  const sc = slam(lt, s), L = layout(str, sc), x0 = Math.round(-L.w / 2), y = Math.round(cy - (F.h * sc) / 2);
  const flash = lt >= HIT && lt < HIT + 0.06;
  const col = flash ? () => WHITE : face(...w.num);
  let di = 0;
  const shown = L.list.map((g) => {
    if (!/[0-9]/.test(g.ch)) return g;
    const lock = 0.06 + 0.07 * di++;
    if (lt >= lock) return g;
    return { ...g, ch: String(Math.floor(rand(seed, di, Math.floor(lt * 40)) * 10)) };
  });
  for (const pass of ["ink", "shadow", "face"])
    for (const g of shown) {
      // a rolling digit sits centered in the final digit's slot
      const dx = Math.round((g.w - glyphW(g.ch) * sc) / 2);
      glyph(p, g.ch, x0 + g.x + dx, y, sc, col, pass, -1e9, 1e9, w.sh);
    }
  return { x0, y, w: L.w, h: F.h * sc };
}

/** The hit: speed lines out of the number, sparks that fly, fall and wink out. */
function impact(p, w, box, lt, seed) {
  const cx = box.x0 + box.w / 2, cy = box.y + box.h / 2, rx = box.w / 2 + 8, ry = box.h / 2 + 6;
  const u = seg(lt, HIT, HIT + 0.22);
  if (u > 0 && u < 1)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + rand(seed, i, 3) * 0.25, ca = Math.cos(a), sa = Math.sin(a);
      const r0 = 1 + u * 10, len = (1 - u) * (8 + rand(seed, i, 4) * 10);
      const x = cx + ca * (rx + r0), y = cy + sa * (ry + r0);
      const y2 = clamp(y + sa * len * 0.8, -59, 58);
      if (y > -59 && y < 58) p.line(x, y, x + ca * len, y2, i % 3 ? w.num[2] : WHITE);
    }
  if (lt >= HIT && lt < 0.9)
    for (let i = 0; i < 12; i++) {
      const age = lt - HIT, a = rand(seed, i, 5) * TAU, sp = 50 + rand(seed, i, 6) * 70;
      const life = 0.35 + rand(seed, i, 7) * 0.4;
      if (age > life) continue;
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp * 0.7 - 30;
      const f = (1 - Math.exp(-4 * age)) / 4;
      const x = cx + Math.cos(a) * rx * 0.8 + vx * f, y = cy + Math.sin(a) * ry * 0.8 + vy * f + 60 * age * age;
      const k = 1 - age / life;
      if (y < -59 || y > 58) continue;
      p.px(x, y, k > 0.6 ? WHITE : w.num[1]);
      if (k > 0.5) p.px(x - Math.sign(vx), y - Math.sign(vy), w.num[2]);
      p.light(x, y, w.glow, 0.5 * k);
    }
  if (lt >= HIT && lt < HIT + 0.3) p.glow(cx, cy, box.w * 0.6, w.glow, 0.3 * (1 - seg(lt, HIT, HIT + 0.3)));
}

/** A small embedded effect at (x, y) at its own time tt, with options. */
function sub(p, mod, x, y, tt, opts = {}) {
  if (tt < 0 || tt >= mod.meta.duration) return;
  const { tx, ty } = p;
  p.place(tx + x, ty + y);
  mod.draw(p, tt, { ...mod.meta.options, ...opts });
  p.place(tx, ty);
}

// ---- each world's flourish, behind (back) or over (front) the words
function flourish(p, world, lt, hw, layer, seed) {
  const by = 46;
  if (world === "sea") {
    if (layer === "back") {
      // a waterline across the bottom, small bubbles rising
      for (let x = -hw; x < hw; x++) p.px(x, by + (Math.sin(x * 0.3 + lt * 6) > 0.85 ? -1 : 0), hex("#1f5a8a"));
      p.rect(-hw, by + 1, hw * 2, 59 - by, hex("#081a30"));
      for (let i = 0; i < 9; i++) {
        const x = -hw + 12 + rand(seed, i, 9) * (hw * 2 - 24), sp = 14 + rand(seed, i, 10) * 10;
        const y = by + 12 - ((lt * sp + rand(seed, i, 11) * 40) % 40);
        if (y < by) continue;
        p.px(x + Math.sin(lt * 5 + i) * 0.8, y, hex("#4a9ad0"));
      }
    } else sub(p, shark, -6, by, 0.05 + lt * 1.18, { len: 150 });
  } else if (world === "grave") {
    if (layer === "back") {
      p.rect(-hw, by + 1, hw * 2, 59 - by, hex("#0a0806"));
      for (let x = -hw; x < hw; x++) if (rand(seed, x, 12) < 0.3) p.px(x, by, hex("#2a3f26"));
      // low fog drifting
      for (let i = 0; i < 6; i++) {
        const x = ((i * 53 + lt * 14) % (hw * 2 - 18)) - hw + 9;
        p.disc(x, by - 2, 9, hex("#3a4a3a"), 0.14);
      }
    } else {
      sub(p, zombie, -80, by, 0.15 + lt * 1.05);
      sub(p, zombie, 82, by, lt * 1.05 - 0.35, { seed: 7 });
    }
  } else if (world === "snow") {
    if (layer === "back") {
      // fine snow across the whole picture
      for (let i = 0; i < 40; i++) {
        const x0 = -hw + 2 + rand(seed, i, 13) * (hw * 2 - 5), sp = 10 + rand(seed, i, 14) * 14;
        const y = ((rand(seed, i, 15) * 120 + lt * sp) % 120) - 60, x = x0 + Math.sin(lt * 2 + i) * 2;
        p.px(x, y, i % 4 ? hex("#7a94bc") : hex("#dce8fa"));
      }
    } else {
      sub(p, snow, -78, -52, lt * 1.15, { w: 50 });
      sub(p, snow, 78, -50, lt * 1.15 - 0.15, { w: 50, seed: 3 });
    }
  } else if (world === "storm") {
    if (layer === "back") {
      // rain on a slant
      for (let i = 0; i < 34; i++) {
        const x0 = -hw - 20 + rand(seed, i, 16) * (hw * 2 + 20), sp = 160 + rand(seed, i, 17) * 60;
        const y = ((rand(seed, i, 18) * 116 + lt * sp) % 116) - 60, x = x0 + (y + 60) * 0.25;
        if (x >= -hw && x < hw - 1) p.line(x, y, x + 1, y + 4, hex("#3a2a52"));
      }
    } else {
      sub(p, bolt, 86, 50, lt - 0.22, { h: 100 });
      sub(p, bolt, -88, 50, lt - 0.95, { h: 96, seed: 9 });
    }
  } else if (world === "clock") {
    if (layer === "back") {
      // a clock face behind the number: twelve ticks and a sweeping hand
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU, r0 = i % 3 ? 46 : 43;
        p.line(Math.cos(a) * r0, -14 + Math.sin(a) * r0 * 0.66, Math.cos(a) * 49, -14 + Math.sin(a) * 49 * 0.66, i % 3 ? hex("#5a3410") : hex("#93591c"));
      }
      const a = -Math.PI / 2 + lt * 2.4;
      p.line(0, -14, Math.cos(a) * 40, -14 + Math.sin(a) * 26, hex("#4a2a0c"));
    } else {
      sub(p, hourglass, -89, -18, lt * 1.05);
      sub(p, hourglass, 89, -18, lt * 1.05 - 0.2, { seed: 4 });
    }
  } else if (world === "sepia") {
    if (layer === "back") {
      // the sun with Venus crossing it, high on the right
      const sx = 82, sy = -34, r = 9;
      p.circle(sx, sy, r, hex("#e0b060"));
      p.circle(sx, sy, r - 2, hex("#f4d090"));
      p.glow(sx, sy, 22, hex("#e0b060"), 0.3);
      const vx = sx - r + 2 + seg(lt, 0.2, 1.8) * (r * 2 - 4);
      p.circle(vx, sy + 2, 1.6, hex("#1c140a"));
    } else {
      // old film: a flicker, scratches, dust
      const fr = Math.floor(lt * 24);
      for (let i = 0; i < 2; i++)
        if (rand(seed, fr, i, 19) < 0.6) {
          const x = -hw + 2 + rand(seed, Math.floor(lt * 3), i, 20) * (hw * 2 - 5);
          p.line(x, -59, x + (rand(seed, fr, i) - 0.5) * 2, 58, hex("#4a3e2a"), 0.5);
        }
      for (let i = 0; i < 4; i++) if (rand(seed, fr, i, 21) < 0.5) p.px(-hw + rand(seed, fr, i, 22) * (hw * 2 - 1), -59 + rand(seed, fr, i, 23) * 117, hex("#0a0806"));
    }
  }
}

/** A fact at its local time lt: number, label, wink, flourish. */
function fact(p, f, lt, hw, t, seed) {
  const w = W[f.world] ?? W.clock;
  // the shake after the hit, settling in steps
  const sk = lt >= HIT && lt < HIT + 0.18 ? Math.round((1 - seg(lt, HIT, HIT + 0.18)) * 2.4) : 0;
  const dx = sk ? (rand(seed, Math.floor(lt * 30), 1) < 0.5 ? -sk : sk) : 0, dy = sk ? (rand(seed, Math.floor(lt * 30), 2) < 0.5 ? -1 : 1) : 0;
  const { tx, ty } = p;
  // the strikes light the whole ground, a frame at a time
  const lit = (b) => (b >= 0 && b < 0.05) || (b >= 0.1 && b < 0.14);
  const flash = f.world === "storm" && (lit(lt - 0.22) || lit(lt - 0.95)) ? 1 : 0;
  ground(p, w, hw, t, lt, 1, null, flash);
  flourish(p, f.world, lt, hw, "back", seed);
  p.place(tx + dx, ty + dy);
  // a wide number drops a size so it keeps clear of the flourishes at the sides
  const wide = layout(f.n, 4).w > 120;
  const ny = -18, s = wide ? 3 : 4;
  // a soft pool of the world's light under the number
  p.glowLine(-40, ny, 40, ny, 20, w.glow, 0.12);
  const box = number(p, f.n, ny, s, w, lt, seed);
  impact(p, w, box, lt, seed);
  // the label rises into place in three steps
  if (lt >= 0.16) {
    const off = lt < 0.2 ? 4 : lt < 0.24 ? 2 : 0;
    words(p, f.label, 0, box.y + box.h + 7 + off, 2, face(WHITE, w.label, w.label, mix(w.label, INK, 0.25)), w.sh);
  }
  // the wink types on
  if (lt >= 0.42) {
    const n = Math.floor((lt - 0.42) * 62);
    words(p, f.sub, 0, box.y + box.h + 28, 1, () => w.sub, w.sh, n);
  }
  flourish(p, f.world, lt, hw, "front", seed);
  p.place(tx, ty);
}

// ---- the finale
function finale(p, ft, hw, t, seed, fin) {
  // light dies with the iris, so nothing glows on the black around it
  const k0 = p.lightK;
  p.lightK = k0 * (1 - 0.85 * ease.inOutCubic(seg(ft, 4.3, 4.95))) * (1 - seg(ft, 5.2, 5.32));
  // ground: deep warm, slow gold rays, a few stars
  ground(p, { bg: [hex("#0c0608"), hex("#140a0c"), hex("#1c0e10")], ray: hex("#2a1410") }, hw, t, ft, 1);
  for (let i = 0; i < 16; i++) {
    const x = -hw + 6 + rand(seed, i, 31) * (hw * 2 - 12), y = -56 + rand(seed, i, 32) * 112;
    const tw = Math.sin(ft * (2 + rand(seed, i, 33) * 3) + i * 1.7);
    if (tw > 0.6) p.px(x, y, tw > 0.9 ? WHITE : WARM.gold3);
  }
  // fireworks behind everything once the number lands
  sub(p, fireworks, -84, -34, ft - 2.15, { r: 16 });
  sub(p, fireworks, 86, -30, ft - 2.45, { r: 15, seed: 5 });
  sub(p, fireworks, -92, -18, ft - 2.95, { r: 10, seed: 8 });
  sub(p, fireworks, 92, -22, ft - 3.3, { r: 10, seed: 3 });

  // THANKS FOR / WATCHING: letters drop and bounce in one by one
  const lines = fin.thanks, cream = face(WARM.gold6, WARM.cream2, WARM.cream1, WARM.cream0);
  lines.forEach((str, li) => {
    const L = layout(str, 2), x0 = Math.round(-L.w / 2), y = li === 0 ? -53 : -37, start = 0.12 + li * 0.42;
    L.list.forEach((g, i) => {
      if (g.ch === " ") return;
      const t0 = start + i * 0.04, u = seg(ft, t0, t0 + 0.3);
      if (u <= 0) return;
      // the first line drops from above, the second springs up from below, so they never cross
      const yy = Math.round(y + (li === 0 ? -1 : 1) * (1 - ease.outBounce(u)) * 22);
      for (const pass of ["ink", "shadow", "face"]) glyph(p, g.ch, x0 + g.x, yy, 2, cream, pass, -60, 60, WARM.red0);
      // a puff of dust where it lands
      const land = ft - (t0 + 0.11);
      if (land > 0 && land < 0.25) {
        const k = land / 0.25, r = 2 + k * 4;
        p.dot(x0 + g.x - r, y + 14, WARM.gold3, 1 - k);
        p.dot(x0 + g.x + g.w + r, y + 14, WARM.gold3, 1 - k);
      }
    });
  });

  // 408 YEARS: three reel windows spin and lock one by one, then the unit slams in
  const R = 4, RW = 26, RH = 34, gap = 3, unit = layout(fin.unit, 3), digits = [...fin.n];
  const reelsW = digits.length * RW + (digits.length - 1) * gap, total = reelsW + 8 + unit.w;
  const rx0 = Math.round(-total / 2), ry = -16, LOCK = [1.5, 1.72, 1.97, 2.2];
  const lockAt = (i) => LOCK[Math.min(i, LOCK.length - 1)] + Math.max(0, i - LOCK.length + 1) * 0.22;
  const appear = seg(ft, 1.1, 1.22);
  let shake = 0;
  digits.forEach((d, i) => {
    const lk = lockAt(i), since = ft - lk;
    if (since >= 0 && since < 0.14) shake = Math.max(shake, Math.round((1 - since / 0.14) * 2));
  });
  const uSince = ft - (lockAt(digits.length - 1) + 0.18);
  if (uSince >= HIT && uSince < HIT + 0.18) shake = Math.max(shake, Math.round((1 - (uSince - HIT) / 0.18) * 3));
  const { tx, ty } = p;
  const sx = shake ? (rand(seed, Math.floor(ft * 30), 3) < 0.5 ? -shake : shake) : 0;
  p.place(tx + sx, ty + (shake ? (rand(seed, Math.floor(ft * 30), 4) < 0.5 ? -1 : 1) : 0));
  // the reels sit centered on their own, then make room as the unit slams in
  const slide = Math.round(((unit.w + 8) / 2) * (1 - ease.outCubic(seg(uSince, 0, 0.12))));
  if (appear > 0) {
    const num = face(...W.clock.num);
    digits.forEach((d, i) => {
      const x = rx0 + slide + i * (RW + gap), lk = lockAt(i), since = ft - lk;
      // the window: an inset with a gold rim that flashes white on the lock
      const rim = since >= 0 && since < 0.08 ? WHITE : WARM.gold3;
      const top = ry + Math.round((1 - appear) * 6);
      p.rect(x - 2, top - 2, RW + 4, RH + 4, WARM.gold1);
      p.rect(x - 1, top - 1, RW + 2, RH + 2, rim);
      p.rect(x, top, RW, RH, hex("#0e0806"));
      p.rect(x, top, RW, 3, hex("#1e120a"));
      p.rect(x, top + RH - 3, RW, 3, hex("#1e120a"));
      const gx = x + Math.round((RW - glyphW("0") * R) / 2), y0 = top + Math.round((RH - F.h * R) / 2);
      if (since < 0) {
        // spinning: a strip of digits scrolling fast, cut by the window
        const sp = 260, off = (ft * sp + i * 11) % RH, k = Math.floor((ft * sp + i * 11) / RH);
        for (const j of [0, 1]) {
          const dd = String((k + j + i * 3) % 10), yy = y0 - Math.round(off) + j * RH;
          glyph(p, dd, gx, yy, R, () => mix(W.clock.num[2], INK, 0.35), "face", top, top + RH);
        }
      } else {
        // locked: a small overshoot and settle
        const bounce = since < 0.05 ? -3 : since < 0.1 ? 1 : 0;
        const c = since < 0.06 ? () => WHITE : num;
        for (const pass of ["shadow", "face"]) glyph(p, d, gx, y0 + bounce, R, c, pass, top, top + RH, W.clock.sh);
        if (since < 0.5) {
          for (let s = 0; s < 6; s++) {
            const a = since * 3, side = s % 2 ? 1 : -1;
            const px = x + RW / 2 + side * (4 + a * 30 + s * 2), py = top + (s < 3 ? -3 : RH + 2) - a * 10 + 40 * a * a;
            if (py < -60 || py > 59) continue;
            p.px(px, py, since < 0.2 ? WHITE : WARM.gold5);
            p.light(px, py, WARM.gold4, 0.5 * (1 - since * 2));
          }
        }
      }
    });
    // the unit, slammed down to scale 3 with a hit frame
    if (uSince >= 0) {
      const sc = slam(uSince, 3), L = layout(fin.unit, sc), ux = rx0 + reelsW + 8 + Math.round((unit.w - L.w) / 2);
      const uy = ry + RH - F.h * sc;
      const c = uSince >= HIT && uSince < HIT + 0.06 ? () => WHITE : face(...W.clock.num);
      for (const pass of ["ink", "shadow", "face"]) for (const g of L.list) glyph(p, g.ch, ux + g.x, uy, sc, c, pass, -1e9, 1e9, W.clock.sh);
      impact(p, W.clock, { x0: rx0, y: ry, w: total, h: RH }, uSince, seed + 3);
    }
    p.glowLine(rx0, ry + RH / 2, rx0 + total, ry + RH / 2, 18, WARM.gold4, 0.1 * appear);
  }
  p.place(tx, ty);
  // the line under it types on
  if (ft >= 2.55) words(p, fin.sub, 0, 24, 1, () => WARM.cream1, WARM.red0, Math.floor((ft - 2.55) * 55));

  // the G pops in at the bottom with a glint, then turns amber as the iris finds it
  const gy = 36, gt = ft - 3.2;
  if (gt >= 0) {
    const amber = ft > 5.0;
    const c = gt < 0.06 ? WHITE : amber ? WARM.gold4 : WHITE;
    drawG(p, G16, -8, gy + (gt < 0.05 ? -2 : gt < 0.1 ? 1 : 0), c, mix(c, INK, 0.5));
    p.glow(0, gy + 8, 14, amber ? WARM.gold4 : WARM.cream1, amber ? 0.4 : 0.22);
    if (gt < 0.6) glint(p, 7, gy + 1, 3 * (1 - gt / 0.6) + 1, WARM.gold5, WARM.gold3, 0.5);
  }
  // the iris closes on the G, holds a breath, shuts
  const close = ease.inOutCubic(seg(ft, 4.3, 4.95)), shut = seg(ft, 5.2, 5.32);
  if (close > 0) {
    const r = lerp(170, 13, close) * (1 - shut);
    p.shade(-hw, -60, hw - 1, 59, (x, y) => {
      const d = Math.hypot(x, (y - (gy + 8)) * 1.05);
      if (d > r + 1) return BLACK;
      if (d > r - 0.2 && r > 2) return WARM.gold2;
    });
  }
  p.lightK = k0;
}

/** The facts at time t: the cold open, then each fact, cut to the next. o: { w, facts, seed }. */
export function drawFacts(p, t, o, D) {
  const hw = (o.w ?? 288) / 2, facts = o.facts ?? FACTS, S = o.seed ?? 7, N = facts.length;
  if (t >= D || t < 0) return;
  const k0 = p.lightK;
  // the cuts: boundary i sits at factAt(i); the cover closes over 0.1 s and opens over 0.12 s; the last one closes to black
  let u = 0, kind = "iris";
  for (let i = 0; i <= N; i++) {
    const b = factAt(i);
    const k = t < b ? seg(t, b - 0.1, b) : i === N ? 1 : 1 - seg(t, b, b + 0.12);
    if (k > u) (u = k), (kind = i === N || i === 0 ? "iris" : KINDS[(i - 1) % KINDS.length]);
  }
  p.lightK = k0 * (1 - u);
  if (t < INTRO) {
    // the cold open: DID YOU KNOW? and its bulb, alone on black, dropped in with a jolt, and a pip per fact to come
    const drop = t < 0.06 ? -6 : t < 0.1 ? 2 : 0;
    trivia.drawHeader(p, t, 44 + drop);
    for (let i = 0; i < N; i++) if (t > 0.45 + i * 0.05) p.rect(-((N - 1) * 6) / 2 + i * 6 - 1, 20, 2, 2, WARM.gold3);
  } else {
    const i = Math.min(N - 1, Math.floor((t - INTRO) / BEAT));
    fact(p, facts[i], t - factAt(i), hw, t, S + i * 17);
    // the pips: done, current, to come
    for (let j = 0; j < N; j++) p.rect(hw - 8 - (N - 1 - j) * 5, 54, 3, 1, j < i ? WARM.gold2 : j === i ? WARM.gold5 : hex("#3a2a20"));
  }
  if (u > 0) cover(p, kind, u, [-hw, -60, hw - 1, 59], BLACK, kind === "roll" ? hex("#3a3a44") : WARM.gold4);
  if (t < 0.08) p.rect(-hw, -60, hw * 2, 120, BLACK, 1 - t / 0.08);
  p.lightK = k0;
}

/** The finale at time t. o: { w, finale, seed }. */
export function drawFinale(p, t, o, D) {
  const hw = (o.w ?? 288) / 2, fin = { ...FINALE, ...(o.finale ?? {}) }, S = o.seed ?? 7;
  if (t >= D || t < 0) return;
  // it opens on an iris out of the facts' black
  const u = 1 - seg(t, 0, 0.16), k0 = p.lightK;
  p.lightK = k0 * (1 - u);
  finale(p, t, hw, t, S, fin);
  if (u > 0) cover(p, "iris", u, [-hw, -60, hw - 1, 59], BLACK, WARM.gold4);
  p.lightK = k0;
}
