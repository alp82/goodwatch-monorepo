import { episodeCode } from "./episode-label.ts"
// The signal that something new aired for a member's shows (#442): what the Browse button, the dock's key, the My
// shows tile and home's Continue door are told, and what they say. A module of its own because the navigation is
// on every page: the rules of what is new, and My shows' own words, are in domain/new-episodes.ts and load with
// the pages that need them.

/** What the navigation and home's Continue door are told: how many shows are new, and the show when it is one. */
export interface NewEpisodes {
	shows: number
	/** Their TMDB ids, so that a show that also landed on one of the member's services (#456) is counted once. */
	ids?: number[]
	only: {
		title: string
		displaySeason?: number
		displayNumber?: number
		season: number
		number: number
		episodes: number
	} | null
}

export const NOTHING_NEW: NewEpisodes = { shows: 0, only: null }

export interface SignalWords {
	/** The number on the Browse button, the dock's key and the My shows tile. */
	badge: string
	/** The line of the My shows tile, short enough for one line of a phone's tile. */
	tile: string
	/** The pill on home's Continue door, and what a screen reader hears for the badge. */
	door: string
	/** The pill on a phone's door. */
	doorShort: string
}

/** Null when nothing is new. One show is named; several are counted. */
export function signalWords(fresh: NewEpisodes): SignalWords | null {
	const { shows, only } = fresh
	if (shows < 1) return null
	const badge = shows > 99 ? "99+" : String(shows)
	if (only) {
		const named =
			only.episodes > 1
				? `New: ${only.title}, ${only.episodes} episodes`
				: `New: ${only.title} ${episodeCode(only)}`
		return { badge, tile: named, door: named, doorShort: "1 show" }
	}
	return {
		badge,
		tile: `New in ${shows} shows`,
		door: `${shows} shows have new episodes`,
		doorShort: `${shows} shows`,
	}
}
