// A frost nova round a poster: a snowflake flashes in the middle, a cold wave runs out to the rim and ice crystals
// erupt all round the edge pointing outward, a glint runs round them, then they shatter into flakes and the frost
// on the rim melts away.
import { PAL, fit, crystal, burst, fly, seg, ease, clamp, rand, rng, TAU, WHITE } from "../../core/index.js";
import { dims, preview, nest } from "./_pun1.js";

export const meta = {
  name: "Pun: frost",
  desc: "A snowflake flashes in the poster's middle, a cold wave runs to the rim, crystals erupt all round the edge and glint, then shatter into flakes as the frost melts.",
  tags: ["cinema", "pun", "ice", "frost", "nova", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: PAL.ice, seed: 1, w: 40, h: 60 },
};

// points round the rim, each with its outward angle (0 points up) and how far round the rim it sits (0..1)
function rim(hw, hh, step) {
  const out = [], per = 4 * (hw + hh);
  const push = (x, y, a, d) => out.push({ x, y, a, d: d / per });
  let d = 0;
  for (let x = -hw + step / 2; x < hw; x += step) push(x, -hh, 0, d + x + hw);
  d += 2 * hw;
  for (let y = -hh + step / 2; y < hh; y += step) push(hw, y, Math.PI / 2, d + y + hh);
  d += 2 * hh;
  for (let x = hw - step / 2; x > -hw; x -= step) push(x, hh, Math.PI, d + hw - x);
  d += 2 * hw;
  for (let y = hh - step / 2; y > -hh; y -= step) push(-hw, y, -Math.PI / 2, d + hh - y);
  for (const [x, y, a] of [[-hw, -hh, -Math.PI / 4], [hw, -hh, Math.PI / 4], [hw, hh, (3 * Math.PI) / 4], [-hw, hh, (-3 * Math.PI) / 4]]) push(x, y, a, 0);
  return out;
}

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), { hw, hh, s } = dims(o), k = Math.max(0.6, s);
  const maxd = Math.hypot(hw, hh);

  // the snowflake: white on the first frames, spins down to nothing
  const sf = 1 - ease.outQuad(seg(t, 0, 0.4));
  if (sf > 0) {
    const L = Math.min(hw, hh) * 0.7 * (0.4 + 0.6 * sf), spin = t * 6;
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * TAU) / 6, ca = Math.cos(a), sa = Math.sin(a);
      for (let d = 0; d <= L; d += 0.5) p.dot(ca * d, sa * d, t < 0.08 || d < L * 0.4 ? WHITE : C[6], sf + 0.3);
      for (const sd of [-1, 1]) {
        const bx = ca * L * 0.6, by = sa * L * 0.6, ba = a + sd * 0.9;
        for (let d = 0; d <= L * 0.3; d += 0.5) p.dot(bx + Math.cos(ba) * d, by + Math.sin(ba) * d, C[5], sf);
      }
    }
    p.glow(0, 0, L * 2 + 6, C[5], 0.55 * sf);
  }
  if (t < 0.1) p.shade(-hw, -hh, hw, hh, (x, y, out) => ((out.a = 1), (out.k = 0), void p.blend(x, y, C[7], 0.45 * (1 - t / 0.1))));

  // the cold wave: a rectangle of light opening out to the rim
  const wv = seg(t, 0.03, 0.24);
  if (wv > 0 && wv < 1) {
    const q = ease.outQuart(wv), x = hw * q, y = hh * q, a = 1 - wv * 0.6;
    for (let i = -x; i <= x; i += 1) (p.dot(i, -y, C[6], a), p.dot(i, y, C[6], a));
    for (let j = -y; j <= y; j += 1) (p.dot(-x, j, C[6], a), p.dot(x, j, C[6], a));
    p.glowRing(0, 0, Math.max(x, y), 4, C[5], 0.3 * a);
  }

  // the crystals: erupt where the wave reaches, glint, then crumble in order
  const pts = rim(hw, hh, 5.5 * k);
  pts.forEach((pt, i) => {
    const r = rng(o.seed, i, 21), reach = Math.hypot(pt.x, pt.y) / maxd;
    const born = 0.08 + reach * 0.16 + r.range(0, 0.03), corner = i >= pts.length - 4;
    const g = ease.outBack(seg(t, born, born + 0.13));
    const melt = ease.inQuad(seg(t, 1.15 + pt.d * 0.35, 1.5 + pt.d * 0.35));
    const ht = (corner ? 10 : 4 + r.range(0, 5.5)) * k * g * (1 - melt), wd = (corner ? 6 : 4 + r.range(0, 2.5)) * k;
    if (ht >= 1.5) {
      const glint = t > 0.45 && t < 1.15 ? clamp(1 - Math.abs(((t - 0.45) / 0.6) - pt.d) * 8) : -1;
      nest(p, pt.x, pt.y, pt.a + r.range(-0.12, 0.12), () => crystal(p, 0, 1, ht, wd, r.range(-1, 1) * k, C, { white: t < born + 0.05, glint: glint > 0 ? 0.6 : -1 }));
      if (t < born + 0.12) p.glow(pt.x, pt.y, 5 * k, C[6], 0.5);
    }
    // when it breaks: two shards and a puff of glitter fly out along its point
    const bt = t - (1.15 + pt.d * 0.35);
    if (bt > 0 && bt < 0.7 && i % 2 === 0) {
      const ca = Math.sin(pt.a), sa = -Math.cos(pt.a);
      for (let j = 0; j < 2; j++) {
        const sp = r.range(25, 55) * k, sd = r.range(-0.6, 0.6);
        const [x, y] = fly(pt.x + ca * 3 * k, pt.y + sa * 3 * k, (ca + sd * sa) * sp, (sa - sd * ca) * sp, bt, 90, 2.5);
        p.dot(x, y, j ? C[6] : WHITE, 1.4 - bt * 2);
        p.light(x, y, C[5], 0.3 * (1 - bt / 0.7));
      }
    }
  });

  // frost creeping in from the rim, fading at the end
  const fr = seg(t, 0.2, 0.45) * (1 - seg(t, 1.3, 2.1));
  if (fr > 0)
    for (const e of [0, 1, 2, 3]) {
      const n = e < 2 ? hw * 2 : hh * 2;
      for (let i = 0; i < n; i++) {
        const D = Math.round((1 + rand(i, e, 5) * 3.5) * k * fr);
        for (let j = 0; j < D; j++) {
          const x = e < 2 ? -hw + i : e === 2 ? -hw + j : hw - 1 - j, y = e < 2 ? (e === 0 ? -hh + j : hh - 1 - j) : -hh + i;
          if (rand(i * 7 + j, e, 9) < 0.35) continue;
          p.dot(x, y, rand(i, j, e) < 0.2 ? C[7] : j < 2 ? C[6] : C[5], fr * (1 - j / (D + 1)) * 1.1);
        }
      }
    }

  // flakes spinning off and drifting down
  burst(Math.round(14 + 4 * s), o.seed + 3, (r) => {
    const a = r.range(0, TAU), born = r.range(0.15, 0.5), age = t - born, life = r.range(1.0, 1.6);
    if (age < 0 || age > life) return;
    const sp = r.range(30, 70) * k, x0 = Math.cos(a) * hw, y0 = Math.sin(a) * hh;
    const [x, y] = fly(x0, y0, Math.cos(a) * sp, Math.sin(a) * sp, age, 22, 3);
    const big = r.next() < 0.3, al = clamp((life - age) * 3);
    const sx = x + Math.sin(age * 4 + a) * 1.5;
    p.dot(sx, y, WHITE, al);
    if (big) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.dot(sx + dx, y + dy, C[6], al * 0.8);
    p.light(sx, y, C[5], 0.2 * al);
  });
}
