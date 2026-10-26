/** Approved shape and layout scale shared by every YepWatch screen. */
export const R = { stamp: 4, control: 10, card: 14 } as const;
/** Subheader and every bottom action row share one column so their edges line up exactly. */
export const COLUMN = { maxWidth: 720, inset: 16 } as const;
export const column = { width: '100%', maxWidth: COLUMN.maxWidth, alignSelf: 'center', paddingHorizontal: COLUMN.inset } as const;
/** Invisible bounds on large windows: no border or panel, only a centered maximum size. */
export const FRAME = { maxWidth: 1120, maxHeight: 920 } as const;
/** Stamps on swipe cards: square-ish corners with a black outline so they read on any poster. */
export const stampStyle = { borderRadius: R.stamp, borderWidth: 2, borderColor: '#000' } as const;
