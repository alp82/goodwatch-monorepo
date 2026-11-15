// Made for the GoodWatch footer cinema: the movie palace around the screen: burgundy wall, stepped gold
// proscenium with a keystone, deco sconces, red velvet main curtains under a swagged valance, and the audience.
import { clamp, mix, hex, seg, rand, TAU } from "../../core/index.js";
import { q, vp, shine, house, lit, fill, rows, pool, crowd, clipped, col, lightRow } from "./_room.js";

export const meta = {
  name: "Room: movie palace",
  desc: "A 1920s movie palace around the screen: burgundy wall, stepped gold proscenium, deco sconces, red velvet curtains that part under a swagged valance, an audience in silhouette.",
  tags: ["cinema", "room", "palace", "curtain", "loop"],
  size: [360, 260],
  origin: [180, 100],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { seed: 1, vl: -180, vr: 180, vt: -100, vb: 160, sw: 222, dim: 1, lum: 0.6, tint: col("#d9b07a"), open: 1, sway: 0 },
};

const WALL = ["#0d0305", "#16050a", "#22080f", "#300c16", "#42111e", "#561826"].map(hex);
const GOLD = ["#160e05", "#2e1d07", "#4e340c", "#765212", "#a2741e", "#cc9c34", "#ecc65e", "#fde8a4"].map(hex);
const VEL = ["#120205", "#25040a", "#3e0811", "#5c0d19", "#821524", "#a82031", "#cc3a40", "#e8705e"].map(hex);
const SEAT = col("#060205"), HEAD = col("#040204");
const LAMP = ["#3a1606", "#6a2e0c", "#b06418", "#f0b048", "#ffe4a0", "#fff8e4"].map(hex);
const WARM = col("#ffb45a");

/** The main curtains t seconds after they start to open: fast start, slow settle, the hems swing and settle. */
export function curtainAt(t) {
  if (t <= 0) return { open: 0, sway: 0 };
  if (t >= 2.5) return { open: 1, sway: 0 };
  const open = 1 - Math.pow(1 - seg(t, 0, 2.3), 3);
  // the hems lag behind as the curtains pull away, swing past and settle
  const sway = Math.exp(-2.4 * t) * Math.sin((TAU * t) / 0.95) * 1.1 * (1 - seg(t, 2.2, 2.5));
  return { open, sway };
}

// the damask lattice: a diamond outline per 12 x 14 cell, its side points left open
const DAMASK = [];
for (let gy = 0; gy < 14; gy++) for (let gx = 0; gx < 12; gx++) if (Math.abs(gx - 6) + Math.abs(gy - 7) === 4 && gy !== 7) DAMASK.push([gx, gy]);
const OPEN_Y = -64, STAGE_Y = 64, BANDS = 13;
const gi = (i) => GOLD[clamp(Math.round(i), 0, 7)];

export function drawBack(p0, t, o) {
  const p = clipped(p0, o);
  const V = vp(o), S = shine(o), H = house(o), hw = (o.sw ?? 222) / 2, ox = hw + 5, open = clamp(o.open ?? 1);
  const spill = S.k * (0.25 + 0.75 * open); // the screen's light on the room, mostly once the curtains part
  // the wall: deep burgundy, a faint damask diamond lattice, brighter with the house lights
  const wi = Math.round(H * 3);
  fill(p, o, V.l, V.t, V.r, V.b, WALL[wi]);
  const dam = WALL[wi + 1];
  for (let cy = Math.floor(V.t / 14) * 14; cy < 78; cy += 14)
    for (let cx = Math.floor(V.l / 12) * 12; cx < V.r; cx += 12)
      for (const [dx, dy] of DAMASK) if (cy + dy >= V.t && cy + dy < 78) p.px(cx + dx, cy + dy, dam);
  // a soft stepped spill of picture light on the wall around the arch
  if (spill > 0.05) pool(p, o, 0, 0, hw + 60, 110, S.c, [0, 0, 0.05 * spill, 0.03 * spill, 0.015 * spill]);

  // sconces on both side walls (off screen on a phone: their glow still reaches in)
  const sx = Math.max(ox + BANDS + 14, Math.min(V.r - 14, ox + BANDS + 18));
  const lamp = Math.max(0.08, H) * (0.94 + 0.06 * (rand(o.seed, Math.floor(t * 12)) > 0.15 ? 1 : 0));
  for (const s of [-1, 1]) sconce(p, o, s * sx, -26, lamp);

  // stage: the dark floor behind the curtain line, the lip with its gold rail, the apron's panels
  fill(p, o, -ox, 60, ox, STAGE_Y, col("#0a0507"));
  const rail = lit(GOLD[2 + Math.round(H * 2)], S, 0.7 * open);
  fill(p, o, -ox - BANDS, STAGE_Y, ox + BANDS, STAGE_Y + 1, rail);
  fill(p, o, -ox - BANDS, STAGE_Y + 1, ox + BANDS, STAGE_Y + 2, GOLD[1 + Math.round(H * 2)]);
  fill(p, o, -ox - BANDS, STAGE_Y + 2, ox + BANDS, 80, WALL[Math.max(0, wi - 1)]);
  for (let x = -ox; x <= ox; x += 24) fill(p, o, x, STAGE_Y + 4, x + 1, 78, WALL[wi + 1]);
  fill(p, o, -ox - BANDS, 79, ox + BANDS, 80, GOLD[Math.round(H * 2)]);

  arch(p, o, ox, S, H, spill);
}

