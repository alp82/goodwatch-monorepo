// Made for the GoodWatch footer cinema: a fake trailer for a made-up car-chase film, MIDNIGHT MILE.
// The blast recipe (fire puffs that cool into smoke, sparks, embers, burning brands, tumbling debris) follows
// src/fx/explosions/small-explosion.js, adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, Blazes, P, PF, B, Rng, clamp, smooth, ease, rand, lerp, hex, mix, scale, WHITE, TAU } from "../../core/index.js";
import { clip, shaken, wash, type, card, steps, tilted, bake, stamp, lightMap, shine } from "./_trailer.js";

export const meta = {
  name: "Trailer: Midnight Mile",
  desc: "A fake car-chase trailer: title cards, a night highway chase under strobing police lights, a jump over a rising drawbridge, a pursuer's fireball, a chrome title slam.",
  tags: ["cinema", "trailer", "car", "chase", "explosion", "screen", "one-shot"],
  size: [288, 120],
  origin: [144, 60],
  duration: 11.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { w: 288, h: 120, seed: 5 },
};

// ---- the cut: shot boundaries in seconds
const C1 = [0.15, 1.65], B1 = [1.65, 4.1], C2 = [4.1, 5.5], B2 = [5.5, 9.3], TT = [9.45, 11.45];

const h = hex, K = h("#07070c");
// the getaway car: a crimson fastback, facing right; wheels are drawn apart so they spin and the body can bounce
const CAR = [
  "....................................",
  "..............kkkkkkkk..............",
  "............kkhhhhhhhhkk............",
  "..........kkwwgwwwkwwwwwk...........",
  "........kkwwwwgwwwwkwwwwwwk.........",
  "...kkkkkbhhhhhhhhhhhhhhhhhhhkkkk....",
  ".kRhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhYk",
  ".kRbbbkkkkkbbbbbbbbbbbbbbkkkkkbbbbbk",
  ".kdddk.....kdddddddddddddk.....kdddk",
  "..kddk.....kdddddddddddddk.....kddk.",
  "...kk.......kkkkkkkkkkkkk......kk...",
];
const POLICE = [
  "...............LLMMNN...............",
  "..............kkkkkkkk..............",
  "............kkhhhhhhhhkk............",
  "..........kkwwgwwwkwwwwwk...........",
  "........kkwwwwgwwwwkwwwwwwk.........",
  "...kkkkkbhhhhhhPPPPPPPPhhhhhkkkk....",
  ".kRhhhhhhhhhhhPPPPPPPPPPhhhhhhhhhhYk",
  ".kRbbbkkkkkbbbQQQQQQQQQQbbkkkkkbbbbk",
  ".kdddk.....kdddddddddddddk.....kdddk",
  "..kddk.....kdddddddddddddk.....kddk.",
  "...kk.......kkkkkkkkkkkkk......kk...",
];
const PIV = [17.5, 13]; // bottom center, under the wheels
const WHEELS = [[8, 10], [27, 10]];
const PAL_CAR = { k: K, b: h("#5e1620"), h: h("#a8323a"), d: h("#350c14"), R: h("#ff4a4a"), Y: h("#fff0b8"), w: h("#16223a"), g: h("#6d8fc4") };
const PAL_COP = { ...PAL_CAR, b: h("#15161e"), h: h("#3d4152"), d: h("#0b0b12"), P: h("#d8dce8"), Q: h("#8f97ad"), L: h("#ff3344"), M: h("#e8e8f0"), N: h("#3d6dff") };
const TIRE = h("#0d0d12"), RIM = h("#7d8090"), RIM2 = h("#c4c8d6");
const SODIUM = h("#ffb35a"), HEAD = h("#fff0c8"), RED = h("#ff2a3a"), BLUE = h("#3a6cff"), TAIL = h("#ff3030");

// police strobe: red red, blue blue, every half second
function strobe(t, off = 0) {
  const u = (t + off) % 0.5;
  return u < 0.09 || (u > 0.12 && u < 0.21) ? 1 : (u > 0.25 && u < 0.34) || (u > 0.37 && u < 0.46) ? 2 : 0;
}

function wheel(p, x, y, spin, k = 1) {
  p.circle(x, y, 3.2 * k, TIRE);
  p.circle(x, y, 1.7 * k, RIM);
  if (k > 1) p.circle(x, y, 0.9 * k, h("#4a4d5c"));
  for (const s of [0, Math.PI]) {
    const X = x + Math.cos(spin + s) * 1.2 * k, Y = y + Math.sin(spin + s) * 1.2 * k;
    k > 1 ? p.rect(Math.round(X - 0.5), Math.round(Y - 0.5), 2, 2, RIM2) : p.px(X, Y, RIM2);
  }
}

