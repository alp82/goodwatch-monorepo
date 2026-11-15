// Made for the GoodWatch stats page: Insert coin: a coin drops into a slot and the slot lights up.
import { Particles, Lights, P, Rng, fit, flare, sparkle, seg, ease, clamp, bump, WHITE } from "../../core/index.js";
import { drawCoin } from "./_coin.js";

export const meta = {
  name: "Coin slot",
  desc: "A coin flips up with a glint, spins down, turns edge-on and slides into a slot; the slot flashes white, light pours out and sparks hop up.",
  tags: ["stats", "coin", "arcade", "insert", "one-shot"],
  size: [96, 96],
  origin: [48, 64],
  duration: 1.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    seed: 7,
    // the slot itself: false when the page already draws it
    slot: true,
    w: 12,
    // how high the coin starts above the slot
    h: 40,
  },
};

const IN = 0.5, DOWN = 0.62;

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), W = o.w;
  const ps = new Particles({ rng: R, sparks: [WHITE, C[6], C[5], C[3]] });
  const lights = new Lights();
  let t = 0, popped = false;
  return {
    update(dt) {
      t += dt;
      if (!popped && t >= DOWN - 0.04) {
        popped = true;
        for (let i = 0; i < 14; i++) {
          const an = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(70, 190);
          ps.spawn(P.SPARK, R.range(-W / 2, W / 2), -1, Math.cos(an) * sp * 0.7, Math.sin(an) * sp, R.range(0.2, 0.45), C[5], 1);
        }
        for (let i = 0; i < 7; i++) {
          const an = -Math.PI / 2 + R.range(-1.3, 1.3), sp = R.range(30, 80);
          ps.spawn(P.STAR, R.range(-W / 2, W / 2), -3, Math.cos(an) * sp, Math.sin(an) * sp, R.range(0.35, 0.65), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 1.8), R.range(0, 0.12));
        }
        lights.add(0, -2, 34, C[4], 0.7, 0.45);
        lights.add(0, -1, 12, WHITE, 0.8, 0.12);
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      const end = seg(t, 1.0, 1.3);
      // the slot: a dark mouth in a lit bezel that warms as the coin comes and flashes when it goes in
      const warm = seg(t, 0.1, DOWN), flash = bump(t, DOWN - 0.04, DOWN + 0.14);
      if (o.slot) {
        const a = 1 - end;
        p.rect(-W / 2 - 2, -2, W + 4, 4, C[1], a);
        p.rect(-W / 2 - 1, -1, W + 2, 2, C[0], a);
        p.line(-W / 2 - 1, -2, W / 2, -2, C[3], a);
      }
      p.glowLine(-W / 2, 0, W / 2, 0, 3, C[4], (0.15 + 0.35 * warm) * (1 - end) + flash * 0.6);
      if (flash > 0) p.line(-W / 2, 0, W / 2 - 1, 0, flash > 0.5 ? WHITE : C[6], 1);
      if (t < DOWN + 0.02) {
        // the coin: pops in at the top, spins down faster and faster, edge-on by the time it reaches the slot
        const u = seg(t, 0, IN);
        const y = -o.h + o.h * ease.inQuad(u) - 4 + 4 * seg(t, IN, DOWN) + 6 * seg(t, IN, DOWN);
        const ph = Math.PI * 4.5 * ease.outQuad(u) + Math.PI / 2 * 0;
        const edge = seg(t, IN - 0.12, IN);
        const spin = edge >= 1 ? Math.PI / 2 : ph * (1 - edge) + (Math.PI / 2) * edge;
        const x = Math.sin(u * 5) * 1.5 * (1 - u);
        const pop = ease.outBack(seg(t, 0, 0.08));
        if (pop > 0.3) drawCoin(p, x, y, spin, C, { clip: (py) => py < -1 });
        p.glow(x, y, 9, C[4], 0.3 * (1 - seg(t, IN, DOWN)));
        if (t < 0.12) sparkle(p, x - 2, y - 3, Math.round(5 * (1 - t / 0.12)), WHITE, C[5], 0.6);
      }
      if (flash > 0) flare(p, 0, -1, 12 * flash, 0.55 * flash, [C[3], C[5], C[6]]);
      // soft shafts of light rise out of the slot after the coin goes in and fade
      const fan = seg(t, DOWN, 1.25);
      if (fan > 0 && fan < 1) {
        const k = (1 - fan) * (1 - fan), hgt = 6 + 16 * ease.outCubic(fan);
        for (const dx of [-W / 3, 0, W / 3]) p.glowLine(dx, -1, dx * 1.6, -hgt, 2.5, C[5], 0.32 * k);
        p.glow(0, -4, 16, C[4], 0.3 * k);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
