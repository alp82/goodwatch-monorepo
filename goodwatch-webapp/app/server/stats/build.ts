// Raw rows (raw.ts) to the /stats snapshot: suspect rows out, lists cut to what the page shows, buckets filled.
// Pure, so build.test.ts runs it on fixtures. What counts as suspect, and why:
//
// - A series stored as a movie: a movie that shares its IMDb id with a show that has 50 or more TMDB votes (Kingdom
//   Hospital as a 608-minute movie). Left out of every movie record. A show with fewer votes that carries a movie's
//   IMDb id is the mislinked one, so Fight Club stays.
// - LETTERBOXD_WHOLE_SERIES: movie pages Letterboxd uses to rate a whole series, so their score and count are the
//   series' (Twin Peaks, 1989: 375,000 ratings on a pilot with 4,000 IMDb votes).
// - Box office before the run is over: TMDB revenue of a movie out for less than a year is a running figure,
//   sometimes a guess. Records need a movie released at least a year before the snapshot.
// - A perfect IMDb 10 on 1,000 or more votes: no real movie has one (in November 2026 three pages did, none with
//   TMDB votes). Left out of the IMDb score spread.
// - CONTESTED_METACRITIC: titles whose Metacritic critics and users split over politics or a campaign, not over the
//   movie. Left out of the Metacritic extremes so the extremes say something about movies.
//
// Checked against Letterboxd on November 15, 2026 and kept: One Direction: This Is Us's 4.37 average (93,534
// ratings; fans rate it) and Obsession's 5.56 million ratings (a 2025 release on Letterboxd).
import {
	type AwardStats,
	type ChartStats,
	type MetacriticTitle,
	STATS_SNAPSHOT_VERSION,
	type StatsSnapshot,
	type StatsTitle,
	type StreamingStats,
	type TriviaStats,
} from "../../domain/stats/snapshot.ts"
import type { MemberStats } from "../../domain/stats/snapshot.ts"
import type { Bucket, RawCatalog, RawMetacritic } from "./raw.ts"

/** Letterboxd film pages that hold a whole series' ratings, by TMDB movie id. */
export const LETTERBOXD_WHOLE_SERIES = new Set([
	452522, // Twin Peaks (1989): Letterboxd's page for the series
])

/** Titles left out of the Metacritic extremes, by TMDB movie id. */
export const CONTESTED_METACRITIC = new Set([
	391995, // Hillary's America: The Secret History of the Democratic Party
	1413097, // Melania
	582885, // Cuties
	724495, // The Woman King
	411019, // I Am Not Your Negro
	420808, // Peter Pan & Wendy
])

const YEAR_MS = 365.25 * 86_400_000

/** How many rows each list keeps. */
const KEEP = {
	ranked: 5,
	runners: 5,
	metacritic: 5,
	versus: 5,
	tropes: 12,
	essence: 12,
	genres: 10,
	languages: 12,
	countries: 10,
	services: 8,
	awardBodies: 8,
	mostWins: 6,
	people: 5,
	commonTitles: 8,
	roles: 15,
	oneLetter: 6,
	longestTitles: 3,
	friday13: 5,
	series: 5,
	episodes: 6,
}

/** Common first names among character names: the roles card asks for jobs and names the top first name apart. */
const FIRST_NAMES = new Set([
	"anna",
	"maria",
	"david",
	"alex",
	"sam",
	"john",
	"michael",
	"sarah",
	"tom",
	"mary",
	"paul",
	"peter",
	"jack",
	"nick",
])

/** Bucket rows to a fixed array: `index(bucket)` places a row, rows outside are dropped. */
export function fillBuckets(
	rows: Bucket[],
	length: number,
	index: (bucket: number) => number,
): number[] {
	const out = Array.from({ length }, () => 0)
	for (const row of rows) {
		const at = index(row.bucket)
		if (at >= 0 && at < length) out[at] += row.titles
	}
	return out
}

const title = <T extends StatsTitle>(row: T): StatsTitle => ({
	type: row.type,
	tmdbId: row.tmdbId,
	title: row.title,
	year: row.year,
	poster: row.poster,
})

