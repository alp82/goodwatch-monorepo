import { query } from "../utils/crate.ts"
import { getRedisCluster, withRedisDeadline } from "../utils/cache.ts"
import {
	createMediaOverlay,
	type Sources,
} from "../utils/media-overlay-core.ts"
import { createLocaleSourceCache } from "./locale-source-cache.server.ts"
export * from "../utils/media-overlay-core.ts"
export const MEDIA_OVERLAY_VERSION = "media-overlay-title-v3"
export const MEDIA_SOURCE_MAX_BYTES = 64 * 1024
const sources = createLocaleSourceCache<Sources>(getRedisCluster, {
	namespace: MEDIA_OVERLAY_VERSION,
	deadline: withRedisDeadline,
	maxValueBytes: MEDIA_SOURCE_MAX_BYTES,
	validate: (value): value is Sources =>
		!!value &&
		typeof value === "object" &&
		["canonical", "translations", "posters"].every((key) => {
			const rows = (value as Record<string, unknown>)[key]
			return (
				Array.isArray(rows) &&
				rows.every(
					(row) =>
						!!row &&
						typeof row === "object" &&
						(row.media_type === "movie" || row.media_type === "show") &&
						Number.isSafeInteger(row.tmdb_id ?? row.media_tmdb_id) &&
						(key === "canonical" || typeof row.language_code === "string") &&
						(key !== "translations" || typeof row.country_code === "string") &&
						(key !== "posters" || typeof row.url_path === "string"),
				)
			)
		}),
})
export const overlayTitles = createMediaOverlay(query, sources)

export const resetMediaOverlayCacheForTest = () => sources.clear()
