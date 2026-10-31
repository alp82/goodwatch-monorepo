// A glowing energy blade sweeps across a poster from its lower left corner: a white core, a colored rim and a smear
// of light behind it, sparks spitting off the tip as it stops, then the blade draws back into the corner.
import { fit, seg, ease, clamp, burst, fly, TAU, WHITE, scale } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: blade",
  desc: "A glowing energy blade sweeps across the poster from its lower left corner, smearing light behind it, sparks spitting off the tip as it stops, then draws back in.",
  tags: ["cinema", "pun", "blade", "slash", "energy", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 1.5,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#081433", "#13307a", "#1f5fd0", "#4a9cff", "#a4d8ff", "#e8f6ff"], seed: 1, w: 40, h: 60 },
};

const A0 = -1.85, A1 = -0.38, AR = -0.62, SWING = [0.1, 0.32];

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), { hw, hh, s } = dims(o), k = Math.max(0.6, s);
  const px0 = -hw * 0.95, py0 = hh * 0.92, L = Math.hypot(hw * 2, hh * 2) * 0.9;
  // ignition: the blade shoots out of the hilt point, swings, holds, then retracts
  const ext = ease.outExpo(seg(t, 0, 0.1)) * (1 - ease.inQuad(seg(t, 0.95, 1.12)));
  const sw = ease.outExpo(seg(t, SWING[0], SWING[1]));
  const ang = A0 + (A1 - A0) * sw + (AR - A1) * ease.inOutQuad(seg(t, SWING[1] + 0.05, SWING[1] + 0.3)), len = L * ext;
  const hum = 1 + Math.sin(t * 70) * 0.08;

  // the smear: arcs of fading light between where the blade was a moment ago and where it is now
  if (t > SWING[0] && t < SWING[1] + 0.3) {
    const back = ease.outExpo(seg(t - 0.07, SWING[0], SWING[1]));
    const a0 = A0 + (A1 - A0) * back, fade = 1 - seg(t, SWING[1], SWING[1] + 0.3);
    const span = ang - a0;
    if (span > 0.01)
      for (let r = L * 0.25; r <= len; r += 1) {
        const u = (r - L * 0.25) / (L * 0.75);
        const steps = Math.ceil(span * r * 1.4);
        for (let j = 0; j <= steps; j++) {
          const q = j / steps, g = a0 + span * q;
          const c = q > 0.85 ? C[5] : q > 0.55 ? C[4] : q > 0.25 ? C[3] : C[2];
          p.blend(px0 + Math.cos(g) * r, py0 + Math.sin(g) * r, c, Math.min(1, (0.1 + q * q * 0.8) * fade * (0.6 + 0.4 * u)));
        }
      }
  }

  // the blade: a white core two pixels wide, a colored rim, a hot rounded tip, light all along it
  if (len > 1) {
    const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
    const x0 = px0 + ca * L * 0.08, y0 = py0 + sa * L * 0.08, x1 = px0 + ca * len, y1 = py0 + sa * len;
    if (len > L * 0.08) {
      if (k < 1.3) {
        p.line(x0 + nx * 1.5, y0 + ny * 1.5, x1 + nx * 1.5, y1 + ny * 1.5, C[3]);
        p.line(x0 - nx * 1.5, y0 - ny * 1.5, x1 - nx * 1.5, y1 - ny * 1.5, C[3]);
        p.line(x0 + nx * 0.6, y0 + ny * 0.6, x1 + nx * 0.6, y1 + ny * 0.6, C[5]);
        p.line(x0 - nx * 0.6, y0 - ny * 0.6, x1 - nx * 0.6, y1 - ny * 0.6, WHITE);
      } else {
        p.beam(x0, y0, x1, y1, 3.4 * k, C[3]);
        p.beam(x0, y0, x1, y1, 2.2 * k, C[5]);
        p.beam(x0, y0, x1, y1, 1.2 * k, WHITE);
      }
      p.glowLine(x0, y0, x1, y1, 6 * k * hum, C[3], 0.5);
      p.glowLine(x0, y0, x1, y1, 2.5 * k, C[4], 0.45);
      p.circle(x1, y1, 1.4, WHITE);
    }
    // the hilt point: a small dark grip with a lit band, where the blade comes from
    p.line(px0 - ca * 4 * k, py0 - sa * 4 * k, px0 + ca * L * 0.07, py0 + sa * L * 0.07, scale(C[0], 2.2));
    p.px(px0 + ca * L * 0.06, py0 + sa * L * 0.06, C[4]);
  }
  // the flash where it ignites
  if (t < 0.08) p.glow(px0, py0, 14 * k, C[5], 0.7);

  // sparks off the tip when the swing stops, and a light where it bit
  const st = t - SWING[1] + 0.06;
  if (st > 0 && st < 0.9) {
    const tx = px0 + Math.cos(A1) * L, ty = py0 + Math.sin(A1) * L;
    burst(Math.round(10 + 4 * s), o.seed + 5, (r) => {
      const d = r.range(0, 0.1), age = st - d, life = r.range(0.2, 0.45);
      if (age < 0 || age > life) return;
      const a = A1 + Math.PI / 2 + r.range(-1.3, 0.6), sp = r.range(50, 120) * k;
      const back = r.range(0, 0.15) * L, ox = tx - Math.cos(A1) * back, oy = ty - Math.sin(A1) * back;
      const [x, y] = fly(ox, oy, Math.cos(a) * sp, Math.sin(a) * sp, age, 260, 3);
      const [x2, y2] = fly(ox, oy, Math.cos(a) * sp, Math.sin(a) * sp, Math.max(0, age - 0.025), 260, 3);
      const kk = 1 - age / life;
      p.line(x2, y2, x, y, kk > 0.5 ? WHITE : C[4]);
      p.light(x, y, C[4], 0.4 * kk);
    });
    p.glow(tx, ty, 10 * k, C[4], 0.5 * clamp(1 - st / 0.4));
  }
}
