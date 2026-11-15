// Made for the GoodWatch stats page: Party poppers on the most-awarded title.
import { fit, rand, rng, seg, clamp, lerp, ease, fly, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Confetti poppers",
  desc: "Two party poppers fire from the card's top corners on a white flash; crisp flipping confetti and curly streamers burst up, flutter down past the card with sway and blink out.",
  tags: ["stats-page", "confetti", "party", "award", "one-shot"],
  size: [100, 160],
  origin: [18, 46],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    // popper: outline, red shadow, red, gold, gold lit
    palette: ["#140c10", "#8a1e2a", "#d83a44", "#e8a826", "#ffe08a"],
    // confetti pairs, back then front: gold, white, amber, accent
    gold: ["#a8700e", "#f6c844"],
    paper: ["#9ca6bc", "#ffffff"],
    amber: ["#b4520e", "#ff9c34"],
    accent: ["#147c86", "#4cdcd0"],
    smoke: "#c8ccd8",
    w: 65,
    h: 105,
    tease: 0,
    seed: 3,
  },
};

export const tease = { duration: 0.8 };

const GRAV = 200, DRAG = 5; // terminal fall = GRAV / DRAG = 40 px/s: a flutter, not a drop

/**
 * A popper at (x, y) aiming along angle a: a striped cone, base at the card corner, mouth up. grow 0..1 pops it
 * in, kick pushes it back along its axis when it fires.
 */
function popper(p, x, y, a, grow, kick, C) {
  if (grow <= 0) return;
  const len = 8 * grow, ca = Math.cos(a), sa = Math.sin(a);
  const bx = x - ca * kick, by = y - sa * kick;
  p.shade(bx - 10, by - 10, bx + 10, by + 10, (X, Y) => {
    const dx = X - bx, dy = Y - by, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    if (u < 0 || u > len) return;
    const hw = 0.7 + u * 0.34;
    if (Math.abs(v) > hw) return;
    // the mouth: a lit gold rim round a dark opening
    if (u > len - 1.2) return Math.abs(v) < hw - 1 ? C[0] : C[4];
    if (Math.abs(v) > hw - 0.85) return C[0];
    // bands across the cone, lit on one flank
    const band = Math.floor(u / 2) % 2, lit = v * Math.sign(ca || 1) < 0;
    return band ? (lit ? C[4] : C[3]) : lit ? C[2] : C[1];
  });
}