/** A car standing on (x, y) (its wheels' contact point), tilted by ang; susp lifts or drops the body. */
function car(p, rows, pal, x, y, ang, spin, o = {}) {
  const k = o.sc ?? 1, ca = Math.cos(ang), sa = Math.sin(ang), at = (sx, sy) => [x + ((sx - PIV[0]) * ca - (sy - PIV[1]) * sa) * k, y + ((sx - PIV[0]) * sa + (sy - PIV[1]) * ca) * k];
  for (const [wx, wy] of WHEELS) {
    const [X, Y] = at(wx, wy);
    wheel(p, X, Y, spin, k);
  }
  const s = (o.susp ?? 0) * k;
  tilted(p, rows, pal, x - sa * -s, y + ca * s, PIV[0], PIV[1], ang, { tint: o.tint, sc: k });
  const [hx, hy] = at(35, 6), [tx, ty] = at(1, 6);
  if (o.lights !== false) {
    p.glow(tx, ty, 5 * k, TAIL, 0.55);
    p.glow(hx, hy, 6 * k, HEAD, 0.6);
    // the headlight beam: a cone of light ahead of the car
    const L = 70 * k;
    if (o.beam && o.bakedBeam) stamp(p, o.bakedBeam, Math.round(hx), Math.round(hy), o.beam);
    else if (o.beam) for (let d = 4; d < L; d += 6) p.glow(hx + ca * d, hy + sa * d + d * 0.08, 2 + d * 0.16, HEAD, 0.2 * (1 - d / L) * o.beam);
  }
  return at;
}

// ---- the night sky and city, shared by both chase shots
const SKY = ["#05070f", "#080b18", "#0b1021", "#0f152b", "#141a36", "#1b1f40", "#251f45"].map(h);
function sky(p, X0, X1, y0, y1) {
  const n = SKY.length;
  for (let i = 0; i < n; i++) {
    const a = y0 + ((y1 - y0) * i) / n, b = y0 + ((y1 - y0) * (i + 1)) / n;
    p.rect(X0, Math.floor(a), X1 - X0, Math.ceil(b) - Math.floor(a), SKY[i]);
  }
}
const FAR = h("#10142a"), FAR_L = h("#171c38"), NEAR = h("#0a0c19"), NEAR_L = h("#11142a");
const WIN = [h("#f2b45a"), h("#d9944a"), h("#cfd8ff"), h("#8a6a3a")];
function skyline(p, X0, X1, base, scroll, seed, tall, col, edge, lit) {
  const step = 14;
  for (let i = Math.floor((X0 + scroll) / step) - 1; i <= Math.ceil((X1 + scroll) / step); i++) {
    const r = rand(i, seed), bw = 9 + Math.floor(rand(i, seed + 1) * 9), bh = Math.floor(tall * (0.35 + 0.65 * r)), x = i * step - scroll;
    p.rect(x, base - bh, bw, bh, col);
    p.rect(x, base - bh, 1, bh, edge);
    if (rand(i, seed + 2) < 0.3) p.rect(x + 3, base - bh - 4, 1, 4, col);
    if (rand(i, seed + 2) < 0.12) {
      p.px(x + 3, base - bh - 5, RED);
      p.glow(x + 3.5, base - bh - 4.5, 3, RED, 0.25);
    }
    for (let wy = base - bh + 2; wy < base - 2; wy += 3)
      for (let wx = x + 2; wx < x + bw - 1; wx += 2)
        if (rand(wx * 7 + wy, seed + 3 + i) < lit) p.px(wx, wy, WIN[Math.floor(rand(wx, wy + seed) * 4)]);
  }
}

