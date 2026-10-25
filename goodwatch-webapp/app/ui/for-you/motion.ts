// The motion and the one dim the page's drawers share (the recipe and print drawers): opacity only, no blur.
export const EASE_OUT = [0.22, 1, 0.36, 1] as const
export const DIM = "bg-black/70"
export const DIM_IN = { duration: 0.24, ease: EASE_OUT } as const
export const DIM_OUT = { duration: 0.2, ease: [0.4, 0, 0.6, 1] } as const
/** The drawers' motion, so the recipe and print drawers move alike. */
export const SHEET_IN = { type: "spring", stiffness: 330, damping: 34 } as const
export const SHEET_OUT = { duration: 0.28, ease: [0.4, 0, 0.9, 0.6] } as const
