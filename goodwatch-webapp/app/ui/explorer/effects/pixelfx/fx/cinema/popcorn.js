// Made for the GoodWatch explorer map: burst.
import { Particles, Lights, P, Rng, fit, flare, seg, ease, clamp, TAU, WHITE, hex, mix, scale } from "../../core/index.js";

export const meta = {
  name: "Popcorn",
  desc: "A big kernel pop: a white hero flash and a burst ring, a dozen puffy lit popcorn pieces jump up and tumble, butter sparks, a curl of steam.",
  tags: ["cinema", "pick", "one-shot"],
  size: [152, 154],
  origin: [76, 58],
  duration: 1.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#7a4a12", "#c8892a", "#ffd24a", "#fff3c8", "#ffffff"], seed: 3, s: 1 },
};

const STEAM = hex("#f2eef8");

// one popped piece: a union of lumps, lit from the top left whatever way it tumbles, a butter patch, a dark rim
function piece(p, k, C, B) {
  const { x, y, r, rot, lumps } = k;
  const L = lumps.map(([an, d, rr]) => [x + Math.cos(an + rot) * d * r, y + Math.sin(an + rot) * d * r, rr * r]);
  const butter = L[k.butter];
  const ext = r * 2.1 + 1;
  p.shade(x - ext, y - ext, x + ext, y + ext, (px, py, out) => {
    let f = 9, nx = 0, ny = 0;
    for (const [lx, ly, lr] of L) {
      const dx = px - lx, dy = py - ly, d = Math.hypot(dx, dy) - lr;
      if (d < f) (f = d), (nx = dx), (ny = dy);
    }
    if (f > 0.45) return;
    const n = Math.hypot(nx, ny) || 1, lit = -(nx + ny) / n / 1.414; // 1 facing the top left
    out.a = k.a;
    if (f > -0.55) return lit > 0.3 ? B.hi : lit > -0.45 ? B.mid : B.rim;
    const bd = Math.hypot(px - butter[0], py - butter[1]);
    if (bd < butter[2] * 0.75 && lit < 0.6) return lit > -0.2 ? C[2] : C[1];
    if (lit > 0.55 && f < -0.9 && f > -1.9) return WHITE;
    return lit > -0.25 ? C[3] : lit > -0.7 ? B.cream : B.shadow;
  });
}

