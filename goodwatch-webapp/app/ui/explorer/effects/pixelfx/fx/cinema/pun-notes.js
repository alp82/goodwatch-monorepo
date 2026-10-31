// Made for the GoodWatch explorer map: title pun.
// Music burst: a soft chord flash, then eighth notes, quarter notes and beamed pairs pop out of the poster in three
// colors, float up swaying with a glow, and a five-line staff ribbon curls through the poster and unwinds.
import { Particles, Lights, P, Rng, clamp, seg, ease, TAU, WHITE, hex, fit, scale, sparkle } from "../../core/index.js";
import { poster } from "./_pun2.js";
import { preview } from "./_pun1.js";

export const meta = {
  name: "Pun: music notes",
  desc: "Musical notes (eighths, quarters, beamed pairs) burst out of the poster in three colors and float up swaying with a soft glow while a staff ribbon curls through and unwinds.",
  tags: ["cinema", "pun", "music", "notes", "musical", "one-shot"],
  size: [128, 128],
  origin: [64, 64],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#ffb347", "#ff6fa8", "#6fd8ff"],
    staff: ["#2a2350", "#6a5cc0", "#b8acff", "#f2eeff"],
    seed: 1, w: 40, h: 60,
  },
};

// 1 main, 2 highlight, 3 shade
const SMALL = [
  ["...1", "...1", "...1", ".211", "1113", ".33."], // quarter
  ["...1.", "...11", "...1.1", ".211..", "1113..", ".33..."].map((r) => r.padEnd(6, ".")), // eighth
  ["...11111", "...1...1", "...1...1", ".211.211", "11131113", ".33..33."], // beamed pair
];
const BIG = [
  ["....1", "....1", "....1", "....1", "....1", ".2111", "21111", "11113", ".333."],
  ["....1..", "....11.", "....1.1", "....1.1", "....1..", ".2111..", "21111..", "11113..", ".333..."],
  ["....111111", "....111111", "....1....1", "....1....1", "....1....1", ".2111.2111", "2111121111", "1111311113", ".333..333."],
];

