import type { ImdbImportSummary } from "~/domain/imdb-import"
// What the import flow decides from a preview and a result, apart from how it looks: which questions a preview asks
// and in which order, the options the answers send at confirm, whether a file brings nothing new, and the count tiles
// the Done step shows. Pure and shared by the general and the IMDb flows.
import type {
	ImportResult,
	ImportResultRow,
	ImportResultSection,
	ImportResultSectionKey,
} from "~/domain/import-result"
import {
	IMPORT_KINDS,
	IMPORT_SOURCE_NAMES,
	type ImportKind,
	type ImportOptions,
	type ImportSource,
	type ImportSummary,
	isFileImportSource,
} from "~/domain/imports"
import type { UserData } from "~/types/user-data"

/** The flow's four steps: Bring a file or account, Choose what comes in, Import, Done. */
export type ImportStep = 1 | 2 | 3 | 4

/** Row names on the Choose step. Plain text: the state names aren't highlighted outside a question. */
export const KIND_NAME: Record<ImportKind, string> = {
	rating: "Scores",
	episode_rating: "Season and episode scores",
	watch: "Watches",
	want: "Want to See",
	favorite: "Favorites",
	review: "Reviews",
	show_status: "Show statuses",
	list: "Lists",
}

export const formatCount = (n: number) => n.toLocaleString("en-US")
/** "1 title", "842 titles". */
export const plural = (n: number, one: string, many = `${one}s`) =>
	`${formatCount(n)} ${n === 1 ? one : many}`
/** One or many: picks the verb or pronoun. */
export const oneOrMany = (n: number, one: string, many: string) =>
	n === 1 ? one : many

/** How the flow names a source in a sentence: "Trakt", "TV Time", "IMDb". */
export const sourceName = (source: ImportSource | "imdb") =>
	source === "imdb" || source === "imdb_list" ? "IMDb" : sourceShortName(source)

/** The wishlist source's long name is for lists; a sentence says Watcharr. */
const sourceShortName = (source: ImportSource) =>
	source === "wishlist"
		? "Watcharr"
		: source === "myanimelist"
			? "MyAnimeList"
			: source === "csv"
				? "CSV"
				: IMPORT_SOURCE_NAMES[source]

/** "your Trakt file", or "your TMDB account" for a source that connects. */
export const sourceThing = (source: ImportSource | "imdb") =>
	source === "imdb" ||
	isFileImportSource(source as ImportSource) ||
	source === "imdb_list"
		? "file"
		: "account"

/** The kinds the file brings, in the order the Choose step lists them. */
export const availableKinds = (summary: Pick<ImportSummary, "kinds">) =>
	IMPORT_KINDS.filter((kind) => (summary.kinds[kind] ?? 0) > 0)

/** A wishlist file that only brings Want to See. Its rewatch choice rides on the conflict choice at the server. */
export const isWishlistOnly = (
	summary: Pick<ImportSummary, "source" | "kinds">,
) =>
	summary.source === "wishlist" &&
	!(
		["rating", "episode_rating", "watch", "review", "show_status"] as const
	).some((kind) => (summary.kinds[kind] ?? 0) > 0)

/** Sources whose preview counts titles already Seen and season or episode wishes for a whole-show choice. */
const WISHLIST_CHOICE_SOURCES: ImportSource[] = [
	"wishlist",
	"imdb_list",
	"mdblist",
]

/** Titles on the wishlist already Seen, which can come in as Want to rewatch. */
export const rewatchCount = (summary: ImportSummary) =>
	WISHLIST_CHOICE_SOURCES.includes(summary.source)
		? (summary.wishlistRewatchChoiceCount ??
			(isWishlistOnly(summary) ? summary.counts.conflict : 0))
		: 0

/** Shows the file lists by season or episode, which can come in as the whole show on Want to See. */
export const wholeShowCount = (summary: ImportSummary) =>
	WISHLIST_CHOICE_SOURCES.includes(summary.source)
		? (summary.wishlistShowChoiceCount ?? 0)
		: 0

