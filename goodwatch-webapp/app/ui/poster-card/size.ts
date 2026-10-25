// How big a poster card is, by its own width: S under 6.5rem (104 px), M from 6.5rem, L from 11rem (176 px). The card
// is an `@container/card`; its parts size themselves with container queries, so the server's HTML already has the
// right look. A part outside a card (the quick view) passes a fixed size.

export type CardSize = "S" | "M" | "L"

/** A fixed size, or "auto": follow the nearest `@container/card`. */
export type PartSize = CardSize | "auto"

/** The card's width in px for each size, for code that measures (the touch tiles). */
export const CARD_SIZE_MIN_PX = { M: 104, L: 176 } as const