export function create(o) {
  const { w, h, k } = poster(o), hw = w / 2, hh = h / 2, sk = Math.sqrt(k), R = new Rng(o.seed);
  const COLS = o.palette.map(hex), S = fit(o.staff, 4);
  const pals = COLS.map((c) => ({ 1: c, 2: WHITE, 3: scale(c, 0.6) }));
  const ps = new Particles({ rng: R, sparks: ["#ffffff", "#fff3d0", "#ffb347", "#ff6fa8"] }), lights = new Lights();
  const n = Math.round(clamp(8 + 5 * k, 8, 26)), notes = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + R.range(-1.5, 1.5), sp = R.range(80, 160) * sk;
    const big = k > 1.4 ? R.chance(0.6) : k > 0.9 ? R.chance(0.35) : R.chance(0.12);
    notes.push({ x: R.range(-hw * 0.5, hw * 0.5), y: R.range(-hh * 0.4, hh * 0.4), vx: Math.cos(a) * sp * clamp(w / 40, 0.55, 1.1), vy: Math.sin(a) * sp * 0.7,
      kind: R.int(0, 2), big, col: i % 3, delay: (i / n) * 0.35 + R.range(0, 0.06),
      ph: R.range(0, TAU), sw: R.range(2.5, 4), amp: R.range(2, 4.5) * sk, rise: R.range(10, 26) * sk, life: R.range(1.7, 2.4), x0: 0, mode: 0 });
  }
  lights.add(0, 0, 30 * sk, COLS[0], 0.35, 0.5);
  lights.add(0, 0, 16 * sk, WHITE, 0.4, 0.14);
  for (let i = 0; i < Math.round(10 * sk); i++) {
    const a = R.range(0, TAU), sp = R.range(50, 110) * sk;
    ps.spawn(P.STAR, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.4, 0.8), COLS[i % 3], R.range(0.5, 2));
  }
  // the staff ribbon: a curling path from lower left to upper right
  const SR = [0.1, 1.3], gap = Math.max(2, Math.round(1.7 * sk));
  const path = (u) => [-hw * 1.35 + u * hw * 2.7, hh * 0.15 - u * hh * 0.35 + Math.sin(u * TAU * 1.15 + 0.6) * hh * 0.22];
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
      for (const m of notes) {
        if (t < m.delay) continue;
        if (m.mode === 0) {
          m.vx -= m.vx * 5 * dt;
          m.vy -= m.vy * 5 * dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (Math.hypot(m.vx, m.vy) < 18) (m.mode = 1), (m.x0 = m.x - Math.sin(m.ph) * m.amp);
        } else {
          m.ph += m.sw * dt;
          m.vx -= m.vx * 3 * dt;
          m.x0 += m.vx * dt;
          m.x = m.x0 + Math.sin(m.ph) * m.amp;
          m.y -= m.rise * dt;
        }
      }
    },
    drawBack(p) {
      preview(p, o);
    },
    draw(p) {
      lights.draw(p);
      // the downbeat: a quick ring pulse out of the poster's middle
      const ru = seg(t, 0, 0.3);
      if (ru > 0 && ru < 1) {
        const r = 3 + ease.outQuart(ru) * Math.min(hw, 18 * sk);
        p.ring(0, 0, r, 1, ru < 0.25 ? WHITE : COLS[0], 1 - ru);
        p.glowRing(0, 0, r, 3, COLS[1], 0.3 * (1 - ru));
      }
      // staff: the head sweeps along the path, the tail follows and unwinds; five lines offset along the normal
      const hu = ease.outCubic(seg(t, SR[0], SR[1] - 0.45)), tu = ease.inQuad(seg(t, SR[0] + 0.3, SR[1]));
      if (hu > tu) {
        const steps = Math.max(8, Math.ceil(w * 0.8 * (hu - tu))) + 4;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const u = tu + ((hu - tu) * i) / steps, [x, y] = path(u), [x2, y2] = path(u + 0.003);
          const L = Math.hypot(x2 - x, y2 - y) || 1;
          pts.push([x, y, -(y2 - y) / L, (x2 - x) / L, i / steps]);
        }
        for (let j = -2; j <= 2; j++) {
          const off = j * gap, c = j === -2 ? S[2] : S[1];
          for (let i = 1; i < pts.length; i++) {
            const [ax, ay, anx, any, af] = pts[i - 1], [bx, by, bnx, bny] = pts[i];
            const fa = af < 0.3 ? af / 0.3 : 1;
            p.line(ax + anx * off, ay + any * off, bx + bnx * off, by + bny * off, af > 0.9 ? S[3] : c, fa);
          }
        }
        for (let i = 0; i < pts.length; i += 3) p.light(pts[i][0], pts[i][1], S[2], 0.18 * pts[i][4]);
        const [ex, ey, enx, eny] = pts[pts.length - 1];
        p.line(ex - enx * gap * 2.4, ey - eny * gap * 2.4, ex + enx * gap * 2.4, ey + eny * gap * 2.4, S[3]);
        p.glow(ex, ey, 7 * sk, S[3], 0.45);
        p.px(ex, ey, WHITE);
      }
      for (const m of notes) {
        if (t < m.delay) continue;
        const left = m.life - t;
        if (left <= 0) continue;
        const two = m.big && k >= 1.8, rows = (m.big && !two ? BIG : SMALL)[m.kind], pal = pals[m.col], sc = two ? 2 : 1;
        const H = rows.length * sc, W = rows[0].length * sc;
        const pop = clamp((t - m.delay) / 0.08);
        const x = Math.round(m.x - W / 2), y = Math.round(m.y - H / 2);
        if (left < 0.3) {
          // fading: last frames as a tinted outline that flickers off
          if (Math.sin(t * 50 + m.ph) > (left / 0.3) * 2 - 1) p.sprite(rows, pal, x, y, { tint: scale(COLS[m.col], 0.7), scale: sc });
        } else p.sprite(rows, pal, x, y, pop < 1 ? { tint: WHITE, scale: sc } : { scale: sc });
        p.glow(m.x, m.y + H * 0.2, 4 + H * 0.6, COLS[m.col], 0.28 * clamp(left / 0.4));
      }
      ps.draw(p);
      // a few twinkles riding the notes
      for (let i = 0; i < notes.length; i += 4) {
        const m = notes[i];
        if (t < m.delay + 0.2 || t > m.life - 0.3) continue;
        if (Math.sin(t * 9 + i * 2.1) > 0.9) sparkle(p, m.x + 3, m.y - 4, 1.5 + sk * 0.5, WHITE, COLS[m.col], 0.35);
      }
    },
  };
}
