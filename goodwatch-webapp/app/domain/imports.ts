import type { AnimeEntry, AnimeScorePlacement } from "./anime-mapping.ts"
import type { EpisodeScoreRange } from "./episode-scores.ts"

/** Shared import contract. IMDb keeps its existing API. */
export const IMPORT_SOURCES = [
	"imdb_list",
	"letterboxd",
	"trakt",
	"csv",
	"movielens",
	"kodi",
	"tmdb",
	"plex",
	"myanimelist",
	"wishlist",
	"tvtime",
	"mdblist",
] as const
export const IMPORT_SOURCE_NAMES = {
	imdb_list: "IMDb",
	letterboxd: "Letterboxd",
	trakt: "Trakt",
	csv: "Generic CSV",
	movielens: "MovieLens",
	kodi: "Kodi",
	tmdb: "TMDB",
	plex: "Plex",
	myanimelist: "MyAnimeList / Kitsu",
	wishlist: "Watcharr / wishlist file",
	tvtime: "TV Time",
	mdblist: "MDBList",
} as const
export type ImportSource = (typeof IMPORT_SOURCES)[number]
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024

interface ImportUploadDescriptor {
	/** The upload step's heading, when "Upload your <source> export" doesn't fit. */
	heading: string | null
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
	heading: null,
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
	imdb_list: null,
	tvtime: {
		...uploadDefaults,
		label: "ZIP, CSV or JSON",
		extensions: [".zip", ".csv", ".json"],
		accept: ".zip,.csv,.json,application/zip,text/csv,application/json",
		hint: "Drop gdpr-data.zip or another TV Time file here, or choose it from your device.",
		invalidFileMessage: "Choose a TV Time ZIP, CSV or JSON export.",
		oversizeHint: "Choose a smaller TV Time export.",
		instructions: [
			"TV Time closed on July 15, 2026, so use the export you saved before then. GoodWatch reads TV Time's own gdpr-data.zip, or the tracking CSV files inside it, and the files from the TV Time Liberator and TV Time Out browser extensions. Upload the ZIP as you saved it.",
			"If your ZIP asks for a password, open it on your computer with that password. Put the CSV files from inside it in a new ZIP without a password and upload that, or upload tracking-prod-records-v2.csv by itself.",
		],
		notes:
			"GoodWatch imports episode and movie watches and ratings, Watching and Dropped show statuses, and For later as Want to See. Movies with one verified title and release date or year match are matched automatically. Uncertain matches stay out of the import. Maximum size: 20 MB.",
	},
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
			"In Kodi, switch the settings level to Advanced, then open Settings → Media → Library → Export library → Single file. Upload videodb.xml from the kodi_videodb_YYYY-MM-DD folder, alone or zipped. Artwork folders are not needed; separate .nfo files are not supported. GoodWatch imports movie, show and episode ratings and one watch per played movie or episode. Maximum size: 20 MB.",
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
			"GoodWatch imports show statuses, episode progress, and each entry's score for its own episodes, such as S1 E1–12. An entry's score never becomes a rating of the whole show. Comments, tags and rewatch counts are not imported. MyAnimeList episode dates stay unknown unless a completed entry starts and finishes on the same day. Kitsu watches are always undated.",
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
	// One import reads Watcharr's own export and wishlist files that a tool made for GoodWatch.
	wishlist: {
		...uploadDefaults,
		heading: "Upload your Watcharr export or wishlist file",
		label: "JSON",
		extensions: [".json"],
		accept: ".json,application/json",
		acceptedMimeTypes: ["application/json"],
		hint: "Drop watcharr-export.json or your wishlist file here, or choose it from your device.",
		invalidFileMessage:
			"Choose watcharr-export.json from Watcharr, or a wishlist file made for GoodWatch.",
		oversizeHint: "Choose a smaller JSON file.",
		instructions: [
			"From Watcharr: open Settings, choose Export, then choose Export in the Export Watched List window. Upload the watcharr-export.json file it downloads, without opening or editing it.",
			"From another tool: if a tool saved your list as a wishlist file for GoodWatch, upload that file as the tool saved it.",
			"Maximum size: 20 MB.",
		],
		notes:
			"GoodWatch reads Watcharr movie and show ratings, season and episode scores, thoughts as reviews, watches, episode progress, and show statuses. Planned becomes Want to See; Finished becomes Seen. Decimal scores are rounded to whole numbers out of 10. Season and episode scores stay with their season or episode and never rate the whole show. Tags, pinned items, and games aren't applied. Wishlist files add Want to See. Titles absent from the file stay as they are.",
	},
	tmdb: null,
	plex: null,
	mdblist: null,
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
	/** A score for a season, an episode, or a part with its episode range; never a whole-show rating (#759). */
	"episode_rating",
	"watch",
	"want",
	"favorite",
	"review",
	"show_status",
	"list",
] as const
export type ImportKind = (typeof IMPORT_KINDS)[number]
export type ImportKindCounts = Record<
	Exclude<ImportKind, "list" | "episode_rating">,
	number
