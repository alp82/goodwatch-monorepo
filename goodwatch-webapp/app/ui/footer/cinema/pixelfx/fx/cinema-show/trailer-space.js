// Made for the GoodWatch footer cinema: a fake trailer for a made-up space-battle film, IRON NEBULA.
// The blast recipe (fire puffs, sparks, embers, tumbling debris, a flare of light that falls away) follows
// src/fx/explosions/small-explosion.js, adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, clamp, smooth, ease, rand, lerp, fbm, hex, mix, scale, WHITE, TAU } from "../../core/index.js";
import { clip, shaken, wash, type, card, steps, tilted, bake, stamp, lightMap, shine, bakeGrid, drawGrid } from "./_trailer.js";

export const meta = {
  name: "Trailer: Iron Nebula",
  desc: "A fake space-battle trailer: title cards, two fighters weaving through a starfield trading laser fire, a capital ship torn apart by a blast and a ring shockwave, a flare-lit title.",
  tags: ["cinema", "trailer", "space", "battle", "explosion", "screen", "one-shot"],
  size: [288, 120],
  origin: [144, 60],
  duration: 11.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { w: 288, h: 120, seed: 9 },
};

const C1 = [0.15, 1.75], B1 = [1.75, 4.6], C2 = [4.6, 6.0], B2 = [6.0, 9.4], TT = [9.55, 11.5];
const h = hex, K = h("#07070d");

// ---- fighters, side view facing right (drawn at 2x)
const HERO = [
  "..kk............",
  "..kWWk..........",
  ".kWWWWkkk.......",
  "EkWWWWWWWWCCkk..",
  "EkSSSOOSSSSSSSWk",
  ".kSSSSSkk.......",
  "..kSSk..........",
  "..kk............",
];
const FOE = [
  "......kkk.......",
  "kk...kDDDk......",
  "kDk.kDDDk.......",
  "FkRRRRRRRRRRRr..",
  "FkRRRRRRRRRRRRrk",
  "kDk.kDDDk.......",
  "kk...kDDDk......",
  "......kkk.......",
];
const PAL_HERO = { k: K, W: h("#e4e8f2"), S: h("#9aa3b8"), O: h("#ff9a3c"), C: h("#5fd8ff"), E: h("#8ae8ff") };
const PAL_FOE = { k: K, D: h("#5a1a26"), R: h("#a8343e"), r: h("#ff7a5a"), F: h("#ff8a5a") };
const CYAN = h("#5fd8ff"), REDL = h("#ff4a3a"), WARM = h("#ffb060");

// ---- the starfield: three baked layers that scroll at different speeds, plus a nebula
function starLayer(W, seed, n, cols, bright) {
  const L = W * 2;
  return bake(-W / 2, -60, L, 120, (p) => {
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + Math.floor(rand(i, seed) * L), y = -60 + Math.floor(rand(i, seed + 1) * 120), c = cols[Math.floor(rand(i, seed + 2) * cols.length)];
      p.px(x, y, c);
      if (bright && rand(i, seed + 3) < 0.25) {
        p.glow(x + 0.5, y + 0.5, 3, c, 0.5);
        if (rand(i, seed + 4) < 0.4) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + dx, y + dy, scale(c, 0.5));
      }
    }
  });
}
const NEB = ["#0b0a16", "#0f0c1e", "#140f28", "#191330", "#1e2c50"].map(h);
function nebula(W) {
  const L = W * 2;
  return bake(-W / 2, -60, L, 120, (p) => {
    for (let y = -60; y < 60; y++)
      for (let x = -W / 2; x < -W / 2 + L; x++) {
        const u = (x + W / 2) / L, band = 1 - Math.abs(y + 10 - Math.sin(u * TAU) * 22) / 46;
        const v = fbm(x * 0.025, y * 0.06, 4, 4) * 0.8 + band * 0.7 - 0.5;
        if (v < 0.04) continue;
        const i = Math.min(3, Math.floor(v * 6));
        // dithered edges between the steps, a few cold wisps where it is thickest
        const j = rand(x, y) < (v * 6) % 1 ? Math.min(3, i + 1) : i;
        if (j > 0 || rand(x * 7, y) < v * 12) p.px(x, y, v > 0.6 && rand(x * 3, y) < 0.5 ? NEB[4] : NEB[j]);
      }
  });
}
function stars(p, layers, W, d) {
  const L = W * 2;
  for (const [layer, k] of layers) {
    const off = -Math.round((d * k) % W);
    stamp(p, layer, off);
    stamp(p, layer, off + L);
  }
}

