// Made for the GoodWatch footer cinema: a fake trailer for a made-up 1950s creature feature, THE HARBOR BEAST.
// The lightning bolt comes from src/fx/lightning/_lib.js (its shape and inking adapted from Sprite Fusion's
// open-source lightning, https://www.spritefusion.com/pixel-art-vfx/lightning, MIT License, Copyright (c) 2026 Hugo Duprez).
import { Particles, Bits, Lights, P, B, Rng, clamp, smooth, ease, rand, lerp, noise2, hex, mix, scale, WHITE, TAU } from "../../core/index.js";
import { clip, shaken, wash, type, typeWidth, card, steps, bake, stamp, bakeGrid, drawGrid } from "./_trailer.js";
import { zigzag, stroke, VOLT } from "../lightning/_lib.js";

export const meta = {
  name: "Trailer: The Harbor Beast",
  desc: "A fake 1950s creature-feature trailer: the harbor water bulges and glows, a barnacled sea creature rises, coils the lighthouse, bellows and is lit by lightning.",
  tags: ["cinema", "trailer", "monster", "b-movie", "lightning", "screen", "one-shot"],
  size: [288, 120],
  origin: [144, 60],
  duration: 11.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { w: 288, h: 120, seed: 4 },
};

const C1 = [0.15, 1.65], B1 = [1.65, 3.95], C2 = [3.95, 5.35], B2 = [5.35, 9.25], TT = [9.4, 11.5];
const h = hex, WL = 26, MX = 14; // the waterline, the beast's x

