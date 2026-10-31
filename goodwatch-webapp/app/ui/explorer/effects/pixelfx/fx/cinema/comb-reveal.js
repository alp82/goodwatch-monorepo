// Made for the GoodWatch explorer map: combination reveal (one-shot when its titles arrive).
import { burst, clamp, ease, fit, fly, flyV, hex, mix, seg, TAU, WHITE } from "../../core/index.js";
import { beam, rampOf } from "./_comb.js";

export const meta = {
  name: "Premiere reveal",
  desc: "A white flash, red curtains part over the hub, searchlights sweep up behind it, and confetti and gold tickets shower down glinting.",
  tags: ["cinema", "combination", "reveal", "curtains", "confetti", "one-shot"],
  size: [200, 200],
  origin: [100, 108],
  duration: 3.4,
  loop: false,
  fps: 30,
  bg: "dark",
  // r: the hub's radius (effect px); colors: the picked islands' colors (confetti)
  options: {
    palette: ["#3a2408", "#8a5a14", "#f0b424", "#ffe27a", "#fff8dc"],
    curtain: ["#2a0610", "#5a0c1c", "#8e1428", "#c8283c", "#ff6a6a"],
    seed: 1,
    r: 30,
    colors: ["#e0607e", "#3fc1b0", "#9b7bea"],
  },
};