// the proscenium: stepped gold moldings around the opening, a deco field with chevrons, a stepped pediment and
// a keystone over the top. Inner edges catch the screen's light, everything brightens with the house lights.
function arch(p, o, ox, S, H, spill) {
  // band d (0 at the opening, out): base level of the molding profile
  const PROFILE = [1, 5, 3, 3, 1, 4, 2, 2, 2, 2, 1, 5, 0];
  const lvl = (d) => PROFILE[d] - 2 + H * 2.4 + spill * 2.2 * (1 - d / BANDS);
  for (let d = 0; d < BANDS; d++) {
    const c = gi(lvl(d)), y0 = OPEN_Y - d, x = ox + d;
    fill(p, o, -x - 1, y0, -x, 80, c);
    fill(p, o, x, y0, x + 1, 80, c);
    fill(p, o, -x - 1, y0 - 1, x + 1, y0, c);
  }
  // the deco field (bands 6..9): chevrons up the pilasters, a zigzag along the top
  const hi = gi(lvl(5) + 0.5), lo = gi(lvl(4));
  for (const s of [-1, 1]) {
    rows(p, o, s > 0 ? ox + 6 : -ox - 10, OPEN_Y + 2, s > 0 ? ox + 10 : -ox - 6, 78, (x, y) => {
      const u = Math.abs(x - s * (ox + 7.5)) , v = ((y - OPEN_Y) % 9 + 9) % 9;
      return Math.round(v - u * 1.2) === 3 ? hi : Math.round(v - u * 1.2) === 2 ? lo : 0;
    });
  }
  rows(p, o, -ox - 6, OPEN_Y - 10, ox + 6, OPEN_Y - 5, (x, y) => {
    const z = Math.abs(((x % 8) + 8) % 8 - 4) * 0.5 + OPEN_Y - 9;
    return Math.round(z) === y ? hi : Math.round(z) === y - 1 ? lo : 0;
  });
  // pediment: two stepped tiers over the middle of the top band
  const top = OPEN_Y - BANDS;
  let yy = top;
  for (const [hw2, h] of [[92, 5], [64, 6], [36, 7]]) {
    yy -= h;
    fill(p, o, -hw2, yy, hw2, yy + h, gi(lvl(7)));
    fill(p, o, -hw2, yy, hw2, yy + 1, gi(lvl(1)));
    fill(p, o, -hw2 - 1, yy, -hw2, yy + h, gi(lvl(0)));
    fill(p, o, hw2, yy, hw2 + 1, yy + h, gi(lvl(12)));
    for (let x = -hw2 + 4; x < hw2 - 2; x += 6) fill(p, o, x, yy + 2, x + 2, yy + h - 1, gi(lvl(4)));
  }
  // a sunburst fan rising behind the keystone from the top tier
  const ky = yy - 2;
  for (let i = -6; i <= 6; i++) {
    const a = -Math.PI / 2 + i * 0.24, L = i % 2 ? 15 : 24;
    p.line(Math.cos(a) * 9, ky + Math.sin(a) * 9, Math.cos(a) * L, ky + Math.sin(a) * L, gi(lvl(i % 2 ? 4 : 1)));
    if (!(i % 2)) p.px(Math.cos(a) * (L + 2), ky + Math.sin(a) * (L + 2), gi(lvl(5)));
  }
  if (H + spill > 0.3) pool(p, o, 0, ky - 8, 30, 20, GOLD[5], [0.06 * (H + spill), 0.03 * (H + spill), 0.015 * (H + spill)]);
  // the keystone: a tapered block with a stepped deco fan, down into the top band
  rows(p, o, -9, ky - 4, 10, OPEN_Y + 3, (x, y) => {
    const v = (y - (ky - 4)) / (OPEN_Y + 3 - (ky - 4)), w = 9 - v * 4;
    if (Math.abs(x + 0.5) > w) return 0;
    const e = w - Math.abs(x + 0.5);
    if (e < 1) return gi(lvl(x < 0 ? 1 : 12));
    if (y === ky - 4) return gi(lvl(1) + 1);
    // stepped fan: three nested chevrons
    const r = Math.abs(x + 0.5) * 0.9 + (y - ky);
    if (Math.round(r) % 4 === 0 && y > ky - 2) return gi(lvl(5));
    return gi(lvl(3));
  });
  p.px(0, ky + 1, gi(lvl(1) + 1));
  if (H > 0.4 || spill > 0.5) p.light(0, ky + 1, GOLD[6], 0.35 * Math.max(H, spill));
}

