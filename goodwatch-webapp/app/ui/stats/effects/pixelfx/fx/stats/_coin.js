// A spinning gold coin, shared by the stats effects. The spin (the face squashed toward its edge, the rim showing
// side-on) follows Sprite Fusion's open-source pickup (https://www.spritefusion.com/pixel-art-vfx/pickup),
// MIT License, Copyright (c) 2026 Hugo Duprez.

// an original coin: a rim, a lit face, a raised star in the middle
const COIN = ["..oooo..", ".ohhlmo.", "ohlmhmdo", "ohhhhhdo", "olmhhmdo", "olmhmmdo", ".oddddo.", "..oooo.."];

/** C: an 8 step gold ramp. clip(y) false hides a pixel row (for a coin sliding into a slot). a: dithered alpha. */
export function drawCoin(p, x, y, ph, C, { clip = null, a = 1 } = {}) {
  const PAL = { o: C[1], h: C[6], l: C[5], m: C[4], d: C[3] };
  const c = Math.cos(ph), sx = Math.abs(c);
  const put = (px, py, col) => {
    if (clip && !clip(py)) return;
    if (a >= 1) p.px(px, py, col);
    else p.dot(px, py, col, a);
  };
  const X = Math.round(x), Y = Math.round(y);
  if (sx < 0.28) {
    for (let dy = -3; dy <= 3; dy++) put(X, Y + dy, Math.abs(dy) === 3 ? C[1] : dy < 0 ? C[6] : C[5]);
    if (sx > 0.12) for (let dy = -2; dy <= 2; dy++) put(X + (c > 0 ? 1 : -1), Y + dy, C[3]);
    return;
  }
  const half = 4 * sx;
  for (let px = Math.floor(x - half); px < Math.ceil(x + half); px++) {
    let col = Math.floor((px + 0.5 - x) / sx + 4);
    if (col < 0 || col > 7) continue;
    if (c < 0) col = 7 - col;
    for (let row = 0; row < 8; row++) {
      const ch = COIN[row][col];
      if (ch !== ".") put(px, Y - 4 + row, PAL[ch]);
    }
  }
}
