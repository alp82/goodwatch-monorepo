// Taste on a search's rows, while the new filter bar is on for a member: each row's taste match, and how far For you
// moves it. For you on a search keeps relevance in charge: a row moves at most SEARCH_MAX_MOVE places (for-you.ts).
// The rows keep the ranking's order; `moved` says where For you puts each one, so a caller can apply it or not.
import { rankForYou } from "~/domain/for-you"
import { isEnabled } from "~/server/features.server"
import { type Taste, loadTaste } from "~/server/taste/index.server"
import type { Row } from "~/ui/search/search-model"
import { type TitleKey, titleKey } from "~/utils/title-key"

/** The member's taste when the filter bar is on for them; null for guests (their progress isn't in the request). */
export async function searchTaste(
	accountId: Promise<string | null>,
): Promise<Taste | null> {
	const userId = await accountId.catch(() => null)
	if (!userId || !isEnabled("filterBar", { userId })) return null
	return loadTaste({ kind: "member", userId }).catch((error) => {
		console.error("Taste for the search failed", error)
		return null
	})
}

const rowKey = (row: Row): TitleKey | null => {
	const [type, id] = row.key.split(":")
	const tmdbId = Number(id)
	if ((type !== "movie" && type !== "show") || !Number.isSafeInteger(tmdbId))
		return null
	return titleKey(type, tmdbId)
}

/** The rows with `tasteMatch` and `moved`; `forYou` is the switch as the request set it. */
export function withTaste(rows: Row[], taste: Taste, forYou: boolean): Row[] {
	const keys = rows.map(rowKey)
	const known = keys.filter((key): key is TitleKey => key !== null)
	const perKey = (values: (number | null)[]) => {
		const byKey = new Map(values.map((value, i) => [known[i], value]))
		return keys.map((key) => (key === null ? null : (byKey.get(key) ?? null)))
	}
	// The match is what a row shows; For you ranks by the percentile behind it.
	const matches = perKey(taste.match(known))
	const moved = new Array<number>(rows.length).fill(0)
	if (forYou && taste.signal === "some") {
		const indexes = rows.map((_, i) => i)
		const ranking = rankForYou(
			indexes,
			perKey(taste.percentile(known)),
			"search",
		)
		ranking.order.forEach((plain, j) => {
			moved[plain] = ranking.moved[j]
		})
	}
	return rows.map((row, i) => ({
		...row,
		tasteMatch: matches[i],
		moved: moved[i],
	}))
}