/** The movie rows that aren't suspect for any record. */
function cleanMovies(raw: RawCatalog) {
	const series = new Set(raw.seriesAsMovies)
	return <T extends StatsTitle>(rows: T[]) =>
		rows.filter((r) => r.type !== "movie" || !series.has(r.tmdbId))
}

const metacritic = (row: RawMetacritic): MetacriticTitle => ({
	...title(row),
	metascore: row.metascore,
	criticReviews: row.criticReviews,
	userScore: row.userScore,
})

function charts(raw: RawCatalog): ChartStats {
	const c = raw.charts
	return {
		moviesByDecade: c.moviesByDecade,
		runtimeByDecade: c.runtimeByDecade.map((d) => ({
			decade: d.decade,
			minutes: Math.round(d.minutes),
		})),
		genres: c.genres.slice(0, KEEP.genres),
		languages: c.languages.slice(0, KEEP.languages),
		// Scores under 2 join the 1s, so the bars are always the ten whole scores.
		imdbSpread: fillBuckets(c.imdbBuckets, 10, (b) => Math.max(0, b - 1)),
		metascoreSpread: fillBuckets(c.metascoreBuckets, 11, (b) => b / 10),
	}
}

function streaming(raw: RawCatalog): StreamingStats {
	const s = raw.streaming
	const names = new Map<number, { name: string; logo: string | null }>()
	for (const row of s.serviceNames)
		if (!names.has(row.id))
			names.set(row.id, { name: row.name, logo: row.logo })
	// The service table holds a row per service and country: one name per id, and one row per name.
	const seen = new Set<string>()
	const topServices = s.byService.flatMap((row) => {
		const service = names.get(row.id)
		if (!service || seen.has(service.name)) return []
		seen.add(service.name)
		return [{ id: row.id, ...service, offers: row.offers }]
	})
	return {
		offers: s.offers,
		titles: s.titles,
		countries: s.countries,
		services: s.services,
		byType: s.byType,
		topCountries: s.byCountry.slice(0, KEEP.countries),
		fewestCountry: s.byCountry.at(-1) ?? null,
		topServices: topServices.slice(0, KEEP.services),
		mostCountries: cleanMovies(raw)(s.mostCountries).slice(0, KEEP.ranked),
	}
}

function awards(raw: RawCatalog): AwardStats {
	const a = raw.awards
	const names = new Map(a.names.map((p) => [p.tmdbId, p]))
	const bodies = new Set(a.bodies.map((b) => b.name))
	return {
		results: a.results,
		wins: a.wins,
		titles: a.titles,
		people: a.people,
		bodies: a.bodies.length,
		firstYear: a.firstYear,
		lastYear: a.lastYear,
		byBody: a.bodies.slice(0, KEEP.awardBodies),
		oscarsToBaeksang:
			bodies.has("Academy Awards") && bodies.has("Baeksang Arts Awards"),
		mostWins: a.mostWins.slice(0, KEEP.mostWins),
		mostAwardedPeople: a.mostAwarded.flatMap((p) => {
			const person = names.get(p.tmdbId)
			return person
				? [{ ...person, wins: p.wins, nominations: p.nominations }]
				: []
		}),
	}
}

function trivia(raw: RawCatalog, now: number): TriviaStats {
	const t = raw.trivia
	const clean = cleanMovies(raw)
	// "Untitled" stands in for movies without a name yet; nobody chose it.
	const commonTitles = t.commonTitles
		.filter((x) => x.title.trim().toLowerCase() !== "untitled")
		.slice(0, KEEP.commonTitles)
	const jobs = t.commonRoles.filter((r) => !FIRST_NAMES.has(r.role))
	return {
		commonTitles,
		commonRoles: jobs.slice(0, KEEP.roles),
		topFirstName: t.commonRoles.find((r) => FIRST_NAMES.has(r.role)) ?? null,
		christmas: t.christmas,
		zombies: t.zombies,
		sharks: t.sharks,
		oneLetterTitles: clean(t.oneLetterTitles).slice(0, KEEP.oneLetter),
		longestTitles: clean(t.longestTitles).slice(0, KEEP.longestTitles),
		friday13Horror: t.friday13Horror,
		friday13Top: clean(t.friday13Top).slice(0, KEEP.friday13),
		busiestYears: t.busiestYears.slice(0, 3),
		biggestSeries: t.biggestSeries
			.map((s) => ({ ...s, name: s.name.replace(/ (Collection|Movies)$/, "") }))
			.slice(0, KEEP.series),
		boxOfficePerMinute: clean(t.boxOfficePerMinute)
			.filter((r) => r.released !== null && r.released <= now - YEAR_MS)
			.slice(0, KEEP.ranked)
			.map(({ released: _, ...r }) => r),
		sourcesAgree: clean(t.sourcesAgree).slice(0, KEEP.ranked),
	}
}

