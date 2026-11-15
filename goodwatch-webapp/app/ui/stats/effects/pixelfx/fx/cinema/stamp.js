import { seg, ease, hex, WHITE, fit, burst, fly, TAU, clamp } from "../../core/index.js";
import { fadeOut } from "./_burst.js";

export const meta = {
  name: "Ticket stamp",
  desc: "A paper ticket stub slams down from above, puffs a ring of dust, and an ink check stamps onto it; it settles, lifts and fades.",
  tags: ["cinema", "seen", "one-shot"],
  size: [72, 64],
  origin: [36, 34],
  duration: 1.15,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#6a5228", "#b89a60", "#e8d4a4", "#fff4d8", "#ffffff"], ink: "#e0383c", seed: 6, s: 1 },
};

const HIT = 0.13, STAMP = 0.3;

export function draw(p, t, o) {
  const C = fit(o.palette, 5), INKC = hex(o.ink), s = o.s ?? 1;
  const drop = t < HIT ? 1 + 1.2 * (1 - ease.inQuad(t / HIT)) : 1 + 0.08 * Math.exp(-(t - HIT) * 30) * Math.cos((t - HIT) * 50);
  const sc = drop * s * (1 - 0.6 * ease.inCubic(seg(t, 0.75, 1.1)));
  const a = (t < HIT ? seg(t, 0, 0.05) : 1) * fadeOut(t, 0.98, 1.1), lift = -5 * s * ease.inQuad(seg(t, 0.75, 1.1));
  const W = 11 * sc, H = 6.5 * sc, cy = lift;
  // the stub: paper body, notches at the ends, a perforated tear line, lit top edge, darker underside
  p.shade(-W - 1, cy - H - 1, W + 1, cy + H + 1, (x, y, out) => {
    const dx = x, dy = y - cy;
    if (Math.abs(dx) > W || Math.abs(dy) > H) return;
    if (Math.hypot(Math.abs(dx) - W, dy) < 2.2 * sc) return; // notches
    out.a = a;
    const perf = Math.abs(dx - W * 0.45) < 0.5;
    if (perf) return Math.floor(dy) % 2 ? C[1] : C[2];
    if (dy < -H + 1) return C[4];
    if (dy > H - 1) return C[1];
    if (Math.abs(dx) > W - 1) return C[1];
    return dx > W * 0.45 ? C[2] : C[3];
  });
  // the stamp: an ink ring with a check, punched in
  if (t >= STAMP) {
    const k = t - STAMP, pop = k < 0.06 ? 1.6 - k * 10 : 1;
    const cx = -W * 0.18, r = 4 * sc * pop;
    for (const dy of [0, 1]) {
      p.line(cx - r * 0.6, cy - 0.5 + dy, cx - r * 0.15, cy + r * 0.45 + dy, INKC, a);
      p.line(cx - r * 0.15, cy + r * 0.45 + dy, cx + r * 0.75, cy - r * 0.6 + dy, INKC, a);
    }
    if (k < 0.05) p.glow(cx, cy, 8 * s, INKC, 0.5);
  }
  // the landing: a white edge flash, a flat ring of dust and a few flecks
  if (t >= HIT) {
    const k = t - HIT;
    if (k < 0.04) p.line(-W, cy + H + 1, W, cy + H + 1, WHITE);
    const R = (8 + 16 * ease.outCubic(seg(k, 0, 0.5))) * s, al = 0.35 * (1 - seg(k, 0, 0.5));
    if (al > 0) for (let i = 0; i < 10; i++) {
      const an = (i / 10) * TAU;
      p.disc(Math.cos(an) * R, H + 1 + Math.sin(an) * R * 0.25, 1.4 * s, C[3], al);
    }
    burst(6, o.seed, (r) => {
      const an = r.range(-Math.PI, 0), sp = r.range(40, 80) * s, life = r.range(0.25, 0.45);
      if (k > life) return;
      const [x, y] = fly(Math.cos(an) * W, H, Math.cos(an) * sp, Math.sin(an) * sp * 0.6, k, 300, 2);
      p.dot(x, y, C[3], 1 - k / life);
    });
  }
}
