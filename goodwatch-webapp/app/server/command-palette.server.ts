import {
	type SearchIndex,
	getSearchIndex,
	loadedSearchIndexBuild,
	startSearchIndex,
} from "~/server/search-ranking/search-index.server"
import { fold } from "~/server/search-ranking/text-rules.server"
// The command palette's matching titles: a prefix lookup over the titles of the search index the search ranking keeps
// in memory (search-ranking/search-index.server.ts), with posters from the title cards' display fields. Each prefix's
// answer is cached in Redis for six hours. The palette normalizes the text first, so every spelling of a prefix
// ("Rea", "rea ") shares one entry. Until the index has loaded, the TMDB title search the old header used serves.
import { getSearchResults } from "~/server/search.server"
import { getDisplayFields } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { cached } from "~/utils/cache"
import {
	MIN_PREFIX_CHARS,
	type PaletteTitle,
	normalizePrefix,
} from "~/utils/command-palette"
import { titleKey } from "~/utils/title-key"

export const PALETTE_TITLES = 5
const CACHE_MINUTES = 6 * 60

/**
 * Up to five movies and shows whose title or original title starts with the text, then ones with a word that starts
 * with it, each group by votes; empty for text shorter than two characters.
 */
export async function getPaletteTitles(text: string): Promise<PaletteTitle[]> {
	const prefix = normalizePrefix(text)
	if (prefix.length < MIN_PREFIX_CHARS) return []
	if (!loadedSearchIndexBuild()) {
		startSearchIndex()
		return tmdbTitles(prefix)
	}
	const { titles } = await cached({
		name: "command-palette-titles-v2",
		params: { prefix },
		ttlMinutes: CACHE_MINUTES,
		target: async () => ({ titles: await indexTitles(prefix) }),
	})
	return titles
}

// ---------------------------------------------------------------- the search index

async function indexTitles(prefix: string): Promise<PaletteTitle[]> {
	const index = await getSearchIndex()
	const rows = matchingRows(index, fold(prefix))
	const keys = rows.map((row) => index.titleTable.pointIds[row])
	const displays = await getDisplayFields(keys)
	const titles: PaletteTitle[] = []
	for (const key of keys) {
		// Titles Crate lacks and ones that aren't presentable are left out; the spare candidates fill in.
		const display = displays.get(key)
		if (
			!display?.poster_path ||
			display.goodwatch_overall_score_normalized_percent == null
		)
			continue
		titles.push({
			mediaType: display.media_type,
			tmdbId: display.tmdb_id,
			title: display.title,
			year: display.release_year ? String(display.release_year) : "",
			posterPath: display.poster_path,
		})
		if (titles.length === PALETTE_TITLES) break
	}
	return titles
}

const CANDIDATES = PALETTE_TITLES + 3

/** Folded titles and original titles (see fold: "Amélie" matches "amel"), with their rows. */
type FoldedNames = { name: string; row: number }[]

const foldedByIndex = new WeakMap<SearchIndex, FoldedNames>()

/** The index's names folded once per build, without adult titles. */
function foldedNames(index: SearchIndex): FoldedNames {
	let found = foldedByIndex.get(index)
	if (!found) {
		const { titleTable } = index
		const adult = titleTable.flagNames.indexOf("adult")
		const names: FoldedNames = []
		for (let row = 0; row < titleTable.size; row++) {
			if (adult >= 0 && (titleTable.flags[row] >> adult) & 1) continue
			const title = fold(titleTable.titles[row])
			const original = fold(titleTable.originalTitles[row])
			if (title) names.push({ name: title, row })
			if (original && original !== title) names.push({ name: original, row })
		}
		found = names
		foldedByIndex.set(index, found)
	}
	return found
}

/** The rows whose names match, best first: a name that starts with the prefix, then a word that does; more votes first. */
function matchingRows(index: SearchIndex, prefix: string): number[] {
	if (!prefix) return []
	const { votes } = index.titleTable
	const wordPrefix = ` ${prefix}`
	// The best tier each row reached: 0 starts with the prefix, 1 has a word that does.
	const tiers = new Map<number, number>()
	for (const { name, row } of foldedNames(index)) {
		const tier = name.startsWith(prefix)
			? 0
			: name.includes(wordPrefix)
				? 1
				: -1
		if (tier < 0) continue
		const best = tiers.get(row)
		if (best === undefined || tier < best) tiers.set(row, tier)
	}
	return [...tiers]
		.sort(([a, tierA], [b, tierB]) => tierA - tierB || votes[b] - votes[a])
		.slice(0, CANDIDATES)
		.map(([row]) => row)
}

// ---------------------------------------------------------------- the fallback

/** The TMDB title search (cached per query by getSearchResults), with the catalog's titles first. */
async function tmdbTitles(prefix: string): Promise<PaletteTitle[]> {
	const results = await getSearchResults({ language: "en_US", query: prefix })
	const titles: PaletteTitle[] = results
		.filter((result) => !result.adult)
		.map((result): PaletteTitle => {
			const show = result.media_type === "show"
			return {
				mediaType: show ? "show" : "movie",
				tmdbId: result.id,
				title: (show ? result.name : result.title) || "",
				year: (
					(show ? result.first_air_date : result.release_date) || ""
				).slice(0, 4),
				posterPath: result.poster_path || null,
			}
		})
		.filter((title) => title.title)
	const snapshot = getTitleSnapshot()
	if (snapshot) {
		const known = (title: PaletteTitle) =>
			snapshot.has(titleKey(title.mediaType, title.tmdbId))
		titles.sort((a, b) => Number(known(b)) - Number(known(a)))
	}
	return titles.slice(0, PALETTE_TITLES)
}
