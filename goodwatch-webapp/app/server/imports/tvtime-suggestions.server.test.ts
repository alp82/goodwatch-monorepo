import assert from "node:assert/strict"
import { test } from "node:test"
import { suggestTvtimeMovie } from "./tvtime-suggestions.server.ts"
test("typographic apostrophes do not prevent an otherwise exact movie identity", async () => {
	const result = await suggestTvtimeMovie(
		{ titles: ["A Director’s Story"], dates: ["2001-02-03"], countries: [] },
		{
			get: async (path) =>
				path === "/search/movie"
					? { results: [{ id: 42 }], total_pages: 1 }
					: {
							id: 42,
							title: "A Director's Story",
							original_title: "A Director's Story",
							release_date: "2001-02-03",
							alternative_titles: { titles: [] },
							translations: { translations: [] },
							release_dates: { results: [] },
						},
			catalog: async () => ({
				title: "A Director's Story",
				year: 2001,
				posterPath: null,
			}),
		},
	)
	assert.equal(result.proposal?.tmdbId, 42)
})
const evidence = {
	titles: ["Localized movie"],
	dates: ["2001-02-03"],
	countries: ["DE"],
}
const movie = {
	id: 42,
	title: "Another title",
	original_title: "Original",
	release_date: "2001-01-01",
	alternative_titles: {
		titles: [{ title: "Localized movie", iso_3166_1: "DE" }],
	},
	translations: { translations: [] },
	release_dates: {
		results: [
			{
				iso_3166_1: "DE",
				release_dates: [{ release_date: "2001-02-03T00:00:00Z", type: 3 }],
			},
		],
	},
}
test("one exact primary title and release year recovers inconsistent release days, while same-year remakes stay unresolved", async () => {
	const get = async (path: string) =>
		path === "/search/movie"
			? { results: [{ id: 42 }], total_pages: 1 }
			: { ...movie, title: "Localized movie", release_dates: { results: [] } }
	const catalog = async () => ({
		title: "Localized movie",
		year: 2001,
		posterPath: null,
	})
	const result = await suggestTvtimeMovie(evidence, { get, catalog })
	assert.equal(result.state, "suggested")
	assert.equal(result.proof?.rule, "tvtime_exact_title_release_year_v1")
	assert.deepEqual(result.proof?.date, { value: "2001", basis: "year" })
	const ambiguous = await suggestTvtimeMovie(evidence, {
		get: async (path) =>
			path === "/search/movie"
				? { results: [{ id: 42 }, { id: 43 }], total_pages: 1 }
				: {
						...movie,
						id: path === "/movie/42" ? 42 : 43,
						title: "Localized movie",
						release_dates: { results: [] },
					},
		catalog,
	})
	assert.equal(ambiguous.state, "manual")
	assert.equal(ambiguous.reason, "tvtime_suggestion_ambiguous")
})
test("strict movie suggestions record exact alternative title and same-country theatrical date proof", async () => {
	const result = await suggestTvtimeMovie(evidence, {
		get: async (path) =>
			path === "/search/movie"
				? { results: [{ id: 42 }], total_pages: 1 }
				: movie,
		catalog: async () => ({
			title: "Catalog movie",
			year: 2001,
			posterPath: null,
		}),
		now: () => 1000,
	})
	assert.equal(result.state, "suggested")
	assert.equal(result.proposal?.tmdbId, 42)
	assert.equal(result.proof?.rule, "tvtime_exact_title_release_date_v1")
	assert.equal(result.proof?.title.kind, "alternative")
	assert.deepEqual(result.proof?.date, {
		value: "2001-02-03",
		basis: "country",
		country: "DE",
		releaseType: 3,
	})
	assert.equal(result.proof?.candidateCount, 1)
	assert.equal(result.proof?.title.locale, "und")
	assert.equal(result.proof?.sourceCountry, "DE")
	assert.equal(result.proof?.verifiedCandidates, 1)
})
test("strict suggestions hold truncated searches, fuzzy titles, foreign dates, digital dates and conflicting evidence", async () => {
	const cases = [
		{
			e: evidence,
			m: movie,
			pages: 6,
			reason: "tvtime_suggestion_search_incomplete",
		},
		{
			e: evidence,
			m: {
				...movie,
				alternative_titles: {
					titles: [{ title: "Localized movie!", iso_3166_1: "DE" }],
				},
			},
			reason: "tvtime_suggestion_no_exact_match",
		},
		{
			e: { ...evidence, countries: ["FR"] },
			m: movie,
			reason: "tvtime_suggestion_no_exact_match",
		},
		{
			e: evidence,
			m: {
				...movie,
				release_dates: {
					results: [
						{
							iso_3166_1: "DE",
							release_dates: [{ release_date: "2001-02-03", type: 4 }],
						},
					],
				},
			},
			reason: "tvtime_suggestion_no_exact_match",
		},
		{
			e: { ...evidence, dates: ["2001-02-03", "2001-02-04"] },
			m: movie,
			reason: "conflicting_source_evidence",
		},
	]
	for (const c of cases) {
		const r = await suggestTvtimeMovie(c.e, {
			get: async (path) =>
				path === "/search/movie"
					? { results: [{ id: 42 }], total_pages: c.pages ?? 1 }
					: c.m,
			catalog: async () => ({
				title: "Catalog movie",
				year: 2001,
				posterPath: null,
			}),
		})
		assert.equal(r.state, "manual")
		assert.equal(r.reason, c.reason)
	}
})
test("a second exact TMDB candidate prevents a suggestion even when absent from the GoodWatch catalog", async () => {
	const r = await suggestTvtimeMovie(evidence, {
		get: async (path) =>
			path === "/search/movie"
				? { results: [{ id: 42 }, { id: 43 }], total_pages: 1 }
				: { ...movie, id: Number(path.split("/").at(-1)) },
		catalog: async (id) =>
			id === 42 ? { title: "Movie", year: 2001, posterPath: null } : null,
	})
	assert.equal(r.reason, "tvtime_suggestion_ambiguous")
})
test("a provider failure is held rather than producing a partially verified suggestion", async () => {
	const r = await suggestTvtimeMovie(evidence, {
		get: async () => {
			throw Error("offline")
		},
		catalog: async () => null,
	})
	assert.deepEqual(r, {
		state: "unavailable",
		reason: "tvtime_suggestion_unavailable",
	})
})

