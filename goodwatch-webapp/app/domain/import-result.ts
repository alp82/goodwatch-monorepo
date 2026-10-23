// What an import changed, and what its Undo did, per title: the shape of GET /api/imports/:id/items?by=title and of
// GET /api/imdb-import/:id/items?by=title. Each source maps its own rows to changes with the helpers here; the
// sections are shared. Pure and shared by the server and the browser.
import type { State } from "./tracking/machine.ts"
import type { MediaType } from "./tracking/storage.ts"

/** What Undo did with a row: took it back, left it as the member changed it, or could not put it back. */
export type UndoOutcome = "reverted" | "left" | "not_restored"
/**
 * What a row's `undo_outcome` holds: an outcome, or "reverting" while Undo writes the row. A resumed Undo reads
 * a row that is already as before as its own work only when it finds the marker.
 */
export type StoredUndoOutcome = UndoOutcome | "reverting"

export interface ImportResultTitle {
	tmdbId: number
	mediaType: MediaType
	/** The catalog's title, or the export's when the catalog has none. */
	title: string
	year: number | null
	posterPath: string | null
}

/** A member's list: Want to See, Not interested, or favorites. */
export type ImportResultList = "want_to_see" | "not_interested" | "favorites"

/** A title's watches, summed up: one movie watch, or a run of episodes. Days are UTC `YYYY-MM-DD`. */
export interface ImportResultWatches {
	count: number
	/** The first and last episode, in season order; null for a movie. */
	first: { season: number; episode: number } | null
	last: { season: number; episode: number } | null
	firstDay: string | null
	lastDay: string | null
	/** Watches without a date. */
	undated: number
}

export interface ImportResultStatusChange {
	/** Null: the show had no status yet. */
	from: State | null
	to: State | null
}

export type ImportResultChange =
	| { type: "rating-added"; score: number }
	| { type: "rating-replaced"; from: number; to: number }
	/** A season, episode or part score (#759). `part` names it, such as "S1 E3"; `from` is the score it replaced. */
	| {
			type: "episode-rating-added"
			part: string
			score: number
			from: number | null
	  }
	| { type: "review-added" }
	| { type: "review-replaced" }
	| {
			type: "watches-added"
			watches: ImportResultWatches
			status: ImportResultStatusChange | null
	  }
	| { type: "status-set"; status: ImportResultStatusChange }
	| { type: "list-added"; list: "want_to_see" | "favorites" }
	| {
			type: "list-cleared"
			list: "want_to_see" | "not_interested"
			/** What took it off: a watch, a show status, or adding Want to See. */
			because: "watched" | "status" | "want"
			/** Whether Undo puts it back. */
			undoRestores: boolean
	  }
	| { type: "kept"; kind: ImportResultKind; reason: string }
	// After Undo:
	| { type: "rating-removed"; score: number }
	/** `from` is the imported rating, `to` the one Undo put back. */
	| { type: "rating-restored"; from: number; to: number }
	/** After Undo: the imported season, episode or part score is gone, or `restored` is back. */
	| {
			type: "episode-rating-removed"
			part: string
			score: number
			restored: number | null
	  }
	| { type: "review-removed" }
	| { type: "review-restored" }
	| {
			type: "watches-removed"
			watches: ImportResultWatches
			status: ImportResultStatusChange | null
	  }
	| { type: "status-restored"; status: ImportResultStatusChange }
	| { type: "list-removed"; list: "want_to_see" | "favorites" }
	/** A list choice the import took away that Undo put back. */
	| { type: "list-restored"; list: "want_to_see" | "not_interested" }
	/** A list choice the import took away that Undo could not put back. */
	| { type: "not-restored"; list: "want_to_see" | "not_interested" }
	/** A change of the import's own that Undo could not take back, such as a rating whose earlier dates are lost. */
	| { type: "not-reverted"; kind: ImportResultKind }
	/** Left as the member changed it after the import. */
	| { type: "left"; kind: ImportResultKind }
	| {
			type: "skipped"
			kind: ImportResultKind
			/** The export's title and year. */
			label: string
			/** The row of the export, from 1. */
			row: number
			reason: string
	  }

/** What a row brought: the import kinds, which IMDb shares through its ratings. */
export type ImportResultKind =
	| "rating"
	| "episode_rating"
	| "watch"
	| "want"
	| "favorite"
	| "review"
	| "show_status"
	| "unsupported"

export type ImportResultChangeType = ImportResultChange["type"]

