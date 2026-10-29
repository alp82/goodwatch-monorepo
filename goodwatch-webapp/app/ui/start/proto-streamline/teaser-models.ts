// PROTOTYPE (start-streamline, round 2): what the teaser under the sofa shows for the page's current focus. It sits
// where the card's top is and grows into the card.
// - Both: a search's state (searching, the titles found, nothing found, an error).
// - Guests: the empty state with Surprise me, loved progress, the picks being ready.
// - Members: a small "this or that" (the first pair), tonight's pick, or the first steps.
import type { TitleCard } from "~/server/title-cards.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { type DeckSource, type DeckTitle, deal } from "../member/deck"
import { shownLabel } from "../spotlight/SpotlightCard"
import {
	LOVED_NEEDED,
	type StartQuery,
	type StartResults,
	type StartView,
	hasQuery,
	querySignature,
} from "../stage/start-query"

export type TeaserTone = "amber" | "violet" | "sky" | "gray" | "rose"

export type TeaserPoster = { path: string | null | undefined; title: string }

export type TeaserSide = {
	title: string
	poster: string | null | undefined
	backdrop: string | null | undefined
	source: DeckSource
	why: string
}

export type TeaserModel = {
	/** A new key crossfades the teaser's content. */
	key: string
	/** fan: a few posters fanned beside the words; row: a row of posters; pair: two titles side by side. */
	kind: "fan" | "row" | "pair" | "words"
	eyebrow: string
	tone: TeaserTone
	headline: string
	sub?: string
	posters: readonly TeaserPoster[]
	pair?: readonly [TeaserSide, TeaserSide]
	/** The button: opening the card, or Surprise me (a random mood, then open). */
	action: { id: "open" | "surprise"; label: string }
	busy?: boolean
}

const shortTitle = (t: string) => t.replace(/:.*$/, "")
const posterOf = (c: { poster_path?: string | null; title: string }) => ({
	path: c.poster_path,
	title: c.title,
})

/** The search's state, or null without a query. */
export function searchTeaser(
	query: StartQuery,
	results: StartResults,
): TeaserModel | null {
	if (!hasQuery(query)) return null
	const label = shownLabel(query)
	const sig = querySignature(query)
	if (
		results.signature !== sig ||
		results.status === "loading" ||
		results.status === "idle"
	)
		return {
			key: `loading:${sig}`,
			kind: "row",
			eyebrow: "Searching",
			tone: "amber",
			headline: label,
			posters: [],
			action: { id: "open", label: "Show" },
			busy: true,
		}
	if (results.status === "error")
		return {
			key: `error:${sig}`,
			kind: "words",
			eyebrow: "Couldn't load",
			tone: "rose",
			headline: "Discover couldn't load right now",
			sub: "Open to try again.",
			posters: [],
			action: { id: "open", label: "Open" },
		}
	if (!results.cards.length)
		return {
			key: `none:${sig}`,
			kind: "words",
			eyebrow: "No matches",
			tone: "gray",
			headline: label,
			sub: "Try other words or another mood.",
			posters: [],
			action: { id: "open", label: "Open" },
		}
	const n = results.total ?? results.cards.length
	return {
		key: `ready:${sig}`,
		kind: "row",
		eyebrow: `${n} ${n === 1 ? "title" : "titles"}`,
		tone: "amber",
		headline: label,
		posters: results.cards.map(posterOf),
		action: { id: "open", label: "Tap three" },
	}
}

export function guestTeaser({
	query,
	results,
	view,
	loved,
	pick,
	fan,
}: {
	query: StartQuery
	results: StartResults
	view: StartView
	loved: readonly TitleCard[]
	pick: { top: TitleCard | null; more: readonly TitleCard[] } | null
	fan: readonly StartTitle[]
}): TeaserModel {
	if (view === "forYou")
		return pick?.top
			? {
					key: `foryou:${pick.top.key}`,
					kind: "row",
					eyebrow: "For you",
					tone: "violet",
					headline: `${shortTitle(pick.top.title)} and ${pick.more.length} more`,
					posters: [pick.top, ...pick.more].map(posterOf),
					action: { id: "open", label: "See picks" },
				}
			: {
					key: "foryou:loading",
					kind: "row",
					eyebrow: "For you",
					tone: "violet",
					headline: "Finding your picks",
					posters: [],
					action: { id: "open", label: "Open" },
					busy: true,
				}
	if (loved.length && hasQuery(query)) {
		const left = LOVED_NEEDED - loved.length
		return {
			key: `loved:${loved.length}`,
			kind: "fan",
			eyebrow: `${loved.length} of ${LOVED_NEEDED} loved`,
			tone: "amber",
			headline: `${left} more to go`,
			sub: "Then GoodWatch picks for you.",
			posters: loved.map(posterOf),
			action: { id: "open", label: "Keep tapping" },
		}
	}
	const search = searchTeaser(query, results)
	if (search) return search
	return {
		key: "empty",
		kind: "fan",
		eyebrow: "Picks for you",
		tone: "amber",
		headline: "Tap three you loved",
		sub: "Search or pick a mood above, then get picks for you.",
		posters: fan.filter((t) => t.poster_path).slice(0, 7).map(posterOf),
		action: { id: "surprise", label: "Surprise me" },
	}
}

export function memberTeaser({
	query,
	results,
	deck,
	unread,
}: {
	query: StartQuery
	results: StartResults
	deck: readonly DeckTitle[]
	unread: boolean
}): TeaserModel {
	const search = searchTeaser(query, results)
	if (search) return { ...search, action: { id: "open", label: "Show" } }
	if (deck.length === 1)
		return {
			key: "only",
			kind: "fan",
			eyebrow: "Tonight's pick",
			tone: "amber",
			headline: shortTitle(deck[0].card.title),
			sub: deck[0].why,
			posters: [posterOf(deck[0].card)],
			action: { id: "open", label: "Open" },
		}
	if (deck.length) {
		const duel = deal(deck as DeckTitle[], 0)
		const of = (k: number | null) => deck.find((t) => t.card.key === k)
		const a = of(duel.left) ?? deck[0]
		const b = of(duel.right) ?? deck[1]
		const side = (t: DeckTitle): TeaserSide => ({
			title: t.card.title,
			poster: t.card.poster_path,
			backdrop: t.card.backdrop_path,
			source: t.source,
			why: t.episode ?? t.why,
		})
		return {
			key: "pair",
			kind: "pair",
			eyebrow: "Tonight",
			tone: "amber",
			headline: "This or that?",
			posters: [posterOf(a.card), posterOf(b.card)],
			pair: [side(a), side(b)],
			action: { id: "open", label: "Pick one" },
		}
	}
	if (unread)
		return {
			key: "unread",
			kind: "words",
			eyebrow: "Your lists",
			tone: "rose",
			headline: "Couldn't load your lists",
			sub: "Reload the page to try again, or search above.",
			posters: [],
			action: { id: "open", label: "Open" },
		}
	return {
		key: "first",
		kind: "words",
		eyebrow: "First steps",
		tone: "sky",
		headline: "Rate a few titles",
		sub: "Or bring your ratings from IMDb, Letterboxd, Trakt and more.",
		posters: [],
		action: { id: "open", label: "Start" },
	}
}
