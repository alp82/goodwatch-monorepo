// PROTOTYPE (start-streamline): what the thin element at the foot of the room says for the page's current focus.
// - Both: a search's state (searching, how many titles, nothing found, an error).
// - Guests: the empty state (search or a mood, then tap three), loved progress, or the picks being ready.
// - Members: a teaser of "this or that" (the first pair), or the first steps.
import type { TitleCard } from "~/server/title-cards.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { type DeckTitle, deal } from "../member/deck"
import { shownLabel } from "../spotlight/SpotlightCard"
import {
	LOVED_NEEDED,
	type StartQuery,
	type StartResults,
	type StartView,
	hasQuery,
	querySignature,
} from "../stage/start-query"

export type StripTone = "amber" | "violet" | "sky" | "gray" | "rose"

export type StripModel = {
	/** A new key crossfades the strip's content. */
	key: string
	tag: string
	tone: StripTone
	line: string
	posters: readonly (string | null | undefined)[]
	action: string
	busy?: boolean
}

const shortTitle = (t: string) => t.replace(/:.*$/, "")

/** The search's state, or null without a query. */
export function searchModel(
	query: StartQuery,
	results: StartResults,
): StripModel | null {
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
			tag: "Searching",
			tone: "amber",
			line: `“${label}”`,
			posters: [],
			action: "Show",
			busy: true,
		}
	if (results.status === "error")
		return {
			key: `error:${sig}`,
			tag: "Couldn't load",
			tone: "rose",
			line: "Open to try again",
			posters: [],
			action: "Open",
		}
	if (!results.cards.length)
		return {
			key: `none:${sig}`,
			tag: "No matches",
			tone: "gray",
			line: `“${label}”`,
			posters: [],
			action: "Open",
		}
	const n = results.total ?? results.cards.length
	return {
		key: `ready:${sig}`,
		tag: `${n} ${n === 1 ? "title" : "titles"}`,
		tone: "amber",
		line: label,
		posters: results.cards.slice(0, 4).map((c) => c.poster_path),
		action: "Show",
	}
}

export function guestModel({
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
}): StripModel {
	if (view === "forYou")
		return pick?.top
			? {
					key: `foryou:${pick.top.key}`,
					tag: "For you",
					tone: "violet",
					line: `${shortTitle(pick.top.title)} and ${pick.more.length} more picks`,
					posters: [pick.top, ...pick.more].slice(0, 4).map((c) => c.poster_path),
					action: "Open",
				}
			: {
					key: "foryou:loading",
					tag: "For you",
					tone: "violet",
					line: "Finding your picks",
					posters: loved.map((c) => c.poster_path),
					action: "Open",
					busy: true,
				}
	if (loved.length && hasQuery(query)) {
		const left = LOVED_NEEDED - loved.length
		return {
			key: `loved:${loved.length}`,
			tag: `${loved.length} of ${LOVED_NEEDED} loved`,
			tone: "amber",
			line: `${left} more to go for your picks`,
			posters: loved.map((c) => c.poster_path),
			action: "Show",
		}
	}
	const search = searchModel(query, results)
	if (search) return search
	return {
		key: "empty",
		tag: "Your picks",
		tone: "amber",
		line: "Search, then tap three you loved",
		posters: fan
			.filter((t) => t.poster_path)
			.slice(0, 3)
			.map((t) => t.poster_path),
		action: "Start",
	}
}

export function memberModel({
	query,
	results,
	deck,
	unread,
}: {
	query: StartQuery
	results: StartResults
	deck: readonly DeckTitle[]
	unread: boolean
}): StripModel {
	const search = searchModel(query, results)
	if (search) return search
	if (deck.length === 1)
		return {
			key: "only",
			tag: "Tonight's pick",
			tone: "amber",
			line: shortTitle(deck[0].card.title),
			posters: [deck[0].card.poster_path],
			action: "Open",
		}
	if (deck.length) {
		const duel = deal(deck as DeckTitle[], 0)
		const of = (k: number | null) => deck.find((t) => t.card.key === k)
		const a = of(duel.left) ?? deck[0]
		const b = of(duel.right) ?? deck[1]
		return {
			key: "pair",
			tag: "This or that",
			tone: "amber",
			line: `${shortTitle(a.card.title)} or ${shortTitle(b.card.title)}?`,
			posters: [a.card.poster_path, b.card.poster_path],
			action: "Pick one",
		}
	}
	if (unread)
		return {
			key: "unread",
			tag: "Your lists",
			tone: "rose",
			line: "Couldn't load your lists",
			posters: [],
			action: "Open",
		}
	return {
		key: "first",
		tag: "First steps",
		tone: "sky",
		line: "Rate a few titles to get your picks",
		posters: [],
		action: "Start",
	}
}
