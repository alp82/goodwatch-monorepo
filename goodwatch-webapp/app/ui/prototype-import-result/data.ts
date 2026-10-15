// PROTOTYPE - throwaway (#651). Sample receipt for one Generic CSV import and its Undo, grouped per title.
// Every change carries `source`: where today's import journal already holds it, or that it needs new data.
//   item     the import item row itself (outcome, reason, apply_state, observation payload)
//   journal  the rating/list journal in the item payload ({ before, after, stamp }); the items API strips it today
//   plan     the per-title tracking plan (kind 'state' row: watches, clear[], before/after show state); hidden today
//   new      not stored anywhere today; the build needs to record it
import { titleToDashed } from "~/utils/helpers"

export type Source = "item" | "journal" | "plan" | "new"
export type MediaType = "movie" | "show"
export type ListName = "Want to See" | "Not interested"

export interface Watch {
	/** "S1 E3" for an episode; null for a movie. */
	episode: string | null
	/** ISO day, or null when the export had no date or the member chose unknown dates. */
	date: string | null
}

export type ImportChange =
	| { type: "rating-added"; score: number; source: Source }
	| { type: "rating-replaced"; from: number; to: number; source: Source }
	| { type: "watches-added"; watches: Watch[]; source: Source }
	| { type: "status-set"; to: string; source: Source }
	| { type: "list-added"; list: ListName; source: Source }
	| { type: "list-cleared"; list: ListName; because: string; source: Source }
	| { type: "kept"; what: string; reason: string; source: Source }

export type UndoChange =
	| { type: "rating-removed"; score: number; source: Source }
	| { type: "rating-restored"; from: number; to: number; source: Source }
	| { type: "watches-removed"; watches: Watch[]; source: Source }
	| { type: "status-restored"; from: string; to: string; source: Source }
	| { type: "list-removed"; list: ListName; source: Source }
	| { type: "left-alone"; what: string; reason: string; source: Source }
	| { type: "not-restored"; list: ListName; source: Source }

export interface Title {
	tmdbId: number
	mediaType: MediaType
	title: string
	year: number
	importChanges: ImportChange[]
	undoChanges: UndoChange[]
}

export interface SkippedRow {
	row: number
	label: string
	kind: string
	outcome: "unmatched" | "invalid" | "unsupported"
	reason: string
}

export const titlePath = (t: { mediaType: MediaType; tmdbId: number; title: string }) =>
	`/${t.mediaType}/${t.tmdbId}-${titleToDashed(t.title)}`

export const formatDay = (iso: string | null) =>
	iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { dateStyle: "medium" }) : "No date"

const episodes = (season: number, from: number, to: number, dates: string[]): Watch[] =>
	Array.from({ length: to - from + 1 }, (_, i) => ({ episode: `S${season} E${from + i}`, date: dates[i] ?? dates.at(-1) ?? null }))

export const IMPORT = {
	source: "Generic CSV",
	fileName: "my-movies-and-shows.csv",
	finishedAt: "October 15, 2026",
	rows: 31,
	warnings: ["Tags, Directors and Rewatch metadata are not applied. Each dated row represents one watch; a rewatch flag does not create extra watches."],
}

