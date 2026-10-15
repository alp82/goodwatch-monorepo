// PROTOTYPE - throwaway (#617). Names a file's source from its name and what peek.ts saw inside, using the
// signatures in the research notes. Some are secondary or unconfirmed there; a real build checks each against a file.
import type { Peek } from "./peek"
import type { SourceId } from "./sources"

export interface Recognition {
	source: SourceId | null
	label: string
	/** A format two sources share; the member says which. */
	needsChoice?: SourceId[]
	hint?: string
}

const has = (list: string[], ...wanted: string[]) =>
	wanted.every((item) =>
		list.some((entry) => entry.toLowerCase() === item.toLowerCase()),
	)
const hasAny = (list: string[], ...wanted: string[]) =>
	wanted.some((item) => has(list, item))

export function recognize(fileName: string, peek: Peek): Recognition {
	const name = fileName.toLowerCase()
	if (peek.kind === "zip") {
		const files = peek.entries.map((entry) => entry.toLowerCase())
		const base = files.map((entry) => entry.split("/").pop() ?? entry)
		if (
			files.some((entry) =>
				entry.endsWith("content_interaction/viewingactivity.csv"),
			)
		)
			return { source: "netflix", label: "Netflix account archive" }
		if (
			has(base, "diary.csv") ||
			(has(base, "ratings.csv") && has(base, "watched.csv"))
		)
			return { source: "letterboxd", label: "Letterboxd export" }
		if (
			base.some(
				(entry) =>
					/^watched-history(-\d+)?\.json$/.test(entry) ||
					/^ratings-(movies|shows|episodes|seasons)\.json$/.test(entry),
			)
		)
			return { source: "trakt", label: "Trakt export" }
		if (
			base.some(
				(entry) =>
					entry.startsWith("simklbackup") || entry === "simkl_backup.json",
			)
		)
			return { source: "simkl", label: "Simkl backup" }
		if (
			base.some((entry) => entry.startsWith("tracking-prod-records")) ||
			name.startsWith("tv-time-export") ||
			name.startsWith("gdpr-data")
		)
			return { source: "tvtime", label: "TV Time export" }
		if (has(base, "items.csv", "categories.csv"))
			return { source: "sofa", label: "Sofa export" }
		if (has(base, "videodb.xml"))
			return { source: "kodi", label: "Kodi library export" }
		return {
			source: null,
			label: "ZIP file",
			hint: "Nothing in this ZIP matches an export GoodWatch knows.",
		}
	}
	if (peek.kind === "csv") {
		const header = peek.header.map((cell) => cell.trim())
		if (has(header, "Const", "Your Rating") && !has(header, "Position"))
			return { source: "imdb", label: "IMDb ratings file" }
		if (has(header, "Position", "Const"))
			return {
				source: "imdb",
				label: name.includes("watchlist") ? "IMDb watchlist" : "IMDb list",
			}
		if (has(header, "TMDb ID", "Your Rating"))
			return { source: "tmdb", label: "TMDB ratings file" }
		if (has(header, "SIMKL_ID"))
			return { source: "simkl", label: "Simkl CSV backup" }
		if (has(header, "Score", "Film Name"))
			return { source: "criticker", label: "Criticker ratings file" }
		if (has(header, "movie_id", "tmdb_id"))
			return {
				source: "movielens",
				label: has(header, "rating")
					? "MovieLens ratings"
					: "MovieLens wishlist",
			}
		if (has(header, "Title", "Date") && header.length === 2)
			return { source: "netflix", label: "Netflix viewing activity" }
		if (has(header, "Date", "Name", "Letterboxd URI"))
			return {
				source: "letterboxd",
				label: "single Letterboxd file",
				hint: "Upload the whole Letterboxd ZIP instead of one file from inside it.",
			}
		if (
			hasAny(
				header,
				"tmdbID",
				"imdbID",
				"Rating10",
				"WatchedDate",
				"LetterboxdURI",
			) ||
			has(header, "Title", "Year")
		)
			return { source: "csv", label: "CSV in Letterboxd's import format" }
		return {
			source: null,
			label: "CSV file",
			hint: "Its columns don't match a known export. A CSV needs at least Title and Year, or tmdbID or imdbID.",
		}
	}
	if (peek.kind === "xml") {
		if (peek.root === "videodb")
			return { source: "kodi", label: "Kodi library export" }
		if (peek.root === "myanimelist") {
			if (name.startsWith("kitsu-"))
				return { source: "kitsu", label: "Kitsu anime library" }
			if (name.startsWith("animelist_"))
				return { source: "mal", label: "MyAnimeList export" }
			return {
				source: null,
				label: "MyAnimeList-format list",
				needsChoice: ["mal", "kitsu"],
			}
		}
		if (peek.root === "export")
			return { source: "tautulli", label: "Tautulli export" }
		return {
			source: null,
			label: "XML file",
			hint: `GoodWatch doesn't know XML files that start with <${peek.root}>.`,
		}
	}
	if (peek.kind === "json") {
		if (has(peek.keys, "ratingKey", "guids"))
			return { source: "tautulli", label: "Tautulli export" }
		if (has(peek.keys, "user", "lists", "activity"))
			return { source: "anilist", label: "AniList data download" }
		if (hasAny(peek.keys, "movies", "shows", "anime") && !peek.isArray)
			return { source: "simkl", label: "Simkl backup" }
		return { source: null, label: "JSON file" }
	}
	return { source: null, label: "file" }
}

