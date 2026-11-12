/**
 * Geometry of the live faces row in the voting bar. Pure numbers (no React Native), so the fit at
 * small widths and large font scales is unit tested.
 *
 * The row's width depends only on the bar's width and the font scale, never on how many people are
 * in the room: a person joining or leaving moves nothing next to it.
 */

/** Faces overlap: each one starts this share of a face after the previous one. */
export const FACE_STEP = 0.72;
/** Most faces the bar ever shows; the rest are counted in "+N". */
export const MAX_FACES = 4;

/** Room for "+N" (12 px text, up to "+99") after the faces; grows with the font scale. */
export function moreSlot(fontScale = 1) {
  return Math.ceil(6 + 22 * Math.max(1, fontScale));
}

/** Width the faces row always takes for `slots` faces and "+N". */
export function liveFacesWidth(size: number, slots: number, fontScale = 1) {
  return size + (slots - 1) * size * FACE_STEP + moreSlot(fontScale);
}

/** Where face `index` of `shown` sits, from the row's start edge (faces end against "+N" when there is one). */
export function faceOffset(size: number, slots: number, fontScale: number, shown: number, index: number, more: boolean) {
  const end = liveFacesWidth(size, slots, fontScale) - (more ? moreSlot(fontScale) : 0);
  return end - size - (shown - 1 - index) * size * FACE_STEP;
}

/** Where "+N" starts, from the row's start edge. */
export function moreOffset(size: number, slots: number, fontScale: number) {
  return liveFacesWidth(size, slots, fontScale) - moreSlot(fontScale) + 5;
}

/**
 * Width of the Matches chip for a label of `chars` characters: 12 px padding each side, 1 px border,
 * the 15 px icon, a 6 px gap and bold 14 px text (Gabarito, about 0.56 em per character).
 */
export function matchesChipWidth(z: (n: number) => number, fontScale: number, chars: number) {
  return 24 + 2 + z(15) + 6 + Math.ceil(z(14) * Math.max(1, fontScale) * 0.56 * chars);
}

/** The longest full label the chip plans for ("10 matches") and its compact form (the count only, "10"). */
const FULL_LABEL = 10;
const COMPACT_LABEL = 2;

export interface VotingBarFit {
  /** Face slots the row reserves (1 to MAX_FACES); people beyond them are counted in "+N". */
  slots: number;
  /** The row's fixed width. */
  facesWidth: number;
  /** The chip shows the icon and the count only: the full label would not fit next to one face. */
  compactChip: boolean;
}

/**
 * How the voting bar shares its width: the Matches chip, the faces row and Undo (`undo` wide), with
 * `gap` between them. The chip keeps room for a two-digit "10 matches"; the faces get what's left,
 * up to four. When even one face doesn't fit beside the full label (narrow phones at a large font
 * scale), the chip drops the word.
 */
export function votingBarFit({ rowWidth, size, fontScale, z, undo, gap }: {
  rowWidth: number;
  size: number;
  fontScale: number;
  z: (n: number) => number;
  undo: number;
  gap: number;
}): VotingBarFit {
  const fits = (chip: number) => {
    const room = rowWidth - undo - 2 * gap - chip - size - moreSlot(fontScale);
    return room < 0 ? 0 : Math.min(MAX_FACES, Math.floor(room / (size * FACE_STEP) + 1e-6) + 1);
  };
  const full = fits(matchesChipWidth(z, fontScale, FULL_LABEL));
  const compactChip = full === 0;
  const slots = Math.max(1, compactChip ? fits(matchesChipWidth(z, fontScale, COMPACT_LABEL)) : full);
  return { slots, facesWidth: liveFacesWidth(size, slots, fontScale), compactChip };
}
