// Made for the GoodWatch footer cinema: the background of a pre-show trivia slide: a warm framed card, a DID YOU
// KNOW? header with a light bulb that flickers on and glows, small sparkles, and an even dark panel in the middle
// for the fact itself (the player sets it over the panel as HTML text).
import { FONTS, seg, ease, clamp, hex, mix, rand, cycle, WHITE, TAU } from "../../core/index.js";
import { WARM, glint } from "./_slides.js";

export const meta = {
  name: "Trivia slide",
  desc: "A pre-show trivia slide: a warm card in a double gold rule, DID YOU KNOW? with a light bulb that flickers on and glows, sparkles, and a calm dark panel for the fact.",
  tags: ["cinema", "screen", "loop"],
  size: [288, 120],
  origin: [144, 60],
  duration: 4,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { seed: 3, w: 288, h: 120 },
};

const D = meta.duration;
/** The calm panel the fact sits on: x -104..104, y -26..46, one flat color. */
export const PANEL = { x0: -104, y0: -26, x1: 104, y1: 46, color: hex("#140a0d") };
const OX = 110, OY = 57, IX = 108, IY = 55; // outer and inner gold rules
const CARD = hex("#24101a"), CARD2 = hex("#2c1420");
const HEAD = "DID YOU KNOW?";
export const HY = -50;

function layout(str, s) {
  const F = FONTS.big, out = [];
  let w = 0;
  for (const ch of str) w += (ch === " " ? F.space : F.glyphs[ch].w) + F.gap;
  w = (w - F.gap) * s;
  let x = 0;
  for (const ch of str) {
    if (ch === " ") { x += (F.space + F.gap) * s; continue; }
    const g = F.glyphs[ch];
    out.push({ x, g });
    x += (g.w + F.gap) * s;
  }
  return { list: out, w };
}
export const H = layout(HEAD, 2);
const BULB_W = 11, GAP = 8;
export const X0 = -Math.round((H.w + BULB_W + GAP) / 2);
export const TX = X0 + BULB_W + GAP;

// the bulb's light over the loop: dark, a tired flicker, a pop of light, a warm steady glow, a dip back to dark
export function bulbLight(t) {
  if (t < 0.12) return 0;
  if (t < 0.17) return 0.7;
  if (t < 0.25) return 0;
  if (t < 0.29) return 0.5;
  if (t < 0.36) return 0.1;
  if (t < 3.84) return 1;
  if (t < 3.9) return 0.45;
  return 0;
}