/** Prototype stand-ins for real files: the file name and what peek would see in it. */
export const SAMPLES: {
	fileName: string
	for: SourceId | null
	wrong?: boolean
	peek: Peek
}[] = [
	{
		fileName: "ratings.csv",
		for: "imdb",
		peek: {
			kind: "csv",
			header: [
				"Const",
				"Your Rating",
				"Date Rated",
				"Title",
				"Original Title",
				"URL",
				"Title Type",
			],
			firstLine: "",
		},
	},
	{
		fileName: "watchlist.csv",
		for: "imdb",
		peek: {
			kind: "csv",
			header: [
				"Position",
				"Const",
				"Created",
				"Modified",
				"Description",
				"Title",
			],
			firstLine: "",
		},
	},
	{
		fileName: "letterboxd-alp82-2026-10-15-09-12-utc.zip",
		for: "letterboxd",
		peek: {
			kind: "zip",
			entries: [
				"diary.csv",
				"ratings.csv",
				"watched.csv",
				"watchlist.csv",
				"reviews.csv",
				"likes/films.csv",
			],
		},
	},
	{
		fileName: "trakt-export-alp82.zip",
		for: "trakt",
		wrong: true,
		peek: {
			kind: "zip",
			entries: [
				"watched-history-1.json",
				"ratings-movies.json",
				"ratings-shows.json",
				"lists-watchlist.json",
			],
		},
	},
	{
		fileName: "rated_movies.csv",
		for: "tmdb",
		peek: {
			kind: "csv",
			header: [
				"TMDb ID",
				"IMDb ID",
				"Type",
				"Name",
				"Release Date",
				"Season Number",
				"Episode Number",
				"Rating",
				"Your Rating",
				"Date Rated",
			],
			firstLine: "",
		},
	},
	{
		fileName: "mubi-ratings.csv",
		for: "csv",
		peek: {
			kind: "csv",
			header: ["Title", "Year", "Rating10", "WatchedDate", "tmdbID"],
			firstLine: "",
		},
	},
	{
		fileName: "SimklBackup.zip",
		for: "simkl",
		peek: { kind: "zip", entries: ["SimklBackup.json"] },
	},
	{
		fileName: "NetflixViewingHistory.csv",
		for: "netflix",
		wrong: true,
		peek: { kind: "csv", header: ["Title", "Date"], firstLine: "Title,Date" },
	},
	{
		fileName: "netflix-report.zip",
		for: "netflix",
		peek: {
			kind: "zip",
			entries: [
				"CONTENT_INTERACTION/ViewingActivity.csv",
				"CONTENT_INTERACTION/Ratings.csv",
				"CONTENT_INTERACTION/MyList.csv",
				"ACCOUNT/AccountDetails.csv",
			],
		},
	},
	{
		fileName: "gdpr-data.zip",
		for: "tvtime",
		peek: {
			kind: "zip",
			entries: [
				"gdpr-data/tracking-prod-records-v2.csv",
				"gdpr-data/followed_tv_show.csv",
			],
		},
	},
	{
		fileName: "videodb.xml",
		for: "kodi",
		wrong: true,
		peek: { kind: "xml", root: "videodb", text: "" },
	},
	{
		fileName: "Library - Movies - All [1].json",
		for: "tautulli",
		peek: {
			kind: "json",
			keys: ["ratingKey", "guid", "guids", "userRating", "viewCount"],
			isArray: true,
		},
	},
	{
		fileName: "animelist_1728990000_-_123456.xml.gz",
		for: "mal",
		peek: { kind: "xml", root: "myanimelist", text: "" },
	},
	{
		fileName: "anime-list.xml",
		for: "mal",
		peek: { kind: "xml", root: "myanimelist", text: "" },
	},
	{
		fileName: "gdpr_data.json",
		for: "anilist",
		peek: {
			kind: "json",
			keys: ["user", "lists", "activity", "reviews"],
			isArray: false,
		},
	},
	{
		fileName: "kitsu-alp82-anime.xml",
		for: "kitsu",
		peek: { kind: "xml", root: "myanimelist", text: "" },
	},
	{
		fileName: "criticker-ratings.csv",
		for: "criticker",
		peek: {
			kind: "csv",
			header: [
				"Score",
				" Film Name",
				" Year",
				" Date Rated",
				" Mini Review",
				" URL",
				" IMDB ID",
			],
			firstLine: "",
		},
	},
	{
		fileName: "movielens-ratings.csv",
		for: "movielens",
		peek: {
			kind: "csv",
			header: [
				"movie_id",
				"imdb_id",
				"tmdb_id",
				"rating",
				"average_rating",
				"title",
			],
			firstLine: "",
		},
	},
	{
		fileName: "sofa-export.zip",
		for: "sofa",
		peek: {
			kind: "zip",
			entries: [
				"items.csv",
				"categories.csv",
				"attachments.csv",
				"images.csv",
				"README.md",
			],
		},
	},
	{
		fileName: "my-movies.xlsx.csv",
		for: null,
		wrong: true,
		peek: { kind: "csv", header: ["Film", "Stars", "Seen on"], firstLine: "" },
	},
]