// ---- shot 1: the highway, a close tracking shot on the getaway car (cars at 2x)
const V = 420; // road speed, px/s
const ROAD0 = 2, ROAD1 = 52;
function highwayLayers(W) {
  const X0 = -W / 2, X1 = W / 2;
  return {
    base: bake(X0, -60, W, 120, (p) => {
      sky(p, X0, X1, -60, -4);
      p.rect(X0, -4, W, 6, h("#1c1d29"));
      p.rect(X0, -4, W, 1, h("#4a4d62"));
      p.rect(X0, ROAD0, W, ROAD1 - ROAD0, h("#111119"));
      p.rect(X0, ROAD0, W, 1, h("#2a2b38"));
      p.rect(X0, ROAD1, W, 60 - ROAD1, h("#181822"));
      p.rect(X0, ROAD1, W, 1, h("#5a5d74"));
    }),
    far: bake(X0, -60, W + 60, 57, (p) => skyline(p, X0, X1 + 60, -4, 0, 11, 44, FAR, FAR_L, 0.06)),
    near: bake(X0, -60, W + 220, 60, (p) => skyline(p, X0, X1 + 220, -1, 0, 23, 30, NEAR, NEAR_L, 0.11)),
    // a streetlight: pole, an arm over the road, a sodium lamp, its cone and pool
    lamp: bake(-24, -60, 80, 112, (p) => {
      p.rect(0, -46, 2, 44, h("#22232f"));
      p.rect(0, -46, 16, 1, h("#2a2b39"));
      p.rect(13, -45, 6, 1, SODIUM);
      p.glow(16, -44, 12, SODIUM, 0.65);
      for (let y = -42; y < 50; y += 4) p.glow(16, y, 6 + (y + 42) * 0.24, SODIUM, 0.045);
      p.glow(16, 30, 36, SODIUM, 0.18);
    }),
    beam: bake(0, -30, 150, 60, (p) => { for (let d = 4; d < 140; d += 3) p.glow(d, d * 0.08, 2 + d * 0.16, HEAD, 0.11 * (1 - d / 140)); }),
    police: lightMap(-150, -80, 300, 160, (x, y) => Math.max(0, 1 - Math.hypot(x, y * 1.5) / 150)),
  };
}
function highway(p, t, W, Lr) {
  const X0 = -W / 2, X1 = W / 2, d = t * V;
  stamp(p, Lr.base);
  stamp(p, Lr.far, -Math.round(d * 0.04));
  stamp(p, Lr.near, -Math.round(d * 0.16));
  for (let x = Math.floor(X0 - (d % 8)); x < X1; x += 8) p.rect(x, -1, 1, 3, h("#2a2b3a"));
  for (let x = X0 - (d % 44); x < X1; x += 44) p.rect(Math.round(x), 30, 22, 2, h("#565664"));
  for (let x = X0 - (d % 30); x < X1; x += 30) {
    p.rect(Math.round(x), ROAD1 + 3, 2, 1, h("#ffb030"));
    p.light(Math.round(x), ROAD1 + 3, h("#ffb030"), 0.4);
    p.light(Math.round(x) + 1, ROAD1 + 3, h("#ffb030"), 0.4);
    p.rect(Math.round(x) + 12, ROAD1 + 5, 2, 3, h("#22222e"));
  }
  const sp = 150;
  for (let x = X0 - (d % sp) - 20; x < X1 + 40; x += sp) stamp(p, Lr.lamp, Math.round(x));
}

// speed lines: thin bright streaks rushing past
function speedLines(p, t, X0, X1, k) {
  for (let i = 0; i < 12; i++) {
    const per = 0.22 + rand(i, 41) * 0.2, ph = (t / per + rand(i, 42)) % 1, cyc = Math.floor(t / per + rand(i, 42));
    const y = -50 + Math.floor(rand(cyc, 43 + i) * 100), len = 10 + rand(cyc, 44 + i) * 30, x = X1 + 40 - ph * (X1 - X0 + 120);
    if (y > -12 && y < 2) continue;
    p.line(x, y, x + len, y, (u) => (u < 0.2 ? h("#c8d0f0") : u < 0.6 ? h("#5a6488") : h("#343a58")));
  }
}

// ---- shot 2: the drawbridge over the river, a fixed camera
const HL = -80, HR = 60, LEAF = 70, DECK = 20, WATER = 42;
const leafAng = (s) => Math.min(0.5, 0.26 + 0.13 * s);
const leafTip = (side, a) => (side < 0 ? [HL + Math.cos(a) * LEAF, DECK - Math.sin(a) * LEAF] : [HR - Math.cos(a) * LEAF, DECK - Math.sin(a) * LEAF]);

// slow motion over the jump: scene time s from trailer time
const SPD = 200, CLIMB = 180, LAUNCH = 165, G = 520;
const sEnter = 0.08, sHinge = sEnter + (HL + 170) / SPD, sLaunch = sHinge + LEAF / CLIMB, SLOW = 0.45;
const launch = (() => {
  const a = leafAng(sLaunch), [x, y] = leafTip(-1, a);
  const vx = Math.cos(a) * LAUNCH, vy = -Math.sin(a) * LAUNCH;
  // land on the far leaf's down slope, or the road past it
  let tau = 0.02;
  for (; tau < 2; tau += 0.002) {
    const s = sLaunch + tau, X = x + vx * tau, Y = y + vy * tau + 0.5 * G * tau * tau, b = leafAng(s), [rx, ry] = leafTip(1, b);
    const ground = X > HR ? DECK : X > rx ? ry + ((X - rx) * (DECK - ry)) / (HR - rx) : Infinity;
    if (vy + G * tau > 0 && Y >= ground) break;
  }
  return { a, x, y, vx, vy, tau };
})();
const sLand = sLaunch + launch.tau;
const T_LAUNCH = B2[0] + sLaunch, T_LAND = T_LAUNCH + launch.tau / SLOW;
const sceneTime = (t) => {
  const u = t - B2[0];
  return t < T_LAUNCH ? u : t < T_LAND ? sLaunch + (t - T_LAUNCH) * SLOW : sLand + (t - T_LAND);
};
// the pursuer: a beat behind, launches off a steeper leaf, too slow, and noses into the far leaf's tip
const COP_LAG = 0.42, COP_HIT = 0.07;
const sCopLaunch = sLaunch + COP_LAG + 0.1, sBoom = sCopLaunch + COP_HIT;