> & {
	list?: number
	/** Absent on previews made before season and episode scores were imported. */
	episode_rating?: number
}
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

export interface ImportCustomList {
	sourceId: string
	name: string
	description: string
	entries: { position: number; note: string; entry: ImportObservation }[]
	/** Allocated before creation; stable across retry/resume of this import only. */
	createdId?: string
	createdContentHash?: string
	undoReason?: string
}
export interface ImportObservation {
	customList?: ImportCustomList

	/** Original IMDb list data; notes are not reviews and Created/Date Rated are never watch dates. */
	imdbList?: {
		kind: "watchlist" | "custom-list"
		position: string
		created: string
		modified: string
		description: string
		dateRated: string
		rawRating: string
	}

	/** Watcharr completion snapshots fill missing watches; they never add a repeat to activity history. */
	watcharrSnapshot?: boolean
	/** Immutable normalized TV Time evidence before any catalog enrichment. */
	resolutionOriginal?: Omit<ImportObservation, "resolutionOriginal">

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
	/** TheTVDB parent identity; source coordinates never imply TMDB numbering. */
	showTvdbId?: number | null
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
	/**
	 * episode_rating rows: what the score is for. A season uses `season`; an episode uses the episode fields and is
	 * resolved like a watch; a part keeps its episode range in `scoreRanges` (an anime cour), filled by the preview.
	 */
	scoreScope?: "season" | "episode" | "part"
	scoreRanges?: EpisodeScoreRange[]
	/** A part's own name at its source, such as a MyAnimeList entry's title. */
	scoreLabel?: string
	score?: number | null
	review?: string | null
	watchedAt?: string | null
	precision?: "moment" | "day" | "unknown"
	pass?: number
	addedAt?: string | null
	/** Source evidence only; native service IDs never stand in for catalog IDs. */
	wishlistEvidence?: {
		source: string
		profileLabel?: string
		country?: string
		exportedAt?: string
		completeness: "complete" | "partial" | "unknown"
		sourceId?: string
		sourceSeen?: boolean
		sourceSeenAt?: string
		sourceUrl?: string
		mediaType: "movie" | "show" | "unknown" | "season" | "episode"
	}
	/** Validated source observation, captured before matching; never replaced by a member choice. */
	wishlistOriginal?: WishlistOriginalObservation
	/** Official TV Time movie identity; never a catalog ID. */
	tvtimeMovie?: {
		sourceId?: string
		releaseDate: string | null
		country?: string
	}
	/** Server-derived holds after canonical duplicate grouping. */
	wishlistShowChoice?: boolean
	wishlistRewatchChoice?: boolean
	wishlistResolution?: {
		basis: "member" | "automatic"
		suggestionProof?: TvtimeSuggestionProof
		mediaType: ImportMediaType
		tmdbId: number
		title: string
		year: number | null
		selectedAt: string
		parentImportId: string
		parentRowIndex: number
	}
	/** Server-owned eligibility survives a manual selection and subsequent clearing. */
	wishlistMatchRequired?: "id_conflict"
	wishlistIdConflict?: {
		candidates: {
			suppliedId: "tmdb" | "imdb"
			mediaType: ImportMediaType
			tmdbId: number
			title: string
			year: number | null
		}[]
		suggestion: {
			mediaType: ImportMediaType
			tmdbId: number
			signal: "interaction" | "metadata" | "popularity"
		} | null
	}
	wishlistParent?: { importId: string; rowIndex: number }
	problem?: {
		code?: string
		outcome: "invalid" | "unsupported" | "unmatched"
		reason: string
	}
}

export type WishlistMatchErrorCode =
	| "tvtime_movie_match_required"
	| "wishlist_preview_required"
	| "wishlist_snapshot_required"
	| "wishlist_resolution_invalid"
	| "wishlist_row_not_resolvable"
	| "wishlist_source_choice_conflict"
	| "wishlist_target_missing"
	| "wishlist_search_invalid"
	| "wishlist_search_unavailable"
	| "wishlist_body_too_large"
	| "method_not_allowed"

