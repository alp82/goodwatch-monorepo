// Made for the GoodWatch footer cinema: the movie palace's 35mm projector, close up from behind and above in the
// bottom-right corner: two big spoked reels on arms, film threading down into the head, a vented lamp house with a
// chimney and an arc window, a long lens barrel with a brass focus ring pointing up and into the room.
// Origin: the lens's front glass. Mirror it with `flip` for the bottom-left corner. Off, `roll` tips it about the lens
// and `spin` turns the reels (the footer peek: tipped back into the corner, then up with a turn of the reels).
import { clamp, fit, rand, hex, mix, TAU, WHITE, sparkle, cycle } from "../../core/index.js";
import { view, plane, prism, box, line3, px3, poly3, tone, screenLit, lensAngle, canvasClip, METAL, BRASS, ALU } from "./_projector.js";

export const meta = {
  name: "Projector 35mm",
  desc: "A classic 35mm projector up close from behind: big spoked reels turning, film threading, lamp light leaking from the vents, a hot lens pointing at the screen.",
  tags: ["cinema", "footer", "projector", "loop"],
  size: [200, 140],
  origin: [104, 46],
  duration: 2.5,
  loop: true,
  fps: 24,
  bg: "dark",
  options: {
    palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    seed: 1, on: 1, lum: 0.5, tint: hex("#dce0ff"), hover: 0, roll: 0, spin: 0,
  },
};

const D = meta.duration;
export const CAM = { F: 160, L: [34, 32, 190], pitch: 0.24, yaw: -0.28 };
const FEED = { y: 36, z: -64, R: 21, pack: 17, spokes: 5, w: 5 };
const TAKE = { y: 24, z: -30, R: 15, pack: 7, spokes: 5, w: 5 };
const RX = -2.5; // the reels' near flange plane
const LH = { x0: -10, x1: 10, y0: -16, y1: 13, z0: -104, z1: -60 };
const HD = { x0: -8, x1: 8, y0: -13, y1: 10, z0: -60, z1: -42 };

