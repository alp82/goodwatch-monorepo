import assert from "node:assert/strict"
import { test } from "node:test"
import type {
	MemberStats,
	StatsEpisode,
	StatsTitle,
} from "../../domain/stats/snapshot.ts"
import {
	CONTESTED_METACRITIC,
	LETTERBOXD_WHOLE_SERIES,
	buildStatsSnapshot,
	fillBuckets,
	missingParts,
	tropeName,
} from "./build.ts"
import type { RawCatalog, RawMetacritic } from "./raw.ts"

const NOW = Date.UTC(2026, 10, 15)
const DAY = 86_400_000

const movie = (tmdbId: number, name = `Movie ${tmdbId}`): StatsTitle => ({
	type: "movie",
	tmdbId,
	title: name,
	year: 2000,
	poster: "/p.jpg",
})
const show = (tmdbId: number): StatsTitle => ({
	...movie(tmdbId),
	type: "show",
})
const range = (n: number, from = 1) =>
	Array.from({ length: n }, (_, i) => from + i)
const meta = (tmdbId: number): RawMetacritic => ({
	...movie(tmdbId),
	metascore: 90,
	criticReviews: 30,
	userScore: 4,
	userRatings: 500,
})
const episode = (n: number): StatsEpisode => ({
	showId: n,
	show: `Show ${n}`,
	poster: null,
	season: 1,
	episode: n,
	name: `Episode ${n}`,
	imdb: 9,
	votes: 100_000,
})

