// Made for the GoodWatch explorer map: burst.
import { Particles, Lights, P, Rng, fit, flare, sparkle, seg, ease, clamp, TAU, WHITE, hex, mix, scale } from "../../core/index.js";

export const meta = {
  name: "Ticket punch",
  desc: "Pick, take two: a hole punch flashes as a star, a ticket stub flips up showing its punched star hole, confetti dots spray out of the punch and the stub drops away.",
  tags: ["cinema", "pick", "one-shot"],
  size: [156, 152],
  origin: [78, 76],
  duration: 1.15,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#7a4a12", "#c8892a", "#ffd24a", "#fff3c8", "#ffffff"],
    ticket: ["#5a1420", "#a8203a", "#e8384e", "#ff8a8a", "#ffe0d0"],
    confetti: ["#ffd24a", "#ff5a7a", "#5ad2ff", "#a8ff6a", "#ffffff"],
    seed: 4, s: 1,
  },
};

// is (u, v) inside a five-point star of radius r?
function inStar(u, v, r) {
  const a = Math.atan2(v, u), d = Math.hypot(u, v), k = (((a / TAU) * 5 + 100.25) % 1) - 0.5;
  return d < r * (0.48 + 0.52 * Math.pow(Math.abs(k) * 2, 2.2));
}

// the stub, flipping about its long axis (fx = cos of the flip), tilted by ang
function stub(p, x, y, ang, fx, s, T, a) {
  const w = 13 * s, h = 7.5 * s, ca = Math.cos(ang), sa = Math.sin(ang), front = fx > 0, sy = Math.max(0.12, Math.abs(fx));
  const E = w + 2;
  p.shade(x - E, y - E, x + E, y + E, (px, py, out) => {
    const dx = px - x, dy = py - y, u = dx * ca + dy * sa, v0 = -dx * sa + dy * ca, v = v0 / sy;
    if (Math.abs(u) > w || Math.abs(v) > h) return;
    if (Math.hypot(Math.abs(u) - w, v) < 2.6 * s) return; // notched ends
    const hu = u + w * 0.42;
    if (inStar(hu, v, 4.4 * s)) return; // the punched hole goes right through
    out.a = a;
    const edgeV = (h - Math.abs(v)) * sy, edgeU = w - Math.abs(u);
    if (!front) return edgeV < 1 || edgeU < 1 ? T[3] : v < 0 ? T[4] : mix(T[4], T[3], 0.4);
    if (edgeV < 0.9 || edgeU < 0.9) return v < 0 ? T[4] : T[0];
    if (inStar(hu, v, 5.6 * s)) return T[4]; // a pale rim round the hole
    if (Math.abs(u - w * 0.12) < 0.5) return (Math.floor(v * sy + 20) & 1) ? T[0] : T[3]; // perforation
    if (u > w * 0.3 && u < w * 0.8 && Math.abs(v) < h * 0.35 && (Math.floor(u * 1.4) & 1) === 0) return T[3]; // a printed line
    return v < -h * 0.45 ? T[3] : v < h * 0.4 ? T[2] : T[1];
  });
}