export const TITLES: Title[] = [
	{
		tmdbId: 693134,
		mediaType: "movie",
		title: "Dune: Part Two",
		year: 2024,
		importChanges: [
			{ type: "rating-added", score: 9, source: "journal" },
			{ type: "watches-added", watches: [{ episode: null, date: "2024-03-09" }], source: "plan" },
			{ type: "list-cleared", list: "Want to See", because: "you watched it", source: "plan" },
		],
		undoChanges: [
			{ type: "rating-removed", score: 9, source: "journal" },
			{ type: "watches-removed", watches: [{ episode: null, date: "2024-03-09" }], source: "plan" },
			{ type: "not-restored", list: "Want to See", source: "plan" },
		],
	},
	{
		tmdbId: 329865,
		mediaType: "movie",
		title: "Arrival",
		year: 2016,
		importChanges: [{ type: "rating-replaced", from: 7, to: 9, source: "journal" }],
		undoChanges: [{ type: "rating-restored", from: 9, to: 7, source: "journal" }],
	},
	{
		tmdbId: 126308,
		mediaType: "show",
		title: "Shōgun",
		year: 2024,
		importChanges: [
			{ type: "rating-added", score: 9, source: "journal" },
			{
				type: "watches-added",
				watches: episodes(1, 1, 10, ["2024-02-27", "2024-02-27", "2024-03-05", "2024-03-12", "2024-03-19", "2024-03-26", "2024-04-02", "2024-04-09", "2024-04-16", "2024-04-23"]),
				source: "plan",
			},
			{ type: "status-set", to: "Seen", source: "plan" },
		],
		undoChanges: [
			{ type: "watches-removed", watches: episodes(1, 1, 10, ["2024-02-27", "2024-02-27", "2024-03-05", "2024-03-12", "2024-03-19", "2024-03-26", "2024-04-02", "2024-04-09", "2024-04-16", "2024-04-23"]), source: "plan" },
			{ type: "status-restored", from: "Seen", to: "Not tracked", source: "plan" },
			{ type: "left-alone", what: "Your rating of 10", reason: "You changed it after the import.", source: "new" },
		],
	},
	{
		tmdbId: 666277,
		mediaType: "movie",
		title: "Past Lives",
		year: 2023,
		importChanges: [
			{ type: "rating-added", score: 8, source: "journal" },
			{ type: "watches-added", watches: [{ episode: null, date: null }], source: "plan" },
			{ type: "list-cleared", list: "Want to See", because: "you watched it", source: "plan" },
		],
		undoChanges: [
			{ type: "rating-removed", score: 8, source: "journal" },
			{ type: "watches-removed", watches: [{ episode: null, date: null }], source: "plan" },
			{ type: "not-restored", list: "Want to See", source: "plan" },
		],
	},
	{
		tmdbId: 136315,
		mediaType: "show",
		title: "The Bear",
		year: 2022,
		importChanges: [
			{ type: "watches-added", watches: episodes(1, 1, 3, ["2023-06-23", "2023-06-23", "2023-06-24"]), source: "plan" },
			{ type: "status-set", to: "Watching", source: "plan" },
			{ type: "list-cleared", list: "Not interested", because: "you watched it", source: "plan" },
		],
		undoChanges: [
			{ type: "watches-removed", watches: episodes(1, 1, 3, ["2023-06-23", "2023-06-23", "2023-06-24"]), source: "plan" },
			{ type: "status-restored", from: "Watching", to: "Not tracked", source: "plan" },
			{ type: "not-restored", list: "Not interested", source: "plan" },
		],
	},
	{
		tmdbId: 1064213,
		mediaType: "movie",
		title: "Anora",
		year: 2024,
		importChanges: [
			{ type: "list-added", list: "Want to See", source: "journal" },
			{ type: "list-cleared", list: "Not interested", because: "you added it to Want to See", source: "new" },
		],
		undoChanges: [
			{ type: "list-removed", list: "Want to See", source: "journal" },
			{ type: "not-restored", list: "Not interested", source: "new" },
		],
	},
	{
		tmdbId: 496243,
		mediaType: "movie",
		title: "Parasite",
		year: 2019,
		importChanges: [{ type: "kept", what: "Rating 10", reason: "Already the same in GoodWatch.", source: "item" }],
		undoChanges: [],
	},
	{
		tmdbId: 157336,
		mediaType: "movie",
		title: "Interstellar",
		year: 2014,
		importChanges: [{ type: "kept", what: "Watch on Nov 7, 2014", reason: "Already in your watch log.", source: "plan" }],
		undoChanges: [],
	},
	{
		tmdbId: 872585,
		mediaType: "movie",
		title: "Oppenheimer",
		year: 2023,
		importChanges: [{ type: "kept", what: "Want to See", reason: "You already watched it, so it was not added.", source: "item" }],
		undoChanges: [],
	},
]

export const SKIPPED: SkippedRow[] = [
	{ row: 12, label: "Kurzfilmnacht Vol. 3 (2021)", kind: "Rating", outcome: "unmatched", reason: "This title could not be matched uniquely in the GoodWatch catalog." },
	{ row: 19, label: "The Office (2005)", kind: "Rating", outcome: "unmatched", reason: "This title could not be matched uniquely in the GoodWatch catalog." },
	{ row: 27, label: "Heat (1995)", kind: "Watch", outcome: "invalid", reason: "WatchedDate must be a calendar date (YYYY-MM-DD)." },
]

/** What the source type and the rows say, in the words the ticket uses. */
export const isChange = (c: ImportChange) => c.type !== "kept"
export const changedTitles = TITLES.filter((t) => t.importChanges.some(isChange))
export const keptTitles = TITLES.filter((t) => t.importChanges.some((c) => c.type === "kept"))
export const undoneTitles = TITLES.filter((t) => t.undoChanges.length > 0)
export const notRestored = TITLES.flatMap((t) => t.undoChanges.filter((c) => c.type === "not-restored").map((c) => ({ title: t, list: (c as { list: ListName }).list })))
export const leftAlone = TITLES.flatMap((t) => t.undoChanges.filter((c) => c.type === "left-alone").map((c) => ({ title: t, change: c as Extract<UndoChange, { type: "left-alone" }> })))

const all = TITLES.flatMap((t) => t.importChanges)
export const TOTALS = {
	ratingsAdded: all.filter((c) => c.type === "rating-added").length,
	ratingsReplaced: all.filter((c) => c.type === "rating-replaced").length,
	watchesAdded: all.flatMap((c) => (c.type === "watches-added" ? c.watches : [])).length,
	listAdded: all.filter((c) => c.type === "list-added").length,
	listCleared: all.filter((c) => c.type === "list-cleared").length,
	kept: all.filter((c) => c.type === "kept").length,
	skipped: SKIPPED.length,
	titles: changedTitles.length,
}
const undoAll = TITLES.flatMap((t) => t.undoChanges)
export const UNDO_TOTALS = {
	ratingsRemoved: undoAll.filter((c) => c.type === "rating-removed").length,
	ratingsRestored: undoAll.filter((c) => c.type === "rating-restored").length,
	watchesRemoved: undoAll.flatMap((c) => (c.type === "watches-removed" ? c.watches : [])).length,
	listRemoved: undoAll.filter((c) => c.type === "list-removed").length,
	statusRestored: undoAll.filter((c) => c.type === "status-restored").length,
	notRestored: notRestored.length,
	leftAlone: leftAlone.length,
	titles: undoneTitles.length,
}

export const SOURCE_LABEL: Record<Source, string> = {
	item: "Item row",
	journal: "Journal (API change)",
	plan: "Watch plan (API change)",
	new: "Needs new data",
}