/** The sections of the result, one per kind of change, in the order the screen shows them. */
export const IMPORT_RESULT_SECTIONS = {
	import: [
		"ratings_added",
		"ratings_replaced",
		"episode_ratings_added",
		"reviews",
		"watches_added",
		"statuses_set",
		"want_added",
		"favorites_added",
		"lists_cleared",
		"kept",
		"skipped",
	],
	undo: [
		"not_restored",
		"ratings_removed",
		"ratings_restored",
		"episode_ratings_removed",
		"reviews_reverted",
		"watches_removed",
		"statuses_restored",
		"want_removed",
		"favorites_removed",
		"lists_restored",
		"left",
	],
} as const

export type ImportResultSectionKey =
	(typeof IMPORT_RESULT_SECTIONS)[keyof typeof IMPORT_RESULT_SECTIONS][number]
export const IMPORT_RESULT_SECTION_KEYS = [
	...IMPORT_RESULT_SECTIONS.import,
	...IMPORT_RESULT_SECTIONS.undo,
] as [ImportResultSectionKey, ...ImportResultSectionKey[]]

const SECTION_OF: Record<ImportResultChangeType, ImportResultSectionKey> = {
	"rating-added": "ratings_added",
	"rating-replaced": "ratings_replaced",
	"episode-rating-added": "episode_ratings_added",
	"episode-rating-removed": "episode_ratings_removed",
	"review-added": "reviews",
	"review-replaced": "reviews",
	"review-removed": "reviews_reverted",
	"review-restored": "reviews_reverted",
	"watches-added": "watches_added",
	"status-set": "statuses_set",
	"list-added": "want_added",
	"list-cleared": "lists_cleared",
	kept: "kept",
	skipped: "skipped",
	"rating-removed": "ratings_removed",
	"rating-restored": "ratings_restored",
	"watches-removed": "watches_removed",
	"status-restored": "statuses_restored",
	"list-removed": "want_removed",
	"list-restored": "lists_restored",
	"not-restored": "not_restored",
	"not-reverted": "not_restored",
	left: "left",
}

/** Changes that leave the member's library as it was. */
const UNCHANGED: ImportResultChangeType[] = [
	"kept",
	"skipped",
	"not-restored",
	"not-reverted",
	"left",
]

/** Rows each section brings with the result; the rest come a page at a time. */
export const IMPORT_RESULT_FIRST_ROWS = 25

export interface ImportResultRow {
	/** Stable within the result: the title, or the export row for a row that matched no title. */
	key: string
	title: ImportResultTitle | null
	changes: ImportResultChange[]
}

export interface ImportResultSection {
	key: ImportResultSectionKey
	/** The number the section's heading shows: its titles, or its watches. */
	count: number
	/** Rows in the section; `rows` holds the first of them. */
	total: number
	rows: ImportResultRow[]
}

export type ImportResultOperation = "import" | "undo"

export interface ImportResult {
	/** Named custom lists are counted separately from changes to movie/show tracking. */
	customLists?: { created: number; deleted: number; notRestored?: number }
	operation: ImportResultOperation
	/** Titles the import changed, or that its Undo changed back. */
	titles: number
	sections: ImportResultSection[]
}

export interface ImportResultPage {
	rows: ImportResultRow[]
	total: number
}

/** One change a source mapped from its rows, before it is grouped by title. */
export interface ImportResultEntry {
	key: string
	title: ImportResultTitle | null
	change: ImportResultChange
}

/** Groups the entries into the sections, each a list of titles in the order the entries came. */
export function groupImportResult(
	operation: ImportResultOperation,
	entries: ImportResultEntry[],
): ImportResult {
	const sections = new Map<
		ImportResultSectionKey,
		Map<string, ImportResultRow>
	>()
	for (const entry of entries) {
		const key =
			(entry.change.type === "list-added" ||
				entry.change.type === "list-removed") &&
			entry.change.list === "favorites"
				? entry.change.type === "list-added"
					? "favorites_added"
					: "favorites_removed"
				: SECTION_OF[entry.change.type]
		const rows = sections.get(key) ?? new Map<string, ImportResultRow>()
		sections.set(key, rows)
		const row = rows.get(entry.key) ?? {
			key: entry.key,
			title: entry.title,
			changes: [],
		}
		rows.set(entry.key, row)
		row.changes.push(entry.change)
	}
	const titles = new Set(
		entries
			.filter((entry) => !UNCHANGED.includes(entry.change.type))
			.map((entry) => entry.key),
	)
	return {
		operation,
		titles: titles.size,
		sections: IMPORT_RESULT_SECTIONS[operation]
			.filter((key) => sections.has(key))
			.map((key) => {
				const rows = [...(sections.get(key)?.values() ?? [])]
				const count = rows.reduce(
					(sum, row) =>
						sum +
						row.changes.reduce(
							(n, change) =>
								n +
								(change.type === "watches-added" ||
								change.type === "watches-removed"
									? change.watches.count
									: 0),
							0,
						),
					0,
				)
				const watches = key === "watches_added" || key === "watches_removed"
				// A show can bring many season and episode scores: the heading counts the scores.
				const scores =
					key === "episode_ratings_added" || key === "episode_ratings_removed"
				return {
					key,
					count: watches
						? count
						: scores
							? rows.reduce((sum, row) => sum + row.changes.length, 0)
							: rows.length,
					total: rows.length,
					rows,
				}
			}),
	}
}