// an art deco sconce: a stepped fan of frosted glass on a bronze back, washing the wall up and down
function sconce(p, o, x, y, k) {
  const g = Math.min(5, Math.round(k * 5));
  // the wall wash: a stepped fan of light opening upward, a small one below
  if (k > 0.1) {
    // a fan of light opening up the wall in hard steps, a short one below
    for (let d = 1; d < 44; d++) {
      const w = 4 + d * 0.3, kk = (d < 10 ? 0.3 : d < 22 ? 0.18 : d < 34 ? 0.1 : 0.05) * k;
      const wi = Math.floor(w);
      lightRow(p, o, x - wi + 1, x + wi, y - 4 - d, WARM, kk);
      p.light(x - wi, y - 4 - d, WARM, kk * 1.5); p.light(x + wi, y - 4 - d, WARM, kk * 1.5);
    }
    for (let d = 1; d < 12; d++) {
      const w = 2 + d * 0.25, kk = (d < 5 ? 0.18 : 0.08) * k;
      lightRow(p, o, x - Math.floor(w), x + Math.floor(w) + 1, y + 12 + d, WARM, kk);
    }
  }
  // bronze backplate and stem
  fill(p, o, x - 1, y + 2, x + 2, y + 10, GOLD[2]);
  fill(p, o, x - 2, y + 9, x + 3, y + 11, GOLD[3]);
  fill(p, o, x, y + 11, x + 1, y + 13, GOLD[2]);
  // the glass fan: stepped rows, ribbed, brightest at the heart
  const W = [5, 5, 4, 3, 2, 1];
  for (let r = 0; r < W.length; r++) {
    const yy = y - 4 + r, w = W[r];
    for (let dx = -w; dx <= w; dx++) {
      const rib = dx % 2 === 0, heart = Math.abs(dx) < 2 && r > 1;
      p.px(x + dx, yy, LAMP[clamp(g - (rib ? 0 : 1) + (heart ? (k < 0.2 ? 2 : 1) : 0) - (r === 0 ? 1 : 0), 0, 5)]);
    }
  }
  fill(p, o, x - 5, y - 5, x + 6, y - 4, GOLD[2 + Math.round(k * 3)]);
  p.glow(x, y - 2, 9, LAMP[3], 0.35 * k + 0.05);
  p.light(x, y - 1, LAMP[4], 0.4 * k);
}

export function draw(p0, t, o) {
  const p = clipped(p0, o);
  const V = vp(o), S = shine(o), H = house(o), hw = (o.sw ?? 222) / 2, ox = hw + 5;
  const open = clamp(o.open ?? 1), sway = o.sway ?? 0;
  curtains(p, o, S, H, ox, open, sway);
  valance(p, o, S, H, ox);
  audience(p, t, o, S, H, open);
}