export interface WishlistOriginalObservation {
	season?: number
	episode?: number
	key: string
	kind: "want" | "watch" | "rating"
	/** Server-owned eligibility for official title-only TV Time movie intents. */
	manualMatchScope?: "tvtime_movie"
	tvtimeMovie?: ImportObservation["tvtimeMovie"]
	watchedAt?: ImportObservation["watchedAt"]
	precision?: ImportObservation["precision"]
	pass?: number
	score?: number | null
	mediaType: "movie" | "show" | "unknown" | "season" | "episode"
	title: string
	year: number | null
	tmdbId: number | null
	imdbId: string | null
	addedAt?: string | null
	wishlistEvidence: NonNullable<ImportObservation["wishlistEvidence"]>
	problem?: ImportObservation["problem"]
}

export interface TvtimeSuggestionProof {
	rule:
		| "tvtime_exact_title_release_date_v1"
		| "tvtime_exact_title_release_year_v1"
	mediaType: "movie"
	tmdbId: number
	sourceFingerprint: string
	title: {
		value: string
		kind: "primary" | "original" | "alternative" | "translation"
		country?: string
		locale: string
	}
	date: {
		value: string
		basis: "primary" | "country" | "year"
		country?: string
		releaseType?: number
	}
	candidateCount: 1
	sourceCountry: string | null
	verifiedCandidates: number
	/** Search-result year pruning; absent on older proofs. */
	discoveredCandidates?: number
	yearExcludedCandidates?: number
	searchYearWindow?: {
		sourceYear: number
		toleranceYears: 1
		countryExactTitleException?: true
	}
	discoveryBound: { pages: 5; candidates: 100 }
	discoveryComplete: true
	pages: number
	verifiedAt: string
}

export interface WishlistSuggestionProposal {
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	year: number | null
	posterPath: string | null
}
export type WishlistSuggestionReason =
	| "unsupported_source"
	| "conflicting_source_evidence"
	| "no_native_id_match"
	| "ambiguous_native_id"
	| "source_metadata_conflict"
	| "catalog_unavailable"
	| "tvtime_suggestion_search_incomplete"
	| "tvtime_suggestion_unavailable"
	| "tvtime_suggestion_no_exact_match"
	| "tvtime_suggestion_ambiguous"
	| "tvtime_suggestion_catalog_missing"
	| "tvtime_suggestion_rejected"
	| "tvtime_suggestion_pending"
	| "tvtime_lookup_budget_exhausted"
export interface WishlistSuggestion {
	suggestionId?: string
	proof?: TvtimeSuggestionProof

	representativeIndex: number
	state: "suggested" | "manual" | "unavailable" | "already_resolved"
	proposal?: WishlistSuggestionProposal
	reason?: WishlistSuggestionReason
}
export interface WishlistSuggestions {
	bulkAccept?: {
		token: string | null
		eligibleCount: number
		previewId: string
		generation: number
		expiresAt: string
	}

	groups: WishlistSuggestion[]
	total: number
	offset: number
	hasMore: boolean
	nextOffset: number | null
}

/** Actionable failures stay visible; export context may be collapsed. */
export interface ImportWarning {
	kind: "actionable" | "info"
	message: string
}
export const importInfo = (message: string): ImportWarning => ({
	kind: "info",
	message,
})
export const importActionable = (message: string): ImportWarning => ({
	kind: "actionable",
	message,
})

/** Stored previews from before warning kinds existed are kept visible conservatively. */
export const normalizeImportWarnings = (
	warnings: (ImportWarning | string)[],
): ImportWarning[] =>
	warnings.map((warning) =>
		typeof warning === "string" ? importActionable(warning) : warning,
	)

export interface ParsedImport {
	source: ImportSource
	observations: ImportObservation[]
	warnings: ImportWarning[]
}

export interface ImportItem extends ImportObservation {
	index: number
	outcome: ImportOutcome
	reason: string | null
	currentScore?: number | null
	applyState?:
		| "added"
		| "updated"
		| "kept"
		| "failed"
		| "undone"
		| `waiting:${ImportQuestion}`
		| `approved:${ImportQuestion}`
		| null
}

/** Wishlist evidence whose Seen titles get their own Want to rewatch answer; others ride on the conflict choice. */
export const REWATCH_QUESTION_EVIDENCE = [
	"watcharr",
	"imdb-watchlist",
	"mdblist",
]

/**
 * Whether confirm decides a row by the conflict choice (keep GoodWatch's, or use the source's) rather than by a
 * wishlist answer. A row held only for the whole-show answer carries `wishlistRewatchChoice: false` and never does.
 */
