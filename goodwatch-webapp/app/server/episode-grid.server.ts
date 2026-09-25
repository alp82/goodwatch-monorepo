// The episode grid of a show page (#153): IMDb episode ratings in IMDb's season and
// episode numbering, plus one season score per provider. It has its own Redis entry so
// the details payload and its cache entry stay the same size.
//
// Every query is keyed by show_id. imdb_episode, imdb_season, rotten_tomatoes_season and
// metacritic_season are CLUSTERED BY (show_id), so each read touches one shard.
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

export interface GridEpisode {
	/** IMDb episode number. 0 is a numbered special such as a Christmas episode. */
	number: number
	name: string
	score: number
	votes: number
}

export interface GridSpecial {
	name: string
	score: number
	votes: number
}

/** A score a provider publishes, on its own scale. `count` is votes, reviews or null when the provider has none. */
export interface ProviderScore {
	score: number
	count: number | null
	url?: string
}

export interface SeasonScores {
	/** Vote-weighted mean of the season's rated IMDb episodes, 0-10. */
	imdb: ProviderScore | null
	/** TMDB season average, 0-10, without a vote count. */
	tmdb: ProviderScore | null
	/** Rotten Tomatoes Tomatometer, 0-100, with the review count. */
	tomatometer: ProviderScore | null
	/** Rotten Tomatoes Popcornmeter, 0-100, with the rating count. */
	popcornmeter: ProviderScore | null
	/** Metacritic Metascore, 0-100, with the review count. */
	metascore: ProviderScore | null
	/** Metacritic user score, 0-10, with the rating count. */
	metacriticUser: ProviderScore | null
}

export interface GridSeason {
	number: number
	/** Sorted by episode number. Numbers without a rated episode are gaps. */
	episodes: GridEpisode[]
	/** Highest episode number IMDb lists for the season, rated or not. */
	maxEpisodeNumber: number
	scores: SeasonScores
}

// A type alias, not an interface, so it fits the JSON constraint of `cached`.
export type EpisodeGrid = {
	showId: number
	/** Seasons with at least one rated episode, in IMDb numbering. */
	seasons: GridSeason[]
	/** Episodes IMDb lists without a season. They count toward no season score. */
	specials: GridSpecial[]
	/** Widest season, for the column count. */
	maxEpisodeNumber: number
	/** Some season has an episode 0. */
	hasEpisodeZero: boolean
	/** Which providers have a score for at least one season. */
	providers: (keyof SeasonScores)[]
}

export const PROVIDER_ORDER: (keyof SeasonScores)[] = [
	"imdb",
	"tmdb",
	"tomatometer",
	"popcornmeter",
	"metascore",
	"metacriticUser",
]

interface EpisodeRow {
	imdb_episode_id: string
	season_number: number | null
	episode_number: number | null
	name: string | null
	score: number | null
	votes: number | null
}

interface ImdbSeasonRow {
	season_number: number
	score: number | null
	votes: number | null
	max_episode_number: number | null
}

interface TmdbSeasonRow {
	season_number: number
	vote_average: number | null
	episode_count: number | null
}

interface RottenSeasonRow {
	season_number: number
	url: string | null
	tomato: number | null
	tomato_count: number | null
	audience: number | null
	audience_count: number | null
}

interface MetacriticSeasonRow {
	season_number: number
	url: string | null
	meta: number | null
	meta_count: number | null
	user_score: number | null
	user_count: number | null
}

export interface EpisodeGridRows {
	episodes: EpisodeRow[]
	imdbSeasons: ImdbSeasonRow[]
	tmdbSeasons: TmdbSeasonRow[]
	rottenSeasons: RottenSeasonRow[]
	metacriticSeasons: MetacriticSeasonRow[]
}

// TMDB numbers some seasons differently from IMDb (#149 found 705 shifted titles). Its
// season score is shown only when the TMDB season's episode count is within this many
// episodes of IMDb's highest episode number for the same season number.
const TMDB_EPISODE_COUNT_TOLERANCE = 1

export const getEpisodeGrid = async ({ showId }: { showId: string }) => {
	if (!/^\d+$/.test(showId)) return null
	return await cached<{ showId: string }, EpisodeGrid>({
		name: "episode-grid",
		target: _getEpisodeGrid,
		params: { showId },
		// The IMDb ingest runs daily and the critic crawls weekly per airing show.
		ttlMinutes: 6 * 60,
	})
}

