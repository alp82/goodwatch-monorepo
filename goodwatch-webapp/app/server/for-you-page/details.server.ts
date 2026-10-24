import type { ForYouDetail } from "~/domain/for-you-page/contract"
import { overlayTitles } from "~/server/media-overlay.server"
import type { Taste } from "~/server/taste/index.server"
import { getTitleCards } from "~/server/title-cards.server"
import { createDisplayMemory } from "~/server/title-display-memory.server"
import type { ViewerContext } from "~/server/viewer.server"
import { query } from "~/utils/crate"
import { type TitleKey, parseTitleKey } from "~/utils/title-key"

const memory = createDisplayMemory<{ overview: string | null }>({
	ttlMs: 6 * 60 * 60_000,
})

/** Canonical overviews cached in process; at most one Crate primary-key read per media type. */
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
		getTitleCards(keys, { ...ctx, language: undefined }, taste),
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
		localized.map((card) => {
			const { mediaType, tmdbId } = parseTitleKey(card.key)
			return [
				`${mediaType}-${tmdbId}`,
				{
					runtime: card.runtime,
					backdrop: card.backdrop_path,
					overview: card.overview,
					tagline: card.tagline,
					services: card.services,
					title: card.title,
					poster: card.poster_path,
				},
			]
		}),
	)
	console.info(
		`For you details: ${cards.length} titles, computed in ${Math.round(performance.now() - started)} ms`,
	)
	return result
}
