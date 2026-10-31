// Made for the GoodWatch explorer map: title pun.
import { rng, clamp, seg, TAU, hex, fit, mix } from "../../core/index.js";
import { poster } from "./_pun2.js";
import { preview } from "./_pun1.js";

export const meta = {
  name: "Rising spores",
  desc: "Glowing motes lift off the poster in layers, blurred near ones, bright mid ones, fine far ones, drifting up and around it while pale ash falls; a soft flush where they rose.",
  tags: ["cinema", "pun", "spores", "ash", "bioluminescent", "motes", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "dark",
  // ashy grey-white with an ember red glow; pass a cyan ramp and glow for bioluminescence
  options: { palette: ["#1e1618", "#4a3a3c", "#8a7a78", "#cfc2bc", "#fff2ea"], glow: "#ff3a2a", seed: 1, w: 40, h: 60 },
};

// a mote's life envelope: in fast, a breathing middle, out slow
const life = (u) => clamp(u * 7) * clamp((1 - u) * 2.2);

export function draw(p, t, o) {
  preview(p, o);
  const { w, h, k } = poster(o), C = fit(o.palette, 5).map(hex), G = hex(o.glow), S = o.seed, sk = Math.sqrt(k);
  const hw = w / 2, hh = h / 2;
  const TINT = mix(G, C[3], 0.35), CORE = mix(C[4], G, 0.15), BODY = mix(C[3], G, 0.45), RIM = mix(C[2], G, 0.6), DEEP = mix(C[1], G, 0.5);

  // the flush where they lift from: a soft glow over the poster's lower half that breathes out
  const fl = seg(t, 0, 0.15) * (1 - seg(t, 0.3, 1.6));
  if (fl > 0) {
    p.glow(0, hh * 0.35, Math.max(w, h) * 0.6, G, 0.22 * fl);
    p.glow(0, hh * 0.6, w * 0.5, TINT, 0.18 * fl);
  }

  // a mote's path: from a point on or around the poster, rising and curling round, pushed a little outward
  const path = (r, age, speed) => {
    const x0 = r.range(-0.7, 0.7) * w, y0 = r.range(-0.1, 0.55) * h;
    const ph = r.range(0, TAU), sw = r.range(2, 5) * sk, fq = r.range(1.4, 3);
    const out = Math.sign(x0 || 1) * r.range(0, 8) * sk;
    const rise = r.range(0.75, 1.25) * speed * sk;
    return [x0 + Math.sin(ph + age * fq) * sw - Math.sin(ph) * sw + out * age, y0 - rise * age - 4 * age * age, ph];
  };

  // far layer: fine single pixels, dim, slow
  const nFar = Math.round(clamp(22 * k, 14, 70));
  for (let i = 0; i < nFar; i++) {
    const r = rng(S, i), born = r.range(0, 1.3), lf = r.range(0.9, 1.3), age = t - born;
    if (age < 0 || age >= lf) continue;
    const [x, y, ph] = path(r, age, 14);
    const a = life(age / lf) * (0.7 + 0.3 * Math.sin(ph * 3 + age * 8));
    if (a < 0.12) continue;
    p.px(x, y, a > 0.6 ? BODY : RIM);
    p.glow(x, y, 3, G, 0.22 * a);
  }

  // ash and pollen falling: pale flecks drifting down with a slow sway, catching the light as they turn
  const nAsh = Math.round(clamp(10 * k, 6, 34));
  for (let i = 0; i < nAsh; i++) {
    const r = rng(S + 70, i), born = r.range(0.2, 1.3), lf = r.range(1.0, 1.25), age = t - born;
    if (age < 0 || age >= lf) continue;
    const x0 = r.range(-0.7, 0.7) * w, y0 = -hh * r.range(0.6, 1.05), ph = r.range(0, TAU);
    const x = x0 + Math.sin(ph + age * 2.2) * 3 * sk, y = y0 + r.range(7, 13) * sk * age;
    const a = life(age / lf), turn = Math.sin(ph * 2 + age * 6);
    if (a < 0.15) continue;
    p.px(x, y, turn > 0.3 ? C[3] : C[2]);
    p.px(x + (turn > 0 ? 1 : -1), y + (r.chance(0.5) ? 0 : 1), C[1]);
    p.glow(x, y, 4, mix(C[3], G, 0.3), (turn > 0.5 ? 0.3 : 0.15) * a);
  }

  // mid layer: 2 to 3 px glowing motes, a hot core, a tinted body, their own light
  const nMid = Math.round(clamp(14 * k, 10, 44));
  for (let i = 0; i < nMid; i++) {
    const r = rng(S + 30, i), born = r.range(0.02, 1.2), lf = r.range(1.0, 1.35), age = t - born;
    if (age < 0 || age >= lf) continue;
    const [x, y, ph] = path(r, age, 24);
    const pulse = 0.72 + 0.28 * Math.sin(ph * 3 + age * r.range(4, 8)), a = life(age / lf) * pulse;
    if (a < 0.1) continue;
    const big = r.chance(0.45);
    if (a > 0.35) {
      if (big) {
        // a 3 px plus: dim rim arms round a hot heart
        p.px(x - 1, y, RIM), p.px(x + 1, y, RIM), p.px(x, y - 1, RIM), p.px(x, y + 1, RIM);
        p.px(x, y, a > 0.7 ? CORE : BODY);
      } else {
        // a 2 x 2: lit top-left, darker bottom-right
        p.px(x, y, a > 0.7 ? CORE : BODY), p.px(x + 1, y, BODY), p.px(x, y + 1, BODY), p.px(x + 1, y + 1, RIM);
      }
    } else p.px(x, y, a > 0.2 ? RIM : DEEP);
    p.light(x, y, TINT, 0.7 * a);
    p.glow(x, y, big ? 9 : 6, G, 0.55 * a);
  }

  // near layer: a few big blurred motes close to the eye, soft and translucent, faster
  const nNear = Math.round(clamp(6 * k, 4, 16));
  for (let i = 0; i < nNear; i++) {
    const r = rng(S + 50, i), born = r.range(0.1, 1.2), lf = r.range(1.0, 1.35), age = t - born;
    if (age < 0 || age >= lf) continue;
    const [x, y, ph] = path(r, age, 32);
    const a = life(age / lf) * (0.8 + 0.2 * Math.sin(ph + age * 5));
    if (a < 0.05) continue;
    const rr = r.range(2.6, 4.2) * sk;
    p.disc(x, y, rr, BODY, 0.35 * a);
    p.disc(x - 0.3, y - 0.3, rr * 0.6, CORE, 0.5 * a);
    p.glow(x, y, rr * 4, G, 0.45 * a);
    p.light(x, y, TINT, 0.6 * a);
  }
}
