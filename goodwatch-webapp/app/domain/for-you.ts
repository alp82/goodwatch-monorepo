// For you: the switch that blends taste match into whichever sort is chosen. It never replaces the sort; it lets titles
// the person would like rise within it. Pure and shared by the server and the browser, so the order and the "↑N moved"
// count the browser shows agree with what the server returned.
//
// Both rules work on where the title falls in the person's own range: the percentile behind the taste match
// (match = round(50 + 0.49 * percentile)), 0 to 100.
// - Browse: every title of the plain order takes part. A title at plain index i lands at the effective position
//   i * (1 - lift), and the titles are sorted by it. The lift (browseLift) is 0 up to the match of
//   BROWSE_LIFT_START (79), rises with the match from there, and is 1 from the match of BROWSE_LIFT_FULL (98): a 90
//   lands at about 0.42 of its position, a 95 at about 0.16, and a 98 or 99 goes to the very top. Only liftable
//   titles get a lift: the server passes the titles with a GoodWatch score of at least BROWSE_QUALITY_FLOOR, because
//   taste match says nothing about how good a title is. A title without a match gets none. Nothing is pushed down
//   by its match; titles only fall behind the ones that rose.
// - Search: relevance stays in charge. A title at plain index i scores -(i - 3 * lean), lean = (percentile - 50) / 50
//   (0 for a title without a match), over the whole ranked list, so a title moves at most SEARCH_MAX_MOVE places.
// Ties keep the plain order, so the titles with the full lift keep the sort's order among themselves; in browse, a
// lifted title that lands exactly on the place of a title that stayed goes before it. A change to either rule changes
// what people see: keep the browser and server on one copy.

/** Browse: the percentile up to which a title gets no lift. Its match is 79. */
export const BROWSE_LIFT_START = 60
/** Browse: the percentile from which a title goes to the top. Its match is 98. */
export const BROWSE_LIFT_FULL = 98
/** Browse: the curve between the two; 1 is a straight line, more than 1 keeps the middle matches lower. */
export const BROWSE_LIFT_EXPONENT = 1
/** Browse: a title needs a known GoodWatch score of at least this to get a lift. */
export const BROWSE_QUALITY_FLOOR = 60
/** On a search, For you moves a title at most this many places up or down. */
export const SEARCH_MAX_MOVE = 5

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

/**
 * The browse rule's curve, for tuning it (the dev page /dev/for-you). Everything defaults to the constants above, which
 * are what the server and Discover use.
 */
export interface BrowseLiftOptions {
	/** The percentile up to which a title gets no lift. */
	start?: number
	/** The percentile from which a title goes to the top. */
	full?: number
	/** The curve between the two. */
	exponent?: number
}

/** The percentile (0 to 100) behind a taste match (50 to 99). */
const percentileOf = (match: number | null | undefined) =>
	!match ? MISSING_PERCENTILE : Math.max(0, Math.min(100, (match - 50) / 0.49))

/** The taste match (50 to 99) shown for a percentile. */
const matchOf = (percentile: number) =>
	Math.round(50 + 0.49 * Math.max(0, Math.min(100, percentile)))

/**
 * The two ends of the browse lift as the taste matches a person sees: up to `start` a title stays, from `full` it goes
 * to the top. What the explanation quotes, so its numbers follow the constants.
 */
export const browseLiftRange = (options: BrowseLiftOptions = {}) => ({
	start: matchOf(options.start ?? BROWSE_LIFT_START),
	full: matchOf(options.full ?? BROWSE_LIFT_FULL),
})

/**
 * Browse: how much of its plain position a title with this taste match (50 to 99) gives up, 0 (stays) to 1 (goes to
 * the top). The lift goes by the match the person sees, so the two ends are the matches of BROWSE_LIFT_START and
 * BROWSE_LIFT_FULL.
 */
export function browseLiftOfMatch(
	match: number | null | undefined,
	options: BrowseLiftOptions = {},
): number {
	if (!match) return 0
	const { start, full } = browseLiftRange(options)
	// Ends that meet or cross leave a step: nothing up to the start, everything past it.
	if (full <= start) return match > start ? 1 : 0
	const t = Math.max(0, Math.min(1, (match - start) / (full - start)))
	return t ** (options.exponent ?? BROWSE_LIFT_EXPONENT)
}

