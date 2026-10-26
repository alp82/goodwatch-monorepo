// The sources on the Imports page, most common first. Only sources with a live import are listed; a source is
// added here when its import ships. Logos are each platform's official mark, used unchanged; a source without one
// would get a neutral letter tile. Names come from the import contract, so the page, the history, and the receipt
// call a source the same.
import type { ImdbImportSummary } from "~/domain/imdb-import"
import {
	IMPORT_SOURCE_NAMES,
	type ImportSource,
	type ImportSummary,
} from "~/domain/imports"
// Every source shows its own mark: the owner chose real marks over letter tiles on 2026-10-19, knowing the brand
// terms noted on each source below.
import csvLogo from "~/img/import-sources/csv.svg?no-inline"
import imdbLogo from "~/img/import-sources/imdb.svg?no-inline"
import kodiLogo from "~/img/import-sources/kodi.png?no-inline"
import letterboxdLogo from "~/img/import-sources/letterboxd.svg?no-inline"
import mdblistLogo from "~/img/import-sources/mdblist.svg?no-inline"
import movielensLogo from "~/img/import-sources/movielens.png?no-inline"
import myanimelistLogo from "~/img/import-sources/myanimelist.svg?no-inline"
import plexLogo from "~/img/import-sources/plex.png?no-inline"
import tmdbLogo from "~/img/import-sources/tmdb.svg?no-inline"
import traktLogo from "~/img/import-sources/trakt.svg?no-inline"
import tvtimeLogo from "~/img/import-sources/tvtime.svg?no-inline"
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
		gets: ["Ratings", "Want to See", "Lists"],
		wait: "A few minutes",
	},
	{
		id: "letterboxd",
		// Letterboxd's decal (letterboxd.com/about/brand). Its brand page asks for consent before commercial use.
		logo: letterboxdLogo,
		tile: "Lb",
		gets: [
			"Ratings",
			"Watches with dates",
			"Rewatches",
			"Want to See",
			"Favorites",
			"Reviews",
			"Lists",
		],
		wait: "Right away",
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
			"Lists",
		],
		wait: "About a minute",
	},
	{
		id: "tmdb",
		logo: tmdbLogo,
		tile: "TMDB",
		gets: ["Ratings", "Want to See", "Favorites", "Lists"],
		wait: "Seconds",
		connect: true,
	},
	{
		id: "plex",
		// Plex's own app icon (its favicon, via Wikimedia Commons), not one derived from it. Plex's kit has only a wide
		// wordmark, and its guidelines forbid icons derived from its marks.
		logo: plexLogo,
		tile: "Px",
		// Each play from the member's own server, and Want to See from the personal watchlist feed.
		gets: ["Watches with dates", "Rewatches", "Episodes", "Want to See"],
		wait: "About a minute",
		connect: true,
	},
	{
		id: "mdblist",
		// MDBList's own pinned-tab mark (mdblist.com/static/safari-pinned-tab.svg, via Simple Icons 16.0.0) in its brand
		// blue. MDBList publishes no brand terms.
		logo: mdblistLogo,
		tile: "MDB",
		gets: [
			"Ratings",
			"Watches with dates",
			"Rewatches",
			"Episodes",
			"Want to See",
			"Show statuses",
			"Lists",
		],
		wait: "Seconds",
		connect: true,
	},
	{
		id: "tvtime",
		// "Logo TV Time" by Vegetapple on Wikimedia Commons (File:Logo_TV_Time.svg), CC BY-SA 4.0. Its CSS classes were
		// moved into fill attributes; it looks the same. The Imports page's notices credit it with links.
		// TV Time closed on July 15, 2026 and publishes no brand terms; members bring an export they saved before then.
		logo: tvtimeLogo,
		tile: "TV",
		gets: [
			"Watches with dates",
			"Rewatches",
			"Episodes",
			"Show statuses",
			"Want to See",
			"Movie ratings",
		],
		wait: "Right away",
		fileNoun: "a TV Time export",
	},
	{
		id: "myanimelist",
		// MyAnimeList's favicon mark (Wikimedia Commons). MyAnimeList allows its marks only with written permission; Kitsu
		// publishes no usage terms.
		logo: myanimelistLogo,
		tile: "MAL",
		gets: ["Episodes", "Show statuses", "Want to See"],
		wait: "Right away",
		fileNoun: "a MyAnimeList or Kitsu file",
	},
	{
		id: "kodi",
		// Kodi's icon from the xbmc/xbmc repository. Kodi's guidelines ask for ® and a trademark notice with the logo; the
		// Imports page's notice names Kodi.
		logo: kodiLogo,
		tile: "K",
		gets: ["Ratings", "Watches", "Episodes"],
		wait: "Right away",
	},
	{
		id: "movielens",
		// MovieLens's site icon (movielens.org, 120 px). GroupLens publishes no brand assets or terms.
		logo: movielensLogo,
		tile: "ML",
		gets: ["Ratings", "Want to See"],
		wait: "Right away",
	},
	{
		id: "wishlist",
		// Watcharr's logo from its repository (sbondCo/Watcharr), which publishes no brand terms. One row: the same import
		// reads wishlist files made for GoodWatch.
		logo: wishlistLogo,
		tile: "W",
		gets: ["Want to See"],
		wait: "Right away",
		fileNoun: "a Watcharr export or wishlist file",
	},
	{
		id: "csv",
		// A plain spreadsheet file mark drawn for GoodWatch; CSV is no brand.
		logo: csvLogo,
		tile: "CSV",
		gets: ["Ratings", "Watches with dates", "Reviews"],
		wait: "Depends on the tool",
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
		if (item.status === "done")
			note(item.source === "imdb_list" ? "imdb" : item.source, item.finishedAt)
	return latest
}
