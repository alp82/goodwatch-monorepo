// The catalog numbers that the footer cinema shows (its trivia montage, stinger and end credits), as /api/cinema-numbers
// sends them: a few counts picked from the /stats snapshot (domain/stats/snapshot.ts), so the cinema never loads the
// whole snapshot. The cinema words them (ui/footer/cinema/numbers.ts). Plain Node runs the tests that import this file,
// so it has type imports only.
import type { StatsSnapshot } from "./stats/snapshot"

/** Counts across the whole catalog. */
export interface CinemaNumbers {
	/** Minutes it takes to watch every movie and every episode back to back. */
	watchMinutes: number
	movies: number
	shows: number
	episodes: number
	people: number
	characters: number
	trailers: number
	/** IMDb votes on movies and shows. */
	imdbVotes: number
	letterboxdRatings: number
	tmdbVotes: number
	metacriticUserRatings: number
	metacriticCriticReviews: number
	/** Countries and streaming services with offers. */
	countries: number
	services: number
	tropeKinds: number
	tropeMentions: number
	/** Members who logged something they watched. */
	watchers: number
	sharkMovies: number
	zombieMovies: number
	christmasMovies: number
	/** Horror movies released on a Friday the 13th. */
	fridayThe13thHorror: number
	mostCommonRole: { role: string; credits: number }
	mostCommonTitle: { title: string; movies: number }
	longestMovie: { title: string; minutes: number }
	oldestTitle: { title: string; year: number }
}

/** The cinema's numbers from a /stats snapshot, or null when the snapshot lacks a list the cinema names from. */
export function cinemaNumbersFrom(s: StatsSnapshot): CinemaNumbers | null {
	const role = s.trivia.commonRoles[0]
	const title = s.trivia.commonTitles[0]
	const longest = s.records.longest[0]
	const oldest = s.records.oldest.find((t) => t.year !== null)
	if (!role || !title || !longest || !oldest || oldest.year === null)
		return null
	return {
		watchMinutes: s.catalog.movieMinutes + s.catalog.episodeMinutes,
		movies: s.catalog.movies,
		shows: s.catalog.shows,
		episodes: s.catalog.episodes,
		people: s.catalog.people,
		characters: s.catalog.characters,
		trailers: s.catalog.trailers,
		imdbVotes: s.sources.imdbMovieVotes + s.sources.imdbShowVotes,
		letterboxdRatings: s.sources.letterboxdRatings,
		tmdbVotes: s.sources.tmdbVotes,
		metacriticUserRatings: s.sources.metacriticUserRatings,
		metacriticCriticReviews: s.sources.metacriticCriticReviews,
		countries: s.streaming.countries,
		services: s.streaming.services,
		tropeKinds: s.tropes.distinct,
		tropeMentions: s.tropes.mentions,
		watchers: s.members.watchers,
		sharkMovies: s.trivia.sharks,
		zombieMovies: s.trivia.zombies,
		christmasMovies: s.trivia.christmas,
		fridayThe13thHorror: s.trivia.friday13Horror,
		mostCommonRole: role,
		mostCommonTitle: title,
		longestMovie: { title: longest.title, minutes: longest.runtime },
		oldestTitle: { title: oldest.title, year: oldest.year },
	}
}
