// The sources on the Imports page, most common first. Only sources with a live import are listed; a source is
// added here when its import ships. Logos are each platform's official mark, used unchanged; a source without one
// GoodWatch may use gets a letter tile.
import type { ImdbImportSummary } from "~/domain/imdb-import"
import type { ImportSource, ImportSummary } from "~/domain/imports"

export type ImportSourceId = "imdb" | ImportSource

export interface ImportSourceEntry {
	id: ImportSourceId
	name: string
	/** Official mark under public/, or null for a letter tile. */
	logo: string | null
	/** The letter tile's text and colour when there is no logo. */
	tile: { text: string; className: string }
	/** What GoodWatch takes from the file or account. */
	gets: string[]
	/** How long getting the file takes. */
	wait: string
	/** Other words a member may search for. */
	aliases: string
	connect?: true
}

export const IMPORT_SOURCE_LIST: readonly ImportSourceEntry[] = [
	{
		id: "imdb",
		name: "IMDb",
		logo: "/images/import-sources/imdb.svg",
		tile: { text: "IMDb", className: "bg-yellow-400 text-black" },
		gets: ["Ratings"],
		wait: "A few minutes",
		aliases: "internet movie database",
	},
	{
		id: "letterboxd",
		name: "Letterboxd",
		logo: "/images/import-sources/letterboxd.svg",
		tile: { text: "Lb", className: "bg-emerald-600 text-white" },
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
		name: "Trakt",
		logo: "/images/import-sources/trakt.svg",
		tile: { text: "Tr", className: "bg-red-600 text-white" },
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
		name: "TMDB",
		logo: "/images/import-sources/tmdb.svg",
		tile: { text: "TMDB", className: "bg-sky-700 text-white" },
		gets: ["Ratings", "Want to See", "Favorites"],
		wait: "Seconds",
		aliases: "the movie database themoviedb",
		connect: true,
	},
	{
		id: "myanimelist",
		name: "MyAnimeList / Kitsu",
		// MyAnimeList allows its marks only with written permission; Kitsu publishes no usage terms.
		logo: null,
		tile: { text: "MAL", className: "bg-blue-700 text-white" },
		gets: ["Episodes", "Show statuses", "Want to See"],
		wait: "Right away",
		aliases: "mal anime kitsu",
	},
	{
		id: "kodi",
		name: "Kodi",
		// Kodi's guidelines ask for ® on the logo, which doesn't fit a tile this small.
		logo: null,
		tile: { text: "K", className: "bg-sky-500 text-white" },
		gets: ["Ratings", "Watches", "Episodes"],
		wait: "Right away",
		aliases: "xbmc media center",
	},
	{
		id: "movielens",
		name: "MovieLens",
		// GroupLens publishes no brand assets.
		logo: null,
		tile: { text: "ML", className: "bg-orange-700 text-white" },
		gets: ["Ratings", "Want to See"],
		wait: "Right away",
		aliases: "grouplens",
	},
	{
		id: "csv",
		name: "Any other site (CSV)",
		logo: null,
		tile: { text: "CSV", className: "bg-slate-600 text-white" },
		gets: ["Ratings", "Watches with dates", "Reviews"],
		wait: "Depends on the tool",
		aliases:
			"generic csv spreadsheet mubi filmweb csfd senscritique douban kinopoisk filmaffinity rotten tomatoes icheckmovies",
	},
]

export const importSourceName = (id: ImportSourceId) =>
	IMPORT_SOURCE_LIST.find((source) => source.id === id)?.name ?? id

/** The sources whose name or other words hold the query. */
export function searchImportSources(query: string) {
	const words = query.trim().toLowerCase()
	if (!words) return IMPORT_SOURCE_LIST
	return IMPORT_SOURCE_LIST.filter((source) =>
		`${source.name} ${source.aliases}`.toLowerCase().includes(words),
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
