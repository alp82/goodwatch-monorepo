// Made for the GoodWatch explorer map: title pun.
// Comic punch: focus lines rush in to a point on the poster's side, a jagged white-yellow starburst slams in on a
// white hero frame, a shock ring races out, the poster's outline doubles and shudders, sweat drops and sparks fly,
// then it all settles and fades.
import { Particles, Lights, P, Rng, clamp, seg, ease, TAU, WHITE, hex, fit } from "../../core/index.js";
import { poster } from "./_pun2.js";
import { preview } from "./_pun1.js";

export const meta = {
  name: "Pun: comic punch",
  desc: "Focus lines rush to the poster's side, a jagged white-yellow starburst slams in on a hero frame, a shock ring races out, the outline shudders, sweat and sparks fly, it settles.",
  tags: ["cinema", "pun", "punch", "boxing", "fight", "comic", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 1.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#5a1414", "#c8401e", "#ff8a2a", "#ffd23a", "#fff2a0", "#ffffff"], sweat: "#9fd8ff", seed: 1, w: 40, h: 60 },
};

const HIT = 0.1;

export function create(o) {
  const { w, h, k } = poster(o), hw = w / 2, hh = h / 2, sk = Math.sqrt(k), R = new Rng(o.seed), C = fit(o.palette, 6), SW = hex(o.sweat);
  const ix = hw * 0.55, iy = -hh * 0.12, RB = clamp(15 * Math.pow(k, 0.8), 9, 40);
  const ps = new Particles({ rng: R, sparks: ["#ffffff", "#fff2a0", "#ffd23a", "#ff8a2a"] }), lights = new Lights();
  // spike layout: n tips of uneven length, valleys between; reshuffled every few frames so the burst vibrates
  const N = 11, shapes = [];
  for (let s = 0; s < 4; s++) {
    const tips = [];
    for (let i = 0; i < N; i++) tips.push({ a: ((i + R.range(-0.25, 0.25)) / N) * TAU, r: R.range(0.72, 1.18), v: R.range(0.38, 0.52) });
    shapes.push(tips);
  }
  const lines = [];
  for (let i = 0; i < Math.round(16 + 6 * k); i++) lines.push({ a: R.range(0, TAU), len: R.range(0.35, 0.7), d: R.range(0, 0.04), w: R.chance(0.3) ? 2 : 1 });
  const drops = [];
  for (let i = 0; i < Math.round(4 + 2 * k); i++) {
    const a = -Math.PI / 2 + R.range(-1.4, 1.1), sp = R.range(70, 140) * sk;
    drops.push({ x: ix, y: iy, vx: Math.cos(a) * sp + 20 * sk, vy: Math.sin(a) * sp, s: R.range(1.1, 1.7) * Math.min(1.6, sk), life: R.range(0.5, 0.8) });
  }
  let t = 0, fired = false;
  const radius = (tips, a) => {
    // piecewise linear between tip and valley in angle
    a = ((a % TAU) + TAU) % TAU;
    for (let i = 0; i < N; i++) {
      const p0 = tips[i], p1 = tips[(i + 1) % N];
      let a0 = p0.a, a1 = p1.a;
      if (a1 < a0) a1 += TAU;
      let aa = a;
      if (aa < a0) aa += TAU;
      if (aa >= a0 && aa <= a1) {
        const m = (aa - a0) / (a1 - a0), vr = (p0.v + p1.v) / 2;
        return m < 0.5 ? p0.r + (vr - p0.r) * (m * 2) : vr + (p1.r - vr) * ((m - 0.5) * 2);
      }
    }
    return 0.5;
  };
  return {
    update(dt) {
      t += dt;
      if (!fired && t >= HIT) {
        fired = true;
        lights.add(ix, iy, 34 * sk, WHITE, 0.6, 0.14);
        lights.add(ix, iy, 46 * sk, C[3], 0.35, 0.6);
        for (let i = 0; i < Math.round(18 * sk); i++) {
          const a = R.range(0, TAU), sp = R.range(110, 230) * sk;
          ps.spawn(P.SPARK, ix, iy, Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 30, R.range(0.15, 0.35));
        }
        for (let i = 0; i < Math.round(5 * sk); i++) {
          const a = R.range(0, TAU), d = R.range(0.9, 1.5) * RB;
          ps.spawn(P.STAR, ix + Math.cos(a) * d, iy + Math.sin(a) * d, Math.cos(a) * 12, Math.sin(a) * 12, R.range(0.4, 0.7), C[4], R.range(1.5, 2.6) * sk, R.range(0.15, 0.35));
        }
      }
      if (t >= HIT)
        for (const d of drops) {
          d.vy += 420 * sk * dt;
          d.vx -= d.vx * 1.2 * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      preview(p, o);
    },
    draw(p) {
      // focus lines: rush in before the hit, then hang around it as emphasis and thin out
      const far = Math.max(w, h) * 0.75;
      for (const L of lines) {
        const u = t < HIT ? ease.inQuad(seg(t, L.d, HIT)) : 1, fade = t < HIT ? 1 : 1 - seg(t, HIT + 0.05, HIT + 0.45);
        if (fade <= 0 || u <= 0) continue;
        const r1 = RB * 1.15 + (far - RB) * (1 - u) * 0.7, r0 = r1 + far * L.len * (t < HIT ? 1 : fade);
        const ca = Math.cos(L.a), sa = Math.sin(L.a);
        // keep each ray inside the canvas by shortening it along its own direction
        const bx = Math.max(62, hw + 18), by = Math.max(62, hh + 18);
        const reach = Math.min(ca > 0 ? (bx - ix) / ca : ca < 0 ? (-bx - ix) / ca : 1e9, sa > 0 ? (by - iy) / sa : sa < 0 ? (-by - iy) / sa : 1e9);
        const R0 = Math.min(r0, reach), R1 = Math.min(r1, reach);
        if (R0 - R1 < 1) continue;
        const x0 = ix + ca * R0, y0 = iy + sa * R0, x1 = ix + ca * R1, y1 = iy + sa * R1;
        p.line(x0, y0, x1, y1, (q) => (q > 0.75 ? WHITE : q > 0.35 ? C[4] : C[3]));
        if (L.w === 2) p.line(x0 + sa, y0 - ca, x1 + sa, y1 - ca, (q) => (q > 0.5 ? C[3] : 0));
      }
      if (t < HIT) return;
      const tt = t - HIT;
      // the poster doubles and shudders: two offset outlines that flick side to side
      if (tt < 0.32) {
        const f = Math.floor(tt * 30), dx = (f % 2 ? 1 : -1) * Math.max(1, Math.round(2 * sk * (1 - tt / 0.32))), a = 1;
        const box = (ox, oy, c) => {
          p.line(-hw + ox, -hh + oy, hw - 1 + ox, -hh + oy, c, a);
          p.line(-hw + ox, hh - 1 + oy, hw - 1 + ox, hh - 1 + oy, c, a);
          p.line(-hw + ox, -hh + oy, -hw + ox, hh - 1 + oy, c, a);
          p.line(hw - 1 + ox, -hh + oy, hw - 1 + ox, hh - 1 + oy, c, a);
        };
        box(dx, f % 3 === 0 ? -1 : 0, tt < 0.06 ? WHITE : tt < 0.16 ? C[4] : C[3]);
        if (tt < 0.22) box(-dx, 0, tt < 0.1 ? C[3] : C[2]);
      }
      // shock ring
      const ru = seg(tt, 0, 0.42);
      if (ru < 1) {
        const r = RB * 0.8 + ease.outQuart(ru) * RB * 1.9;
        p.ring(ix, iy, r, ru < 0.3 ? 2 : 1, ru < 0.2 ? WHITE : ru < 0.45 ? C[4] : ru < 0.7 ? C[3] : C[1], ru < 0.8 ? 1 : (1 - ru) * 5);
        p.glowRing(ix, iy, r, 3, C[3], 0.35 * (1 - ru));
      }
      // the starburst: slams in oversize, settles, holds, shrinks away
      const grow = tt < 0.05 ? 1.3 : tt < 0.16 ? 1.3 - 0.3 * ease.outQuad(seg(tt, 0.05, 0.16)) : 1;
      const shrink = 1 - ease.inQuad(seg(tt, 0.35, 0.7));
      const RS = RB * grow * shrink;
      if (RS > 1.5) {
        const tips = shapes[Math.floor(tt * 15) % shapes.length], hero = tt < 0.045, spin = tt * 0.6;
        const ext = RS * 1.25 + 2;
        p.shade(ix - ext, iy - ext, ix + ext, iy + ext, (x, y, out) => {
          const dx = x - ix, dy = y - iy, d = Math.hypot(dx, dy), rr = radius(tips, Math.atan2(dy, dx) - spin) * RS;
          if (d > rr + 1) return;
          if (hero) return WHITE;
          if (d > rr) return C[0];
          const m = d / rr;
          if (m < 0.42) return (out.k = 0.25), WHITE;
          if (m < 0.62) return C[4];
          if (m < 0.86) return C[3];
          return C[2];
        });
        p.glow(ix, iy, RS * 1.6, C[3], 0.35 * shrink);
        p.glow(ix, iy, RS * 0.6, WHITE, hero ? 0.8 : 0.3 * shrink);
      }
      lights.draw(p);
      // sweat drops: teardrops trailing back along their flight
      for (const d of drops) {
        const a = clamp((d.life - tt) / 0.2);
        if (a <= 0 || Math.abs(d.y) > 58 || Math.abs(d.x) > 58) continue;
        const sp = Math.hypot(d.vx, d.vy) || 1, ux = d.vx / sp, uy = d.vy / sp, L = 1.5 + d.s * 2.2;
        p.line(d.x - ux * L, d.y - uy * L, d.x, d.y, (q) => (q > 0.45 ? SW : 0), a);
        p.circle(d.x, d.y, d.s * 1.05, SW, a);
        p.px(d.x - 0.4, d.y - 0.5, WHITE);
        p.glow(d.x, d.y, 3, SW, 0.25 * a);
      }
      ps.draw(p);
    },
  };
}
