// Little sheet ghosts slip out of a poster: each pops up out of a pale puff, rises wobbling with its hem rippling and
// a wisp trailing, glances about, and thins away above the poster.
import { fit, rng, seg, ease, clamp, TAU, WHITE, hex } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: ghosts",
  desc: "Small sheet ghosts slip out of the poster in pale puffs, rise wobbling with rippling hems and trailing wisps, glance about and thin away above it.",
  tags: ["cinema", "pun", "ghost", "spooky", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#141a36", "#2c3a6e", "#5a74b0", "#9fb6e4", "#d6e2ff", "#ffffff"], seed: 1, w: 40, h: 60, count: 4 },
};

const EYE = hex("#141026");

export function drawBack(p, t, o) {
  preview(p, o);
}

// one ghost at (x, y), radius R, alpha a, hem phase ph, lean (sway velocity) and where it looks
function ghost(p, C, x, y, R, a, ph, lean, look) {
  const body = R * 1.25, NL = 3;
  const inside = (X, Y) => {
    // Y < 0 is the dome; 0..body the sheet; the hem is scalloped and ripples
    const u = clamp(Y / body);
    const sx = X - lean * u * u * R * 0.5;
    if (Y < 0) return sx * sx + Y * Y <= R * R;
    const hw = R + u * R * 0.15;
    if (Math.abs(sx) > hw) return false;
    const j = Math.floor(((sx + hw) / (2 * hw)) * NL), cx = -hw + ((j + 0.5) * 2 * hw) / NL, v = (sx - cx) / (hw / NL);
    const d = (R * 0.35 + R * 0.15 * Math.sin(ph - j * 1.7)) * Math.sqrt(Math.max(0, 1 - v * v));
    return Y <= body + d - R * 0.15;
  };
  p.shade(x - R * 1.8, y - R - 1, x + R * 1.8, y + body + R, (px, py) => {
    const X = px - x, Y = py - y;
    if (!inside(X, Y)) return;
    let c = C[4];
    if (!inside(X + 1.6, Y + 1.2)) c = C[3];
    else if (!inside(X - 1.2, Y - 1.2)) c = C[5];
    if (Y > R * 0.9 && !inside(X, Y + 1.5)) c = C[3];
    p.blend(px, py, c, a * (Y > R * 0.6 ? 0.8 : 0.95));
  });
  // eyes: two dark pills, shifted to where it looks; a small round mouth on bigger ghosts
  const ex = look * R * 0.18, ey = -R * 0.15, sep = Math.max(1, R * 0.38);
  const eh = R >= 5 ? 2 : 1;
  for (const s of [-1, 1]) for (let k = 0; k < eh; k++) p.blend(x + ex + s * sep, y + ey + k, EYE, a);
  if (R >= 6) p.blend(x + ex, y + ey + R * 0.5, EYE, a * 0.9);
  p.glow(x, y, R * 2.4, C[3], 0.28 * a);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), { hw, hh, s } = dims(o), k = Math.max(0.6, s), n = o.count ?? 4;
  for (let i = 0; i < n; i++) {
    const r = rng(o.seed, i, 7);
    const born = i * 0.16 + r.range(0, 0.08), life = r.range(1.45, 1.75), age = t - born;
    if (age < 0 || age > life) continue;
    const q = age / life;
    const side = (((i * 3) % n) + 0.5) / n * 2 - 1, x0 = side * hw * 0.6 + r.range(-2, 2), y0 = hh * r.range(-0.05, 0.3);
    const top = hh * r.range(1.3, 1.5) + y0 * 0.5, wf = r.range(4, 6);
    const pos = (ag) => [x0 + side * hw * 0.35 * ease.outQuad(ag / life) + Math.sin(ag * wf + i) * hw * 0.12 * (0.3 + ag / life), y0 - ease.outQuad(ag / life) * top];
    const [x, y] = pos(age);
    const lean = Math.cos(age * 5 + i) * 0.8;
    const pop = ease.outBack(seg(age, 0, 0.25)), R = Math.max(2.5, r.range(3.4, 4.6) * k) * (0.5 + 0.5 * pop);
    const a = Math.min(seg(age, 0, 0.12), 1 - seg(q, 0.62, 1)) * 0.95;
    // the puff it comes out of
    if (age < 0.35) {
      const pq = age / 0.35;
      p.disc(x0, y0 + R * 0.5, R * (0.6 + pq * 1.1), C[3], (1 - pq) * 0.35);
      if (age < 0.06) p.disc(x0, y0, R * 0.9, WHITE, 0.8);
    }
    // the wisp: fading dots where it has been
    for (let j = 1; j <= 6; j++) {
      const [px, py] = pos(Math.max(0, age - j * 0.05));
      p.blend(px, py + R * 1.4, j < 3 ? C[4] : C[3], a * (1 - j / 7) * 0.7);
    }
    ghost(p, C, x, y, R, a, age * 9 + i, lean, Math.sin(age * 2.2 + i * 2) > 0.3 ? 1 : Math.sin(age * 2.2 + i * 2) < -0.3 ? -1 : 0);
  }
  if (t < 0.2) p.glow(0, 0, hh * 0.8, C[3], 0.35 * (1 - t / 0.2));
}
