// The Similar shelf's titles from a title's related map pack: its nearest titles, most similar first, with the fields
// a poster card shows (the title cards display cache). The title page's loader turns the pack it already looked up
// into the shelf, so the shelf is in the server's HTML; /api/title-more-like-this?part=similar does the same for a
// pack the page didn't have in time.
import type { RelatedMapLookup } from "~/server/related-map.server"
import { getDisplayFields } from "~/server/title-cards.server"
import type { RawPack } from "~/ui/related-map/engine"
import { type ShelfTitle, nearestKeys } from "./shelf-data"

/** The shelf's titles for a pack, or none for a title without one. `language`: the page's presentation language. */
export async function similarShelfTitles(
	pack: RawPack | null,
	type: "movie" | "show",
	id: number,
	language?: string,
): Promise<ShelfTitle[]> {
	if (!pack) return []
	const keys = nearestKeys(pack, type, id)
	if (!keys.length) return []
	const fields = await getDisplayFields(keys, language)
	return keys.flatMap((k) => {
		const d = fields.get(k)
		if (!d) return []
		return [
			{
				type: d.media_type,
				tmdbId: d.tmdb_id,
				title: d.title,
				year: d.release_year,
				poster: d.poster_path,
				goodwatch: d.goodwatch_overall_score_normalized_percent,
			},
		]
	})
}

/**
 * The shelf for a title page's loader, from the related map lookup it already ran: the titles, an empty list for a
 * title without related titles, or undefined when the lookup ran late or the cards failed (the shelf then asks the
 * API from the browser).
 */
export async function similarShelfFromLookup(
	lookup: RelatedMapLookup,
	type: "movie" | "show",
	id: number,
	language?: string,
): Promise<ShelfTitle[] | undefined> {
	if (lookup === "late") return undefined
	if (lookup === "none") return []
	try {
		return await similarShelfTitles(lookup, type, id, language)
	} catch (error) {
		console.error("Similar shelf failed", error)
		return undefined
	}
}

/**
 * The shelf for a title page's loader, from its related map lookup, waited for `budgetMs` at most once the lookup is
 * in (the cards are one more read). Undefined when the lookup or the cards ran late or failed.
 */
export async function similarShelfWithin(
	lookup: Promise<RelatedMapLookup>,
	type: "movie" | "show",
	id: number,
	budgetMs: number,
	language?: string,
): Promise<ShelfTitle[] | undefined> {
	let found: RelatedMapLookup
	try {
		found = await lookup
	} catch {
		return undefined
	}
	let timer: ReturnType<typeof setTimeout> | undefined
	return Promise.race([
		similarShelfFromLookup(found, type, id, language),
		new Promise<undefined>((resolve) => {
			timer = setTimeout(() => resolve(undefined), budgetMs)
		}),
	]).finally(() => clearTimeout(timer))
}
