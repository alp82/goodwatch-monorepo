// Made for the GoodWatch stats page: Coins pop out of the highest box office poster and stack up at its foot.
import { fit, rand, seg, clamp, lerp, ease, WHITE } from "../../core/index.js";

export const meta = {
  name: "Coin shower",
  desc: "Coins pop out of the poster's top edge with a white flash, spin as they arc up and fall, bounce once on its bottom edge with a clink sparkle and settle in a tiny stack.",
  tags: ["stats-page", "coins", "money", "box-office", "one-shot"],
  size: [52, 80],
  origin: [12, 25],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2a1404", "#7a4a0a", "#c88a14", "#f4c430", "#ffe890", "#ffffff"],
    w: 27,
    h: 50,
    tease: 0,
    seed: 4,
  },
};

export const tease = { duration: 0.55 };

const G = 400, BOUNCE = 0.3, FADE0 = 1.78, END = 2.16;
// each coin: launch time, where on the top edge it pops (0..1 of the width), launch speed up, which stack slot it lands in
const COINS = [
  { t0: 0.04, at: 0.5, vy: 96, slot: 0 },
  { t0: 0.13, at: 0.28, vy: 86, slot: 1 },
  { t0: 0.21, at: 0.72, vy: 92, slot: 2 },
  { t0: 0.3, at: 0.42, vy: 80, slot: 3 },
  { t0: 0.38, at: 0.62, vy: 88, slot: 4 },
];
// stack slots: which stack (-1 left, 1 right) and level
const SLOTS = [[-1, 0], [1, 0], [-1, 1], [1, 1], [-1, 2]];
const SPIN = [5, 5, 3, 1, 3]; // face-on lingers a beat, then 3-1-3 through the edge

/** A spinning coin centered at (x, y), seen at width 5, 3 or 1, lit on its upper-left edge. */
function coin(p, C, x, y, w, hero) {
  const X = Math.round(x), Y = Math.round(y);
  if (hero) {
    for (let j = -2; j <= 2; j++) for (let i = -(w >> 1); i <= w >> 1; i++) if (!(w === 5 && Math.abs(j) === 2 && Math.abs(i) === 2)) p.px(X + i, Y + j, WHITE);
    return;
  }
  if (w === 5) {
    for (let j = -2; j <= 2; j++)
      for (let i = -2; i <= 2; i++) {
        if (Math.abs(j) === 2 && Math.abs(i) === 2) continue;
        const rim = Math.abs(i) === 2 || Math.abs(j) === 2;
        let c = rim ? (i + j < 0 ? C[4] : C[1]) : C[3];
        if (!rim && i === 0 && j !== 0) c = C[2]; // the stamped mark down the middle
        p.px(X + i, Y + j, c);
      }
    p.px(X - 1, Y - 1, WHITE);
  } else if (w === 3) {
    for (let j = -2; j <= 2; j++) {
      p.px(X - 1, Y + j, Math.abs(j) === 2 ? C[2] : C[4]);
      p.px(X, Y + j, Math.abs(j) === 2 ? C[1] : C[3]);
      p.px(X + 1, Y + j, C[1]);
    }
    p.px(X - 1, Y - 1, WHITE);
  } else {
    for (let j = -2; j <= 2; j++) p.px(X, Y + j, j < 0 ? C[4] : j === 0 ? C[3] : C[2]);
    p.px(X, Y - 2, WHITE);
  }
}

/** A coin lying flat in a stack: 5 x 2, lit top face over a darker edge. f steps it down one notch, a fades it. */
function flat(p, C, x, y, f, a) {
  const X = Math.round(x), Y = Math.round(y), s = (i) => C[clamp(i - f, 0, 5)];
  for (let i = -2; i <= 2; i++) {
    p.blend(X + i, Y, Math.abs(i) === 2 ? s(3) : i === -1 ? s(5) : s(4), a);
    p.blend(X + i, Y + 1, Math.abs(i) === 2 ? s(1) : s(2), a);
  }
}

