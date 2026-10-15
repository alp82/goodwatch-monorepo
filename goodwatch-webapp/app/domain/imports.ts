import type { AnimeEntry, AnimeScorePlacement } from "./anime-mapping.ts"

/** Shared import contract. IMDb keeps its existing API. */
export const IMPORT_SOURCES = [
	"letterboxd",
	"trakt",
	"csv",
	"movielens",
	"kodi",
	"tmdb",
	"myanimelist",
] as const
export const IMPORT_SOURCE_NAMES = {
	letterboxd: "Letterboxd",
	trakt: "Trakt",
	csv: "Generic CSV",
	movielens: "MovieLens",
	kodi: "Kodi",
	tmdb: "TMDB",
	myanimelist: "MyAnimeList / Kitsu",
} as const
export type ImportSource = (typeof IMPORT_SOURCES)[number]
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024

interface ImportUploadDescriptor {
	label: string
	accept: string
	extensions: readonly string[]
	acceptedMimeTypes: readonly string[]
	hint: string
	invalidFileMessage: string
	oversizeHint: string
	optionalWishlist: boolean
	instructions: readonly string[]
	exportUrl: string | null
	exportLabel: string | null
	notes: string
	credits: readonly { name: string; url: string; purpose: string }[]
}
const uploadDefaults: ImportUploadDescriptor = {
	label: "",
	accept: "",
	extensions: [],
	acceptedMimeTypes: [],
	hint: "",
	invalidFileMessage: "",
	oversizeHint: "",
	optionalWishlist: false,
	instructions: [],
	exportUrl: null,
	exportLabel: null,
	notes: "",
	credits: [],
}
const zipUpload = {
	...uploadDefaults,
	label: "ZIP",
	extensions: [".zip"],
	accept: ".zip,application/zip,application/x-zip-compressed",
	acceptedMimeTypes: ["application/zip", "application/x-zip-compressed"],
	invalidFileMessage:
		"Choose the ZIP file you downloaded from Letterboxd or Trakt.",
	oversizeHint: "Choose a smaller export ZIP file.",
	notes:
		"GoodWatch reads ratings, watches, your watchlist, favorites, and reviews when present. Maximum ZIP size: 20 MB.",
}
const csvUpload = {
	...uploadDefaults,
	label: "CSV",
	extensions: [".csv"],
	accept: ".csv,text/csv",
	hint: "Drop your CSV file here, or choose it from your device.",
	invalidFileMessage: "Choose a CSV export file.",
	oversizeHint: "Choose a smaller export CSV file.",
}
/** One source of truth for file controls, validation, instructions and receipt credits. */
export const IMPORT_SOURCE_UPLOAD = {
	letterboxd: {
		...zipUpload,
		hint: "Drop the ZIP file from Letterboxd here, or choose it from your device.",
		instructions: [
			"Sign in to Letterboxd, open Settings → Data, and choose Export Data. Wait for the download, then upload the ZIP without extracting it.",
		],
		exportUrl: "https://letterboxd.com/user/exportdata/",
	},
	trakt: {
		...zipUpload,
		hint: "Drop the ZIP file from Trakt here, or choose it from your device.",
		instructions: [
			"Sign in to Trakt, open Profile → Settings → Data, and choose Export now. This export is available to free and VIP members. Wait for the download, then upload the ZIP without extracting it.",
		],
		exportUrl: "https://app.trakt.tv/settings/data",
	},
	csv: {
		...csvUpload,
		instructions: [
			"Upload a CSV in Letterboxd import format. Include tmdbID, imdbID, or Title and Year. Rating uses 0.5–5; Rating10 uses 1–10 and takes priority. Only WatchedDate (or Watched Date) creates a dated watch. Maximum size: 20 MB.",
		],
	},
	movielens: {
		...csvUpload,
		optionalWishlist: true,
		instructions: [
			"Sign in to MovieLens, open Settings → Import or export, and download your ratings and, optionally, wishlist. Choose the original CSV files below. Combined maximum size: 20 MB.",
		],
		exportUrl: "https://movielens.org/profile/settings/import-export",
		notes:
			"Ratings and Want to See are imported without viewing dates. Tags and activity logs are not applied. You will review everything before GoodWatch changes your library.",
	},
	kodi: {
		...uploadDefaults,
		label: "XML or ZIP",
		extensions: [".xml", ".zip"],
		accept:
			".xml,application/xml,text/xml,.zip,application/zip,application/x-zip-compressed",
		hint: "Drop videodb.xml or its ZIP here, or choose it from your device.",
		invalidFileMessage:
			"Choose videodb.xml or a ZIP from Kodi’s Single file export, not separate .nfo files.",
		oversizeHint: "Upload videodb.xml by itself.",
		instructions: [
			"In Kodi, switch the settings level to Advanced, then open Settings → Media → Library → Export library → Single file. Upload videodb.xml from the kodi_videodb_YYYY-MM-DD folder, alone or zipped. Artwork folders are not needed; separate .nfo files are not supported. GoodWatch imports movie and show ratings and one watch per played movie or episode. Maximum size: 20 MB.",
		],
	},
	myanimelist: {
		...uploadDefaults,
		label: "XML or gzip",
		extensions: [".xml", ".gz"],
		accept:
			".xml,application/xml,text/xml,.gz,application/gzip,application/x-gzip",
		hint: "Drop your anime XML or gzip file here, or choose it from your device.",
		invalidFileMessage:
			"Choose a MyAnimeList or Kitsu anime XML or gzip export.",
		oversizeHint: "Choose a smaller export XML or gzip file.",
		instructions: [
			"Sign in to MyAnimeList, open its export page, select Export my: Anime List, and choose Export My List. Upload animelist_*.xml.gz as downloaded, or the extracted .xml. Maximum size: 20 MB.",
			"For Kitsu, try Settings → Export → Download Anime Library and upload kitsu-<slug>-anime.xml. This download is not available to every member.",
		],
		exportUrl: "https://myanimelist.net/panel.php?go=export",
		exportLabel: "MyAnimeList",
		notes:
			"GoodWatch imports show statuses and episode progress. Season scores are kept for later and not applied as show ratings. Comments, tags and rewatch counts are not imported. MyAnimeList episode dates stay unknown unless a completed entry starts and finishes on the same day. Kitsu watches are always undated.",
		credits: [
			{
				name: "Anime-Lists",
				url: "https://github.com/Anime-Lists/anime-lists",
				purpose: "Anime episode mapping",
			},
			{
				name: "Fribb",
				url: "https://github.com/Fribb/anime-lists",
				purpose: "Anime identities",
			},
		],
	},
	tmdb: null,
} satisfies Record<ImportSource, ImportUploadDescriptor | null>
export type FileImportSource = {
	[Source in ImportSource]: (typeof IMPORT_SOURCE_UPLOAD)[Source] extends ImportUploadDescriptor
		? Source
		: never
}[ImportSource]
export const isFileImportSource = (
	source: ImportSource,
): source is FileImportSource => IMPORT_SOURCE_UPLOAD[source] !== null
export const IMPORT_KINDS = [
	"rating",
	"watch",
	"want",
	"favorite",
	"review",
	"show_status",
] as const
export type ImportKind = (typeof IMPORT_KINDS)[number]
export const IMPORT_SHOW_STATUS_LABELS = {
	watching: "Watching",
	on_hold: "On hold",
	dropped: "Dropped",
	plan_to_watch: "Plan to watch → Want to See",
	completed: "Completed → Seen",
} as const
export type ImportShowStatus =
	| "watching"
	| "on_hold"
	| "dropped"
	| "plan_to_watch"
	| "completed"
