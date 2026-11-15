// Made for the GoodWatch stats page: A thrown d6 that lands on a chosen face.
import { Particles, Lights, P, Rng, fit, hex, sparkle, seg, ease, clamp, bump, TAU, WHITE } from "../../core/index.js";
import { drawDie, faceRun } from "./_die.js";

export const meta = {
  name: "Die tumble",
  desc: "A thrown die tumbles over face after face, bounces twice in puffs of dust, rocks and settles on its face with a glint, then winks out.",
  tags: ["stats", "dice", "roll", "random", "one-shot"],
  size: [200, 104],
  origin: [140, 84],
  duration: 1.75,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    dust: ["#5a4426", "#8c6c40", "#c8a46a", "#f0dcae"],
    pip: "#1a0f04",
    seed: 5,
    face: 5,
    // where it's thrown from (relative to where it lands) and how high it flies
    x0: -100,
    y0: -34,
    peak: 30,
    // quarter rolls over the throw, and picture-plane spin in turns
    turns: 7,
    spin: 1.5,
    size: 14,
    // seconds it rests on its face before it winks out
    hold: 0.45,
  },
};

const T1 = 0.4, T2 = 0.62, T3 = 0.76, OUT = 0.3;

export function create(o) {
  const C = fit(o.palette, 8), D = fit(o.dust, 4), R = new Rng(o.seed), S = o.size;
  const pip = hex(o.pip);
  const faces = faceRun(o.turns, o.face, (n) => R.int(0, n - 1));
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[3]] });
  const lights = new Lights();
  const land1 = o.x0 * 0.22, land2 = o.x0 * 0.06;
  const restAt = T3, fadeAt = T3 + 0.2 + o.hold;
  let t = 0, hits = 0;

  // where the die is: three arcs, each landing on the floor (its bottom edge on y = 0)
  function pos(tt) {
    const r = S / 2;
    if (tt < T1) {
      const u = tt / T1;
      return [o.x0 + (land1 - o.x0) * u, o.y0 * (1 - u) - 4 * o.peak * u * (1 - u) - r];
    }
    if (tt < T2) {
      const u = (tt - T1) / (T2 - T1);
      return [land1 + (land2 - land1) * u, -4 * o.peak * 0.32 * u * (1 - u) - r];
    }
    if (tt < T3) {
      const u = (tt - T2) / (T3 - T2);
      return [land2 + (0 - land2) * u, -4 * o.peak * 0.08 * u * (1 - u) - r];
    }
    return [0, -r];
  }

  function puff(x, k) {
    // dust kicked out low on both sides, grit hopping off, a flick of light
    const n = Math.round(6 + 8 * k);
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      ps.spawn(P.DUST, x + dir * R.range(2, 6), -1, dir * R.range(20, 70) * k, -R.range(4, 16) * k, R.range(0.35, 0.7), R.pick([D[2], D[2], D[3], D[3]]), R.range(1.6, 3.2) * (0.6 + 0.4 * k));
    }
    for (let i = 0; i < Math.round(3 * k); i++) {
      const dir = R.sign();
      ps.spawn(P.GRIT, x + dir * 4, -1, dir * R.range(30, 80), -R.range(40, 90) * k, R.range(0.4, 0.7), D[2], 1);
    }
    lights.add(x, -3, 16 + 10 * k, C[4], 0.35 * k, 0.18);
  }

  return {
    update(dt) {
      t += dt;
      const marks = [T1, T2, T3];
      while (hits < 3 && t >= marks[hits]) {
        const x = [land1, land2, 0][hits];
        puff(x, [1, 0.55, 0.3][hits]);
        if (hits === 2) {
          for (let i = 0; i < 6; i++) {
            const an = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(40, 90);
            ps.spawn(P.STAR, R.range(-4, 4), -S, Math.cos(an) * sp, Math.sin(an) * sp, R.range(0.3, 0.55), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 1.6), 0.08);
          }
          lights.add(0, -S / 2, 26, C[5], 0.5, 0.35);
        }
        hits++;
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // a warm pool of light on the floor under the die that tightens as it comes down
      const [x, y] = pos(Math.min(t, T3));
      const h = clamp(-(y + S / 2) / 40);
      const fade = 1 - seg(t, fadeAt, fadeAt + OUT);
      p.glow(x, -1, S * (1.1 - 0.5 * h), C[3], 0.28 * (1 - h) * fade);
      ps.draw(p, "back");
    },
    draw(p) {
      const tt = Math.min(t, T3);
      let [x, y] = pos(tt);
      // tumble: rolls over faces fast at first, slowing to the last; spins in the picture plane and settles flat
      const pr = ease.outQuad(clamp(tt / T3));
      const ang = (o.turns * Math.PI) / 2 * pr;
      let k = Math.floor(ang / (Math.PI / 2) + 1e-6);
      if (k >= o.turns) k = o.turns;
      const roll = k >= o.turns ? 0 : ang - (k * Math.PI) / 2;
      let a = -o.spin * TAU * (1 - ease.outCubic(clamp(tt / T3)));
      // landing: a squash, then a rock on its corner that dies away
      const after = t - restAt;
      let sq = 1;
      if (after > 0) {
        sq = 1 - 0.2 * bump(after, 0, 0.12);
        a += 0.22 * Math.sin(after * 30) * Math.exp(-after * 11);
        y = -S / 2 + (S / 2) * (1 - sq);
      } else for (const m of [T1, T2]) sq = Math.min(sq, 1 - 0.18 * bump(t, m - 0.02, m + 0.06));
      const out = seg(t, fadeAt, fadeAt + OUT);
      if (out >= 1) return;
      const hot = t < 0.05 ? 1 - t / 0.05 : out > 0 ? out * 0.9 : 0;
      p.glow(x, y, S * 1.4, C[4], 0.22 * (1 - out));
      drawDie(p, x, y, { s: S, a, roll, from: faces[Math.min(k, o.turns)], to: faces[Math.min(k + 1, o.turns)], sq, alpha: 1 - out * out, hot }, C, pip);
      // a glint runs over its top corner once it has settled
      const g = seg(after, 0.12, 0.34);
      if (g > 0 && g < 1) sparkle(p, x - S / 2 + 2, y - S / 2 + 1, Math.round(4 * Math.sin(g * Math.PI)), WHITE, C[5], 0.6);
      // it winks out in a little pop of light
      if (out > 0.55) {
        const q = seg(out, 0.55, 1);
        p.ring(x, y, 3 + 9 * ease.outCubic(q), 1, C[6], 1 - q);
        p.glow(x, y, 12, C[5], 0.4 * (1 - q));
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