function heroAt(s) {
  if (s < sHinge) return { x: -170 + (s - sEnter) * SPD, y: DECK, ang: 0 };
  if (s < sLaunch) {
    const a = leafAng(s), d = (s - sHinge) * CLIMB;
    return { x: HL + Math.cos(a) * d, y: DECK - Math.sin(a) * d, ang: -a };
  }
  const tau = s - sLaunch;
  if (tau < launch.tau) {
    const L = launch, f = tau / L.tau;
    return { x: L.x + L.vx * tau, y: L.y + L.vy * tau + 0.5 * G * tau * tau, ang: lerp(-L.a, 0.38, ease.inQuad(f)), air: true };
  }
  // landed: run down the far leaf onto the road and away, faster and faster
  const u = s - sLand, L = launch, x0 = L.x + L.vx * L.tau, x = x0 + 150 * u + 120 * u * u;
  const b = leafAng(s), [rx, ry] = leafTip(1, b);
  const onLeaf = x < HR, y = onLeaf ? ry + ((x - rx) * (DECK - ry)) / (HR - rx) : DECK;
  return { x, y, ang: onLeaf ? b : 0, u };
}
function copAt(s) {
  const lagged = s - COP_LAG;
  if (lagged < sHinge) return { x: -170 + (lagged - sEnter) * SPD, y: DECK, ang: 0 };
  if (s < sCopLaunch) {
    const a = leafAng(s), d = Math.min(LEAF, (lagged - sHinge) * CLIMB);
    return { x: HL + Math.cos(a) * d, y: DECK - Math.sin(a) * d, ang: -a };
  }
  const a = leafAng(sCopLaunch), [x, y] = leafTip(-1, a), tau = Math.min(s, sBoom) - sCopLaunch;
  return { x: x + Math.cos(a) * 95 * tau, y: y - Math.sin(a) * 95 * tau + 0.5 * G * tau * tau, ang: -a + tau * 2 };
}

const STEEL = h("#262838"), STEEL_L = h("#4b4f68"), STEEL_D = h("#151622"), CONC = h("#1e1f2b"), CONC_L = h("#33354a");
function leafDraw(p, side, a, s) {
  const hx = side < 0 ? HL : HR, dir = side < 0 ? 1 : -1, ca = Math.cos(a) * dir, sa = -Math.sin(a);
  const pt = (d, o) => [hx + ca * d - sa * o * dir * 0, DECK + sa * d + o];
  // deck slab: four px thick, a truss underneath, a railing on top
  for (let o = 1; o <= 4; o++) p.line(hx, DECK + o, hx + ca * LEAF, DECK + sa * LEAF + o, o === 4 ? STEEL_D : STEEL);
  p.line(hx, DECK, hx + ca * LEAF, DECK + sa * LEAF, STEEL_L);
  for (let d = 4; d < LEAF - 2; d += 6) {
    p.line(hx + ca * d, DECK + sa * d + 4, hx + ca * (d + 3), DECK + sa * (d + 3) + 8, STEEL_D);
    p.line(hx + ca * (d + 3), DECK + sa * (d + 3) + 8, hx + ca * (d + 6), DECK + sa * (d + 6) + 4, STEEL_D);
  }
  p.line(hx + ca * 2, DECK + sa * 2 + 8, hx + ca * (LEAF - 2), DECK + sa * (LEAF - 2) + 8, STEEL_D);
  for (let d = 0; d <= LEAF; d += 4) p.line(hx + ca * d, DECK + sa * d - 1, hx + ca * d, DECK + sa * d - 4, h("#2d3044"));
  p.line(hx, DECK - 4, hx + ca * LEAF, DECK + sa * LEAF - 4, h("#3d4058"));
  // the red lamp at the tip, blinking
  const [tx, ty] = [hx + ca * (LEAF - 1), DECK + sa * (LEAF - 1) - 5];
  if (Math.sin(s * 9) > -0.2) {
    p.px(tx, ty, RED);
    p.glow(tx + 0.5, ty + 0.5, 7, RED, 0.5);
  }
  void pt;
}

