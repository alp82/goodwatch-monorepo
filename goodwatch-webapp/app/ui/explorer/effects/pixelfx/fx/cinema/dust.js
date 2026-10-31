// Made for the GoodWatch explorer map: burst.
import { Particles, Lights, P, Rng, fit, seg, ease, clamp, band, TAU, WHITE, hex, mix, scale } from "../../core/index.js";

export const meta = {
  name: "Dust puff",
  desc: "Put back: a soft thump, a ring of lit dust billows out low and wide, grit falls out of it, a ticket stub tumbles off, and the dust thins away slowly.",
  tags: ["cinema", "unpick", "one-shot"],
  size: [150, 108],
  origin: [75, 56],
  duration: 1.5,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#4a4858", "#6e6c80", "#9896a8", "#c4c2d2", "#ecebf4"], ticket: ["#8a1f2c", "#c8283a", "#ff5a5a", "#ffd8c8"], seed: 8, s: 1 },
};

// a small ticket stub: notched ends, a perforated edge, lit on top, tumbling
function stub(p, x, y, ang, sx, T, a) {
  const ca = Math.cos(ang), sa = Math.sin(ang), w = 5.5 * sx, h = 3.2 * sx;
  p.shade(x - 8 * sx, y - 8 * sx, x + 8 * sx, y + 8 * sx, (px, py, out) => {
    const dx = px - x, dy = py - y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    if (Math.abs(u) > w || Math.abs(v) > h) return;
    if (Math.abs(u) > w - 1.1 && Math.abs(v) < 0.9) return; // notches
    out.a = a;
    if (Math.abs(u - w * 0.35) < 0.5) return (Math.floor(v + 9) & 1) ? T[3] : T[0]; // perforation
    if (v < -h + 1) return T[3];
    if (v > h - 1 || Math.abs(u) > w - 1) return T[0];
    return u > w * 0.35 ? T[1] : T[2];
  });
}

export function create(o) {
  const C = fit(o.palette, 5), T = fit(o.ticket, 4), s = o.s ?? 1, R = new Rng(o.seed);
  const FLOOR = 6 * s;
  const ps = new Particles({ rng: R });
  const lights = new Lights();
  lights.add(0, 0, 30 * s, C[4], 0.4, 0.35);
  lights.add(0, 0, 10 * s, WHITE, 0.5, 0.08);
  // the dust: a ring of puffs rolling out, wider than tall, a couple rising behind
  const puffs = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const an = (i / N) * TAU + R.range(-0.18, 0.18), sp = (i % 3 === 0 ? R.range(35, 60) : R.range(80, 125)) * s;
    puffs.push({ x: Math.cos(an) * 3 * s, y: Math.sin(an) * 1.5 * s, vx: Math.cos(an) * sp * 1.35, vy: Math.sin(an) * sp * 0.38 - R.range(4, 14) * s,
      r0: R.range(3, 5) * s, r1: R.range(8, 12.5) * s, life: R.range(0.95, 1.4), delay: R.range(0, 0.05), back: Math.sin(an) < 0 });
  }
  for (let i = 0; i < 4; i++) {
    const x = R.range(-8, 8) * s;
    puffs.push({ x, y: -2 * s, vx: x * 2.5, vy: -R.range(25, 40) * s, r0: 3 * s, r1: R.range(6, 9) * s, life: R.range(1.0, 1.35), delay: R.range(0.04, 0.12), back: true });
  }
  // grit: thrown up from the edge and raining down out of the cloud
  for (let i = 0; i < 26; i++) {
    const an = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(90, 200) * s;
    ps.spawn(P.GRIT, R.range(-6, 6) * s, 0, Math.cos(an) * sp * 0.9, Math.sin(an) * sp, R.range(0.28, 0.44), R.pick([C[2], C[3], C[3], C[4]]), R.chance(0.35) ? 2 : 1, R.range(0, 0.08));
  }
  // motes of light settling in the dust
  for (let i = 0; i < 6; i++) {
    const an = R.range(0, TAU), d = R.range(10, 30) * s;
    ps.spawn(P.STAR, Math.cos(an) * d, Math.sin(an) * d * 0.4 - R.range(2, 10) * s, R.range(-6, 6), R.range(2, 10), R.range(0.5, 0.9), C[4], R.chance(0.4) ? 2 : 0.6, R.range(0.25, 0.6));
  }
  // the ticket stub: pops off to one side, tumbles, lands, fades
  const side = R.sign();
  const tk = { x: 0, y: -1, vx: side * R.range(55, 75) * s, vy: -R.range(170, 200) * s, a: R.range(0, TAU), va: side * R.range(10, 14), rest: false };
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
      for (const q of puffs) {
        if (t < q.delay) continue;
        q.vx -= q.vx * 3.6 * dt;
        q.vy -= q.vy * 3 * dt + 6 * s * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
      if (!tk.rest) {
        tk.vy += 700 * s * dt;
        tk.x += tk.vx * dt;
        tk.y += tk.vy * dt;
        tk.a += tk.va * dt;
        if (tk.y > FLOOR - 1 && tk.vy > 0) {
          if (tk.vy > 120 * s) (tk.vy *= -0.35), (tk.vx *= 0.5), (tk.va *= 0.4);
          else (tk.rest = true), (tk.y = FLOOR - 1), (tk.a = Math.round(tk.a / Math.PI) * Math.PI);
        }
      }
    },
    drawBack(p) {
      this.layer(p, true);
    },
    draw(p) {
      // thump: a flat white flash and a ring of dust on the floor
      if (t < 0.07) p.ellipse(0, 0, 9 * s * (1 - t / 0.14), 3 * s, (d) => (d < 0.5 ? WHITE : C[4]));
      const ru = seg(t, 0, 0.5);
      if (ru < 1) band(p, 0, 1, (6 + 44 * ease.outQuart(ru)) * s, 0.3, 3 * s * (1 - ru) + 1, 1.1 * (1 - ru), [C[1], C[2], C[3], C[4]]);
      this.layer(p, false);
      ps.draw(p);
      const ta = clamp(1 - (t - 1.05) / 0.35);
      if (ta > 0) stub(p, tk.x, tk.y, tk.a, s, T, ta);
      lights.draw(p);
    },
    layer(p, back) {
      for (const q of puffs) {
        if (q.back !== back || t < q.delay) continue;
        const u = (t - q.delay) / q.life;
        if (u >= 1) continue;
        const r = q.r0 + (q.r1 - q.r0) * ease.outCubic(u), a = (u < 0.06 ? u / 0.06 : 1) * Math.pow(1 - u, 1.4) * (back ? 0.5 : 0.62);
        // body, a lit cap up and left, a darker belly
        p.disc(q.x, q.y, r, (d, ang) => (d > 0.8 ? C[1] : Math.sin(ang) > 0.35 ? C[1] : C[2]), (d) => a * (1 - d * d * 0.7));
        p.disc(q.x - r * 0.25, q.y - r * 0.32, r * 0.6, u < 0.3 ? C[4] : C[3], (d) => a * 0.8 * (1 - d * 0.5));
        if (u < 0.35) p.glow(q.x, q.y - r * 0.3, r * 1.5, C[3], 0.12 * (1 - u / 0.35));
      }
    },
  };
}
