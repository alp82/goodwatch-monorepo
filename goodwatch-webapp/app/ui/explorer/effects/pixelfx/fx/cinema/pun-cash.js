// Made for the GoodWatch explorer map: title pun.
// Cash burst: banknotes shoot up from behind the poster's top edge, tumble and flutter down (foreshortening as they
// flip, a thin edge between faces), gold coins spin out and bounce on the poster's bottom edge, glints on both.
// The flutter (swing that slows at its ends, tilt that follows it) borrows the recipe from ui/confetti, itself adapted
// from Sprite Fusion's falling leaves (MIT, Copyright (c) 2026 Hugo Duprez).
import { Particles, Lights, P, Rng, clamp, TAU, WHITE, hex, fit, scale, sparkle } from "../../core/index.js";
import { poster } from "./_pun2.js";
import { preview } from "./_pun1.js";

export const meta = {
  name: "Pun: cash burst",
  desc: "Banknotes burst up from behind the poster and flutter down tumbling, flipping edge-on; gold coins spin out and bounce off the poster's bottom edge with glints.",
  tags: ["cinema", "pun", "money", "cash", "heist", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0c2416", "#1b4a2b", "#2f7a43", "#5fb25e", "#a8e08a", "#e6f8d2"],
    gold: ["#4a2c08", "#9a6414", "#e0a42a", "#ffd95a", "#fff6c8"],
    seed: 1, w: 40, h: 60,
  },
};

