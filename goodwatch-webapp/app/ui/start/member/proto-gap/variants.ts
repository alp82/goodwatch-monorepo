// PROTOTYPE (branch prototype/member-start-gap, never main): ways to use a tall screen's spare height under a
// member's "this or that", switchable with `?gap=a..e`, and the member shelf rule (Watch next movies, else shows to
// continue, else For you). `?shelf=old` shows the old shelf (everyone's start titles) for comparison.
import type { ShelfTitle } from "../../room/ShelfCovers"
import type { MemberStartData } from "../member-data"

export const GAP_VARIANTS = [
	{ key: "a", name: "Now (baseline)" },
	{ key: "b", name: "Fit: Go deeper right under the card" },
	{ key: "c", name: "Card grows: bigger this or that" },
	{ key: "d", name: "Room fills the screen" },
	{ key: "e", name: "Go deeper in the room, floor extends" },
] as const

export type GapKey = (typeof GAP_VARIANTS)[number]["key"]

export const gapOf = (value: string | null): GapKey =>
	GAP_VARIANTS.some((v) => v.key === value) ? (value as GapKey) : "a"

/** The phone shelf has 16 cases, the desktop shelf 11. */
const SHELF_SLOTS = 16

/**
 * A member's shelf: Watch next's movies (the Wishlist in My movies' order), or the shows to continue when there are no
 * movies, or For you when there are neither. Free cases take the next lists' titles, then everyone's start titles.
 */
export function memberShelf(
	data: MemberStartData,
	fallback: readonly ShelfTitle[],
): { titles: ShelfTitle[]; source: string } {
	const movies = data.wishlist?.titles ?? []
	const shows = (data.continue?.titles ?? []).map((row) => row.card)
	const forYou = data.forYou?.titles ?? []
	const source = movies.length
		? "Watch next movies"
		: shows.length
			? "Shows to continue"
			: forYou.length
				? "For you"
				: "Start titles"
	const seen = new Set<string>()
	const titles: ShelfTitle[] = []
	for (const t of [...movies, ...shows, ...forYou, ...fallback]) {
		const id = `${t.media_type}:${t.tmdb_id}`
		if (!t.poster_path || seen.has(id)) continue
		seen.add(id)
		titles.push(t)
		if (titles.length === SHELF_SLOTS) break
	}
	return { titles, source }
}
