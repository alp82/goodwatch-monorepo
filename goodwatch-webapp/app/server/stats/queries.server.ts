// The stats refresh's reads: every number /stats shows, from Crate, SELECT only. Rows come back positional, so the
// column order in each statement is the mapping (Crate lowercases unquoted aliases; positions don't care). Slow shapes
// are avoided: aggregates first, then names and posters by id in a second, small statement; member rows are read per
// member and counted in members.ts, not joined and sorted in SQL.
import type {
	MediaType,
	StatsEpisode,
	StatsTitle,
} from "~/domain/stats/snapshot"
import { backgroundStatement } from "~/server/command-palette/background.server"
import type { Counts, MemberAggregates } from "./members"
import { memberTitleKeys } from "./members"
import type { MemberTitleRow, RawCatalog, RawMembers } from "./raw"

type Cell = string | number | boolean | null | string[]
type Row = Cell[]

/** One statement's time, for the refresh log. */
export type Timing = { name: string; ms: number }

export interface Reader {
	rows<T extends Row>(name: string, sql: string): Promise<T[]>
	timings: Timing[]
}

export function crateReader(): Reader {
	const timings: Timing[] = []
	return {
		timings,
		async rows<T extends Row>(name: string, sql: string) {
			const start = performance.now()
			try {
				return (await backgroundStatement(sql)).rows as T[]
			} finally {
				timings.push({ name, ms: Math.round(performance.now() - start) })
			}
		},
	}
}

/**
 * A gate that lets at most `max` statements run at once: the cluster is shared, and this runs once a day. Once the
 * signal aborts, no statement starts any more: each one still to come throws the signal's reason.
 */
export function limiter(max: number, signal?: AbortSignal) {
	let active = 0
	const waiting: (() => void)[] = []
	return async <T>(task: () => Promise<T>): Promise<T> => {
		signal?.throwIfAborted()
		if (active >= max)
			await new Promise<void>((resolve) => waiting.push(resolve))
		if (signal?.aborted) {
			waiting.shift()?.()
			throw signal.reason
		}
		active++
		try {
			return await task()
		} finally {
			active--
			waiting.shift()?.()
		}
	}
}
type Gate = ReturnType<typeof limiter>

/** Runs every task through the gate and keeps each one's own result type, in order. */
function together<const T extends readonly (() => Promise<unknown>)[]>(
	gate: Gate,
	tasks: T,
): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
	return Promise.all(tasks.map((task) => gate(task))) as Promise<{
		-readonly [K in keyof T]: Awaited<ReturnType<T[K]>>
	}>
}

const n = (v: Cell): number => (typeof v === "number" ? v : Number(v ?? 0))
const nn = (v: Cell): number | null =>
	v === null || v === undefined ? null : Number(v)
const s = (v: Cell): string => (v === null ? "" : String(v))
const sn = (v: Cell): string | null => (v === null ? null : String(v))
const ids = (list: number[]) => (list.length ? list.join(",") : "-1")

/** Movies with a real audience, a poster and a real year. */
const NOTABLE_MOVIE =
	"imdb_user_score_rating_count >= 1000 AND poster_path IS NOT NULL AND release_year >= 1870"
/** Shows need TMDB votes too, which drops mislinked IMDb ids. */
const NOTABLE_SHOW =
	"imdb_user_score_rating_count >= 1000 AND tmdb_user_score_rating_count >= 50 AND poster_path IS NOT NULL"
/** Letterboxd counts past this are wrong matches (a 2026 movie with 5.5 million ratings). */
const LETTERBOXD_SANE = "letterboxd_user_score_rating_count < 7000000"
/** Record lists read this many rows, so build.ts can drop suspect ones and still fill the page's five. */
const OVER = 15

/** Distinct titles in a table of both kinds: movie 550 and show 550 are two titles, so the type is part of the key. */
const DISTINCT_TITLES =
	"count(DISTINCT media_type || '-' || media_tmdb_id::text)"

const TITLE_COLS = "tmdb_id, title, release_year, poster_path"
const titleOf = (type: MediaType, r: Row): StatsTitle => ({
	type,
	tmdbId: n(r[0]),
	title: s(r[1]),
	year: nn(r[2]),
	poster: sn(r[3]),
})

const top = (
	table: "movie" | "show",
	extra: string,
	where: string,
	order: string,
	limit = OVER,
) =>
	`SELECT ${TITLE_COLS}${extra ? `, ${extra}` : ""} FROM doc.${table} WHERE ${where} ORDER BY ${order} LIMIT ${limit}`

const EPISODE_COLS =
	"s.tmdb_id, s.title, s.poster_path, e.season_number, e.episode_number, e.name, e.imdb_user_score_original, e.imdb_user_score_rating_count"
const episodeOf = (r: Row): StatsEpisode => ({
	showId: n(r[0]),
	show: s(r[1]),
	poster: sn(r[2]),
	season: n(r[3]),
	episode: n(r[4]),
	name: s(r[5]),
	imdb: n(r[6]),
	votes: n(r[7]),
})
const episodes = (where: string, order: string) =>
	`SELECT ${EPISODE_COLS} FROM doc.imdb_episode e JOIN doc.show s ON s.tmdb_id = e.show_id WHERE s.tmdb_user_score_rating_count >= 50 AND e.season_number > 0 AND ${where} ORDER BY ${order} LIMIT 12`

const META_COLS =
	"metacritic_meta_score_original, metacritic_meta_score_review_count, metacritic_user_score_original, metacritic_user_score_rating_count"
const metaOf = (type: MediaType) => (r: Row) => ({
	...titleOf(type, r),
	metascore: n(r[4]),
	criticReviews: n(r[5]),
	userScore: nn(r[6]),
	userRatings: nn(r[7]),
})

