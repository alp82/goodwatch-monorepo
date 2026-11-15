// The /stats page's numbers: one snapshot, computed in the background from Crate once a day
// (app/server/stats/), read by the page as it is. Every list is already cleaned (suspect rows out), cut to what the
// page shows, and for member numbers filtered by the privacy rules (app/server/stats/members.ts). Plain Node runs the
// tests that import this file, so it has no imports.

export type MediaType = "movie" | "show"

/** A movie or show as the page links and draws it. */
export interface StatsTitle {
	type: MediaType
	tmdbId: number
	title: string
	year: number | null
	poster: string | null
}

/** An episode with its show, numbered as IMDb numbers it. */
export interface StatsEpisode {
	showId: number
	show: string
	poster: string | null
	season: number
	episode: number
	name: string
	imdb: number
	votes: number
}

export interface StatsPerson {
	tmdbId: number
	name: string
	profile: string | null
}

export interface MetacriticTitle extends StatsTitle {
	metascore: number
	criticReviews: number
	userScore: number | null
}

export interface CatalogStats {
	movies: number
	shows: number
	seasons: number
	episodes: number
	people: number
	castCredits: number
	crewCredits: number
	characters: number
	characterPortraits: number
	posters: number
	backdrops: number
	logos: number
	trailers: number
	/** Every movie's runtime added up (runtimes of 1 to 1,000 minutes). */
	movieMinutes: number
	/** Every episode's runtime added up (runtimes of 1 to 400 minutes). */
	episodeMinutes: number
}

export interface SourceStats {
	imdbMovieVotes: number
	imdbShowVotes: number
	/** Movies and shows with an IMDb score. */
	imdbTitles: number
	imdbEpisodeVotes: number
	letterboxdTitles: number
	letterboxdRatings: number
	tmdbVotes: number
	/** Movies and shows with a Metascore. */
	metacriticTitles: number
	metacriticCriticReviews: number
	metacriticUserRatings: number
	rottenTomatoesTitles: number
	goodwatchScored: number
	/** Titles that title analysis has read. */
	titleAnalysis: number
}

export interface ChartStats {
	/** Movies with 1,000 or more IMDb votes, by decade, from the 1900s. */
	moviesByDecade: { decade: number; titles: number }[]
	/** The same movies' average runtime, by decade, from the 1920s. */
	runtimeByDecade: { decade: number; minutes: number }[]
	genres: { name: string; titles: number }[]
	languages: { code: string; titles: number }[]
	/**
	 * IMDb scores of the same movies: index 0 holds scores under 2, index 8 the 9s. Perfect 10s are left out (the read
	 * takes scores under 10), so index 9 stays 0.
	 */
	imdbSpread: number[]
	/** Movie Metascores in tens: index 0 holds 0 to 9, index 9 holds 90 to 99, index 10 a perfect 100. */
	metascoreSpread: number[]
}

export interface RecordStats {
	mostImdbVotesMovies: (StatsTitle & { votes: number })[]
	mostImdbVotesShows: (StatsTitle & { votes: number })[]
	mostLetterboxdRatings: (StatsTitle & { ratings: number })[]
	highestLetterboxd: (StatsTitle & { score: number; ratings: number })[]
	imdbOverLetterboxd: (StatsTitle & {
		imdb: number
		imdbVotes: number
		letterboxd: number
	})[]
	letterboxdOverImdb: (StatsTitle & {
		imdb: number
		imdbVotes: number
		letterboxd: number
	})[]
	criticsVsAudience: (StatsTitle & { critics: number; audience: number })[]
	topGoodwatchMovies: (StatsTitle & { score: number })[]
	topGoodwatchShows: (StatsTitle & { score: number })[]
	oldest: StatsTitle[]
	longest: (StatsTitle & { runtime: number })[]
	mostEpisodes: (StatsTitle & { episodes: number; seasons: number })[]
	highestGrossing: (StatsTitle & { revenue: number; budget: number | null })[]
	mostTropes: (StatsTitle & { tropes: number })[]
	highestMetascoreMovies: MetacriticTitle[]
	highestMetascoreShows: MetacriticTitle[]
	lowestMetascoreMovies: MetacriticTitle[]
	criticsOverUsers: (MetacriticTitle & { userScore: number })[]
	usersOverCritics: (MetacriticTitle & { userScore: number })[]
}

export interface EpisodeStats {
	mostVoted: StatsEpisode[]
	/** The lowest-rated episodes with 20,000 or more votes. */
	lowestRated: StatsEpisode[]
	/** The highest-rated episodes with 50,000 or more votes. */
	highestRated: StatsEpisode[]
}

