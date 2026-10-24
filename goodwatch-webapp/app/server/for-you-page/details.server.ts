import type { ForYouDetail } from "~/domain/for-you-page/contract"
import { overlayTitles } from "~/server/media-overlay.server"
import type { Taste } from "~/server/taste/index.server"
import { getTitleCards } from "~/server/title-cards.server"
import { createDisplayMemory } from "~/server/title-display-memory.server"
import type { ViewerContext } from "~/server/viewer.server"
import { query } from "~/utils/crate"
import { type TitleKey, parseTitleKey } from "~/utils/title-key"
import { publicKey } from "./pool.server"

const memory = createDisplayMemory<{ overview: string | null }>({
	ttlMs: 6 * 60 * 60_000,
})
const cacheKey = (key: number) => `for-you-overview:v1:${key}`

/** Canonical overviews; at most one primary-key statement per media type. */
export async function readOverviews(
	keys: TitleKey[],
): Promise<Map<TitleKey, string | null>> {
	if (keys.length > 12) throw new RangeError("At most 12 titles")
	const found = new Map<TitleKey, string | null>()
	const missing = [...new Set(keys)].filter((key) => {
		const hit = memory.get(key)
		if (!hit) return true
		found.set(key, hit.overview)
		return false
	})
	if (!missing.length) return found
	// Cache reads only: this feature adds no data-store writes.
	const { getRedisCluster, withRedisDeadline } = await import("~/utils/cache")
	const redis = await getRedisCluster()
	if (redis)
		await Promise.all(
			missing.map(async (key) => {
				const raw = await withRedisDeadline(redis.get(cacheKey(key))).catch(
					() => null,
				)
				if (!raw) return
				try {
					const value: unknown = JSON.parse(raw)
					if (value === null || typeof value === "string") {
						found.set(key, value)
						memory.set(key, { overview: value })
					}
				} catch {
					/* A malformed entry is a miss. */
				}
			}),
		)
	for (const mediaType of ["movie", "show"] as const) {
		const batch = missing.filter(
			(key) => !found.has(key) && parseTitleKey(key).mediaType === mediaType,
		)
		if (!batch.length) continue
		const rows = await query<{ tmdb_id: number; overview: string | null }>(
			`SELECT tmdb_id, synopsis AS overview FROM ${mediaType} WHERE tmdb_id = ANY(?)`,
			[batch.map((key) => parseTitleKey(key).tmdbId) as never],
		)
		const byId = new Map(rows.map((row) => [Number(row.tmdb_id), row.overview]))
		for (const key of batch) {
			const overview = byId.get(parseTitleKey(key).tmdbId) ?? null
			found.set(key, overview)
			memory.set(key, { overview })
		}
	}
	return found
}

export async function getForYouDetails(
	ctx: ViewerContext,
	taste: Taste,
	keys: TitleKey[],
): Promise<Record<string, ForYouDetail>> {
	if (keys.length > 12) throw new RangeError("At most 12 titles")
	const started = performance.now()
	const [cards, overviews] = await Promise.all([
		getTitleCards(keys, ctx, taste),
		readOverviews(keys),
	])
	const canonical = cards.map((card) => ({
		...card,
		overview: overviews.get(card.key) ?? null,
	}))
	const localized = ctx.language
		? await overlayTitles(canonical, ctx.language)
		: canonical
	const result = Object.fromEntries(
		localized.map((card) => [
			publicKey(card.key),
			{
				runtime: card.runtime,
				backdrop: card.backdrop_path,
				overview: card.overview,
				tagline: card.tagline,
				services: card.services,
				title: card.title,
				poster: card.poster_path,
			},
		]),
	)
	console.info(
		`For you details: ${cards.length} titles, computed in ${Math.round(performance.now() - started)} ms`,
	)
	return result
}
