// Types for show.js. Written by scripts/vendor-footer-cinema-fx.mjs.
import type { FxModule } from "./core/index.js"

export type FxId =
	| "cinema-show/beam"
	| "cinema-show/room-palace"
	| "cinema-show/film-gate"
	| "cinema-show/silence-phone"
	| "cinema-show/leader"
	| "cinema-show/ident-a"
	| "cinema-show/trailer-chase"
	| "cinema-show/ident-b"
	| "cinema-show/trailer-space"
	| "cinema-show/ident-c"
	| "cinema-show/trailer-monster"
	| "cinema-show/after-credits"
	| "cinema-show/after-credits-end"

/** Effect modules; some export timing helpers too (the palace's curtainAt). */
export const FX: Record<FxId, FxModule & Record<string, unknown>>
