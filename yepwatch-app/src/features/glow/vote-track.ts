/**
 * Geometry of the voting bar's progress track. Pure numbers (no React Native), so placement can be tested
 * in Node. Everyone's face sits at the share of the dealt cards they've answered; faces at the same place
 * overlap instead of hiding each other, and a crowd at the finish backs up from the end.
 */

/** Faces at the same place overlap: each one starts this share of a face after the previous one. */
export const TRACK_STEP = 0.6;
/** Room after the track for the deck's size ("20", up to "120"); grows with the font scale. */
export const trackLabelWidth = (fontScale = 1) => Math.ceil(34 * Math.max(1, fontScale));

export interface TrackRider {
  id: string;
  self: boolean;
  /** Cards of the dealt deck this person has answered. */
  answered: number;
}

/** A person's share of the deck: 0 with no cards dealt, never past the end. */
export const trackShare = (answered: number, dealt: number) => (dealt > 0 ? Math.min(1, Math.max(0, answered) / dealt) : 0);

/**
 * Where each face's start edge sits along `span` (0 = start of the track, `span` = the finish), and the
 * order to draw them in (furthest last, you on top of anyone you share a place with).
 */
export function placeRiders<T extends TrackRider>(riders: T[], dealt: number, span: number, size: number) {
  // A crowd too big for the track overlaps more, so no face is pushed before the start.
  const step = Math.min(size * TRACK_STEP, riders.length > 1 ? span / (riders.length - 1) : Infinity);
  const order = [...riders].sort((a, b) => trackShare(a.answered, dealt) - trackShare(b.answered, dealt) || Number(a.self) - Number(b.self));
  const at = new Map<string, number>();
  let last = -Infinity;
  for (const r of order) {
    const x = Math.max(trackShare(r.answered, dealt) * span, last + step);
    at.set(r.id, x);
    last = x;
  }
  // Pushed past the finish: back the crowd up from the end, keeping one overlap step between faces.
  let limit = span;
  for (const r of [...order].reverse()) {
    const x = at.get(r.id)!;
    if (x <= limit) break;
    at.set(r.id, limit);
    limit -= step;
  }
  return { at, order };
}