export function buildStatsSnapshot(
	raw: RawCatalog,
	members: MemberStats,
	now: number,
): StatsSnapshot {
	const r = raw.records
	const clean = cleanMovies(raw)
	const notContested = (row: RawMetacritic) =>
		!CONTESTED_METACRITIC.has(row.tmdbId)
	const meta = (rows: RawMetacritic[]) =>
		clean(rows).filter(notContested).map(metacritic).slice(0, KEEP.metacritic)
	const bothMeta = (rows: RawMetacritic[]) =>
		meta(rows.filter((x) => x.userScore !== null)) as (MetacriticTitle & {
			userScore: number
		})[]
	const letterboxd = <T extends StatsTitle>(rows: T[]) =>
		clean(rows).filter((x) => !LETTERBOXD_WHOLE_SERIES.has(x.tmdbId))
	const headings = new Map(raw.tropes.headings.map((h) => [h.url, h.title]))
	return {
		version: STATS_SNAPSHOT_VERSION,
		generatedAt: new Date(now).toISOString(),
		catalog: raw.catalog,
		sources: raw.sources,
		charts: charts(raw),
		records: {
			mostImdbVotesMovies: clean(r.mostImdbVotesMovies).slice(0, KEEP.ranked),
			mostImdbVotesShows: r.mostImdbVotesShows.slice(0, KEEP.ranked),
			mostLetterboxdRatings: letterboxd(r.mostLetterboxdRatings).slice(
				0,
				KEEP.ranked,
			),
			highestLetterboxd: letterboxd(r.highestLetterboxd).slice(0, KEEP.ranked),
			imdbOverLetterboxd: letterboxd(r.imdbOverLetterboxd).slice(
				0,
				KEEP.versus,
			),
			letterboxdOverImdb: letterboxd(r.letterboxdOverImdb).slice(
				0,
				KEEP.versus,
			),
			criticsVsAudience: clean(r.criticsVsAudience).slice(0, KEEP.versus),
			topGoodwatchMovies: clean(r.topGoodwatchMovies).slice(0, KEEP.ranked),
			topGoodwatchShows: r.topGoodwatchShows.slice(0, KEEP.ranked),
			oldest: clean(r.oldest).slice(0, KEEP.ranked).map(title),
			longest: clean(r.longest).slice(0, KEEP.ranked),
			mostEpisodes: r.mostEpisodes.slice(0, KEEP.ranked),
			highestGrossing: clean(r.highestGrossing)
				.filter((x) => x.released !== null && x.released <= now - YEAR_MS)
				.slice(0, KEEP.ranked)
				.map(({ released: _, ...x }) => x),
			mostTropes: r.mostTropes.slice(0, KEEP.ranked),
			highestMetascoreMovies: meta(r.highestMetascoreMovies),
			highestMetascoreShows: meta(r.highestMetascoreShows),
			lowestMetascoreMovies: meta(r.lowestMetascoreMovies),
			criticsOverUsers: bothMeta(r.criticsOverUsers),
			usersOverCritics: bothMeta(r.usersOverCritics),
		},
		episodes: {
			mostVoted: raw.episodes.mostVoted.slice(0, KEEP.episodes),
			lowestRated: raw.episodes.lowestRated.slice(0, KEEP.episodes),
			highestRated: raw.episodes.highestRated.slice(0, KEEP.episodes),
		},
		tropes: {
			mentions: raw.tropes.mentions,
			distinct: raw.tropes.distinct,
			top: raw.tropes.top.slice(0, KEEP.tropes).map((t) => ({
				...t,
				name: headings.get(t.url) ?? tropeName(t.url),
			})),
			essenceTags: raw.tropes.essenceTags.slice(0, KEEP.essence),
			moods: raw.tropes.moods,
		},
		streaming: streaming(raw),
		awards: awards(raw),
		people: {
			mostCastCredits: (() => {
				const names = new Map(raw.people.names.map((p) => [p.tmdbId, p]))
				return raw.people.castCredits.flatMap((p) => {
					const person = names.get(p.tmdbId)
					return person ? [{ ...person, credits: p.credits }] : []
				})
			})().slice(0, KEEP.people),
		},
		trivia: trivia(raw, now),
		members,
	}
}