/** Entries GoodWatch couldn't tie to one title, which the member can match by hand. */
export const matchableCount = (summary: ImportSummary) =>
	summary.source === "wishlist" || summary.source === "tvtime"
		? (summary.wishlistUnresolvedMatchCount ?? summary.wishlistMatchCount ?? 0)
		: 0

const SCORE_LIKE: ImportKind[] = ["rating", "review", "episode_rating"]

/**
 * Rows whose score or review differs from the member's in GoodWatch. A preview's conflict count also holds the
 * wishlist titles that wait on the rewatch and whole-show choices; `conflictKinds` are the kinds of the conflict rows
 * the flow loaded, and `loadedAll` says whether those were all of them.
 */
export function scoreConflictCount(
	summary: ImportSummary,
	conflictKinds: readonly string[] | null,
	loadedAll: boolean,
) {
	if (isWishlistOnly(summary)) return 0
	const held = rewatchCount(summary) + wholeShowCount(summary)
	if (summary.counts.conflict === 0) return 0
	// TV Time's conflict choice also decides For later titles already Seen, so all its conflicts are one question.
	if (held === 0 || summary.source === "tvtime") return summary.counts.conflict
	const loaded = (conflictKinds ?? []).filter((kind) =>
		SCORE_LIKE.includes(kind as ImportKind),
	).length
	if (conflictKinds && loadedAll) return loaded
	return Math.max(loaded, summary.counts.conflict - held)
}

/**
 * Whether the differing rows are all scores (not reviews), so a question can say "scores" rather than "entries".
 * Wishlist rows waiting on the rewatch and whole-show choices are left out: they have their own questions.
 */
export const conflictsAreScores = (conflictKinds: readonly string[] | null) => {
	const scoreLike = (conflictKinds ?? []).filter((kind) =>
		SCORE_LIKE.includes(kind as ImportKind),
	)
	return (
		scoreLike.length > 0 &&
		scoreLike.every((kind) => kind === "rating" || kind === "episode_rating")
	)
}

/** The questions a preview can ask, in the order they are asked. */
export type Question = "conflicts" | "rewatch" | "whole-show" | "matching"
/** What the member picked on each question. A question without an entry has no answer yet. */
export type Answers = Partial<Record<Question, string>>

export const ANSWER = {
	conflicts: { keep: "keep", source: "source" },
	rewatch: { add: "add", leave: "leave" },
	"whole-show": { add: "add", leave: "leave" },
	matching: { check: "check", leave: "leave" },
} as const

/** The questions that apply to this preview and the kinds the member left in, in the order they are asked. */
export function sourceQuestions(input: {
	summary: ImportSummary
	kinds: readonly ImportKind[]
	scoreConflicts: number
}): Question[] {
	const { summary, kinds, scoreConflicts } = input
	const wishlistOnly = isWishlistOnly(summary)
	const want = wishlistOnly || kinds.includes("want")
	const out: Question[] = []
	if (
		scoreConflicts > 0 &&
		(summary.source === "tvtime" ||
			kinds.some((kind) => SCORE_LIKE.includes(kind)))
	)
		out.push("conflicts")
	if (want && rewatchCount(summary) > 0) out.push("rewatch")
	if (want && wholeShowCount(summary) > 0) out.push("whole-show")
	if (matchableCount(summary) > 0) out.push("matching")
	return out
}

