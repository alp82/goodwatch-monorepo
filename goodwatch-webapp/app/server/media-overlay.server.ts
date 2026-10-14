import { query } from "../utils/crate.ts"
import { cached } from "../utils/cache.ts"
import { createMediaOverlay } from "../utils/media-overlay-core.ts"
export * from "../utils/media-overlay-core.ts"
export const MEDIA_OVERLAY_VERSION = "media-overlay-v1"

export const overlayTitles = createMediaOverlay(query, (params, get) =>
	cached({
		name: MEDIA_OVERLAY_VERSION,
		params,
		target: get,
		ttlMinutes: 30,
		staleMinutes: 0,
	}),
)