export function create(o) {
  const C = fit(o.palette, 5), s = o.s ?? 1, R = new Rng(o.seed);
  const B = { hi: mix(C[3], WHITE, 0.6), mid: C[3], rim: scale(C[1], 0.8), cream: mix(C[3], C[2], 0.3), shadow: mix(C[2], C[1], 0.35) };
  const ps = new Particles({ rng: R, sparks: [C[4], C[3], C[2], C[1]], haze: C[3] });
  const lights = new Lights();
  lights.add(0, 0, 46 * s, C[2], 0.55, 0.5);
  lights.add(0, 0, 18 * s, WHITE, 0.8, 0.1);
  // butter sparks: a fan up and out, a few low ones
  for (let i = 0; i < 22; i++) {
    const an = -Math.PI / 2 + R.range(-1.45, 1.45), sp = R.range(130, 300) * s;
    ps.spawn(P.SPARK, 0, -2, Math.cos(an) * sp, Math.sin(an) * sp, R.range(0.18, 0.45), C[3], 1, R.range(0, 0.04));
  }
  for (let i = 0; i < 8; i++) {
    const an = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(40, 110) * s;
    ps.spawn(P.EMBER, R.range(-4, 4) * s, -2, Math.cos(an) * sp, Math.sin(an) * sp, R.range(0.5, 0.9), C[2], R.range(1, 2), R.range(0.03, 0.12));
  }
  // steam: a soft puff that rises after the pop
  const steam = [];
  for (let i = 0; i < 3; i++) steam.push({ x: (i - 1) * 4 * s, d: 0.08 + i * 0.07, w: R.range(0, TAU), life: R.range(0.55, 0.75), r: R.range(2.5, 3.6) * s });
  // the popcorn: a dozen pieces, varied sizes, one big hero piece straight up
  const pcs = [];
  for (let i = 0; i < 12; i++) {
    const hero = i === 0;
    const an = hero ? -Math.PI / 2 : -Math.PI / 2 + ((i - 6) / 6) * 1.0 + R.range(-0.15, 0.15);
    const sp = (hero ? 230 : R.range(160, 250)) * s;
    const n = R.int(3, 5), lumps = [];
    for (let j = 0; j < n; j++) lumps.push([(j / n) * TAU + R.range(-0.4, 0.4), j === 0 ? 0 : R.range(0.55, 0.85), R.range(0.6, 0.85)]);
    pcs.push({
      x: R.range(-3, 3) * s, y: -2, vx: Math.cos(an) * sp * 0.6, vy: Math.sin(an) * sp, r: (hero ? 4.4 : R.range(2.4, 3.9)) * s,
      rot: R.range(0, TAU), va: R.range(5, 11) * R.sign(), lumps, butter: R.int(1, n - 1), delay: hero ? 0 : R.range(0, 0.1),
      life: R.range(0.8, 0.98), age: 0, a: 1, R0: 0,
    });
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
      for (const k of pcs) {
        if (t < k.delay) continue;
        k.age += dt;
        k.vy += 470 * s * dt;
        k.vx -= k.vx * 0.9 * dt;
        k.vy -= k.vy * 0.9 * dt;
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        k.rot += k.va * dt;
        k.va -= k.va * 0.8 * dt;
        k.a = clamp(1 - (k.age - k.life * 0.85) / (k.life * 0.15));
        k.shrink = clamp(1 - (k.age - k.life * 0.6) / (k.life * 0.4));
      }
    },
    draw(p) {
      // hero flash and burst ring
      if (t < 0.06) {
        p.circle(0, -2, 7 * s * (1 - t / 0.12), WHITE);
        p.glow(0, -2, 30 * s, C[3], 0.7);
      }
      if (t < 0.16) flare(p, 0, -2, 16 * s * (1 - t / 0.16), 0.6, [C[1], C[2], C[3]]);
      const ru = seg(t, 0, 0.32);
      if (ru < 1) {
        const rr = (5 + 34 * ease.outQuart(ru)) * s, w = Math.max(1, 3.2 * (1 - ru)) * s;
        p.ring(0, -2, rr, w, (v) => (v > 0.6 ? (ru < 0.35 ? WHITE : C[3]) : C[2]), (1 - ru) * 1.1);
        p.glowRing(0, -2, rr, 5 * s, C[2], 0.35 * (1 - ru));
      }
      p.glow(0, -6, 40 * s, C[2], 0.22 * (1 - seg(t, 0, 0.7)));
      // steam: thin luminous wisps curling up from the pop
      for (const w of steam) {
        const u = (t - w.d) / w.life;
        if (u <= 0 || u >= 1) continue;
        const head = -6 * s - 36 * s * ease.outCubic(u), len = 12 * s * Math.sin(Math.PI * Math.min(1, u * 1.4)), a = 1 - u;
        for (let d = 0; d < len; d += 0.6) {
          const y = head + d, x = w.x + Math.sin((y / s) * 0.22 + w.w + u * 3) * 2.2 * s;
          p.dot(x, y, d < len * 0.3 ? STEAM : B.mid, a * (0.85 - (d / len) * 0.6));
        }
        p.glow(w.x, head + len * 0.4, 6 * s, STEAM, 0.18 * a);
      }
      ps.draw(p, "back");
      for (const k of pcs) {
        if (t < k.delay || k.a <= 0) continue;
        const grow = ease.outBack(seg(k.age, 0, 0.12)) * (0.35 + 0.65 * k.shrink);
        if (grow <= 0.05) continue;
        const r0 = k.r;
        k.r = r0 * grow;
        piece(p, k, C, B);
        k.r = r0;
        if (k.age < 0.2) p.glow(k.x, k.y, r0 * 3, C[3], 0.25 * (1 - k.age / 0.2));
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
