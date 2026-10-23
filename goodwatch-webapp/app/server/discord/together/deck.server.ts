import type { DeckPlace, SessionMeta } from "./store.server.ts"
import type { GuestTitle } from "../cards.ts"
import { isTitleId } from "../custom-id.ts"
export async function deckCandidates(meta: SessionMeta): Promise<string[]> {
	const [
		{ filterTitles },
		{ guestContext },
		{ defaultFilterState },
		{ parseTitleKey },
	] = await Promise.all([
		import("../../title-filter/index.server"),
		import("../../viewer.server"),
		import("../../../domain/filter-state.ts"),
		import("../../../utils/title-key.ts"),
	])
	const { MOOD_KEYS } = await import("../../../domain/moods.ts")
	const mood = MOOD_KEYS.find((key) => key === meta.mood)
	const result = await filterTitles({
		universe: "catalog",
		sort: "popular",
		taste: null,
		forYou: null,
		viewer: guestContext(
			{
				interactions: [],
				country: meta.place.country,
				services: meta.place.services,
			},
			meta.place.country,
		),
		state: {
			...defaultFilterState({ onMyServices: false, notSeenYet: false }),
			type: meta.type === "any" ? "all" : meta.type,
			moods: mood ? [mood] : [],
			anyService: !meta.place.services.length,
			services: meta.place.services,
		},
	})
	// Read beyond the current deck and skip it; popularity changes cannot reorder existing titles.
	return result.keys
		.map((key) => {
			const { mediaType, tmdbId } = parseTitleKey(key)
			return `${mediaType}:${tmdbId}`
		})
		.filter((id) => !meta.deck.includes(id))
		.slice(0, 31)
}
/** Guest-only presentation: linked members get exactly the same deck and title information. */
export async function togetherTitle(
	id: string,
	place: DeckPlace,
): Promise<GuestTitle> {
	if (!isTitleId(id)) throw new Error("Invalid title")
	const { readGuestTool } = await import("../../mcp/guest.server.ts")
	const result = await readGuestTool(
		place,
		"https://goodwatch.app",
		"get_title",
		{ title_id: id },
	)
	const title = result.title as GuestTitle | undefined
	if (!title) return { id, name: "Title unavailable", year: null }
	// Canonical details strip videos down to keys, so check the catalog's official flag here.
	const { query } = await import("../../../utils/crate")
	const [kind, tmdbId] = id.split(":")
	const videos = await query<{ site_key: string }>(
		`SELECT site_key FROM media_video WHERE media_type = '${kind}' AND media_tmdb_id = ${Number(
			tmdbId,
		)}
		 AND video_type = 'Trailer' AND official = true AND site = 'YouTube'
		 ORDER BY published_at DESC LIMIT 1`,
	).catch(() => [])
	const key = videos[0]?.site_key
	return {
		...title,
		trailer_url:
			key && /^[\w-]{11}$/.test(key)
				? `https://www.youtube.com/watch?v=${key}`
				: null,
	}
}