/** What the server takes at confirm. Watch dates always keep the source's own dates (owner rule). */
export function sourceOptions(
	summary: ImportSummary,
	kinds: readonly ImportKind[],
	answers: Answers,
): ImportOptions {
	const rewatch = answers.rewatch === ANSWER.rewatch.add
	const shows = wholeShowCount(summary) > 0
	if (isWishlistOnly(summary))
		return {
			kinds: ["want"],
			conflictChoice: rewatch ? "source" : "keep",
			...(rewatch ? { wishlistRewatch: true } : {}),
			watchDates: "preserve",
			...(shows
				? { wishlistShows: answers["whole-show"] === ANSWER["whole-show"].add }
				: {}),
		}
	return {
		kinds: [...kinds],
		conflictChoice:
			answers.conflicts === ANSWER.conflicts.source ? "source" : "keep",
		watchDates: "preserve",
		...(WISHLIST_CHOICE_SOURCES.includes(summary.source)
			? { wishlistRewatch: rewatch }
			: {}),
		...(shows
			? { wishlistShows: answers["whole-show"] === ANSWER["whole-show"].add }
			: {}),
	}
}

/** Whether confirming with these answers can change anything, so the flow never starts an import that adds nothing. */
export function sourceWouldWrite(
	summary: ImportSummary,
	kinds: readonly ImportKind[],
	answers: Answers,
) {
	const rewatch = answers.rewatch === ANSWER.rewatch.add
	const shows = answers["whole-show"] === ANSWER["whole-show"].add
	if (isWishlistOnly(summary)) {
		const seen = rewatchCount(summary)
		const showChoices = wholeShowCount(summary)
		const rewatchOnly = summary.counts.conflict - showChoices
		const showOnly = summary.counts.conflict - seen
		return (
			summary.counts.new > 0 ||
			(rewatch && (rewatchOnly > 0 || shows)) ||
			(shows && showOnly > 0)
		)
	}
	if (kinds.length === 0) return false
	return (
		summary.counts.new > 0 ||
		(answers.conflicts === ANSWER.conflicts.source &&
			summary.counts.conflict > 0) ||
		rewatch ||
		shows
	)
}

/**
 * What a preview holds for the member: something to bring in, nothing new because GoodWatch already has it all
 * ("caught-up"), or nothing GoodWatch can use ("nothing").
 */
export type PreviewContent = "some" | "caught-up" | "nothing"

export function sourcePreviewContent(
	summary: ImportSummary,
	stillMatching: boolean,
): PreviewContent {
	const { counts } = summary
	if (
		counts.new > 0 ||
		counts.conflict > 0 ||
		matchableCount(summary) > 0 ||
		stillMatching
	)
		return "some"
	return counts.unchanged > 0 ? "caught-up" : "nothing"
}

/** IMDb ratings: rows the import writes with the conflict choice. */
export const imdbToWrite = (
	summary: Pick<ImdbImportSummary, "counts">,
	useImdb: boolean,
) =>
	summary.counts.new +
	summary.counts.update +
	(useImdb ? summary.counts.conflict : 0)

export function imdbPreviewContent(summary: ImdbImportSummary): PreviewContent {
	if (imdbToWrite(summary, true) > 0) return "some"
	return summary.counts.unchanged > 0 ? "caught-up" : "nothing"
}

/** Rows the member can't bring in: not in the catalog, a kind GoodWatch doesn't take, or unreadable. */
export const leftOutCount = (summary: {
	counts: { unmatched: number; unsupported: number; invalid: number }
}) =>
	summary.counts.unmatched + summary.counts.unsupported + summary.counts.invalid

/* ------------------------------------------------------------------------------------------------------------------ */
/* Running                                                                                                            */

/** How far a run is, from 0 to 1. */
export const runProgress = (summary: { processed: number; total: number }) =>
	summary.total > 0
		? Math.min(1, Math.max(0, summary.processed / summary.total))
		: 0

/** Rows above which a run takes a few minutes, so the member hears they can leave. */
export const LONG_RUN_ROWS = 3000

