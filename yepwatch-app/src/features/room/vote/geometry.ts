/**
 * Voting stage geometry: one card size and position for every look, and the display words' widths
 * for fitting YEP, NOPE and MATCH to a width. Stage coordinates: x 0…aw (the content column),
 * y 0…stageH; `ext` is the gutter between the column and the window edge, where looks may paint.
 */
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
  /** Content column width and the window width. */
  aw: number;
  vw: number;
  /** Column edge to window edge. */
  ext: number;
  stageH: number;
  cardTop: number;
  /** Card center (y). */
  cy: number;
  phone: boolean;
  z: (n: number) => number;
}

export interface StageGeometry extends Geo {
  /** Drag distance where a release commits (a third of the card width). */
  threshold: number;
  /** How far a committed card flies. */
  off: number;
  /** Drag distance where the card behind has grown to full size. */
  lean: number;
}

/** The card as big as the stage allows (2:3), centered; capped on big windows. */
export function stageGeometry({ aw, stageH, vw, phone, z }: { aw: number; stageH: number; vw: number; phone: boolean; z: (n: number) => number }): StageGeometry {
  let h = Math.max(0, Math.min(stageH, phone ? 600 : z(720)));
  let w = h / 1.5;
  const maxW = Math.max(0, phone ? aw - 36 : Math.min(aw, vw * 0.34));
  if (w > maxW) {
    w = maxW;
    h = w * 1.5;
  }
  const cardTop = Math.max(0, (stageH - h) / 2);
  return {
    w, h, aw, vw, stageH, cardTop, phone, z,
    ext: Math.max(0, (vw - aw) / 2),
    cy: cardTop + h / 2,
    threshold: w * 0.33,
    off: Math.max(vw * 0.6, w * 1.4) + w,
    lean: Math.max(120, w * 0.5),
  };
}