export const followsConflictChoice = (
	item: Pick<
		ImportItem,
		"outcome" | "wishlistRewatchChoice" | "wishlistEvidence"
	>,
) =>
	item.outcome === "conflict" &&
	(item.wishlistRewatchChoice
		? !REWATCH_QUESTION_EVIDENCE.includes(item.wishlistEvidence?.source ?? "")
		: item.wishlistRewatchChoice !== false)

/** Resolve today's source-specific consent without changing the stored options. */
export function effectiveImportOptions(
	item: Pick<ImportItem, "wishlistEvidence">,
	options: ImportOptions,
): ImportOptions {
	return {
		...options,
		wishlistRewatch: REWATCH_QUESTION_EVIDENCE.includes(
			item.wishlistEvidence?.source ?? "",
		)
			? options.wishlistRewatch === true
			: options.conflictChoice === "source",
	}
}

/**
 * Pure eligibility boundary before any writes. Future question holds can be returned here;
 * today every row either keeps GoodWatch's data or passes with legacy effective options.
 */
export function importGate(
	item: ImportItem,
	options: ImportOptions,
): { kept: true } | { effective: ImportOptions } {
	const effective = effectiveImportOptions(item, options)
	if (
		item.kind === "unsupported" ||
		!effective.kinds.includes(item.kind) ||
		["unmatched", "unsupported", "invalid", "unchanged"].includes(item.outcome)
	)
		return { kept: true }
	if (
		item.outcome === "conflict" &&
		((item.wishlistShowChoice && effective.wishlistShows !== true) ||
			(item.wishlistRewatchChoice
				? !effective.wishlistRewatch
				: item.wishlistRewatchChoice !== false &&
					effective.conflictChoice === "keep"))
	)
		return { kept: true }
	return { effective }
}

export const IMPORT_QUESTIONS = [
	"conflict",
	"rewatch",
	"wholeShow",
	"undated",
] as const
export type ImportQuestion = (typeof IMPORT_QUESTIONS)[number]
export type ImportAnswer = "keep" | "source" | "add" | "leave"

export interface WishlistMatchEvidenceVariant {
	title: string
	year: number | null
	sourceId?: string
	sourceUrl?: string
	/** TV Time keeps the complete source release date, separately from catalog year. */
	releaseDate?: string | null
	country?: string
}
export interface WishlistMatchGroup {
	representativeIndex: number
	item: ImportItem
	entryCount: number
	evidenceVariants: WishlistMatchEvidenceVariant[]
	hasMoreEvidence: boolean
	matchScope?: "tvtime_movie"
	allowedMediaTypes?: ["movie"]
	intentCounts?: Partial<Record<ImportKind, number>>
}

export interface ImportOptions {
	/** Independent, explicit Watcharr Want to rewatch consent; never implied by rating conflicts. */
	wishlistRewatch?: boolean
	/** Explicit conversion of source season/episode wishes to whole-show wishes. */
	wishlistShows?: boolean
	kinds: ImportKind[]
	conflictChoice: "keep" | "source"
	/** Preselected as "preserve" (owner rule, fewest steps); never inferred from clusters of equal timestamps. */
	watchDates: "preserve" | "unknown"
}

export interface ImportSummary {
	resolution?: {
		jobId: string
		state: string
		phase: string
		total: number
		processed: number
		matched: number
		held: number
		pending: number
		failedByCode: Record<string, number>
		failed: number
		heldByCode: Record<string, number>
		attempts: number
		updatedAt: string
		deadline: string
		replacementId: string | null
	}

	id: string
	source: ImportSource
	fileName: string
	status: ImportStatus
	createdAt: string
	finishedAt: string | null
	counts: Record<ImportOutcome, number> & { rows: number }
	kinds: ImportKindCounts
	warnings: ImportWarning[]
	options: ImportOptions | null
	processed: number
	total: number
	applied: { added: number; updated: number; kept: number; failed: number }
	stalled: boolean
	/** Manually matchable source groups (unknown type or conflicting IDs), including resolved groups. */
	wishlistMatchCount?: number
	/** Of those groups, the ones without a member's match yet. Absent on previews made before it was counted. */
	wishlistUnresolvedMatchCount?: number
	wishlistShowChoiceCount?: number
	wishlistRewatchChoiceCount?: number
	/** TV Time rows left unmatched because this preview reached its lookup limit; a rerun can match more. */
	tvtimeLookupLimitCount?: number
	/** TV Time rows left unmatched because TMDB's TVDB lookup was unavailable. */
	tvtimeLookupUnavailableCount?: number
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
