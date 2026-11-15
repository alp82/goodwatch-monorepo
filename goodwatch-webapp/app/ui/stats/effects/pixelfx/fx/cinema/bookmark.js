import { seg, ease, WHITE, fit, clamp } from "../../core/index.js";
import { fadeOut, glint } from "./_burst.js";

export const meta = {
  name: "Bookmark shine",
  desc: "A ribbon bookmark drops into place with a little bounce, a shine sweeps across it, a glint winks at its corner, then it fades.",
  tags: ["cinema", "want", "one-shot"],
  size: [56, 64],
  origin: [28, 34],
  duration: 1.1,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#4a2a06", "#a8620c", "#f0a81c", "#ffd86a", "#fff6d0"], seed: 1, s: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5), s = o.s ?? 1;
  const fall = ease.outBack(seg(t, 0, 0.22), 2.2), y0 = -18 * s * (1 - fall);
  const a = seg(t, 0, 0.05) * fadeOut(t, 1.0, 1.08), shrink = 1 - 0.3 * ease.inCubic(seg(t, 0.75, 1.08));
  const turn = Math.cos(ease.inCubic(seg(t, 0.75, 1.05)) * Math.PI / 2);
  if (turn < 0.08) return;
  const hw = 4 * s * shrink * turn, top = y0 - 10 * s * shrink, bot = y0 + 10 * s * shrink, notch = 4 * s * shrink;
  const sweep = seg(t, 0.28, 0.6);
  p.shade(-hw - 1, top, hw + 1, bot + 1, (x, y, out) => {
    if (Math.abs(x) > hw) return;
    const cut = bot - notch * (1 - Math.abs(x) / hw);
    if (y > cut) return;
    out.a = a;
    // a diagonal shine band running down-right
    const band = (x + (y - top) * 0.6) - (-hw + sweep * (hw * 2 + 22 * s));
    if (sweep > 0 && sweep < 1 && Math.abs(band) < 1.6) { out.l = WHITE; out.k = 0.4; return WHITE; }
    if (x < -hw + 1) return C[3];
    if (x > hw - 1) return C[1];
    if (y > cut - 1) return C[1];
    return Math.abs(x) < 0.6 ? C[3] : C[2];
  });
  // land: a short flash and a tiny thud of light
  if (t > 0.2 && t < 0.25) p.glow(0, y0, 12 * s, C[3], 0.5);
  p.glow(0, y0, 14 * s, C[2], 0.2 * a);
  // glint at the top corner after the shine
  const u = (t - 0.55) / 0.35;
  if (u > 0 && u < 1) {
    const g = u < 0.25 ? ease.outBack(u / 0.25) : 1 - (u - 0.25) / 0.75;
    glint(p, hw, top + 1, 3.5 * s * g, C[4], C[3], 0.5 * g);
  }
}
