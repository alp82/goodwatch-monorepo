// IMDb ratings import: a member uploads the ratings CSV that IMDb exports, reviews a preview, and confirms.
// These are the shapes the `/api/imdb-import/*` endpoints return and the Imports settings page draws.
// Pure and shared by the server and the browser. See docs/research/imdb-ratings-import.md.

/** Where an import is in its life. `preview` has written nothing to the member's ratings yet. */
export type ImdbImportStatus = "preview" | "running" | "done" | "failed" | "undone"

/** What to do with titles whose GoodWatch rating differs from the file. */
export type ImdbConflictChoice = "keep" | "imdb"

/**
 * What the import does with one row of the file. Every row has exactly one outcome,
 * so the counts always add up to the number of rows in the file.
 */
export const IMDB_IMPORT_OUTCOMES = [
	// No GoodWatch rating yet: the IMDb rating is added.
	"new",
	// The rating came from an earlier import, wasn't touched in GoodWatch since, and changed on IMDb: it is updated.
	"update",
	// GoodWatch already has this rating.
	"unchanged",
	// GoodWatch has a different rating the member set or removed themselves. Follows the conflict choice.
	"conflict",
	// The IMDb ID isn't in the GoodWatch catalog.
	"unmatched",
	// A title type GoodWatch doesn't rate, such as an episode, a short or a game.
	"unsupported",
	// The row can't be read: no IMDb ID, no rating from 1 to 10, or the same title twice with different ratings.
	"invalid",
] as const

export type ImdbImportOutcome = (typeof IMDB_IMPORT_OUTCOMES)[number]

export type ImdbImportCounts = Record<ImdbImportOutcome, number> & {
	/** Data rows in the file. Equals the sum of the outcomes. */
	rows: number
}

/** What a finished or running import has written so far. */
export interface ImdbImportApplied {
	added: number
	updated: number
	/** Conflicts where the GoodWatch rating was kept. */
	kept: number
	/** Rows that could not be written and can be retried. */
	failed: number
}

export interface ImdbImportSummary {
	id: string
	status: ImdbImportStatus
	fileName: string
	/** ISO timestamps. */
	createdAt: string
	finishedAt: string | null
	counts: ImdbImportCounts
	/** Null until the import is confirmed. */
	conflictChoice: ImdbConflictChoice | null
	/** Progress of a running import: rows written out of rows to write. */
	processed: number
	total: number
	applied: ImdbImportApplied
	/** Imported titles that have no fingerprint yet, so they don't count toward Taste. Null until known. */
	withoutFingerprint: number | null
	/** A running import that stopped making progress and can be resumed by confirming again. */
	stalled: boolean
	/** A done import whose writes can still be reversed. */
	canUndo: boolean
	/** A message for the member when status is `failed`. */
	error: string | null
}

export interface ImdbImportItem {
	/** `tt…`, or the raw value for an invalid row. */
	imdbId: string
	title: string
	year: number | null
	/** The `Title Type` label from the file, such as "Movie" or "TV Series". */
	titleType: string
	/** The member's IMDb rating, 1 to 10. Null for an invalid row. */
	imdbScore: number | null
	/** `YYYY-MM-DD` as in the file. It is the date rated, never a watch date. */
	dateRated: string | null
	outcome: ImdbImportOutcome
	/** One short sentence for unmatched, unsupported, invalid and conflict rows. */
	reason: string | null
	tmdbId: number | null
	mediaType: "movie" | "show" | null
	/** The member's GoodWatch rating when the preview was made. */
	currentScore: number | null
}

// POST /api/imdb-import/preview, JSON body. Parses, matches and stores a preview. Writes no ratings.
export interface ImdbImportPreviewRequest {
	fileName: string
	/** The file's text. */
	csv: string
}

/** The largest file the preview accepts, in bytes of text. */
export const IMDB_IMPORT_MAX_BYTES = 10 * 1024 * 1024

// GET  /api/imdb-import                 -> ImdbImportListResponse (newest first; abandoned previews left out)
// POST /api/imdb-import/preview         -> ImdbImportResponse
// GET  /api/imdb-import/:id             -> ImdbImportResponse
// GET  /api/imdb-import/:id/items       -> ImdbImportItemsResponse (?outcome=…&offset=0&limit=50)
// POST /api/imdb-import/:id/confirm     -> ImdbImportResponse (body: ImdbImportConfirmRequest; starts or resumes)
// POST /api/imdb-import/:id/undo        -> ImdbImportResponse
// GET  /api/imdb-import/:id/skipped     -> text/csv download of the unmatched, unsupported and invalid rows
// Errors are `{ error: string }` with a 4xx or 5xx status; the message is written for the member.

export interface ImdbImportResponse {
	import: ImdbImportSummary
}

export interface ImdbImportListResponse {
	imports: ImdbImportSummary[]
}

export interface ImdbImportItemsResponse {
	items: ImdbImportItem[]
	total: number
}

export interface ImdbImportConfirmRequest {
	conflictChoice: ImdbConflictChoice
}

export interface ImdbImportError {
	error: string
}

export const IMDB_RATINGS_URL = "https://www.imdb.com/list/ratings"
export const IMDB_EXPORTS_URL = "https://www.imdb.com/exports"
