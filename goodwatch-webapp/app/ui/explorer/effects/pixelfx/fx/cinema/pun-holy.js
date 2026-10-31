// Made for the GoodWatch explorer map: title pun.
// Light from above: a beam of warm white light comes down onto a poster, motes rising inside it, a soft halo ring
// floats over the poster, a little shower of choir sparkles drifts down around it, then the beam lifts away.
import { burst, seg, ease, clamp, TAU, WHITE, hex, fit } from "../../core/index.js";
import { dims, preview } from "./_pun1.js";

export const meta = {
  name: "Pun: holy",
  desc: "A beam of warm white light descends onto the poster with motes rising in it, a soft halo ring floats above, a shower of little sparkles drifts down, then the light lifts away.",
  tags: ["cinema", "pun", "holy", "heaven", "angel", "miracle", "light", "one-shot"],
  size: [144, 176],
  origin: [72, 96],
  duration: 2.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"], seed: 1, w: 40, h: 60 },
};

const TOP = -95, LIFT = 1.75, END = 2.45;

export function drawBack(p, t, o) {
  preview(p, o);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), { hw, hh, s } = dims(o), k = clamp(s, 0.6, 3.5), sk = Math.sqrt(k);
  const top = k <= 1.2 ? Math.max(TOP, -hh - 60) : -hh - 50 * sk;
  // the beam's foot comes down fast; at the end its foot lifts back up and it thins
  const down = ease.outCubic(seg(t, 0, 0.32)), up = ease.inCubic(seg(t, LIFT, END));
  const foot = top + (hh + 2 - top) * down - (hh + 2 - top) * up;
  const fade = 1 - seg(t, LIFT + 0.2, END), on = Math.min(1, t / 0.05) * fade;
  const w0 = hw * 0.35, w1 = hw * 0.95;
  const halfW = (y) => w0 + (w1 - w0) * clamp((y - top) / (hh - top));

  if (foot > top + 1 && on > 0) {
    // the shaft: truly translucent warm light, brightest down its middle, bands sliding down it
    p.each(-w1 - 1, top, w1 + 1, foot, (x, y, sx, sy) => {
      const hwy = halfW(y), u = Math.abs(x) / hwy;
      if (u > 1) return;
      // god rays: a few fixed streaks along the beam, shimmering, and soft bands sliding down
      const ray = Math.max(0, Math.sin((x / hwy) * 7.5 + 0.6) * Math.sin((x / hwy) * 3.1 - 1.1 + t * 0.8));
      const band = 0.85 + 0.15 * Math.sin(y * 0.25 / sk - t * 10);
      const tip = clamp((foot - y) / 6), head = clamp((y - top) / 18), core = 1 - u * u;
      const a = on * tip * head * band * (0.07 + 0.16 * core + 0.2 * ray * core);
      p.blendPx(sx, sy, ray > 0.55 && u < 0.7 ? C[6] : u < 0.5 ? C[5] : C[4], a);
      p.add(sx, sy, C[4], a * 0.25);
    });
    // its two edges: fine lit lines
    for (let y = Math.ceil(top); y < foot; y++) {
      const e = halfW(y), a = 0.45 * on * clamp((y - top) / 18) * clamp((foot - y) / 4);
      p.blend(-e, y, C[5], a);
      p.blend(e, y, C[5], a);
    }
    p.glowLine(0, top + 20, 0, foot, w1 * 0.8, C[4], 0.16 * on);
  }

  // where it lands: a pool of light on the poster and a white flash the moment it arrives
  const land = seg(t, 0.25, 0.4) * fade * (1 - up);
  if (land > 0) {
    p.glow(0, hh * 0.3, Math.max(hw, hh) * 0.9, C[5], 0.18 * land);
  }
  const hit = 1 - seg(t, 0.3, 0.48);
  if (t > 0.3 && hit > 0) {
    p.glowLine(-hw, -hh, hw, -hh, 10 * sk, WHITE, 0.6 * hit);
    p.line(-hw * hit, -hh, hw * hit, -hh, WHITE);
  }

  // motes rising inside the beam
  burst(Math.round(14 + 12 * k), o.seed + 1, (r) => {
    const b = r.range(0.15, LIFT), life = r.range(0.7, 1.2), age = t - b;
    if (age < 0 || age > life) return;
    const u = age / life, y0 = r.range(-hh * 0.6, hh), y = y0 - u * r.range(18, 34) * sk;
    if (y < top + 2 || y > foot) return;
    const x = r.range(-0.85, 0.85) * halfW(y) + Math.sin(age * 4 + b * 9) * 1.2;
    const a = Math.sin(Math.PI * u) * fade;
    const big = r.next() < 0.25;
    p.dot(x, y, big ? WHITE : C[6], a * 1.2);
    if (big && a > 0.5) { p.dot(x, y + 1, C[5], a * 0.8); p.light(x, y, C[5], 0.35 * a); }
  });

  // the halo: a flat ring floating over the poster's top, back half dimmer, bobbing; rises away at the end
  const ho = ease.outBack(seg(t, 0.35, 0.65)) * (1 - seg(t, LIFT + 0.1, END));
  if (ho > 0.02) {
    const rx = Math.max(6, hw * 0.55) * Math.min(1.1, ho), ry = Math.max(1.8, rx * 0.26);
    const cy = -hh - 9 * sk - 3 * sk * Math.sin(t * 3) - up * 25 * sk;
    const m = Math.ceil(rx * 7);
    for (let j = 0; j < m; j++) {
      const g = (j / m) * TAU, x = Math.cos(g) * rx, y = cy + Math.sin(g) * ry, front = Math.sin(g) > 0;
      const lit = Math.cos(g - t * 4);
      p.px(x, y, front ? (lit > 0.8 ? WHITE : C[5]) : C[3]);
      if (rx > 9 && front) p.px(x, y + 1, C[4]);
    }
    p.glow(0, cy, rx * 1.8, C[4], 0.35 * ho);
    p.glow(rx * Math.cos(t * 4), cy + ry * Math.sin(t * 4) * 0.5, 4 * sk, WHITE, 0.4 * ho);
  }

  // the choir shower: little star sparkles drifting down around the poster, twinkling
  burst(Math.round(10 + 8 * k), o.seed + 3, (r) => {
    const b = r.range(0.35, 1.5), life = r.range(0.7, 1.1), age = t - b;
    if (age < 0 || age > life) return;
    const u = age / life, x = r.range(-1.2, 1.2) * hw + Math.sin(age * 3 + b * 5) * 2 * sk;
    const y = -hh * r.range(0.6, 1.3) + u * r.range(18, 40) * sk;
    const tw = Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.sin(age * 20 + b * 30));
    const arm = Math.round(tw * (1.6 + 1.2 * sk));
    p.px(x, y, tw > 0.6 ? WHITE : C[5]);
    for (let q = 1; q <= arm; q++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + dx * q, y + dy * q, q === arm ? C[4] : C[5]);
    p.glow(x, y, (3 + 2 * arm) * sk, C[5], 0.4 * tw);
  });
}
