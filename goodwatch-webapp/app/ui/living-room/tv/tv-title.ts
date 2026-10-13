// What the new TV says about one title: on Tonight, on the title screen and on the rating after Seen it. Pure, so
// the words and the rules stay in one place and have tests.
//
// A title on the TV is named by its key in the URL (`movie-603`). What a screen shows of it comes in two steps: at
// once what a list on the page knew (`TvKnownTitle`: Tonight's picks hold whole cards, an island's titles only a
// name and a poster), then the card `/api/title-cards` answers.
import type { CardService, TitleCard } from "~/server/title-cards.server"
import type { MediaType } from "~/types/user-data"
import { RATING_LEVELS } from "../../taste-quiz/quiz-flow.ts"
import { scoreLabels } from "../../../utils/ratings.ts"
import {
	brandName,
	getShorterProviderLabel,
} from "../../../utils/streaming-links.ts"
import type { TvTonightPick } from "./tv-home.ts"
import { RATE_SCORES } from "./tv-machine.ts"

/** What a list on the page knew of a title, before its card is there: at least what names it. */
export type TvKnownTitle = Pick<TitleCard, "media_type" | "tmdb_id" | "title"> &
	Partial<TitleCard>

/** The title on the title screen and on the rating after Seen it, with the person's marks. */
export type TvTitleOnScreen = {
	/** `movie-603`, as in the URL. */
	key: string
	/** What is known of the title: what a list knew, then its card. Null until either is there. */
	title: TvKnownTitle | null
	/** Its card was asked for, and the catalog has no such title. */
	missing: boolean
	/** The viewer's own services: a title's service among them is theirs. */
	mine: readonly CardService[]
	want: boolean
	seen: boolean
	score: number | null
}

/** What the screens of one title draw from: Tonight's picks, and the title on the title screen and the rating. */
export type TvTitleScreens = {
	tonight: readonly TvTonightPick[]
	/** Tonight's picks are still on their way. */
	waiting: boolean
	title: TvTitleOnScreen | null
}

/** A title's key on the TV, read: `movie-603`. Null for anything else. */
export function parseTvTitleKey(
	key: string,
): { mediaType: MediaType; tmdbId: number } | null {
	const [, mediaType, tmdbId] = /^(movie|show)-([1-9]\d*)$/.exec(key) ?? []
	return mediaType
		? { mediaType: mediaType as MediaType, tmdbId: Number(tmdbId) }
		: null
}

/** "2019 · Movie · 2h 10m", "2021 · Show · 45 min episodes": what stands over a title's name. */
export function titleKicker(
	title: Pick<TvKnownTitle, "media_type" | "release_year" | "runtime">,
): string {
	const { runtime } = title
	const show = title.media_type === "show"
	const length = !runtime
		? null
		: show
			? `${runtime} min episodes`
			: runtime < 60
				? `${runtime} min`
				: `${Math.floor(runtime / 60)}h ${runtime % 60}m`
	return [title.release_year, show ? "Show" : "Movie", length]
		.filter(Boolean)
		.join(" · ")
}

/** A service's name as the title page shows it: "Prime", "Disney+". */
const serviceName = (service: CardService) =>
	brandName(getShorterProviderLabel(service.name))

/** The first service a title streams on, the viewer's own first, with whether it is theirs. */
function firstOffer(
	services: readonly CardService[],
	mine: readonly CardService[],
): { name: string; owned: boolean } | null {
	const own = new Set(mine.map(serviceName))
	const names = [...new Set(services.map(serviceName))]
	const name = names.find((n) => own.has(n)) ?? names[0]
	return name ? { name, owned: own.has(name) } : null
}

/**
 * The key that leaves for the title's page at its streaming block. "Watch on Netflix" on one of the person's
 * services, "On Netflix" on another; "Not streaming" is a key that does nothing. While nobody knows where the
 * title streams (its card is on its way, or the country's availability is loading) the key says where it leads.
 */
export function watchKey(
	title: Pick<TvKnownTitle, "services"> | null,
	mine: readonly CardService[],
): { label: string; goes: boolean } {
	const services = title?.services
	if (!services) return { label: "Where to watch", goes: true }
	const first = firstOffer(services, mine)
	if (!first) return { label: "Not streaming", goes: false }
	return {
		label: first.owned ? `Watch on ${first.name}` : `On ${first.name}`,
		goes: true,
	}
}

/** "On Netflix" in a title's line of facts; nothing while nobody knows, "Not streaming" when it is nowhere. */
export function whereLine(
	title: Pick<TvKnownTitle, "services"> | null,
	mine: readonly CardService[],
): string | null {
	const services = title?.services
	if (!services) return null
	const first = firstOffer(services, mine)
	return first ? `On ${first.name}` : "Not streaming"
}

/** The Want to See key: it says what is, and one more press takes it back. */
export const wantLabel = (want: boolean) =>
	want ? "On Wishlist ✓" : "Want to See"

/** The Seen it key: the person's score once there is one ("8 · Great"), else that they have seen it. */
export function seenLabel(score: number | null, seen: boolean): string {
	if (score) return `${score} · ${scoreLabels[score]}`
	return seen ? "Seen ✓" : "Seen it"
}

/**
 * Whether Seen it records a watch before it asks how it was. A member's only: the server refuses a guest's
 * watch, and a guest's score counts as Seen. A movie gets a watch, a show the member has not started its Seen
 * press. A show they are in the middle of (Watching, On hold, Dropped) keeps its status, because the press would
 * tick every episode; its rating follows either way, and rating never changes a show's status.
 */
export function recordsWatch(press: {
	signedIn: boolean
	mediaType: MediaType
	/** The title counts as Seen already. */
	seen: boolean
	/** The show has a watch state: the member has started it. */
	started: boolean
}): boolean {
	if (!press.signedIn || press.seen) return false
	return press.mediaType === "movie" || !press.started
}

/** What the TV says once a score is stored. */
export const ratedToast = (score: number) =>
	`Rated ${score} · ${scoreLabels[score]}`

/**
 * The answers of "How was it?" after Seen it, in the machine's order.
 * WAITING FOR A PROTOTYPE: a strip from low on the left to high on the right, with labels and the ten exact
 * scores, takes the place of these four (screens/Rate.tsx draws them; `answerItems` in tv-machine.ts names them).
 */
export const RATE_ANSWERS: readonly { item: string; label: string }[] =
	RATE_SCORES.map((score) => ({
		item: `level:${score}`,
		label: RATING_LEVELS.find((level) => level.score === score)?.name ?? "",
	}))

/** What Tonight says over a pick: where the picks come from, and which one this is. */
export function tonightWords(
	pick: TvTonightPick,
	at: number,
	count: number,
): { crumb: string; kicker: string; line: string | null } {
	const { episode, href, wished, card } = pick
	return {
		// A pick with a page of its own is a member's, from their shows and their Wishlist; a guest's own pick is
		// the last title on their Wishlist; the others are the best of the pool.
		crumb: episode
			? `Next episode: ${episode.code}`
			: href || wished
				? "From your Wishlist"
				: "Best rated right now",
		kicker: `Pick ${at + 1} of ${count}`,
		line: episode?.name ?? card.tagline ?? null,
	}
}
