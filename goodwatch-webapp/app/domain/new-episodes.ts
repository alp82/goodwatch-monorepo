// New episodes for the shows a member tracks (#442): when a waiting show's next episode airs, which shows are new
// since the member last opened My shows, and what the signal outside My shows says. Pure and shared by the server
// and the browser. Nothing here is stored but the time of the last visit, which the server reads and writes
// (docs/implementation/tracking/data-model.md, "New episodes").

import type { NewEpisodes } from "./new-episodes-signal"

const DAY_MS = 86_400_000
const midnight = (day: string) => Date.parse(`${day}T00:00:00Z`)

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
})

/** "12 Oct"; with the year when it is not today's: "14 Jan 2027". */
export const dayWords = (day: string, today: string) =>
	day.slice(0, 4) === today.slice(0, 4)
		? DAY_MONTH.format(midnight(day))
		: `${DAY_MONTH.format(midnight(day))} ${day.slice(0, 4)}`

/**
 * When an episode airs, by the member's day: "tomorrow", "in 4 days", and from a week out the date. "today" is for
 * a member whose day is ahead of UTC, by which the list decides what has aired.
 */
export function whenWords(airDate: string, today: string): string {
	const days = Math.round((midnight(airDate) - midnight(today)) / DAY_MS)
	if (days <= 0) return "today"
	if (days === 1) return "tomorrow"
	if (days < 7) return `in ${days} days`
	return dayWords(airDate, today)
}

// ---------------------------------------------------------------------------------------------------------
// Waiting for episodes

/** An episode that has not aired, with the date it will. */
export interface UpcomingEpisode {
	season: number
	number: number
	name: string | null
	/** TMDB's calendar date, "YYYY-MM-DD". */
	airDate: string
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
	weekday: "short",
	timeZone: "UTC",
})

/**
 * The date column of a waiting row: the day ("Tomorrow", "20 Nov"), and under it the weekday and date while the day
 * is said in words, else how many weeks it is. Without a dated episode: no day, and the plain statement.
 */
export function upcomingWords(
	upcoming: Pick<UpcomingEpisode, "airDate"> | null,
	today: string,
): { when: string | null; detail: string } {
	if (!upcoming) return { when: null, detail: "No date yet" }
	const { airDate } = upcoming
	const days = Math.round((midnight(airDate) - midnight(today)) / DAY_MS)
	const when = whenWords(airDate, today)
	const weeks = Math.round(days / 7)
	return {
		when: when[0].toUpperCase() + when.slice(1),
		detail:
			days < 7
				? `${WEEKDAY.format(midnight(airDate))} ${dayWords(airDate, today)}`
				: `in ${weeks} ${weeks === 1 ? "week" : "weeks"}`,
	}
}

/** The device's calendar date, "YYYY-MM-DD": the member's day, by which the page says "tomorrow". */
export function deviceDay(now = new Date()): string {
	const two = (value: number) => String(value).padStart(2, "0")
	return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`
}

/** Of a show's dated episodes to come, the one that airs first; on one day, the first in the show's order. */
export function firstUpcoming<E extends UpcomingEpisode>(
	episodes: readonly E[],
): E | null {
	let first: E | null = null
	for (const episode of episodes)
		if (
			!first ||
			episode.airDate < first.airDate ||
			(episode.airDate === first.airDate &&
				(episode.season - first.season || episode.number - first.number) < 0)
		)
			first = episode
	return first
}

/** Waiting shows soonest first; the ones without a date follow, in the order they came in. */
export function soonestFirst<
	R extends { upcoming: Pick<UpcomingEpisode, "airDate"> | null },
>(rows: readonly R[]): R[] {
	const dated = rows
		.map((row, i) => ({ row, i }))
		.filter(({ row }) => row.upcoming)
		.sort(
			(a, b) =>
				(a.row.upcoming?.airDate ?? "").localeCompare(
					b.row.upcoming?.airDate ?? "",
				) || a.i - b.i,
		)
		.map(({ row }) => row)
	return [...dated, ...rows.filter((row) => !row.upcoming)]
}

// ---------------------------------------------------------------------------------------------------------
// New since the last visit

/** A member who has not opened My shows yet is shown what aired in the last days, as the page's "New" mark is. */
export const NEW_WITHOUT_VISIT_DAYS = 7

/** From when on an aired episode is new. */
export interface Since {
	/** The last UTC date that does not count: the day of the last visit, whose episodes the member saw then. */
	day: string
	/** False while the member has never opened My shows: `day` is then seven days back. */
	visited: boolean
}

const utcDate = (at: number) => new Date(at).toISOString().slice(0, 10)

export const sinceOf = (visitedAt: number | null, now: number): Since =>
	visitedAt === null
		? { day: utcDate(now - NEW_WITHOUT_VISIT_DAYS * DAY_MS), visited: false }
		: { day: utcDate(visitedAt), visited: true }

/** A show the member can continue, with its Next episode. */
export interface NewCandidate {
	id: number
	title: string
	state: string
	/** Null when the show has no episode list, or nothing aired that is not watched. */
	next: { season: number; number: number; airDate: string | null } | null
	/** Aired episodes from the Next episode on. */
	unwatched: number
}

/** A show whose Next episode aired after the last visit. */
export interface NewShow {
	id: number
	title: string
	/** The Next episode. */
	season: number
	number: number
	airDate: string
	/** The Next episode and the aired ones after it. */
	episodes: number
}

/**
 * The shows that are new: Watching or Seen, with a Next episode that aired after `since`. A show the member was
 * behind on has an older Next episode and is not new when one more airs; On hold and Dropped shows never are. The
 * latest to air comes first.
 */
export function newShowsOf(
	candidates: readonly NewCandidate[],
	since: string,
): NewShow[] {
	const fresh: NewShow[] = []
	for (const { id, title, state, next, unwatched } of candidates) {
		if (state !== "watching" && state !== "seen") continue
		if (!next?.airDate || next.airDate <= since) continue
		fresh.push({
			id,
			title,
			season: next.season,
			number: next.number,
			airDate: next.airDate,
			episodes: unwatched,
		})
	}
	return fresh.sort(
		(a, b) =>
			b.airDate.localeCompare(a.airDate) ||
			a.title.localeCompare(b.title) ||
			a.id - b.id,
	)
}

// ---------------------------------------------------------------------------------------------------------
// What the signal is told, and what My shows says on arrival

export function summaryOf(fresh: readonly NewShow[]): NewEpisodes {
	const [first] = fresh
	return {
		shows: fresh.length,
		only:
			fresh.length === 1
				? {
						title: first.title,
						season: first.season,
						number: first.number,
						episodes: first.episodes,
					}
				: null,
	}
}

/** What was new when the member opened My shows: the shows, the latest to air first, and since when. */
export interface Arrival {
	since: Since
	titles: string[]
}

/** How many shows the line on My shows names before it counts the rest. */
const ARRIVAL_NAMES = 3

/** The one line My shows says on arrival; null when nothing was new. */
export function arrivalWords(
	since: Since,
	titles: readonly string[],
	today: string,
): { lead: string; names: string } | null {
	if (!titles.length) return null
	const more = titles.length - ARRIVAL_NAMES
	return {
		lead: since.visited
			? `New since ${dayWords(since.day, today)}:`
			: `New in the last ${NEW_WITHOUT_VISIT_DAYS} days:`,
		names:
			titles.slice(0, ARRIVAL_NAMES).join(", ") +
			(more > 0 ? ` and ${more} more` : ""),
	}
}
