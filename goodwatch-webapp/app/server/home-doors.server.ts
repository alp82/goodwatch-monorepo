// Home's three doors for a member with REC_TRACKING (#385): Continue, Start a show, A movie. And what Tonight's pick
// is built from, since the pick is the first thing behind one of the doors. No query of its own for the member: the
// shows come from the member data and the catalog by key (my-shows.server.ts), the movies from Watch next's plan
// over the Wishlist's movies (docs/implementation/tracking/data-model.md, "Reads": Home doors and Tonight's pick).
//
// A title that landed on the member's services in the last 14 days leads its own door (#489): a movie that fits
// tonight leads A movie, a show not started leads Start a show, the latest landing first. The order of the doors
// is untouched, so Continue stays Tonight's pick for a member in the middle of a show. From memory: what landed is
// read from the availability index.
import { episodeCode, placedWords } from "~/domain/my-shows"
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
import type { HomeDoors } from "~/ui/living-room/living-room-data"

/** How many movies a door's fan of posters shows. */
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

/** A member's shows and first movies for tonight. `ctx` is a member's. */
export async function getTonightParts(
	ctx: ViewerContext,
	taste: Taste,
	now = Date.now(),
): Promise<TonightParts> {
	if (ctx.viewer.kind !== "member") throw new Error("Members only")
	const [shows, outside, landed] = await Promise.all([
		getMyShows(
			{
				userId: ctx.viewer.userId,
				country: ctx.country,
				services: ctx.services,
				taste,
			},
			// Only the first Continue row's Next episode is shown, and no waiting show.
			{ episodeLists: 1, now, upcoming: false },
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
	).slice(0, FAN)
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

/** The doors as home draws them. A door without anything behind it is null; A movie is always there. */
export function homeDoorsOf(
	parts: TonightParts,
	services: readonly number[],
	now: number,
): HomeDoors {
	const { shows, movies } = parts
	const first = shows.continue[0] ?? shows.pickUp[0] ?? null
	const started = shows.continue.length + shows.pickUp.length
	const movie = movies[0] ?? null
	const own = new Set(services)
	return {
		continue: first && {
			title: first.title,
			backdrop_path: first.backdrop_path,
			episode: first.next ? episodeCode(first.next) : null,
			episodeName: first.next?.name ?? null,
			fact:
				first.kind === "seenNew"
					? `${first.left} new since you saw it`
					: placedWords(first, now),
			more: started - 1,
		},
		start: shows.start.length
			? {
					count: shows.start.length,
					title: shows.start[0].title,
					posters: shows.start.slice(0, FAN).map((show) => show.poster_path),
					...(parts.newOn.start ? { newOn: parts.newOn.start } : {}),
				}
			: null,
		movie: {
			count: parts.movieCount,
			title: movie?.title ?? null,
			runtime: movie?.runtime ?? null,
			service:
				movie?.services?.find((service) => own.has(service.id))?.name ?? null,
			posters: movies.map((card) => card.poster_path),
			...(parts.newOn.movie ? { newOn: parts.newOn.movie } : {}),
		},
	}
}

export async function getHomeDoors(
	ctx: ViewerContext,
	taste: Taste,
	now = Date.now(),
): Promise<HomeDoors> {
	return homeDoorsOf(await getTonightParts(ctx, taste, now), ctx.services, now)
}
