/** Shared contract for native Letterboxd and Trakt exports. IMDb keeps its existing API. */
export const IMPORT_SOURCES = ["letterboxd", "trakt"] as const
export type ImportSource = (typeof IMPORT_SOURCES)[number]
export const IMPORT_KINDS = [
	"rating",
	"watch",
	"want",
	"favorite",
	"review",
] as const
export type ImportKind = (typeof IMPORT_KINDS)[number]
export type ImportMediaType = "movie" | "show"
export type ImportOutcome =
	| "new"
	| "unchanged"
	| "conflict"
	| "unmatched"
	| "unsupported"
	| "invalid"
export type ImportStatus = "preview" | "running" | "done" | "failed" | "undone"
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024
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
	episodeTmdbId?: number | null
	season?: number | null
	episode?: number | null
	score?: number | null
	review?: string | null
	watchedAt?: string | null
	precision?: "moment" | "day" | "unknown"
	pass?: number
	addedAt?: string | null
	problem?: { outcome: "invalid" | "unsupported"; reason: string }
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

// POST /api/imports/preview: multipart FormData { source, file }; returns { import }.
// GET /api/imports: { imports }; GET /api/imports/:id: { import }.
// GET /api/imports/:id/items?offset=0&limit=50&outcome=unmatched: { items, total }.
// POST /api/imports/:id/confirm: ImportOptions JSON; returns { import }.
// POST /api/imports/:id/undo: returns { import }.
// GET /api/imports/:id/skipped: CSV of unapplied rows and reasons.
// All errors: { error: string }, all routes require a member and private/no-store responses.
