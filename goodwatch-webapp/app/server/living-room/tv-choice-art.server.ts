// The pictures of mini Discover's tiles on the new TV: one title for each option of its three tabs (Moods, Themes,
// Styles), of which the pool sends the backdrop's path and nothing else.
//
// The title of an option is the pool's first candidate that has the mood, theme or style and stands for no option
// before it, so eighteen options show eighteen titles. The candidates are the pool's own (pool-keys.server.ts):
// the same for everyone, in popularity order, kept per snapshot version and UTC day. Nothing of a viewer goes in,
// so the pictures are the same for everyone too and are worked out once per version and day: after that a pool
// request reads them from memory. An option without a candidate, or whose title has no backdrop, has no picture,
// and its tile is the option's own colour.
import { MOOD_KEYS } from "~/domain/moods"
import { STYLE_KEYS, THEME_KEYS } from "~/domain/themes-styles"
import type { TitleDisplay } from "~/server/title-cards.server"
import type { TitleSnapshot } from "~/server/title-snapshot/snapshot.server"
import { DISCOVER_TABS } from "~/ui/living-room/tv/tv-machine"
import type { PoolCandidates } from "./pool-keys.server"

/** A backdrop's path per option, by its item on the TV: `mood:funny`, `theme:crime`, `style:slow`. */
export type ChoiceArt = Record<string, string>

/** What the pictures read of the snapshot: a title's row, whether it has a backdrop, and the three masks. */
export type ChoiceArtSnapshot = Pick<TitleSnapshot, "rowOf"> & {
	factsAt(
		row: number,
	): Pick<ReturnType<TitleSnapshot["factsAt"]>, "hasBackdrop">
	columns: Pick<TitleSnapshot["columns"], "moods" | "themes" | "styles">
}

const KEYS = {
	mood: MOOD_KEYS as readonly string[],
	theme: THEME_KEYS as readonly string[],
	style: STYLE_KEYS as readonly string[],
}

/**
 * The title that stands for each option, by the option's item. Walks the candidates once, most popular first,
 * until every option has a title. A title with a backdrop only: the snapshot knows which have one.
 */
export function choiceArtKeys(
	snapshot: ChoiceArtSnapshot,
	candidates: Pick<PoolCandidates, "all">,
): Map<string, number> {
	const masks = {
		mood: snapshot.columns.moods,
		theme: snapshot.columns.themes,
		style: snapshot.columns.styles,
	}
	const open = DISCOVER_TABS.flatMap(({ kind, keys }) =>
		keys.flatMap((key) => {
			const bit = KEYS[kind].indexOf(key)
			return bit < 0 ? [] : { item: `${kind}:${key}`, kind, bit: 1 << bit }
		}),
	)
	const found = new Map<string, number>()
	for (const { key } of candidates.all) {
		if (found.size === open.length) break
		const row = snapshot.rowOf(key)
		if (row < 0 || !snapshot.factsAt(row).hasBackdrop) continue
		// The first option still without a title that this one has: one title, one tile.
		const option = open.find(
			({ item, kind, bit }) =>
				!found.has(item) && (masks[kind][row] & bit) !== 0,
		)
		if (option) found.set(option.item, key)
	}
	return found
}

let memo: { candidates: object; art: ChoiceArt } | null = null

/**
 * The tiles' pictures for this snapshot version and day. The first call reads the titles' display fields (at most
 * eighteen, from the cards' own cache); later calls answer from memory. A failed read is not kept, and answers
 * no pictures.
 */
export async function loadChoiceArt(
	snapshot: ChoiceArtSnapshot,
	candidates: PoolCandidates,
	displayFields: (keys: number[]) => Promise<Map<number, TitleDisplay>>,
): Promise<ChoiceArt> {
	if (memo?.candidates === candidates) return memo.art
	try {
		const keys = choiceArtKeys(snapshot, candidates)
		const displays = await displayFields([...new Set(keys.values())])
		const art: ChoiceArt = {}
		for (const [item, key] of keys) {
			const path = displays.get(key)?.backdrop_path
			if (path) art[item] = path
		}
		memo = { candidates, art }
		return art
	} catch (error) {
		console.error("Living room: loading the TV's tile pictures failed", error)
		return {}
	}
}

export function resetChoiceArtForTest() {
	memo = null
}
