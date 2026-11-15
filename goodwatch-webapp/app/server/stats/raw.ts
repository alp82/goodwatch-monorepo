// What the stats refresh reads from Crate (queries.server.ts), before build.ts cleans and cuts it into the page's
// snapshot. Record lists are read longer than the page shows, so the rows build.ts drops still leave enough.
import type {
	CatalogStats,
	MediaType,
	SourceStats,
	StatsEpisode,
	StatsPerson,
	StatsTitle,
} from "../../domain/stats/snapshot.ts"

export type Bucket = { bucket: number; titles: number }

export interface RawMetacritic extends StatsTitle {
	metascore: number
	criticReviews: number
	userScore: number | null
	userRatings: number | null
}

export interface RawCatalog {
	catalog: CatalogStats
	sources: SourceStats
	charts: {
		moviesByDecade: { decade: number; titles: number }[]
		runtimeByDecade: { decade: number; minutes: number }[]
		genres: { name: string; titles: number }[]
		languages: { code: string; titles: number }[]
		imdbBuckets: Bucket[]
		metascoreBuckets: Bucket[]
	}
	/** Movies that share an IMDb id with a real show (one with TMDB votes): a series stored as a movie (Kingdom Hospital). */
	seriesAsMovies: number[]
	records: {
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
		highestGrossing: (StatsTitle & {
			revenue: number
			budget: number | null
			released: number | null
		})[]
		mostTropes: (StatsTitle & { tropes: number })[]
		highestMetascoreMovies: RawMetacritic[]
		highestMetascoreShows: RawMetacritic[]
		lowestMetascoreMovies: RawMetacritic[]
		criticsOverUsers: RawMetacritic[]
		usersOverCritics: RawMetacritic[]
	}
	episodes: {
		mostVoted: StatsEpisode[]
		lowestRated: StatsEpisode[]
		highestRated: StatsEpisode[]
	}
	tropes: {
		mentions: number
		distinct: number
		top: { url: string; titles: number }[]
		/** TV Tropes page headings by URL, where the catalog has one. */
		headings: { url: string; title: string }[]
		essenceTags: { name: string; titles: number }[]
		moods: {
			binge: number
			comfort: number
			thoughtProvoking: number
			background: number
		}
	}
	streaming: {
		offers: number
		titles: number
		countries: number
		services: number
		byType: { type: string; offers: number }[]
		/** Every country by offers, most first. */
		byCountry: { code: string; offers: number }[]
		/** Subscription offers by service id, most first. */
		byService: { id: number; offers: number }[]
		/** Service rows by id; the table holds one per id and country, so ids repeat. */
		serviceNames: { id: number; name: string; logo: string | null }[]
		mostCountries: (StatsTitle & { countries: number })[]
	}
	awards: {
		results: number
		wins: number
		titles: number
		people: number
		firstYear: number
		lastYear: number
		/** Every award body by results, most first. */
		bodies: { name: string; results: number }[]
		mostWins: (StatsTitle & { wins: number })[]
		mostAwarded: { tmdbId: number; wins: number; nominations: number }[]
		names: StatsPerson[]
	}
	people: {
		castCredits: { tmdbId: number; credits: number }[]
		names: StatsPerson[]
	}
	trivia: {
		commonTitles: { title: string; movies: number }[]
		commonRoles: { role: string; credits: number }[]
		christmas: number
		zombies: number
		sharks: number
		oneLetterTitles: (StatsTitle & { imdb: number; votes: number })[]
		longestTitles: (StatsTitle & { letters: number })[]
		friday13Horror: number
		friday13Top: (StatsTitle & { imdb: number; votes: number })[]
		busiestYears: { year: number; movies: number }[]
		biggestSeries: { id: number; name: string; movies: number }[]
		boxOfficePerMinute: (StatsTitle & {
			revenue: number
			runtime: number
			released: number | null
		})[]
		sourcesAgree: (StatsTitle & {
			imdb: number
			letterboxd: number
			metascore: number
			tomatometer: number
		})[]
	}
}

/** Member rows, read per member so that the privacy rules (members.ts) can drop a member's rows before counting. */
export interface RawMembers {
	/** `user_setting` `profile_visibility` values, as stored (JSON text). */
	visibility: { userId: string; value: string }[]
	scores: {
		userId: string
		type: MediaType
		tmdbId: number
		score: number
		/** Epoch ms. */
		createdAt: number | null
		year: number | null
		genres: string[]
	}[]
	/** Scores an import wrote (`user_import_item` rows it added). */
	importedScores: { userId: string; type: MediaType; tmdbId: number }[]
	/** Logged movie watches and their minutes, per member. */
	movieMinutes: { userId: string; minutes: number }[]
	episodeMinutes: { userId: string; minutes: number }[]
	watches: { userId: string; type: MediaType; watches: number }[]
	showWatches: { userId: string; tmdbId: number; watches: number }[]
	seen: { userId: string; type: MediaType; tmdbId: number }[]
	wishlist: {
		userId: string
		type: MediaType
		tmdbId: number
		createdAt: number | null
		/** The movie's runtime; null for a show. */
		runtime: number | null
	}[]
	imports: { userId: string; source: string; added: number }[]
	countries: { userId: string; code: string }[]
}

/** A title a member list names, with its IMDb score for the members against IMDb rows. */
export interface MemberTitleRow extends StatsTitle {
	imdb: number | null
}
