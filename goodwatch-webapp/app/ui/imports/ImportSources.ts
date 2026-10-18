// The sources on the Imports page, most common first. Only sources with a live import are listed; a source is
// added here when its import ships. Logos are each platform's official mark, used unchanged; every other source gets
// the same neutral letter tile, which borrows no platform's colors or shapes. Names come from the import contract, so the page, the history, and the
// receipt call a source the same.
import type { ImdbImportSummary } from "~/domain/imdb-import"
import {
	IMPORT_SOURCE_NAMES,
	type ImportSource,
	type ImportSummary,
} from "~/domain/imports"
import imdbLogo from "~/img/import-sources/imdb.svg?no-inline"
import tmdbLogo from "~/img/import-sources/tmdb.svg?no-inline"
import traktLogo from "~/img/import-sources/trakt.svg?no-inline"
// PROTOTYPE (prototype/settings-subpages): the real mark for every source, as the owner asked on 2026-10-19. Each
// comment below keeps the brand caveat that made production use a letter tile; clear those before this ships.
import csvLogo from "~/img/import-sources/csv.svg?no-inline"
import kodiLogo from "~/img/import-sources/kodi.png?no-inline"
import letterboxdLogo from "~/img/import-sources/letterboxd.svg?no-inline"
import movielensLogo from "~/img/import-sources/movielens.png?no-inline"
import myanimelistLogo from "~/img/import-sources/myanimelist.svg?no-inline"
import plexLogo from "~/img/import-sources/plex.png?no-inline"
import wishlistLogo from "~/img/import-sources/wishlist.png?no-inline"
import type { RecognizedImportFile } from "./ImportFileRecognition"

export type ImportSourceId = "imdb" | ImportSource

export interface ImportSourceEntry {
	id: ImportSourceId
	name: string
	/** Official mark, a build file with a hashed name (cached for a year), or null for a letter tile. */
	logo: string | null
	/** The letter tile's text when there is no logo. */
	tile: string
	/** What GoodWatch takes from the file or account. */
	gets: string[]
	/** How long getting the file takes. */
	wait: string
	/** Other words a member may search for. */
	aliases: string
	/** How a sentence names this source's file, for a source that takes one: "a Trakt file". */
	fileNoun?: string
	connect?: true
}

const NAMES: Record<ImportSourceId, string> = {
	imdb: "IMDb",
	...IMPORT_SOURCE_NAMES,
}

const SOURCES: Omit<ImportSourceEntry, "name">[] = [
	{
		id: "imdb",
		logo: imdbLogo,
		tile: "IMDb",
		gets: ["Ratings"],
		wait: "A few minutes",
		aliases: "internet movie database",
	},
	{
		id: "letterboxd",
		// Prototype: Letterboxd's decal (letterboxd.com/about/brand). Caveat: its brand page forbids commercial use of its marks without consent.
		logo: letterboxdLogo,
		tile: "Lb",
		gets: [
			"Ratings",
			"Watches with dates",
			"Rewatches",
			"Want to See",
			"Favorites",
			"Reviews",
		],
		wait: "Right away",
		aliases: "lb boxd",
	},
	{
		id: "trakt",
		logo: traktLogo,
		tile: "Tr",
		gets: [
			"Ratings",
			"Watches with dates",
			"Rewatches",
			"Episodes",
			"Want to See",
			"Favorites",
		],
		wait: "About a minute",
		// TV Time closed; its members are pointed to Trakt, which imports a saved TV Time file.
		aliases: "trakt.tv tv time tvtime",
	},
	{
		id: "tmdb",
		logo: tmdbLogo,
		tile: "TMDB",
		gets: ["Ratings", "Want to See", "Favorites"],
		wait: "Seconds",
		aliases: "the movie database themoviedb",
		connect: true,
	},
	{
		id: "plex",
		// Prototype: Plex's own app icon (its favicon, via Wikimedia Commons), not one derived from it. Caveat: Plex's kit has
		// only a wide wordmark, and its guidelines forbid icons derived from its marks.
		logo: plexLogo,
		tile: "Px",
		// Each play from the member's own server, and Want to See from the personal watchlist feed.
		gets: ["Watches with dates", "Rewatches", "Episodes", "Want to See"],
		wait: "About a minute",
		aliases: "plex.tv plex media server",
		connect: true,
	},
	{
		id: "myanimelist",
		// Prototype: MyAnimeList's favicon mark (Wikimedia Commons). Caveat: MyAnimeList allows its marks only with written
		// permission; Kitsu publishes no usage terms.
		logo: myanimelistLogo,
		tile: "MAL",
		gets: ["Episodes", "Show statuses", "Want to See"],
		wait: "Right away",
		aliases: "mal anime kitsu",
		fileNoun: "a MyAnimeList or Kitsu file",
	},
	{
		id: "kodi",
		// Prototype: Kodi's icon from the xbmc/xbmc repository. Caveat: Kodi's guidelines ask for ® and a trademark notice
		// with the logo.
		logo: kodiLogo,
		tile: "K",
		gets: ["Ratings", "Watches", "Episodes"],
		wait: "Right away",
		aliases: "xbmc media center",
	},
	{
		id: "movielens",
		// Prototype: MovieLens's site icon (movielens.org, 120 px). Caveat: GroupLens publishes no brand assets or terms.
		logo: movielensLogo,
		tile: "ML",
		gets: ["Ratings", "Want to See"],
		wait: "Right away",
		aliases: "grouplens",
	},
	{
		id: "wishlist",
		// Prototype: Watcharr's logo from its repository (sbondCo/Watcharr). Caveat: Watcharr publishes no brand terms, and
		// the row also reads wishlist files made for GoodWatch.
		logo: wishlistLogo,
		tile: "W",
		gets: ["Want to See"],
		wait: "Right away",
		aliases: "self-hosted planned watchlist json",
		fileNoun: "a Watcharr export or wishlist file",
	},
	{
		id: "csv",
		// Prototype: a plain spreadsheet file mark drawn for GoodWatch; CSV is no brand.
		logo: csvLogo,
		tile: "CSV",
		gets: ["Ratings", "Watches with dates", "Reviews"],
		wait: "Depends on the tool",
		aliases:
			"any other site spreadsheet mubi filmweb csfd senscritique douban kinopoisk filmaffinity rotten tomatoes icheckmovies",
		fileNoun: "a CSV file in Letterboxd's import format",
	},
]