/** A clink: a 4-arm glint that flashes white and shrinks. */
function clink(p, C, x, y, age) {
  if (age < 0 || age > 0.16) return;
  const arm = age < 0.05 ? 3 : age < 0.1 ? 2 : 1, c = age < 0.05 ? WHITE : C[4];
  p.px(x, y, WHITE);
  for (let k = 1; k <= arm; k++) {
    const ck = k === arm ? C[3] : c;
    p.px(x - k, y, ck); p.px(x + k, y, ck); p.px(x, y - k, ck);
  }
  p.glow(x + 0.5, y + 0.5, 5, C[3], 0.4 * (1 - age / 0.16));
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), S = o.seed;
  const W = Math.max(12, Math.round(o.w)), H = Math.max(16, Math.round(o.h));

  if (o.tease) {
    const D = tease.duration;
    if (t >= D) return;
    // one coin flips up a few px off the top edge, spins once, and drops back in
    const age = t - 0.08, x = Math.round(W * 0.62), vy = 60;
    if (age >= 0) {
      const y = -3 - vy * age + (G * age * age) / 2;
      const w = SPIN[Math.floor(age * 12) % 5];
      if (y < -1.5) coin(p, C, x, y, w, age < 0.03);
      if (age < 0.06) { p.px(x - 2, -1, WHITE); p.px(x + 2, -1, WHITE); p.glow(x, -1, 5, C[4], 0.4); }
    }
    return;
  }
  if (t >= END) return;

  // the stack steps one notch down the ramp, then melts away
  const fade = t > FADE0 ? 1 : 0, sa = 1 - ease.inQuad(seg(t, FADE0 + 0.08, END - 0.02));
  const stackX = (side) => Math.round(W / 2 + side * 4);
  const rested = [];
  COINS.forEach((c, i) => {
    const age = t - c.t0;
    if (age < 0) return;
    const [side, lvl] = SLOTS[c.slot];
    const x0 = Math.round(W * c.at), x1 = stackX(side);
    const floorY = H - 3 - lvl * 2; // a flying coin's center when its foot touches the stack top
    // time to fall from the top edge to its landing height
    const vy = c.vy * clamp(H / 50, 0.7, 1);
    const tl = (vy + Math.sqrt(vy * vy + 2 * G * (floorY + 3))) / G;
    const vb = (G * tl - vy) * BOUNCE, tb = (2 * vb) / G;
    if (age < tl) {
      // up and over: x eases towards its stack
      const x = lerp(x0, x1, age / tl), y = -3 - vy * age + (G * age * age) / 2;
      const w = SPIN[Math.floor(age * 15 + i) % 5];
      coin(p, C, x, y, w, age < 0.035);
      if (age < 0.07) {
        // the pop: a white burst on the top edge where it came out
        p.px(x0 - 2, -1, WHITE); p.px(x0 + 2, -1, WHITE); p.px(x0, -1, C[4]);
        if (age < 0.035) { p.px(x0 - 3, -2, C[4]); p.px(x0 + 3, -2, C[4]); }
        p.glow(x0, -1, 6, C[4], 0.45);
      }
    } else if (age < tl + tb) {
      const u = age - tl, y = floorY - vb * u + (G * u * u) / 2;
      coin(p, C, x1, y, SPIN[Math.floor(age * 12 + i) % 5], false);
      clink(p, C, x1 + 3, floorY + 2, u);
    } else {
      rested.push([x1, floorY + 1, lvl]);
      clink(p, C, x1 - 3, floorY + 1, age - tl - tb);
    }
  });
  // the stacks, bottom coins first, with a dark outline so they read over the poster
  rested.sort((a, b) => a[2] - b[2]);
  for (const [x, y] of rested) {
    for (const dx of [-3, 3]) { p.blend(x + dx, y, C[0], 0.75 * sa); p.blend(x + dx, y + 1, C[0], 0.75 * sa); }
    flat(p, C, x, y, fade, sa);
  }
  // a last glint runs across the top coin before it all fades
  if (t > 1.6 && t < 1.72 && rested.length) {
    const top = rested[rested.length - 1];
    const gx = top[0] - 2 + Math.floor(seg(t, 1.6, 1.72) * 5);
    p.px(gx, top[1], WHITE);
    p.light(gx, top[1], C[4], 0.5);
  }
}