const _getEpisodeGrid = async ({ showId }: { showId: string }): Promise<EpisodeGrid> => {
	const id = Number(showId)
	const [episodes, imdbSeasons, tmdbSeasons, rottenSeasons, metacriticSeasons] = await Promise.all([
		query<EpisodeRow>(
			`SELECT imdb_episode_id, season_number, episode_number, name,
				imdb_user_score_original AS score, imdb_user_score_rating_count AS votes
			FROM imdb_episode WHERE show_id = ?`,
			[id],
		),
		query<ImdbSeasonRow>(
			`SELECT season_number, imdb_user_score_original AS score,
				imdb_user_score_rating_count AS votes, max_episode_number
			FROM imdb_season WHERE show_id = ?`,
			[id],
		),
		query<TmdbSeasonRow>(
			"SELECT season_number, vote_average, episode_count FROM season WHERE show_id = ?",
			[id],
		),
		query<RottenSeasonRow>(
			`SELECT season_number, rotten_tomatoes_url AS url,
				rotten_tomatoes_tomato_score_original AS tomato,
				rotten_tomatoes_tomato_score_review_count AS tomato_count,
				rotten_tomatoes_audience_score_original AS audience,
				rotten_tomatoes_audience_score_rating_count AS audience_count
			FROM rotten_tomatoes_season WHERE show_id = ?`,
			[id],
		),
		query<MetacriticSeasonRow>(
			`SELECT season_number, metacritic_url AS url,
				metacritic_meta_score_original AS meta,
				metacritic_meta_score_review_count AS meta_count,
				metacritic_user_score_original AS user_score,
				metacritic_user_score_rating_count AS user_count
			FROM metacritic_season WHERE show_id = ?`,
			[id],
		),
	])
	return buildEpisodeGrid(id, { episodes, imdbSeasons, tmdbSeasons, rottenSeasons, metacriticSeasons })
}

// A score of 0 or below means the provider has none (TMDB stores 0.0 for no votes).
const present = (value: number | null | undefined): value is number =>
	typeof value === "number" && Number.isFinite(value) && value > 0

const providerScore = (score: number | null, count: number | null, url?: string | null): ProviderScore | null =>
	present(score) ? { score, count: present(count) ? count : null, ...(url ? { url } : {}) } : null

export const buildEpisodeGrid = (showId: number, rows: EpisodeGridRows): EpisodeGrid => {
	const bySeason = new Map<number, Map<number, GridEpisode>>()
	const specials: (GridSpecial & { order: number })[] = []

	for (const row of rows.episodes) {
		if (!present(row.score)) continue
		const name = row.name?.trim() || ""
		const votes = row.votes ?? 0
		if (row.season_number === null) {
			specials.push({ name, score: row.score, votes, order: Number(row.imdb_episode_id.replace(/\D/g, "")) })
			continue
		}
		// A season episode without a number cannot be placed in the grid.
		if (row.episode_number === null) continue
		const season = bySeason.get(row.season_number) ?? new Map<number, GridEpisode>()
		bySeason.set(row.season_number, season)
		// IMDb occasionally lists two episodes under one number; keep the one more people rated.
		const existing = season.get(row.episode_number)
		if (existing && existing.votes >= votes) continue
		season.set(row.episode_number, { number: row.episode_number, name, score: row.score, votes })
	}

	const imdbSeasons = new Map(rows.imdbSeasons.map((r) => [r.season_number, r]))
	const tmdbSeasons = new Map(rows.tmdbSeasons.map((r) => [r.season_number, r]))
	const rottenSeasons = new Map(rows.rottenSeasons.map((r) => [r.season_number, r]))
	const metacriticSeasons = new Map(rows.metacriticSeasons.map((r) => [r.season_number, r]))

	const seasons: GridSeason[] = [...bySeason.entries()]
		.sort(([a], [b]) => a - b)
		.map(([number, episodeMap]) => {
			const episodes = [...episodeMap.values()].sort((a, b) => a.number - b.number)
			const imdb = imdbSeasons.get(number)
			const maxEpisodeNumber = Math.max(imdb?.max_episode_number ?? 0, episodes[episodes.length - 1].number)
			const tmdb = tmdbSeasons.get(number)
			const tmdbMatches =
				tmdb && present(tmdb.episode_count) && Math.abs(tmdb.episode_count - maxEpisodeNumber) <= TMDB_EPISODE_COUNT_TOLERANCE
			const rotten = rottenSeasons.get(number)
			const metacritic = metacriticSeasons.get(number)
			return {
				number,
				episodes,
				maxEpisodeNumber,
				scores: {
					imdb: imdb ? providerScore(imdb.score, imdb.votes) : null,
					tmdb: tmdbMatches ? providerScore(tmdb.vote_average, null) : null,
					tomatometer: rotten ? providerScore(rotten.tomato, rotten.tomato_count, rotten.url) : null,
					popcornmeter: rotten ? providerScore(rotten.audience, rotten.audience_count, rotten.url) : null,
					metascore: metacritic ? providerScore(metacritic.meta, metacritic.meta_count, metacritic.url) : null,
					metacriticUser: metacritic ? providerScore(metacritic.user_score, metacritic.user_count, metacritic.url) : null,
				},
			}
		})

	// The dataset has no air dates. IMDb assigns ids in the order titles are added, which
	// is close enough to broadcast order for a row of specials.
	specials.sort((a, b) => a.order - b.order)

	return {
		showId,
		seasons,
		specials: specials.map(({ order, ...special }) => special),
		maxEpisodeNumber: Math.max(0, ...seasons.map((s) => s.maxEpisodeNumber)),
		hasEpisodeZero: seasons.some((s) => s.episodes[0]?.number === 0),
		providers: PROVIDER_ORDER.filter((key) => seasons.some((s) => s.scores[key] !== null)),
	}
}
