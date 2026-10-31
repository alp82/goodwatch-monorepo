// A lightning bolt strikes down onto a poster: a faint leader feels its way down, the main bolt slams in with a white
// frame and forks, re-strikes twice on new paths, sparks spray from the hit and the glow dies away.
import { fit, bolt, forks, rng, seg, burst, fly, clamp, WHITE } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: bolt",
  desc: "A faint leader feels its way down, then a forked bolt slams onto the poster with a white frame, re-strikes twice, sprays sparks from the hit and glows away.",
  tags: ["cinema", "pun", "lightning", "bolt", "storm", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 1.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1c1406", "#5a3e10", "#c48412", "#ffd23c", "#fff09a", "#ffffff"], seed: 1, w: 40, h: 60 },
};

// strikes: when, how long they burn, which path seed
const STRIKES = [
  { t: 0.12, life: 0.16, k: 1 },
  { t: 0.34, life: 0.1, k: 0.75 },
  { t: 0.52, life: 0.08, k: 0.55 },
];
const LEADER = [0, 0.12];

export function drawBack(p, t, o) {
  preview(p, o);
}

function path(o, idx, hw, hh) {
  const r = rng(o.seed, idx, 41);
  const x0 = -hw * 0.35 + r.next() * hw * 0.4, y0 = -hh * 1.75, x1 = hw * 0.1 + (r.next() - 0.5) * hw * 0.3, y1 = -hh * 0.1;
  const main = bolt(r, x0, y0, x1, y1, { jag: 0.28, depth: 5 });
  return { main, fk: forks(r, main, { count: 3, len: hh * 0.55, spread: 0.8 }), hit: [x1, y1] };
}

function drawBolt(p, pts, C, w, a) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    for (let d = 1; d < w; d++) {
      p.line(x0 - d, y0, x1 - d, y1, d > 1 ? C[3] : C[4], a);
      p.line(x0 + d, y0, x1 + d, y1, C[3], a);
    }
    p.line(x0, y0, x1, y1, WHITE, a);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), { hw, hh, s } = dims(o), k = Math.max(0.6, s);

  // the leader: a thin dim path inching down, stepping
  if (t >= LEADER[0] && t < LEADER[1]) {
    const { main } = path(o, 0, hw, hh), n = Math.floor(main.length * Math.min(1, (t - LEADER[0]) / (LEADER[1] - LEADER[0]) * 1.1));
    for (let i = 1; i < n; i++) p.line(main[i - 1][0], main[i - 1][1], main[i][0], main[i][1], C[3], 0.8);
    if (n > 1) p.glow(main[n - 1][0], main[n - 1][1], 5 * k, C[4], 0.4);
  }

  STRIKES.forEach((S, i) => {
    const age = t - S.t;
    if (age < 0) return;
    const { main, fk, hit } = path(o, i, hw, hh);
    // the white frame: the whole poster lights for a frame or two on the first strike
    if (age < 0.06) {
      p.shade(-hw, -hh, hw, hh, (x, y) => void p.blend(x, y, WHITE, 0.4 * S.k * (1 - age / 0.06)));
      p.glow(hit[0], hit[1], hh * 1.2, C[4], 0.55);
    }
    if (age < S.life) {
      const flick = age < S.life * 0.5 || Math.sin(age * 120) > -0.3 ? 1 : 0.45;
      drawBolt(p, main, C, k >= 0.9 ? Math.round(1 + k) : 1, flick);
      for (const f of fk) drawBolt(p, f, C, 1, flick * 0.8);
      for (let j = 0; j < main.length; j += 3) p.light(main[j][0], main[j][1], C[4], 0.35 * S.k);
      p.glowLine(main[0][0], main[0][1], hit[0], hit[1], 9 * k, C[3], 0.3 * S.k);
      p.glow(hit[0], hit[1], 16 * k, C[4], 0.45 * S.k);
    } else if (age < S.life + 0.25) {
      // an afterimage that cools down the ramp
      const q = (age - S.life) / 0.25;
      for (let j = 1; j < main.length; j++) p.line(main[j - 1][0], main[j - 1][1], main[j][0], main[j][1], q < 0.4 ? C[3] : C[2], (1 - q) * 0.9);
    }
  });

  // the hit: sparks spraying off the poster, a scorch glow that lingers
  const h0 = STRIKES[0].t, ha = t - h0;
  if (ha > 0) {
    const { hit } = path(o, 0, hw, hh);
    burst(Math.round(12 + 6 * s), o.seed + 9, (r) => {
      const d = r.next() < 0.6 ? 0 : 0.22, age = ha - d, life = r.range(0.25, 0.55);
      if (age < 0 || age > life) return;
      const a = -Math.PI / 2 + r.range(-1.4, 1.4), sp = r.range(60, 140) * k;
      const [x, y] = fly(hit[0], hit[1], Math.cos(a) * sp, Math.sin(a) * sp, age, 320, 3);
      const [x2, y2] = fly(hit[0], hit[1], Math.cos(a) * sp, Math.sin(a) * sp, Math.max(0, age - 0.025), 320, 3);
      const q = 1 - age / life;
      p.line(x2, y2, x, y, q > 0.5 ? WHITE : C[4]);
      p.light(x, y, C[4], 0.4 * q);
    });
    const g = clamp(1 - (ha - 0.1) / 1.0);
    if (g > 0) {
      p.glow(hit[0], hit[1], 10 * k, C[3], 0.35 * g);
      p.px(hit[0], hit[1], g > 0.5 ? C[5] : C[4]);
    }
  }
}