export function isApplicableStatus(
	status: unknown,
): status is Exclude<ImportShowStatus, "plan_to_watch"> {
	return (
		status === "watching" ||
		status === "on_hold" ||
		status === "dropped" ||
		status === "completed"
	)
}

/** Plan to watch is an intention, and must never replace tracking or existing watches. */
export const canImportWantToSee = (
	state: string | null | undefined,
	hasWatches: boolean,
) => (!state || state === "not_started") && !hasWatches

export type ImportMediaType = "movie" | "show"
export type ImportOutcome =
	| "new"
	| "unchanged"
	| "conflict"
	| "unmatched"
	| "unsupported"
	| "invalid"
export type ImportStatus = "preview" | "running" | "done" | "failed" | "undone"
export const IMPORT_MAX_ROWS = 50_000

export interface ImportObservation {
	/** Stable within the source, independent of upload/archive and mutable watch dates. */
	key: string
	kind: ImportKind | "unsupported"
	mediaType: ImportMediaType
	title: string
	year: number | null
	tmdbId: number | null
	imdbId: string | null
	/** Tracker entry scope; progress expands to episode watches, never a whole-show Seen. */
	animeEntry?: AnimeEntry
	episodeTmdbId?: number | null
	episodeTvdbId?: number | null
	episodeName?: string | null
	/** Coordinates are usable only when the adapter explicitly knows their numbering. */
	episodeNumbering?: "tmdb" | "unknown"
	/** Explicit TMDB group, or a Netflix/part-count hint; label names its part/volume. */
	episodeGroup?: { id?: string; label: string; groupCount?: number }
	/** Special: applied, but never contributes to regular progress. */
	episodeSpecial?: boolean
	season?: number | null
	episode?: number | null
	/** Show-level source status; never an episode or season status. */
	showStatus?: ImportShowStatus
	/** Completed only means Seen with explicit coverage of the whole matched TMDB show. */
	completionScope?: "show" | "part"
	/** Entry score placement retained in the receipt, not applied to user_score. */
	animeScorePlacement?: AnimeScorePlacement
	score?: number | null
	review?: string | null
	watchedAt?: string | null
	precision?: "moment" | "day" | "unknown"
	pass?: number
	addedAt?: string | null
	problem?: {
		outcome: "invalid" | "unsupported" | "unmatched"
		reason: string
	}
}

