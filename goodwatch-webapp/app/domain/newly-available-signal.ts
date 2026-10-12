// Newly available on a member's services (#456): what the navigation is told, and the one thing the Browse button
// and the dock's key say about it, the sum of everything new. A module of its own because the navigation is on
// every page: the rules are in domain/newly-available.ts, and the words of the tiles, the doors and the pages in
// domain/newly-available-words.ts, which load with what shows them.

import {
	type NewEpisodes,
	type SignalWords,
	signalWords,
} from "./new-episodes-signal"

/** The titles of one kind that landed on the member's services since they last opened the kind's page. */
export interface Landings {
	count: number
	/** Their TMDB ids: a show that also has a new episode is counted once. */
	ids: number[]
	/** The title and the service, when it is one. */
	only: { title: string; service: string } | null
}

/** What rides along with Tonight's pick: the movies behind My movies, the shows behind My shows. */
export interface NewOnServices {
	movies: Landings
	shows: Landings
}

export const badgeOf = (count: number) => (count > 99 ? "99+" : String(count))

/** How many of the member's shows are new: with a new episode, newly on a service, or both, each once. */
export function newShowCount(
	episodes: NewEpisodes | null,
	landed: Landings | null,
): number {
	const aired = episodes?.shows ?? 0
	if (!landed?.count) return aired
	const known = episodes?.ids
	if (!known) return aired + landed.count
	return aired + landed.ids.filter((id) => !known.includes(id)).length
}

/** The number on the Browse button and the dock's key: everything new behind My shows and My movies. */
export function openerWords(
	episodes: NewEpisodes | null,
	landed: NewOnServices | null,
): SignalWords | null {
	if (!landed?.movies.count && !landed?.shows.count)
		return episodes ? signalWords(episodes) : null
	const total = newShowCount(episodes, landed.shows) + landed.movies.count
	const words = `${total} new in your shows and movies`
	return { badge: badgeOf(total), tile: words, door: words, doorShort: words }
}