export function create(o) {
  const { w, h, k } = poster(o), hw = w / 2, hh = h / 2, sk = Math.sqrt(k), R = new Rng(o.seed);
  const G = fit(o.palette, 6), Y = fit(o.gold, 5);
  const ps = new Particles({ rng: R, sparks: ["#ffffff", "#fff6c8", "#ffd95a", "#9a6414"] }), lights = new Lights();
  const bw = clamp(6 * sk, 4.5, 13), bh = bw * 0.52, floor = hh - 0.5;
  const notes = [], coins = [];
  const nN = Math.round(clamp(9 * k, 7, 30));
  for (let i = 0; i < nN; i++) {
    const x = R.range(-hw * 0.8, hw * 0.8), up = R.range(120, 175) * sk;
    notes.push({ x, y: -hh + R.range(2, 6) * sk, vx: x * R.range(1.2, 2.6) + R.range(-25, 25) * sk, vy: -up,
      ang: R.range(-0.4, 0.4), spin: R.range(-3, 3), flip: R.range(0, TAU), fs: R.range(7, 12), ph: R.range(0, TAU),
      amp: R.range(2.5, 5) * sk, fw: R.range(2.4, 3.6), x0: 0, mode: 0, fall: R.range(0.42, 0.62) * h,
      delay: (i / nN) * 0.22 + R.range(0, 0.05), fade: R.range(2.1, 2.55), big: R.range(0.85, 1.15), behind: true });
  }
  const nC = Math.round(clamp(3 + 1.5 * k, 3, 9));
  for (let i = 0; i < nC; i++) {
    const side = i % 2 ? 1 : -1;
    coins.push({ x: R.range(-hw * 0.5, hw * 0.5), y: -hh * R.range(0.1, 0.5), vx: side * R.range(12, 35) * sk, vy: -R.range(110, 170) * Math.pow(k, 0.7),
      spin: R.range(0, TAU), vs: R.range(14, 22), r: clamp(R.range(1.7, 2.5) * Math.pow(k, 0.7), 1.5, 6), delay: 0.06 + R.range(0, 0.25), bounces: 0, life: R.range(1.9, 2.4) });
  }
  lights.add(0, -hh, 28 * sk, G[4], 0.45, 0.35);
  lights.add(0, -hh, 14 * sk, WHITE, 0.4, 0.12);
  for (let i = 0; i < Math.round(10 * sk); i++) {
    const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(70, 150) * sk;
    ps.spawn(P.SPARK, R.range(-hw * 0.6, hw * 0.6), -hh, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.12, 0.3));
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
      for (const n of notes) {
        if (t < n.delay) continue;
        n.flip += n.fs * dt;
        if (n.mode === 0) {
          n.vx -= n.vx * 3.2 * dt;
          n.vy -= n.vy * 3.2 * dt - 200 * dt;
          n.x += n.vx * dt;
          n.y += n.vy * dt;
          n.ang += n.spin * dt;
          if (n.y < -hh - bh * 1.5) n.behind = false;
          if (n.vy > -25) (n.mode = 1), (n.x0 = n.x - Math.sin(n.ph) * n.amp), (n.fs *= 0.35), (n.behind = false);
        } else {
          n.ph += n.fw * dt;
          n.x0 += n.vx * dt;
          n.vx -= n.vx * 2 * dt;
          n.x = n.x0 + Math.sin(n.ph) * n.amp;
          n.y += n.fall * (0.35 + 0.9 * Math.abs(Math.cos(n.ph))) * dt;
          n.ang += (Math.cos(n.ph) * 0.3 - n.ang) * 4 * dt;
        }
      }
      for (const c of coins) {
        if (t < c.delay) continue;
        c.spin += c.vs * dt;
        c.vy += 520 * Math.pow(k, 0.6) * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.y > floor - c.r && c.vy > 0) {
          c.y = floor - c.r;
          if (c.bounces < 2) {
            c.vy = -c.vy * 0.45;
            c.vx *= 0.7;
            c.bounces++;
            for (let i = 0; i < 3; i++) ps.spawn(P.SPARK, c.x, floor - 0.5, R.range(-50, 50), -R.range(30, 80), R.range(0.08, 0.18));
            lights.add(c.x, floor, 6 * sk, Y[3], 0.4, 0.15);
          } else (c.vy = 0), (c.vx *= 1 - 9 * dt), (c.vs *= 1 - 3 * dt);
        }
      }
    },
    drawBack(p) {
      preview(p, o);
    },
    draw(p) {
      if (t < 0.08) p.glow(0, -hh, 16 * sk, G[4], 0.4 * (1 - t / 0.08));
      lights.draw(p);
      for (const n of notes) {
        if (t < n.delay) continue;
        const a = 1, sh = clamp((n.fade - t) / 0.3);
        if (sh <= 0.15) continue;
        if (a <= 0) continue;
        const cf = Math.cos(n.flip), front = cf > 0, sy = Math.abs(cf), W = bw * n.big * sh, Hh = bh * n.big * sh;
        const ca = Math.cos(n.ang), sa = Math.sin(n.ang), r = Math.ceil(W) + 1;
        if (sy < 0.28) {
          // edge-on: a thin lit line
          const ex = ca * W, ey = sa * W;
          p.line(n.x - ex, n.y - ey, n.x + ex, n.y + ey, (u) => (u < 0.5 ? G[5] : G[3]), a);
          continue;
        }
        const hv = Hh * sy;
        p.shade(n.x - r, n.y - r, n.x + r, n.y + r, (px, py, out) => {
          if (n.behind && py > -hh) return;
          const dx = px - n.x, dy = py - n.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
          if (Math.abs(u) > W || Math.abs(v) > hv) return;
          out.a = a;
          const edge = Math.abs(u) > W - 1 || Math.abs(v) > hv - 1;
          const lit = (v < 0) === front;
          if (edge) return lit && u < 0 ? G[4] : G[1];
          if (!front) return Math.abs(u) < hv * 0.8 ? G[2] : G[3];
          // face: a pale medallion with a dark mark, inner frame lines, a lit top row
          const m = Math.hypot(u, v / Math.max(0.5, sy));
          const mr = Math.max(1.2, Hh * 0.62);
          if (sy > 0.55 && m < mr) return m < mr * 0.5 ? G[1] : G[5];
          if (W > 4.5 && Math.abs(Math.abs(u) - (W - 2.5)) < 0.5 && Math.abs(v) < hv - 1.5) return G[2];
          return Math.abs(v + (front ? hv : -hv)) < 1.6 ? G[4] : G[3];
        });
        if (front && sy > 0.93) p.light(n.x - ca * W * 0.5, n.y - sa * W * 0.5, G[5], 0.35 * a);
      }
      for (const c of coins) {
        if (t < c.delay) continue;
        const a = 1, sh = clamp((c.life - t) / 0.3);
        if (sh <= 0.3) continue;
        const cs = Math.cos(c.spin), ry = c.r * sh, rx = Math.max(0.6, Math.abs(cs) * ry);
        p.ellipse(c.x, c.y, rx + 0.5, ry, Y[1], a);
        if (rx > 1.2) p.ellipse(c.x - 0.3, c.y - 0.2, rx - 0.5, ry - 0.7, cs > 0 ? Y[2] : Y[3], a);
        p.px(c.x - rx * 0.4, c.y - ry * 0.5, Y[4]);
        p.glow(c.x, c.y, c.r * 3, Y[3], 0.25 * a);
        if (Math.abs(cs) > 0.96 && sh > 0.8) sparkle(p, c.x - rx * 0.4, c.y - ry * 0.5, 2 + sk, Y[4], Y[3], 0.4);
      }
      // glints that pop on a few notes as they face the light
      for (let i = 0; i < notes.length; i += 3) {
        const n = notes[i];
        if (t < n.delay + 0.3 || t > n.fade - 0.3) continue;
        const g = Math.sin(n.flip * 0.5 + i);
        if (g > 0.93) sparkle(p, n.x + bw * 0.5, n.y - bh * 0.5, 1.5 + sk, G[5], G[4], 0.35);
      }
      ps.draw(p);
    },
  };
}
