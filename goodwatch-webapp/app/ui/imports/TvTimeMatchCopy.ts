// What a member reads when matching TV Time movies by hand and when a TV Time preview couldn't look everything up.
// TV Time's own export names movies without a catalog ID, so the member picks the GoodWatch movie; the server groups a
// movie's rows and counts them by kind (`intentCounts`). The lookup strings repeat the server's row reasons
// (app/server/imports/tvdb-lookup.server.ts), so the box and the rows say the same.
import type { ImportKind } from "~/domain/imports"
import { formatCount } from "./shared"

type IntentCounts = Partial<Record<ImportKind, number>> | undefined

const watches = (n: number) =>
	`${formatCount(n)} ${n === 1 ? "watch" : "watches"}`

/** What TV Time has for a movie, in a line: "3 watches · For later". */
export function tvtimeIntentLine(counts: IntentCounts): string {
	return [
		counts?.watch ? watches(counts.watch) : null,
		counts?.want ? "For later" : null,
		counts?.rating ? "Rated" : null,
	]
		.filter(Boolean)
		.join(" · ")
}

/**
 * What matching a movie adds. TV Time writes one row per play, so the first is a watch and the rest are rewatches.
 * Watches in the same import win over For later, so a watched movie isn't also added to Want to See.
 */
export function tvtimeMatchEffect(counts: IntentCounts): string {
	const watched = counts?.watch ?? 0
	const rewatches = watched - 1
	const parts = [
		watched > 0
			? `1 watch${rewatches > 0 ? ` and ${formatCount(rewatches)} ${rewatches === 1 ? "rewatch" : "rewatches"}` : ""}`
			: null,
		counts?.rating ? "your rating" : null,
	].filter(Boolean)
	if (parts.length === 0)
		return counts?.want ? "Matching adds the movie to Want to See." : ""
	const adds = `Matching adds ${parts.join(" and ")}.`
	return watched > 0 && counts?.want
		? `${adds} For later isn't added: a watch comes first.`
		: adds
}

const DAY = new Intl.DateTimeFormat("en-US", {
	dateStyle: "long",
	timeZone: "UTC",
})

/** A TV Time release date as a calendar day, or null for a missing or placeholder date such as 0001-01-01. */
export function tvtimeReleaseDate(value: string | null | undefined) {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1800")
		return null
	const date = new Date(`${value}T00:00:00Z`)
	return Number.isNaN(date.getTime()) ? null : DAY.format(date)
}

/**
 * The match section's introduction, for one movie or many. `unresolved` is how many the member hasn't matched yet;
 * a preview from before that was counted leaves it out, and reads as nothing matched.
 */
export function tvtimeMatchIntro(count: number, unresolved = count) {
	const matched = count - unresolved
	if (matched > 0 && unresolved === 0)
		return count === 1
			? "You matched the movie. Change the match if it's wrong."
			: `You matched all ${formatCount(count)} movies. Change a match if one is wrong.`
	if (matched > 0)
		return `You matched ${formatCount(matched)} of ${formatCount(count)} movies. TV Time's export has no catalog ID for the other ${formatCount(unresolved)}, so ${unresolved === 1 ? "it isn't added until you match it" : "they aren't added until you match them"}.`
	return count === 1
		? "TV Time's export names this movie but has no catalog ID for it, so GoodWatch didn't add it on its own. Choose the GoodWatch movie it is. A movie you don't match isn't added."
		: `TV Time's export names these ${formatCount(count)} movies but has no catalog ID for them, so GoodWatch didn't add them on its own. Choose the GoodWatch movie for each one. Movies you don't match aren't added.`
}

/** The count beside the section heading: "2 of 3 matched", or the number of movies before any is matched. */
export function tvtimeMatchedLine(count: number, unresolved = count) {
	const matched = count - unresolved
	return matched > 0
		? `${formatCount(matched)} of ${formatCount(count)} matched`
		: formatCount(count)
}

export const TVTIME_COPY = {
	matchHeading: "Movies to match",
	/** Shown in the match panel: one source's watch and another's For later can land on the same movie. */
	watchesFirst:
		"When a watch and a For later entry match the same movie, GoodWatch adds the watch and leaves the movie off Want to See.",
	lookupLimit:
		"This preview reached its lookup limit. Run the import again to match more.",
	lookupUnavailable:
		"TMDB's TVDB lookup is unavailable; retry this import later.",
	/** A rerun reads the file afresh, so matches made in this preview don't carry over. */
	rerunBeforeMatching:
		"Run it again before you match movies: a new run starts without your matches.",
} as const

/** How many rows a rerun can still match: "2,400 rows aren't matched yet." */
export const tvtimeRowsLeft = (count: number) =>
	count === 1
		? "1 row isn't matched yet."
		: `${formatCount(count)} rows aren't matched yet.`