// a laser bolt: a white core, a colored body, a soft glow
function bolt(p, x, y, dx, dy, c, len = 10) {
  const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  p.line(x, y, x - ux * len, y - uy * len, c);
  p.line(x, y - 1, x - ux * (len - 3), y - 1 - uy * (len - 3), scale(c, 0.6));
  p.line(x, y, x - ux * 4, y - uy * 4, WHITE);
  p.glowLine(x, y, x - ux * len, y - uy * len, 4, c, 0.55);
}

// ---- the capital ship, baked once: a long wedge hull, panel lines, window rows, a bridge tower, engines
const HULL = { o: h("#0b0c14"), top: h("#69728e"), base: h("#3c4459"), mid: h("#2e3546"), shade: h("#20253a"), under: h("#151827") };
function shipPicture(p) {
  // the hull: a wedge from the engine block at x -86 to the nose at x 86
  p.shade(-92, -26, 92, 18, (x, y, out) => {
    const u = (x + 86) / 172;
    if (u < 0 || u > 1) return;
    const top = lerp(-12, 0, Math.pow(u, 1.3)), bot = lerp(13, 3, Math.pow(u, 1.1));
    if (y < top - 1 || y > bot + 1) return;
    if (y < top || y > bot) return HULL.o;
    const v = (y - top) / (bot - top);
    let c = v < 0.08 ? HULL.top : v < 0.45 ? HULL.base : v < 0.7 ? HULL.mid : v < 0.88 ? HULL.shade : HULL.under;
    // panel seams and plating
    if (Math.floor(x) % 14 === 0 && v > 0.1) c = scale(c, 0.75);
    if (Math.abs(v - 0.45) < 0.03 || Math.abs(v - 0.7) < 0.03) c = scale(c, 0.8);
    if (rand(Math.floor(x / 3), Math.floor(y / 2)) < 0.12 && v > 0.1 && v < 0.85) c = scale(c, 1.12);
    return c;
  });
  // superstructure: a bridge tower and two sensor domes
  p.rect(-50, -22, 20, 12, HULL.base);
  p.rect(-50, -22, 20, 1, HULL.top);
  p.rect(-51, -22, 1, 12, HULL.o);
  p.rect(-30, -22, 1, 12, HULL.o);
  p.rect(-56, -18, 6, 8, HULL.mid);
  p.rect(-46, -26, 2, 4, HULL.mid);
  p.circle(-12, -9, 3, HULL.base);
  p.circle(14, -6, 2.5, HULL.base);
  // windows: warm rows, a lit bridge band
  for (let x = -80; x < 70; x += 2) for (const v of [0.3, 0.58]) {
    const u = (x + 86) / 172, top = lerp(-12, 0, Math.pow(u, 1.3)), bot = lerp(13, 3, Math.pow(u, 1.1)), y = Math.round(top + (bot - top) * v);
    if (rand(x, v * 10) < 0.45) {
      const c = rand(x, 7 + v) < 0.8 ? h("#ffd89a") : h("#bfe4ff");
      p.px(x, y, c);
      p.light(x, y, c, 0.5);
    }
  }
  for (let x = -48; x < -32; x += 2) (p.px(x, -18, h("#bfe4ff")), p.light(x, -18, h("#bfe4ff"), 0.6));
  // engines at the back: three nozzles
  for (const y of [-6, 0, 6]) {
    p.rect(-92, y - 2, 6, 4, HULL.mid);
    p.rect(-93, y - 1, 2, 2, h("#9ae8ff"));
    p.glow(-93, y, 7, h("#5fb8ff"), 0.6);
  }
  // a running light at the nose
  p.px(86, 2, h("#ff5a4a"));
}
const CUT = (y) => 6 + Math.round(Math.sin(y * 1.7) * 3 + Math.sin(y * 0.6) * 2);

