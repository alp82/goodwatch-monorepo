// Made for the GoodWatch explorer map: title pun.
// Speed: layered speed lines whip across the poster from right to left (far ones dim and slow, near ones bright and
// fast), a white flash streak tears through, tire smoke billows off the bottom edge and sparks skid along it.
import { Particles, Lights, P, PF, Rng, clamp, seg, ease, WHITE, hex, fit, mix } from "../../core/index.js";
import { poster } from "./_pun2.js";
import { preview } from "./_pun1.js";

export const meta = {
  name: "Pun: speed",
  desc: "Speed lines whip across the poster right to left in layers, a white flash streak tears through, tire smoke billows at the bottom edge and sparks skid away.",
  tags: ["cinema", "pun", "speed", "racing", "car", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#141c34", "#27447a", "#4f86cc", "#9fd0ff", "#e4f4ff", "#ffffff"], smoke: "#c9ccd6", seed: 1, w: 40, h: 60 },
};

export function create(o) {
  const { w, h, k } = poster(o), hw = w / 2, hh = h / 2, sk = Math.sqrt(k), R = new Rng(o.seed);
  const C = fit(o.palette, 6), SMOKE = hex(o.smoke);
  const floor = hh;
  const ps = new Particles({ rng: R, ground: () => floor, sparks: ["#ffffff", "#fff3a6", "#ffc23d", "#ff8a2a"] }), lights = new Lights();
  // speed lines: layer 0 far (dim, slow, short), 1 mid, 2 near (bright, fast, long)
  const lines = [], n = Math.round(clamp(26 * k, 16, 70));
  for (let i = 0; i < n; i++) {
    const L = i % 3, u = i / n;
    lines.push({ y: R.range(-hh * 0.95, hh * 0.85), layer: L,
      len: (L === 2 ? R.range(0.9, 1.5) : L === 1 ? R.range(0.6, 1.0) : R.range(0.35, 0.7)) * w,
      v: (L === 2 ? R.range(300, 400) : L === 1 ? R.range(190, 250) : R.range(110, 150)) * Math.pow(k, 0.8),
      t0: 0.02 + Math.pow(u, 1.6) * 0.65 + R.range(0, 0.05) });
  }
  const FLASH = 0.03, fy = hh * R.range(0.0, 0.2);
  const SMOKE_T = [0.08, 0.7];
  let t = 0, sx = hw * 1.1;
  const x0 = hw + 4;
  return {
    update(dt) {
      t += dt;
      // a skidding contact point runs right to left along the bottom edge, smoking and sparking
      const u = seg(t, SMOKE_T[0], SMOKE_T[1]);
      if (u > 0 && u < 1) {
        const cx = hw * 1.1 - ease.outQuad(u) * w * 1.15;
        for (let x = sx; x > cx; x -= 2.2 / sk) {
          if (R.chance(0.45)) ps.spawn(P.SMOKE, x, floor - R.range(0, 2), R.range(15, 45) * sk, -R.range(8, 22) * sk, R.range(0.9, 1.5), SMOKE, R.range(1.8, 3) * Math.pow(k, 0.75), 0, R.chance(0.3) ? PF.BIG : 0);
          if (R.chance(0.4)) ps.spawn(P.SPARK, x, floor - 0.5, R.range(80, 170) * sk, -R.range(10, 70), R.range(0.15, 0.32));
          if (R.chance(0.15)) ps.spawn(P.DUST, x, floor - 1, R.range(20, 50), -R.range(2, 8), R.range(0.5, 0.8), mix(SMOKE, C[1], 0.4), R.range(1.2, 2) * sk);
        }
        sx = cx;
        if (R.chance(Math.min(1, dt * 20))) lights.add(cx, floor, 10 * sk, hex("#ffc23d"), 0.35, 0.12);
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      preview(p, o);
      ps.draw(p, "back");
    },
    draw(p) {
      lights.draw(p);
      // skid marks along the bottom edge, fading
      const sm = seg(t, SMOKE_T[0], SMOKE_T[1]), ka = clamp((2.0 - t) / 0.6);
      if (sm > 0 && ka > 0) {
        const xe = hw * 1.1 - ease.outQuad(sm) * w * 1.15;
        if (ka > 0.4) p.line(xe, floor - 1, hw * 1.1, floor - 1, (q) => (q < 0.5 ? hex("#2a2430") : hex("#3e3440")));
      }
      for (const l of lines) {
        const dt = t - l.t0;
        if (dt < 0) continue;
        const hx = x0 + l.len * 0.2 - dt * l.v; // head (left end)
        const tx = Math.min(x0 + l.len * 0.2 + 2, hx + l.len * Math.min(1, dt * 6)); // tail stretches out first
        if (tx < -hw - 4) continue;
        if (l.layer === 0 && t < 0.05) continue;
        const head = l.layer === 2 ? WHITE : l.layer === 1 ? C[4] : C[3];
        const mid = l.layer === 2 ? C[3] : l.layer === 1 ? C[2] : C[1];
        const tail = l.layer === 2 ? C[2] : C[1];
        const xa = Math.max(hx, -hw - 4), xb = Math.min(tx, hw + 6), span = Math.max(1, tx - hx);
        if (xb <= xa) continue;
        // solid ramp steps along the line, only the last stretch dithers away
        const gAt = (q) => (xa - hx + q * (xb - xa)) / span;
        p.line(xa, l.y, xb, l.y, (q) => { const g = gAt(q); return g < 0.1 ? head : g < 0.4 ? mid : g < 0.75 ? tail : C[0]; },
          (q) => { const g = gAt(q); return g < 0.75 ? 1 : 1.9 - g * 1.5; });
        if (l.layer === 2) {
          const xe = k > 1.8 ? xb : Math.min(xb, hx + span * 0.3);
          if (xe > xa + 1) p.line(xa, l.y + 1, xe, l.y + 1, (q) => (q < 0.25 && hx >= xa - 1 ? C[4] : tail));
          if (hx > -hw - 4) p.glow(hx, l.y, 3, C[4], 0.3);
        }
      }
      // the flash streak: a white beam tearing through, thinning to a line
      const f = seg(t, FLASH, FLASH + 0.36);
      if (f > 0 && f < 1) {
        const hx = hw + 6 - ease.outExpo(f) * (w + 14), th = Math.round(Math.max(0, 2.2 * sk * (1 - f * 1.3)));
        const tail = Math.min(hw + 6, hx + w * (1.5 - f));
        for (let d = -th; d <= th; d += 1) {
          const edge = Math.abs(d) === th && th > 0, L = tail - hx;
          p.line(hx + Math.abs(d) * 2, fy + d, tail - L * (edge ? 0.5 : 0), fy + d, (q) => (q < 0.35 - f * 0.2 && !edge ? WHITE : q < 0.7 ? (edge ? C[3] : C[4]) : C[2]));
        }
        p.glowLine(hx, fy, tail, fy, 5 * sk, C[4], 0.4 * (1 - f));
        p.glow(hx, fy, 9 * sk, WHITE, 0.5 * (1 - f));
        if (f < 0.25) p.glow(0, fy, 26 * sk, C[3], 0.3 * (1 - f * 4));
      }
      ps.draw(p, "front");
    },
  };
}