function bridgeStill(p, W) {
  const X0 = -W / 2, X1 = W / 2;
  sky(p, X0, X1, -60, 10);
  skyline(p, X0, X1, 10, 40, 31, 50, FAR, FAR_L, 0.1);
  p.rect(X0, 10, W, 2, h("#0c0f1e"));
  p.rect(X0, 12, W, 48, h("#060912"));
}
function bridgeBack(p, s, W, Lr) {
  const X0 = -W / 2, X1 = W / 2;
  stamp(p, Lr.back);
  // reflections: broken columns of short dashes under the brighter lights, swaying slowly
  const fr = Math.floor(s * 5);
  for (let i = 0; i < 11; i++) {
    const x = Math.round(X0 + (i + 0.5) * (W / 11) + (rand(i, 63) - 0.5) * 10), c = scale(WIN[Math.floor(rand(i, 62) * 3)], 0.7), c2 = scale(c, 0.6);
    for (let y = 14; y < 58; y += 2) {
      const r = rand(i * 97 + y, fr), depth = (y - 14) / 44;
      if (r < 0.4 + depth * 0.4) continue;
      const wv = Math.round(Math.sin(s * 2 + y * 0.6 + i) * (0.6 + depth * 2)), len = 1 + Math.floor(rand(i + y, fr + 3) * (2 + depth * 3));
      for (let q = 0; q < len; q++) p.px(x + wv - (len >> 1) + q, y, depth < 0.4 ? c : c2);
    }
  }
  for (let y = 16; y < 60; y += 5) {
    const off = (s * 8 + y * 13) % 40;
    for (let x = X0 - off; x < X1; x += 40) p.line(x, y, x + 6 + (y % 3) * 2, y, h("#141a2e"));
  }
}

function bridgeFrontStill(p, W) {
  const X0 = -W / 2, X1 = W / 2;
  // fixed decks, piers and control houses
  for (const [a, b] of [[X0, HL], [HR, X1]]) {
    p.rect(a, DECK, b - a, 4, CONC);
    p.rect(a, DECK, b - a, 1, CONC_L);
    p.rect(a, DECK + 4, b - a, 1, STEEL_D);
    for (let x = a; x < b; x += 4) p.line(x, DECK - 1, x, DECK - 4, h("#2d3044"));
    p.rect(a, DECK - 4, b - a, 1, h("#3d4058"));
  }
  for (const hx of [HL, HR]) {
    p.rect(hx - 9, DECK + 4, 18, 40, CONC);
    p.rect(hx - 9, DECK + 4, 1, 40, CONC_L);
    p.rect(hx - 9, DECK + 12, 18, 1, STEEL_D);
    p.circle(hx, DECK + 1, 2.5, STEEL_L);
    p.px(hx, DECK + 1, K);
  }
  const hut = (x) => {
    p.rect(x, DECK - 15, 12, 11, CONC);
    p.rect(x - 1, DECK - 16, 14, 2, CONC_L);
    p.rect(x + 3, DECK - 12, 6, 3, SODIUM);
    p.glow(x + 6, DECK - 10.5, 9, SODIUM, 0.35);
  };
  hut(HL - 26);
  hut(HR + 14);
  // lamp posts on the decks
  for (const lx of [-128, 112]) {
    p.rect(lx, DECK - 30, 1, 26, h("#2a2b39"));
    p.rect(lx - 2, DECK - 31, 5, 1, SODIUM);
    p.glow(lx + 0.5, DECK - 30, 10, SODIUM, 0.55);
    p.glow(lx + 0.5, DECK - 2, 24, SODIUM, 0.14);
  }
}

// ---- the title: MIDNIGHT MILE in chrome, slammed in
const CHROME = ["#ffffff", "#e3ebff", "#a9bde6", "#6f86c2", "#ffd27a", "#ff8a3a", "#c63a2a"].map(h);