// ---- the beast: an original harbor creature. A great barnacled dome (a hood of shell bands) with one big eye and two
// small ones, a wide grim maw, a lure on a stalk that glows over its head, and tentacles that rise round it and coil
// up the lighthouse. Local origin at the waterline, under the dome's middle.
const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
// barnacle bumps on the outline (angle on the dome's edge, radius) and clusters on the shell
const EDGE_BUMPS = [[-2.8, 2.2], [-2.5, 2.6], [-2.25, 1.8], [-2.0, 2.4], [-1.72, 1.7], [-1.45, 2.1], [-1.15, 1.5], [-0.85, 1.9], [-0.5, 1.4], [-3.1, 1.8], [-0.2, 1.6]];
const SHELL_BUMPS = [[-14, -50, 1.8], [-10, -54, 1.2], [-17, -45, 1.4], [-20, -34, 1.7], [-18, -29, 1.1], [21, -50, 1.3], [18, -55, 1.1], [-5, -61, 1.4], [-1, -63, 1], [23, -36, 1.2], [-22, -22, 1.3], [-8, -57, 0.9]];
const MOUTH = { cx: 5, y: -24, hw: 17 };
// the hood: a broad dome, a crown that leans forward over the face, a hump behind, its outline lumpy like old rock
const lumpy = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + 0.1 * noise2(Math.cos(Math.atan2(y - cy, x - cx)) * 2.2 + cx, Math.sin(Math.atan2(y - cy, x - cx)) * 2.2, 7);
const domeIn = (x, y) => lumpy(x, y, 0, -30, 28, 34) || lumpy(x, y, 7, -49, 19, 19) || lumpy(x, y, -12, -42, 14, 17);
// 0 empty, 1 shell, 2 underside, 3 barnacle, 4 maw, 5 tooth, 6 shell band, 7 lip crease
function dome(x, y, m) {
  const mx = (x - MOUTH.cx) / MOUTH.hw;
  if (Math.abs(mx) < 1 && domeIn(x, y)) {
    // a downturned gash: the lower jaw drops, long fangs hang from the upper lip and short ones rise from the lower
    const yc = MOUTH.y + 4 * mx * mx, hh = m * 8 * (1 - mx * mx), top = yc - hh * 0.25, bot = yc + hh;
    if (m > 0.05 && y > top && y < bot) {
      const col = Math.floor(x + 0.5), edge = Math.abs(mx) < 0.8;
      if (edge && col % 4 === 0 && y < top + 3.2) return 5;
      if (edge && col % 4 === 2 && y > bot - 2.2) return 5;
      return 4;
    }
    if (y > top - 0.6 && y < bot + 0.6) return 7;
  }
  // a heavy brow over the great eye
  if (x > -1 && x < 13 && Math.abs(y - (-39.6 - Math.abs(x - 6) * 0.3)) < 0.8 && domeIn(x, y)) return 6;
  for (const [a, r] of EDGE_BUMPS) {
    const bx = Math.cos(a) * 27.5, by = -32 + Math.sin(a) * 34;
    if ((x - bx) ** 2 + (y - by) ** 2 <= r * r) return 3;
  }
  if (!domeIn(x, y)) return 0;
  for (const [bx, by, r] of SHELL_BUMPS) if ((x - bx) ** 2 + (y - by) ** 2 <= r * r) return 3;
  // shell bands: arcs that curve down at the sides, so the hood reads round
  for (const k of [0, 1]) {
    const yb = -62 + k * 8 + ((x - 3) / 26) ** 2 * (7 + k * 3);
    if (Math.abs(y - yb) < 0.5 && Math.abs(x - 3) < 22 - k * 2) return 6;
  }
  return y > -14 ? 2 : 1;
}
const NIGHT = { 1: h("#0c0f1e"), 2: h("#080a14"), 3: h("#1c2236"), 4: h("#3a0a14"), 5: h("#8a8a80"), 6: h("#1a2038"), 7: h("#030409") };
const LIT = { 1: h("#46385e"), 2: h("#30283f"), 3: h("#b4a890"), 4: h("#6a1a24"), 5: h("#ecebd8"), 6: h("#62507e"), 7: h("#1a1224") };
// the hood at night: stepped bands, the crown a little lighter (moon and lure above it), the base sunk in shadow
const NIGHT_BANDS = [[-52, h("#151b32")], [-38, h("#10142a")], [-20, h("#0c0f1e")], [99, h("#080a14")]];
function domeGrid(m, lit) {
  return bakeGrid(-36, -80, 72, 110, (p) => {
    for (let y = -80; y < 30; y++)
      for (let x = -36; x < 36; x++) {
        const k = dome(x + 0.5, y + 0.5, m);
        if (!k) continue;
        const up = dome(x + 0.5, y - 0.5, m), left = dome(x - 0.5, y + 0.5, m), right = dome(x + 1.5, y + 0.5, m), down = dome(x + 0.5, y + 1.5, m);
        let c = (lit ? LIT : NIGHT)[k];
        if (!lit && (k === 1 || k === 2)) c = NIGHT_BANDS.find(([y1]) => y < y1 + (rand(x, 3) < 0.5 ? 0 : 1))[1];
        if (lit && k === 1) c = rand(Math.floor(x / 2) + Math.floor(y / 2) * 7, 5) < 0.3 ? scale(c, 0.82) : c;
        // barnacles: a lit cap and a dark foot
        if (k === 3 && !lit && up === 3) c = h("#0d1120");
        if (k === 3 && lit && down !== 3) c = h("#8a8070");
        // the moonlit rim on edges that face up and left, a cooler second rim inside it, a faint rim on the right
        const rim = !up || !left;
        if (rim && k !== 4) c = lit ? h("#e0e8ff") : y < -30 || x < -12 ? h("#6474a0") : h("#33405e");
        else if (lit && k !== 4 && k !== 5 && (!dome(x + 0.5, y - 1.5, m) || !dome(x - 1.5, y + 0.5, m))) c = scale(c, 1.25);
        else if (!right && k !== 4) c = lit ? h("#7a6a98") : h("#232a44");
        p.px(x, y, c);
      }
  });
}
// a tentacle's spine: from its base (bx, by) upward, swaying with a wave that runs up it (overlapping action) and
// curling at the tip. Returns [x, y, r] per point.
function spine(bx, by, len, lean, phase, amp, curl, r0, t, n = 22) {
  const pts = [];
  let x = bx, y = by;
  const step = len / n;
  for (let i = 0; i <= n; i++) {
    const s = i / n, a = -Math.PI / 2 + lean + amp * Math.sin(t * 1.7 + phase - s * 2.8) * s + curl * s ** 3 * 4.2;
    pts.push([x, y, r0 * (1 - s) ** 0.85 + 0.6]);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
  }
  return pts;
}
// the tentacle drawn from its spine: a moonlit rim up and left, the dark body, pale suckers on its underside when lit
function limb(p, pts, lit, keep, thin = false) {
  const rimC = lit ? h("#e0e8ff") : h("#5a6a96"), body = lit ? LIT[1] : h("#141a30"), under = lit ? h("#6a5a88") : h("#262e4a");
  // a dark edge to part it from the sky, the moonlit side, then the body offset down and right
  if (!thin) for (const [x, y, r] of pts) if (!keep || keep(x, y)) p.circle(x + 0.4, y + 0.3, r + 1.1, lit ? h("#1a1224") : h("#030409"));
  for (const [x, y, r] of pts) if (!keep || keep(x, y)) p.circle(x, y, r + 0.3, rimC);
  for (const [x, y, r] of pts) if (!keep || keep(x, y)) p.circle(x + 0.8, y + 0.6, r, body);
  for (let i = 1; i < pts.length - 2; i += 2) {
    const [x, y, r] = pts[i], [x2, y2] = pts[i + 1], dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1;
    if (keep && !keep(x, y)) continue;
    // the side away from the moon
    const nx = dy / l, ny = -dx / l, sgn = nx + ny > 0 ? 1 : -1;
    if (r > 1.3) p.px(x + 0.8 + nx * sgn * (r - 0.5), y + 0.6 + ny * sgn * (r - 0.5), lit ? h("#e8dcc8") : under);
  }
}
// the tentacle that climbs the lighthouse: up the pier, then a coil round the tower (x 98..102), the tip free above
const TOWER = 100.5;
function coil(g, t, squeeze) {
  const pts = [], n = 46;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    if (s > g) break;
    let x, y, front = true;
    if (s < 0.2) {
      const q = s / 0.2;
      (x = 92 + q * 3 + Math.sin(t * 1.5 + q * 3) * 0.6), (y = WL + 2 - q * 10);
    } else if (s < 0.8) {
      const q = (s - 0.2) / 0.6, ph = Math.PI + q * Math.PI * 4, R = 3.4 - squeeze * 0.5;
      x = TOWER + Math.cos(ph) * R;
      y = WL - 8 - q * 13;
      front = Math.sin(ph) > -0.1;
    } else {
      // the tip rises free over the lantern and curls
      const q = (s - 0.8) / 0.2, a = -Math.PI / 2 + q * 3.4 + Math.sin(t * 2.1) * 0.25;
      x = TOWER - 3.6 + q * 3 + Math.cos(a) * 3 * q;
      y = WL - 21 - q * 6 + Math.sin(a) * 3 * q;
    }
    pts.push([x, y, 1.1 * (1 - s * 0.6) + 0.2, front]);
  }
  return pts;
}

