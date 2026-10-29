// Members with more and less on their lists, for the deck's, the doors' and the render tests: one with a full start,
// a few of everything, no shows, an empty Wishlist, and a brand new member with nothing yet.
import type { TitleCard } from "~/server/title-cards.server"
import type { MemberStartData } from "./member-data"

export function card(
	mediaType: "movie" | "show",
	tmdbId: number,
	extra: Partial<TitleCard> = {},
): TitleCard {
	return {
		key: (mediaType === "movie" ? 1e12 : 2e12) + tmdbId,
		media_type: mediaType,
		tmdb_id: tmdbId,
		title: `${mediaType === "movie" ? "Movie" : "Show"} ${tmdbId}`,
		release_year: 2020,
		poster_path: `/p${tmdbId}.jpg`,
		backdrop_path: `/b${tmdbId}.jpg`,
		runtime: mediaType === "movie" ? 100 + (tmdbId % 50) : 45,
		goodwatch_overall_score_normalized_percent: 80,
		match: 80,
		reasons: [],
		services: [],
		seen: false,
		wantToSee: false,
		notInterested: false,
		rating: null,
		...extra,
	} as unknown as TitleCard
}

const range = (from: number, n: number) =>
	Array.from({ length: n }, (_, i) => from + i)

const shows = (n: number) =>
	range(1, n).map((id) => ({
		card: card("show", id),
		episode: `S1 E${id} · Pilot`,
	}))
const movies = (n: number) => range(101, n).map((id) => card("movie", id))
const forYou = (n: number) =>
	range(201, n).map((id) =>
		card(id % 2 ? "movie" : "show", id, { match: 90 - (id % 10) }),
	)
const hot = (n: number) =>
	range(301, n).map((id, i) => ({
		card: card("movie", id),
		rank: i + 1,
		why: "New trailer · today",
	}))

const list = <T>(titles: T[], total = titles.length) => ({ titles, total })

/** Everything on every list: twelve of each (more in all), 905 ratings, Hot on socials on. */
export const FULL: MemberStartData = {
	ratings: 905,
	services: [8],
	tonight: {
		card: card("show", 1),
		episode: "S1 E1 · Pilot",
		source: "continue",
	},
	continue: list(shows(12), 14),
	wishlist: list(movies(12), 40),
	forYou: list(forYou(12)),
	hotOn: true,
	hot: list(hot(12)),
}

/** One show in progress, two Wishlist movies, four ratings: For you is still forming. */
export const FEW: MemberStartData = {
	...FULL,
	ratings: 4,
	continue: list(shows(1)),
	wishlist: list(movies(2)),
	forYou: list(forYou(9)),
}

/** No shows: Tonight's pick is the Wishlist's first movie. */
export const NO_SHOWS: MemberStartData = {
	...FULL,
	tonight: { card: movies(1)[0], episode: null, source: "wishlist" },
	continue: list([]),
}

/** An empty Wishlist. */
export const NO_WISHLIST: MemberStartData = { ...FULL, wishlist: list([]) }

/** Brand new: no ratings, nothing on any list (For you isn't read without ratings). */
export const NEW: MemberStartData = {
	...FULL,
	ratings: 0,
	tonight: null,
	continue: list([]),
	wishlist: list([]),
	forYou: list([]),
}

export const MEMBERS = {
	full: FULL,
	few: FEW,
	noShows: NO_SHOWS,
	noWishlist: NO_WISHLIST,
	new: NEW,
}
