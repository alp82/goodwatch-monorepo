// A beam of breath roars in from the left across a poster: a white-hot core in a churning sheath that swells and
// surges, sparks spraying off its far end and smoke rolling off it, then it chokes off and thins away.
import { Particles, Lights, P, Rng, fit, seg, ease, clamp, TAU, WHITE } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: breath",
  desc: "A beam of breath roars in from the left across the poster: a white-hot core in a churning sheath, sparks off its far end, smoke rolling off it, then it chokes off.",
  tags: ["cinema", "pun", "breath", "beam", "atomic", "fire", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.0,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#06102a", "#0f2a6a", "#1f55c0", "#3f8cff", "#7cd0ff", "#c8f4ff", "#ffffff"], seed: 1, w: 40, h: 60 },
};

const ON = [0.02, 0.2], OFF = [0.95, 1.2];

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), { hw, hh, s } = dims(o), k = Math.max(0.6, s);
  const x0 = -hw * 1.1, x1 = hw * 1.05, y0 = -hh * 0.05, tilt = hh * 0.22;
  const ps = new Particles({ rng: R, sparks: [WHITE, C[5], C[4], C[3]] }), lights = new Lights();
  let t = 0, hit = false;
  const reach = () => ease.outQuart(seg(t, ON[0], ON[1]));
  const yAt = (x) => y0 + ((x - x0) / (x1 - x0)) * tilt * (ease.inOutQuad(seg(t, 0.1, 1.1)) * 2 - 1);
  const width = () => Math.max(1.6, hh * 0.09) * (1 - ease.inQuad(seg(t, OFF[0], OFF[1])));

  return {
    update(dt) {
      t += dt;
      const re = reach(), on = t < OFF[1];
      const xe = x0 + (x1 - x0) * re;
      if (re > 0.98 && !hit) {
        hit = true;
        lights.add(xe, yAt(xe), 30 * k, C[5], 0.6, 0.3);
      }
      if (on && t > ON[0]) {
        // sparks off the far end, smoke rolling off the top of the beam
        if (re > 0.5 && R.chance(dt * 60 * k)) {
          const a = R.range(-2.2, 2.2), sp = R.range(50, 130) * k;
          ps.spawn(P.SPARK, xe, yAt(xe), Math.cos(a) * sp * 0.6 + 20, Math.sin(a) * sp - 20, R.range(0.2, 0.45));
        }
        if (R.chance(dt * 18 * k)) {
          const x = x0 + (xe - x0) * R.range(0.2, 1);
          ps.spawn(P.SMOKE, x, yAt(x) - width(), R.range(5, 20), R.range(-20, -8), R.range(0.6, 1), C[1], R.range(1.6, 3) * k);
        }
        if (R.chance(dt * 30 * k)) {
          const x = x0 + (xe - x0) * R.range(0, 1);
          ps.spawn(P.MOTE, x, yAt(x) + R.range(-2, 2) * k, R.range(60, 120), R.range(-15, 15), R.range(0.15, 0.3), C[5], 1);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      preview(p, o);
      ps.draw(p, "back");
    },
    draw(p) {
      const re = reach(), w0 = width();
      if (re > 0 && w0 > 0.3 && t < OFF[1]) {
        const xe = x0 + (x1 - x0) * re;
        // the sheath: a churning edge that surges along the beam, then the core inside it
        for (let x = Math.floor(x0); x <= xe; x++) {
          const u = (x - x0) / (x1 - x0), y = yAt(x);
          const surge = 1 + 0.35 * Math.sin(u * 14 - t * 40) + 0.15 * Math.sin(u * 31 + t * 23);
          const w = w0 * surge * (0.55 + 0.45 * Math.min(1, u * 4)) * (x > xe - 3 ? 0.7 : 1);
          for (let d = -w; d <= w; d += 1) {
            const e = Math.abs(d) / w;
            p.px(x, y + d, e < 0.18 ? WHITE : e < 0.42 ? C[6] : e < 0.7 ? C[5] : e < 0.9 ? C[4] : C[3]);
          }
          p.dot(x, y - w - 1, C[3], 0.7);
          p.dot(x, y + w + 1, C[3], 0.7);
        }
        p.glowLine(x0, yAt(x0), xe, yAt(xe), w0 * 3.5 + 4, C[3], 0.35);
        p.glowLine(x0, yAt(x0), xe, yAt(xe), w0 * 1.5 + 2, C[5], 0.2);
        // the head: a hot bloom where it hits
        p.circle(xe, yAt(xe), w0 * 1.2 + 1, C[6]);
        p.circle(xe, yAt(xe), w0 * 0.7, WHITE);
        p.glow(xe, yAt(xe), 12 * k, C[5], 0.5);
        // the mouth it comes from: a flare at the left
        p.glow(x0, yAt(x0), 9 * k, C[5], 0.4);
      }
      if (t > ON[0] && t < ON[0] + 0.06) p.glow(x0, y0, 20 * k, C[6], 0.5);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
