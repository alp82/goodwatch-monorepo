// Home's three doors for a member with REC_TRACKING (#385): Continue, Start a show, A movie. And what Tonight's pick
// is built from, since the pick is the first thing behind one of the doors. No query of its own for the member: the
// shows come from the member data and the catalog by key (my-shows.server.ts), the movies from Watch next's plan
// over the Wishlist's movies (docs/implementation/tracking/data-model.md, "Reads": Home doors and Tonight's pick).
import { activityWords, episodeCode } from "~/domain/my-shows"
import { type MyShows, getMyShows } from "~/server/my-shows.server"
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
}

/** A member's shows and first movies for tonight. `ctx` is a member's. */
export async function getTonightParts(
	ctx: ViewerContext,
	taste: Taste,
	now = Date.now(),
): Promise<TonightParts> {
	if (ctx.viewer.kind !== "member") throw new Error("Members only")
	const [shows, outside] = await Promise.all([
		getMyShows(
			{
				userId: ctx.viewer.userId,
				country: ctx.country,
				services: ctx.services,
				taste,
			},
			// Only the first Continue row's Next episode is shown.
			{ episodeLists: 1, now },
		),
		sortFactsOutsideSnapshot(ctx.wishlist.keys()),
	])
	const plan = planWatchNext(
		ctx,
		taste,
		{ onMyServices: true, moods: [], kind: "movie" },
		outside,
	)
	const movies = await getTitleCards(
		plan.head.slice(0, FAN).map((entry) => entry.key),
		ctx,
		taste,
	)
	return {
		shows,
		movieCount: plan.total,
		movies,
		movieFits: plan.heroFits,
		movieByMatch: plan.sort === "match",
	}
}

/** The doors as home draws them. A door without anything behind it is null; A movie is always there. */
export function homeDoorsOf(
	parts: TonightParts,
	services: readonly number[],
	now: number,
): HomeDoors {
	const { shows, movies } = parts
	const first = shows.continue[0] ?? shows.older[0] ?? null
	const started = shows.continue.length + shows.older.length
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
					: activityWords(first.lastActivityAt, now),
			more: started - 1,
		},
		start: shows.start.length
			? {
					count: shows.start.length,
					title: shows.start[0].title,
					posters: shows.start.slice(0, FAN).map((show) => show.poster_path),
				}
			: null,
		movie: {
			count: parts.movieCount,
			title: movie?.title ?? null,
			runtime: movie?.runtime ?? null,
			service:
				movie?.services?.find((service) => own.has(service.id))?.name ?? null,
			posters: movies.map((card) => card.poster_path),
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