export function create(o) {
  const C = fit(o.palette, 5), T = fit(o.ticket, 5), Q = fit(o.confetti, 5), s = o.s ?? 1, R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [WHITE, C[3], C[2], C[1]] });
  const lights = new Lights();
  lights.add(0, 0, 44 * s, C[3], 0.55, 0.45);
  lights.add(0, 0, 16 * s, WHITE, 0.8, 0.08);
  for (let i = 0; i < 14; i++) {
    const an = R.range(0, TAU), sp = R.range(140, 260) * s;
    ps.spawn(P.SPARK, 0, 0, Math.cos(an) * sp, Math.sin(an) * sp, R.range(0.12, 0.28), C[3]);
  }
  // confetti dots from the punch: round, lit, fluttering down
  const dots = [];
  for (let i = 0; i < 22; i++) {
    const an = -Math.PI / 2 + R.range(-1.9, 1.9), sp = R.range(140, 250) * s;
    dots.push({ x: 0, y: 0, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, c: Q[i % 4], r: R.range(1.4, 2.3) * s, ph: R.range(0, TAU), life: R.range(0.65, 0.95), d: R.range(0, 0.06) });
  }
  // the punched-out chad: a little star that drops straight down, spinning
  const chad = { x: -4 * s, y: 0, vx: R.range(-20, 20) * s, vy: -60 * s };
  const tk = { x: 0, y: 2 * s, vx: R.sign() * R.range(10, 22) * s, vy: -250 * s, ang: R.range(-0.3, 0.3), va: R.range(-3, 3), flip: 0 };
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
      for (const d of dots) {
        if (t < d.d) continue;
        d.vy += 300 * s * dt;
        d.vx -= d.vx * 3.2 * dt;
        d.vy -= d.vy * 3.2 * dt;
        d.x += (d.vx + Math.sin(t * 9 + d.ph) * 14 * s) * dt;
        d.y += d.vy * dt;
      }
      chad.vy += 420 * s * dt;
      chad.x += chad.vx * dt;
      chad.y += chad.vy * dt;
      tk.vy += 430 * s * dt;
      tk.vx -= tk.vx * 1.5 * dt;
      tk.vy -= tk.vy * 1.8 * dt;
      tk.x += tk.vx * dt;
      tk.y += tk.vy * dt;
      tk.ang += tk.va * dt;
      tk.flip = TAU * ease.outCubic(seg(t, 0, 0.6)) + Math.sin(t * 7) * 0.5 * seg(t, 0.4, 0.8);
    },
    draw(p) {
      // the punch: a hot star, a ring snapping out
      if (t < 0.07) {
        p.shade(-9 * s, -9 * s, 9 * s, 9 * s, (x, y) => (inStar(x, y + 0.5, 8 * s * (1 - t / 0.14)) ? WHITE : 0));
        p.glow(0, 0, 30 * s, C[3], 0.7);
      }
      if (t < 0.18) flare(p, 0, 0, 20 * s * (1 - t / 0.18), 0.6, [C[1], C[2], C[3]]);
      const ru = seg(t, 0, 0.3);
      if (ru < 1) {
        const rr = (4 + 30 * ease.outQuart(ru)) * s;
        p.ring(0, 0, rr, Math.max(1, 2.5 * (1 - ru)) * s, (v) => (v > 0.5 ? (ru < 0.3 ? WHITE : C[3]) : C[2]), 1 - ru);
        p.glowRing(0, 0, rr, 4 * s, C[2], 0.3 * (1 - ru));
      }
      // the stub: grows in with a pop, flips, sails up, falls and fades
      const g = ease.outBack(seg(t, 0, 0.1)) * (1 - 0.7 * ease.inCubic(seg(t, 0.8, 1.1))), ta = clamp(1 - (t - 1.0) / 0.12);
      if (g > 0.05 && ta > 0) {
        const fx = Math.cos(tk.flip);
        stub(p, tk.x, tk.y, tk.ang, fx * g, s * g, T, ta);
        if (t < 0.3) p.glow(tk.x, tk.y, 16 * s, T[3], 0.25 * (1 - t / 0.3));
        if (fx > 0.85 && t < 0.8) sparkle(p, tk.x + 6 * s, tk.y - 4 * s, 2, C[4], C[3], 0.4);
      }
      // the chad
      const ca = clamp(1 - (t - 0.4) / 0.2);
      if (ca > 0 && t > 0.05) p.shade(chad.x - 3, chad.y - 3, chad.x + 3, chad.y + 3, (x, y, out) => {
        const a = t * 14, u = (x - chad.x) * Math.cos(a) + (y - chad.y) * Math.sin(a), v = -(x - chad.x) * Math.sin(a) + (y - chad.y) * Math.cos(a);
        if (!inStar(u, v, 2.6 * s)) return;
        out.a = ca;
        return v < 0 ? T[3] : T[2];
      });
      for (const d of dots) {
        if (t < d.d) continue;
        const a = clamp(1 - (t - d.life * 0.6) / (d.life * 0.4));
        if (a <= 0) continue;
        const tw = Math.sin(t * 16 + d.ph);
        p.circle(d.x, d.y, d.r * (0.65 + 0.35 * Math.abs(tw)), (dd, an) => (dd > 0.25 && Math.sin(an) < -0.2 && Math.cos(an) < 0.3 ? mix(d.c, WHITE, 0.6) : dd > 0.7 && Math.sin(an) > 0.3 ? scale(d.c, 0.7) : d.c), a);
        p.glow(d.x, d.y, 3.5 * s, d.c, 0.3 * a);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