// ---------------------------------------------------------------------------------------------------------
// Mapping a source's rows: what every source shares
// ---------------------------------------------------------------------------------------------------------

export const resultTitleKey = (title: { mediaType: string; tmdbId: number }) =>
	`${title.mediaType}:${title.tmdbId}`

/** The reason a row that failed to save shows under Not imported. */
export const FAILED_REASON =
	"Couldn't be saved. Import the file again to retry."

/** "Heat (1995)", or the title alone when the export has no year. */
export const exportLabel = (title: string, year: number | null | undefined) =>
	year ? `${title} (${year})` : title

/** A row that wasn't imported, listed by the export's title and its row (`rowIndex` counts from 0). */
export const skippedEntry = (
	rowIndex: number,
	kind: ImportResultKind,
	label: string,
	reason: string,
): ImportResultEntry => ({
	key: `row:${rowIndex}`,
	title: null,
	change: { type: "skipped", kind, label, row: rowIndex + 1, reason },
})

/**
 * Why a row the member chose to import left GoodWatch as it was, or null when the row changed something.
 * `current` is the member's rating when the preview was made, for a rating conflict.
 */
export function keptReason(row: {
	outcome: string
	applyState: string | null | undefined
	keepConflicts: boolean
	kind: ImportResultKind
	current?: number | null
	reason?: string | null
}) {
	if (row.outcome === "unchanged") return "Already the same in GoodWatch."
	if (row.outcome === "conflict" && row.keepConflicts)
		return row.kind === "rating" && typeof row.current === "number"
			? `You chose to keep your GoodWatch rating of ${row.current}.`
			: row.kind === "episode_rating" && typeof row.current === "number"
				? `You chose to keep your GoodWatch score of ${row.current}.`
				: "You chose to keep what GoodWatch has."
	if (row.applyState === "kept") return row.reason ?? KEPT[row.kind]
	return null
}
const KEPT: Record<ImportResultKind, string> = {
	rating: "You changed it in GoodWatch after the preview.",
	episode_rating: "You changed it in GoodWatch after the preview.",
	review: "You changed it in GoodWatch after the preview.",
	watch: "Already in your watch log.",
	want: "Already on Want to See, or already watched.",
	favorite: "Already a favorite.",
	show_status: "Your show status in GoodWatch stays.",
	unsupported: "GoodWatch can't import this.",
}

/** What Undo did not take back: left as the member changed it, or not put back. Null for a row it took back. */
export function undoneEntry(
	key: string,
	title: ImportResultTitle,
	kind: ImportResultKind,
	outcome: StoredUndoOutcome | null,
): ImportResultEntry | null {
	if (outcome === "left") return { key, title, change: { type: "left", kind } }
	if (outcome === "not_restored")
		return { key, title, change: { type: "not-reverted", kind } }
	// Imports undone before Undo recorded its outcomes count as taken back.
	return null
}

/** A rating the import wrote: added or replaced, or after Undo, removed, put back, or what Undo didn't take back. */
export function ratingEntry(
	operation: ImportResultOperation,
	key: string,
	title: ImportResultTitle,
	before: number | null,
	after: number,
	outcome: StoredUndoOutcome | null,
): ImportResultEntry {
	if (operation === "import")
		return {
			key,
			title,
			change:
				before === null
					? { type: "rating-added", score: after }
					: { type: "rating-replaced", from: before, to: after },
		}
	return (
		undoneEntry(key, title, "rating", outcome) ?? {
			key,
			title,
			change:
				before === null
					? { type: "rating-removed", score: after }
					: { type: "rating-restored", from: after, to: before },
		}
	)
}
