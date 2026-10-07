// A movie's watch log as the browser holds it: one entry per watch, its order, how a date reads, and what the log is
// expected to be right after an action, before the server has answered
// (docs/implementation/tracking/data-model.md, "The date" and "The browser"). Pure: no clock, no time zone of its own.

export type WatchPrecision = "moment" | "day" | "unknown"

/** One watch of a movie, as `/api/watch-log` answers it. */
export interface WatchLogEntry {
	/** The `watch_id`. */
	id: string
	/**
	 * When it was watched, in milliseconds: the instant for "moment", 00:00 UTC of the calendar day for "day", null
	 * for "unknown".
	 */
	at: number | null
	precision: WatchPrecision
	/** "score" is the watch a rating records while the movie has no other: the member logged none. */
	origin: "single" | "import" | "score"
	importId: string | null
	/** The platform an imported watch came from, as its import names it. */
	source: string | null
	/** When the watch was recorded here, in milliseconds. */
	createdAt: number
}

/** When a watch happened, as the member says it. */
export type WatchWhen =
	| { precision: "moment" }
	| { precision: "day"; day: string }
	| { precision: "unknown" }

/** A date set in the log afterwards: a day or unknown, never a time. */
export type LoggedWhen = Exclude<WatchWhen, { precision: "moment" }>

const DAY_MS = 86_400_000
const midnightUtc = (day: string) => Date.parse(`${day}T00:00:00Z`)

/** The id of the watch a movie's score owns. */
export const scoreWatchId = (movieId: number) => `score-${movieId}`

// ---------------------------------------------------------------------------------------------------------
// Order and counts
// ---------------------------------------------------------------------------------------------------------

/** Dated watches newest first, then the undated ones, last recorded first. The order the server reads them in. */
export function orderWatches(log: readonly WatchLogEntry[]): WatchLogEntry[] {
	const recorded = (a: WatchLogEntry, b: WatchLogEntry) =>
		b.createdAt - a.createdAt
	return [
		...log
			.filter((entry) => entry.at !== null)
			.sort((a, b) => (b.at ?? 0) - (a.at ?? 0) || recorded(a, b)),
		...log.filter((entry) => entry.at === null).sort(recorded),
	]
}

/** The watches the member logged or imported: every row but the one a score owns. */
export const memberWatches = (log: readonly WatchLogEntry[]) =>
	log.filter((entry) => entry.origin !== "score")

/** The movie is Seen through its score alone: "Scored, no watch logged". */
export const scoredOnly = (log: readonly WatchLogEntry[]) =>
	log.length > 0 && memberWatches(log).length === 0

/** "3×" on the Seen button, from two watches on. */
export const countLabel = (count: number) => (count >= 2 ? `${count}×` : null)

/**
 * What the member data map says about a movie with this log: its rows, the latest dated watch, and how exact that
 * is. Null for an empty log, which is a movie that is not Seen.
 */
export function summaryOf(
	log: readonly WatchLogEntry[],
): { count: number; watchedAt: Date | null; precision: WatchPrecision } | null {
	if (!log.length) return null
	const [latest] = orderWatches(log)
	return {
		count: log.length,
		watchedAt: latest.at === null ? null : new Date(latest.at),
		precision: latest.at === null ? "unknown" : latest.precision,
	}
}

// ---------------------------------------------------------------------------------------------------------
// Dates as they read
// ---------------------------------------------------------------------------------------------------------

/** The calendar date of an instant where the viewer is, as YYYY-MM-DD. Without a zone: the device's. */
export function localDay(date: Date, timeZone?: string): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone,
	}).formatToParts(date)
	const part = (type: string) => parts.find((p) => p.type === type)?.value
	return `${part("year")}-${part("month")}-${part("day")}`
}

export const dayBefore = (day: string) =>
	new Date(midnightUtc(day) - DAY_MS).toISOString().slice(0, 10)

/** The calendar day of a watch: a day-precise watch's own, a moment's where the viewer is. Null without a date. */
export function dayOf(entry: WatchLogEntry, timeZone?: string): string | null {
	if (entry.at === null) return null
	return entry.precision === "day"
		? new Date(entry.at).toISOString().slice(0, 10)
		: localDay(new Date(entry.at), timeZone)
}

const dayName = (day: string, now: Date, timeZone?: string) => {
	const today = localDay(now, timeZone)
	if (day === today) return "Today"
	if (day === dayBefore(today)) return "Yesterday"
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(midnightUtc(day)))
}

