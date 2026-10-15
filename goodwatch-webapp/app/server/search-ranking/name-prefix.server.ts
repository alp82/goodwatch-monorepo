// The command palette's prefix lookup over the titles, original titles, and localized names (aliases) of the search
// index, which also feeds the search's title lookup (command-palette.server.ts). Pure: no cache, no I/O.
import { aliasCandidates, aliasTier } from "./aliases.server.ts"
import type { SearchIndex } from "./search-index.server.ts"
import { fold } from "./text-rules.server.ts"
import { type Squashed, nameTier, squash } from "./title-prefix.server.ts"

/** Folded titles and original titles (see fold: "Amélie" matches "amel"), without spaces, with their rows. */
type FoldedNames = { name: Squashed; row: number }[]

const foldedByIndex = new WeakMap<SearchIndex, FoldedNames>()

/** The index's names folded once per build, without adult titles. */
function foldedNames(index: SearchIndex): FoldedNames {
	let found = foldedByIndex.get(index)
	if (!found) {
		const { titleTable } = index
		const names: FoldedNames = []
		for (let row = 0; row < titleTable.size; row++) {
			if (adult(index, row)) continue
			const title = fold(titleTable.titles[row])
			const original = fold(titleTable.originalTitles[row])
			if (title) names.push({ name: squash(title), row })
			if (original && original !== title)
				names.push({ name: squash(original), row })
		}
		found = names
		foldedByIndex.set(index, found)
	}
	return found
}

function adult(index: SearchIndex, row: number): boolean {
	const { titleTable } = index
	const bit = titleTable.flagNames.indexOf("adult")
	return bit >= 0 && ((titleTable.flags[row] >> bit) & 1) === 1
}

/**
 * The Redis entry of a palette prefix: a build's answer for it depends on its localized names, so the entry carries the
 * alias rules version and an alias-free answer cached before the names arrived isn't served after.
 */
export const paletteCacheEntry = (prefix: string, aliasVersion: number) => ({
	name: "command-palette-titles-v5",
	params: { prefix, aliases: aliasVersion },
})

// Tiers, best first: the start of a title (or original title), a later word of one, then the same for the localized
// names. Aliases only fill the places the titles leave, so they never push a title match out of the palette or the
// search's title lookup.
const CANONICAL_TIER = [0, 1]
const ALIAS_TIER = [2, 3]

/**
 * The first `limit` rows whose names match the folded prefix, best first: a title or original title that starts with
 * it, then one with a word that does, then the same for a localized name; more votes first. Spaces don't count, so
 * "spiderman" matches "Spider-Man" (see title-prefix.server.ts). With how many match, and for each row whose best
 * match was an alias, that alias.
 */
export function matchingRows(
	index: SearchIndex,
	prefix: string,
	limit: number,
): { rows: number[]; total: number; aliases: Map<number, number> } {
	const query = squash(prefix).text
	const aliases = new Map<number, number>()
	if (!query) return { rows: [], total: 0, aliases }
	const { votes } = index.titleTable
	// The best tier each row reached.
	const tiers = new Map<number, number>()
	for (const { name, row } of foldedNames(index)) {
		const tier = nameTier(name, query)
		if (tier < 0) continue
		const best = tiers.get(row)
		if (best === undefined || CANONICAL_TIER[tier] < best)
			tiers.set(row, CANONICAL_TIER[tier])
	}
	const table = index.aliases
	const candidates = aliasCandidates(table, query)
	for (let k = 0; k < candidates.length; k++) {
		const i = candidates[k]
		const tier = aliasTier(table, i, query)
		if (tier < 0) continue
		const row = table.rows[i]
		const best = tiers.get(row)
		if (best !== undefined && best <= ALIAS_TIER[tier]) continue
		if (adult(index, row)) continue
		tiers.set(row, ALIAS_TIER[tier])
		aliases.set(row, i)
	}
	// The first `limit` of a stable sort by tier, then votes, without sorting every match: a short prefix matches tens
	// of thousands of names.
	const top: [number, number][] = []
	const worse = ([a, tierA]: [number, number], [b, tierB]: [number, number]) =>
		tierA - tierB || votes[b] - votes[a]
	for (const entry of tiers) {
		if (top.length === limit && worse(top[limit - 1], entry) <= 0) continue
		let at = top.length
		while (at > 0 && worse(top[at - 1], entry) > 0) at--
		top.splice(at, 0, entry)
		if (top.length > limit) top.pop()
	}
	const rows = top.map(([row]) => row)
	const shown = new Map<number, number>()
	for (const row of rows) {
		const alias = aliases.get(row)
		if (alias !== undefined) shown.set(row, alias)
	}
	return { rows, total: tiers.size, aliases: shown }
}
