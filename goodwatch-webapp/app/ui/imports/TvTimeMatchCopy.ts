// What a member reads when matching TV Time movies by hand and when a TV Time preview couldn't look everything up.
// TV Time's own export names movies without a catalog ID, so the member picks the GoodWatch movie; the server groups a
// movie's rows and counts them by kind (`intentCounts`). The lookup strings repeat the server's row reasons
// (app/server/imports/tvdb-lookup.server.ts), so the box and the rows say the same.
import type {
	ImportKind,
	TvtimeSuggestionProof,
	WishlistSuggestionReason,
} from "~/domain/imports"
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

const REGION = new Intl.DisplayNames(["en"], { type: "region" })
const regionName = (code: string | undefined) => {
	if (!code) return null
	try {
		return REGION.of(code.toUpperCase()) ?? null
	} catch {
		return null
	}
}
const TITLE_KIND: Record<TvtimeSuggestionProof["title"]["kind"], string> = {
	primary: "title",
	original: "original title",
	alternative: "alternative title",
	translation: "translated title",
}

/** What a suggestion rests on, in plain words: "Same title and release date on TMDB". */
export function tvtimeSuggestionEvidence(proof: TvtimeSuggestionProof) {
	const country =
		proof.date.basis === "country" ? regionName(proof.date.country) : null
	return `Same ${TITLE_KIND[proof.title.kind]} and release date${country ? ` in ${country}` : ""} on TMDB`
}

const SUGGESTION_NOTES: Partial<Record<WishlistSuggestionReason, string>> = {
	tvtime_suggestion_pending: "Checking movie suggestions…",
	tvtime_suggestion_no_exact_match:
		"No movie on TMDB has this exact title and release date. Find it yourself.",
	tvtime_suggestion_ambiguous:
		"More than one movie fits. Choose the right one.",
	tvtime_suggestion_search_incomplete:
		"Too many movies share this title to suggest one. Find it yourself.",
	tvtime_suggestion_catalog_missing:
		"The movie that fits isn't in GoodWatch yet. Find another match or leave it.",
	tvtime_suggestion_unavailable:
		"GoodWatch couldn't check this movie right now. Find it yourself.",
	tvtime_suggestion_rejected: "You turned down the suggestion.",
	tvtime_lookup_budget_exhausted:
		"Matching stopped before this movie. Find it yourself.",
	conflicting_source_evidence:
		"Your export has different details for this movie. Find it yourself.",
}

/** Why a TV Time movie has no suggestion, or null for a reason this copy doesn't cover. */
export const tvtimeSuggestionNote = (reason: string | undefined) =>
	(reason && SUGGESTION_NOTES[reason as WishlistSuggestionReason]) || null

const STEPS: Record<string, string> = {
	watched_parents: "Matching shows and episodes…",
	episodes: "Matching shows and episodes…",
	other_parents: "Matching shows and episodes…",
	movies: "Checking movie suggestions…",
	publishing: "Putting the preview together…",
}

/** Where a background run stands: whether it's still going, its step, and a line of counts. */
export function tvtimeProgress(resolution: {
	state: string
	phase: string
	total: number
	processed: number
	matched: number
}) {
	const active = ["queued", "running", "editing"].includes(resolution.state)
	return {
		active,
		step:
			resolution.state === "queued"
				? "Waiting to start…"
				: (STEPS[resolution.phase] ?? "Matching your titles…"),
		line: `Checked ${formatCount(resolution.processed)} of ${formatCount(resolution.total)} rows. ${formatCount(resolution.matched)} matched so far.`,
	}
}

/** When to try again after the server refused to start matching. */
export function tvtimeBusyHint(code: string | null | undefined) {
	if (code === "tvtime_resolution_member_busy")
		return "Open it to follow its progress, or discard it to start again."
	if (code === "tvtime_resolution_global_busy")
		return "Matching a large export can take about 15 minutes."
	if (code === "tvtime_resolution_busy") return "Try again in a minute."
	return null
}