// a light bulb, top-left at (x, y): round glass, a filament, a screw base; k is how lit it is
export function drawBulb(p, x, y, k, t) {
  const cx = x + 5, cy = y + 5;
  const pop = seg(t, 0.36, 0.42) * (1 - seg(t, 0.42, 0.9));
  // glass
  p.shade(cx - 6, cy - 6, cx + 6, cy + 9, (px, py) => {
    const dx = px - cx, dy = py - cy;
    let inside = dx * dx + dy * dy <= 30;
    if (!inside && dy > 0 && dy < 8.5) inside = Math.abs(dx) <= 5.2 - dy * 0.38;
    if (!inside) return;
    const edge = dx * dx + dy * dy > 20 && dy < 2 || (dy >= 2 && Math.abs(dx) > 4.2 - dy * 0.38);
    if (k <= 0.05) return edge ? hex("#6a6074") : hex("#2a2430");
    if (k < 0.6) return edge ? WARM.gold2 : WARM.gold1;
    if (edge) return WARM.gold4;
    const d = Math.hypot(dx, dy + 1);
    return d < 2 ? WHITE : d < 3.5 ? WARM.gold6 : WARM.gold5;
  });
  // the shine on the glass
  p.px(cx - 3, cy - 3, k > 0.6 ? WHITE : hex("#8a8096"));
  p.px(cx - 3, cy - 2, k > 0.6 ? WARM.gold6 : hex("#5a5064"));
  // filament: a little zigzag on two wires
  const fc = k > 0.6 ? WHITE : k > 0.05 ? WARM.gold4 : hex("#5a4a3a");
  p.px(cx - 1, cy + 4, fc); p.px(cx + 1, cy + 4, fc);
  p.px(cx - 1, cy + 3, fc); p.px(cx + 1, cy + 3, fc);
  p.px(cx - 2, cy + 1, fc); p.px(cx - 1, cy + 2, fc); p.px(cx, cy + 1, fc); p.px(cx + 1, cy + 2, fc); p.px(cx + 2, cy + 1, fc);
  // screw base
  for (let j = 0; j < 4; j++) {
    const yy = cy + 9 + j, w = j === 3 ? 1 : 3;
    p.rect(cx - w, yy, w * 2 + 1, 1, j % 2 ? hex("#8a8494") : hex("#c8c4d0"));
  }
  p.px(cx, cy + 13, hex("#4a4450"));
  if (k > 0.05) {
    p.glow(cx + 0.5, cy + 1, 13, WARM.gold4, 0.42 * k + 0.25 * pop);
    p.glow(cx + 0.5, cy + 1, 5, WHITE, 0.25 * k);
    // rays of an idea, longer on the pop
    if (k > 0.6) {
      const L = 2 + Math.round(pop * 3);
      for (let i = 0; i < 5; i++) {
        const an = Math.PI + 0.45 + (i / 4) * (Math.PI - 0.9), r0 = 8;
        for (let d = 0; d < L; d++) {
          const rx = cx + Math.cos(an) * (r0 + d), ry = cy + Math.sin(an) * (r0 + d);
          if (ry > -28 - 0.5) continue;
          p.px(rx, ry, d === 0 ? WARM.gold5 : WARM.gold4);
        }
      }
    }
  }
}

/** DID YOU KNOW? in warm sign letters (ink outline, deep red shadow) with its bulb, `dy` pixels below the slide's spot. */
export function drawHeader(p, t, dy = 0, k = bulbLight(t)) {
  for (const pass of [0, 1, 2])
    for (const { x, g } of H.list)
      for (let gy = 0; gy < 7; gy++)
        for (let gx = 0; gx < g.w; gx++) {
          if (!g.rows[gy][gx]) continue;
          const X = TX + x + gx * 2, Y = HY + dy + gy * 2;
          if (pass === 0) p.rect(X - 1, Y - 1, 4, 4, WARM.ink);
          else if (pass === 1) p.rect(X + 1, Y + 1, 2, 2, WARM.red0);
          else p.rect(X, Y, 2, 2, gy === 0 ? WARM.gold6 : gy < 3 ? WARM.gold5 : gy < 5 ? WARM.gold4 : WARM.gold3);
        }
  p.glowLine(TX + 4, HY + dy + 7, TX + H.w - 4, HY + dy + 7, 8, WARM.gold4, 0.1 + 0.04 * k);
  drawBulb(p, X0, HY - 1 + dy, k, t);
}

// a scroll in a corner: a short curl and two little rules, mirrored by sx, sy
function scroll(p, x, y, sx, sy, c, hi) {
  const pts = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 1], [6, 2], [6, 3], [5, 4], [4, 4], [3, 3], [3, 2], [4, 2]];
  for (const [u, v] of pts) p.px(x + u * sx, y + v * sy, c);
  for (const [u, v] of pts) p.px(x + v * sx, y + u * sy, c);
  p.px(x, y, hi);
  p.px(x + 1 * sx, y + 1 * sy, hi);
}

