// Stacking order for layers inside the page, under the site header (z-[1000]) and the portaled dialogs above it.
// Tailwind reads these class names from this file, so keep each one a whole literal.
//
// A poster card is its own stacking context (CARD), so its pill, actions, and covers never reach the page: whatever
// z-index they use inside the card, the whole card stays under a sticky bar. Its popovers render in portals.

/** The poster card's root: a stacking context of its own. */
export const CARD = "isolate"

/** A card with its actions open, over the neighboring cards and still under sticky bars. */
export const CARD_RAISED = "z-10"

/** A bar that pins under the site header while the page scrolls, such as a page's tabs or its filter row. */
export const STICKY_BAR = "z-30"

/** A bar that pins right under another sticky bar, such as a tab's filter row under the tabs: below that bar. */
export const STICKY_SUBBAR = "z-20"
