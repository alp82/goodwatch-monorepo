// Made for the GoodWatch stats page: The Friday the 13th reveal lets the bats out.
import { fit, hex, rand, seg, clamp, lerp, bump, burst, TAU } from "../../core/index.js";

export const meta = {
  name: "Bats out",
  desc: "A little dark puff pops and four small bats burst out, wings snapping through four frames, red eyes glinting, flapping up and away on diverging arcs.",
  tags: ["stats-page", "bats", "spooky", "halloween", "friday", "one-shot"],
  size: [220, 116],
  origin: [110, 98],
  duration: 2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0b0812", "#2a1f3a", "#4e3c66", "#7c64a0", "#c8b4e4"],
    eye: ["#7a0a14", "#ff3b30", "#ffb08a"],
    n: 4,
    seed: 13,
  },
};

// four wing frames, big (11 px span) and small (7 px). o body, a/b membrane dark/mid, c lit bone, e eye.
const BIG = [
  // wings up
  ["c...........c", "bc.........cb", "bbc..c.c..cbb", ".bbb.ooo.bbb.", "..bbbeoebbb..", "...aaoooaa...", ".....aoa....."],
  // level, spread
  [".............", ".....c.c.....", "cccbbooobbccc", "bbbbbeoebbbbb", "a.ba.ooo.ab.a", ".....aoa.....", "............."],
  // down
  [".............", ".....c.c.....", "....booob....", "...bbeoebb...", "..bbaoooabb..", ".bba.aoa.abb.", "cba.......abc"],
  // coming back up, folded
  [".............", "..c..c.c..c..", "..bb.ooo.bb..", "...bbeoebb...", "....aoooa....", ".....aoa.....", "............."],
];
const SMALL = [
  ["c.......c", "bbc.o.cbb", ".bbbebbb.", "....o...."],
  ["...c.c...", "ccbbobbcc", "a.baeab.a", "....o...."],
  ["...c.c...", "..bbobb..", ".bbaeabb.", "cb.....bc"],
  ["..c.c.c..", ".bb.o.bb.", "..bbebb..", "....o...."],
];

const PUFF = 0.26;

export function draw(p, t, o) {
  const C = fit(o.palette, 5), E = fit(o.eye, 3), S = o.seed, n = clamp(Math.round(o.n), 1, 6);
  const pal = { a: C[1], b: C[2], c: C[4], o: C[3], e: E[1] };
  const palDim = { a: C[1], b: C[2], c: C[3], o: C[2], e: E[0] };

  // the puff: a soft violet-black cloud that swells and thins, a pale rim on top, a few motes
  if (t < PUFF + 0.2) {
    const k = seg(t, 0, PUFF + 0.2), sw = 1 - (1 - k) * (1 - k);
    const a = 0.55 * (1 - k);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * TAU + rand(S, i, 1) * 0.8;
      const d = 3 + 6 * sw;
      p.disc(Math.cos(ang) * d, -4 + Math.sin(ang) * d * 0.6 - 3 * sw, 3 + 3 * sw, C[2], a);
    }
    p.disc(0, -4 - 2 * sw, 4 + 4 * sw, C[1], a);
    // the pop: a thin pale ring snapping out, a flick of red light
    if (t < 0.2) p.ring(0, -4, 2 + 30 * t, 1, C[4], 1 - t / 0.2);
    p.glow(0, -4, 14, E[1], 0.15 * (1 - seg(t, 0, 0.3)));
    burst(8, S + 3, (r) => {
      const ang = r.range(0, TAU), sp = r.range(18, 40), life = r.range(0.25, 0.5);
      if (t > life) return;
      const d = sp * t * (1 - t / (2 * life));
      p.dot(Math.cos(ang) * d, -4 + Math.sin(ang) * d * 0.7, C[3], 1 - t / life);
    });
  }

  // the bats
  for (let i = 0; i < n; i++) {
    const delay = 0.03 + i * 0.07 + rand(S, i, 2) * 0.04;
    const u = t - delay;
    if (u < 0) continue;
    const side = i % 2 ? 1 : -1;
    const spread = side * (0.25 + rand(S, i, 3) * 0.9) * (i === 0 ? 0.3 : 1);
    const speed = 34 + rand(S, i, 4) * 22, life = 1.35 + rand(S, i, 5) * 0.35;
    if (u > life) continue;
    // up and out: drifting sideways faster as it climbs, a lazy swerve, a lift on each downbeat
    const flap = 0.17 + rand(S, i, 6) * 0.05, ph = u / flap + rand(S, i, 7) * 4;
    const f = Math.floor(ph * 4) % 4;
    const lift = f === 2 ? -1 : f === 0 ? 1 : 0;
    const x = spread * (40 * u + 14 * u * u) + Math.sin(u * 5 + i) * 3 * u;
    const y = -4 - (speed + 26) * u * (1 - 0.22 * u) + lift;
    const k = u / life;
    const small = k > 0.55 || (i === n - 1 && k > 0.4);
    const rows = small ? SMALL[f] : BIG[f];
    const w = rows[0].length, h = rows.length;
    const a = k > 0.85 ? (1 - k) / 0.15 : 1;
    const flip = spread < 0;
    p.sprite(rows, k > 0.7 ? palDim : pal, Math.round(x - w / 2), Math.round(y - h / 2), { flip, a });
    // eye glints: a red light that flickers, a white-hot pin now and then
    const ey = Math.round(y - h / 2) + (small ? 2 : rows.findIndex((r) => r.includes("e")));
    p.light(x, ey, E[1], 0.2 * a);
    if (bump(u, 0.2 + i * 0.1, 0.32 + i * 0.1) > 0.5) p.px(x - 1, ey, E[2]);
    // a faint rim of moonlight on the wings while they're spread
    if (f === 1 && !small) p.light(x, y - 1, C[4], 0.12 * a);
  }
}