export function draw(p, t, o) {
  const W = (o.w ?? 288) / 2, S = o.seed ?? 3;
  t = ((t % D) + D) % D;

  // the card: a dark warm ground, a slightly lighter card inside the rules, the calm panel
  p.shade(-W, -60, W - 1, 59, (x, y) => {
    const ax = Math.abs(x), ay = Math.abs(y);
    if (ax > OX + 0.5 || ay > OY + 0.5) return WARM.maroon0;
    if (x >= PANEL.x0 && x < PANEL.x1 && y >= PANEL.y0 && y < PANEL.y1) return PANEL.color;
    return y < -40 ? CARD2 : CARD;
  });
  // double gold rule
  for (const [rx, ry, c] of [[OX, OY, WARM.gold2], [IX, IY, WARM.gold1]]) {
    p.line(-rx, -ry, rx, -ry, c); p.line(-rx, ry, rx, ry, c);
    p.line(-rx, -ry, -rx, ry, c); p.line(rx, -ry, rx, ry, c);
  }
  // the panel's thin rule, just outside it
  const pr = mix(WARM.gold0, WARM.gold1, 0.5);
  p.line(PANEL.x0 - 1, PANEL.y0 - 1, PANEL.x1, PANEL.y0 - 1, pr);
  p.line(PANEL.x0 - 1, PANEL.y1, PANEL.x1, PANEL.y1, pr);
  p.line(PANEL.x0 - 1, PANEL.y0 - 1, PANEL.x0 - 1, PANEL.y1, pr);
  p.line(PANEL.x1, PANEL.y0 - 1, PANEL.x1, PANEL.y1, pr);
  // corner scrolls in the header band, small diamonds on the bottom band
  scroll(p, -IX + 2, -IY + 2, 1, 1, WARM.gold3, WARM.gold5);
  scroll(p, IX - 2, -IY + 2, -1, 1, WARM.gold3, WARM.gold5);
  for (const dx of [-60, 0, 60]) {
    const y = 51;
    p.px(dx, y - 2, WARM.gold3); p.px(dx - 1, y - 1, WARM.gold3); p.px(dx + 1, y - 1, WARM.gold3);
    p.px(dx - 2, y, WARM.gold3); p.px(dx, y, WARM.gold5); p.px(dx + 2, y, WARM.gold3);
    p.px(dx - 1, y + 1, WARM.gold3); p.px(dx + 1, y + 1, WARM.gold3); p.px(dx, y + 2, WARM.gold3);
    if (dx) { p.line(dx - 24 * Math.sign(dx), y, dx - 5 * Math.sign(dx), y, WARM.gold1); }
  }
  p.line(-IX + 4, 51, -66, 51, WARM.gold1); p.line(66, 51, IX - 4, 51, WARM.gold1);

  // a point of light runs round the outer rule once a loop, with a short tail
  const per = 4 * OX + 4 * OY, head = (t / D) * per;
  for (let k = 0; k < 10; k++) {
    let d = (head - k + per) % per, x, y;
    if (d < 2 * OX) (x = -OX + d), (y = -OY);
    else if ((d -= 2 * OX) < 2 * OY) (x = OX), (y = -OY + d);
    else if ((d -= 2 * OY) < 2 * OX) (x = OX - d), (y = OY);
    else (d -= 2 * OX), (x = -OX), (y = OY - d);
    p.px(x, y, k === 0 ? WHITE : k < 4 ? WARM.gold5 : WARM.gold4);
    if (k === 0) p.glow(x + 0.5, y + 0.5, 5, WARM.gold4, 0.4);
  }

  drawHeader(p, t);

  // sparkles now and then around the header and the frame, never over the panel
  const spots = [[-96, -46], [97, -45], [-98, -31], [96, -31], [-108, 10], [108, -8], [-40, 51], [40, 51], [TX + H.w + 4, HY], [-104, 52], [104, 52]];
  cycle(t, D, 6, S, 0.55, (age, life, r) => {
    const [sx, sy] = spots[Math.floor(r.next() * spots.length)], u = age / life;
    const arm = (u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75) * (r.next() < 0.4 ? 3 : 2);
    glint(p, sx, sy, arm, WARM.gold5, WARM.gold3, 0.35 * (1 - u));
  });
}
