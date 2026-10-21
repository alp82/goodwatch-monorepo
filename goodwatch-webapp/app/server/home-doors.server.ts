// What a member's Tonight and My shows on the start page's TV are built from (server/living-room/tv-home.server.ts
// shapes them), and Tonight's pick, which is the first of them. The file keeps the name of the three doors the old
// TV had (#385). No query of its own for the member: the shows come from the member data and the catalog by key
// (my-shows.server.ts), the movies from Watch next's plan over the Wishlist's movies
// (docs/implementation/tracking/data-model.md, "Reads": Home doors and Tonight's pick).
//
// A title that landed on the member's services in the last 14 days leads (#489): a movie that fits tonight leads the
// movies, a show not started leads the shows to start, the latest landing first. A show the member is in the middle
// of stays first, so it stays Tonight's pick. From memory: what landed is read from the availability index.
import { landedFirst } from "~/domain/newly-available"
import { type MyShows, getMyShows } from "~/server/my-shows.server"
import { getLandings, newOnOf } from "~/server/newly-available.server"
import type { Taste } from "~/server/taste/index.server"
import { type TitleCard, getTitleCards } from "~/server/title-cards.server"
import type { ViewerContext } from "~/server/viewer.server"
import {
	planWatchNext,
	sortFactsOutsideSnapshot,
} from "~/server/watch-next.server"

/** How many movies Tonight reads. */
const FAN = 3

export interface TonightParts {
	shows: MyShows
	/** Want to See movies. */
	movieCount: number
	/** The first movies of My movies under its defaults: Best match, On my services, any mood, any length. */
	movies: TitleCard[]
	/** The first movie is on the member's services (or they have none saved). */
	movieFits: boolean
	/** Best match placed it, as opposed to Last added without taste. */
	movieByMatch: boolean
	/** The short name of the service the first movie, and the first show to start, landed on lately; null otherwise. */
	newOn: { movie: string | null; start: string | null }
}

/**
 * A member's shows and first movies for tonight. `ctx` is a member's. `movies` is how many of My movies' first
 * movies to read: three for home's doors, more for the TV's Watch next stack. The order is the same either way.
 */
export async function getTonightParts(
	ctx: ViewerContext,
	taste: Taste,
	now = Date.now(),
	{ movies: movieCount = FAN }: { movies?: number } = {},
): Promise<TonightParts> {
	if (ctx.viewer.kind !== "member") throw new Error("Members only")
	const [shows, outside, landed] = await Promise.all([
		getMyShows(
			{
				userId: ctx.viewer.userId,
				country: ctx.country,
				services: ctx.services,
				taste,
				language: ctx.language,
			},
			// The first three Continue rows' Next episodes are shown (the new TV's My shows; home's Continue door shows
			// the first), and no waiting show.
			{ episodeLists: 3, now, upcoming: false },
		),
		sortFactsOutsideSnapshot(ctx.wishlist.keys()),
		// A door led by what landed is an addition: without it the doors are in their own order.
		getLandings(ctx, now).catch((error) => {
			console.error("Home doors: reading what landed failed:", error)
			return { movies: [], shows: [] }
		}),
	])
	const plan = planWatchNext(
		ctx,
		taste,
		{ onMyServices: true, moods: [], kind: "movie" },
		outside,
	)
	// A landed movie leads when it is one of tonight's: on the member's services, as every landed movie is.
	const fits = (key: number) => {
		const entry = plan.entries.get(key)
		return Boolean(entry && entry.fit === plan.need && !entry.over)
	}
	const movieKeys = landedFirst(
		plan.head.map((entry) => entry.key),
		landed.movies.map(({ key }) => key),
		fits,
	).slice(0, movieCount)
	const toStart = new Set(shows.start.map((show) => show.id))
	const startIds = landedFirst(
		shows.start.map((show) => show.id),
		landed.shows.map(({ tmdbId }) => tmdbId),
		(id) => toStart.has(id),
	)
	const ledBy = {
		movie: landed.movies.find(({ key }) => key === movieKeys[0]),
		start: landed.shows.find(({ tmdbId }) => tmdbId === startIds[0]),
	}
	const [movies, services] = await Promise.all([
		getTitleCards(movieKeys, ctx, taste),
		newOnOf([ledBy.movie, ledBy.start].flatMap((landing) => landing ?? [])),
	])
	const startOf = new Map(shows.start.map((show) => [show.id, show]))
	const serviceOf = (landing: (typeof ledBy)["movie"]) =>
		(landing && services.get(landing.service)?.name) ?? null
	return {
		shows: ledBy.start
			? {
					...shows,
					start: startIds.flatMap((id) => startOf.get(id) ?? []),
				}
			: shows,
		movieCount: plan.total,
		movies,
		movieFits: plan.heroFits,
		movieByMatch: plan.sort === "match",
		newOn: {
			// The card of a title the catalog lacks is left out, and the movie after it is then first.
			movie:
				ledBy.movie && movies[0]?.key === ledBy.movie.key
					? serviceOf(ledBy.movie)
					: null,
			start: serviceOf(ledBy.start),
		},
	}
}
