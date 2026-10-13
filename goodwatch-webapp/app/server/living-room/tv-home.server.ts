// What the start page with the new TV shows a guest and a member, shaped from what the loader read
// (tv-loader.server.ts). Pure: no request, no read.
import { episodeCode, tonightsPickOf } from "~/domain/my-shows"
import type { TonightParts } from "~/server/home-doors.server"
import type { TitleCard } from "~/server/title-cards.server"
import type { TvHomeData, TvTonightPick } from "~/ui/living-room/tv/tv-home"
import {
	DOOR_HREF,
	SHOWS_PER_GROUP,
	TONIGHT_PICKS,
} from "~/ui/living-room/tv/tv-machine"

/** What every guest gets: the start titles and the first picture. */
export function guestHome(start: {
	titles: TvHomeData["startTitles"]
	picture: string | null
}): TvHomeData {
	return {
		member: false,
		startTitles: start.titles,
		picture: start.picture,
		tonight: [],
		shows: null,
	}
}

/**
 * The shows whose card Tonight needs: the show of Tonight's pick when the pick is an episode or a show to start,
 * and the first show to start, which follows the movies.
 */
export function tonightShowIds(parts: TonightParts): number[] {
	const choice = tonightsPickOf(parts.shows, parts.movies[0]?.tmdb_id ?? null)
	const ids = new Set<number>()
	if (choice && choice.kind !== "movie") ids.add(choice.showId)
	const start = parts.shows.start[0]
	if (start) ids.add(start.id)
	return [...ids]
}

/**
 * A member's Tonight and My shows, shaped from what home's doors read.
 * - Tonight: up to three picks. The first is Tonight's pick, as `getTonightsPick` decides it with tracking: the
 *   Next episode of the first show to continue, else the first movie of My movies, else the first show to start.
 *   The movies follow, then the first show to start.
 * - My shows: the first three shows to continue, or to pick up when there is none, and the first three to start.
 * `showCards` are the cards of `tonightShowIds`; a show the catalog lacks is left out.
 */
export function memberHome(
	parts: TonightParts,
	showCards: readonly TitleCard[],
): Pick<TvHomeData, "tonight" | "shows"> {
	const { shows, movies } = parts
	const showCard = (id: number) =>
		showCards.find((card) => card.media_type === "show" && card.tmdb_id === id)
	const choice = tonightsPickOf(shows, movies[0]?.tmdb_id ?? null)
	const tonight: TvTonightPick[] = []
	if (choice?.kind === "episode") {
		const card = showCard(choice.showId)
		const next = shows.continue[0].next
		if (card)
			tonight.push({
				card,
				href: DOOR_HREF.continue,
				...(next && {
					episode: { code: episodeCode(next), name: next.name },
				}),
			})
	}
	const start = shows.start[0]
	const startCard = start && showCard(start.id)
	const startPick = startCard && { card: startCard, href: DOOR_HREF.start }
	// A show to start is Tonight's pick only without a movie; otherwise it follows the movies.
	if (choice?.kind === "start" && startPick) tonight.push(startPick)
	for (const card of movies) tonight.push({ card, href: DOOR_HREF.movie })
	if (choice?.kind !== "start" && startPick) tonight.push(startPick)

	const started = shows.continue.length ? shows.continue : shows.pickUp
	return {
		tonight: tonight.slice(0, TONIGHT_PICKS),
		shows: {
			next: started.slice(0, SHOWS_PER_GROUP).map((row) => ({
				id: row.id,
				title: row.title,
				poster_path: row.poster_path,
				backdrop_path: row.backdrop_path,
				episode: row.next && {
					code: episodeCode(row.next),
					name: row.next.name,
					runtime: row.next.runtime,
				},
			})),
			start: shows.start.slice(0, SHOWS_PER_GROUP).map((show) => ({
				id: show.id,
				title: show.title,
				poster_path: show.poster_path,
				backdrop_path: show.backdrop_path,
				match: show.match,
				service: show.service,
			})),
		},
	}
}
