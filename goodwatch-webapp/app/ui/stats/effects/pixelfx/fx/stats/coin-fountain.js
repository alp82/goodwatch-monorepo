// Made for the GoodWatch stats page: Jackpot: coins spurt up and rain past the point, glinting.
import { Particles, Lights, P, Rng, fit, flare, sparkle, seg, ease, clamp, TAU, WHITE } from "../../core/index.js";
import { drawCoin } from "./_coin.js";

export const meta = {
  name: "Coin fountain",
  desc: "Jackpot: a white flash, a fountain of spinning gold coins spurts up and out, hangs, and rains down past the point, glinting as they turn.",
  tags: ["stats", "coin", "jackpot", "slot", "one-shot"],
  size: [176, 160],
  origin: [88, 80],
  duration: 1.45,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    seed: 9,
    coins: 14,
    // how far the coins fall below the point before they are gone
    drop: 72,
  },
};

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [WHITE, C[6], C[5], C[3]] });
  const lights = new Lights();
  lights.add(0, 0, 50, C[4], 0.7, 0.5);
  lights.add(0, 0, 18, WHITE, 0.9, 0.12);
  for (let i = 0; i < 18; i++) {
    const an = -Math.PI / 2 + R.range(-1.3, 1.3), sp = R.range(120, 260);
    ps.spawn(P.SPARK, 0, 0, Math.cos(an) * sp, Math.sin(an) * sp, R.range(0.18, 0.4), C[5], 1, R.range(0, 0.05));
  }
  for (let i = 0; i < 10; i++) {
    const an = R.range(0, TAU), sp = R.range(30, 90);
    ps.spawn(P.STAR, 0, -2, Math.cos(an) * sp, Math.sin(an) * sp - 20, R.range(0.4, 0.8), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 1.8), R.range(0.05, 0.25));
  }
  const coins = [];
  for (let i = 0; i < o.coins; i++) {
    const u = o.coins > 1 ? i / (o.coins - 1) - 0.5 : 0;
    const an = -Math.PI / 2 + u * 1.9 + R.range(-0.12, 0.12), sp = R.range(190, 270) * (1 - Math.abs(u) * 0.3);
    coins.push({ x: R.range(-2, 2), y: 0, vx: Math.cos(an) * sp * 0.75, vy: Math.sin(an) * sp, ph: R.range(0, TAU), w: R.range(10, 18) * R.sign(), born: R.range(0, 0.18), glint: R.range(0, 1) });
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const c of coins) {
        if (t < c.born) continue;
        c.vy += 520 * dt;
        c.vx -= c.vx * 1.1 * dt;
        c.vy -= c.vy * 0.6 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.ph += c.w * dt;
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      if (t < 0.07) {
        const k = t / 0.07;
        p.circle(0, 0, 7 + 3 * k, C[6]);
        p.circle(0, 0, 5 + 2 * k, WHITE);
      }
      if (t < 0.2) flare(p, 0, 0, 20 * (1 - t / 0.2), 0.7, [C[3], C[5], C[6]]);
      const ru = seg(t, 0, 0.35);
      if (ru < 1) p.ring(0, 0, 4 + 30 * ease.outQuart(ru), Math.max(1, 2.5 * (1 - ru)), ru < 0.3 ? WHITE : C[5], 1 - ru);
      ps.draw(p, "back");
      for (const c of coins) {
        if (t < c.born) continue;
        // fades as it falls below the point, and in the last stretch of the effect whatever happens
        const a = clamp(1 - (c.y - o.drop * 0.5) / (o.drop * 0.5)) * (1 - seg(t, 1.2, 1.45));
        if (a <= 0.02) continue;
        drawCoin(p, c.x, c.y, c.ph, C, { a });
        p.glow(c.x, c.y, 7, C[4], 0.25 * a);
        const turn = Math.abs(Math.cos(c.ph));
        if (turn > 0.97 && a > 0.5) sparkle(p, c.x - 1, c.y - 2, 2, WHITE, C[6], 0.5);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
