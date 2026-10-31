// Made for the GoodWatch explorer map: ambient loop.
import { cycle, fit, hex, TAU } from "../../core/index.js";
import { env, count, radius, step } from "./_amb2.js";

export const meta = {
  name: "Drifting petals",
  desc: "Over a spring or Japan island: a few pink petals swing down on a light breeze, flipping as they go to show their pale backs.",
  tags: ["cinema", "ambient", "island", "petals", "spring", "loop"],
  size: [112, 104],
  origin: [56, 56],
  duration: 7,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#4a1430", "#a8406e", "#ec7aa8", "#ffc4dc", "#fff2f8"], seed: 1, r: 30, density: 1 },
};

// m petal, h lit edge, d shade; turns: face, tilted, edge, back (pale)
const SMALL = [["hm.", "mmd"], [".h", "md"], ["hm"], ["hh.", "hhm"]];
const BIG = [[".hm.", "hmmm", ".mmd"], ["hm.", "mmd", ".d."], ["hmm"], [".hh.", "hhhh", ".hhm"]];

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = radius(o), d2 = o.density >= 2;
  cycle(t, meta.duration, count(5, o.density), o.seed, (g) => g.range(3.2, 4.6), (age, life, r) => {
    const k = age / life, ph = r.range(0, TAU), sw = r.range(1.6, 2.4);
    const x0 = r.range(-0.85, 0.6) * R, y0 = -R * r.range(0.75, 1), fall = R * r.range(0.9, 1.3);
    // a swing that slows at its ends, and a breeze that carries it right
    const x = x0 + Math.sin(age * sw + ph) * R * 0.12 + k * R * 0.22, y = y0 + fall * k;
    if (Math.hypot(x, y) > R * 1.05) return;
    const a = env(k, 0.12, 0.3), c = step(C, a, 2);
    if (!c) return;
    const flip = Math.cos(age * sw * 2 + ph), f = Math.abs(flip) < 0.3 ? 2 : flip > 0.7 ? 0 : flip > 0 ? 1 : 3;
    const rows = (d2 || r.chance(0.4) ? BIG : SMALL)[f];
    const pal = f === 3 ? { h: C[3], m: C[2] } : { m: c, h: C[3], d: C[1] };
    p.sprite(rows, pal, Math.round(x), Math.round(y), { flip: Math.sin(age * sw + ph) < 0 });
    p.light(x + 1, y + 1, C[2], 0.1 * a);
  });
}
