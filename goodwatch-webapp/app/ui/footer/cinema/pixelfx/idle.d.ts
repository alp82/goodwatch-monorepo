// Types for idle.js. Written by scripts/vendor-footer-cinema-fx.mjs.
import type { FxModule } from "./core/index.js"

export type FxId =
	| "cinema-show/projector-35mm"

/** Effect modules; some export timing helpers too (the palace's curtainAt). */
export const FX: Record<FxId, FxModule & Record<string, unknown>>