/** One confetti piece: a 2x1 or 1x2 bit that flips (full, edge-on, back, edge-on) as it tumbles. */
function piece(p, x, y, vert, phase, back, front, a) {
  const st = Math.floor(phase * 4) & 3;
  const X = Math.round(x), Y = Math.round(y);
  if (st === 1 || st === 3) return p.dot(X, Y, st === 1 ? back : front, a);
  const c = st === 0 ? front : back;
  p.dot(X, Y, c, a);
  p.dot(vert ? X : X + 1, vert ? Y + 1 : Y, c, a);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5), S = o.seed, w = Math.max(20, o.w);
  const sets = [o.gold, o.paper, o.amber, o.accent].map((r) => fit(r, 2));
  const smoke = fit([o.smoke], 1)[0];
  const weights = [0.36, 0.26, 0.24, 0.14];
  const pick = (r) => {
    let x = r;
    for (let i = 0; i < 4; i++) if ((x -= weights[i]) < 0) return sets[i];
    return sets[0];
  };

  const poppers = o.tease
    ? [{ x: w, y: 0, a: -Math.PI / 2 - 0.45, fire: 0.16, n: 5, v: [85, 125], life: [0.48, 0.58], st: 0, out: [0.52, 0.66] }]
    : [
        { x: 0, y: 0, a: -Math.PI / 2 + 0.62, fire: 0.14, n: 26, v: [100, 190], life: [1.6, 2.3], st: 2, out: [0.85, 1.05] },
        { x: w, y: 0, a: -Math.PI / 2 - 0.62, fire: 0.22, n: 26, v: [100, 190], life: [1.6, 2.3], st: 2, out: [0.9, 1.1] },
      ];
  const end = o.tease ? 0.78 : meta.duration;
  if (t >= end) return;

  poppers.forEach((P, pi) => {
    const age = t - P.fire;
    const grow = ease.outBack(seg(t, P.fire - 0.14, P.fire - 0.04)) * (1 - ease.inQuad(seg(t, P.out[0], P.out[1])));
    const kick = age > 0 && age < 0.1 ? 1.5 * (1 - age / 0.1) : 0;
    // the popper: the wind-up is a tiny squeeze back just before it fires
    const squeeze = age > -0.05 && age < 0 ? 0.6 : 0;
    popper(p, P.x, P.y, P.a, grow, kick + squeeze, C);
    const mx = P.x + Math.cos(P.a) * 8.5, my = P.y + Math.sin(P.a) * 8.5;

    // the bang: a white hero frame at the mouth, a flash of light, a soft puff that drifts up and thins
    if (age >= 0 && age < 0.07) {
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (Math.abs(i) + Math.abs(j) < 2) p.px(mx + i, my + j, WHITE);
      for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) p.px(mx + dx, my + dy, C[4]);
      p.glow(mx, my, 10, C[4], 0.6);
    }
    if (age >= 0.03 && age < 0.38) {
      const u = (age - 0.03) / 0.35;
      p.disc(mx + Math.cos(P.a) * 3 * u, my - 4 * u, 1.2 + 2 * ease.outCubic(u), smoke, (d) => (d < 0.5 ? 0.24 : 0.1) * (1 - u));
    }

    // confetti: a fan from the mouth, fast out, drag to a hover, then a swaying flutter down
    for (let i = 0; i < P.n; i++) {
      const r = rng(S, pi, i);
      const fan = o.tease ? (i / (P.n - 1) - 0.5) * 1.3 + r.range(-0.08, 0.08) : r.range(-0.6, 0.75);
      const ang = P.a + fan * (P.x > 0 ? -1 : 1), v = r.range(P.v[0], P.v[1]);
      const life = r.range(P.life[0], P.life[1]), delay = r.range(0, 0.04);
      const pa = age - delay;
      if (pa < 0 || pa > life) continue;
      const [x0, y0] = fly(mx, my, Math.cos(ang) * v, Math.sin(ang) * v, pa, GRAV, DRAG);
      const swayA = r.range(1.8, 3.2) * seg(pa, 0.25, 0.8), swayF = r.range(3.5, 6), ph = r.range(0, TAU);
      const x = x0 + Math.sin(pa * swayF + ph) * swayA, y = y0;
      const set = pick(r.next()), vert = r.next() < 0.5;
      // spin is fast in the burst and lazier as it floats
      const spin = r.range(2.2, 4) * pa + r.range(0, 1) + 3 * (1 - Math.exp(-pa * 6));
      // the last ones blink out
      const left = life - pa, blink = o.tease ? 0.12 : 0.24;
      if (left < blink && Math.floor(left * 16) % 2 === 1) continue;
      piece(p, x, y, vert, spin, set[0], set[1], 1);
    }

    // curly streamers: a short 1 px ribbon whose body follows the head's path, curling as it goes
    for (let i = 0; i < P.st; i++) {
      const r = rng(S, pi, 99, i);
      const ang = P.a + r.range(-0.3, 0.3), v = r.range(100, 140), life = r.range(1.6, 2.1);
      if (age < 0 || age > life) continue;
      const set = i % 2 ? sets[3] : sets[0];
      const left = life - age;
      if (left < 0.24 && Math.floor(left * 16) % 2 === 1) continue;
      let px0 = null, py0 = null;
      for (let k = 0; k < 7; k++) {
        const ta = Math.max(0, age - k * 0.035);
        const [hx, hy] = fly(mx, my, Math.cos(ang) * v, Math.sin(ang) * v, ta, GRAV * 0.8, DRAG);
        const curl = Math.sin(k * 1.3 + age * 9 + i) * 1.4 * seg(age, 0.05, 0.3);
        const X = Math.round(hx + curl + Math.sin(ta * 4 + i) * 2 * seg(ta, 0.3, 0.8)), Y = Math.round(hy);
        if (px0 !== null && (X !== px0 || Y !== py0)) p.line(px0, py0, X, Y, k < 3 ? set[1] : set[0]);
        else p.px(X, Y, set[1]);
        px0 = X; py0 = Y;
      }
    }
  });
}
