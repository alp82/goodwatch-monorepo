// My library (#385): every title a member has marked, one status at a time. Want to see and Seen are the two main
// choices; Watching, On hold, Dropped and Not rated are one step away in a drop-down. Pure and shared by the server
// and the browser. The counts and the order of a list are made from the member data map alone; only the cards of
// one step are read from the catalog (docs/implementation/tracking/data-model.md, "Reads": Library).
import type { MediaKey, UserData } from "~/types/user-data"

export type LibraryStatus =
	| "want"
	| "seen"
	| "watching"
	| "on_hold"
	| "dropped"
	| "unrated"

/** The two choices that are always shown. */
export const MAIN_STATUSES = [
	"want",
	"seen",
] as const satisfies readonly LibraryStatus[]
/** The choices in the drop-down. Not rated is a view of Seen: the Seen titles without a score. */
export const MORE_STATUSES = [
	"watching",
	"on_hold",
	"dropped",
	"unrated",
] as const satisfies readonly LibraryStatus[]
const STATUSES: readonly LibraryStatus[] = [...MAIN_STATUSES, ...MORE_STATUSES]

export const STATUS_LABEL: Record<LibraryStatus, string> = {
	want: "Want to see",
	seen: "Seen",
	watching: "Watching",
	on_hold: "On hold",
	dropped: "Dropped",
	unrated: "Not rated",
}

export type LibrarySort = "added" | "last" | "score" | "title"
export const SORT_LABEL: Record<LibrarySort, string> = {
	added: "Last added",
	last: "Last watched",
	score: "My score",
	title: "Title",
}

export type LibraryKind = "all" | "movie" | "show"

/** A list is drawn in steps of this many titles. */
export const LIBRARY_STEP = 60

/** The sorts a status has; the first is its default. */
export function sortsFor(status: LibraryStatus): LibrarySort[] {
	if (status === "want") return ["added", "title"]
	if (status === "seen") return ["last", "score", "title"]
	return ["last", "title"]
}

export interface LibraryChoice {
	status: LibraryStatus
	/** Null: the status's default sort. */
	sort: LibrarySort | null
	kind: LibraryKind
	q: string
}

export type LibraryData = Pick<UserData, "wishlist" | "watchState" | "scores">

const keysOf = <T>(entries: Record<string, T>) =>
	Object.keys(entries) as MediaKey[]
const isShow = (key: MediaKey) => key.startsWith("show-")

/** The titles of a status. A title is under one of Watching, On hold, Dropped and Seen, never under two. */
export function libraryKeys(
	data: LibraryData,
	status: LibraryStatus,
): MediaKey[] {
	if (status === "want") return keysOf(data.wishlist)
	if (status === "seen" || status === "unrated") {
		const seen = keysOf(data.watchState).filter(
			(key) => data.watchState[key].state === "seen",
		)
		if (status === "unrated") return seen.filter((key) => !(key in data.scores))
		// A rated show counts as Seen through its score alone, unless a state says where the member stands with it.
		const rated = keysOf(data.scores).filter(
			(key) => isShow(key) && !(key in data.watchState),
		)
		return [...seen, ...rated]
	}
	return keysOf(data.watchState).filter(
		(key) => data.watchState[key].state === status,
	)
}

export const libraryCounts = (data: LibraryData) =>
	Object.fromEntries(
		STATUSES.map((status) => [status, libraryKeys(data, status).length]),
	) as Record<LibraryStatus, number>

// Lower case and without accents, so "elite" finds "Élite".
const fold = (text: string) =>
	text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.trim()

/** A title as the Title sort reads it: lower case, without accents, without a leading article. */
export const sortKey = (title: string) =>
	fold(title).replace(/^(the|an|a) (?=\S)/, "")

/** The Title sort and the search need the titles of the status's keys; the other sorts need no catalog read. */
export const needsTitles = (choice: { sort: LibrarySort | null; q: string }) =>
	choice.sort === "title" || choice.q.trim() !== ""

const time = (value: Date | string | number | null | undefined) =>
	value == null ? null : new Date(value).getTime()

export interface LibraryOrder {
	/** The sort in use: the chosen one when the status has it, else the status's default. */
	sort: LibrarySort
	/** Every title of the list, in order. */
	keys: MediaKey[]
	total: number
	/** How many titles the status holds under the search, by kind, whatever the kind filter says. */
	kinds: Record<LibraryKind, number>
}

/**
 * A status's list under a sort, the movies/shows filter and a search. `titleOf` gives a title's name; without it
 * the Title sort falls back to the key and a search matches nothing.
 */
