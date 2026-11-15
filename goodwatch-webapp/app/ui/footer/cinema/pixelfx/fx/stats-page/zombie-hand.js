// Made for the GoodWatch stats page: The zombie count gets a hand out of the floor.
import { fit, hex, rand, seg, clamp, bump, ease, burst, fly, sparkle, TAU } from "../../core/index.js";

export const meta = {
  name: "Zombie hand",
  desc: "A crack opens in the floor and spits dirt, a green-gray hand pushes up to its ragged cuff, flexes open and grasps twice, then sinks back in a puff of dust.",
  tags: ["stats-page", "zombie", "hand", "horror", "spooky", "one-shot"],
  size: [72, 56],
  origin: [36, 40],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0e1a10", "#2a3f26", "#4e6a40", "#7e9a62", "#b8cc94"],
    dirt: ["#1f140a", "#4a3018", "#7a5430", "#b08a58"],
    sleeve: ["#1c1622", "#3a2e44", "#5e4c6a"],
    nail: "#d4c88e",
    seed: 4,
  },
};

// n nail, h highlight, l lit, m mid, d shade; s/r/q sleeve lit/mid/dark. 12 x 15, the cuff at the bottom.
const CUFF = ["..qrrqrrqq..", ".rsrrsrrqsr.", "..s.rs.qr.s."];
const PALM = ["lmhlllmmmmmd", ".lmhllmmmmd.", "..lmlmmmmmd.", "..lmmmmmmd..", "..lmmmmmdd.."];
const OPEN = [".....nn.....", "..nn.lm.nn..", "..lm.lm.lm..", "..lm.lm.lm.n", "..lm.lm.lm.m", "..lmdlmdlmdm", "n.lmmlmmlmmd", ...PALM, ...CUFF];
const CLAW = ["............", "............", ".....hn.....", "..hn.lm.hn..", "..lm.lm.lm.n", "..lm.lm.lm.m", "n.lmdlmdlmdm", ...PALM, ...CUFF];
const FIST = ["............", "............", "............", "............", "............", "...hlhlh....", "..hlmlmlmd..", "..lmdmdmdm..", ".hlmdmdmdmd.", ".hhlllmmmdd.", "..lmmmmmmd..", "..lmmmmmdd..", ...CUFF];
const H = OPEN.length, TOP = 15; // rows above the floor at full height (the last cuff row stays under)

// when it opens and grasps: fist on the way up, open, grasp, open, grasp, open on the way down
function pose(t) {
  if (t < 0.62) return FIST;
  if (t < 0.84) return OPEN;
  if (t < 0.92) return CLAW;
  if (t < 1.08) return FIST;
  if (t < 1.18) return CLAW;
  if (t < 1.38) return OPEN;
  if (t < 1.46) return CLAW;
  if (t < 1.62) return FIST;
  if (t < 1.72) return CLAW;
  return OPEN;
}

