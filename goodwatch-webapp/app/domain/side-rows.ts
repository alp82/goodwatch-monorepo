// Discover's Sides of you rows (#671): a list grouped by side without changing its order. Sides group, the list's
// order (personal order under Best match) ranks: inside a group the titles keep the list's order, and the groups come
// in the order of their first title, the titles that fit no side among them.
import type { TitleKey } from "~/utils/title-key"

/** One group of the list: a side's titles (its index) or those that fit no side (null). */
export interface ListGroup {
	side: number | null
	/** Its titles in the whole list. */
	total: number
	/** Its first titles, in the list's order. */
	keys: TitleKey[]
}

/**
 * The list grouped by side: each group's first `first` titles in the list's order, and the groups in the order of
 * their first title, the titles that fit no side among them. Groups without a title are left out.
 */
export function groupInListOrder(
	keys: readonly TitleKey[],
	side: (key: TitleKey) => number | null,
	first: number,
): ListGroup[] {
	const groups = new Map<number | null, ListGroup>()
	for (const key of keys) {
		const s = side(key)
		let group = groups.get(s)
		if (!group) {
			group = { side: s, total: 0, keys: [] }
			groups.set(s, group)
		}
		group.total++
		if (group.keys.length < first) group.keys.push(key)
	}
	// A Map keeps insertion order: the order of each group's first title.
	return [...groups.values()]
}

/**
 * Whether a list shows the member's taste grouping: while browsing (not searching), whenever For you is on, with any
 * sort, and never while it's off. Best match counts as on: For you always shows on under it (owner, #671).
 */
export function groupsByTaste(input: {
	searching: boolean
	forYou: boolean
	sort: string
}): boolean {
	return !input.searching && (input.forYou || input.sort === "match")
}
