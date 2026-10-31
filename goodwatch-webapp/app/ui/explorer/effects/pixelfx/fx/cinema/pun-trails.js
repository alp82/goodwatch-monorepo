// Two parallel fire trails streak across under a poster: something unseen races through with a white-hot spark at
// each track's head, flames spring up behind it and burn down the lines, embers lift, smoke curls off, scorch fades.
import { Particles, Lights, P, PF, Rng, fit, seg, ease, clamp, WHITE, hex } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: fire trails",
  desc: "Two parallel fire trails streak across under the poster behind white-hot heads, flames burning down the lines, embers lifting and smoke curling off as the scorch fades.",
  tags: ["cinema", "pun", "fire", "trails", "speed", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6"], seed: 1, w: 40, h: 60 },
};

const RUN = [0.04, 0.3], BURN = 1.3;
const SCORCH = hex("#2a1612");

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), { hw, hh, s } = dims(o), k = Math.max(0.6, s);
  const x0 = -hw * 1.15, x1 = hw * 1.15, gap = Math.max(4, hh * 0.16);
  const ys = [hh + gap * 0.45, hh + gap * 1.45];
  const ps = new Particles({ rng: R, sparks: ["#ffffff", "#fff3a6", "#ffc23d", "#f2561d"] }), lights = new Lights();
  let t = 0, lastX = x0;
  const head = () => x0 + (x1 - x0) * ease.inQuad(seg(t, RUN[0], RUN[1]));

  return {
    update(dt) {
      t += dt;
      const hx = head();
      // flames spawn behind the heads as they pass, then keep feeding along the lines while they burn
      if (t > RUN[0] && hx > lastX) {
        for (let x = lastX; x < hx; x += 1.2) {
          for (const y of ys) {
            if (R.chance(0.5)) ps.spawn(P.FIRE, x, y - 1, R.range(-20, 0), R.range(-22, -6), R.range(0.2, 0.42), 0, R.range(1, 1.8) * k, 0, R.chance(0.2) ? PF.SMOKES : 0);
            if (R.chance(0.12)) ps.spawn(P.SPARK, x, y, R.range(-60, -10), R.range(-60, -15), R.range(0.15, 0.35));
          }
        }
        lastX = hx;
      }
      if (t > RUN[1] && t < BURN) {
        const life = 1 - seg(t, RUN[1], BURN), n = (x1 - x0) * dt * 1.6 * life;
        for (let i = 0; i < n; i++) {
          const x = R.range(x0, x1), y = R.chance(0.5) ? ys[0] : ys[1];
          ps.spawn(P.FIRE, x, y - 1, R.range(-4, 4), R.range(-28, -10), R.range(0.2, 0.38) * (0.5 + life * 0.5), 0, R.range(1, 1.8) * k * (0.5 + life * 0.5), 0, t < 0.8 && R.chance(0.1) ? PF.SMOKES : 0);
          if (t < 1.0 && R.chance(0.08)) ps.spawn(P.EMBER, x, y - 2, R.range(-10, 10), R.range(-30, -15), R.range(0.4, 0.7));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      preview(p, o);
      // the scorched tracks
      const hx = head(), sc = 1 - seg(t, 1.2, 2.05);
      if (sc > 0)
        for (const y of ys)
          for (let x = x0; x < hx; x++) {
            const hot = clamp(1 - (hx - x) / (hw * 1.2)) * (1 - seg(t, RUN[1], 1.0)), glowing = 1 - seg(t, 0.5, BURN);
            const flick = Math.sin(x * 1.7 + t * 9) > -0.2;
            p.dot(x, y, hot > 0.6 ? C[6] : hot > 0.2 ? C[4] : glowing > 0.3 && flick ? C[3] : SCORCH, sc);
            p.dot(x, y + 1, SCORCH, sc * 0.6);
          }
      ps.draw(p, "back");
    },
    draw(p) {
      const hx = head();
      if (t > RUN[0] && t < RUN[1] + 0.05) {
        for (const y of ys) {
          // the head: a white-hot spark with a long streak of light behind it
          p.line(hx - 10 * k, y, hx, y, C[6]);
          p.line(hx - 4 * k, y, hx, y, WHITE);
          p.px(hx + 1, y, WHITE);
          p.glowLine(hx - 20 * k, y, hx, y, 5 * k, C[5], 0.5);
        }
        if (t < RUN[0] + 0.05) p.glow(x0, ys[0], 16 * k, C[6], 0.6);
      }
      if (t > RUN[1] && t < RUN[1] + 0.12) p.glow(x1, (ys[0] + ys[1]) / 2, 14 * k, C[6], 0.5 * (1 - (t - RUN[1]) / 0.12));
      // a warm pool along the lines while they burn
      const burn = seg(t, RUN[0], RUN[1]) * (1 - seg(t, 0.8, BURN + 0.2));
      if (burn > 0) p.glowLine(x0, ys[0], Math.min(hx, x1), ys[1], 8 * k, C[4], 0.25 * burn);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
