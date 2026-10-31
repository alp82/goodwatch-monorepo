// Shared bits for the title pun effects (set 1): the poster rectangle they play over, its size, nested transforms.
import { hex } from "../../core/index.js";

/** Poster size in effect px and a unit scale (1 at the default 40 x 60). */
export function dims(o) {
  const w = o.w ?? 40, h = o.h ?? 60;
  return { w, h, hw: w / 2, hh: h / 2, s: Math.min(w / 40, h / 60) };
}

const POSTER = hex("#1a1f2e"), RIM = hex("#3b4460");
/** A stand-in poster, only with o.preview (renders and the playground), drawn behind. */
export function preview(p, o) {
  if (!o.preview) return;
  const { hw, hh } = dims(o);
  p.rect(-hw, -hh, hw * 2, hh * 2, POSTER);
  p.line(-hw, -hh, hw - 1, -hh, RIM);
  p.line(-hw, hh - 1, hw - 1, hh - 1, RIM);
  p.line(-hw, -hh, -hw, hh - 1, RIM);
  p.line(hw - 1, -hh, hw - 1, hh - 1, RIM);
}

/** Draw fn in a frame at local (x, y) turned by ang, then restore the painter's placement. */
export function nest(p, x, y, ang, fn) {
  const { tx, ty, fx, cs, sn } = p;
  const th = Math.atan2(sn, cs);
  p.place(p.toX(x, y), p.toY(x, y), fx < 0, th + ang * fx);
  fn();
  p.tx = tx; p.ty = ty; p.fx = fx; p.cs = cs; p.sn = sn;
}
