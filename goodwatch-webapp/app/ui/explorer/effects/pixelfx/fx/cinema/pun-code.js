// Green glyph rain over a poster: columns of made-up 3 x 5 glyphs fall with a white-hot head and a fading tail,
// glyphs flicker to new shapes as they fall, and the rain thins and drains off the bottom.
import { PAL, fit, rng, hash, seg, clamp, WHITE } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: code rain",
  desc: "Columns of made-up glyphs rain down over the poster with white-hot heads and fading green tails, flickering to new shapes, then thin out and drain off the bottom.",
  tags: ["cinema", "pun", "code", "digital", "rain", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.0,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: PAL.matrix, seed: 1, w: 40, h: 60 },
};

// invented glyphs: strokes and hooks that read as code, not letters (3 wide, 5 tall, row bits left to right)
const GLYPHS = [
  "111|001|011|001|001", "100|111|101|001|011", "010|111|010|010|100", "111|101|111|001|110",
  "110|010|111|010|011", "001|010|110|010|010", "111|100|111|001|001", "101|111|001|011|100",
  "011|100|111|100|011", "100|100|111|101|111", "111|010|011|010|110", "010|110|011|010|111",
].map((g) => g.split("|").map((r) => [...r].map((c) => c === "1")));

function glyph(p, x, y, g, c, a, z) {
  const G = GLYPHS[g % GLYPHS.length];
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 3; i++)
      if (G[j][i]) for (let v = 0; v < z; v++) for (let u = 0; u < z; u++) p.dot(x + i * z + u, y + j * z + v, c, a);
}

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), { hw, hh, s: sc } = dims(o), z = Math.max(1, Math.round(sc * 0.75));
  const step = 4 * z, rows = 6, cols = Math.max(4, Math.floor((hw * 2 - 1) / step));
  const x0 = -Math.floor((cols * step) / 2) + 0.5;
  const top = -hh - 4 * z, bot = hh - 5 * z;
  // a green cast over the poster while the rain is heavy
  const cast = seg(t, 0, 0.3) * (1 - seg(t, 1.1, 1.8));
  if (cast > 0) p.glow(0, 0, Math.max(hw, hh) * 1.2, C[4], 0.18 * cast);

  for (let ci = 0; ci < cols; ci++) {
    const x = x0 + ci * step;
    // each column runs one to three streams, each with its own speed, start and tail length
    for (let si = 0; si < 3; si++) {
      const r = rng(o.seed, ci, si);
      const born = si * 0.28 + r.range(0, si ? 0.3 : 0.45), speed = r.range(85, 140) * Math.max(0.8, hh / 30);
      if (si > 0 && r.next() < (si === 1 ? 0.3 : 0.6)) continue;
      const tail = Math.round(r.range(3, rows + 2)), age = t - born;
      if (age < 0) continue;
      const head = top + age * speed;
      const cell = 6 * z;
      const hc = Math.floor((head - top) / cell);
      for (let k = 0; k <= tail; k++) {
        const c = hc - k;
        if (c < 0) break;
        const y = top + c * cell;
        if (y > bot) continue;
        // a glyph changes now and then, more often near the head
        const g = hash(o.seed, ci, c, Math.floor(t * (k < 2 ? 14 : 4) + r.next() * 3));
        const u = k / tail;
        const col = k === 0 ? WHITE : k === 1 ? C[6] : u < 0.45 ? C[5] : u < 0.75 ? C[4] : C[3];
        const a = (k === 0 ? 1 : 1.05 - u * 0.8) * (1 - seg(t, 1.75, 1.95));
        glyph(p, x - z, y, g, col, a, z);
        if (k === 0) p.glow(x + 0.5, y + 2.5 * z, 5 * z, C[6], 0.35);
        else if (k < 3) p.light(x + 0.5, y + 2, C[5], 0.25);
      }
    }
  }
  // a scan line runs down the poster once at the start: the hero frame
  if (t < 0.16) {
    const y = -hh + (t / 0.16) * hh * 2;
    p.line(-hw, y, hw - 1, y, WHITE);
    p.glowLine(-hw, y, hw, y, 6, C[6], 0.5 * clamp(1 - t / 0.16));
  }
}