/** A trope's name from its TV Tropes address when the catalog has no heading: "BookEnds" reads "Book Ends". */
export const tropeName = (url: string) =>
	decodeURIComponent(url.split("/").at(-1) ?? "Trope")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/_/g, " ")

/**
 * The lists the page can't do without, each with the fewest rows it reads. A refresh that comes back short keeps the
 * last snapshot instead (stats.server.ts).
 */
export function missingParts(s: StatsSnapshot): string[] {
	const need: [string, number, number][] = [
		["catalog.movies", s.catalog.movies, 1],
		["catalog.episodes", s.catalog.episodes, 1],
		["charts.moviesByDecade", s.charts.moviesByDecade.length, 3],
		["charts.runtimeByDecade", s.charts.runtimeByDecade.length, 2],
		["charts.genres", s.charts.genres.length, 3],
		["records.mostImdbVotesMovies", s.records.mostImdbVotesMovies.length, 3],
		["records.mostImdbVotesShows", s.records.mostImdbVotesShows.length, 1],
		[
			"records.mostLetterboxdRatings",
			s.records.mostLetterboxdRatings.length,
			1,
		],
		["records.highestLetterboxd", s.records.highestLetterboxd.length, 1],
		["records.imdbOverLetterboxd", s.records.imdbOverLetterboxd.length, 1],
		["records.letterboxdOverImdb", s.records.letterboxdOverImdb.length, 1],
		["records.criticsVsAudience", s.records.criticsVsAudience.length, 1],
		["records.topGoodwatchMovies", s.records.topGoodwatchMovies.length, 1],
		["records.oldest", s.records.oldest.length, 1],
		["records.longest", s.records.longest.length, 1],
		["records.mostEpisodes", s.records.mostEpisodes.length, 3],
		["records.highestGrossing", s.records.highestGrossing.length, 1],
		["records.mostTropes", s.records.mostTropes.length, 1],
		[
			"records.highestMetascoreMovies",
			s.records.highestMetascoreMovies.length,
			1,
		],
		[
			"records.highestMetascoreShows",
			s.records.highestMetascoreShows.length,
			1,
		],
		[
			"records.lowestMetascoreMovies",
			s.records.lowestMetascoreMovies.length,
			1,
		],
		["records.criticsOverUsers", s.records.criticsOverUsers.length, 1],
		["records.usersOverCritics", s.records.usersOverCritics.length, 2],
		["episodes.mostVoted", s.episodes.mostVoted.length, 3],
		["episodes.lowestRated", s.episodes.lowestRated.length, 1],
		["episodes.highestRated", s.episodes.highestRated.length, 1],
		["tropes.top", s.tropes.top.length, 1],
		["streaming.topCountries", s.streaming.topCountries.length, 4],
		["streaming.topServices", s.streaming.topServices.length, 1],
		["streaming.mostCountries", s.streaming.mostCountries.length, 1],
		["awards.mostWins", s.awards.mostWins.length, 1],
		["trivia.commonTitles", s.trivia.commonTitles.length, 4],
		["trivia.commonRoles", s.trivia.commonRoles.length, 2],
		["trivia.oneLetterTitles", s.trivia.oneLetterTitles.length, 3],
		["trivia.longestTitles", s.trivia.longestTitles.length, 1],
		["trivia.friday13Top", s.trivia.friday13Top.length, 1],
		["trivia.busiestYears", s.trivia.busiestYears.length, 1],
		["trivia.biggestSeries", s.trivia.biggestSeries.length, 1],
		["trivia.boxOfficePerMinute", s.trivia.boxOfficePerMinute.length, 1],
		["trivia.sourcesAgree", s.trivia.sourcesAgree.length, 1],
	]
	return need.filter(([, n, min]) => n < min).map(([name]) => name)
}
