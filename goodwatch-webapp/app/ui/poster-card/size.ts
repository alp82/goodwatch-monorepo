// A part's look: S, M or L for a part outside a card (the quick view, list rows), or "auto" inside a poster card. The
// card is an `@container/card`; its parts size and trim themselves by its width with container queries, so the
// server's HTML already has the right look (the steps are in MovieTvCard.tsx: 4.5, 6, 6.5, 7.5, 8 and 11rem).

export type CardSize = "S" | "M" | "L"

/** A fixed size, or "auto": follow the nearest `@container/card`. */
export type PartSize = CardSize | "auto"

/** The card's width in px for each size, for code that measures (the touch tiles). */
export const CARD_SIZE_MIN_PX = { M: 104, L: 176 } as const
