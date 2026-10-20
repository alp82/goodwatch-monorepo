import type { PresentedMedia } from "../../../utils/media-presentation.ts"
import { copyMediaPresentation } from "../../../utils/media-presentation.ts"
// What the new TV says about a member's shows: the rows of My shows with their words, the New episodes signal on
// them, and the Seen it key of a show the member is midway through. Pure, so the words and the rules stay in one
// place and have tests.
//
// My shows on the TV is the member's loader's (`TvHomeData.shows`: up to three shows to continue, or to pick up
// when there is none, and up to three to start). The signal comes from the site's navigation, which asks what is
// new on every page (`useWhatsNew`); use-tv-shows.ts hands it over as `TvShowsSignal`.
//
// With the My shows screen's chunk: nothing here is in the start page's first view.
import {
	brandName,
	getShorterProviderLabel,
} from "../../../utils/streaming-links.ts"
import type {
	TvHomeData,
	TvShowNext,
	TvShowStart,
	TvTileSignal,
} from "./tv-home.ts"
import { SHOWS_PER_GROUP } from "./tv-machine.ts"

export type TvShows = NonNullable<TvHomeData["shows"]>

/** What is new for the member's shows: what the signal says, and the shows it is about. */
export type TvShowsSignal = {
	/** The New episodes signal's words; null when nothing is new. */
	words: TvTileSignal | null
	/** The shows whose Next episode is new, by their TMDB ids. */
	aired: readonly number[]
	/** The shows that are newly on one of the member's services. */
	landed: readonly number[]
}

export const NO_SIGNAL: TvShowsSignal = { words: null, aired: [], landed: [] }

/** A show of My shows as the screen draws it. */
export type TvShowRow = PresentedMedia & {
	/** `show-95396`, as in the URL. */
	key: string
	/** Its item on the screen: `title:show-95396`. */
	item: string
	kind: "next" | "start"
	title: string
	poster_path: string | null
	backdrop_path: string | null
	/** What stands on its poster: "S2 E4 · 50 min", "Continue", "Start". */
	label: string
	/** The line under its name while it has the focus. */
	factMedia?: { text: string; lang: string; at?: number }
	facts: string
	/** The New episodes signal counts it: its Next episode is new, or it is newly on one of the member's services. */
	fresh: boolean
}

const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : "s"}`
const line = (parts: (string | null | false | undefined)[]) =>
	parts.filter(Boolean).join(" · ")

function nextRow(show: TvShowNext, signal: TvShowsSignal): TvShowRow {
	const { episode } = show
	const aired = signal.aired.includes(show.id)
	const length = episode?.runtime ? `${episode.runtime} min` : null
	const left = !show.left
		? null
		: show.caughtUp
			? `${show.left} new since you saw it`
			: `${plural(show.left, "episode")} left`
	return {
		key: `show-${show.id}`,
		item: `title:show-${show.id}`,
		kind: "next",
		...copyMediaPresentation(show),
		title: show.title,
		poster_path: show.poster_path,
		backdrop_path: show.backdrop_path,
		// Without the show's episode list nobody knows which episode is next.
		label: episode ? line([episode.code, length]) : "Continue",
		facts: episode
			? line([
					`${aired ? "New" : "Next"}: ${episode.code}`,
					episode.name,
					length,
					left,
				])
			: line(["Continue", left]),
		...(episode?.name
			? {
					factMedia: {
						text: episode.name,
						lang: episode.language ?? "en",
						at: `${aired ? "New" : "Next"}: ${episode.code} · `.length,
					},
				}
			: {}),
		fresh: aired || signal.landed.includes(show.id),
	}
}

function startRow(show: TvShowStart, signal: TvShowsSignal): TvShowRow {
	const landed = signal.landed.includes(show.id)
	const service =
		show.service && brandName(getShorterProviderLabel(show.service))
	return {
		key: `show-${show.id}`,
		item: `title:show-${show.id}`,
		kind: "start",
		...copyMediaPresentation(show),
		title: show.title,
		poster_path: show.poster_path,
		backdrop_path: show.backdrop_path,
		label: "Start",
		facts: line([
			// A show that landed is on the member's service since a few days: the service leads.
			landed && (service ? `Now on ${service}` : "Now on your services"),
			"To start",
			show.seasons ? plural(show.seasons, "season") : null,
			show.match != null && `${show.match}% match`,
			!landed && service && `On ${service}`,
		]),
		fresh: landed,
	}
}

/**
 * My shows' rows in the machine's order (`tvItems`): up to three shows with a Next episode, then up to three to
 * start. A show is listed once, should the loader ever name it in both groups.
 */
export function showRows(
	shows: TvShows | null,
	signal: TvShowsSignal = NO_SIGNAL,
): TvShowRow[] {
	if (!shows) return []
	const rows = [
		...shows.next
			.slice(0, SHOWS_PER_GROUP)
			.map((show) => nextRow(show, signal)),
		...shows.start
			.slice(0, SHOWS_PER_GROUP)
			.map((show) => startRow(show, signal)),
	]
	return rows.filter(
		(row, at) => rows.findIndex((one) => one.key === row.key) === at,
	)
}

/**
 * What stands under the screen's name: the New episodes signal while something is new (one show is named,
 * several are counted), else what the list holds.
 */
export function showsCrumb(
	shows: TvShows | null,
	signal: TvShowsSignal = NO_SIGNAL,
): string | undefined {
	if (signal.words) return signal.words.tile
	if (shows?.next.length) return "Your next episodes"
	return shows?.start.length ? "Shows to start" : undefined
}

/** A member without a show to continue or to start, in the words of the My shows page. */
export const SHOWS_EMPTY =
	"No show to watch next. Want to See on a show puts it here to start. Once you mark an episode watched, its next episode leads this list."

/** What a screen reader hears for a show's poster: the show, that it is new, and where a press leads. */
export const showSays = (row: Pick<TvShowRow, "title" | "fresh" | "label">) =>
	`${row.title}, ${row.fresh ? "new, " : ""}${row.label}`

// ---------------------------------------------------------------------------------------------------------
// Seen it on a show the member is midway through.

/**
 * The episode Seen it marks: the Next episode of a show the member is midway through, which is a Watching show
 * or a Seen show with new episodes. Null for every other show, where Seen it asks how the show was:
 * - Not started: the press is the show's Seen press (tv-title.ts, `recordsWatch`).
 * - On hold and Dropped: the member set the status themselves, and a watch would end it.
 * - Seen with nothing new: there is no episode left to mark.
 */
export function episodeToMark<E>(show: {
	state: string
	/** Aired episodes not watched, while the show is Seen. */
	newEpisodes: number
	next: E | null
}): E | null {
	const midway =
		show.state === "watching" || (show.state === "seen" && show.newEpisodes > 0)
	return midway ? show.next : null
}

/**
 * Whether a show can have an episode to mark, by its state in the member's data: only then is the show's
 * tracking read at all. A show without a state is Not started.
 */
export const mayHaveNext = (state: string | null | undefined) =>
	state === "watching" || state === "seen"

/** What the TV says once the episode is marked. `last`: it was the last aired one, and the show is now Seen. */
export const episodeSeenToast = (code: string, last: boolean) =>
	last ? `${code} seen, every episode watched` : `${code} seen`
