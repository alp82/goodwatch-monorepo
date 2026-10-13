// What the new TV's home shows, and how the page's data becomes the machine's `TvContext`. Pure, shared by the
// server (server/living-room/tv-loader.server.ts shapes `TvHomeData`) and the browser.
//
// A guest's first paint is the same for every guest: the tiles, and one picture, the first start title's backdrop.
// The pool (`POST /api/living-room/picks?view=pool`) arrives after the first interaction and swaps in the person's
// own picks. A member's Tonight and My shows come with the loader; a member asks for the pool only for the
// Discover tile's posters.
import type { TitleCard } from "~/server/title-cards.server"
import { QUIZ_GOAL } from "../../taste-quiz/quiz-flow.ts"
import type { StartTitle } from "../living-room-data"
import {
	EMPTY_CONTEXT,
	TONIGHT_PICKS,
	TV_APPS,
	type TvApp,
	type TvContext,
} from "./tv-machine.ts"

/** One of Tonight's picks. */
export type TvTonightPick = {
	card: TitleCard
	/** The member page the pick is the first thing on; null for a guest's pick. */
	href: string | null
	/** A guest's own Tonight's pick: the last title they added to the Wishlist in their browser. */
	wished?: boolean
	/** When the pick is a Next episode: "S2 E3" and its name. */
	episode?: { code: string; name: string | null }
}

/** A show with a Next episode, as My shows lists it on the TV. */
export type TvShowNext = {
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	/** Null when the show's episode list was not read. */
	episode: { code: string; name: string | null; runtime: number | null } | null
}

/** A Want to See show the member has not started. */
export type TvShowStart = {
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	match: number | null
	service: string | null
}

/** What the loader of the start page with the new TV returns. */
export type TvHomeData = {
	member: boolean
	/** The titles below the room, the same for everyone. Empty while the title snapshot loads. */
	startTitles: StartTitle[]
	/** The first start title's backdrop: the home's first picture until the person's own picks are there. */
	picture: string | null
	/** A member's Tonight, Tonight's pick first. Empty for a guest, and for a member with nothing to pick from. */
	tonight: TvTonightPick[]
	/** A member's My shows on the TV. Null for a guest. */
	shows: { next: TvShowNext[]; start: TvShowStart[] } | null
}

/** What the TV reads of the pool: its suggestions, best first for the person. */
export type TvPool = { suggestions: TitleCard[] }

/** A title's key on the TV and in its URL: `<media_type>-<tmdb_id>`. */
export const tvTitleKey = (title: { media_type: string; tmdb_id: number }) =>
	`${title.media_type}-${title.tmdb_id}`

/**
 * Tonight's picks: a member's from the loader. A guest's, and those of a member with nothing to pick from, are the
 * pool's best three, once the pool is there. `wished` is a guest's own Tonight's pick, the last title on the
 * Wishlist in their browser (`useTonightsPick`): it leads.
 */
export function tonightPicks(
	data: TvHomeData,
	pool: TvPool | null,
	wished: TitleCard | null = null,
): TvTonightPick[] {
	if (data.tonight.length) return data.tonight.slice(0, TONIGHT_PICKS)
	const best: TvTonightPick[] = (pool?.suggestions ?? [])
		.filter((card) => !wished || card.key !== wished.key)
		.map((card) => ({ card, href: null }))
	return [
		...(wished ? [{ card: wished, href: null, wished: true }] : []),
		...best,
	].slice(0, TONIGHT_PICKS)
}

/**
 * The machine's context for the screens built so far: home, the menu and What is GoodWatch? Each app's slice
 * adds what its screens show (the titles of a list, the islands, the sides, the quiz's progress, the draft).
 */
export function tvContextOf(
	data: TvHomeData,
	pool: TvPool | null,
	wished: TitleCard | null = null,
): TvContext {
	return {
		...EMPTY_CONTEXT,
		member: data.member,
		tonight: tonightPicks(data, pool, wished).map((pick) => ({
			title: tvTitleKey(pick.card),
			href: pick.href,
		})),
		nextEpisodes: (data.shows?.next ?? []).map((show) => `show-${show.id}`),
		toStart: (data.shows?.start ?? []).map((show) => `show-${show.id}`),
	}
}

/** An app tile's picture: real art for Tonight, Discover and My shows, a drawing for Explorer and Taste. */
export type TvAppArt =
	/** A backdrop; without a path the tile is plain. */
	| { kind: "backdrop"; path: string | null }
	/** Posters side by side. */
	| { kind: "posters"; paths: string[] }
	| { kind: "map" }
	| { kind: "print" }

export type TvAppTile = {
	app: TvApp
	name: string
	/** What the home says about the app while its tile has the focus. */
	line: string
	art: TvAppArt
}

const APP_NAME: Record<TvApp, string> = {
	tonight: "Tonight",
	discover: "Discover",
	explorer: "Explorer",
	taste: "Taste",
	shows: "My shows",
}

/** How many posters the Discover tile shows. */
const DISCOVER_POSTERS = 4

/** Home's tiles in order, with what each shows. My shows is a member's. */
export function homeApps(
	data: TvHomeData,
	pool: TvPool | null,
	taste = false,
	wished: TitleCard | null = null,
): TvAppTile[] {
	const picks = tonightPicks(data, pool, wished)
	const own = data.tonight.length > 0
	const best: { poster_path: string | null }[] =
		pool?.suggestions ?? data.startTitles
	// Until the pool is there, a guest's picture is the first start title's: for a visitor nobody knows anything
	// about it is the pool's best title.
	const tonightPicture = picks[0] ? picks[0].card.backdrop_path : data.picture
	// Tonight's pick is often the first show to continue: the My shows tile then takes the next show's picture, so
	// the two tiles don't show the same one.
	const shows = [...(data.shows?.next ?? []), ...(data.shows?.start ?? [])]
	const showPicture =
		shows.find(
			(show) => show.backdrop_path && show.backdrop_path !== tonightPicture,
		)?.backdrop_path ??
		shows[0]?.backdrop_path ??
		null
	const tile: Record<TvApp, Omit<TvAppTile, "app" | "name">> = {
		tonight: {
			line: !own
				? "One pick at a time, best rated right now."
				: picks[0].episode
					? "One pick at a time, your next episode first."
					: "One pick at a time, from your Wishlist.",
			art: { kind: "backdrop", path: tonightPicture },
		},
		discover: {
			line: "Pick a mood, get four titles.",
			art: {
				kind: "posters",
				paths: best
					.flatMap((title) => title.poster_path ?? [])
					.slice(0, DISCOVER_POSTERS),
			},
		},
		explorer: { line: "Sail a small map of islands.", art: { kind: "map" } },
		taste: {
			line: taste
				? "The sides of you."
				: `Rate ${QUIZ_GOAL} titles, get picks made for you.`,
			art: { kind: "print" },
		},
		shows: {
			line: "Your next episodes.",
			art: { kind: "backdrop", path: showPicture },
		},
	}
	return TV_APPS.filter((app) => app !== "shows" || data.member).map((app) => ({
		app,
		name: APP_NAME[app],
		...tile[app],
	}))
}