// ---- the harbor at night, baked once
const SKY = ["#04060e", "#060a17", "#091121", "#0d182d", "#13213a", "#1c2c48"].map(h);
const BLD = h("#0a0d18"), BLD_L = h("#121729"), BLD2 = h("#070910"), WIN = [h("#ffd27a"), h("#e8b45a"), h("#fff0c0"), h("#9a7a4a")];
function harbor(p, W) {
  const X0 = -W / 2, X1 = W / 2;
  SKY.forEach((c, i) => p.rect(X0, -60 + i * 13, W, 14, c));
  for (let i = 0; i < 60; i++) {
    const x = X0 + rand(i, 3) * W, y = -60 + rand(i, 4) * 50;
    p.px(x, y, rand(i, 5) < 0.3 ? h("#cfd8ff") : h("#5a6488"));
  }
  // the moon, high on the left, with a soft halo
  p.circle(-78, -38, 7, h("#e8e4cc"));
  p.circle(-80, -40, 2, h("#cfcab0"));
  p.circle(-75, -36, 1.5, h("#cfcab0"));
  p.circle(-77, -34, 1, h("#d8d2b8"));
  p.glow(-78, -38, 26, h("#bfc8e8"), 0.35);
  for (let x = X0; x < X1; x += 24) p.glow(x, 14, 34, h("#3a3050"), 0.22);
  // far skyline, near skyline with lit windows, a harbor crane, the quay
  for (let i = -13; i < 13; i++) {
    const x = i * 12, bh = 14 + Math.floor(rand(i, 7) * 22), bw = 10 + Math.floor(rand(i, 8) * 4);
    p.rect(x, 18 - bh, bw, bh, BLD);
    p.rect(x, 18 - bh, 1, bh, BLD_L);
    if (rand(i, 9) < 0.3) p.rect(x + 4, 18 - bh - 5, 1, 5, BLD);
    for (let wy = 18 - bh + 2; wy < 16; wy += 3) for (let wx = x + 2; wx < x + bw - 1; wx += 2) if (rand(wx * 5 + wy, 11) < 0.2) p.px(wx, wy, WIN[Math.floor(rand(wx, wy) * 4)]);
  }
  for (let i = -8; i < 8; i++) {
    const x = i * 19 + 5, bh = 6 + Math.floor(rand(i, 12) * 10), bw = 14;
    p.rect(x, 20 - bh, bw, bh, BLD2);
    for (let wx = x + 2; wx < x + bw - 2; wx += 3) if (rand(wx, 13) < 0.35) p.px(wx, 20 - bh + 2, WIN[0]);
  }
  // the crane at left
  p.rect(-108, -22, 2, 42, BLD2);
  p.line(-118, -22, -72, -22, BLD2);
  p.line(-107, -30, -118, -22, BLD2);
  p.line(-107, -30, -80, -22, BLD2);
  p.line(-84, -22, -84, -6, h("#1a1e2c"));
  p.px(-107, -31, h("#ff3a3a"));
  p.glow(-106.5, -30.5, 4, h("#ff3a3a"), 0.4);
  p.rect(X0, 20, W, 3, h("#11141f"));
  p.rect(X0, 20, W, 1, h("#232838"));
  for (let x = X0; x < X1; x += 9) p.rect(x, 21, 1, 4, h("#191c28"));
  // the water
  p.rect(X0, 23, W, 37, h("#05070e"));
  // the lighthouse on the pier at right
  p.rect(98, 4, 5, 16, h("#d8d0c0"));
  p.rect(98, 8, 5, 2, h("#a03a30"));
  p.rect(98, 14, 5, 2, h("#a03a30"));
  p.rect(97, 1, 7, 3, h("#20242e"));
  p.rect(92, 19, 20, 2, h("#141822"));
}

