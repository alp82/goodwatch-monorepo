// What an import changed, and what its Undo did, per title: the shape of GET /api/imports/:id/items?by=title and of
// GET /api/imdb-import/:id/items?by=title. Each source maps its own rows to changes; the sections are shared.
// Pure and shared by the server and the browser.

export type ImportResultMediaType = "movie" | "show"

export interface ImportResultTitle {
	tmdbId: number
	mediaType: ImportResultMediaType
	/** The catalog's title, or the export's when the catalog has none. */
	title: string
	year: number | null
	posterPath: string | null
}

export type ImportResultList = "Want to See" | "Not interested" | "Favorites"
export type ImportResultShowState =
	| "not_started"
	| "watching"
	| "on_hold"
	| "dropped"
	| "seen"

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
	from: ImportResultShowState | null
	to: ImportResultShowState | null
}

export type ImportResultChange =
	| { type: "rating-added"; score: number }
	| { type: "rating-replaced"; from: number; to: number }
	| { type: "review-added" }
	| { type: "review-replaced" }
	| {
			type: "watches-added"
			watches: ImportResultWatches
			status: ImportResultStatusChange | null
	  }
	| { type: "status-set"; status: ImportResultStatusChange }
	| { type: "list-added"; list: "Want to See" | "Favorites" }
	| {
			type: "list-cleared"
			list: "Want to See" | "Not interested"
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
	| { type: "review-removed" }
	| { type: "review-restored" }
	| {
			type: "watches-removed"
			watches: ImportResultWatches
			status: ImportResultStatusChange | null
	  }
	| { type: "status-restored"; status: ImportResultStatusChange }
	| { type: "list-removed"; list: "Want to See" | "Favorites" }
	/** A list choice the import took away that Undo put back. */
	| { type: "list-restored"; list: "Want to See" | "Not interested" }
	/** A list choice the import took away that Undo could not put back. */
	| { type: "not-restored"; list: "Want to See" | "Not interested" }
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
	| "watch"
	| "want"
	| "favorite"
	| "review"
	| "show_status"
	| "unsupported"

export type ImportResultChangeType = ImportResultChange["type"]

/** The lists of variation A, in the order the screen shows them. */
export const IMPORT_RESULT_SECTIONS = {
	import: [
		"ratings_added",
		"ratings_replaced",
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
	left: "left",
}

/** Changes that leave the member's library as it was. */
const UNCHANGED: ImportResultChangeType[] = [
	"kept",
	"skipped",
	"not-restored",
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

export interface ImportResult {
	operation: "import" | "undo"
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
	operation: ImportResult["operation"],
	entries: ImportResultEntry[],
) {
	const sections = new Map<
		ImportResultSectionKey,
		Map<string, ImportResultRow>
	>()
	for (const entry of entries) {
		const key =
			(entry.change.type === "list-added" ||
				entry.change.type === "list-removed") &&
			entry.change.list === "Favorites"
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
				return {
					key,
					count: watches ? count : rows.length,
					total: rows.length,
					rows,
				}
			}),
	}
}
