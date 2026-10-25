// Where you part ways, as two lists of the same length: genres and traits, each with its warmest and coldest gaps.
// Pure, for the Taste page's You vs everyone.

/** A gap as the everyone view gives it: a genre name or a fingerprint key, the gap on the 1 to 10 scale. */
export interface Gap {
	id: string
	name: string
	delta: number
}

export interface GapRow {
	id: string
	label: string
	emoji?: string
	delta: number
}

/** TV genres that merge movie genres: the movie genres they cover. */
const TV_PAIRS: Record<string, string[]> = {
	"Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
	"Action & Adventure": ["Action", "Adventure"],
	"War & Politics": ["War"],
}
const TV_ONLY = new Set([
	...Object.keys(TV_PAIRS),
	"Kids",
	"Soap",
	"Talk",
	"News",
	"Reality",
])
const MOVIE_WORD: Record<string, string> = { "Science Fiction": "Sci-fi" }

/** Honest genre names: a TV-only genre says shows; a movie genre says movies when its TV twin is in the list too. */
export function genreLabel(id: string, ids: ReadonlySet<string>): string {
	if (TV_ONLY.has(id))
		return `${id.charAt(0)}${id.slice(1).toLowerCase()} shows`
	const twin = Object.entries(TV_PAIRS).some(
		([tv, movies]) => ids.has(tv) && movies.includes(id),
	)
	return twin ? `${MOVIE_WORD[id] ?? id} movies` : id
}

/** Up to `n` rows, taken in turns from the warmest and the coldest end; warmest first. */
export function evenEnds<T extends { delta: number }>(
	rows: T[],
	n: number,
): T[] {
	const warm = rows.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta)
	const cold = rows.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta)
	const picked: T[] = []
	for (
		let i = 0;
		picked.length < n && (i < warm.length || i < cold.length);
		i++
	) {
		if (i < warm.length) picked.push(warm[i])
		if (picked.length < n && i < cold.length) picked.push(cold[i])
	}
	return picked.sort((a, b) => b.delta - a.delta)
}

/**
 * The genre and trait lists at the same length (the shorter one's, unless it is empty), and the largest gap shown, for
 * one scale across both.
 */
export function gapLists(
	genres: Gap[],
	traits: Gap[],
	attribute: (key: string) => { label: string; emoji: string } | null,
) {
	const ids = new Set(genres.map((g) => g.id))
	const genreRows: GapRow[] = genres
		.filter((g) => g.delta !== 0)
		.map((g) => ({ id: g.id, label: genreLabel(g.id, ids), delta: g.delta }))
	const traitRows: GapRow[] = traits
		.filter((g) => g.delta !== 0)
		.map((g) => {
			const a = attribute(g.id)
			return {
				id: g.id,
				label: a?.label ?? g.name,
				emoji: a?.emoji,
				delta: g.delta,
			}
		})
	const n =
		genreRows.length && traitRows.length
			? Math.min(genreRows.length, traitRows.length)
			: Math.max(genreRows.length, traitRows.length)
	const shown = {
		genres: evenEnds(genreRows, n),
		traits: evenEnds(traitRows, n),
	}
	const max = Math.max(
		0.1,
		...[...shown.genres, ...shown.traits].map((g) => Math.abs(g.delta)),
	)
	return { ...shown, max }
}