/** Why a run stopped, in the member's words: the server's reason first. */
export function stopReason(summary: {
	error: string | null
	stalled: boolean
	operation?: "apply" | "undo"
}) {
	if (summary.error) return summary.error
	const undo = summary.operation === "undo"
	return summary.stalled
		? `Your ${undo ? "undo" : "import"} stopped making progress.`
		: `Something went wrong on GoodWatch's side while ${undo ? "undoing" : "importing"}.`
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Done                                                                                                               */

/** One kind on the Done step: the member's total in GoodWatch now, what came in, and what came off. */
export interface CountTile {
	key: string
	name: string
	/** The member's total for this kind in GoodWatch now. Null where GoodWatch keeps no total: the tile shows `added`. */
	total: number | null
	added: number
	removed: number
}

const sectionOf = (result: ImportResult, key: ImportResultSectionKey) =>
	result.sections.find((section) => section.key === key)
const countOf = (result: ImportResult, key: ImportResultSectionKey) =>
	sectionOf(result, key)?.count ?? 0

/** Titles a list lost to this import, from the rows of its lists_cleared section, by list. */
export function clearedByList(rows: readonly ImportResultRow[]) {
	const out = { want_to_see: 0, not_interested: 0 }
	for (const row of rows)
		for (const change of row.changes)
			if (change.type === "list-cleared") out[change.list]++
	return out
}

type Totals = Record<
	| "scores"
	| "reviews"
	| "watches"
	| "statuses"
	| "want"
	| "notInterested"
	| "favorites",
	number
>

/** The member's totals per kind, from their user data. */
export function libraryTotals(
	data: Pick<
		UserData,
		"scores" | "wishlist" | "watchState" | "favorites" | "notInterested"
	>,
): Totals {
	const scores = Object.values(data.scores ?? {})
	const states = Object.entries(data.watchState ?? {})
	return {
		scores: scores.length,
		reviews: scores.filter((entry) => !!entry.review?.trim()).length,
		watches: states.reduce((sum, [, entry]) => sum + (entry.count ?? 0), 0),
		statuses: states.filter(([key]) => key.startsWith("show-")).length,
		want: Object.keys(data.wishlist ?? {}).length,
		notInterested: Object.keys(data.notInterested ?? {}).length,
		favorites: Object.keys(data.favorites ?? {}).length,
	}
}

/**
 * One tile per kind this import changed, in a fixed order. `cleared` are the titles that came off Want to See and Not
 * interested (from every row of lists_cleared); `data` is the member's data now, or undefined while it loads.
 */
export function doneTiles(
	result: ImportResult,
	cleared: { want_to_see: number; not_interested: number },
	data: Parameters<typeof libraryTotals>[0] | undefined,
): CountTile[] {
	const totals = data ? libraryTotals(data) : null
	const tile = (
		key: keyof Totals,
		name: string,
		added: number,
		removed = 0,
	): CountTile => ({
		key,
		name,
		total: totals ? totals[key] : null,
		added,
		removed,
	})
	const lists = result.customLists?.created ?? 0
	const all: CountTile[] = [
		tile("scores", "Scores", countOf(result, "ratings_added")),
		tile("reviews", "Reviews", countOf(result, "reviews")),
		{
			key: "episode-scores",
			name: "Season and episode scores added",
			total: null,
			added: countOf(result, "episode_ratings_added"),
			removed: 0,
		},
		tile("watches", "Watches", countOf(result, "watches_added")),
		tile("statuses", "Show statuses", countOf(result, "statuses_set")),
		tile(
			"want",
			"Want to See",
			countOf(result, "want_added"),
			cleared.want_to_see,
		),
		tile("notInterested", "Not interested", 0, cleared.not_interested),
		tile("favorites", "Favorites", countOf(result, "favorites_added")),
		{
			key: "lists",
			name: "Lists added",
			total: null,
			added: lists,
			removed: 0,
		},
	]
	return all.filter((item) => item.added > 0 || item.removed > 0)
}

/** The sections the Done step sums up in its own lines, apart from its tiles. */
export const doneSection = (
	result: ImportResult,
	key: ImportResultSectionKey,
): ImportResultSection | undefined => sectionOf(result, key)