/** Browse: the lift of a title at this percentile (0 to 100) of the person's range. See browseLiftOfMatch. */
export const browseLift = (
	percentile: number,
	options?: BrowseLiftOptions,
): number => browseLiftOfMatch(matchOf(percentile), options)

/**
 * Reorders items that are already in their plain order (the chosen sort) by For you. `matches[i]` is the taste match
 * (50 to 99) of `items[i]`, or null (or 0) without one. `liftable[i]` says whether browse may lift `items[i]` (the quality
 * floor); without it every item with a match may. Search ignores it. `options` tunes the browse curve.
 */
export function rankForYou<T>(
	items: readonly T[],
	matches: ArrayLike<number | null | undefined>,
	surface: ForYouSurface,
	liftable?: ArrayLike<boolean | number>,
	options?: BrowseLiftOptions,
): ForYouRanking<T> {
	const n = items.length
	const reordered =
		surface === "browse"
			? browseOrder(n, matches, liftable, options)
			: searchOrder(n, matches)
	const order: T[] = new Array(n)
	const moved: number[] = new Array(n)
	let movedUp = 0
	for (let j = 0; j < n; j++) {
		const i = reordered[j]
		order[j] = items[i]
		moved[j] = i - j
		if (i > j) movedUp++
	}
	return { order, moved, movedUp }
}

function searchOrder(
	n: number,
	matches: ArrayLike<number | null | undefined>,
): number[] {
	const scores = new Float64Array(n)
	for (let i = 0; i < n; i++)
		scores[i] = -(
			i -
			SEARCH_LEAN_PLACES * ((percentileOf(matches[i]) - 50) / 50)
		)
	return Array.from({ length: n }, (_, i) => i).sort(
		(a, b) => scores[b] - scores[a] || a - b,
	)
}

// Only the lifted titles leave their place, and those with the same lift are already in order among themselves (the
// position grows with the plain index). So the lifted titles are one sorted run per lift, merged with each other and
// then with the titles that stay: browse ranks the whole catalog on every request, and this is linear in it.
function browseOrder(
	n: number,
	matches: ArrayLike<number | null | undefined>,
	liftable: ArrayLike<boolean | number> | undefined,
	options: BrowseLiftOptions | undefined,
): Int32Array {
	// Lift and run per match, once: a match is a whole number from 50 to 99. Matches with the same lift share a run.
	const lifts = new Float64Array(100)
	const runOf = new Int8Array(100).fill(-1)
	const runs: number[][] = []
	for (let match = 50; match < 100; match++) {
		const lift = browseLiftOfMatch(match, options)
		lifts[match] = lift
		if (lift === 0) continue
		if (lift !== lifts[match - 1]) runs.push([])
		runOf[match] = runs.length - 1
	}
	const position = new Float64Array(n)
	const isLifted = new Uint8Array(n)
	let liftedCount = 0
	for (let i = 0; i < n; i++) {
		position[i] = i
		const match = matches[i]
		if (!match || (liftable && !liftable[i])) continue
		const run = runOf[Math.round(match)] ?? -1
		if (run < 0) continue
		position[i] = i * (1 - lifts[Math.round(match)])
		isLifted[i] = 1
		runs[run].push(i)
		liftedCount++
	}
	// The lifted titles by position, ties in the plain order.
	const lifted = new Int32Array(liftedCount)
	const heads = new Int32Array(runs.length)
	for (let l = 0; l < liftedCount; l++) {
		let best = -1
		let bestIndex = -1
		for (let r = 0; r < runs.length; r++) {
			if (heads[r] === runs[r].length) continue
			const i = runs[r][heads[r]]
			if (
				best < 0 ||
				position[i] < position[bestIndex] ||
				(position[i] === position[bestIndex] && i < bestIndex)
			) {
				best = r
				bestIndex = i
			}
		}
		lifted[l] = bestIndex
		heads[best]++
	}
	const order = new Int32Array(n)
	let next = 0
	let at = 0
	for (let i = 0; i < n; i++) {
		if (isLifted[i]) continue
		// A title that stays has its plain index as its position. A lifted title that lands exactly there takes the
		// place, so a full lift ends above the first title.
		while (next < lifted.length && position[lifted[next]] <= i)
			order[at++] = lifted[next++]
		order[at++] = i
	}
	while (next < lifted.length) order[at++] = lifted[next++]
	return order
}
