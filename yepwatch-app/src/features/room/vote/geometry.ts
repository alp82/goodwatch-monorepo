/**
 * Voting stage geometry: one card size and position for every look, and the display words' widths
 * for fitting YEP, NOPE and MATCH to a width. Stage coordinates: x 0…aw (the content column),
 * y 0…stageH; `ext` is the gutter between the column and the window edge, where looks may paint.
 *
 * On desktop the stage may sit off center, with a question column to its right. Looks then paint in a window
 * centered on the card that reaches the farther screen edge (`vw`, `ext`), so backgrounds still cover the whole
 * screen, and they read `screen`, `column` and `words` to keep words on screen and clear of the column.
 */
import { backdropAt } from '../../glow/backdrop-colors';

export type VoteWord = 'YEP' | 'NOPE' | 'MATCH';

/** Gabarito Bold advance widths in em (from the font's hmtx). */
export const EM: Record<VoteWord, number> = { YEP: 1.722, NOPE: 2.564, MATCH: 3.465 };
/** Display words' letter spacing in em. */
export const TRACK = -0.03;
/** Gabarito Bold's baseline in a line box as tall as the font size (ascent 0.94, descent 0.26). */
export const BASELINE = 0.84;

/** The font size at which `word` is `width` wide. */
export const fitTo = (word: VoteWord, width: number) => width / (EM[word] + TRACK * word.length);
/** The width of `word` at `size`. */
export const wordW = (word: VoteWord, size: number) => (EM[word] + TRACK * word.length) * size;

export interface Geo {
  /** Card size. */
  w: number;
  h: number;
  /**
   * Content column width, and the width of a window centered on the card that reaches the farther screen edge
   * (the window itself when the stage is centered).
   */
  aw: number;
  vw: number;
  /** Column edge to the edge of that window. */
  ext: number;
  /** The stage is centered in the window with nothing beside it (phones, single column): looks paint as designed for that. */
  centered: boolean;
  /** The screen's left and right edges in stage x (the left one is 0 or less). */
  screen: { left: number; right: number };
  /** Where the question column to the right of the stage starts, in stage x; null without one. */
  column: number | null;
  /** The widest a word centered on the card may be: on screen and clear of the question column (`vw` when centered). */
  words: number;
  stageH: number;
  cardTop: number;
  /** Card center (y). */
  cy: number;
  phone: boolean;
  z: (n: number) => number;
  /** The backdrop behind the stage's soft top and bottom edges, once the stage is placed in its frame (web). */
  rim: Rim | null;
}

/** How far in from the stage's top and bottom its back layers fade out (a share of the stage height). */
export const EDGE = 0.06;
/**
 * The backdrop's own colors over the stage's soft edges, each strip opaque at the stage edge and clear `EDGE` in:
 * painted over a back layer they give the same picture as masking it to those edges, as long as only the backdrop
 * is behind it. Three stops per strip, so the backdrop's own gradient across the strip is kept.
 */
export interface Rim { top: readonly [string, string, string]; bottom: readonly [string, string, string] }

/** The rim of a stage `top` px down a frame `height` px tall (the backdrop spans the frame). */
export function stageRim(top: number, stageH: number, height: number): Rim | null {
  if (!(height > 0) || !(stageH > 0)) return null;
  const fade = stageH * EDGE;
  const at = (y: number, alpha: number) => `rgba(${backdropAt(y / height).map(Math.round).join(', ')}, ${alpha})`;
  const bottom = top + stageH;
  return {
    top: [at(top, 1), at(top + fade / 2, 0.5), at(top + fade, 0)],
    bottom: [at(bottom - fade, 0), at(bottom - fade / 2, 0.5), at(bottom, 1)],
  };
}

export interface StageGeometry extends Geo {
  /** Drag distance where a release commits (a third of the card width). */
  threshold: number;
  /** How far a committed card flies. */
  off: number;
  /** Drag distance where the card behind has grown to full size. */
  lean: number;
}

/** Where the stage sits in the window (desktop), in window x. */
export interface StagePlace {
  /** The stage's left edge. */
  left: number;
  /** The question column to the right of the stage, if the screen has one. */
  column?: { left: number; width: number } | null;
}

/** A stage that sits less than this far off center, with no column beside it, counts as centered. */
const CENTERED_SLACK = 1;

/**
 * The card as big as the stage allows (2:3), centered in the stage; capped on big windows. `place` (desktop)
 * says where the stage sits in the window; without it, on a phone, or when the stage is centered with no column,
 * the geometry is the centered one.
 */
export function stageGeometry({ aw, stageH, vw, phone, z, rim = null, place = null }: { aw: number; stageH: number; vw: number; phone: boolean; z: (n: number) => number; rim?: Rim | null; place?: StagePlace | null }): StageGeometry {
  let h = Math.max(0, Math.min(stageH, phone ? 600 : z(720)));
  let w = h / 1.5;
  const maxW = Math.max(0, phone ? aw - 36 : Math.min(aw, vw * 0.34));
  if (w > maxW) {
    w = maxW;
    h = w * 1.5;
  }
  const cardTop = Math.max(0, (stageH - h) / 2);
  const ext = Math.max(0, (vw - aw) / 2);
  const centered = phone || !place || (!place.column && Math.abs(place.left - ext) < CENTERED_SLACK);
  const reach = centered ? { vw, ext, screen: { left: -ext, right: aw + ext }, column: null, words: vw } : offCenter(aw, vw, z, place);
  return {
    w, h, aw, stageH, cardTop, phone, z, rim, centered, ...reach,
    cy: cardTop + h / 2,
    threshold: w * 0.33,
    off: Math.max(reach.vw * 0.6, w * 1.4) + w,
    lean: Math.max(120, w * 0.5),
  };
}

/** The looks' window for a stage `place.left` px from the window's left edge, its card at the stage's center. */
function offCenter(aw: number, vw: number, z: (n: number) => number, place: StagePlace) {
  const screen = { left: -place.left, right: vw - place.left };
  const cx = aw / 2;
  const half = Math.max(cx - screen.left, screen.right - cx);
  const column = place.column ? place.column.left - place.left : null;
  const clear = Math.min(column ?? screen.right, screen.right);
  return {
    vw: 2 * half,
    ext: half - cx,
    screen,
    column,
    words: Math.max(0, 2 * Math.min(cx - screen.left, clear - cx) - 2 * z(20)),
  };
}