// a searchlight beam: a cone of light from (x, y) at angle a, with crisp dim edges
function beam(p, x, y, a, k, len = 150) {
  const ca = Math.cos(a), sa = Math.sin(a);
  for (let d = 6; d < len; d += 7) p.glow(x + ca * d, y + sa * d, 3 + d * 0.09, h("#c8d4ff"), 0.2 * k * (1 - d / len));
  p.glowLine(x, y, x + ca * len * 0.7, y + sa * len * 0.7, 2, h("#dce4ff"), 0.25 * k);
  for (const s of [-1, 1]) {
    const b = a + s * 0.045;
    p.line(x, y, x + Math.cos(b) * len * 0.85, y + Math.sin(b) * len * 0.85, h("#3e4868"), (u) => k * 0.7 * (1 - u));
  }
  p.glow(x, y, 4, WHITE, 0.8 * k);
}

export function create(o) {
  const W = o.w ?? 288, HH = o.h ?? 120, X0 = -W / 2, X1 = W / 2, Y0 = -HH / 2, Y1 = HH / 2;
  const R = new Rng(o.seed);
  const BG = bake(X0, -60, W, 120, (p) => harbor(p, W));
  const GRID = { night: [0, 0.5, 1].map((m) => domeGrid(m, false)), lit: [0, 0.5, 1].map((m) => domeGrid(m, true)) };
  const BOLT = zigzag(new Rng(o.seed + 3), -52, -62, -44, WL, 0.3, 0.5);
  const drops = new Bits({ ground: () => WL }), foam = new Particles({ rng: R, ground: () => WL, sparks: ["#e8f4ff", "#a8c8f0", "#5a7ab0", "#2a3a60"] });
  let t = 0;
  const ev = {};
  const once = (k, at) => (t >= at && !ev[k] ? (ev[k] = true) : false);
  // ---- beat 2 timings (u since its cut)
  const RISE = [0.15, 1.7], EYES = 1.8, LAMP = 2.0, ROAR = [2.3, 3.2], BOLT_T = 2.55;
  const riseY = (u) => 92 * (1 - ease.outCubic(clamp((u - RISE[0]) / (RISE[1] - RISE[0]))));
  const mouth = (u) => (u < ROAR[0] ? 0 : u < ROAR[0] + 0.12 ? (u - ROAR[0]) / 0.12 : u < ROAR[1] - 0.2 ? 1 : u < ROAR[1] ? (ROAR[1] - u) / 0.2 : 0);
  const flashK = (u) => {
    const k = u - BOLT_T;
    return k < 0 ? 0 : k < 0.06 ? 1 : k < 0.1 ? 0.15 : k < 0.2 ? 0.9 : k < 0.45 ? 0.9 * (1 - (k - 0.2) / 0.25) : 0;
  };
  // how hard it bellows (0..1): the tentacles rear and thrash with it
  const roarK = (u) => smooth(ROAR[0] - 0.1, ROAR[0] + 0.1, u) * (1 - smooth(ROAR[1] - 0.2, ROAR[1] + 0.4, u));
  // the tentacles round the dome: base x, length, lean, wave phase, sway, tip curl, base radius, behind the dome, rise window
  const TENTS = [
    { bx: MX - 42, len: 64, lean: -0.3, ph: 0, amp: 0.26, curl: 0.4, r0: 5.2, back: true, rise: [0.35, 1.6] },
    { bx: MX + 40, len: 56, lean: 0.3, ph: 1.9, amp: 0.24, curl: -0.42, r0: 5, back: false, rise: [0.55, 1.8] },
    { bx: -60, len: 34, lean: -0.05, ph: 3.4, amp: 0.34, curl: 0.55, r0: 3, back: true, rise: [0.95, 2.05] },
  ];
  const tent = (T, u) => {
    const e = ease.outCubic(clamp((u - T.rise[0]) / (T.rise[1] - T.rise[0]))), r = roarK(u);
    return spine(T.bx, WL + 4 + (1 - e) * (T.len + 6), T.len, T.lean * (1 + r * 0.5), T.ph, T.amp * (1 + r * 1.6), T.curl * (1 - r * 0.35), T.r0, u * (1 + r * 1.5));
  };
  const coilG = (u) => ease.inOutSine(clamp((u - 0.95) / 1.15));
  // the dome's top edge per local x, for the water running off it
  const TOP = {};
  for (let x = -30; x <= 30; x++) for (let y = -80; y < 0; y++) if (domeIn(x + 0.5, y + 0.5)) { TOP[x] = y; break; }
  // the lure: a stalk off the crown, a glowing bulb hanging in front of the face (local coords, before tilt)
  const lure = (u) => {
    const r = roarK(u), sw = Math.sin(u * 1.3) * 2 + Math.sin(u * 7) * 2.5 * r;
    return { sx: 5, sy: -71, cx: 13 + sw * 0.4, cy: -82 + Math.abs(sw) * 0.2, bx: 21 + sw, by: -74 + Math.sin(u * 2.1) * 1 - r * 2 };
  };

  return {
    update(dt) {
      t += dt;
      const u = t - B2[0];
      // water pours off the dome's sides and drips off the tentacles while it all rises
      if (u > RISE[0] && u < RISE[1] + 1.2) {
        const n = u < RISE[1] ? 1 : 0.35 * (1 - (u - RISE[1]) / 1.2);
        if (R.chance(0.9 * n)) {
          const ly = R.range(-62, -8), half = 29 * Math.sqrt(Math.max(0, 1 - ((ly + 34) / 38) ** 2)), side = R.chance(0.5) ? 1 : -1;
          const sy = WL + ly + riseY(u);
          if (sy < WL - 2) drops.add({ kind: B.DRIP, x: MX + side * (half + 1), y: sy, vx: side * R.range(2, 14), vy: R.range(0, 20), g: 0.8, life: 2, c: R.pick(["#6a88b8", "#4a6290", "#9ab8e0"]) });
        }
        if (R.chance(0.5)) foam.spawn(P.VAPOUR, MX + R.range(-30, 30), WL - 1, R.range(-20, 20), -R.range(2, 10), R.range(0.4, 0.8), h("#8aa0c8"), R.range(2, 4));
      }
      if (u > 0.4 && u < 3.6)
        for (const T of TENTS) if (R.chance(0.12)) {
          const pts = tent(T, u), q = pts[Math.floor(R.range(4, pts.length - 2))];
          if (q[1] < WL - 3) drops.add({ kind: B.DRIP, x: q[0] + R.range(-1, 1), y: q[1] + q[2], vx: R.range(-4, 4), vy: R.range(0, 10), g: 0.8, life: 2, c: R.pick(["#6a88b8", "#9ab8e0"]) });
        }
      if (once("break", B2[0] + RISE[0] + 0.1))
        for (let i = 0; i < 40; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), v = R.range(60, 230);
          foam.spawn(P.SPARK, MX + R.range(-18, 18), WL, Math.cos(a) * v, Math.sin(a) * v, R.range(0.4, 0.9));
        }
      // each tentacle breaks the surface with its own little splash
      TENTS.forEach((T, i) => {
        if (once("tent" + i, B2[0] + T.rise[0] + 0.05)) for (let j = 0; j < 12; j++) {
          const a = -Math.PI / 2 + R.range(-0.9, 0.9), v = R.range(40, 140);
          foam.spawn(P.SPARK, T.bx + R.range(-4, 4), WL, Math.cos(a) * v, Math.sin(a) * v, R.range(0.3, 0.7));
        }
      });
      if (once("bubble", B1[0] + 1.2)) for (let i = 0; i < 6; i++) foam.spawn(P.VAPOUR, MX + R.range(-14, 14), WL, R.range(-6, 6), -R.range(2, 6), R.range(0.5, 0.9), h("#5a6a90"), R.range(1.5, 2.5), R.range(0, 0.8));
      drops.update(dt);
      foam.update(dt);
    },
    draw(p) {
      clip(p, X0, Y0, X1, Y1, () => {
        if (t >= C1[0] && t < C1[1]) card(p, t - C1[0], [{ s: "THE CITY SLEPT", y: -4, c: "#ffffff", track: 1 }], { glow: "#8aa8ff" });
        else if (t >= B1[0] && t < B1[1]) scene(p, t - B1[0], 1);
        else if (t >= C2[0] && t < C2[1]) card(p, t - C2[0], [{ s: "IT WAS NOT ALONE", y: -4, c: "#fbbf24", track: 1 }]);
        else if (t >= B2[0] && t < B2[1]) scene(p, t - B2[0], 2);
        else if (t >= TT[0] && t < TT[1]) title(p, t - TT[0]);
        if ((t >= B1[0] && t < B1[1]) || (t >= B2[0] && t < B2[1]) || (t >= TT[0] && t < TT[1])) film(p);
      });
    },
  };

  // old film: a gate weave of the light, the odd scratch and fleck
  function film(p) {
    const f = Math.floor(t * 24);
    if (rand(f, 71) < 0.1) {
      const x = X0 + Math.floor(rand(f, 72) * W);
      p.line(x, Y0, x + (rand(f, 73) - 0.5) * 4, Y1, h("#9a9488"), 0.35);
    }
    for (let i = 0; i < 2; i++) if (rand(f * 3 + i, 74) < 0.4) p.px(X0 + rand(f, 75 + i) * W, Y0 + rand(f, 77 + i) * HH, h("#c8c0b0"));
  }

  function scene(p, u, beat) {
    const fk = beat === 2 ? flashK(u) : 0, m = beat === 2 ? mouth(u) : 0;
    const bulge = beat === 1 ? smooth(0.9, 2.2, u) : 1 - smooth(0.1, 0.5, u);
    const roarAmp = beat === 2 && u > ROAR[0] && u < ROAR[1] ? 2.5 * (1 - (u - ROAR[0]) / (ROAR[1] - ROAR[0]) * 0.6) : 0;
    const rumble = beat === 1 && u > 1.0 ? 0.8 : beat === 2 && u < RISE[1] ? 1.2 : 0;
    shaken(p, Math.max(roarAmp, rumble), u, 41, () => {
      stamp(p, BG);
      // searchlights sweeping the sky; in the second beat one finds the beast and holds
      const beams = [
        [-96, 12, -1.15 + Math.sin(u * 0.7) * 0.35],
        [-28, 14, -1.9 + Math.sin(u * 0.55 + 1) * 0.4],
        [70, 12, -1.6 + Math.sin(u * 0.8 + 2) * 0.35],
      ];
      if (beat === 2) {
        const lock = smooth(LAMP - 0.4, LAMP, u), target = Math.atan2(WL - 38 - 12, MX + 6 - 70);
        beams[2][2] = lerp(beams[2][2], target, lock);
      }
      for (const [bx, by, a] of beams) beam(p, bx, by, a, 1 - fk * 0.6);
      // the lightning: behind the beast, out over the water
      if (fk > 0.1) {
        stroke(p, BOLT, fk, VOLT.map(h), 1.2, { light: 0.7, hero: fk > 0.95 });
        wash(p, X0, Y0, X1, Y1, h("#bcd0ff"), 0.35 * fk);
      }
      // window lights blinking on and off in the city
      for (let i = 0; i < 5; i++) {
        const on = rand(Math.floor(u * 2 + i * 0.37), 80 + i) < 0.6;
        if (on) p.px(-90 + i * 41, 6 + (i % 3) * 3, WIN[i % 3]);
      }
      // moon path and reflections on the water
      for (let y = WL + 2; y < 60; y += 3) {
        const w = 1 + (y - WL) * 0.12, fr = Math.floor(u * 6), x = -78 + (rand(y, fr) - 0.5) * w * 2;
        if (rand(y, fr + 7) < 0.6) p.line(x - w * 0.5, y, x + w * 0.5, y, (y - WL) < 12 ? h("#7a7a74") : h("#3a3c48"));
      }
      // the city's windows broken up in the harbor
      const fr = Math.floor(u * 5);
      for (let i = 0; i < 14; i++) {
        const x = Math.round(X0 + (i + 0.5) * (W / 14) + (rand(i, 81) - 0.5) * 12), c = scale(WIN[i % 3], 0.6);
        for (let y = WL + 2; y < WL + 22; y += 2) if (rand(i * 31 + y, fr) < 0.5 - (y - WL) * 0.015) p.px(x + Math.round(Math.sin(u * 2 + y + i) * 1.2), y, c);
      }
      for (const [bx, , a] of beams) for (let y = WL + 2; y < 56; y += 3) if (rand(y + bx, Math.floor(u * 5)) < 0.5) p.dot(bx + Math.cos(a) * 30 + Math.sin(u * 3 + y) * 2, y, h("#3a4462"), 0.8);
      // the bulge: the water lifts in a dome, rings spread
      if (bulge > 0) {
        const bh = 11 * bulge, bw = 32 * (0.6 + 0.4 * bulge);
        p.shade(MX - bw, WL - bh - 1, MX + bw, WL, (x, y) => {
          const d = ((x - MX) / bw) ** 2, top = WL - bh * (1 - d);
          if (d > 1 || y < top - 0.5) return;
          return y < top + 1 ? (x < MX ? h("#8a9ac0") : h("#5a6a90")) : y < top + 3 ? h("#1e2a48") : h("#0c1222");
        });
        for (let i = 0; i < 3; i++) {
          const k = ((u * 0.8 + i / 3) % 1), r = bw + k * 60;
          for (let j = 0, m2 = Math.ceil(r * 3); j < m2; j++) {
            const a = (j / m2) * TAU;
            if (Math.sin(a) < 0) continue;
            p.dot(MX + Math.cos(a) * r, WL + 1 + Math.sin(a) * r * 0.12, h("#5a6a98"), (1 - k) * bulge * 1.3);
          }
        }
      }
      // the lure glows under the water before anything breaks the surface
      const preGlow = beat === 1 ? smooth(1.3, 2.2, u) : 1 - smooth(RISE[0], RISE[0] + 0.5, u);
      if (preGlow > 0) {
        const gx = MX + 8 + Math.sin(u * 1.7) * 3;
        p.glow(gx, WL - 1, 14, h("#3ad8c0"), 0.32 * preGlow * (0.8 + 0.2 * Math.sin(u * 6)));
        p.glow(gx, WL - 1, 4, h("#b8fff0"), 0.3 * preGlow);
        // and its shimmer on the water round the bulge
        for (let y = WL + 2; y < WL + 12; y += 2) if (rand(y, Math.floor(u * 8)) < 0.7) p.dot(gx + (rand(y, Math.floor(u * 8) + 3) - 0.5) * 8, y, h("#2a9a8a"), preGlow * (1 - (y - WL) / 12));
      }
      // the beast rising: a dark barnacled dome on the night sky, its tentacles round it, lit in the lightning
      if (beat === 2 && u > RISE[0]) beast(p, u, fk, m);
      drops.draw(p);
      foam.draw(p);
    });
  }

  function beast(p, u, fk, m) {
    const lit = fk > 0.5, r = roarK(u);
    const dy = riseY(u) + (u > RISE[1] ? Math.round(Math.sin(u * 2.4) * 0.8) : 0), tilt = -0.06 * r;
    const ca = Math.cos(tilt), sa = Math.sin(tilt), at = (lx, ly) => [MX + lx * ca - ly * sa, WL + dy + lx * sa + ly * ca];
    const mi = m > 0.75 ? 2 : m > 0.25 ? 1 : 0, g = lit ? GRID.lit[mi] : GRID.night[mi];
    const L = lure(u), [bx, by] = at(L.bx, L.by), up = WL - 0.5, cg = coilG(u);
    clip(p, X0, Y0, X1, WL, () => {
      for (const T of TENTS) if (T.back) limb(p, tent(T, u), lit);
      // the lure's stalk, behind the bulb: a thin dark line with a moonlit top
      const stalk = [];
      for (let i = 0; i <= 14; i++) {
        const q = i / 14, lx = (1 - q) ** 2 * L.sx + 2 * q * (1 - q) * L.cx + q * q * L.bx, ly = (1 - q) ** 2 * L.sy + 2 * q * (1 - q) * L.cy + q * q * L.by;
        stalk.push(at(lx, ly));
      }
      p.polyline(stalk.map(([x, y]) => [x, y - 1]), lit ? h("#e0e8ff") : h("#46557e"));
      p.polyline(stalk, lit ? LIT[1] : NIGHT[1]);
      drawGrid(p, g, MX, WL + dy, tilt);
      for (const T of TENTS) if (!T.back) limb(p, tent(T, u), lit);
      // water running down the shell while it rises: short bright rivulets sliding to the waterline
      const pour = u < RISE[1] + 1.2 ? 1 - smooth(RISE[1] + 0.2, RISE[1] + 1.2, u) : 0;
      if (pour > 0 && !lit)
        for (let i = 0; i < 7; i++) {
          const lx = -20 + i * 7 + Math.floor(rand(i, 61) * 3), top = TOP[lx];
          if (top === undefined) continue;
          const per = 0.8 + rand(i, 62) * 0.5, k = ((u + rand(i, 63) * per) % per) / per, ly = top + 2 + k * 40;
          for (let j = 0; j < 6; j++) {
            const yy = ly - j;
            if (!domeIn(lx + 0.5, yy + 0.5) || dome(lx + 0.5, yy + 0.5, 0) === 7) continue;
            const [X, Y] = at(lx, yy);
            if (Y < up) p.dot(X, Y, j === 0 ? h("#b8d0f0") : j < 3 ? h("#6a88b8") : h("#34466c"), pour * (1 - k * 0.6));
          }
        }
      // the lighthouse: a tentacle climbs out by the pier and coils round the tower (its back turns hidden by it)
      if (cg > 0) limb(p, coil(cg, u, r).filter((q) => q[3] || Math.abs(q[0] - TOWER) > 3), lit, null, true);
    });
    // a searchlight on it lights its face once it has turned
    const lamp = smooth(LAMP - 0.1, LAMP + 0.2, u) * (1 - fk);
    if (lamp > 0) {
      const [fx, fy] = at(6, -40), [gx, gy] = at(0, -30);
      p.glow(fx, fy, 16, h("#aab8e8"), 0.2 * lamp);
      p.glow(gx, gy, 26, h("#8a98c8"), 0.1 * lamp);
    }
    // the lure: a cold bulb that glows from the moment it breaks the surface, lighting the crown under it
    if (by < up) {
      const pulse = 0.85 + 0.15 * Math.sin(u * 5.3);
      p.circle(bx, by, 1.6, h("#3ad8c0"));
      p.px(bx, by, h("#e8fff8"));
      p.px(bx - 1, by, h("#b8fff0"));
      p.glow(bx, by, 5, h("#b8fff0"), 0.55 * pulse);
      p.glow(bx, by, 22, h("#3ad8c0"), 0.26 * pulse * (1 - fk));
      p.dot(bx + Math.sin(u * 4) * 1.5, 2 * WL - by + 3, h("#2a9a8a"), 0.7);
      p.dot(bx + Math.sin(u * 4 + 1) * 1.5, 2 * WL - by + 6, h("#1a6a60"), 0.5);
    }
    // the eyes: one great slit eye, then two small ones, ignite one after another; it blinks once after the bellow
    const blink = u > 3.5 && u < 3.62;
    [[6, -37, 2, EYES], [-5, -43, 1, EYES + 0.12], [16, -45, 1, EYES + 0.2]].forEach(([ex, ey, big, t0]) => {
      const e = smooth(t0, t0 + 0.1, u);
      if (e <= 0) return;
      const [X, Y] = at(ex, ey);
      if (Y > up) return;
      const hot = e > 0.6 ? h("#fff6a0") : h("#c8a020"), iris = h("#ffc23a");
      if (big === 2) {
        if (blink) p.line(X - 3, Y, X + 3, Y, iris);
        else {
          p.line(X - 2, Y - 1, X + 2, Y - 1, iris);
          p.line(X - 3, Y, X + 3, Y, hot);
          p.line(X - 2, Y + 1, X + 2, Y + 1, iris);
          p.line(X, Y - 1, X, Y + 1, h("#2a1004"));
        }
        p.glow(X + 0.5, Y + 0.5, 9 + m * 5, h("#ffd040"), (0.6 + m * 0.35) * e);
      } else {
        if (!blink) p.px(X, Y, hot);
        p.glow(X + 0.5, Y + 0.5, 4 + m * 2, h("#ffd040"), 0.45 * e);
      }
      // reflections in the water
      p.dot(X + Math.sin(u * 5 + ex) * 1.5, 2 * WL - Y + 4, h("#a08020"), (big === 2 ? 0.7 : 0.4) * e);
    });
    // foam where the dome and the tentacles meet the water
    const fr = Math.floor(u * 10);
    for (let x = MX - 30; x < MX + 31; x++) if (rand(x, fr) < 0.5) p.px(x, WL - (rand(x, 3) < 0.3 ? 1 : 0), h("#8aa0c8"));
    for (const T of TENTS) if (u > T.rise[0]) for (let x = T.bx - 5; x < T.bx + 6; x++) if (rand(x, fr + 5) < 0.45) p.px(x, WL, h("#6a80a8"));
    if (cg > 0) for (let x = 89; x < 97; x++) if (rand(x, fr + 9) < 0.4) p.px(x, WL, h("#6a80a8"));
    // the bellow: the maw glows inside, rings roll out of it both ways
    const [mx, my] = at(MOUTH.cx, MOUTH.y);
    if (m > 0.3 && fk < 0.5) p.glow(mx, my, 12, h("#ff4a2a"), 0.4 * m);
    if (m > 0.5) for (let i = 0; i < 3; i++) {
      const k = ((u - ROAR[0]) * 2.2 + i / 3) % 1, rr = 22 + k * 46;
      p.arc(mx, my, rr, 1, -0.45, 0.45, h("#8a96b8"), (1 - k) * 0.6);
      p.arc(mx, my, rr, 1, Math.PI - 0.45, Math.PI + 0.45, h("#8a96b8"), (1 - k) * 0.45);
    }
  }

  function title(p, u) {
    // THE HARBOR BEAST: the letters drop in one by one and bounce, then the paint starts to run
    const word = "HARBOR BEAST", k = 2, tr = 1, Wt = typeWidth(word, "big", k, tr), left = -Wt / 2;
    const theLv = steps(u - 0.85, 0.12);
    if (theLv > 0) type(p, "THE", 0, -29, mix(h("#0b0b10"), h("#f0e8d0"), theLv), { track: 2, shadow: h("#3a0a10"), sx: 1, sy: 1 });
    const FIRE = ["#fff27a", "#ffe04a", "#ffc23a", "#ff9a2a", "#ff6a1e", "#e83a1a", "#b81e18"].map(h);
    let x = left, idx = 0;
    for (const ch of word) {
      const wch = typeWidth(ch, "big", k, 0);
      if (ch !== " ") {
        const t0 = 0.1 + idx * 0.04, q = clamp((u - t0) / 0.3), y = -14 - 60 * (1 - ease.outBounce(q));
        const wob = (gx) => Math.round(Math.sin(u * 3 + (x + gx * k) * 0.15) * 1);
        if (q > 0) {
          type(p, ch, x, y + 3, h("#2a0608"), { scale: k, align: "left", dy: wob });
          type(p, ch, x, y, (gx, gy) => FIRE[gy], { scale: k, align: "left", outline: h("#120204"), dy: wob });
          // drips: paint runs from a few bottom pixels once the letter has landed
          if (q >= 1) for (let d = 0; d < 2; d++) {
            const r = rand(idx * 7 + d, 91), dx = x + Math.floor(r * (wch - 2)) + 1, start = t0 + 0.4 + rand(idx, 92 + d) * 0.5;
            const len = clamp((u - start) / 0.9) * (3 + rand(idx, 94 + d) * 6), bx = dx + 0, by = y + 14 + wob(Math.floor((dx - x) / k));
            if (len > 0.5) {
              p.rect(bx, by, 1, Math.round(len), FIRE[6]);
              p.rect(bx, by + Math.round(len), 1, 1, FIRE[4]);
              if (len > 4) p.rect(bx - 1 + (d % 2) * 2, by + Math.round(len) - 1, 1, 1, FIRE[6]);
            }
          }
        }
        idx++;
      }
      x += wch + tr * k;
    }
    // a single hard flash the moment the last letter lands
    const land = u - (0.1 + 10 * 0.04 + 0.3);
    if (land > 0 && land < 0.07) wash(p, X0, Y0, X1, Y1, h("#ffd8a0"), 0.18);
    // NOW PLAYING flickers on like a marquee sign
    const f = u - 1.0, on = f > 0 && (f > 0.35 || [0.05, 0.12, 0.2, 0.28].some((s) => f > s && f < s + 0.04));
    if (on) {
      type(p, "NOW PLAYING", 0, 16, h("#fbbf24"), { track: 1 });
      p.glowLine(-30, 19.5, 30, 19.5, 8, h("#ffb030"), 0.25);
    } else if (f > 0) type(p, "NOW PLAYING", 0, 16, h("#3a2a10"), { track: 1 });
  }
}