export const IMPORT_SOURCE_LIST: readonly ImportSourceEntry[] = SOURCES.map(
	(source) => ({ ...source, name: NAMES[source.id] }),
)

const entry = (id: ImportSourceId) =>
	IMPORT_SOURCE_LIST.find((source) => source.id === id) as ImportSourceEntry

export const importSourceName = (id: ImportSourceId) => entry(id).name

/** How a sentence names a source's file: "a Trakt file", "a CSV file in Letterboxd's import format". */
export const importFileNoun = (id: ImportSourceId) =>
	entry(id).fileNoun ??
	`${/^[AEIOU]/i.test(entry(id).name) ? "an" : "a"} ${entry(id).name} file`

/** The source a recognized file is offered as: "Trakt", "Kitsu". */
export const importAsName = (recognition: RecognizedImportFile) =>
	recognition.source === "myanimelist"
		? recognition.kitsu
			? "Kitsu"
			: "MyAnimeList"
		: importSourceName(recognition.source)

/** The sources whose name or other words hold the query. */
export function searchImportSources(query: string) {
	const words = query.trim().toLowerCase()
	if (!words) return IMPORT_SOURCE_LIST
	return IMPORT_SOURCE_LIST.filter((source) =>
		`${source.name} ${source.aliases}`.toLowerCase().includes(words),
	)
}

/**
 * Streaming services and trackers members look for that GoodWatch can't import from. A search that finds no source
 * but names one of these says so, instead of suggesting a CSV file that holds no watchlist.
 */
const STREAMING_SERVICES: readonly {
	name: string
	terms: readonly string[]
	/** The live imports to point to instead, in order. */
	instead: readonly ImportSourceId[]
}[] = [
	["Netflix", []],
	["Prime Video", ["amazon", "prime"]],
	["Disney+", ["disney"]],
	["Max", ["hbo", "hbo max"]],
	["Hulu", []],
	["Apple TV", []],
	["Paramount+", ["paramount"]],
	["Peacock", []],
	["Crunchyroll", []],
	["WOW", ["sky"]],
	["RTL+", ["rtl"]],
	["Joyn", []],
	["ARD", []],
	["ZDF", []],
	["JustWatch", []],
	["Simkl", []],
	["Google TV", []],
].map(([name, terms]) => ({
	name: name as string,
	terms: [(name as string).toLowerCase(), ...(terms as string[])],
	instead: [
		...(name === "Crunchyroll" ? (["myanimelist"] as const) : []),
		"trakt",
		"tmdb",
		"plex",
	],
}))

/** The streaming service a search names, as a whole word or the start of its name. */
export function streamingServiceFor(query: string) {
	const words = query.trim().toLowerCase()
	if (!words) return null
	return (
		STREAMING_SERVICES.find((service) =>
			service.terms.some(
				(term) =>
					` ${words} `.includes(` ${term} `) ||
					(words.length >= 3 && term.startsWith(words)),
			),
		) ?? null
	)
}

/** When each source last finished an import. An undone or unfinished import doesn't count. */
export function lastImported(
	imdb: readonly ImdbImportSummary[],
	native: readonly ImportSummary[],
) {
	const latest = new Map<ImportSourceId, string>()
	const note = (id: ImportSourceId, at: string | null) => {
		if (at && at > (latest.get(id) ?? "")) latest.set(id, at)
	}
	for (const item of imdb)
		if (item.status === "done") note("imdb", item.finishedAt)
	for (const item of native)
		if (item.status === "done") note(item.source, item.finishedAt)
	return latest
}
