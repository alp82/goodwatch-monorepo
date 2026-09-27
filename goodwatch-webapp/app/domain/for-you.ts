// For you: the switch that blends taste match into whichever sort is chosen. It never replaces the sort; it lets titles
// the person would like rise within it. Pure and shared by the server and the browser, so the order and the "↑N moved"
// count the browser shows agree with what the server returned.
//
// Both rules work on where the title falls in the person's own range: the percentile behind the taste match
// (match = round(50 + 0.49 * percentile)), 0 to 100, and 50 for a title without a match.
// - Browse: over the first FOR_YOU_WINDOW titles of the plain order, a title at plain index i scores
//   0.4 * (1 - i / FOR_YOU_WINDOW) + 0.6 * (percentile / 100). Titles beyond the window keep their plain order after it.
// - Search: relevance stays in charge. A title at plain index i scores -(i - 3 * lean), lean = (percentile - 50) / 50,
//   over the whole ranked list, so a title moves at most SEARCH_MAX_MOVE places.
// Ties keep the plain order. A change to either rule changes what people see: keep the browser and server on one copy.

export const FOR_YOU_WINDOW = 400
/** On a search, For you moves a title at most this many places up or down. */
export const SEARCH_MAX_MOVE = 5

const BROWSE_ORDER_WEIGHT = 0.4
const BROWSE_TASTE_WEIGHT = 0.6
const MISSING_PERCENTILE = 50
// Half of the largest shift each way: two titles 6 places apart can at best tie, and a tie keeps the plain order.
const SEARCH_LEAN_PLACES = 3

export type ForYouSurface = "browse" | "search"

export interface ForYouRanking<T> {
	/** The items in the For you order. */
	order: T[]
	/** Per item of `order`: its plain index minus its new index. Positive means it moved up. */
	moved: number[]
	/** How many items moved up: the "↑N moved" count. */
	movedUp: number
}

/** The percentile (0 to 100) behind a taste match (50 to 99). */
const percentileOf = (match: number | null | undefined) =>
	match == null
		? MISSING_PERCENTILE
		: Math.max(0, Math.min(100, (match - 50) / 0.49))

/**
 * Reorders items that are already in their plain order (the chosen sort) by For you. `matches[i]` is the taste match
 * (50 to 99) of `items[i]`, or null without one.
 */
export function rankForYou<T>(
	items: readonly T[],
	matches: readonly (number | null | undefined)[],
	surface: ForYouSurface,
): ForYouRanking<T> {
	const n =
		surface === "browse" ? Math.min(items.length, FOR_YOU_WINDOW) : items.length
	const scores = new Float64Array(n)
	for (let i = 0; i < n; i++) {
		const percentile = percentileOf(matches[i])
		scores[i] =
			surface === "browse"
				? BROWSE_ORDER_WEIGHT * (1 - i / FOR_YOU_WINDOW) +
					BROWSE_TASTE_WEIGHT * (percentile / 100)
				: -(i - SEARCH_LEAN_PLACES * ((percentile - 50) / 50))
	}
	const reordered = Array.from({ length: n }, (_, i) => i).sort(
		(a, b) => scores[b] - scores[a] || a - b,
	)
	const order: T[] = new Array(items.length)
	const moved: number[] = new Array(items.length).fill(0)
	let movedUp = 0
	for (let j = 0; j < n; j++) {
		const i = reordered[j]
		order[j] = items[i]
		moved[j] = i - j
		if (i > j) movedUp++
	}
	for (let i = n; i < items.length; i++) order[i] = items[i]
	return { order, moved, movedUp }
}