export function libraryOrder(
	data: LibraryData,
	choice: LibraryChoice,
	titleOf: (key: MediaKey) => string | undefined = () => undefined,
): LibraryOrder {
	const sorts = sortsFor(choice.status)
	const sort =
		choice.sort && sorts.includes(choice.sort) ? choice.sort : sorts[0]
	const needle = fold(choice.q)
	const found = libraryKeys(data, choice.status).filter(
		(key) => !needle || fold(titleOf(key) ?? "").includes(needle),
	)
	const shows = found.filter(isShow).length
	const kinds = { all: found.length, movie: found.length - shows, show: shows }
	const keys = found.filter(
		(key) => choice.kind === "all" || isShow(key) === (choice.kind === "show"),
	)

	const byKey = (a: MediaKey, b: MediaKey) => (a < b ? -1 : a > b ? 1 : 0)
	// Newest first; titles without a date last.
	const byDate = (dateOf: (key: MediaKey) => number | null) => {
		const dates = new Map(keys.map((key) => [key, dateOf(key)]))
		return (a: MediaKey, b: MediaKey) => {
			const [x, y] = [dates.get(a) ?? null, dates.get(b) ?? null]
			if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
			return y - x
		}
	}
	const lastWatched = byDate((key) => time(data.watchState[key]?.watchedAt))
	let compare: (a: MediaKey, b: MediaKey) => number
	if (sort === "added")
		compare = byDate((key) => time(data.wishlist[key]?.createdAt))
	else if (sort === "last") compare = lastWatched
	else if (sort === "score") {
		// Not rated goes last under My score; the Not rated choice is how those are found.
		const scoreOf = (key: MediaKey) => data.scores[key]?.score ?? -1
		compare = (a, b) => scoreOf(b) - scoreOf(a) || lastWatched(a, b)
	} else {
		const names = new Map(
			keys.map((key) => [key, sortKey(titleOf(key) ?? "")]),
		)
		compare = (a, b) =>
			(names.get(a) as string).localeCompare(names.get(b) as string, "en")
	}
	keys.sort((a, b) => compare(a, b) || byKey(a, b))
	return { sort, keys, total: keys.length, kinds }
}

/** One step of a list: its keys, where the next step starts (null at the end), and how many titles follow it. */
export function libraryStep(keys: readonly MediaKey[], offset: number) {
	const start = Math.max(0, Math.floor(offset / LIBRARY_STEP) * LIBRARY_STEP)
	const step = keys.slice(start, start + LIBRARY_STEP)
	const end = start + step.length
	return {
		keys: step,
		next: end < keys.length ? end : null,
		left: Math.max(0, keys.length - end),
	}
}

// ---------------------------------------------------------------------------------------------------------
// The choice in the URL: `/my-library?status=seen&sort=score&type=movie&q=alien`, defaults left out.

const SORTS: readonly LibrarySort[] = ["added", "last", "score", "title"]

export function libraryChoiceOf(params: URLSearchParams): LibraryChoice {
	const status = params.get("status") as LibraryStatus
	const sort = params.get("sort") as LibrarySort
	const kind = params.get("type")
	return {
		status: STATUSES.includes(status) ? status : "want",
		sort: SORTS.includes(sort) ? sort : null,
		kind: kind === "movie" || kind === "show" ? kind : "all",
		q: (params.get("q") ?? "").slice(0, 100),
	}
}

export function libraryParams(choice: LibraryChoice): URLSearchParams {
	const params = new URLSearchParams()
	if (choice.status !== "want") params.set("status", choice.status)
	if (choice.sort && choice.sort !== sortsFor(choice.status)[0])
		params.set("sort", choice.sort)
	if (choice.kind !== "all") params.set("type", choice.kind)
	if (choice.q.trim()) params.set("q", choice.q.trim())
	return params
}

// ---------------------------------------------------------------------------------------------------------
// Words

const DMY = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
})
const utcDay = (at: number) => new Date(at).toISOString().slice(0, 10)

/** "Today", "Yesterday", "12 Mar 2024". A watch never gets a date nobody recorded. */
export function dayWords(at: number, now: number): string {
	const day = utcDay(at)
	if (day === utcDay(now)) return "Today"
	if (day === utcDay(now - 86_400_000)) return "Yesterday"
	return DMY.format(at)
}

/** When a title was last watched and how often: "12 Mar 2024", "Date unknown", "Watched 3 times, last 12 Mar 2024". */
export function watchedWords(
	entry: {
		watchedAt: Date | string | number | null
		count: number
	} | null,
	now: number,
): string {
	if (!entry) return "Rated"
	const at = time(entry.watchedAt)
	if (entry.count > 1)
		return `Watched ${entry.count} times, ${at === null ? "dates unknown" : `last ${dayWords(at, now)}`}`
	return at === null ? "Date unknown" : dayWords(at, now)
}