export function create(o) {
  const W = o.w ?? 288, HH = o.h ?? 120, X0 = -W / 2, X1 = W / 2, Y0 = -HH / 2, Y1 = HH / 2;
  const R = new Rng(o.seed);
  const HW = highwayLayers(W);
  const BR = { back: bake(X0, -60, W, 120, (p) => bridgeStill(p, W)), front: bake(X0, -60, W, 120, (p) => bridgeFrontStill(p, W)) };
  const BLAST = lightMap(-170, -120, 340, 240, (x, y) => 0.35 + 0.65 * Math.max(0, 1 - Math.hypot(x, y * 1.4) / 170));
  let blazes;
  const groundAt = (x) => (x < HL || x > HR ? DECK : WATER);
  const ps = new Particles({ rng: R, ground: groundAt, sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#c9281f"], onLand: (x, y) => blazes.add(x, y - 0.25, R.range(0.8, 1.4), R.range(0.5, 0.8)) });
  blazes = new Blazes(ps);
  const splash = new Particles({ rng: R, ground: () => WATER, sparks: ["#e8f6ff", "#a8d8ff", "#5a8ac8", "#2a4a80"] });
  const sp1 = new Particles({ rng: R, ground: () => 53, sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#c9281f"] });
  const bits = new Bits({ ground: groundAt }), lights = new Lights();
  const wreck = { on: false, x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, sunk: false };
  let t = 0, landed = false, boomed = false, sunk = false, scraped = false;

  const boomAt = () => copAt(sBoom);
  return {
    update(dt) {
      t += dt;
      // shot 1: tyre sparks when the getaway car swerves
      if (t > B1[0] + 1.15 && t < B1[0] + 1.7 && R.chance(0.85)) sp1.spawn(P.SPARK, R.range(-8, 30), 51, -R.range(160, 360), -R.range(20, 120), R.range(0.15, 0.4));
      if (!scraped && t > B1[0] + 1.25) scraped = true;
      sp1.update(dt);
      if (t < B2[0]) return;
      const sdt = t < T_LAUNCH || t >= T_LAND ? dt : dt * SLOW, s = sceneTime(t);
      if (!landed && s >= sLand) {
        landed = true;
        const hpos = heroAt(sLand);
        for (let i = 0; i < 26; i++) ps.spawn(P.SPARK, hpos.x + R.range(-8, 8), hpos.y - 1, -R.range(60, 260), -R.range(30, 160), R.range(0.2, 0.55));
        for (let i = 0; i < 5; i++) ps.spawn(P.DUST, hpos.x + R.range(-12, 10), hpos.y - 2, R.range(-50, 20), -R.range(2, 14), R.range(0.4, 0.8), h("#4a4658"), R.range(2, 4));
      }
      if (!boomed && s >= sBoom) {
        boomed = true;
        const b = boomAt(), X = b.x + 14, Y = b.y - 6;
        lights.add(X, Y, 60, WHITE, 0.9, 0.15);
        for (let i = 0; i < 6; i++) ps.spawn(P.FIRE, X + R.range(-3, 3), Y + R.range(-3, 3), R.range(-20, 20), R.range(-40, -10), R.range(0.2, 0.32), 0, R.range(9, 12));
        for (let i = 0; i < 24; i++) {
          const a = R.range(0, TAU), d = R.range(0, 9), v = R.range(40, 200);
          ps.spawn(P.FIRE, X + Math.cos(a) * d, Y + Math.sin(a) * d, Math.cos(a) * v, Math.sin(a) * v * 0.8 - 40, R.range(0.5, 1.15), 0, R.range(4, 8.5), 0, R.chance(0.5) ? PF.SMOKES | PF.BIG : 0);
        }
        for (let i = 0; i < 8; i++) {
          const a = R.range(0, TAU), d = R.range(0, 12);
          ps.spawn(P.SMOKE, X + Math.cos(a) * d, Y + Math.sin(a) * d, Math.cos(a) * 25, -R.range(25, 70), R.range(1.8, 2.8), 0, R.range(6, 10), R.range(0.1, 0.5), PF.BIG);
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.FIRE, X + R.range(-5, 5), Y, R.range(-12, 12), R.range(-170, -100), R.range(0.8, 1.2), 0, R.range(5, 7), R.range(0, 0.1), PF.SMOKES | PF.BIG);
        for (let i = 0; i < 64; i++) {
          const a = R.range(0, TAU), v = R.range(140, 380);
          ps.spawn(P.SPARK, X, Y, Math.cos(a) * v, Math.sin(a) * v - 70, R.range(0.2, 0.7));
        }
        for (let i = 0; i < 26; i++) {
          const a = R.range(0, TAU), v = R.range(30, 150);
          ps.spawn(P.EMBER, X + Math.cos(a) * 6, Y + Math.sin(a) * 6, Math.cos(a) * v, Math.sin(a) * v - 70, R.range(1.2, 2.6), h("#ff8a2a"));
        }
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + R.range(-1.4, 1.4), v = R.range(150, 300);
          ps.spawn(P.BRAND, X, Y, Math.cos(a) * v, Math.sin(a) * v, R.range(0.7, 1.3));
        }
        for (let i = 0; i < 16; i++)
          bits.add({ kind: B.CHUNK, x: X + R.range(-6, 6), y: Y, vx: R.range(-180, 180), vy: -R.range(80, 300), g: 0.9, drag: 0.4, bounce: 0.35, life: R.range(2, 3.2), a: R.range(0, TAU), va: R.range(-16, 16), s: R.range(1, 2.4), ramp: ["#0c0c12", "#22222e", "#3f4152", "#6a6e84", "#a8aec4"] });
        for (let i = 0; i < 10; i++)
          bits.add({ kind: B.SHARD, x: X, y: Y, vx: R.range(-200, 200), vy: -R.range(60, 260), g: 0.8, drag: 0.5, bounce: 0.3, life: R.range(1, 1.8), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1.5, 3), c: R.pick(["#d8dce8", "#ff3344", "#3d6dff", "#a8c8ff"]) });
        Object.assign(wreck, { on: true, x: b.x, y: b.y, vx: -30, vy: -90, a: b.ang, va: 3.2 });
      }
      if (wreck.on && !wreck.sunk) {
        wreck.vy += G * sdt;
        wreck.x += wreck.vx * sdt;
        wreck.y += wreck.vy * sdt;
        wreck.a += wreck.va * sdt;
        if (R.chance(0.7)) ps.spawn(P.FIRE, wreck.x + R.range(-5, 5), wreck.y - 6, R.range(-10, 10), -R.range(10, 40), R.range(0.25, 0.5), 0, R.range(2, 4), 0, R.chance(0.5) ? PF.SMOKES : 0);
        if (wreck.y > WATER + 4) {
          wreck.sunk = true;
          for (let i = 0; i < 30; i++) {
            const a = -Math.PI / 2 + R.range(-0.9, 0.9), v = R.range(60, 220);
            splash.spawn(P.SPARK, wreck.x + R.range(-8, 8), WATER, Math.cos(a) * v, Math.sin(a) * v, R.range(0.3, 0.7));
          }
          for (let i = 0; i < 8; i++) splash.spawn(P.VAPOUR, wreck.x + R.range(-10, 10), WATER - 2, R.range(-30, 30), -R.range(10, 40), R.range(0.6, 1.1), h("#c8dcff"), R.range(3, 6));
          for (let i = 0; i < 4; i++) splash.spawn(P.VAPOUR, wreck.x + R.range(-6, 6), WATER - 3, R.range(-8, 8), -R.range(20, 40), R.range(1, 1.6), h("#9aa8c4"), R.range(3, 5));
        }
      }
      void sunk;
      bits.update(sdt);
      blazes.update(sdt);
      ps.update(sdt);
      splash.update(sdt);
      lights.update(sdt);
    },
    draw(p) {
      clip(p, X0, Y0, X1, Y1, () => {
        if (t >= C1[0] && t < C1[1]) card(p, t - C1[0], [{ s: "THIS FALL", y: -4, c: "#ffffff", track: 2 }]);
        else if (t >= B1[0] && t < B1[1]) drawChase(p, t - B1[0]);
        else if (t >= C2[0] && t < C2[1]) card(p, t - C2[0], [{ s: "ONE LAST RIDE", y: -4, c: "#fbbf24", track: 2 }]);
        else if (t >= B2[0] && t < B2[1]) drawJump(p, t);
        else if (t >= TT[0] && t < TT[1]) drawTitle(p, t - TT[0]);
      });
    },
  };

  function drawChase(p, u) {
    // the police car pulls up in the far lane; the getaway car scrapes the near barrier, then pulls away
    const bob = (x) => Math.round(Math.sin(u * 23 + x) * 0.6);
    const scrape = smooth(1.1, 1.3, u) * (1 - smooth(1.55, 1.8, u));
    const gx = 18 + ease.inQuad(clamp((u - 1.6) / 0.85)) * 26 + Math.sin(u * 1.3) * 2, gy = 48 + Math.round(scrape * 3);
    const cx = -118 + 70 * ease.outCubic(clamp(u / 1.6)) + Math.sin(u * 1.7 + 1) * 3, cy = 30;
    const st = strobe(u), pc = st === 1 ? RED : BLUE;
    highway(p, u, W, HW);
    // police light washing the road and the cars
    if (st) {
      shine(p, HW.police, pc, 0.16, Math.round(cx), Math.round(cy - 26));
      p.glow(cx + 1, cy - 26, 14, pc, 0.7);
    }
    const copPal = { ...PAL_COP, L: st === 1 ? RED : h("#5a1a22"), M: st ? WHITE : h("#8a8a96"), N: st === 2 ? BLUE : h("#1a2450") };
    car(p, POLICE, copPal, cx, cy + bob(1), 0, u * 30, { beam: 1, sc: 2, bakedBeam: HW.beam });
    car(p, CAR, PAL_CAR, gx, gy + bob(0), scrape > 0 && scrape < 1 ? 0.03 : 0, u * 30, { beam: 1, sc: 2, bakedBeam: HW.beam });
    sp1.draw(p);
    speedLines(p, u, X0, X1, 1);
  }

  function drawJump(p, t) {
    const s = sceneTime(t), a = leafAng(s), slow = t >= T_LAUNCH && t < T_LAND;
    const sinceBoom = boomed ? s - sBoom : -1;
    const amp = sinceBoom >= 0 ? 3.5 * Math.max(0, 1 - sinceBoom / 0.55) : 0;
    shaken(p, amp, t, 13, () => {
      bridgeBack(p, s, W, BR);
      ps.draw(p, "back");
      blazes.drawBack(p);
      leafDraw(p, -1, a, s);
      leafDraw(p, 1, a, s);
      stamp(p, BR.front);
      // the cars
      const cop = copAt(s), hero = heroAt(s), spin = s * 60;
      const stc = strobe(s), copPal = { ...PAL_COP, L: stc === 1 ? RED : h("#5a1a22"), N: stc === 2 ? BLUE : h("#1a2450") };
      if (!boomed) {
        car(p, POLICE, copPal, cop.x, cop.y, cop.ang, spin, { beam: 0.8 });
        if (stc) p.glow(cop.x, cop.y - 14, 40, stc === 1 ? RED : BLUE, 0.4);
      } else if (wreck.on && !wreck.sunk) {
        car(p, POLICE, copPal, wreck.x, wreck.y, wreck.a, 0, { lights: false, tint: (c) => mix(c, h("#120c0c"), 0.7) });
      }
      if (hero.x < X1 + 30) {
        const susp = hero.u !== undefined ? Math.round(2.5 * Math.exp(-hero.u * 5) * Math.sin(hero.u * 26 + 1.2)) : 0;
        car(p, CAR, PAL_CAR, hero.x, hero.y, hero.ang, slow ? spin * 0.4 : spin, { beam: 1, susp });
      }
      for (const b of bits.list) if (b.kind === B.CHUNK) void 0;
      bits.draw(p);
      ps.draw(p, "front");
      splash.draw(p);
      lights.draw(p);
      // the blast lights the whole frame, then falls away
      if (sinceBoom >= 0) {
        const k = sinceBoom < 0.05 ? 0.9 : 0.42 * Math.pow(Math.max(0, 1 - sinceBoom / 1.4), 2);
        const b = boomAt();
        shine(p, BLAST, sinceBoom < 0.05 ? WHITE : h("#ff9a50"), k, Math.round(b.x + 14), Math.round(b.y));
      }
      // slow motion reads as a cooler, quieter frame: a faint blue grade
      if (slow) wash(p, X0, Y0, X1, Y1, h("#203060"), 0.08);
    });
    // a single white flash frame on the blast
    if (sinceBoom >= 0 && sinceBoom < 0.034) p.rect(X0, Y0, W, HH, WHITE);
  }

  function drawTitle(p, u) {
    const slamAmp = u < 0.4 ? 3 * (1 - u / 0.4) : 0;
    shaken(p, slamAmp, u, 29, () => {
      // the slam: two frames big and white, then it lands in chrome
      const big = u < 0.067, e = Math.max(0, 1 - u / 0.4);
      if (e > 0) p.glowLine(-140 * e, -5, 140 * e, -5, 2.5, h("#6fa8ff"), 0.9 * e);
      // the road line under the title runs out from the middle, a light racing along it
      const lw = 140 * ease.outCubic(clamp((u - 0.05) / 0.5));
      p.rect(-lw / 2, 9, lw, 1, h("#ffb030"));
      p.glowLine(-lw / 2, 9.5, lw / 2, 9.5, 5, h("#ff8a2a"), 0.4);
      const rx = -70 + ((u * 90) % 140);
      if (u > 0.6) (p.rect(rx, 9, 3, 1, WHITE), p.glow(rx + 1.5, 9.5, 6, h("#ffd27a"), 0.6));
      if (big) type(p, "MIDNIGHT MILE", 0, -16, WHITE, { scale: 3, track: 0, outline: h("#05050a") });
      else type(p, "MIDNIGHT MILE", 0, -12, (gx, gy) => CHROME[gy], { scale: 2, track: 1, outline: h("#05050a"), shadow: h("#2a0a10"), sx: 2, sy: 2 });
      if (u < 0.17) wash(p, X0, Y0, X1, Y1, WHITE, big ? 0.3 : 0.14 * (1 - u / 0.17));
      // a glint runs along the top edge
      const g = clamp((u - 0.75) / 0.6);
      if (g > 0 && g < 1) {
        const gx = -70 + 140 * ease.inOutSine(g);
        p.glow(gx, -12, 8, WHITE, 0.8);
        p.line(gx - 3, -12, gx + 3, -12, WHITE);
        p.line(gx, -15, gx, -9, WHITE);
      }
      const lv = steps(u - 0.6);
      if (lv > 0) type(p, "COMING SOON", 0, 15, mix(h("#0b0b10"), h("#e8e8f0"), lv), { track: 1 });
    });
  }
}