export function draw(p, t, o) {
  const G = fit(o.palette, 5).map(hex), V = fit(o.curtain, 5).map(hex), r = Math.max(12, o.r);
  const cols = [...(o.colors?.length ? o.colors : []).map((c) => rampOf(c)), rampOf(G[2]), [G[0], G[1], G[2], G[3], G[4]]];
  const end = 1 - seg(t, 2.9, 3.4);

  // searchlights from below the hub, sweeping up and crossing
  const sl = seg(t, 0.15, 0.45) * (1 - seg(t, 2.2, 3.0));
  if (sl > 0) {
    for (let i = 0; i < 4; i++) {
      const bx = (i - 1.5) * r * 0.45, sw = Math.sin(t * (1.6 + i * 0.3) + i * 1.7) * 0.45;
      const ang = -Math.PI / 2 + (i - 1.5) * 0.28 + sw;
      beam(p, bx, r * 0.8, ang, r * 2.8, 0.17, i % 2 ? G[3] : mix(G[3], WHITE, 0.5), sl * 2.2);
    }
  }

  // hero frame and shock ring
  if (t < 0.1) {
    p.circle(0, 0, r * 0.35 * (1 - t / 0.1) + 2, WHITE);
    p.glow(0, 0, r * 1.4, G[4], 0.8 * (1 - t / 0.1));
  }
  const sh = seg(t, 0, 0.55);
  if (sh > 0 && sh < 1) {
    const rr = r * (0.3 + 1.4 * ease.outQuart(sh)), k = 1 - sh;
    p.ring(0, 0, rr, sh < 0.4 ? 2 : 1, sh < 0.3 ? WHITE : G[3], k);
    p.glowRing(0, 0, rr, 4, G[3], 0.4 * k);
  }

  // curtains: a stage over the hub, two velvet halves sweeping aside, gathering at the edges, then dissolving
  const open = ease.outCubic(seg(t, 0.06, 0.85)), fly2 = ease.inCubic(seg(t, 1.25, 1.9)), gone = seg(t, 1.78, 1.9);
  if (gone < 1) {
    const W = r * 1.15, top = -r * 0.85 - fly2 * r * 1.4, bot = r * 0.85 - fly2 * r * 2.2, a = 1 - gone;
    for (let s = -1; s <= 1; s += 2) {
      // each half spans from the side (s * W) to its inner edge, which moves from 0 to near the side
      const inner = s * W * open * 0.62, outer = s * W, x0 = Math.min(inner, outer), x1 = Math.max(inner, outer);
      const wid = x1 - x0;
      if (wid < 1) continue;
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const u = (x - x0) / wid; // 0..1 across the half
        // folds bunch up as the curtain gathers
        const fold = Math.sin(((x - inner) / (3 + 3 * (1 - open))) * Math.PI);
        const ci = fold > 0.6 ? 3 : fold > -0.1 ? 2 : fold > -0.7 ? 1 : 0;
        // the inner edge swings: its hem lifts a little as it moves
        const edge = s > 0 ? 1 - u : u, lift = (1 - open) * 0 + edge * Math.sin(t * 9) * 2 * (1 - open) + edge * 4 * open * (1 - open) * 4;
        const yb = bot - lift;
        for (let y = Math.ceil(top + 3); y <= yb; y++) {
          // tied back: the inner part pinches in towards the side a little above the middle
          const v = (y - top) / (bot - top), pinch = open * 0.55 * Math.exp(-((v - 0.55) ** 2) / 0.03);
          if (edge < pinch) continue;
          const c = y > yb - 1.5 ? V[ci + 1 > 4 ? 4 : ci + 1] : V[ci];
          p.dot(x, y, c, a);
        }
        // the hem
        p.dot(x, yb + 1, V[0], a);
      }
      // a light along the inner edge as it opens
      p.glowLine(inner, top + 4, inner, bot, 3, V[4], 0.25 * a * (1 - open * 0.5));
    }
    // the valance: a gold-fringed pelmet across the top
    for (let x = Math.floor(-W - 1); x <= Math.ceil(W + 1); x++) {
      const sc = Math.sin((x / 5) * Math.PI);
      p.dot(x, top, V[2], a);
      p.dot(x, top + 1, V[3], a);
      p.dot(x, top + 2, V[1], a);
      p.dot(x, top + 3 + (sc > 0.3 ? 1 : 0), G[3], a);
      if (sc > 0.8) p.dot(x, top + 5, G[2], a);
    }
    p.glowLine(-W, top + 3, W, top + 3, 3, G[3], 0.2 * a);
  }

  // confetti and tickets: thrown up from above the hub, then fluttering down
  const T0 = 0.12;
  if (t > T0 && end > 0) {
    const tt = t - T0;
    burst(84, o.seed, (g, i) => {
      const life = g.range(2.0, 3.2), age = tt - g.range(0, 0.35);
      if (age < 0 || age > life) return;
      const ang = -Math.PI / 2 + g.range(-1.35, 1.35), sp = g.range(90, 210) * Math.sqrt(r / 30);
      const [x0, y0] = [g.range(-r * 0.7, r * 0.7), -r * 0.5];
      let [x, y] = fly(x0, y0, Math.cos(ang) * sp, Math.sin(ang) * sp, age, 120, 2.6);
      const sway = Math.sin(age * g.range(5, 9) + i) * g.range(2, 5) * seg(age, 0.4, 1);
      x += sway;
      const CC = cols[i % cols.length], a = 1 - seg(age, life * 0.75, life);
      const flip = Math.sin(age * g.range(8, 16) + i);
      if (i % 9 === 0) {
        // a ticket: 5x3 gold with a dark stub line, foreshortened as it turns
        const w = Math.max(1, Math.round(Math.abs(flip) * 5)), c = flip > 0 ? G[3] : G[2];
        for (let dx = 0; dx < w; dx++)
          for (let dy = 0; dy < 3; dy++) p.dot(x - w / 2 + dx, y + dy - 1, dx === Math.floor(w * 0.65) && w > 2 ? G[1] : c, a);
        if (flip > 0.85) p.light(x, y, G[4], 0.6 * a);
      } else {
        // confetti: a 2x1 chip that turns, catching light
        const c = flip > 0.6 ? CC[4] : flip > -0.3 ? CC[3] : CC[2];
        p.dot(x, y, c, a);
        if (Math.abs(flip) > 0.4) p.dot(x + 1, y, c, a);
        else p.dot(x, y + 1, CC[2], a);
        if (flip > 0.92) p.light(x, y, CC[4], 0.5 * a);
      }
    });
  }

  // glints round the hub while it all settles
  burst(14, o.seed + 9, (g) => {
    const at = g.range(0.4, 2.4), age = t - at;
    if (age < 0 || age > 0.45) return;
    const a = g.range(0, TAU), d = r * g.range(0.7, 1.3), x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
    const k = Math.sin((age / 0.45) * Math.PI), arm = Math.round(1 + 2 * k);
    p.px(x, y, WHITE);
    for (let j = 1; j <= arm; j++) {
      const c = j === arm ? G[2] : G[3];
      p.px(x + j, y, c); p.px(x - j, y, c); p.px(x, y + j, c); p.px(x, y - j, c);
    }
    p.glow(x, y, 5, G[3], 0.4 * k);
  });
}
