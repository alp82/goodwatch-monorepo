import {
	type SearchIndex,
	getSearchIndex,
	loadedSearchIndexBuild,
	startSearchIndex,
} from "~/server/search-ranking/search-index.server"
import { fold } from "~/server/search-ranking/text-rules.server"
import {
	type Squashed,
	nameTier,
	squash,
} from "~/server/search-ranking/title-prefix.server"
// The command palette's matching titles: a prefix lookup over the titles of the search index the search ranking keeps
// in memory (search-ranking/search-index.server.ts), with posters from the title cards' display fields. Each prefix's
// answer is cached in Redis for six hours. The palette normalizes the text first, so every spelling of a prefix
// ("Rea", "rea ") shares one entry. Until the index has loaded, the TMDB title search the old header used serves.
import { getSearchResults } from "~/server/search.server"
import { getDisplayFields } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { Title } from "~/ui/search/search-model"
import { cached } from "~/utils/cache"
import {
	MIN_PREFIX_CHARS,
	type PaletteTitle,
	type PaletteTitles,
	normalizePrefix,
} from "~/utils/command-palette"
import { titleKey } from "~/utils/title-key"
import { runsSearch } from "./role.server"

export const PALETTE_TITLES = 8
const CACHE_MINUTES = 6 * 60

const NONE: PaletteTitles = { titles: [], more: 0 }

/**
 * Up to eight movies and shows whose title or original title starts with the text, then ones with a word that starts
 * with it, each group by votes, and about how many more match; none for text shorter than two characters.
 */
export async function getPaletteTitles(text: string): Promise<PaletteTitles> {
	const prefix = normalizePrefix(text)
	if (prefix.length < MIN_PREFIX_CHARS) return NONE
	// A page instance has no search index: the proxy sends the palette to the search roles, and this is what answers
	// when a lookup arrives here anyway.
	if (!runsSearch()) return tmdbTitles(prefix)
	if (!loadedSearchIndexBuild()) {
		startSearchIndex()
		return tmdbTitles(prefix)
	}
	return cached({
		name: "command-palette-titles-v4",
		params: { prefix },
		ttlMinutes: CACHE_MINUTES,
		target: () => indexTitles(prefix),
	})
}

// ---------------------------------------------------------------- the search index

async function indexTitles(prefix: string): Promise<PaletteTitles> {
	const index = await getSearchIndex()
	const { rows, total } = matchingRows(index, fold(prefix), CANDIDATES)
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
	// A guess: the matches past the shown ones, counting the unpresentable ones too.
	return { titles, more: Math.max(0, total - titles.length) }
}

const CANDIDATES = PALETTE_TITLES + 3

/** Folded titles and original titles (see fold: "Amélie" matches "amel"), without spaces, with their rows. */
type FoldedNames = { name: Squashed; row: number }[]

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
			if (title) names.push({ name: squash(title), row })
			if (original && original !== title)
				names.push({ name: squash(original), row })
		}
		found = names
		foldedByIndex.set(index, found)
	}
	return found
}

/**
 * The first `limit` rows whose names match, best first: a name that starts with the prefix, then a word that does; more
 * votes first. Spaces don't count, so "spiderman" matches "Spider-Man" (see title-prefix.server.ts). With how many match.
 */
function matchingRows(
	index: SearchIndex,
	prefix: string,
	limit: number,
): { rows: number[]; total: number } {
	const query = squash(prefix).text
	if (!query) return { rows: [], total: 0 }
	const { votes } = index.titleTable
	// The best tier each row reached: 0 starts with the prefix, 1 has a word that does.
	const tiers = new Map<number, number>()
	for (const { name, row } of foldedNames(index)) {
		const tier = nameTier(name, query)
		if (tier < 0) continue
		const best = tiers.get(row)
		if (best === undefined || tier < best) tiers.set(row, tier)
	}
	const rows = [...tiers]
		.sort(([a, tierA], [b, tierB]) => tierA - tierB || votes[b] - votes[a])
		.slice(0, limit)
		.map(([row]) => row)
	return { rows, total: tiers.size }
}

const SHOW_POINT_IDS = 2_000_000_000_000
const TMDB_ID_RANGE = 1_000_000_000_000

/**
 * The palette's matches for the search's title lookup, so the search lists the titles the palette showed for the same
 * text: up to `limit` titles in the palette's order, in the TMDB lookup's row format. No posters (the search's catalog
 * metadata has them). None for short text, on a page instance, before the index has loaded, or when it fails.
 */
export async function paletteLookupTitles(
	text: string,
	limit: number,
): Promise<Title[]> {
	const prefix = normalizePrefix(text)
	if (prefix.length < MIN_PREFIX_CHARS) return []
	if (!runsSearch() || !loadedSearchIndexBuild()) return []
	try {
		const index = await getSearchIndex()
		const t = index.titleTable
		return matchingRows(index, fold(prefix), limit).rows.map((row) => {
			const id = t.pointIds[row]
			return {
				id: id % TMDB_ID_RANGE,
				title: t.titles[row],
				original: t.originalTitles[row] || undefined,
				type: id >= SHOW_POINT_IDS ? "tv" : "movie",
				year: t.years[row] ? String(t.years[row]) : "",
				poster: null,
				popularity: t.popularity[row] || 0,
			}
		})
	} catch {
		return []
	}
}

// ---------------------------------------------------------------- the fallback

/** The TMDB title search (cached per query by getSearchResults), with the catalog's titles first. */
async function tmdbTitles(prefix: string): Promise<PaletteTitles> {
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
	// A guess: TMDB answers one page of matches, so there may be more than the rest of it.
	return {
		titles: titles.slice(0, PALETTE_TITLES),
		more: Math.max(0, titles.length - PALETTE_TITLES),
	}
}