export interface TropeStats {
	mentions: number
	distinct: number
	top: { url: string; name: string; titles: number }[]
	essenceTags: { name: string; titles: number }[]
	/** Shows that title analysis calls each of these. */
	moods: {
		binge: number
		comfort: number
		thoughtProvoking: number
		background: number
	}
}

export interface StreamingStats {
	offers: number
	titles: number
	countries: number
	services: number
	byType: { type: string; offers: number }[]
	topCountries: { code: string; offers: number }[]
	fewestCountry: { code: string; offers: number } | null
	topServices: {
		id: number
		name: string
		logo: string | null
		offers: number
	}[]
	/** Notable movies that stream in the most countries. */
	mostCountries: (StatsTitle & { countries: number })[]
}

export interface AwardStats {
	results: number
	wins: number
	titles: number
	people: number
	bodies: number
	firstYear: number
	lastYear: number
	/** Award bodies with the most results. */
	byBody: { name: string; results: number }[]
	/** Whether both the Oscars and the Baeksang Arts Awards are among the bodies. */
	oscarsToBaeksang: boolean
	mostWins: (StatsTitle & { wins: number })[]
	mostAwardedPeople: (StatsPerson & { wins: number; nominations: number })[]
}

export interface TriviaStats {
	commonTitles: { title: string; movies: number }[]
	/** The most common character names that are jobs ("Doctor"), and the top first name with its credits. */
	commonRoles: { role: string; credits: number }[]
	topFirstName: { role: string; credits: number } | null
	christmas: number
	zombies: number
	sharks: number
	oneLetterTitles: (StatsTitle & { imdb: number; votes: number })[]
	longestTitles: (StatsTitle & { letters: number })[]
	friday13Horror: number
	friday13Top: (StatsTitle & { imdb: number; votes: number })[]
	busiestYears: { year: number; movies: number }[]
	biggestSeries: { id: number; name: string; movies: number }[]
	boxOfficePerMinute: (StatsTitle & { revenue: number; runtime: number })[]
	sourcesAgree: (StatsTitle & {
		imdb: number
		letterboxd: number
		metascore: number
		tomatometer: number
	})[]
}

export interface MemberTitle extends StatsTitle {
	members: number
}

export interface ScoredTitle extends MemberTitle {
	average: number
}

export interface MemberStats {
	/** Minutes of movies and of episodes that members logged as watched. */
	loggedMovieMinutes: number
	loggedEpisodeMinutes: number
	/** Members who logged anything. */
	watchers: number
	movieWatches: number
	episodeWatches: number
	/** Different titles members marked as seen. */
	seenTitles: number
	scores: {
		count: number
		average: number
		/** How often each score was given: index 0 is a 1, index 9 a 10. */
		spread: number[]
		perfectTens: number
		perfectTenMembers: number
		byType: { type: MediaType; average: number }[]
	}
	mostSeen: MemberTitle[]
	mostBinged: (MemberTitle & { episodeWatches: number })[]
	highestRated: ScoredTitle[]
	/** Titles members score most alike (smallest standard deviation), and most apart. */
	agreed: (ScoredTitle & { spread: number })[]
	split: (ScoredTitle & { spread: number })[]
	belowImdb: (ScoredTitle & { imdb: number })[]
	aboveImdb: (ScoredTitle & { imdb: number })[]
	genres: { genre: string; scores: number; members: number; average: number }[]
	decades: { decade: number; scores: number }[]
	oldestShared: MemberTitle[]
	newestShared: MemberTitle[]
	/** Scores members gave by hand, by UTC weekday (1 is Monday) and UTC hour. */
	weekdays: { day: number; scores: number }[]
	hours: { hour: number; scores: number }[]
	wishlist: {
		movies: number
		shows: number
		addedLast30Days: number
		movieMinutes: number
		most: MemberTitle[]
	}
	imports: { source: string; titles: number }[]
	countries: { code: string; members: number }[]
}

export interface StatsSnapshot {
	/** Bumped when the shape changes, so a stored snapshot of an older shape is computed again. */
	version: typeof STATS_SNAPSHOT_VERSION
	/** ISO time the numbers were read. */
	generatedAt: string
	catalog: CatalogStats
	sources: SourceStats
	charts: ChartStats
	records: RecordStats
	episodes: EpisodeStats
	tropes: TropeStats
	streaming: StreamingStats
	awards: AwardStats
	people: { mostCastCredits: (StatsPerson & { credits: number })[] }
	trivia: TriviaStats
	members: MemberStats
}

export const STATS_SNAPSHOT_VERSION = 1