export interface ParsedImport {
	source: ImportSource
	observations: ImportObservation[]
	warnings: string[]
}

export interface ImportItem extends ImportObservation {
	index: number
	outcome: ImportOutcome
	reason: string | null
	currentScore?: number | null
	applyState?: "added" | "updated" | "kept" | "failed" | "undone" | null
}

export interface ImportOptions {
	kinds: ImportKind[]
	conflictChoice: "keep" | "source"
	/** Explicit choice; never inferred from clusters of equal timestamps. */
	watchDates: "preserve" | "unknown"
}

export interface ImportSummary {
	id: string
	source: ImportSource
	fileName: string
	status: ImportStatus
	createdAt: string
	finishedAt: string | null
	counts: Record<ImportOutcome, number> & { rows: number }
	kinds: Record<ImportKind, number>
	warnings: string[]
	options: ImportOptions | null
	processed: number
	total: number
	applied: { added: number; updated: number; kept: number; failed: number }
	stalled: boolean
	canUndo: boolean
	error: string | null
	/** The durable direction of a running/failed job, so Resume continues the same operation. */
	operation?: "apply" | "undo"
}

// POST /api/imports/preview: multipart FormData { source, file, wishlist? } (wishlist is MovieLens only); returns { import }.
// GET /api/imports: { imports }; GET /api/imports/:id: { import }.
// GET /api/imports/:id/items?offset=0&limit=50&outcome=unmatched: { items, total }.
// POST /api/imports/:id/confirm: ImportOptions JSON; returns { import }.
// POST /api/imports/:id/undo: returns { import }.
// GET /api/imports/:id/skipped: CSV of unapplied rows and reasons.
// All errors: { error: string }, all routes require a member and private/no-store responses.

/** Opaque IDs used in import return URLs and connect cookies. */
export const IMPORT_ID_PATTERN =
	/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
