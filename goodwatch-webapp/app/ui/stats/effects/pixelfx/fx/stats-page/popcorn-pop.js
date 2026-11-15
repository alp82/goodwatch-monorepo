// Made for the GoodWatch stats page: Popcorn popping into a little pile by the most binged show.
import { fit, rand, seg, clamp, lerp, ease, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Popcorn pop",
  desc: "Kernels pop one after another: each brown seed jiggles, bursts on a white frame and steam puff into a fluffy piece, hops and lands; a pile of seven builds, then pops away.",
  tags: ["stats-page", "popcorn", "snack", "binge", "one-shot"],
  size: [56, 48],
  origin: [28, 36],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    // outline, seed, seed lit, butter shade, butter, cream shade, white
    palette: ["#3a2010", "#7a4418", "#bc7a30", "#cc9428", "#f6d050", "#e6dcc4", "#ffffff"],
    steam: "#d8dce6",
    tease: 0,
    seed: 1,
  },
};

export const tease = { duration: 0.7 };

// popped pieces: o outline, W white, c cream shade, Y butter, y butter shade
const PIECES = [
  ["..oo...", ".oWWoo.", "oWWWWWo", "oWWcWco", ".oYycYo", "..oooo."],
  [".oo...", "oWWoo.", "oWWWWo", "oWcWWo", ".oyYco", "..ooo."],
  ["...oo.", ".ooWWo", "oWWWco", "oWcYyo", ".oooo."],
];
const SEED = ["ho", "so"]; // h lit, s seed, o outline: a 2x2 kernel lit from the top-left

// each kernel: when it pops, where its seed sits, where it lands (sprite top-left), how high it hops, which piece
const KERNELS = [
  { pop: 0.12, sx: -1, sy: -2, px: -3, py: -6, hop: 7, kind: 0, out: 6 },
  { pop: 0.34, sx: -8, sy: -2, px: -10, py: -6, hop: 9, kind: 1, flip: true, out: 5 },
  { pop: 0.52, sx: 5, sy: -2, px: 4, py: -5, hop: 8, kind: 2, out: 4 },
  { pop: 0.68, sx: -6, sy: -7, px: -7, py: -11, hop: 10, kind: 2, flip: true, out: 2 },
  { pop: 0.84, sx: 2, sy: -7, px: 0, py: -11, hop: 11, kind: 0, flip: true, out: 1 },
  { pop: 1.0, sx: -2, sy: -12, px: -4, py: -16, hop: 12, kind: 1, out: 0 },
  { pop: 1.3, sx: 1, sy: -17, px: 10, py: -5, hop: 14, kind: 2, out: 3 },
];
const FLY = 0.26, FADE0 = 1.74;

export function draw(p, t, o) {
  const C = fit(o.palette, 7), steam = fit([o.steam], 1)[0];
  const pal = { o: C[0], s: C[1], h: C[2], y: C[3], Y: C[4], c: C[5], W: C[6] };
  const list = o.tease ? [{ pop: 0.2, sx: 0, sy: -2, px: -1, py: -5, hop: 8, kind: 0, gone: 0.56 }] : KERNELS;
  const end = o.tease ? 0.66 : meta.duration;
  if (t >= end) return;

  // settled pieces first (in landing order), flying ones over them
  const flying = [];
  list.forEach((k, i) => {
    const age = t - k.pop;
    // the pile pops away from the top down, each piece flashing white for a frame before it goes
    const gone = k.gone ?? FADE0 + k.out * 0.06;
    if (t >= gone + 0.05) return;
    const flash = t >= gone;

    if (age < 0) {
      // the seed: appears a beat before, then jiggles as the steam builds inside
      const pre = -age;
      if (pre > 0.22) return;
      const jig = pre < 0.1 ? (Math.floor(t * 30) % 2 ? 1 : -1) * (pre < 0.05 ? 1 : 0.5) : 0;
      const sq = pre > 0.18 ? 1 : 0; // it pops in a pixel low
      p.sprite(SEED, pal, Math.round(k.sx + jig * 0.6), k.sy + sq, {});
      if (pre < 0.06) p.px(k.sx + (Math.floor(t * 30) % 2), k.sy - 1, C[6]); // a hiss of steam on top
      return;
    }

    // the burst: a 1-frame white pop, a light, then a little steam puff rising and thinning
    if (age < 0.034) {
      const cx = k.sx + 1, cy = k.sy + 0.5;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, -2], [1, -1], [-1, -1]]) p.px(cx + dx, cy + dy, WHITE);
      p.glow(cx, cy, 6, C[4], 0.45);
    }
    // a wisp of steam: three specks curling up from where it burst and thinning out
    for (let j = 0; j < 3; j++) {
      const u = (age - j * 0.05) / 0.36;
      if (u < 0 || u > 1) continue;
      p.dot(k.sx + 1 + Math.sin(u * 6 + i + j * 2) * 1.2 + (j - 1), k.sy - 1 - u * 8, j === 1 ? WHITE : steam, 1 - u);
    }

    const S = PIECES[k.kind];
    let x, y, flip = !!k.flip;
    if (age < FLY) {
      // the hop: an arc from the seed to its place, turning over once in the air
      const u = age / FLY;
      x = lerp(k.sx - 2, k.px, u);
      y = lerp(k.sy - 3, k.py, u) - k.hop * 4 * u * (1 - u);
      if (u > 0.35 && u < 0.7) flip = !flip;
      flying.push({ S, x, y, flip });
      return;
    }
    // landed: a 1-frame squash down a pixel, a tiny bounce, then sits
    const la = age - FLY;
    const bounce = la < 0.04 ? 1 : la < 0.1 ? -1 : 0;
    x = k.px;
    y = k.py + bounce;
    if (flash) {
      // popped away: a little white star where it sat
      const cx = Math.round(x + S[0].length / 2 - 0.5), cy = Math.round(y + S.length / 2 - 0.5);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(cx + dx, cy + dy, WHITE);
      p.px(cx - 2, cy, C[5]); p.px(cx + 2, cy, C[5]); p.px(cx, cy - 2, C[5]); p.px(cx, cy + 2, C[5]);
      return;
    }
    p.sprite(S, pal, Math.round(x), Math.round(y), { flip });
    if (la < 0.05) {
      p.px(x - 1, k.py + S.length - 1, C[5]);
      p.px(x + S[0].length, k.py + S.length - 1, C[5]);
    }
  });
  for (const f of flying) p.sprite(f.S, pal, Math.round(f.x), Math.round(f.y), { flip: f.flip });
  // the warm light of the pile
  const pileK = o.tease ? 0 : seg(t, 0.4, 1.0) * (1 - seg(t, FADE0, FADE0 + 0.4));
  if (pileK > 0) p.glow(0, -6, 14, C[4], 0.12 * pileK);
}