/** A raw read with every list long enough, so a test changes only what it is about. */
function raw(): RawCatalog {
	const movies = <T>(extra: T) =>
		range(8).map((i) => ({ ...movie(i), ...extra }))
	return {
		catalog: {
			movies: 10,
			shows: 2,
			seasons: 3,
			episodes: 40,
			people: 5,
			castCredits: 6,
			crewCredits: 7,
			characters: 8,
			characterPortraits: 2,
			posters: 9,
			backdrops: 4,
			logos: 1,
			trailers: 3,
			movieMinutes: 1000,
			episodeMinutes: 2000,
		},
		sources: {
			imdbMovieVotes: 1,
			imdbShowVotes: 1,
			imdbTitles: 1,
			imdbEpisodeVotes: 1,
			letterboxdTitles: 1,
			letterboxdRatings: 1,
			tmdbVotes: 1,
			metacriticTitles: 1,
			metacriticCriticReviews: 1,
			metacriticUserRatings: 1,
			rottenTomatoesTitles: 1,
			goodwatchScored: 1,
			titleAnalysis: 1,
		},
		charts: {
			moviesByDecade: range(5).map((i) => ({
				decade: 1950 + i * 10,
				titles: i,
			})),
			runtimeByDecade: range(5).map((i) => ({
				decade: 1950 + i * 10,
				minutes: 90.4,
			})),
			genres: range(12).map((i) => ({ name: `Genre ${i}`, titles: i })),
			languages: [{ code: "en", titles: 5 }],
			imdbBuckets: [
				{ bucket: 0, titles: 1 },
				{ bucket: 1, titles: 2 },
				{ bucket: 9, titles: 3 },
			],
			metascoreBuckets: [
				{ bucket: 0, titles: 1 },
				{ bucket: 100, titles: 2 },
			],
		},
		seriesAsMovies: [],
		records: {
			mostImdbVotesMovies: movies({ votes: 10 }),
			mostImdbVotesShows: range(5).map((i) => ({ ...show(i), votes: 10 })),
			mostLetterboxdRatings: movies({ ratings: 10 }),
			highestLetterboxd: movies({ score: 4.5, ratings: 10 }),
			imdbOverLetterboxd: movies({ imdb: 6, imdbVotes: 10, letterboxd: 1.5 }),
			letterboxdOverImdb: movies({ imdb: 3, imdbVotes: 10, letterboxd: 3.5 }),
			criticsVsAudience: movies({ critics: 90, audience: 20 }),
			topGoodwatchMovies: movies({ score: 90 }),
			topGoodwatchShows: range(5).map((i) => ({ ...show(i), score: 90 })),
			oldest: movies({}),
			longest: movies({ runtime: 500 }),
			mostEpisodes: range(5).map((i) => ({
				...show(i),
				episodes: 100,
				seasons: 3,
			})),
			highestGrossing: movies({
				revenue: 1e9,
				budget: 1e8,
				released: NOW - 3 * 365 * DAY,
			}),
			mostTropes: range(5).map((i) => ({ ...show(i), tropes: 100 })),
			highestMetascoreMovies: range(8).map(meta),
			highestMetascoreShows: range(8).map(meta),
			lowestMetascoreMovies: range(8).map(meta),
			criticsOverUsers: range(8).map(meta),
			usersOverCritics: range(8).map(meta),
		},
		episodes: {
			mostVoted: range(8).map(episode),
			lowestRated: range(8).map(episode),
			highestRated: range(8).map(episode),
		},
		tropes: {
			mentions: 100,
			distinct: 10,
			top: [
				{
					url: "https://tvtropes.org/pmwiki/pmwiki.php/Main/ShoutOut",
					titles: 9,
				},
				{
					url: "https://tvtropes.org/pmwiki/pmwiki.php/Main/BookEnds",
					titles: 8,
				},
			],
			headings: [
				{
					url: "https://tvtropes.org/pmwiki/pmwiki.php/Main/ShoutOut",
					title: "Shout-Out",
				},
			],
			essenceTags: [{ name: "Cozy", titles: 3 }],
			moods: { binge: 1, comfort: 2, thoughtProvoking: 3, background: 4 },
		},
		streaming: {
			offers: 100,
			titles: 10,
			countries: 5,
			services: 3,
			byType: [{ type: "flatrate", offers: 50 }],
			byCountry: ["US", "GB", "DE", "CA", "FR"].map((code, i) => ({
				code,
				offers: 50 - i,
			})),
			byService: [
				{ id: 8, offers: 40 },
				{ id: 1796, offers: 30 },
				{ id: 9, offers: 20 },
			],
			serviceNames: [
				{ id: 8, name: "Netflix", logo: "/n.png" },
				{ id: 8, name: "Netflix", logo: "/n.png" },
				{ id: 1796, name: "Netflix", logo: "/n2.png" },
				{ id: 9, name: "Prime Video", logo: null },
			],
			mostCountries: movies({ countries: 139 }),
		},
		awards: {
			results: 10,
			wins: 4,
			titles: 3,
			people: 2,
			firstYear: 1928,
			lastYear: 2026,
			bodies: [
				{ name: "Academy Awards", results: 6 },
				{ name: "Baeksang Arts Awards", results: 4 },
			],
			mostWins: [{ ...movie(1), wins: 11 }],
			mostAwarded: [{ tmdbId: 7, wins: 3, nominations: 9 }],
			names: [{ tmdbId: 7, name: "A Person", profile: null }],
		},
		people: {
			castCredits: [
				{ tmdbId: 7, credits: 900 },
				{ tmdbId: 8, credits: 800 },
			],
			names: [{ tmdbId: 7, name: "A Person", profile: null }],
		},
		trivia: {
			commonTitles: ["Home", "Untitled", "Alone", "Mother", "Echo", "Gift"].map(
				(title, i) => ({ title, movies: 100 - i }),
			),
			commonRoles: [
				{ role: "doctor", credits: 9 },
				{ role: "anna", credits: 8 },
				{ role: "nurse", credits: 7 },
			],
			christmas: 300,
			zombies: 200,
			sharks: 100,
			oneLetterTitles: movies({ imdb: 7, votes: 10 }),
			longestTitles: movies({ letters: 100 }),
			friday13Horror: 30,
			friday13Top: movies({ imdb: 6, votes: 10 }),
			busiestYears: [{ year: 2019, movies: 9000 }],
			biggestSeries: [{ id: 1, name: "Beck Collection", movies: 38 }],
			boxOfficePerMinute: movies({
				revenue: 1e9,
				runtime: 120,
				released: NOW - 3 * 365 * DAY,
			}),
			sourcesAgree: movies({
				imdb: 7,
				letterboxd: 3.5,
				metascore: 70,
				tomatometer: 70,
			}),
		},
	}
}

const members = {} as MemberStats

test("buckets fill a fixed array; rows outside it are dropped", () => {
	assert.deepEqual(
		fillBuckets(
			[
				{ bucket: 2, titles: 4 },
				{ bucket: 12, titles: 1 },
			],
			3,
			(b) => b,
		),
		[0, 0, 4],
	)
})

test("the IMDb spread folds scores under 2 into the 1s; Metascores keep the perfect 100", () => {
	const s = buildStatsSnapshot(raw(), members, NOW)
	assert.deepEqual(s.charts.imdbSpread, [3, 0, 0, 0, 0, 0, 0, 0, 3, 0])
	assert.equal(s.charts.metascoreSpread.length, 11)
	assert.equal(s.charts.metascoreSpread[10], 2)
})

