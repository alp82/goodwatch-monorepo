// Made for the GoodWatch stats page: Sparks between two scores that disagree. With `ring` (a radius) the
// middle is a badge the bolt lands on: each strike knocks a shock ring off the badge's rim. With `ink` the bolt and the
// ring get a dark outline, so they read over bright brand colors (a yellow IMDb half) as well as the dark page.
import { Particles, Lights, P, Rng, rng, fit, hex, bolt, forks, sparkle, seg, clamp, ease, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Score clash",
  desc: "Sparks gather at two points, a bolt snaps between them and re-strikes twice, a flare pops at the middle (and shock rings off a badge there), sparks spray, it cools.",
  tags: ["stats", "disagree", "lightning", "spark", "one-shot"],
  size: [80, 48],
  origin: [20, 24],
  duration: 0.9,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    dx: 40,
    dy: 0,
    ring: 0,
    ink: null,
    jag: 0,
    seed: 3,
  },
};

// when each strike lands and how long its white frame holds
const STRIKES = [[0.14, 0.09], [0.29, 0.06], [0.42, 0.05]];

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), dx = o.dx, dy = o.dy, L = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / L, uy = dy / L, mx = dx / 2, my = dy / 2;
  const floor = Math.max(0, dy) + 9;
  const ps = new Particles({ rng: R, ground: () => floor, sparks: [WHITE, C[6], C[5], C[3]] });
  const lights = new Lights();
  const depth = L < 28 ? 3 : L < 70 ? 4 : 5;
  const paths = STRIKES.map((_, k) => {
    const r = rng(o.seed, 7, k);
    const main = bolt(r, 0, 0, dx, dy, { jag: o.jag || Math.min(0.2, 9 / L), depth }); // `jag` flattens it for a short card
    return { main, forks: forks(r, main, { count: L < 30 ? 1 : 2, len: Math.min(14, L * 0.3), jag: 0.3, spread: 0.9 }) };
  });
  const INK = o.ink ? hex(o.ink) : null;
  let t = 0, struck = 0, charged = 0;

  return {
    update(dt) {
      t += dt;
      // charge: streaks drawn into both ends
      if (t < STRIKES[0][0] && charged < 10 && t > charged * 0.012) {
        charged++;
        for (const [ex, ey] of [[0, 0], [dx, dy]]) {
          const a = R.range(0, TAU), d = R.range(6, 10);
          ps.spawn(P.STREAK, ex + Math.cos(a) * d, ey + Math.sin(a) * d, -Math.cos(a) * 30, -Math.sin(a) * 30, 0.1, C[5]);
        }
      }
      while (struck < STRIKES.length && t >= STRIKES[struck][0]) {
        const k = 1 - struck * 0.35;
        const lk = INK ? 0.35 : 1; // an outlined bolt keeps its light low, or the light washes the outline out
        lights.add(mx, my, 10 + L * 0.15, C[5], 0.55 * k * lk, 0.25);
        lights.add(0, 0, 9, C[4], 0.5 * k * lk, 0.2);
        lights.add(dx, dy, 9, C[4], 0.5 * k * lk, 0.2);
        const n = Math.round((struck ? 3 : 9) * Math.min(1.4, 0.6 + L / 80));
        for (let i = 0; i < n; i++) {
          // off the middle, across the bolt more than along it
          const side = R.sign(), a = Math.atan2(uy, ux) + side * R.range(0.6, 2.5) - (R.chance(0.6) ? Math.PI / 2 * 0 : 0);
          const sp = R.range(50, 150) * k;
          const sx = mx + R.range(-0.25, 0.25) * dx, sy = my + R.range(-0.25, 0.25) * dy;
          ps.spawn(P.SPARK, sx, sy, Math.cos(a) * sp, Math.sin(a) * sp - 40, Math.min(R.range(0.22, 0.42), 0.86 - t), WHITE);
        }
        for (const [ex, ey, dir] of [[0, 0, -1], [dx, dy, 1]])
          for (let i = 0; i < 2; i++) {
            const a = Math.atan2(uy, ux) * 1 + (dir < 0 ? Math.PI : 0) + R.range(-0.9, 0.9);
            ps.spawn(P.SPARK, ex, ey, Math.cos(a) * R.range(40, 90), Math.sin(a) * R.range(40, 90) - 30, Math.min(R.range(0.2, 0.4), 0.86 - t), WHITE);
          }
        struck++;
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // charge glow at the ends
      const ch = seg(t, 0, STRIKES[0][0]);
      if (t < STRIKES[0][0]) {
        for (const [ex, ey] of [[0, 0], [dx, dy]]) {
          p.glow(ex, ey, 4 + 5 * ch, C[4], 0.4 * ch);
          p.px(ex, ey, ch > 0.5 ? C[6] : C[4]);
        }
      }
      for (let k = 0; k < STRIKES.length; k++) {
        const [s, hold] = STRIKES[k], age = t - s;
        if (age < 0 || age > hold + 0.08) continue;
        const { main, forks: fk } = paths[k];
        const hot = age < hold;
        const core = hot ? (age < 0.03 ? WHITE : C[6]) : C[3];
        const edge = hot ? C[5] : C[2];
        // (light would wash an outline out: with ink the bolt glows only faintly)
        if (hot) for (let i = 1; i < main.length; i++) p.glowLine(main[i - 1][0], main[i - 1][1], main[i][0], main[i][1], INK ? 2 : 4, C[4], INK ? 0.12 : 0.35);
        // the outline: the core's path stamped dark one pixel around, under everything else
        if (hot && INK)
          for (const [ox, oy] of [[0, -2], [0, 2], [-1, -1], [1, 1], [1, -1], [-1, 1]]) p.polyline(main.map(([x, y]) => [x + ox, y + oy]), INK);
        // a 1 px halo either side of the core, then the core
        if (hot)
          for (const [ox, oy] of [[-uy, ux], [uy, -ux]]) {
            const pts = main.map(([x, y]) => [x + ox, y + oy]);
            p.polyline(pts, edge, age < 0.03 ? 0.75 : 0.45);
          }
        p.polyline(main, core);
        for (const f of fk) p.polyline(f, hot ? C[5] : C[2], hot ? 1 : 0.5);
        if (hot) {
          sparkle(p, 0, 0, 2, C[6], C[4], 0.4);
          sparkle(p, dx, dy, 2, C[6], C[4], 0.4);
        }
      }
      // the hit flare at the middle on the first strike
      const fa = t - STRIKES[0][0];
      if (fa >= 0 && fa < 0.22) {
        const k = 1 - fa / 0.22;
        sparkle(p, mx, my, 2 + 5 * k, fa < 0.05 ? WHITE : C[6], C[4], 0.7 * k);
        if (fa < 0.05) p.circle(mx, my, 2.2, WHITE);
        p.glow(mx, my, INK ? 4 : 8 + L * 0.06, C[5], (INK ? 0.3 : 0.45) * k);
      }
      // the badge: every strike lights its rim, the first also knocks a shock ring off it
      if (o.ring > 0) {
        for (let k = 0; k < STRIKES.length; k++) {
          const age = t - STRIKES[k][0];
          if (age >= 0 && age < 0.07) p.ring(mx, my, o.ring, 1.5, age < 0.03 ? WHITE : C[6], k ? 0.6 : 1);
        }
        const age = t - STRIKES[0][0], life = 0.24;
        if (age >= 0 && age < life) {
          // out fast and cut, never faded (a faded 1 px ring dithers into dashes)
          const u = age / life, R = o.ring + 1.5 + Math.min(6, o.ring) * ease.outQuad(u);
          if (INK) p.ring(mx, my, R + 1, 1, INK);
          p.ring(mx, my, R, 1.5, u < 0.2 ? WHITE : u < 0.55 ? C[6] : C[5]);
          if (!INK) p.glowRing(mx, my, R, 2, C[5], 0.3 * (1 - u));
        }
      }
      ps.draw(p);
      lights.draw(p);
      // a cooling ember of light at each end
      const cool = 1 - seg(t, 0.45, 0.75);
      if (t > STRIKES[0][0] && cool > 0) {
        p.dot(0, 0, C[4], cool);
        p.dot(dx, dy, C[4], cool);
      }
    },
  };
}