/**
 * A watch's date as a row of the log shows it. A day never shifts with the viewer's zone; a time is shown only for
 * a watch that has one, in the viewer's zone.
 */
export function watchLabel(
	entry: WatchLogEntry,
	now: Date,
	timeZone?: string,
): { day: string; time?: string } {
	const day = dayOf(entry, timeZone)
	if (day === null || entry.at === null) return { day: "Date unknown" }
	const label = { day: dayName(day, now, timeZone) }
	if (entry.precision !== "moment") return label
	return {
		...label,
		time: new Intl.DateTimeFormat("en-GB", {
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
			timeZone,
		}).format(new Date(entry.at)),
	}
}

/** The date inside a sentence: "today, 21:40", "on 5 Oct 2026", "date unknown". */
export function whenText(
	entry: WatchLogEntry,
	now: Date,
	timeZone?: string,
): string {
	const label = watchLabel(entry, now, timeZone)
	if (entry.at === null) return "date unknown"
	const day =
		label.day === "Today" || label.day === "Yesterday"
			? label.day.toLowerCase()
			: `on ${label.day}`
	return label.time ? `${day}, ${label.time}` : day
}

const SOURCES: Record<string, string> = {
	imdb: "IMDb",
	letterboxd: "Letterboxd",
	trakt: "Trakt",
	tmdb: "TMDB",
	simkl: "Simkl",
	tvtime: "TV Time",
}

/** The platform of an import as its second line names it: "Imported from Letterboxd". */
export function sourceName(source: string | null): string | null {
	if (!source) return null
	return (
		SOURCES[source.toLowerCase()] ??
		source.charAt(0).toUpperCase() + source.slice(1)
	)
}

// ---------------------------------------------------------------------------------------------------------
// The log right after an action
// ---------------------------------------------------------------------------------------------------------

const dateOf = (when: WatchWhen, now: Date) =>
	when.precision === "moment"
		? { at: now.getTime(), precision: "moment" as const }
		: when.precision === "day"
			? { at: midnightUtc(when.day), precision: "day" as const }
			: { at: null, precision: "unknown" as const }

/** A watch the member logs, under the id the browser made for it. */
export const newWatch = (
	id: string,
	when: WatchWhen,
	now: Date,
): WatchLogEntry => ({
	id,
	...dateOf(when, now),
	origin: "single",
	importId: null,
	source: null,
	createdAt: now.getTime(),
})

/** A watch the member logs takes the place of the one their score owns. */
export function withWatch(
	log: readonly WatchLogEntry[],
	entry: WatchLogEntry,
): WatchLogEntry[] {
	return orderWatches([
		...memberWatches(log).filter((other) => other.id !== entry.id),
		entry,
	])
}

/** "Change date" on one watch. A day set on the score's watch makes it the member's own record. */
export function withDate(
	log: readonly WatchLogEntry[],
	id: string,
	when: LoggedWhen,
): WatchLogEntry[] {
	return orderWatches(
		log.map((entry) => {
			if (entry.id !== id) return entry
			const date = dateOf(when, new Date(0))
			return {
				...entry,
				...date,
				origin:
					entry.origin === "score" && date.at !== null
						? "single"
						: entry.origin,
			}
		}),
	)
}

/**
 * One watch deleted, or with `id` null every watch the member logged. A rated movie that has none left gets the
 * watch its score owns back, and stays Seen.
 */
export function withoutWatch(
	log: readonly WatchLogEntry[],
	id: string | null,
	movie: { movieId: number; scored: boolean; now: Date },
): WatchLogEntry[] {
	const left =
		id === null
			? log.filter((entry) => entry.origin === "score")
			: log.filter((entry) => entry.id !== id)
	if (left.length || !movie.scored) return left
	return [
		{
			...newWatch(
				scoreWatchId(movie.movieId),
				{ precision: "unknown" },
				movie.now,
			),
			origin: "score",
		},
	]
}

/** Undo of a delete: the same rows with the same ids, in place of the score's watch if that had come back. */
export function withRestored(
	log: readonly WatchLogEntry[],
	rows: readonly WatchLogEntry[],
): WatchLogEntry[] {
	const restored = new Set(rows.map((row) => row.id))
	return orderWatches([
		...memberWatches(log).filter((entry) => !restored.has(entry.id)),
		...rows,
	])
}