test("a series stored as a movie is left out of the movie records", () => {
	const r = raw()
	r.seriesAsMovies = [1]
	const s = buildStatsSnapshot(r, members, NOW)
	assert.equal(s.records.longest[0].tmdbId, 2)
	assert.ok(!s.records.mostImdbVotesMovies.some((t) => t.tmdbId === 1))
	assert.equal(s.records.longest.length, 5)
})

test("a Letterboxd page for a whole series is left out of the Letterboxd lists", () => {
	const r = raw()
	const [series] = LETTERBOXD_WHOLE_SERIES
	r.records.highestLetterboxd.unshift({
		...movie(series, "Twin Peaks"),
		score: 4.66,
		ratings: 375_652,
	})
	const s = buildStatsSnapshot(r, members, NOW)
	assert.ok(!s.records.highestLetterboxd.some((t) => t.tmdbId === series))
})

test("box office counts only for movies out at least a year", () => {
	const r = raw()
	r.records.highestGrossing.unshift({
		...movie(99, "Out in July"),
		revenue: 9e9,
		budget: null,
		released: NOW - 100 * DAY,
	})
	r.trivia.boxOfficePerMinute.unshift({
		...movie(99, "Out in July"),
		revenue: 9e9,
		runtime: 100,
		released: null,
	})
	const s = buildStatsSnapshot(r, members, NOW)
	assert.equal(s.records.highestGrossing[0].tmdbId, 1)
	assert.ok(!("released" in s.records.highestGrossing[0]))
	assert.equal(s.trivia.boxOfficePerMinute[0].tmdbId, 1)
})

test("contested titles are left out of the Metacritic extremes", () => {
	const r = raw()
	const [contested] = CONTESTED_METACRITIC
	r.records.criticsOverUsers.unshift(meta(contested))
	const s = buildStatsSnapshot(r, members, NOW)
	assert.ok(!s.records.criticsOverUsers.some((t) => t.tmdbId === contested))
})

test("each service shows once, by id and by name", () => {
	const s = buildStatsSnapshot(raw(), members, NOW)
	assert.deepEqual(
		s.streaming.topServices.map((x) => x.name),
		["Netflix", "Prime Video"],
	)
	assert.deepEqual(s.streaming.fewestCountry, { code: "FR", offers: 46 })
})

test("trivia drops Untitled, splits first names from jobs and shortens series names", () => {
	const s = buildStatsSnapshot(raw(), members, NOW)
	assert.deepEqual(s.trivia.commonTitles.map((t) => t.title).slice(0, 3), [
		"Home",
		"Alone",
		"Mother",
	])
	assert.deepEqual(
		s.trivia.commonRoles.map((r) => r.role),
		["doctor", "nurse"],
	)
	assert.equal(s.trivia.topFirstName?.role, "anna")
	assert.equal(s.trivia.biggestSeries[0].name, "Beck")
})

test("tropes take the TV Tropes heading, or a name read from the address", () => {
	const s = buildStatsSnapshot(raw(), members, NOW)
	assert.deepEqual(
		s.tropes.top.map((t) => t.name),
		["Shout-Out", "Book Ends"],
	)
	assert.equal(
		tropeName("https://tvtropes.org/pmwiki/pmwiki.php/Main/ChekhovsGun"),
		"Chekhovs Gun",
	)
})

test("awards know whether the Oscars and the Baeksang Arts Awards are both in", () => {
	const s = buildStatsSnapshot(raw(), members, NOW)
	assert.equal(s.awards.oscarsToBaeksang, true)
	assert.equal(s.awards.bodies, 2)
	assert.equal(s.awards.mostAwardedPeople[0].name, "A Person")
	assert.deepEqual(
		s.people.mostCastCredits.map((p) => p.tmdbId),
		[7],
	)
})

test("a complete read is complete; a short list is named", () => {
	assert.deepEqual(missingParts(buildStatsSnapshot(raw(), members, NOW)), [])
	const r = raw()
	r.records.mostEpisodes = r.records.mostEpisodes.slice(0, 2)
	r.trivia.commonTitles = []
	assert.deepEqual(missingParts(buildStatsSnapshot(r, members, NOW)), [
		"records.mostEpisodes",
		"trivia.commonTitles",
	])
})
