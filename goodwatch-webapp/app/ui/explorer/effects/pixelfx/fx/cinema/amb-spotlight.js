// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, mix, clamp, WHITE, TAU } from "../../core/index.js";
import { radius } from "./_amb2.js";

export const meta = {
  name: "Premiere spotlights",
  desc: "Over a showbiz island: two thin searchlight beams rise from below the island and sweep slowly across each other, and a star glints where they cross.",
  tags: ["cinema", "ambient", "island", "showbiz", "spotlight", "premiere", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 8,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#2a1e08", "#7a5a18", "#e0b040", "#fff0b0", "#fffdf2"], seed: 1, r: 30, density: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), ph = t / meta.duration, d2 = o.density >= 2;
  const L = R * 1.55, beams = [];
  for (let s = 0; s < 2; s++) {
    const bx = (s ? 0.42 : -0.42) * R, by = R * 0.5;
    // straight up, swinging out to each side; the two swing in opposite senses so they cross twice a loop
    const an = -Math.PI / 2 + (s ? -1 : 1) * 0.42 * Math.sin(ph * TAU + (s ? 0.7 : 0));
    const dx = Math.cos(an), dy = Math.sin(an);
    beams.push([bx, by, dx, dy]);
    // keep the beam inside the island's band
    let len = L;
    for (; len > 4; len -= 1) if (Math.hypot(bx + dx * len, by + dy * len) < R * 1.1) break;
    for (let d = 2; d <= len; d += 1) {
      const u = d / len, x = bx + dx * d, y = by + dy * d, fall = (1 - u) * 0.8 + 0.2;
      // solid and warm near the lamp, thinning out into dither toward the tip
      p.dot(x, y, u < 0.3 ? C[3] : u < 0.65 ? C[2] : C[1], u < 0.55 ? 1 : 1.6 - u * 1.2);
      p.light(x, y, C[2], 0.12 * fall);
      if (d2 && u < 0.6) { p.light(x + dy, y - dx, C[1], 0.08 * fall); p.light(x - dy, y + dx, C[1], 0.08 * fall); }
    }
    // the lamp
    p.dot(bx, by, C[4], 0.9);
    p.light(bx, by, C[3], 0.3);
  }
  // where they cross: a star, brighter the closer the crossing sits to the beams' bright lower half
  const [a, b] = beams, den = a[2] * b[3] - a[3] * b[2];
  if (Math.abs(den) > 0.08) {
    const s = ((b[0] - a[0]) * b[3] - (b[1] - a[1]) * b[2]) / den;
    const x = a[0] + a[2] * s, y = a[1] + a[3] * s;
    const inside = s > 4 && s < L * 0.95 && Math.hypot(x, y) < R * 1.0;
    if (inside) {
      const k = clamp(1.4 - Math.abs(den) * 1.2) * clamp(1 - s / L + 0.3);
      const arm = Math.round(1 + k * (d2 ? 4 : 3));
      for (let i = 1; i <= arm; i++) {
        const c = i === arm ? C[2] : C[3];
        p.dot(x + i, y, c, k + 0.2); p.dot(x - i, y, c, k + 0.2); p.dot(x, y + i, c, k + 0.2); p.dot(x, y - i, c, k + 0.2);
      }
      p.px(x, y, mix(C[4], WHITE, 0.6));
      p.glow(x, y, 4 + arm * 1.5, C[3], 0.3 * k);
    }
  }
}