const LB_GAP = `${NOTABLE_MOVIE} AND imdb_user_score_rating_count >= 20000 AND letterboxd_user_score_rating_count >= 20000 AND ${LETTERBOXD_SANE}`
const META_MOVIES = `${NOTABLE_MOVIE} AND metacritic_meta_score_review_count >= 15`
const FRIDAY_13 =
	"'Horror' = ANY(genres) AND extract(DAY FROM release_date) = 13 AND extract(DAY_OF_WEEK FROM release_date) = 5"
/** Character names that say nothing about the role: the actor as themselves, voices, extras. */
const GENERIC_ROLES =
	"'himself','herself','self','narrator','narrator (voice)','additional voices','additional voices (voice)','self (archive footage)','self - host','self - guest','voice','(voice)','cameo','extra','uncredited'"

/** The catalog side of the snapshot: every statement but the member ones. */
export async function readCatalog(
	db: Reader,
	gate: Gate,
	now: number,
): Promise<RawCatalog> {
	const one = async (name: string, sql: string) =>
		(await db.rows(name, sql))[0] ?? []
	// Gate order is start order: the long scans (trivia, essence tags) go first.
	const phase4 = together(gate, [
		() =>
			db.rows<[string, number]>(
				"common titles",
				"SELECT title, count(*) FROM doc.movie WHERE release_year >= 1900 GROUP BY title ORDER BY 2 DESC LIMIT 10",
			),
		() =>
			db.rows<[string, number]>(
				"common roles",
				`SELECT c, count(*) FROM (SELECT lower(character) AS c FROM doc.person_appeared_in WHERE media_type = 'movie' AND character IS NOT NULL AND character <> '') x WHERE c NOT IN (${GENERIC_ROLES}) AND c NOT LIKE '%(uncredited)%' AND c NOT LIKE 'self%' GROUP BY c ORDER BY 2 DESC LIMIT 20`,
			),
		() =>
			db.rows(
				"one-letter titles",
				top(
					"movie",
					"imdb_user_score_original, imdb_user_score_rating_count",
					`${NOTABLE_MOVIE} AND char_length(title) = 1`,
					"imdb_user_score_rating_count DESC",
				),
			),
		() =>
			db.rows(
				"longest titles",
				top(
					"movie",
					"char_length(title)",
					NOTABLE_MOVIE,
					"char_length(title) DESC",
					8,
				),
			),
		() =>
			one(
				"friday the 13th horror",
				`SELECT count(*) FROM doc.movie WHERE ${FRIDAY_13}`,
			),
		() =>
			db.rows(
				"friday the 13th, best known",
				top(
					"movie",
					"imdb_user_score_original, imdb_user_score_rating_count",
					`${NOTABLE_MOVIE} AND ${FRIDAY_13}`,
					"imdb_user_score_rating_count DESC",
					10,
				),
			),
		() =>
			db.rows<[number, number]>(
				"busiest years",
				// Only finished years: the current one is still filling.
				`SELECT release_year, count(*) FROM doc.movie WHERE release_year BETWEEN 1900 AND ${new Date(now).getUTCFullYear() - 1} GROUP BY 1 ORDER BY 2 DESC LIMIT 3`,
			),
		() =>
			db.rows<[number, number]>(
				"biggest series",
				"SELECT movie_series_id, count(*) FROM doc.movie WHERE movie_series_id IS NOT NULL AND imdb_user_score_rating_count >= 1000 GROUP BY 1 ORDER BY 2 DESC LIMIT 5",
			),
		() =>
			db.rows(
				"box office per minute",
				top(
					"movie",
					"revenue, runtime, release_date",
					`${NOTABLE_MOVIE} AND revenue > 0 AND runtime >= 60 AND imdb_user_score_rating_count >= 50000`,
					"revenue / runtime DESC",
				),
			),
		() =>
			db.rows(
				"all sources agree",
				top(
					"movie",
					"imdb_user_score_original, letterboxd_user_score_original, metacritic_meta_score_original, rotten_tomatoes_tomato_score_original",
					`${NOTABLE_MOVIE} AND imdb_user_score_rating_count >= 100000 AND letterboxd_user_score_rating_count >= 10000 AND metacritic_meta_score_original IS NOT NULL AND rotten_tomatoes_tomato_score_original IS NOT NULL AND ${LETTERBOXD_SANE}`,
					"greatest(imdb_user_score_normalized_percent, letterboxd_user_score_normalized_percent, metacritic_meta_score_normalized_percent, rotten_tomatoes_tomato_score_normalized_percent) - least(imdb_user_score_normalized_percent, letterboxd_user_score_normalized_percent, metacritic_meta_score_normalized_percent, rotten_tomatoes_tomato_score_normalized_percent) ASC, imdb_user_score_rating_count DESC",
				),
			),
	])

	const phase3 = together(gate, [
		() =>
			one(
				"trope totals",
				"SELECT count(*), count(DISTINCT url) FROM doc.trope",
			),
		() =>
			db.rows<[string, number]>(
				"top tropes",
				"SELECT url, count(*) FROM doc.trope WHERE url IS NOT NULL GROUP BY url ORDER BY 2 DESC LIMIT 12",
			),
		() =>
			db.rows<[string, number]>(
				"essence tags",
				"SELECT t, count(*) FROM (SELECT unnest(essence_tags) AS t FROM doc.movie WHERE essence_tags IS NOT NULL) x GROUP BY 1 ORDER BY 2 DESC LIMIT 12",
			),
		() =>
			one(
				"streaming totals",
				`SELECT count(*), ${DISTINCT_TITLES}, count(DISTINCT country_code), count(DISTINCT streaming_service_id) FROM doc.streaming_availability`,
			),
		() =>
			db.rows<[string, number]>(
				"offers by kind",
				"SELECT streaming_type, count(*) FROM doc.streaming_availability GROUP BY 1 ORDER BY 2 DESC",
			),
		() =>
			db.rows<[string, number]>(
				"offers by country",
				"SELECT country_code, count(*) FROM doc.streaming_availability GROUP BY 1 ORDER BY 2 DESC LIMIT 500",
			),
		() =>
			db.rows<[number, number]>(
				"subscription offers by service",
				"SELECT streaming_service_id, count(*) FROM doc.streaming_availability WHERE streaming_type = 'flatrate' GROUP BY 1 ORDER BY 2 DESC LIMIT 16",
			),
		() =>
			db.rows(
				"streams in most countries",
				top(
					"movie",
					"array_length(streaming_country_codes, 1)",
					NOTABLE_MOVIE,
					"array_length(streaming_country_codes, 1) DESC NULLS LAST, imdb_user_score_rating_count DESC",
				),
			),
		() =>
			one(
				"award totals",
				`SELECT count(*), ${DISTINCT_TITLES}, sum(CASE WHEN has_win THEN 1 ELSE 0 END), min(ceremony_year), max(ceremony_year) FROM doc.award_title_display`,
			),
		() =>
			one(
				"award people",
				"SELECT count(DISTINCT person_tmdb_id) FROM doc.award_person_display",
			),
		() =>
			db.rows<[string, number]>(
				"award bodies",
				"SELECT award_name, count(*) FROM doc.award_title_display GROUP BY 1 ORDER BY 2 DESC LIMIT 500",
			),
		() =>
			db.rows<[number, string, number]>(
				"most award wins",
				"SELECT media_tmdb_id, media_type, sum(CASE WHEN has_win THEN 1 ELSE 0 END) FROM doc.award_title_display GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 6",
			),
		() =>
			db.rows<[number, number, number]>(
				"most awarded people",
				"SELECT person_tmdb_id, sum(CASE WHEN has_win THEN 1 ELSE 0 END), count(*) FROM doc.award_person_display GROUP BY 1 ORDER BY 2 DESC LIMIT 5",
			),
		() =>
			db.rows<[number, number]>(
				"most cast credits",
				"SELECT person_tmdb_id, count(*) FROM doc.person_appeared_in WHERE media_type = 'movie' GROUP BY 1 ORDER BY 2 DESC LIMIT 5",
			),
	])

	const phase1 = together(gate, [
		() =>
			one(
				"movie totals",
				`SELECT count(*), sum(CASE WHEN runtime BETWEEN 1 AND 1000 THEN runtime ELSE 0 END),
					count(imdb_user_score_rating_count), sum(imdb_user_score_rating_count),
					sum(CASE WHEN ${LETTERBOXD_SANE} THEN 1 ELSE 0 END), sum(CASE WHEN ${LETTERBOXD_SANE} THEN letterboxd_user_score_rating_count ELSE 0 END),
					sum(tmdb_user_score_rating_count), count(metacritic_meta_score_original),
					sum(metacritic_meta_score_review_count), sum(metacritic_user_score_rating_count),
					count(rotten_tomatoes_tomato_score_original), count(goodwatch_overall_score_normalized_percent),
					count(fingerprint_highlight_keys),
					count(*) FILTER (WHERE title ILIKE '%christmas%'), count(*) FILTER (WHERE title ILIKE '%zombie%'),
					count(*) FILTER (WHERE title ILIKE '%shark%')
				FROM doc.movie`,
			),
		() =>
			// A show's IMDb votes count only with TMDB votes too, or under 100,000: a mislinked id carries a famous movie's.
			one(
				"show totals",
				`SELECT count(*),
					sum(CASE WHEN imdb_user_score_rating_count IS NOT NULL AND (tmdb_user_score_rating_count >= 1 OR imdb_user_score_rating_count < 100000) THEN 1 ELSE 0 END),
					sum(CASE WHEN tmdb_user_score_rating_count >= 1 OR imdb_user_score_rating_count < 100000 THEN imdb_user_score_rating_count ELSE 0 END),
					sum(tmdb_user_score_rating_count), count(metacritic_meta_score_original),
					count(rotten_tomatoes_tomato_score_original), count(goodwatch_overall_score_normalized_percent),
					count(fingerprint_highlight_keys),
					sum(CASE WHEN context_is_binge_friendly THEN 1 ELSE 0 END), sum(CASE WHEN context_is_comfort_watch THEN 1 ELSE 0 END),
					sum(CASE WHEN context_is_thought_provoking THEN 1 ELSE 0 END), sum(CASE WHEN context_is_background_friendly THEN 1 ELSE 0 END)
				FROM doc.show`,
			),
		() => one("seasons", "SELECT count(*) FROM doc.season"),
		() =>
			one(
				"episodes",
				"SELECT count(*), sum(CASE WHEN runtime BETWEEN 1 AND 400 THEN runtime ELSE 0 END) FROM doc.episode WHERE removed_at IS NULL",
			),
		() =>
			one(
				"imdb episodes",
				"SELECT sum(imdb_user_score_rating_count) FROM doc.imdb_episode",
			),
		() => one("people", "SELECT count(*) FROM doc.person"),
		() => one("cast credits", "SELECT count(*) FROM doc.person_appeared_in"),
		() => one("crew credits", "SELECT count(*) FROM doc.person_worked_on"),
		() =>
			one(
				"characters",
				"SELECT count(*), count(image_url) FROM doc.tvdb_character",
			),
		() =>
			db.rows<[string, number]>(
				"images",
				"SELECT image_type, count(*) FROM doc.media_image GROUP BY 1",
			),
		() =>
			one(
				"trailers",
				"SELECT count(*) FROM doc.media_video WHERE video_type = 'Trailer'",
			),
		() =>
			db.rows<[number, number]>(
				"movies by decade",
				`SELECT floor(release_year / 10) * 10, count(*) FROM doc.movie WHERE ${NOTABLE_MOVIE} AND release_year >= 1900 GROUP BY 1 ORDER BY 1`,
			),
		() =>
			db.rows<[number, number]>(
				"runtime by decade",
				`SELECT floor(release_year / 10) * 10, avg(runtime) FROM doc.movie WHERE ${NOTABLE_MOVIE} AND runtime BETWEEN 40 AND 400 AND release_year >= 1920 GROUP BY 1 ORDER BY 1`,
			),
		() =>
			db.rows<[string, number]>(
				"genres",
				`SELECT g, count(*) FROM (SELECT unnest(genres) AS g FROM doc.movie WHERE ${NOTABLE_MOVIE}) x GROUP BY 1 ORDER BY 2 DESC LIMIT 14`,
			),
		() =>
			db.rows<[string, number]>(
				"languages",
				"SELECT original_language_code, count(*) FROM doc.movie WHERE original_language_code IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12",
			),
		() =>
			db.rows<[number, number]>(
				"imdb spread",
				`SELECT floor(imdb_user_score_original), count(*) FROM doc.movie WHERE ${NOTABLE_MOVIE} AND imdb_user_score_original < 10 GROUP BY 1`,
			),
		() =>
			db.rows<[number, number]>(
				"metascore spread",
				"SELECT floor(metacritic_meta_score_original / 10) * 10, count(*) FROM doc.movie WHERE metacritic_meta_score_original IS NOT NULL GROUP BY 1",
			),
		// A real show (TMDB votes) with the movie's IMDb id: the movie is that series. A show without votes that carries
		// a movie's IMDb id is the mislinked one (a children's series with Fight Club's id), and the movie stays.
		() =>
			db.rows<[number]>(
				"series as movies",
				"SELECT tmdb_id FROM doc.movie WHERE imdb_user_score_rating_count >= 1000 AND imdb_id IN (SELECT imdb_id FROM doc.show WHERE imdb_id IS NOT NULL AND tmdb_user_score_rating_count >= 50) LIMIT 10000",
			),
	])

	const movie = (rows: Row[]) => rows.map((r) => titleOf("movie", r))
	const show = (rows: Row[]) => rows.map((r) => titleOf("show", r))
	const phase2 = together(gate, [
		() =>
			db.rows(
				"most imdb votes, movies",
				top(
					"movie",
					"imdb_user_score_rating_count",
					NOTABLE_MOVIE,
					"imdb_user_score_rating_count DESC",
				),
			),
		() =>
			db.rows(
				"most imdb votes, shows",
				top(
					"show",
					"imdb_user_score_rating_count",
					NOTABLE_SHOW,
					"imdb_user_score_rating_count DESC",
				),
			),
		() =>
			db.rows(
				"most letterboxd ratings",
				top(
					"movie",
					"letterboxd_user_score_rating_count",
					`${NOTABLE_MOVIE} AND ${LETTERBOXD_SANE}`,
					"letterboxd_user_score_rating_count DESC NULLS LAST",
				),
			),
		() =>
			db.rows(
				"highest letterboxd",
				top(
					"movie",
					"letterboxd_user_score_original, letterboxd_user_score_rating_count",
					`${NOTABLE_MOVIE} AND letterboxd_user_score_rating_count >= 10000 AND ${LETTERBOXD_SANE}`,
					"letterboxd_user_score_original DESC, letterboxd_user_score_rating_count DESC",
				),
			),
		() =>
			db.rows(
				"imdb over letterboxd",
				top(
					"movie",
					"imdb_user_score_original, imdb_user_score_rating_count, letterboxd_user_score_original",
					LB_GAP,
					"imdb_user_score_normalized_percent - letterboxd_user_score_normalized_percent DESC",
				),
			),
		() =>
			db.rows(
				"letterboxd over imdb",
				top(
					"movie",
					"imdb_user_score_original, imdb_user_score_rating_count, letterboxd_user_score_original",
					LB_GAP,
					"imdb_user_score_normalized_percent - letterboxd_user_score_normalized_percent ASC",
				),
			),
		() =>
			db.rows(
				"critics against audiences",
				top(
					"movie",
					"rotten_tomatoes_tomato_score_original, rotten_tomatoes_audience_score_original",
					`${NOTABLE_MOVIE} AND imdb_user_score_rating_count >= 50000 AND rotten_tomatoes_tomato_score_original IS NOT NULL AND rotten_tomatoes_audience_score_original IS NOT NULL`,
					"abs(rotten_tomatoes_tomato_score_original - rotten_tomatoes_audience_score_original) DESC",
				),
			),
		() =>
			db.rows(
				"top goodwatch, movies",
				top(
					"movie",
					"goodwatch_overall_score_normalized_percent",
					`${NOTABLE_MOVIE} AND goodwatch_overall_score_voting_count >= 100000`,
					"goodwatch_overall_score_normalized_percent DESC NULLS LAST",
				),
			),
		() =>
			db.rows(
				"top goodwatch, shows",
				top(
					"show",
					"goodwatch_overall_score_normalized_percent",
					`${NOTABLE_SHOW} AND goodwatch_overall_score_voting_count >= 50000`,
					"goodwatch_overall_score_normalized_percent DESC NULLS LAST",
				),
			),
		// The oldest need a smaller audience: few people have voted on an 1880s short.
		() =>
			db.rows(
				"oldest",
				top(
					"movie",
					"",
					"imdb_user_score_rating_count >= 100 AND poster_path IS NOT NULL AND release_year >= 1870 AND release_date IS NOT NULL",
					"release_date ASC",
				),
			),
		() =>
			db.rows(
				"longest",
				top(
					"movie",
					"runtime",
					`${NOTABLE_MOVIE} AND runtime < 2000`,
					"runtime DESC",
				),
			),
		() =>
			db.rows(
				"most episodes",
				top(
					"show",
					"number_of_episodes, number_of_seasons",
					"poster_path IS NOT NULL AND tmdb_user_score_rating_count >= 5",
					"number_of_episodes DESC NULLS LAST",
				),
			),
		() =>
			db.rows(
				"highest grossing",
				top(
					"movie",
					"revenue, budget, release_date",
					`${NOTABLE_MOVIE} AND imdb_user_score_rating_count >= 50000`,
					"revenue DESC NULLS LAST",
				),
			),
		() =>
			db.rows(
				"most tropes",
				top(
					"show",
					"array_length(tropes, 1)",
					`${NOTABLE_SHOW} AND array_length(tropes, 1) > 0`,
					"array_length(tropes, 1) DESC",
					5,
				),
			),
		() =>
			db.rows(
				"highest metascore, movies",
				top(
					"movie",
					META_COLS,
					META_MOVIES,
					"metacritic_meta_score_original DESC, metacritic_meta_score_review_count DESC",
				),
			),
		() =>
			db.rows(
				"highest metascore, shows",
				top(
					"show",
					META_COLS,
					`${NOTABLE_SHOW} AND metacritic_meta_score_review_count >= 10`,
					"metacritic_meta_score_original DESC, metacritic_meta_score_review_count DESC",
				),
			),
		() =>
			db.rows(
				"lowest metascore, movies",
				top(
					"movie",
					META_COLS,
					META_MOVIES,
					"metacritic_meta_score_original ASC",
				),
			),
		() =>
			db.rows(
				"metacritic critics over users",
				top(
					"movie",
					META_COLS,
					`${META_MOVIES} AND metacritic_user_score_rating_count >= 200`,
					"metacritic_meta_score_original - metacritic_user_score_original * 10 DESC",
				),
			),
		() =>
			db.rows(
				"metacritic users over critics",
				top(
					"movie",
					META_COLS,
					`${META_MOVIES} AND metacritic_user_score_rating_count >= 200`,
					"metacritic_meta_score_original - metacritic_user_score_original * 10 ASC",
				),
			),
		() =>
			db.rows(
				"most voted episodes",
				episodes(
					"e.imdb_user_score_rating_count IS NOT NULL",
					"e.imdb_user_score_rating_count DESC",
				),
			),
		() =>
			db.rows(
				"lowest rated episodes",
				episodes(
					"e.imdb_user_score_rating_count >= 20000",
					"e.imdb_user_score_original ASC",
				),
			),
		() =>
			db.rows(
				"highest rated episodes",
				episodes(
					"e.imdb_user_score_rating_count >= 50000",
					"e.imdb_user_score_original DESC, e.imdb_user_score_rating_count DESC",
				),
			),
	])

	const [
		[
			movieTotals,
			showTotals,
			seasons,
			episodeTotals,
			imdbEpisodes,
			people,
			cast,
			crew,
			characters,
			images,
			trailers,
			moviesByDecade,
			runtimeByDecade,
			genres,
			languages,
			imdbBuckets,
			metascoreBuckets,
			seriesAsMovies,
		],
		[
			mostImdbVotesMovies,
			mostImdbVotesShows,
			mostLetterboxdRatings,
			highestLetterboxd,
			imdbOverLetterboxd,
			letterboxdOverImdb,
			criticsVsAudience,
			topGoodwatchMovies,
			topGoodwatchShows,
			oldest,
			longest,
			mostEpisodes,
			highestGrossing,
			mostTropes,
			highestMetascoreMovies,
			highestMetascoreShows,
			lowestMetascoreMovies,
			criticsOverUsers,
			usersOverCritics,
			mostVoted,
			lowestRated,
			highestRated,
		],
		[
			tropeTotals,
			tropeTop,
			essenceTags,
			streamingTotals,
			byType,
			byCountry,
			byService,
			mostCountries,
			awardTotals,
			awardPeople,
			awardBodies,
			mostWins,
			mostAwarded,
			castCredits,
		],
		[
			commonTitles,
			commonRoles,
			oneLetterTitles,
			longestTitles,
			friday13,
			friday13Top,
			busiestYears,
			biggestSeries,
			boxOfficePerMinute,
			sourcesAgree,
		],
	] = await Promise.all([phase1, phase2, phase3, phase4])

	// Second round: names for the ids the aggregates found.
	const urls = tropeTop.map((r) => `'${s(r[0]).replace(/'/g, "''")}'`)
	const winIds = (type: string) =>
		ids(mostWins.filter((r) => r[1] === type).map((r) => n(r[0])))
	const personIds = ids([
		...mostAwarded.map((r) => n(r[0])),
		...castCredits.map((r) => n(r[0])),
	])
	const [headings, serviceNames, winMovies, winShows, persons, series] =
		await together(gate, [
			() =>
				db.rows<[string, string]>(
					"trope headings",
					`SELECT url, title FROM doc.trope_catalog_page WHERE url IN (${urls.join(",") || "''"})`,
				),
			() =>
				db.rows<[number, string, string | null]>(
					"service names",
					`SELECT tmdb_id, name, logo_path FROM doc.streaming_service WHERE tmdb_id IN (${ids(byService.map((r) => n(r[0])))}) ORDER BY order_default ASC NULLS LAST LIMIT 1000`,
				),
			() =>
				db.rows(
					"award titles, movies",
					`SELECT ${TITLE_COLS} FROM doc.movie WHERE tmdb_id IN (${winIds("movie")})`,
				),
			() =>
				db.rows(
					"award titles, shows",
					`SELECT ${TITLE_COLS} FROM doc.show WHERE tmdb_id IN (${winIds("show")})`,
				),
			() =>
				db.rows<[number, string, string | null]>(
					"people names",
					`SELECT tmdb_id, name, profile_path FROM doc.person WHERE tmdb_id IN (${personIds})`,
				),
			() =>
				db.rows<[number, string]>(
					"series names",
					`SELECT tmdb_id, name FROM doc.movie_series WHERE tmdb_id IN (${ids(biggestSeries.map((r) => n(r[0])))})`,
				),
		])

	const winTitles = new Map(
		[...movie(winMovies), ...show(winShows)].map((t) => [
			`${t.type}-${t.tmdbId}`,
			t,
		]),
	)
	const seriesNames = new Map(series.map((r) => [n(r[0]), s(r[1])]))
	const image = (type: string) => n(images.find((r) => r[0] === type)?.[1] ?? 0)
	const movieMeta = metaOf("movie")

	return {
		catalog: {
			movies: n(movieTotals[0]),
			shows: n(showTotals[0]),
			seasons: n(seasons[0]),
			episodes: n(episodeTotals[0]),
			people: n(people[0]),
			castCredits: n(cast[0]),
			crewCredits: n(crew[0]),
			characters: n(characters[0]),
			characterPortraits: n(characters[1]),
			posters: image("posters"),
			backdrops: image("backdrops"),
			logos: image("logos"),
			trailers: n(trailers[0]),
			movieMinutes: n(movieTotals[1]),
			episodeMinutes: n(episodeTotals[1]),
		},
		sources: {
			imdbMovieVotes: n(movieTotals[3]),
			imdbShowVotes: n(showTotals[2]),
			imdbTitles: n(movieTotals[2]) + n(showTotals[1]),
			imdbEpisodeVotes: n(imdbEpisodes[0]),
			letterboxdTitles: n(movieTotals[4]),
			letterboxdRatings: n(movieTotals[5]),
			tmdbVotes: n(movieTotals[6]) + n(showTotals[3]),
			metacriticTitles: n(movieTotals[7]) + n(showTotals[4]),
			metacriticCriticReviews: n(movieTotals[8]),
			metacriticUserRatings: n(movieTotals[9]),
			rottenTomatoesTitles: n(movieTotals[10]) + n(showTotals[5]),
			goodwatchScored: n(movieTotals[11]) + n(showTotals[6]),
			titleAnalysis: n(movieTotals[12]) + n(showTotals[7]),
		},
		charts: {
			moviesByDecade: moviesByDecade.map((r) => ({
				decade: n(r[0]),
				titles: n(r[1]),
			})),
			runtimeByDecade: runtimeByDecade.map((r) => ({
				decade: n(r[0]),
				minutes: n(r[1]),
			})),
			genres: genres.map((r) => ({ name: s(r[0]), titles: n(r[1]) })),
			languages: languages.map((r) => ({ code: s(r[0]), titles: n(r[1]) })),
			imdbBuckets: imdbBuckets.map((r) => ({
				bucket: n(r[0]),
				titles: n(r[1]),
			})),
			metascoreBuckets: metascoreBuckets.map((r) => ({
				bucket: n(r[0]),
				titles: n(r[1]),
			})),
		},
		seriesAsMovies: seriesAsMovies.map((r) => n(r[0])),
		records: {
			mostImdbVotesMovies: mostImdbVotesMovies.map((r) => ({
				...titleOf("movie", r),
				votes: n(r[4]),
			})),
			mostImdbVotesShows: mostImdbVotesShows.map((r) => ({
				...titleOf("show", r),
				votes: n(r[4]),
			})),
			mostLetterboxdRatings: mostLetterboxdRatings.map((r) => ({
				...titleOf("movie", r),
				ratings: n(r[4]),
			})),
			highestLetterboxd: highestLetterboxd.map((r) => ({
				...titleOf("movie", r),
				score: n(r[4]),
				ratings: n(r[5]),
			})),
			imdbOverLetterboxd: imdbOverLetterboxd.map((r) => ({
				...titleOf("movie", r),
				imdb: n(r[4]),
				imdbVotes: n(r[5]),
				letterboxd: n(r[6]),
			})),
			letterboxdOverImdb: letterboxdOverImdb.map((r) => ({
				...titleOf("movie", r),
				imdb: n(r[4]),
				imdbVotes: n(r[5]),
				letterboxd: n(r[6]),
			})),
			criticsVsAudience: criticsVsAudience.map((r) => ({
				...titleOf("movie", r),
				critics: n(r[4]),
				audience: n(r[5]),
			})),
			topGoodwatchMovies: topGoodwatchMovies.map((r) => ({
				...titleOf("movie", r),
				score: n(r[4]),
			})),
			topGoodwatchShows: topGoodwatchShows.map((r) => ({
				...titleOf("show", r),
				score: n(r[4]),
			})),
			oldest: movie(oldest),
			longest: longest.map((r) => ({
				...titleOf("movie", r),
				runtime: n(r[4]),
			})),
			mostEpisodes: mostEpisodes.map((r) => ({
				...titleOf("show", r),
				episodes: n(r[4]),
				seasons: n(r[5]),
			})),
			highestGrossing: highestGrossing.map((r) => ({
				...titleOf("movie", r),
				revenue: n(r[4]),
				budget: nn(r[5]) || null,
				released: nn(r[6]),
			})),
			mostTropes: mostTropes.map((r) => ({
				...titleOf("show", r),
				tropes: n(r[4]),
			})),
			highestMetascoreMovies: highestMetascoreMovies.map(movieMeta),
			highestMetascoreShows: highestMetascoreShows.map(metaOf("show")),
			lowestMetascoreMovies: lowestMetascoreMovies.map(movieMeta),
			criticsOverUsers: criticsOverUsers.map(movieMeta),
			usersOverCritics: usersOverCritics.map(movieMeta),
		},
		episodes: {
			mostVoted: mostVoted.map(episodeOf),
			lowestRated: lowestRated.map(episodeOf),
			highestRated: highestRated.map(episodeOf),
		},
		tropes: {
			mentions: n(tropeTotals[0]),
			distinct: n(tropeTotals[1]),
			top: tropeTop.map((r) => ({ url: s(r[0]), titles: n(r[1]) })),
			headings: headings.map((r) => ({ url: s(r[0]), title: s(r[1]) })),
			essenceTags: essenceTags.map((r) => ({ name: s(r[0]), titles: n(r[1]) })),
			moods: {
				binge: n(showTotals[8]),
				comfort: n(showTotals[9]),
				thoughtProvoking: n(showTotals[10]),
				background: n(showTotals[11]),
			},
		},
		streaming: {
			offers: n(streamingTotals[0]),
			titles: n(streamingTotals[1]),
			countries: n(streamingTotals[2]),
			services: n(streamingTotals[3]),
			byType: byType.map((r) => ({ type: s(r[0]), offers: n(r[1]) })),
			byCountry: byCountry.map((r) => ({ code: s(r[0]), offers: n(r[1]) })),
			byService: byService.map((r) => ({ id: n(r[0]), offers: n(r[1]) })),
			serviceNames: serviceNames.map((r) => ({
				id: n(r[0]),
				name: s(r[1]),
				logo: sn(r[2]),
			})),
			mostCountries: mostCountries.map((r) => ({
				...titleOf("movie", r),
				countries: n(r[4]),
			})),
		},
		awards: {
			results: n(awardTotals[0]),
			titles: n(awardTotals[1]),
			wins: n(awardTotals[2]),
			firstYear: n(awardTotals[3]),
			lastYear: n(awardTotals[4]),
			people: n(awardPeople[0]),
			bodies: awardBodies.map((r) => ({ name: s(r[0]), results: n(r[1]) })),
			mostWins: mostWins.flatMap((r) => {
				const t = winTitles.get(`${s(r[1])}-${n(r[0])}`)
				return t ? [{ ...t, wins: n(r[2]) }] : []
			}),
			mostAwarded: mostAwarded.map((r) => ({
				tmdbId: n(r[0]),
				wins: n(r[1]),
				nominations: n(r[2]),
			})),
			names: persons.map((r) => ({
				tmdbId: n(r[0]),
				name: s(r[1]),
				profile: sn(r[2]),
			})),
		},
		people: {
			castCredits: castCredits.map((r) => ({
				tmdbId: n(r[0]),
				credits: n(r[1]),
			})),
			names: persons.map((r) => ({
				tmdbId: n(r[0]),
				name: s(r[1]),
				profile: sn(r[2]),
			})),
		},
		trivia: {
			commonTitles: commonTitles.map((r) => ({
				title: s(r[0]),
				movies: n(r[1]),
			})),
			commonRoles: commonRoles.map((r) => ({
				role: s(r[0]),
				credits: n(r[1]),
			})),
			christmas: n(movieTotals[13]),
			zombies: n(movieTotals[14]),
			sharks: n(movieTotals[15]),
			oneLetterTitles: oneLetterTitles.map((r) => ({
				...titleOf("movie", r),
				imdb: n(r[4]),
				votes: n(r[5]),
			})),
			longestTitles: longestTitles.map((r) => ({
				...titleOf("movie", r),
				letters: n(r[4]),
			})),
			friday13Horror: n(friday13[0]),
			friday13Top: friday13Top.map((r) => ({
				...titleOf("movie", r),
				imdb: n(r[4]),
				votes: n(r[5]),
			})),
			busiestYears: busiestYears.map((r) => ({
				year: n(r[0]),
				movies: n(r[1]),
			})),
			biggestSeries: biggestSeries.flatMap((r) => {
				const name = seriesNames.get(n(r[0]))
				return name ? [{ id: n(r[0]), name, movies: n(r[1]) }] : []
			}),
			boxOfficePerMinute: boxOfficePerMinute.map((r) => ({
				...titleOf("movie", r),
				revenue: n(r[4]),
				runtime: n(r[5]),
				released: nn(r[6]),
			})),
			sourcesAgree: sourcesAgree.map((r) => ({
				...titleOf("movie", r),
				imdb: n(r[4]),
				letterboxd: n(r[5]),
				metascore: n(r[6]),
				tomatometer: n(r[7]),
			})),
		},
	}
}