test("search year prefilter skips only dated candidates beyond one year; remaining candidates are fully verified", async () => {
	const details: number[] = []
	const result = await suggestTvtimeMovie(evidence, {
		get: async (path) => {
			if (path === "/search/movie")
				return {
					results: [
						{ id: 42, title: "Localized movie", release_date: "2001-01-01" },
						{ id: 43, title: "Another name", release_date: "1990-01-01" },
						{ id: 44, title: "Unknown date", release_date: "" },
					],
					total_pages: 1,
				}
			const id = Number(path.split("/").at(-1))
			details.push(id)
			if (id === 43)
				throw Error("A far-year candidate must not request details")
			return id === 42
				? movie
				: { ...movie, id: 44, alternative_titles: { titles: [] } }
		},
		catalog: async () => ({
			title: "Catalog movie",
			year: 2001,
			posterPath: null,
		}),
	})
	assert.equal(result.state, "suggested")
	assert.deepEqual(details, [42, 44])
	assert.equal(result.proof?.verifiedCandidates, 2)
	assert.equal(result.proof?.discoveredCandidates, 3)
	assert.equal(result.proof?.yearExcludedCandidates, 1)
})

test("adjacent years, missing dates and conflicting duplicate search evidence still require full verification", async () => {
	for (const releaseDate of ["2000-01-01", "2002-01-01", "", "invalid"]) {
		let details = 0
		const result = await suggestTvtimeMovie(evidence, {
			get: async (path) => {
				if (path === "/search/movie")
					return {
						results: [
							{ id: 42, release_date: "2001-01-01" },
							{ id: 43, release_date: releaseDate },
						],
						total_pages: 1,
					}
				details++
				return { ...movie, id: Number(path.split("/").at(-1)) }
			},
			catalog: async () => ({ title: "Movie", year: 2001, posterPath: null }),
		})
		assert.equal(result.reason, "tvtime_suggestion_ambiguous")
		assert.equal(details, 2)
	}
	let details = 0
	const result = await suggestTvtimeMovie(evidence, {
		get: async (path) => {
			if (path === "/search/movie")
				return {
					results: [
						{ id: 42, release_date: "1990-01-01" },
						{ id: 42, release_date: "2001-01-01" },
					],
					total_pages: 1,
				}
			details++
			return movie
		},
		catalog: async () => ({ title: "Movie", year: 2001, posterPath: null }),
	})
	assert.equal(result.state, "suggested")
	assert.equal(details, 1)
})

test("an exact search title with an explicit country still verifies a distant country release", async () => {
	let details = 0
	const result = await suggestTvtimeMovie(evidence, {
		get: async (path) => {
			if (path === "/search/movie")
				return {
					results: [
						{ id: 42, title: "Localized movie", release_date: "2003-01-01" },
					],
					total_pages: 1,
				}
			details++
			return { ...movie, release_date: "2003-01-01" }
		},
		catalog: async () => ({ title: "Movie", year: 2003, posterPath: null }),
	})
	assert.equal(result.state, "suggested")
	assert.equal(details, 1)
	assert.equal(result.proof?.date.basis, "country")
})
