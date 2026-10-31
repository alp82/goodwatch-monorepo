// Made for the GoodWatch explorer map: ambient loop.
import { fit, hex, mix, clamp, bump, smooth, rng, ease, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Surf",
  desc: "Over the Australia island: small waves curl along the upper edge, a white crest breaks into spray that arcs and falls, and the sun glints off the water.",
  tags: ["cinema", "ambient", "island", "country", "australia", "surf", "waves", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 6,
  loop: true,
  fps: 30,
  bg: "dark",
  // deep water, water, lit water, foam shadow, foam
  options: { palette: ["#0b2f5c", "#1c6aa8", "#4cb4ec", "#bfe9ff", "#f4fdff"], seed: 1, r: 30, density: 1 },
};

const radius = (o) => clamp(o.r ?? 30, 10, 100);

/** Every element i of n, evenly spaced over the loop, alive for `life` s: fn(age, i). Seamless. */
function each(t, D, n, life, fn) {
  for (let i = 0; i < n; i++) {
    let age = (((t - (i * D) / n) % D) + D) % D;
    for (; age < life; age += D) fn(age, i);
  }
}

// one wave: travels along the upper edge; local frame x along travel, h up from the waterline
function wave(p, C, age, life, i, R, s, seed, d2) {
  const k = age / life, g = rng(seed, i, 13);
  const a0 = -Math.PI * g.range(0.66, 0.72), span = Math.PI * 0.3;
  const th = a0 + span * ease.outQuad(k), er = R * 0.82;
  const bx = Math.cos(th) * er, by = Math.sin(th) * er * 0.9;
  let fx = -Math.sin(th), fy = Math.cos(th) * 0.9;
  const tilt = clamp(Math.atan2(fy, fx), -0.35, 0.35);
  fx = Math.cos(tilt); fy = Math.sin(tilt);
  const ux = fy, uy = -fx; // up (outward)
  const W = (x, h) => [bx + fx * x + ux * h, by + fy * x + uy * h];
  // phases: swell 0..0.3, curl 0.3..0.55, break 0.55..0.75, whitewater and fade after
  const big = 0.9 + g.next() * 0.25;
  const swell = ease.outQuad(clamp(k / 0.3)), curl = ease.inOutQuad(smooth(0.22, 0.55, k)), brk = smooth(0.55, 0.75, k);
  const fade = 1 - smooth(0.82, 1, k);
  const H = 11 * s * big * swell * (1 - brk * 0.6), B = 14 * s * big, r0 = Math.max(2.2, H * 0.4);
  const ext = curl * 3.4, w = Math.max(1.2, 1.6 * s);
  const cx = 0, ch = H - r0;
  const spiral = [];
  for (let j = 0; j <= 16; j++) {
    const v = j / 16, phi = Math.PI / 2 - ext * v, rr = r0 * (1 - 0.4 * (ext * v) / 3.4);
    spiral.push([cx + Math.cos(phi) * rr, ch + Math.sin(phi) * rr, v]);
  }
  const lipEnd = 1 - brk; // the lip dissolves from the tip back as it breaks
  const F = r0 * 0.9 + (1 - curl) * B * 0.4;
  const prof = (x) => {
    if (x < -B || x > F) return -1;
    if (x < 0) return H * (0.5 - 0.5 * Math.cos(((x + B) / B) * Math.PI));
    const round = H * (0.5 + 0.5 * Math.cos((x / F) * Math.PI)), hollow = (H - r0) * (1 - x / F) ** 1.3;
    return round + (hollow - round) * curl;
  };
  if (H > 0.8 && fade > 0) {
    const ext2 = B + r0 + 3;
    const [ox, oy] = W(0, H / 2);
    p.shade(ox - ext2, oy - ext2, ox + ext2, oy + ext2, (px, py, out) => {
      const rx = px - bx, ry = py - by, x = rx * fx + ry * fy, h = rx * ux + ry * uy;
      if (h < -0.5 || x < -B - 1 || x > r0 * 1.6 + 2) return;
      // lip: near the spiral
      let best = 1e9, bv = 0;
      for (const [sx, sh, v] of spiral) {
        if (v > lipEnd) break;
        const d = (sx - x) ** 2 + (sh - h) ** 2;
        if (d < best) { best = d; bv = v; }
      }
      if (ext > 0.2 && best < (w * 0.75) ** 2) {
        const dc = Math.hypot(x - cx, h - ch), rr = r0 * (1 - 0.4 * (ext * bv) / 3.4);
        out.c = dc > rr - 0.2 ? (bv > 0.25 ? C[4] : C[3]) : C[3];
        if (bv > 0.55 && dc > rr - 0.2) { out.c = mix(C[4], WHITE, 0.4); out.k = 0.25; out.l = C[3]; }
        out.a = fade;
        return;
      }
      const top = prof(x);
      if (h <= top) {
        const fromTop = top - h;
        out.c = fromTop < 1 ? (x < -B * 0.25 ? C[3] : C[2]) : h < 1.2 ? C[0] : fromTop < H * 0.4 ? C[2] : C[1];
        out.a = fade;
        return;
      }
      // the barrel: inside the curl, behind the lip
      const ang = Math.atan2(h - ch, x - cx), dc = Math.hypot(x - cx, h - ch);
      const sweep = Math.PI / 2 - ang;
      const sw = sweep < 0 ? sweep + Math.PI * 2 : sweep;
      if (ext > 0.8 && sw < ext * lipEnd && dc < r0 * (1 - 0.4 * sw / 3.4) && x > -0.5) { out.c = C[1]; out.a = fade; }
    });
  }
  // a little sea under the wave: a rippling waterline that runs out to both sides
  if (fade > 0) {
    const L = (B + r0) * 1.1;
    for (let x = -L; x <= L + 6 * s; x += 2) {
      const e = 1 - Math.abs((x - 3 * s) / (L + 3 * s)), rip = Math.sin(x * 0.9 + age * 6);
      if (e < 0.15) continue;
      const [px, py] = W(x, -0.5 + (rip > 0.5 ? 1 : 0));
      p.dot(px, py, rip > 0.7 ? C[3] : C[2], fade * clamp(e * 1.3) * (0.3 + 0.7 * swell) * (1 - brk * 0.5));
    }
  }
  // whitewater: foam that boils over the face and spreads along the line after the break
  if (brk > 0 && fade > 0) {
    const n = Math.round(10 * s), spread = (3 + 9 * smooth(0.6, 0.95, k)) * s;
    for (let j = 0; j < n; j++) {
      const q = rng(seed, i, 300 + j), x = r0 * 0.3 + q.range(-1, 1) * spread, hh = q.range(0, 2.5 * s) * (1 - brk * 0.6);
      const wob = Math.sin(age * 9 + j) > 0 ? 1 : 0;
      const [px, py] = W(x, hh + wob * 0.5);
      p.dot(px, py, q.next() < 0.5 ? C[4] : C[3], fade * clamp(brk * 2) * (1 - smooth(0.75, 1, k) * q.next()));
    }
  }
  // the spray: droplets thrown off the lip as it breaks, arcing out and falling
  if (k >= 0.5) {
    const sa = (k - 0.5) * life, tip = spiral[16];
    const [lx, ly] = W(r0 * 0.9, H / (1 - brk * 0.6) * 0.85);
    const n = Math.round((d2 ? 18 : 13) * Math.min(1.6, Math.sqrt(s)));
    for (let j = 0; j < n; j++) {
      const q = rng(seed, i, 50 + j), delay = q.range(0, 0.25), a = sa - delay;
      if (a <= 0) continue;
      const life2 = q.range(0.55, 1.0);
      if (a > life2) continue;
      const sp = q.range(14, 30) * Math.sqrt(s), an = q.range(0.1, 1.3);
      const vx = (fx * Math.cos(an) + ux * Math.sin(an)) * sp, vy = (fy * Math.cos(an) + uy * Math.sin(an)) * sp;
      const G = 55 * Math.sqrt(s);
      const x = lx + vx * a, y = ly + vy * a + 0.5 * G * a * a, vyy = vy + G * a, l01 = a / life2;
      const c = l01 < 0.3 ? mix(C[4], WHITE, 0.5) : l01 < 0.65 ? C[4] : C[3];
      p.px(x, y, c);
      if (l01 < 0.25 && j % 2 === 0) p.px(x + 1, y, c);
      if (l01 < 0.55) p.px(x - Math.sign(vx), y - Math.sign(vyy), l01 < 0.3 ? C[3] : C[2]); // streak behind it
      p.light(x, y, C[3], 0.2 * (1 - l01));
    }
    const bk = bump(sa, 0, 0.35);
    if (bk > 0) p.glow(lx, ly, 9 * s, C[3], 0.3 * bk);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), s = Math.max(0.7, R / 30), D = meta.duration, d2 = o.density >= 2;
  const n = d2 ? 4 : R >= 50 ? 3 : 2;
  each(t, D, n, 3.4, (age, i) => wave(p, C, age, 3.4, i, R, s, o.seed, d2));
  // the sun glinting off the water: a quick four-point star, twice a loop
  each(t, D, d2 ? 3 : 2, 0.6, (age, i) => {
    const g = rng(o.seed, i, 99), th = -Math.PI * g.range(0.25, 0.75), d = R * g.range(0.55, 0.8);
    const x = Math.cos(th) * d, y = Math.sin(th) * d * 0.9, k = bump(age, 0, 0.6) ** 0.7, arm = Math.round(k * 3 * s);
    for (let a = 1; a <= arm; a++) {
      const c = a === arm ? C[3] : C[4];
      p.px(x + a, y, c); p.px(x - a, y, c); p.px(x, y + a, c); p.px(x, y - a, c);
    }
    p.px(x, y, WHITE);
    p.glow(x, y, 5 + 3 * k * s, C[3], 0.35 * k);
  });
}