function rise(t) {
  if (t < 0.22) return 0;
  if (t < 0.6) return TOP * ease.outBack(seg(t, 0.22, 0.6));
  if (t < 1.75) return TOP - (t > 0.95 && t < 1.05 ? 1 : 0) - (t > 1.5 && t < 1.6 ? 1 : 0);
  return TOP * (1 - ease.inCubic(seg(t, 1.75, 2.1)));
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5), D = fit(o.dirt, 4), Q = fit(o.sleeve, 3), N = hex(o.nail), S = o.seed;
  const pal = { n: N, h: C[4], l: C[3], m: C[2], d: C[1], s: Q[2], r: Q[1], q: Q[0] };
  const open = seg(t, 0, 0.2) * (1 - seg(t, 2.15, 2.45));
  const half = 1 + 7 * open;

  // an eerie glow out of the crack while it's open
  p.glow(0, -1, 16, C[3], 0.22 * open);
  p.glow(0, 0, 6, C[4], 0.2 * open * bump(t, 0.1, 0.5));

  // the mound: a low heap of dirt round the crack, lit on top, heaved up while the hand is out
  const heave = seg(t, 0.18, 0.4) * (1 - seg(t, 2.05, 2.5));
  if (heave > 0) {
    // a lumpy heap: columns of dirt, taller in the middle, lit on top where the light catches
    const mw = 3 + 7 * heave, mh = 1 + 2.4 * heave;
    for (let x = -Math.ceil(mw); x <= Math.ceil(mw); x++) {
      const u = x / mw;
      if (Math.abs(u) > 1) continue;
      const hh = Math.round(mh * (1 - u * u) + (rand(S, x + 40, 3) - 0.5) * 1.2);
      for (let y = 0; y < hh; y++) p.px(x, -y, y === hh - 1 ? (x < 1 && rand(S, x + 40, 4) < 0.7 ? D[3] : D[2]) : D[1]);
    }
  }

  // the crack: a jagged dark seam with a lit lip
  if (open > 0) {
    for (let x = -Math.floor(half); x <= Math.floor(half); x++) {
      const j = rand(S, x + 20, 1) < 0.35 ? -1 : 0;
      p.px(x, j, D[0]);
      if (rand(S, x + 20, 2) < 0.5) p.px(x, j - 1, D[3]);
    }
  }

  // the hand, clipped at the floor
  const h = rise(t);
  if (h > 0.5) {
    const rows = pose(t), W = rows[0].length;
    const shake = t < 0.6 ? Math.round(Math.sin(t * 60) * 0.7) : t > 1.75 ? Math.round(Math.sin(t * 50) * 0.6) : 0;
    const x0 = -6 + shake, y0 = Math.round(-h);
    for (let r = 0; r < H; r++) {
      const y = y0 + r;
      if (y >= -1) break;
      for (let q = 0; q < W; q++) {
        const ch = rows[r][q];
        if (ch === ".") continue;
        p.px(x0 + q, y, pal[ch]);
      }
    }
    // the cold light it gives off, and a glint on a nail when it grasps
    p.glow(0, y0 + 7, 10, C[3], 0.12);
    if (t > 0.66 && t < 0.82) sparkle(p, x0 + 6, y0, 2 * bump(t, 0.66, 0.82), hex("#ffffff"), N, 0.5);
  }

  // dirt: clods thrown up when it breaks through, crumbs when it sinks back
  const clods = (t0, n, seed, up) => {
    burst(n, seed, (r) => {
      const u = t - t0 - r.range(0, 0.06);
      if (u < 0) return;
      const vx = r.range(-45, 45), vy = -r.range(up * 0.5, up), life = r.range(0.5, 0.75);
      if (u > life) return;
      let [x, y] = fly(r.range(-3, 3), -1, vx, vy, u, 300, 0.5);
      if (y > 0) y = 0; // landed: it sits on the floor
      const c = r.next() < 0.3 ? D[3] : D[2];
      const k = 1 - seg(u, life - 0.2, life);
      p.dot(x, y - 1, c, k);
      if (r.next() < 0.4) p.dot(x + 1, y - 1, D[1], k);
    });
  };
  clods(0.22, 12, S, 95);
  clods(1.76, 7, S + 9, 50);

  // dust: soft puffs that swell and thin, at the break and at the sink
  const puff = (t0, n, seed) => {
    const u = t - t0;
    if (u < 0 || u > 0.6) return;
    const k = u / 0.6;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1, d = (2 + rand(seed, i, 1) * 8) * (0.35 + k);
      const r0 = 1 + rand(seed, i, 3) * 1.5;
      p.disc(dir * d, -1 - k * (2 + rand(seed, i, 2) * 5), r0 + 1.6 * k, i % 3 ? D[2] : D[3], 0.38 * (1 - k) * (1 - k));
    }
  };
  puff(0.24, 9, S + 1);
  puff(1.9, 8, S + 2);
}
