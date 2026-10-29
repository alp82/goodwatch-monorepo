// What the ledge on the room's floor shows (StartLedge.tsx): the page's current focus, in the strip the card grows up
// from.
// - Both: a search's state (searching, the titles found, nothing found, an error).
// - Guests: Surprise me (a tap rolls a random mood and opens the card on its titles), the loved titles so far, the
//   picks being ready.
// - Members: one big button, "Choose what to watch next" ("Get your first picks" with nothing on any list yet), with
//   the links to My movies and My shows under it.
//
// Pure, so the choices are tested (ledge-models.test.ts).
import type { TitleCard } from "~/server/title-cards.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { MEMBER_HREF } from "../member/doors"
import { shownLabel } from "../moods/mixes"
import {
	LOVED_NEEDED,
	type StartQuery,
	type StartResults,
	type StartView,
	hasQuery,
	querySignature,
} from "../stage/start-query"

export type LedgeTone = "amber" | "violet" | "gray" | "rose"

export type LedgePoster = { path: string | null | undefined; title: string }

export type ListLink = { label: string; href: string; note: string | null }

export type LedgeModel = {
	/** A new key fades the ledge's content in again. */
	key: string
	/**
	 * fan: a few posters fanned beside the words; row: a row of posters under the words; words: words only; choose: a
	 * member's big button with the links to their lists.
	 */
	kind: "fan" | "row" | "words" | "choose"
	eyebrow: string
	tone: LedgeTone
	headline: string
	sub?: string
	posters: readonly LedgePoster[]
	/** What a tap does: open the card, or roll a surprise mood (which opens it on its titles). */
	action: { id: "open" | "surprise"; label: string }
	busy?: boolean
	/** The member's lists (choose). */
	links?: readonly ListLink[]
}

const shortTitle = (t: string) => t.replace(/:.*$/, "")
const posterOf = (c: { poster_path?: string | null; title: string }) => ({
	path: c.poster_path,
	title: c.title,
})

/** A member's two list pages, with how much is on each: the Wishlist's movies and the shows to continue. */
export function listLinks(lists: {
	movies: number | null
	shows: number | null
}): ListLink[] {
	return [
		{
			label: "My movies",
			href: MEMBER_HREF.movies,
			note: lists.movies ? `${lists.movies} to see` : null,
		},
		{
			label: "My shows",
			href: MEMBER_HREF.shows,
			note: lists.shows ? `${lists.shows} in progress` : null,
		},
	]
}

/** The search's state, or null without a query. */
export function searchLedge(
	query: StartQuery,
	results: StartResults,
	openLabel: string,
): LedgeModel | null {
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
		eyebrow: `${n.toLocaleString("en-US")} ${n === 1 ? "title" : "titles"}`,
		tone: "amber",
		headline: label,
		posters: results.cards.map(posterOf),
		action: { id: "open", label: openLabel },
	}
}

export function guestLedge({
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
	/** The start titles, for the fan before any choice. */
	fan: readonly StartTitle[]
}): LedgeModel {
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
	const search = searchLedge(query, results, "Tap three")
	if (search) return search
	return {
		key: "empty",
		kind: "fan",
		eyebrow: "Picks for you",
		tone: "amber",
		headline: "Tap three you loved",
		sub: "Search or pick a mood above, then get picks for you.",
		posters: fan
			.filter((t) => t.poster_path)
			.slice(0, 5)
			.map(posterOf),
		action: { id: "surprise", label: "Surprise me" },
	}
}

export function memberLedge({
	query,
	results,
	hasDeck,
	unread,
	lists,
}: {
	query: StartQuery
	results: StartResults
	/** Something on the member's lists to choose from ("this or that"). */
	hasDeck: boolean
	/** None of the member's lists could be read. */
	unread: boolean
	lists: { movies: number | null; shows: number | null }
}): LedgeModel {
	const search = searchLedge(query, results, "Show")
	if (search) return search
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
	const headline = hasDeck
		? "Choose what to watch next"
		: "Get your first picks"
	return {
		key: hasDeck ? "choose" : "first",
		kind: "choose",
		eyebrow: "",
		tone: "amber",
		headline,
		posters: [],
		action: { id: "open", label: headline },
		links: listLinks(lists),
	}
}