// a reel: the far flange, then the near one per pixel (spokes, rims, a hub) with the film pack in its windows
function reel(p, V, r, rot, C, k, lum, tint, run) {
  const R = r.R, lit = V.lit([-1, 0, 0]);
  const warm = (c, up) => (run && up < -0.35 ? mix(c, C[4], Math.floor(clamp(-up * k) * 3) / 3 * 0.6) : c);
  const base = tone(ALU, 0.28 + 0.45 * lit.f);
  // far flange: a dark disc with a thin rim, seen through the windows and past the near rim
  plane(p, V, [RX + r.w, r.y, r.z], [0, 0, 1], [0, 1, 0], -R - 1, R + 1, -R - 1, R + 1, (u, v) => {
    const d = Math.hypot(u, v);
    if (d > R) return;
    if (d > R - 1) return v > 0 ? ALU[3] : ALU[1];
    if (d < r.pack) return 0;
    return METAL[2];
  }, { two: true });
  // the pack's outer turns, between the flanges: a lit band where it shows below the near flange's windows
  plane(p, V, [RX, r.y, r.z], [0, 0, 1], [0, 1, 0], -R - 1, R + 1, -R - 1, R + 1, (u, v) => {
    const d = Math.hypot(u, v);
    if (d > R) return;
    const a = Math.atan2(v, u), up = v / (d || 1);
    // the lamp below warms the rim's lower half when running; the screen lights its top
    if (d > R - 1.3) return warm(screenLit(up > 0.45 ? ALU[6] : up > -0.25 ? ALU[4] : ALU[2], Math.max(0, up), lum, tint), up);
    if (d > R - 2.4) return warm(up > 0.2 ? ALU[3] : ALU[2], up);
    if (d < 1.2) return run ? C[6] : ALU[6];
    if (d < 2.6) return up > -0.2 ? ALU[5] : ALU[3];
    if (d < 4.4) return d < 3.4 ? ALU[2] : base;
    // spokes: the angular distance to the nearest one, in units of length; lit on the upper side
    const per = TAU / r.spokes, s = (((a - rot) % per) + per) % per, off = Math.min(s, per - s) * d;
    if (off < 1.15) return warm(off < 0.5 ? (up > -0.1 ? ALU[5] : ALU[4]) : base, up);
    // the open window: film pack, or the far flange already drawn behind
    if (d < r.pack) {
      if (d > r.pack - 1) return run ? mix(C[4], C[5], k) : C[3];
      // wound film: dark brown turns with fine rings, a glossy sheen where the light catches the pack
      const ring = Math.floor(d * 1.3) % 3 === 0, sheen = Math.cos(a - 1.0) > 0.6;
      if (sheen) return ring ? C[3] : C[2];
      return ring ? C[2] : mix(C[0], C[1], 0.6);
    }
    return 0;
  }, { two: true });
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), on = clamp(o.on ?? 0), run = on > 0.001, lum = clamp(o.lum ?? 0), tint = o.tint ?? WHITE;
  const hover = run ? 0 : clamp(o.hover ?? 0);
  // roll: the projector tipped about its lens (the footer's peek); spin: the reels' turn while it is off
  const V = view({ ...CAM, roll: o.roll ?? 0, clip: canvasClip(meta) }), M = METAL;
  const ph = run ? t / D : (o.spin ?? 0);
  const step = run ? Math.floor(t * 24) % 60 : 0;
  const fl = run ? 0.84 + 0.16 * rand(o.seed, step) - (rand(o.seed, step, 7) < 0.08 ? 0.22 : 0) : 0;
  const k = on * fl;
  const body = (lt, lo = 0.12, hi = 0.5) => screenLit(tone(M, lo + hi * lt.f), lt.s, lum, tint);
  const hot = (a) => mix(C[3], C[6], clamp(a));
  const fan = run ? -ph * (TAU / 5) * 12 : 0.3;

  // ---- far to near: the lens barrel first
  // the front hood and its glass: we look down the barrel's back, the glass faces the screen
  prism(p, V, [0, 0, -5], [0, 0, 1], 5, 6.4, 7, 16, (lt) => screenLit(tone(ALU, 0.25 + 0.6 * lt.f), lt.s, lum, tint), null, null, 0.2);
  // the barrel, in slices from far to near: front slice, brass focus ring, middle, a chrome band, the back
  const barrel = (z0, z1) => prism(p, V, [0, 0, z0], [0, 0, 1], z1 - z0, 5.4, 5.4, 16, (lt) => screenLit(tone(M, 0.25 + 0.62 * lt.f), lt.s, lum, tint), null, null, 0.2);
  barrel(-11, -5);
  prism(p, V, [0, 0, -14], [0, 0, 1], 3, 6.2, 6.2, 16, (lt, i) => screenLit(tone(BRASS, (i % 2 ? 0.05 : 0.18) + 0.62 * lt.f), lt.s, lum, tint), null, (lt) => tone(BRASS, 0.2 + 0.45 * lt.f), 0.2);
  barrel(-28, -14);
  prism(p, V, [0, 0, -30], [0, 0, 1], 2, 5.9, 5.9, 16, (lt) => screenLit(tone(ALU, 0.3 + 0.6 * lt.f), lt.s, lum, tint), null, (lt) => tone(ALU, 0.2 + 0.5 * lt.f), 0.2);
  barrel(-38, -30);
  // the lens mount plate
  box(p, V, -7.5, -7.5, -42, 7.5, 7.5, -38, (f, lt) => (f === "top" ? screenLit(tone(M, 0.5 + 0.3 * lt.f), lt.s, lum, tint) : body(lt, 0.22, 0.5)));

  // ---- the head (the mechanism) with the gate door
  box(p, V, HD.x0, HD.y0, HD.z0, HD.x1, HD.y1, HD.z1, (f, lt) => {
    const c = body(lt, 0.16, 0.5);
    if (f === "left") return (u, v) => {
      // the gate door: a recessed panel with a little window glowing with the lamp
      if (u > 4 && u < 18 && v > 6 && v < 19) {
        if (u > 9 && u < 13 && v > 10 && v < 15) return run ? hot(0.4 + 0.6 * k) : M[1];
        if (u < 5 || v > 18) return tone(M, 0.12);
        if (u > 17 || v < 7) return tone(M, 0.55 + 0.3 * lt.f);
        return tone(M, 0.24 + 0.4 * lt.f);
      }
      // a knob and a brass name plate
      if (Math.hypot(u - 16, v - 3.5) < 1.3) return BRASS[4];
      if (u > 3 && u < 12 && v > 2 && v < 4.5) return v > 3.6 ? BRASS[5] : BRASS[2];
      if (v > 22) return screenLit(tone(M, 0.62 + 0.3 * lt.f), 1, lum, tint);
      return c;
    };
    if (f === "top") return (u, v) => (u < 1.2 ? screenLit(tone(M, 0.7), 1, lum, tint) : c);
    return c;
  });

  // ---- the lamp house, the near end: louvres, an arc window, a rear door, a chimney
  box(p, V, LH.x0, LH.y0, LH.z0, LH.x1, LH.y1, LH.z1, (f, lt) => {
    const c = body(lt, 0.14, 0.48);
    if (f === "left") return (u, v) => {
      // the cooling fan: a round grille, blades spinning against the lamp's glow behind
      const fu = u - 34, fv = v - 14, dw = Math.hypot(fu, fv);
      if (dw < 8.4) {
        if (dw > 7.4) return dw > 7.9 ? tone(M, 0.6 + 0.3 * lt.f) : M[1];
        const ring = dw > 1.8 && ((dw + 0.5) % 2.2) < 0.75;
        if (ring) return tone(M, 0.35 + 0.35 * lt.f + (fv > 0 ? 0.12 : 0));
        if (dw < 1.8) return dw < 0.9 ? ALU[5] : ALU[3];
        const per = TAU / 5, s = (((Math.atan2(fv, fu) - fan) % per) + per) % per;
        const blade = s < per * 0.55;
        if (blade) return s < per * 0.12 ? tone(M, 0.4) : M[1];
        return run ? hot(0.15 + 0.6 * k * (1 - dw / 9)) : M[0];
      }
      // louvres: rows of slits, glowing with the lamp when running
      const row = v - 3, rr = ((row % 3.5) + 3.5) % 3.5, inLv = row > 0 && row < 20 && u > 4 && u < 23;
      if (inLv && rr < 1.1) return run ? hot(k * (0.55 + 0.45 * Math.sin(u * 0.35 + 1))) : M[0];
      if (inLv && rr < 2.1) return tone(M, 0.32 + 0.4 * lt.f);
      if (v > LH.y1 - LH.y0 - 1.3) return screenLit(tone(M, 0.62 + 0.3 * lt.f), 1, lum, tint);
      if (u < 1) return tone(M, 0.3);
      return c;
    };
    if (f === "top") return (u, v) => {
      // vent slats either side of the chimney
      const slat = u > 4 && u < 16 && v > 4 && v < 42 && Math.abs(v - 26) > 5 && (Math.floor(v) % 3 === 0);
      if (slat) return run ? hot(0.5 * k + 0.2) : M[1];
      if (u < 1.2) return screenLit(tone(M, 0.75), 1, lum, tint);
      if (v < 1) return screenLit(tone(M, 0.6), 1, lum, tint);
      return c;
    };
    if (f === "back") return (u, v) => {
      // the rear door: seams that leak lamp light, hinges and a handle
      const seam = (Math.abs(u - 3) < 0.6 || Math.abs(u - 17) < 0.6) && v > 3 && v < 26 || (Math.abs(v - 3) < 0.6 || Math.abs(v - 26) < 0.6) && u > 3 && u < 17;
      if (seam) return run ? hot(0.25 + 0.4 * k) : M[0];
      // the arc window: a round port of ruby glass where you watch the lamp burn
      const dw = Math.hypot(u - 10, v - 15);
      if (dw < 4.2) {
        if (dw > 3.2) return dw < 3.7 ? BRASS[5] : BRASS[2];
        return run ? (dw < 1.6 ? WHITE : hot(0.55 + 0.45 * k)) : dw < 1.4 ? hex("#6a2026") : hex("#2a0c12");
      }
      if (u > 15 && u < 16.5 && v > 12 && v < 17) return ALU[4];
      if (u < 2.5 && (Math.abs(v - 7) < 1.2 || Math.abs(v - 22) < 1.2)) return ALU[3];
      if (v > LH.y1 - LH.y0 - 1.2) return screenLit(tone(M, 0.5), 1, lum, tint);
      if (u < 1) return tone(M, 0.32);
      return c;
    };
    return c;
  });
  // the chimney and its mushroom cap
  prism(p, V, [0, LH.y1, -86], [0, 1, 0], 5, 3.4, 3.4, 12, (lt) => body(lt, 0.16, 0.6), null);
  prism(p, V, [0, LH.y1 + 2.5, -86], [0, 1, 0], 1.2, 3.8, 3.8, 12, (lt) => tone(BRASS, 0.15 + 0.6 * lt.f), null);
  prism(p, V, [0, LH.y1 + 5, -86], [0, 1, 0], 2.2, 5.2, 3.2, 12, (lt) => screenLit(tone(M, 0.2 + 0.6 * lt.f), lt.s, lum, tint), (lt) => screenLit(tone(M, 0.45 + 0.3 * lt.f), lt.s, lum, tint), (lt) => (run ? hot(0.4 * k) : M[0]));

  // ---- reel arms rising from the head and the lamp house
  const armLit = V.lit([-1, 0, 0]);
  const arm = (y0, z0, r) => {
    const xa = RX + r.w / 2;
    poly3(p, V, [[xa, y0, z0 - 2], [xa, y0, z0 + 2], [xa, r.y, r.z + 1.2], [xa, r.y, r.z - 1.2]], tone(M, 0.22 + 0.4 * armLit.f));
    line3(p, V, [xa, y0, z0 - 2], [xa, r.y, r.z - 1.2], screenLit(tone(M, 0.62), 1, lum, tint));
  };
  arm(HD.y1, -48, TAKE);
  arm(LH.y1, -68, FEED);

  // ---- film: off the feed pack's front, a loop down into the head; out of the head up to the take-up pack
  const rotF = -ph * (TAU / FEED.spokes) * 2 + 0.25, rotT = -ph * (TAU / TAKE.spokes) * 4 + 0.9;
  const flut = run ? Math.sin(ph * TAU * 10) * 0.7 * on : 0;
  const fx = RX + 2.5;
  const film = (a, b, mid) => {
    const pts = mid ? [a, mid, b] : [a, b];
    for (let i = 0; i + 1 < pts.length; i++) {
      line3(p, V, pts[i], pts[i + 1], C[2]);
      line3(p, V, [pts[i][0], pts[i][1] + 0.9, pts[i][2]], [pts[i + 1][0], pts[i + 1][1] + 0.9, pts[i + 1][2]], run ? C[5] : C[4]);
    }
  };
  // the far reel (take-up) and its film first
  film([fx, HD.y1, -55], [fx, TAKE.y - TAKE.pack + 1, TAKE.z - 2]);
  reel(p, V, TAKE, rotT, C, k, lum, tint, run);
  film([fx, FEED.y - 3, FEED.z + FEED.pack], [fx, HD.y1, -45], [fx, 17 + flut * 0.5, -42 + flut]);
  reel(p, V, FEED, rotF, C, k, lum, tint, run);

  // sprocket glints running down the feed film
  if (run) {
    const m = Math.floor(ph * 60) % 3;
    for (let i = 0; i < 6; i++) if ((i + m) % 3 === 0) {
      const u = i / 6, a = [fx, FEED.y - 3, FEED.z + FEED.pack], b = [fx, 17 + flut * 0.5, -42 + flut];
      px3(p, V, [fx - 0.5, a[1] + (b[1] - a[1]) * u + 0.5, a[2] + (b[2] - a[2]) * u], C[6]);
    }
  }

  // ---- pilot light on the head
  const pl = V.P(HD.x0, 4, -46);
  p.px(pl[0], pl[1], run || hover ? C[6] : C[4]);
  p.light(pl[0], pl[1], C[4], run ? 0.5 : 0.35 + 0.45 * hover);
  if (hover) p.glow(pl[0], pl[1], 5, C[4], 0.4 * hover);

  // ---- light: lamp leaks from louvres, slats, seams and the arc window; heat over the chimney
  if (run) {
    const lv = V.P(LH.x0, 0, -90), aw = V.P(LH.x0, -2, -70), ch = V.P(0, LH.y1 + 10, -86), gw = V.P(HD.x0, 0, -51), bk = V.P(0, 0, LH.z0);
    p.glow(lv[0], lv[1], 34, C[4], 0.16 * k);
    p.glow(lv[0], lv[1], 16, C[5], 0.18 * k);
    p.glow(aw[0], aw[1], 14, C[5], 0.3 * k);
    const ap = V.P(-0, -1, LH.z0);
    p.glow(ap[0], ap[1], 10, C[6], 0.35 * k);
    p.glow(ch[0], ch[1], 22, C[4], 0.22 * k);
    p.glow(gw[0], gw[1], 9, C[5], 0.3 * k);
    p.glow(bk[0], bk[1], 30, C[3], 0.1 * k);
    // the reels lit from the lamp below
    const fr = V.P(RX, FEED.y - 10, FEED.z), tr = V.P(RX, TAKE.y - 8, TAKE.z);
    p.glow(fr[0], fr[1], 26, C[3], 0.12 * k);
    p.glow(tr[0], tr[1], 18, C[3], 0.12 * k);
  }
  // ---- motes drifting up through the lamp's light from the top slats and the chimney
  if (run) {
    cycle(t, D, 10, o.seed, (g) => g.range(1.4, 2.5), (age, life, r) => {
      const z = r.chance(0.4) ? -86 + r.range(-2, 2) : r.range(-100, -64), x = r.range(-6, 6);
      const q = V.P(x, LH.y1 + 1 + age * r.range(6, 12), z), u = age / life, a = Math.sin(Math.PI * u) * on;
      const sx = q[0] + Math.sin(age * 3 + r.range(0, 6)) * 1.2;
      p.dot(sx, q[1], r.chance(0.3) ? C[6] : C[5], clamp(a * 1.2));
      p.light(sx, q[1], C[4], 0.3 * a);
    });
  }
  // ---- the lens: hot glass spilling round the hood, a small flare
  if (run) {
    p.glow(0, 0, 18, C[5], 0.35 * k);
    p.glow(0, 0, 7, C[6], 0.8 * k);
    sparkle(p, 0, 0, 3 + 2 * k, WHITE, C[5], 0.6 * k);
    // a thin horizontal flare streak through the hot glass
    for (let i = 4; i < 12; i++) { p.dot(i, 0, C[5], (1 - i / 12) * k); p.dot(-i, 0, C[5], (1 - i / 12) * k); }
  } else if (hover) {
    sparkle(p, -2, -4, 2, WHITE, C[5], 0.45 * hover);
  }
}

export const LENS_ANGLE = lensAngle(view(CAM));