// the main curtains: two halves of red velvet that gather to the sides; folds compress and deepen as they open
function curtains(p, o, S, H, ox, open, sway) {
  const XO = ox + 10, xi = lerp(-1, ox - 11, open), top = -66, hem = 60, NF = 9;
  const amp = 1.2 + 1.3 * open, house2 = Math.round(H * 2);
  const screenLit = S.k * open;
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? Math.floor(xi - 14) : -XO, x1 = s > 0 ? XO : Math.ceil(-xi + 14);
    rows(p, o, x0, top, x1, hem + 6, (x, y) => {
      const v = (y - top) / (hem - top), lx = x * s + 0.5;
      const sh = -sway * 9 * v * v * (1 - 0.4 * open), e = xi + sh;
      if (lx < e || lx > XO) return 0;
      const ph = (lx - e) / (XO - e);
      if (y >= hem) {
        // the gold fringe: strands, with a bead row at the bottom
        const k = house2 + (ph < 0.3 ? Math.round(screenLit * 2) : 0);
        if (y === hem + 5) return Math.round(lx) % 3 === 0 ? gi(2 + k) : 0;
        if (y === hem) return gi(3 + k);
        return Math.round(lx) % 2 ? gi(1 + k) : gi(3 + k);
      }
      const f = Math.cos(TAU * NF * ph * (1 + 0.08 * v));
      let i = 3 + Math.round(f * amp) + house2 - 1;
      if (y < top + 3) i -= 2; else if (y < top + 9) i -= 1;
      if (lx - e < 1.2) i += 2; // the rolled leading edge
      i = clamp(i, 0, 7);
      let c = VEL[i];
      // the picture's light on crests near the opening
      if (screenLit > 0.05 && f > 0.4 && ph < 0.6) c = mix(c, S.c, q(0.45 * screenLit * (1 - ph / 0.6), 3));
      return c;
    });
  }
}

const lerp = (a, b, u) => a + (b - a) * u;

// the valance: a velvet pelmet with gold trims and swags hanging between tasseled tie points
function valance(p, o, S, H, ox) {
  const L = ox + 14, N = 5, Wsw = (2 * L) / N, top = -71, base = -66, depth = 8, h2 = Math.round(H * 2);
  rows(p, o, -L, top, L, base + depth + 3, (x, y) => {
    const u = ((x + L) % Wsw) / Wsw * 2 - 1, yb = base + depth * (1 - u * u);
    if (y < base) {
      if (y === top) return gi(3 + h2);
      if (y === base - 1) return gi(4 + h2);
      return VEL[clamp(2 + h2 - (y === top + 1 ? 1 : 0), 0, 7)];
    }
    if (y > yb + 2) return 0;
    if (y > yb) return lit(gi(y > yb + 1 ? 2 + h2 : 4 + h2), S, 0.25);
    const fr = (y - base) / Math.max(1, yb - base);
    const band = Math.cos(fr * Math.PI * 2.5);
    let c = VEL[clamp(3 + Math.round(band * 1.4) + h2 - 1 - (Math.abs(u) > 0.85 ? 1 : 0), 0, 7)];
    if (fr > 0.7) c = lit(c, S, 0.18);
    return c;
  });
  // tassels at the tie points
  for (let i = 0; i <= N; i++) {
    const x = Math.round(-L + i * Wsw);
    p.px(x, base - 1, gi(6 + h2 - 2));
    p.px(x, base, gi(4 + h2));
    p.px(x - 1, base + 1, gi(3 + h2)); p.px(x + 1, base + 1, gi(3 + h2)); p.px(x, base + 1, gi(5 + h2));
    for (let y = base + 2; y < base + 7; y++) for (let dx = -1; dx <= 1; dx++) p.px(x + dx, y, gi((dx ? 2 : 3) + h2 + (y === base + 6 ? -1 : 0)));
    p.px(x, base + 7, lit(gi(3 + h2), S, 0.5));
  }
}

// rows of seat backs and heads in silhouette, rim lit by the screen; nearer rows catch less of it
function audience(p, t, o, S, H, open) {
  crowd(p, t, o, S, H, { top: 76, light: 0.3 + 0.7 * open, seat0: col("#090205"), seat1: col("#3c0a15"), density: 0.5 });
}