export function create(o) {
  const W = o.w ?? 288, HH = o.h ?? 120, X0 = -W / 2, X1 = W / 2, Y0 = -HH / 2, Y1 = HH / 2;
  const R = new Rng(o.seed);
  const SF = [
    [starLayer(W, 11, 140, [h("#3a3f5a"), h("#4a4560"), h("#2e3a58")], false), 0.15],
    [starLayer(W, 23, 70, [h("#8a90b0"), h("#a8a0c8"), h("#7aa0d0")], false), 0.4],
    [starLayer(W, 37, 26, [h("#ffffff"), h("#cfe0ff"), h("#ffe8c8")], true), 1],
  ];
  const NB = nebula(W);
  const SHIP = bakeGrid(-96, -30, 192, 50, shipPicture);
  // the two halves it breaks into, each cut along the jagged seam and cropped to its own box
  const half = (front) => {
    const x0 = front ? 0 : -96, w = front ? 96 : 108;
    return bakeGrid(x0, -30, w, 50, (p) => {
      for (let gy = 0; gy < 50; gy++)
        for (let gx = 0; gx < w; gx++) {
          const X = x0 + gx, Y = -30 + gy, si = (Y + 30) * 192 + X + 96;
          if (X < -96 || X >= 96 || (X >= CUT(Y)) !== front) continue;
          const c = SHIP.c[si], l = SHIP.l[si] & 0xffffff;
          if (c >>> 24) p.px(X, Y, c);
          if (l) p.light(X, Y, l | 0xff000000, 1);
        }
    });
  };
  const FRONT = half(true), REAR = half(false), WHOLE = bake(-96, -30, 192, 50, shipPicture);
  const FLASH = lightMap(-150, -110, 300, 220, (x, y) => 0.3 + 0.7 * Math.max(0, 1 - Math.hypot(x, y * 1.3) / 150));
  const sparkCols = ["#ffffff", "#fff3a6", "#ffc23d", "#ff8a2a"];
  const ps = new Particles({ rng: R, sparks: sparkCols });
  const bits = new Bits(), lights = new Lights();
  let t = 0;
  const ev = {};
  const once = (k, at) => (t >= at && !ev[k] ? (ev[k] = true) : false);

  // ---- beat 1 choreography (u = time since the cut)
  const heroAt = (u) => {
    const climb = smooth(1.75, 2.15, u) - smooth(2.6, 3.0, u) * 0.6;
    return { x: 34 + Math.sin(u * 1.1) * 8 - climb * 10, y: Math.sin(u * 2.3) * 20 * (1 - climb) - climb * 26, ang: Math.cos(u * 2.3) * 0.4 * (1 - climb) - (u > 1.75 && u < 2.15 ? 0.35 : 0) };
  };
  const foeAt = (u) => {
    const past = smooth(1.85, 2.4, u);
    const lag = heroAt(Math.max(0, u - 0.35));
    return { x: -48 + Math.sin(u * 1.4) * 6 + past * 96, y: lerp(lag.y + 3, 6 + Math.sin(u * 2) * 4, past), ang: lag.ang * 0.9 * (1 - past) };
  };
  const FOE_SHOTS = [0.25, 0.5, 0.8, 1.05, 1.3];
  const HIT_SHIELD = 1.3 + 0.32;
  const HERO_SHOTS = [2.3, 2.4, 2.5];
  const FOE_BOOM = 2.62;

  // ---- beat 2 choreography
  const shipX = (u) => -40 + u * 9, TORP = 0.95, CHAIN = [1.15, 1.32, 1.47, 1.6, 1.68], CORE = 1.78;
  const halves = (u) => {
    const k = Math.max(0, u - CORE), e = 1 - Math.exp(-k * 2.2);
    return { front: { dx: 12 * k + 10 * e, dy: -5 * k - 4 * e, a: 0.1 * k + 0.08 * e }, rear: { dx: -8 * k - 7 * e, dy: 5 * k + 3 * e, a: -0.08 * k - 0.06 * e } };
  };

  function blast(x, y, n, size, vel, ramp = 1) {
    lights.add(x, y, 40 * size, WARM, 0.8, 0.5);
    lights.add(x, y, 16 * size, WHITE, 0.8, 0.1);
    for (let i = 0; i < n; i++) {
      const a = R.range(0, TAU), v = R.range(10, vel);
      ps.spawn(P.FIRE, x + R.range(-2, 2) * size, y + R.range(-2, 2) * size, Math.cos(a) * v, Math.sin(a) * v + 60, R.range(0.35, 0.8) * ramp, 0, R.range(2, 4.5) * size);
    }
    for (let i = 0; i < n * 2; i++) {
      const a = R.range(0, TAU), v = R.range(60, 240) * Math.sqrt(size);
      ps.spawn(P.MOTE, x, y, Math.cos(a) * v, Math.sin(a) * v, R.range(0.3, 0.8), R.pick([h("#fff3a6"), h("#ffc23d"), WHITE]), 0.8);
    }
    for (let i = 0; i < Math.round(n * 0.6); i++)
      bits.add({ kind: B.CHUNK, x, y, vx: R.range(-90, 90) * size, vy: R.range(-90, 90) * size, g: 0, drag: 0.5, life: R.range(1.5, 2.6), a: R.range(0, TAU), va: R.range(-9, 9), s: R.range(0.8, 1.8), ramp: ["#0b0c14", "#20253a", "#3c4459", "#69728e", "#aab4d0"] });
  }

  return {
    update(dt) {
      t += dt;
      const u1 = t - B1[0], u2 = t - B2[0];
      if (once("shield", B1[0] + HIT_SHIELD)) {
        const hp = heroAt(HIT_SHIELD);
        for (let i = 0; i < 16; i++) {
          const a = Math.PI + R.range(-1, 1), v = R.range(60, 180);
          ps.spawn(P.MOTE, hp.x - 14, hp.y, Math.cos(a) * v, Math.sin(a) * v, R.range(0.2, 0.5), R.pick([h("#bfeaff"), CYAN, WHITE]), 0.7);
        }
        lights.add(hp.x - 10, hp.y, 30, CYAN, 0.7, 0.3);
      }
      if (once("foeboom", B1[0] + FOE_BOOM)) {
        const f = foeAt(FOE_BOOM);
        blast(f.x, f.y, 16, 1.4, 120);
      }
      if (once("torp", B2[0] + TORP)) {
        const x = shipX(TORP) + 20, y = -2;
        for (let i = 0; i < 22; i++) {
          const a = R.range(-1.6, 1.6), v = R.range(60, 220);
          ps.spawn(P.MOTE, x, y, Math.cos(a) * v, Math.sin(a) * v, R.range(0.2, 0.6), R.pick([CYAN, WHITE, h("#bfeaff")]), 0.8);
        }
        lights.add(x, y, 50, CYAN, 0.9, 0.35);
      }
      CHAIN.forEach((c, i) => {
        if (once("chain" + i, B2[0] + c)) blast(shipX(c) + [24, -10, 40, -30, 8][i], [-4, 4, -2, -6, 2][i], 6, 0.8, 70);
      });
      if (once("core", B2[0] + CORE)) {
        const x = shipX(CORE) + 6, y = 0;
        lights.add(x, y, 90, WHITE, 1, 0.3);
        for (let i = 0; i < 30; i++) {
          const a = R.range(0, TAU), v = R.range(60, 260);
          ps.spawn(P.FIRE, x + R.range(-6, 6), y + R.range(-4, 4), Math.cos(a) * v, Math.sin(a) * v * 0.6 + 50, R.range(0.35, 0.8), 0, R.range(4, 8));
        }
        // the cloud it leaves: soft warm vapour that swells, dims to violet and thins out
        for (let i = 0; i < 16; i++) {
          const a = R.range(0, TAU), v = R.range(15, 70);
          ps.spawn(P.VAPOUR, x + Math.cos(a) * 8, y + Math.sin(a) * 5, Math.cos(a) * v, Math.sin(a) * v * 0.6, R.range(1.2, 2.2), R.pick([h("#ff9a50"), h("#c8607a"), h("#7a4a8a")]), R.range(6, 12), R.range(0.1, 0.4));
        }
        for (let i = 0; i < 110; i++) {
          const a = R.range(0, TAU), v = R.range(80, 380);
          ps.spawn(P.MOTE, x, y, Math.cos(a) * v, Math.sin(a) * v * 0.8, R.range(0.4, 1.3), R.pick([h("#fff3a6"), h("#ffc23d"), WHITE, h("#ff8a2a")]), R.range(0.6, 1.2));
        }
        for (let i = 0; i < 40; i++) {
          const a = R.range(0, TAU), v = R.range(20, 90);
          ps.spawn(P.EMBER, x + Math.cos(a) * 10, y + Math.sin(a) * 6, Math.cos(a) * v, Math.sin(a) * v, R.range(1.2, 2.4), h("#ff8a2a"));
        }
        for (let i = 0; i < 26; i++)
          bits.add({ kind: B.CHUNK, x: x + R.range(-20, 20), y: y + R.range(-6, 6), vx: R.range(-150, 150), vy: R.range(-90, 90), g: 0, drag: 0.35, life: R.range(2, 3), a: R.range(0, TAU), va: R.range(-8, 8), s: R.range(1, 2.8), ramp: ["#0b0c14", "#20253a", "#3c4459", "#69728e", "#aab4d0"] });
        for (let i = 0; i < 14; i++)
          bits.add({ kind: B.SHARD, x, y, vx: R.range(-220, 220), vy: R.range(-120, 120), g: 0, drag: 0.4, life: R.range(1, 2), a: R.range(0, TAU), va: R.range(-15, 15), s: R.range(2, 4), c: R.pick(["#ffd89a", "#aab4d0", "#ffffff"]) });
      }
      // engines and burning wreck halves shed fire
      if (u2 > CORE && u2 < 3.3 && R.chance(0.5)) {
        const H2 = halves(u2), x = shipX(u2) + 6;
        ps.spawn(P.FIRE, x + H2.front.dx + R.range(0, 4), H2.front.dy + R.range(-6, 6), R.range(-10, 20), 40, R.range(0.3, 0.6), 0, R.range(1.5, 3));
        ps.spawn(P.FIRE, x + H2.rear.dx - R.range(0, 4), H2.rear.dy + R.range(-6, 6), R.range(-20, 10), 40, R.range(0.3, 0.6), 0, R.range(1.5, 3));
      }
      void u1;
      ps.update(dt);
      bits.update(dt);
      lights.update(dt);
    },
    draw(p) {
      clip(p, X0, Y0, X1, Y1, () => {
        if (t >= C1[0] && t < C1[1]) card(p, t - C1[0], [{ s: "BEYOND THE LAST STAR", y: -4, c: "#ffffff", track: 1 }], { glow: "#8ab8ff" });
        else if (t >= B1[0] && t < B1[1]) dogfight(p, t - B1[0]);
        else if (t >= C2[0] && t < C2[1]) card(p, t - C2[0], [{ s: "ONE FLEET REMAINS", y: -4, c: "#fbbf24", track: 1 }]);
        else if (t >= B2[0] && t < B2[1]) battle(p, t - B2[0]);
        else if (t >= TT[0] && t < TT[1]) title(p, t - TT[0]);
      });
    },
  };

  function dogfight(p, u) {
    const boom = u - FOE_BOOM;
    shaken(p, boom > 0 && boom < 0.35 ? 2.5 * (1 - boom / 0.35) : 0, u, 17, () => {
      stamp(p, NB, -Math.round((u * 12) % W));
      stamp(p, NB, -Math.round((u * 12) % W) + W * 2);
      stars(p, SF, W, u * 160);
      const hp = heroAt(u), fp = foeAt(u);
      // engine trails: short dotted streams left behind
      for (const [q, c, at] of [[hp, CYAN, heroAt], [fp, h("#ff8a5a"), foeAt]]) {
        if (q === fp && boom > 0) continue;
        for (let i = 1; i < 14; i++) {
          const back = at(Math.max(0, u - i * 0.02));
          p.dot(back.x - 15 - i * 3.2, back.y, i < 4 ? WHITE : c, 1 - i / 14);
        }
        p.glow(q.x - 15, q.y, 7, c, 0.6);
      }
      // the foe's shots: red bolts flying right; the last one hits the hero's shield
      for (const s0 of FOE_SHOTS) {
        const k = u - s0;
        if (k < 0 || k > 0.6) continue;
        const f0 = foeAt(s0), x = f0.x + 16 + k * 280, y = f0.y + (s0 === 1.3 ? 0 : 0);
        const hit = s0 === 1.3 && u >= HIT_SHIELD;
        if (!hit && x < X1 + 20) bolt(p, x, y, 1, 0, REDL, 12);
      }
      // the hero's shots after the reversal: cyan bolts that find the foe
      for (const s0 of HERO_SHOTS) {
        const k = u - s0;
        if (k < 0 || u > FOE_BOOM + (s0 - 2.5) * 0.4) continue;
        const h0 = heroAt(s0), f = foeAt(Math.min(u, FOE_BOOM)), x = lerp(h0.x - 10, f.x, clamp(k / (FOE_BOOM - s0))), y = lerp(h0.y + 4, f.y, clamp(k / (FOE_BOOM - s0)));
        if (k < FOE_BOOM - s0) bolt(p, x, y, f.x - h0.x + 10, f.y - h0.y - 4, CYAN, 10);
      }
      if (boom < 0) tilted(p, FOE, PAL_FOE, fp.x, fp.y, 8, 4, fp.ang, { sc: 2 });
      tilted(p, HERO, PAL_HERO, hp.x, hp.y, 8, 4, hp.ang, { sc: 2 });
      // shield flash: a hex-ish arc on the hero's tail
      const sh = u - HIT_SHIELD;
      if (sh >= 0 && sh < 0.3) {
        const e = 1 - sh / 0.3;
        p.arc(hp.x - 2, hp.y, 20, 1.5, Math.PI * 0.6, Math.PI * 1.4, h("#bfeaff"), e);
        p.glowRing(hp.x - 2, hp.y, 20, 4, CYAN, 0.4 * e);
      }
      if (boom >= 0 && boom < 0.07) {
        const f = foeAt(FOE_BOOM), r = 5 + boom * 90;
        p.circle(f.x, f.y, r * 0.55, WHITE);
        p.ring(f.x, f.y, r, 1.5, h("#ffe8a0"));
      }
      if (boom >= 0 && boom < 0.3) p.ring(foeAt(FOE_BOOM).x, foeAt(FOE_BOOM).y, 8 + boom * 110, 1, h("#ffc23d"), 1 - boom / 0.3);
      bits.draw(p);
      ps.draw(p);
      lights.draw(p);
    });
  }

  function battle(p, u) {
    const sinceCore = u - CORE, x = shipX(u);
    const amp = sinceCore > 0 ? 4 * Math.max(0, 1 - sinceCore / 0.7) : CHAIN.some((c) => u > c && u < c + 0.12) ? 1.2 : 0;
    shaken(p, amp, u, 31, () => {
      stamp(p, NB, -Math.round(u * 4) - 60);
      stars(p, SF, W, u * 20);
      // the ring shockwave's far half goes behind the ship
      const ring = (back) => {
        if (sinceCore < 0.05 || sinceCore > 1.15) return;
        const k = (sinceCore - 0.05) / 1.1, r = 8 + 230 * ease.outCubic(k), cx = x + 6;
        const ramp = ["#2a3a7a", "#5a8ad8", "#bfe4ff", "#ffffff"];
        for (let j = 0, m = Math.ceil(r * 2.2); j < m; j++) {
          const a = (j / m) * TAU, sa = Math.sin(a);
          if ((sa < 0) !== back) continue;
          for (let q = 0; q < 3; q++) {
            const rr = r - q * (1 + 2 * (1 - k));
            p.dot(cx + Math.cos(a) * rr, Math.sin(a) * rr * 0.2, h(ramp[3 - q]), (1 - k) * (q === 0 ? 1.2 : 0.8));
          }
        }
        if (!back) for (const s of [-1, 1]) p.glow(cx + s * r, 0, 18, h("#8ac8ff"), 0.5 * (1 - k));
      };
      ring(true);
      // a few escorts zipping past, the ship's own turret fire
      for (let i = 0; i < 4; i++) {
        const k = (u * 0.6 + i * 0.27) % 1, ex = X1 + 20 - k * (W + 40), ey = -40 + i * 22 + Math.sin(u * 3 + i) * 3;
        if (u > CORE + 0.2) continue;
        p.line(ex, ey, ex + 3, ey, h("#c8d0e0"));
        p.dot(ex + 4, ey, CYAN, 1);
        p.glow(ex + 4, ey, 3, CYAN, 0.4);
      }
      for (let i = 0; i < 6; i++) {
        const s0 = 0.1 + i * 0.13, k = u - s0;
        if (k < 0 || k > 0.5 || u > CORE) continue;
        const sx = x + [-20, 10, 30, -40, 50, 0][i], sy = -10 + (i % 2) * 14;
        p.line(sx + k * 300, sy - k * 120 * (i % 2 ? -1 : 1), sx + k * 300 + 5, sy - (k * 120 + 2) * (i % 2 ? -1 : 1), h("#7dffb0"));
      }
      // the ship: whole, then two halves turning away from each other
      const H2 = halves(u), heat = sinceCore > 0 ? Math.max(0, 1 - sinceCore / 1.6) : clamp((u - CHAIN[0]) / (CORE - CHAIN[0]));
      const crack = (c, gx, gy) => {
        const d = Math.abs(gx - CUT(gy));
        if (heat > 0 && d < 2 + heat * 4) return mix(c, d < 1.5 ? h("#ffe08a") : h("#ff6a2a"), heat * (1 - d / (2 + heat * 4)));
        return c;
      };
      const ight = sinceCore > 0 ? 0.3 : 1;
      if (sinceCore < 0 && heat <= 0) stamp(p, WHOLE, Math.round(x), 0);
      else if (sinceCore < 0) drawGrid(p, SHIP, x, 0, 0, { tint: crack, light: ight });
      else {
        drawGrid(p, REAR, x + H2.rear.dx, H2.rear.dy, H2.rear.a, { tint: crack, light: ight });
        drawGrid(p, FRONT, x + H2.front.dx, H2.front.dy, H2.front.a, { tint: crack, light: ight });
      }
      // the torpedo: a cyan spark racing in from the right
      if (u < TORP) {
        const k = clamp((u - 0.45) / (TORP - 0.45)), tx = lerp(X1 + 10, x + 20, k), ty = lerp(-30, -2, k);
        if (k > 0) {
          for (let i = 1; i < 10; i++) p.dot(tx + i * 4, ty - i * 1.2, i < 3 ? WHITE : CYAN, 1 - i / 10);
          p.circle(tx, ty, 1.5, WHITE);
          p.glow(tx, ty, 9, CYAN, 0.8);
        }
      }
      ring(false);
      bits.draw(p);
      ps.draw(p);
      lights.draw(p);
      // the core blast: a white sphere that swells and cools, light over the whole frame
      if (sinceCore >= 0 && sinceCore < 0.3) {
        // the core: a hot white heart inside stepped rings that swell and cool
        const k = sinceCore / 0.3, r = 10 + 26 * ease.outCubic(k), cx = x + 6;
        p.ring(cx, 0, r, 2, k < 0.4 ? h("#fff3c0") : h("#ffc870"), 1.3 - k);
        p.ring(cx, 0, r * 0.75, 2, h("#ffe08a"), 1.2 - k * 1.2);
        p.circle(cx, 0, r * 0.45 * (1 - k * 0.6), WHITE);
      }
      if (sinceCore >= 0) shine(p, FLASH, sinceCore < 0.1 ? WHITE : WARM, 0.75 * Math.pow(Math.max(0, 1 - sinceCore / 1.6), 2), Math.round(x + 6), 0);
    });
    if (sinceCore >= 0 && sinceCore < 0.034) p.rect(X0, Y0, W, HH, WHITE);
  }

  function title(p, u) {
    // a flare sweeps left to right; the letters are struck where it has passed
    const fx = -110 + 220 * ease.outCubic(clamp(u / 0.8)), e = Math.max(0, 1 - Math.abs(u - 0.4) / 0.5);
    const steel = ["#ffffff", "#dfe6f2", "#b9c4d8", "#8e9ab4", "#6c7894", "#9fdcff", "#3a7ab8"].map(h);
    type(p, "IRON NEBULA", 0, -12, (gx, gy) => steel[gy], { scale: 2, track: 2, outline: h("#05060c"), keep: (gx, gy, Wt) => -Wt + gx * 2 < fx });
    if (e > 0) {
      p.glowLine(fx - 120, -5, fx + 120, -5, 2.5, h("#7ac8ff"), 0.8 * e);
      p.glow(fx, -5, 16, WHITE, 0.8 * e);
      p.glow(fx, -5, 40, h("#7ac8ff"), 0.3 * e);
    }
    // a slow star glint on the O
    const g = clamp((u - 1.0) / 0.8);
    if (g > 0 && g < 1) {
      const k = Math.sin(Math.PI * g), gx = -44, gy = -11;
      p.line(gx - 6 * k, gy, gx + 6 * k, gy, WHITE);
      p.line(gx, gy - 4 * k, gx, gy + 4 * k, WHITE);
      p.glow(gx, gy, 8, WHITE, 0.7 * k);
    }
    const lv = steps(u - 0.9);
    if (lv > 0) type(p, "NEXT SUMMER", 0, 13, mix(h("#0b0b10"), h("#fbbf24"), lv), { track: 1 });
  }
}