/** Member rows, read per member; members.ts applies the privacy rules before anything is counted. */
export async function readMembers(db: Reader, gate: Gate): Promise<RawMembers> {
	const [
		visibility,
		scores,
		importedScores,
		movieMinutes,
		episodeMinutes,
		watches,
		showWatches,
		seen,
		wishlist,
		imports,
		countries,
	] = await together(gate, [
		() =>
			db.rows<[string, string]>(
				"member visibility",
				"SELECT user_id, value FROM doc.user_setting WHERE key = 'profile_visibility' LIMIT 1000000",
			),
		() =>
			db.rows<
				[
					string,
					string,
					number,
					number,
					number | null,
					number | null,
					string[] | null,
				]
			>(
				"member scores",
				`SELECT u.user_id, u.media_type, u.tmdb_id, u.score, u.created_at, coalesce(m.release_year, s.release_year), coalesce(m.genres, s.genres)
				FROM doc.user_score u
				LEFT JOIN doc.movie m ON u.media_type = 'movie' AND m.tmdb_id = u.tmdb_id
				LEFT JOIN doc.show s ON u.media_type = 'show' AND s.tmdb_id = u.tmdb_id
				LIMIT 5000000`,
			),
		() =>
			db.rows<[string, string, number]>(
				"imported scores",
				"SELECT user_id, media_type, tmdb_id FROM doc.user_import_item WHERE apply_state = 'added' AND (kind = 'rating' OR kind IS NULL) AND tmdb_id IS NOT NULL LIMIT 5000000",
			),
		() =>
			db.rows<[string, number]>(
				"member movie minutes",
				"SELECT w.user_id, sum(m.runtime) FROM doc.user_watch_log w JOIN doc.movie m ON m.tmdb_id = w.tmdb_id WHERE w.media_type = 'movie' AND m.runtime BETWEEN 1 AND 400 GROUP BY 1 LIMIT 1000000",
			),
		() =>
			db.rows<[string, number]>(
				"member episode minutes",
				"SELECT w.user_id, sum(e.runtime) FROM doc.user_watch_log w JOIN doc.episode e ON e.tmdb_id = w.episode_tmdb_id WHERE w.media_type = 'show' AND e.runtime BETWEEN 1 AND 300 GROUP BY 1 LIMIT 1000000",
			),
		() =>
			db.rows<[string, string, number]>(
				"member watches",
				"SELECT user_id, media_type, count(*) FROM doc.user_watch_log GROUP BY 1, 2 LIMIT 1000000",
			),
		() =>
			db.rows<[string, number, number]>(
				"member show watches",
				"SELECT user_id, tmdb_id, count(*) FROM doc.user_watch_log WHERE media_type = 'show' GROUP BY 1, 2 LIMIT 5000000",
			),
		() =>
			db.rows<[string, string, number]>(
				"member seen marks",
				"SELECT user_id, media_type, tmdb_id FROM doc.user_watch_state WHERE state = 'seen' LIMIT 5000000",
			),
		() =>
			db.rows<[string, string, number, number | null, number | null]>(
				"member wishlists",
				`SELECT w.user_id, w.media_type, w.tmdb_id, w.created_at, m.runtime
				FROM doc.user_wishlist w LEFT JOIN doc.movie m ON w.media_type = 'movie' AND m.tmdb_id = w.tmdb_id
				LIMIT 5000000`,
			),
		() =>
			db.rows<[string, string, number | null]>(
				"member imports",
				"SELECT user_id, source, added FROM doc.user_import WHERE status = 'done' LIMIT 1000000",
			),
		() =>
			db.rows<[string, string]>(
				"member countries",
				"SELECT user_id, value FROM doc.user_setting WHERE key = 'country_default' LIMIT 1000000",
			),
	])
	const type = (v: Cell): MediaType => (v === "show" ? "show" : "movie")
	return {
		visibility: visibility.map((r) => ({ userId: s(r[0]), value: s(r[1]) })),
		scores: scores.map((r) => ({
			userId: s(r[0]),
			type: type(r[1]),
			tmdbId: n(r[2]),
			score: n(r[3]),
			createdAt: nn(r[4]),
			year: nn(r[5]),
			genres: Array.isArray(r[6]) ? r[6].map(String) : [],
		})),
		importedScores: importedScores.map((r) => ({
			userId: s(r[0]),
			type: type(r[1]),
			tmdbId: n(r[2]),
		})),
		movieMinutes: movieMinutes.map((r) => ({
			userId: s(r[0]),
			minutes: n(r[1]),
		})),
		episodeMinutes: episodeMinutes.map((r) => ({
			userId: s(r[0]),
			minutes: n(r[1]),
		})),
		watches: watches.map((r) => ({
			userId: s(r[0]),
			type: type(r[1]),
			watches: n(r[2]),
		})),
		showWatches: showWatches.map((r) => ({
			userId: s(r[0]),
			tmdbId: n(r[1]),
			watches: n(r[2]),
		})),
		seen: seen.map((r) => ({
			userId: s(r[0]),
			type: type(r[1]),
			tmdbId: n(r[2]),
		})),
		wishlist: wishlist.map((r) => ({
			userId: s(r[0]),
			type: type(r[1]),
			tmdbId: n(r[2]),
			createdAt: nn(r[3]),
			runtime: nn(r[4]),
		})),
		imports: imports.map((r) => ({
			userId: s(r[0]),
			source: s(r[1]),
			added: n(r[2]),
		})),
		countries: countries.map((r) => ({
			userId: s(r[0]),
			code: s(r[1]).toUpperCase(),
		})),
	}
}

