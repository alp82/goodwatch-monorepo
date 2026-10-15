import { matchedAlias } from "~/server/search-ranking/aliases.server"
import {
	matchingRows,
	paletteCacheEntry,
} from "~/server/search-ranking/name-prefix.server"
import {
	type SearchIndex,
	getSearchIndex,
	loadedAliasVersion,
	loadedSearchIndexBuild,
	startSearchIndex,
} from "~/server/search-ranking/search-index.server"
import { fold } from "~/server/search-ranking/text-rules.server"
// The command palette's matching titles: a prefix lookup over the titles, original titles, and localized names of the
// search index the search ranking keeps in memory (search-ranking/name-prefix.server.ts), with posters from the title
// cards' display fields. Each prefix's answer is cached in Redis for six hours, per alias rules version. The palette
// normalizes the text first, so every spelling of a prefix ("Rea", "rea ") shares one entry. Until the index has loaded, the TMDB title search the old header used serves.
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
 * with it, then the same for their localized names, each group by votes, and about how many more match; none for text
 * shorter than two characters.
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
		...paletteCacheEntry(prefix, loadedAliasVersion()),
		ttlMinutes: CACHE_MINUTES,
		target: () => indexTitles(prefix),
	})
}

// ---------------------------------------------------------------- the search index

async function indexTitles(prefix: string): Promise<PaletteTitles> {
	const index = await getSearchIndex()
	const { rows, total, aliases } = matchingRows(index, fold(prefix), CANDIDATES)
	const keys = rows.map((row) => index.titleTable.pointIds[row])
	const displays = await getDisplayFields(keys)
	const titles: PaletteTitle[] = []
	for (const [at, key] of keys.entries()) {
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
			...withAlias(index, aliases.get(rows[at])),
		})
		if (titles.length === PALETTE_TITLES) break
	}
	// A guess: the matches past the shown ones, counting the unpresentable ones too.
	return { titles, more: Math.max(0, total - titles.length) }
}

const CANDIDATES = PALETTE_TITLES + 3

/** The alias a row matched by, when its best match was a localized name. */
const withAlias = (index: SearchIndex, alias: number | undefined) =>
	alias === undefined
		? {}
		: { matchedAlias: matchedAlias(index.aliases, alias) }

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
		const { rows, aliases } = matchingRows(index, fold(prefix), limit)
		return rows.map((row) => {
			const id = t.pointIds[row]
			return {
				id: id % TMDB_ID_RANGE,
				title: t.titles[row],
				original: t.originalTitles[row] || undefined,
				type: id >= SHOW_POINT_IDS ? "tv" : "movie",
				year: t.years[row] ? String(t.years[row]) : "",
				poster: null,
				popularity: t.popularity[row] || 0,
				...withAlias(index, aliases.get(row)),
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