/** Ids per statement when member titles are read by id. */
export const MEMBER_TITLES_PER_STATEMENT = 5000

/**
 * Names, posters and IMDb scores of the titles the member lists could show. Every one is read: the ids go in
 * statements of MEMBER_TITLES_PER_STATEMENT, each limited to its own id count, so no limit cuts a title off.
 */
export async function readMemberTitles(
	db: Reader,
	gate: Gate,
	agg: MemberAggregates,
): Promise<MemberTitleRow[]> {
	const keys = memberTitleKeys(agg)
	const read = (type: MediaType) => {
		const all = keys.filter((k) => k.type === type).map((k) => k.tmdbId)
		const chunks: number[][] = []
		for (let i = 0; i < all.length; i += MEMBER_TITLES_PER_STATEMENT)
			chunks.push(all.slice(i, i + MEMBER_TITLES_PER_STATEMENT))
		return chunks.map(
			(chunk, i) => () =>
				db.rows(
					`member titles, ${type}s${chunks.length > 1 ? ` ${i + 1}/${chunks.length}` : ""}`,
					`SELECT ${TITLE_COLS}, imdb_user_score_original FROM doc.${type} WHERE tmdb_id IN (${ids(chunk)}) LIMIT ${chunk.length}`,
				),
		)
	}
	const movies = read("movie")
	const shows = read("show")
	const rows = await together(gate, [...movies, ...shows])
	return rows.flatMap((part, i) =>
		part.map((r) => ({
			...titleOf(i < movies.length ? "movie" : "show", r),
			imdb: nn(r[4]),
		})),
	)
}

export type { Counts }
